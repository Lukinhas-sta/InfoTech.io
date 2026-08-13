# InfoTech.io — V8.0 Release Candidate

Versão preparada para teste final antes da publicação.

## O que mudou nesta versão

- autenticação do cliente com PKCE e sessão persistente;
- senha não é mais copiada para `sessionStorage`/`localStorage`;
- login inválido não tenta adivinhar se o e-mail existe;
- política de senha mais forte no front-end;
- MFA TOTP para contas administrativas;
- RLS V8 com bloqueio de usuário e autorização administrativa no banco;
- RPCs administrativas versionadas no SQL;
- uploads limitados a JPG, PNG, WebP, PDF e TXT, com validação de tamanho e assinatura básica;
- links assinados de arquivos com validade curta;
- CSP mais estrita, sem `unsafe-inline`;
- páginas privadas marcadas `noindex`;
- canonical, Open Graph, Twitter Cards, sitemap e robots;
- página de Privacidade e página de Segurança;
- PWA manifest com ícones 192/512;
- `.well-known/security.txt`;
- `404.html`;
- workflow GitHub Actions para auditoria de HTML, CSS, JavaScript e vazamento de segredos;
- auditoria local automatizada em `scripts/audit_site.py`;
- melhorias de acessibilidade: foco visível, labels, H1, `alt`, dimensões de imagens e `prefers-reduced-motion`;
- sincronização de nome/e-mail do Auth para `profiles` via trigger;
- nenhuma `service_role` deve existir no navegador.

## Teste local

Abra `index.html` para testar o visual estático. Para autenticação/Supabase, prefira servir a pasta por HTTP local ou publicar em um ambiente de teste.

## Banco de dados

O arquivo novo é:

`SUPABASE-HARDENING-V8.sql`

Execute primeiro em um projeto de teste ou após backup. Ele pressupõe as tabelas já usadas pela V7.

## Antes de produção

Leia:

- `CHECKLIST-PRODUCAO-V8.md`
- `SECURITY-HEADERS-V8.md`
- `RELATORIO-AUDITORIA-V8.md`

## Auditoria automática

```bash
python -m pip install beautifulsoup4==4.12.3 tinycss2==1.4.0
python scripts/audit_site.py
node --check css/jss/v6-ui.js
node --check css/jss/v6-app.js
node --check css/jss/v6-admin.js
node --check css/jss/supabase-config.js
```

A mesma validação roda no GitHub Actions após push/PR.

## Regra importante

A chave `publishable` do Supabase pode existir no navegador. **Nunca** coloque `service_role`, segredo SMTP, token privado, senha de banco ou chave administrativa em HTML/JS público.
