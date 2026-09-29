import { expect, test } from "@playwright/test";

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// PRELAUNCH mode (the default build). Booking-request tests live in tests/e2e-live.
test.describe("lead forms (demo store)", () => {
  test("launch list: validation errors preserve input, then saves and confirms", async ({ page }) => {
    await page.goto("/#launch-list");
    const form = page.getByRole("form", { name: "Launch list signup" });
    await form.getByLabel("First name").fill("Ana");
    await form.getByLabel("Email", { exact: true }).fill("not-an-email");
    await form.getByLabel("ZIP code").fill("32003");
    await form.getByRole("button", { name: "Join the launch list" }).click();

    await expect(form.getByRole("alert").filter({ hasText: /valid email/i })).toBeVisible();
    await expect(form.getByRole("alert").filter({ hasText: /confirm we may use/i })).toBeVisible();
    // Values preserved after a server-side validation failure.
    await expect(form.getByLabel("First name")).toHaveValue("Ana");
    await expect(form.getByLabel("ZIP code")).toHaveValue("32003");

    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByRole("button", { name: "Join the launch list" }).click();

    await expect(page).toHaveURL(/\/thanks\/launch-list\?ref=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("You're on the list");
    await expect(page.getByText(/Reference [A-Z0-9]{6}/)).toBeVisible();
  });

  test("before launch, /request takes no bookings: it collects an email with the chosen package pre-filled", async ({ page }) => {
    await page.goto("/request?service=signature&vehicle=suv2");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/not booking yet/i);
    await expect(page.getByRole("form", { name: "Service request" })).toHaveCount(0);
    const form = page.getByRole("form", { name: "Launch list signup" });
    await expect(form.getByLabel(/Service you're interested in/)).toHaveValue("signature");
    await expect(form.getByLabel(/Vehicle type/)).toHaveValue("suv2");

    await form.getByLabel("First name").fill("Sam");
    await form.getByLabel("ZIP code").fill("32043");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByRole("button", { name: "Join the launch list" }).click();
    await expect(page).toHaveURL(/\/thanks\/launch-list\?ref=/);
  });

  test("confirmation page refuses to show success for an unknown reference", async ({ page }) => {
    await page.goto("/thanks/request?ref=00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/couldn.t find that submission/);
  });

  test("owner can sign in (demo), see a launch-list lead, export CSV, and sign out", async ({ page }) => {
    // Create a lead of our own so this test does not depend on the others.
    await page.goto("/request?service=essential&vehicle=sedan");
    const form = page.getByRole("form", { name: "Launch list signup" });
    const name = `Admin ${unique()}`;
    await form.getByLabel("First name").fill(name);
    await form.getByLabel("ZIP code").fill("32068");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByRole("button", { name: "Join the launch list" }).click();
    await expect(page).toHaveURL(/\/thanks\/launch-list\?ref=/);

    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/launch-list");
    await page.getByRole("link", { name }).first().click();
    await expect(page).toHaveURL(/\/admin\/leads\//);
    await expect(page.getByText("Corsa Essential Detail").first()).toBeVisible();

    // Write back from the dashboard (demo outbox stands in for Resend).
    await expect(page.getByRole("heading", { name: `Email ${name}` })).toBeVisible();
    await expect(page.getByLabel("Message")).toHaveValue(`Hi ${name},\n\n`);
    await page.getByLabel("Subject").fill("Welcome to the list");
    await page.getByLabel("Message").fill(`Hi ${name},\n\nThanks for signing up. We open soon.`);
    await page.getByRole("button", { name: "Send email" }).click();
    await expect(page.getByRole("status").filter({ hasText: /^Sent to / })).toBeVisible();
    await expect(page.getByLabel("Subject")).not.toHaveValue("Welcome to the list");
    await expect(page.getByRole("heading", { name: "Emails you sent" })).toBeVisible();
    await expect(page.getByText("Welcome to the list")).toBeVisible();
    await expect(page.getByText("Contacted").first()).toBeVisible();

    // Fetch from inside the page so the Secure session cookie is sent exactly as the browser sends it.
    const csv = await page.evaluate(async () => {
      const r = await fetch("/admin/export");
      return { status: r.status, type: r.headers.get("content-type") ?? "", body: await r.text() };
    });
    expect(csv.status).toBe(200);
    expect(csv.type).toContain("text/csv");
    expect(csv.body).toMatch(/^id,created_at,lead_type/);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    expect(await page.evaluate(() => fetch("/admin/export").then((r) => r.status))).toBe(401);
  });
});
