import "server-only";
import { ApiError } from "@/lib/api/http";
import { getLeadStore } from "@/lib/leads/store";
import type { LeadStore } from "@/lib/leads/types";

export async function requireStore(): Promise<LeadStore> {
  const store = await getLeadStore();
  if (!store) throw new ApiError("unavailable", "The database isn't reachable right now. Try again shortly.");
  return store;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Route ids are user input: reject anything that isn't a UUID before it reaches the database. */
export function requireUuid(id: string): string {
  if (!UUID.test(id)) throw new ApiError("not_found", "That record doesn't exist.");
  return id.toLowerCase();
}