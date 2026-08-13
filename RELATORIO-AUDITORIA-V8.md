# Relatório de auditoria — InfoTech V8.0

## Resultado automatizado

A versão foi preparada para passar pelos seguintes testes locais:

- 24 páginas HTML;
- IDs duplicados;
- recursos e links internos quebrados;
- âncoras internas;
- `alt`, `width` e `height` em imagens;
- campos com label acessível;
- botões com `type`;
- `noindex` nas páginas privadas;
- canonical e Open Graph nas páginas públicas;
- CSP presente e sem `unsafe-inline`;
- ausência de estilos/event handlers inline;
- ausência de senha em Web Storage;
- ausência de `service_role` em JavaScript público;
- ausência de `eval`/`new Function`;
- formatos de upload perigosos removidos;
- CSS parseável;
- manifest JSON válido;
- sitemap XML válido;
- sintaxe dos quatro arquivos JavaScript verificada pelo Node.

## Segurança implementada no código

### Autenticação
- PKCE.
- sessão com chave dedicada;
- política de senha no cliente;
- login inválido com mensagem genérica;
- senha nunca copiada para Web Storage;
- MFA TOTP para administração.

### Banco/Supabase
- RLS em dados do cliente;
- usuário bloqueado não passa pelas políticas V8;
- admin depende do banco e, quando possui MFA, de AAL2;
- novos usuários entram como `client`;
- perfil sincronizado após alteração de nome/e-mail;
- RPCs administrativas exigem admin;
- cliente não pode alterar campos administrativos da solicitação;
- cliente só pode anexar uma nova mensagem por atualização.

### Arquivos
- bucket privado;
- caminho vinculado ao UID;
- limite de 10 MB;
- allowlist de tipos;
- validação cliente de extensão/MIME/assinatura básica;
- URL assinada com validade curta.

### Front-end
- CSP;
- páginas privadas `noindex`;
- escape de conteúdo dinâmico nos principais templates;
- URLs externas filtradas para HTTP/HTTPS;
- `noopener noreferrer`;
- redução de movimento respeitada.

## O que a auditoria local NÃO substitui

Ela não substitui:
- pentest externo;
- scanner de vulnerabilidades contra a URL publicada;
- teste de TLS/headers reais do servidor;
- inspeção da configuração do painel Supabase;
- teste real das policies depois que o SQL for aplicado;
- análise de malware de uploads;
- revisão jurídica/LGPD.

Esses pontos estão separados no `CHECKLIST-PRODUCAO-V8.md`.
