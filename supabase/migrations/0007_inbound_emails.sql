-- Customer replies received through Resend (reply.corsaautodetailing.com).
--
-- provider_email_id is Resend's id: a webhook delivered twice is stored once.
-- lead_id links the reply to its conversation (by the reply+<lead>@ address,
-- else the sender's most recent request); a reply from someone new gets a
-- contact lead. read_at is set when the owner opens the conversation.
-- RLS enabled with no policies: only the service role (the web server) reads or writes.

create table if not exists public.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  provider_email_id text not null unique,
  lead_id uuid references public.leads (id) on delete cascade,
  from_email text not null check (char_length(from_email) <= 254),
  from_name text check (from_name is null or char_length(from_name) <= 200),
  to_email text check (to_email is null or char_length(to_email) <= 254),
  subject text not null default '' check (char_length(subject) <= 500),
  body text not null default '' check (char_length(body) <= 50000),
  message_id text,
  received_at timestamptz not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists inbound_emails_lead_idx on public.inbound_emails (lead_id, received_at desc);
create index if not exists inbound_emails_unread_idx on public.inbound_emails (lead_id) where read_at is null;

alter table public.inbound_emails enable row level security;
revoke all on public.inbound_emails from anon, authenticated;
