import { HttpResponseError } from "@/server/route-utils";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  discriminator?: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function clientIpFor(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();

  return forwardedFor || realIp || connectingIp || "unknown";
}

function cleanupExpiredBuckets(now: number): void {
  if (buckets.size < 1_000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function assertRateLimit(request: Request, scope: string, options: RateLimitOptions): void {
  const now = Date.now();
  const key = [scope, clientIpFor(request), options.discriminator].filter(Boolean).join(":");
  const current = buckets.get(key);

  cleanupExpiredBuckets(now);

  if (current === undefined || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return;
  }

  if (current.count >= options.limit) {
    throw new HttpResponseError(429, "Too many requests. Please try again shortly.");
  }

  current.count += 1;
}
