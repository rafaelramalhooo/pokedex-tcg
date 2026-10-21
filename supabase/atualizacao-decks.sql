-- Pokédex TCG: atualização "Decks" (montagem de decks de 60 cartas).
-- Como usar: no painel do Supabase, abra "SQL Editor", crie uma consulta nova, cole este arquivo e clique em "Run".
-- É seguro rodar mais de uma vez. Não mexe em nada que você já tem.

create table if not exists public.decks (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

drop trigger if exists decks_touch on public.decks;
create trigger decks_touch before update on public.decks
  for each row execute function public.touch_updated_at();

alter table public.decks enable row level security;

drop policy if exists "decks: só o dono" on public.decks;
create policy "decks: só o dono" on public.decks
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
