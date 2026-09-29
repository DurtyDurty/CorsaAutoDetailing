import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Sliding-window rate limiter keyed by a hashed client IP.
 *
 * In-memory: effective per server instance. On a single Node host this is a
 * real limit; on serverless it is best-effort per warm instance. The database
 * idempotency key and per-email duplicate check provide the second layer. See
 * docs/SETUP.md for upgrading to a shared store if abuse becomes a problem.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return { ok: false, retryAfterSeconds: Math.ceil((oldest + windowMs - now) / 1000) };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > MAX_KEYS) {
    // Drop the oldest-inserted key to bound memory.
    const first = buckets.keys().next().value;
    if (first) buckets.delete(first);
  }
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}

export async function clientKey(scope: string): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  // Hash so raw IPs are never kept in memory or logs.
  return `${scope}:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
}

/**
 * Standard limit for public form submissions: 6 per 10 minutes per client.
 * FORM_RATE_LIMIT overrides the count; only the e2e test servers set it (they
 * submit the same form many times from one IP). Never set it in production.
 */
export async function limitFormSubmission(scope: string): Promise<RateLimitResult> {
  const key = await clientKey(scope);
  const override = Number(process.env.FORM_RATE_LIMIT);
  const limit = Number.isInteger(override) && override > 0 ? override : 6;
  return checkRateLimit(key, limit, 10 * 60_000);
}
