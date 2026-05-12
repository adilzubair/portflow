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

export default function SettingsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("default");
  const [rebuildingHistory, setRebuildingHistory] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirming, setResetConfirming] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState<{ updated: number; total: number } | null>(null);

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

  const resolveMissingDetails = async () => {
    setResolving(true);
    setDataError(null);
    setResolveResult(null);
    try {
      const res = await fetch("/api/holdings/resolve", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Failed to resolve holdings");
      }
      setResolveResult({ updated: data.updatedCount ?? 0, total: data.total ?? 0 });
      hapticSuccess();
      router.refresh();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Failed to resolve holdings");
    } finally {
      setResolving(false);
    }
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
        <p className="mt-1.5 text-sm leading-6 text-text-secondary">Manage your portfolio data and learn how to format imports.</p>
      </div>

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

            {/* Auto-resolve missing details */}
            <div className="rounded-xl border border-border-default bg-bg-elevated p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Fix missing tickers & scheme codes</p>
                  <p className="mt-1 text-xs leading-5 text-text-secondary">
                    Re-scan your holdings and auto-resolve missing Indian MF scheme codes, stock tickers (India/US), and UAE symbols. Run this if a holding&apos;s price is not refreshing.
                  </p>
                  {resolveResult && (
                    <p className="mt-2 text-xs font-medium text-accent-gain">
                      Updated {resolveResult.updated} of {resolveResult.total} holdings.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { tap(); resolveMissingDetails(); }}
                  disabled={resolving}
                  className="shrink-0 self-start rounded-full border border-border-default bg-bg-card px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-bg-card-hover disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {resolving ? "Resolving…" : "Auto-resolve"}
                </button>
              </div>
            </div>

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
