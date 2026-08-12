# InfoTech V6.6 — validação local

- Links e arquivos locais conferidos: sem referências quebradas.
- JavaScript conferido com `node --check`: sem erros de sintaxe.
- CSS conferido: chaves balanceadas.
- IDs duplicados: nenhum encontrado.
- Imagens com texto alternativo: conferidas.
- Cabeçalho possui personagem de fallback mesmo se o Supabase/CDN estiver lento ou indisponível.
- Scripts externos usam `defer` e preconnect para reduzir bloqueio de renderização.
- Efeito de aura das páginas internas usa transformação centralizada, evitando deslocamento lateral.
- Efeito neon foi simplificado para reduzir custo de filtro animado no celular.

Para testar, abra `index.html` ou sirva a pasta com um servidor local. Recursos de autenticação exigem internet e acesso ao Supabase.

- Patch SQL V6.6 adiciona guarda contra alteração de status/resposta pelo cliente e políticas explícitas para arquivos/progresso/storage.
