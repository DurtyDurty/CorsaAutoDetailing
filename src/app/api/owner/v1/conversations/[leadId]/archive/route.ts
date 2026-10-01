import { archiveSchema, type ConversationDetail } from "@shared/api";
import { json, parseBody, withOwner } from "@/lib/api/http";
import { getConversation, setArchived } from "@/lib/owner/conversations";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Archive (hide from the Inbox, keep the history) or restore a conversation. */
export const POST = withOwner<{ leadId: string }>(async (req, { params }) => {
  const leadId = requireUuid(params.leadId);
  const { archived } = await parseBody(req, archiveSchema);
  const store = await requireStore();
  await setArchived(store, leadId, archived);
  return json<ConversationDetail>(await getConversation(store, leadId));
});