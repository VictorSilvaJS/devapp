# Plano Mestre de Implementação da Revisão de QA — Julho de 2026

> Status: `ATIVO`
>
> Criado em: 2026-07-30
>
> Próxima tarefa: finalizar a revalidação de `MP-07 — Login responsivo` com
> IME que respeite o modo inline em paisagem; `MP-08` a `MP-13` foram
> concluídas; `MP-14`, `MP-15`, `MP-16`, `MP-17` e `MP-18` também foram
> concluídas; `MP-19` não foi iniciada

## 1. Objetivo

Este documento transforma a revisão manual de QA executada entre 23 e 30 de
julho de 2026 em uma fila controlada de implementação, validação e aceite.

Ele deve permitir que cada problema seja resolvido em uma conversa, branch e
entrega delimitadas, sem perder as observações levantadas durante o teste do
Android.

A evidência de origem é:

- [Revisão completa de QA Android — 23 a 30 de julho de 2026](../reviews/revisao-qa-android-2026-07-30.md)

O relatório registra o que foi observado. Este plano controla como cada ponto
será tratado. As regras efetivas continuam sendo definidas por
`regras-de-negocio.md`, `decisoes-consolidadas.md` e
`pendencias-de-definicao.md`.

## 2. Relação com os demais documentos ativos

Este plano:

- não substitui `estado-atual.md`;
- não altera sozinho uma regra de negócio;
- não fecha uma pendência apenas por listar uma tarefa;
- não substitui `plano-reorganizacao.md`, que define a ordem técnica mais
  ampla do projeto;
- não substitui `roadmap-futuro.md`, que reúne evoluções futuras;
- usa o relatório de `docs/reviews/` somente como evidência;
- exige que cada decisão necessária seja promovida ao documento ativo correto
  antes da implementação correspondente.

Se houver conflito, prevalece esta ordem:

1. regras e decisões ativas;
2. pendências de definição;
3. plano técnico e roadmap;
4. este plano operacional;
5. relatório e evidências históricas.

## 3. Princípios de execução

1. Trabalhar em uma tarefa `MP-*` por conversa sempre que possível.
2. Não alterar código enquanto a tarefa estiver com decisão funcional
   pendente.
3. Não tratar proteção visual do mock como segurança de produção.
4. Preservar `Propriedade`, `Produtor`, `Titular`, `Talhão` e a compatibilidade
   temporária de `fazenda_id`.
5. Evitar duas tarefas simultâneas nos mesmos arquivos.
6. Implementar o menor corte que satisfaça os critérios de aceite.
7. Executar testes automáticos e smoke manual proporcional ao risco.
8. Atualizar este plano no fechamento de cada tarefa.
9. Não marcar item como concluído quando faltar backend, auditoria, teste de
   rota direta ou validação em campo exigida pelo próprio item.
10. Fazer regressão completa somente depois das tarefas predecessoras.

## 4. Estados permitidos

| Estado | Significado |
|---|---|
| `BACKLOG` | Registrado, mas ainda não é o próximo item executável |
| `EM_ESPECIFICACAO` | Regra, contrato ou solução está sendo definida |
| `PRONTO` | Dependências resolvidas e critérios mínimos definidos |
| `EM_IMPLEMENTACAO` | Código ou documentação da tarefa está sendo alterado |
| `EM_VALIDACAO` | Implementação pronta, aguardando testes ou smoke |
| `PARCIAL` | Corte local concluído, mas fechamento produtivo ainda pendente |
| `BLOQUEADO` | Depende de decisão, backend, dado, ambiente ou autoridade externa |
| `CONCLUIDO` | Critérios, testes, documentação e evidências completos |

Somente `CONCLUIDO` fecha uma tarefa. `PARCIAL` não deve ser contabilizado como
conclusão total.

## 5. Critério de entrada de uma tarefa

Uma tarefa só passa para `PRONTO` quando possui:

- objetivo delimitado;
- itens `QA-P*` relacionados;
- documentos ativos que sustentam a mudança;
- comportamento esperado;
- critérios de aceite;
- arquivos ou áreas prováveis;
- dependências conhecidas;
- fora de escopo;
- testes automáticos e manuais planejados.

Quando a tarefa depender de decisão de produto, a primeira entrega deve ser a
atualização da documentação ativa. A edição de código ocorre em uma tarefa
posterior ou em um segundo estágio claramente separado.

## 6. Critério global de conclusão

Para marcar uma tarefa como `CONCLUIDO`, registrar:

- arquivos alterados;
- decisão ativa que sustenta a implementação;
- resultado de `npm run typecheck`;
- resultado de `npm run test:domain-compat`;
- testes focados adicionais, quando existirem;
- smoke aplicável de `docs/project/smoke.md`;
- perfis testados;
- retrato, paisagem e teclado quando relevantes;
- evidências salvas em `dist/qa-session-AAAA-MM-DD/`;
- revisão do diff;
- commit ou referência da entrega;
- pendências remanescentes.

Mudanças exclusivamente documentais não exigem as suites de código, mas devem
passar em `git diff --check`, validação de links e revisão de consistência.

## 7. Separação entre MVP local e fechamento produtivo

Os itens P0 possuem dois cortes:

### Corte local

Pode melhorar coerência, impedir ações indevidas na interface mockada, criar
contratos de domínio e preparar repositories/services. Esse corte não comprova
segurança.

### Corte produtivo

Exige backend, autorização no servidor, persistência real, auditoria,
revogação, testes negativos e validação de rota direta.

Um P0 só pode ser considerado integralmente resolvido depois do corte
produtivo. Até lá, o estado máximo permitido para o item pai é `PARCIAL`.

## 8. Fila mestre de execução

As tarefas devem ser executadas na ordem abaixo, salvo dependência ou decisão
nova registrada neste documento.

### Fase 0 — Baseline e contratos críticos

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 1 | `MP-00` Baseline técnico | todos | Registrar estado inicial, testes, build e riscos antes das correções | nenhuma | `CONCLUIDO` |
| 2 | `MP-01` Política de sessão | `QA-P0-04` | Definir expiração, revalidação, logout, offline e retomada segura | `MP-00` | `CONCLUIDO` |
| 3 | `MP-02` Modelo territorial e bloqueio de autoedição | `QA-P0-02`, `QA-P2-08` | Separar Município/UF de Regional/Área e impedir autoatribuição territorial | `MP-00` | `CONCLUIDO` |
| 4 | `MP-03` Contrato de notificações | `QA-P0-01` | Definir destinatário, escopo, recurso, persistência e navegação segura | `MP-00` | `CONCLUIDO` |
| 5 | `MP-04` Ciclo de vida do Caderno | `QA-P0-03` | Formalizar rascunho, registro imutável, complemento, correção, anulação e auditoria | `MP-00` | `CONCLUIDO` |
| 6 | `MP-05` Estados de Visita | `QA-P1-04` | Formalizar transições, atraso, conclusão, cancelamento e correção auditada | `MP-00` | `CONCLUIDO` |
| 7 | `MP-06` Contrato de versão do GeoJSON | `QA-P1-06` | Formalizar identidade lógica, versões, reconciliação e linhagem de Talhões | `MP-00` | `CONCLUIDO` |

#### Entregas mínimas da Fase 0

- regras aprovadas nos documentos ativos;
- contratos compatíveis com mock atual e backend futuro;
- riscos que não podem ser resolvidos localmente marcados como bloqueados;
- nenhuma alegação de segurança baseada somente na interface.

### Fase 1 — Correções comuns e de baixo acoplamento

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 8 | `MP-07` Login responsivo | `QA-P1-03` | Corrigir teclado, rolagem e mudança de orientação | `MP-00` | `PARCIAL` |
| 9 | `MP-08` Semântica do X nos filtros | `QA-P1-09` | Fazer X cancelar rascunho ou adotar aplicação imediata explícita | `MP-00` | `CONCLUIDO` |
| 10 | `MP-09` Componente padrão de filtros | `QA-P2-04` | Criar bottom sheet comum e migrar telas gradualmente | `MP-08` | `CONCLUIDO` |
| 11 | `MP-10` Cabeçalhos e retorno | `QA-P2-05` | Padronizar seta, botão Android e preservação de contexto | `MP-00` | `CONCLUIDO` |
| 12 | `MP-11` Contraste e opacidade | `QA-P2-09` | Corrigir tokens e pares semânticos de superfície/texto | `MP-00` | `CONCLUIDO` |
| 13 | `MP-12` Linguagem e formatação | `QA-P2-17`, `QA-P3-01` | Padronizar Coleta de Solo, áreas, rótulos e nomes técnicos | `MP-00` | `CONCLUIDO` |
| 14 | `MP-13` Validação visual dos formulários | `QA-P2-16` | Sinalizar obrigatórios, focar primeiro erro e manter mensagens junto ao campo | `MP-00` | `CONCLUIDO` |
| 15 | `MP-14` Espaçamento seguro e FAB | `QA-P2-18` | Preservar conteúdo final e remover oclusão transitória relevante | `MP-00` | `CONCLUIDO` |

#### Subtarefas obrigatórias de `MP-09`

1. definir API e comportamento do componente;
2. migrar Propriedades;
3. migrar Usuários/Produtores;
4. migrar Visitas;
5. migrar Caderno;
6. migrar Materiais;
7. validar teclado, X, Aplicar, Limpar e chips ativos em cada tela.

Cada migração pode virar uma conversa e branch própria se o diff crescer.

### Fase 2 — Arquitetura de informação e responsividade

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 16 | `MP-15` Navegação da Propriedade | `QA-P2-01` | Adotar Resumo, Talhões, Safras e Safrinha, Materiais, Visitas e Caderno | `MP-10` | `CONCLUIDO` |
| 17 | `MP-16` Entrada de Talhões | `QA-P2-02` | Criar `Lista \| Mapa`, com Lista inicial no celular | `MP-15` | `CONCLUIDO` |
| 18 | `MP-17` Filtros de Materiais | `QA-P2-03` | Reduzir poluição, eliminar seleção inicial indevida e organizar chips | `MP-09`, `MP-15` | `CONCLUIDO` |
| 19 | `MP-18` Dashboards e indicadores responsivos | `QA-P2-06` | Corrigir grids, paisagem, largura dos cartões e colisão com FAB | `MP-11`, `MP-14` | `CONCLUIDO` |
| 20 | `MP-19` Resumo da Propriedade | `QA-P2-07` | Remover repetição e priorizar indicadores úteis ao perfil | `MP-15` | `BACKLOG` |
| 21 | `MP-20` Perfil do Produtor | `QA-P2-12` | Corrigir falsa affordance e oferecer solicitação de atualização | `MP-10` | `BACKLOG` |
| 22 | `MP-21` Sistema de cartões operacionais | `QA-P2-10` | Criar casca comum para Caderno e Visitas sem apagar diferenças de domínio | `MP-11` | `BACKLOG` |
| 23 | `MP-22` Lista de Visitas | `QA-P2-11` | Humanizar enums, separar próximas/histórico e corrigir ordenação/status | `MP-05`, `MP-21` | `BACKLOG` |
| 24 | `MP-23` Safras e Safrinha | `QA-P2-15` | Remover ação duplicada e validar Talhão, ano, cultura, datas e status | `MP-15`, `MP-13` | `BACKLOG` |

#### Critério de aceite transversal da Fase 2

- retrato e paisagem sem cortes ou sobreposições;
- navegação com retorno previsível;
- diferenças entre Admin, Colaborador e Produtor preservadas;
- nenhum atalho duplicando uma aba principal;
- termos de produto coerentes com os documentos ativos.

### Fase 3 — Integridade operacional

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 25 | `MP-24` IDs estáveis de responsável e Talhão | `QA-P1-07` | Substituir texto livre por referências estáveis e preservar snapshots legíveis | `MP-02`, `MP-06` | `BACKLOG` |
| 26 | `MP-25` Caderno auditável e validação por tipo | `QA-P0-03`, `QA-P1-08` | Implementar ciclo aprovado, autoria, complemento, correção e obrigatórios por tipo | `MP-04`, `MP-24`, `MP-13` | `BACKLOG` |
| 27 | `MP-26` Apresentação da localização | `QA-P2-14` | Usar mini mapa, precisão, relação com Talhão e detalhe técnico recolhido | `MP-06`, `MP-25` | `BACKLOG` |
| 28 | `MP-27` Implementação dos estados de Visita | `QA-P1-04` | Aplicar máquina de estados, atraso, motivo e histórico | `MP-05`, `MP-13` | `BACKLOG` |

#### Subtarefas obrigatórias de `MP-25`

1. persistir autoria por id;
2. diferenciar rascunho e registro consolidado;
3. preservar corpo e localização originais;
4. criar complemento técnico;
5. criar correção excepcional com motivo e antes/depois;
6. criar arquivamento/anulação sem exclusão destrutiva;
7. auditar visibilidade;
8. aplicar requisitos por tipo;
9. limitar informação administrativa mostrada ao Produtor;
10. cobrir rotas diretas e tentativas de payload indevido.

### Fase 4 — Materiais e mapas

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 29 | `MP-28` Fonte única de Materiais | `QA-P1-05` | Unificar resumo, listagem, imports e visibilidade | `MP-17` | `BACKLOG` |
| 30 | `MP-29` Rota e visualizador por material | `QA-P1-01`, `QA-P2-13` | Abrir mapa, imagem, PDF ou arquivo a partir de `material_id` e versão | `MP-28` | `BACKLOG` |
| 31 | `MP-30` Fotos com ampliação e ação autorizada | `QA-P2-13` | Permitir zoom e download conforme permissão e disponibilidade | `MP-11` | `BACKLOG` |
| 32 | `MP-31` Redesign do mapa de Talhões | `QA-P1-02` | Corrigir painel, legenda, localização, expandir e paisagem | `MP-16`, `MP-24` | `BACKLOG` |
| 33 | `MP-32` WebView, rede e fallback offline | `QA-P3-02` | Corrigir ciclo de vida, diagnosticar SSL e tratar mapa indisponível | `MP-31` | `BACKLOG` |

#### Subtarefas obrigatórias de `MP-29`

1. estender contrato da rota com id e versão;
2. resolver visualizador pelo tipo real;
3. camada georreferenciada com legenda e metadados;
4. imagem com zoom;
5. PDF com visualização real, quando suportado;
6. ZIP/arquivo sem falsa indicação de preview;
7. ação de download condicionada à autorização;
8. retorno preservando posição e filtros.

#### Subtarefas obrigatórias de `MP-31`

1. impedir recarga integral da WebView por seleção simples;
2. separar atualização do marcador de centralização;
3. implementar bottom sheet com snap points reais no retrato;
4. implementar painel lateral no paisagem/tablet;
5. manter mapa manipulável com detalhe aberto;
6. criar lista completa pesquisável/rolável;
7. transformar `Expandir mapa` em expansão real;
8. recalcular dimensões na orientação;
9. remover alças e controles sem função.

### Fase 5 — Fechamento produtivo dos itens P0

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 34 | `MP-33` Autenticação e sessão reais | `QA-P0-04` | Implementar tokens, refresh, revogação, inatividade e offline controlado | `MP-01`, backend | `BLOQUEADO` |
| 35 | `MP-34` Notificações reais e isoladas | `QA-P0-01` | Consultar por destinatário/escopo, persistir leitura e reautorizar a rota | `MP-03`, backend | `BLOQUEADO` |
| 36 | `MP-35` Escopo territorial no backend | `QA-P0-02` | Administrar vínculos e impedir ampliação de acesso pelo cliente | `MP-02`, backend | `BLOQUEADO` |
| 37 | `MP-36` Auditoria produtiva do Caderno | `QA-P0-03` | Persistir histórico imutável, concorrência e autorização no servidor | `MP-25`, backend | `BLOQUEADO` |
| 38 | `MP-37` Versionamento produtivo do GeoJSON | `QA-P1-06` | Persistir importações, publicação, reconciliação, linhagem e consulta histórica | `MP-06`, `MP-24`, backend/storage | `BLOQUEADO` |

Nenhuma dessas tarefas deve ser simulada como segurança completa apenas no
front-end.

### Fase 6 — Validações finais

| Ordem | Tarefa | QA relacionado | Objetivo | Dependência | Estado |
|---:|---|---|---|---|---|
| 39 | `MP-38` Teste real de localização em campo | `QA-P2-14` | Validar dentro/fora de Talhão, precisão, permissão, offline e cancelamento | `MP-26`, área mapeada | `BLOQUEADO` |
| 40 | `MP-39` Regressão histórica de GeoJSON | `QA-P1-06` | Testar múltiplas versões, renome, área, split, merge e rollback | `MP-37` | `BACKLOG` |
| 41 | `MP-40` Acessibilidade e matriz de dispositivos | `QA-P1-03`, `QA-P2-06`, `QA-P2-09` | Validar TalkBack, fonte, contraste, toque, aparelhos e orientação | Fases 1–4 | `BACKLOG` |
| 42 | `MP-41` Regressão completa dos três perfis | todos | Repetir QA funcional, permissões, persistência e responsividade | `MP-33` a `MP-40` aplicáveis | `BACKLOG` |

## 9. Matriz de cobertura dos achados

Cada identificador do relatório deve aparecer nesta matriz. Um item só está
integralmente concluído quando todas as tarefas associadas estiverem
`CONCLUIDO`.

| Achado | Tarefas do plano |
|---|---|
| `QA-P0-01` | `MP-03`, `MP-34` |
| `QA-P0-02` | `MP-02`, `MP-35` |
| `QA-P0-03` | `MP-04`, `MP-25`, `MP-36` |
| `QA-P0-04` | `MP-01`, `MP-33` |
| `QA-P1-01` | `MP-29` |
| `QA-P1-02` | `MP-31` |
| `QA-P1-03` | `MP-07`, `MP-40` |
| `QA-P1-04` | `MP-05`, `MP-27` |
| `QA-P1-05` | `MP-28` |
| `QA-P1-06` | `MP-06`, `MP-37`, `MP-39` |
| `QA-P1-07` | `MP-24` |
| `QA-P1-08` | `MP-25` |
| `QA-P1-09` | `MP-08` |
| `QA-P2-01` | `MP-15` |
| `QA-P2-02` | `MP-16` |
| `QA-P2-03` | `MP-17` |
| `QA-P2-04` | `MP-09` |
| `QA-P2-05` | `MP-10` |
| `QA-P2-06` | `MP-18`, `MP-40` |
| `QA-P2-07` | `MP-19` |
| `QA-P2-08` | `MP-02` |
| `QA-P2-09` | `MP-11`, `MP-40` |
| `QA-P2-10` | `MP-21` |
| `QA-P2-11` | `MP-22` |
| `QA-P2-12` | `MP-20` |
| `QA-P2-13` | `MP-29`, `MP-30` |
| `QA-P2-14` | `MP-26`, `MP-38` |
| `QA-P2-15` | `MP-23` |
| `QA-P2-16` | `MP-13` |
| `QA-P2-17` | `MP-12` |
| `QA-P2-18` | `MP-14` |
| `QA-P3-01` | `MP-12` |
| `QA-P3-02` | `MP-32` |

## 10. Roteiro para iniciar cada conversa

Usar este modelo:

```text
Trabalhe somente na tarefa MP-XX do plano
docs/project/plano-mestre-implementacao-qa-2026-07.md.

Leia o AGENTS.md e os documentos ativos obrigatórios.
Leia apenas a seção relacionada do relatório
docs/reviews/revisao-qa-android-2026-07-30.md.

Primeiro:
1. confirme objetivo, dependências e estado da tarefa;
2. inspecione o código relacionado;
3. apresente uma spec curta com comportamento esperado;
4. liste critérios de aceite, arquivos prováveis, fora de escopo e testes;
5. não altere código até o plano da tarefa estar coerente.
```

Depois da aprovação:

```text
Implemente somente a tarefa MP-XX conforme a spec aprovada.
Preserve mudanças existentes e não amplie o escopo.
Execute os testes aplicáveis, revise o diff e prepare o smoke Android.
Atualize o plano mestre somente com resultados realmente verificados.
```

## 11. Registro de execução

Adicionar uma linha por entrega concluída ou bloqueio material.

| Data | Tarefa | Estado final da rodada | Branch/commit | Validações | Evidências | Pendência |
|---|---|---|---|---|---|---|
| 2026-07-30 | `MP-00` | `CONCLUIDO` | `appteste` / `fdf2934` | typecheck, domain-compat e assembleRelease passaram; smoke manual não reexecutado por `adb` ausente | `dist/qa-session-2026-07-30/mp-00-baseline-tecnico.md` | assinatura debug no release, avisos Gradle/`NODE_ENV`, divergência de Java, checagem Expo online e smoke Android pendentes |
| 2026-07-30 | `MP-01` | `CONCLUIDO` | `appteste` / árvore de trabalho | `git diff --check` e validação de links locais; sem suíte de código por ser mudança documental | `docs/project/politica-sessao.md`; `dist/qa-session-2026-07-30/mp-01-politica-sessao.md` | implementação produtiva permanece bloqueada até `MP-33` e definição offline por fluxo |
| 2026-07-30 | `MP-02` | `CONCLUIDO` | `appteste` / árvore de trabalho | typecheck, domain-compat e 7 testes focados passaram; `git diff --check` passou; smoke Android não reexecutado por `adb` ausente | `docs/project/modelo-territorial.md`; `dist/qa-session-2026-07-30/mp-02-modelo-territorial-autoedicao.md` | backend, migração, auditoria e revalidação produtiva permanecem em `MP-35` |
| 2026-07-30 | `MP-03` | `CONCLUIDO` | `appteste` / árvore de trabalho | `git diff --check`, referências locais e consistência documental passaram; sem suíte de código por ser mudança documental | `docs/project/contrato-notificacoes.md`; `dist/qa-session-2026-07-30/mp-03-contrato-notificacoes.md` | implementação, isolamento, persistência e testes negativos permanecem em `MP-34` |
| 2026-07-30 | `MP-04` | `CONCLUIDO` | `appteste` / árvore de trabalho | `git diff --check`, referências locais e consistência documental passaram; sem suíte de código por ser mudança documental | `docs/project/ciclo-vida-caderno.md`; `dist/qa-session-2026-07-30/mp-04-ciclo-vida-caderno.md` | implementação no app permanece em `MP-25`; backend append-only e auditoria produtiva em `MP-36` |
| 2026-07-30 | `MP-05` | `CONCLUIDO` | `appteste` / árvore de trabalho | `git diff --check`, referências locais e consistência documental passaram; sem suíte de código por ser mudança documental | `docs/project/estados-visita.md`; `dist/qa-session-2026-07-30/mp-05-estados-visita.md` | implementação permanece em `MP-27`; organização visual da lista em `MP-22`; validação produtiva depende do backend |
| 2026-07-30 | `MP-06` | `CONCLUIDO` | `appQA` / árvore de trabalho | `git diff --check`, referências locais e consistência documental passaram; sem suíte de código por ser mudança documental | `docs/project/versionamento-geojson-talhoes.md`; `dist/qa-session-2026-07-30/mp-06-versionamento-geojson-talhoes.md` | IDs e vínculos ficam em `MP-24`; implementação produtiva em `MP-37`; regressão histórica em `MP-39` |
| 2026-07-30 | `MP-07` | `PARCIAL` | `appQA` / árvore de trabalho | typecheck, domain-compat e assembleRelease passaram; smoke físico passou em retrato e paisagem com teclado fechado, e em retrato com teclado aberto | `dist/qa-session-2026-07-30/mp-07-login-responsivo/` | Gboard ignorou `IME_FLAG_NO_FULLSCREEN` e abriu editor de extração em paisagem; repetir com IME/aparelho que permita teclado inline antes de concluir |
| 2026-07-30 | `MP-08` | `CONCLUIDO` | `appQA` / árvore de trabalho | typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico passou em Propriedades e Visitas | `dist/qa-session-2026-07-30/mp-08-filtros-rascunho/` | bottom sheet comum e gesto de arraste permanecem fora deste corte, em `MP-09` |
| 2026-07-30 | `MP-09` | `CONCLUIDO` | `appQA` / árvore de trabalho | typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico passou nas cinco telas, teclado e paisagem | `dist/qa-session-2026-07-30/mp-09-filtros-padrao/` | reorganização funcional dos filtros de Materiais permanece em `MP-17`; `MP-10` não foi iniciada |
| 2026-07-30 | `MP-10` | `CONCLUIDO` | `appQA` / árvore de trabalho | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico passou em retrato e paisagem | `dist/qa-session-2026-07-30/mp-10-cabecalhos-retorno/` | reorganização da Propriedade permanece em `MP-15`; contraste em `MP-11`; `MP-11` não foi iniciada |
| 2026-07-30 | `MP-11` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `8680761` | teste focado WCAG, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico passou em retrato, paisagem e busca com teclado | `dist/qa-session-2026-07-30/mp-11-contraste-opacidade/` | sistema de cartões permanece em `MP-21`; matriz completa de acessibilidade em `MP-40`; `MP-12` não foi iniciada |
| 2026-07-30 | `MP-12` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `4efa1d2` | testes focados, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico passou em retrato e paisagem | `dist/qa-session-2026-07-30/mp-12-linguagem-formatacao/` | reorganização de filtros permanece em `MP-17`; cartões em `MP-21`; `MP-13` não foi iniciada |
| 2026-07-31 | `MP-13` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `c37cc2a` | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico confirmou obrigatórios, mensagens adjacentes, correção progressiva, rolagem, foco e teclado | `dist/qa-session-2026-07-31/mp-13-validacao-formularios/` | regras específicas permanecem em `MP-23`, `MP-25` e `MP-27`; `MP-14` não foi iniciada |
| 2026-07-31 | `MP-14` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `3034d70` | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico confirmou faixa de ação sem oclusão, conteúdo final, retrato, paisagem e navegação | `dist/qa-session-2026-07-31/mp-14-espacamento-seguro-fab/` | grids e colisões de Dashboard permanecem em `MP-18`; cartões em `MP-21`; `MP-15` não foi iniciada |
| 2026-07-31 | `MP-15` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `9383518` | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico confirmou os seis destinos, retrato, paisagem e retorno | `dist/qa-session-2026-07-31/mp-15-navegacao-propriedade/` | `MP-16`, `MP-17`, `MP-19` e `MP-23` permanecem separadas; `MP-16` não foi iniciada |
| 2026-07-31 | `MP-16` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `e594005` | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico confirmou Lista inicial, Mapa, abertura contextual de Talhão, retrato e paisagem | `dist/qa-session-2026-07-31/mp-16-entrada-talhoes/` | redesign responsivo do mapa permanece em `MP-31`; `MP-17` não foi iniciada |
| 2026-07-31 | `MP-17` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `f0e1fef` | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico confirmou estado neutro, rascunho, Aplicar, chips ativos e rolagens em retrato e paisagem | `dist/qa-session-2026-07-31/mp-17-filtros-materiais/` | fonte única permanece em `MP-28`; mapa responsivo em `MP-31`; `MP-18` não foi iniciada |
| 2026-07-31 | `MP-18` | `CONCLUIDO` | `appQA` / árvore de trabalho sobre `2b2e8f7` | teste focado, typecheck, domain-compat, diff-check e assembleRelease passaram; smoke Android físico confirmou grades responsivas, ação ancorada e rotação nos três perfis | `dist/qa-session-2026-07-31/mp-18-dashboards-responsivos/` | conteúdo dos indicadores permanece em `MP-19`; cartões em `MP-21`; matriz completa em `MP-40`; `MP-19` não foi iniciada |
| 2026-08-03 | `MP-18` | `CONCLUIDO` | `appQA` / árvore limpa sobre `3eca4ed` | revisão solicitada: carrossel compacto em Propriedades e FAB flutuante único em Propriedades, Caderno, Usuários e Visitas; testes, assembleRelease e smoke Android passaram | `dist/qa-session-2026-08-03/mp-18-revisao-carrossel-fab/` | conteúdo dos indicadores permanece em `MP-19`; `MP-19` não foi iniciada |

## 12. Próxima ação

`MP-07` recebeu o corte local de login responsivo em 2026-07-30. O formulário
passou a usar safe area, uma única rolagem, `adjustResize` nativo no Android,
reposicionamento do campo focado, layout compacto e larguras explícitas por
orientação para os acessos rápidos.

Typecheck, suíte `domain-compat`, build release e instalação física passaram.
O smoke passou em retrato com teclado aberto/fechado, em paisagem com teclado
fechado, na rolagem e nas mudanças retrato -> paisagem -> retrato.

A tarefa permanece `PARCIAL`: o Gboard do aparelho físico ignorou
`IME_FLAG_NO_FULLSCREEN`, embora os dois campos tenham enviado a flag, e abriu
o editor de extração em tela cheia na paisagem. Repetir somente esse cenário
com outro IME/aparelho que permita teclado inline.

`MP-08` foi concluída em 2026-07-30. Propriedades e Visitas agora mantêm
separados os filtros aplicados e o rascunho do modal. Abrir copia o estado
aplicado; X, toque fora e botão Voltar descartam o rascunho; Aplicar confirma
as mudanças; Limpar só afeta a lista depois de Aplicar. Badge, chips e
resultados refletem somente o estado aplicado.

Typecheck, suíte `domain-compat`, `git diff --check`, build release, instalação
e smoke no Android físico passaram. A criação de componente comum, bottom
sheet e gesto real de arraste foi entregue em `MP-09`.

`MP-09` foi concluída em 2026-07-30. A casca padrão concentra backdrop,
cabeçalho, conteúdo rolável, X, Limpar, Aplicar, botão Voltar, safe area e
arraste real para baixo. O acionador com badge e a faixa rolável de chips
ativos também passaram a ser comuns.

Propriedades, Usuários/Produtores, Visitas, Caderno e Materiais foram migrados.
Usuários preserva o filtro de perfil; Caderno usa os tipos já presentes nos
registros; Materiais moveu categoria e ordenação para a folha, sem reorganizar
os filtros de contexto do panorama reservados para `MP-17`.

Typecheck, suíte `domain-compat`, `git diff --check` e build release passaram.
O smoke Android confirmou teclado no primeiro toque, X, backdrop, Voltar,
arraste, Aplicar, Limpar, badge/chips e conteúdo rolável, inclusive em
paisagem. A reorganização funcional de Materiais permanece em `MP-17`.

`MP-10` foi concluída em 2026-07-30. O cabeçalho comum agora usa um único
contrato `showBack`, com seta acessível e fallback para `navigation.goBack()`.
As rotas internas de Propriedade, Notificações e autoedição que ainda exibiam
a marca receberam retorno explícito; o alias legado `showBackButton` foi
removido. Notificações também deixou de empilhar outra cópia da própria tela.

O teste focado audita as 18 rotas internas do native stack, todos os estados
de `Header`, as telas-raiz sem seta e o retorno próprio do mapa de limites.
Typecheck, suíte `domain-compat`, `git diff --check`, build release e instalação
passaram. No Android físico, seta e botão do sistema preservaram filtro, busca,
aba da Propriedade e contexto em retrato e paisagem. `MP-11` foi executada na
sequência.

`MP-11` foi concluída em 2026-07-30. O tema passou a expor pares explícitos
de superfície, texto e borda para estados primário, sucesso, aviso,
informação, erro e desabilitado. Os tokens de primeiro plano foram escurecidos
e `primaryLight` passou a representar uma superfície clara, eliminando os
pares de verde próximos reportados em `Registrado pelo produtor` e
`Ver mais 2 materiais`.

Os componentes reutilizáveis de formulário, seleção, confirmação, data,
chips, rádio e localização deixaram de reduzir a opacidade do controle
inteiro. Estados desabilitados agora usam superfície, texto e borda próprios.
Chips de status de Usuários e caixas informativas também passaram a usar os
pares semânticos explícitos.

`themeContrastCompat.test.js` calcula contraste WCAG diretamente dos tokens,
exige 4,5:1 para texto normal e 3:1 para ícones/bordas essenciais, audita os
dois exemplos reportados e impede a reintrodução de opacidade global nos
controles cobertos. Teste focado, typecheck, suíte `domain-compat`,
`git diff --check` e build release passaram.

No Android físico, o smoke passou no Dashboard, status de Usuários, estado
desabilitado da Propriedade, busca com teclado e materiais da Sela de Prata,
em retrato e paisagem. O seed atual não contém registro de Caderno com
`origem_registro = produtor`; por isso esse badge específico foi coberto pelo
teste de contrato e pela auditoria do código, sem fabricar dado no smoke.
`MP-12` foi executada na sequência.

`MP-12` foi concluída em 2026-07-30. O rótulo público do objetivo
`coleta_solo` foi centralizado como `Coleta de Solo` e passou a ser usado na
lista, detalhe, criação e edição de Visitas. As áreas exibidas no Dashboard,
Propriedades e Caderno usam o formatador brasileiro compartilhado, sem
abreviação em `k`.

Materiais técnicos agora distinguem apresentação pública e detalhe técnico.
Os cartões mostram título legível, camada/elemento, profundidade, data, safra,
escopo, Propriedade e versão; códigos internos e nomes originais são ocultados
da listagem. O nome original permanece disponível somente no detalhe do
anexo. Os cinco anexos Sela legados recebem a compatibilidade visual `v1`
quando o dado persistido antecede o campo de versão.

Testes focados, typecheck, suíte `domain-compat`, `git diff --check` e build
release passaram. No Android físico, o smoke confirmou `15.470 ha`,
`6.200 ha`, `2.500 ha`, `Coleta de Solo`, cartões públicos sem nome de arquivo
e detalhe técnico com nome original, em retrato e paisagem. `MP-13` foi
executada na sequência.

`MP-13` foi concluída em 2026-07-31. Os formulários de criação e edição de
Propriedade, Usuário, Visita, Caderno e Safra/Safrinha agora sinalizam os
campos obrigatórios cobertos por suas validações, exibem todas as mensagens
junto aos campos no primeiro envio inválido e levam a rolagem e o foco ao
primeiro erro segundo a ordem visual. Campos textuais recebem foco real e
seletores recebem foco de acessibilidade e anúncio da mensagem.

O contrato foi centralizado em um hook reutilizável e em funções puras para
ordenação do primeiro erro e cálculo da rolagem. O teste focado, typecheck,
suíte `domain-compat`, `git diff --check` e build release passaram. No Android
físico, o smoke de Nova Visita confirmou erros simultâneos e limpeza
progressiva; a edição de Propriedade confirmou rolagem, mensagem adjacente,
foco real e reabertura do teclado. Nenhum dado de teste foi salvo.

Regras obrigatórias específicas por domínio continuam reservadas para
`MP-23`, `MP-25` e `MP-27`. `MP-14` foi executada na sequência.

`MP-14` foi concluída em 2026-07-31. No Caderno global, a ação de criação
deixou de ficar posicionada sobre a lista e passou a ocupar uma faixa inferior
própria, fora da área rolável e acima da navegação por abas. O padding seguro
existente foi preservado, assim como rótulo, ícone, acessibilidade, regra de
permissão e navegação para Novo Registro. O modo flutuante padrão das outras
listas não foi alterado.

Em revisão visual solicitada em 2026-08-03, a faixa inferior foi removida e o
Caderno voltou ao FAB flutuante compartilhado com Propriedades, Usuários e
Visitas. O padding seguro permaneceu para manter o último conteúdo alcançável.

Teste focado, typecheck, suíte `domain-compat`, `git diff --check` e build
release passaram. No Android físico, o smoke confirmou ausência de oclusão
durante a rolagem, último cartão totalmente alcançável, retrato, paisagem e
abertura de Novo Registro sem persistir dados.

Grids e colisões de Dashboard permanecem em `MP-18`; o sistema de cartões
permanece em `MP-21`. `MP-15` foi executada na sequência.

`MP-15` foi concluída em 2026-07-31. O detalhe da Propriedade agora oferece
uma única navegação com `Resumo`, `Talhões`, `Safras e Safrinha`, `Materiais`,
`Visitas` e `Caderno`, nessa ordem. A barra é rolável no retrato e mostra os
seis destinos simultaneamente no paisagem validado. Os atalhos duplicados do
Resumo foram removidos; Talhões, períodos produtivos e Materiais ganharam
destinos separados; Safras/Safrinha mantém uma única ação de criação.

Teste focado, typecheck, suíte `domain-compat`, `git diff --check` e build
release passaram. No Android físico, o smoke confirmou os seis destinos e
seus conteúdos em retrato e paisagem, além do retorno à lista de Propriedades.
Rotas, permissões, payloads, persistência e `fazenda_id` não foram alterados.

A entrada `Lista | Mapa` foi executada em `MP-16`; filtros de Materiais em
`MP-17`, reorganização do Resumo em `MP-19` e regras de Safra/Safrinha em
`MP-23` permanecem separados.

`MP-16` foi concluída em 2026-07-31. A entrada de Talhões da Propriedade
passou a oferecer o seletor acessível `Lista | Mapa`, iniciando em `Lista` no
celular. A lista apresenta os Talhões individualmente com nome, área e
metadados existentes; a abertura de um item preserva a Propriedade e seleciona
o Talhão no mapa. O modo `Mapa` reutiliza a demarcação atual e mantém acesso ao
mapa interativo, com estado controlado quando a geometria não está disponível.

Teste focado, typecheck, suíte `domain-compat`, `git diff --check` e build
release passaram. O APK foi instalado por cima no Android físico; Lista,
Mapa, rolagem e abertura contextual de Talhão passaram em retrato e paisagem.
O redesign responsivo do mapa permanece em `MP-31`. `MP-17` foi executada na
sequência.

`MP-17` foi concluída em 2026-07-31. A consulta de Materiais passou a iniciar
sem demarcação implícita e concentra no topo somente a busca, o acionador com
badge e o resumo rolável dos filtros aplicados. Demarcação, Talhão, ano dos
materiais, Safra/Safrinha, categoria e ordenação foram reunidos no bottom
sheet padrão, com rascunho descartável, Aplicar explícito e limpeza única. O
cabeçalho e o título da seção foram ajustados para `Materiais técnicos`.

Teste focado, typecheck, suíte `domain-compat`, `git diff --check` e build
release passaram. O APK foi instalado por cima no Android físico `8483A`; o
smoke confirmou estado neutro, cancelamento do rascunho, aplicação de dois
filtros, chips removíveis e rolagens vertical e horizontal em retrato e
paisagem. A rotação automática foi restaurada e não houve exceção fatal no
logcat recente. A fonte única dos Materiais permanece em `MP-28` e o redesign
responsivo do mapa em `MP-31`. `MP-18` foi executada na sequência.

`MP-18` foi concluída em 2026-07-31 e revisada em 2026-08-03. Os indicadores
do Dashboard de Admin e Colaborador usam duas colunas em retrato e três em
paisagem ampla. A tela de
Propriedades usa um carrossel horizontal com o mesmo estilo de cartões
compactos do detalhe da Propriedade. `Nova Propriedade` e `Novo Registro`
usam o FAB flutuante compartilhado com Usuários e Visitas. No Dashboard do
Produtor, o panorama da Propriedade fica acima dos indicadores em retrato e ao
lado de uma grade 2 x 3 em paisagem, sem truncar os rótulos.

Teste focado, typecheck, suíte `domain-compat`, `git diff --check` e build
release passaram. O APK foi instalado por cima no Android físico `8483A`; o
smoke da revisão confirmou o carrossel de Propriedades e os FABs de
Propriedades e Caderno em retrato e paisagem, sem exceção fatal no logcat
recente. A rotação automática foi restaurada. O conteúdo dos indicadores
permanece em `MP-19`, o sistema geral de cartões em `MP-21` e a matriz completa
em `MP-40`. `MP-19` não foi iniciada.
