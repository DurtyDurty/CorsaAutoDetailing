import { expect, test, type Page } from "@playwright/test";

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * LIVE mode (built by playwright.live.config.ts) with the demo payment
 * provider. Without per-package deposits and durations (business.booking),
 * the site takes requests instead of deposit bookings.
 */

async function fillVehicleAndCondition(page: Page, service: string) {
  await page.goto(`/request?service=${service}`);
  const form = page.getByRole("form", { name: "Service request" });
  await form.getByLabel(/^Year\b/).fill("2019");
  await form.getByLabel(/^Make\b/).fill("Lexus");
  await form.getByLabel(/^Model\b/).fill("IS F");
  await form.getByRole("button", { name: "Continue" }).click();
  await form.getByRole("radio", { name: /Normal maintenance/ }).check();
  await form.getByRole("button", { name: "Continue" }).click();
  await expect(form.getByRole("heading", { name: /^Location & tim(e|ing)$/ })).toBeVisible();
  await form.getByLabel("Service address").fill("45 Oak Ln");
  await form.getByLabel("ZIP code").fill("32068");
  await form.getByRole("radio", { name: "Home" }).check();
  return form;
}

/** Picks the first open time on the auto-selected day; returns its ISO value. */
async function pickFirstSlot(page: Page) {
  const form = page.getByRole("form", { name: "Service request" });
  const first = form.locator('input[name="slotStart"]').first();
  await expect(first).toBeAttached();
  const iso = await first.getAttribute("value");
  await first.locator("xpath=..").click();
  await expect(first).toBeChecked();
  return iso!;
}

async function fillContactAndAgree(page: Page, name: string) {
  const form = page.getByRole("form", { name: "Service request" });
  await form.getByRole("button", { name: "Continue" }).click();
  await expect(form.getByRole("heading", { name: "Contact & deposit" })).toBeVisible();
  await form.getByLabel("First name").fill(name);
  await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
  await form.getByLabel(/Phone/).fill("904-555-0101");
  await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
  await form.getByLabel(/deposit, cancellation and weather policy/).check();
  await form.getByLabel(/displayed price is an estimate/).check();
  return form;
}

async function openSlots(page: Page, service: string): Promise<string[]> {
  const res = await page.request.get(`/api/availability?service=${service}`);
  expect(res.status()).toBe(200);
  const { days } = (await res.json()) as { days: { slots: string[] }[] };
  return days.flatMap((d) => d.slots);
}

test.describe("after launch without deposits (LIVE mode, current production setup)", () => {
  test("Book now opens the request form with the package chosen and no vehicle size", async ({ page, isMobile }) => {
    await page.goto("/services");
    await page.locator("article", { has: page.getByRole("heading", { name: "Signature Full Detail" }) }).getByRole("link", { name: "Book now" }).click();
    await expect(page).toHaveURL(/\/request\?service=platinum-full$/);
    const form = page.getByRole("form", { name: "Service request" });
    await expect(form.getByLabel("Service", { exact: true })).toHaveValue("platinum-full");
    await expect(form.locator('[data-step="0"]').getByText("$299", { exact: true })).toBeVisible();
    await expect(form.getByText(/Vehicle type/)).toHaveCount(0);
    await expect(page.getByText(/Preparing to launch/)).toHaveCount(0);
    if (!isMobile) await expect(page.getByRole("banner").getByRole("link", { name: "Book a detail" })).toBeVisible();
  });

  test("a customer sends a request for Monthly Maintenance without paying anything", async ({ page }) => {
    const form = await fillVehicleAndCondition(page, "monthly-maintenance");
    await expect(form.locator('input[name="slotStart"]')).toHaveCount(0);
    await form.getByRole("checkbox", { name: /Flexible/ }).check();
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(form.getByRole("heading", { name: "Contact & review" })).toBeVisible();
    await expect(form.locator('[data-step="3"]').getByText("$150/mo", { exact: true })).toBeVisible();
    await form.getByLabel("First name").fill("Riley");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/Phone/).fill("904-555-0101");
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByLabel(/displayed price is an estimate/).check();
    await form.getByRole("button", { name: "Request an appointment" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);
    await expect(page.getByText("Monthly Maintenance")).toBeVisible();
  });
});

// Needs a deposit and a duration for every package in business.booking; skipped while deposits are off.
test.describe.skip("online booking with deposits (LIVE mode, demo payments)", () => {

  test("book a time, pay the deposit, get confirmed; the slot disappears; owner can refund", async ({ page }) => {
    await fillVehicleAndCondition(page, "platinum-full");
    const slot = await pickFirstSlot(page);
    const name = `Booker ${unique()}`;
    const form = await fillContactAndAgree(page, name);
    await expect(form.getByText("Deposit due today")).toBeVisible();
    await form.getByRole("button", { name: "Pay $50 deposit & book" }).click();

    // Demo stand-in for Stripe Checkout.
    await expect(page).toHaveURL(/\/booking\/demo-checkout\?session=/);
    await expect(page.getByText("$50")).toBeVisible();
    await page.getByRole("button", { name: "Pay test deposit" }).click();

    await expect(page).toHaveURL(/\/booking\/confirmed\?session_id=/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/You.re booked/);
    await expect(page.getByText(/\$50, credited toward your final price/)).toBeVisible();
    expect(await openSlots(page, "platinum-full")).not.toContain(slot);

    // Owner view: deposit paid, cancel with refund.
    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("table").getByRole("link", { name }).first().click();
    await expect(page.getByText(/Booked online · deposit \$50 paid/)).toBeVisible();
    await expect(page.getByText("45 Oak Ln")).toBeVisible();
    await page.getByRole("button", { name: "Cancel & refund deposit" }).click();
    await expect(page.getByText("Appointment cancelled and deposit refunded.")).toBeVisible();
    // Cancelled → the time is bookable again.
    expect(await openSlots(page, "platinum-full")).toContain(slot);
  });

  test("backing out of payment releases the held time immediately", async ({ page }) => {
    await fillVehicleAndCondition(page, "signature-full");
    const slot = await pickFirstSlot(page);
    const form = await fillContactAndAgree(page, `Backout ${unique()}`);
    await form.getByRole("button", { name: "Pay $25 deposit & book" }).click();
    await expect(page).toHaveURL(/\/booking\/demo-checkout\?session=/);
    // While paying, the slot is held for everyone else.
    expect(await openSlots(page, "signature-full")).not.toContain(slot);
    await page.getByRole("button", { name: "Cancel and go back" }).click();
    await expect(page).toHaveURL(/\/booking\/cancelled\?/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Payment not completed");
    expect(await openSlots(page, "signature-full")).toContain(slot);
  });

  test("owner blocks a day off: it leaves the calendar until reopened", async ({ page }) => {
    const days = async () => {
      const res = await page.request.get("/api/availability?service=signature-full");
      return ((await res.json()) as { days: { date: string }[] }).days.map((d) => d.date);
    };
    // The last bookable day, so the other tests' "first open time" is unaffected.
    const day = (await days()).at(-1)!;

    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Days off" }).click();
    await expect(page.getByRole("heading", { name: "Days off", level: 1 })).toBeVisible();
    await page.getByLabel(/Day off/).fill(day);
    const note = `Vacation ${unique()}`;
    await page.getByLabel(/Note/).fill(note);
    await page.getByRole("button", { name: "Block these days" }).click();
    await expect(page.getByText("Day off added.")).toBeVisible();
    await expect(page.getByText(note)).toBeVisible();
    expect(await days()).not.toContain(day);

    await page.getByRole("listitem").filter({ hasText: note }).getByRole("button", { name: /^Reopen / }).click();
    await expect(page.getByText("Day reopened for booking.")).toBeVisible();
    expect(await days()).toContain(day);
  });

  test("two customers racing for the same time: the second is told it was taken", async ({ page, browser }) => {
    // Customer B loads the calendar first, so the time still shows as open for them.
    const other = await browser.newContext();
    const pageB = await other.newPage();
    await fillVehicleAndCondition(pageB, "signature-full");
    const slotB = await pickFirstSlot(pageB);
    await fillContactAndAgree(pageB, `Racer B ${unique()}`);

    // Customer A books the same (first) time and pays.
    await fillVehicleAndCondition(page, "signature-full");
    const slotA = await pickFirstSlot(page);
    expect(slotA).toBe(slotB);
    const formA = await fillContactAndAgree(page, `Racer A ${unique()}`);
    await formA.getByRole("button", { name: "Pay $25 deposit & book" }).click();
    await page.getByRole("button", { name: "Pay test deposit" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/You.re booked/);

    // B submits the now-taken time.
    const formB = pageB.getByRole("form", { name: "Service request" });
    await formB.getByRole("button", { name: "Pay $25 deposit & book" }).click();
    await expect(formB.getByText(/just booked by someone else/)).toBeVisible();
    await expect(pageB).toHaveURL(/\/request\?/);
    await other.close();
  });
});
