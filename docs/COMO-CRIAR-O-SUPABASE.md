# Como criar o Supabase (para o login)

**Este guia liga o login e a sincronização na nuvem (versão 1.0).** Siga na ordem.

Você precisa fazer, porque eu não posso criar contas ou digitar senhas em seu nome. Os nomes de menus podem mudar; procure o equivalente e me avise.

## Parte 1: criar o projeto

1. Acesse **supabase.com** e crie uma conta. Pode entrar com a sua conta do GitHub.
2. Clique em **New project**.
3. Preencha:
   - **Name:** `pokedex-tcg`
   - **Database password:** crie uma senha forte e **guarde-a num gerenciador de senhas**. Não me envie essa senha.
   - **Region:** escolha a mais próxima do Brasil (São Paulo, se aparecer).
4. Clique em **Create new project** e aguarde alguns minutos até terminar.

## Parte 2: criar as tabelas

1. No menu da esquerda, abra **SQL Editor** e crie uma consulta nova (**New query**).
2. Abra, no seu computador, o arquivo **supabase/schema.sql** (da pasta do projeto) com o TextEdit, copie todo o texto e cole na consulta.
3. Clique em **Run**. A mensagem de sucesso indica que as tabelas e as regras de segurança foram criadas.

## Parte 3: conferir o login por e-mail e senha

1. No menu da esquerda, abra **Authentication**.
2. Procure a área de provedores (**Providers**, dentro de **Sign In / Providers**) e confirme que **Email** está ligado.

## Parte 3b: configurar o endereço do site

Isso faz o e-mail de confirmação e o de recuperação de senha abrirem o seu app.

1. Em **Authentication**, abra **URL Configuration**.
2. Em **Site URL**, cole: `https://rafaelramalhooo.github.io/pokedex-tcg/`
3. Em **Redirect URLs**, clique em **Add URL**, cole o mesmo endereço e salve.

## Parte 4: copiar os dados para me enviar

1. Abra **Project Settings** (ícone de engrenagem) e depois **API** (ou **API Keys**).
2. Copie e me envie no chat:
   - a **Project URL** (algo como `https://abcdefgh.supabase.co`);
   - a chave pública, chamada **anon** ou **publishable**.

**Atenção:** nunca me envie a chave **service_role** ou **secret**, nem a senha do banco. A chave pública pode ir no código do site, porque a proteção dos seus dados está nas regras do banco.

## Parte 5: depois que o login estiver funcionando

1. Abra o app e crie a sua conta na tela de cadastro (confirme o e-mail, se ele pedir).
2. Volte ao Supabase, abra **Authentication** e desligue a opção que permite novos cadastros (**Allow new users to sign up**). Assim ninguém mais consegue criar conta no seu app.
