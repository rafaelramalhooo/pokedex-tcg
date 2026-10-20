# Como abrir o app no seu Mac

Você não precisa saber programar. Siga na ordem.

## Preparação (só uma vez)

1. Aperte **Command + Espaço**, digite **Terminal** e aperte Enter. Abre uma janela com um texto e um cursor piscando.
2. Copie a linha abaixo, cole na janela (Command + V) e aperte Enter:

   chmod +x "$HOME/Documents/Pokemon TCG Gestão de Coleção/Abrir Pokedex.command"

   Não aparece nenhuma mensagem. Isso é normal e significa que deu certo. Pode fechar o Terminal.

## Todo dia que quiser usar

1. Abra a pasta **Pokemon TCG Gestão de Coleção**, dentro de Documentos.
2. Dê dois cliques no arquivo **Abrir Pokedex.command**.
3. Abre uma janela preta e, em seguida, o navegador com o app. Pronto.
4. **Deixe a janela preta aberta** enquanto estiver usando. Para encerrar, feche a janela preta.

Na primeira vez, o Mac pode avisar que o arquivo "não pode ser aberto". Nesse caso, clique com o botão direito no arquivo, escolha **Abrir** e, na janela que aparecer, clique em **Abrir** de novo. Depois disso, os dois cliques funcionam normalmente.

## Cuidados importantes

- **Use sempre o mesmo navegador** (recomendo o Chrome) e o mesmo endereço: **http://localhost:8080/**. A sua coleção fica guardada dentro do navegador, ligada a esse endereço. Se mudar de navegador, ela não aparece.
- Faça um **backup** de vez em quando: no app, abra **Catálogo e ajustes** e clique em **Exportar backup**. Guarde o arquivo gerado em um lugar seguro.
- Precisa estar conectado à internet, porque as informações e as imagens das cartas vêm da TCGdex.

## Se der erro

**A janela preta diz que não encontrou o Python 3.** Abra o Terminal e cole `xcode-select --install`. O Mac oferece instalar as ferramentas de desenvolvimento; aceite e espere terminar. Depois dê dois cliques no arquivo de novo.

**O navegador abre, mas a página não carrega.** A janela preta provavelmente foi fechada. Dê dois cliques em **Abrir Pokedex.command** de novo.

**A coleção "sumiu".** Quase sempre é outro navegador ou outro endereço. Volte ao navegador e ao endereço de sempre. Se os dados foram apagados, use **Importar backup** em **Catálogo e ajustes**.

## Sem o atalho (modo manual)

1. Abra o Terminal.
2. Cole e aperte Enter:

   cd "$HOME/Documents/Pokemon TCG Gestão de Coleção"

3. Cole e aperte Enter:

   python3 -m http.server 8080

4. Abra o navegador em http://localhost:8080/
5. Para encerrar, volte ao Terminal e aperte **Control + C**.

## Quando o app estiver publicado na internet

Você abre por um endereço do GitHub e não precisa mais de nada disso. Veja o guia **COMO-PUBLICAR-NO-GITHUB.md**.
