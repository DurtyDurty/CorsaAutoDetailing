import "server-only";
import type { LeadStore } from "./types";

/**
 * Select the lead store.
 *
 * - Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 * - Local demo store otherwise, but ONLY outside production. In production
 *   with no durable backend the store is `null` and every form fails closed
 *   with an honest "temporarily unavailable" state.
 */

export type StoreKind = "supabase" | "demo" | "unavailable";

let cached: LeadStore | null | undefined;

export function storeKind(): StoreKind {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_STORE === "true") return "demo";
  return "unavailable";
}

export async function getLeadStore(): Promise<LeadStore | null> {
  if (cached !== undefined) return cached;
  const kind = storeKind();
  if (kind === "supabase") {
    const { SupabaseLeadStore } = await import("./supabase-store");
    cached = new SupabaseLeadStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  } else if (kind === "demo") {
    const { DemoLeadStore } = await import("./demo-store");
    cached = new DemoLeadStore();
  } else {
    cached = null;
  }
  return cached;
}

/** Test hook. */
export function resetLeadStoreCache() {
  cached = undefined;
}
