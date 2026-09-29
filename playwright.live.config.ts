import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks for the booking flow as it will run after launch
 * (NEXT_PUBLIC_BUSINESS_MODE=LIVE). NEXT_PUBLIC_* values are baked in at build
 * time, so this config builds its own copy into .next-live and serves it on 3101.
 * Run with `npm run test:e2e` (both suites) or `npx playwright test -c playwright.live.config.ts`.
 */
const env = {
  NEXT_DIST_DIR: ".next-live",
  NEXT_PUBLIC_BUSINESS_MODE: "LIVE",
  NEXT_PUBLIC_ANALYTICS_PROVIDER: "none",
  DEMO_ADMIN_PASSWORD: "corsa-demo",
  ALLOW_DEMO_STORE: "true",
  FORM_RATE_LIMIT: "200",
};

export default defineConfig({
  testDir: "tests/e2e-live",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3101",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next build && npx next start -p 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 300_000,
    env,
  },
  projects: [
    { name: "live-mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "live-desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
