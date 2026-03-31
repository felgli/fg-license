/**
 * Simple sliding-window rate limiter.
 * Uses in-memory storage (resets on cold start — acceptable for dev).
 * Swap the store implementation for Upstash Redis in production if needed.
 */

interface Window {
  timestamps: number[];
}

const store = new Map<string, Window>();

/** Returns true if the request is allowed. */
export function rateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(identifier) ?? { timestamps: [] };

  // Drop timestamps outside the current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    store.set(identifier, entry);
    return { allowed: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  store.set(identifier, entry);
  return { allowed: true, remaining: limit - entry.timestamps.length };
}

/** Extract the caller IP from a Next.js Request. */
export function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}
