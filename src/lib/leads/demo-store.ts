import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
  NotificationKind,
  NotificationRecord,
  NotificationStatus,
  StoreHealth,
} from "./types";
import { matchesFilter, computeCounts } from "./shared";

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
      appointments: parsed.appointments ?? [],
      notifications: parsed.notifications ?? [],
    };
  } catch {
    return { leads: [], appointments: [], notifications: [] };
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
      const appt: AppointmentRecord = { ...input, id: randomUUID(), createdAt: ts, updatedAt: ts };
      data.appointments.push(appt);
      await save(data);
      return appt;
    });
  }

  updateAppointment(id: string, patch: Partial<AppointmentRecord>) {
    return serialized(async () => {
      const data = await load();
      const appt = data.appointments.find((a) => a.id === id);
      if (!appt) return null;
      Object.assign(appt, patch, { updatedAt: now() });
      await save(data);
      return appt;
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
