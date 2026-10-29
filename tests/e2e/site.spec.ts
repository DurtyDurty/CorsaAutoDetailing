import { expect, test, type Page } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/es", "/services", "/request", "/about", "/service-areas", "/es/service-areas/middleburg", "/contact", "/privacy", "/terms"];

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "horizontal overflow px").toBeLessThanOrEqual(1);
}

test.describe("public site", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route} without overflow, broken images or placeholder links`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expectNoHorizontalOverflow(page);
      const brokenImages = await page.$$eval("img", (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length);
      expect(brokenImages).toBe(0);
      const hashLinks = await page.$$eval('a[href="#"]', (a) => a.length);
      expect(hashLinks).toBe(0);
      const body = await page.textContent("body");
      expect(body).not.toMatch(/lorem ipsum|placeholder|555-0/i);
      // Case-sensitive: Spanish copy says "todo" (everything).
      expect(body).not.toContain("TODO");
      // Site copy rule (owner, 2026-10-28): no em dashes.
      expect(body).not.toContain("—");
    });
  }

  test("primary CTAs and navigation reach their destinations", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pit-crew detailing");
    await expect(page.getByText("Preparing to launch").first()).toBeVisible();

    if (isMobile) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("navigation", { name: "Primary mobile" }).getByRole("link", { name: "Service area" }).click();
    } else {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Service area" }).click();
    }
    await expect(page).toHaveURL(/\/#service-area$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Join the launch list" }).first().click();
    await expect(page).toHaveURL(/\/#launch-list$/);
    await expect(page.getByRole("form", { name: "Launch list signup" })).toBeVisible();
  });

  test("mobile menu is keyboard operable", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/about");
    // Located by attribute: its accessible name toggles between "Menu" and "Close".
    const button = page.locator("header button[aria-expanded]");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Primary mobile" }).getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  // Message us and tap-to-call need the business phone: covered by the LIVE suite.
  test("the header switches between English and Spanish", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: /Ver esta página en español/ }).click();
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.locator("main [lang=es]").first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Detallado con precisión de pits");
    await page.getByRole("banner").getByRole("link", { name: /View this page in English/ }).click();
    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/$/);
  });

  test("home and Spanish home link to each other with hreflang", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute("href", /\/es$/);
    await page.goto("/es");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/es$/);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);
  });

  test("services page shows every starting price, add-on range and disclosure", async ({ page }) => {
    await page.goto("/services");
    const text = (await page.textContent("main")) ?? "";
    for (const price of ["$90", "$150", "$200", "$89"]) expect(text).toContain(price);
    for (const range of ["$35-$75", "$30-$75", "$50-$100"]) expect(text).toContain(range);
    expect(text).toMatch(/Planned starting price/);
    expect(text).toMatch(/Most popular/);
    expect(text).toMatch(/Final pricing is subject to an in-person vehicle inspection/);
    expect(text).toMatch(/Any applicable tax will be disclosed/);
  });

  test("town pages render in both languages, link to each other, and skip Orange Park", async ({ page, request }) => {
    const towns = ["middleburg", "fleming-island", "green-cove-springs", "st-johns", "orangedale", "world-golf-village", "jacksonville"];
    for (const slug of towns) {
      const res = await page.goto(`/service-areas/${slug}`);
      expect(res?.status(), slug).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/Mobile auto detailing in .+, FL/i);
      await expectNoHorizontalOverflow(page);
    }
    expect((await request.get("/es/service-areas/fleming-island")).status()).toBe(200);
    expect((await request.get("/service-areas/orange-park")).status()).toBe(404);
    await page.goto("/service-areas");
    await page.getByRole("link", { name: "Fleming Island" }).first().click();
    await expect(page).toHaveURL(/\/service-areas\/fleming-island$/);
  });

  test("home page: packages with prices, Essential marked most popular, Corsa Club, FAQ markup and the slideshow", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    for (const [id, price] of [
      ["basic-full", "$90"],
      ["signature-full", "$150"],
      ["platinum-full", "$200"],
    ]) {
      await expect(main.locator(`#packages li#${id}`)).toContainText(price);
    }
    await expect(main.locator("#packages li#signature-full")).toContainText("Most popular");
    await expect(main.locator("#packages")).not.toContainText("Monthly Maintenance");
    await expect(main.locator("#corsa-club")).toContainText("$89 a visit");
    // The full "what's included" list is in the page (for search engines) behind a disclosure.
    await expect(main.locator("#packages li#signature-full details")).toContainText("Door jambs wiped clean");
    await expect(main.getByRole("heading", { level: 1 }).locator("..")).toContainText("Orange Park");
    // Fewer than 3 real reviews: no reviews section and no rating markup.
    await expect(main.locator("#reviews")).toHaveCount(0);
    const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("");
    expect(jsonLd).not.toMatch(/"(price|minPrice|priceRange|aggregateRating)"/);
    expect(jsonLd).toContain('"FAQPage"');
    expect(jsonLd).toContain('"AutoWash"');
    // Hero slideshow: 4 photos plus the animated logo, a pause button, and bars that jump to a slide.
    const slideshow = main.getByRole("region", { name: "Photos of our work" });
    await expect(slideshow.locator('[aria-roledescription="slide"]')).toHaveCount(5);
    await expect(slideshow.locator('img[alt="Corsa Auto Detailing logo"]')).toHaveCount(1);
    await slideshow.getByRole("button", { name: "Pause slideshow" }).click();
    await expect(slideshow.getByRole("button", { name: "Play slideshow" })).toBeVisible();
    const third = slideshow.getByRole("button", { name: /^Show slide 3:/ });
    await third.click();
    await expect(third).toHaveAttribute("aria-current", "true");
  });

  test("the before/after photo flips when tapped", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("#gallery").getByRole("button", { name: /Front seat and console/ });
    await expect(card).toHaveAttribute("aria-pressed", "false");
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(card).toContainText("After");
  });

  test("services page shows every package with one starting price", async ({ page }) => {
    await page.goto("/services");
    for (const [id, price] of [
      ["basic-full", "$90"],
      ["signature-full", "$150"],
      ["platinum-full", "$200"],
    ]) {
      await expect(page.locator(`li#${id}`)).toContainText(price);
    }
    await expect(page.locator("#corsa-club")).toContainText("$89");
    await expect(page.locator("main")).not.toContainText("Coupe or sedan");
  });

  test("instant quote shows the starting price for the chosen package", async ({ page }) => {
    await page.goto("/services#quote");
    await page.getByLabel("Service", { exact: true }).selectOption("platinum-full");
    await expect(page.locator("#quote")).toContainText("$200");
  });

  test("before launch, package buttons ask for an email with the package pre-filled (no booking)", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("link", { name: /Book this package/ })).toHaveCount(0);
    await page.locator("li#platinum-full").getByRole("link", { name: /Get launch updates/ }).click();
    await expect(page).toHaveURL(/\/request\?service=platinum-full$/);
    await expect(page.getByRole("form", { name: "Booking request" })).toHaveCount(0);
    const form = page.getByRole("form", { name: "Launch list signup" });
    await expect(form.getByLabel(/Service you're interested in/)).toHaveValue("platinum-full");

    await page.goto("/");
    await page.locator("li#basic-full").getByRole("link", { name: /Get launch updates/ }).click();
    await expect(page).toHaveURL(/\/request\?service=basic-full$/);
    await expect(page.getByRole("form", { name: "Launch list signup" }).getByLabel(/Service you're interested in/)).toHaveValue("basic-full");
  });

  test("old maintenance-plans links land on Corsa Club", async ({ page }) => {
    await page.goto("/maintenance-plans");
    await expect(page).toHaveURL(/\/#corsa-club$/);
  });

  test("admin, export and photos are locked without a session", async ({ request, page }) => {
    const exp = await request.get("/admin/export");
    expect(exp.status()).toBe(401);
    const photo = await request.get("/admin/photos?ref=leads/x/1.jpg");
    expect(photo.status()).toBe(401);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin/leads/00000000-0000-4000-8000-000000000000");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("robots and sitemap exclude private routes and list the Spanish pages", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).toMatch(/Disallow: \/thanks/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/services");
    expect(sitemap).toContain("/service-areas/fleming-island");
    expect(sitemap).toContain("/es/service-areas/fleming-island");
    expect(sitemap).toContain('hreflang="es"');
    expect(sitemap).not.toContain("/service-areas/orange-park");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/thanks");
  });
});
