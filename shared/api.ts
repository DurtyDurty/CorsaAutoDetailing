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
  /** Latest quote for a website request, if one was sent. */
  quoteStatus: QuoteViewStatus | null;
  /** A website request: the part of the day the customer asked for, e.g. "Morning, around 9:30". */
  requested: string | null;
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
  /** The latest quote, if any. */
  quote: QuoteSummary | null;
  /** Starting point for a new quote; only for a website request still waiting on you. */
  quoteDraft: QuoteDraft | null;
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
  /** The job to work on now: one underway, otherwise today's next confirmed job. Only ever today's. */
  focus: AppointmentSummary | null;
  /** When nothing is left today: the next confirmed job on a later day (shown without actions). */
  nextJob: AppointmentSummary | null;
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
  /** A website message or request nobody has handled yet, or a reply you haven't opened. */
  unread: boolean;
  lastActivityAt: string;
  preview: string;
  /** Last email you sent failed to deliver. */
  lastSendFailed: boolean;
  /** The latest message is an email you sent (you're waiting on the customer). */
  replied: boolean;
}

export type ConversationMessage =
  | { id: string; type: "website"; at: string; title: string; text: string }
  | { id: string; type: "sent"; at: string; subject: string; body: string; status: "sent" | "failed"; error: string | null }
  | {
      id: string;
      type: "received";
      at: string;
      from: string;
      /** Sent from an address other than the customer's own; anyone can write to a reply address. */
      fromOtherAddress?: boolean;
      subject: string;
      body: string;
    };

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
  /** Hidden from the Inbox; history kept. */
  archived: boolean;
  /** Delete is refused while the customer has an upcoming booked appointment. */
  canDelete: boolean;
  messages: ConversationMessage[];
}

export const archiveSchema = z.object({ archived: z.boolean() });

export const listConversationsQuery = z.object({
  filter: z.enum(["all", "unread", "archived"]).default("all"),
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
/* ---------- Working a job: reschedule, payments, receipt, notes ---------- */

export const rescheduleSchema = z.object({
  requestId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time."),
  durationMinutes: z.coerce.number().int().min(15).max(600),
  /** Allow outside working hours / a day off. Never allows overlapping another job. */
  override: z.boolean().default(false),
  /** Email the customer the new time. */
  notifyCustomer: z.boolean().default(true),
});
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

/** What the owner can record by hand; Stripe deposits are recorded by the server. */
export const RECORDABLE_METHODS = ["card_reader", "cash", "digital"] as const;

export const recordPaymentSchema = z.object({
  requestId: z.string().uuid(),
  kind: z.enum(["deposit", "balance", "refund"]).default("balance"),
  method: z.enum(RECORDABLE_METHODS),
  amountCents: z.coerce.number().int().min(1, "Enter an amount.").max(1_000_000, "That amount looks too large."),
  note: z.string().trim().max(500).optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const noteSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().trim().min(1, "Write a note.").max(1000),
});

export const receiptSchema = z.object({ requestId: z.string().uuid() });

export interface WorkResponse {
  appointment: AppointmentDetail;
  /** For reschedule and receipt: whether the customer email went out. */
  customerEmail: { status: "sent" | "failed" | "skipped"; error: string | null };
  /** True when this requestId was already applied (double tap or retry). */
  unchanged: boolean;
}

/* ---------- Quotes ---------- */

/** "expired" is a sent quote past its valid-until time. */
export type QuoteViewStatus = "sent" | "accepted" | "declined" | "withdrawn" | "expired";

export const QUOTE_STATUS_LABELS: Record<QuoteViewStatus, string> = {
  sent: "Quote sent, waiting for the customer",
  accepted: "Quote accepted",
  declined: "Quote declined",
  withdrawn: "Quote replaced or withdrawn",
  expired: "Quote expired",
};

export interface QuoteLineDto {
  label: string;
  amountCents: number;
}

export interface QuoteSummary {
  id: string;
  number: string;
  status: QuoteViewStatus;
  lines: QuoteLineDto[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  sentAt: string;
  expiresAt: string;
  respondedAt: string | null;
  /** The customer's reason when they declined. */
  responseNote: string | null;
}

/** What a new quote starts from: the requested package, plus common extras to add in one tap. */
export interface QuoteDraft {
  lines: QuoteLineDto[];
  discountCents: number;
  extras: { label: string; minCents: number; maxCents: number }[];
  defaultExpiresInDays: number;
  /** A quote can't stay open past the appointment's start. */
  latestExpiry: string;
  /** What the customer asked for on the website, e.g. "Morning, around 9:30". */
  requested: string | null;
  /** The arrival time held now ("08:00", Eastern) and the times you can set with the quote. */
  arrivalTime: string;
  arrivalOptions: string[];
}

export const QUOTE_MAX_LINES = 20;

export const sendQuoteSchema = z
  .object({
    requestId: z.string().uuid(),
    lines: z
      .array(
        z.object({
          label: z
            .string()
            .transform((s) => s.replace(/\s+/g, " ").trim())
            .pipe(z.string().min(1, "Describe each line.").max(80, "Keep each line under 80 characters.")),
          amountCents: z.coerce.number().int().min(0, "Amounts can't be negative.").max(1_000_000, "That amount looks too large."),
        }),
      )
      .min(1, "Add at least one line.")
      .max(QUOTE_MAX_LINES, `Up to ${QUOTE_MAX_LINES} lines.`),
    discountCents: z.coerce.number().int().min(0).max(1_000_000).default(0),
    notes: z.string().trim().max(1000).optional(),
    expiresInDays: z.coerce.number().int().min(1).max(14).default(3),
    /** Set the exact arrival time (Eastern, same day) as the quote goes out. */
    arrivalTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick an arrival time.")
      .optional(),
  })
  .superRefine((v, ctx) => {
    const subtotal = v.lines.reduce((s, l) => s + l.amountCents, 0);
    if (v.discountCents > subtotal) ctx.addIssue({ code: "custom", path: ["discountCents"], message: "The discount can't be more than the subtotal." });
    if (subtotal - v.discountCents <= 0) ctx.addIssue({ code: "custom", path: ["lines"], message: "The total must be more than $0." });
  });
export type SendQuoteInput = z.infer<typeof sendQuoteSchema>;

export interface SendQuoteResponse extends WorkResponse {
  quote: QuoteSummary;
}