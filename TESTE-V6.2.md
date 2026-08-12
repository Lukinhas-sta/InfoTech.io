# InfoTech V6.2 — roteiro rápido de teste

## O que mudou nesta revisão
- Correção de estouro horizontal/fenda preta no celular.
- Scrollbar vertical escondida no celular.
- Carrosséis sem setas: arraste com o dedo; o movimento usa a inércia natural do aparelho.
- Carrosséis automáticos avançam após ~5 segundos sem interação.
- Serviços em linha horizontal no celular e lado a lado no desktop.
- Processo da Home redesenhado para ocupar menos altura.
- Ícone da Área do Cliente anima o bonequinho, sem anel de aura.
- Cadeado do login abre para cima/baixo.
- Projetos viraram portfólio horizontal clicável; Rass Studio abre o site publicado.
- Marca Rass Studio incluída no card do projeto.
- Bloco “Primeira vez aqui?” removido de Contato.
- Bloco “Conte o que você precisa” removido do fim de Serviços.
- No Sobre, a estrela pulsa e avança para o próximo card.

## Teste no celular
1. Home: confirme que não existe faixa/fenda preta na direita.
2. Arraste os carrosséis devagar e depois com força. O gesto forte deve percorrer mais distância.
3. Pare de tocar por cerca de 5 segundos e veja o carrossel avançar sozinho.
4. Confirme que não aparecem setas nos carrosséis.
5. Confira que a barra de rolagem vertical não fica visível.
6. Serviços: os cards devem ficar lado a lado e deslizar horizontalmente.
7. Projetos: arraste os projetos e toque em Rass Studio para abrir o site.
8. Sobre: toque na estrela brilhante para ir ao próximo valor.
9. Login: o formulário aparece primeiro; o cadeado abre verticalmente.
10. Cabeçalho: o ícone de usuário deve se movimentar sozinho.

## Teste no computador
1. Confirme que Serviços e Projetos ficam lado a lado.
2. Nos carrosséis da Home, arraste com o mouse e solte para testar a inércia.
3. Verifique menu, login, cadastro e Área do Cliente.
4. Teste links de solicitação e links do portfólio.

> Esta é uma versão de preview. Não substituir a branch principal antes de validar o fluxo de login/Supabase no ambiente publicado.
