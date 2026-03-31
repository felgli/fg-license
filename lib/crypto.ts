import { createHash, timingSafeEqual } from "node:crypto";

/** SHA-256 hex digest of a string. */
export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Both strings must be the same length (hex digests are always 64 chars).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
