import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end checks against the production build in demo mode.
 * `npm run test:e2e` builds, starts, and runs these.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 120_000,
    // `next start` runs with NODE_ENV=production, so the demo store must be allowed explicitly for e2e.
    // FORM_RATE_LIMIT: the suite submits the same form many times from one IP.
    env: { DEMO_ADMIN_PASSWORD: "corsa-demo", ALLOW_DEMO_STORE: "true", NEXT_PUBLIC_ANALYTICS_PROVIDER: "none", FORM_RATE_LIMIT: "200" },
  },
  projects: [
    { name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } } },
    // iPhone-sized viewport with Chromium emulation (WebKit is not installed by default).
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
