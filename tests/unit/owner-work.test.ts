import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CreateAppointmentResponse, SessionTokens, WorkResponse } from "@shared/api";

/** Working a job from the app: reschedule, payments, receipt, notes. LIVE mode, demo store. */

process.env.NEXT_PUBLIC_BUSINESS_MODE = "LIVE";
const PASSWORD = "test-owner-password";
const originalCwd = process.cwd;
let cwd: string;

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-work-"));
  process.cwd = () => cwd;
  for (const k of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ADMIN_EMAILS", "RESEND_API_KEY", "EMAIL_FROM"]) {
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

const req = (p: string, init: { method?: string; token?: string; body?: unknown } = {}) =>
  new Request(`http://localhost/api/owner/v1${p}`, {
    method: init.method ?? "GET",
    headers: { ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.body !== undefined ? { "content-type": "application/json" } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
const params = <P,>(p: P) => ({ params: Promise.resolve(p) });
const outbox = async (): Promise<{ to: string; subject: string; text: string }[]> => {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, ".data", "demo-outbox.json"), "utf8"));
  } catch {
    return [];
  }
};

async function token() {
  const { POST } = await import("@/app/api/owner/v1/session/route");
  return ((await (await POST(req("/session", { method: "POST", body: { email: "o@example.com", password: PASSWORD } }))).json()) as SessionTokens).accessToken;
}

async function nextTuesday(): Promise<string> {
  const { addDays, todayEastern } = await import("@/lib/time");
  let d = addDays(todayEastern(), 1);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 2) d = addDays(d, 1);
  return d;
}

async function book(t: string, time: string, email = "sam@example.com") {
  const { POST } = await import("@/app/api/owner/v1/appointments/route");
  const res = await POST(
    req("/appointments", {
      method: "POST",
      token: t,
      body: {
        requestId: crypto.randomUUID(),
        customer: { new: { firstName: "Sam", email, serviceAddress: "12 Pine St", zip: "32003" } },
        serviceId: "platinum-full",
        date: await nextTuesday(),
        time,
        durationMinutes: 120,
        priceCents: 29900,
        sendConfirmation: false,
      },
    }),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as CreateAppointmentResponse).appointment;
}

const routes = async () => ({
  reschedule: await import("@/app/api/owner/v1/appointments/[id]/reschedule/route"),
  payments: await import("@/app/api/owner/v1/appointments/[id]/payments/route"),
  receipt: await import("@/app/api/owner/v1/appointments/[id]/receipt/route"),
  notes: await import("@/app/api/owner/v1/appointments/[id]/notes/route"),
});

describe("working a job", () => {
  it("requires a signed-in owner for every action", async () => {
    const r = await routes();
    const id = crypto.randomUUID();
    for (const route of [r.reschedule, r.payments, r.receipt, r.notes]) {
      expect((await route.POST(req(`/appointments/${id}/x`, { method: "POST", body: {} }), params({ id }))).status).toBe(401);
    }
  });

  it("reschedules into a nearby slot without clashing with itself, refuses another job's time, and emails the new time", async () => {
    const r = await routes();
    const t = await token();
    const a = await book(t, "09:00");
    const b = await book(t, "14:00", "pat@example.com");
    const date = await nextTuesday();
    const move = (id: string, time: string, requestId = crypto.randomUUID()) =>
      r.reschedule.POST(req(`/appointments/${id}/reschedule`, { method: "POST", token: t, body: { requestId, date, time, durationMinutes: 120 } }), params({ id }));

    // 09:30 overlaps only its own old 09:00 slot.
    const ok = await move(a.id, "09:30");
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as WorkResponse;
    expect(body.customerEmail.status).toBe("sent");
    expect(body.appointment.events.map((e) => e.type)).toContain("rescheduled");
    expect((await outbox()).some((m) => m.subject.startsWith("New time for your Signature Full Detail"))).toBe(true);

    // 13:00 runs into b at 14:00 (with the 45-minute buffer).
    const clash = await move(a.id, "13:00");
    expect(clash.status).toBe(409);
    expect(b.id).toBeTruthy();
  });

  it("records payments into the balance, once per tap, and refuses refunds above what was collected", async () => {
    const r = await routes();
    const t = await token();
    const a = await book(t, "09:00");
    const pay = (body: Record<string, unknown>) =>
      r.payments.POST(req(`/appointments/${a.id}/payments`, { method: "POST", token: t, body }), params({ id: a.id }));

    const requestId = crypto.randomUUID();
    const first = (await (await pay({ requestId, method: "cash", amountCents: 20000 })).json()) as WorkResponse;
    expect(first.appointment.balance).toMatchObject({ collectedCents: 20000, balanceDueCents: 9900 });
    const again = (await (await pay({ requestId, method: "cash", amountCents: 20000 })).json()) as WorkResponse;
    expect(again.unchanged).toBe(true);
    expect(again.appointment.payments).toHaveLength(1);

    const rest = (await (await pay({ requestId: crypto.randomUUID(), method: "card_reader", amountCents: 9900 })).json()) as WorkResponse;
    expect(rest.appointment.balance).toMatchObject({ balanceDueCents: 0, paidInFull: true });

    expect((await pay({ requestId: crypto.randomUUID(), kind: "refund", method: "cash", amountCents: 50000 })).status).toBe(422);
    expect((await pay({ requestId: crypto.randomUUID(), method: "stripe", amountCents: 100 })).status).toBe(422);
    expect((await pay({ requestId: crypto.randomUUID(), method: "cash", amountCents: 0 })).status).toBe(422);
  });

  it("sends a receipt only after something was paid, and keeps private notes in the history", async () => {
    const r = await routes();
    const t = await token();
    const a = await book(t, "09:00");
    const receipt = () => r.receipt.POST(req(`/appointments/${a.id}/receipt`, { method: "POST", token: t, body: { requestId: crypto.randomUUID() } }), params({ id: a.id }));
    expect((await receipt()).status).toBe(409);

    await r.payments.POST(req(`/appointments/${a.id}/payments`, { method: "POST", token: t, body: { requestId: crypto.randomUUID(), method: "digital", amountCents: 29900 } }), params({ id: a.id }));
    const sent = (await (await receipt()).json()) as WorkResponse;
    expect(sent.customerEmail.status).toBe("sent");
    const mail = (await outbox()).find((m) => m.subject.includes("receipt"))!;
    expect(mail.text).toContain("Total: $299");
    expect(mail.text).toContain("Paid in full.");

    const noted = (await (
      await r.notes.POST(req(`/appointments/${a.id}/notes`, { method: "POST", token: t, body: { requestId: crypto.randomUUID(), note: "Gate code 1234" } }), params({ id: a.id }))
    ).json()) as WorkResponse;
    expect(noted.appointment.events.some((e) => e.type === "note" && e.note === "Gate code 1234")).toBe(true);
    expect((await outbox()).some((m) => m.text.includes("Gate code"))).toBe(false);
  });
});
