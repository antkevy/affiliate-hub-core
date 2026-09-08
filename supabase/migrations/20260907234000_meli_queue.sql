-- Fila de espera de ofertas do Mercado Livre: quando a sessão (cookie) expira
-- durante a conversão, a mensagem entra na fila para ser reprocessada depois de
-- o usuário colar um novo cookie. Também armazena o resultado quando processada.

create table if not exists public.meli_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'message' check (mode in ('message', 'single')),
  source_text text not null,
  source_links jsonb not null default '[]'::jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'processing', 'done', 'failed')),
  last_error text,
  result_links jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists meli_queue_user_status_idx
  on public.meli_queue (user_id, status, created_at desc);

alter table public.meli_queue enable row level security;

drop policy if exists "meli_queue_select_own" on public.meli_queue;
create policy "meli_queue_select_own"
  on public.meli_queue for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "meli_queue_insert_own" on public.meli_queue;
create policy "meli_queue_insert_own"
  on public.meli_queue for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "meli_queue_update_own" on public.meli_queue;
create policy "meli_queue_update_own"
  on public.meli_queue for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meli_queue_delete_own" on public.meli_queue;
create policy "meli_queue_delete_own"
  on public.meli_queue for delete
  to authenticated using (auth.uid() = user_id);

drop policy if exists "meli_queue_service_role" on public.meli_queue;
create policy "meli_queue_service_role"
  on public.meli_queue for all
  to service_role using (true) with check (true);