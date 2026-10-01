import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SessionTokens, StatusChangeResponse, TodaySummary } from "@shared/api";

/**
 * Deposits off, LIVE: the website calendar holds a picked time for the owner
 * to confirm or decline in the app. Demo store + demo outbox in a temp dir.
 */

process.env.NEXT_PUBLIC_BUSINESS_MODE = "LIVE";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }) }));

const PASSWORD = "test-owner-password";
const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-cal-"));
  process.cwd = () => cwd;
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAILS", "RESEND_API_KEY", "STRIPE_SECRET_KEY"]) {
    delete process.env[k];
  }
  process.env.DEMO_ADMIN_PASSWORD = PASSWORD;
  process.env.OWNER_NOTIFY_EMAIL = "owner@example.com";
  process.env.FORM_RATE_LIMIT = "200";
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
  delete process.env.OWNER_NOTIFY_EMAIL;
  delete process.env.FORM_RATE_LIMIT;
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
  expect(res.status).toBe(200);
  const { days } = (await res.json()) as { days: { slots: string[] }[] };
  const slot = days.flatMap((d) => d.slots)[0];
  expect(slot).toBeDefined();
  return slot!;
}

function requestForm(slotStart: string, email = "ana@example.com") {
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
    slotStart,
    firstName: "Ana",
    email,
    phone: "904-555-0101",
    preferredContact: "email",
    serviceConsent: "on",
    priceAcknowledgment: "on",
  };
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

async function ownerToken(): Promise<string> {
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

async function setStatus(token: string, id: string, body: Record<string, unknown>) {
  const { POST } = await import("@/app/api/owner/v1/appointments/[id]/status/route");
  const res = await POST(
    new Request(`http://localhost/api/owner/v1/appointments/${id}/status`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
  return { status: res.status, body: (await res.json()) as StatusChangeResponse };
}

describe("calendar requests (deposits off)", () => {
  it("shows the calendar without deposits and holds the picked time for the owner", async () => {
    const { calendarRequestsEnabled, bookingEnabled } = await import("@/lib/booking");
    expect(bookingEnabled()).toBe(false);
    expect(calendarRequestsEnabled()).toBe(true);

    const slot = await firstOpenSlot();
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const result = await submitCalendarRequest(null, requestForm(slot));
    expect(result.status).toBe("ok");

    const s = await store();
    const [appt] = await s.listAppointments();
    expect(appt).toMatchObject({ status: "held", depositStatus: "none", source: "online", startsAt: slot, quotedPriceCents: 29900 });
    // Held for at most 48 hours, and never past the start time.
    const hold = Date.parse(appt!.holdExpiresAt!);
    expect(hold).toBeLessThanOrEqual(Math.min(Date.now() + 48 * 3600_000 + 1000, Date.parse(slot)));

    const mail = await outbox();
    expect(mail.map((m) => m.to).sort()).toEqual(["ana@example.com", "owner@example.com"]);
    expect(mail.find((m) => m.to === "owner@example.com")!.subject).toContain("Time requested");
    expect(mail.find((m) => m.to === "ana@example.com")!.text).toContain("we're holding that time for you");

    // That time is gone from the calendar for the next customer.
    const { isSlotAvailable } = await import("@/lib/availability");
    const { calendarState } = await import("@/lib/booking");
    expect(isSlotAvailable({ serviceId: "platinum-full", ...(await calendarState(s)), startIso: slot })).toBe(false);
  });

  it("tells a second customer the time was just taken", async () => {
    const slot = await firstOpenSlot();
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    expect((await submitCalendarRequest(null, requestForm(slot))).status).toBe("ok");
    const second = await submitCalendarRequest(null, requestForm(slot, "ben@example.com"));
    expect(second.status).toBe("invalid");
    expect(second.status === "invalid" && second.fieldErrors.slotStart).toMatch(/just booked/);
  });

  it("requires a time: a request without one is rejected", async () => {
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    const f = requestForm("");
    f.delete("slotStart");
    const r = await submitCalendarRequest(null, f);
    expect(r.status).toBe("invalid");
    expect(r.status === "invalid" && r.fieldErrors.slotStart).toBeDefined();
  });

  it("confirming in the app makes it a booking and emails the customer once", async () => {
    const slot = await firstOpenSlot();
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    await submitCalendarRequest(null, requestForm(slot));
    const s = await store();
    const [appt] = await s.listAppointments();
    const token = await ownerToken();

    const { summary } = { summary: await import("@/app/api/owner/v1/summary/route") };
    const before = (await (await summary.GET(new Request("http://localhost/api/owner/v1/summary", { headers: { authorization: `Bearer ${token}` } }))).json()) as TodaySummary;
    expect(before.toConfirm.map((a) => a.id)).toEqual([appt!.id]);

    const requestId = crypto.randomUUID();
    const res = await setStatus(token, appt!.id, { to: "confirmed", requestId });
    expect(res.status).toBe(200);
    expect(res.body.customerEmail).toEqual({ status: "sent", error: null });
    expect(res.body.appointment.status).toBe("confirmed");
    expect((await s.getAppointment(appt!.id))?.holdExpiresAt).toBeNull();
    expect((await s.getLead(appt!.leadId))?.stage).toBe("scheduled");

    const confirmations = (await outbox()).filter((m) => m.subject.includes("is confirmed"));
    expect(confirmations).toHaveLength(1);
    expect(confirmations[0]!.to).toBe("ana@example.com");

    // A repeated tap changes nothing and sends nothing.
    await setStatus(token, appt!.id, { to: "confirmed", requestId });
    expect((await outbox()).filter((m) => m.subject.includes("is confirmed"))).toHaveLength(1);
  });

  it("declining frees the time and asks the customer to pick another", async () => {
    const slot = await firstOpenSlot();
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    await submitCalendarRequest(null, requestForm(slot));
    const s = await store();
    const [appt] = await s.listAppointments();
    const res = await setStatus(await ownerToken(), appt!.id, { to: "declined", reason: "Booked elsewhere", requestId: crypto.randomUUID() });
    expect(res.status).toBe(200);
    expect(res.body.customerEmail?.status).toBe("sent");
    const declined = (await outbox()).find((m) => m.subject.startsWith("About your"));
    expect(declined?.text).toContain("pick another time");
    expect(declined?.text).not.toContain("Booked elsewhere");
    expect(await firstOpenSlot()).toBe(slot);
  });

  it("releases holds nobody confirmed in time", async () => {
    const slot = await firstOpenSlot();
    const { submitCalendarRequest } = await import("@/app/actions/leads");
    await submitCalendarRequest(null, requestForm(slot));
    const s = await store();
    const [appt] = await s.listAppointments();
    await s.updateAppointment(appt!.id, { holdExpiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(await s.releaseExpiredHolds()).toBe(1);
    expect((await s.getAppointment(appt!.id))?.status).toBe("cancelled");
    expect(await firstOpenSlot()).toBe(slot);
  });
});
