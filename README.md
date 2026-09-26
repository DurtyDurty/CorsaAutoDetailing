# Corsa Auto Detailing — website

Prelaunch lead-generation site and owner dashboard for a mobile auto detailing startup in Clay County, Florida.

- **Stack:** Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, Zod 4, Supabase (Postgres + Auth + Storage), Resend (email via REST), Vitest, Playwright.
- **Brand name is provisional.** Everything public about the business lives in [`src/config/business.ts`](src/config/business.ts) and `.env` — change it there, not in page copy.

## Quick start

```bash
npm install
cp .env.example .env.local      # then set DEMO_ADMIN_PASSWORD=anything for local admin access
npm run dev                      # http://localhost:3000
```

With no Supabase/Resend credentials the app runs in **demo mode**:

- Leads are saved to `.data/demo-store.json` (git-ignored).
- Emails are written to `.data/demo-outbox.json` instead of being sent.
- `/admin` accepts the single `DEMO_ADMIN_PASSWORD`.
- A yellow "DEMO MODE" bar shows in the dashboard.

Demo mode is refused when `NODE_ENV=production` unless `ALLOW_DEMO_STORE=true` is set explicitly; without a durable store the public forms fail closed with a "temporarily unavailable" notice. `npm run launch-check` and `GET /api/health` both report this.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript + React Compiler rules) |
| `npm run typecheck` | Generates Next route types, then `tsc --noEmit` |
| `npm test` | Vitest unit tests (pricing, ZIP rules, Eastern time, CSV, validation, intake pipeline) |
| `npm run test:e2e` | Production build + Playwright at 360px, 390px and 1440px (first run: `npx playwright install chromium`) |
| `npm run check` | lint + typecheck + unit tests |
| `npm run launch-check` | Fails if the environment would run the public site in demo mode or without email/auth |

## Project layout

```
src/config/business.ts      Single source of truth: brand, owner, contact, mode, services, prices, areas, flags
src/app/(site)/             Public routes: /, /services, /request, /maintenance-plans, /about, /service-areas,
                            /contact, /privacy, /terms, /thanks/[kind]
src/app/admin/              Owner dashboard (server-enforced auth on every page/action/route)
src/app/actions/leads.ts    Server actions for the four public forms
src/app/api/health          Readiness check (full detail only for owner or non-production)
src/app/api/cron/...        Notification retry endpoint (CRON_SECRET)
src/lib/leads/              LeadStore interface + Supabase and demo implementations + intake pipeline
src/lib/email/              Email adapter (Resend REST / demo outbox / disabled)
src/lib/notifications.ts    Owner alert + customer acknowledgement, retryable, logged per lead
src/lib/validation.ts       Zod schemas (server-side validation for every form)
src/lib/pricing.ts          Estimate computation from config only; condition/travel never change price
src/lib/time.ts             America/New_York helpers, work-hours and overlap checks
src/lib/photos.ts           Optional private photo uploads (content-sniffed, re-encoded, EXIF stripped)
src/lib/auth/owner.ts       Owner session (Supabase Auth + ADMIN_EMAILS, or demo password)
src/lib/analytics.ts        Client event adapter with a strict no-PII property allow-list
supabase/migrations/        Schema, RLS (deny-all for anon/authenticated), private storage bucket
tests/unit, tests/e2e       Vitest and Playwright suites
docs/SETUP.md               Provider setup (Supabase, Resend, analytics, cron, deployment)
OWNER_DECISIONS.md          Open business decisions the site is waiting on
LAUNCH_CHECKLIST.md         Steps before the site goes public and before switching to LIVE mode
```

## Business modes

`NEXT_PUBLIC_BUSINESS_MODE` (default `PRELAUNCH`):

- **PRELAUNCH** — banner "Preparing to launch", primary CTA "Join the launch list", prices labelled "Planned starting prices", request form saves details but states appointments aren't confirmed, admin cannot confirm appointments, date preferences are refused until `NEXT_PUBLIC_LAUNCH_DATE` is set.
- **LIVE** — primary CTA "Request an appointment", admin can confirm appointments (customer-agreement checkbox, work-hours and travel-buffer conflict checks), completed jobs record revenue.

A submitted request is never presented as a confirmed appointment in either mode.

## Data flow (public form → owner)

1. Client form (multi-step for quotes) posts to a server action via `startTransition`, carrying a per-visitor idempotency key, a honeypot field and sanitised attribution.
2. `intake()` — rate limit (hashed IP, in-memory) → honeypot → Zod validation → **durable save** → notifications.
3. Notifications are recorded per lead (`notification_log`) and attempted; failure never affects the saved lead and can be retried from the lead page or `POST /api/cron/retry-notifications`.
4. The confirmation page looks the lead up by ID and shows success only if it exists.

## Deployment

Any Node host works (Vercel, Fly, Render, a VPS). See [docs/SETUP.md](docs/SETUP.md) for Supabase, Resend, analytics and environment setup, and [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) before going public. Nothing in this repo purchases services, registers domains or sends live messages on its own.

## Logo assets

No logo files were supplied in this repository, so the site uses a typographic wordmark (`src/components/site/Wordmark.tsx`). Drop SVG/PNG files into `public/brand/` and set the paths in `business.brand.logos` to switch; the light/dark variants are chosen automatically by background.
