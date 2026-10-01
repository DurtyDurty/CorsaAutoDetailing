import { recordPaymentSchema, type WorkResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { recordPayment } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Record money collected (card reader, cash, digital) or refunded. Retries with the same requestId record once. */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const input = await parseBody(req, recordPaymentSchema);
  return json<WorkResponse>(await recordPayment(await requireStore(), owner.email, id, input));
});
