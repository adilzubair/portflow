"use client";

import { useMemo, useState } from "react";
import { ASSET_CLASS_OPTIONS, CURRENCY_OPTIONS, GEOGRAPHY_OPTIONS, PLATFORM_OPTIONS, RISK_OPTIONS, type Currency, type Holding } from "@/lib/constants";
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.assetName.trim()) {
      return;
    }

    onSave(form);
  };

  const update = (patch: Partial<Holding>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="glass-card relative max-h-[92vh] w-full max-w-5xl overflow-y-auto border border-black/8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-black/8 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-text-primary">
                {holding ? "Edit holding" : "Add holding"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-full border border-black/8 bg-white p-2.5 text-text-secondary transition hover:bg-[#fff1ef] hover:text-text-primary"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <FormSelect label="Platform" value={form.platform} options={PLATFORM_OPTIONS} onChange={(value) => update({ platform: value })} />
              <FormInput label="Asset name" value={form.assetName} onChange={(value) => update({ assetName: value })} placeholder="Apple, Bitcoin, Nifty ETF" required />
              <FormInput label="Ticker" value={form.ticker} onChange={(value) => update({ ticker: value })} placeholder="AAPL, BTC" />
              <FormSelect label="Asset class" value={form.assetClass} options={ASSET_CLASS_OPTIONS} onChange={(value) => update({ assetClass: value as Holding["assetClass"] })} />
              <FormInput label="Sector or theme" value={form.sector} onChange={(value) => update({ sector: value })} placeholder="Technology, banking, index" />
              <FormSelect label="Geography" value={form.geography} options={GEOGRAPHY_OPTIONS} onChange={(value) => update({ geography: value as Holding["geography"] })} />
              <FormSelect label="Risk" value={form.risk} options={RISK_OPTIONS} onChange={(value) => update({ risk: value as Holding["risk"] })} />
              <FormNumber label="Quantity" value={form.quantity} onChange={(value) => update({ quantity: value })} />
              <FormNumber label="Average buy price" value={form.avgBuyPrice} onChange={(value) => update({ avgBuyPrice: value })} />
              <FormNumber label="Current price" value={form.currentPrice} onChange={(value) => update({ currentPrice: value })} />
              <FormSelect label="Currency" value={form.currency} options={CURRENCY_OPTIONS} onChange={(value) => update({ currency: value as Currency })} />
              <FormInput label="Scheme code" value={form.schemeCode || ""} onChange={(value) => update({ schemeCode: value })} placeholder="AMFI code for mutual funds" />
            </div>

            <div>
              <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">Notes</label>
              <textarea
                value={form.notes}
                onChange={(event) => update({ notes: event.target.value })}
                rows={4}
                placeholder="Optional context for this position"
                className="w-full rounded-[1.35rem] border border-black/8 bg-white px-4 py-3 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border border-black/8 bg-[#fffaf8] p-5">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-text-muted">Preview</p>
              <div className="mt-4 space-y-4">
                <PreviewStat label="Invested capital" value={formatMoney(preview.investedAmount, form.currency)} sub={formatMoney(preview.investedAmountAed, "AED")} />
                <PreviewStat label="Current value" value={formatMoney(preview.currentValue, form.currency)} sub={formatMoney(preview.currentValueAed, "AED")} />
                <PreviewStat
                  label="Unrealised P/L"
                  value={`${formatMoney(preview.gainLoss, form.currency)} (${preview.gainLossPct.toFixed(2)}%)`}
                  sub={formatMoney(preview.gainLossAed, "AED")}
                  tone={preview.gainLoss >= 0 ? "gain" : "loss"}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-black/8 bg-white px-4 py-3 text-sm font-medium text-text-secondary transition hover:bg-[#fff1ef] hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full bg-accent-violet px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105"
              >
                {holding ? "Save changes" : "Create holding"}
              </button>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "gain" | "loss";
}) {
  return (
    <div className="rounded-[1.2rem] border border-black/8 bg-white p-4">
      <div className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className={`mt-2 text-base font-semibold ${tone === "gain" ? "text-accent-gain" : tone === "loss" ? "text-accent-loss" : "text-text-primary"}`}>
        {value}
      </div>
      <div className="mt-1 text-sm text-text-secondary">{sub}</div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-[1.1rem] border border-black/8 bg-white px-4 py-3 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-[1.1rem] border border-black/8 bg-white px-4 py-3 text-sm text-text-primary transition focus:border-accent-violet"
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

function FormNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{label}</label>
      <input
        type="number"
        step="any"
        value={value || ""}
        onChange={(event) => onChange(toNumber(event.target.value))}
        placeholder="0"
        className="w-full rounded-[1.1rem] border border-black/8 bg-white px-4 py-3 text-sm text-text-primary transition placeholder:text-text-muted focus:border-accent-violet"
      />
    </div>
  );
}
