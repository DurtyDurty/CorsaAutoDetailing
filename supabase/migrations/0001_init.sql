-- Corsa Auto Detailing — initial schema.
-- Apply with the Supabase CLI (`supabase db push`) or paste into the SQL editor.
--
-- Access model:
--   * The web app talks to these tables ONLY from the server using the
--     service-role key, which bypasses RLS.
--   * RLS is enabled with NO policies for anon/authenticated, so browser
--     clients (anon key) cannot read, list, or write leads even if they
--     discover the table names.
--   * Owner sign-in uses Supabase Auth; authorization is enforced in the app
--     by matching the signed-in email against ADMIN_EMAILS.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  lead_type         text not null check (lead_type in ('launch_list','quote_request','membership_interest','contact')),
  business_mode     text not null check (business_mode in ('PRELAUNCH','LIVE')),
  idempotency_key   uuid not null unique,

  first_name        text not null,
  last_name         text,
  email             text not null,
  phone             text,
  preferred_contact text check (preferred_contact in ('email','phone','text')),

  vehicle_category  text,
  vehicle_year      integer,
  vehicle_make      text,
  vehicle_model     text,
  service_id        text,
  membership_cadence text,
  future_interests  text[] not null default '{}',

  condition         text check (condition in ('normal','deeper','unsure')),
  condition_flags   text[] not null default '{}',
  concerns          text,

  zip               text,
  zip_eligibility   text,
  city              text,
  location_type     text check (location_type in ('home','work','other')),
  time_windows      text[] not null default '{}',
  preferred_date    date,
  notes             text,
  message           text,

  estimate          jsonb,
  pricing_version   text not null,
  consent           jsonb not null,
  source            jsonb not null default '{}'::jsonb,

  stage             text not null default 'new'
                    check (stage in ('new','contacted','quote_sent','scheduled','completed','lost','spam')),
  follow_up_on      date,
  internal_notes    text,
  archived_at       timestamptz,
  photo_refs        text[] not null default '{}'
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_email_type_idx on public.leads (email, lead_type, created_at desc);
create index if not exists leads_stage_idx on public.leads (stage) where archived_at is null;

create table if not exists public.appointments (
  id                      uuid primary key default gen_random_uuid(),
  lead_id                 uuid not null references public.leads(id) on delete cascade,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  starts_at               timestamptz not null,
  ends_at                 timestamptz not null,
  status                  text not null check (status in ('confirmed','completed','cancelled')),
  quoted_price_cents      integer not null check (quoted_price_cents >= 0),
  customer_agreed         boolean not null default false,
  completed_revenue_cents integer check (completed_revenue_cents >= 0),
  notes                   text,
  check (ends_at > starts_at)
);

create index if not exists appointments_starts_at_idx on public.appointments (starts_at);
create index if not exists appointments_lead_idx on public.appointments (lead_id);

create table if not exists public.notification_log (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references public.leads(id) on delete cascade,
  kind                text not null check (kind in ('owner_notify','customer_ack')),
  status              text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts            integer not null default 0,
  last_error          text,
  provider_message_id text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists notification_log_status_idx on public.notification_log (status, created_at desc);
create index if not exists notification_log_lead_idx on public.notification_log (lead_id);

-- Row-level security: enabled, no policies → anon and authenticated roles are denied.
alter table public.leads            enable row level security;
alter table public.appointments     enable row level security;
alter table public.notification_log enable row level security;

revoke all on public.leads, public.appointments, public.notification_log from anon, authenticated;

-- Private storage bucket for optional vehicle photos (server-only access).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lead-photos', 'lead-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do nothing;
