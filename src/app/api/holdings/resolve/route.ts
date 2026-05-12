import { NextResponse } from "next/server";
import { fetchRemoteHoldings, upsertRemoteHoldings } from "@/lib/holdings-store";
import { resolveHoldings } from "@/lib/holdings-resolver";
import { RATE_LIMIT_POLICIES, enforceRateLimits } from "@/lib/rate-limit";
import { checkApproval, createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deniedResponse = await checkApproval(supabase, user.id);
    if (deniedResponse) return deniedResponse;

    const rateLimitResponse = await enforceRateLimits({
      request,
      client: supabase,
      userId: user.id,
      accountPolicy: RATE_LIMIT_POLICIES.holdingsWriteAccount,
      ipPolicy: RATE_LIMIT_POLICIES.holdingsWriteIp,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const holdings = (await fetchRemoteHoldings(supabase, user.id)) || [];
    const { resolved, changedIds, reasons } = await resolveHoldings(holdings);

    const updates = resolved.filter((h) => changedIds.includes(h.id));
    if (updates.length > 0) {
      await upsertRemoteHoldings(supabase, user.id, updates);
    }

    return NextResponse.json({
      success: true,
      total: holdings.length,
      updatedCount: changedIds.length,
      updatedIds: changedIds,
      reasons,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve holdings" },
      { status: 500 }
    );
  }
}
