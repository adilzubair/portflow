"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type Holding } from "@/lib/constants";
import { tap, success as hapticSuccess, destructive as hapticDestructive, medium } from "@/lib/haptics";
import { DEFAULT_INR_TO_AED_RATE, getRateStorageKey, replaceRemoteHoldingsState } from "@/lib/dashboard/persistence";
import { buildBackfilledSnapshots } from "@/lib/history-backfill";
import { normalizeHoldings } from "@/lib/holdings-normalize";
import { fetchPortfolioSnapshots, replacePortfolioSnapshots } from "@/lib/portfolio-snapshots";
import { createClient } from "@/lib/supabase/client";

const REQUIRED_HOLDING_FIELDS: (keyof Holding)[] = [
  "id", "assetName", "ticker", "assetClass", "geography",
  "currency", "quantity", "avgBuyPrice", "currentPrice", "priceSource",
];

function validateHoldings(data: unknown): data is Holding[] {
  if (!Array.isArray(data)) return false;
  return data.every(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      REQUIRED_HOLDING_FIELDS.every((field) => field in item)
  );
}

interface ApiStatus {
  name: string;
  description: string;
  status: "ok" | "missing" | "unknown";
  keyRequired: boolean;
  envVar?: string;
}

const apiStatuses: ApiStatus[] = [
  { name: "MFAPI.in", description: "Indian mutual fund NAV data", status: "ok", keyRequired: false },
  { name: "CoinGecko", description: "Cryptocurrency prices", status: "ok", keyRequired: false },
  { name: "Frankfurter", description: "Currency exchange rates", status: "ok", keyRequired: false },
  { name: "Binance WebSocket", description: "Real-time BTC price stream", status: "ok", keyRequired: false },
  { name: "Yahoo Finance (India)", description: "Indian stocks and ETFs on NSE", status: "ok", keyRequired: false },
  { name: "Yahoo Finance (US ETFs)", description: "US stocks and ETFs", status: "ok", keyRequired: false },
  { name: "Twelve Data", description: "Optional fallback for UAE stocks on DFM", status: "unknown", keyRequired: true, envVar: "TWELVE_DATA_API_KEY" },
];

const IMPORT_FIELDS: { field: string; type: string; hint: string }[] = [
  { field: "id", type: "string", hint: 'Unique identifier — e.g. "holding-1"' },
  { field: "assetName", type: "string", hint: 'Display name — e.g. "Reliance Industries"' },
  { field: "ticker", type: "string", hint: 'Market symbol — e.g. "RELIANCE.NS", "BTC"' },
  { field: "assetClass", type: "enum", hint: "Stocks · ETFs · Crypto · Mutual Funds · Cash · Gold · Bonds · Others" },
  { field: "geography", type: "enum", hint: "India · US · UAE · Global · Others" },
  { field: "currency", type: "enum", hint: "AED · USD · INR" },
  { field: "quantity", type: "number", hint: "Units held" },
  { field: "avgBuyPrice", type: "number", hint: "Average purchase price in the holding's currency" },
  { field: "currentPrice", type: "number", hint: "Latest price — refreshed automatically after import" },
  { field: "priceSource", type: "enum", hint: "mfapi · coingecko · twelvedata · alphavantage · frankfurter · dfm · manual" },
];

const EXAMPLE_JSON = `[
  {
    "id": "holding-1",
    "assetName": "Reliance Industries",
    "ticker": "RELIANCE.NS",
    "assetClass": "Stocks",
    "geography": "India",
    "currency": "INR",
    "quantity": 10,
    "avgBuyPrice": 2400,
    "currentPrice": 2800,
    "priceSource": "alphavantage"
  }
]`;

function statusColor(result: string | undefined, defaultStatus: "ok" | "missing" | "unknown") {
  if (!result) {
    if (defaultStatus === "ok") return "bg-accent-gain";
    return "bg-text-muted";
  }
  if (result === "Checking") return "bg-amber-400 animate-pulse";
  if (result === "Healthy") return "bg-accent-gain";
  if (result === "Ready") return "bg-accent-gain";
  return "bg-accent-loss";
}

function statusLabel(result: string | undefined, defaultStatus: "ok" | "missing" | "unknown") {
  if (!result) return defaultStatus === "ok" ? "Ready" : "Not checked";
  return result;
}

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("default");
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [rebuildingHistory, setRebuildingHistory] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => {
    async function getUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || "default");
    }
    getUser();
  }, []);

  const storageKey = `portflow-holdings-${userId}`;
  const rateStorageKey = getRateStorageKey(userId);

  const testEndpoint = async (path: string) => {
    try {
      const response = await fetch(path);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return "Unexpected response";
      const data = await response.json();
      return data.success ? "Healthy" : data.error || "Error";
    } catch {
      return "Connection failed";
    }
  };

  const runTests = async () => {
    setTesting(true);
    const endpoints = [
      { name: "MFAPI.in", path: "/api/prices/indian-mf" },
      { name: "Yahoo Finance (India)", path: "/api/prices/indian-stocks" },
      { name: "Yahoo Finance (US ETFs)", path: "/api/prices/us-etfs" },
      { name: "CoinGecko", path: "/api/prices/crypto" },
      { name: "Frankfurter", path: "/api/prices/currency" },
    ];
    setTestResults(Object.fromEntries(endpoints.map((e) => [e.name, "Checking"])));
    const settled = await Promise.all(
      endpoints.map(async (endpoint) => [endpoint.name, await testEndpoint(endpoint.path)] as const)
    );
    setTestResults(Object.fromEntries(settled));
    setTesting(false);
  };

  const rebuildHistory = async () => {
    setRebuildingHistory(true);
    setDataError(null);
    try {
      const rawHoldings = localStorage.getItem(storageKey);
      const parsed = rawHoldings ? (JSON.parse(rawHoldings) as Holding[]) : [];
      const { normalized } = normalizeHoldings(parsed);
      const storedRate = Number(localStorage.getItem(rateStorageKey));
      const inrToAedRate = Number.isFinite(storedRate) && storedRate > 0 ? storedRate : DEFAULT_INR_TO_AED_RATE;
      const existingSnapshots = await fetchPortfolioSnapshots(userId);
      const rebuiltSnapshots = buildBackfilledSnapshots(normalized, existingSnapshots, inrToAedRate);
      await replacePortfolioSnapshots(userId, rebuiltSnapshots);
      hapticSuccess();
      router.refresh();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Failed to rebuild history");
    } finally {
      setRebuildingHistory(false);
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setDataError(null);
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (!validateHoldings(parsed)) {
          setDataError("Invalid holdings file. See the import format guide below for required fields.");
          return;
        }
        const { normalized } = normalizeHoldings(parsed);
        await replaceRemoteHoldingsState(userId, normalized);
        localStorage.setItem(storageKey, JSON.stringify(normalized));
        router.refresh();
      } catch (error) {
        setDataError(
          error instanceof SyntaxError
            ? "Invalid JSON file"
            : error instanceof Error
              ? error.message
              : "Failed to import holdings"
        );
      }
    };
    input.click();
  };

  const handleReset = async () => {
    setResetting(true);
    setDataError(null);
    try {
      await replaceRemoteHoldingsState(userId, []);
      localStorage.removeItem(storageKey);
      setResetConfirming(false);
      router.refresh();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Failed to reset holdings");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="px-1">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em] text-text-primary">Settings</h1>
        <p className="mt-1.5 text-sm leading-6 text-text-secondary">Manage your data, check API connectivity, and learn how to format imports.</p>
      </div>

      {/* Service health */}
      <section className="glass-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border-default px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Service health</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Live status of the market data sources Portflow connects to.</p>
          </div>
          <button
            onClick={() => { tap(); runTests(); }}
            disabled={testing}
            className="self-start rounded-full bg-accent-violet px-5 py-2.5 text-sm font-semibold text-bg-primary transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55 sm:self-auto"
          >
            {testing ? "Running…" : "Run checks"}
          </button>
        </div>

        <div className="divide-y divide-border-default/50">
          {apiStatuses.map((api) => {
            const result = testResults[api.name];
            const label = statusLabel(result, api.status);
            const dot = statusColor(result, api.status);
            return (
              <div key={api.name} className="grid gap-3 px-6 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{api.name}</span>
                    <span className="rounded-full border border-border-default bg-bg-elevated px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-text-muted">
                      {api.keyRequired ? "Key required" : "Keyless"}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-text-secondary">{api.description}</p>
                  {api.envVar && <code className="text-[0.68rem] text-text-muted">{api.envVar}</code>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                  <span className="text-sm text-text-secondary">{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Data management + Import guide */}
      <div className="grid gap-5 xl:grid-cols-2">

        {/* Data management */}
        <section className="glass-card overflow-hidden">
          <div className="border-b border-border-default px-6 py-5">
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Data management</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Export, import, or reset your holdings data.</p>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <DataButton
                label="Export holdings"
                description="Download as JSON"
                onClick={() => {
                  tap();
                  const data = localStorage.getItem(storageKey);
                  if (!data) return;
                  const blob = new Blob([data], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `portflow-holdings-${new Date().toISOString().slice(0, 10)}.json`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              />
              <DataButton
                label="Import holdings"
                description="Upload a JSON file"
                onClick={() => { tap(); handleImport(); }}
              />
            </div>

            {dataError && (
              <p className="rounded-xl border border-accent-loss/20 bg-accent-loss-bg px-4 py-3 text-sm text-accent-loss">
                {dataError}
              </p>
            )}

            {/* Historical snapshots */}
            <div className="rounded-xl border border-border-default bg-bg-elevated p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Historical snapshots</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Rebuild missing history from purchase dates. Backfilled entries assume portfolio value matched invested cost.
                  </p>
                </div>
                <button
                  onClick={() => { tap(); rebuildHistory(); }}
                  disabled={rebuildingHistory}
                  className="shrink-0 self-start rounded-full border border-border-default bg-bg-card px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {rebuildingHistory ? "Rebuilding…" : "Rebuild"}
                </button>
              </div>
            </div>

            {/* Reset */}
            <div className="rounded-xl border border-accent-loss/15 bg-accent-loss-bg p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-accent-loss">Reset storage</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">Permanently deletes all holdings. This cannot be undone.</p>
                </div>
                {resetConfirming ? (
                  <div className="flex shrink-0 gap-2 self-start">
                    <button
                      onClick={() => { hapticDestructive(); handleReset(); }}
                      disabled={resetting}
                      className="rounded-full bg-accent-loss px-4 py-2 text-xs font-semibold text-white transition hover:brightness-105 disabled:opacity-55"
                    >
                      {resetting ? "Resetting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setResetConfirming(false)}
                      className="rounded-full border border-border-default bg-bg-card px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-elevated"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { medium(); setDataError(null); setResetConfirming(true); }}
                    className="shrink-0 self-start rounded-full border border-accent-loss/30 px-4 py-2 text-xs font-semibold text-accent-loss transition hover:bg-accent-loss/10"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Import format guide */}
        <section className="glass-card overflow-hidden">
          <div className="border-b border-border-default px-6 py-5">
            <h2 className="font-display text-lg font-semibold tracking-[-0.03em] text-text-primary">Import format</h2>
            <p className="mt-0.5 text-sm text-text-secondary">Holdings must be a JSON array. Each object requires these ten fields.</p>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="overflow-hidden rounded-xl border border-border-default">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-default bg-bg-elevated">
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-widest text-text-muted">Field</th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-widest text-text-muted">Type</th>
                    <th className="hidden px-4 py-2.5 text-left font-semibold uppercase tracking-widest text-text-muted sm:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default/50">
                  {IMPORT_FIELDS.map(({ field, type, hint }) => (
                    <tr key={field} className="align-top">
                      <td className="px-4 py-2.5">
                        <code className="font-semibold text-accent-violet">{field}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-md border border-border-default bg-bg-elevated px-1.5 py-0.5 text-[0.65rem] font-medium text-text-muted">{type}</span>
                      </td>
                      <td className="hidden px-4 py-2.5 leading-5 text-text-secondary sm:table-cell">{hint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-border-default bg-bg-elevated p-4">
              <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-widest text-text-muted">Example</p>
              <pre className="overflow-x-auto text-xs leading-5 text-text-secondary">{EXAMPLE_JSON}</pre>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function DataButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-0.5 rounded-xl border border-border-default bg-bg-card px-4 py-4 text-left transition hover:bg-bg-elevated"
    >
      <span className="text-sm font-semibold text-text-primary">{label}</span>
      <span className="text-xs text-text-secondary">{description}</span>
    </button>
  );
}
