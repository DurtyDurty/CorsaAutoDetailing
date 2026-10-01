import { noteSchema, type WorkResponse } from "@shared/api";
import { json, parseBody, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { addNote } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Add a private note to the job history (never sent to the customer). */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-work", 60, 10 * 60_000);
  const id = requireUuid(params.id);
  const { requestId, note } = await parseBody(req, noteSchema);
  return json<WorkResponse>(await addNote(await requireStore(), owner.email, id, requestId, note));
});
