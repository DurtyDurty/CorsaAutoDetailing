# Setup & integrations

## Environment variables

See `.env.example` for the full list with comments. Summary of how the app chooses its mode:

| Condition | Lead store | Email | Admin auth |
| --- | --- | --- | --- |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set | Supabase | — | — |
| `RESEND_API_KEY` + `EMAIL_FROM` set | — | Resend | — |
| `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `ADMIN_EMAILS` set | — | — | Supabase Auth |
| None of the above, `NODE_ENV != production` | demo file | demo outbox | `DEMO_ADMIN_PASSWORD` |
| None of the above, `NODE_ENV = production` | **unavailable** (forms fail closed) | skipped (logged) | unavailable |

`ALLOW_DEMO_STORE=true` forces the demo store in a production build. It exists for running the Playwright suite against `next start`; never set it on a real deployment.

## Supabase

1. Create a project. Run `supabase/migrations/0001_init.sql`.
2. **Authorization model.** The app uses the service-role key from server code only (`src/lib/leads/supabase-store.ts`, `src/lib/photos.ts`, sign-out in `src/lib/auth/api-session.ts`). Tables have RLS enabled with no policies and explicit `REVOKE` for `anon`/`authenticated` (run every file in `supabase/migrations/` in order, including `0009_harden_grants.sql`), so the public anon key cannot read or write leads. The anon key is only used by server code for sign-in; it is still a public value, not a secret.
3. **Owner auth.** Supabase Auth email+password. Authorization is *not* "any signed-in user": `src/lib/auth/owner.ts` checks the user's email against `ADMIN_EMAILS` and, when `ADMIN_USER_IDS` is set, the account id too. **Signups must be off** (Supabase → Authentication → Sign In / Providers → "Allow new users to sign up"), with "Confirm email" on: otherwise anyone could create an account for an allowed address that has none yet. `supabase/config.toml` carries the same settings so a `supabase config push` can't undo them. Sign-in attempts are throttled per client and per account, but only in memory per server instance: use a long unique password and turn on MFA for the Supabase, Vercel, GitHub, Google and Expo accounts.
4. **Photos.** The migration creates a private bucket `lead-photos`. Set `SUPABASE_STORAGE_BUCKET=lead-photos` to show the upload control. Uploads are content-sniffed (JPEG/PNG/WebP only), decoded and re-encoded with `sharp` (strips EXIF/GPS, caps at 2000px), and stored under `leads/<lead-id>/<n>.jpg`. The dashboard opens them via 5-minute signed URLs through `/admin/photos?ref=…`, which re-checks the owner session.

## Resend

1. Verify your domain (SPF + DKIM). Use a `From` on that domain, e.g. `Corsa Auto Detailing <hello@yourdomain.com>`.
2. The adapter (`src/lib/email/index.ts`) calls the REST API directly; no SDK.
3. Two messages per lead: owner alert (reply-to = customer) and customer acknowledgement (reply-to = public contact email). Internal notes are never included. The acknowledgement never confirms an appointment.
4. Failures are recorded in `notification_log` with the error message; retry from the lead page or via cron.

## Quotes

Website requests are answered with a quote (dashboard job page, or the owner app). Needs `supabase/migrations/0010_quotes.sql`.

- The customer gets an email with the quote as a PDF (`src/lib/quotes/pdf.ts`, drawn with pdf-lib: no HTML, nothing fetched) and a private link, `/quote/<token>`. Accepting confirms the job at the quoted price; declining releases the time.
- The token is 256 random bits. The database keeps only its sha256, and the email log keeps the message with the link removed.
- While a quote is open the requested time stays held, until the quote expires (never past the start time). Sending a revised quote, declining the request, or moving it withdraws the open quote.
- `/quote/*` is outside the site layout (no analytics), `no-store`, `noindex`, and sends no referrer.

## Cron: notification retries

`POST /api/cron/retry-notifications` with header `Authorization: Bearer <CRON_SECRET>`. Returns `{ retried: n }`. Disabled when `CRON_SECRET` is unset. Vercel Cron, GitHub Actions, or any scheduler works.

## Rate limiting

`src/lib/rate-limit.ts` keeps a sliding window (6 submissions / 10 min) per hashed IP **in process memory**. On a single always-on Node host this is a true limit; on serverless it is per warm instance. Limits that matter are therefore counted from saved rows instead, so they hold across instances: at most 3 acknowledgement emails per address per hour (5 per day), at most 2 unconfirmed calendar holds per customer and 6 overall (`business.booking.maxOpenRequests`), and caps on what mail to the reply domain can create (`src/lib/inbound.ts`). The unique `idempotency_key` (prevents duplicate rows from retries) and honeypot rejection apply as well. If abuse becomes real, swap the map for Upstash Redis or a Postgres table — the function signature is designed for that.

## Analytics

`NEXT_PUBLIC_ANALYTICS_PROVIDER`:

- `none` (default) — nothing loads.
- `console` — logs events to the browser console (dev).
- `plausible` — loads `https://plausible.io/js/script.js` for `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` (cookieless; no consent banner needed under most interpretations, but confirm for your situation).

Events: `service_viewed`, `pricing_vehicle_selected`, `lead_form_started`, `lead_form_submitted` (only after durable save), `membership_interest_submitted`, `contact_clicked`. Properties are filtered through an allow-list in `src/lib/analytics.ts`; strings containing `@` or longer than 60 chars are dropped. Nothing personal is ever sent.

The CSP in `next.config.ts` allows `plausible.io` for scripts and connections. Add other hosts there if you change provider.

## Security headers / CSP

`next.config.ts` sets nosniff, frame-ancestors none, referrer policy, permissions policy, and a CSP. `script-src` includes `'unsafe-inline'` because Next's runtime injects inline bootstrap scripts; moving to nonce-based CSP requires a `proxy.ts` that generates a nonce per request. Do this before embedding any third-party widget.

## Business mode & launch date

- `NEXT_PUBLIC_BUSINESS_MODE=PRELAUNCH|LIVE`
- `NEXT_PUBLIC_LAUNCH_DATE=YYYY-MM-DD`

Both are `NEXT_PUBLIC_` so server and client render identically. Rules: date preferences are only accepted when a launch date exists (PRELAUNCH) or always (LIVE), never in the past (Eastern), and never before the launch date. Appointments can only be confirmed in LIVE.

## Local demo data

`.data/demo-store.json` and `.data/demo-outbox.json` are git-ignored. Delete the folder to reset.

## Deployment notes

- Set `NEXT_PUBLIC_SITE_URL` to the canonical https URL — it drives metadata, sitemap and links in emails.
- Preview/staging: `NEXT_PUBLIC_SITE_ENV=staging` → `noindex`, empty sitemap, robots disallow all.
- Server actions accept 1 MB bodies, or 55 MB when `SUPABASE_STORAGE_BUCKET` is set at build time (photo uploads). Vercel itself rejects request bodies over 4.5 MB, so photo uploads there need client-side resizing first.
- `sharp` is a native dependency; most hosts (Vercel, Docker with glibc) handle it. On Alpine images use `sharp`'s musl build.
