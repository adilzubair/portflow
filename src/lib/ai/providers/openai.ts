import {
  HOLDINGS_EXTRACTION_SCHEMA,
  parseLikelyJson,
  type HoldingsExtractionResult,
  type ImagePayload,
  buildHoldingsExtractionPrompt,
  sanitizeHoldingsExtractionResult,
} from "@/lib/ai/holdings-import";

const OPENAI_URL = "https://api.openai.com/v1/responses";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

interface OpenAIResponseContentItem {
  type?: string;
  text?: string;
  refusal?: string;
}

interface OpenAIResponseOutputItem {
  content?: OpenAIResponseContentItem[];
}

interface OpenAIResponse {
  model?: string;
  output_text?: string;
  output?: OpenAIResponseOutputItem[];
}

function getOpenAIHeaders() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function extractOpenAIOutputText(payload: OpenAIResponse) {
  if (payload.output_text?.trim()) {
    return payload.output_text;
  }

  for (const item of payload.output || []) {
    for (const contentItem of item.content || []) {
      if (contentItem.type === "output_text" && contentItem.text?.trim()) {
        return contentItem.text;
      }

      if (contentItem.type === "refusal" && contentItem.refusal?.trim()) {
        throw new Error(`OpenAI refused the extraction request: ${contentItem.refusal}`);
      }
    }
  }

  throw new Error("OpenAI returned an empty extraction response.");
}

export async function extractHoldingsWithOpenAI({
  images,
  platformHint,
}: {
  images: ImagePayload[];
  platformHint?: string | null;
}): Promise<HoldingsExtractionResult> {
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: getOpenAIHeaders(),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_output_tokens: 2500,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a careful portfolio OCR assistant. Output valid JSON only with no markdown.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildHoldingsExtractionPrompt(platformHint),
            },
            ...images.map((image) => ({
              type: "input_image",
              image_url: image.dataUrl,
              detail: "auto",
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: HOLDINGS_EXTRACTION_SCHEMA.name,
          strict: HOLDINGS_EXTRACTION_SCHEMA.strict,
          schema: HOLDINGS_EXTRACTION_SCHEMA.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorText || "Unknown error"}`);
  }

  const payload = (await response.json()) as OpenAIResponse;
  const parsed = parseLikelyJson(extractOpenAIOutputText(payload));
  const result = sanitizeHoldingsExtractionResult(parsed, model);
  result.provider = "openai";
  result.usedModel = payload.model || result.usedModel || model;
  return result;
}
