export interface DfmQuote {
  id: string;
  lastradeprice: number;
  previousclosingprice: number;
  changepercentage: number;
  lastradetime: string | null;
}

export async function fetchDfmQuotes(symbols: string[]): Promise<Record<string, DfmQuote>> {
  try {
    const response = await fetch("https://api2.dfm.ae/mw/v1/stocks", {
      next: { revalidate: 900 },
    });
    if (!response.ok) {
      throw new Error(`DFM error: ${response.status}`);
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    const wanted = new Set(symbols);
    const results: Record<string, DfmQuote> = {};

    for (const row of data) {
      const id = String(row.id || "");
      if (!wanted.has(id)) continue;

      results[id] = {
        id,
        lastradeprice: Number(row.lastradeprice || 0),
        previousclosingprice: Number(row.previousclosingprice || 0),
        changepercentage: Number(row.changepercentage || 0),
        lastradetime: typeof row.lastraded === "string" ? row.lastraded : null,
      };
    }

    return results;
  } catch (error) {
    console.error("DFM: failed to fetch delayed quotes:", error);
    return {};
  }
}
