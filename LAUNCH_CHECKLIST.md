# Launch checklist

Work top to bottom. Nothing here happens automatically — the repo never deploys, buys, or sends anything on its own.

## 1. Durable lead storage (Supabase)

- [ ] Create a Supabase project (choose a US East region).
- [ ] Apply `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`). Confirm `leads`, `appointments`, `notification_log` exist with RLS **enabled** and **no policies**.
- [ ] Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the server only. Never expose the service-role key to the browser.
- [ ] (Optional) Set `SUPABASE_STORAGE_BUCKET=lead-photos` to enable private photo uploads.
- [ ] Verify with `GET /api/health` (while signed in) that `leadStore.kind` is `supabase` and `ok` is true.

## 2. Owner access

- [ ] In Supabase Auth: disable public signups; create your user with a strong password (and enable MFA if available).
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ADMIN_EMAILS=you@yourdomain.com`.
- [ ] Remove `DEMO_ADMIN_PASSWORD` and make sure `ALLOW_DEMO_STORE` is not set in production.
- [ ] Sign in at `/admin/login`; confirm `/admin/export` returns 401 in a private window.

## 3. Email delivery (Resend)

- [ ] Add and verify your sending domain in Resend (SPF/DKIM DNS records).
- [ ] Set `RESEND_API_KEY`, `EMAIL_FROM` (verified address), `OWNER_NOTIFY_EMAIL`.
- [ ] Submit a test launch-list signup on the deployed site with your own email; confirm you receive both the owner alert and the customer acknowledgement, and that the lead page shows both notifications as **sent**.
- [ ] (Optional) Configure a scheduler to `POST /api/cron/retry-notifications` with `Authorization: Bearer $CRON_SECRET` every 15 minutes.

## 4. Business configuration

- [ ] `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL` set (required); phone/social/hours only if real.
- [ ] Prices, ZIP mapping, owner bio, and veteran statement reviewed in `src/config/business.ts`.
- [ ] `npm run launch-check` passes.

## 5. Policies & claims review

- [ ] Read `/privacy` and `/terms` line by line; resolve every "owner decision pending" item in OWNER_DECISIONS.md or leave it honestly unstated.
- [ ] Confirm no page claims insurance, certification, experience, reviews, ratings, or an opening date you haven't verified.
- [ ] Confirm the gallery and testimonials sections are still hidden unless real content exists.

## 6. Deploy

- [ ] Deploy to your host with the production environment variables. Build must pass `npm run check` first.
- [ ] Staging/preview deployments: set `NEXT_PUBLIC_SITE_ENV=staging` so they are `noindex` with an empty sitemap.
- [ ] Point DNS at the deployment; confirm HTTPS and that `http://` redirects to `https://`.
- [ ] Confirm security headers are present (`curl -I https://yourdomain.com`).

## 7. Search & measurement

- [ ] `https://yourdomain.com/robots.txt` allows the site and disallows `/admin`, `/api`, `/thanks`, `/request`.
- [ ] `https://yourdomain.com/sitemap.xml` lists the public pages.
- [ ] Submit the sitemap in Google Search Console (optional) — do **not** create a Google Business Profile with your home address.
- [ ] Decide on analytics (`NEXT_PUBLIC_ANALYTICS_PROVIDER`); if enabling Plausible, set the domain and update the analytics sentence on `/privacy`.

## 8. Final pre-public checks (do these on your phone)

- [ ] Home, services, request form (all four steps), maintenance plans, service areas, about, contact, privacy, terms load and look right at 360–390px.
- [ ] Submit one real test on each form; check `/admin` shows them; delete the test leads.
- [ ] Sticky bottom CTA doesn't cover form controls.
- [ ] Mobile menu opens/closes with touch and keyboard.

## 9. When you're ready to take jobs

- [ ] Set `NEXT_PUBLIC_LAUNCH_DATE` (enables date preferences) and, when open, `NEXT_PUBLIC_BUSINESS_MODE=LIVE`.
- [ ] Review `business.scheduling` (work hours, work days, travel buffer, default duration).
- [ ] Practice the appointment flow in `/admin`: confirm → complete → revenue recorded.

## 10. Before enabling maintenance-plan billing (future)

Do not flip `business.membership.billingEnabled` until all of these exist:

- [ ] Approved prices, included visits, eligibility, billing interval, cancellation/rescheduling/rollover rules, weather handling, tax configuration (OWNER_DECISIONS.md).
- [ ] A payment provider with **hosted checkout** (e.g., Stripe Checkout + Customer Portal), **signed webhooks**, **idempotent** webhook handling, **server-trusted pricing** (price IDs, never client amounts), and a customer billing-management link. No card data ever touches this app.
- [ ] Separate authorization and a test run in the provider's test mode before any live checkout.
