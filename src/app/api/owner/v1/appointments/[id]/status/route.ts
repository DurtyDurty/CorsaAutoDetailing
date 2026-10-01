import { statusChangeSchema, type StatusChangeResponse } from "@shared/api";
import { json, parseBody, withOwner } from "@/lib/api/http";
import { changeAppointmentStatus, getAppointmentDetail } from "@/lib/owner/appointments";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Move an appointment through its workflow. Retries with the same requestId are applied once. */
export const POST = withOwner<{ id: string }>(async (req, { owner, params }) => {
  const id = requireUuid(params.id);
  const input = await parseBody(req, statusChangeSchema);
  const store = await requireStore();
  const { unchanged, customerEmail } = await changeAppointmentStatus(store, owner.email, id, input);
  return json<StatusChangeResponse>({ appointment: await getAppointmentDetail(store, id), unchanged, customerEmail: customerEmail ?? null });
});