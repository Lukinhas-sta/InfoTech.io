# InfoTech.io V6 — Preview

## O que já está neste pacote

- Nova identidade visual baseada na logo enviada.
- Home totalmente refeita com foco em conversão.
- Páginas de Serviços, Solicitações, Projetos, Contato e Sobre.
- Login, cadastro, confirmação de e-mail e recuperação de senha.
- Redirecionamento após confirmação de e-mail quando o Supabase devolver uma sessão válida.
- Área do cliente responsiva.
- Nova solicitação, lista de solicitações, detalhes, chat, arquivos e andamento do projeto usando o Supabase atual.
- Layout responsivo para celular e computador.
- Acessibilidade básica (skip link, labels, navegação por teclado, reduced motion).
- SQL opcional de hardening em `SUPABASE-SECURITY-V6.sql`.

## Como testar

1. Extraia a pasta.
2. Abra um terminal dentro dela.
3. Rode um servidor local:
   - Python: `python -m http.server 8080`
4. Abra `http://localhost:8080`.

> O Supabase pode exigir que `http://localhost:8080` esteja na lista de URLs permitidas em Authentication > URL Configuration para testar confirmação/recuperação localmente.

## Como colocar no GitHub depois

Este pacote foi preparado para substituir as páginas públicas e de cliente do repositório atual.
Antes de publicar em produção:
1. Faça backup/branch.
2. Teste cadastro, confirmação, login, solicitação, chat e upload.
3. Só depois envie os arquivos para `main`.

## Segurança importante

A chave incluída no JavaScript é a chave **publicável** do Supabase. Nunca coloque `service_role`, `sb_secret` ou senha administrativa em HTML/JS público.
