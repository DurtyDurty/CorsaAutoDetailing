import { listAppointmentsQuery, type AppointmentSummary, type Page } from "@shared/api";
import { json, parseQuery, withOwner } from "@/lib/api/http";
import { listAppointmentSummaries } from "@/lib/owner/appointments";
import { requireStore } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Appointments overlapping [from, to], oldest first, paginated with `cursor`. */
export const GET = withOwner(async (req) => {
  const q = parseQuery(req, listAppointmentsQuery);
  return json<Page<AppointmentSummary>>(await listAppointmentSummaries(await requireStore(), q));
});