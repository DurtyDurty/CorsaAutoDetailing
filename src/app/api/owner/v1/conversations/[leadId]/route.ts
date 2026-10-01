import type { ConversationDetail } from "@shared/api";
import { ApiError, json, withOwner } from "@/lib/api/http";
import { deleteConversation, getConversation, markRepliesRead } from "@/lib/owner/conversations";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Opening a conversation marks its email replies read (website requests stay unread until handled). */
export const GET = withOwner<{ leadId: string }>(async (_req, { params }) => {
  const leadId = requireUuid(params.leadId);
  const store = await requireStore();
  const detail = await getConversation(store, leadId);
  if (detail.messages.some((m) => m.type === "received")) await markRepliesRead(store, leadId);
  return json<ConversationDetail>(detail);
});
/**
 * Permanently delete the customer and everything linked to them. The app asks
 * first; the request must also say `?confirm=delete` so a stray call can't do it.
 */
export const DELETE = withOwner<{ leadId: string }>(async (req, { params }) => {
  const leadId = requireUuid(params.leadId);
  if (new URL(req.url).searchParams.get("confirm") !== "delete") {
    throw new ApiError("invalid", "Confirm the delete first.");
  }
  await deleteConversation(await requireStore(), leadId);
  return json({ deleted: true });
});