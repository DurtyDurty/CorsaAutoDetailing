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
  /** Confirming or declining a website request emails the customer; null otherwise. */
  customerEmail: { status: "sent" | "failed"; error: string | null } | null;
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
  /** Current job if one is underway, otherwise the next confirmed one today or later. */
  focus: AppointmentSummary | null;
  /** Times customers requested on the website, held for you to confirm or decline (soonest first). */
  toConfirm: AppointmentSummary[];
  timeline: AppointmentSummary[];
}

/* ---------- Inbox ---------- */

export type ConversationKind = "contact" | "quote_request" | "launch_list" | "membership_interest";

export interface ConversationSummary {
  leadId: string;
  customerName: string;
  email: string;
  kind: ConversationKind;
  /** A website message or request nobody has handled yet. */
  unread: boolean;
  lastActivityAt: string;
  preview: string;
  /** Last email you sent failed to deliver. */
  lastSendFailed: boolean;
}

export type ConversationMessage =
  | { id: string; type: "website"; at: string; title: string; text: string }
  | { id: string; type: "sent"; at: string; subject: string; body: string; status: "sent" | "failed"; error: string | null };

export interface ConversationDetail {
  leadId: string;
  customerName: string;
  firstName: string;
  email: string;
  phone: string | null;
  kind: ConversationKind;
  unread: boolean;
  serviceName: string | null;
  /** The appointment templates refer to: underway or next, else the most recent. */
  appointment: { id: string; startsAt: string; endsAt: string; balanceDueCents: number } | null;
  defaultSubject: string;
  /** Appended by the server to every email; shown under the composer. */
  signature: string;
  canSend: boolean;
  messages: ConversationMessage[];
}

export const listConversationsQuery = z.object({
  filter: z.enum(["all", "unread"]).default("all"),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(200).optional(),
});
export type ListConversationsQuery = z.infer<typeof listConversationsQuery>;

export const sendMessageSchema = z.object({
  subject: z.string().trim().min(1, "Add a subject.").max(200),
  message: z.string().trim().min(1, "Write a message first.").max(8000),
  /** Created with the draft; the same key is sent at most once. */
  sendKey: z.string().uuid(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface SendMessageResponse {
  conversation: ConversationDetail;
  /** True when this key had already been sent (double tap or retry). */
  alreadySent: boolean;
}
/* ---------- Booking from the app ---------- */

const newCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(80),
  lastName: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .refine((v) => !v || v.replace(/\D/g, "").length === 10, "Enter a 10-digit phone number."),
  serviceAddress: z.string().trim().min(5, "Enter the service address.").max(200),
  city: z.string().trim().max(80).optional(),
  zip: z.string().trim().regex(/^\d{5}$/, "Enter a 5-digit ZIP code."),
  vehicleYear: z.coerce.number().int().min(1950).max(2100).optional(),
  vehicleMake: z.string().trim().max(60).optional(),
  vehicleModel: z.string().trim().max(60).optional(),
});
export type NewCustomerInput = z.infer<typeof newCustomerSchema>;

export const createAppointmentSchema = z.object({
  /** Created when the form opens; a repeated submit books once and emails once. */
  requestId: z.string().uuid(),
  customer: z.union([z.object({ leadId: z.string().uuid() }), z.object({ new: newCustomerSchema })]),
  serviceId: z.string().trim().min(1, "Choose a service.").max(60),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time."),
  durationMinutes: z.coerce.number().int().min(15, "At least 15 minutes.").max(600, "At most 10 hours."),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  notes: z.string().trim().max(1000).optional(),
  /** Book even if it's outside working hours or on a day off. Never overrides another booking. */
  override: z.boolean().default(false),
  sendConfirmation: z.boolean().default(true),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export interface CreateAppointmentResponse {
  appointment: AppointmentDetail;
  confirmation: "sent" | "skipped" | "failed";
  /** Why the confirmation email didn't go out, when it failed. */
  confirmationError: string | null;
  /** True when this requestId had already booked (double tap or retry). */
  alreadyBooked: boolean;
}

/** Returned in `error.fields.override` when a booking can go ahead if the owner confirms. */
export const OVERRIDABLE = "overridable";

/** Customers to pick from when booking: recent first. */
export interface CustomerOption {
  leadId: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  vehicle: string | null;
  serviceId: string | null;
}

export interface ServiceOption {
  id: string;
  name: string;
  group: string;
  priceCents: number;
  billing: "visit" | "monthly";
  /** How long the calendar blocks for this package, when set. */
  durationMinutes: number | null;
}

export interface BookingOptions {
  services: ServiceOption[];
  defaultDurationMinutes: number;
  travelBufferMinutes: number;
  workHours: { start: string; end: string };
  /** False before launch: the server refuses bookings in PRELAUNCH mode. */
  bookingOpen: boolean;
}