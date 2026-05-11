"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ASSET_CLASS_OPTIONS,
  CURRENCY_OPTIONS,
  GEOGRAPHY_OPTIONS,
  PLATFORM_OPTIONS,
  RISK_OPTIONS,
  type AssetClass,
  type Currency,
  type Geography,
  type Holding,
  type Platform,
  type Risk,
} from "@/lib/constants";
import {
  HOLDINGS_IMPORT_MAX_FILES,
  HOLDINGS_IMPORT_ROUTE,
  draftToHolding,
  type HoldingsExtractionResult,
  type ImportableHoldingDraft,
} from "@/lib/ai/holdings-import";
import { medium, success as hapticSuccess, tap } from "@/lib/haptics";

interface Props {
  onClose: () => void;
  onImport: (holdings: Holding[]) => void;
}

type AnalyzeState = "idle" | "analyzing" | "review";

function createEmptyDraft(platformHint: string): ImportableHoldingDraft {
  return {
    platform: platformHint || "Custom",
    assetName: "",
    ticker: "",
    assetClass: "Stocks",
    allocationClass: "Stocks",
    sector: "",
    geography: "US",
    risk: "Medium",
    quantity: 0,
    avgBuyPrice: 0,
    currentPrice: 0,
    currency: "USD",
    notes: "",
    schemeCode: "",
    confidence: 0.25,
    extractionNotes: "",
  };
}

function formatConfidence(value: number) {
  return `${Math.round(value * 100)}% confidence`;
}

function FileBadge({ name, size }: { name: string; size: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <div className="truncate text-sm font-medium text-slate-800">{name}</div>
      <div className="mt-0.5 text-xs text-slate-500">{(size / (1024 * 1024)).toFixed(2)} MB</div>
    </div>
  );
}

export default function HoldingsImportModal({ onClose, onImport }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [platformHint, setPlatformHint] = useState("");
  const [status, setStatus] = useState<AnalyzeState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [requestedModel, setRequestedModel] = useState<string>("");
  const [usedModel, setUsedModel] = useState<string>("");
  const [drafts, setDrafts] = useState<ImportableHoldingDraft[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPosition = body.style.position;
    const previousTop = body.style.top;
    const previousWidth = body.style.width;
    const scrollY = window.scrollY;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      body.style.overflow = previousOverflow;
      body.style.position = previousPosition;
      body.style.top = previousTop;
      body.style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);

  const readyToImport = drafts.some((draft) => draft.assetName.trim());
  const totalConfidence = useMemo(() => {
    if (!drafts.length) {
      return 0;
    }

    return drafts.reduce((sum, draft) => sum + draft.confidence, 0) / drafts.length;
  }, [drafts]);

  function updateDraft(index: number, patch: Partial<ImportableHoldingDraft>) {
    setDrafts((current) => current.map((draft, currentIndex) => (currentIndex === index ? { ...draft, ...patch } : draft)));
  }

  async function handleAnalyze() {
    if (!files.length) {
      setError("Upload at least one screenshot to analyze.");
      return;
    }

    setStatus("analyzing");
    setError(null);
    setWarnings([]);

    const formData = new FormData();
    if (platformHint) {
      formData.append("platformHint", platformHint);
    }

    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(HOLDINGS_IMPORT_ROUTE, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as HoldingsExtractionResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to analyze screenshots.");
      }

      setDrafts(payload.holdings);
      setWarnings(payload.warnings || []);
      setRequestedModel(payload.requestedModel || "");
      setUsedModel(payload.usedModel || "");
      setStatus("review");
      hapticSuccess();
    } catch (analysisError) {
      setStatus("idle");
      setError(analysisError instanceof Error ? analysisError.message : "Failed to analyze screenshots.");
    }
  }

  function handleAddEmptyDraft() {
    medium();
    setDrafts((current) => [...current, createEmptyDraft(platformHint)]);
    setStatus("review");
  }

  function handleImport() {
    const importedHoldings = drafts
      .filter((draft) => draft.assetName.trim())
      .map((draft) => draftToHolding(draft));

    if (!importedHoldings.length) {
      setError("Add or keep at least one holding before importing.");
      return;
    }

    hapticSuccess();
    onImport(importedHoldings);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm" />
      <div
        className="relative my-6 w-full max-w-6xl rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">AI screenshot import</div>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em] text-slate-900">Upload, verify, then add holdings</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                The model drafts portfolio rows from your screenshots, but nothing is saved until you review and confirm each line.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                tap();
                onClose();
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100"
              aria-label="Close importer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 p-5 lg:border-b-0 lg:border-r">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
              <label className="block text-sm">
                <span className="mb-2 block text-sm font-medium text-slate-700">Platform hint</span>
                <select
                  value={platformHint}
                  onChange={(event) => setPlatformHint(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                >
                  <option value="">Auto-detect</option>
                  {PLATFORM_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-4 block text-sm">
                <span className="mb-2 block text-sm font-medium text-slate-700">Screenshots</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const nextFiles = Array.from(event.target.files || []).slice(0, HOLDINGS_IMPORT_MAX_FILES);
                    setFiles(nextFiles);
                    setStatus("idle");
                    setError(null);
                    setDrafts([]);
                    setWarnings([]);
                  }}
                  className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                />
              </label>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Upload up to {HOLDINGS_IMPORT_MAX_FILES} screenshots in one batch. Multiple screenshots help when a portfolio list spans more than one screen.
              </p>

              <button
                type="button"
                onClick={() => {
                  tap();
                  void handleAnalyze();
                }}
                disabled={status === "analyzing" || !files.length}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "analyzing" ? "Analyzing screenshots..." : "Analyze screenshots"}
              </button>
            </div>

            {files.length ? (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Uploaded files</div>
                <div className="grid gap-2">
                  {files.map((file) => (
                    <FileBadge key={`${file.name}-${file.size}`} name={file.name} size={file.size} />
                  ))}
                </div>
              </div>
            ) : null}

            {previewUrls.length ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {previewUrls.map((previewUrl, index) => (
                  <Image
                    key={previewUrl}
                    src={previewUrl}
                    alt={`Screenshot preview ${index + 1}`}
                    width={320}
                    height={400}
                    unoptimized
                    className="aspect-[4/5] h-auto w-full rounded-2xl border border-slate-200 object-cover"
                  />
                ))}
              </div>
            ) : null}
          </aside>

          <section className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-5 sm:p-6">
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            {warnings.length ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="font-semibold text-amber-900">Review notes</div>
                <ul className="mt-2 space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {status !== "review" ? (
              <div className="rounded-[1.7rem] border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white ring-1 ring-slate-200">
                  <svg className="h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V17a2 2 0 002 2h14a2 2 0 002-2v-.5M7 10l5-5 5 5M12 5v12" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">Start with screenshots from your broker or exchange</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Once analysis completes, you’ll get editable holdings with confidence hints before anything is added.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-3 rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {drafts.length} drafted {drafts.length === 1 ? "holding" : "holdings"}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Average confidence {formatConfidence(totalConfidence)}
                      {usedModel ? ` • ${usedModel}` : requestedModel ? ` • ${requestedModel}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleAddEmptyDraft}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Add row manually
                    </button>
                    <button
                      type="button"
                      onClick={handleImport}
                      disabled={!readyToImport}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Add verified holdings
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {drafts.map((draft, index) => (
                    <div key={`${draft.assetName}-${index}`} className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">Holding {index + 1}</div>
                          <div className="mt-1 text-sm text-slate-600">{draft.extractionNotes || "Verify each field before import."}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            {formatConfidence(draft.confidence)}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              medium();
                              setDrafts((current) => current.filter((_, currentIndex) => currentIndex !== index));
                            }}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <TextField label="Asset name" value={draft.assetName} onChange={(value) => updateDraft(index, { assetName: value })} />
                        <TextField label="Ticker" value={draft.ticker} onChange={(value) => updateDraft(index, { ticker: value.toUpperCase() })} />
                        <SelectField
                          label="Platform"
                          value={draft.platform}
                          options={PLATFORM_OPTIONS}
                          onChange={(value) => updateDraft(index, { platform: value as Platform })}
                        />
                        <SelectField
                          label="Asset class"
                          value={draft.assetClass}
                          options={ASSET_CLASS_OPTIONS}
                          onChange={(value) => updateDraft(index, { assetClass: value as AssetClass, allocationClass: value })}
                        />
                        <SelectField
                          label="Allocation group"
                          value={draft.allocationClass || draft.assetClass}
                          options={ASSET_CLASS_OPTIONS}
                          onChange={(value) => updateDraft(index, { allocationClass: value as AssetClass })}
                        />
                        <SelectField
                          label="Geography"
                          value={draft.geography}
                          options={GEOGRAPHY_OPTIONS}
                          onChange={(value) => updateDraft(index, { geography: value as Geography })}
                        />
                        <SelectField
                          label="Currency"
                          value={draft.currency}
                          options={CURRENCY_OPTIONS}
                          onChange={(value) => updateDraft(index, { currency: value as Currency })}
                        />
                        <SelectField
                          label="Risk"
                          value={draft.risk || "Medium"}
                          options={RISK_OPTIONS}
                          onChange={(value) => updateDraft(index, { risk: value as Risk })}
                        />
                        <NumberField label="Quantity" value={draft.quantity} onChange={(value) => updateDraft(index, { quantity: value })} />
                        <NumberField label="Avg buy price" value={draft.avgBuyPrice} onChange={(value) => updateDraft(index, { avgBuyPrice: value })} />
                        <NumberField label="Current price" value={draft.currentPrice || 0} onChange={(value) => updateDraft(index, { currentPrice: value })} />
                        <TextField label="Scheme code" value={draft.schemeCode || ""} onChange={(value) => updateDraft(index, { schemeCode: value })} />
                        <TextField label="Sector" value={draft.sector || ""} onChange={(value) => updateDraft(index, { sector: value })} />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <TextareaField label="Notes" value={draft.notes || ""} onChange={(value) => updateDraft(index, { notes: value })} />
                        <TextareaField
                          label="Extraction notes"
                          value={draft.extractionNotes || ""}
                          onChange={(value) => updateDraft(index, { extractionNotes: value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2" />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        type="number"
        step="any"
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-slate-200 px-3 py-2"
      />
    </label>
  );
}

function SelectField({
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
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2"
      />
    </label>
  );
}
