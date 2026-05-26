# Planejador de Casamento

App web em React, Vite, TypeScript, Tailwind CSS e Supabase para planejamento de casamento.

## Rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie `.env` a partir de `.env.example` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. No Supabase SQL Editor, execute `supabase/schema.sql`.
4. Crie o bucket público/privado `wedding-files` no Supabase Storage, ou execute a parte de storage do SQL se disponível no seu plano.
5. Inicie:
   ```bash
   npm run dev
   ```

## Login

O cadastro cria um perfil. Ao entrar pela primeira vez, crie o casamento em Configurações. Membros vinculados em `wedding_members` acessam o mesmo planejamento.
# Planejador-Casamento
