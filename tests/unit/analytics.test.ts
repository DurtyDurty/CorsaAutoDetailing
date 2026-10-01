import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { LeadRecord, NewLead } from "@/lib/leads/types";

/** Dashboard analytics against the demo store, with fixed dates. */

const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-an-"));
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

function lead(overrides: Partial<NewLead> = {}): NewLead {
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
    source: { landingPath: "/request", referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    photoRefs: [],
    ...overrides,
  };
}

async function job(l: LeadRecord, startsAt: string, status: "confirmed" | "completed" | "cancelled", cents: number, serviceId = "platinum-full") {
  const s = await store();
  const appt = await s.createAppointment({
    leadId: l.id,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + 3 * 3600_000).toISOString(),
    status: status === "cancelled" ? "confirmed" : status,
    quotedPriceCents: cents,
    customerAgreed: true,
    completedRevenueCents: status === "completed" ? cents : null,
    notes: null,
    source: "owner",
    serviceId,
    depositCents: null,
    depositStatus: "none",
    checkoutSessionId: null,
    paymentIntentId: null,
    holdExpiresAt: null,
    bufferMinutes: 45,
  });
  if (status === "cancelled") await s.updateAppointment(appt.id, { status: "cancelled" });
  return appt;
}

describe("sourceLabel", () => {
  it("names where a request came from", async () => {
    const { sourceLabel } = await import("@/lib/owner/analytics");
    const src = (s: Partial<LeadRecord["source"]>) => sourceLabel({ source: { landingPath: null, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null, ...s } });
    expect(src({ referrer: "https://www.google.com/" })).toBe("Google");
    expect(src({ utmSource: "instagram" })).toBe("Facebook / Instagram");
    expect(src({ referrer: "https://l.facebook.com/" })).toBe("Facebook / Instagram");
    expect(src({ landingPath: "owner-app" })).toBe("Booked in the app");
    expect(src({ landingPath: "email-reply" })).toBe("Emailed in");
    expect(src({ referrer: "https://corsaautodetailing.com/services" })).toBe("Direct / typed in");
    expect(src({})).toBe("Direct / typed in");
    expect(src({ utmSource: "flyer" })).toBe("Campaign: flyer");
  });
});

describe("computeAnalytics", () => {
  // Wed Oct 21 2026, 3 PM Eastern.
  const NOW = new Date("2026-10-21T19:00:00Z");

  it("adds up booked and collected revenue, conversion and the funnel for the period", async () => {
    const { computeAnalytics } = await import("@/lib/owner/analytics");
    const s = await store();
    const google = (await s.createLead(lead({ source: { landingPath: "/request", referrer: "https://www.google.com/", utmSource: null, utmMedium: null, utmCampaign: null } }))).lead;
    const direct = (await s.createLead(lead())).lead;
    await s.createLead(lead()); // a request that never booked
    await job(google, "2026-10-12T14:00:00Z", "completed", 29900);
    await job(direct, "2026-10-23T14:00:00Z", "confirmed", 17900, "signature-full");
    await job((await s.createLead(lead({ leadType: "contact", serviceId: null }))).lead, "2026-10-14T14:00:00Z", "cancelled", 12500);

    const a = await computeAnalytics(s, "30d", NOW);
    // The period looks back to today: the Oct 23 job is future work, counted in "next 7 days".
    expect(a.bookedCents.value).toBe(29900);
    expect(a.collectedCents.value).toBe(29900);
    expect(a.completedJobs.value).toBe(1);
    expect(a.avgTicketCents.value).toBe(29900);
    // Conversion counts a request as booked whenever its job is, including upcoming ones.
    expect(a.conversion).toMatchObject({ requests: 3, booked: 2 });
    expect(a.conversion.rate).toBeCloseTo(2 / 3);
    expect(a.funnel.map((f) => f.count)).toEqual([3, 2, 1]);
    expect(a.lostRate).toMatchObject({ lost: 1, total: 2 });
    expect(a.next7).toEqual({ cents: 17900, jobs: 1 });
    expect(a.services).toEqual([{ label: "Signature Full Detail", count: 1, cents: 29900 }]);
    expect(a.sources.find((r) => r.label === "Google")?.count).toBe(1);

    // Weekly series: Oct 12 falls in the week of Oct 12; the week of Oct 19 is current.
    expect(a.series.unit).toBe("week");
    expect(a.series.points.find((p) => p.current)?.title).toBe("Week of Oct 19");
    expect(a.series.points.find((p) => p.title === "Week of Oct 12")?.valueCents).toBe(29900);
    expect(a.series.points.reduce((n, p) => n + p.valueCents, 0)).toBe(a.bookedCents.value);
  });

  it("compares with the previous period and leaves rates empty with no data", async () => {
    const { computeAnalytics } = await import("@/lib/owner/analytics");
    const s = await store();
    const empty = await computeAnalytics(s, "30d", NOW);
    expect(empty.conversion.rate).toBeNull();
    expect(empty.lostRate.rate).toBeNull();
    expect(empty.series.points.every((p) => p.valueCents === 0)).toBe(true);

    const l = (await s.createLead(lead())).lead;
    await job(l, "2026-09-10T14:00:00Z", "completed", 20000); // previous 30 days
    const a = await computeAnalytics(s, "30d", NOW);
    expect(a.bookedCents).toEqual({ value: 0, previous: 20000 });

    const year = await computeAnalytics(s, "year", NOW);
    expect(year.series.unit).toBe("month");
    expect(year.series.points).toHaveLength(10);
    expect(year.series.points.at(-1)).toMatchObject({ label: "Oct", current: true });
    expect(year.series.points.find((p) => p.label === "Sep")?.valueCents).toBe(20000);
  });
});
