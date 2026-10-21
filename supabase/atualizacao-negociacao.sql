-- Pokédex TCG: atualização "Negociação" (listas de vender/trocar e procurar).
-- Como usar: no painel do Supabase, abra "SQL Editor", crie uma consulta nova, cole este arquivo e clique em "Run".
-- É seguro rodar mais de uma vez. Não mexe em nada que você já tem.

create table if not exists public.trade_lists (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

drop trigger if exists trade_lists_touch on public.trade_lists;
create trigger trade_lists_touch before update on public.trade_lists
  for each row execute function public.touch_updated_at();

alter table public.trade_lists enable row level security;

drop policy if exists "trade_lists: só o dono" on public.trade_lists;
create policy "trade_lists: só o dono" on public.trade_lists
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
