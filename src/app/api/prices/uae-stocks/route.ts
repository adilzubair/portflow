import { fetchTwelveDataQuotes } from '@/lib/api/twelvedata';
import { UAE_STOCK_TICKERS } from '@/lib/constants';
import { RATE_LIMIT_POLICIES, enforceRateLimits } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const rateLimitResponse = await enforceRateLimits({
    request,
    client: supabase,
    userId: user.id,
    accountPolicy: RATE_LIMIT_POLICIES.priceCheckAccount,
    ipPolicy: RATE_LIMIT_POLICIES.priceCheckIp,
  });
  if (rateLimitResponse) return rateLimitResponse;
  try {
    const results = await fetchTwelveDataQuotes(UAE_STOCK_TICKERS, 'DFM');
    return Response.json({ success: true, data: results, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('UAE Stocks API error:', error);
    return Response.json({ success: false, error: 'Failed to fetch UAE stock prices' }, { status: 500 });
  }
}
