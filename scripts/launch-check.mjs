#!/usr/bin/env node
/**
 * Launch readiness check. Run against the environment you're about to deploy:
 *   npm run launch-check
 * Exits non-zero if the configuration would run the public site in demo mode
 * or without the pieces needed to actually receive and act on leads.
 */
import { readFileSync, existsSync } from "node:fs";

// Load .env.local / .env if present (simple parser; no dependency).
for (const file of [".env", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const env = (k) => (process.env[k] ?? "").trim();
const checks = [
  ["Durable lead store (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)", env("SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY")],
  ["Demo store override is NOT enabled", env("ALLOW_DEMO_STORE") !== "true"],
  ["Owner auth (NEXT_PUBLIC_SUPABASE_URL + ANON_KEY + ADMIN_EMAILS)", env("NEXT_PUBLIC_SUPABASE_URL") && env("NEXT_PUBLIC_SUPABASE_ANON_KEY") && env("ADMIN_EMAILS")],
  ["Email provider (RESEND_API_KEY + EMAIL_FROM)", env("RESEND_API_KEY") && env("EMAIL_FROM")],
  ["Owner alert address (OWNER_NOTIFY_EMAIL)", env("OWNER_NOTIFY_EMAIL")],
  ["Public contact email (NEXT_PUBLIC_CONTACT_EMAIL)", env("NEXT_PUBLIC_CONTACT_EMAIL")],
  ["Canonical https URL (NEXT_PUBLIC_SITE_URL)", env("NEXT_PUBLIC_SITE_URL").startsWith("https://")],
  ["Site env is production (NEXT_PUBLIC_SITE_ENV)", env("NEXT_PUBLIC_SITE_ENV") !== "staging"],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
}
console.log(`\nBusiness mode: ${env("NEXT_PUBLIC_BUSINESS_MODE") || "PRELAUNCH"}; launch date: ${env("NEXT_PUBLIC_LAUNCH_DATE") || "(none)"}`);
if (failed) {
  console.error(`\n${failed} check(s) failed. Do not launch publicly with this configuration.`);
  process.exit(1);
}
console.log("\nConfiguration looks launch-ready. Complete LAUNCH_CHECKLIST.md before switching DNS.");
