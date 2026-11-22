-- Two cars per visit (2026-11-22). The first car stays on the lead; extra cars ride on the appointment:
-- [{ "year": 2021, "make": "Honda", "model": "Civic", "sizeId": "sedan", "serviceId": "signature-full", "priceCents": 15000 }]
-- The app only writes this column when a booking has a second car, so single-car bookings work before it exists.

alter table public.appointments
  add column if not exists extra_vehicles jsonb not null default '[]'::jsonb;

alter table public.appointments drop constraint if exists appointments_extra_vehicles_check;
alter table public.appointments
  add constraint appointments_extra_vehicles_check
  check (jsonb_typeof(extra_vehicles) = 'array' and jsonb_array_length(extra_vehicles) <= 3);
