/**
 * MFAPI.in scheme search with fuzzy name matching.
 *
 * The full scheme list (~9000 entries) is fetched once, cached in-process for
 * 24h, then matched against user-provided asset names using token overlap
 * scoring. Direct + Growth plans are preferred when ambiguous.
 */

interface MfapiScheme {
  schemeCode: string;
  schemeName: string;
}

interface SchemeListCache {
  fetchedAt: number;
  schemes: MfapiScheme[];
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let cache: SchemeListCache | null = null;
let inflight: Promise<MfapiScheme[]> | null = null;

const NOISE_TOKENS = new Set([
  "fund", "plan", "scheme", "the", "of", "and",
  "ltd", "limited", "mutual",
]);

const STRONG_BIAS_TOKENS = new Set([
  "direct", "growth",
]);

const NEGATIVE_BIAS_TOKENS = new Set([
  "idcw", "dividend", "regular", "payout", "reinvestment",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !NOISE_TOKENS.has(token));
}

async function fetchSchemeList(): Promise<MfapiScheme[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.schemes;
  }

  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const res = await fetch("https://api.mfapi.in/mf", { cache: "no-store" });
      if (!res.ok) throw new Error(`MFAPI list error: ${res.status}`);
      const raw = (await res.json()) as Array<{ schemeCode: number | string; schemeName: string }>;
      const schemes: MfapiScheme[] = raw.map((entry) => ({
        schemeCode: String(entry.schemeCode),
        schemeName: entry.schemeName,
      }));
      cache = { fetchedAt: Date.now(), schemes };
      return schemes;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export interface SchemeMatch {
  schemeCode: string;
  schemeName: string;
  confidence: number;
}

function scoreScheme(queryTokens: string[], schemeName: string): number {
  const schemeTokens = tokenize(schemeName);
  if (!queryTokens.length || !schemeTokens.length) return 0;

  const schemeSet = new Set(schemeTokens);
  let overlap = 0;
  for (const token of queryTokens) {
    if (schemeSet.has(token)) overlap += 1;
  }

  const baseScore = overlap / queryTokens.length;

  let bias = 0;
  for (const token of schemeTokens) {
    if (STRONG_BIAS_TOKENS.has(token)) bias += 0.05;
    if (NEGATIVE_BIAS_TOKENS.has(token)) bias -= 0.1;
  }

  const lengthPenalty = Math.min(0.1, Math.max(0, schemeTokens.length - queryTokens.length - 4) * 0.01);

  return baseScore + bias - lengthPenalty;
}

/**
 * Resolve an Indian mutual fund asset name to a scheme code.
 * Returns the best match above the confidence threshold, or null if no
 * confident match exists.
 */
export async function resolveSchemeByName(
  assetName: string,
  options: { minConfidence?: number } = {}
): Promise<SchemeMatch | null> {
  const minConfidence = options.minConfidence ?? 0.7;
  const trimmed = assetName?.trim();
  if (!trimmed) return null;

  const queryTokens = tokenize(trimmed);
  if (queryTokens.length < 2) return null;

  const schemes = await fetchSchemeList();

  let best: SchemeMatch | null = null;
  for (const scheme of schemes) {
    const score = scoreScheme(queryTokens, scheme.schemeName);
    if (score >= minConfidence && (!best || score > best.confidence)) {
      best = {
        schemeCode: scheme.schemeCode,
        schemeName: scheme.schemeName,
        confidence: score,
      };
    }
  }

  return best;
}
