import {
  createAppointmentSchema,
  listAppointmentsQuery,
  type AppointmentSummary,
  type CreateAppointmentResponse,
  type Page,
} from "@shared/api";
import { json, parseBody, parseQuery, rateLimit, withOwner } from "@/lib/api/http";
import { listAppointmentSummaries } from "@/lib/owner/appointments";
import { bookFromApp } from "@/lib/owner/schedule";
import { requireStore } from "@/lib/owner/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Appointments overlapping [from, to], oldest first, paginated with `cursor`. */
export const GET = withOwner(async (req) => {
  const q = parseQuery(req, listAppointmentsQuery);
  return json<Page<AppointmentSummary>>(await listAppointmentSummaries(await requireStore(), q));
});

/** Book an appointment from the app and (optionally) email the customer a confirmation. */
export const POST = withOwner(async (req, { owner }) => {
  rateLimit(req, "owner-api-book", 30, 10 * 60_000);
  const input = await parseBody(req, createAppointmentSchema);
  const result = await bookFromApp(await requireStore(), owner.email, input);
  return json<CreateAppointmentResponse>(result, result.alreadyBooked ? 200 : 201);
});