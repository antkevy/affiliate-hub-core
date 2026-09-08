-- Conversor de links do Mercado Livre: sessão (cookies + renovação) e histórico.

create table if not exists public.meli_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cookies text,
  status text not null default 'active' check (status in ('active', 'expired', 'error')),
  last_validated_at timestamptz default now(),
  last_error text,
  alert_email text,
  updated_at timestamptz default now()
);

create index if not exists meli_sessions_user_idx on public.meli_sessions (user_id, updated_at desc);

alter table public.meli_sessions enable row level security;

drop policy if exists "meli_sessions_select_own" on public.meli_sessions;
create policy "meli_sessions_select_own"
  on public.meli_sessions for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "meli_sessions_insert_own" on public.meli_sessions;
create policy "meli_sessions_insert_own"
  on public.meli_sessions for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "meli_sessions_update_own" on public.meli_sessions;
create policy "meli_sessions_update_own"
  on public.meli_sessions for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meli_sessions_delete_own" on public.meli_sessions;
create policy "meli_sessions_delete_own"
  on public.meli_sessions for delete
  to authenticated using (auth.uid() = user_id);

drop policy if exists "meli_sessions_service_role" on public.meli_sessions;
create policy "meli_sessions_service_role"
  on public.meli_sessions for all
  to service_role using (true) with check (true);

create table if not exists public.converted_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'message' check (mode in ('message', 'single')),
  source_text text not null,
  processed_text text not null,
  links jsonb not null default '[]'::jsonb,
  response_time_ms integer,
  created_at timestamptz default now()
);

create index if not exists converted_offers_user_idx
  on public.converted_offers (user_id, created_at desc);

alter table public.converted_offers enable row level security;

drop policy if exists "converted_offers_select_own" on public.converted_offers;
create policy "converted_offers_select_own"
  on public.converted_offers for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "converted_offers_insert_own" on public.converted_offers;
create policy "converted_offers_insert_own"
  on public.converted_offers for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "converted_offers_update_own" on public.converted_offers;
create policy "converted_offers_update_own"
  on public.converted_offers for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "converted_offers_delete_own" on public.converted_offers;
create policy "converted_offers_delete_own"
  on public.converted_offers for delete
  to authenticated using (auth.uid() = user_id);

drop policy if exists "converted_offers_service_role" on public.converted_offers;
create policy "converted_offers_service_role"
  on public.converted_offers for all
  to service_role using (true) with check (true);