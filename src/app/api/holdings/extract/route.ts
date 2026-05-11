import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  HOLDINGS_IMPORT_MAX_FILES,
  fileToImagePayload,
} from "@/lib/ai/holdings-import";
import { extractHoldingsWithOpenRouter } from "@/lib/ai/providers/openrouter";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: `Upload up to ${HOLDINGS_IMPORT_MAX_FILES} screenshots at a time.` }, { status: 400 });
    }

    const images = await Promise.all(files.map((file) => fileToImagePayload(file)));
    const extraction = await extractHoldingsWithOpenRouter({ images, platformHint });

    return NextResponse.json(extraction);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to extract holdings from screenshots.",
      },
      { status: 500 }
    );
  }
}
