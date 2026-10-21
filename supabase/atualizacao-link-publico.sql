-- Pokédex TCG: atualização "Link público" (compartilhar uma lista de negociação só para leitura).
-- Como usar: no painel do Supabase, abra "SQL Editor", crie uma consulta nova, cole este arquivo e clique em "Run".
-- É seguro rodar mais de uma vez. Não mexe em nada que você já tem.
--
-- Segurança: a tabela só pode ser lida e alterada pelo dono. Quem recebe o link não acessa a tabela:
-- ele chama uma função que devolve apenas a lista daquele código (nome, tipo, cartas e quantidades).
-- Nada da sua conta, coleção ou decks entra nessa cópia.

create table if not exists public.shared_lists (
  id         text        primary key check (char_length(id) >= 20),
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb       not null check (pg_column_size(data) < 300000),
  updated_at timestamptz not null default now()
);

drop trigger if exists shared_lists_touch on public.shared_lists;
create trigger shared_lists_touch before update on public.shared_lists
  for each row execute function public.touch_updated_at();

alter table public.shared_lists enable row level security;

drop policy if exists "shared_lists: só o dono" on public.shared_lists;
create policy "shared_lists: só o dono" on public.shared_lists
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.get_shared_list(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select data from public.shared_lists where id = p_code limit 1;
$$;

revoke all on function public.get_shared_list(text) from public;
grant execute on function public.get_shared_list(text) to anon, authenticated;
