import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { LeadStage } from "@/lib/leads/types";

/**
 * Regression tests for the 2026-10-02 security audit. Everything runs against
 * the demo store, demo auth and demo outbox in a temp directory, with invented
 * people: no real service is contacted and no real data is read.
 */

process.env.NEXT_PUBLIC_BUSINESS_MODE = "LIVE";
// No session cookie: what an anonymous visitor's request looks like to the server.
const net = vi.hoisted(() => ({ ip: "203.0.113.20" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": net.ip }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => undefined, delete: () => undefined }),
}));

const PASSWORD = "test-owner-password";
const DOMAIN = "reply.corsaautodetailing.com";
const WEBHOOK_SECRET = `whsec_${Buffer.from("test-signing-secret-32-bytes!!!!").toString("base64")}`;
const CLEARED = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "ADMIN_EMAILS",
  "ADMIN_USER_IDS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CRON_SECRET",
  "RESEND_WEBHOOK_SECRET",
  "INBOUND_REPLY_DOMAIN",
];
const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-sec-"));
  process.cwd = () => cwd;
  net.ip = "203.0.113.20";
  for (const k of CLEARED) delete process.env[k];
  Object.assign(process.env, { DEMO_ADMIN_PASSWORD: PASSWORD, OWNER_NOTIFY_EMAIL: "owner@example.com", FORM_RATE_LIMIT: "500" });
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
  vi.unstubAllGlobals();
  process.cwd = originalCwd;
  for (const k of [...CLEARED, "DEMO_ADMIN_PASSWORD", "OWNER_NOTIFY_EMAIL", "FORM_RATE_LIMIT"]) delete process.env[k];
  await fs.rm(cwd, { recursive: true, force: true });
});

const store = async () => (await (await import("@/lib/leads/store")).getLeadStore())!;
const outbox = async (): Promise<{ to: string; subject: string; text: string }[]> => {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, ".data", "demo-outbox.json"), "utf8"));
  } catch {
    return [];
  }
};

async function firstOpenSlot(service = "platinum-full"): Promise<string> {
  const { GET } = await import("@/app/api/availability/route");
  const { NextRequest } = await import("next/server");
  const res = await GET(new NextRequest(`http://localhost/api/availability?service=${service}`));
  const { days } = (await res.json()) as { days: { slots: string[] }[] };
  return days.flatMap((d) => d.slots)[0]!;
}

function requestForm(slotStart: string, overrides: Record<string, string | string[]> = {}) {
  const f = new FormData();
  const fields: Record<string, string | string[]> = {
    idempotencyKey: crypto.randomUUID(),
    serviceId: "platinum-full",
    vehicleYear: "2019",
    vehicleMake: "Toyota",
    vehicleModel: "4Runner",
    condition: "normal",
    serviceAddress: "45 Oak Ln",
    zip: "32068",
    locationType: "home",
    slotStart,
    dayPart: "either",
    firstName: "Ana",
    email: "ana@example.com",
    phone: "904-555-0101",
    preferredContact: "email",
    serviceConsent: "on",
    priceAcknowledgment: "on",
    ...overrides,
  };
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) f.append(k, one);
  return f;
}

/** A different invented customer each time: own email and phone. */
const customer = (n: number) => ({ email: `customer${n}@example.com`, phone: `904-555-${String(1000 + n)}` });

const holds = async () => (await (await store()).listAppointments()).filter((a) => a.status === "held");

function launchForm(overrides: Record<string, string> = {}) {
  const f = new FormData();
  const base = { idempotencyKey: crypto.randomUUID(), firstName: "Ana", email: "ana@example.com", zip: "32003", serviceConsent: "on", ...overrides };
  for (const [k, v] of Object.entries(base)) f.append(k, v);
  return f;
}

async function seedLead(email = "dana@example.com", stage: LeadStage = "contacted") {
  const { lead } = await (await store()).createLead({
    leadType: "quote_request",
    businessMode: "LIVE",
    idempotencyKey: crypto.randomUUID(),
    firstName: "Dana",
    lastName: "Cole",
    email,
    phone: null,
    preferredContact: null,
    vehicleCategory: null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    serviceId: "signature-full",
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
    message: null,
    estimate: null,
    pricingVersion: "test",
    consent: { serviceTextVersion: "v1", serviceAcceptedAt: new Date().toISOString(), marketingEmail: false, marketingTextVersion: null, marketingAcceptedAt: null },
    source: { landingPath: null, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    stage,
    photoRefs: [],
  });
  return lead;
}

describe("public forms: what a visitor can put into the business's emails", () => {
  it("refuses a name that carries a link or extra lines, so the acknowledgement can't deliver someone's message", async () => {
    const { submitLaunchList } = await import("@/app/actions/leads");
    for (const firstName of ["there,\n\nYour invoice is overdue: https://evil.example/pay", "Call 904-555-0199 now", "www.evil.example", "a@b.co"]) {
      const res = await submitLaunchList(null, launchForm({ firstName, email: "victim@example.com" }));
      expect(res.status, firstName).toBe("invalid");
      expect(res.status === "invalid" && res.fieldErrors.firstName, firstName).toBeDefined();
    }
    expect(await outbox()).toHaveLength(0);
    expect(await (await store()).listLeads()).toHaveLength(0);
    // Ordinary names still pass.
    for (const firstName of ["Ana", "Mary-Jane", "O'Brien", "José", "J. R."]) {
      expect((await submitLaunchList(null, launchForm({ firstName, email: `${crypto.randomUUID()}@example.com` }))).status, firstName).toBe("ok");
    }
  });

  it("keeps one-line fields on one line, so a customer can't fake lines in the owner's alert", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const res = await submitCalendarRequest(
      null,
      requestForm(await firstOpenSlot(), { serviceAddress: "45 Oak Ln\nEmail: attacker@evil.example\r\nPhone: 000", vehicleMake: "Toyota\nPaid: yes" }),
    );
    expect(res.status).toBe("ok");
    const [lead] = await (await store()).listLeads();
    expect(lead!.serviceAddress).toBe("45 Oak Ln Email: attacker@evil.example Phone: 000");
    expect(lead!.vehicleMake).toBe("Toyota Paid: yes");
    for (const mail of await outbox()) expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("stops acknowledging the same address after three in an hour, while the owner still hears about every request", async () => {
    const { submitLaunchList } = await import("@/app/actions/leads");
    for (let i = 0; i < 5; i++) expect((await submitLaunchList(null, launchForm({ email: "victim@example.com" }))).status).toBe("ok");
    const mail = await outbox();
    expect(mail.filter((m) => m.to === "victim@example.com")).toHaveLength(3);
    expect(mail.filter((m) => m.to === "owner@example.com")).toHaveLength(5);
    const skipped = (await (await store()).listNotifications({ status: "skipped" })).filter((n) => n.kind === "customer_ack");
    expect(skipped).toHaveLength(2);
  });

  it("bounds repeated fields: checkbox lists are de-duplicated and oversized forms are rejected", async () => {
    const { formDataToObject, calendarRequestSchema } = await import("@/lib/validation");
    const slot = await firstOpenSlot();
    const dupes = calendarRequestSchema.safeParse(formDataToObject(requestForm(slot, { timeWindows: Array<string>(20).fill("saturday") })));
    expect(dupes.success && dupes.data.timeWindows).toEqual(["saturday"]);
    expect(calendarRequestSchema.safeParse(formDataToObject(requestForm(slot, { timeWindows: Array<string>(40).fill("saturday") }))).success).toBe(false);

    const flood = new FormData();
    for (let i = 0; i < 5000; i++) flood.append("timeWindows", "saturday");
    expect(formDataToObject(flood)).toEqual({});
    // Keys that exist on every object are just field names here.
    const odd = new FormData();
    odd.append("constructor", "x");
    odd.append("__proto__", "y");
    expect(Object.keys(formDataToObject(odd)).sort()).toEqual(["__proto__", "constructor"]);
  });
});

describe("booking requests: price and calendar integrity", () => {
  it("ignores any price, deposit, status or stage a client sends", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const res = await submitCalendarRequest(
      null,
      requestForm(await firstOpenSlot(), {
        price: "1",
        quotedPriceCents: "1",
        estimate: '{"total":1}',
        depositCents: "0",
        depositStatus: "paid",
        status: "confirmed",
        stage: "completed",
        customerAgreed: "true",
      }),
    );
    expect(res.status).toBe("ok");
    const s = await store();
    const [appt] = await s.listAppointments();
    expect(appt).toMatchObject({ status: "held", depositStatus: "none", quotedPriceCents: 17500, customerAgreed: false });
    const lead = await s.getLead(appt!.leadId);
    expect(lead).toMatchObject({ stage: "new" });
    expect(lead!.estimate?.total).toBe(175);
  });

  it("prices a replayed form from the package it asks for now, not the one first saved", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const key = crypto.randomUUID();
    const s = await store();
    expect((await submitCalendarRequest(null, requestForm(await firstOpenSlot("signature-full"), { idempotencyKey: key, serviceId: "signature-full" }))).status).toBe("ok");
    const [first] = await s.listAppointments();
    await s.updateAppointment(first!.id, { status: "declined" });

    expect((await submitCalendarRequest(null, requestForm(await firstOpenSlot(), { idempotencyKey: key, serviceId: "platinum-full" }))).status).toBe("ok");
    const held = (await holds())[0]!;
    expect(held.serviceId).toBe("platinum-full");
    expect(held.quotedPriceCents).toBe(17500);
  });

  it("lets only one of two simultaneous requests take the same time", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const slot = await firstOpenSlot();
    const results = await Promise.all([1, 2, 3].map((n) => submitCalendarRequest(null, requestForm(slot, customer(n)))));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect(results.filter((r) => r.status === "invalid")).toHaveLength(2);
    expect(await holds()).toHaveLength(1);
  });

  it("does not hold a second time when the same form is sent twice", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const slot = await firstOpenSlot();
    const form = requestForm(slot);
    const key = String(form.get("idempotencyKey"));
    expect((await submitCalendarRequest(null, form)).status).toBe("ok");
    expect((await submitCalendarRequest(null, requestForm(slot, { idempotencyKey: key }))).status).not.toBe("error");
    expect(await holds()).toHaveLength(1);
    expect(await (await store()).listLeads()).toHaveLength(1);
  });

  it("gives one customer at most two unconfirmed holds", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    expect((await submitCalendarRequest(null, requestForm(await firstOpenSlot()))).status).toBe("ok");
    // Same phone, different email: still the same customer.
    expect((await submitCalendarRequest(null, requestForm(await firstOpenSlot(), { email: "ana.other@example.com" }))).status).toBe("ok");
    const third = await submitCalendarRequest(null, requestForm(await firstOpenSlot()));
    expect(third.status).toBe("invalid");
    expect(third.status === "invalid" && third.fieldErrors.slotStart).toMatch(/waiting for us to confirm/);
    expect(await holds()).toHaveLength(2);
    // The refused request saved nothing.
    expect(await (await store()).listLeads()).toHaveLength(2);
  });

  it("stops holding times once six requests are waiting, but still takes the request", async () => {
    const { business } = await import("@/config/business");
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    for (let n = 0; n < business.booking.maxOpenRequests; n++) {
      expect((await submitCalendarRequest(null, requestForm(await firstOpenSlot(), customer(n)))).status).toBe("ok");
    }
    expect(await holds()).toHaveLength(business.booking.maxOpenRequests);

    const next = await firstOpenSlot();
    const extra = await submitCalendarRequest(null, requestForm(next, customer(99)));
    expect(extra.status).toBe("ok");
    expect(await holds()).toHaveLength(business.booking.maxOpenRequests);
    // The calendar still shows that time, and the owner was told about the request.
    expect(await firstOpenSlot()).toBe(next);
    const mail = await outbox();
    expect(mail.filter((m) => m.to === "owner@example.com")).toHaveLength(business.booking.maxOpenRequests + 1);
    expect(mail.find((m) => m.to === customer(99).email)!.text).toContain("not a confirmed appointment yet");
  });
});

describe("anonymous and unauthorized access", () => {
  const params = <P,>(p: P) => ({ params: Promise.resolve(p) });
  const anon = (p: string, method = "GET", body?: unknown) =>
    new Request(`http://localhost/api/owner/v1${p}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it("refuses customer data, invoices, payments and messages without a token", async () => {
    const id = crypto.randomUUID();
    const requestId = crypto.randomUUID();
    const [customers, conversations, conversation, messages, archive, handled, receipt, payments, notes, reschedule, options] = await Promise.all([
      import("@/app/api/owner/v1/customers/route"),
      import("@/app/api/owner/v1/conversations/route"),
      import("@/app/api/owner/v1/conversations/[leadId]/route"),
      import("@/app/api/owner/v1/conversations/[leadId]/messages/route"),
      import("@/app/api/owner/v1/conversations/[leadId]/archive/route"),
      import("@/app/api/owner/v1/conversations/[leadId]/handled/route"),
      import("@/app/api/owner/v1/appointments/[id]/receipt/route"),
      import("@/app/api/owner/v1/appointments/[id]/payments/route"),
      import("@/app/api/owner/v1/appointments/[id]/notes/route"),
      import("@/app/api/owner/v1/appointments/[id]/reschedule/route"),
      import("@/app/api/owner/v1/booking-options/route"),
    ]);
    const lead = await seedLead();
    const responses = await Promise.all([
      customers.GET(anon("/customers")),
      conversations.GET(anon("/conversations")),
      conversation.GET(anon(`/conversations/${lead.id}`), params({ leadId: lead.id })),
      conversation.DELETE(anon(`/conversations/${lead.id}?confirm=delete`, "DELETE"), params({ leadId: lead.id })),
      messages.POST(anon(`/conversations/${lead.id}/messages`, "POST", { subject: "Hi", message: "Hello", sendKey: requestId }), params({ leadId: lead.id })),
      archive.POST(anon(`/conversations/${lead.id}/archive`, "POST", { archived: true }), params({ leadId: lead.id })),
      handled.POST(anon(`/conversations/${lead.id}/handled`, "POST"), params({ leadId: lead.id })),
      receipt.POST(anon(`/appointments/${id}/receipt`, "POST", { requestId }), params({ id })),
      payments.POST(anon(`/appointments/${id}/payments`, "POST", { requestId, kind: "payment", method: "cash", amountCents: 100 }), params({ id })),
      notes.POST(anon(`/appointments/${id}/notes`, "POST", { requestId, note: "x" }), params({ id })),
      reschedule.POST(anon(`/appointments/${id}/reschedule`, "POST", {}), params({ id })),
      options.GET(anon("/booking-options")),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
    // Nothing was deleted, archived or emailed.
    expect((await (await store()).getLead(lead.id))?.archivedAt).toBeNull();
    expect(await outbox()).toHaveLength(0);
  });

  it("refuses the CSV export and photo links without an owner session", async () => {
    const { NextRequest } = await import("next/server");
    const [exportRoute, photos] = await Promise.all([import("@/app/admin/export/route"), import("@/app/admin/photos/route")]);
    expect((await exportRoute.GET(new NextRequest("http://localhost/admin/export"))).status).toBe(401);
    expect((await photos.GET(new NextRequest("http://localhost/admin/photos?ref=leads/x/1.jpg"))).status).toBe(401);
  });

  it("refuses dashboard actions called directly, without a session", async () => {
    const lead = await seedLead();
    const actions = await import("@/app/admin/actions");
    const inbox = await import("@/app/admin/inbox/actions");
    const form = (fields: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) f.append(k, v);
      return f;
    };
    const toLogin = { digest: expect.stringMatching(/^NEXT_REDIRECT;.*\/admin\/login/) };
    await expect(actions.deleteLeadAction(form({ leadId: lead.id, confirm: "DELETE" }))).rejects.toMatchObject(toLogin);
    await expect(actions.archiveLeadAction(form({ leadId: lead.id }))).rejects.toMatchObject(toLogin);
    await expect(
      actions.sendLeadEmailAction({ status: "idle", message: "", sendKey: "" } as never, form({ leadId: lead.id, sendKey: crypto.randomUUID(), subject: "Hi", message: "Hello" })),
    ).rejects.toMatchObject(toLogin);
    await expect(inbox.deleteConversationAction(form({ leadId: lead.id, confirm: "delete" }))).rejects.toMatchObject(toLogin);

    const after = await (await store()).getLead(lead.id);
    expect(after).toMatchObject({ id: lead.id, archivedAt: null });
    expect(await outbox()).toHaveLength(0);
  });

  it("answers an unlisted email exactly like a wrong password, without contacting the sign-in service", async () => {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key", ADMIN_EMAILS: "owner@example.com" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { signInWithPassword } = await import("@/lib/auth/owner");
    expect(await signInWithPassword("stranger@example.com", "anything")).toEqual({ error: "failed" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("slows password guessing on the dashboard form, per client and per account", async () => {
    const { signInThrottled } = await import("@/lib/auth/owner");
    for (let i = 0; i < 10; i++) expect(await signInThrottled("", "wrong")).toEqual({ error: "failed" });
    // Once a client has used its tries, even the right password waits.
    expect(await signInThrottled("", PASSWORD)).toEqual({ error: "rate_limited" });
    // Switching address doesn't reset it: the account keeps its own count (11 used, 20 allowed).
    for (let i = 0; i < 9; i++) {
      net.ip = `198.51.100.${i}`;
      expect(await signInThrottled("", "wrong")).toEqual({ error: "failed" });
    }
    net.ip = "198.51.100.200";
    expect(await signInThrottled("", PASSWORD)).toEqual({ error: "rate_limited" });
  });

  it("can require the account id as well as the email", async () => {
    const { ownerEmailOf } = await import("@/lib/auth/owner");
    process.env.ADMIN_EMAILS = "Owner@Example.com";
    const real = "11111111-1111-4111-8111-111111111111";
    expect(ownerEmailOf({ id: real, email: "owner@example.com" })).toBe("owner@example.com");
    expect(ownerEmailOf({ id: real, email: "someone@example.com" })).toBeNull();
    expect(ownerEmailOf(null)).toBeNull();

    process.env.ADMIN_USER_IDS = real;
    expect(ownerEmailOf({ id: real, email: "owner@example.com" })).toBe("owner@example.com");
    // A different account that somehow carries the owner's email gets nothing.
    expect(ownerEmailOf({ id: "22222222-2222-4222-8222-222222222222", email: "owner@example.com" })).toBeNull();
  });

  it("protects the scheduled jobs with the cron secret, including against odd input", async () => {
    const { NextRequest } = await import("next/server");
    const [retry, ads] = await Promise.all([import("@/app/api/cron/retry-notifications/route"), import("@/app/api/cron/ads-conversions/route")]);
    const call = (bearer?: string) =>
      retry.POST(new NextRequest("http://localhost/api/cron/retry-notifications", { method: "POST", headers: bearer === undefined ? {} : { authorization: bearer } }));

    // No secret configured: nobody gets in, even with an empty bearer.
    expect((await call("Bearer ")).status).toBe(401);
    expect((await call()).status).toBe(401);

    process.env.CRON_SECRET = "correct-horse-battery-staple";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    // Same length, non-ASCII: used to throw; must be a plain refusal.
    expect((await call(`Bearer ${"é".repeat(process.env.CRON_SECRET.length)}`)).status).toBe(401);
    expect((await ads.GET(new NextRequest("http://localhost/api/cron/ads-conversions", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
  });

  it("compares secrets without throwing on any input", async () => {
    const { safeEqual } = await import("@/lib/safe-equal");
    expect(safeEqual("abc", "abc")).toBe(true);
    for (const [a, b] of [["abc", "abd"], ["abc", "abcd"], ["", "abc"], ["ééé", "abc"], ["a".repeat(5000), "abc"]] as const) {
      expect(safeEqual(a, b)).toBe(false);
    }
  });
});

describe("payment and email webhooks", () => {
  it("rejects Stripe webhooks that are unsigned, wrongly signed, or arrive while Stripe isn't configured", async () => {
    const { NextRequest } = await import("next/server");
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_test_1", payment_status: "paid" } } });
    const post = (headers: Record<string, string>) => POST(new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", headers, body }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect((await post({ "stripe-signature": "t=1,v1=abc" })).status).toBe(400);

    Object.assign(process.env, { STRIPE_SECRET_KEY: "sk_test_not_a_real_key", STRIPE_WEBHOOK_SECRET: "whsec_test_not_a_real_secret" });
    expect((await post({})).status).toBe(400);
    expect((await post({ "stripe-signature": "t=1,v1=abc" })).status).toBe(400);
    // Signed with the wrong secret, with a current timestamp.
    const t = Math.floor(Date.now() / 1000);
    const forged = createHmac("sha256", "whsec_attacker").update(`${t}.${body}`).digest("hex");
    expect((await post({ "stripe-signature": `t=${t},v1=${forged}` })).status).toBe(400);
    quiet.mockRestore();
    expect(await (await store()).listAppointments()).toHaveLength(0);
  });

  it("does not accept an inbound-mail signature made with an empty or truncated secret", async () => {
    const { verifyWebhook } = await import("@/lib/inbound");
    const body = '{"type":"email.received"}';
    const ts = String(Math.floor(Date.now() / 1000));
    for (const secret of ["whsec_", `whsec_${Buffer.from("short").toString("base64")}`]) {
      const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
      const sig = createHmac("sha256", key).update(`msg_1.${ts}.${body}`).digest("base64");
      expect(verifyWebhook(body, { id: "msg_1", timestamp: ts, signature: `v1,${sig}` }, secret)).toBe(false);
    }
  });
});

describe("inbound email: what a stranger writing to the reply address can cause", () => {
  let received: Record<string, unknown>;

  beforeEach(() => {
    Object.assign(process.env, { RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET, INBOUND_REPLY_DOMAIN: DOMAIN, RESEND_API_KEY: "re_test" });
    received = {};
    // Only Resend's "retrieve received email" call is stubbed; sending uses the demo outbox (EMAIL_FROM is unset).
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = received[String(url).split("/").pop()!];
        return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("not found", { status: 404 });
      }),
    );
  });

  async function deliver(emailId: string, message: { from: string; to: string[]; subject?: string; text?: string | null; html?: string | null }) {
    received[emailId] = { subject: "Hello", text: "Hi", html: null, message_id: null, created_at: new Date().toISOString(), ...message };
    const { POST } = await import("@/app/api/inbound/resend/route");
    const body = JSON.stringify({ type: "email.received", data: { email_id: emailId } });
    const ts = Math.floor(Date.now() / 1000);
    const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
    const sig = createHmac("sha256", key).update(`msg_${emailId}.${ts}.${body}`).digest("base64");
    const res = await POST(
      new Request("http://localhost/api/inbound/resend", {
        method: "POST",
        headers: { "svix-id": `msg_${emailId}`, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` },
        body,
      }),
    );
    return (await res.json()) as { status: string; reason?: string; leadId?: string };
  }

  it("ignores senders whose address isn't a plain email address", async () => {
    for (const [i, from] of ["a@b.co?bcc=x@evil.example", "not-an-address", `${"a".repeat(300)}@example.com`].entries()) {
      expect(await deliver(`bad${i}`, { from, to: [`hello@${DOMAIN}`] })).toMatchObject({ status: "ignored" });
    }
    expect(await (await store()).listLeads()).toHaveLength(0);
    expect(await outbox()).toHaveLength(0);
  });

  it("warns the owner when a reply filed under a customer came from a different address", async () => {
    const lead = await seedLead("dana@example.com");
    expect(await deliver("m1", { from: "Mallory <mallory@evil.example>", to: [`reply+${lead.id}@${DOMAIN}`], text: "Please cancel my Saturday appointment" })).toMatchObject({
      status: "stored",
      leadId: lead.id,
    });
    const [copy] = (await outbox()).filter((m) => m.to === "owner@example.com");
    expect(copy!.subject).toContain("mallory@evil.example");
    expect(copy!.subject).not.toContain("Dana");
    expect(copy!.text).toMatch(/^Check before acting on this/);
    expect(copy!.text).toContain("not the address on file (dana@example.com)");

    const { getConversation } = await import("@/lib/owner/conversations");
    const reply = (await getConversation(await store(), lead.id)).messages.find((m) => m.type === "received");
    expect(reply).toMatchObject({ fromOtherAddress: true });

    // The customer's own reply carries no warning.
    await deliver("m2", { from: "dana@example.com", to: [`reply+${lead.id}@${DOMAIN}`], text: "Thanks!" });
    const own = (await outbox()).filter((m) => m.to === "owner@example.com")[1]!;
    expect(own.text).not.toContain("Check before acting");
  });

  it("drops mail from a sender the owner marked as spam", async () => {
    await seedLead("spammer@example.com", "spam");
    expect(await deliver("s1", { from: "spammer@example.com", to: [`hello@${DOMAIN}`] })).toMatchObject({ status: "ignored" });
    expect(await outbox()).toHaveLength(0);
  });

  it("caps how many copies one sender can trigger and how many messages are stored per hour", async () => {
    const lead = await seedLead("dana@example.com");
    const results: string[] = [];
    for (let i = 0; i < 23; i++) results.push((await deliver(`f${i}`, { from: "dana@example.com", to: [`reply+${lead.id}@${DOMAIN}`], text: `Message ${i}` })).status);
    expect(results.filter((s) => s === "stored")).toHaveLength(20);
    expect(results.slice(20)).toEqual(["ignored", "ignored", "ignored"]);
    expect((await outbox()).filter((m) => m.to === "owner@example.com")).toHaveLength(5);
  });

  it("stops creating new customers from unknown senders after 25 in a day", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await deliver(`n${i}`, { from: `stranger${i}@example.com`, to: [`hello@${DOMAIN}`] })).status).toBe("stored");
    }
    expect(await deliver("n25", { from: "stranger25@example.com", to: [`hello@${DOMAIN}`] })).toMatchObject({ status: "ignored" });
    expect(await (await store()).listLeads({ includeArchived: true })).toHaveLength(25);
    // A webhook retry for a message already filed is still recognised.
    expect((await deliver("n3", { from: "stranger3@example.com", to: [`hello@${DOMAIN}`] })).status).toBe("duplicate");
  });
});

describe("owner emails and exports", () => {
  it("quotes CSV cells that could split into a formula in semicolon locales", async () => {
    const { csvCell } = await import("@/lib/csv");
    expect(csvCell("Smith;=HYPERLINK(\"http://evil.example\")")).toBe('"Smith;=HYPERLINK(""http://evil.example"")"');
    expect(csvCell("a\tb")).toBe('"a\tb"');
  });

  it("reports an email as sent once it has gone out, even if logging it fails", async () => {
    const lead = await seedLead();
    const s = await store();
    const { sendOwnerEmail } = await import("@/lib/owner/email");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failing = Object.assign(Object.create(s), {
      recordOutboundEmail: async () => {
        throw new Error("database unavailable");
      },
    });
    const result = await sendOwnerEmail(failing, lead.id, { subject: "Hi\r\nBcc: someone@evil.example", message: "Hello", sendKey: crypto.randomUUID() });
    quiet.mockRestore();
    expect(result.status).toBe("sent");
    const sent = (await outbox()).filter((m) => m.to === lead.email);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe("Hi Bcc: someone@evil.example");
  });
});
