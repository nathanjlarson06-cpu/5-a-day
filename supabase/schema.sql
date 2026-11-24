-- Five a Day: database setup.
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run again; it skips anything that already exists.

-- 1. Game data. One row per document, grouped into collections:
--    players   one row per player (their rounds, leagues, badges); id = their user id
--    subs      each player's submitted questions and reports; id = their user id
--    community approved player-written questions
--    mod       moderation (hidden players, voided questions)
--    leagues   older league records (read only)
create table if not exists public.docs (
  collection text not null check (collection in ('players','subs','community','mod','leagues')),
  id         text not null,
  data       jsonb not null default '{}'::jsonb check (pg_column_size(data) < 250000),
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

-- 2. Display names shown on the leaderboards.
create table if not exists public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null check (char_length(name) between 2 and 24),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 3. Admins (you). Admins approve questions, void questions and hide players.
create table if not exists public.admins (
  user_id uuid primary key references auth.users on delete cascade
);

alter table public.docs     enable row level security;
alter table public.profiles enable row level security;
alter table public.admins   enable row level security;

-- Admin check lives in a private schema so it isn't callable through the public API.
create schema if not exists private;
grant usage on schema private to anon, authenticated;
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Who can read and write what.
drop policy if exists "docs read"   on public.docs;
drop policy if exists "docs insert" on public.docs;
drop policy if exists "docs update" on public.docs;

create policy "docs read" on public.docs for select using (
  collection in ('players','community','mod','leagues')
  or (collection = 'subs' and (id = auth.uid()::text or private.is_admin()))
);
create policy "docs insert" on public.docs for insert to authenticated with check (
  (collection = 'players' and id = auth.uid()::text)
  or (collection = 'subs' and (id = auth.uid()::text or private.is_admin()))
  or (collection in ('community','mod','leagues') and private.is_admin())
);
create policy "docs update" on public.docs for update to authenticated using (
  (collection = 'players' and id = auth.uid()::text)
  or (collection = 'subs' and (id = auth.uid()::text or private.is_admin()))
  or (collection in ('community','mod','leagues') and private.is_admin())
) with check (
  (collection = 'players' and id = auth.uid()::text)
  or (collection = 'subs' and (id = auth.uid()::text or private.is_admin()))
  or (collection in ('community','mod','leagues') and private.is_admin())
);

drop policy if exists "profiles read"   on public.profiles;
drop policy if exists "profiles insert" on public.profiles;
drop policy if exists "profiles update" on public.profiles;
create policy "profiles read"   on public.profiles for select using (true);
create policy "profiles insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "admins read own" on public.admins;
create policy "admins read own" on public.admins for select to authenticated using (user_id = auth.uid());

grant select on public.docs, public.profiles to anon, authenticated;
grant insert, update on public.docs, public.profiles to authenticated;
grant select on public.admins to authenticated;

-- Live updates for leaderboards and leagues.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 4. AFTER you have signed in to the game once, make yourself the admin.
--    Replace the email below with yours, then run just this line:
-- insert into public.admins (user_id) select id from auth.users where email = 'you@example.com' on conflict do nothing;
