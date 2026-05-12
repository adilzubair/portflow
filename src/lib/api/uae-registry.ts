/**
 * UAE stock registry (DFM + ADX).
 *
 * Yahoo Finance does not reliably surface most UAE tickers, and DFM/ADX
 * provide no public search APIs. This is a curated list of the most
 * commonly held names across both exchanges. Match by name token overlap.
 */

interface UaeStock {
  ticker: string;
  names: string[];
  exchange: "DFM" | "ADX";
}

const UAE_STOCKS: UaeStock[] = [
  // DFM
  { ticker: "EMAAR", names: ["emaar", "emaar properties"], exchange: "DFM" },
  { ticker: "EMAARDEV", names: ["emaar development"], exchange: "DFM" },
  { ticker: "EMAARMALLS", names: ["emaar malls"], exchange: "DFM" },
  { ticker: "DEWA", names: ["dewa", "dubai electricity and water authority"], exchange: "DFM" },
  { ticker: "SALIK", names: ["salik", "salik company"], exchange: "DFM" },
  { ticker: "TECOM", names: ["tecom", "tecom group"], exchange: "DFM" },
  { ticker: "PARKIN", names: ["parkin", "parkin company"], exchange: "DFM" },
  { ticker: "DUBAIINV", names: ["dubai investments"], exchange: "DFM" },
  { ticker: "DIB", names: ["dib", "dubai islamic bank"], exchange: "DFM" },
  { ticker: "ENBD", names: ["enbd", "emirates nbd"], exchange: "DFM" },
  { ticker: "DU", names: ["du", "emirates integrated telecommunications"], exchange: "DFM" },
  { ticker: "MASHREQ", names: ["mashreq", "mashreqbank"], exchange: "DFM" },
  { ticker: "ARMX", names: ["aramex"], exchange: "DFM" },
  { ticker: "AMLAK", names: ["amlak finance"], exchange: "DFM" },
  { ticker: "AIRARABIA", names: ["air arabia"], exchange: "DFM" },
  { ticker: "DIC", names: ["dubai investments"], exchange: "DFM" },
  { ticker: "DFM", names: ["dfm", "dubai financial market"], exchange: "DFM" },
  { ticker: "GFH", names: ["gfh", "gfh financial"], exchange: "DFM" },
  { ticker: "SHUAA", names: ["shuaa capital"], exchange: "DFM" },
  { ticker: "AMANAT", names: ["amanat holdings"], exchange: "DFM" },
  { ticker: "TABREED", names: ["tabreed", "national central cooling"], exchange: "DFM" },
  { ticker: "EMPOWER", names: ["empower", "emirates central cooling"], exchange: "DFM" },
  { ticker: "UPP", names: ["union properties"], exchange: "DFM" },
  { ticker: "DEYAAR", names: ["deyaar development"], exchange: "DFM" },

  // ADX
  { ticker: "IHC", names: ["ihc", "international holding"], exchange: "ADX" },
  { ticker: "ADCB", names: ["adcb", "abu dhabi commercial bank"], exchange: "ADX" },
  { ticker: "FAB", names: ["fab", "first abu dhabi bank"], exchange: "ADX" },
  { ticker: "ADIB", names: ["adib", "abu dhabi islamic bank"], exchange: "ADX" },
  { ticker: "ETISALAT", names: ["etisalat", "e&", "emirates telecommunications"], exchange: "ADX" },
  { ticker: "ALDAR", names: ["aldar", "aldar properties"], exchange: "ADX" },
  { ticker: "TAQA", names: ["taqa", "abu dhabi national energy"], exchange: "ADX" },
  { ticker: "ADNOCDIST", names: ["adnoc distribution"], exchange: "ADX" },
  { ticker: "ADNOCDRILL", names: ["adnoc drilling"], exchange: "ADX" },
  { ticker: "ADNOCGAS", names: ["adnoc gas"], exchange: "ADX" },
  { ticker: "ADNOCLS", names: ["adnoc logistics", "adnoc l&s"], exchange: "ADX" },
  { ticker: "BOROUGE", names: ["borouge"], exchange: "ADX" },
  { ticker: "FERTIGLB", names: ["fertiglobe"], exchange: "ADX" },
  { ticker: "ADPORTS", names: ["ad ports", "abu dhabi ports"], exchange: "ADX" },
  { ticker: "AGTHIA", names: ["agthia"], exchange: "ADX" },
  { ticker: "MULTIPLY", names: ["multiply group"], exchange: "ADX" },
  { ticker: "PURE", names: ["pure health"], exchange: "ADX" },
  { ticker: "ALPHADHABI", names: ["alpha dhabi"], exchange: "ADX" },
  { ticker: "Q", names: ["q holding"], exchange: "ADX" },
  { ticker: "AMER", names: ["americana restaurants"], exchange: "ADX" },
  { ticker: "ESG", names: ["emirates stallions", "esg"], exchange: "ADX" },
  { ticker: "PRESIGHT", names: ["presight ai"], exchange: "ADX" },
  { ticker: "SPACE42", names: ["space42", "yahsat", "bayanat"], exchange: "ADX" },
  { ticker: "EMSTEEL", names: ["emsteel", "emirates steel"], exchange: "ADX" },
  { ticker: "NMDCENR", names: ["nmdc energy"], exchange: "ADX" },
];

export interface UaeMatch {
  ticker: string;
  exchange: "DFM" | "ADX";
  name: string;
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveUaeTicker(assetName: string): UaeMatch | null {
  const trimmed = assetName?.trim();
  if (!trimmed) return null;

  const haystack = normalize(trimmed);
  if (!haystack) return null;

  let best: { stock: UaeStock; score: number } | null = null;

  for (const stock of UAE_STOCKS) {
    for (const candidate of stock.names) {
      const needle = normalize(candidate);
      if (!needle) continue;
      let score = 0;
      if (haystack === needle) {
        score = 1;
      } else if (haystack.startsWith(`${needle} `) || haystack.endsWith(` ${needle}`)) {
        score = 0.9;
      } else if (haystack.includes(` ${needle} `) || haystack.includes(needle)) {
        score = 0.75;
      }
      if (score > 0 && (!best || score > best.score)) {
        best = { stock, score };
      }
    }
  }

  if (!best || best.score < 0.75) return null;

  return {
    ticker: best.stock.ticker,
    exchange: best.stock.exchange,
    name: best.stock.names[0],
  };
}
