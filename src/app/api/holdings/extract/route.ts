import { NextResponse } from "next/server";
import { checkApproval, createClient } from "@/lib/supabase/server";
import {
  HOLDINGS_IMPORT_MAX_FILES,
  fileToImagePayload,
} from "@/lib/ai/holdings-import";
import { resolveHoldingsImportProvider } from "@/lib/ai/provider";
import { extractHoldingsWithOpenAI } from "@/lib/ai/providers/openai";
import { extractHoldingsWithOpenRouter } from "@/lib/ai/providers/openrouter";
import { recordAiUsage } from "@/lib/ai/usage";
import { RATE_LIMIT_POLICIES, enforceRateLimits } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deniedResponse = await checkApproval(supabase, user.id);
    if (deniedResponse) return deniedResponse;

    const rateLimitResponse = await enforceRateLimits({
      request,
      client: supabase,
      userId: user.id,
      accountPolicy: RATE_LIMIT_POLICIES.aiExtractAccount,
      ipPolicy: RATE_LIMIT_POLICIES.aiExtractIp,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const formData = await request.formData();
    const platformHintRaw = formData.get("platformHint");
    const platformHint = typeof platformHintRaw === "string" ? platformHintRaw : null;
    const files = formData
      .getAll("files")
      .filter((file): file is File => typeof File !== "undefined" && file instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "Upload at least one screenshot." }, { status: 400 });
    }

    if (files.length > HOLDINGS_IMPORT_MAX_FILES) {
      return NextResponse.json(
        {
          error: `The free tier supports up to ${HOLDINGS_IMPORT_MAX_FILES} screenshots per import. Higher limits will be available on a paid plan soon.`,
          code: "FREE_TIER_PHOTO_LIMIT",
          limit: HOLDINGS_IMPORT_MAX_FILES,
        },
        { status: 400 }
      );
    }

    const images = await Promise.all(files.map((file) => fileToImagePayload(file)));
    const provider = resolveHoldingsImportProvider();
    const extraction =
      provider === "openai"
        ? await extractHoldingsWithOpenAI({ images, platformHint })
        : await extractHoldingsWithOpenRouter({ images, platformHint });

    // Fire-and-forget usage tracking. Never block the response on this.
    void recordAiUsage({
      supabase,
      userId: user.id,
      provider: extraction.result.provider,
      model: extraction.model,
      requestKind: "holdings_extract",
      usage: extraction.usage,
      metadata: {
        imageCount: files.length,
        holdingsExtracted: extraction.result.holdings.length,
        platformHint: extraction.result.platformHint,
        costEstimated: extraction.usage.costEstimated,
      },
    });

    return NextResponse.json(extraction.result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to extract holdings from screenshots.",
      },
      { status: 500 }
    );
  }
}
