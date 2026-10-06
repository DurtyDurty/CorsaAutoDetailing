import type { BusinessMode } from "@/config/business";
import type { EstimateSnapshot } from "@/lib/pricing";
import type { AppointmentStatus, CancelledBy } from "@shared/appointment-status";
import type { AppointmentEventType } from "@shared/api";
import type { PaymentKind, PaymentMethod } from "@shared/money";

export type { AppointmentStatus } from "@shared/appointment-status";

export type LeadType = "launch_list" | "quote_request" | "membership_interest" | "contact";

export const LEAD_STAGES = [
  "new",
  "contacted",
  "quote_sent",
  "scheduled",
  "completed",
  "lost",
  "spam",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  scheduled: "Scheduled",
  completed: "Completed",
  lost: "Lost",
  spam: "Spam",
};

export type ContactMethod = "email" | "phone" | "text";
export type ConditionLevel = "normal" | "deeper" | "unsure";
export type LocationType = "home" | "work" | "other";

export interface ConsentRecord {
  serviceTextVersion: string;
  serviceAcceptedAt: string;
  marketingEmail: boolean;
  marketingTextVersion: string | null;
  marketingAcceptedAt: string | null;
  /** Booking requests only: customer acknowledged the online price is an estimate pending inspection. */
  priceAcknowledgmentTextVersion?: string | null;
  priceAcknowledgedAt?: string | null;
  /** Online bookings only: customer agreed to the deposit / cancellation / weather policy. */
  bookingPolicyTextVersion?: string | null;
  bookingPolicyAcceptedAt?: string | null;
}

export interface LeadSource {
  landingPath: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /** Added with Google Ads tracking; older leads don't have them. */
  utmTerm?: string | null;
  utmContent?: string | null;
  /** Google Ads click ids, used to report confirmed bookings back to Google Ads. */
  gclid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  /** When the visitor first arrived (first touch), and when the ad click happened. */
  firstSeenAt?: string | null;
  clickSeenAt?: string | null;
}

export interface LeadRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  leadType: LeadType;
  businessMode: BusinessMode;
  idempotencyKey: string;

  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  preferredContact: ContactMethod | null;

  vehicleCategory: string | null;
  vehicleYear: number | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  serviceId: string | null;
  membershipCadence: string | null;
  futureInterests: string[];

  condition: ConditionLevel | null;
  conditionFlags: string[];
  concerns: string | null;

  zip: string | null;
  zipEligibility: string | null;
  city: string | null;
  /** Street address where the vehicle will be (booking requests). */
  serviceAddress: string | null;
  locationType: LocationType | null;
  timeWindows: string[];
  preferredDate: string | null;
  notes: string | null;
  message: string | null;

  estimate: EstimateSnapshot | null;
  pricingVersion: string;
  consent: ConsentRecord;
  source: LeadSource;

  stage: LeadStage;
  followUpOn: string | null;
  internalNotes: string | null;
  archivedAt: string | null;
  photoRefs: string[];
}

export type NewLead = Omit<LeadRecord, "id" | "createdAt" | "updatedAt" | "stage" | "followUpOn" | "internalNotes" | "archivedAt"> & {
  stage?: LeadStage;
};

export type LeadPatch = Partial<
  Pick<LeadRecord, "stage" | "followUpOn" | "internalNotes" | "archivedAt" | "photoRefs">
>;


export type DepositStatus = "none" | "pending" | "paid" | "refunded" | "forfeited" | "released";

export interface AppointmentRecord {
  id: string;
  leadId: string;
  createdAt: string;
  updatedAt: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  quotedPriceCents: number;
  customerAgreed: boolean;
  completedRevenueCents: number | null;
  notes: string | null;
  /** `owner` = confirmed from the dashboard; `online` = customer booked with a deposit. */
  source: "owner" | "online";
  serviceId: string | null;
  depositCents: number | null;
  depositStatus: DepositStatus;
  checkoutSessionId: string | null;
  paymentIntentId: string | null;
  holdExpiresAt: string | null;
  bufferMinutes: number;
  /** ends_at + buffer; the window the database keeps free of other active appointments. */
  busyUntil: string;
  cancelReason: string | null;
  cancelledBy: CancelledBy | null;
  discountCents: number;
}

export type NewAppointment = Omit<
  AppointmentRecord,
  "id" | "createdAt" | "updatedAt" | "busyUntil" | "cancelReason" | "cancelledBy" | "discountCents"
> &
  Partial<Pick<AppointmentRecord, "discountCents">>;

export type AppointmentPatch = Partial<
  Pick<
    AppointmentRecord,
    | "status"
    | "completedRevenueCents"
    | "notes"
    | "startsAt"
    | "endsAt"
    | "depositStatus"
    | "checkoutSessionId"
    | "paymentIntentId"
    | "holdExpiresAt"
    | "cancelReason"
    | "cancelledBy"
    | "discountCents"
    | "quotedPriceCents"
    | "customerAgreed"
  >
>;

/** Audit history for an appointment. */
export interface AppointmentEventRecord {
  id: string;
  appointmentId: string;
  type: AppointmentEventType;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus | null;
  note: string | null;
  actor: string;
  /** Set when the change came from an app request; a retry with the same id isn't recorded twice. */
  requestId: string | null;
  createdAt: string;
}

export type NewAppointmentEvent = Omit<AppointmentEventRecord, "id" | "createdAt">;

export interface PaymentRecord {
  id: string;
  appointmentId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  amountCents: number;
  note: string | null;
  providerRef: string | null;
  recordedBy: string;
  requestId: string | null;
  createdAt: string;
}

export type NewPayment = Omit<PaymentRecord, "id" | "createdAt">;

export interface OnlineHoldInput {
  leadId: string;
  serviceId: string;
  startsAt: string;
  endsAt: string;
  quotedPriceCents: number;
  depositCents: number;
  holdMinutes: number;
  bufferMinutes: number;
}

/** A calendar day (Eastern) the owner isn't working; online booking skips it. */
export interface TimeOffRecord {
  /** YYYY-MM-DD */
  day: string;
  note: string | null;
  createdAt: string;
}

/** An email the owner wrote to a lead from the dashboard. */
export interface OutboundEmailRecord {
  id: string;
  leadId: string;
  /** Generated when the compose form renders; one send per key. */
  sendKey: string;
  toEmail: string;
  subject: string;
  body: string;
  status: "sent" | "failed";
  providerMessageId: string | null;
  error: string | null;
  createdAt: string;
}

export type NewOutboundEmail = Omit<OutboundEmailRecord, "id" | "createdAt">;

/** A customer's email reply, received through Resend. */
export interface InboundEmailRecord {
  id: string;
  providerEmailId: string;
  leadId: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string;
  body: string;
  messageId: string | null;
  receivedAt: string;
  readAt: string | null;
  createdAt: string;
}

export type NewInboundEmail = Omit<InboundEmailRecord, "id" | "createdAt" | "readAt">;

export interface QuoteLine {
  label: string;
  amountCents: number;
}

export type QuoteStatus = "sent" | "accepted" | "declined" | "withdrawn";

/** An invoice-style price for a requested time, accepted or declined by the customer through a private link. */
export interface QuoteRecord {
  id: string;
  appointmentId: string;
  leadId: string;
  /** Shown to the customer, e.g. "Q-3F9A2C". */
  number: string;
  /** sha256 of the link token; the token itself is never stored. */
  tokenHash: string;
  status: QuoteStatus;
  lines: QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  notes: string | null;
  expiresAt: string;
  createdBy: string;
  requestId: string | null;
  respondedAt: string | null;
  responseNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewQuote = Omit<QuoteRecord, "id" | "status" | "respondedAt" | "responseNote" | "createdAt" | "updatedAt">;
export type QuotePatch = Partial<Pick<QuoteRecord, "status" | "respondedAt" | "responseNote">>;

/** Thrown when another live quote for the same appointment was created at the same moment. */
export class QuoteConflictError extends Error {
  constructor() {
    super("QUOTE_CONFLICT");
    this.name = "QuoteConflictError";
  }
}

/** A conversion reported (or attempted) to Google Ads. No personal data. */
export interface AdConversionRecord {
  /** Google's dedupe key, e.g. "booking-<lead id>". */
  transactionId: string;
  kind: "inquiry" | "booking" | "paid";
  leadId: string | null;
  appointmentId: string | null;
  /** Value last sent (or attempted). */
  valueCents: number;
  eventAt: string;
  status: "sent" | "failed";
  attempts: number;
  lastError: string | null;
  requestId: string | null;
  sentAt: string | null;
  updatedAt: string;
}

/** Thrown by `bookOnlineSlot` when the slot (plus travel buffer) overlaps an active appointment. */
export class SlotTakenError extends Error {
  constructor() {
    super("SLOT_TAKEN");
    this.name = "SlotTakenError";
  }
}

export type NotificationKind = "owner_notify" | "customer_ack";
export type NotificationStatus = "pending" | "sent" | "failed" | "skipped";

export interface NotificationRecord {
  id: string;
  leadId: string;
  kind: NotificationKind;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFilter {
  leadType?: LeadType | LeadType[];
  stage?: LeadStage;
  search?: string;
  includeArchived?: boolean;
  limit?: number;
}

export interface DashboardCounts {
  leads: number;
  contacted: number;
  quotes: number;
  confirmedAppointments: number;
  completedJobs: number;
  recordedRevenueCents: number;
  launchList: number;
  membershipInterest: number;
}

export interface StoreHealth {
  ok: boolean;
  kind: "supabase" | "demo";
  detail: string;
}

export interface LeadStore {
  readonly kind: "supabase" | "demo";
  health(): Promise<StoreHealth>;

  /** Idempotent on `idempotencyKey`. Returns the existing lead when replayed. */
  createLead(input: NewLead): Promise<{ lead: LeadRecord; created: boolean }>;
  getLead(id: string): Promise<LeadRecord | null>;
  /** Leads by id, in no particular order; unknown ids are skipped. */
  getLeads(ids: string[]): Promise<LeadRecord[]>;
  listLeads(filter?: LeadFilter): Promise<LeadRecord[]>;
  updateLead(id: string, patch: LeadPatch): Promise<LeadRecord | null>;
  deleteLead(id: string): Promise<void>;
  counts(): Promise<DashboardCounts>;

  /** Recent leads from the same email, for duplicate awareness. */
  findRecentByEmail(email: string, leadType: LeadType, withinMinutes: number): Promise<LeadRecord | null>;

  listAppointments(opts?: { from?: string; to?: string; leadId?: string }): Promise<AppointmentRecord[]>;
  getAppointment(id: string): Promise<AppointmentRecord | null>;
  createAppointment(input: NewAppointment): Promise<AppointmentRecord>;
  updateAppointment(id: string, patch: AppointmentPatch): Promise<AppointmentRecord | null>;
  /**
   * Change status only if it is still `expected`, so two devices (or a retry)
   * can't both apply a transition. Returns null when the status had changed.
   */
  updateAppointmentIfStatus(id: string, expected: AppointmentStatus, patch: AppointmentPatch): Promise<AppointmentRecord | null>;

  /** Oldest first. */
  listAppointmentEvents(appointmentId: string): Promise<AppointmentEventRecord[]>;
  /** Returns null if an event with the same requestId was already recorded. */
  addAppointmentEvent(input: NewAppointmentEvent): Promise<AppointmentEventRecord | null>;
  findAppointmentEventByRequestId(requestId: string): Promise<AppointmentEventRecord | null>;

  /** Oldest first. */
  listPayments(opts: { appointmentIds?: string[]; from?: string; to?: string }): Promise<PaymentRecord[]>;
  /** Returns null if a payment with the same requestId was already recorded. */
  recordPayment(input: NewPayment): Promise<PaymentRecord | null>;
  /** Cancel `held` appointments whose hold has expired, so their times can be booked again. */
  releaseExpiredHolds(): Promise<number>;
  /**
   * Atomically release stale holds and reserve `input` as a `held` online
   * appointment. Throws SlotTakenError if it overlaps (with buffer) an active one.
   */
  bookOnlineSlot(input: OnlineHoldInput): Promise<AppointmentRecord>;
  findAppointmentByCheckoutSession(sessionId: string): Promise<AppointmentRecord | null>;
  /**
   * Confirm a `held` appointment after its deposit is paid. Conditional on the
   * row still being `held`, so only one caller (webhook or return page) wins;
   * the others get null and must not send confirmation emails.
   */
  markHeldAppointmentPaid(id: string, paymentIntentId: string | null): Promise<AppointmentRecord | null>;

  /** Days off on or after `from` (YYYY-MM-DD), earliest first. */
  listTimeOff(opts?: { from?: string }): Promise<TimeOffRecord[]>;
  /** Adds the days; days already off are left as they are. */
  addTimeOff(days: string[], note: string | null): Promise<void>;
  removeTimeOff(day: string): Promise<void>;

  /** Newest first. */
  listOutboundEmails(leadId: string): Promise<OutboundEmailRecord[]>;
  /** Newest first, for many leads at once (inbox list). */
  listOutboundEmailsForLeads(leadIds: string[]): Promise<OutboundEmailRecord[]>;
  findOutboundEmailBySendKey(sendKey: string): Promise<OutboundEmailRecord | null>;
  /** Returns null if an email with the same sendKey was already recorded. */
  recordOutboundEmail(input: NewOutboundEmail): Promise<OutboundEmailRecord | null>;

  /** Returns null if this provider email id was already stored (webhook retry). */
  recordInboundEmail(input: NewInboundEmail): Promise<InboundEmailRecord | null>;
  /** Newest first, for many leads at once. */
  listInboundEmailsForLeads(leadIds: string[]): Promise<InboundEmailRecord[]>;
  /** Lead ids with at least one unread reply. */
  leadsWithUnreadInbound(): Promise<string[]>;
  markInboundRead(leadId: string): Promise<void>;

  /** Returns null when a quote with the same requestId already exists (retried send). */
  createQuote(input: NewQuote): Promise<QuoteRecord | null>;
  findQuoteByRequestId(requestId: string): Promise<QuoteRecord | null>;
  getQuoteByTokenHash(tokenHash: string): Promise<QuoteRecord | null>;
  /** Newest first. */
  listQuotesForAppointments(appointmentIds: string[]): Promise<QuoteRecord[]>;
  /** Change a quote only if its status is still `expected` (accept/decline/withdraw race safely). */
  updateQuoteIfStatus(id: string, expected: QuoteStatus, patch: QuotePatch): Promise<QuoteRecord | null>;

  listAdConversions(): Promise<AdConversionRecord[]>;
  /** Insert or replace by transactionId. */
  saveAdConversion(row: AdConversionRecord): Promise<void>;

  createNotification(leadId: string, kind: NotificationKind): Promise<NotificationRecord>;
  updateNotification(
    id: string,
    patch: Partial<Pick<NotificationRecord, "status" | "attempts" | "lastError" | "providerMessageId">>,
  ): Promise<void>;
  listNotifications(opts?: { leadId?: string; status?: NotificationStatus }): Promise<NotificationRecord[]>;
}
