import { receiptSchema, type WorkResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { sendWorkConfirmation } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Email the customer that the job is complete (summary, payment, review link). */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const { requestId } = await parseBody(req, receiptSchema);
  return json<WorkResponse>(await sendWorkConfirmation(await requireStore(), owner.email, id, requestId));
});
