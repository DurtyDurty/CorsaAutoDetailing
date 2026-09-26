import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Exercises the full intake pipeline against the demo store with the demo
 * email adapter, including notification failure and idempotent replays.
 * Uses a temp working directory so it never touches the real .data folder.
 */

const KEY = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
let cwd: string;
const originalCwd = process.cwd;

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
}));

async function load() {
  const [{ intake, baseLead }, { getLeadStore, resetLeadStoreCache }, { resetEmailAdapterCache }, { launchListSchema }, { resetRateLimits }] =
    await Promise.all([
      import("@/lib/leads/intake"),
      import("@/lib/leads/store"),
      import("@/lib/email"),
      import("@/lib/validation"),
      import("@/lib/rate-limit"),
    ]);
  resetLeadStoreCache();
  resetEmailAdapterCache();
  resetRateLimits();
  return { intake, baseLead, getLeadStore, launchListSchema };
}

function form(overrides: Record<string, string> = {}) {
  const f = new FormData();
  const base = { idempotencyKey: KEY, firstName: "Ana", email: "ana@example.com", zip: "32003", serviceConsent: "on", ...overrides };
  for (const [k, v] of Object.entries(base)) f.append(k, v);
  return f;
}

beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(process.env.TEMP ?? "/tmp", "corsa-test-"));
  process.cwd = () => cwd;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.OWNER_NOTIFY_EMAIL = "owner@example.test";
});

afterEach(async () => {
  process.cwd = originalCwd;
  await fs.rm(cwd, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("intake pipeline (demo store)", () => {
  it("saves a valid lead, records notifications, and returns ok", async () => {
    const { intake, baseLead, getLeadStore, launchListSchema } = await load();
    const res = await intake({
      leadType: "launch_list",
      schema: launchListSchema,
      formData: form(),
      build: (d) => ({ ...baseLead("launch_list", d), zip: d.zip }),
    });
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    const store = (await getLeadStore())!;
    const lead = await store.getLead(res.leadId);
    expect(lead?.email).toBe("ana@example.com");
    expect(lead?.stage).toBe("new");
    expect(lead?.consent.serviceTextVersion).toBeTruthy();
    const notifs = await store.listNotifications({ leadId: res.leadId });
    expect(notifs.map((n) => n.kind).sort()).toEqual(["customer_ack", "owner_notify"]);
    expect(notifs.every((n) => n.status === "sent")).toBe(true);
    const outbox = JSON.parse(await fs.readFile(path.join(cwd, ".data", "demo-outbox.json"), "utf8"));
    expect(outbox).toHaveLength(2);
    expect(JSON.stringify(outbox)).not.toMatch(/internalNotes/);
  });

  it("returns field errors for invalid input and saves nothing", async () => {
    const { intake, baseLead, getLeadStore, launchListSchema } = await load();
    const res = await intake({
      leadType: "launch_list",
      schema: launchListSchema,
      formData: form({ email: "bad", zip: "1" }),
      build: (d) => baseLead("launch_list", d),
    });
    expect(res.status).toBe("invalid");
    if (res.status === "invalid") {
      expect(res.fieldErrors.email).toBeDefined();
      expect(res.fieldErrors.zip).toBeDefined();
    }
    expect(await (await getLeadStore())!.listLeads()).toHaveLength(0);
  });

  it("silently discards honeypot submissions", async () => {
    const { intake, baseLead, getLeadStore, launchListSchema } = await load();
    const res = await intake({
      leadType: "launch_list",
      schema: launchListSchema,
      formData: form({ website: "spam" }),
      build: (d) => baseLead("launch_list", d),
    });
    expect(res.status).toBe("ok");
    expect(await (await getLeadStore())!.listLeads()).toHaveLength(0);
  });

  it("is idempotent: a replayed submission returns the same lead without duplicating", async () => {
    const { intake, baseLead, getLeadStore, launchListSchema } = await load();
    const opts = {
      leadType: "launch_list" as const,
      schema: launchListSchema,
      build: (d: { idempotencyKey: string; firstName: string; email: string; marketingEmail: boolean; landingPath: string | null; referrer: string | null; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null }) =>
        baseLead("launch_list", d),
    };
    const a = await intake({ ...opts, formData: form() });
    const b = await intake({ ...opts, formData: form() });
    expect(a.status).toBe("ok");
    expect(b.status).toBe("ok");
    if (a.status === "ok" && b.status === "ok") {
      expect(b.leadId).toBe(a.leadId);
      expect(b.created).toBe(false);
    }
    const store = (await getLeadStore())!;
    expect(await store.listLeads()).toHaveLength(1);
    // Notifications were only attempted once.
    expect(await store.listNotifications()).toHaveLength(2);
  });

  it("keeps the lead when notification delivery fails and records the failure", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Corsa <noreply@example.test>";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("boom", { status: 500 }));
    const { intake, baseLead, getLeadStore, launchListSchema } = await load();
    const res = await intake({
      leadType: "launch_list",
      schema: launchListSchema,
      formData: form(),
      build: (d) => baseLead("launch_list", d),
    });
    expect(res.status).toBe("ok");
    const store = (await getLeadStore())!;
    expect(await store.listLeads()).toHaveLength(1);
    const notifs = await store.listNotifications();
    expect(notifs).toHaveLength(2);
    expect(notifs.every((n) => n.status === "failed" && n.attempts === 1)).toBe(true);
    expect(notifs[0].lastError).toMatch(/Resend 500/);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Retry path succeeds once the provider recovers.
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const { retryFailedNotifications } = await import("@/lib/notifications");
    const retried = await retryFailedNotifications(store);
    expect(retried).toBe(2);
    expect((await store.listNotifications()).every((n) => n.status === "sent" && n.attempts === 2)).toBe(true);
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
  });

  it("rate limits repeated submissions from one client", async () => {
    const { intake, baseLead, launchListSchema } = await load();
    let limited = 0;
    for (let i = 0; i < 8; i++) {
      const res = await intake({
        leadType: "launch_list",
        schema: launchListSchema,
        formData: form({ idempotencyKey: `3fa85f64-5717-4562-b3fc-2c963f66af${String(i).padStart(2, "0")}` }),
        build: (d) => baseLead("launch_list", d),
      });
      if (res.status === "rate_limited") limited++;
    }
    expect(limited).toBe(2);
  });

  it("fails closed in production without a durable store", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { intake, baseLead, launchListSchema } = await load();
    const res = await intake({
      leadType: "launch_list",
      schema: launchListSchema,
      formData: form(),
      build: (d) => baseLead("launch_list", d),
    });
    expect(res.status).toBe("unavailable");
    vi.unstubAllEnvs();
  });
});
