import { changeTotalSchema, type WorkResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { changeTotal } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Add to or take off a booked job's total. The customer isn't told. */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const input = await parseBody(req, changeTotalSchema);
  return json<WorkResponse>(await changeTotal(await requireStore(), owner.email, id, input));
});
