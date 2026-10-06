import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppointmentDetail, SendQuoteResponse, SessionTokens, TodaySummary } from "@shared/api";

/**
 * Quotes from request to booked job: the owner prices a website request, the
 * customer gets an email with the PDF and a private link, and accepting it
 * confirms the job. Demo store, demo auth and demo outbox in a temp directory,
 * with invented people.
 */

process.env.NEXT_PUBLIC_BUSINESS_MODE = "LIVE";
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.30" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => undefined, delete: () => undefined }),
}));

const PASSWORD = "test-owner-password";
const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-quote-"));
  process.cwd = () => cwd;
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAILS", "RESEND_API_KEY", "STRIPE_SECRET_KEY"]) {
    delete process.env[k];
  }
  Object.assign(process.env, { DEMO_ADMIN_PASSWORD: PASSWORD, OWNER_NOTIFY_EMAIL: "owner@example.com", FORM_RATE_LIMIT: "200" });
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
  for (const k of ["DEMO_ADMIN_PASSWORD", "OWNER_NOTIFY_EMAIL", "FORM_RATE_LIMIT"]) delete process.env[k];
  await fs.rm(cwd, { recursive: true, force: true });
});

type Mail = { to: string; subject: string; text: string; attachments?: { filename: string; bytes: number }[] };
const store = async () => (await (await import("@/lib/leads/store")).getLeadStore())!;
const outbox = async (): Promise<Mail[]> => {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, ".data", "demo-outbox.json"), "utf8"));
  } catch {
    return [];
  }
};
const params = <P,>(p: P) => ({ params: Promise.resolve(p) });

async function openSlot(): Promise<string> {
  const { GET } = await import("@/app/api/availability/route");
  const { NextRequest } = await import("next/server");
  const { days } = (await (await GET(new NextRequest("http://localhost/api/availability?service=platinum-full"))).json()) as { days: { slots: string[] }[] };
  return days.flatMap((d) => d.slots)[0]!;
}

/** A customer requests the first open time on the website; returns the held appointment. */
async function request(email = `${crypto.randomUUID()}@example.com`) {
  const f = new FormData();
  const fields: Record<string, string> = {
    idempotencyKey: crypto.randomUUID(),
    serviceId: "platinum-full",
    vehicleYear: "2019",
    vehicleMake: "Toyota",
    vehicleModel: "4Runner",
    condition: "normal",
    serviceAddress: "45 Oak Ln",
    zip: "32068",
    locationType: "home",
    slotStart: await openSlot(),
    firstName: "Dana",
    lastName: "Cole",
    email,
    phone: `904555${String(1000 + Math.floor(Math.random() * 9000))}`,
    preferredContact: "email",
    serviceConsent: "on",
    priceAcknowledgment: "on",
  };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  const { submitCalendarRequest } = await import("@/app/actions/leads");
  expect((await submitCalendarRequest(null, f)).status).toBe("ok");
  const appts = await (await store()).listAppointments();
  return appts.find((a) => a.status === "held" && a.startsAt === fields.slotStart)!;
}

async function ownerToken(): Promise<string> {
  const { POST } = await import("@/app/api/owner/v1/session/route");
  const res = await POST(
    new Request("http://localhost/api/owner/v1/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@example.com", password: PASSWORD }) }),
  );
  return ((await res.json()) as SessionTokens).accessToken;
}

const LINES = [
  { label: "Signature Full Detail", amountCents: 29900 },
  { label: "Excessive pet-hair removal", amountCents: 5000 },
];

async function sendQuote(apptId: string, body: Record<string, unknown> = {}, token?: string) {
  const { POST } = await import("@/app/api/owner/v1/appointments/[id]/quote/route");
  const res = await POST(
    new Request(`http://localhost/api/owner/v1/appointments/${apptId}/quote`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token === "" ? {} : { authorization: `Bearer ${token ?? (await ownerToken())}` }) },
      body: JSON.stringify({ requestId: crypto.randomUUID(), lines: LINES, discountCents: 2500, notes: "Thanks for choosing Corsa!", expiresInDays: 3, ...body }),
    }),
    params({ id: apptId }),
  );
  return { status: res.status, body: (await res.json()) as SendQuoteResponse & { error?: { code: string; fields?: Record<string, string> } } };
}

/** The private link from the most recent quote email to that customer. */
async function linkTokenFor(email: string): Promise<string> {
  const mail = (await outbox()).filter((m) => m.to === email && m.subject.startsWith("Your quote")).at(-1)!;
  return /\/q\/([A-Za-z0-9]{12})\b/.exec(mail.text)![1]!;
}

describe("sending a quote", () => {
  it("emails the customer an itemized quote with the PDF attached and a private link, and keeps the time held", async () => {
    const appt = await request("dana@example.com");
    const { status, body } = await sendQuote(appt.id);
    expect(status).toBe(200);
    expect(body.quote).toMatchObject({ status: "sent", subtotalCents: 34900, discountCents: 2500, totalCents: 32400, lines: LINES });
    expect(body.quote.number).toMatch(/^Q-[A-Z0-9]{6}$/);
    expect(body.appointment).toMatchObject({ status: "held", quoteStatus: "sent", quote: { number: body.quote.number } });

    const mail = (await outbox()).find((m) => m.subject.startsWith("Your quote"))!;
    expect(mail.to).toBe("dana@example.com");
    expect(mail.text).toContain("$324");
    expect(mail.attachments).toEqual([{ filename: `Corsa-Quote-${body.quote.number}.pdf`, bytes: expect.any(Number) }]);
    expect(mail.attachments![0]!.bytes).toBeGreaterThan(5_000);

    // The hold now lasts as long as the quote (capped at the start time).
    const held = (await (await store()).getAppointment(appt.id))!;
    expect(held.holdExpiresAt).toBe(new Date(Math.min(Date.parse(body.quote.expiresAt), Date.parse(held.startsAt))).toISOString());
    expect((await (await store()).getLead(appt.leadId))!.stage).toBe("quote_sent");
  });

  it("never stores the link: only a hash of it is kept", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const saved = await fs.readFile(path.join(cwd, ".data", "demo-store.json"), "utf8");
    expect(saved).not.toContain(token);
    const { hashToken } = await import("@/lib/quotes/service");
    expect(saved).toContain(hashToken(token));
    expect(saved).toContain("[private quote link]");
  });

  it("serves the customer's PDF by the private link only, never cached", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const { GET } = await import("@/app/quote/[token]/pdf/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest(`http://localhost/quote/${token}/pdf`), params({ token }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");

    for (const bad of ["x".repeat(43), "x".repeat(12), "not-a-token", `${token.slice(0, -1)}`]) {
      expect((await GET(new NextRequest(`http://localhost/quote/${bad}/pdf`), params({ token: bad }))).status).toBe(404);
    }
  });

  it("sends a short link that forwards to the quote, and links sent before short links still work", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const code = await linkTokenFor("dana@example.com");
    const { GET } = await import("@/app/q/[code]/route");
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest(`http://localhost/q/${code}`), params({ code }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`http://localhost/quote/${code}`);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect((await GET(new NextRequest("http://localhost/q/nope"), params({ code: "nope" }))).status).toBe(404);

    // A quote emailed with the earlier 43-character link.
    const { hashToken, loadQuoteByToken } = await import("@/lib/quotes/service");
    const s = await store();
    const [current] = await s.listQuotesForAppointments([appt.id]);
    await s.updateQuoteIfStatus(current!.id, "sent", { status: "withdrawn" });
    const legacy = "L".repeat(43);
    await s.createQuote({ ...current!, number: "Q-LEGACY", tokenHash: hashToken(legacy), requestId: crypto.randomUUID() });
    expect((await loadQuoteByToken(s, legacy))?.quote.number).toBe("Q-LEGACY");
  });

  it("refuses anyone but the owner, and checks the numbers", async () => {
    const appt = await request();
    expect((await sendQuote(appt.id, {}, "")).status).toBe(401);
    const t = await ownerToken();
    expect((await sendQuote(appt.id, { discountCents: 999999 }, t)).status).toBe(422);
    expect((await sendQuote(appt.id, { lines: [{ label: "Free", amountCents: 0 }], discountCents: 0 }, t)).status).toBe(422);
    expect((await sendQuote(appt.id, { lines: [] }, t)).status).toBe(422);
    expect((await sendQuote(appt.id, { lines: Array.from({ length: 21 }, () => LINES[0]) }, t)).status).toBe(422);
    const odd = await sendQuote(appt.id, { lines: [{ label: "Line\nwith\tbreaks", amountCents: 1000 }], discountCents: 0 }, t);
    expect(odd.body.quote.lines[0]!.label).toBe("Line with breaks");
  });

  it("is applied once when the same send is retried, and a revised quote replaces the open one", async () => {
    const appt = await request("dana@example.com");
    const t = await ownerToken();
    const requestId = crypto.randomUUID();
    const first = await sendQuote(appt.id, { requestId }, t);
    const again = await sendQuote(appt.id, { requestId }, t);
    expect(again.body.unchanged).toBe(true);
    expect(again.body.quote.id).toBe(first.body.quote.id);
    expect((await outbox()).filter((m) => m.subject.startsWith("Your quote"))).toHaveLength(1);

    const oldToken = await linkTokenFor("dana@example.com");
    const revised = await sendQuote(appt.id, { discountCents: 5000 }, t);
    expect(revised.body.quote.totalCents).toBe(29900);
    const { acceptQuote, loadQuoteByToken } = await import("@/lib/quotes/service");
    const s = await store();
    expect((await loadQuoteByToken(s, oldToken))!.status).toBe("withdrawn");
    expect(await acceptQuote(s, oldToken)).toMatchObject({ ok: false });
    expect(await acceptQuote(s, await linkTokenFor("dana@example.com"))).toEqual({ ok: true });
  });

  it("only quotes a website request that is still waiting", async () => {
    const appt = await request();
    const t = await ownerToken();
    const s = await store();
    await s.updateAppointment(appt.id, { status: "confirmed" });
    const res = await sendQuote(appt.id, {}, t);
    expect(res.status).toBe(409);
  });
});

describe("the customer's answer", () => {
  it("accepting confirms the job at the quoted price, emails one confirmation, and tells the owner", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const { acceptQuote } = await import("@/lib/quotes/service");
    const s = await store();

    expect(await acceptQuote(s, token)).toEqual({ ok: true });
    const job = (await s.getAppointment(appt.id))!;
    expect(job).toMatchObject({ status: "confirmed", quotedPriceCents: 34900, discountCents: 2500, customerAgreed: true, holdExpiresAt: null });
    expect((await s.getLead(appt.leadId))!.stage).toBe("scheduled");
    const events = await s.listAppointmentEvents(appt.id);
    expect(events.some((e) => e.type === "status" && e.toStatus === "confirmed" && e.actor === "customer")).toBe(true);

    // Accepting again (double tap, back button) changes nothing and sends nothing more.
    expect(await acceptQuote(s, token)).toMatchObject({ ok: false });
    const mail = await outbox();
    expect(mail.filter((m) => m.to === "dana@example.com" && m.subject.includes("is confirmed"))).toHaveLength(1);
    expect(mail.filter((m) => m.to === "owner@example.com" && m.subject.includes("Quote accepted"))).toHaveLength(1);

    // The dashboard shows it as booked, with the quote accepted.
    const { getAppointmentDetail } = await import("@/lib/owner/appointments");
    const detail: AppointmentDetail = await getAppointmentDetail(s, appt.id);
    expect(detail).toMatchObject({ quoteStatus: "accepted", quote: { status: "accepted" }, quoteDraft: null });
    expect(detail.balance.totalCents).toBe(32400);
  });

  it("declining releases the time and passes the reason to the owner", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const { declineQuote } = await import("@/lib/quotes/service");
    const s = await store();
    expect(await declineQuote(s, token, "Need a\nweekend   instead")).toEqual({ ok: true });
    expect((await s.getAppointment(appt.id))!.status).toBe("declined");
    expect(await openSlot()).toBe(appt.startsAt);
    const alert = (await outbox()).find((m) => m.to === "owner@example.com" && m.subject.includes("Quote declined"))!;
    expect(alert.text).toContain("Their reason: Need a weekend instead");
  });

  it("can't be accepted after it expires", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const file = path.join(cwd, ".data", "demo-store.json");
    const data = JSON.parse(await fs.readFile(file, "utf8"));
    data.quotes[0].expiresAt = new Date(Date.now() - 60_000).toISOString();
    await fs.writeFile(file, JSON.stringify(data));
    const { acceptQuote, loadQuoteByToken } = await import("@/lib/quotes/service");
    const s = await store();
    expect((await loadQuoteByToken(s, token))!.status).toBe("expired");
    expect(await acceptQuote(s, token)).toMatchObject({ ok: false, message: expect.stringContaining("expired") });
    expect((await s.getAppointment(appt.id))!.status).toBe("held");
  });

  it("withdraws an open quote when you decline the request or move it", async () => {
    const { acceptQuote, loadQuoteByToken } = await import("@/lib/quotes/service");
    const { changeAppointmentStatus } = await import("@/lib/owner/appointments");
    const s = await store();

    const a = await request("first@example.com");
    await sendQuote(a.id);
    const t1 = await linkTokenFor("first@example.com");
    await changeAppointmentStatus(s, "owner@example.com", a.id, { to: "declined", reason: "Booked elsewhere", requestId: crypto.randomUUID() });
    expect((await loadQuoteByToken(s, t1))!.status).toBe("withdrawn");
    expect(await acceptQuote(s, t1)).toMatchObject({ ok: false });

    const b = await request("second@example.com");
    await sendQuote(b.id);
    const t2 = await linkTokenFor("second@example.com");
    const { rescheduleAppointment } = await import("@/lib/owner/work");
    const next = new Date(Date.parse(b.startsAt) + 7 * 86_400_000);
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(next);
    await rescheduleAppointment(s, "owner@example.com", b.id, { requestId: crypto.randomUUID(), date, time: "09:00", durationMinutes: 300, override: true, notifyCustomer: false });
    expect((await loadQuoteByToken(s, t2))!.status).toBe("withdrawn");
  });

  it("tells the customer, and undoes the acceptance, when the time is no longer held", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const s = await store();
    await s.updateAppointment(appt.id, { status: "cancelled" });
    const { acceptQuote, loadQuoteByToken } = await import("@/lib/quotes/service");
    expect(await acceptQuote(s, token)).toMatchObject({ ok: false, message: expect.stringContaining("no longer") });
    expect((await loadQuoteByToken(s, token))!.status).toBe("withdrawn");
  });

  it("the page's accept form needs the box ticked, and redirects back to the quote", async () => {
    const appt = await request("dana@example.com");
    await sendQuote(appt.id);
    const token = await linkTokenFor("dana@example.com");
    const { acceptQuoteAction } = await import("@/app/quote/[token]/actions");
    const form = (agree: boolean) => {
      const f = new FormData();
      f.append("token", token);
      if (agree) f.append("agree", "on");
      return f;
    };
    await expect(acceptQuoteAction(form(false))).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_REDIRECT;.*\?e=agree/) });
    expect((await (await store()).getAppointment(appt.id))!.status).toBe("held");
    await expect(acceptQuoteAction(form(true))).rejects.toMatchObject({ digest: expect.stringMatching(/NEXT_REDIRECT;.*\?done=accepted/) });
    expect((await (await store()).getAppointment(appt.id))!.status).toBe("confirmed");
  });

  it("Today lists the request with its quote status", async () => {
    const appt = await request();
    await sendQuote(appt.id);
    const { GET } = await import("@/app/api/owner/v1/summary/route");
    const summary = (await (await GET(new Request("http://localhost/api/owner/v1/summary", { headers: { authorization: `Bearer ${await ownerToken()}` } }))).json()) as TodaySummary;
    expect(summary.toConfirm.find((a) => a.id === appt.id)?.quoteStatus).toBe("sent");
  });
});

describe("the PDF", () => {
  it("renders whatever was typed, even characters the PDF font lacks", async () => {
    const { renderQuotePdf } = await import("@/lib/quotes/pdf");
    const bytes = await renderQuotePdf({
      number: "Q-TEST01",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      customer: { name: "José Ñúñez 😀", email: "a@example.com", phone: "9045550101", address: "1 Calle Mayor, 東京" },
      appointment: { startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(), serviceName: "Signature Full Detail", vehicle: "2019 Toyota 4Runner" },
      lines: Array.from({ length: 20 }, (_, i) => ({ label: `Line ${i + 1} — “quoted” ${"long text ".repeat(i % 4)}`, amountCents: 1000 * (i + 1) })),
      subtotalCents: 210000,
      discountCents: 0,
      totalCents: 210000,
      notes: "Se habla español.\nSecond line with ✓ and 🚗.",
      acceptUrl: "https://corsaautodetailing.com/quote/" + "A".repeat(43),
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    // Twenty lines don't fit on one page: it continues on a second.
    const { PDFDocument } = await import("pdf-lib");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
