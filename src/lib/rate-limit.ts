import { NextResponse } from "next/server";

// In-memory fixed-window rate limiter, keyed by bucket + client IP.
// Note: state is per server instance. On serverless hosting each warm
// instance counts separately, so treat the limits here as a burst guard;
// for a hard global limit use an external store (e.g. Upstash) or a WAF rule.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, w] of windows) {
    if (w.resetAt <= now) windows.delete(key);
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimit(
  bucket: string,
  clientId: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  cleanupExpired(now);

  const key = `${bucket}:${clientId}`;
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count++;
  if (current.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

// Convenience guard for route handlers: returns a 429 response when the
// caller exceeded the limit, or null when the request may proceed.
export function checkRateLimit(
  request: Request,
  bucket: string,
  options: { limit: number; windowMs: number },
): NextResponse | null {
  const { allowed, retryAfterSeconds } = rateLimit(
    bucket,
    getClientIp(request),
    options,
  );
  if (allowed) return null;
  return NextResponse.json(
    { error: "יותר מדי ניסיונות, נסו שוב בעוד רגע" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}
