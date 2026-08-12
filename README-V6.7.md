# InfoTech.io V6.7 — Preview

Versão de teste antes do envio ao GitHub.

## Principais ajustes
- Artes originais do Instagram reutilizadas onde já existiam: `logo.webp`, `sites.webp`, `sistemas.webp`, `servicos.webp`, `projetos.webp` e `contatos.webp`.
- Novos emblemas somente para categorias que não tinham arte própria: Aplicativos, Automação, Programas e Suporte, mantendo o tema circular preto/ciano/azul.
- Logos e emblemas do conteúdo ficam estáticos; o movimento de atenção fica apenas no personagem da Área do Cliente e no pulso do logo central do rodapé.
- Personagem do cabeçalho com cabelo, braços, antebraços e mãos animados.
- Carrosséis reescritos para evitar piscadas ao encaixar, aceitar arraste curto, impulso proporcional à força e loop realmente contínuo, inclusive ao atravessar a emenda das cópias.
- Login: quando as credenciais não são reconhecidas, o cadastro abre com e-mail e senha preenchidos via `sessionStorage` (não vai senha na URL). Se o e-mail já tiver conta, o cadastro orienta recuperação de senha.
- Destino e serviço escolhido são preservados no fluxo login → cadastro → confirmação → nova solicitação.
- Imagens das páginas internas ficam centralizadas e sem anéis animados adicionais.

## Teste local
Extraia a pasta e abra `index.html`. Para testar autenticação/Supabase, use o domínio publicado ou um servidor local HTTP, pois callbacks de confirmação dependem da configuração de URL do Supabase.

## Publicação
Depois de aprovar o preview, envie todo o conteúdo desta pasta para a raiz do repositório que publica `infotech-io.com.br`.
