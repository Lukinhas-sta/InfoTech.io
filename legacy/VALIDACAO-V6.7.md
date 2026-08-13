# Validação técnica — V6.7

- 20 páginas HTML verificadas; referências locais sem arquivos ausentes.
- IDs HTML duplicados: nenhum encontrado.
- Imagens sem `alt`: nenhuma encontrada.
- Campos de formulário sem rótulo: nenhum encontrado.
- JavaScript validado com `node --check` em todos os arquivos.
- CSS analisado com `tinycss2` sem erro de parsing.
- SVGs validados como XML.
- Nenhuma chave administrativa do Supabase foi colocada no navegador; o frontend mantém somente a chave publicável.
- Rascunho de senha no fluxo login → cadastro usa `sessionStorage`, expira em 5 minutos, é removido ao ser lido e nunca vai para a URL.
- Como o Supabase não revela publicamente se um e-mail existe, credenciais inválidas seguem para o cadastro; se o endereço já possuir conta, a tela orienta recuperação de senha. Isso evita enumeração pública de usuários.
- Links de referência enviados por clientes são aceitos/renderizados somente com protocolo `http` ou `https`.
- Redirecionamentos preservam apenas destinos internos permitidos e o parâmetro de serviço sanitizado.
- Teste de carrossel: autoplay em 5 s, arraste curto, impulso rápido e múltiplas voltas no loop sem erro JavaScript; corrigida a condição de corrida ao atravessar a emenda do loop.
- Teste responsivo nas páginas principais em 390 px e 1440 px: nenhum overflow horizontal de página.
- Artes existentes do Instagram foram preservadas para Sites, Sistemas, Serviços, Projetos, Contatos e marca principal. As novas artes só cobrem categorias sem original.
