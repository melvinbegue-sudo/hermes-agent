-- MB NUTRITION — consentement RGPD (données de santé, art. 9). À lancer une fois, après 0001 et 0002
-- (Supabase > SQL Editor > coller tout > Run). See ARCHITECTURE.md v3.

-- ---------- consents: append-only log, the latest row per (user, kind) is the current choice ----------
-- Withdrawal = a new row with granted = false (art. 7(3)); history is kept as proof of consent (art. 7(1)).
create table public.consents (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind     text not null default 'health' check (kind in ('health')),
  version  text not null check (length(version) between 1 and 40),  -- MB_LEGAL.version the user saw
  granted  boolean not null,
  at       timestamptz not null default now()
);
create index consents_user_kind_at on public.consents (user_id, kind, at desc);

-- Current health consent of u. Answers only for yourself or your own clients (no probing other people).
create function public.has_health_consent(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (u = auth.uid() or public.is_coach_of(u)) and coalesce(
    (select granted from consents where user_id = u and kind = 'health' order by at desc, id desc limit 1), false);
$$;
revoke execute on function public.has_health_consent(uuid) from public, anon;
grant execute on function public.has_health_consent(uuid) to authenticated;

alter table public.consents enable row level security;
-- Read: own rows; the coach reads his clients' rows (the app takes the latest).
create policy consents_read on public.consents for select
  using (user_id = auth.uid() or public.is_coach_of(user_id));
create policy consents_insert on public.consents for insert with check (user_id = auth.uid());
-- Append-only, and `at` / `id` cannot be backdated or forged: insert grants only the three choice columns.
revoke insert, update, delete, truncate on public.consents from anon, authenticated;
grant insert (kind, version, granted) on public.consents to authenticated;

-- ---------- gate: no health data reaches the server without consent ----------
-- Tradeoff: days.data mixes non-health data (food log, water) with health data (steps, heart rate, sleep, cycle)
-- inside one jsonb. Filtering keys inside jsonb in RLS is brittle, so the whole row is gated: a client who
-- refuses keeps everything on the device (local mode) and nothing is synced, not even the food log.
-- checkins is gated too (sleep, energy, hunger are self-reported health data); trainings is not.
-- Restrictive policies AND with the existing *_own policies; only insert/update are gated, so a client can still
-- read and delete what was synced before a withdrawal. Withdrawal stops future syncs, it does not erase:
-- erasure = delete the rows or the account (delete-account Edge Function).
-- The service role (Edge Functions, SQL editor) bypasses RLS and is not affected.
do $$
declare t text;
begin
  foreach t in array array['days','weights','measures','checkins','photos'] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_health_consent(auth.uid()))', t||'_consent_ins', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (true) with check (public.has_health_consent(auth.uid()))', t||'_consent_upd', t);
  end loop;
end $$;

-- Photo files too, otherwise the upload succeeds and only the photos row is refused (orphan file).
create policy photos_consent_ins on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'photos' or public.has_health_consent(auth.uid()));
