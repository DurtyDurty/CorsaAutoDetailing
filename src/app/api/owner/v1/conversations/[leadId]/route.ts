import type { ConversationDetail } from "@shared/api";
import { json, withOwner } from "@/lib/api/http";
import { getConversation, markRepliesRead } from "@/lib/owner/conversations";
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