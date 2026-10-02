-- Corsa Auto Detailing: tighten database grants (security audit, 2026-10-02).
--
-- Nothing here changes what the website can do: it reads and writes through the
-- service role, which keeps every grant. This only removes access the public
-- (anon / signed-in) roles never needed, so a table is safe even if a later
-- migration forgets a step.
--
-- Rollback: every statement is reversible with the matching GRANT / ALTER shown
-- in SECURITY_AUDIT.md; no data is touched.

-- 1. The two tables that had row-level security but no explicit revoke.
revoke all on public.time_off, public.outbound_emails from anon, authenticated;

-- 2. Future tables, sequences and functions created by migrations get no
--    automatic access for the public roles.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- 3. Pin the trigger function's search_path (it only uses built-ins).
alter function public.appointments_set_busy_until() set search_path = '';

-- 4. Re-assert that the photo bucket is private, even if it existed before the
--    first migration ran (that insert used "on conflict do nothing").
update storage.buckets
   set public = false
 where id = 'lead-photos' and public is distinct from false;
