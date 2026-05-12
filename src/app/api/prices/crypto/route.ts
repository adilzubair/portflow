import { fetchCryptoPrices } from '@/lib/api/coingecko';
import { CRYPTO_IDS } from '@/lib/constants';
import { RATE_LIMIT_POLICIES, enforceRateLimits } from '@/lib/rate-limit';
import { checkApproval, createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const deniedResponse = await checkApproval(supabase, user.id);
  if (deniedResponse) return deniedResponse;
  const rateLimitResponse = await enforceRateLimits({
    request,
    client: supabase,
    userId: user.id,
    accountPolicy: RATE_LIMIT_POLICIES.priceCheckAccount,
    ipPolicy: RATE_LIMIT_POLICIES.priceCheckIp,
  });
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const ids = Object.values(CRYPTO_IDS);
    const results = await fetchCryptoPrices(ids);
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Crypto API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch crypto prices' }, { status: 500 });
  }
}
