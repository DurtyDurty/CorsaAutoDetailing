import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { mergeTouch, parseStoredTouch, touchFromUrl, isGoogleAds, type Touch } from "@/lib/attribution";
import { deriveConversions, planUploads, type ConversionAppointment, type ConversionLead } from "@/lib/ads/conversions";
import { dataManagerConfig, ingest, ingestBody, type DataManagerConfig } from "@/lib/ads/data-manager";
import { leadSource } from "@/lib/leads/intake";
import type { LeadRecord, NewLead } from "@/lib/leads/types";

const GCLID = "Cj0KCQjw_test-click-id_123";
const NOW = new Date("2026-10-10T15:00:00Z");

/* ---------- Attribution capture ---------- */

describe("touchFromUrl", () => {
  it("keeps campaign tags and click ids, nothing else from the query", () => {
    const t = touchFromUrl(
      `https://corsaautodetailing.com/service-areas/middleburg?utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=mobile+detailing&gclid=${GCLID}&email=sam@example.com&phone=9045550100`,
      "https://www.google.com/",
      NOW,
    )!;
    expect(t).toMatchObject({
      landingPath: "/service-areas/middleburg",
      referrer: "www.google.com",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "launch",
      utmTerm: "mobile detailing",
      gclid: GCLID,
      clickSeenAt: NOW.toISOString(),
    });
    expect(JSON.stringify(t)).not.toMatch(/example\.com|9045550100/);
  });

  it("drops tags that carry contact details and click ids that aren't tokens", () => {
    const t = touchFromUrl("https://x.test/?utm_campaign=sam@example.com&utm_content=904-555-0100&gclid=<script>", null, NOW)!;
    expect(t.utmCampaign).toBeNull();
    expect(t.utmContent).toBeNull();
    expect(t.gclid).toBeNull();
    expect(t.clickSeenAt).toBeNull();
  });

  it("ignores a referrer from our own site", () => {
    expect(touchFromUrl("https://corsaautodetailing.com/request", "https://corsaautodetailing.com/services", NOW)!.referrer).toBeNull();
  });
});

describe("mergeTouch (first touch kept, newest ad click wins)", () => {
  const first = touchFromUrl("https://x.test/?utm_source=nextdoor&utm_medium=social", "https://nextdoor.com/", new Date("2026-10-01T12:00:00Z"))!;

  it("keeps the first touch on later visits", () => {
    const later = touchFromUrl("https://x.test/services?utm_source=flyer", null, NOW);
    expect(mergeTouch(first, later, NOW)).toEqual(first);
  });

  it("adds a later Google ad click without rewriting the first touch", () => {
    const click = touchFromUrl(`https://x.test/?gclid=${GCLID}`, null, NOW);
    const m = mergeTouch(first, click, NOW)!;
    expect(m.utmSource).toBe("nextdoor");
    expect(m.firstSeenAt).toBe(first.firstSeenAt);
    expect(m.gclid).toBe(GCLID);
    expect(m.clickSeenAt).toBe(NOW.toISOString());
  });

  it("discards touches older than 90 days", () => {
    const old: Touch = { ...first, firstSeenAt: "2026-06-01T00:00:00Z" };
    expect(mergeTouch(old, null, NOW)).toBeNull();
  });

  it("rejects malformed stored values", () => {
    expect(parseStoredTouch("not json")).toBeNull();
    expect(parseStoredTouch(JSON.stringify({ gclid: GCLID }))).toBeNull();
    expect(parseStoredTouch(JSON.stringify({ firstSeenAt: NOW.toISOString(), gclid: "bad id!", utmSource: "a@b.co" }))).toMatchObject({ gclid: null, utmSource: null });
  });
});

describe("leadSource (server re-cleans what the browser sent)", () => {
  it("stores path, host, tags, click id and first-seen time", () => {
    const s = leadSource(
      { landingPath: "/request?email=a@b.co", referrer: "www.google.com", utmSource: "google", utmMedium: "cpc", utmCampaign: "c", gclid: GCLID, firstSeenAt: "2026-10-09T12:00:00Z", clickSeenAt: "2026-10-09T12:00:00Z" },
      NOW,
    );
    expect(s).toMatchObject({ landingPath: "/request", referrer: "www.google.com", gclid: GCLID, firstSeenAt: "2026-10-09T12:00:00.000Z", clickSeenAt: "2026-10-09T12:00:00.000Z" });
  });

  it("drops timestamps outside the 90-day window or in the future, and click time without a click", () => {
    const s = leadSource({ landingPath: null, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, firstSeenAt: "2026-01-01T00:00:00Z", clickSeenAt: "2026-10-09T00:00:00Z" }, NOW);
    expect(s.firstSeenAt).toBeNull();
    expect(s.clickSeenAt).toBeNull();
    expect(leadSource({ landingPath: null, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, firstSeenAt: "2027-01-01T00:00:00Z" }, NOW).firstSeenAt).toBeNull();
  });

  it("recognises Google Ads by click id or paid Google tags", () => {
    expect(isGoogleAds({ gclid: GCLID })).toBe(true);
    expect(isGoogleAds({ utmSource: "google", utmMedium: "cpc" })).toBe(true);
    expect(isGoogleAds({ utmSource: "google", utmMedium: "organic" })).toBe(false);
  });
});

/* ---------- Conversion rules ---------- */

const clickLead = (over: Partial<ConversionLead> = {}): ConversionLead => ({
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-10-05T14:00:00Z",
  leadType: "quote_request",
  stage: "new",
  source: { landingPath: "/request", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, gclid: GCLID, clickSeenAt: "2026-10-05T13:50:00Z", firstSeenAt: "2026-10-05T13:50:00Z" },
  ...over,
});
const appt = (over: Partial<ConversionAppointment> = {}): ConversionAppointment => ({
  id: "a1",
  leadId: clickLead().id,
  status: "confirmed",
  createdAt: "2026-10-05T14:00:00Z",
  confirmedAt: "2026-10-05T18:00:00Z",
  totalCents: 29900,
  collectedCents: 0,
  firstPaidAt: null,
  ...over,
});

describe("deriveConversions", () => {
  it("ignores leads that didn't come from a Google ad click", () => {
    const l = clickLead({ source: { landingPath: "/", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null } });
    expect(deriveConversions([l], [appt()]).events).toEqual([]);
  });

  it("a held request is an inquiry, not a booking; declined never books", () => {
    for (const status of ["held", "declined", "cancelled"] as const) {
      const kinds = deriveConversions([clickLead()], [appt({ status, confirmedAt: null })]).events.map((e) => e.kind);
      expect(kinds).toEqual(["inquiry"]);
    }
  });

  it("a confirmed job is one booking per customer, valued at the price after discount", () => {
    const ev = deriveConversions([clickLead()], [appt(), appt({ id: "a2", confirmedAt: "2026-11-01T12:00:00Z", totalCents: 12500 })]).events;
    const bookings = ev.filter((e) => e.kind === "booking");
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({ transactionId: `booking-${clickLead().id}`, appointmentId: "a1", valueCents: 29900, eventAt: "2026-10-05T18:00:00Z" });
  });

  it("deposit plus final payment is one paying customer with the total collected", () => {
    const ev = deriveConversions([clickLead()], [appt({ status: "completed", collectedCents: 29900, firstPaidAt: "2026-10-08T20:00:00Z" })]).events;
    const paid = ev.filter((e) => e.kind === "paid");
    expect(paid).toHaveLength(1);
    expect(paid[0]).toMatchObject({ transactionId: `paid-${clickLead().id}`, valueCents: 29900, eventAt: "2026-10-08T20:00:00Z" });
  });

  it("nothing collected (or fully refunded) is not a paying customer", () => {
    const ev = deriveConversions([clickLead()], [appt({ status: "completed", collectedCents: 0, firstPaidAt: null })]).events;
    expect(ev.some((e) => e.kind === "paid")).toBe(false);
  });

  it("never dates a conversion before its click, and skips ones past 90 days", () => {
    const early = deriveConversions([clickLead({ createdAt: "2026-10-05T13:00:00Z" })], []).events[0];
    expect(early.eventAt).toBe("2026-10-05T13:50:00Z");
    const late = deriveConversions([clickLead()], [appt({ confirmedAt: "2027-02-01T00:00:00Z" })]);
    expect(late.events.some((e) => e.kind === "booking")).toBe(false);
    expect(late.skipped[0]).toMatchObject({ kind: "booking" });
  });

  it("spam leads never convert", () => {
    expect(deriveConversions([clickLead({ stage: "spam" })], [appt()]).events).toEqual([]);
  });
});

describe("planUploads (safe reruns)", () => {
  const { events } = deriveConversions([clickLead()], [appt({ status: "completed", collectedCents: 29900, firstPaidAt: "2026-10-08T20:00:00Z" })]);
  const id = (k: string) => `${k}-${clickLead().id}`;

  it("sends everything new, only for configured conversion actions", () => {
    expect(planUploads(events, [], ["booking"]).map((p) => p.event.kind)).toEqual(["booking"]);
    expect(planUploads(events, [], ["booking", "paid", "inquiry"])).toHaveLength(3);
  });

  it("skips what was sent, retries failures, re-sends a changed value as an adjustment", () => {
    const ledger = [
      { transactionId: id("inquiry"), status: "sent" as const, valueCents: 0 },
      { transactionId: id("booking"), status: "sent" as const, valueCents: 29900 },
      { transactionId: id("paid"), status: "sent" as const, valueCents: 12500 },
    ];
    expect(planUploads(events, ledger, ["booking", "paid", "inquiry"]).map((p) => [p.event.kind, p.reason])).toEqual([["paid", "adjust"]]);
    const failed = [{ transactionId: id("booking"), status: "failed" as const, valueCents: 29900 }];
    expect(planUploads(events, failed, ["booking"]).map((p) => p.reason)).toEqual(["retry"]);
  });
});

/* ---------- Data Manager request ---------- */

const cfg: DataManagerConfig = {
  mode: "on",
  customerId: "1234567890",
  loginCustomerId: null,
  clientId: "cid",
  clientSecret: "secret",
  refreshToken: "refresh",
  actions: { booking: "111", paid: "222" },
};

describe("Data Manager request", () => {
  const booking = deriveConversions([clickLead()], [appt()]).events.find((e) => e.kind === "booking")!;

  it("sends the click id, value in dollars and transaction id, and no personal data", () => {
    const body = ingestBody(booking, cfg, true);
    expect(body).toEqual({
      destinations: [{ operatingAccount: { accountType: "GOOGLE_ADS", accountId: "1234567890" }, productDestinationId: "111" }],
      events: [
        {
          transactionId: `booking-${clickLead().id}`,
          eventTimestamp: "2026-10-05T18:00:00.000Z",
          eventSource: "WEB",
          adIdentifiers: { gclid: GCLID },
          conversionValue: 299,
          currency: "USD",
        },
      ],
      validateOnly: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/userData|email|phone/i);
    expect(ingestBody(booking, { ...cfg, loginCustomerId: "999" }, false).destinations[0]).toMatchObject({ loginAccount: { accountType: "GOOGLE_ADS", accountId: "999" } });
  });

  it("is off unless explicitly enabled and fully configured", () => {
    expect(dataManagerConfig({})).toBeNull();
    const full = { GOOGLE_ADS_CUSTOMER_ID: "123-456-7890", GOOGLE_ADS_CLIENT_ID: "a", GOOGLE_ADS_CLIENT_SECRET: "b", GOOGLE_ADS_REFRESH_TOKEN: "c", GOOGLE_ADS_CONVERSION_BOOKING: "111" };
    expect(dataManagerConfig(full)).toBeNull();
    expect(dataManagerConfig({ ...full, GOOGLE_ADS_CONVERSION_UPLOADS: "validate" })).toMatchObject({ mode: "validate", customerId: "1234567890" });
  });

  it("retries rate limits, not bad requests", async () => {
    let calls = 0;
    const flaky = (async () => (++calls < 2 ? new Response("{}", { status: 429 }) : Response.json({ requestId: "r1" }))) as typeof fetch;
    expect(await ingest({}, "t", flaky)).toBe("r1");
    expect(calls).toBe(2);
    calls = 0;
    const bad = (async () => {
      calls++;
      return Response.json({ error: { status: "INVALID_ARGUMENT", message: "bad gclid" } }, { status: 400 });
    }) as typeof fetch;
    await expect(ingest({}, "t", bad)).rejects.toThrow(/INVALID_ARGUMENT/);
    expect(calls).toBe(1);
  });
});

/* ---------- Upload runner against the demo store ---------- */

const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-ads-"));
  process.cwd = () => cwd;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  (await import("@/lib/leads/store")).resetLeadStoreCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await fs.rm(cwd, { recursive: true, force: true });
});

const store = async () => (await (await import("@/lib/leads/store")).getLeadStore())!;

function newLead(source: NewLead["source"]): NewLead {
  return {
    leadType: "quote_request",
    businessMode: "LIVE",
    idempotencyKey: crypto.randomUUID(),
    firstName: "Sam",
    lastName: null,
    email: `${crypto.randomUUID()}@example.com`,
    phone: null,
    preferredContact: null,
    vehicleCategory: null,
    vehicleYear: null,
    vehicleMake: null,
    vehicleModel: null,
    serviceId: "platinum-full",
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
    consent: { serviceTextVersion: "v1", serviceAcceptedAt: "2026-10-01T12:00:00Z", marketingEmail: false, marketingTextVersion: null, marketingAcceptedAt: null },
    source,
    photoRefs: [],
  };
}

/** Fake Google: records each ingest body. */
function fakeGoogle(fail?: (body: { events: { transactionId: string }[] }) => boolean) {
  const bodies: { validateOnly: boolean; events: { transactionId: string; conversionValue: number }[] }[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes("oauth2")) return Response.json({ access_token: "tok" });
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    if (fail?.(body)) return Response.json({ error: { status: "INVALID_ARGUMENT", message: "nope" } }, { status: 400 });
    return Response.json({ requestId: `req-${bodies.length}` });
  }) as typeof fetch;
  return { f, bodies };
}

async function seed() {
  const s = await store();
  const recent = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { lead } = await s.createLead(newLead({ landingPath: "/request", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, gclid: GCLID, clickSeenAt: recent, firstSeenAt: recent }));
  await s.createLead(newLead({ landingPath: "/request", referrer: "www.google.com", utmSource: null, utmMedium: null, utmCampaign: null }));
  const a = await s.createAppointment({
    leadId: lead.id,
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 86_400_000 + 3 * 3600_000).toISOString(),
    status: "held",
    quotedPriceCents: 29900,
    customerAgreed: true,
    completedRevenueCents: null,
    notes: null,
    source: "online",
    serviceId: "platinum-full",
    depositCents: null,
    depositStatus: "none",
    checkoutSessionId: null,
    paymentIntentId: null,
    holdExpiresAt: new Date(Date.now() + 48 * 3600_000).toISOString(),
    bufferMinutes: 45,
  });
  return { s, lead: lead as LeadRecord, a };
}

describe("uploadConversions", () => {
  it("does nothing until configured", async () => {
    const { uploadConversions } = await import("@/lib/ads/upload");
    const { s } = await seed();
    const r = await uploadConversions(s, { config: null });
    expect(r).toMatchObject({ mode: "unconfigured", sent: 0 });
  });

  it("validate mode asks Google to check only and records nothing", async () => {
    const { uploadConversions } = await import("@/lib/ads/upload");
    const { s, a } = await seed();
    await s.updateAppointment(a.id, { status: "confirmed" });
    await s.addAppointmentEvent({ appointmentId: a.id, type: "status", fromStatus: "held", toStatus: "confirmed", note: null, actor: "owner", requestId: null });
    const g = fakeGoogle();
    const r = await uploadConversions(s, { config: { ...cfg, mode: "validate" }, fetchImpl: g.f });
    expect(r.sent).toBe(1);
    expect(g.bodies.every((b) => b.validateOnly)).toBe(true);
    expect(await s.listAdConversions()).toEqual([]);
  });

  it("a held request isn't a booking; once confirmed it's sent once; payment adds one paying customer", async () => {
    const { uploadConversions } = await import("@/lib/ads/upload");
    const { s, a } = await seed();
    const g = fakeGoogle();

    expect((await uploadConversions(s, { config: cfg, fetchImpl: g.f })).sent).toBe(0);

    await s.updateAppointment(a.id, { status: "confirmed" });
    await s.addAppointmentEvent({ appointmentId: a.id, type: "status", fromStatus: "held", toStatus: "confirmed", note: null, actor: "owner", requestId: null });
    const first = await uploadConversions(s, { config: cfg, fetchImpl: g.f });
    expect(first.planned.map((p) => [p.kind, p.reason])).toEqual([["booking", "new"]]);
    expect(g.bodies.at(-1)!.validateOnly).toBe(false);

    // Rerun: nothing new to send.
    expect((await uploadConversions(s, { config: cfg, fetchImpl: g.f })).planned).toEqual([]);

    // Deposit then balance: still one paying customer, value updated under the same id.
    await s.recordPayment({ appointmentId: a.id, kind: "deposit", method: "digital", amountCents: 5000, note: null, providerRef: null, recordedBy: "owner", requestId: null });
    const paid1 = await uploadConversions(s, { config: cfg, fetchImpl: g.f });
    expect(paid1.planned.map((p) => [p.kind, p.reason, p.valueCents])).toEqual([["paid", "new", 5000]]);
    await s.recordPayment({ appointmentId: a.id, kind: "balance", method: "cash", amountCents: 24900, note: null, providerRef: null, recordedBy: "owner", requestId: null });
    const paid2 = await uploadConversions(s, { config: cfg, fetchImpl: g.f });
    expect(paid2.planned.map((p) => [p.kind, p.reason, p.valueCents])).toEqual([["paid", "adjust", 29900]]);
    expect(g.bodies.at(-1)!.events[0].conversionValue).toBe(299);

    const ledger = await s.listAdConversions();
    expect(ledger.map((r) => r.kind).sort()).toEqual(["booking", "paid"]);
    expect(JSON.stringify(ledger)).not.toMatch(/example\.com|Sam/);
  });

  it("records a failure and retries it next run", async () => {
    const { uploadConversions } = await import("@/lib/ads/upload");
    const { s, a } = await seed();
    await s.updateAppointment(a.id, { status: "confirmed" });
    await s.addAppointmentEvent({ appointmentId: a.id, type: "status", fromStatus: "held", toStatus: "confirmed", note: null, actor: "owner", requestId: null });
    const bad = fakeGoogle(() => true);
    const r = await uploadConversions(s, { config: cfg, fetchImpl: bad.f });
    expect(r.failed).toHaveLength(1);
    expect((await s.listAdConversions())[0]).toMatchObject({ status: "failed", attempts: 1 });
    const ok = fakeGoogle();
    const again = await uploadConversions(s, { config: cfg, fetchImpl: ok.f });
    expect(again.planned.map((p) => p.reason)).toEqual(["retry"]);
    expect((await s.listAdConversions())[0]).toMatchObject({ status: "sent", attempts: 2 });
  });
});

describe("dashboard Google Ads cohort", () => {
  it("counts ad leads, bookings, paying customers and collected revenue from records", async () => {
    const { computeAnalytics } = await import("@/lib/owner/analytics");
    const { s, a } = await seed();
    await s.updateAppointment(a.id, { status: "confirmed" });
    await s.recordPayment({ appointmentId: a.id, kind: "balance", method: "cash", amountCents: 29900, note: null, providerRef: null, recordedBy: "owner", requestId: null });
    const an = await computeAnalytics(s, "30d");
    expect(an.googleAds).toMatchObject({ leads: 1, bookings: 1, payingCustomers: 1, revenueCents: 29900 });
    expect(an.sources.find((r) => r.label === "Google Ads")?.count).toBe(1);
    expect(an.sources.find((r) => r.label === "Google")?.count).toBe(1);
  });
});
