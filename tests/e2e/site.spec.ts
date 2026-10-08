import { expect, test, type Page } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/services", "/request", "/about", "/service-areas", "/contact", "/privacy", "/terms"];

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
      expect(body).not.toMatch(/lorem ipsum|placeholder|TODO|555-0/i);
    });
  }

  test("primary CTAs and navigation reach their destinations", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Driven by Detail");
    await expect(page.getByText("Preparing to launch").first()).toBeVisible();

    await page.getByRole("link", { name: "Explore services" }).first().click();
    await expect(page).toHaveURL(/\/services$/);

    if (isMobile) {
      await page.getByRole("button", { name: "Menu" }).click();
      await page.getByRole("navigation", { name: "Primary mobile" }).getByRole("link", { name: "Service areas" }).click();
    } else {
      await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Service areas" }).click();
    }
    await expect(page).toHaveURL(/\/service-areas$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Join the launch list" }).first().click();
    await expect(page).toHaveURL(/\/#launch-list$/);
    await expect(page.getByRole("form", { name: "Launch list signup" })).toBeVisible();
  });

  test("mobile menu is keyboard operable", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/about");
    // Located by attribute: its visible label toggles between "Menu" and "Close".
    const button = page.locator("header button[aria-expanded]");
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Primary mobile" }).getByRole("link").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
  });

  test("services page shows every starting price, add-on range and disclosure", async ({ page }) => {
    await page.goto("/services");
    const text = (await page.textContent("main")) ?? "";
    for (const price of ["$90", "$150", "$150/mo", "$125", "$225", "$200"]) expect(text).toContain(price);
    for (const range of ["$35-$75", "$30-$75", "$50-$100", "$50", "$100-$150"]) expect(text).toContain(range);
    expect(text).toMatch(/Planned starting price/);
    expect(text).toMatch(/Most popular/);
    expect(text).toMatch(/Final pricing is subject to an in-person vehicle inspection/);
    expect(text).toMatch(/Any applicable tax will be disclosed/);
  });

  test("town pages render, link to each other, and skip Orange Park", async ({ page, request }) => {
    const towns = ["middleburg", "fleming-island", "green-cove-springs", "st-johns", "orangedale", "world-golf-village", "jacksonville"];
    for (const slug of towns) {
      const res = await page.goto(`/service-areas/${slug}`);
      expect(res?.status(), slug).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/Mobile auto detailing in .+, FL/i);
      await expectNoHorizontalOverflow(page);
    }
    expect((await request.get("/service-areas/orange-park")).status()).toBe(404);
    await page.goto("/service-areas");
    await page.getByRole("link", { name: "Fleming Island" }).first().click();
    await expect(page).toHaveURL(/\/service-areas\/fleming-island$/);
  });

  test("home page shows packages but no prices", async ({ page }) => {
    await page.goto("/");
    const text = (await page.textContent("main")) ?? "";
    expect(text).toContain("Essential Full Detail");
    expect(text).toContain("Signature Full Detail");
    expect(text).toContain("Monthly Maintenance");
    expect(text).not.toMatch(/\$\s?\d/);
    const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("");
    expect(jsonLd).not.toMatch(/"(price|minPrice|priceRange)"/);
    await page.getByRole("link", { name: "See pricing & details" }).first().click();
    await expect(page).toHaveURL(/\/services#signature-full$/);
  });

  test("services page shows every package with one starting price", async ({ page }) => {
    await page.goto("/services");
    for (const [name, price] of [
      ["Basic Package", "$90"],
      ["Essential Full Detail", "$150"],
      ["Signature Full Detail", "$200"],
      ["Monthly Maintenance", "$150/mo"],
      ["Essential Interior Detail", "$125"],
      ["Signature Interior Detail", "$225"],

      ["Essential Exterior Detail", "$125"],
      ["Signature Exterior Detail", "$200"],

    ]) {
      await expect(page.locator("article", { has: page.getByRole("heading", { name, exact: true }) })).toContainText(price);
    }
    await expect(page.locator("main")).not.toContainText("Coupe or sedan");
  });

  test("instant quote shows the starting price for the chosen package", async ({ page }) => {
    await page.goto("/services#quote");
    await page.getByLabel("Service", { exact: true }).selectOption("wax-and-buff");
    await expect(page.locator("#quote")).toContainText("$200");
  });

  test("before launch, package buttons ask for an email with the package pre-filled (no booking)", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("link", { name: "Book now" })).toHaveCount(0);
    // Second card is Signature.
    await page.locator("article").getByRole("link", { name: "Get launch updates" }).nth(1).click();
    await expect(page).toHaveURL(/\/request\?service=platinum-full$/);
    await expect(page.getByRole("form", { name: "Service request" })).toHaveCount(0);
    const form = page.getByRole("form", { name: "Launch list signup" });
    await expect(form.getByLabel(/Service you're interested in/)).toHaveValue("platinum-full");

    await page.goto("/");
    await page.locator("article").getByRole("link", { name: "Get launch updates" }).first().click();
    await expect(page).toHaveURL(/\/request\?service=signature-full$/);
    await expect(page.getByRole("form", { name: "Launch list signup" }).getByLabel(/Service you're interested in/)).toHaveValue("signature-full");
  });

  test("old maintenance-plans links land on the Monthly Maintenance package", async ({ page }) => {
    await page.goto("/maintenance-plans");
    await expect(page).toHaveURL(/\/services#monthly-maintenance$/);
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

  test("robots and sitemap exclude private routes", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Disallow: \/admin/);
    expect(robots).toMatch(/Disallow: \/thanks/);
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/services");
    expect(sitemap).toContain("/service-areas/fleming-island");
    expect(sitemap).not.toContain("/service-areas/orange-park");
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/thanks");
  });
});
