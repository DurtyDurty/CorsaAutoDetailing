import { rescheduleSchema, type WorkResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { rescheduleAppointment } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Move an appointment (same checks as booking) and optionally email the customer the new time. */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const input = await parseBody(req, rescheduleSchema);
  return json<WorkResponse>(await rescheduleAppointment(await requireStore(), owner.email, id, input));
});
