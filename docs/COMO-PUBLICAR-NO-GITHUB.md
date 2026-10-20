# Como publicar no GitHub (de graça, sem terminal)

Resultado: o app fica na internet, num endereço seu, e você abre no computador e no celular. O repositório será **público**, como você escolheu. Isso significa que o código pode ser visto por qualquer pessoa. Sua coleção **não** fica no repositório.

Os nomes de botões podem estar em inglês ou ligeiramente diferentes; procure o equivalente. Se algo não bater, me mande uma captura de tela.

## Parte 1: instalar o GitHub Desktop

1. Acesse **desktop.github.com**, baixe e instale o GitHub Desktop.
2. Abra o programa e entre com a sua conta do GitHub.

## Parte 2: enviar a pasta para o GitHub

1. No GitHub Desktop, abra o menu **File** (Arquivo) e escolha **Add Local Repository…** (Adicionar repositório local).
2. Clique em **Choose…** e selecione a pasta **Pokemon TCG Gestão de Coleção**, dentro de Documentos. Clique em **Add Repository**.
3. Se aparecer um aviso dizendo que a pasta não é um repositório Git, clique no link **create a repository** (criar um repositório) e depois no botão **Create Repository**, sem mudar nada.
4. Na lista de arquivos à esquerda, deixe tudo marcado. Embaixo, no campo **Summary**, escreva `Primeira versão` e clique no botão azul **Commit to main**.
5. Clique em **Publish repository** (no topo).
6. Na janela que abrir:
   - **Name:** `pokedex-tcg`
   - **Desmarque** a opção **Keep this code private** (para o repositório ficar público).
   - Clique em **Publish repository**.

## Parte 3: ligar o site (GitHub Pages)

1. No navegador, abra **github.com**, entre no repositório **pokedex-tcg** e clique na aba **Settings**.
2. No menu da esquerda, clique em **Pages**.
3. Em **Build and deployment**, em **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha **main** e a pasta **/ (root)**. Clique em **Save**.
5. Aguarde de 1 a 3 minutos e recarregue a página. O endereço do seu app aparece no topo, no formato **https://SEU-USUARIO.github.io/pokedex-tcg/**. Me envie esse endereço que eu confiro se está funcionando.

## Para atualizar o site depois

Sempre que eu alterar arquivos da pasta:

1. Abra o GitHub Desktop.
2. Escreva um resumo curto no campo **Summary** (por exemplo, "Novos fichários").
3. Clique em **Commit to main** e depois em **Push origin**.
4. O site se atualiza sozinho em alguns minutos.

## Cuidados

- **Cada endereço tem a sua própria coleção.** O app aberto em `localhost:8080` e o app aberto no endereço do GitHub guardam dados separados. Para levar a coleção de um para o outro, use **Exportar backup** e **Importar backup** em **Catálogo e ajustes**. Quando ligarmos o login, isso deixa de ser necessário.
- Se o seu Mac sincroniza **Documentos** com o iCloud, a pasta oculta do Git pode dar conflito. Para conferir, abra **Ajustes do Sistema**, clique no seu nome, depois em **iCloud** > **Drive** e veja se **Pastas Mesa e Documentos** está ligada. Se estiver, me avise que eu sugiro uma alternativa.
