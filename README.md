# Pokédex TCG

App web para gerir a coleção de Pokémon Estampas Ilustradas (TCG): coleções, Set e Master Set, fichários por regras e, em breve, login e sincronização na nuvem.

Não é afiliado à The Pokémon Company. Dados e imagens vêm da TCGdex (tcgdex.dev).

## Estrutura

    index.html            página única
    css/app.css           estilos
    js/app.js             eventos, rotas e início
    js/state.js           estado global
    js/db.js              armazenamento local (IndexedDB); será complementado pelo Supabase
    js/api.js             acesso à TCGdex
    js/catalog.js         coleções, cartas, sincronização
    js/collection.js      coleção e contagens
    js/rules.js           regras dos fichários
    js/ui.js              peças de interface compartilhadas
    js/logos.js           logos com alternativas e diagnóstico
    js/tilt.js            efeito 3D da carta
    sw.js, manifest.webmanifest, icons/   app instalável (PWA) e abertura sem internet
    js/views/             telas (início, minhas coleções, coleção, popup da carta, fichários, editor, visual de fichário, ajustes)
    supabase/schema.sql   esquema do banco na nuvem (rascunho)
    docs/                 guias: abrir o app, publicar no GitHub, criar o Supabase
    Abrir Pokedex.command atalho para abrir o app no Mac
    tests/mock_test.py    teste ponta a ponta com a TCGdex simulada

Não há etapa de compilação: são arquivos estáticos, publicáveis direto no GitHub Pages.

## Rodar no computador

No Mac, dê dois cliques em `Abrir Pokedex.command`. O passo a passo completo, com os cuidados, está em `docs/COMO-ABRIR-O-APP.md`.

Se preferir pelo Terminal (módulos JavaScript não funcionam abrindo o arquivo direto):

    cd pasta-do-projeto
    python3 -m http.server 8080

Depois acesse http://localhost:8080/

## Testar

Requer Python com Playwright instalado:

    python3 tests/mock_test.py

## O que o app faz hoje

- **Minhas coleções:** você escolhe quais carregar; só elas aparecem e são baixadas.
- **Set e Master Set**, com cartas cinza (faltam) e coloridas (tenho), quantidade, acabamento, condição e idioma.
- **Decks**: monte decks de 60 cartas, busque pelo nome (inclusive só as que você tem) e veja na hora se ele respeita 60 cartas, 4 cópias por nome, Pokémon Básico, ACE SPEC/Radiante e o Standard (marcas editáveis; cartas reimpressas aparecem como aviso, por inferência). Exporta e importa no formato de texto do Pokémon TCG Live (`4 Nome SIGLA 123`) e gera uma página para imprimir ou salvar em PDF. Precisa rodar `supabase/atualizacao-decks.sql` uma vez para sincronizar os decks na nuvem. Dá para criar uma lista de Vendo/Troco ou Procuro a partir de um deck (Negociação).
- **Negociação**: listas "Vendo / Troco" e "Procuro" (com quantidade, acabamento e idioma), separadas da coleção. **Exportar imagem** (até 10 colunas, quantidade sobre cada carta) nas listas e nos fichários, para compartilhar. Precisa rodar `supabase/atualizacao-negociacao.sql` uma vez para sincronizar as listas na nuvem.
- **Fichários** por regras (tipo, Pokémon por nome, geração, ilustrador, raridade, coleção, Standard…), manuais ou no modo **Pokédex**.
- **Visual de fichário:** grades 2×2, 3×3, 3×4, 4×4, 5×4 ou personalizada, páginas, setas, teclado, deslize e página dupla no computador.
- **Popup da carta:** centralizado, com inclinação 3D e brilho (respeita "reduzir movimento"), carta anterior/próxima.
- **Celular:** menu embaixo, botões maiores, instalável na tela inicial.

## Pontos não verificados

- As faixas de geração (1ª: 1–151 … 9ª: 906–1025) vêm de conhecimento prévio, não de fonte oficial.
- Na Pokédex, o nome do Pokémon só aparece depois de baixar alguma carta dele; espaços sem carta mostram só o número.
- Logos de coleções novas dependem do que a TCGdex publica; use "Verificar logos" em Catálogo e ajustes.

## Situação

Hoje a coleção fica no navegador (IndexedDB), com exportação e importação de backup. O login e a sincronização com o Supabase são o próximo passo; veja `docs/COMO-CRIAR-O-SUPABASE.md`.


## Login e sincronização (versão 1.0)

- O login usa o Supabase (e-mail e senha). A conexão fica em `js/config.js` (só a Project URL e a chave pública). Enquanto o arquivo estiver vazio, o app funciona só no aparelho, sem login.
- O que sincroniza: coleção, fichários, decks, listas de negociação, ajustes e imagens próprias. O catálogo de cartas continua vindo da TCGdex em cada aparelho.
- Funciona offline: as alterações ficam guardadas e sobem quando a conexão volta.
- Ao sair da conta, os dados do aparelho são apagados (continuam na nuvem).
- Guia de configuração: `docs/COMO-CRIAR-O-SUPABASE.md`. Tabelas e regras de segurança: `supabase/schema.sql`.
- Testes: `python3 tests/mock_test.py` (app) e `python3 tests/cloud_test.py` (login e sincronização, com Supabase simulado).

- **Link público (Negociação)**: em uma lista, *Compartilhar link* gera um endereço só de leitura (nome, tipo, cartas e quantidades; sem login nem dados da conta). O link só muda quando você aperta *Atualizar link*, e *Parar de compartilhar* o derruba. Precisa rodar `supabase/atualizacao-link-publico.sql` uma vez.
- **30 Anos**: a letra (marca) da carta decide a legalidade no Standard; só as cartas da Celebração de 30 Anos que vêm sem letra na base entram por exceção (Ajustes), e a Coleção Clássica nunca.
- **Versão 3.1**: Decks, TCG Live, listas a partir de decks, link público e legalidade pela letra.
