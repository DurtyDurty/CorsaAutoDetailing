import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets and tokens. Both sides are
 * hashed first, so inputs of any length or encoding compare without throwing
 * and without revealing the secret's length.
 */
export function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}
