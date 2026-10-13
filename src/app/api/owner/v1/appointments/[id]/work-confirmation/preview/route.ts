import type { PreviewResponse } from "@shared/api";
import { json, rateLimit, withOwner } from "@/lib/api/http";
import { requireStore, requireUuid } from "@/lib/owner/store";
import { previewWorkConfirmation } from "@/lib/owner/work";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Email the work confirmation and invoice to the signed-in owner only, to check before the customer gets it. */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  rateLimit(req, "owner-api-preview", 10, 10 * 60_000);
  const id = requireUuid(params.id);
  return json<PreviewResponse>(await previewWorkConfirmation(await requireStore(), owner.email, id));
});
