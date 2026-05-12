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
    <section className="glass-card relative overflow-hidden rounded-[2rem] p-5 sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 opacity-80"
        style={{
          background:
            "radial-gradient(circle at top left, color-mix(in srgb, var(--color-accent-violet) 16%, transparent), transparent 58%), radial-gradient(circle at top right, color-mix(in srgb, var(--color-accent-blue) 14%, transparent), transparent 44%)",
        }}
      />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-elevated px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Guided setup
          </div>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-[-0.05em] text-text-primary sm:text-[2.4rem]">
            Build your portfolio from screenshots instead of typing every line item.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            Portflow can analyze portfolio screenshots, draft structured holdings, and pause for review before anything is added to your account.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                tap();
                onImportHoldings();
              }}
              className="inline-flex items-center justify-center rounded-full bg-accent-violet px-5 py-3 text-sm font-semibold text-bg-primary transition hover:brightness-110 active:scale-[0.99]"
            >
              Import from screenshots
            </button>
            <button
              type="button"
              onClick={() => {
                tap();
                onAddManually();
              }}
              className="inline-flex items-center justify-center rounded-full border border-border-default bg-bg-card px-5 py-3 text-sm font-semibold text-text-primary transition hover:bg-bg-card-hover active:scale-[0.99]"
            >
              Add one manually
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-[1.4rem] border border-border-default bg-bg-elevated p-4">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-text-muted">{step.eyebrow}</div>
              <div className="mt-2 text-base font-semibold text-text-primary">{step.title}</div>
              <p className="mt-1 text-sm leading-6 text-text-secondary">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
