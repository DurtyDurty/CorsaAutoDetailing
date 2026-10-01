import type { ConversationDetail } from "@shared/api";
import { json, withOwner } from "@/lib/api/http";
import { getConversation } from "@/lib/owner/conversations";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withOwner<{ leadId: string }>(async (_req, { params }) =>
  json<ConversationDetail>(await getConversation(await requireStore(), requireUuid(params.leadId))),
);