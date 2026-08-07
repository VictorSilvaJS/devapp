# Documentacao do Projeto

Esta pasta concentra a documentacao oficial do projeto. O objetivo e separar com clareza:

- o que representa estado atual e direcao ativa
- o que serve como apoio tecnico e operacional
- o que e apenas revisao ou historico

`docs/project/` e o nucleo documental ativo e prioritario. Em caso de conflito, ele deve prevalecer sobre as demais pastas de `docs/`.

Para agentes de codigo, o ponto de entrada rapido do repositorio e `../AGENTS.md`.
Ele resume o protocolo operacional e aponta para as regras completas em
`project/instrucoes-para-ia.md`.

## Hierarquia de Leitura

Ao interpretar a documentacao, use esta ordem:

1. `docs/project/`
2. `docs/architecture/`
3. `docs/guides/`
4. `docs/testing/`
5. `docs/reviews/`
6. `docs/archive/` apenas como historico

## Estrutura

### `project/`
- Nucleo documental ativo do projeto.
- Reune estado atual, contexto, escopo, regras, decisoes, pendencias, plano tecnico e backlog futuro.

### `architecture/`
- Apoio tecnico e arquitetural.
- Deve ser lida sempre em subordinacao ao que estiver definido em `project/`.

### `guides/`
- Guias operacionais, padroes e referencias de uso.

### `testing/`
- Materiais de teste, validacao funcional e roteiros de verificacao.

### `reviews/`
- Auditorias, revisoes e verificacoes que ajudam no contexto, mas nao substituem o nucleo ativo.

### `archive/`
- Historico preservado do projeto.
- Nao deve ser lido como estado atual sem confirmacao explicita em documentos ativos.

## Trilha Principal de Leitura

Para humanos e IA/agentes de codigo, a trilha recomendada comeca por:

1. [AGENTS.md](../AGENTS.md), quando a leitura for para execucao por agente
2. [Estado atual do projeto](project/estado-atual.md)
3. [Contexto consolidado](project/contexto-consolidado.md)
4. [Escopo do MVP](project/escopo-mvp.md)
5. [Regras de negocio](project/regras-de-negocio.md)
6. [Decisoes consolidadas](project/decisoes-consolidadas.md)
7. [Pendencias de definicao](project/pendencias-de-definicao.md)
8. [Plano de fechamento das pendencias pre-backend](project/plano-fechamento-pendencias-pre-backend-2026-08.md)
9. [Baseline aprovada para o backend v1](project/baseline-backend-v1-2026-08.md)
10. [Plano mestre de implementacao da revisao de QA](project/plano-mestre-implementacao-qa-2026-07.md)
11. [Plano de reorganizacao](project/plano-reorganizacao.md)
12. [Backlog futuro de evolucao](project/roadmap-futuro.md)

## Leitura Complementar

Depois da trilha principal:

1. [README da raiz](../README.md)
2. documentos de `architecture/` conforme a necessidade tecnica
3. documentos de `guides/` conforme o fluxo em estudo
4. documentos de `testing/` para validacao
5. [Contrato do mock v2](project/modelo-dados-mock-v2.md) e
   [dataset demonstrativo v2](project/dataset-demonstrativo-v2.md) quando a
   tarefa envolver dados locais, seed, geometrias ou bootstrap
6. [Auditoria de compatibilidade de fazenda_id](project/auditoria-compatibilidade-fazenda-id-2026-08.md)
   quando a tarefa envolver aliases legados, mapas/offline, rotas ou a futura
   remoção da leitura dupla

## Regra Pratica

- Documentacao viva deve ficar em `project/`, `architecture/`, `guides/` ou `testing/`.
- Revisoes pontuais vao para `reviews/`.
- Materiais obsoletos ou superseded vao para `archive/`.
- Evite criar novos `.md` na raiz do repositorio, exceto pontos de entrada operacionais como `AGENTS.md`.
