/**
 * Per-user AI usage and cost tracking.
 *
 * Both providers return token counts; OpenRouter optionally returns the
 * exact billed cost when the request includes `usage: { include: true }`.
 * For OpenAI we compute cost from a maintained pricing table because the
 * API doesn't expose pricing in responses.
 *
 * Writes go into the `ai_usage` Supabase table via the user's authenticated
 * session. Errors are swallowed and logged — usage tracking must never
 * cause a user-facing failure.
 */

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD. Authoritative when from OpenRouter; computed from pricing table for OpenAI. */
  costUsd: number;
  /** True when costUsd had to be computed because the provider didn't return one. */
  costEstimated: boolean;
}

/**
 * OpenAI pricing in USD per 1M tokens.
 * Source: https://openai.com/api/pricing/ (update when pricing changes).
 * Lookup is by prefix-match so dated model IDs (e.g. "gpt-4o-mini-2024-07-18") still resolve.
 */
const OPENAI_PRICING: Array<{ prefix: string; inputPerM: number; outputPerM: number }> = [
  { prefix: "gpt-4.1-nano", inputPerM: 0.1, outputPerM: 0.4 },
  { prefix: "gpt-4.1-mini", inputPerM: 0.4, outputPerM: 1.6 },
  { prefix: "gpt-4.1", inputPerM: 2.0, outputPerM: 8.0 },
  { prefix: "gpt-4o-mini", inputPerM: 0.15, outputPerM: 0.6 },
  { prefix: "gpt-4o", inputPerM: 2.5, outputPerM: 10.0 },
  { prefix: "o4-mini", inputPerM: 1.1, outputPerM: 4.4 },
  { prefix: "o3-mini", inputPerM: 1.1, outputPerM: 4.4 },
];

export function computeOpenAiCost(model: string, promptTokens: number, completionTokens: number): number {
  const entry = OPENAI_PRICING.find((row) => model.startsWith(row.prefix));
  if (!entry) return 0;
  return (promptTokens * entry.inputPerM + completionTokens * entry.outputPerM) / 1_000_000;
}

interface SupabaseInsertClient {
  from(table: string): {
    insert(rows: Record<string, unknown>): Promise<{ error: unknown }>;
  };
}

export async function recordAiUsage(params: {
  supabase: unknown;
  userId: string;
  provider: "openai" | "openrouter";
  model: string;
  requestKind: string;
  usage: ProviderUsage;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { supabase, userId, provider, model, requestKind, usage, metadata } = params;
  try {
    const client = supabase as SupabaseInsertClient;
    const { error } = await client.from("ai_usage").insert({
      user_id: userId,
      provider,
      model,
      request_kind: requestKind,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      total_tokens: usage.totalTokens,
      cost_usd: Number(usage.costUsd.toFixed(6)),
      metadata: metadata ?? null,
    });
    if (error) {
      console.error("[ai-usage] insert failed", error);
    }
  } catch (error) {
    console.error("[ai-usage] unexpected error", error);
  }
}
