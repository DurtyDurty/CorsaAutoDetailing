# Owner decisions — open items

Things the website is deliberately silent or provisional about until you decide. Each item says where the decision is applied.

## Identity

- [ ] **Business name clearance.** "Corsa Auto Detailing" is a working name. Check Florida Sunbiz (fictitious name / LLC), USPTO trademark search, and domain availability before spending on signage or print. → `business.brand.name`, `.env NEXT_PUBLIC_SITE_URL`
- [x] **Domain.** `corsaautodetailing.com` purchased 2026-09-25. `NEXT_PUBLIC_SITE_URL` set in `.env.example`; DNS is pointed at the host in LAUNCH_CHECKLIST §6.
- [ ] **Logo files.** None supplied. Provide horizontal + stacked SVGs (dark and light) and favicons, or approve the typographic wordmark. → `business.brand.logos`, `public/`
- [ ] **"Veteran-owned" statement.** Currently shown; confirm you want it and the wording "U.S. Navy Chief, retired · 20 years of service". → `business.owner`
- [ ] **Owner bio copy.** Three paragraphs drafted from your brief; edit freely. → `business.owner.bio`

## Contact & hours

- [ ] **Public email address** (required before launch; also used as reply-to on customer emails). → `NEXT_PUBLIC_CONTACT_EMAIL`
- [ ] **Public phone number** (optional; omitted until set). → `NEXT_PUBLIC_CONTACT_PHONE`
- [ ] **Reply hours** — the site makes no response-time promise until you set a truthful one, e.g. "Mon–Sat, 9am–6pm ET". → `NEXT_PUBLIC_RESPONSE_HOURS`
- [ ] **Social profiles** (omitted until set). → `NEXT_PUBLIC_SOCIAL_*`
- [ ] **Owner alert inbox** for new-lead emails. → `OWNER_NOTIFY_EMAIL`

## Launch

- [ ] **Opening date.** The site never invents one. Set it only when confirmed; it enables date preferences on the request form. → `NEXT_PUBLIC_LAUNCH_DATE`
- [ ] **Switch to LIVE** once you're taking jobs. → `NEXT_PUBLIC_BUSINESS_MODE=LIVE`

## Service area

- [ ] **Verify ZIP → community mapping.** Current mapping is a best guess: Middleburg 32068, Fleming Island 32003, Green Cove Springs 32043, Orange Park 32065/32073, plus 32079/32656/32234 as "travel confirmation". Fix any errors. → `business.serviceAreas`
- [ ] **Decide which Orange Park locations count as "selected".** The site says travel eligibility is confirmed on review. → `business.serviceAreas.communities[orange-park].blurb`
- [ ] **Travel radius / cutoff policy** (currently: no surcharges, we just say yes or no).

## Pricing & scope

- [ ] **Validate the planned prices** ($79/$89/$109 exterior; $109/$129/$149 maintenance) after practice jobs. Bump `business.pricingVersion` whenever you change them. → `business.services[].prices`
- [ ] **Typical durations.** Not published until validated. → `SERVICES_FAQ` in `src/content/faq.ts`
- [ ] **Fixed add-ons** (none approved). Add to `business.addOns` only with a firm price.
- [ ] **Sales tax treatment.** Site shows "Any applicable tax will be disclosed in your final quote" until you confirm with the Florida DOR / your accountant whether detailing services are taxable for you and at what rate. → `business.taxNotice`
- [ ] **Vehicle category edge cases** (three-row crossovers, small pickups, two-door trucks). Adjust category labels/examples. → `business.vehicleCategories`
- [ ] **Accepted payment methods** (cash, card, Zelle…) — terms page says "will be listed before we open".

## Policies (Terms & Privacy are drafts)

- [ ] **Weather policy** (rain delay / reschedule).
- [ ] **Cancellation & rescheduling** rules and any fees. None are stated; none should be invented.
- [ ] **Satisfaction / redo policy** if any.
- [ ] **Data retention period** for inquiries and photos, and who handles deletion requests. → `/privacy` retention section
- [ ] **HOA / workplace washing restrictions** — how you want to handle them (currently: customer is asked to check).
- [ ] **Legal review** of `/privacy` and `/terms` before public launch.

## Insurance & credentials

- [ ] **Garage keepers / general liability insurance.** The site makes no insurance claim. Add a statement only once a policy is active. → `src/app/(site)/about/page.tsx`
- [ ] **Business license / registration** (Clay County BTR, etc.). Not claimed on site.
- [ ] **Certifications** (e.g., IDA). Not claimed. Add only when earned.

## Photos & proof

- [ ] **Real work photos** (before/after of practice jobs on your IS F / FJ Cruiser or consenting friends). Gallery is hidden until `business.gallery` has entries. Do not use stock or AI images as work samples.
- [ ] **Hero video.** The home page background is a license-free Pexels clip (video 6157780, black car reflections, no people) used as mood only, never presented as our work. Replace it with your own 10–15 s landscape clip: drop it in `public/media/` (720p + 360p MP4, no audio, plus a poster JPG) and update the paths in `src/components/site/HeroVideo.tsx`.
- [ ] **Testimonials.** Section hidden until real, permissioned quotes exist. → `business.testimonials`
- [ ] **Customer photo uploads.** Enable only after creating the private Supabase bucket. → `SUPABASE_STORAGE_BUCKET`

## Maintenance plans (interest capture only today)

Before `business.membership.billingEnabled` can be switched on, decide and document:

- [ ] Prices for monthly and twice-monthly cadences (and whether an initial qualifying detail is required and its price).
- [ ] Included visits per period, vehicle eligibility, and what's excluded.
- [ ] Billing interval and start date; proration.
- [ ] Cancellation, rescheduling, missed-visit and rollover rules.
- [ ] Weather handling for plan visits.
- [ ] Tax configuration.
- [ ] Payment provider (hosted checkout only; see LAUNCH_CHECKLIST for the technical requirements).

## Analytics

- [ ] **Provider.** None runs by default. Plausible is wired (cookieless). Decide whether you want analytics at all. → `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

## Future services (not offered at launch)

- [ ] PPF, tint, ceramic, correction — currently listed only as "future interests" on the maintenance-plans form. Decide whether to keep even that mention. → `business.futureServices`
