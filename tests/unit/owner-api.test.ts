import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppointmentDetail, SessionTokens, StatusChangeResponse, TodaySummary } from "@shared/api";

/**
 * Owner API (`/api/owner/v1`) against the demo store and demo auth, in a temp
 * working directory so the real .data folder is never touched. Route handlers
 * are called directly with Request objects, exactly as Next calls them.
 */

const PASSWORD = "test-owner-password";
const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-api-"));
  process.cwd = () => cwd;
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAILS"]) {
    delete process.env[k];
  }
  process.env.DEMO_ADMIN_PASSWORD = PASSWORD;
  const [{ resetLeadStoreCache }, { resetRateLimits }] = await Promise.all([import("@/lib/leads/store"), import("@/lib/rate-limit")]);
  resetLeadStoreCache();
  resetRateLimits();
});

afterEach(async () => {
  process.cwd = originalCwd;
  delete process.env.DEMO_ADMIN_PASSWORD;
  await fs.rm(cwd, { recursive: true, force: true });
});

const routes = async () => ({
  session: await import("@/app/api/owner/v1/session/route"),
  refresh: await import("@/app/api/owner/v1/session/refresh/route"),
  me: await import("@/app/api/owner/v1/me/route"),
  summary: await import("@/app/api/owner/v1/summary/route"),
  list: await import("@/app/api/owner/v1/appointments/route"),
  detail: await import("@/app/api/owner/v1/appointments/[id]/route"),
  status: await import("@/app/api/owner/v1/appointments/[id]/status/route"),
});

const url = (p: string) => `http://localhost/api/owner/v1${p}`;
const req = (p: string, init: Omit<RequestInit, "body"> & { token?: string; body?: unknown } = {}) => {
  const headers = new Headers(init.headers);
  if (init.token) headers.set("authorization", `Bearer ${init.token}`);
  if (init.body !== undefined) headers.set("content-type", "application/json");
  return new Request(url(p), {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
  });
};
const params = <P,>(p: P) => ({ params: Promise.resolve(p) });

async function signIn(): Promise<SessionTokens> {
  const { session } = await routes();
  const res = await session.POST(req("/session", { method: "POST", body: { email: "owner@example.com", password: PASSWORD } }));
  expect(res.status).toBe(200);
  return (await res.json()) as SessionTokens;
}

/** A booked lead + confirmed appointment today, created straight in the demo store. */
async function seedAppointment(startsInMinutes = 60) {
  const { getLeadStore } = await import("@/lib/leads/store");
  const store = (await getLeadStore())!;
  const { lead } = await store.createLead({
    leadType: "quote_request",
    businessMode: "LIVE",
    idempotencyKey: crypto.randomUUID(),
    firstName: "Riley",
    lastName: "Stone",
    email: "riley@example.com",
    phone: "9045550101",
    preferredContact: "text",
    vehicleCategory: null,
    vehicleYear: 2021,
    vehicleMake: "Toyota",
    vehicleModel: "Tacoma",
    serviceId: "platinum-full",
    membershipCadence: null,
    futureInterests: [],
    condition: "normal",
    conditionFlags: [],
    concerns: null,
    zip: "32068",
    zipEligibility: "core",
    city: "Middleburg",
    serviceAddress: "45 Oak Ln",
    locationType: "home",
    timeWindows: [],
    preferredDate: null,
    notes: null,
    message: null,
    estimate: null,
    pricingVersion: "test",
    consent: { serviceTextVersion: "v1", serviceAcceptedAt: new Date().toISOString(), marketingEmail: false, marketingTextVersion: null, marketingAcceptedAt: null },
    source: { landingPath: null, referrer: null, utmSource: null, utmMedium: null, utmCampaign: null },
    photoRefs: [],
  });
  const start = new Date(Date.now() + startsInMinutes * 60_000);
  const appt = await store.createAppointment({
    leadId: lead.id,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 180 * 60_000).toISOString(),
    status: "confirmed",
    quotedPriceCents: 29900,
    customerAgreed: true,
    completedRevenueCents: null,
    notes: null,
    source: "owner",
    serviceId: "platinum-full",
    depositCents: null,
    depositStatus: "none",
    checkoutSessionId: null,
    paymentIntentId: null,
    holdExpiresAt: null,
    bufferMinutes: 45,
  });
  return { store, lead, appt };
}

describe("owner API authorization", () => {
  it("refuses every protected endpoint without a token", async () => {
    const r = await routes();
    const id = crypto.randomUUID();
    const responses = await Promise.all([
      r.me.GET(req("/me")),
      r.summary.GET(req("/summary")),
      r.list.GET(req("/appointments")),
      r.detail.GET(req(`/appointments/${id}`), params({ id })),
      r.status.POST(req(`/appointments/${id}/status`, { method: "POST", body: { to: "en_route", requestId: crypto.randomUUID() } }), params({ id })),
      r.session.DELETE(req("/session", { method: "DELETE" })),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unauthorized");
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
  });

  it("refuses forged, tampered and refresh tokens used as access tokens", async () => {
    const { me } = await routes();
    const tokens = await signIn();
    const [prefix, exp] = tokens.accessToken.split(".");
    for (const token of [
      "not-a-token",
      `${prefix}.${exp}.${"0".repeat(64)}`,
      `${prefix}.${Number(exp) + 999999}.${tokens.accessToken.split(".")[2]}`,
      tokens.refreshToken,
    ]) {
      expect((await me.GET(req("/me", { token }))).status, token).toBe(401);
    }
    expect((await me.GET(req("/me", { headers: { authorization: `Basic ${tokens.accessToken}` } }))).status).toBe(401);
  });

  it("signs in, reads /me, refreshes, and rejects a wrong password with a generic message", async () => {
    const r = await routes();
    const bad = await r.session.POST(req("/session", { method: "POST", body: { email: "owner@example.com", password: "nope" } }));
    expect(bad.status).toBe(401);
    expect(((await bad.json()) as { error: { message: string } }).error.message).toBe("Sign-in failed. Check your email and password.");

    const tokens = await signIn();
    const me = await r.me.GET(req("/me", { token: tokens.accessToken }));
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ role: "owner", business: { timeZone: "America/New_York" } });

    const refreshed = await r.refresh.POST(req("/session/refresh", { method: "POST", body: { refreshToken: tokens.refreshToken } }));
    expect(refreshed.status).toBe(200);
    const rejected = await r.refresh.POST(req("/session/refresh", { method: "POST", body: { refreshToken: tokens.accessToken } }));
    expect(rejected.status).toBe(401);
  });

  it("rate-limits repeated sign-in attempts", async () => {
    const { session } = await routes();
    const attempt = () => session.POST(req("/session", { method: "POST", body: { email: "x@example.com", password: "wrong" } }));
    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(401);
    const limited = await attempt();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("rejects malformed input instead of passing it on", async () => {
    const r = await routes();
    const { accessToken } = await signIn();
    expect((await r.session.POST(req("/session", { method: "POST", body: "{not json" }))).status).toBe(422);
    expect((await r.detail.GET(req("/appointments/../../leads", { token: accessToken }), params({ id: "../../leads" }))).status).toBe(404);
    expect((await r.list.GET(req("/appointments?status=bogus", { token: accessToken }))).status).toBe(422);
    expect((await r.list.GET(req("/appointments?limit=5000", { token: accessToken }))).status).toBe(422);
  });
});

describe("owner API appointments", () => {
  it("returns today's job in the summary with its money", async () => {
    const r = await routes();
    const { accessToken } = await signIn();
    const { appt } = await seedAppointment(1);
    const res = await r.summary.GET(req("/summary", { token: accessToken }));
    expect(res.status).toBe(200);
    const s = (await res.json()) as TodaySummary;
    // The seeded job starts a minute from now, so it's today unless the test runs at 11:59pm Eastern.
    if (s.timeline.length > 0) {
      expect(s.today.jobs).toBe(1);
      expect(s.today.bookedCents).toBe(29900);
      expect(s.today.outstandingCents).toBe(29900);
    }
    expect(s.focus?.id).toBe(appt.id);
    expect(s.focus?.customerName).toBe("Riley Stone");
  });

  it("lists and pages appointments", async () => {
    const r = await routes();
    const { accessToken } = await signIn();
    await seedAppointment(60);
    await seedAppointment(60 * 24);
    const first = await r.list.GET(req("/appointments?limit=1", { token: accessToken }));
    const page1 = (await first.json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(page1.items).toHaveLength(1);
    expect(page1.nextCursor).not.toBeNull();
    const second = await r.list.GET(req(`/appointments?limit=1&cursor=${encodeURIComponent(page1.nextCursor!)}`, { token: accessToken }));
    const page2 = (await second.json()) as { items: { id: string }[]; nextCursor: string | null };
    expect(page2.items).toHaveLength(1);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
    expect(page2.nextCursor).toBeNull();
  });

  it("moves through the workflow, records history once per tap, and refuses invalid steps", async () => {
    const r = await routes();
    const { accessToken } = await signIn();
    const { appt, store } = await seedAppointment();
    const post = (body: unknown) =>
      r.status.POST(req(`/appointments/${appt.id}/status`, { method: "POST", token: accessToken, body }), params({ id: appt.id }));

    const tap = crypto.randomUUID();
    const enRoute = await post({ to: "en_route", requestId: tap });
    expect(enRoute.status).toBe(200);
    const body = (await enRoute.json()) as StatusChangeResponse;
    expect(body).toMatchObject({ unchanged: false, appointment: { status: "en_route" } });
    expect(body.appointment.allowedTransitions).toContain("arrived");

    // Same tap retried (flaky network): applied once.
    const retry = (await (await post({ to: "en_route", requestId: tap })).json()) as StatusChangeResponse;
    expect(retry.unchanged).toBe(true);
    expect((await store.listAppointmentEvents(appt.id)).filter((e) => e.toStatus === "en_route")).toHaveLength(1);

    const skip = await post({ to: "completed", requestId: crypto.randomUUID() });
    expect(skip.status).toBe(409);

    const noReason = await post({ to: "cancelled", cancelledBy: "customer", requestId: crypto.randomUUID() });
    expect(noReason.status).toBe(422);

    for (const to of ["arrived", "in_progress", "completed"]) {
      expect((await post({ to, requestId: crypto.randomUUID() })).status, to).toBe(200);
    }
    const detail = (await (await r.detail.GET(req(`/appointments/${appt.id}`, { token: accessToken }), params({ id: appt.id }))).json()) as AppointmentDetail;
    expect(detail.status).toBe("completed");
    expect(detail.allowedTransitions).toEqual([]);
    expect(detail.events.map((e) => e.toStatus)).toEqual(["en_route", "arrived", "in_progress", "completed"]);
    expect(detail.events.every((e) => e.actor === "demo-owner@localhost")).toBe(true);
    expect((await store.getLead(appt.leadId))?.stage).toBe("completed");
  });

  it("returns 404 for an appointment that doesn't exist", async () => {
    const r = await routes();
    const { accessToken } = await signIn();
    const id = crypto.randomUUID();
    expect((await r.detail.GET(req(`/appointments/${id}`, { token: accessToken }), params({ id }))).status).toBe(404);
  });
});
