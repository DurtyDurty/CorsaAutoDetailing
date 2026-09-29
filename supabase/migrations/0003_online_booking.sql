-- Online booking with deposits.
--
-- * Appointments gain a 'held' status (slot reserved while the customer pays
--   the deposit), deposit tracking, and payment-provider references.
-- * busy_until = ends_at + travel buffer, maintained by a trigger. The database
--   itself refuses two active (held/confirmed) appointments whose
--   [starts_at, busy_until) windows overlap, so a double booking is impossible
--   even if two customers pay at the same moment.
-- * book_online_slot() expires stale holds and inserts a new hold atomically.
--   Only the service role (the web server) may call it.
-- RLS on public.appointments is unchanged (enabled, no policies).

create extension if not exists btree_gist;

alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments
  add constraint appointments_status_check check (status in ('held', 'confirmed', 'completed', 'cancelled'));

alter table public.appointments
  add column if not exists source text not null default 'owner' check (source in ('owner', 'online')),
  add column if not exists service_id text,
  add column if not exists deposit_cents integer check (deposit_cents is null or deposit_cents >= 0),
  add column if not exists deposit_status text not null default 'none'
    check (deposit_status in ('none', 'pending', 'paid', 'refunded', 'forfeited', 'released')),
  add column if not exists checkout_session_id text unique,
  add column if not exists payment_intent_id text,
  add column if not exists hold_expires_at timestamptz,
  add column if not exists buffer_minutes integer not null default 45 check (buffer_minutes >= 0),
  add column if not exists busy_until timestamptz;

create or replace function public.appointments_set_busy_until()
returns trigger language plpgsql as $$
begin
  new.busy_until := new.ends_at + make_interval(mins => new.buffer_minutes);
  return new;
end $$;

drop trigger if exists appointments_busy_until on public.appointments;
create trigger appointments_busy_until
  before insert or update of starts_at, ends_at, buffer_minutes on public.appointments
  for each row execute function public.appointments_set_busy_until();

update public.appointments set busy_until = ends_at + make_interval(mins => buffer_minutes) where busy_until is null;
alter table public.appointments alter column busy_until set not null;

alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (tstzrange(starts_at, busy_until, '[)') with &&)
  where (status in ('held', 'confirmed'));

create index if not exists appointments_hold_expiry_idx on public.appointments (hold_expires_at) where status = 'held';

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
