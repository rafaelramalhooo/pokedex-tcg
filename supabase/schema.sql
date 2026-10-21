-- Pokédex TCG: esquema dos dados do usuário no Supabase (versão 1.0).
-- Como usar: no painel do Supabase, abra "SQL Editor", crie uma consulta nova, cole este arquivo e clique em "Run".
-- O catálogo de cartas NÃO fica aqui: ele vem da TCGdex e é guardado em cada aparelho.
-- Cada linha pertence a um usuário e só ele consegue ler ou alterar (regras de segurança por linha, RLS).

-- Coleção: uma linha por carta que o usuário tem ou anotou.
-- finishes guarda os acabamentos, por exemplo:
--   {"normal":{"q":2,"c":"NM","l":"pt"},"reverse":{"q":1,"c":"LP","l":"en"}}
create table if not exists public.collection (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  card_id    text        not null,
  set_id     text        not null,
  finishes   jsonb       not null default '{}'::jsonb,
  notes      text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
create index if not exists collection_set_idx on public.collection (user_id, set_id);

-- Fichários: regras ou cartas escolhidas, guardadas como JSON.
create table if not exists public.binders (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Ajustes: marcas legais do Standard, expansões escolhidas, preferências de exibição.
create table if not exists public.user_settings (
  user_id    uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Imagens próprias (logos de coleção, fotos de carta, capas de fichário), já reduzidas pelo app.
-- kind: 'logos' | 'cards' | 'covers'; data: a imagem como texto (data URL).
create table if not exists public.custom_images (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text        not null,
  id         text        not null,
  data       text        not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

-- Atualiza updated_at a cada alteração (útil para sincronizar vários aparelhos).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists collection_touch on public.collection;
create trigger collection_touch before update on public.collection
  for each row execute function public.touch_updated_at();

drop trigger if exists binders_touch on public.binders;
create trigger binders_touch before update on public.binders
  for each row execute function public.touch_updated_at();

drop trigger if exists custom_images_touch on public.custom_images;
create trigger custom_images_touch before update on public.custom_images
  for each row execute function public.touch_updated_at();

drop trigger if exists user_settings_touch on public.user_settings;
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- Segurança: só o dono da linha enxerga e altera.
alter table public.collection    enable row level security;
alter table public.binders       enable row level security;
alter table public.user_settings enable row level security;
alter table public.custom_images enable row level security;

drop policy if exists "collection: só o dono" on public.collection;
create policy "collection: só o dono" on public.collection
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "binders: só o dono" on public.binders;
create policy "binders: só o dono" on public.binders
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "custom_images: só o dono" on public.custom_images;
create policy "custom_images: só o dono" on public.custom_images
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings: só o dono" on public.user_settings;
create policy "user_settings: só o dono" on public.user_settings
  for all to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Negociação: listas de vender/trocar e procurar (também disponível separado em atualizacao-negociacao.sql).
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

-- Decks: decks de 60 cartas (também disponível separado em atualizacao-decks.sql).
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

-- Link público: listas de negociação compartilhadas só para leitura (também em atualizacao-link-publico.sql).
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
