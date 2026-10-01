-- Conversions reported to Google Ads through the Data Manager API.
--
-- One row per Google transaction id (e.g. booking-<lead id>), so a booking is
-- counted once however often the upload runs. value_cents is what Google was
-- last sent; a different value later is re-sent under the same transaction id,
-- which Google applies as an adjustment rather than a new conversion.
-- No personal data is stored here: only ids, amounts and upload status.
-- RLS enabled with no policies: only the service role (the web server) reads or writes.

create table if not exists public.ad_conversions (
  transaction_id text primary key check (char_length(transaction_id) <= 100),
  kind text not null check (kind in ('inquiry', 'booking', 'paid')),
  lead_id uuid references public.leads (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  value_cents integer not null default 0 check (value_cents >= 0),
  event_at timestamptz not null,
  status text not null check (status in ('sent', 'failed')),
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 1000),
  request_id text,
  sent_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ad_conversions_kind_idx on public.ad_conversions (kind, event_at desc);

alter table public.ad_conversions enable row level security;
revoke all on public.ad_conversions from anon, authenticated;
