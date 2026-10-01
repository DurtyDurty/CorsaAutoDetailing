import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  ConversationDetail,
  ConversationSummary,
  CreateAppointmentResponse,
  Page,
  SendMessageResponse,
  SessionTokens,
} from "@shared/api";

/**
 * Inbox and booking-from-the-app endpoints, in LIVE mode against the demo
 * store. The demo email adapter writes .data/demo-outbox.json in the temp
 * working directory, so the tests can see exactly what would have been sent.
 */

process.env.NEXT_PUBLIC_BUSINESS_MODE = "LIVE";
const PASSWORD = "test-owner-password";
const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-inbox-"));
  process.cwd = () => cwd;
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAILS", "RESEND_API_KEY"]) {
    delete process.env[k];
  }
  process.env.DEMO_ADMIN_PASSWORD = PASSWORD;
  const [{ resetLeadStoreCache }, { resetRateLimits }, { resetEmailAdapterCache }] = await Promise.all([
    import("@/lib/leads/store"),
    import("@/lib/rate-limit"),
    import("@/lib/email"),
  ]);
  resetLeadStoreCache();
  resetRateLimits();
  resetEmailAdapterCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  delete process.env.DEMO_ADMIN_PASSWORD;
  await fs.rm(cwd, { recursive: true, force: true });
});

const routes = async () => ({
  session: await import("@/app/api/owner/v1/session/route"),
  conversations: await import("@/app/api/owner/v1/conversations/route"),
  conversation: await import("@/app/api/owner/v1/conversations/[leadId]/route"),
  send: await import("@/app/api/owner/v1/conversations/[leadId]/messages/route"),
  handled: await import("@/app/api/owner/v1/conversations/[leadId]/handled/route"),
  appointments: await import("@/app/api/owner/v1/appointments/route"),
  options: await import("@/app/api/owner/v1/booking-options/route"),
  customers: await import("@/app/api/owner/v1/customers/route"),
});

const req = (p: string, init: Omit<RequestInit, "body"> & { token?: string; body?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(`http://localhost/api/owner/v1${p}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
};
const params = <P,>(p: P) => ({ params: Promise.resolve(p) });

async function token(): Promise<string> {
  const { session } = await routes();
  const res = await session.POST(req("/session", { method: "POST", body: { email: "owner@example.com", password: PASSWORD } }));
  return ((await res.json()) as SessionTokens).accessToken;
}

async function outbox(): Promise<{ to: string; subject: string; text: string }[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, ".data", "demo-outbox.json"), "utf8"));
  } catch {
    return [];
  }
}

async function seedContactMessage() {
  const { getLeadStore } = await import("@/lib/leads/store");
  const store = (await getLeadStore())!;
  const { lead } = await store.createLead({
    leadType: "contact",
    businessMode: "LIVE",
    idempotencyKey: crypto.randomUUID(),
    firstName: "Dana",
    lastName: "Cole",
    email: "dana@example.com",
    phone: null,
    preferredContact: null,
    vehicleCategory: null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    serviceId: null,
    membershipCadence: null,
    futureInterests: [],
    condition: null,
    conditionFlags: [],
    concerns: null,
    zip: null,
    zipEligibility: null,
    city: null,
    serviceAddress: null,
    locationType: null,
    timeWindows: [],
    preferredDate: null,
    notes: null,
    message: "Do you do boats?",
    estimate: null,
    pricingVersion: "test",
    consent: { serviceTextVersion: "v1", serviceAcceptedAt: new Date().toISOString(), marketingEmail: false, marketingTextVersion: null, marketingAcceptedAt: null },
    source: { landingPath: null, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    photoRefs: [],
  });
  return { store, lead };
}

/** Next Tuesday (a work day) as YYYY-MM-DD in Eastern time. */
async function nextTuesday(): Promise<string> {
  const { addDays, todayEastern } = await import("@/lib/time");
  let d = addDays(todayEastern(), 1);
  for (let i = 0; i < 8; i++) {
    const [y, m, dd] = d.split("-").map(Number);
    if (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() === 2) return d;
    d = addDays(d, 1);
  }
  throw new Error("no Tuesday found");
}

const newCustomer = {
  firstName: "Sam",
  lastName: "Reyes",
  email: "sam@example.com",
  phone: "904-555-0102",
  serviceAddress: "12 Pine St",
  city: "Fleming Island",
  zip: "32003",
  vehicleYear: 2020,
  vehicleMake: "Honda",
  vehicleModel: "Accord",
};

describe("inbox", () => {
  it("refuses every inbox and booking endpoint without a token", async () => {
    const r = await routes();
    const id = crypto.randomUUID();
    for (const res of await Promise.all([
      r.conversations.GET(req("/conversations")),
      r.conversation.GET(req(`/conversations/${id}`), params({ leadId: id })),
      r.send.POST(req(`/conversations/${id}/messages`, { method: "POST", body: {} }), params({ leadId: id })),
      r.handled.POST(req(`/conversations/${id}/handled`, { method: "POST" }), params({ leadId: id })),
      r.appointments.POST(req("/appointments", { method: "POST", body: {} })),
      r.options.GET(req("/booking-options")),
      r.customers.GET(req("/customers")),
    ])) {
      expect(res.status).toBe(401);
    }
  });

  it("lists a website message as unread, sends a reply once per key, and records it", async () => {
    const r = await routes();
    const t = await token();
    const { lead, store } = await seedContactMessage();

    const list = (await (await r.conversations.GET(req("/conversations?filter=unread", { token: t }))).json()) as Page<ConversationSummary>;
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ leadId: lead.id, unread: true, preview: "Do you do boats?" });

    const sendKey = crypto.randomUUID();
    const send = () =>
      r.send.POST(
        req(`/conversations/${lead.id}/messages`, { method: "POST", token: t, body: { subject: "Re: boats", message: "Hi Dana,\n\nNot yet!", sendKey } }),
        params({ leadId: lead.id }),
      );
    const first = (await (await send()).json()) as SendMessageResponse;
    expect(first.alreadySent).toBe(false);
    expect(first.conversation.unread).toBe(false);
    expect(first.conversation.messages.map((m) => m.type)).toEqual(["website", "sent"]);

    const again = (await (await send()).json()) as SendMessageResponse;
    expect(again.alreadySent).toBe(true);
    const sent = await outbox();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "dana@example.com", subject: "Re: boats" });
    // The server adds the owner's signature.
    expect(sent[0]!.text).toContain("Corsa Auto Detailing");
    expect((await store.getLead(lead.id))?.stage).toBe("contacted");
  });

  it("rejects an empty message and marks a conversation handled without emailing", async () => {
    const r = await routes();
    const t = await token();
    const { lead } = await seedContactMessage();
    const empty = await r.send.POST(
      req(`/conversations/${lead.id}/messages`, { method: "POST", token: t, body: { subject: "Hi", message: "  ", sendKey: crypto.randomUUID() } }),
      params({ leadId: lead.id }),
    );
    expect(empty.status).toBe(422);
    const handled = (await (await r.handled.POST(req(`/conversations/${lead.id}/handled`, { method: "POST", token: t }), params({ leadId: lead.id }))).json()) as ConversationDetail;
    expect(handled.unread).toBe(false);
    expect(await outbox()).toHaveLength(0);
  });
});

describe("booking from the app", () => {
  it("books a new customer, emails one confirmation, and treats a repeat submit as the same booking", async () => {
    const r = await routes();
    const t = await token();
    const date = await nextTuesday();
    const body = {
      requestId: crypto.randomUUID(),
      customer: { new: newCustomer },
      serviceId: "platinum-full",
      date,
      time: "10:00",
      durationMinutes: 180,
      priceCents: 29900,
      sendConfirmation: true,
    };
    const res = await r.appointments.POST(req("/appointments", { method: "POST", token: t, body }));
    expect(res.status).toBe(201);
    const booked = (await res.json()) as CreateAppointmentResponse;
    expect(booked).toMatchObject({ confirmation: "sent", alreadyBooked: false, appointment: { status: "confirmed", customerName: "Sam Reyes", quotedPriceCents: 29900 } });
    expect(booked.appointment.events.map((e) => e.type)).toEqual(["created", "note"]);

    const mail = await outbox();
    expect(mail).toHaveLength(1);
    expect(mail[0]!.to).toBe("sam@example.com");
    expect(mail[0]!.subject).toContain("Signature Full Detail is confirmed");
    expect(mail[0]!.text).toContain("12 Pine St, Fleming Island, 32003");
    expect(mail[0]!.text).toContain("$299");

    const replay = await r.appointments.POST(req("/appointments", { method: "POST", token: t, body }));
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as CreateAppointmentResponse).alreadyBooked).toBe(true);
    expect(await outbox()).toHaveLength(1);

    const { getLeadStore } = await import("@/lib/leads/store");
    const store = (await getLeadStore())!;
    expect(await store.listAppointments()).toHaveLength(1);
    const leads = await store.listLeads();
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ stage: "scheduled", phone: "9045550102", source: { landingPath: "owner-app" } });
  });

  it("refuses an overlapping time, even with override", async () => {
    const r = await routes();
    const t = await token();
    const date = await nextTuesday();
    const base = { customer: { new: newCustomer }, serviceId: "signature-full", date, durationMinutes: 120, priceCents: 17900, sendConfirmation: false };
    expect((await r.appointments.POST(req("/appointments", { method: "POST", token: t, body: { ...base, requestId: crypto.randomUUID(), time: "09:00" } }))).status).toBe(201);
    // 10:30 starts inside the first job's 11:00 end + 45-minute buffer.
    const clash = await r.appointments.POST(
      req("/appointments", { method: "POST", token: t, body: { ...base, requestId: crypto.randomUUID(), time: "10:30", override: true } }),
    );
    expect(clash.status).toBe(409);
    const err = (await clash.json()) as { error: { message: string; fields?: Record<string, string> } };
    expect(err.error.message).toContain("overlaps another job");
    expect(err.error.fields?.override).toBeUndefined();
    // The refused booking didn't leave a second customer record behind.
    const { getLeadStore } = await import("@/lib/leads/store");
    expect(await (await getLeadStore())!.listLeads()).toHaveLength(1);
  });

  it("asks before booking outside working hours, then books when told to", async () => {
    const r = await routes();
    const t = await token();
    const date = await nextTuesday();
    const base = { customer: { new: newCustomer }, serviceId: "signature-full", date, time: "19:00", durationMinutes: 60, priceCents: 17900, sendConfirmation: false };
    const ask = await r.appointments.POST(req("/appointments", { method: "POST", token: t, body: { ...base, requestId: crypto.randomUUID() } }));
    expect(ask.status).toBe(409);
    expect(((await ask.json()) as { error: { fields?: Record<string, string> } }).error.fields?.override).toBe("overridable");
    const { getLeadStore } = await import("@/lib/leads/store");
    expect(await (await getLeadStore())!.listLeads()).toHaveLength(0);
    const ok = await r.appointments.POST(req("/appointments", { method: "POST", token: t, body: { ...base, requestId: crypto.randomUUID(), override: true } }));
    expect(ok.status).toBe(201);
  });

  it("books an existing customer and offers them in customer search", async () => {
    const r = await routes();
    const t = await token();
    const { lead } = await seedContactMessage();
    const found = (await (await r.customers.GET(req("/customers?q=dana", { token: t }))).json()) as { items: { leadId: string }[] };
    expect(found.items.map((c) => c.leadId)).toContain(lead.id);
    const res = await r.appointments.POST(
      req("/appointments", {
        method: "POST",
        token: t,
        body: { requestId: crypto.randomUUID(), customer: { leadId: lead.id }, serviceId: "signature-exterior", date: await nextTuesday(), time: "13:00", durationMinutes: 90, priceCents: 12500, sendConfirmation: false },
      }),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as CreateAppointmentResponse).confirmation).toBe("skipped");
  });

  it("rejects an unknown service and a time in the past", async () => {
    const r = await routes();
    const t = await token();
    const base = { requestId: crypto.randomUUID(), customer: { new: newCustomer }, time: "10:00", durationMinutes: 60, priceCents: 0 };
    expect((await r.appointments.POST(req("/appointments", { method: "POST", token: t, body: { ...base, serviceId: "boat-wash", date: await nextTuesday() } }))).status).toBe(422);
    expect((await r.appointments.POST(req("/appointments", { method: "POST", token: t, body: { ...base, serviceId: "signature-full", date: "2020-01-07" } }))).status).toBe(422);
  });
});
