export type HoldingsImportProviderName = "openai" | "openrouter";

export function resolveHoldingsImportProvider(): HoldingsImportProviderName {
  const configuredProvider = process.env.PORTFOLIO_IMPORT_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "openai") {
    return "openai";
  }

  if (configuredProvider === "openrouter") {
    return "openrouter";
  }

  if (process.env.OPENAI_API_KEY) {
    return "openai";
  }

  return "openrouter";
}
