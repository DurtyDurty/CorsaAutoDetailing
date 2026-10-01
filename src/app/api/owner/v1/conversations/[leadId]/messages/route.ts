import { sendMessageSchema, type SendMessageResponse } from "@shared/api";
import { ApiError, json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { getConversation } from "@/lib/owner/conversations";
import { sendOwnerEmail } from "@/lib/owner/email";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Email the customer from the business address. The same sendKey is sent at most once. */
export const POST = withOwner<{ leadId: string }>(async (req, { params }) => {
  rateLimit(req, "owner-api-send-email", 30, 10 * 60_000);
  const leadId = requireUuid(params.leadId);
  const input = await parseBody(req, sendMessageSchema);
  const store = await requireStore();
  const result = await sendOwnerEmail(store, leadId, input);
  if (result.status === "not_found") throw new ApiError("not_found", "That conversation doesn't exist.");
  if (result.status === "unavailable") throw new ApiError("unavailable", result.reason);
  if (result.status === "failed") throw new ApiError("unavailable", `Not sent: ${result.reason}`);
  return json<SendMessageResponse>({ conversation: await getConversation(store, leadId), alreadySent: result.alreadySent });
});