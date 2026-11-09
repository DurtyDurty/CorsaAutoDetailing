import { customerEmailSchema, type WorkResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { setCustomerEmail } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Add the email of a customer who booked without one (or fix a mistyped one). */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const { requestId, email } = await parseBody(req, customerEmailSchema);
  return json<WorkResponse>(await setCustomerEmail(await requireStore(), owner.email, id, requestId, email));
});
