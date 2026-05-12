import {
  HOLDINGS_EXTRACTION_SCHEMA,
  parseLikelyJson,
  type HoldingsExtractionResult,
  type ImagePayload,
  buildHoldingsExtractionPrompt,
  sanitizeHoldingsExtractionResult,
} from "@/lib/ai/holdings-import";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
export const DEFAULT_PINNED_OPENROUTER_VISION_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  model?: string;
  choices?: OpenRouterChoice[];
}

interface ExtractionAttempt {
  label: string;
  model: string;
  requireParameters: boolean;
  responseFormat?:
    | {
        type: "json_schema";
        json_schema: typeof HOLDINGS_EXTRACTION_SCHEMA;
      }
    | {
        type: "json_object";
      };
}

function getOpenRouterHeaders() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(process.env.OPENROUTER_APP_URL ? { "HTTP-Referer": process.env.OPENROUTER_APP_URL } : {}),
    ...(process.env.OPENROUTER_APP_NAME ? { "X-Title": process.env.OPENROUTER_APP_NAME } : {}),
  };
}

export async function extractHoldingsWithOpenRouter({
  images,
  platformHint,
}: {
  images: ImagePayload[];
  platformHint?: string | null;
}): Promise<HoldingsExtractionResult> {
  const configuredModel = process.env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const attempts: ExtractionAttempt[] = [];

  function pushAttempt(attempt: ExtractionAttempt) {
    const exists = attempts.some(
      (current) =>
        current.model === attempt.model &&
        current.requireParameters === attempt.requireParameters &&
        current.responseFormat?.type === attempt.responseFormat?.type
    );
    if (!exists) {
      attempts.push(attempt);
    }
  }

  pushAttempt({
    label: "configured strict schema",
    model: configuredModel,
    requireParameters: true,
    responseFormat: {
      type: "json_schema",
      json_schema: HOLDINGS_EXTRACTION_SCHEMA,
    },
  });

  pushAttempt({
    label: "pinned strict schema",
    model: DEFAULT_PINNED_OPENROUTER_VISION_MODEL,
    requireParameters: true,
    responseFormat: {
      type: "json_schema",
      json_schema: HOLDINGS_EXTRACTION_SCHEMA,
    },
  });

  pushAttempt({
    label: "configured json mode",
    model: configuredModel,
    requireParameters: false,
    responseFormat: {
      type: "json_object",
    },
  });

  pushAttempt({
    label: "pinned json mode",
    model: DEFAULT_PINNED_OPENROUTER_VISION_MODEL,
    requireParameters: false,
    responseFormat: {
      type: "json_object",
    },
  });

  pushAttempt({
    label: "configured plain completion",
    model: configuredModel,
    requireParameters: false,
  });

  pushAttempt({
    label: "pinned plain completion",
    model: DEFAULT_PINNED_OPENROUTER_VISION_MODEL,
    requireParameters: false,
  });

  const errors: string[] = [];

  for (const attempt of attempts) {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: getOpenRouterHeaders(),
      body: JSON.stringify({
        model: attempt.model,
        provider: {
          require_parameters: attempt.requireParameters,
        },
        ...(attempt.responseFormat ? { response_format: attempt.responseFormat } : {}),
        plugins: [{ id: "response-healing" }],
        messages: [
          {
            role: "system",
            content: "You are a careful portfolio OCR assistant. Output valid JSON only with no markdown.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: buildHoldingsExtractionPrompt(platformHint),
              },
              ...images.map((image) => ({
                type: "image_url",
                image_url: {
                  url: image.dataUrl,
                },
              })),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      errors.push(`${attempt.label} [${attempt.model}] failed (${response.status}): ${errorText || "Unknown error"}`);
      continue;
    }

    const payload = (await response.json()) as OpenRouterResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      errors.push(`${attempt.label} [${attempt.model}] returned an empty response.`);
      continue;
    }

    try {
      const parsed = parseLikelyJson(content);
      const result = sanitizeHoldingsExtractionResult(parsed, attempt.model);
      result.provider = "openrouter";
      result.usedModel = payload.model || result.usedModel;

      if (!attempt.responseFormat || attempt.responseFormat.type === "json_object") {
        result.warnings = [
          "The strict JSON-schema path was unavailable, so Portflow used a looser free-model fallback for this extraction.",
          ...result.warnings,
        ];
      }

      if (result.holdings.length > 0) {
        return result;
      }

      errors.push(`${attempt.label} [${attempt.model}] returned parseable JSON but no holdings were extracted.`);
    } catch {
      errors.push(`${attempt.label} [${attempt.model}] did not return parseable JSON.`);
    }
  }

  throw new Error(`OpenRouter extraction failed after free-model fallbacks. ${errors.join(" | ")}`);
}
