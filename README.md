# Pokédex TCG

App web para gerir a coleção de Pokémon Estampas Ilustradas (TCG): expansões, Set e Master Set, fichários por regras e, em breve, login e sincronização na nuvem.

Não é afiliado à The Pokémon Company. Dados e imagens vêm da TCGdex (tcgdex.dev).

## Estrutura

    index.html            página única
    css/app.css           estilos
    js/app.js             eventos, rotas e início
    js/state.js           estado global
    js/db.js              armazenamento local (IndexedDB); será complementado pelo Supabase
    js/api.js             acesso à TCGdex
    js/catalog.js         expansões, cartas, sincronização
    js/collection.js      coleção e contagens
    js/rules.js           regras dos fichários
    js/ui.js              peças de interface compartilhadas
    js/logos.js           logos com alternativas e diagnóstico
    js/tilt.js            efeito 3D da carta
    sw.js, manifest.webmanifest, icons/   app instalável (PWA) e abertura sem internet
    js/views/             telas (início, minhas expansões, expansão, popup da carta, fichários, editor, visual de fichário, ajustes)
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

- **Minhas expansões:** você escolhe quais carregar; só elas aparecem e são baixadas.
- **Set e Master Set**, com cartas cinza (faltam) e coloridas (tenho), quantidade, acabamento, condição e idioma.
- **Fichários** por regras (tipo, Pokémon por nome, geração, ilustrador, raridade, expansão, Standard…), manuais ou no modo **Pokédex**.
- **Visual de fichário:** grades 2×2, 3×3, 3×4, 4×4, 5×4 ou personalizada, páginas, setas, teclado, deslize e página dupla no computador.
- **Popup da carta:** centralizado, com inclinação 3D e brilho (respeita "reduzir movimento"), carta anterior/próxima.
- **Celular:** menu embaixo, botões maiores, instalável na tela inicial.

## Pontos não verificados

- As faixas de geração (1ª: 1–151 … 9ª: 906–1025) vêm de conhecimento prévio, não de fonte oficial.
- Na Pokédex, o nome do Pokémon só aparece depois de baixar alguma carta dele; espaços sem carta mostram só o número.
- Logos de expansões novas dependem do que a TCGdex publica; use "Verificar logos" em Catálogo e ajustes.

## Situação

Hoje a coleção fica no navegador (IndexedDB), com exportação e importação de backup. O login e a sincronização com o Supabase são o próximo passo; veja `docs/COMO-CRIAR-O-SUPABASE.md`.
