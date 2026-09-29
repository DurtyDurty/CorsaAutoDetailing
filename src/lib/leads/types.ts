import type { BusinessMode } from "@/config/business";
import type { EstimateSnapshot } from "@/lib/pricing";

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

/** `held` = online slot reserved while the customer pays the deposit. */
export type AppointmentStatus = "held" | "confirmed" | "completed" | "cancelled";
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
}

export type NewAppointment = Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt" | "busyUntil">;

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
  listLeads(filter?: LeadFilter): Promise<LeadRecord[]>;
  updateLead(id: string, patch: LeadPatch): Promise<LeadRecord | null>;
  deleteLead(id: string): Promise<void>;
  counts(): Promise<DashboardCounts>;

  /** Recent leads from the same email, for duplicate awareness. */
  findRecentByEmail(email: string, leadType: LeadType, withinMinutes: number): Promise<LeadRecord | null>;

  listAppointments(opts?: { from?: string; to?: string; leadId?: string }): Promise<AppointmentRecord[]>;
  createAppointment(input: NewAppointment): Promise<AppointmentRecord>;
  updateAppointment(
    id: string,
    patch: Partial<
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
      >
    >,
  ): Promise<AppointmentRecord | null>;
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

  createNotification(leadId: string, kind: NotificationKind): Promise<NotificationRecord>;
  updateNotification(
    id: string,
    patch: Partial<Pick<NotificationRecord, "status" | "attempts" | "lastError" | "providerMessageId">>,
  ): Promise<void>;
  listNotifications(opts?: { leadId?: string; status?: NotificationStatus }): Promise<NotificationRecord[]>;
}
