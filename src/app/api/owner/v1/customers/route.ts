import { z } from "zod";
import type { CustomerOption } from "@shared/api";
import { json, parseQuery, withOwner } from "@/lib/api/http";
import { customerOptions } from "@/lib/owner/schedule";
import { requireStore } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const query = z.object({ q: z.string().trim().max(100).optional() });

/** Recent customers (one per email) to book again; `q` searches name, email, phone, vehicle and address. */
export const GET = withOwner(async (req) => {
  const { q } = parseQuery(req, query);
  return json<{ items: CustomerOption[] }>({ items: await customerOptions(await requireStore(), q) });
});