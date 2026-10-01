import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AppointmentEventRecord,
  AppointmentPatch,
  AppointmentRecord,
  AppointmentStatus,
  NewAppointmentEvent,
  NewPayment,
  PaymentRecord,
  DashboardCounts,
  LeadFilter,
  LeadPatch,
  LeadRecord,
  LeadStore,
  LeadType,
  NewAppointment,
  NewLead,
  NewOutboundEmail,
  OnlineHoldInput,
  OutboundEmailRecord,
  NotificationKind,
  NotificationRecord,
  NotificationStatus,
  StoreHealth,
  TimeOffRecord,
} from "./types";
import { SlotTakenError } from "./types";
import { matchesFilter, computeCounts } from "./shared";
import { todayEastern } from "@/lib/time";
import { isBlocking } from "@shared/appointment-status";

const easternDate = (iso: string) => todayEastern(new Date(iso));

/** Mirrors the database: busy window = [starts_at, ends_at + buffer). */
function withBusy<T extends { endsAt: string; bufferMinutes: number }>(a: T): T & { busyUntil: string } {
  return { ...a, busyUntil: new Date(Date.parse(a.endsAt) + a.bufferMinutes * 60_000).toISOString() };
}

/** Mirrors the appointments_no_overlap exclusion constraint. */
function overlapsActive(list: AppointmentRecord[], candidate: AppointmentRecord): boolean {
  const s = Date.parse(candidate.startsAt);
  const e = Date.parse(candidate.busyUntil);
  return list.some(
    (a) =>
      a.id !== candidate.id &&
      isBlocking(a.status) &&
      Date.parse(a.startsAt) < e &&
      s < Date.parse(a.busyUntil),
  );
}

/**
 * LOCAL DEMO STORE — development only.
 *
 * Persists to `.data/demo-store.json` in the project directory so that leads
 * survive a dev-server restart. It is single-process, unauthenticated, and
 * never used when NODE_ENV=production (see `getLeadStore`).
 */

interface DemoData {
  leads: LeadRecord[];
  appointments: AppointmentRecord[];
  notifications: NotificationRecord[];
  timeOff: TimeOffRecord[];
  outboundEmails: OutboundEmailRecord[];
  appointmentEvents: AppointmentEventRecord[];
  payments: PaymentRecord[];
}

// Resolved per call so the working directory can be swapped in tests.
const dataDir = () => path.join(process.cwd(), ".data");
const dataFile = () => path.join(dataDir(), "demo-store.json");

let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function load(): Promise<DemoData> {
  try {
    const raw = await fs.readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Partial<DemoData>;
    return {
      leads: parsed.leads ?? [],
      // Older demo files predate online booking; fill the new fields with their database defaults.
      appointments: (parsed.appointments ?? []).map((a) =>
        withBusy({
          source: "owner" as const,
          serviceId: null,
          depositCents: null,
          depositStatus: "none" as const,
          checkoutSessionId: null,
          paymentIntentId: null,
          holdExpiresAt: null,
          bufferMinutes: 45,
          cancelReason: null,
          cancelledBy: null,
          discountCents: 0,
          ...(a as Partial<AppointmentRecord>),
        } as AppointmentRecord),
      ),
      notifications: parsed.notifications ?? [],
      timeOff: parsed.timeOff ?? [],
      outboundEmails: parsed.outboundEmails ?? [],
      appointmentEvents: parsed.appointmentEvents ?? [],
      payments: parsed.payments ?? [],
    };
  } catch {
    return { leads: [], appointments: [], notifications: [], timeOff: [], outboundEmails: [], appointmentEvents: [], payments: [] };
  }
}

async function save(data: DemoData): Promise<void> {
  await fs.mkdir(dataDir(), { recursive: true });
  const file = dataFile();
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

const now = () => new Date().toISOString();

export class DemoLeadStore implements LeadStore {
  readonly kind = "demo" as const;

  async health(): Promise<StoreHealth> {
    return { ok: true, kind: "demo", detail: `Local JSON file at ${dataFile()}. Not for production.` };
  }

  createLead(input: NewLead) {
    return serialized(async () => {
      const data = await load();
      const existing = data.leads.find((l) => l.idempotencyKey === input.idempotencyKey);
      if (existing) return { lead: existing, created: false };
      const ts = now();
      const lead: LeadRecord = {
        ...input,
        id: randomUUID(),
        createdAt: ts,
        updatedAt: ts,
        stage: input.stage ?? "new",
        followUpOn: null,
        internalNotes: null,
        archivedAt: null,
      };
      data.leads.push(lead);
      await save(data);
      return { lead, created: true };
    });
  }

  async getLead(id: string) {
    const data = await load();
    return data.leads.find((l) => l.id === id) ?? null;
  }

  async getLeads(ids: string[]) {
    const data = await load();
    const wanted = new Set(ids);
    return data.leads.filter((l) => wanted.has(l.id));
  }

  async listLeads(filter: LeadFilter = {}) {
    const data = await load();
    return data.leads
      .filter((l) => matchesFilter(l, filter))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, filter.limit ?? 500);
  }

  updateLead(id: string, patch: LeadPatch) {
    return serialized(async () => {
      const data = await load();
      const lead = data.leads.find((l) => l.id === id);
      if (!lead) return null;
      Object.assign(lead, patch, { updatedAt: now() });
      await save(data);
      return lead;
    });
  }

  deleteLead(id: string) {
    return serialized(async () => {
      const data = await load();
      data.leads = data.leads.filter((l) => l.id !== id);
      data.appointments = data.appointments.filter((a) => a.leadId !== id);
      data.notifications = data.notifications.filter((n) => n.leadId !== id);
      data.outboundEmails = data.outboundEmails.filter((e) => e.leadId !== id);
      const remaining = new Set(data.appointments.map((a) => a.id));
      data.appointmentEvents = data.appointmentEvents.filter((e) => remaining.has(e.appointmentId));
      data.payments = data.payments.filter((p) => remaining.has(p.appointmentId));
      await save(data);
    });
  }

  async counts(): Promise<DashboardCounts> {
    const data = await load();
    return computeCounts(data.leads, data.appointments);
  }

  async findRecentByEmail(email: string, leadType: LeadType, withinMinutes: number) {
    const data = await load();
    const cutoff = Date.now() - withinMinutes * 60_000;
    return (
      data.leads
        .filter((l) => l.email === email && l.leadType === leadType && Date.parse(l.createdAt) >= cutoff)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  async listAppointments(opts: { from?: string; to?: string; leadId?: string } = {}) {
    const data = await load();
    return data.appointments
      .filter((a) => !opts.leadId || a.leadId === opts.leadId)
      .filter((a) => !opts.from || a.endsAt >= opts.from)
      .filter((a) => !opts.to || a.startsAt <= opts.to)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  createAppointment(input: NewAppointment) {
    return serialized(async () => {
      const data = await load();
      const ts = now();
      const appt: AppointmentRecord = withBusy({
        discountCents: 0,
        ...input,
        cancelReason: null,
        cancelledBy: null,
        id: randomUUID(),
        createdAt: ts,
        updatedAt: ts,
      });
      if (isBlocking(appt.status) && overlapsActive(data.appointments, appt)) {
        throw new SlotTakenError();
      }
      data.appointments.push(appt);
      await save(data);
      return appt;
    });
  }

  async getAppointment(id: string) {
    const data = await load();
    return data.appointments.find((a) => a.id === id) ?? null;
  }

  updateAppointmentIfStatus(id: string, expected: AppointmentStatus, patch: AppointmentPatch) {
    return this.patchAppointment(id, patch, expected);
  }

  async listAppointmentEvents(appointmentId: string) {
    const data = await load();
    return data.appointmentEvents
      .filter((e) => e.appointmentId === appointmentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  addAppointmentEvent(input: NewAppointmentEvent) {
    return serialized(async () => {
      const data = await load();
      if (input.requestId && data.appointmentEvents.some((e) => e.requestId === input.requestId)) return null;
      const rec: AppointmentEventRecord = { ...input, id: randomUUID(), createdAt: now() };
      data.appointmentEvents.push(rec);
      await save(data);
      return rec;
    });
  }

  async findAppointmentEventByRequestId(requestId: string) {
    const data = await load();
    return data.appointmentEvents.find((e) => e.requestId === requestId) ?? null;
  }

  async listPayments(opts: { appointmentIds?: string[]; from?: string; to?: string }) {
    const data = await load();
    const ids = opts.appointmentIds ? new Set(opts.appointmentIds) : null;
    return data.payments
      .filter((p) => !ids || ids.has(p.appointmentId))
      .filter((p) => !opts.from || p.createdAt >= opts.from)
      .filter((p) => !opts.to || p.createdAt <= opts.to)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  recordPayment(input: NewPayment) {
    return serialized(async () => {
      const data = await load();
      if (input.requestId && data.payments.some((p) => p.requestId === input.requestId)) return null;
      const rec: PaymentRecord = { ...input, id: randomUUID(), createdAt: now() };
      data.payments.push(rec);
      await save(data);
      return rec;
    });
  }

  updateAppointment(id: string, patch: AppointmentPatch) {
    return this.patchAppointment(id, patch);
  }

  private patchAppointment(id: string, patch: AppointmentPatch, expected?: AppointmentStatus) {
    return serialized(async () => {
      const data = await load();
      const appt = data.appointments.find((a) => a.id === id);
      if (!appt || (expected && appt.status !== expected)) return null;
      const next = withBusy({ ...appt, ...patch, updatedAt: now() });
      if (isBlocking(next.status) && overlapsActive(data.appointments, next)) {
        throw new SlotTakenError();
      }
      Object.assign(appt, next);
      await save(data);
      return appt;
    });
  }

  bookOnlineSlot(input: OnlineHoldInput) {
    return serialized(async () => {
      const data = await load();
      const ts = now();
      // Mirrors the day-off check in book_online_slot().
      if (data.timeOff.some((t) => t.day === easternDate(input.startsAt))) throw new SlotTakenError();
      // Same order as book_online_slot(): release stale holds and this lead's earlier hold.
      for (const a of data.appointments) {
        const stale = a.status === "held" && a.holdExpiresAt !== null && a.holdExpiresAt < ts;
        if (stale || (a.status === "held" && a.leadId === input.leadId)) {
          Object.assign(a, { status: "cancelled", depositStatus: "released", updatedAt: ts });
        }
      }
      const appt: AppointmentRecord = withBusy({
        id: randomUUID(),
        leadId: input.leadId,
        createdAt: ts,
        updatedAt: ts,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: "held" as const,
        quotedPriceCents: input.quotedPriceCents,
        customerAgreed: true,
        completedRevenueCents: null,
        notes: null,
        source: "online" as const,
        serviceId: input.serviceId,
        depositCents: input.depositCents,
        depositStatus: "pending" as const,
        checkoutSessionId: null,
        paymentIntentId: null,
        holdExpiresAt: new Date(Date.now() + input.holdMinutes * 60_000).toISOString(),
        bufferMinutes: input.bufferMinutes,
        cancelReason: null,
        cancelledBy: null,
        discountCents: 0,
      });
      if (overlapsActive(data.appointments, appt)) {
        await save(data);
        throw new SlotTakenError();
      }
      data.appointments.push(appt);
      await save(data);
      return appt;
    });
  }

  markHeldAppointmentPaid(id: string, paymentIntentId: string | null) {
    return serialized(async () => {
      const data = await load();
      const appt = data.appointments.find((a) => a.id === id && a.status === "held");
      if (!appt) return null;
      Object.assign(appt, {
        status: "confirmed",
        depositStatus: "paid",
        paymentIntentId,
        holdExpiresAt: null,
        updatedAt: now(),
      });
      await save(data);
      return appt;
    });
  }

  async findAppointmentByCheckoutSession(sessionId: string) {
    const data = await load();
    return data.appointments.find((a) => a.checkoutSessionId === sessionId) ?? null;
  }

  async listTimeOff(opts: { from?: string } = {}) {
    const data = await load();
    return data.timeOff.filter((t) => !opts.from || t.day >= opts.from).sort((a, b) => a.day.localeCompare(b.day));
  }

  addTimeOff(days: string[], note: string | null) {
    return serialized(async () => {
      const data = await load();
      const ts = now();
      for (const day of days) {
        if (!data.timeOff.some((t) => t.day === day)) data.timeOff.push({ day, note, createdAt: ts });
      }
      await save(data);
    });
  }

  removeTimeOff(day: string) {
    return serialized(async () => {
      const data = await load();
      data.timeOff = data.timeOff.filter((t) => t.day !== day);
      await save(data);
    });
  }

  async listOutboundEmails(leadId: string) {
    const data = await load();
    return data.outboundEmails.filter((e) => e.leadId === leadId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findOutboundEmailBySendKey(sendKey: string) {
    const data = await load();
    return data.outboundEmails.find((e) => e.sendKey === sendKey) ?? null;
  }

  recordOutboundEmail(input: NewOutboundEmail) {
    return serialized(async () => {
      const data = await load();
      if (data.outboundEmails.some((e) => e.sendKey === input.sendKey)) return null;
      const rec: OutboundEmailRecord = { ...input, id: randomUUID(), createdAt: now() };
      data.outboundEmails.push(rec);
      await save(data);
      return rec;
    });
  }

  createNotification(leadId: string, kind: NotificationKind) {
    return serialized(async () => {
      const data = await load();
      const ts = now();
      const n: NotificationRecord = {
        id: randomUUID(),
        leadId,
        kind,
        status: "pending",
        attempts: 0,
        lastError: null,
        providerMessageId: null,
        createdAt: ts,
        updatedAt: ts,
      };
      data.notifications.push(n);
      await save(data);
      return n;
    });
  }

  updateNotification(id: string, patch: Partial<NotificationRecord>) {
    return serialized(async () => {
      const data = await load();
      const n = data.notifications.find((x) => x.id === id);
      if (!n) return;
      Object.assign(n, patch, { updatedAt: now() });
      await save(data);
    });
  }

  async listNotifications(opts: { leadId?: string; status?: NotificationStatus } = {}) {
    const data = await load();
    return data.notifications
      .filter((n) => !opts.leadId || n.leadId === opts.leadId)
      .filter((n) => !opts.status || n.status === opts.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
