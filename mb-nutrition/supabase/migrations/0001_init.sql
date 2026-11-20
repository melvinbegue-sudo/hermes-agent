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
