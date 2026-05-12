import {
  ASSET_CLASS_OPTIONS,
  CURRENCY_OPTIONS,
  GEOGRAPHY_OPTIONS,
  PLATFORM_OPTIONS,
  RISK_OPTIONS,
  type AllocationClass,
  type AssetClass,
  type Currency,
  type Geography,
  type Holding,
  type Platform,
  type Risk,
} from "@/lib/constants";

export const HOLDINGS_IMPORT_MAX_FILES = 4;
export const HOLDINGS_IMPORT_MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;
export const HOLDINGS_IMPORT_ROUTE = "/api/holdings/extract";

export type ModelProvider = "openrouter" | "openai";

export interface ImportableHoldingDraft {
  platform: string;
  assetName: string;
  ticker: string;
  assetClass: string;
  allocationClass?: string;
  sector?: string;
  geography: string;
  risk?: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
  currency: string;
  notes?: string;
  schemeCode?: string;
  confidence: number;
  extractionNotes?: string;
}

export interface HoldingsExtractionResult {
  provider: ModelProvider;
  requestedModel: string;
  usedModel: string | null;
  platformHint: string | null;
  warnings: string[];
  holdings: ImportableHoldingDraft[];
}

export interface ImagePayload {
  contentType: string;
  dataUrl: string;
  filename: string;
}

const VALID_ASSET_CLASSES = new Set<string>(ASSET_CLASS_OPTIONS);
const VALID_GEOGRAPHIES = new Set<string>(GEOGRAPHY_OPTIONS);
const VALID_CURRENCIES = new Set<string>(CURRENCY_OPTIONS);
const VALID_RISKS = new Set<string>(RISK_OPTIONS);
const VALID_PLATFORMS = new Set<string>(PLATFORM_OPTIONS);
const HOLDINGS_COLLECTION_KEYS = [
  "holdings",
  "assets",
  "positions",
  "portfolio",
  "items",
  "rows",
  "data",
  "extractedHoldings",
  "extracted_holdings",
] as const;
const ASSET_NAME_TICKER_HINTS: Array<{ pattern: RegExp; ticker: string }> = [
  { pattern: /\btesla\b/i, ticker: "TSLA" },
  { pattern: /\bapple\b/i, ticker: "AAPL" },
  { pattern: /\bmicrosoft\b/i, ticker: "MSFT" },
  { pattern: /\bbitcoin\b/i, ticker: "BTC" },
  { pattern: /\bethereum\b/i, ticker: "ETH" },
  { pattern: /\bgold\s*bees\b/i, ticker: "GOLDBEES" },
  { pattern: /\bmid\s*150\s*bees\b/i, ticker: "MID150BEES" },
  { pattern: /\bhdfc\s*small\s*cap\s*250\b/i, ticker: "HDFCSML250" },
];

function getObjectValue(record: Record<string, unknown>, keys: readonly string[]) {
  for (const key of keys) {
    if (key in record) {
      return record[key];
    }
  }

  return undefined;
}

function clampNumber(value: unknown, fallback = 0, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(minimum, parsed);
}

function asTrimmedString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export function parseLikelyJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fencedMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1].trim());
    }

    const arrayStart = content.indexOf("[");
    const arrayEnd = content.lastIndexOf("]");
    if (arrayStart !== -1 && arrayEnd > arrayStart) {
      return JSON.parse(content.slice(arrayStart, arrayEnd + 1));
    }

    const objectStart = content.indexOf("{");
    const objectEnd = content.lastIndexOf("}");
    if (objectStart !== -1 && objectEnd > objectStart) {
      return JSON.parse(content.slice(objectStart, objectEnd + 1));
    }

    throw new Error("No parseable JSON found in model response.");
  }
}

function inferNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!normalized) {
      return fallback;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function inferString(record: Record<string, unknown>, keys: readonly string[], fallback = "") {
  return asTrimmedString(getObjectValue(record, keys), fallback);
}

function inferNumberFromKeys(record: Record<string, unknown>, keys: readonly string[], fallback = 0) {
  return clampNumber(inferNumber(getObjectValue(record, keys), fallback), fallback);
}

function inferTickerFromAssetName(assetName: string) {
  const match = ASSET_NAME_TICKER_HINTS.find(({ pattern }) => pattern.test(assetName));
  return match?.ticker || "";
}

function isLikelyTickerSymbol(value: string) {
  const ticker = value.trim().toUpperCase();
  if (!ticker) return false;
  if (ticker.length > 15) return false;
  if (ticker.includes(" ")) return false;
  if (/[^A-Z0-9.:_-]/.test(ticker)) return false;
  if (!/[A-Z]/.test(ticker)) return false;
  return true;
}

function sanitizeInferredTicker(rawTicker: string, assetName: string) {
  const normalizedTicker = rawTicker.trim().toUpperCase();
  if (isLikelyTickerSymbol(normalizedTicker)) {
    return normalizedTicker;
  }

  if (normalizedTicker && assetName.trim() && normalizedTicker === assetName.trim().toUpperCase()) {
    return "";
  }

  return inferTickerFromAssetName(assetName);
}

export function normalizePlatform(value: string): Platform {
  const trimmed = value.trim();
  return VALID_PLATFORMS.has(trimmed) ? (trimmed as Platform) : "Custom";
}

export function normalizeAssetClass(value: string): AssetClass {
  if (VALID_ASSET_CLASSES.has(value)) {
    return value as AssetClass;
  }

  const lower = value.toLowerCase();

  if (lower.includes("crypto")) return "Crypto";
  if (lower.includes("mutual")) return "Mutual Funds";
  if (lower.includes("bond")) return "Bonds";
  if (lower.includes("cash")) return "Cash";
  if (lower.includes("gold")) return "Gold";
  if (lower.includes("etf")) return "ETFs";
  if (lower.includes("stock") || lower.includes("equity")) return "Stocks";

  return "Others";
}

export function normalizeAllocationClass(value: string | undefined, fallback: AssetClass): AllocationClass {
  if (value && VALID_ASSET_CLASSES.has(value)) {
    return value as AllocationClass;
  }

  return fallback;
}

export function normalizeGeography(value: string): Geography {
  if (VALID_GEOGRAPHIES.has(value)) {
    return value as Geography;
  }

  const lower = value.toLowerCase();

  if (lower.includes("india") || lower.includes("nse") || lower.includes("bse")) return "India";
  if (lower.includes("us") || lower.includes("usa") || lower.includes("nasdaq") || lower.includes("nyse")) return "US";
  if (lower.includes("uae") || lower.includes("dubai") || lower.includes("dfm") || lower.includes("adx")) return "UAE";
  if (lower.includes("global")) return "Global";

  return "Others";
}

export function normalizeCurrency(value: string, geography: Geography): Currency {
  if (VALID_CURRENCIES.has(value)) {
    return value as Currency;
  }

  const upper = value.toUpperCase();

  if (upper === "RS" || upper === "INR") return "INR";
  if (upper === "$" || upper === "USD") return "USD";
  if (upper === "AED" || upper === "DHS" || upper === "DIRHAM") return "AED";

  if (geography === "India") return "INR";
  if (geography === "US") return "USD";

  return "AED";
}

export function normalizeRisk(value: string | undefined): Risk {
  if (value && VALID_RISKS.has(value)) {
    return value as Risk;
  }

  return "Medium";
}

export function sanitizeHoldingDraft(input: unknown, platformHint?: string | null): ImportableHoldingDraft | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const record = input as Record<string, unknown>;
  const assetName = inferString(record, ["assetName", "asset_name", "name", "company", "holding", "instrument"]);
  if (!assetName) {
    return null;
  }

  const ticker = sanitizeInferredTicker(
    inferString(record, ["ticker", "symbol", "code", "securityCode", "security_code"]),
    assetName
  );
  const geography = normalizeGeography(inferString(record, ["geography", "region", "market", "exchange"], "Others"));
  const assetClass = normalizeAssetClass(inferString(record, ["assetClass", "asset_class", "type", "instrumentType", "instrument_type"], "Others"));
  const currency = normalizeCurrency(inferString(record, ["currency", "currencyCode", "currency_code", "money"], ""), geography);
  const quantity = inferNumberFromKeys(record, ["quantity", "qty", "units", "shares", "holdingQuantity", "holding_quantity"], 0);
  const avgBuyPriceRaw = inferNumberFromKeys(record, ["avgBuyPrice", "avg_buy_price", "averageBuyPrice", "average_buy_price", "avgPrice", "buyPrice", "buy_price"], 0);
  const currentPriceRaw = inferNumberFromKeys(record, ["currentPrice", "current_price", "ltp", "marketPrice", "market_price", "cmp", "price"], avgBuyPriceRaw);
  const investedValue = inferNumberFromKeys(record, ["investedAmount", "invested_amount", "costBasis", "cost_basis", "totalCost", "total_cost"], 0);
  const marketValue = inferNumberFromKeys(record, ["currentValue", "current_value", "marketValue", "market_value", "value"], 0);
  const avgBuyPrice = avgBuyPriceRaw || (quantity > 0 && investedValue > 0 ? investedValue / quantity : 0);
  const currentPrice = currentPriceRaw || (quantity > 0 && marketValue > 0 ? marketValue / quantity : avgBuyPrice);
  const platform = platformHint?.trim() || inferString(record, ["platform", "broker", "source"]) || "Custom";
  const confidence = Math.min(1, clampNumber(inferNumber(getObjectValue(record, ["confidence", "score", "certainty"]), 0.5), 0.5, 0));

  return {
    platform,
    assetName,
    ticker,
    assetClass,
    allocationClass: normalizeAllocationClass(inferString(record, ["allocationClass", "allocation_class", "category", "group"]), assetClass),
    sector: inferString(record, ["sector", "theme", "industry"]),
    geography,
    risk: normalizeRisk(inferString(record, ["risk", "riskLevel", "risk_level"])),
    quantity,
    avgBuyPrice,
    currentPrice,
    currency,
    notes: inferString(record, ["notes", "note", "remarks", "comments"]),
    schemeCode: inferString(record, ["schemeCode", "scheme_code", "amfiCode", "amfi_code"]) || undefined,
    confidence,
    extractionNotes: inferString(record, ["extractionNotes", "extraction_notes", "rationale", "reasoning", "ocrNotes", "ocr_notes"]),
  };
}

function extractDraftCandidates(input: unknown): unknown[] {
  if (Array.isArray(input)) {
    return input;
  }

  if (!input || typeof input !== "object") {
    return [];
  }

  const record = input as Record<string, unknown>;

  for (const key of HOLDINGS_COLLECTION_KEYS) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  if (record.portfolio && typeof record.portfolio === "object" && !Array.isArray(record.portfolio)) {
    const nestedPortfolio = record.portfolio as Record<string, unknown>;
    for (const key of HOLDINGS_COLLECTION_KEYS) {
      const value = nestedPortfolio[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  return [];
}

export function sanitizeHoldingsExtractionResult(input: unknown, requestedModel: string): HoldingsExtractionResult {
  const record = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const warnings = Array.isArray(getObjectValue(record, ["warnings", "issues", "reviewNotes", "review_notes"]))
    ? (getObjectValue(record, ["warnings", "issues", "reviewNotes", "review_notes"]) as unknown[])
        .map((warning) => asTrimmedString(warning))
        .filter(Boolean)
    : [];
  const platformHint = inferString(record, ["platformHint", "platform_hint", "platform", "broker"]) || null;
  const drafts = extractDraftCandidates(input);
  const holdings = drafts
    .map((draft) => sanitizeHoldingDraft(draft, platformHint))
    .filter((draft): draft is ImportableHoldingDraft => Boolean(draft));

  return {
    provider: "openrouter",
    requestedModel,
    usedModel: inferString(record, ["usedModel", "used_model", "model"]) || null,
    platformHint,
    warnings,
    holdings,
  };
}

export function draftToHolding(draft: ImportableHoldingDraft): Holding {
  const assetClass = normalizeAssetClass(draft.assetClass);
  const geography = normalizeGeography(draft.geography);
  const currency = normalizeCurrency(draft.currency, geography);

  return {
    id: "",
    platform: normalizePlatform(draft.platform),
    assetName: draft.assetName.trim(),
    ticker: draft.ticker.trim().toUpperCase(),
    assetClass,
    allocationClass: normalizeAllocationClass(draft.allocationClass, assetClass),
    sector: draft.sector?.trim() || "",
    geography,
    risk: normalizeRisk(draft.risk),
    quantity: clampNumber(draft.quantity),
    avgBuyPrice: clampNumber(draft.avgBuyPrice),
    currentPrice: clampNumber(draft.currentPrice, clampNumber(draft.avgBuyPrice)),
    currency,
    notes: draft.notes?.trim() || "",
    priceSource: "manual",
    schemeCode: draft.schemeCode?.trim() || undefined,
  };
}

export async function fileToImagePayload(file: File): Promise<ImagePayload> {
  if (!file.type.startsWith("image/")) {
    throw new Error(`${file.name} is not an image file.`);
  }

  if (file.size > HOLDINGS_IMPORT_MAX_FILE_SIZE_BYTES) {
    throw new Error(`${file.name} is larger than 6 MB.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    filename: file.name,
    contentType: file.type || "image/png",
    dataUrl: `data:${file.type || "image/png"};base64,${base64}`,
  };
}

export const HOLDINGS_EXTRACTION_SCHEMA = {
  name: "portfolio_holdings_extraction",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      platformHint: {
        type: "string",
        description: "The inferred or user-provided portfolio platform for this screenshot batch.",
      },
      warnings: {
        type: "array",
        description: "Portfolio-level warnings, ambiguities, or missing information the user should review.",
        items: { type: "string" },
      },
      usedModel: {
        type: "string",
        description: "The model that generated this extraction if known.",
      },
      holdings: {
        type: "array",
        description: "Only the visible holdings extracted from the screenshot batch.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            platform: { type: "string" },
            assetName: { type: "string" },
            ticker: { type: "string" },
            assetClass: {
              type: "string",
              enum: ASSET_CLASS_OPTIONS,
            },
            allocationClass: {
              type: "string",
              enum: ASSET_CLASS_OPTIONS,
            },
            sector: { type: "string" },
            geography: {
              type: "string",
              enum: GEOGRAPHY_OPTIONS,
            },
            risk: {
              type: "string",
              enum: RISK_OPTIONS,
            },
            quantity: { type: "number" },
            avgBuyPrice: { type: "number" },
            currentPrice: { type: "number" },
            currency: {
              type: "string",
              enum: CURRENCY_OPTIONS,
            },
            notes: { type: "string" },
            schemeCode: { type: "string" },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 1,
            },
            extractionNotes: { type: "string" },
          },
          required: [
            "platform",
            "assetName",
            "ticker",
            "assetClass",
            "allocationClass",
            "sector",
            "geography",
            "risk",
            "quantity",
            "avgBuyPrice",
            "currentPrice",
            "currency",
            "notes",
            "schemeCode",
            "confidence",
            "extractionNotes",
          ],
        },
      },
    },
    required: ["platformHint", "warnings", "usedModel", "holdings"],
  },
} as const;

export function buildHoldingsExtractionPrompt(platformHint?: string | null) {
  const selectedPlatform = platformHint?.trim() || "not provided";

  return [
    "You extract investment holdings from portfolio screenshots.",
    "Return only JSON that matches the provided schema.",
    "The top-level object must include platformHint, warnings, usedModel, and holdings.",
    "If strict schema formatting is not possible, return either that object shape or a top-level JSON array of holding objects.",
    "Never use a full company or fund name as the ticker symbol.",
    "If the ticker is not clearly visible or you are unsure, return an empty string for ticker instead of guessing.",
    "If a common market symbol is obvious from the screenshot, prefer the short tradable symbol such as TSLA, AAPL, BTC, GOLDBEES, or MID150BEES.",
    "If a value is not visible, infer conservatively and add a warning or extraction note.",
    "Do not invent holdings that are not visible.",
    "Treat each screenshot as part of one combined portfolio upload.",
    "Prefer the provided platform hint when it matches the visible UI.",
    "If current market price is not visible, reuse avgBuyPrice so the user can verify it later.",
    `Platform hint: ${selectedPlatform}.`,
    "Supported asset classes: Stocks, ETFs, Crypto, Mutual Funds, Cash, Gold, Bonds, Others.",
    "Supported geographies: India, US, UAE, Global, Others.",
    "Supported currencies: AED, USD, INR.",
    "Supported platforms: IG, iVestor, Binance, Groww, Custom.",
    "Confidence should be between 0 and 1.",
    "Keep notes and extractionNotes short and useful.",
  ].join("\n");
}
