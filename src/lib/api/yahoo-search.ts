/**
 * Yahoo Finance symbol search for stocks/ETFs.
 *
 * Uses the public search endpoint to resolve a company/fund name into a
 * tradeable ticker. Results are filtered by exchange to scope to the
 * requested geography (India NSE/BSE, US NASDAQ/NYSE/AMEX).
 */

import type { Geography } from "@/lib/constants";

interface YahooSearchQuote {
  symbol: string;
  exchange?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  score?: number;
}

const EXCHANGES_BY_GEOGRAPHY: Record<Geography, Set<string>> = {
  India: new Set(["NSI", "BSE", "NSE"]),
  US: new Set(["NMS", "NYQ", "NGM", "ASE", "PCX", "BTS"]),
  UAE: new Set(["DFM", "ADX"]),
  Global: new Set(),
  Others: new Set(),
};

const VALID_QUOTE_TYPES = new Set(["EQUITY", "ETF", "MUTUALFUND"]);

const cache = new Map<string, { fetchedAt: number; symbol: string | null }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SymbolMatch {
  symbol: string;
  exchange: string;
  name: string;
}

function buildCacheKey(query: string, geography: Geography) {
  return `${geography}|${query.trim().toLowerCase()}`;
}

/**
 * Resolve an asset name to its tradeable ticker on the requested market.
 * Returns null if no clear match is found on a supported exchange.
 */
export async function resolveTickerByName(
  assetName: string,
  geography: Geography
): Promise<SymbolMatch | null> {
  const trimmed = assetName?.trim();
  if (!trimmed) return null;

  const allowedExchanges = EXCHANGES_BY_GEOGRAPHY[geography];
  if (!allowedExchanges || allowedExchanges.size === 0) return null;

  const cacheKey = buildCacheKey(trimmed, geography);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    if (!cached.symbol) return null;
    return { symbol: cached.symbol, exchange: "", name: trimmed };
  }

  try {
    const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("quotesCount", "10");
    url.searchParams.set("newsCount", "0");

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) throw new Error(`Yahoo search error: ${res.status}`);
    const data = (await res.json()) as { quotes?: YahooSearchQuote[] };
    const quotes = data.quotes ?? [];

    const filtered = quotes.filter(
      (q) =>
        q.symbol &&
        q.quoteType &&
        VALID_QUOTE_TYPES.has(q.quoteType) &&
        q.exchange &&
        allowedExchanges.has(q.exchange)
    );

    if (filtered.length === 0) {
      cache.set(cacheKey, { fetchedAt: Date.now(), symbol: null });
      return null;
    }

    const best = filtered[0];
    const symbol = best.symbol.replace(/\.NS$|\.BO$/, "");
    cache.set(cacheKey, { fetchedAt: Date.now(), symbol });

    return {
      symbol,
      exchange: best.exchange ?? "",
      name: best.longname || best.shortname || trimmed,
    };
  } catch (error) {
    console.error("[yahoo-search]", error);
    return null;
  }
}
