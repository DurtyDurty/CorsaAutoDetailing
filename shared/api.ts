/**
 * Owner API contract (`/api/owner/v1`): request schemas and response types.
 * The server validates every input with these schemas; the app uses the same
 * schemas for its forms, so both sides reject the same things.
 */
import { z } from "zod";
import { APPOINTMENT_STATUSES, type AppointmentStatus, type CancelledBy } from "./appointment-status";
import type { Balance, PaymentKind, PaymentMethod } from "./money";

export const API_BASE_PATH = "/api/owner/v1";

/* ---------- Roles ---------- */

/** Prepared for a team; every authorized account is the owner for now. */
export const ROLES = ["owner", "manager", "detailer", "read_only"] as const;
export type Role = (typeof ROLES)[number];

/* ---------- Errors ---------- */

export type ApiErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "server_error";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string> };
}

/* ---------- Session ---------- */

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: z.string().min(1, "Enter your password.").max(200),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10).max(4000),
});

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. Refresh shortly before this. */
  expiresAt: number;
  email: string;
  role: Role;
}

export interface MeResponse {
  email: string;
  role: Role;
  business: { name: string; timeZone: string };
}

/* ---------- Appointments ---------- */

export interface VehicleSummary {
  year: number | null;
  make: string | null;
  model: string | null;
  /** Size class saved on older requests; null on newer ones. */
  sizeLabel: string | null;
}

export interface AppointmentSummary {
  id: string;
  leadId: string;
  status: AppointmentStatus;
  startsAt: string;
  endsAt: string;
  serviceId: string | null;
  serviceName: string | null;
  customerName: string;
  phone: string | null;
  email: string;
  serviceAddress: string | null;
  city: string | null;
  zip: string | null;
  vehicle: VehicleSummary;
  quotedPriceCents: number;
  discountCents: number;
  depositCents: number | null;
  depositStatus: string;
  balance: Balance;
  source: "owner" | "online";
  cancelReason: string | null;
  cancelledBy: CancelledBy | null;
  updatedAt: string;
}

export type AppointmentEventType = "created" | "status" | "rescheduled" | "note" | "payment";

export interface AppointmentEvent {
  id: string;
  type: AppointmentEventType;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus | null;
  note: string | null;
  actor: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amountCents: number;
  note: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface AppointmentDetail extends AppointmentSummary {
  customer: {
    firstName: string;
    lastName: string | null;
    preferredContact: "email" | "phone" | "text" | null;
  };
  /** What the customer wrote on the request. */
  customerNotes: { concerns: string | null; spaceNotes: string | null; conditionFlags: string[]; condition: string | null };
  internalNotes: string | null;
  appointmentNotes: string | null;
  bufferMinutes: number;
  createdAt: string;
  events: AppointmentEvent[];
  payments: Payment[];
  allowedTransitions: AppointmentStatus[];
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

const isoDateTime = z.string().datetime({ offset: true });

export const listAppointmentsQuery = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  /** Comma-separated statuses. */
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(APPOINTMENT_STATUSES)).optional()),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z.string().max(200).optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuery>;

export const statusChangeSchema = z
  .object({
    to: z.enum(APPOINTMENT_STATUSES),
    reason: z.string().trim().max(500).optional(),
    cancelledBy: z.enum(["customer", "owner"]).optional(),
    /** Generated once per tap; a retried request with the same id is applied once. */
    requestId: z.string().uuid(),
  })
  .superRefine((v, ctx) => {
    if ((v.to === "cancelled" || v.to === "declined" || v.to === "no_show") && !v.reason) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Add a short reason." });
    }
    if (v.to === "cancelled" && !v.cancelledBy) {
      ctx.addIssue({ code: "custom", path: ["cancelledBy"], message: "Say who cancelled." });
    }
  });
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

export interface StatusChangeResponse {
  appointment: AppointmentDetail;
  /** True when the appointment already had this status (repeat tap). */
  unchanged: boolean;
}

/* ---------- Today / summary ---------- */

export interface TodaySummary {
  /** YYYY-MM-DD in the business time zone. */
  date: string;
  generatedAt: string;
  today: {
    jobs: number;
    bookedCents: number;
    depositsCollectedCents: number;
    collectedCents: number;
    outstandingCents: number;
  };
  week: { bookedCents: number; jobs: number };
  month: { bookedCents: number; jobs: number };
  /** Website requests nobody has acted on yet. */
  newRequests: number;
  /** Website contact messages not yet handled. */
  unreadMessages: number;
  /** Appointments needing a decision (deposit pending / awaiting confirmation). */
  awaitingConfirmation: number;
  /** Current job if one is underway, otherwise the next upcoming one today or later. */
  focus: AppointmentSummary | null;
  timeline: AppointmentSummary[];
}
