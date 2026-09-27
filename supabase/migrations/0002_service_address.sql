-- Service address for booking requests (street address where the vehicle will be).
-- Nullable: launch-list, contact and plan-interest leads don't collect it, and
-- older quote requests predate it. RLS and grants on public.leads are unchanged.
alter table public.leads add column if not exists service_address text;
