# Corsa owner app: audit and plan

Status (2026-10-01): Phase A (audit) and Phase B (shared contract, owner API, workflow migration) complete. Phase C next.

## Phase B delivered

- `shared/`: `appointment-status.ts` (transitions, blocking statuses), `money.ts` (balance math), `api.ts` (Zod schemas + response types), `brand.ts`.
- Migration `0006_owner_app.sql` applied to the live database: new statuses (en_route, arrived, in_progress, no_show, declined), cancel reason / cancelled by, discount, `appointment_events` (audit), `payments` (ledger).
- Bearer auth (`src/lib/auth/api-session.ts`): the server signs in to Supabase for the app, only for `ADMIN_EMAILS`, and re-verifies the token on every request. Sign out one device or all.
- Endpoints under `/api/owner/v1`: `POST/DELETE session`, `POST session/refresh`, `GET me`, `GET summary`, `GET appointments` (range, status filter, cursor paging), `GET appointments/:id`, `POST appointments/:id/status`.
- Service layer `src/lib/owner/*` used by the API; dashboard confirm/complete/cancel and the online booking flow now write audit events too.
- Tests: status rules, balance math, API authorization (no/forged/tampered/refresh-as-access tokens, rate limit, malformed input) and workflow (idempotent retries, invalid steps, history).
- Changed from the original plan: customers and vehicles move to Phase E (where their screens are built); push tokens to Phase F.

## 1. Existing stack and architecture

| Area | What exists | Where |
|---|---|---|
| Web | Next.js 16 (App Router), React 19, TypeScript strict, Tailwind 4. Single app at the repo root, deployed to Vercel on every push to `main`. | `src/app` |
| Database | Supabase Postgres. Tables: `leads`, `appointments`, `notification_log`, `time_off`, `outbound_emails`. RLS on with **no policies**: only the server (service-role key) can read or write. | `supabase/migrations/0001–0005` |
| Data access | `LeadStore` interface with a Supabase implementation and a file-backed demo store (local dev, e2e). No ORM. | `src/lib/leads/*` |
| Auth | Supabase Auth email + password. Authorization = signed-in email listed in `ADMIN_EMAILS`. Demo password mode outside production. Cookie sessions only. | `src/lib/auth/owner.ts` |
| Owner dashboard | `/admin`: leads list and detail, appointments, time off, launch list, CSV export, email a lead. Mutations are **server actions** (not callable from a phone app). | `src/app/admin/*` |
| Booking | Website request form → lead (stage `new`). Owner confirms an appointment from the dashboard. Online deposit booking (calendar + Stripe Checkout) is built but **off**: no Stripe keys in production, and no deposit/duration per package. | `src/app/actions/leads.ts`, `src/lib/booking.ts`, `src/lib/availability.ts` |
| Conflict detection | Postgres exclusion constraint on `[starts_at, ends_at + buffer)` for active appointments; `book_online_slot` RPC; slot math in `availability.ts`. | `0003`, `0004` |
| Pricing | Config-driven, 7 packages with one starting price each, estimate snapshot stored on each lead. | `src/config/business.ts`, `src/lib/pricing.ts` |
| Payments | Stripe adapter (Checkout, retrieve, expire, refund) + signed, idempotent webhook. Deposits only; no balance payments. | `src/lib/payments.ts`, `src/app/api/stripe/webhook` |
| Email | Resend over REST, idempotency keys, demo outbox. Outbound only: owner notification, customer acknowledgment, owner-written emails (logged in `outbound_emails`). Customer replies go to `NEXT_PUBLIC_CONTACT_EMAIL` (the owner's mailbox), **not** into the system. | `src/lib/email`, `src/lib/notifications.ts` |
| Notifications | Email to `OWNER_NOTIFY_EMAIL` per lead; retry cron. No push. | `src/app/api/cron/retry-notifications` |
| API routes | `availability` (public), `health`, `cron/retry-notifications`, `stripe/webhook`. No owner API. | `src/app/api` |
| Brand | Vector logo (`public/brand/logo-master.svg`, dark/light variants), icons. Colors and fonts defined as Tailwind tokens. | `public/brand`, `src/app/globals.css` |
| Tests | Vitest (46 unit), Playwright (pre-launch and LIVE suites). | `tests/` |

Not a monorepo. No mobile code.

## 2. Reusable systems

- `LeadStore` and its Supabase implementation, including the atomic slot booking and conflict constraint.
- Pricing and estimate snapshot, availability/slot math, Eastern-time helpers.
- Resend adapter with idempotency; outbound email log with per-send keys (prevents duplicate sends).
- Stripe adapter and webhook (for when deposits or payment links are turned on).
- Zod validation patterns, rate limiter, CSV export.
- Supabase Auth: the phone can sign in with the same owner account.

## 3. Missing backend capabilities

1. **Owner API for the app.** Dashboard logic lives in server actions. Needed: authenticated REST endpoints (`/api/owner/v1/...`) that call the same service functions the dashboard uses.
2. **Bearer-token auth.** Server must accept a Supabase access token from the app, verify it with Supabase, and check `ADMIN_EMAILS` (later a staff table) on every request.
3. **Appointment workflow.** Statuses today: `held / confirmed / completed / cancelled`. Needed: en route, arrived, in progress, no-show, declined, cancel reason and who cancelled, plus a timestamped **audit log**.
4. **Payments beyond deposits.** No record of balances or final payments. Needed: a `payments` ledger (deposit, balance, refund; method; amount; who recorded it).
5. **Customers and vehicles.** A "customer" is currently one lead per request. Needed: a `customers` table (one per person, linked from leads by email) and `vehicles` (adds color).
6. **Inbound messages.** Replies never reach the system. Needs an inbound email route (Resend inbound on a reply subdomain) before an in-app inbox can show replies. Website contact-form messages already exist as leads and can appear in the inbox now.
7. **Push notifications.** Device token table, Expo push sending, de-duplication, preferences.
8. **Settings in the database.** Working hours, buffer, confirmation mode and similar values are in code (`business.ts`). App-editable settings need a settings table; code stays the default.
9. **Roles.** Only `ADMIN_EMAILS`. Needed later: `staff_members` with owner/manager/detailer/read-only.
10. Not present and not needed for v1: SMS provider (texting uses the phone's Messages app), weather, travel-time API (navigation opens Apple/Google Maps).

## 4. Recommended mobile architecture

- **Expo (React Native) + TypeScript + Expo Router**, TanStack Query, Zustand only for small local state, React Hook Form + Zod, Expo SecureStore, Expo Notifications, Sentry-compatible error reporting.
- **Same backend and database.** The app talks only to `https://corsaautodetailing.com/api/owner/v1/*`. It never gets the Supabase service-role key; the anon key it uses for sign-in is public by design, and RLS still denies it every table.
- **Freshness:** refetch on focus and every 30 s while open; push notifications trigger an immediate refetch. (Supabase Realtime would require opening RLS to clients, which this design avoids.)
- **Offline:** cache today's and the next 7 days' appointments; cleared on sign-out.

### Repo layout: mobile app beside the website, not a full monorepo

Moving the website into `apps/web` would change the Vercel root directory and risk the live site. Instead:

```
/                 existing Next.js site (unchanged location)
/shared           pure TypeScript shared by web and app: DTO types, Zod schemas,
                  appointment status rules, money/balance math, brand tokens
/mobile           Expo app, its own package.json and lockfile
```

The website imports `shared/` through a TS path alias; the app through Metro `watchFolders`. Web tsconfig, ESLint and Vitest exclude `mobile/`. React Native and the website keep separate `node_modules`, so their React versions can't clash.

## 5. File and folder plan

```
shared/
  types.ts              API request/response types
  schemas.ts            Zod schemas (validated on both sides)
  appointment-status.ts allowed transitions, labels
  money.ts              subtotal, deposit, balance
  brand.ts              colors, spacing, radii, type scale
src/lib/owner/          service layer used by server actions AND the API
src/app/api/owner/v1/   session, summary, appointments, customers, vehicles,
                        conversations, templates, payments, push-tokens, settings, analytics
mobile/
  app/                  (auth)/sign-in; (tabs)/today|calendar|inbox|customers|more;
                        appointment/[id]; customer/[id]; conversation/[id]
  src/api/              fetch client, query keys, hooks
  src/features/         today, calendar, appointments, inbox, customers, settings
  src/design/           tokens + components (Button, Card, StatusPill, Sheet, …)
  src/lib/              session (SecureStore), push, native links (call, text, maps)
```

## 6. Database changes (migration `0006_owner_app.sql`, additive only)

- `customers` (email unique, name, phone, preferred contact, notes, private flag); `leads.customer_id` backfilled by email.
- `vehicles` (customer, year, make, model, color, size).
- `appointments`: wider status check (`en_route`, `arrived`, `in_progress`, `no_show`, `declined`), `cancel_reason`, `cancelled_by`, `vehicle_id`, `discount_cents`.
- `appointment_events` (audit: actor, from, to, note, time).
- `payments` (appointment, kind, method, amount, status, provider ref, recorded by).
- `push_tokens` (owner, Expo token unique, platform, last seen, revoked).
- Later phases: `messages` (inbound/outbound, read, flagged, archived), `message_templates`, `business_settings`, `staff_members`.

All existing columns stay. Existing statuses keep their meaning. RLS stays on with no client policies.

## 7. Implementation risks

- **Live site.** Every push deploys. New API routes are additive; migrations must be applied to the live database *before* code that depends on them deploys.
- **Can't fully verify on this machine.** Windows: no iOS simulator. iOS builds go through EAS cloud builds and need an Apple Developer account. UI checks rely on a device or Android emulator.
- **Duplicate logic.** Dashboard actions must be refactored into the shared service layer, or web and app will drift.
- **PII on the phone.** Cached appointments include names and addresses; keep the cache small and wipe it on sign-out.
- **Rate limiting** is in-memory per server instance; fine for one owner, weak against abuse.
- **Scope.** This is several weeks of work; each phase ends with lint, type check and tests.

## 8. Phase A execution plan (done) and next

Phase A: audit (this document).
Phase B: `shared/`, owner service layer, Bearer auth, `/api/owner/v1` session + summary + appointments, migration 0006, authorization tests.
Phase C: Expo scaffold, design system, sign-in, Today.
Phase D: calendar, appointment detail, confirm/decline/reschedule/status workflow.
Phase E: inbox (website messages + email history; inbound replies once the reply domain exists), templates, customers.
Phase F: payments ledger, push notifications, analytics, settings.
Phase G: tests, accessibility, security review, build and store documentation.

## Owner decisions (2026-10-01)

- **Platform:** iPhone first (EAS cloud builds; Apple Developer account needed for device installs and the App Store).
- **Inbox replies:** yes. Outbound email gets a reply address on a mail subdomain; replies arrive through Resend inbound. Owner adds the DNS records.
- **Final payments:** card on a reader, cash, or digital payments (Zelle, Venmo, Cash App and similar), recorded in the app. No Stripe payment links for now.
- **Database migrations:** applied to the live database right before the code that needs them deploys.
