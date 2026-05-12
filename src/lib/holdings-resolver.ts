/**
 * Server-side holdings resolver.
 *
 * Enriches holdings with scheme codes (Indian MFs) and tradeable tickers
 * (stocks/ETFs across India, US, UAE) by calling external lookup services.
 * Must only run server-side because it hits third-party APIs.
 */

import type { Holding } from "@/lib/constants";
import { resolveSchemeByName } from "@/lib/api/mfapi-search";
import { resolveTickerByName } from "@/lib/api/yahoo-search";
import { resolveUaeTicker } from "@/lib/api/uae-registry";

export interface ResolveResult {
  holding: Holding;
  changed: boolean;
  reason?: string;
}

function isMissingSchemeCode(holding: Holding) {
  return holding.assetClass === "Mutual Funds" && !holding.schemeCode;
}

function isMissingTicker(holding: Holding) {
  if (!holding.ticker) return true;
  const ticker = holding.ticker.trim();
  if (ticker.length < 2) return true;
  return false;
}

async function resolveMutualFund(holding: Holding): Promise<ResolveResult> {
  if (!isMissingSchemeCode(holding)) {
    return { holding, changed: false };
  }
  const match = await resolveSchemeByName(holding.assetName);
  if (!match) {
    return { holding, changed: false, reason: "no-mf-match" };
  }
  return {
    holding: {
      ...holding,
      schemeCode: match.schemeCode,
      priceSource: "mfapi",
    },
    changed: true,
    reason: `matched ${match.schemeName} (${(match.confidence * 100).toFixed(0)}%)`,
  };
}

async function resolveStockOrEtf(holding: Holding): Promise<ResolveResult> {
  if (!isMissingTicker(holding)) {
    return { holding, changed: false };
  }

  if (holding.geography === "UAE") {
    const match = resolveUaeTicker(holding.assetName);
    if (!match) return { holding, changed: false, reason: "no-uae-match" };
    return {
      holding: { ...holding, ticker: match.ticker, priceSource: "dfm" },
      changed: true,
      reason: `matched ${match.ticker} on ${match.exchange}`,
    };
  }

  if (holding.geography === "India" || holding.geography === "US") {
    const match = await resolveTickerByName(holding.assetName, holding.geography);
    if (!match) return { holding, changed: false, reason: "no-ticker-match" };
    return {
      holding: {
        ...holding,
        ticker: match.symbol,
        priceSource: "alphavantage",
      },
      changed: true,
      reason: `matched ${match.symbol} on ${match.exchange}`,
    };
  }

  return { holding, changed: false };
}

export async function resolveHolding(holding: Holding): Promise<ResolveResult> {
  if (holding.assetClass === "Mutual Funds") {
    return resolveMutualFund(holding);
  }
  if (holding.assetClass === "Stocks" || holding.assetClass === "ETFs") {
    return resolveStockOrEtf(holding);
  }
  return { holding, changed: false };
}

export async function resolveHoldings(holdings: Holding[]): Promise<{
  resolved: Holding[];
  changedIds: string[];
  reasons: Record<string, string>;
}> {
  const results = await Promise.all(holdings.map(resolveHolding));
  const resolved: Holding[] = [];
  const changedIds: string[] = [];
  const reasons: Record<string, string> = {};

  results.forEach((result, index) => {
    resolved.push(result.holding);
    const id = holdings[index].id;
    if (result.changed) {
      changedIds.push(id);
    }
    if (result.reason) {
      reasons[id] = result.reason;
    }
  });

  return { resolved, changedIds, reasons };
}
