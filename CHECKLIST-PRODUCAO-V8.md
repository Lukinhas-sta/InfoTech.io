# Checklist de produção — InfoTech V8.0

Faça estes passos **nesta ordem**.

## 1. Backup

- [ ] Baixar/exportar o banco atual do Supabase.
- [ ] Guardar uma cópia do ZIP V7 que está funcionando.
- [ ] Testar a V8 em ambiente separado antes de substituir produção.

## 2. Aplicar a segurança do banco

- [ ] Abrir o SQL Editor do Supabase.
- [ ] Revisar e executar `SUPABASE-HARDENING-V8.sql`.
- [ ] Confirmar que as tabelas `profiles`, `requests`, `request_files`, `request_projects` e `request_events` existem.
- [ ] Confirmar que o bucket `request-files` continua **privado**.
- [ ] Confirmar que as RPCs `admin_list_clients`, `admin_set_client_blocked` e `admin_save_request_project_v2` aparecem no projeto.

## 3. Testar isolamento de dados

Crie **duas contas de cliente diferentes**.

- [ ] Cliente A cria uma solicitação.
- [ ] Cliente B não consegue ler a solicitação do Cliente A.
- [ ] Cliente B não consegue alterar a solicitação do Cliente A.
- [ ] Cliente B não consegue abrir arquivos do Cliente A.
- [ ] Cliente bloqueado perde acesso aos dados protegidos.
- [ ] Cliente comum não consegue chamar ações administrativas.

## 4. Admin e MFA

- [ ] Entre com uma conta `role = admin`.
- [ ] Abra `admin-seguranca.html`.
- [ ] Cadastre o TOTP em um aplicativo autenticador.
- [ ] Confirme que o painel exige AAL2 depois que o MFA estiver verificado.
- [ ] Guarde códigos/recuperação do autenticador em local seguro.

## 5. Autenticação

No painel do Supabase Auth:

- [ ] Configure a URL oficial `https://infotech-io.com.br`.
- [ ] Cadastre somente Redirect URLs necessárias.
- [ ] Teste cadastro + confirmação de e-mail.
- [ ] Teste recuperação de senha.
- [ ] Teste alteração de e-mail.
- [ ] Configure SMTP próprio antes de depender do fluxo em produção.
- [ ] Revise os rate limits.
- [ ] Ative proteção anti-bot/CAPTCHA quando decidir o provedor.
- [ ] Revise a política mínima de senha no próprio Supabase.

## 6. Hospedagem e headers

O HTML já contém uma CSP por `meta`, mas os headers reais devem ser configurados no servidor/proxy.

- [ ] Aplicar o conteúdo de `SECURITY-HEADERS-V8.md`.
- [ ] HSTS.
- [ ] `X-Content-Type-Options: nosniff`.
- [ ] `Referrer-Policy`.
- [ ] `Permissions-Policy`.
- [ ] `frame-ancestors 'none'` / proteção anti-clickjacking.
- [ ] Considerar separar `app.infotech-io.com.br` e `admin.infotech-io.com.br` da landing page estática.

## 7. Uploads

- [ ] Testar JPG, PNG, WebP, PDF e TXT válidos.
- [ ] Confirmar rejeição de ZIP, EXE, DOC/DOCX e arquivos acima de 10 MB.
- [ ] Não abrir arquivo de cliente em máquina administrativa sem proteção/antimalware.
- [ ] Se o volume crescer, adicionar análise de malware no backend.

## 8. Privacidade

- [ ] Revisar `privacidade.html` com os dados reais da empresa/controlador.
- [ ] Informar um canal real para solicitações de privacidade.
- [ ] Definir por quanto tempo solicitações, mensagens e arquivos serão guardados.
- [ ] Definir processo de exclusão/correção de dados.

## 9. SEO e publicação

- [ ] Conferir `CNAME`.
- [ ] Conferir `robots.txt`.
- [ ] Conferir `sitemap.xml`.
- [ ] Testar preview do link em WhatsApp/Instagram.
- [ ] Cadastrar sitemap no Google Search Console.
- [ ] Testar 404.
- [ ] Conferir favicon/PWA no celular.

## 10. Teste final visual

Testar pelo menos:

- [ ] 360 px.
- [ ] 390/412 px.
- [ ] Tablet.
- [ ] Notebook 1366×768.
- [ ] Desktop Full HD.
- [ ] Chrome.
- [ ] Edge.
- [ ] Safari/iPhone, se houver acesso.
- [ ] Navegador interno do Instagram.

Verificar:

- [ ] nenhuma rolagem horizontal;
- [ ] menus e dropdowns;
- [ ] carrosséis sem travamento/piscada;
- [ ] animações sem deslocar layout;
- [ ] botões fáceis de tocar;
- [ ] formulários com teclado móvel correto;
- [ ] navegação por teclado;
- [ ] modo `prefers-reduced-motion`.

## 11. Só depois

- [ ] Publicar.
- [ ] Rodar o GitHub Actions.
- [ ] Fazer um cadastro real de teste.
- [ ] Fazer uma solicitação real de teste.
- [ ] Responder pelo admin.
- [ ] Abrir arquivo assinado.
- [ ] Testar bloqueio de usuário.
- [ ] Testar logout e expiração de sessão.

Quando todos os itens críticos passarem, a V8 pode virar a versão de produção.
