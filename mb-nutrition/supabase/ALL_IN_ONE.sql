-- MB NUTRITION : base complète (0001 + 0002 + 0003). À coller en une fois dans Supabase › SQL Editor › Run.

-- ===== migrations/0001_init.sql =====
-- MB NUTRITION — schéma initial. À coller tel quel dans Supabase > SQL Editor > Run.
-- One coach (Melvin), many clients. Every table has RLS; a client only ever sees rows where client_id = auth.uid().

-- ---------- profiles ----------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'client' check (role in ('client','coach')),
  email      text,
  prenom     text,
  coach_id   uuid references public.profiles(id) on delete set null,
  profile    jsonb not null default '{}',   -- client-owned: S.profile (salle, objectif, regime, allergies…)
  plan       jsonb,                          -- coach-owned: {kcal, swap, extra, note, at}
  statut     text not null default 'Actif',  -- coach-owned
  cid        text,                           -- coach-owned: client code MB-…
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Coach-private notes: separate table so the client can never read them through its own profile row.
create table public.coach_notes (
  client_id  uuid primary key references public.profiles(id) on delete cascade,
  notes      text,
  data       jsonb not null default '{}',    -- pct, debut, dernierPoint… whatever the coach screen keeps
  updated_at timestamptz not null default now()
);

-- ---------- client data ----------
create table public.days (
  client_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date       date not null,
  data       jsonb not null default '{}',    -- {log, water, steps, health, fasting}
  updated_at timestamptz not null default now(),
  primary key (client_id, date)
);
create table public.weights (
  client_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date       date not null,
  kg         numeric(5,1) not null check (kg between 20 and 400),
  primary key (client_id, date)
);
create table public.measures (
  client_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date       date not null,
  waist numeric(5,1), hips numeric(5,1), chest numeric(5,1), arm numeric(5,1), thigh numeric(5,1),
  primary key (client_id, date)
);
create table public.checkins (
  client_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date       date not null,
  data       jsonb not null default '{}',    -- {respect, energie, sommeil, faim, note…}
  primary key (client_id, date)
);
create table public.trainings (
  client_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  date       date not null,
  data       jsonb not null default '[]',    -- that day's sessions [{sport, min, …}]
  primary key (client_id, date)
);
create table public.photos (
  id         bigint generated always as identity primary key,
  client_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  path       text not null unique,           -- storage key in bucket 'photos': <client_id>/<kind>/<file>.jpg
  kind       text not null check (kind in ('meal','progress')),
  date       date not null default current_date,
  created_at timestamptz not null default now(),
  check (split_part(path, '/', 1) = client_id::text)
);
create table public.messages (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references public.profiles(id) on delete cascade, -- the conversation = the client
  sender_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index messages_client_created on public.messages (client_id, created_at);

-- Edge Function rate limit (analyze-meal): one row per user per day.
create table public.ai_usage (
  client_id  uuid not null references public.profiles(id) on delete cascade,
  day        date not null default current_date,
  n          int  not null default 0,
  primary key (client_id, day)
);

-- ---------- helpers ----------
-- security definer: reads profiles without going through profiles' own RLS (avoids policy recursion).
create function public.is_coach_of(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = c and coach_id = auth.uid());
$$;

-- Atomically counts one AI call for the caller; true while under the limit. Calling it directly only burns your own quota.
create function public.ai_take(lim int) returns boolean
language sql volatile security definer set search_path = public as $$
  insert into ai_usage (client_id) values (auth.uid())
  on conflict (client_id, day) do update set n = ai_usage.n + 1
  returning n < lim   -- first insert stores n = 0, so lim calls are allowed per day
    and (select coalesce(sum(n), 0) from ai_usage where day = current_date) < 1000;  -- global daily cap on the AI bill
$$;
revoke execute on function public.ai_take(int) from public, anon;

-- New auth user -> profile row, attached to the coach (there is one).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, prenom, coach_id)
  values (new.id, new.email, new.raw_user_meta_data->>'prenom',
          (select id from profiles where role = 'coach' order by created_at limit 1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Who may change what on a profile row. auth.uid() is null in the SQL editor / service role: admin, no restriction.
create function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null then
    new.id := old.id; new.role := old.role; new.coach_id := old.coach_id; new.email := old.email;
    if auth.uid() is distinct from old.coach_id then      -- not this client's coach: plan/statut/cid are read-only
      new.plan := old.plan; new.statut := old.statut; new.cid := old.cid;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

-- ---------- RLS ----------
alter table public.profiles    enable row level security;
alter table public.coach_notes enable row level security;
alter table public.messages    enable row level security;
alter table public.ai_usage    enable row level security;

create policy profiles_read   on public.profiles for select using (id = auth.uid() or coach_id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid() or coach_id = auth.uid())
                                                          with check (id = auth.uid() or coach_id = auth.uid());
-- no insert/delete policy: rows come from the signup trigger, deletion = delete the auth user.

create policy coach_notes_all on public.coach_notes for all
  using (public.is_coach_of(client_id)) with check (public.is_coach_of(client_id));

-- Same two policies on every client-data table: owner full access, coach read-only.
do $$
declare t text;
begin
  foreach t in array array['days','weights','measures','checkins','trainings','photos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (client_id = auth.uid()) with check (client_id = auth.uid())', t||'_own', t);
    execute format('create policy %I on public.%I for select using (public.is_coach_of(client_id))', t||'_coach', t);
  end loop;
end $$;

create policy messages_read on public.messages for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));
create policy messages_send on public.messages for insert
  with check (sender_id = auth.uid() and (client_id = auth.uid() or public.is_coach_of(client_id)));
create policy messages_mark_read on public.messages for update
  using (client_id = auth.uid() or public.is_coach_of(client_id));
-- Only read_at is updatable; sender/created_at can't be forged on insert.
revoke insert, update on public.messages from anon, authenticated;
grant insert (client_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

create policy ai_usage_read on public.ai_usage for select using (client_id = auth.uid());

-- ---------- Storage: private bucket 'photos', key = <client_id>/… ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', false, 2097152, '{image/jpeg}') on conflict (id) do nothing;

create policy photos_own on storage.objects for all to authenticated
  using      (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_coach_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and exists (
    select 1 from public.profiles p where p.id::text = (storage.foldername(name))[1] and p.coach_id = auth.uid()));

-- ---------- Realtime for the chat (RLS applies to realtime too) ----------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when undefined_object then null;  -- publication absent (plain Postgres)
end $$;

-- ===== migrations/0002_billing_calls_push.sql =====
-- MB NUTRITION — abonnement Stripe, calls Cal.com, notifications push. À lancer une fois, après 0001_init.sql
-- (Supabase > SQL Editor > coller tout > Run). See ARCHITECTURE.md "Abonnement, calls, notifications (v2)".
-- Writes to subscriptions / bookings come only from the Edge Functions (service role, which bypasses RLS).

-- ---------- subscriptions: one row per client ----------
create table public.subscriptions (
  client_id              uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text,
  -- normalized by stripe-webhook: active | trialing | past_due | canceled | none
  status                 text not null default 'none' check (status in ('active','trialing','past_due','canceled','none')),
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,  -- client cancelled: access runs until current_period_end
  comp                   boolean not null default false,  -- free access granted by the coach (set_comp only)
  updated_at             timestamptz not null default now()
);

-- ---------- bookings: Cal.com calls ----------
create table public.bookings (
  id          bigint generated always as identity primary key,
  cal_uid     text not null unique,
  client_id   uuid references public.profiles(id) on delete set null,  -- null until the attendee email matches a profile
  email       text,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'booked' check (status in ('booked','cancelled')),
  meeting_url text,
  updated_at  timestamptz not null default now()
);
create index bookings_client_start on public.bookings (client_id, starts_at);

-- ---------- push_tokens: one row per device ----------
create table public.push_tokens (
  token      text primary key check (length(token) between 10 and 4096),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  platform   text not null check (platform in ('ios','android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user on public.push_tokens (user_id);

-- ---------- helpers ----------
-- Premium access: active/trialing/past_due subscription (Stripe itself ends past_due after its retries), comp, or the coach.
-- Only answers for yourself or your own clients, so it can't be used to probe other people's billing.
create function public.has_access(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (u = auth.uid() or public.is_coach_of(u)) and (
    exists (select 1 from profiles where id = u and role = 'coach')
    or exists (select 1 from subscriptions where client_id = u
               and (comp or status in ('active','trialing','past_due'))));
$$;

-- The coach grants / removes free access. Creates the row if the client never opened checkout.
create function public.set_comp(client uuid, on_ boolean) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_coach_of(client) then return false; end if;
  insert into subscriptions (client_id, comp) values (client, on_)
  on conflict (client_id) do update set comp = excluded.comp, updated_at = now();
  return true;
end $$;
revoke execute on function public.set_comp(uuid, boolean) from public, anon;
grant execute on function public.set_comp(uuid, boolean) to authenticated;

-- A device token belongs to whoever signed in last on that device (upsert can't do this under RLS:
-- the old owner's row isn't visible to the new user).
create function public.register_push(tok text, plat text) returns boolean
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into push_tokens (token, user_id, platform) values (tok, auth.uid(), plat)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
  return true;
end $$;
revoke execute on function public.register_push(text, text) from public, anon;
grant execute on function public.register_push(text, text) to authenticated;

-- ---------- RLS ----------
alter table public.subscriptions enable row level security;
alter table public.bookings      enable row level security;
alter table public.push_tokens   enable row level security;

-- Read-only through the API: no insert/update/delete policy and no write grant (belt and braces).
create policy subscriptions_read on public.subscriptions for select
  using (client_id = auth.uid() or public.is_coach_of(client_id));
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;

create policy bookings_read on public.bookings for select
  using (client_id = auth.uid() or public.is_coach_of(client_id)
         or (client_id is null and exists (select 1 from public.profiles where id = auth.uid() and role = 'coach')));
revoke insert, update, delete, truncate on public.bookings from anon, authenticated;

create policy push_tokens_own on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Chat is premium: a client can only send while subscribed (or comp). The coach can always write.
-- shortcut: plan (profiles.plan) is still readable without access — gating it needs a column split; do it if clients abuse it.
drop policy messages_send on public.messages;
create policy messages_send on public.messages for insert
  with check (sender_id = auth.uid() and (
    (client_id = auth.uid() and public.has_access(auth.uid())) or public.is_coach_of(client_id)));

-- ===== migrations/0003_consent.sql =====
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
