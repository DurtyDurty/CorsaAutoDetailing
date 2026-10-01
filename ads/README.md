# Corsa Google Ads

The first Search campaign is defined in `campaign.yaml` and managed with the official
`google-ads` Python client (33.0.0, Google Ads API v25). Booking conversions go back to
Google Ads from the website through the Data Manager API.

**Safety rules built into the tool**
- Campaigns are only ever created **PAUSED**. There is no command to enable a campaign or change a budget or bids.
- `create-campaign` checks the account first and only adds what's missing, so it's safe to rerun.
- Every write asks Google to validate first (`validate_only`). `--dry-run` stops there.
- Secrets stay in `ads/.env` (git-ignored) and the Vercel environment. Output is redacted.

## Commands

Run these from `ads/`: `.venv\Scripts\python -m corsa_ads <command>`.

| Command | Changes the account? | What it does |
|---|---|---|
| `validate-config` | No (local only) | Checks limits, claims, prices against the site, keywords against negatives, URLs and geo IDs. |
| `preview-campaign [--live]` | No | Prints the full campaign. `--live` marks what already exists. |
| `create-campaign --dry-run` | No | Google validates every create operation. Without credentials it builds the requests locally. |
| `auth-login` | No | One-time Google sign-in. Saves the refresh token to `ads/.env` without printing it. |
| `auth-check` | No | Checks credentials, time zone, currency and auto-tagging. |
| `list-accounts` | No | Lists the accounts these credentials can reach. |
| `keyword-estimates` | No | Search volumes and bid ranges from Keyword Planner. Needs **Basic** API access. Output is labeled as estimates. |
| `campaign-status` | No | Shows status, budget, ad approval and config drift. |
| `report [--days 30]` | No | Actual spend, clicks and conversions by ad group. |
| `search-terms [--days 30]` | No | Search terms plus **suggested** negatives. Suggestions are never applied. |
| `create-campaign --paused` | **Yes** | Creates whatever is missing, with the campaign PAUSED. You confirm by typing the campaign name. |
| `pause-campaign [--dry-run]` | **Yes** | Sets the campaign to PAUSED. |

Errors show Google's request ID and error codes. Read calls retry quota and transient errors with backoff. Writes are not retried automatically; just rerun, since reruns only add what's missing.

## One-time setup

1. **Google Ads account** for Corsa:
   - Set the time zone to **America/New_York** and the currency to **USD**. Neither can be changed later, and the ad schedule uses the account time zone.
   - Turn on auto-tagging: Admin → Account settings.
2. **Developer token**: create a Google Ads manager account, then API Center.
   - Explorer access can create the campaign.
   - Keyword Planner estimates need Basic access.
3. **Google Cloud project**:
   - Enable the **Google Ads API** and the **Data Manager API**.
   - Create an OAuth client of type *Desktop app*.
4. Set up the tool:
   ```
   py -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   copy .env.example .env
   ```
   Fill in `.env`, then run `.venv\Scripts\python -m corsa_ads auth-login` and then `auth-check`.
5. Run `create-campaign --dry-run`, then `create-campaign --paused`.

## Conversion tracking

| Event | Where it's recorded | Sent to Google Ads as |
|---|---|---|
| Inquiry (booking request or contact form) | lead | `inquiry`, secondary, optional |
| Booking created (owner confirms the held request, or books it in the app) | appointment `confirmed` | **`booking`, primary** |
| Deposit paid / final payment (deposits are off for now) | payments ledger | `paid`, secondary, value = collected |
| Job completed | appointment status | Not sent; dashboard only |
| Revenue collected | payments ledger | The value on `paid` |

How the website handles attribution and uploads:
- **Capture.** The site keeps the first touch in first-party browser storage for 90 days and saves it with the lead. That covers the landing page, referrer host, UTMs (including term and content) and the time. The latest Google ad click ID (gclid, gbraid or wbraid) is saved too. Only those parameters are read, so personal data in a URL is ignored. The site loads no Google tag.
- **Upload.** The daily Vercel Cron (`/api/cron/ads-conversions`) sends conversions to the Data Manager API (`events:ingest`). It sends only the click ID, time, value and transaction ID: no name, email or phone. Enhanced conversions are not used.
- **Deduplication.** Transaction IDs are per customer, such as `booking-<lead id>`. A deposit plus the final payment, or a reschedule, is still one acquisition. A changed value is re-sent under the same ID, and Google applies it as an adjustment.
- **What never counts.** Held requests that are declined or expire never count. Failed payments are never recorded, so they never count.
- **GA4.** There is no GA4 on the site, so nothing is double-counted with it.
- **Limits.** The Data Manager API **can't retract** a conversion, so a booking cancelled after upload stays counted. The dashboard shows the true picture. Conversions more than 90 days after the click are skipped.

To turn on uploads, after the campaign exists:
1. Create the conversion actions in Google Ads: Goals → Conversions → New → Import → **Website (Import from clicks)**.
   - "Booking confirmed": primary, count **One**.
   - "Paying customer": secondary, count One, value from upload.
   - Optionally, "Inquiry": secondary.
2. Wait 4–6 hours after creating them before uploading.
3. Add these Vercel env vars:
   - `GOOGLE_ADS_CUSTOMER_ID` (plus `GOOGLE_ADS_LOGIN_CUSTOMER_ID` if you sign in through a manager account)
   - `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`
   - `GOOGLE_ADS_CONVERSION_BOOKING`, `GOOGLE_ADS_CONVERSION_PAID` (and optionally `GOOGLE_ADS_CONVERSION_INQUIRY`)
   - `GOOGLE_ADS_DEVELOPER_TOKEN`, for the dashboard spend card
4. Set `GOOGLE_ADS_CONVERSION_UPLOADS=validate` for one day and check the cron response: `planned`, `sent`, `failed`. Then set it to `on`.

The website dashboard (Analytics → Google Ads) shows:
- **Actual**, from Google Ads (read-only report): spend.
- **Actual**, from the business's records: Google Ads leads, bookings, paying customers and collected revenue.
- **Calculated** from those: cost per lead, booking and paying customer.

If Google Ads isn't connected, spend shows "not connected". It is never estimated.

## Decisions for the owner
- **Ad schedule.** The proposed schedule is 8am–7pm every day; confirm real availability.
- **Business phone number.** It adds the call asset and Call/Text on the site.
- **Start date.** None is set. The campaign runs once you enable it. Bookings open Oct 8, 2026.
- **Max CPC.** None is set. Add `max_cpc_usd` after a week of real CPC data.
- **Developer token level.** Apply for Basic if you want Keyword Planner estimates through the API.

## Spanish campaign (later, separate)
- It will be a separate campaign, "Corsa | Search | Clay County | ES", with Spanish (1003) as the language and the same towns and settings.
- It needs Spanish keywords ("detallado de autos a domicilio", "lavado de autos a domicilio") and Spanish ad copy reviewed by a fluent speaker.
- **Prerequisite:** don't launch it until the site has a Spanish landing page and someone can reply in Spanish.
- To build it, add a second YAML file and run the same commands with `--config`.

## Activation checklist (owner action; the tool never does this)
1. `validate-config` shows 0 errors. `campaign-status` shows the ads approved and nothing missing.
   - The site is behind Vercel's Security Checkpoint, which challenged automated browsers on 2026-10-01.
   - If an ad shows "Destination not working", Google's ad reviewer was blocked. Relax the Vercel Firewall challenge setting (verified bots, including Google's, should be allowed through).
2. Auto-tagging is on. The conversion actions exist and uploads are `on`, with a `validate` day passed.
3. The ad schedule matches your availability. The phone number is added if you want calls.
4. Billing is set up in Google Ads, and the $10/day budget is confirmed.
5. Enable the campaign yourself in Google Ads. Watch `report` and `search-terms` daily for the first week. Add negatives you agree with to `campaign.yaml` and run `create-campaign --paused` to add them.
6. To stop at any time, run `pause-campaign`.

## Tests
```
.venv\Scripts\python -m unittest discover -s tests
```
These cover:
- Limits, claims and prices
- Keywords versus negatives, URLs and geo IDs
- Budget micros and the PAUSED-only rule
- Real v25 request objects built offline
- Dry runs, safe reruns, declined confirmation, time-zone guard
- Redaction and state

The website side is covered by `npx vitest run tests/unit/google-ads.test.ts`:
- Attribution capture
- Conversion rules (held vs. confirmed, deposit plus balance, failed or refunded payments)
- Deduplication and adjustments
- The Data Manager payload, retries and the dashboard cohort
