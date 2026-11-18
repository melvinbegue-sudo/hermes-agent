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
