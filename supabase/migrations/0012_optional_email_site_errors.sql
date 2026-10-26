-- 1. The short booking form (/book, /request) makes email optional: those
--    customers are reached by phone or text. Apply this BEFORE deploying the
--    code that sends a request without an email, or those saves fail.
-- 2. site_errors: website forms that failed or were turned away, shown on the
--    /admin dashboard. No customer details: the form, the kind of failure, and
--    field names or error text. The service-role web server is the only reader/writer.

alter table public.leads alter column email drop not null;

create table if not exists public.site_errors (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('save_failed', 'unexpected', 'invalid')),
  form text not null check (char_length(form) <= 60),
  detail text not null default '' check (char_length(detail) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists site_errors_created_idx on public.site_errors (created_at desc);

alter table public.site_errors enable row level security;
revoke all on public.site_errors from anon, authenticated;
