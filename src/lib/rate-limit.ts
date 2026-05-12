import { NextResponse } from "next/server";

interface RateLimitPolicy {
  scope: string;
  limit: number;
  windowSeconds: number;
}

interface RateLimitRow {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

interface RateLimitResult extends RateLimitRow {
  scope: string;
  limit: number;
  windowSeconds: number;
}

type SupabaseRateLimitClient = {
  rpc?: (
    fn: string,
    args: Record<string, string | number>
  ) => Promise<{ data: RateLimitRow[] | RateLimitRow | null; error: { message: string } | null }>;
};

const IP_HASH_SALT = process.env.RATE_LIMIT_IP_SALT || "portflow-rate-limit";

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const RATE_LIMIT_POLICIES = {
  aiExtractAccount: {
    scope: "holdings_extract:account",
    limit: envNumber("RATE_LIMIT_AI_ACCOUNT_PER_HOUR", 20),
    windowSeconds: 60 * 60,
  },
  aiExtractIp: {
    scope: "holdings_extract:ip",
    limit: envNumber("RATE_LIMIT_AI_IP_PER_HOUR", 40),
    windowSeconds: 60 * 60,
  },
  holdingsReadAccount: {
    scope: "holdings_read:account",
    limit: envNumber("RATE_LIMIT_HOLDINGS_READ_ACCOUNT_PER_MINUTE", 180),
    windowSeconds: 60,
  },
  holdingsReadIp: {
    scope: "holdings_read:ip",
    limit: envNumber("RATE_LIMIT_HOLDINGS_READ_IP_PER_MINUTE", 360),
    windowSeconds: 60,
  },
  holdingsWriteAccount: {
    scope: "holdings_write:account",
    limit: envNumber("RATE_LIMIT_HOLDINGS_WRITE_ACCOUNT_PER_MINUTE", 60),
    windowSeconds: 60,
  },
  holdingsWriteIp: {
    scope: "holdings_write:ip",
    limit: envNumber("RATE_LIMIT_HOLDINGS_WRITE_IP_PER_MINUTE", 120),
    windowSeconds: 60,
  },
  priceRefreshAccount: {
    scope: "price_refresh:account",
    limit: envNumber("RATE_LIMIT_PRICE_REFRESH_ACCOUNT_PER_HOUR", 60),
    windowSeconds: 60 * 60,
  },
  priceRefreshIp: {
    scope: "price_refresh:ip",
    limit: envNumber("RATE_LIMIT_PRICE_REFRESH_IP_PER_HOUR", 120),
    windowSeconds: 60 * 60,
  },
  priceCheckAccount: {
    scope: "price_check:account",
    limit: envNumber("RATE_LIMIT_PRICE_CHECK_ACCOUNT_PER_MINUTE", 60),
    windowSeconds: 60,
  },
  priceCheckIp: {
    scope: "price_check:ip",
    limit: envNumber("RATE_LIMIT_PRICE_CHECK_IP_PER_MINUTE", 180),
    windowSeconds: 60,
  },
} satisfies Record<string, RateLimitPolicy>;

function hasRateLimitRpc(client: unknown): client is Required<SupabaseRateLimitClient> {
  return typeof client === "object" && client !== null && typeof (client as SupabaseRateLimitClient).rpc === "function";
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getIpBucket(request: Request) {
  return sha256(`${IP_HASH_SALT}:${getClientIp(request)}`);
}

async function consumeRateLimit(client: unknown, bucket: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
  if (!hasRateLimitRpc(client)) {
    return {
      scope: policy.scope,
      limit: policy.limit,
      windowSeconds: policy.windowSeconds,
      allowed: true,
      remaining: policy.limit,
      reset_at: new Date(Date.now() + policy.windowSeconds * 1000).toISOString(),
    };
  }

  const { data, error } = await client.rpc("consume_api_rate_limit", {
    p_scope: policy.scope,
    p_bucket: bucket,
    p_window_seconds: policy.windowSeconds,
    p_limit: policy.limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("Rate limit check returned no result");
  }

  return {
    ...row,
    scope: policy.scope,
    limit: policy.limit,
    windowSeconds: policy.windowSeconds,
  };
}

function getRetryAfterSeconds(result: RateLimitResult) {
  const resetAt = new Date(result.reset_at).getTime();
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return String(Math.max(retryAfter, 1));
}

function getRateLimitHeaders(result: RateLimitResult) {
  return {
    "Retry-After": getRetryAfterSeconds(result),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": result.reset_at,
    "X-RateLimit-Scope": result.scope,
  };
}

export async function enforceRateLimits({
  request,
  client,
  userId,
  accountPolicy,
  ipPolicy,
}: {
  request: Request;
  client: unknown;
  userId: string;
  accountPolicy: RateLimitPolicy;
  ipPolicy: RateLimitPolicy;
}) {
  const ipBucket = await getIpBucket(request);
  const ipResult = await consumeRateLimit(client, ipBucket, ipPolicy);

  if (!ipResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: getRateLimitHeaders(ipResult) }
    );
  }

  const accountResult = await consumeRateLimit(client, userId, accountPolicy);

  if (!accountResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests for this account. Please try again shortly." },
      { status: 429, headers: getRateLimitHeaders(accountResult) }
    );
  }

  return null;
}
