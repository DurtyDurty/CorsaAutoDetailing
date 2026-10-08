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

/** Calendar requests: picks a part of the first open day (no times are shown); returns the placeholder start it holds. */
async function pickDayPart(page: Page, part: "Morning" | "Afternoon" | "Either" = "Morning") {
  const form = page.getByRole("form", { name: "Service request" });
  const group = form.getByRole("radiogroup", { name: "What part of the day?" });
  await expect(group).toBeVisible();
  const choice = group.getByRole("radio", { name: part }).or(group.getByRole("radio").first()).first();
  await choice.locator("xpath=..").click();
  await expect(choice).toBeChecked();
  return (await form.locator('input[name="slotStart"]').getAttribute("value"))!;
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
    await expect(form.locator('[data-step="0"]').getByText("$200", { exact: true })).toBeVisible();
    await expect(form.getByText(/Vehicle type/)).toHaveCount(0);
    await expect(page.getByText(/Preparing to launch/)).toHaveCount(0);
    if (!isMobile) await expect(page.getByRole("banner").getByRole("link", { name: "Book a detail" })).toBeVisible();
  });

  test("a customer picks a day and part of the day (no times shown); it's held for the owner, nothing is paid", async ({ page }) => {
    const form = await fillVehicleAndCondition(page, "monthly-maintenance");
    // No time picked yet: can't continue.
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(form.getByRole("heading", { name: /^Location & tim(e|ing)$/ })).toBeVisible();
    await expect(form.getByRole("checkbox", { name: /Flexible/ })).toHaveCount(0);
    // A day, then morning, afternoon or either, and an optional preferred time. No times are listed.
    await expect(form.getByRole("group", { name: "Days" })).toBeVisible();
    await expect(form.getByText(/^\d{1,2}:\d{2}/)).toHaveCount(0);
    const slot = await pickDayPart(page, "Morning");
    await form.getByLabel(/Preferred time/).fill("around 9:30");
    if (process.env.QUOTE_SHOTS) await form.locator('[data-field="slotStart"]').screenshot({ path: `${process.env.QUOTE_SHOTS}/slots-${test.info().project.name}.png` });
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(form.getByRole("heading", { name: "Contact & review" })).toBeVisible();
    await expect(form.locator('[data-step="3"]').getByText("$150/mo", { exact: true })).toBeVisible();
    await expect(form.getByText(/deposit/i)).toHaveCount(0);
    await form.getByLabel("First name").fill("Riley");
    await form.getByLabel("Email", { exact: true }).fill(`${unique()}@example.com`);
    await form.getByLabel(/Phone/).fill(phone());
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByLabel(/displayed price is an estimate/).check();
    await form.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);
    await expect(page.getByRole("heading", { name: "Request received." })).toBeVisible();
    await expect(page.getByText("Morning, around 9:30")).toBeVisible();
    await expect(page.getByText("Monthly Maintenance")).toBeVisible();
    // The held time is gone from the calendar.
    expect(await openSlots(page, "monthly-maintenance")).not.toContain(slot);
  });
});

test.describe("quotes: request, quote, accept (LIVE mode)", () => {
  test("the owner quotes a website request; the customer accepts it and the job is confirmed", async ({ page, browser }, testInfo) => {
    // A customer requests a time on the website.
    const form = await fillVehicleAndCondition(page, "monthly-maintenance");
    await pickDayPart(page, "Morning");
    await form.getByRole("button", { name: "Continue" }).click();
    const name = `Quote ${word()}`;
    const email = `${unique()}@example.com`;
    await form.getByLabel("First name").fill(name);
    await form.getByLabel("Email", { exact: true }).fill(email);
    await form.getByLabel(/Phone/).fill(phone());
    await form.getByLabel(/I understand Corsa Auto Detailing will use/).check();
    await form.getByLabel(/displayed price is an estimate/).check();
    await form.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);

    // The owner sends a quote from the dashboard, adding an extra and a discount.
    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const card = page.locator("article", { hasText: name });
    await card.getByRole("link", { name: "Send quote" }).click();
    await expect(page).toHaveURL(/\/admin\/jobs\/[0-9a-f-]{36}#quote$/);
    const quote = page.getByRole("region", { name: "Quote" });
    await expect(quote.getByText("Customer asked for:")).toBeVisible();
    // The arrival time starts at the time held for the request (moving it is covered by unit tests).
    const arrival = quote.getByLabel("Arrival time (Eastern, same day)");
    await expect(arrival).toHaveValue(/^\d{2}:\d{2}$/);
    await quote.getByLabel("Include Excessive pet-hair removal").check();
    await quote.getByLabel("Discount ($)").fill("10");
    await quote.getByLabel(/Note to the customer/).fill("Thanks for choosing Corsa!");
    page.once("dialog", (d) => void d.accept());
    await quote.getByRole("button", { name: "Send quote" }).click();
    await expect(page.getByRole("status")).toContainText(/Quote Q-[A-Z0-9]{6} sent/);
    await expect(quote).toContainText("Quote sent, waiting for the customer");

    // The customer opens the link from the email.
    const { readFile } = await import("node:fs/promises");
    const outbox = JSON.parse(await readFile(".data/demo-outbox.json", "utf8")) as { to: string; subject: string; text: string }[];
    const mail = outbox.filter((m) => m.to === email && m.subject.startsWith("Your quote")).at(-1)!;
    // The email carries the short link, which forwards to the quote page.
    const link = /\/q\/[A-Za-z0-9]{12}/.exec(mail.text)![0];
    const customer = await (await browser.newContext({ viewport: page.viewportSize() ?? undefined })).newPage();
    await customer.goto(link);
    await expect(customer.getByRole("article", { name: /Quote Q-/ })).toBeVisible();
    await expect(customer.getByText("Excessive pet-hair removal")).toBeVisible();
    await expect(customer.getByText("-$10")).toBeVisible();
    if (process.env.QUOTE_SHOTS) await customer.screenshot({ path: `${process.env.QUOTE_SHOTS}/quote-${testInfo.project.name}.png`, fullPage: true });

    // The PDF is there too.
    await expect(customer).toHaveURL(/\/quote\/[A-Za-z0-9]{12}$/);
    const pdf = await customer.request.get(`${customer.url()}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");

    // Accepting needs the box ticked, then confirms the appointment.
    await customer.getByRole("button", { name: /Accept & confirm/ }).click();
    await expect(customer.getByRole("article", { name: /Quote Q-/ })).toBeVisible();
    await customer.getByLabel(/I accept this quote/).check();
    await customer.getByRole("button", { name: /Accept & confirm/ }).click();
    await expect(customer.getByRole("status")).toContainText("You're booked.");
    if (process.env.QUOTE_SHOTS) await customer.screenshot({ path: `${process.env.QUOTE_SHOTS}/accepted-${testInfo.project.name}.png`, fullPage: true });

    // The owner sees a confirmed job at the quoted price.
    await page.reload();
    await expect(page.getByRole("region", { name: "Quote" })).toContainText("Quote accepted");
    await expect(page.locator("header").filter({ hasText: name })).toContainText("Confirmed");
    await customer.context().close();
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
    await expect(page.getByLabel("Price ($)")).toHaveValue("200");
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
    await expect(page.getByRole("link", { name: "Collect $200" })).toBeVisible();
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
