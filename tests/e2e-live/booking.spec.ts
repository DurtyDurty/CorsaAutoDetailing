import { expect, test } from "@playwright/test";

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// LIVE mode (built by playwright.live.config.ts): the booking-request flow customers get after launch.
test.describe("booking after launch (LIVE mode, demo store)", () => {
  test("Book buttons and the header CTA lead to the booking form", async ({ page, isMobile }) => {
    await page.goto("/services");
    await page.getByText("Small crossover or two-row SUV").first().click();
    await page.getByRole("link", { name: "Book Signature" }).click();
    await expect(page).toHaveURL(/\/request\?service=signature&vehicle=suv2$/);
    const form = page.getByRole("form", { name: "Service request" });
    await expect(form.getByRole("radio", { name: /Corsa Signature Detail/ })).toBeChecked();
    await expect(form.getByRole("radio", { name: /Small crossover or two-row SUV/ })).toBeChecked();
    await expect(form.locator('[data-step="0"]').getByText("$325")).toBeVisible();
    await expect(page.getByText(/Preparing to launch/)).toHaveCount(0);
    if (!isMobile) {
      await expect(page.getByRole("banner").getByRole("link", { name: "Request an appointment" })).toBeVisible();
    }
  });

  test("booking request: multi-step, estimate shown, phone and price acknowledgment required, saves", async ({ page }) => {
    await page.goto("/request?service=signature");
    const form = page.getByRole("form", { name: "Service request" });

    // Step 1
    await expect(form.getByRole("radio", { name: /Corsa Signature Detail/ })).toBeChecked();
    await form.getByRole("radio", { name: /Small crossover or two-row SUV/ }).check();
    await expect(form.locator('[data-step="0"]').getByText("$325")).toBeVisible();
    await form.getByLabel(/^Year\b/).fill("2012");
    await form.getByLabel(/^Make\b/).fill("Toyota");
    await form.getByLabel(/^Model\b/).fill("FJ Cruiser");
    await form.getByRole("button", { name: "Continue" }).click();

    // Step 2: flags must not change the estimate
    await expect(form.getByRole("heading", { name: "Condition" })).toBeVisible();
    await form.getByRole("radio", { name: /Needs deeper cleaning/ }).check();
    await form.getByRole("checkbox", { name: "Pet hair" }).check();
    await form.getByRole("checkbox", { name: "Heavy sand" }).check();
    await form.getByRole("button", { name: "Continue" }).click();

    // Step 3: after launch the preferred-date field is available
    await expect(form.getByRole("heading", { name: "Location & timing" })).toBeVisible();
    await form.getByLabel("Service address").fill("123 Main St");
    await form.getByLabel("ZIP code").fill("32073");
    await expect(form.getByText(/Orange Park is served at selected locations/)).toBeVisible();
    await form.getByRole("radio", { name: "Home" }).check();
    await form.getByRole("checkbox", { name: /Saturdays/ }).check();
    await expect(form.getByLabel(/Preferred date/)).toBeVisible();
    await form.getByRole("button", { name: "Continue" }).click();

    // Step 4
    await expect(form.getByRole("heading", { name: "Contact & review" })).toBeVisible();
    await expect(form.locator('[data-step="3"]').getByText("$325")).toBeVisible(); // still $325 despite flags
    await expect(form.getByText(/Final pricing is subject to an in-person vehicle inspection/)).toBeVisible();
    await form.getByLabel("First name").fill("Herson");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByRole("button", { name: "Request an appointment" }).click();

    // Native required on phone blocks submit; fill and retry.
    await expect(page).not.toHaveURL(/thanks/);
    await form.getByLabel(/Phone/).fill("904-555-0100");
    // The unchecked price acknowledgment still blocks submit.
    await form.getByRole("button", { name: "Request an appointment" }).click();
    await expect(page).not.toHaveURL(/thanks/);
    await form.getByLabel(/displayed price is an estimate/).check();
    await form.getByRole("button", { name: "Request an appointment" }).click();

    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Request received");
    await expect(page.getByText("$325")).toBeVisible();
    await expect(page.getByText(/not a confirmed appointment/i)).toBeVisible();
  });

  test("owner sees the booking with address, timestamped acknowledgment, and can confirm appointments", async ({ page }) => {
    await page.goto("/request?service=essential&vehicle=sedan");
    const form = page.getByRole("form", { name: "Service request" });
    await form.getByLabel(/^Year\b/).fill("2019");
    await form.getByLabel(/^Make\b/).fill("Lexus");
    await form.getByLabel(/^Model\b/).fill("IS F");
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByRole("radio", { name: /Normal maintenance/ }).check();
    await form.getByRole("button", { name: "Continue" }).click();
    await form.getByLabel("Service address").fill("45 Oak Ln");
    await form.getByLabel("ZIP code").fill("32068");
    await form.getByRole("radio", { name: "Home" }).check();
    await form.getByRole("button", { name: "Continue" }).click();
    const name = `Admin ${unique()}`;
    await form.getByLabel("First name").fill(name);
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/Phone/).fill("904-555-0101");
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByLabel(/displayed price is an estimate/).check();
    await form.getByRole("button", { name: "Request an appointment" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);

    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.getByRole("table").getByRole("link", { name }).first().click();
    await expect(page).toHaveURL(/\/admin\/leads\//);
    await expect(page.getByText("45 Oak Ln")).toBeVisible();
    await expect(page.getByText("Price estimate ack.")).toBeVisible();
    await expect(page.getByText(/2026-09-v1 · /).last()).toBeVisible();
    // LIVE: appointment confirmation is available (not the PRELAUNCH block).
    await expect(page.getByText(/can.t be confirmed while the site is in PRELAUNCH/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Appointment" })).toBeVisible();
  });
});
