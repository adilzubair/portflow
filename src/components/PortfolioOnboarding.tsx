"use client";

import { tap } from "@/lib/haptics";

interface Props {
  onImportHoldings: () => void;
  onAddManually: () => void;
}

const steps = [
  {
    eyebrow: "Step 1",
    title: "Upload screenshots",
    description: "Add broker or exchange screenshots from Groww, Binance, IG, iVestor, or any other platform.",
  },
  {
    eyebrow: "Step 2",
    title: "Verify extracted rows",
    description: "The importer pre-fills symbols, quantities, and prices, then lets you correct anything before saving.",
  },
  {
    eyebrow: "Step 3",
    title: "Start tracking",
    description: "Imported holdings flow into the normal dashboard, sync, and refresh pipeline right away.",
  },
];

export default function PortfolioOnboarding({ onImportHoldings, onAddManually }: Props) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.08),_transparent_58%),radial-gradient(circle_at_top_right,_rgba(37,99,235,0.08),_transparent_44%)]" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Guided setup
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-[2.4rem]">
            Build your portfolio from screenshots instead of typing every line item.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Portflow can analyze portfolio screenshots, draft structured holdings, and pause for review before anything is added to your account.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                tap();
                onImportHoldings();
              }}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              Import from screenshots
            </button>
            <button
              type="button"
              onClick={() => {
                tap();
                onAddManually();
              }}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Add one manually
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">{step.eyebrow}</div>
              <div className="mt-2 text-base font-semibold text-slate-900">{step.title}</div>
              <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
