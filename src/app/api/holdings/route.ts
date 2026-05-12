import { NextResponse } from "next/server";
import type { Holding } from "@/lib/constants";
import { deleteRemoteHolding, fetchRemoteHoldings, replaceRemoteHoldings, upsertRemoteHoldings } from "@/lib/holdings-store";
import { resolveHoldings } from "@/lib/holdings-resolver";
import { RATE_LIMIT_POLICIES, enforceRateLimits } from "@/lib/rate-limit";
import { checkApproval, createClient } from "@/lib/supabase/server";

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, deniedResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const deniedResponse = await checkApproval(supabase, user.id);
  return { supabase, user: deniedResponse ? null : user, deniedResponse };
}

async function enforceHoldingsRateLimit({
  request,
  supabase,
  userId,
  mutation,
}: {
  request: Request;
  supabase: unknown;
  userId: string;
  mutation: boolean;
}) {
  return enforceRateLimits({
    request,
    client: supabase,
    userId,
    accountPolicy: mutation ? RATE_LIMIT_POLICIES.holdingsWriteAccount : RATE_LIMIT_POLICIES.holdingsReadAccount,
    ipPolicy: mutation ? RATE_LIMIT_POLICIES.holdingsWriteIp : RATE_LIMIT_POLICIES.holdingsReadIp,
  });
}

export async function GET(request: Request) {
  try {
    const { supabase, user, deniedResponse } = await requireUser();
    if (deniedResponse) return deniedResponse;

    const rateLimitResponse = await enforceHoldingsRateLimit({
      request,
      supabase,
      userId: user.id,
      mutation: false,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const holdings = await fetchRemoteHoldings(supabase, user.id);
    return NextResponse.json({ holdings: holdings || [] });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to fetch holdings") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user, deniedResponse } = await requireUser();
    if (deniedResponse) return deniedResponse;

    const rateLimitResponse = await enforceHoldingsRateLimit({
      request,
      supabase,
      userId: user.id,
      mutation: true,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = (await request.json()) as { holdings?: Holding[] };
    const { resolved } = await resolveHoldings(body.holdings || []);
    await replaceRemoteHoldings(supabase, user.id, resolved);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to replace holdings") }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user, deniedResponse } = await requireUser();
    if (deniedResponse) return deniedResponse;

    const rateLimitResponse = await enforceHoldingsRateLimit({
      request,
      supabase,
      userId: user.id,
      mutation: true,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = (await request.json()) as { holdings?: Holding[] };
    const { resolved } = await resolveHoldings(body.holdings || []);
    await upsertRemoteHoldings(supabase, user.id, resolved);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update holdings") }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { supabase, user, deniedResponse } = await requireUser();
    if (deniedResponse) return deniedResponse;

    const rateLimitResponse = await enforceHoldingsRateLimit({
      request,
      supabase,
      userId: user.id,
      mutation: true,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const holdingId = searchParams.get("id");

    if (holdingId) {
      await deleteRemoteHolding(supabase, user.id, holdingId);
      return NextResponse.json({ success: true });
    }

    await replaceRemoteHoldings(supabase, user.id, []);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to delete holdings") }, { status: 500 });
  }
}
