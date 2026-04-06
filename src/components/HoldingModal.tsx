"use client";

import { useState, useMemo } from "react";
import { type Holding, type Currency, PLATFORM_OPTIONS, ASSET_CLASS_OPTIONS, GEOGRAPHY_OPTIONS, RISK_OPTIONS, CURRENCY_OPTIONS } from "@/lib/constants";
import { computeHolding, formatMoney, toNumber } from "@/lib/utils";

interface Props {
  holding: Holding | null;
  inrToAedRate: number;
  onSave: (holding: Holding) => void;
  onClose: () => void;
}

const emptyForm: Holding = {
  id: "",
  platform: "Groww",
  assetName: "",
  ticker: "",
  assetClass: "Stocks",
  sector: "",
  geography: "India",
  risk: "Medium",
  quantity: 0,
  avgBuyPrice: 0,
  currentPrice: 0,
  currency: "INR",
  notes: "",
  priceSource: "manual",
};

export default function HoldingModal({ holding, inrToAedRate, onSave, onClose }: Props) {
  const [form, setForm] = useState<Holding>(holding || emptyForm);

  const preview = useMemo(() => computeHolding(form, inrToAedRate), [form, inrToAedRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetName.trim()) return;
    onSave(form);
  };

  const update = (patch: Partial<Holding>) => setForm({ ...form, ...patch });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="glass-card relative max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">
            {holding ? "Edit Holding" : "Add Holding"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-text-muted transition-colors hover:bg-bg-card-hover hover:text-text-primary">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Preview Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <PreviewStat label="Invested" value={formatMoney(preview.investedAmount, form.currency)} sub={formatMoney(preview.investedAmountAed, "AED")} />
            <PreviewStat label="Current Value" value={formatMoney(preview.currentValue, form.currency)} sub={formatMoney(preview.currentValueAed, "AED")} />
            <PreviewStat
              label="P/L"
              value={`${formatMoney(preview.gainLoss, form.currency)} (${preview.gainLossPct.toFixed(2)}%)`}
              sub={formatMoney(preview.gainLossAed, "AED")}
              color={preview.gainLoss >= 0}
            />
          </div>

          {/* Form fields */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormSelect label="Platform" value={form.platform} options={PLATFORM_OPTIONS} onChange={(v) => update({ platform: v })} />
            <FormInput label="Asset Name" value={form.assetName} onChange={(v) => update({ assetName: v })} placeholder="Apple, Bitcoin, Nifty ETF" required />
            <FormInput label="Ticker" value={form.ticker} onChange={(v) => update({ ticker: v })} placeholder="AAPL, BTC" />
            <FormSelect label="Asset Class" value={form.assetClass} options={ASSET_CLASS_OPTIONS} onChange={(v) => update({ assetClass: v as Holding["assetClass"] })} />
            <FormInput label="Sector / Theme" value={form.sector} onChange={(v) => update({ sector: v })} placeholder="Tech, Banking" />
            <FormSelect label="Geography" value={form.geography} options={GEOGRAPHY_OPTIONS} onChange={(v) => update({ geography: v as Holding["geography"] })} />
            <FormSelect label="Risk" value={form.risk} options={RISK_OPTIONS} onChange={(v) => update({ risk: v as Holding["risk"] })} />
            <FormNumber label="Quantity" value={form.quantity} onChange={(v) => update({ quantity: v })} />
            <FormNumber label="Avg Buy Price" value={form.avgBuyPrice} onChange={(v) => update({ avgBuyPrice: v })} />
            <FormNumber label="Current Price" value={form.currentPrice} onChange={(v) => update({ currentPrice: v })} />
            <FormSelect label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={(v) => update({ currency: v as Currency })} />
            <FormInput label="Scheme Code (MF)" value={form.schemeCode || ""} onChange={(v) => update({ schemeCode: v })} placeholder="AMFI code" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update({ notes: e.target.value })}
              rows={2}
              className="w-full rounded-xl border border-border-default bg-bg-input px-4 py-3 text-sm text-text-primary placeholder-text-muted outline-none transition-all focus:border-accent-violet"
              placeholder="Optional notes"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="rounded-xl border border-border-default px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-card-hover">
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #8B5CF6, #3B82F6)" }}
            >
              {holding ? "Update Holding" : "Save Holding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sub-components ──
function PreviewStat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: boolean }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-input p-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`mt-1 text-sm font-semibold ${color === undefined ? "text-text-primary" : color ? "text-accent-gain" : "text-accent-loss"}`}>{value}</div>
      <div className="mt-0.5 text-xs text-text-muted">{sub}</div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-all focus:border-accent-violet"
      />
    </div>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary outline-none transition-all focus:border-accent-violet"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function FormNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-text-muted">{label}</label>
      <input
        type="number"
        step="any"
        value={value || ""}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className="w-full rounded-lg border border-border-default bg-bg-input px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none transition-all focus:border-accent-violet"
        placeholder="0"
      />
    </div>
  );
}
