import type { AppointmentDetail } from "@shared/api";
import { json, withOwner } from "@/lib/api/http";
import { getAppointmentDetail } from "@/lib/owner/appointments";
import { requireStore, requireUuid } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = withOwner<{ id: string }>(async (_req, { params }) =>
  json<AppointmentDetail>(await getAppointmentDetail(await requireStore(), requireUuid(params.id))),
);