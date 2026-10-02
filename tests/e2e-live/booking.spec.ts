import { expect, test, type Page } from "@playwright/test";

const unique = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
/** Names on the public forms are letters only, so the unique part of a test name is too. */
const word = () => Array.from({ length: 10 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");
/** A customer may hold two unconfirmed times, matched by email or phone: each test customer gets their own number. */
const phone = () => `904-555-${String(1000 + Math.floor(Math.random() * 9000))}`;

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
  await form.getByLabel(/Phone/).fill(phone());
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

  test("a customer must pick a time from the calendar; it's held for the owner, nothing is paid", async ({ page }) => {
    const form = await fillVehicleAndCondition(page, "monthly-maintenance");
    // No time picked yet: can't continue.
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(form.getByRole("heading", { name: /^Location & tim(e|ing)$/ })).toBeVisible();
    await expect(form.getByRole("checkbox", { name: /Flexible/ })).toHaveCount(0);
    const slot = await pickFirstSlot(page);
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(form.getByRole("heading", { name: "Contact & review" })).toBeVisible();
    await expect(form.locator('[data-step="3"]').getByText("$150/mo", { exact: true })).toBeVisible();
    await expect(form.getByText(/deposit/i)).toHaveCount(0);
    await form.getByLabel("First name").fill("Riley");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/Phone/).fill(phone());
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByLabel(/displayed price is an estimate/).check();
    await form.getByRole("button", { name: "Request this time" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);
    await expect(page.getByRole("heading", { name: "Time requested." })).toBeVisible();
    await expect(page.getByText("Monthly Maintenance")).toBeVisible();
    // The held time is gone from the calendar.
    expect(await openSlots(page, "monthly-maintenance")).not.toContain(slot);
  });
});

test.describe("owner dashboard laid out like the app (LIVE mode)", () => {
  test("book from the dashboard, work the job through to closed out", async ({ page }, testInfo) => {
    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("link", { name: "Today", exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "+ New appointment" }).click();
    await expect(page).toHaveURL(/\/admin\/book/);
    await page.getByRole("radio", { name: "New customer" }).click();
    const name = `Dash ${word()}`;
    await page.getByLabel("First name").fill(name);
    await page.getByLabel(/^Email/).fill(`${unique()}@example.com`);
    await page.getByLabel("Service address").fill("45 Oak Ln");
    await page.getByLabel("ZIP").fill("32068");
    await page.getByLabel("Service", { exact: true }).selectOption("platinum-full");
    await expect(page.getByLabel("Price ($)")).toHaveValue("299");
    // A free Tuesday: each project and run picks its own week and hour so they never collide.
    const d = new Date(Date.now() + (8 + 7 * Math.floor(Math.random() * 20)) * 86400_000);
    while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
    await page.getByLabel("Date").fill(d.toISOString().slice(0, 10));
    await page.getByLabel("Time (Eastern)").fill(testInfo.project.name.includes("mobile") ? "08:00" : "12:30");
    await page.getByRole("button", { name: "Book appointment" }).click();

    await expect(page).toHaveURL(/\/admin\/jobs\/[0-9a-f-]{36}\?ok=/);
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Booked");

    page.on("dialog", (dlg) => void dlg.accept());
    for (const step of ["Mark en route", "Mark arrived", "Start service", "Complete service"]) {
      await page.getByRole("button", { name: step }).click();
      await expect(page.getByRole("status")).toContainText("Updated");
    }
    await expect(page.getByRole("link", { name: "Collect $299" })).toBeVisible();
    await page.getByLabel("How").selectOption("cash");
    await page.getByRole("button", { name: "Record" }).click();
    await expect(page.getByRole("status")).toContainText("Payment recorded");
    await expect(page.getByText("Closed out: completed and paid in full")).toBeVisible();

    await page.getByRole("link", { name: "← Calendar" }).click();
    await expect(page).toHaveURL(/\/admin\/calendar\?day=/);
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  });
});
// Needs a deposit and a duration for every package in business.booking; skipped while deposits are off.
test.describe.skip("online booking with deposits (LIVE mode, demo payments)", () => {

  test("book a time, pay the deposit, get confirmed; the slot disappears; owner can refund", async ({ page }) => {
    await fillVehicleAndCondition(page, "platinum-full");
    const slot = await pickFirstSlot(page);
    const name = `Booker ${word()}`;
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
    const form = await fillContactAndAgree(page, `Backout ${word()}`);
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
    await fillContactAndAgree(pageB, `Racer B ${word()}`);

    // Customer A books the same (first) time and pays.
    await fillVehicleAndCondition(page, "signature-full");
    const slotA = await pickFirstSlot(page);
    expect(slotA).toBe(slotB);
    const formA = await fillContactAndAgree(page, `Racer A ${word()}`);
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
