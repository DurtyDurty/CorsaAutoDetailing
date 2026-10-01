-- Owner app: field workflow statuses, audit history and a payments ledger.
--
-- Additive only. Existing statuses keep their meaning; existing rows are untouched.
-- * appointments: adds en_route / arrived / in_progress / no_show / declined,
--   cancellation details and a discount. The no-overlap constraint now also
--   covers jobs that are underway, so nothing can be booked on top of them.
-- * appointment_events: who changed what and when. request_id makes a retried
--   app request record once.
-- * payments: deposits, balance payments and refunds the owner records
--   (card reader, cash, digital) or the server records (Stripe).
-- RLS enabled with no policies: only the service role (the web server) reads or writes.

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check check (
    status in ('held', 'confirmed', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'declined')
  );

alter table public.appointments
  add column if not exists cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  add column if not exists cancelled_by text check (cancelled_by is null or cancelled_by in ('customer', 'owner')),
  add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);

alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (tstzrange(starts_at, busy_until, '[)') with &&)
  where (status in ('held', 'confirmed', 'en_route', 'arrived', 'in_progress'));

create table if not exists public.appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  type text not null check (type in ('created', 'status', 'rescheduled', 'note', 'payment')),
  from_status text,
  to_status text,
  note text check (note is null or char_length(note) <= 1000),
  actor text not null check (char_length(actor) between 1 and 254),
  request_id uuid unique,
  created_at timestamptz not null default now()
);

create index if not exists appointment_events_appt_idx on public.appointment_events (appointment_id, created_at);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'balance', 'refund')),
  method text not null check (method in ('card_reader', 'cash', 'digital', 'stripe')),
  amount_cents integer not null check (amount_cents > 0),
  note text check (note is null or char_length(note) <= 500),
  provider_ref text,
  recorded_by text not null check (char_length(recorded_by) between 1 and 254),
  request_id uuid unique,
  created_at timestamptz not null default now()
);

create index if not exists payments_appt_idx on public.payments (appointment_id, created_at);
create index if not exists payments_created_idx on public.payments (created_at desc);

alter table public.appointment_events enable row level security;
alter table public.payments enable row level security;
revoke all on public.appointment_events, public.payments from anon, authenticated;
