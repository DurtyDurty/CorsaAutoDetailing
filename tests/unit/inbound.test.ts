import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ConversationDetail, ConversationSummary, Page, SessionTokens, TodaySummary } from "@shared/api";

/**
 * Customer replies through Resend: webhook verification, filing replies under
 * the right customer, idempotency, unread state, and the Reply-To address.
 * Resend's API is stubbed; demo store and outbox live in a temp directory.
 */

const SECRET = `whsec_${Buffer.from("test-signing-secret-32-bytes!!!!").toString("base64")}`;
const DOMAIN = "reply.corsaautodetailing.com";
const PASSWORD = "test-owner-password";
const originalCwd = process.cwd;
let cwd: string;
let received: Record<string, unknown>;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-in-"));
  process.cwd = () => cwd;
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAILS", "EMAIL_FROM"]) {
    delete process.env[k];
  }
  Object.assign(process.env, {
    RESEND_WEBHOOK_SECRET: SECRET,
    INBOUND_REPLY_DOMAIN: DOMAIN,
    RESEND_API_KEY: "re_test",
    OWNER_NOTIFY_EMAIL: "owner@example.com",
    DEMO_ADMIN_PASSWORD: PASSWORD,
  });
  received = {};
  // Only Resend's "retrieve received email" API is stubbed; email sending uses the demo outbox.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const id = String(url).split("/").pop()!;
      const body = received[id];
      return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("not found", { status: 404 });
    }),
  );
  const [{ resetLeadStoreCache }, { resetRateLimits }, { resetEmailAdapterCache }] = await Promise.all([
    import("@/lib/leads/store"),
    import("@/lib/rate-limit"),
    import("@/lib/email"),
  ]);
  resetLeadStoreCache();
  resetRateLimits();
  // EMAIL_FROM is unset, so sends go to the demo outbox even with RESEND_API_KEY present.
  resetEmailAdapterCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  process.cwd = originalCwd;
  for (const k of ["RESEND_WEBHOOK_SECRET", "INBOUND_REPLY_DOMAIN", "RESEND_API_KEY", "OWNER_NOTIFY_EMAIL", "DEMO_ADMIN_PASSWORD"]) delete process.env[k];
  await fs.rm(cwd, { recursive: true, force: true });
});

function sign(body: string, id = "msg_1", ts = Math.floor(Date.now() / 1000)) {
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": String(ts), "svix-signature": `v1,${sig}` };
}

async function deliver(emailId: string, headers?: Record<string, string>) {
  const { POST } = await import("@/app/api/inbound/resend/route");
  const body = JSON.stringify({ type: "email.received", data: { email_id: emailId } });
  return POST(new Request("http://localhost/api/inbound/resend", { method: "POST", headers: headers ?? sign(body, `msg_${emailId}`), body }));
}

const store = async () => (await (await import("@/lib/leads/store")).getLeadStore())!;
const outbox = async (): Promise<{ to: string; subject: string; text: string; replyTo?: string }[]> => {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, ".data", "demo-outbox.json"), "utf8"));
  } catch {
    return [];
  }
};

async function seedLead(email = "dana@example.com") {
  const s = await store();
  const { lead } = await s.createLead({
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
    stage: "contacted",
    photoRefs: [],
  });
  return lead;
}

async function token() {
  const { POST } = await import("@/app/api/owner/v1/session/route");
  const res = await POST(
    new Request("http://localhost/api/owner/v1/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "owner@example.com", password: PASSWORD }),
    }),
  );
  return ((await res.json()) as SessionTokens).accessToken;
}

describe("webhook signature", () => {
  it("accepts a valid signature and refuses forged, tampered or stale ones", async () => {
    const { verifyWebhook } = await import("@/lib/inbound");
    const body = '{"type":"email.received"}';
    const h = sign(body);
    const parts = { id: h["svix-id"], timestamp: h["svix-timestamp"], signature: h["svix-signature"] };
    expect(verifyWebhook(body, parts, SECRET)).toBe(true);
    // Several signatures (key rotation): any valid one passes.
    expect(verifyWebhook(body, { ...parts, signature: `v1,AAAA ${parts.signature}` }, SECRET)).toBe(true);
    expect(verifyWebhook(body + " ", parts, SECRET)).toBe(false);
    expect(verifyWebhook(body, { ...parts, signature: "v1,bm9wZQ==" }, SECRET)).toBe(false);
    expect(verifyWebhook(body, parts, `whsec_${Buffer.from("another-secret").toString("base64")}`)).toBe(false);
    expect(verifyWebhook(body, parts, SECRET, Number(parts.timestamp) + 600)).toBe(false);
    expect(verifyWebhook(body, { ...parts, signature: null }, SECRET)).toBe(false);
  });

  it("rejects unsigned webhooks and refuses to run without a secret", async () => {
    expect((await deliver("e1", { "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,abc" })).status).toBe(401);
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await deliver("e1")).status).toBe(503);
  });
});

describe("visibleReply", () => {
  it("keeps the new text and drops the quoted history", async () => {
    const { visibleReply } = await import("@/lib/inbound");
    expect(visibleReply("Sounds good, see you then!\n\nOn Thu, Oct 1, 2026 at 2:00 PM Corsa <x@y.com> wrote:\n> You're booked")).toBe(
      "Sounds good, see you then!",
    );
    expect(visibleReply("Yes please\n> earlier")).toBe("Yes please");
    expect(visibleReply("Thanks\n\n-----Original Message-----\nFrom: Corsa")).toBe("Thanks");
    expect(visibleReply("> only quoted")).toBe("> only quoted");
  });
});

describe("receiving replies", () => {
  it("files a reply under its conversation by the reply+ address, once, and copies the owner", async () => {
    const lead = await seedLead();
    received.e1 = {
      from: "Dana Cole <Dana@Example.com>",
      to: [`reply+${lead.id}@${DOMAIN}`],
      subject: "Re: Your request",
      text: "Is Saturday possible?\n\nOn Thu wrote:\n> old",
      html: null,
      message_id: "<m1@example.com>",
      created_at: new Date().toISOString(),
    };
    const res = await deliver("e1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "stored", leadId: lead.id });
    // Resend retries the same webhook: stored once.
    expect(await (await deliver("e1")).json()).toEqual({ status: "duplicate" });

    const s = await store();
    const replies = await s.listInboundEmailsForLeads([lead.id]);
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ fromEmail: "dana@example.com", fromName: "Dana Cole", readAt: null });

    const copies = (await outbox()).filter((m) => m.to === "owner@example.com");
    expect(copies).toHaveLength(1);
    expect(copies[0]!.text).toContain("Is Saturday possible?");
    expect(copies[0]!.text).not.toContain("> old");
  });

  it("shows the reply as unread until the conversation is opened", async () => {
    const lead = await seedLead();
    received.e2 = { from: "dana@example.com", to: [`reply+${lead.id}@${DOMAIN}`], subject: "Re: hi", text: "Thanks!", html: null, message_id: null, created_at: new Date().toISOString() };
    await deliver("e2");
    const t = await token();
    const auth = { headers: { authorization: `Bearer ${t}` } };

    const list = await import("@/app/api/owner/v1/conversations/route");
    const page = (await (await list.GET(new Request("http://localhost/api/owner/v1/conversations?filter=unread", auth))).json()) as Page<ConversationSummary>;
    expect(page.items.map((c) => c.leadId)).toEqual([lead.id]);
    expect(page.items[0]!.preview).toBe("Thanks!");

    const summaryRoute = await import("@/app/api/owner/v1/summary/route");
    const before = (await (await summaryRoute.GET(new Request("http://localhost/api/owner/v1/summary", auth))).json()) as TodaySummary;
    expect(before.unreadMessages).toBe(1);

    const detailRoute = await import("@/app/api/owner/v1/conversations/[leadId]/route");
    const detail = (await (
      await detailRoute.GET(new Request(`http://localhost/api/owner/v1/conversations/${lead.id}`, auth), { params: Promise.resolve({ leadId: lead.id }) })
    ).json()) as ConversationDetail;
    expect(detail.messages.map((m) => m.type)).toEqual(["website", "received"]);

    const after = (await (await summaryRoute.GET(new Request("http://localhost/api/owner/v1/summary", auth))).json()) as TodaySummary;
    expect(after.unreadMessages).toBe(0);
  });

  it("matches a reply without the tag by sender, and starts one conversation for a new sender", async () => {
    const lead = await seedLead("pat@example.com");
    received.e3 = { from: "pat@example.com", to: [`hello@${DOMAIN}`], subject: "Question", text: "Hi", html: null, message_id: null, created_at: new Date().toISOString() };
    expect(await (await deliver("e3")).json()).toEqual({ status: "stored", leadId: lead.id });

    received.e4 = { from: "New Person <new@example.com>", to: [`hello@${DOMAIN}`], subject: "Hello", text: null, html: "<p>Do you do <b>boats</b>?</p>", message_id: null, created_at: new Date().toISOString() };
    const first = (await (await deliver("e4")).json()) as { leadId: string };
    const s = await store();
    const created = await s.getLead(first.leadId);
    expect(created).toMatchObject({ leadType: "contact", firstName: "New", lastName: "Person", email: "new@example.com" });
    expect((await s.listInboundEmailsForLeads([first.leadId]))[0]!.body).toBe("Do you do boats?");
    await deliver("e4");
    expect((await s.listLeads()).filter((l) => l.email === "new@example.com")).toHaveLength(1);
  });

  it("brings an archived conversation back when the customer replies", async () => {
    const lead = await seedLead();
    const s = await store();
    await s.updateLead(lead.id, { archivedAt: new Date().toISOString() });
    received.e7 = { from: "dana@example.com", to: [`reply+${lead.id}@${DOMAIN}`], subject: "Re: hi", text: "Back again", html: null, message_id: null, created_at: new Date().toISOString() };
    await deliver("e7");
    expect((await s.getLead(lead.id))?.archivedAt).toBeNull();
  });

  it("ignores mail from the business sending address, but files the owner's own test emails", async () => {
    process.env.EMAIL_FROM = "Corsa Auto Detailing <hello@corsaautodetailing.com>";
    received.e5 = { from: "hello@corsaautodetailing.com", to: [`hello@${DOMAIN}`], subject: "x", text: "x", html: null, message_id: null, created_at: new Date().toISOString() };
    expect(await (await deliver("e5")).json()).toMatchObject({ status: "ignored" });
    delete process.env.EMAIL_FROM;
    received.e6 = { from: "owner@example.com", to: [`test@${DOMAIN}`], subject: "Testing", text: "Testing Corsa inbox", html: null, message_id: null, created_at: new Date().toISOString() };
    expect(await (await deliver("e6")).json()).toMatchObject({ status: "stored" });
  });

  it("sends with a reply+ address only once receiving is set up", async () => {
    const lead = await seedLead();
    const { sendOwnerEmail } = await import("@/lib/owner/email");
    await sendOwnerEmail(await store(), lead.id, { subject: "Hi", message: "Hello", sendKey: crypto.randomUUID() });
    delete process.env.INBOUND_REPLY_DOMAIN;
    await sendOwnerEmail(await store(), lead.id, { subject: "Hi again", message: "Hello", sendKey: crypto.randomUUID() });
    const sent = (await outbox()).filter((m) => m.to === "dana@example.com");
    expect(sent[0]!.replyTo).toBe(`reply+${lead.id}@${DOMAIN}`);
    // Falls back to the contact address (unset in tests).
    expect(sent[1]!.replyTo ?? "").not.toContain("reply+");
  });
});
