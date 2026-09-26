import { expect, test, type Page } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/services", "/request", "/maintenance-plans", "/about", "/service-areas", "/contact", "/privacy", "/terms"];

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
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thoughtful car care");
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

  test("services page shows every planned base price", async ({ page }) => {
    await page.goto("/services");
    const text = (await page.textContent("main")) ?? "";
    for (const price of ["$79", "$89", "$109", "$129", "$149"]) expect(text).toContain(price);
    expect(text).toMatch(/Planned starting prices/);
    expect(text).toMatch(/Any applicable tax will be disclosed/);
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
    expect(sitemap).not.toContain("/admin");
    expect(sitemap).not.toContain("/thanks");
  });
});
