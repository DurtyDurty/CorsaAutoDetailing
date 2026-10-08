# Owner decisions — open items

Things the website is deliberately silent or provisional about until you decide. Each item says where the decision is applied.

## Identity

- [x] **Business name: Florida Sunbiz search.** Clear as of 2026-09-28 (no conflicting entity or fictitious name). Domain owned.
- [ ] **Register the name.** A clear search doesn't reserve it. File either a **Fictitious Name (DBA)** for "Corsa Auto Detailing" on Sunbiz (about $50, plus a newspaper notice), or form **Corsa Auto Detailing LLC**. An LLC also separates your personal assets from the business.
- [ ] **USPTO trademark search** (tmsearch.uspto.gov) for "Corsa" in car care/detailing before spending on signage, shirts or a wrap.
- [x] **Domain.** `corsaautodetailing.com` purchased 2026-09-25. `NEXT_PUBLIC_SITE_URL` set in `.env.example`; DNS is pointed at the host in LAUNCH_CHECKLIST §6.
- [x] **Logo.** Vector master supplied 2026-09-26: `public/brand/logo-master.svg`. That's the file to hand to sign shops, embroiderers and printers. The site uses SVG dark and light versions made from it, plus a browser-tab icon from the "C" mark.
- [ ] **LLC: CORSA AUTO DETAILING LLC.** Filed and paid on Sunbiz 2026-09-28 (tracking #000482991190, effective 09/28/2026), owned by you (a veteran), so "Veteran owned" stays accurate. When the approval email arrives, tell me: the privacy and terms pages and the footer copyright will name the LLC. Then EIN → operating agreement → business bank account → insurance.
- [ ] **Sunbiz annual report:** due every year January 1 to May 1 (first one in 2027). Missing it means a $400 late fee.
- [x] **"Veteran-owned" statement.** Decided 2026-09-26: show only "Veteran owned" with a U.S. flag (home hero top-right, About, footer). No rank or branch details. → `business.owner.veteranOwned`
- [x] **Owner bio.** Decided 2026-09-26: removed from the site.

## Contact & hours

- [ ] **Public email address** (required before launch; also used as reply-to on customer emails). → `NEXT_PUBLIC_CONTACT_EMAIL`
- [x] **Public phone number.** Set 2026-10-02: 904-649-0739 (site contact page, footer, and the Google Ads call asset). → `NEXT_PUBLIC_CONTACT_PHONE`
- [ ] **Reply hours** — the site makes no response-time promise until you set a truthful one, e.g. "Mon–Sat, 9am–6pm ET". → `NEXT_PUBLIC_RESPONSE_HOURS`
- [ ] **Social profiles** (omitted until set). → `NEXT_PUBLIC_SOCIAL_*`
- [ ] **Owner alert inbox** for new-lead emails. → `OWNER_NOTIFY_EMAIL`

## Launch

- [ ] **Opening date.** The site never invents one. Set it only when confirmed; it turns on the "Preferred date" field in the booking form (until then customers pick time windows). → `NEXT_PUBLIC_LAUNCH_DATE`
- [ ] **Switch to LIVE** once you're taking jobs. → `NEXT_PUBLIC_BUSINESS_MODE=LIVE`

## Service area

- [ ] **Verify ZIP → community mapping.** Current mapping is a best guess: Middleburg 32068, Fleming Island 32003, Green Cove Springs 32043, Orange Park 32065/32073, plus 32079/32656/32234 as "travel confirmation". Fix any errors. → `business.serviceAreas`
- [ ] **St. Johns County towns (added 2026-09-28).** St. Johns (32259), World Golf Village (32092) and Orangedale (no ZIP set yet: tell me which ZIP(s) to use) are marked core coverage, each with its own page. Check the one-line intro on each town page (`business.serviceAreas.communities[].intro`), e.g. "Orangedale sits on the St. Johns County side of the Shands Bridge", and correct anything that's off.
- [ ] **Orange Park.** No town page, per your call. It's still listed as "travel confirmed on review" and its ZIPs still get that answer. Remove it entirely if you don't want Orange Park jobs.
- [ ] **Jacksonville coverage.** Added 2026-09-26 as "travel confirmed on review" with 33 Duval County ZIPs (32099, 322xx). Remove any you won't drive to (e.g. the Beaches), or move nearby ones to core coverage. → `business.serviceAreas.communities[jacksonville]`
- [ ] **Decide which Orange Park locations count as "selected".** The site says travel eligibility is confirmed on review. → `business.serviceAreas.communities[orange-park].blurb`
- [ ] **Travel radius / cutoff policy** (currently: no surcharges, we just say yes or no).

## Pricing & scope

- [x] **Packages.** Replaced 2026-09-30 with nine packages (seven after later removals), one starting price each and no vehicle sizes. Popular: Essential Full Detail $179, Signature Full Detail $299, Monthly Maintenance $150/mo. Interior: Essential Interior $125, Signature Interior $225 (was Full Works Interior). Exterior: Essential Exterior $125, Signature Exterior $200 (was Wax & Buff $349). Mold Remediation ($300) removed 2026-09-30. Every exterior wash includes sealant application. No air freshener. Ceramic Coating ($600) taken off the site 2026-09-30 until you're trained in it. → `business.services`, `business.packageGroups`
- [x] **Price drop and Basic Package (2026-10-07).** Full packages are now priced by vehicle size (Sedan / SUV / Truck): Basic Package $90 / $105 / $120 (basic exterior wash and basic interior clean-up), Essential Full Detail $140 / $160 / $180 (was $179), Signature Full Detail $175 / $200 / $225 (was $299). Signature Full now lists "Sanitation" (steam removed) and adds "Protectant wax (1 month protectant)". Interior-only, exterior-only and Monthly Maintenance prices are unchanged. → `business.services[].price` and `sizeStep`, `business.vehicleSizes`
- [ ] **Interior-only and exterior-only prices.** After the 2026-10-07 drop, Signature Interior ($225) and Signature Exterior ($200) cost more than Signature Full ($175), and Essential Interior / Exterior ($125) sit $15 under Essential Full. Lower them or remove them.
- [ ] **Ceramic Coating, when you're ready.** Was listed at $600+ with "9H and 10H surface hardness" and 1-, 3- and 5-year options. Before bringing it back: training, product data sheets to back those claims, and a price for each year option.
- [ ] **Service times per package.** Not shown on the site. Needed before online deposits can be turned on (`business.booking.durationMinutes`, along with `depositCents`).
- [ ] **Validate the starting prices** after real jobs. Bump `business.pricingVersion` whenever you change them (now `2026-10-v10`). → `business.services[].price`
- [x] **Additional services.** Five range-priced add-ons (one-step paint enhancement removed 2026-09-30; it's part of Signature Exterior) are listed and confirmed at inspection; they're never added to an online estimate automatically. → `business.additionalServices`

- [ ] **Sales tax treatment.** Site shows "Any applicable tax will be disclosed in your final quote" until you confirm with the Florida DOR / your accountant whether detailing services are taxable for you and at what rate. → `business.taxNotice`

- [x] **Accepted payment methods.** Card (on a reader), cash and digital payments (decided 2026-10-01); shown on /terms.

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

## Monthly Maintenance ($150/mo package since 2026-09-30)

Customers request it through the normal form; you set up visits and payment with them directly. The old /maintenance-plans interest page redirects to the package. Before any automatic billing, decide and document:

- [ ] What "Exclusive client perks" are, and whether a first full detail is required before joining.
- [ ] Billing interval and start date; proration.
- [ ] Cancellation, rescheduling, missed-visit and rollover rules.
- [ ] Weather handling for plan visits.
- [ ] Tax configuration.
- [ ] Payment provider (hosted checkout only; see LAUNCH_CHECKLIST for the technical requirements).

## Analytics

- [ ] **Provider.** None runs by default. Plausible is wired (cookieless). Decide whether you want analytics at all. → `NEXT_PUBLIC_ANALYTICS_PROVIDER`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`

## Future services (not offered at launch)

- [ ] PPF, tint, ceramic coating, multi-step correction — not shown anywhere on the site. → `business.futureServices`
