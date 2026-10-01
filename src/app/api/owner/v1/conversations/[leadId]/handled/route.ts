import type { ConversationDetail } from "@shared/api";
import { json, withOwner } from "@/lib/api/http";
import { getConversation, markHandled } from "@/lib/owner/conversations";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Clears "unread" on a website message or request without emailing. */
export const POST = withOwner<{ leadId: string }>(async (_req, { params }) => {
  const leadId = requireUuid(params.leadId);
  const store = await requireStore();
  await markHandled(store, leadId);
  return json<ConversationDetail>(await getConversation(store, leadId));
});