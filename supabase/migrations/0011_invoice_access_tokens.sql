-- Private customer links to completed invoices. Only the hashed token is stored;
-- the service-role web server is the only reader/writer.

create table if not exists public.invoice_access_tokens (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  token_hash text not null unique check (char_length(token_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists invoice_access_tokens_appointment_idx on public.invoice_access_tokens (appointment_id);

alter table public.invoice_access_tokens enable row level security;
revoke all on public.invoice_access_tokens from anon, authenticated;