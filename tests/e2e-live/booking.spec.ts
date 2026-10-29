import { expect, test, type Page } from "@playwright/test";
import releaseLeftoverHolds from "./global-setup";

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

// The build has a made-up Google Ads tag (playwright.live.config.ts). Google's script is replaced
// with nothing, so no test talks to Google; the page's own gtag() still records each call in dataLayer.
// Each request can hold a time, and the site allows only a few unconfirmed holds at once; this suite makes
// more than that across both projects, so every test starts with none (the demo store is a shared local file).
test.beforeEach(async ({ context }) => {
  await releaseLeftoverHolds();
  await context.route("https://www.googletagmanager.com/**", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
});

/**
 * The 3-step booking form at /book (deposits off): package, then the car and you, then a day.
 * Leaves the submit to the caller. `lang: "es"` uses /es/book and the Spanish labels.
 */
async function fillWizard(
  page: Page,
  opts: {
    service: string;
    packageName: string;
    name: string;
    email?: string;
    part?: "Morning" | "Afternoon" | "Either";
    flags?: string[];
    addOns?: string[];
    military?: boolean;
    firstTime?: boolean;
    lang?: "en" | "es";
  },
) {
  const es = opts.lang === "es";
  await page.goto(`${es ? "/es" : ""}/book?service=${opts.service}`);
  const form = page.getByRole("form", { name: es ? "Solicitud de cita" : "Booking request" });
  const next = es ? "Continuar" : "Continue";
  if (opts.service !== "help") await expect(form.getByRole("radio", { name: new RegExp(opts.packageName) })).toBeChecked();
  else await form.getByText(es ? "Ayúdame a elegir" : "Help me choose").click();
  for (const a of opts.addOns ?? []) await form.getByRole("checkbox", { name: new RegExp(a) }).check();
  for (const f of opts.flags ?? []) await form.getByRole("checkbox", { name: f }).check();
  await form.getByRole("button", { name: next }).click();
  await form.getByLabel(es ? /^Año/ : /^Year\b/).fill("2019");
  await form.getByLabel(es ? /^Marca/ : /^Make\b/).fill("Lexus");
  await form.getByLabel(es ? /^Modelo/ : /^Model\b/).fill("IS F");
  await form.getByLabel(es ? "Pueblo o ciudad" : "Town", { exact: true }).selectOption("middleburg");
  await form.getByLabel(es ? "Nombre" : "Name", { exact: true }).fill(opts.name);
  await form.getByLabel(es ? "Teléfono" : "Phone", { exact: true }).fill(phone());
  if (opts.email) await form.getByLabel(es ? /^Correo/ : /^Email/).fill(opts.email);
  if (opts.military) await form.getByRole("checkbox", { name: es ? /Soy militar activo/ : /active military/ }).check();
  if (opts.firstTime) await form.getByRole("checkbox", { name: es ? /primera vez/ : /first-time customer/ }).check();
  await form.getByRole("button", { name: next }).click();
  const group = form.getByRole("radiogroup", { name: es ? "¿En qué parte del día?" : "What part of the day?" });
  await expect(group).toBeVisible();
  const label = { Morning: es ? "Mañana" : "Morning", Afternoon: es ? "Tarde" : "Afternoon", Either: es ? "Cualquiera" : "Either" }[opts.part ?? "Morning"];
  const choice = group.getByRole("radio", { name: label }).or(group.getByRole("radio").first()).first();
  await choice.locator("xpath=..").click();
  await expect(choice).toBeChecked();
  const slot = (await form.locator('input[name="slotStart"]').getAttribute("value"))!;
  // The day strip scrolls inside the form; it must never widen the page on a phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  return { form, slot };
}
async function openSlots(page: Page, service: string): Promise<string[]> {
  const res = await page.request.get(`/api/availability?service=${service}`);
  expect(res.status()).toBe(200);
  const { days } = (await res.json()) as { days: { slots: string[] }[] };
  return days.flatMap((d) => d.slots);
}

test.describe("after launch without deposits (LIVE mode, current production setup)", () => {
  test("Book this package opens /book with the package chosen and every price in step 1", async ({ page }) => {
    await page.goto("/services");
    await page.locator("li#platinum-full").getByRole("link", { name: /Book this package/ }).click();
    await expect(page).toHaveURL(/\/book\?service=platinum-full$/);
    const form = page.getByRole("form", { name: "Booking request" });
    await expect(form.getByRole("radio", { name: /Signature Full Detail/ })).toBeChecked();
    for (const price of ["$90+", "$150+", "$200+", "$89"]) await expect(form).toContainText(price);
    await expect(form.getByRole("radio", { name: /Help me choose/ })).toHaveCount(1);
    await expect(page.getByText("Veteran-owned").first()).toBeVisible();
    await expect(page.getByText("Se habla español").first()).toBeVisible();
    await expect(page.getByText(/Preparing to launch/)).toHaveCount(0);
  });

  test("old /request links forward to /book, keeping the package and the offer", async ({ page }) => {
    await page.goto("/request?service=basic-full&offer=first-time");
    await expect(page).toHaveURL(/\/book\?service=basic-full&offer=first-time$/);
    const form = page.getByRole("form", { name: "Booking request" });
    await expect(form.getByRole("radio", { name: /Basic Package/ })).toBeChecked();
    await expect(form.locator('input[name="firstTimeOffer"]')).toBeChecked();
  });

  test("the header has Message us (prefilled SMS, both languages) and tap-to-call on phones", async ({ page, isMobile }) => {
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Message us" })).toHaveAttribute("href", /^sms:\+1\d{10}\?&body=Hi%20Corsa%2C%20I'd%20like%20a%20quote%20for%20my%20car$/);
    await expect(header.getByRole("link", { name: /Call Corsa at/ })).toHaveCount(isMobile ? 1 : 0);
    await page.goto("/es");
    await expect(page.getByRole("banner").getByRole("link", { name: "Escríbenos" })).toHaveAttribute("href", /body=Hola%20Corsa%2C%20quiero%20una%20cotizaci/);
  });

  test("phones get Call, Text and Book at the bottom; Text opens a prefilled message", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/about");
    const bar = page.getByRole("navigation", { name: "Call, text or book" });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("link", { name: "Call" })).toHaveAttribute("href", /^tel:\+1\d{10}$/);
    await expect(bar.getByRole("link", { name: "Text" })).toHaveAttribute("href", /^sms:\+1\d{10}\?&body=Hi%20Corsa%2C%20I'd%20like%20a%20quote%20for%20my%20car$/);
    await bar.getByRole("link", { name: "Book" }).click();
    await expect(page).toHaveURL(/\/book$/);
    // On a page with the form, Book jumps to it.
    await page.goto("/");
    await page.getByRole("navigation", { name: "Call, text or book" }).getByRole("link", { name: "Book" }).click();
    await expect(page).toHaveURL(/\/#booking-form$/);
  });

  test("the first-time offer pops up once per visit and carries into the booking form", async ({ page }) => {
    await page.goto("/services");
    const offer = page.getByRole("dialog", { name: "10% off your first detail" });
    // It waits until the visitor is halfway down the page (or 25 s).
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(offer).toBeVisible();
    await expect(offer.getByRole("img", { name: "Corsa Auto Detailing" })).toBeVisible();
    const email = `${unique()}@example.com`;
    await offer.getByLabel("First name").fill("Casey");
    await offer.getByLabel("Email").fill(email);
    await offer.getByRole("button", { name: "Send my 10% off" }).click();
    await expect(page.getByRole("dialog", { name: "You're in." })).toBeVisible();
    const { readFile } = await import("node:fs/promises");
    const outbox = JSON.parse(await readFile(".data/demo-outbox.json", "utf8")) as { to: string; subject: string; text: string }[];
    const sent = outbox.find((m) => m.to === email);
    expect(sent?.subject).toBe("Your 10% off at Corsa Auto Detailing");
    expect(sent?.text).toContain("/book?offer=first-time");
    await page.getByRole("dialog").getByRole("link", { name: "Book with 10% off" }).click();
    await expect(page).toHaveURL(/\/book\?offer=first-time$/);
    await expect(offer).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Booking request" }).locator('input[name="firstTimeOffer"]')).toBeChecked();
    // Same visit, another page: it does not come back.
    await page.goto("/about");
    await page.waitForTimeout(2500);
    await expect(offer).toHaveCount(0);
  });

  test("without an email: flags and the military box are saved, the day is held, the customer is told we'll text or call", async ({ page }) => {
    const name = `Riley ${word()}`;
    const { form, slot } = await fillWizard(page, {
      service: "monthly-maintenance",
      packageName: "Corsa Club",
      name,
      flags: ["Pets or pet hair", "Bugs, tar or sap"],
      addOns: ["Headlight restoration"],
      military: true,
    });
    await expect(form.getByRole("group", { name: "Days" })).toBeVisible();
    await expect(form.getByText(/^\d{1,2}:\d{2}/)).toHaveCount(0);
    await form.getByLabel(/Preferred time/).fill("around 9:30");
    await expect(form.getByText(/deposit/i)).toHaveCount(0);
    await form.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=/);
    await expect(page.getByRole("heading", { name: "Request received." })).toBeVisible();
    await expect(page.getByText(/We'll text or call you at \(904\) 555-/)).toBeVisible();
    // Morning unless an earlier run already holds it; then the first open part of the day.
    await expect(page.getByText(/^(Morning|Afternoon|Morning or afternoon), around 9:30$/)).toBeVisible();
    await expect(page.locator("main").getByText("Corsa Club")).toBeVisible();
    expect(await openSlots(page, "monthly-maintenance")).not.toContain(slot);

    // The owner sees the flags and the discount claim.
    await page.goto("/admin/login");
    await page.getByLabel("Password").fill("corsa-demo");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/leads?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name }).first().click();
    await expect(page.getByText("Pets or pet hair, Bugs, tar or sap", { exact: true })).toBeVisible();
    await expect(page.getByText(/Military, veteran or first responder: 10% off/).first()).toBeVisible();
    await expect(page.getByText("Headlight restoration (price at inspection)")).toBeVisible();
  });

  test("in Spanish: Help me choose, then the Spanish confirmation", async ({ page }) => {
    const { form } = await fillWizard(page, { service: "help", packageName: "Ayúdame a elegir", name: `Lucía ${word()}`, lang: "es" });
    await form.getByRole("button", { name: "Enviar mi solicitud" }).click();
    await expect(page).toHaveURL(/\/es\/thanks\/request\?ref=/);
    await expect(page.getByRole("heading", { name: "Recibimos tu solicitud." })).toBeVisible();
    await expect(page.getByText(/Te escribimos o te llamamos al \(904\) 555-/)).toBeVisible();
  });

  test("a mistake on step 2 keeps the customer on step 2 with everything typed", async ({ page }) => {
    await page.goto("/book?service=basic-full");
    const form = page.getByRole("form", { name: "Booking request" });
    await form.getByRole("button", { name: "Continue" }).click();
    const name = `Morgan ${word()}`;
    await form.getByLabel("Name", { exact: true }).fill(name);
    await form.getByLabel(/^Email/).fill("morgan@");
    // The browser's own checks stop it; the server check is covered by unit tests.
    await form.getByRole("button", { name: "Continue" }).click();
    await expect(form.getByRole("radiogroup", { name: "What part of the day?" })).toBeHidden();
    await expect(form.getByLabel("Name", { exact: true })).toHaveValue(name);
  });
});
test.describe("Google Ads conversions (LIVE mode, stubbed tag)", () => {
  /** gtag() calls the page made, as plain arrays. */
  const gtagCalls = (page: Page) =>
    page.evaluate(() => ((window as unknown as { dataLayer?: ArrayLike<unknown>[] }).dataLayer ?? []).map((a) => JSON.parse(JSON.stringify(Array.from(a)))));
  const conversions = async (page: Page, sendTo: string) =>
    (await gtagCalls(page)).filter((c: unknown[]) => c[0] === "event" && c[1] === "conversion" && (c[2] as { send_to?: string }).send_to === sendTo);

  test("the tag loads on public pages and is allowed by the security policy", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.headers()["content-security-policy"]).toContain("https://www.googletagmanager.com");
    await expect(page.locator('script[src*="googletagmanager.com/gtag/js?id=AW-000000000"]')).toBeAttached();
    await expect.poll(async () => (await gtagCalls(page)).some((c: unknown[]) => c[0] === "config" && c[1] === "AW-000000000")).toBe(true);
  });

  test("a booking request counts once it's saved, not before", async ({ page }) => {
    const { form } = await fillWizard(page, { service: "basic-full", packageName: "Basic Package", name: `Ads ${word()}`, part: "Afternoon" });
    expect(await conversions(page, "AW-000000000/e2eLead")).toHaveLength(0);
    await form.getByRole("button", { name: "Send my request" }).click();
    await expect(page).toHaveURL(/\/thanks\/request\?ref=([0-9a-f-]{36})/);
    const ref = new URL(page.url()).searchParams.get("ref");
    const sent = await conversions(page, "AW-000000000/e2eLead");
    expect(sent).toHaveLength(1);
    expect(sent[0][2]).toMatchObject({ transaction_id: ref });
  });

  test("tapping a phone or text link counts as a call/text lead", async ({ page }) => {
    await page.goto("/contact");
    // Keep the browser from trying to dial; the site's own listener still sees the tap.
    await page.evaluate(() => window.addEventListener("click", (e) => (e.target as Element).closest?.('a[href^="tel:"],a[href^="sms:"]') && e.preventDefault(), true));
    await page.locator('main a[href^="tel:"]').first().click();
    await expect.poll(async () => (await conversions(page, "AW-000000000/e2eCall")).length).toBe(1);
  });
});

test.describe("quotes: request, quote, accept (LIVE mode)", () => {
  test("the owner quotes a website request; the customer accepts it and the job is confirmed", async ({ page, browser }, testInfo) => {
    // A customer requests a time on the website, with an email so the quote can be emailed.
    const name = `Quote ${word()}`;
    const email = `${unique()}@example.com`;
    const { form } = await fillWizard(page, { service: "signature-full", packageName: "Essential Full Detail", name, email, firstTime: true });
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
    await expect(page.getByText("First-time customer: 10% off (about $15 off the $150 starting price)")).toBeVisible();
    const quote = page.getByRole("region", { name: "Quote" });
    await expect(quote.getByText("Customer asked for:")).toBeVisible();
    // The arrival time starts at the time held for the request (moving it is covered by unit tests).
    const arrival = quote.getByLabel("Arrival time (Eastern, same day)");
    await expect(arrival).toHaveValue(/^\d{2}:\d{2}$/);
    await quote.getByRole("button", { name: /^\+ Excessive pet-hair removal/ }).click();
    await expect(quote.getByLabel("Line 2 description")).toHaveValue("Excessive pet-hair removal");
    await quote.getByLabel("Discount ($)").fill("10");
    await quote.getByLabel(/What the car needs/).fill("Thanks for choosing Corsa!");
    page.once("dialog", (d) => void d.accept());
    await quote.getByRole("button", { name: "Send quote" }).click();
    await expect(page.getByRole("status")).toContainText(/Quote Q-[A-Z0-9]{6} sent\. Waiting on the customer/);
    await expect(quote).toContainText("Sent. Waiting on the customer");
    await expect(page.getByText("Quote sent · waiting on customer")).toBeVisible();

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

    await expect(page.getByRole("link", { name: "+ New appointment" })).toHaveAttribute("href", "/admin/book");
    const name = `Dash ${word()}`;
    // A free day: each project and run picks its own week and weekday (a 5-hour job has to start by noon to
    // finish inside working hours, so two don't fit in one day). The local test store keeps jobs from earlier
    // runs, so if that day is already taken, try the next week.
    const d = new Date(Date.now() + (8 + 7 * Math.floor(Math.random() * 20)) * 86400_000);
    while (d.getUTCDay() !== (testInfo.project.name.includes("mobile") ? 2 : 3)) d.setUTCDate(d.getUTCDate() + 1);
    for (let attempt = 0; ; attempt++) {
      await page.goto("/admin/book");
      await page.getByRole("radio", { name: "New customer" }).click();
      await page.getByLabel("First name").fill(name);
      await page.getByLabel(/^Email/).fill(`${unique()}@example.com`);
      await page.getByLabel("Service address").fill("45 Oak Ln");
      await page.getByLabel("ZIP").fill("32068");
      await page.getByLabel("Service", { exact: true }).selectOption("platinum-full");
      await expect(page.getByLabel("Price ($)")).toHaveValue("200");
      await page.getByLabel("Date").fill(d.toISOString().slice(0, 10));
      await page.getByLabel("Time (Eastern)").fill("09:30");
      // The form starts on "A quote to accept"; this walk-through books outright.
      await page.getByRole("radio", { name: "Booked now" }).click();
      await page.getByRole("button", { name: "Book appointment" }).click();
      const taken = page.getByText(/overlaps another job/);
      await expect(taken.or(page.getByRole("heading", { name, exact: true }))).toBeVisible();
      if (!(await taken.isVisible()) || attempt >= 5) break;
      d.setUTCDate(d.getUTCDate() + 7);
    }

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
