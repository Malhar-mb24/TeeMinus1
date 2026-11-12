interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * In-memory sliding-window rate limiter keyed by endpoint + caller identifier.
 * Keeps bounded state and protects device pairing and sync endpoints from bursts.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  nowMs: number = Date.now()
): RateLimitResult {
  if (rateLimitStore.size > 5000) {
    for (const [entryKey, bucket] of rateLimitStore.entries()) {
      if (bucket.resetAt <= nowMs) {
        rateLimitStore.delete(entryKey);
      }
    }
  }

  const existing = rateLimitStore.get(key);
  if (!existing || existing.resetAt <= nowMs) {
    rateLimitStore.set(key, { count: 1, resetAt: nowMs + windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, maxRequests - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
  };
}

export function clearRateLimitStoreForTests(): void {
  rateLimitStore.clear();
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "local";
}

export function buildDeviceCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    Vary: "Origin",
  };
  if (origin.startsWith("chrome-extension://") || origin.startsWith("http://localhost")) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
