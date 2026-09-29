-- Emails the owner writes to a lead from the dashboard (sent through Resend).
--
-- send_key is generated when the compose form renders, so a double-click or a
-- resubmitted form can't send the same message twice.
-- RLS enabled with no policies: only the service role (the web server) reads or writes.

create table if not exists public.outbound_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  send_key text not null unique,
  to_email text not null,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 10000),
  status text not null check (status in ('sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists outbound_emails_lead_idx on public.outbound_emails (lead_id, created_at desc);

alter table public.outbound_emails enable row level security;
