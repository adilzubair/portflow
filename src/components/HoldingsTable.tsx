"use client";

import { useState, useMemo } from "react";
import { type ComputedHolding, type Holding, ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS } from "@/lib/constants";
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

  const platforms = useMemo(
    () => ["All", ...new Set(holdings.map((h) => h.platform))],
    [holdings]
  );

  const filtered = useMemo(() => {
    return holdings.filter((h) => {
      if (filters.platform !== "All" && h.platform !== filters.platform) return false;
      if (filters.assetClass !== "All" && h.assetClass !== filters.assetClass) return false;
      if (filters.geography !== "All" && h.geography !== filters.geography) return false;
      if (filters.risk !== "All" && h.risk !== filters.risk) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !h.assetName.toLowerCase().includes(q) &&
          !h.ticker.toLowerCase().includes(q) &&
          !h.sector.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [holdings, filters]);

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border-subtle p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Holdings</h2>
            <p className="mt-1 text-sm text-text-muted">
              {filtered.length} of {holdings.length} holdings
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterInput
              label="Search"
              value={filters.search}
              onChange={(v) => setFilters({ ...filters, search: v })}
              placeholder="Asset, ticker, sector"
            />
            <FilterSelect
              label="Platform"
              value={filters.platform}
              options={platforms}
              onChange={(v) => setFilters({ ...filters, platform: v })}
            />
            <FilterSelect
              label="Class"
              value={filters.assetClass}
              options={["All", ...ASSET_CLASS_OPTIONS]}
              onChange={(v) => setFilters({ ...filters, assetClass: v })}
            />
            <FilterSelect
              label="Geography"
              value={filters.geography}
              options={["All", ...GEOGRAPHY_OPTIONS]}
              onChange={(v) => setFilters({ ...filters, geography: v })}
            />
            <FilterSelect
              label="Risk"
              value={filters.risk}
              options={["All", ...RISK_OPTIONS]}
              onChange={(v) => setFilters({ ...filters, risk: v })}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border-subtle text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="px-5 py-3">Asset</th>
              <th className="px-3 py-3">Platform</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Market Price</th>
              <th className="px-3 py-3">Value</th>
              <th className="px-3 py-3">Value (AED)</th>
              <th className="px-3 py-3">P/L (AED)</th>
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-border-subtle transition-colors hover:bg-bg-card-hover"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-text-primary">{h.assetName}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                      {h.ticker && (
                        <span className="rounded-md bg-accent-violet-bg px-1.5 py-0.5 font-mono text-accent-violet">
                          {h.ticker}
                        </span>
                      )}
                      <span>{h.assetClass}</span>
                      <span>·</span>
                      <span>{h.geography}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-text-secondary">{h.platform}</td>
                  <td className="px-3 py-3.5 font-mono text-text-secondary">
                    {h.quantity < 1 ? h.quantity.toFixed(7) : h.quantity.toLocaleString()}
                  </td>
                  <td className="px-3 py-3.5">
                    <input
                      type="number"
                      step="any"
                      value={h.currentPrice || ""}
                      onChange={(e) => onPriceUpdate(h.id, Number(e.target.value))}
                      className="w-24 rounded-lg border border-border-default bg-bg-input px-2 py-1.5 font-mono text-sm text-text-primary outline-none transition-all focus:border-accent-violet"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-3.5 font-mono text-text-secondary">
                    {isAmountsVisible
                      ? formatMoney(h.currentValue, h.currency)
                      : "••••"}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-text-secondary">
                    {isAmountsVisible
                      ? formatMoney(h.currentValueAed, "AED")
                      : "••••"}
                  </td>
                  <td className="px-3 py-3.5">
                    <div
                      className={`font-mono font-medium ${
                        h.gainLossAed >= 0 ? "text-accent-gain" : "text-accent-loss"
                      }`}
                    >
                      {isAmountsVisible
                        ? formatMoney(h.gainLossAed, "AED")
                        : `${h.gainLossPct.toFixed(2)}%`}
                    </div>
                    <div className="mt-0.5 text-xs text-text-muted">
                      {h.gainLossPct >= 0 ? "+" : ""}
                      {h.gainLossPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-text-muted">
                    {timeAgo(h.lastPriceUpdate)}
                  </td>
                  <td className="relative px-3 py-3.5">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === h.id ? null : h.id)}
                      className="rounded-lg border border-border-default bg-bg-card px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-card-hover"
                    >
                      ⋮
                    </button>
                    {openMenuId === h.id && (
                      <div className="absolute right-3 top-12 z-20 min-w-28 overflow-hidden rounded-xl border border-border-default bg-bg-card shadow-xl">
                        <button
                          onClick={() => { onEdit(h); setOpenMenuId(null); }}
                          className="block w-full px-4 py-2.5 text-left text-xs text-text-secondary transition-colors hover:bg-bg-card-hover hover:text-text-primary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { onDelete(h.id); setOpenMenuId(null); }}
                          className="block w-full px-4 py-2.5 text-left text-xs text-accent-loss transition-colors hover:bg-accent-loss-bg"
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
                <td colSpan={9} className="py-12 text-center text-text-muted">
                  No holdings match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Filter Components ──
function FilterInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none transition-all focus:border-accent-violet"
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
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2 text-sm text-text-primary outline-none transition-all focus:border-accent-violet"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
