-- Quotes: an invoice-style price for a requested time, which the customer
-- accepts (confirming the booking) or declines through a private link.
--
-- * token_hash: sha256 of the link token. The token itself is only ever in the
--   email the customer receives, so a database read can't be turned into a link.
-- * One live ("sent") quote per appointment; sending a revised quote withdraws
--   the earlier one.
-- * request_id makes a retried "send" from the app create one quote.
-- RLS enabled with no policies: only the service role (the web server) reads or writes.

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  number text not null unique check (char_length(number) between 3 and 40),
  token_hash text not null unique check (char_length(token_hash) = 64),
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined', 'withdrawn')),
  lines jsonb not null check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) between 1 and 20),
  subtotal_cents integer not null check (subtotal_cents between 0 and 10000000),
  discount_cents integer not null default 0 check (discount_cents >= 0 and discount_cents <= subtotal_cents),
  total_cents integer not null check (total_cents = subtotal_cents - discount_cents),
  notes text check (notes is null or char_length(notes) <= 1000),
  expires_at timestamptz not null,
  created_by text not null check (char_length(created_by) between 1 and 254),
  request_id uuid unique,
  responded_at timestamptz,
  response_note text check (response_note is null or char_length(response_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotes_appointment_idx on public.quotes (appointment_id, created_at desc);
create unique index if not exists quotes_one_live_per_appointment on public.quotes (appointment_id) where status = 'sent';

alter table public.quotes enable row level security;
revoke all on public.quotes from anon, authenticated;
