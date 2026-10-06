import { sendQuoteSchema, type SendQuoteResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { getAppointmentDetail } from "@/lib/owner/appointments";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { sendQuote } from "@/lib/quotes/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Price a website request and email the customer the quote (PDF + link to accept). Replaces an open quote. */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const input = await parseBody(req, sendQuoteSchema);
  return json<SendQuoteResponse>(await sendQuote(await requireStore(), owner.email, id, input, getAppointmentDetail));
});
