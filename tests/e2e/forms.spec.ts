import { expect, test } from "@playwright/test";

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

  test("quote request: multi-step, estimate shown, phone required for text contact, saves", async ({ page }) => {
    await page.goto("/request?service=maintenance");
    const form = page.getByRole("form", { name: "Service request" });
    await expect(page.getByText(/aren't confirming appointments yet/)).toBeVisible();

    // Step 1
    await expect(form.getByRole("radio", { name: /Maintenance Clean/ })).toBeChecked();
    await form.getByRole("radio", { name: /Two-row SUV/ }).check();
    await expect(form.locator('[data-step="0"]').getByText("$129")).toBeVisible();
    // Optional fields are labelled "Year (optional)" etc., so anchor on the leading word.
    await form.getByLabel(/^Year\b/).fill("2012");
    await form.getByLabel(/^Make\b/).fill("Toyota");
    await form.getByLabel(/^Model\b/).fill("FJ Cruiser");
    await form.getByRole("button", { name: "Continue" }).click();

    // Step 2 — flags must not change the estimate
    await expect(form.getByRole("heading", { name: "Condition" })).toBeVisible();
    await form.getByRole("radio", { name: /Needs deeper cleaning/ }).check();
    await form.getByRole("checkbox", { name: "Pet hair" }).check();
    await form.getByRole("checkbox", { name: "Sand" }).check();
    await form.getByRole("button", { name: "Continue" }).click();

    // Step 3
    await expect(form.getByRole("heading", { name: "Location & timing" })).toBeVisible();
    await form.getByLabel("ZIP code").fill("32073");
    await expect(form.getByText(/Orange Park is served at selected locations/)).toBeVisible();
    await form.getByRole("radio", { name: "Home" }).check();
    await form.getByRole("checkbox", { name: /Saturdays/ }).check();
    await expect(form.getByText(/once an opening date is set/)).toBeVisible();
    await form.getByRole("button", { name: "Continue" }).click();

    // Step 4
    await expect(form.getByRole("heading", { name: "Contact & review" })).toBeVisible();
    await expect(form.locator('[data-step="3"]').getByText("$129")).toBeVisible(); // still $129 despite flags
    await form.getByLabel("First name").fill("Herson");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel("How should we reach you?").selectOption("text");
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByRole("button", { name: "Send my request" }).click();

    // Native required on phone blocks submit; fill and retry.
    await expect(page).not.toHaveURL(/thanks/);
    await form.getByLabel(/Phone/).fill("904-555-0100");
    await form.getByRole("button", { name: "Send my request" }).click();

    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Request saved");
    await expect(page.getByText("$129")).toBeVisible();
    await expect(page.getByText(/not confirming appointments/i)).toBeVisible();
  });

  test("confirmation page refuses to show success for an unknown reference", async ({ page }) => {
    await page.goto("/thanks/request?ref=00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/couldn.t find that submission/);
  });

  test("owner can sign in (demo), see the lead, export CSV, and PRELAUNCH blocks appointment confirmation", async ({ page }) => {
    // Create a lead of our own so this test does not depend on the others.
    await page.goto("/request?service=exterior&vehicle=sedan");
    const form = page.getByRole("form", { name: "Service request" });
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByRole("radio", { name: /Normal maintenance/ }).check();
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByLabel("ZIP code").fill("32068");
    await form.getByRole("radio", { name: "Home" }).check();
    await form.getByRole("button", { name: "Continue" }).click();
    const name = `Admin ${unique()}`;
    await form.getByLabel("First name").fill(name);
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);

    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();

    await page.getByRole("table").getByRole("link", { name }).first().click();
    await expect(page).toHaveURL(/\/admin\/leads\//);
    await expect(page.getByText(/can.t be confirmed while the site is in PRELAUNCH/)).toBeVisible();

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
