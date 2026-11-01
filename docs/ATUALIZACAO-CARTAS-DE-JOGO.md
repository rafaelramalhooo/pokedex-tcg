# Cartas de jogo (v7): ativar a sincronização

As **Cartas de jogo** funcionam mesmo sem este passo, mas só ficam guardadas no aparelho onde você as cadastrou. Para que elas apareçam no celular, no computador e no backup da nuvem, faça isto **uma vez**:

1. Abra o painel do Supabase do seu projeto e clique em **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo `supabase/atualizacao-cartas-de-jogo.sql` (está na pasta do projeto), copie todo o conteúdo e cole na consulta.
4. Clique em **Run**. Deve aparecer "Success. No rows returned".

É seguro rodar mais de uma vez e não mexe em nada que você já tem.

Depois disso, abra o app, entre na sua conta e aguarde alguns segundos: as cartas de jogo já cadastradas sobem sozinhas.
