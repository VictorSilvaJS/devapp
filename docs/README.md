# Documentacao do Projeto

Este diretorio concentra a documentacao do projeto em categorias mais previsiveis. A ideia aqui e separar material vivo, que guia o trabalho atual, de revisoes e registros historicos.

## Como Ler Esta Pasta

Comece por estes arquivos:

1. [Estado atual do projeto](project/estado-atual.md)
2. [Plano de reorganizacao](project/plano-reorganizacao.md)
3. [Backlog futuro de evolucao](project/roadmap-futuro.md)
4. [README da raiz](../README.md)
5. [Guia de testes](testing/guia-testes.md)

## Estrutura

### `architecture/`
- Arquitetura tecnica, integracoes, filtros regionais e trilha de mapas/offline.

### `guides/`
- Guias operacionais e referencias de implementacao, como mapas, importacao de KML e padrao de icones.

### `project/`
- Documentos vivos de contexto do produto e do projeto, incluindo estado atual, plano de reorganizacao e backlog futuro.

### `testing/`
- Roteiros de teste e materiais de validacao funcional.

### `reviews/`
- Auditorias, verificacoes e revisoes tecnicas que continuam uteis como contexto, mas nao devem ser tratadas como fonte principal de verdade.

### `archive/`
- Materiais historicos preservados para consulta. Em geral, nao representam mais o estado atual do repositorio.

## Regra Pratica

- Documentacao viva deve ficar em `project/`, `architecture/`, `guides/` ou `testing/`.
- Revisoes pontuais vao para `reviews/`.
- Materiais obsoletos ou superseded vao para `archive/`.
- Evite criar novos `.md` na raiz do repositorio.

## Observacao

Use `project/estado-atual.md` como fonte principal de verdade sobre o repositorio. `project/plano-reorganizacao.md` organiza a ordem tecnica do trabalho e `project/roadmap-futuro.md` lista backlog de evolucao sem substituir esse plano. Documentos em `reviews/` e `archive/` podem refletir premissas antigas, promessas nao entregues ou caminhos que ja mudaram.
