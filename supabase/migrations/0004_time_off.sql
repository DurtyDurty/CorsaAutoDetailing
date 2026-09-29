-- Owner days off.
--
-- A row per calendar day (Eastern) the owner isn't working. The booking
-- calendar hides these days, and book_online_slot() refuses a hold that starts
-- on one, so a customer with the calendar already open can't slip in after the
-- day is blocked. Existing appointments on a newly blocked day are left alone;
-- the dashboard lists them so the owner can reschedule.
-- RLS enabled with no policies: only the service role (the web server) reads or writes.

create table if not exists public.time_off (
  day date primary key,
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table public.time_off enable row level security;

create or replace function public.book_online_slot(
  p_lead_id uuid,
  p_service_id text,
  p_starts timestamptz,
  p_ends timestamptz,
  p_quoted_cents integer,
  p_deposit_cents integer,
  p_hold_minutes integer,
  p_buffer_minutes integer
) returns public.appointments
language plpgsql
set search_path = public
as $$
declare
  r public.appointments;
begin
  if exists (select 1 from public.time_off where day = (p_starts at time zone 'America/New_York')::date) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  -- Release holds whose payment window has passed.
  update public.appointments
     set status = 'cancelled', deposit_status = 'released', updated_at = now()
   where status = 'held' and hold_expires_at < now();

  -- A customer retrying keeps at most one live hold.
  update public.appointments
     set status = 'cancelled', deposit_status = 'released', updated_at = now()
   where status = 'held' and lead_id = p_lead_id;

  insert into public.appointments (
    lead_id, service_id, starts_at, ends_at, status, quoted_price_cents, customer_agreed,
    source, deposit_cents, deposit_status, hold_expires_at, buffer_minutes
  ) values (
    p_lead_id, p_service_id, p_starts, p_ends, 'held', p_quoted_cents, true,
    'online', p_deposit_cents, 'pending', now() + make_interval(mins => p_hold_minutes), p_buffer_minutes
  )
  returning * into r;
  return r;
exception
  when exclusion_violation then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
end $$;

revoke all on function public.book_online_slot(uuid, text, timestamptz, timestamptz, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.book_online_slot(uuid, text, timestamptz, timestamptz, integer, integer, integer, integer) to service_role;
