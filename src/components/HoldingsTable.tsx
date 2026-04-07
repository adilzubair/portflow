"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, type ComputedHolding, type Holding } from "@/lib/constants";
import { formatMoney, timeAgo } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  isAmountsVisible: boolean;
  onEdit: (holding: Holding) => void;
  onDelete: (id: string) => void;
  onPriceUpdate: (id: string, price: number) => void;
}

export default function HoldingsTable({ holdings, isAmountsVisible, onEdit, onDelete, onPriceUpdate }: Props) {
  const [filters, setFilters] = useState({
    search: "",
    platform: "All",
    assetClass: "All",
    geography: "All",
    risk: "All",
  });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const platforms = useMemo(() => ["All", ...new Set(holdings.map((holding) => holding.platform))], [holdings]);

  const filtered = useMemo(() => {
    return holdings.filter((holding) => {
      if (filters.platform !== "All" && holding.platform !== filters.platform) return false;
      if (filters.assetClass !== "All" && holding.assetClass !== filters.assetClass) return false;
      if (filters.geography !== "All" && holding.geography !== filters.geography) return false;
      if (filters.risk !== "All" && holding.risk !== filters.risk) return false;

      if (filters.search) {
        const query = filters.search.toLowerCase();
        return [holding.assetName, holding.ticker, holding.sector].some((field) => field.toLowerCase().includes(query));
      }

      return true;
    });
  }, [filters, holdings]);

  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-black/8 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-text-primary">Holdings</h2>
            <div className="text-sm text-text-secondary">
              <span className="font-semibold text-text-primary">{filtered.length}</span> of{" "}
              <span className="font-semibold text-text-primary">{holdings.length}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <FilterInput label="Search" value={filters.search} onChange={(value) => setFilters({ ...filters, search: value })} placeholder="Asset, ticker, sector" />
            <FilterSelect label="Platform" value={filters.platform} options={platforms} onChange={(value) => setFilters({ ...filters, platform: value })} />
            <FilterSelect label="Class" value={filters.assetClass} options={["All", ...ASSET_CLASS_OPTIONS]} onChange={(value) => setFilters({ ...filters, assetClass: value })} />
            <FilterSelect label="Geography" value={filters.geography} options={["All", ...GEOGRAPHY_OPTIONS]} onChange={(value) => setFilters({ ...filters, geography: value })} />
            <FilterSelect label="Risk" value={filters.risk} options={["All", ...RISK_OPTIONS]} onChange={(value) => setFilters({ ...filters, risk: value })} />
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:hidden">
        {filtered.length > 0 ? (
          filtered.map((holding) => (
            <article key={holding.id} className="rounded-[1.35rem] border border-black/8 bg-[#fffaf8] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">{holding.assetName}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                    {holding.ticker && (
                      <span className="rounded-full border border-black/8 bg-white px-2 py-1 font-mono text-accent-violet">
                        {holding.ticker}
                      </span>
                    )}
                    <span>{holding.platform}</span>
                    <span className="text-black/20">/</span>
                    <span>{holding.geography}</span>
                  </div>
                </div>
                <button
                  onClick={() => setOpenMenuId((current) => (current === holding.id ? null : holding.id))}
                  className="shrink-0 rounded-full border border-black/8 bg-white px-3 py-2 text-xs font-medium text-text-secondary"
                >
                  Actions
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MobileStat label="Qty" value={holding.quantity < 1 ? holding.quantity.toFixed(7) : holding.quantity.toLocaleString()} mono />
                <MobileStat
                  label="Value"
                  value={isAmountsVisible ? formatMoney(holding.currentValueAed, "AED") : "••••"}
                  mono
                />
                <MobileStat
                  label="P/L"
                  value={isAmountsVisible ? formatMoney(holding.gainLossAed, "AED") : `${holding.gainLossPct.toFixed(2)}%`}
                  mono
                  tone={holding.gainLossAed >= 0 ? "gain" : "loss"}
                />
                <MobileStat label="Updated" value={timeAgo(holding.lastPriceUpdate)} />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Market price
                </label>
                <input
                  type="number"
                  step="any"
                  value={holding.currentPrice || ""}
                  onChange={(event) => onPriceUpdate(holding.id, Number(event.target.value))}
                  placeholder="0"
                  className="w-full rounded-xl border border-black/8 bg-white px-3 py-3 text-sm font-mono text-text-primary transition focus:border-accent-violet"
                />
              </div>

              {openMenuId === holding.id && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onEdit(holding);
                      setOpenMenuId(null);
                    }}
                    className="rounded-xl border border-black/8 bg-white px-3 py-3 text-sm font-medium text-text-primary"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      onDelete(holding.id);
                      setOpenMenuId(null);
                    }}
                    className="rounded-xl border border-accent-loss/20 bg-accent-loss-bg px-3 py-3 text-sm font-medium text-accent-loss"
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <div className="py-12 text-center text-sm text-text-muted">No holdings</div>
        )}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-[1100px] w-full text-left">
          <thead>
            <tr className="border-b border-black/8 text-[0.7rem] uppercase tracking-[0.18em] text-text-muted">
              <th className="px-6 py-4 font-semibold">Asset</th>
              <th className="px-4 py-4 font-semibold">Platform</th>
              <th className="px-4 py-4 font-semibold">Qty</th>
              <th className="px-4 py-4 font-semibold">Market price</th>
              <th className="px-4 py-4 font-semibold">Current value</th>
              <th className="px-4 py-4 font-semibold">AED value</th>
              <th className="px-4 py-4 font-semibold">P/L</th>
              <th className="px-4 py-4 font-semibold">Updated</th>
              <th className="px-4 py-4 font-semibold sr-only">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((holding) => (
                <tr key={holding.id} className="border-b border-black/[0.06] align-top transition hover:bg-[#fff8f6]">
                  <td className="px-6 py-4">
                    <div className="min-w-[16rem]">
                      <div className="text-sm font-medium text-text-primary">{holding.assetName}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                        {holding.ticker && (
                          <span className="rounded-full border border-black/8 bg-white px-2.5 py-1 font-mono text-[0.7rem] text-accent-violet">
                            {holding.ticker}
                          </span>
                        )}
                        <span>{holding.assetClass}</span>
                        <span className="text-black/20">/</span>
                        <span>{holding.geography}</span>
                        {holding.sector && (
                          <>
                            <span className="text-black/20">/</span>
                            <span>{holding.sector}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-text-secondary">{holding.platform}</td>

                  <td className="px-4 py-4 font-mono text-sm text-text-secondary">
                    {holding.quantity < 1 ? holding.quantity.toFixed(7) : holding.quantity.toLocaleString()}
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      step="any"
                      value={holding.currentPrice || ""}
                      onChange={(event) => onPriceUpdate(holding.id, Number(event.target.value))}
                      placeholder="0"
                      className="w-28 rounded-xl border border-black/8 bg-white px-3 py-2 text-sm font-mono text-text-primary transition focus:border-accent-violet"
                    />
                  </td>

                  <td className="px-4 py-4 font-mono text-sm text-text-secondary">
                    {isAmountsVisible ? formatMoney(holding.currentValue, holding.currency) : "••••"}
                  </td>

                  <td className="px-4 py-4 font-mono text-sm text-text-secondary">
                    {isAmountsVisible ? formatMoney(holding.currentValueAed, "AED") : "••••"}
                  </td>

                  <td className="px-4 py-4">
                    <div className={`font-mono text-sm font-semibold ${holding.gainLossAed >= 0 ? "text-accent-gain" : "text-accent-loss"}`}>
                      {isAmountsVisible ? formatMoney(holding.gainLossAed, "AED") : `${holding.gainLossPct.toFixed(2)}%`}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {holding.gainLossPct >= 0 ? "+" : ""}
                      {holding.gainLossPct.toFixed(2)}%
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-text-muted">{timeAgo(holding.lastPriceUpdate)}</td>

                  <td className="relative px-4 py-4">
                    <button
                      onClick={() => setOpenMenuId((current) => (current === holding.id ? null : holding.id))}
                      className="rounded-full border border-black/8 bg-white px-3 py-2 text-xs font-medium text-text-secondary transition hover:bg-[#fff1ef] hover:text-text-primary"
                    >
                      Actions
                    </button>
                    {openMenuId === holding.id && (
                      <div className="absolute right-4 top-14 z-20 min-w-36 overflow-hidden rounded-[1.1rem] border border-black/8 bg-white shadow-xl">
                        <button
                          onClick={() => {
                            onEdit(holding);
                            setOpenMenuId(null);
                          }}
                          className="block w-full px-4 py-3 text-left text-sm text-text-secondary transition hover:bg-[#fff1ef] hover:text-text-primary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            onDelete(holding.id);
                            setOpenMenuId(null);
                          }}
                          className="block w-full px-4 py-3 text-left text-sm text-accent-loss transition hover:bg-accent-loss-bg"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-16 text-center text-sm text-text-muted">
                  No holdings
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MobileStat({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="rounded-[1rem] border border-black/8 bg-white p-3">
      <div className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div
        className={`mt-2 text-sm ${
          mono ? "font-mono" : ""
        } ${tone === "gain" ? "text-accent-gain" : tone === "loss" ? "text-accent-loss" : "text-text-primary"}`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-text-primary transition focus:border-accent-violet"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
