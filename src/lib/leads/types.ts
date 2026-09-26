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

export type AppointmentStatus = "confirmed" | "completed" | "cancelled";

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
}

export type NewAppointment = Omit<AppointmentRecord, "id" | "createdAt" | "updatedAt">;

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
    patch: Partial<Pick<AppointmentRecord, "status" | "completedRevenueCents" | "notes" | "startsAt" | "endsAt">>,
  ): Promise<AppointmentRecord | null>;

  createNotification(leadId: string, kind: NotificationKind): Promise<NotificationRecord>;
  updateNotification(
    id: string,
    patch: Partial<Pick<NotificationRecord, "status" | "attempts" | "lastError" | "providerMessageId">>,
  ): Promise<void>;
  listNotifications(opts?: { leadId?: string; status?: NotificationStatus }): Promise<NotificationRecord[]>;
}
