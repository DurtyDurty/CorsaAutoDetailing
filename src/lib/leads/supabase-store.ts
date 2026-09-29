import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AppointmentRecord,
  DashboardCounts,
  LeadFilter,
  LeadPatch,
  LeadRecord,
  LeadStore,
  LeadType,
  NewAppointment,
  NewLead,
  OnlineHoldInput,
  NotificationKind,
  NotificationRecord,
  NotificationStatus,
  StoreHealth,
} from "./types";
import { SlotTakenError } from "./types";
import { computeCounts } from "./shared";

/**
 * Supabase (Postgres) store. Uses the SERVICE ROLE key and therefore must only
 * ever be imported on the server. Row-level security denies all access to the
 * anon role; see supabase/migrations/0001_init.sql.
 */

type Row = Record<string, unknown>;

function leadFromRow(r: Row): LeadRecord {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    leadType: r.lead_type as LeadRecord["leadType"],
    businessMode: r.business_mode as LeadRecord["businessMode"],
    idempotencyKey: r.idempotency_key as string,
    firstName: r.first_name as string,
    lastName: (r.last_name as string | null) ?? null,
    email: r.email as string,
    phone: (r.phone as string | null) ?? null,
    preferredContact: (r.preferred_contact as LeadRecord["preferredContact"]) ?? null,
    vehicleCategory: (r.vehicle_category as string | null) ?? null,
    vehicleYear: (r.vehicle_year as number | null) ?? null,
    vehicleMake: (r.vehicle_make as string | null) ?? null,
    vehicleModel: (r.vehicle_model as string | null) ?? null,
    serviceId: (r.service_id as string | null) ?? null,
    membershipCadence: (r.membership_cadence as string | null) ?? null,
    futureInterests: (r.future_interests as string[] | null) ?? [],
    condition: (r.condition as LeadRecord["condition"]) ?? null,
    conditionFlags: (r.condition_flags as string[] | null) ?? [],
    concerns: (r.concerns as string | null) ?? null,
    zip: (r.zip as string | null) ?? null,
    zipEligibility: (r.zip_eligibility as string | null) ?? null,
    city: (r.city as string | null) ?? null,
    serviceAddress: (r.service_address as string | null) ?? null,
    locationType: (r.location_type as LeadRecord["locationType"]) ?? null,
    timeWindows: (r.time_windows as string[] | null) ?? [],
    preferredDate: (r.preferred_date as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    message: (r.message as string | null) ?? null,
    estimate: (r.estimate as LeadRecord["estimate"]) ?? null,
    pricingVersion: r.pricing_version as string,
    consent: r.consent as LeadRecord["consent"],
    source: r.source as LeadRecord["source"],
    stage: r.stage as LeadRecord["stage"],
    followUpOn: (r.follow_up_on as string | null) ?? null,
    internalNotes: (r.internal_notes as string | null) ?? null,
    archivedAt: (r.archived_at as string | null) ?? null,
    photoRefs: (r.photo_refs as string[] | null) ?? [],
  };
}

function leadToRow(l: NewLead): Row {
  return {
    lead_type: l.leadType,
    business_mode: l.businessMode,
    idempotency_key: l.idempotencyKey,
    first_name: l.firstName,
    last_name: l.lastName,
    email: l.email,
    phone: l.phone,
    preferred_contact: l.preferredContact,
    vehicle_category: l.vehicleCategory,
    vehicle_year: l.vehicleYear,
    vehicle_make: l.vehicleMake,
    vehicle_model: l.vehicleModel,
    service_id: l.serviceId,
    membership_cadence: l.membershipCadence,
    future_interests: l.futureInterests,
    condition: l.condition,
    condition_flags: l.conditionFlags,
    concerns: l.concerns,
    zip: l.zip,
    zip_eligibility: l.zipEligibility,
    city: l.city,
    service_address: l.serviceAddress,
    location_type: l.locationType,
    time_windows: l.timeWindows,
    preferred_date: l.preferredDate,
    notes: l.notes,
    message: l.message,
    estimate: l.estimate,
    pricing_version: l.pricingVersion,
    consent: l.consent,
    source: l.source,
    stage: l.stage ?? "new",
    photo_refs: l.photoRefs,
  };
}

function apptFromRow(r: Row): AppointmentRecord {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    status: r.status as AppointmentRecord["status"],
    quotedPriceCents: r.quoted_price_cents as number,
    customerAgreed: r.customer_agreed as boolean,
    completedRevenueCents: (r.completed_revenue_cents as number | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    source: ((r.source as string | null) ?? "owner") as AppointmentRecord["source"],
    serviceId: (r.service_id as string | null) ?? null,
    depositCents: (r.deposit_cents as number | null) ?? null,
    depositStatus: ((r.deposit_status as string | null) ?? "none") as AppointmentRecord["depositStatus"],
    checkoutSessionId: (r.checkout_session_id as string | null) ?? null,
    paymentIntentId: (r.payment_intent_id as string | null) ?? null,
    holdExpiresAt: (r.hold_expires_at as string | null) ?? null,
    bufferMinutes: (r.buffer_minutes as number | null) ?? 45,
    busyUntil: (r.busy_until as string | null) ?? (r.ends_at as string),
  };
}

function notifFromRow(r: Row): NotificationRecord {
  return {
    id: r.id as string,
    leadId: r.lead_id as string,
    kind: r.kind as NotificationKind,
    status: r.status as NotificationStatus,
    attempts: r.attempts as number,
    lastError: (r.last_error as string | null) ?? null,
    providerMessageId: (r.provider_message_id as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function snake(obj: Record<string, unknown>): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  }
  return out;
}

export class SupabaseLeadStore implements LeadStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async health(): Promise<StoreHealth> {
    const { error } = await this.client.from("leads").select("id", { count: "exact", head: true });
    return error
      ? { ok: false, kind: "supabase", detail: `Supabase query failed: ${error.message}` }
      : { ok: true, kind: "supabase", detail: "Supabase reachable; leads table present." };
  }

  async createLead(input: NewLead) {
    const { data, error } = await this.client
      .from("leads")
      .insert(leadToRow(input))
      .select("*")
      .single();
    if (!error && data) return { lead: leadFromRow(data), created: true };
    // Unique violation on idempotency_key → replayed submission; return the original.
    if (error?.code === "23505") {
      const { data: existing, error: e2 } = await this.client
        .from("leads")
        .select("*")
        .eq("idempotency_key", input.idempotencyKey)
        .single();
      if (e2 || !existing) throw new Error(`Lead exists but could not be read: ${e2?.message}`);
      return { lead: leadFromRow(existing), created: false };
    }
    throw new Error(`Lead insert failed: ${error?.message ?? "unknown error"}`);
  }

  async getLead(id: string) {
    const { data, error } = await this.client.from("leads").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? leadFromRow(data) : null;
  }

  async listLeads(filter: LeadFilter = {}) {
    let q = this.client.from("leads").select("*").order("created_at", { ascending: false });
    if (!filter.includeArchived) q = q.is("archived_at", null);
    if (filter.leadType) {
      const types = Array.isArray(filter.leadType) ? filter.leadType : [filter.leadType];
      q = q.in("lead_type", types);
    }
    if (filter.stage) q = q.eq("stage", filter.stage);
    if (filter.search) {
      const s = filter.search.replace(/[%,()]/g, " ").trim();
      if (s) {
        q = q.or(
          ["first_name", "last_name", "email", "phone", "vehicle_make", "vehicle_model", "zip", "city", "service_address"]
            .map((c) => `${c}.ilike.%${s}%`)
            .join(","),
        );
      }
    }
    q = q.limit(filter.limit ?? 500);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map(leadFromRow);
  }

  async updateLead(id: string, patch: LeadPatch) {
    const { data, error } = await this.client
      .from("leads")
      .update({ ...snake(patch), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? leadFromRow(data) : null;
  }

  async deleteLead(id: string) {
    // appointments / notifications cascade via FK.
    const { error } = await this.client.from("leads").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async counts(): Promise<DashboardCounts> {
    const [{ data: leads, error: e1 }, { data: appts, error: e2 }] = await Promise.all([
      this.client.from("leads").select("lead_type, stage, archived_at"),
      this.client.from("appointments").select("status, completed_revenue_cents"),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return computeCounts(
      (leads ?? []).map((r) => ({ leadType: r.lead_type, stage: r.stage, archivedAt: r.archived_at }) as LeadRecord),
      (appts ?? []).map(
        (r) => ({ status: r.status, completedRevenueCents: r.completed_revenue_cents }) as AppointmentRecord,
      ),
    );
  }

  async findRecentByEmail(email: string, leadType: LeadType, withinMinutes: number) {
    const cutoff = new Date(Date.now() - withinMinutes * 60_000).toISOString();
    const { data, error } = await this.client
      .from("leads")
      .select("*")
      .eq("email", email)
      .eq("lead_type", leadType)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? leadFromRow(data) : null;
  }

  async listAppointments(opts: { from?: string; to?: string; leadId?: string } = {}) {
    let q = this.client.from("appointments").select("*").order("starts_at", { ascending: true });
    if (opts.leadId) q = q.eq("lead_id", opts.leadId);
    if (opts.from) q = q.gte("ends_at", opts.from);
    if (opts.to) q = q.lte("starts_at", opts.to);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map(apptFromRow);
  }

  async createAppointment(input: NewAppointment) {
    const { data, error } = await this.client
      .from("appointments")
      .insert(snake({ ...input }))
      .select("*")
      .single();
    // 23P01 = exclusion_violation: overlaps an active appointment (with travel buffer).
    if (error?.code === "23P01") throw new SlotTakenError();
    if (error) throw new Error(error.message);
    return apptFromRow(data);
  }

  async updateAppointment(id: string, patch: Partial<AppointmentRecord>) {
    const { data, error } = await this.client
      .from("appointments")
      .update({ ...snake(patch), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error?.code === "23P01") throw new SlotTakenError();
    if (error) throw new Error(error.message);
    return data ? apptFromRow(data) : null;
  }

  async bookOnlineSlot(input: OnlineHoldInput) {
    const { data, error } = await this.client.rpc("book_online_slot", {
      p_lead_id: input.leadId,
      p_service_id: input.serviceId,
      p_starts: input.startsAt,
      p_ends: input.endsAt,
      p_quoted_cents: input.quotedPriceCents,
      p_deposit_cents: input.depositCents,
      p_hold_minutes: input.holdMinutes,
      p_buffer_minutes: input.bufferMinutes,
    });
    if (error) {
      if (error.message.includes("SLOT_TAKEN")) throw new SlotTakenError();
      throw new Error(error.message);
    }
    return apptFromRow(data as Row);
  }

  async markHeldAppointmentPaid(id: string, paymentIntentId: string | null) {
    const { data, error } = await this.client
      .from("appointments")
      .update({
        status: "confirmed",
        deposit_status: "paid",
        payment_intent_id: paymentIntentId,
        hold_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "held")
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? apptFromRow(data) : null;
  }

  async findAppointmentByCheckoutSession(sessionId: string) {
    const { data, error } = await this.client
      .from("appointments")
      .select("*")
      .eq("checkout_session_id", sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? apptFromRow(data) : null;
  }

  async listTimeOff(opts: { from?: string } = {}) {
    let q = this.client.from("time_off").select("*").order("day", { ascending: true });
    if (opts.from) q = q.gte("day", opts.from);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      day: r.day as string,
      note: (r.note as string | null) ?? null,
      createdAt: r.created_at as string,
    }));
  }

  async addTimeOff(days: string[], note: string | null) {
    if (days.length === 0) return;
    const { error } = await this.client
      .from("time_off")
      .upsert(days.map((day) => ({ day, note })), { onConflict: "day", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async removeTimeOff(day: string) {
    const { error } = await this.client.from("time_off").delete().eq("day", day);
    if (error) throw new Error(error.message);
  }

  async createNotification(leadId: string, kind: NotificationKind) {
    const { data, error } = await this.client
      .from("notification_log")
      .insert({ lead_id: leadId, kind, status: "pending", attempts: 0 })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return notifFromRow(data);
  }

  async updateNotification(id: string, patch: Partial<NotificationRecord>) {
    const { error } = await this.client
      .from("notification_log")
      .update({ ...snake(patch), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listNotifications(opts: { leadId?: string; status?: NotificationStatus } = {}) {
    let q = this.client.from("notification_log").select("*").order("created_at", { ascending: false });
    if (opts.leadId) q = q.eq("lead_id", opts.leadId);
    if (opts.status) q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map(notifFromRow);
  }
}
