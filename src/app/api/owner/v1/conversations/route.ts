import { listConversationsQuery, type ConversationSummary, type Page } from "@shared/api";
import { json, parseQuery, withOwner } from "@/lib/api/http";
import { listConversations } from "@/lib/owner/conversations";
import { requireStore } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Customers with a website message, request or emails, most recent activity first. */
export const GET = withOwner(async (req) => {
  const q = parseQuery(req, listConversationsQuery);
  return json<Page<ConversationSummary>>(await listConversations(await requireStore(), q));
});