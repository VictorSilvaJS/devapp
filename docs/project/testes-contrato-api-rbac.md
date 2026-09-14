# Testes De Contrato/API Para RBAC

Status revisado em 2026-09-14:
`MP-35A/B/C integradas; MP-35D-1/2 concluídas na feat/mp-35d; MP-35D-3
concluída, auditada e enviada em 92bba62; MP-35D em andamento;
decimal fechado em dab3ac4; HTTP administrativo de Propriedades fechado em 27df733;
Titular/Localidades fechados em 37a8790; formulários/navegação fechados em e5db497; status visual aprovado independentemente para commit; D-4 em andamento`.
Este documento
define a matriz baseada em `contrato-api-rbac.md`, nas decisões consolidadas e
em D1-D13, distinguindo o corte já executável das linhas planejadas.

## MP-35D-4 — aprovação independente do status visual — 2026-09-14

**FLUXO VISUAL DE STATUS DE PROPRIEDADE — APROVADO PARA COMMIT**.
Parecer independente final comunicado no fechamento: nenhum achado obrigatório
remanescente. Autorizados somente documentação, índice explícito, commit e push
para `feat/mp-35d`, com confirmação do hash remoto. Este registro pré-commit não
antecipa o sucesso do envio; o relatório final registra a confirmação Git.

| Origem da evidência herdada | Resultado |
|---|---|
| Implementação | D-4 340/340 e regressões gerais aprovadas |
| Auditoria independente | 38/38 critérios; 33/33 probes independentes; nenhum achado obrigatório |
| Suítes na auditoria | D-4 340/340; D-3 106/106; D-2 85/85; D-1 55/55 |
| Demais checks da auditoria | typecheck, domain-compat, propriedadeNavigationCompat, propriedadeRouteFlowCompat, native graph e bundles HTTP/Demo aprovados |

Composição preservada: 296 anteriores + 38 renderizados + 6 arquitetura = 340.
São 44 casos novos do status; os 11 D-2 reutilizados já pertencem aos 296.
Os 33 probes independentes não são novos casos permanentes da suíte.

Inativação/reativação e motivos D10 aprovados: destino fixo oposto ao status atual,
corpo exclusivo `versao`, `status`, `motivo`, `motivo_detalhe?`; recibo seguido de
GET autoritativo obrigatório. Recovery somente GET, version_conflict com releitura
e nova decisão sem retry automático, business_rule_conflict seguro sem otimismo.
F1/N1 preservados; edição cadastral continua sem status e Demo permanece intacto.

Verificações deste fechamento: oito arquivos não documentais derivados do Git,
SHA-256 individual antes da documentação e comparação após documentação, staging
e commit; diff check, links locais, revisão documental, objeto exato e remoto.
Somente os sete documentos já pertencentes ao corte recebem mudanças. Não se
reexecutam suítes, PostgreSQL, Android físico ou bundles/grafos por ritual.

D-3 `92bba62`, decimal `dab3ac4`, HTTP `27df733`, Titular/Localidades `37a8790`
e formulários/navegação `e5db497` preservados. D-4 ainda em andamento: smoke
Android físico completo, fechamento final e integração da MP-35D na `backend`
posteriores. Sem release, deploy, produção, vínculos, transferência, exclusão,
offline/AsyncStorage administrativo ou fallback Demo. CI remota não consultada.

## MP-35D-4 — status visual separado — implementação de 2026-09-14

Base fechada: `e5db497baf6a4b1c35115c1d4a3aa8f9e5d1093c`; worktree/index limpos,
origin no mesmo commit antes da implementação. Corte aprovado independentemente para commit, sem achado obrigatório.
Fechamento Git autorizado; Android físico não executado.

`mp35d4RenderedStatus.test.js` registra 38 casos no runner renderizado existente.
Assim o harness de React Navigation real importa D-2 uma única vez: são 84 casos
renderizados executados (35 próprios anteriores + 38 status + 11 D-2 reutilizados).
O novo `mp35d4StatusArchitecture.test.js` acrescenta 6 gates. Composição total:
**296 anteriores + 38 renderizados status + 6 arquitetura status = 340/340**.
São 44 casos novos neste corte; os 11 D-2 já pertencem aos 296, não são novos.
Nenhum caso anterior foi removido. O gate que vedava status passou a exigir
modal local Admin, mantendo proibição de rota pública, vínculos e transferência.

Cobertura: inativar/reativar com corpo exato capturado no transporte, motivo D10,
Outro obrigatório, detalhe opcional/NFC/300 pontos de código, confirmação,
cancelamento antes do comando e na confirmação, duplo submit, GET igual/superior
ao recibo, ID/versão inválidos, GET mais novo com status diferente do solicitado,
recovery nos dois destinos (um PATCH, três GETs, duas falhas), retry ambíguo com
mesma chave/corpo/versão inclusive após GET incidental, version_conflict com
estado já alterado ou ainda original, nova intenção/chave após decisão explícita,
falha da leitura de conflito, business_rule_conflict sem dados internos,
indisponibilidade, Admin/perfis finais, ID inválido, ausência de rota/deep link,
redução de perfil, 401/403 antes/durante PATCH/GET, respostas tardias, callbacks
A após retomada em B, StrictMode, conclusão repetida, saída após recibo, lista
ativa removendo/reexibindo item somente por consulta e edição cadastral sem status.
As sete regressões N1 anteriores continuam passando, com keys/pilha reais.

Execuções herdadas da implementação (PowerShell, `npm.cmd`), não repetidas no fechamento:

| Comando | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run test:mp35d4` | 340/340 |
| `npm run test:mp35d3` | 106/106 |
| `npm run test:mp35d2` | 85/85 |
| `npm run test:mp35d1` | 55/55 |
| `npm run test:domain-compat` | passou |
| `node tests/propriedadeNavigationCompat.test.js` | passou |
| `node tests/propriedadeRouteFlowCompat.test.js` | passou |
| `npm run test:native-graph:mp33c` | grafos HTTP/Demo aprovados |
| `npm run test:bundle:mp33c` | exportações HTTP/Demo aprovadas, sem mock/AsyncStorage no HTTP |

As primeiras asserções focais foram corrigidas para usar a versão efetiva da
fixture e os cartões renderizados (o host FlatList não conserva `data` no harness).
Na revisão final foi acrescentada a guarda que impede GET incidental de trocar
a intenção ainda ambígua, com regressão ampliada; typecheck, D-4 e bundle foram
reexecutados após esse ajuste. Não houve flexibilização de modelos/decoders.

Demo/PropertyForm/SelectField, edição cadastral, navegação N1, runtime,
SessionCoordinator, boundary, serviço, modelo e lifecycle aprovados não mudaram.
Backend intacto; PostgreSQL não reexecutado. Grafos/bundles exigiram subprocessos
Expo fora do sandbox e não equivalem a instalação, release ou Android físico.
Marcos: D-3 `92bba62`, decimal `dab3ac4`, HTTP `27df733`, Titular/Localidades
`37a8790`, formulários/navegação `e5db497`. D-4 em andamento, auditoria deste
corte aprovada; Android físico pendente e integração final na `backend` posterior.

## MP-35D-4 — aprovação independente e fechamento controlado — 2026-09-14

**FORMULÁRIOS HTTP DE PROPRIEDADE E NAVEGAÇÃO MÍNIMA — APROVADOS PARA COMMIT**.
Parecer independente final comunicado no fechamento: N1 corrigido e aprovado,
nenhum achado obrigatório remanescente. Autorizados registro documental, staging
explícito dos 25 caminhos, um commit e push somente para `feat/mp-35d`.
A confirmação de commit/push e do hash remoto pertence ao relatório final do
fechamento; este registro pré-commit não antecipa sucesso do envio nem CI remota.

Evidências herdadas, sem nova execução das suítes neste fechamento:

| Etapa | Resultado |
|---|---|
| Implementação anterior a N1 | D-4 289/289; demais testes, bundles e grafos aprovados |
| Primeira auditoria | 33/34 critérios; único achado obrigatório N1 |
| Correção N1 | Reprodução falhou antes da mudança; 7 regressões permanentes; D-4 296/296 |
| Reauditoria independente | 20/20 critérios focais e 14/14 probes novos; N1 aprovado |
| Suítes na reauditoria | D-4 296/296; D-3 106/106; D-2 85/85; D-1 55/55 |
| Demais verificações na reauditoria | typecheck, domain-compat, propriedadeNavigationCompat e propriedadeRouteFlowCompat aprovados |

A reauditoria demonstrou o detalhe reconciliado com versão GET superior à do
recibo. A fonte exibida é a projeção autoritativa publicada pela boundary.
D-4: 246 anteriores + 28 renderizados anteriores + 7 N1 + 4 arquitetura +
11 D-2 importados = 296 executados. São 39 casos realmente novos no corte visual;
os 11 D-2 são cobertura reutilizada. Os 14 probes são evidência independente,
não novos casos permanentes acrescidos à suíte D-4.

Preservação deste fechamento: 18 arquivos não documentais derivados de todos os
caminhos modificados/novos do Git, com SHA-256 individual antes da documentação.
A conferência após documentação, staging e commit é condição para prosseguir.
Demo, SelectField, PropertyForm, telas, controllers, access, navegação, testes e
configuração aprovados devem permanecer byte a byte idênticos. Somente os sete
documentos já pertencentes ao corte recebem alterações. Verificações próprias:
hashes, diff check, links locais, revisão documental, índice explícito e remoto.
Não se repetem suítes integrais, backend/PostgreSQL, Android ou bundles/grafos.

Marcos preservados: D-3 `92bba62`, decimal `dab3ac4`, HTTP administrativo
`27df733` e Titular/Localidades `37a8790`. D-4 permanece em andamento.
Status visual de ativar/inativar Propriedade, Android físico, integração final
na `backend`, release, deploy e produção permanecem pendentes. Vínculos e
transferência de Titularidade fora do corte; Demo sem backend; sem offline
administrativo ou AsyncStorage administrativo. Nenhuma etapa posterior autorizada.

## MP-35D-4 — correção focal N1 — 2026-09-14

Primeira auditoria do corte visual: **CORREÇÕES OBRIGATÓRIAS**, somente
**N1 — salvar edição duplica o detalhe da Propriedade na pilha**. Os outros
33 critérios receberam PASSA na primeira auditoria (33/34). N1 foi encerrado
na reauditoria posterior. Na entrada do fechamento, base e origin estavam em `37a87909e10e50baa8b13201c1c7c5f8c86bd131`,
com 19 modificados/6 novos e index vazio; nenhum commit/push anterior deste corte.

### Reprodução anterior à alteração funcional

Foi acrescentada primeiro a regressão permanente `N1: detalhe → editar → salvar
reutiliza a mesma key; Voltar alcança Main`, em
`tests/mp35d4RenderedForms.test.js`, executada com React Navigation real por:

`node --test-name-pattern='^N1:' tests/mp35d4RenderedForms.test.js`

Resultado antes da correção: **1 teste, 0 passou, 1 falhou**. O teste confirmou
um PATCH e um GET de reconciliação antes de comparar o estado real da pilha.
A falha mostrou índice 2 em vez de 1 e dois `PropertyDetail` com o mesmo ID,
mas keys distintas: `PropertyDetail-9G3oYjYo4psNB1NnBWMpl` e
`PropertyDetail-X9jSak-JryUUEOUE-uN-s`. Os diagnósticos também registraram que
Voltar deixava o primeiro detalhe ativo, em vez de retornar ao Main.
Nenhuma alteração funcional precedeu essa execução vermelha.

| Fluxo | Antes | Após salvar/reconciliar | Após Voltar |
|---|---|---|---|
| Defeito reproduzido | Main / Detail(A,k1) / Edit(A) | Main / Detail(A,k1) / Detail(A,k2) | Main / Detail(A,k1) |
| Origem válida, corrigido | Main / Detail(A,k1) / Edit(A) | Main / Detail(A,k1) | Main |
| Entrada direta, corrigido | Main / Edit(A) | Main / Detail(A,k2) | Main |

### Correção e regressões permanentes

`HttpPropertyScreens.tsx` passa origem interna com route key e ID da Propriedade.
`HttpAdministrativePropertyFormScreens.tsx` distingue criação/edição na conclusão:
origem imediatamente anterior com key, nome de rota e identidade correspondentes
permite `goBack`, revelando a mesma instância de detalhe já atualizada pela
boundary. Sem origem válida, `reset` conserva o histórico não relacionado,
retira detalhes/edições da mesma Propriedade e termina com um detalhe canônico.
São APIs já disponíveis no router instalado (`@react-navigation/routers` 6.1.9),
sem dependência/import novo. Criação continua usando `replace`.

As guardas de instância montada, rota atual e lifecycle foram preservadas;
conclusão já consumida não realiza segunda navegação. Nenhum refetch compensatório,
mutação extra ou mudança em conflito/rebase/recovery foi introduzido.

Sete novos casos N1 cobrem pilha e Voltar, Nome/Área/Município no detalhe existente,
entrada direta, GET pós-recibo com duas falhas e recovery, cinco origens inválidas
(removida, nova key, outra identidade, outro nome e não adjacente), StrictMode com
callback repetido e callback antigo após retomada, Cancelar/Voltar antes do submit.
O smoke de criação existente passou a verificar também pilha, ID e uma transição.
A rodada focal completa passou **7/7**. As primeiras asserções auxiliares dessa
rodada foram alinhadas à estrutura do renderer: interpolação de Text com espaços
e key do stack raiz distinta da aba filha Properties; não exigiram mudança funcional.

Composição atual da D-4: **246 anteriores + 28 renderizados do corte visual +
7 regressões N1 + 4 arquitetura + 11 D-2 importados = 296/296**. São 35 casos
renderizados próprios e 4 de arquitetura novos no corte visual inteiro;
os 11 D-2 importados não são novos. O arquivo renderizado executa 46 casos.

### Validações herdadas da correção N1

| Comando | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run test:mp35d4` | 296/296 |
| `npm run test:mp35d3` | 106/106 |
| `npm run test:mp35d2` | 85/85 |
| `npm run test:mp35d1` | 55/55 |
| `npm run test:domain-compat` | passou integralmente, incluindo MP-33C 46/46, MP-34 35/35 e convergência 7/7 |
| `node tests/propriedadeNavigationCompat.test.js` | passou, 4 casos |
| `node tests/propriedadeRouteFlowCompat.test.js` | passou |

Npm executado por `npm.cmd` no PowerShell. O baseline SHA-256 anterior a N1
cobriu 732 arquivos rastreados/novos: somente dois arquivos HTTP, o teste
renderizado e sete documentos ativos mudaram nesta correção. Demo,
`PropertyForm`, `SelectField`, demais apresentações, seletores, decimal, modelos,
idempotência, lifecycle, SessionCoordinator, boundary, BackendApi, runtime e
backend preservados por hash. Configuração/imports/composição não mudaram;
bundle/native graph não foram reexecutados. Nenhum teste backend adicional.
Probes ignorados do auditor foram preservados.

Estado: **FORMULÁRIOS HTTP DE PROPRIEDADE E NAVEGAÇÃO MÍNIMA —
APROVADOS PARA COMMIT**. N1 encerrado na reauditoria independente. D-3 `92bba62`, decimal `dab3ac4`, HTTP
`27df733` e Titular/Localidades `37a8790` preservados. Status visual, Android
físico e integração final na `backend` pendentes; fechamento Git autorizado.

## MP-35D-4 — formulários HTTP e navegação mínima — execução anterior à auditoria N1

Implementação sobre `37a87909e10e50baa8b13201c1c7c5f8c86bd131`, com worktree
inicial limpo, index vazio e `origin/feat/mp-35d` no mesmo commit. Titular e
Localidades foram fechados nesse commit; os registros abaixo sobre aprovação
para commit são snapshots históricos. D-3 em `92bba62`, decimal em `dab3ac4`
e HTTP administrativo em `27df733` preservados. Sem staging, commit ou push.

### Execuções próprias deste corte

| Comando | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run test:mp35d4` | **289/289** |
| `npm run test:mp35d3` | **106/106** |
| `npm run test:mp35d2` | **85/85** |
| `npm run test:mp35d1` | **55/55** |
| `npm run test:domain-compat` | passou integralmente, incluindo MP-33C 46/46, MP-34 35/35 e convergência 7/7 |
| `node tests/propriedadeNavigationCompat.test.js` | passou, 4 casos |
| `node tests/propriedadeRouteFlowCompat.test.js` | passou |
| `node tests/formValidationCompat.test.js` | passou, 3 casos |
| `node tests/formInteractionCompat.test.js` | passou |
| `npm run test:native-graph:mp33c` | grafos Android HTTP/Demo aprovados por Expo Autolinking |
| `npm run test:bundle:mp33c` | exportações Android HTTP/Demo aprovadas; HTTP sem marcadores mock/AsyncStorage |

Os comandos npm foram executados via `npm.cmd` no PowerShell, Node.js 22.20.0.
Grafos/bundles precisaram executar subprocessos fora do sandbox; não representam
APK de release, deploy, instalação ou smoke físico. Backend permaneceu intacto;
PostgreSQL integral não foi reexecutado.

Composição D-4: **35 contratos + 29 modelos + 26 comandos + 36 lifecycle +
5 arquitetura + 58 Localidades + 57 Titular/sessão = 246 anteriores**;
mais **28 cenários novos de tela + 4 gates novos de arquitetura + 11 cenários
D-2 reutilizados = 289**. O arquivo renderizado executa 39 casos, incluindo
explicitamente esses 11 herdados; eles não são apresentados como testes novos.
Nenhum caso anterior foi removido. O gate que proibia toda UI D-4 foi atualizado
para exigir somente criação/edição autorizadas e continuar proibindo status,
vínculos e transferência visuais.

`tests/mp35d4RenderedForms.test.js` usa as telas, apresentação compartilhada,
NavigationContainer, native-stack, sessão, repositórios, seletores, modelos,
coordenador e lifecycle reais. Apenas primitivas nativas e transporte são
controlados. Cobre smoke de criação/edição, identidade Titular distinta do Usuário,
confirmação/revalidação, buscas e paginação reais, retry A1, reinício explícito
após cursor inválido, UF/Município stale, seleção inicial fora da página, decimal
textual/limpeza/dirty, conflitos de Nome/Área/Município em v1→v2→v3, rebase sem
conflito e GET de conflito indisponível.

Para POST e PATCH confirmados, comprova uma mutação e três GETs, duas falhas
seguidas de sucesso mais novo que o recibo e uma conclusão/navegação. Também
cobre ausência de capacidades para Produtor/Colaborador, rotas diretas bloqueadas,
links administrativos sem mapeamento público, 401/403, retomada após `/me`,
callbacks Cancelar/Voltar/submit de A após abrir B, perda de Admin em POST/GET,
StrictMode com setup/cleanup/setup e descarte de dados próprios, transporte
ambíguo com mesma chave, e mensagens 400/422/404/conflito sem conteúdo interno.

### Falhas intermediárias e correções

- Os primeiros testes revelaram expectativas estáticas da composição anterior:
  zero ações D-4, referências de formulário dentro das telas Demo e contagens
  sem os dois observadores de capacidade de Propriedade. Os gates passaram a
  verificar a extração e os totais exatos novos; zero residual após desmontagem
  e zero assinatura administrativa para não-Admin continuam obrigatórios.
- O harness novo inicialmente copiava getters por valor e usava um decimal de
  seis casas, fora do domínio de quatro; as fixtures foram corrigidas, sem
  flexibilizar decoders/normalização. As chaves são verificadas na porta de
  transporte (`idempotencyKey`), antes da conversão para cabeçalhos.
- Na revisão de integração, o controller visual foi ajustado para não restaurar
  Município ao reler outros campos durante uma troca incompleta de UF, e a UI
  distingue retry transitório de reinício explícito de catálogo/cursor inválido.
  Ambos possuem regressão renderizada permanente.

Estado ao concluir a implementação anterior à auditoria N1: **FORMULÁRIOS HTTP DE PROPRIEDADE E NAVEGAÇÃO MÍNIMA IMPLEMENTADOS —
AGUARDANDO AUDITORIA INDEPENDENTE**. D-4 não concluída; alteração visual de status,
Android físico e integração final na `backend` pendentes. Sem backend alterado,
release, publicação ou persistência de draft administrativo.

## MP-35D-4 — aprovação independente e fechamento controlado de Titular/Localidades — 2026-09-14

Parecer final: **APROVADO PARA COMMIT DE TITULAR E LOCALIDADES DA MP-35D-4**.
A primeira auditoria encontrou somente A1; reprodução permanente em Titular e
Municípios precedeu a correção focal. A reauditoria encerrou A1, sem achado
novo ou obrigatório remanescente. Objeto aprovado: HEAD/origin em
`27df7335efd4ab352245c48f6b022da1d99f0987`, 13 modificados, seis novos,
index vazio e diff rastreado `+536/-71`. A auditoria preservou esse objeto.

### Evidências herdadas, sem novas execuções neste fechamento

| Etapa | Evidência |
|---|---|
| Implementação inicial | D-4 233/233; demais regressões e grafos/bundles registrados na seção histórica |
| Primeira auditoria | Somente A1 obrigatório; gate D-2 preservado, incluindo treze mutações arquiteturais proibidas recusadas |
| Correção A1 | 13 regressões falharam antes da mudança; depois D-4 246/246 e probe próprio com um GET com cursor/zero sem cursor por consumidor |
| Reauditoria focal | A1 encerrado, 20/20 critérios, 42/42 probes independentes, nenhum achado obrigatório remanescente |
| Suítes da reauditoria | typecheck e domain-compat passaram; D-4 246/246, D-3 106/106, D-2 85/85, D-1 55/55 |

Composição D-4: **35 contratos + 29 modelos + 26 comandos + 36 lifecycle +
5 arquitetura + 58 Localidades + 57 Titular/sessão/arquitetura = 246**.
A mutação de sensibilidade da reauditoria manteve os 233 anteriores e fez
falhar as 13 regressões A1 ao remover a correção.

A1: a primeira recuperação limpava `nextPageFailure`; outro retry interpretava
a ausência como refresh. `retry()` agora consulta primeiro `#pending`.
A reauditoria confirmou mesma promise, geração/páginas/seleção preservadas,
um GET com cursor e zero sem cursor, mantendo invalidação por nova busca/UF,
dispose e perda de autorização. F1 permanece preservado.
O gate D-2 comprova repositório único, referência compartilhada e Titular
usando a mesma instância/sessão/fronteira; não foi alterado neste fechamento.

### Manifesto de preservação funcional

Lista derivada do diff real e dos não rastreados do Git antes da edição
documental: **13 arquivos não documentais**. SHA-256 dos bytes do worktree:

| Arquivo | SHA-256 de referência |
|---|---|
| `package.json` | `df23090c80931b815b26f12ec5725d916c2795b0f6c356bf1ca4a245215813b9` |
| `src/http/backendApi.ts` | `045ebdd90243c167b8519426ca038f7d1bcceaca09b8547a00e1d0e641c7fc2b` |
| `src/http/contracts.ts` | `efec5eb7e636c01196f77841f4ebc3586676c77733c24b30a5ea3726723618c5` |
| `src/http/decoders.ts` | `2c0b74f5b6f483b513217468db4fd60a39787def8a1e995f12f1089a8adf8b19` |
| `src/http/runtime.ts` | `f5c40ddf0e90aa5ab522855ddbaa105686e8504c2673673b80b688f0c3c3782f` |
| `tests/fixtures/mp35d4.js` | `b7e56aafad962e77fd1c7f7fd2ea8c743f5c7150e5b2b4da1a548368e4e8e02d` |
| `tests/mp35d2Architecture.test.js` | `c50a6c1f3f33ec9b93942567c4f45ee0796cc665f68b7483043bf61f9a76350f` |
| `src/http/administrativeHolderController.ts` | `eb5b2071e8e2cb06e85adee38dbca855c018c4cbc9bec4bddb9b7b19dfe6ed80` |
| `src/http/administrativeLocalityController.ts` | `c9e177990c2576de53dfd473c7fa2ea587ef3b7afe5e5627b2e8404bead12dfd` |
| `src/http/administrativeSelectionController.ts` | `971856b36a75053ffdd9d5d463a1b31b5634e32eb604faf8a8c6776e2fe7cce8` |
| `tests/fixtures/mp35d4Selectors.js` | `686f65446f31b37280b1b0352249e7147780e74b7605db1856e92ecfed32be0c` |
| `tests/mp35d4Localities.test.js` | `59f6af7f9f1b9c6e612095dcae7c209d259d4c27718f2e246a220fb57ebc44c3` |
| `tests/mp35d4Selectors.test.js` | `7e0399598538878221ade6587fa67d029e99fb7127d771d47af88e642d19a777` |

Esses hashes são comparados após a edição documental, após staging e após
commit/hooks. Qualquer divergência impede commit/push. Código, testes,
configuração, imports e comportamento aprovados são preservados integralmente.
Somente os seis documentos ativos do corte são editados neste fechamento.

Estado deste registro anterior ao commit: **TITULAR E LOCALIDADES DA MP-35D-4
— APROVADOS PARA COMMIT**. Fechamento autorizado: um commit, staging explícito
dos 19 caminhos, push sem tags somente para `feat/mp-35d`, hash remoto igual
ao local e worktree/index limpos. O relatório final registra a conclusão
somente depois dessas verificações; não se antecipa confirmação remota.

D-3 fechada em `92bba62`, decimal em `dab3ac4` e integração HTTP em `27df733`
preservados. D-4 segue em andamento. Sem formulário de Nova Propriedade,
edição ou tela de status; sem nova navegação, Android físico, CI remota
consultada, backend/PostgreSQL reexecutado, integração final na `backend`,
release/deploy/produção. Demo preservado e artefatos ignorados fora do commit.

## MP-35D-4 — correção focal A1 de Titular/Localidades — 2026-09-14

Registro histórico anterior à reauditoria, posteriormente aprovada acima.

Primeira auditoria: **CORREÇÕES OBRIGATÓRIAS**, somente A1. Base preservada:
`feat/mp-35d`, HEAD/origin em `27df7335efd4ab352245c48f6b022da1d99f0987`,
13 modificados, seis novos, index vazio e diff rastreado `+407/-71`.
Não houve commit/push nem alteração do gate D-2 aprovado.

### Reprodução anterior à correção

Foram acrescentados 13 casos permanentes nos dois arquivos de seletores,
usando os controllers públicos, transporte capturado e deferreds, sem
manipulação de campos internos. Com o controller funcional ainda idêntico ao
auditado (SHA-256 `a5aec7368d29327a5476dc64f0c2960d2656c0bbedf58cc07844966d459978b4`),
`npm.cmd run test:mp35d4` falhou: os 131 anteriores passaram e Localidades
executou 58 casos, com 52 passando e os seis A1 falhando. O encadeamento parou
ali; `node tests/mp35d4Selectors.test.js` executou os 57 casos restantes:
50 passaram e os sete A1 falharam. Assim, os **233 anteriores passaram e os
13 novos falharam semanticamente antes da correção**.

Nos dois consumidores, o primeiro retry usou o cursor e limpou
`nextPageFailure`; o retry concorrente caiu em `refresh()`, gerando um GET
sem cursor onde a asserção exigia zero. No cenário simultâneo dos dois
consumidores foram quatro GETs em vez de dois. A tentativa auxiliar com
`node --test --test-name-pattern=A1` foi bloqueada pelo sandbox em `spawn EPERM`;
a execução direta acima comprovou o erro sem depender desse subprocesso.

### Correção e cobertura

A única mudança funcional acrescenta a `retry()` a consulta prioritária de
`#pending`, reutilizando a promise já usada por `loadMore()`. A operação
captura query/filtros/UF, geração, cursor e lease em `#load`; reset/dispose
retiram a referência e invalidam o contexto. Não foi criado estado paralelo,
fila ou boolean. Refresh explícito continua reiniciando a primeira página;
retry sem falha volta a significar refresh somente depois que não há operação
pendente. Contratos, decoders, runtime, sessão e gate D-2 permanecem intactos
em relação ao objeto auditado.

As 13 regressões cobrem: recuperação concorrente bem-sucedida com e sem
seleção em cada consumidor; falha repetida compartilhada com observação
coerente e retry posterior; nova busca e refresh explícito durante recovery
nos dois consumidores; troca BA → SP durante recovery; dispose e redução de
perfil durante recovery de ambos, com retomada em instâncias novas.
Verificam requests, geração, identidade da query/promise, páginas, seleção,
dedup e avanço do cursor; mantêm também loadMore concorrente e retry após
sucesso. Nenhuma rejeição não tratada foi observada.

Composição atual: **35 contratos + 29 modelos + 26 comandos + 36 lifecycle +
5 arquitetura + 58 Localidades + 57 Titular/sessão/arquitetura = 246/246**.
O baseline 233 permanece preservado; os acréscimos são seis e sete casos nos
respectivos arquivos, sem novo arquivo permanente ou alteração de package.

### Probe focal e execuções próprias após A1

Probe ignorado em `dist/a1-mp35d4-20260914/retry-probe.js`, sem apagar artefatos
do auditor. Usa `Promise.all([retry(), retry()])` nos dois controllers reais:

| Consumidor | GETs de recovery com cursor | GETs sem cursor | Resultado |
|---|---:|---:|---|
| Município BA | 1 | 0 | Ilhéus + Itabuna, seleção/geração/versão preservadas, cursor page-3 |
| Titular | 1 | 0 | duas opções deduplicadas, candidato/geração preservados, cursor page-3 |

| Comando executado | Resultado após correção |
|---|---|
| `npm.cmd run typecheck` | Passou |
| `npm.cmd run test:mp35d4` | 246/246, sem falhas/skips |
| `npm.cmd run test:mp35d3` | 106/106 |
| `npm.cmd run test:mp35d2` | 85/85, gate aprovado não alterado |
| `npm.cmd run test:mp35d1` | 55/55 |
| `npm.cmd run test:domain-compat` | Passou |
| `node dist/a1-mp35d4-20260914/retry-probe.js` | Ambos os consumidores passaram |

Backend/PostgreSQL não executados: sem mudança nessas superfícies.
Bundle/native graph não repetidos em A1: imports, runtime, package e composição
não mudaram em relação ao objeto auditado. Os resultados históricos abaixo
não são novas execuções desta correção.

Estado: **A1 CORRIGIDO — TITULAR E LOCALIDADES AGUARDANDO REAUDITORIA
INDEPENDENTE**. Não há aprovação do corte, conclusão da D-4 ou autorização
para fechamento Git. D-3 em `92bba62`, decimal em `dab3ac4` e HTTP em `27df733`
preservados; formulários/navegação e Android físico permanecem pendentes,
CI remota não consultada e integração final na `backend` posterior.

## MP-35D-4 — implementação inicial de Titular/Localidades — 2026-09-14

Registro anterior à primeira auditoria, que posteriormente encontrou A1.
Contagens, execuções e estado abaixo pertencem à implementação inicial;
a correção e a aprovação posterior estão nas seções acima.

Base conferida antes da edição: `feat/mp-35d`, HEAD e `origin/feat/mp-35d` em
`27df7335efd4ab352245c48f6b022da1d99f0987`; worktree limpo, index vazio,
diffs rastreado/cached vazios e `git diff --check` aprovado. Sem novo commit/push.
Esta é execução própria da implementação, distinta das auditorias históricas abaixo.

### Suíte permanente e cobertura

`test:mp35d4` mantém **131 casos anteriores sem alterar seus cinco arquivos**:
35 contratos + 29 modelos + 26 comandos + 36 lifecycle + 5 arquitetura.
Acrescenta `mp35d4Localities.test.js` (**52**) e `mp35d4Selectors.test.js` (**50**),
totalizando **233/233**, sem skips ou falhas. A fixture adicional usa runtime e
SessionCoordinator reais, transporte controlado e as 27 UFs do seed backend
existente somente nos testes. Não introduz catálogo local no aplicativo.

Cobertura: IDs distintos de Usuário/Produtor; filtros ativa/inativa; detalhe
autoritativo e divergências de ID/perfil/estado; mudança de status; vazios e
rede/retry; envelopes e limites de Localidades; cursor opaco e NFC; paginação,
dedup e seleção durante página em voo; versão divergente/cursor inválido e
reinício; seleção municipal da edição fora das páginas e PATCH somente dirty.
Deferreds cobrem ambos os ordenamentos BA/`ilh` → BA/`ita`, BA → SP, consulta
UF → refresh e busca/status de Titular, com sucesso, erro, página e callback
antigos. 401/403 nas quatro leituras, redução para Produtor/Colaborador,
identidade, logout, dispose, nova geração e retomada verificam descarte F1 e
inércia dos controllers antigos. Seletores não enviam comandos de Propriedade.

### Execuções próprias desta etapa

| Comando executado no Windows | Resultado |
|---|---|
| `npm.cmd run typecheck` | Passou após corrigir import do tipo existente `HttpUserStatus` |
| `npm.cmd run test:mp35d4` | 233/233; 131 anteriores + 102 novos |
| `npm.cmd run test:mp35d3` | 106/106 |
| `npm.cmd run test:mp35d2` | 85/85 após ajustar a asserção da composição compartilhada |
| `npm.cmd run test:mp35d1` | 55/55, pertinente às mudanças aditivas de BackendApi/contratos/decoders |
| `npm.cmd run test:domain-compat` | Passou, incluindo MP-33C, MP-34 e convergência |
| `npm.cmd run test:native-graph:mp33c` | Passou via Expo Autolinking após reexecução com permissão de subprocessos |
| `npm.cmd run test:bundle:mp33c` | Passou isoladamente após domain-compat; HTTP/Demo exportados, grafo HTTP sem mock/AsyncStorage |

Falhas intermediárias registradas: o primeiro typecheck detectou `UserStatus`
inexistente; import corrigido para `HttpUserStatus`. Na primeira D-4, a asserção
nova de autenticação tentou ler `headers` no request abstrato do transporte;
corrigida para `accessToken`, conforme a porta existente. Todos os 131 casos
anteriores já passavam. A D-2 detectou regex exigindo construção inline do
repositório; a asserção foi atualizada para comprovar a única instância agora
compartilhada com Titular. O novo teste comportamental também verifica identidade
da instância reutilizada. Nenhuma falha funcional foi acomodada por relaxamento
dos 131 testes anteriores. O grafo nativo inicialmente falhou com `spawnSync
node.exe EPERM` no sandbox; o mesmo comando passou após permissão para executar
os subprocessos locais do Expo.

Conferência final: `git diff --check` passou e 81 links locais nos seis
documentos ativos foram validados, sem destinos ausentes. O diff confirma
backend, Demo, navegação, SessionCoordinator, coordenador idempotente,
lifecycle F1, repositório de Usuários e modelos de Propriedade inalterados.
Index vazio; artefatos ignorados de testes/bundles não pertencem à entrega.

Backend/OpenAPI/SQL/migrations não foram alterados; testes backend/PostgreSQL
não foram executados. Sem Android físico, consulta à CI remota ou integração
final na `backend`. Formulários e navegação D-4 permanecem pendentes. Estado:
**TITULAR/LOCALIDADES IMPLEMENTADOS INTERNAMENTE — AGUARDANDO AUDITORIA INDEPENDENTE**.

## MP-35D-4 — aprovação independente e fechamento anterior — 2026-09-14

Registro histórico do corte fechado em `27df733`, com hash remoto confirmado.
As contagens e hashes abaixo documentam aquele objeto, não o novo worktree de
Titular/Localidades. A autorização Git descrita abaixo pertence ao fechamento
anterior e não autoriza commit/push da etapa atual.

Parecer final recebido: **APROVADA PARA COMMIT DA INTEGRAÇÃO HTTP
ADMINISTRATIVA DE PROPRIEDADES**. A primeira auditoria encontrou somente F1;
a correção focal foi reproduzida, implementada e aprovada na reauditoria.
Nenhum achado obrigatório remanescente. O objeto aprovado é HEAD `dab3ac4`
mais os 27 arquivos do corte: 14 modificados e 13 novos, index inicialmente
vazio e diff rastreado `+582/-67`.

### Validações executadas pelo auditor na reauditoria

Estes resultados pertencem ao auditor independente e não foram reexecutados
no fechamento documental:

| Validação do auditor | Resultado |
|---|---|
| typecheck | Passou |
| test:mp35d4 | 131/131 |
| test:mp35d3 | 106/106 |
| test:mp35d2 | 85/85 |
| test:domain-compat | Passou |
| Probes F1 originais | 2/2 |
| Descarte/identidade/erros/conflitos | 19/19 |
| StrictMode/dispose | 9/9 |
| Recovery/operações tardias | 90/90 |
| Retomada Admin | 4/4 |

Composição D-4: **35 contratos, 29 modelos, 26 comandos, 36 lifecycle e
5 arquitetura = 131/131**. A reauditoria cobriu criação/edição/status,
reduções Admin → Produtor/Colaborador, dispose/StrictMode, identidade/logout,
401/403, recovery pós-recibo, operações/GETs tardios e retomada com nova instância.

Observação preservada do auditor: dois probes exploratórios tentaram exigir
neutralização por dispose de um `403` ainda pertencente à mesma geração
compartilhada. Isso não foi classificado como regressão F1. Após substituição
real da geração, os testes de resposta tardia passaram. Não há bug aberto
decorrente desses probes.

Backend/PostgreSQL não foram reexecutados na reauditoria porque não foram
alterados. Implementação, primeira auditoria e reauditoria são evidências
distintas: a implementação inicial passou 122 D-4; a primeira auditoria exigiu
F1; a correção passou 131 D-4 e as regressões próprias descritas abaixo;
a reauditoria executou a tabela acima e aprovou o objeto final.

### Preservação funcional no fechamento

Somente os seis documentos ativos já pertencentes ao corte são atualizados.
Os 21 arquivos não documentais abaixo tiveram SHA-256 registrado antes da
edição documental e comparado depois: **21/21 iguais byte a byte**.
A comparação é repetida antes do commit e após hooks. Código, testes, scripts
e configuração aprovados não recebem regeneração, formatação ou refatoração.

| Arquivo preservado | SHA-256 antes = depois da atualização documental |
|---|---|
| `.gitignore` | `9a9c2cbf944ba15add1326126fd60e8dc19e7d64ccf9ca0a53f6b84e0f7a88a7` |
| `backend/src/administration/mp35c-routes.ts` | `811f9671b9e15e0b00f28b0ab4694bfa15e2bd2a233623117570d134636be495` |
| `backend/tests/http/mp35c-routes.test.ts` | `27180f3ab14260ec24abeabd6ea554988b4bde6a67bb420cc287f7dc59cb5d8d` |
| `package.json` | `a48ce3b7c86761df046f3054ea39153c1353e57af6250e5a5477b5e400eb350e` |
| `scripts/cleanMp35d4Output.js` | `275c499171c975a7e2fe12ffc96968206ab0c86dc2e494b8ed512ffc2583b414` |
| `src/http/administrativePropertyCommandLifecycle.ts` | `5f805768e7d3f5fb894d9cd65a761767d908f1c9e8a53c0ca554f60c2cbfb76a` |
| `src/http/administrativePropertyCommands.ts` | `3189b8b0affec0eae2ac2c151e382732dc1545b39bd7ba6239e970543fca47fd` |
| `src/http/administrativePropertyDataBoundary.ts` | `a02d18a766b4d6c3fa634b06686a485ca0b74f1aeac26a5f28d31390ab1dc995` |
| `src/http/administrativePropertyModels.ts` | `691ee089daf5a59dbbe04a739afada2a906a2560f1c60c2564e56d149c65e835` |
| `src/http/administrativePropertyRepository.ts` | `e50d99de476be89df3d1cd4474526838747ef813aeb9b326b7a09c0ebe6f759f` |
| `src/http/backendApi.ts` | `826dc98fd2bd72e686262000e91339f299aa4c45b3d5f34dc08ecadf78d2f75d` |
| `src/http/contracts.ts` | `bc8652b423a2d91f2ff92a890a1bab10682ab694f549a615a0899a861abd6a4e` |
| `src/http/decoders.ts` | `c8098204f69a468ef00443f73f0c62b6118a162cec1181fa8d827a371afb450b` |
| `src/http/runtime.ts` | `2dd49ecd901af45392b1a8ef1883633616bde9b671343e891d8e1a37617d21fb` |
| `tests/fixtures/mp35d4.js` | `7897c05eb844938d99c25da83aa8a3e239cc26d6f822789e31fa77753aad7d0e` |
| `tests/mp35d4Architecture.test.js` | `43006b022ce93654dbb23044fb096331681498ead302f849161b42acf916533d` |
| `tests/mp35d4Commands.test.js` | `06030dd917284b31520d27e0c0703972aba208574f72c150adf7e0dd1086dc2b` |
| `tests/mp35d4Contracts.test.js` | `27797f7180da9bb3fd3f24a98d65ebe76d29ed3d417ea65d33f7990170f99d30` |
| `tests/mp35d4Lifecycle.test.js` | `375130438b3a5eb946fa0174c57bbbeed04648943c96c0cb06e747206c0aab47` |
| `tests/mp35d4Models.test.js` | `976a5d5c0b747187397a54fbbbf2f4d9ce8284ae87d1a5cb45ddb21e34f07319` |
| `tsconfig.mp35d4-tests.json` | `8284c38b366e117962d3bcd1ece8d24fe45c0f59b60cbc828361c81901ad92d4` |

Manifesto dos 21 pares acima, na ordem da tabela, com cada linha formada por
`caminho + TAB + SHA256 maiúsculo + LF`, em UTF-8:
`SHA256 = 9bd30bc886997c5ab2d04c492a98a3548b80653a7ac9da97130305abef8db204`.
A igualdade dos hashes individuais é a prova de preservação; o manifesto
permite conferir o conjunto sem confundi-lo com um hash de commit.

Estado registrado neste snapshot: **INTEGRAÇÃO HTTP ADMINISTRATIVA DE
PROPRIEDADES — APROVADA E EM FECHAMENTO NA feat/mp-35d**.
O fechamento Git está autorizado para esses 27 caminhos, com revisão do
índice, commit e push somente para `feat/mp-35d`, sem tags. Sua conclusão
exige hash local igual ao remoto e worktree limpo; não é antecipada neste
registro anterior ao commit. Nenhuma suíte integral é repetida neste fechamento:
as verificações são hashes, links, diffs, índice e remoto.

Conferência documental deste fechamento: `git diff --check` passou;
76 links locais dos seis documentos foram validados, sem destinos ausentes.

D-3 permanece fechada em `92bba62` e o pré-requisito decimal em `dab3ac4`.
A aprovação cobre o corte HTTP interno, não toda a D-4. Seletores, formulários
e navegação permanecem pendentes; sem UI D-4, Android físico desta etapa,
consulta à CI remota, integração final na `backend`, release ou produção.
Os probes ignorados permanecem fora do commit.

## MP-35D-4 — correção focal F1 — 2026-09-14

A auditoria independente devolveu **CORREÇÕES OBRIGATÓRIAS**, com um único
achado: F1, lifecycle cancelado conservando intenção e dados administrativos.
Base da correção: `feat/mp-35d`, HEAD/origin em `dab3ac4`, 14 modificados,
13 novos, index vazio e diff rastreado `+492/-67`; worktree auditado preservado.

Reprodução permanente executada antes de alterar código funcional:
`npm.cmd run test:mp35d4` terminou com saída 1. Contratos 35/35, modelos 29/29
e comandos 26/26 passaram; lifecycle executou 36 casos, com 19 passando e
17 falhando; arquitetura não executou porque o encadeamento parou na falha.
Os nove cenários novos falharam, junto de oito cenários existentes reforçados.
Nas duas reduções Admin → Produtor/Colaborador, SessionCoordinator/runtime
reais revalidaram `/v1/auth/me`; o fluxo de edição iniciado sem submit ficou
`cancelled` e a fronteira foi limpa, mas `flow.intent` ainda continha body,
baseline/draft, Titular, Município, área/cultura e intenção local. A asserção
de descarte falhou; nenhuma fixture limpou manualmente esses dados.
Dispose sem submit também falhou por deixar a instância em `idle` reutilizável.

Correção funcional restrita a `administrativePropertyCommandLifecycle.ts`:
armazenamento único `#intent: AdministrativePropertyIntent | null`, retornado
diretamente pelo getter, recebe `null` em `#cancel()` antes dos callbacks;
nenhuma cópia integral é mantida. Somente o ID escalar é usado para descartar
a entrada do coordenador. A referência à operação pendente e os callbacks
também são liberados. Dispose é definitivo antes ou depois de start/submit;
o teste StrictMode usa nova instância no novo setup. Referências externas do
chamador não são apagadas. `confirmed_reconciliation_failed` válido mantém
intenção/recibo, sem transformar recovery em novo comando.

Nove cenários adicionados em `mp35d4Lifecycle.test.js`: edição sem submit com
redução para cada perfil e retomada Admin com fluxo independente (2), criação
com logout (1), status com dispose da fronteira (1), dispose antes de submit
com/sem start (2), nova identidade e resposta tardia (1), recovery válido até
invalidação (1), cancelamento após version_conflict com rebase/conflitos (1).
Asserções existentes foram reforçadas em dispose durante mutação/GET, 401/403,
recovery pendente e setup/cleanup/setup. A prova usa o runtime real e a única
referência privada efetivamente zerada, sem limpeza artificial da fixture.

Composição atual executada após a correção: **35 contratos + 29 modelos +
26 comandos + 36 lifecycle + 5 arquitetura = 131/131**, sem falhas ou skips.

Execuções desta correção, todas com saída zero após a reprodução negativa:
`npm.cmd run typecheck`; `npm.cmd run test:mp35d4` (131/131);
`npm.cmd run test:mp35d1` (55/55); `npm.cmd run test:mp35d2` (85/85);
`npm.cmd run test:mp35d3` (106/106); `npm.cmd run test:domain-compat`, incluindo
MP-33C (46/46), MP-34 (35/35) e convergência (7/7).
Nenhum resultado de auditoria foi reutilizado como execução desta correção.

Backend, OpenAPI, decoders, contratos decimais, serviço, runtime, imports e
dependências não foram alterados por F1. Sem nova execução backend/PostgreSQL
ou gates nativo/bundle: a correção não muda grafo/imports/composição; os testes
de arquitetura D-4 e das regressões compartilhadas passaram. Probes ignorados
da auditoria foram preservados. Sem formulário, seletor, navegação, vínculo,
transferência, AsyncStorage, fila offline, fallback ou alteração Demo.

Estado ao término da correção: **F1 CORRIGIDO — INTEGRAÇÃO HTTP ADMINISTRATIVA DE PROPRIEDADES
AGUARDANDO REAUDITORIA INDEPENDENTE**. Naquele momento não havia aprovação da
integração ou liberação de fechamento Git. D-3 fechada em `92bba62`; decimal fechado em `dab3ac4`;
Android físico não executado, CI remota não consultada e integração final na
`backend` posterior. Sem add, commit ou push.

## MP-35D-4 — integração HTTP administrativa — 2026-09-14

Registro da implementação anterior à auditoria F1; execuções e contagens
abaixo pertencem àquela rodada, não à correção focal acima.

Base registrada antes das alterações: `feat/mp-35d`, HEAD e
`origin/feat/mp-35d` em `dab3ac494ef3d42b4cc4893d21e5a3e5f21d199c`, mensagem
`feat: alinhar leitura decimal administrativa da MP-35D-4`; worktree limpo,
index vazio, diffs normal/cached vazios e `git diff --check` sem ocorrência.
O log de oito commits confirmou D-3 em `92bba62` e merge de convite em `963eb0f`.
Nenhuma divergência da base solicitada. Sem add, commit ou push nesta entrega.

Suíte própria `npm run test:mp35d4`: TypeScript estrito com
`tsconfig.mp35d4-tests.json`, limpeza dedicada e cinco arquivos JS, sem testes
TSX de telas D-4. Usa BackendApi, SessionCoordinator, runtime e coordenador
reais com transporte de teste; somente o módulo nativo SecureStore é substituído.
Não equivale a um ensaio E2E PostgreSQL ou Android físico.

| Responsabilidade | Arquivo | Casos aprovados |
|---|---|---:|
| Contratos: campos obrigatórios, decimal, versão/timestamps, operacional preservado, recibos/rotas/chave | [mp35d4Contracts.test.js](../../tests/mp35d4Contracts.test.js) | 35 |
| Modelos: POST, PATCH parcial, limpezas, equivalência decimal, município, rebase/conflitos consecutivos, D10 | [mp35d4Models.test.js](../../tests/mp35d4Models.test.js) | 29 |
| Comandos: payloads, correlação, retry idempotente, recuperação só GET, refresh após recibo, D13 e listas | [mp35d4Commands.test.js](../../tests/mp35d4Commands.test.js) | 26 |
| Fronteira/lifecycle: StrictMode, dispose, identidade, 401/403, reduções, /me concorrente e respostas antigas | [mp35d4Lifecycle.test.js](../../tests/mp35d4Lifecycle.test.js) | 27 |
| Arquitetura: grafo HTTP, ausência de UI D-4, isolamento Demo/dados, coordenador existente | [mp35d4Architecture.test.js](../../tests/mp35d4Architecture.test.js) | 5 |
| **Total D-4 deste corte HTTP** | | **122** |

Execuções novas desta rodada, todas concluídas com saída zero após tratar as
ocorrências de ambiente descritas abaixo:

- Node 22.20.0, raiz: `npm run typecheck`; `npm run test:mp35d1` 55/55;
  `npm run test:mp35d2` 85/85; `npm run test:mp35d3` 106/106;
  `npm run test:mp35d4` 122/122; `npm run test:domain-compat`, incluindo
  MP-33C 46/46, MP-34 35/35 e convergência 7/7;
- `npm run test:native-graph:mp33c` e `npm run test:bundle:mp33c`: passaram;
  exports Android HTTP/Demo inspecionados, HTTP sem marcadores mock/AsyncStorage;
- Node 24.19.0, backend: `npm run typecheck`; `npm run test:unit` 190/190;
  `npm run test:http` 43/43; `npm run migrations:verify` dez migrations íntegras;
  `npm run build`; `npm run smoke:dist`.

Novo teste HTTP em [mp35c-routes.test.ts](../../backend/tests/http/mp35c-routes.test.ts)
inspeciona as três descrições OpenAPI e dez entradas de precedência `400`/`422`.
Schemas executáveis, campos/tipos reconhecidos, SQL, migrations e serviço MP-35C
continuam iguais. Nenhuma integração PostgreSQL foi necessária ou executada.

Ocorrências da execução: `node --test` inicial foi bloqueado por `spawn EPERM`;
a nova suíte adotou o padrão existente de executar arquivos diretamente.
Backend HTTP/unit e gates Expo usaram permissão para subprocessos fora do
sandbox. O wrapper `npm.ps1` falhou ao capturar saída (`Unknown command: pm`);
as execuções registradas usam `npm.cmd`, com os mesmos scripts. O primeiro gate
de bundle encontrou `ENOENT` porque a limpeza de `test:domain-compat` removeu
a pasta compartilhada `.tmp-mp33c`; o mesmo gate foi reexecutado isoladamente e
passou. Essas tentativas falhas não são contadas como testes aprovados.

Revisão final: `git diff --check` passou e os 73 links locais dos seis
documentos alterados apontam para arquivos existentes. O index permanece
vazio; não houve `git add`, commit ou push. O diff e os arquivos novos não
incluem coverage, logs, probes, builds, temporários, segredos ou `.env`.

Limites: auditoria independente pendente; sem seletores, formulários, navegação
D-4, vínculos ou transferência. Android físico não executado; CI remota não
consultada; sem release, publicação ou integração final na `backend`.

## MP-35D-4 — regressões do pré-requisito de leitura decimal

Escopo executado em 2026-09-11: leitura aditiva de área, decoder administrativo
e fim absoluto do validador mobile. Não é cobertura integral da D-4.

| Cenário | Evidência permanente |
|---|---|
| A: leitor operacional base com resposta numérica; B: mesmo leitor com resposta ampliada, lista/detalhe, null, limites e cursor | [MP-35D-1 contratos](../../tests/mp35d1Contracts.test.js) executa [snapshot do leitor base](../../tests/fixtures/mp35d4-base-property-reader.ts.txt), com SHA-256 fixado |
| C: novo leitor administrativo com texto válido/canonicalizado; D: ausência/corrupção/nulabilidade divergente | MP-35D-1 contratos exige texto e `InvalidBackendResponseError`, sem reconstrução numérica; mantém versão, timestamps e chaves fechadas |
| Domínio textual e fim absoluto: zero, negativos, sinais, expoentes, separadores, cinco casas, excesso de faixa, tipos não textuais, whitespace e LF/CR/CRLF/U+2028/U+2029/tab | MP-35D-1 contratos valida sem trim; omissão da criação/PATCH, null na criação e null no PATCH permanecem distintos |
| Texto obrigatório no resultado do banco, sem aceitar número como fonte; canonicalização e mesmo mapeamento em lista/detalhe | [Unit de Propriedades](../../backend/tests/unit/properties.test.ts); injeção de falha na conversão numérica altera somente o campo legado, preservando o texto; fonte numérica ou textual inválida falha com 503 seguro |
| JSON e OpenAPI de lista/detalhe iguais; número legado preservado e texto obrigatório `readOnly` | [HTTP de Propriedades](../../backend/tests/http/properties.test.ts) |
| `area_total_decimal` desconhecido em POST/PATCH, sozinho ou junto de `area_total`, string ou null | [HTTP MP-35C](../../backend/tests/http/mp35c-routes.test.ts) exige 400 sem chamada ao comando; matriz anterior preserva 400/422 e nulabilidade |
| PostgreSQL/PostGIS real → repositório → serialização → JSON: null, mínimo, máximo, quatro casas e padding | [Integração de Propriedades](../../backend/tests/integration/property-repository.integration.test.ts), com parser do OID numeric configurado para lançar erro caso usado |
| PATCH sem área preserva exatamente o texto persistido; escritas exatas/null e regras de acesso existentes | [Integração MP-35C](../../backend/tests/integration/mp35c-repository.integration.test.ts) e suíte de Propriedades, incluindo três perfis, vínculos, escopo, 404, status e versão de autorização |

O snapshot foi extraído de `git show
92bba628f43719216a28f73bec81348a0c3a4643:src/http/decoders.ts` antes de alterar o
código. Contém literalmente `decodeProperty`, `decodePropertyPage` e suas
declarações dependentes, sem importar o decoder atual; registra o hash do fonte
integral e tem seu próprio hash verificado em teste. A/B também foram
executados antes da implementação. A inspeção dos consumidores confirmou que
`BackendApi.listProperties/getProperty` usam esses leitores operacionais. O
decoder administrativo anterior era estrito e rejeitaria o campo adicional,
mas ainda não tinha consumidor no aplicativo: era fundação D-1 exercitada
somente em testes. Ele é explicitamente atualizado para exigir o novo contrato;
nenhum leitor operacional foi relaxado.

Resultados executados pelo implementador antes da auditoria, todos com saída zero:

- Node 22.20.0: `npm run typecheck`, `npm run test:mp35d1` (55),
  `npm run test:mp35d2` (85), `npm run test:mp35d3` (106) e
  `npm run test:domain-compat`; este encadeou MP-33C (46), MP-34 e convergência.
- Node 24.19.0 no backend: `npm run typecheck`, `npm run test:unit` (190),
  `npm run test:http` (42), `npm run migrations:verify` (dez migrations),
  `npm run build` e `npm run smoke:dist`.
- Integração focal: após `migrations:verify`,
  `node --import=tsx --test tests/integration/property-repository.integration.test.ts tests/integration/mp35c-repository.integration.test.ts`
  passou 32/32, sem falhas, cancelamentos ou skips. Usou `NODE_ENV=test` e
  `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`, exclusivamente URLs de Testcontainers
  `postgis/postgis:17-3.5` com bancos `_test`; nenhum banco de trabalho foi usado.

Ocorrências corrigidas durante o desenvolvimento: o novo teste de integração
tinha uma asserção de tipo quebrada por newline (TS1434); o teste OpenAPI
precisou declarar `bearerAuth` no app de teste e explicitar a conversão do tipo
de resposta OpenAPI (TS2352). As mesmas validações passaram após as correções.
O sandbox bloqueou subprocessos Node com EPERM e o acesso inicial ao Docker;
as suítes backend foram executadas com permissão de execução fora do sandbox.
Isso não foi registrado como aprovação antes da execução real.

Revisão documental: `git diff --check` passou; 79 links locais nos nove
documentos alterados apontam para arquivos existentes. A comparação adicional
contra o objeto Git confirmou as onze declarações congeladas, o hash do fonte
integral e os decoders operacionais atuais sem alteração.

Limites: integração backend focal, não suíte PostgreSQL integral; smoke ESM e
contratos automatizados, não execução Android física ou fluxo de formulário.
Não houve release, CI remota, commit/push ou integração na branch backend
naquela etapa. Ao término da implementação, a auditoria independente estava
pendente; D-3 concluída, formulários e demais fluxos D-4 não implementados.

### Aprovação independente do pré-requisito decimal — 2026-09-11

**APROVADO PARA COMMIT DO PRÉ-REQUISITO DECIMAL DA MP-35D-4**. O parecer cobre
HEAD `92bba628f43719216a28f73bec81348a0c3a4643` + worktree (21 arquivos,
`+569/-58`) + snapshot novo de 121 linhas, sem achado obrigatório ou evidência
crítica pendente. SHA-256 do snapshot aprovado:
`c18aec16e83fdbc90306586277ea1c30a86d0d5cca76d83f655a99391bdd981d`.
Contrato aditivo, escrita exclusivamente em `area_total` e compatibilidade
do leitor anterior foram preservados e comprovados.

| Executado pelo auditor independente | Resultado |
|---|---|
| Mobile typecheck; D-1; D-2; D-3 | Passou; 55/55; 85/85; 106/106 |
| domain-compat, incluindo MP-33C, MP-34 e convergência | Passou; 46/46; 35/35; 7/7 |
| Backend typecheck; unit; HTTP | Passou; 190/190; 42/42 |
| Integração PostgreSQL focal; integridade das migrations | 32/32; dez íntegras |
| Build backend e smoke ESM | Passaram |
| git diff --check; links locais | Passou; 79 válidos |
| Probes independentes de compatibilidade e ligação ao decoder | Passaram |

O fechamento documental herda esses resultados, sem repetir as suítes ou
alterar código, testes, snapshot, schemas, dependências e configurações.
Integração PostgreSQL focal não equivale à suíte integral; identidade injetada
no probe não equivale a novo E2E de autenticação. Nenhum Android físico, build
mobile de release ou validação produtiva. D-3 concluída; MP-35D/D-4 em andamento.
Formulários, seletores, comandos mobile e navegação dependem da próxima
autorização. Integração final na `backend` e revisão geral do OpenAPI de escrita
continuam posteriores, preservando `400`/`422`.

## MP-35D-3 — regressões permanentes das correções focais

A primeira auditoria independente desta sequência resultou em **CORREÇÕES OBRIGATÓRIAS**.
Naquela etapa, as correções implementadas aguardavam reauditoria independente.
O script existente `npm run test:mp35d3` inclui as suítes permanentes
abaixo; as telas são exercitadas com React Navigation real.

| Cenário | Resultado exigido | Suíte permanente |
|---|---|---|
| Rebase v1 → v2 → v3 com conflito pendente de nome e alteração remota somente no documento | Conflito preservado, intenção local intacta e documento intocado atualizado pelo servidor | [mp35d3Contracts.test.js](../../tests/mp35d3Contracts.test.js) |
| Resolver explicitamente o conflito após rebase consecutivo | Opções existentes coerentes com baseline, draft e dirtyFields; próximo comando necessário usa a versão autoritativa atual | [mp35d3Contracts.test.js](../../tests/mp35d3Contracts.test.js) |
| Rebase consecutivo na tela real de edição | Conflito visível, Salvar desabilitado e nenhum PATCH antes da resolução explícita | [mp35d3RenderedNavigation.test.js](../../tests/mp35d3RenderedNavigation.test.js) |
| Recibo válido seguido de falha de GET em edição, status e convite | Mensagens distinguem comando em andamento e confirmado; falha visível com recuperação explícita, sem spinner quando não há leitura em curso; submit normal não contorna reconciliação | [mp35d3RenderedNavigation.test.js](../../tests/mp35d3RenderedNavigation.test.js) |
| Recuperar a leitura, falhar novamente e depois concluir | Cada recuperação solicita somente GET; uma única mutação, mesmo recurso e versão relida igual ou superior ao recibo; conclusão consumida uma vez | [mp35d3RenderedNavigation.test.js](../../tests/mp35d3RenderedNavigation.test.js) |
| Criação com falha de releitura após recibo | Recuperação por GET preservada, sem duplicar criação nem concluir antes da reconciliação | [mp35d3RenderedNavigation.test.js](../../tests/mp35d3RenderedNavigation.test.js) |
| Invalidação por falha de reconciliação no controller | Detalhe e leitura anterior limpos; projeção sem carregamento fictício e sem GET adicional após publicação reconciliada | [mp35d3BoundaryLifecycle.test.js](../../tests/mp35d3BoundaryLifecycle.test.js) |
| Identidade ou lifecycle interrompido durante recuperação | Callback antigo não solicita GET nem publica/navega após troca de identidade, redução de perfil ou dispose | [mp35d3RenderedNavigation.test.js](../../tests/mp35d3RenderedNavigation.test.js) |
| `401`/`403` durante recuperação de recibo confirmado nos quatro comandos | Falha fecha o acesso e impede nova recuperação, publicação ou mutação | [mp35d3Commands.test.js](../../tests/mp35d3Commands.test.js) |

As suítes existentes de comandos, lifecycle e arquitetura complementam esses
casos com duplo submit, correlação de recibo, `401`/`403`, troca de identidade,
redução de perfil, dispose e isolamento HTTP/Demo. A recuperação não desativa a
invalidação de dados e não concede acesso por conta própria. Esta rodada não
altera backend nem migrations e não substitui reauditoria independente, smoke
Android físico ou validação produtiva.

Validação da rodada anterior, em 2026-09-10: `npm run typecheck`,
`npm run test:mp35d1`, `npm run test:mp35d2`, `npm run test:mp35d3` e
`npm run test:domain-compat` concluíram com código de saída zero. A
compatibilidade de domínio incluiu os scripts encadeados MP-33C, MP-34 e
convergência de interface. A MP-35D-3 passou em 68 casos: 13 de contratos,
11 de comandos, 8 de lifecycle, 30 de navegação e 6 de arquitetura; 15 casos
foram acrescentados nesta correção.

Antes da correção, os novos testes reproduziram quatro falhas de domínio,
duas de rebase nas telas, quatro de recuperação nas telas e uma de projeção
do detalhe. A recuperação da criação também detectou mutação duplicada por
callback antigo; edição, status e convite reproduziram o spinner. Os casos
passaram na versão corrigida. Esta evidência automatizada não constitui
aprovação independente das correções.

### Rodada posterior — retomada após 403

A reauditoria aprovou os reparos de rebase consecutivo e recuperação somente
por GET, além da correlação de recibo e conclusão/navegação únicas. Encontrou
um novo P2: nova criação habilitada sem POST após Admin revalidado na mesma
partição. A correção sequencial passou na reauditoria seguinte, com e sem GET
incidental; naquele momento D-3 não estava formalmente aprovada e D-4 não iniciada.

| Cenário permanente acrescentado | Evidência exigida | Suíte |
|---|---|---|
| Dois ciclos 403 → `/me` aceito na mesma partição | Novo lifecycle executa comando e leitura; leases, callbacks, start e remontagem dos cancelados continuam inválidos | [Fronteira/lifecycle](../../tests/mp35d3BoundaryLifecycle.test.js) |
| Revalidação pendente, 503, transporte, 200 malformado, conta inativa, 403, Produtor, Colaborador ou identidade divergente | Nenhum POST administrativo indevido | [Fronteira/lifecycle](../../tests/mp35d3BoundaryLifecycle.test.js) |
| `/me` anterior a nova invalidação, respostas concorrentes e troca de identidade/dispose | Nenhuma restauração por resposta obsoleta; identidade mais recente preservada | [Fronteira/lifecycle](../../tests/mp35d3BoundaryLifecycle.test.js) |
| Criação confirmada → GET falho → recuperação 403 → Admin aceito → nova criação, com e sem GET incidental | Um POST passa a dois somente no novo submit; payload novo, chave idempotente distinta e uma navegação/conclusão | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) |
| Callbacks e respostas antigas 200/403 após retomada e após conclusão nova | Nenhum comando, leitura, publicação, alteração do novo draft ou navegação antiga | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) |
| Montagem bloqueada e revalidação rotineira sem 403 | Bloqueio visível sem submit silencioso; validação rotineira preserva draft e comando legítimos | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) |

Antes de alterar o código funcional, `npm run test:mp35d3` reproduziu a falha
principal nas duas variantes: botão habilitado, `esperado: 2` POSTs e
`obtido: 1`. Após o reparo, ambas passaram. O teste adicional de 403 tardio
detectou o empréstimo indevido de lease novo pelo serviço; o ajuste passou na
mesma regressão, preservando os casos anteriores.

A composição da rodada anterior de `test:mp35d3` foi **86/86**: 13 de contratos, 11 de
comandos, 20 de fronteira/lifecycle, 36 de navegação (incluindo os 11 casos
D-2 importados pela fixture) e 6 de arquitetura. Foram acrescentados 18 casos
nesta rodada: 12 de fronteira/lifecycle e 6 de navegação. O runtime, os decoders,
a sessão, as telas e React Navigation são reais; transporte e primitivas
nativas são controlados. Os testes não limpam `forbidden` para simular retomada.

Validações desta rodada: `npm run typecheck`, `npm run test:mp35d1` (52/52),
`npm run test:mp35d2` (85/85), `npm run test:mp35d3` (86/86) e
`npm run test:domain-compat` passaram. A compatibilidade inclui MP-33C, MP-34 e
convergência da interface. `git diff --check` e links documentais alterados
foram verificados. Não houve smoke Android físico, build de release ou
liberação produtiva; esta evidência do implementador não é aprovação
independente.

### Rodada anterior — concorrência de /me e Cancelar antigo, 2026-09-10

A reauditoria daquela rodada aprovou a retomada sequencial, mas reproduziu descarte de
B válida após A substituir o objeto de snapshot, e Cancelar preexistente de uma
tela descartada navegando sobre nova criação. Ambos foram corrigidos e, ao fim
da implementação, aguardavam reauditoria independente. A prioridade de `/me` segue a ordem de início,
com epoch, identidade e token da tentativa efetiva preservados; retomar exige
também o lease atual da fronteira. A saída da tela verifica instância montada e
chave da rota atual, separadamente da confirmação de mutações.

| Regressão permanente adicionada | Evidência | Suíte |
|---|---|---|
| B Admin/Produtor/Colaborador, entregas A-B e B-A | Só B publica/notifica aceitação; A não sobrepõe B; duas chamadas e nenhum refresh incidental | [Sessão MP-33C](../../tests/mp33cSession.test.js) — 6 casos |
| Rotação posterior à tentativa e refresh necessário antes da tentativa | Resposta anterior à rotação descartada; identidade da tentativa com token renovado aceita | [Sessão MP-33C](../../tests/mp33cSession.test.js) — 2 casos |
| A antes do 403, B depois, três perfis e duas ordens | A não retoma; B Admin libera comandos/leituras na mesma partição; B não Admin impede POST; lifecycle antigo permanece cancelado | [Runtime/fronteira](../../tests/mp35d3BoundaryLifecycle.test.js) — 6 casos |
| Nova invalidação após a captura de B | Mesmo com A e B Admin, B não restaura acesso e novos lifecycles continuam bloqueados | [Runtime/fronteira](../../tests/mp35d3BoundaryLifecycle.test.js) — 1 caso |
| Recibo → GET falho → A pendente → recuperação 403 → B → A-B Admin, com/sem GET incidental | Nova criação leva POSTs de um para dois, payload novo, chave distinta, conclusão/navegação únicas e nenhuma terceira revalidação | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) — 2 casos |
| B Produtor/Colaborador, A-B e B-A | Perfil aceito; rotas, dados e draft administrativos removidos; callbacks antigos inertes | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) — 4 casos |
| Cancelar capturado de criação/edição descartada após retomada | Nova chave de rota e draft intactos, zero navegação/requisição antiga; Cancelar atual navega de fato | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) — 2 casos |
| Cancelar atual após recibo confirmado e GET falho | Saída legítima preservada, sem repetir POST | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) — 1 caso |
| Voltar capturado das quatro telas sob nova criação | Mesmo ainda montada, a origem não navega sobre outra chave; Voltar atual funciona | [Tela/React Navigation](../../tests/mp35d3RenderedNavigation.test.js) — 4 casos |

Antes do código funcional, falharam os três casos A-B de sessão, os três de
runtime/fronteira, as duas retomadas Admin em tela, as duas reduções A-B, os dois
Cancelar descartados e os quatro Voltar equivalentes. As entregas B-A e o
Cancelar legítimo já passavam. Depois, todos passaram. Os testes usam respostas
deferred e sessão/runtime/React Navigation reais; não limpam `forbidden` na
fixture nem substituem `goBack` por um mock sem efeito. Foram preservadas as
regressões anteriores de recibo, recuperação só por GET, rebases consecutivos,
erros tardios, troca de identidade, logout/dispose e StrictMode.

Validação do implementador naquela rodada, com saída zero: `npm run typecheck`, `npm run test:mp35d1`
(52/52), `npm run test:mp35d2` (85/85, incluindo 5 de sessão real),
`npm run test:mp35d3` (**106/106**) e `npm run test:domain-compat`. D-3 contém
13 contratos, 11 comandos, 27 fronteira/lifecycle, 49 navegação (incluindo os
11 D-2 importados) e 6 arquitetura: **20 casos novos**, 7 de fronteira e 13 de
navegação. MP-33C passou isoladamente e encadeada pela compatibilidade em
46/46: 8 contratos, **33 sessão (8 novos)** e 5 arquitetura. A compatibilidade
também executou MP-34 (35/35) e convergência da interface (7/7).

Estado ao término daquela implementação: **CORREÇÕES DE CONCORRÊNCIA /me E
CALLBACK CANCELAR IMPLEMENTADAS — AGUARDANDO REAUDITORIA INDEPENDENTE**.
Naquele momento D-3 estava sem aprovação formal; D-4 não
iniciada. Não houve smoke Android físico, release ou liberação produtiva.

### Auditoria independente final — aprovação para commit, 2026-09-10

Parecer: **APROVADA PARA COMMIT DO MP-35D-3**. O auditor independente cobriu
HEAD `963eb0f673d5f51e369d574f9210a8b690f486dc` + worktree aprovado de 20
arquivos (`+1918/-164`), incluindo todas as correções anteriores, preservadas e
verificadas. Não restaram achados obrigatórios ou evidências críticas pendentes.

| Validação executada pelo auditor independente | Resultado |
|---|---|
| typecheck | Passou |
| MP-35D-1 | 52/52 |
| MP-35D-2 | 85/85 |
| MP-35D-3 | 106/106 |
| MP-33C | 46/46 |
| domain-compat | Passou |
| git diff --check | Passou |

Esses resultados pertencem ao parecer independente e não são novas execuções
do fechamento documental. Código, testes, dependências, configuração e contratos
aprovados são preservados. MP-35D permanece em andamento; D-4 não iniciada e
integração final na `backend` posterior. Não houve smoke Android físico, build
de release ou validação produtiva; este fechamento não libera produção/release.

## Recibo de convite — correção focal 000010

| Cenário | Resultado exigido | Teste automatizado |
|---|---|---|
| Emissão e substituição com bearer e LOGIN runtime | 201, usuario, ID da rota e versão igual ao banco, sem incremento artificial | administrative-user-e2e.integration.test.ts |
| Recibo seguido de GET | Mesmo ID e versão relida igual ou superior | administrative-user-e2e.integration.test.ts |
| Replay imediato e após aceite | Recibo idêntico e nenhum novo convite, desafio, outbox ou auditoria | administrative-user-e2e.integration.test.ts |
| Mesma chave com outro alvo/pedido válido | 409 idempotency_conflict | administrative-user-e2e.integration.test.ts |
| Falha no COMMIT da substituição | Estado anterior preservado; retry da mesma chave conclui | administrative-user-e2e.integration.test.ts |
| Convite ativar_usuario e aceite público | 204 e conta ativada | administrative-user-e2e.integration.test.ts |
| Recibo legado, sem versão, de outro alvo ou com segredo/ID interno | 503 e ROLLBACK antes do COMMIT | invitation-receipt-repository.test.ts |
| Legados retidos há 1, 89 ou 91 dias | Upgrade bloqueado atomicamente e replay antigo intacto | invitation-receipt-migration.integration.test.ts |
| Recibo novo retido e down | Downgrade bloqueado e replay novo intacto | invitation-receipt-migration.integration.test.ts |
| Up/down/up e falha após DDL | Definições, OIDs, owners, ACLs e constraint preservados/revertidos | invitation-receipt-migration.integration.test.ts |
| Menor privilégio e PUBLIC | Runtime sem DML administrativo direto; PUBLIC sem EXECUTE; helper negado | invitation-receipt-migration.integration.test.ts |
| OpenAPI e privacidade | Quatro campos exatos; usuario e versao obrigatórios; auditoria referencia Usuário | administrative-user-e2e.integration.test.ts |

O corpo do convite só admite `ativar_usuario`; modo histórico continua `422`
e campo desconhecido continua `400`. O cenário de pedido diferente cobre
outro alvo e outro comando com corpo válido na mesma unicidade de chave,
preservando o contrato de validação. A regressão completa MP-35B/C e seus
resultados estão em [smoke.md](smoke.md).

## Escopo Da Matriz

Esta matriz orienta a API/backend. Os cenários de autenticação da MP-33B
possuem automação validada. Os cenários de leitura de Propriedades viraram
testes executáveis e foram validados na MP-33C; a administração de Usuários e
convites foi automatizada na MP-35B. As sete rotas de Propriedades, vínculos e
Localidades foram automatizadas localmente na MP-35C. A MP-35A implementou a
fundação persistente aprovada em D1-D13.

Separacao obrigatoria:

- Mock v2: deve usar vinculos diretos `usuario_propriedade` como escopo do
  colaborador.
- Backend: valida permissão dentro da consulta de Propriedades na MP-33C; cada
  vertical futura também deve validar por ação e Propriedade.
- Backend: Titularidade deriva exclusivamente de `propriedades.titular_id`;
  `usuario_propriedade` persiste somente `usuario_autorizado` e `colaborador`.
- Municipio e UF podem filtrar listagens e atribuicoes administrativas em
  lote, mas nao concedem acesso.
- A MP-33B automatiza somente autenticacao e autorizacao estreita de seus
  endpoints; o frontend nunca e fonte de seguranca.

## Estrategia Para `403` E `404`

- Usar `401 Unauthorized` quando nao houver usuario autenticado ou a sessao for
  invalida.
- Usar `403 Forbidden` quando o usuario autenticado pode saber que o recurso ou
  area existe, mas nao tem permissao para executar a acao.
- Usar `404 Not Found` quando o recurso nao existe ou quando revelar sua
  existencia criaria vazamento de escopo.
- Usar `400 invalid_request` para JSON malformado ou estrutura inválida.
- Usar `409 version_conflict`, `idempotency_conflict` ou
  `business_rule_conflict`, conforme a fonte do conflito.
- Usar `422 validation_error` para enum, valor ou limite semanticamente
  inválido.

Para eliminar ambiguidade, recurso individual fora do escopo usa `404`; acao
negada sobre recurso conhecido e dentro do escopo usa `403`.

## Classificacao Dos Testes

| Tipo | Destino |
|---|---|
| Automatizado MP-33B/MP-33C | Teste executável de contrato, domínio, HTTP ou integração |
| Planejado backend/API | Deve virar teste executável na fase indicada |
| Smoke/manual | Pode virar checklist de documentacao ou validacao manual de fluxo |
| Fora do Demo mockado | Deve ser executado somente contra a composição HTTP/backend aplicável |

## Autenticacao E Sessao

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-AUTH-01 | Login valido | Admin | Usuario ativo com credenciais validas | `POST /v1/auth/login` | `{ "email": "...", "senha": "..." }` | `200 OK` | Usuario ativo pode iniciar sessao | Automatizado backend/API |
| API-RBAC-AUTH-02 | Login invalido | Nao autenticado | Credenciais incorretas | `POST /v1/auth/login` | `{ "email": "...", "senha": "errada" }` | `401 Unauthorized` | Credenciais invalidas nao autenticam | Automatizado backend/API |
| API-RBAC-AUTH-03 | Usuario inativo tenta login | Usuario inativo | Credenciais validas, status inativo | `POST /v1/auth/login` | `{ "email": "...", "senha": "..." }` | `401 Unauthorized` | Resposta uniforme nao enumera estado | Automatizado backend/API |
| API-RBAC-AUTH-04 | Usuario pendente tenta login | Usuario pendente | Credenciais validas, status pendente | `POST /v1/auth/login` | `{ "email": "...", "senha": "..." }` | `401 Unauthorized` | Resposta uniforme nao enumera estado | Automatizado backend/API |
| API-RBAC-AUTH-05 | Consultar sessao valida | Colaborador | Sessao valida | `GET /v1/auth/me` | Nao se aplica | `200 OK` | Sessao retorna identidade, modo de escopo e versao, sem Propriedades | Automatizado backend/API |
| API-RBAC-AUTH-06 | Consultar sessao sem token | Nao autenticado | Sem sessao | `GET /v1/auth/me` | Nao se aplica | `401 Unauthorized` | Area protegida exige autenticacao | Automatizado backend/API |

## Usuarios

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-USR-01 | Admin lista usuarios | Admin | Admin ativo | `GET /v1/usuarios` | Filtros opcionais | `200 OK` | Somente Admin gerencia usuarios | Automatizado na MP-35B |
| API-RBAC-USR-02 | Produtor tenta listar usuarios | Produtor | Produtor autenticado | `GET /v1/usuarios` | Filtros opcionais | `403 Forbidden` | Produtor nao edita usuarios/vinculos | Automatizado na MP-35B |
| API-RBAC-USR-03 | Nao autenticado lista usuarios | Nao autenticado | Sem sessao | `GET /v1/usuarios` | Filtros opcionais | `401 Unauthorized` | Autenticacao obrigatoria | Automatizado na MP-35B |
| API-RBAC-USR-04 | Admin abre detalhe de usuario | Admin | Usuario existe | `GET /v1/usuarios/:id` | Nao se aplica | `200 OK` | Admin pode abrir detalhe administrativo | Automatizado na MP-35B |
| API-RBAC-USR-05 | Usuario inexistente | Admin | Id nao existe | `GET /v1/usuarios/:id` | Nao se aplica | `404 Not Found` | Recurso inexistente retorna 404 | Automatizado na MP-35B |
| API-RBAC-USR-06 | Admin cria usuario valido | Admin | E-mail nao existe | `POST /v1/usuarios` | `{ "nome": "...", "email": "...", "perfil": "produtor" }` | `201 Created` | Servidor cria pendente, sem senha, e emite convite | Automatizado na MP-35B |
| API-RBAC-USR-07 | Criar usuario com payload invalido | Admin | Campo obrigatorio ausente | `POST /v1/usuarios` | `{ "email": "invalido" }` | `400 Bad Request` | Payload invalido e recusado | Automatizado na MP-35B |
| API-RBAC-USR-08 | Criar usuario com e-mail duplicado | Admin | E-mail ja cadastrado | `POST /v1/usuarios` | `{ "nome": "...", "email": "...", "perfil": "produtor" }` | `409 Conflict` | Conflito de regra retorna 409 | Automatizado na MP-35B |
| API-RBAC-USR-09 | Admin atualiza usuario | Admin | Usuario existe | `PATCH /v1/usuarios/:id` | Campos parciais e `versao` | `200 OK` | Somente Admin atualiza usuario | Automatizado na MP-35B |
| API-RBAC-USR-10 | Colaborador atualiza usuario sem permissao | Colaborador | Sem papel administrativo | `PATCH /v1/usuarios/:id` | Campos parciais | `403 Forbidden` | Colaborador nao edita usuarios | Automatizado na MP-35B |
| API-RBAC-USR-11 | Admin altera status | Admin | Usuario existe e regra permite | `PATCH /v1/usuarios/:id/status` | `{ "status": "inativo", "versao": 2, "motivo": "fim_relacao" }` | `200 OK` | Status e controlado por Admin e revoga sessões afetadas | Automatizado na MP-35B |
| API-RBAC-USR-12 | Inativar Titular de Propriedade ativa isoladamente | Admin | Usuario/Produtor ativo e Propriedade ativa | `PATCH /v1/usuarios/:id/status` | `{ "status": "inativo", "versao": 2, "motivo": "suspensao_operacional" }` | `409 Conflict` | Estado final não pode deixar Propriedade ativa sem Titular habilitado | Automatizado na MP-35B |
| API-RBAC-USR-13 | Usuario principal inativo tenta acessar como Titular | Produtor inativo | `titular_id` permanece valido | `GET /v1/propriedades` | Nao se aplica | `401 Unauthorized` | Usuario inativo nao obtem acesso apesar da Titularidade cadastral | Automatizado na MP-33C |
| API-RBAC-USR-14 | Aceitar convite novo de Colaborador | Colaborador pendente | Convite `ativar_usuario`, sem credencial | `POST /v1/auth/invitations/accept` | Token e senha válida | `204 No Content` | Credencial e Usuário ativo no mesmo commit, mesmo com zero vínculos | Automatizado na MP-35A |
| API-RBAC-USR-15 | Aceitar convite novo de Produtor | Produtor pendente/inativo | Convite `ativar_usuario`, sem credencial | `POST /v1/auth/invitations/accept` | Token e senha válida | `204 No Content` | Usuário, Produtor e credencial ficam ativos atomicamente com login real membro somente de `tche_agro_runtime` | Automatizado na MP-35A |
| API-RBAC-USR-16 | Emitir modo histórico em fluxo novo | Admin | Usuário pendente | `POST /v1/usuarios/:id/convites` | Tentativa `manter_status` | `422 Unprocessable Entity` | `manter_status` é somente compatibilidade histórica | Automatizado na MP-35B; constraint automatizada na MP-35A |
| API-RBAC-USR-17 | Retry idempotente de mutação | Admin | Primeira resposta ambígua | Repetir rota mutável | Mesma `Idempotency-Key` e mesmo corpo | Mesmo status/recibo | Nenhuma versão ou efeito avança duas vezes | Automatizado para Usuários na MP-35B; Propriedades na MP-35C |
| API-RBAC-USR-18 | Reuso conflitante da chave | Admin | Chave já concluída | Repetir rota mutável | Mesma chave e corpo diferente | `409 Conflict` | Hash do pedido vincula a chave ao comando | Automatizado para Usuários na MP-35B; Propriedades na MP-35C |
| API-RBAC-USR-19 | Ativar Usuário sem credencial | Runtime | Usuário pendente sem credencial ativa | Escrita SQL controlada | Alterar para ativo | Transação rejeitada | Ativação exige credencial ativa mesmo por escrita direta | Automatizado na MP-35A |
| API-RBAC-USR-20 | Concluir bootstrap e inativar último Admin em corrida | Runtime | Uma conexão conclui bootstrap e outra inativa o Admin | Duas transações com barreira | Não se aplica | No máximo um commit | Proteção do último Admin compartilha o lock singleton | Automatizado na MP-35A |
| API-RBAC-USR-21 | Alteração de autorização | Admin | MP-35B/C implementada | Rota mutável aplicável | Comando válido | Conforme rota | D13 revoga sessões dos Usuários diretamente afetados, inclusive em ampliação | Status de Usuário automatizado na MP-35B; vínculos e status de Propriedade automatizados localmente na MP-35C |
| API-RBAC-USR-22 | Login runtime tenta DML administrativo direto | Login membro somente de runtime | `current_user=session_user`, não-superuser e não-owner | SQL direto em Usuários/Produtores/idempotência | `INSERT`/`UPDATE`/`DELETE` adversarial | Permissão negada | Somente funções estreitas podem mutar o agregado | Automatizado na MP-35B |
| API-RBAC-USR-23 | Cursor confidencial e vinculado | Admin | Mais de 100 nomes, iguais, acentuados e Unicode | `GET /v1/usuarios` | filtros, limite e cursor vazio/excessivo/truncado/malformado/adulterado/versão desconhecida | `200` ou `400 invalid_request` para envelope inválido | Sem PII decodificável, adulteração/troca de filtro recusada, sem omissão/duplicação | Automatizado na MP-35B |
| API-RBAC-USR-24 | Sessão Admin stale após autenticação | Admin com sessão revogada/versão divergente | Bearer formalmente válido | qualquer leitura administrativa | Não se aplica | `401 invalid_session` | Repositório revalida sessão no SQL | Automatizado na MP-35B |
| API-RBAC-USR-25 | Limite Unicode N/N+1 | Admin | ASCII, emoji, composto, decomposto e caractere fora do BMP | `POST /v1/usuarios` | nome e e-mail no limite e acima | `201` / `422 validation_error` | Pontos de código após NFC em HTTP/domínio/SQL | Automatizado na MP-35B |
| API-RBAC-USR-26 | Substituição versus outbox em voo | Admin e worker | Duas conexões e barreira antes do dispatcher | reemitir convite e dispatch | Duas ordens de lock e expiração real durante espera | Um envio anterior termina antes do commit ou o worker observa cancelamento/expiração sem dispatch | Fronteira linearizável e relógio do PostgreSQL consultado após os locks | Automatizado na MP-35B |
| API-RBAC-USR-27 | Criar Admin em produção sem MFA | Admin | Composição `production`, MFA ainda ausente | `POST /v1/usuarios` | `perfil=admin` | `409 business_rule_conflict` | Portão produtivo permanece fechado | Automatizado no serviço da MP-35B |
| API-RBAC-USR-28 | Matriz negativa das seis rotas | Admin, não autenticado, stale, Produtor e Colaborador | Bearers e sessões reais | seis rotas de `/v1/usuarios` | payload válido por rota | Admin `2xx`; ausência/stale `401`; Produtor/Colaborador `403` | Autenticação, revalidação SQL e RBAC atravessam o serviço/runtime real | `administrative-user-e2e.integration.test.ts`, matriz 6 x 5 |
| API-RBAC-USR-29 | Destino pendente na rota de status | Admin | Usuário pendente | `PATCH /v1/usuarios/:id/status` | `{ "status": "pendente", "versao": 2, "motivo": "outro", "motivo_detalhe": "teste" }` | `422 validation_error` | Pendente não é conflito de estado e não transiciona por essa rota | Automatizado em serviço, HTTP e PostgreSQL |
| API-RBAC-USR-30 | Corridas observáveis no PostgreSQL | Admin/runtime | Duas conexões por cenário | mutações administrativas e ativação de Propriedade | comandos concorrentes coordenados | Estado final serializado; ambos os PIDs observados esperando lock | Mesma chave/corpo, mesma chave/corpo diferente, mesma versão, e-mail, convite, status e Produtor versus Propriedade | `administrative-user-repository.integration.test.ts` |

## Propriedades

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-PROP-01 | Admin lista Propriedades | Admin | Admin ativo | `GET /v1/propriedades` | Filtros opcionais | `200 OK` | Admin tem acesso global | Automatizado na MP-33C |
| API-RBAC-PROP-02 | Produtor lista vinculadas | Produtor | Titularidade derivada ou `usuario_propriedade` adicional ativo | `GET /v1/propriedades` | Filtros opcionais | `200 OK` | Produtor acessa somente Propriedades ativas vinculadas | Automatizado na MP-33C |
| API-RBAC-PROP-03 | Colaborador lista vinculadas diretamente | Colaborador | `usuario_propriedade` ativo | `GET /v1/propriedades` | Filtros opcionais | `200 OK` | Colaborador acessa somente Propriedades ativas vinculadas | Automatizado na MP-33C |
| API-RBAC-PROP-04 | Colaborador filtra vinculadas por municipio/UF | Colaborador | Vinculos diretos ativos em mais de uma localidade | `GET /v1/propriedades` | `municipio` e/ou `uf` | `200 OK` | Localizacao filtra o escopo ja autorizado | Automatizado na MP-33C |
| API-RBAC-PROP-05 | Colaborador abre vinculada em outra localidade | Colaborador | `usuario_propriedade` ativo | `GET /v1/propriedades/:id` | Nao se aplica | `200 OK` | Vinculo direto independe de municipio ou UF | Automatizado na MP-33C |
| API-RBAC-PROP-06 | Produtor tenta abrir Propriedade de outro titular | Produtor | Sem vinculo ativo | `GET /v1/propriedades/:id` | Nao se aplica | `404 Not Found` | Produtor nao acessa outro titular nem confirma sua existencia | Automatizado na MP-33C |
| API-RBAC-PROP-07 | Colaborador sem vinculo tenta abrir Propriedade | Colaborador | Sem `usuario_propriedade` ativo | `GET /v1/propriedades/:id` | Nao se aplica | `404 Not Found` | Vinculo direto ativo e obrigatorio | Automatizado na MP-33C |
| API-RBAC-PROP-08 | Recurso inexistente | Admin | Id inexistente | `GET /v1/propriedades/:id` | Nao se aplica | `404 Not Found` | Recurso inexistente retorna o mesmo 404 do fora de escopo | Automatizado na MP-33C |
| API-RBAC-PROP-09 | Admin cria Propriedade | Admin | Payload valido | `POST /v1/propriedades` | `{ "nome": "...", "titular_id": "...", "municipio_id": "...", "area_total": "120.5", "status": "ativa" }` | `201 Created` | Cliente envia só Município e decimal exato textual; Admin grava a Titularidade somente em `titular_id`; backend deriva UF, nome e sigla | MP-35C |
| API-RBAC-PROP-10 | Criar Propriedade com payload invalido | Admin | Campo obrigatorio ausente | `POST /v1/propriedades` | `{ "nome": "..." }` | `400 Bad Request` | Payload invalido e recusado | MP-35C |
| API-RBAC-PROP-11 | Conflito de Titularidade | Admin | Regra estrutural de Titularidade conflita | `POST /v1/propriedades` | Payload valido formalmente | `409 Conflict` | Conflito de regra retorna 409 sem depender de vinculo `titular` | MP-35C |
| API-RBAC-PROP-12 | Admin edita Propriedade | Admin | Propriedade existe | `PATCH /v1/propriedades/:id` | Campos parciais e `versao` | `200 OK` | Admin edita cadastro sem transferir Titularidade | MP-35C |
| API-RBAC-PROP-13 | Colaborador edita cadastro sem permissao | Colaborador | Escopo valido, sem permissao de acao | `PATCH /v1/propriedades/:id` | Campos parciais e `versao` | `403 Forbidden` | Escopo nao implica editar cadastro | MP-35C |
| API-RBAC-PROP-14 | API apresenta acesso do Titular | Produtor | Usuario principal ativo do Produtor indicado por `titular_id` | `GET /v1/propriedades/:id` | Nao se aplica | `200 OK` | `tipo_acesso=titular` e calculado e nao possui linha duplicada em `usuario_propriedade` | Automatizado na MP-33C |
| API-RBAC-PROP-15 | Busca literal no escopo | Perfil autenticado | Nomes distintos de Propriedade, Titular e Município | `GET /v1/propriedades` | `busca` | `200 OK` | Substring literal busca nos três campos sem ampliar escopo | Automatizado na MP-33C |
| API-RBAC-PROP-16 | Filtro UF por ID ou sigla | Perfil autenticado | Propriedades autorizadas em UFs diferentes | `GET /v1/propriedades` | `uf=43` e `uf=rs` | `200 OK` | `uf_id` e `uf_sigla` são aceitos, sigla sem diferença de caixa | Automatizado na MP-33C |
| API-RBAC-PROP-17 | Filtro Município por ID ou nome | Perfil autenticado | Propriedades autorizadas em Municípios diferentes | `GET /v1/propriedades` | `municipio=4306106` e nome | `200 OK` | ID ou nome filtram sem diferença de caixa e sem conceder acesso | Automatizado na MP-33C |
| API-RBAC-PROP-18 | Cursor estável sem duplicação | Perfil autenticado | Mais registros que o limite e nomes repetidos | `GET /v1/propriedades` | `limite`, depois `cursor` | `200 OK` | Ordenação nome/ID não perde nem repete item | Automatizado na MP-33C |
| API-RBAC-PROP-19 | Contrato sem alias legado | Perfil autenticado | Lista ou detalhe autorizado | `GET /v1/propriedades` | Nao se aplica | `200 OK` | JSON usa `snake_case`, `tipo_acesso` e nenhum alias legado | Automatizado na MP-33C |
| API-RBAC-PROP-20 | Endpoint pessoal duplicado ausente | Perfil autenticado | Sessao valida | `GET /v1/me/propriedades` | Nao se aplica | `404 Not Found` | Coleção canônica é somente `/v1/propriedades` | Automatizado na MP-33C |
| API-RBAC-PROP-21 | Colaborador com vínculo inativo | Colaborador | Somente vínculo inativo | `GET /v1/propriedades` | Nao se aplica | `200 OK` vazio | Vínculo inativo não concede escopo | Automatizado na MP-33C |
| API-RBAC-PROP-22 | Produtor/Colaborador tenta listar Propriedade inativa | Produtor ou Colaborador | Escopo estrutural existente, Propriedade inativa | `GET /v1/propriedades` | `status=inativa` | `200 OK` vazio | Perfis não administrativos recebem somente Propriedades ativas | Automatizado na MP-33C |
| API-RBAC-PROP-23 | Campo territorial derivado em escrita | Admin | Propriedade existente | `PATCH /v1/propriedades/:id` | `uf_id`, `uf_sigla` ou `municipio_nome` | `422 validation_error` | Escrita externa aceita somente `municipio_id`; backend deriva os demais campos | Automatizado localmente na MP-35C |
| API-RBAC-PROP-24 | Alterar Titular no PATCH ordinário | Admin | Propriedade existente | `PATCH /v1/propriedades/:id` | `titular_id` | `422 validation_error` | Titular é obrigatório na criação e transferência fica fora da MP-35 | Automatizado localmente na MP-35C |
| API-RBAC-PROP-25 | Tipo estrutural inválido junto de campo proibido | Admin | Sessão válida | Rota mutável de Propriedade | Campo aceito com tipo inválido e campo semanticamente proibido | `400 bad_request` | Erro estrutural prevalece sobre a classificação semântica específica da rota | Automatizado localmente na MP-35C |
| API-RBAC-PROP-26 | UUID com versão/variante inválida | Admin | Sessão válida | Rota mutável de Propriedade | UUID hifenizado fora de v4/RFC | `422 validation_error` | HTTP, domínio e SQL aplicam o mesmo UUID canônico; forma malformada continua `400` | Automatizado localmente na MP-35C |
| API-RBAC-PROP-27 | Área textual fora de `numeric(14,4)` | Admin | Sessão válida | `POST` ou `PATCH /v1/propriedades` | `"0"`, negativo, cinco casas, expoente, zero à esquerda, whitespace ou acima de `"9999999999.9999"` | `422 validation_error` | Nenhuma coerção IEEE-754 ou arredondamento chega ao PostgreSQL | Automatizado em HTTP, domínio e SQL na MP-35C |
| API-RBAC-PROP-28 | Precedência de campo proibido | Admin | Sessão válida | `PATCH /v1/propriedades/:id` | `titular_id`/`status` válido com `versao` ausente ou par de tipo incorreto | `400 invalid_request` | A estrutura completa é validada antes da proibição semântica; payload completo retorna `422` | Automatizado localmente na MP-35C |
| API-RBAC-PROP-29 | Área com tipo estrutural inválido | Admin | Sessão válida | `POST` ou `PATCH /v1/propriedades` | número JSON, booleano, array ou objeto | `400 invalid_request` | Escrita aceita somente string decimal exata; criação com `null` é `422`, e PATCH com `null` limpa | Automatizado em HTTP, domínio e SQL na MP-35C |
| API-RBAC-PROP-30 | Área textual exata válida | Admin | Sessão válida | `POST` ou `PATCH /v1/propriedades` | `"0.0001"`, `"1"`, `"1.0"`, `"1.2345"`, `"9999999999.9999"` | `200` ou `201` | Backend canonicaliza zeros fracionários finais sem conversão binária; SQL converte para `numeric` só após validar o texto | Automatizado em HTTP, domínio e SQL na MP-35C |

## Localidades

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-LOC-01 | Admin lista UFs | Admin | Snapshot ativo | `GET /v1/localidades/ufs` | Nao se aplica | `200 OK` | 27 UFs locais, sem consulta externa | MP-35C |
| API-RBAC-LOC-02 | Admin lista Municípios por UF | Admin | UF válida | `GET /v1/localidades/municipios` | `uf_id`, busca/cursor opcionais | `200 OK` | Cursor nome/ID e somente versão ativa | MP-35C |
| API-RBAC-LOC-03 | Município sem UF | Admin | Sessão válida | `GET /v1/localidades/municipios` | Sem `uf_id` | `400 Bad Request` | Filtro de UF é obrigatório | MP-35C |
| API-RBAC-LOC-04 | Perfil final consulta catálogo administrativo | Produtor ou Colaborador | Sessão válida | `GET /v1/localidades/ufs` | Nao se aplica | `403 Forbidden` | Catálogo administrativo não amplia escopo | MP-35C |

## Vinculos

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-VINC-01 | Admin lista Propriedades vinculadas ao usuario | Admin | Usuario existe | `GET /v1/usuarios/:id/propriedades` | Nao se aplica | `200 OK` | Admin consulta vinculos diretos | MP-35C |
| API-RBAC-VINC-02 | Produtor tenta listar vinculos de outro usuario | Produtor | Sem permissao administrativa | `GET /v1/usuarios/:id/propriedades` | Nao se aplica | `403 Forbidden` | Produtor não administra vínculos | MP-35C |
| API-RBAC-VINC-03 | Admin aplica delta de vínculos | Admin | Payload valido | `PATCH /v1/usuarios/:id/propriedades` | `{ "versao": 2, "adicionar": ["UUID da Propriedade"], "remover": [] }` | `200 OK` | Backend deriva o tipo pelo perfil; delta persistente, versionado e auditável | Automatizado localmente na MP-35C |
| API-RBAC-VINC-04 | Delta com vínculo duplicado | Admin | Payload duplica vínculo ativo | `PATCH /v1/usuarios/:id/propriedades` | Delta com duplicidade | `409 Conflict` | Duplicidade retorna conflito | MP-35C |
| API-RBAC-VINC-05 | Payload invalido de vinculo | Admin | Falta `propriedade_id` | `PATCH /v1/usuarios/:id/propriedades` | `{ "versao": 2, "adicionar": [{}], "remover": [] }` | `400 Bad Request` | Payload invalido e recusado | MP-35C |
| API-RBAC-VINC-06 | Admin filtra Propriedades para atribuicao | Admin | Propriedades cadastradas | `GET /v1/propriedades` | `municipio` e/ou `uf` | `200 OK` | Localizacao auxilia selecao, sem conceder acesso | Automatizado backend/API |
| API-RBAC-VINC-07 | Admin atribui lote filtrado | Admin | Selecao confirmada e payload valido | `PATCH /v1/usuarios/:id/propriedades` | Delta com IDs selecionados | `200 OK` | Cada item gera vínculo direto persistente e auditável | MP-35C |
| API-RBAC-VINC-08 | Propriedade inexistente no lote | Admin | Um `propriedade_id` nao existe | `PATCH /v1/usuarios/:id/propriedades` | Delta com ID inexistente | `404 Not Found` | Nao criar vinculo para recurso invalido | MP-35C |
| API-RBAC-VINC-09 | Colaborador tenta alterar vinculos | Colaborador | Sem papel administrativo | `PATCH /v1/usuarios/:id/propriedades` | Payload valido | `403 Forbidden` | Colaborador nao administra vinculos | MP-35C |
| API-RBAC-VINC-10 | Cliente tenta escolher tipo do vínculo | Admin | Usuario e Propriedade existem | `PATCH /v1/usuarios/:id/propriedades` | Campo `tipo_vinculo` | `422 validation_error` | Tipo é derivado pelo backend; Titularidade nunca é persistida no vínculo | Automatizado localmente na MP-35C |
| API-RBAC-VINC-11 | Delta vazio | Admin | Usuário existente | `PATCH /v1/usuarios/:id/propriedades` | `adicionar=[]`, `remover=[]` | `409 business_rule_conflict` | Comando sem alteração efetiva é conflito de negócio | Automatizado localmente na MP-35C |
| API-RBAC-VINC-12 | Delta duplicado ou sobreposto | Admin | Usuário existente | `PATCH /v1/usuarios/:id/propriedades` | ID repetido ou em adicionar/remover | `422 Unprocessable Entity` | Um ID aparece no máximo uma vez no delta | MP-35C; validador automatizado na MP-35A |
| API-RBAC-VINC-13 | Delta acima do limite | Admin | Usuário existente | `PATCH /v1/usuarios/:id/propriedades` | Mais de 100 IDs somados | `422 Unprocessable Entity` | Limite D9 é global ao delta | MP-35C; validador automatizado na MP-35A |

A fronteira PostgreSQL da MP-35C também é exercitada por LOGIN runtime real com
`null`, número, booleano, string, array, objeto, UUID, hashes, metadados,
`versao`, patch, status, motivo, detalhe e arrays do delta incompatíveis. Todas
as rejeições ocorrem antes de contexto, idempotência, auditoria ou mutação, com
snapshot posterior sem efeitos. O catálogo sensível de dez termos é comparado
integralmente entre TS e SQL e consumido pelas fronteiras MP-35B/MP-35C. Erros
controlados usam `22023` + `ck_mp35c_input_validation` e viram `422` somente no
repositório MP-35C; falha induzida não allowlisted continua `503`.

O executor único das quatro mutações valida cardinalidade, colunas, resultado,
HTTP e recibo antes do `COMMIT`. Testes com executor falso e PostgreSQL real
adulteram deliberadamente a resposta após uma escrita, observam `ROLLBACK` e
confirmam ausência de mutação, recibo e auditoria persistidos. O helper de
Testcontainers usa mapeamento dinâmico de `5432`, banco/role exclusivos e é
exercitado por três processos simultâneos, sem mutex ou arquivo global de lock.

As corridas Titular × ativação são dois testes separados. Com ativação primeiro,
o resultado é `completed`/`active_holder_conflict`, Propriedade ativa e Titular
habilitado. Com inativação primeiro, é `completed`/`invalid_holder`, Propriedade
inativa e Titular inativo. Cada ordenamento usa duas conexões/PIDs, barreira
advisory observada em `pg_stat_activity`, verifica exatamente um recibo e uma
auditoria, revogação, versões, nenhuma reserva `processando` e nenhum deadlock;
cada teste executa três repetições internas.

## Permissao E Escopo

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-SCOPE-01 | Usuario lista seu escopo pela coleção canônica | Colaborador | Sessao valida | `GET /v1/propriedades` | Filtros opcionais | `200 OK` | Escopo calculado no backend | Automatizado na MP-33C |
| API-RBAC-SCOPE-02 | Nao autenticado consulta escopo | Nao autenticado | Sem sessao | `GET /v1/propriedades` | Filtros opcionais | `401 Unauthorized` | Autenticacao obrigatoria | Automatizado na MP-33C |
| API-RBAC-SCOPE-03 | Usuario recebe permissoes | Produtor | Sessao valida | `GET /me/permissoes` | Nao se aplica | `200 OK` | Usuario autenticado recebe capacidades | Automatizado backend/API |
| API-RBAC-SCOPE-04 | Permissao por Propriedade permitida | Colaborador | Vinculo direto ativo | `GET /propriedades/:id/permissao` | Nao se aplica | `200 OK` | Backend valida por Propriedade | Automatizado backend/API |
| API-RBAC-SCOPE-05 | Permissao por Propriedade negada | Colaborador | Sem vinculo direto ativo | `GET /propriedades/:id/permissao` | Nao se aplica | `404 Not Found` | Nao revelar recurso fora do escopo | Automatizado backend/API |
| API-RBAC-SCOPE-06 | Usuario inativo consulta permissoes | Usuario inativo | Sessao revogada | `GET /me/permissoes` | Nao se aplica | `401 Unauthorized` | Inativo nao mantém sessao protegida | Automatizado backend/API |

## Mapas E Anexos

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-MAPA-01 | Admin lista mapas | Admin | Propriedade existe | `GET /propriedades/:id/mapas` | Filtros opcionais | `200 OK` | Admin global, material filtrado por politica | Automatizado backend/API |
| API-RBAC-MAPA-02 | Produtor lista mapas liberados | Produtor | Propriedade vinculada, material liberado | `GET /propriedades/:id/mapas` | Filtros opcionais | `200 OK` | Produtor ve materiais autorizados | Automatizado backend/API |
| API-RBAC-MAPA-03 | Produtor tenta mapas de outra Propriedade | Produtor | Sem vinculo | `GET /propriedades/:id/mapas` | Filtros opcionais | `404 Not Found` | Propriedade fora do escopo bloqueada | Automatizado backend/API |
| API-RBAC-MAPA-04 | Colaborador lista anexos da Propriedade vinculada | Colaborador | Vinculo direto ativo | `GET /propriedades/:id/anexos` | Filtros opcionais | `200 OK` | Colaborador acessa por Propriedade | Automatizado backend/API |
| API-RBAC-MAPA-05 | Colaborador tenta anexos sem vinculo direto | Colaborador | Sem vinculo direto ativo | `GET /propriedades/:id/anexos` | Filtros opcionais | `404 Not Found` | Localizacao coincidente nao concede acesso | Automatizado backend/API |
| API-RBAC-MAPA-06 | Recurso inexistente de Propriedade | Admin | Propriedade nao existe | `GET /propriedades/:id/anexos` | Filtros opcionais | `404 Not Found` | Recurso inexistente retorna 404 | Automatizado backend/API |

## Visitas

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-VIS-01 | Admin lista visitas | Admin | Admin ativo | `GET /visitas` | Filtros opcionais | `200 OK` | Admin global | Automatizado backend/API |
| API-RBAC-VIS-02 | Produtor lista visitas proprias | Produtor | Propriedade vinculada | `GET /visitas` | `propriedade_id` opcional | `200 OK` | Produtor ve Propriedades vinculadas quando liberado | Automatizado backend/API |
| API-RBAC-VIS-03 | Colaborador lista visitas no escopo | Colaborador | Vinculo direto ativo | `GET /visitas` | Filtros opcionais | `200 OK` | Colaborador por Propriedade vinculada | Automatizado backend/API |
| API-RBAC-VIS-04 | Nao autenticado lista visitas | Nao autenticado | Sem sessao | `GET /visitas` | Filtros opcionais | `401 Unauthorized` | Autenticacao obrigatoria | Automatizado backend/API |
| API-RBAC-VIS-05 | Admin cria visita | Admin | Propriedade existe | `POST /visitas` | `{ "propriedade_id": "prop_1", "data": "2026-06-03", "tipo": "tecnica", "observacoes": "..." }` | `201 Created` | Admin cria visita | Automatizado backend/API |
| API-RBAC-VIS-06 | Colaborador cria visita no escopo | Colaborador | Propriedade no escopo e permissao ativa | `POST /visitas` | Payload minimo valido | `201 Created` | Colaborador cria dentro do escopo | Automatizado backend/API |
| API-RBAC-VIS-07 | Colaborador cria visita fora do escopo | Colaborador | Sem vinculo direto ativo | `POST /visitas` | Payload minimo valido | `404 Not Found` | Rotas diretas nao burlam escopo | Automatizado backend/API |
| API-RBAC-VIS-08 | Produtor tenta criar visita tecnica | Produtor | Propriedade vinculada | `POST /visitas` | Payload minimo valido | `403 Forbidden` | Produtor nao cria visita tecnica por padrao | Automatizado backend/API |
| API-RBAC-VIS-09 | Criar visita com payload invalido | Admin | Falta `propriedade_id` ou `data` | `POST /visitas` | `{ "observacoes": "..." }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |

## Caderno

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-CAD-01 | Admin lista caderno | Admin | Admin ativo | `GET /caderno` | Filtros opcionais | `200 OK` | Admin global | Automatizado backend/API |
| API-RBAC-CAD-02 | Produtor lista caderno da Propriedade vinculada | Produtor | Propriedade vinculada e visibilidade permitida | `GET /caderno` | `propriedade_id` opcional | `200 OK` | Produtor ve propria realidade operacional | Automatizado backend/API |
| API-RBAC-CAD-03 | Colaborador lista caderno no escopo | Colaborador | Vinculo direto ativo | `GET /caderno` | Filtros opcionais | `200 OK` | Colaborador por Propriedade vinculada | Automatizado backend/API |
| API-RBAC-CAD-04 | Produtor tenta caderno de outra Propriedade | Produtor | Sem vinculo ativo | `GET /caderno` | `propriedade_id` de outro titular | `404 Not Found` | Produtor nao acessa outro titular | Automatizado backend/API |
| API-RBAC-CAD-05 | Admin cria registro no caderno | Admin | Propriedade existe | `POST /caderno` | `{ "propriedade_id": "prop_1", "data": "2026-06-03", "atividade": "...", "observacoes": "..." }` | `201 Created` | Admin cria registro | Automatizado backend/API |
| API-RBAC-CAD-06 | Colaborador cria caderno no escopo | Colaborador | Propriedade no escopo e permissao ativa | `POST /caderno` | Payload minimo valido | `201 Created` | Colaborador cria dentro do escopo | Automatizado backend/API |
| API-RBAC-CAD-07 | Colaborador cria caderno fora do escopo | Colaborador | Sem vinculo direto ativo | `POST /caderno` | Payload minimo valido | `404 Not Found` | Escopo validado no backend | Automatizado backend/API |
| API-RBAC-CAD-08 | Produtor cria caderno na propria Propriedade | Produtor | Propriedade vinculada e politica permite criacao | `POST /caderno` | Payload minimo valido | `201 Created` | Produtor cria apenas quando politica permitir | Automatizado backend/API |
| API-RBAC-CAD-09 | Criar caderno com payload invalido | Admin | Campo obrigatorio ausente | `POST /caderno` | `{ "observacoes": "..." }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |

## Testes Que Ainda Devem Virar Automatizados

- Todos os casos futuros ainda marcados como `Automatizado backend/API`.
- Casos de acesso permitido e negado para cada endpoint protegido.
- Casos de `401`, `403`, `404`, `400` e `409`.
- Casos de acesso direto ativo, vinculo inativo e ausencia de vinculo para o
  colaborador.
- Casos de usuario inativo/pendente.
- Casos de rota direta/API por id fora do escopo.
- Casos de payload invalido para criacao/alteracao.
- Casos de vinculo duplicado ou conflito de regra.
- Casos de Titularidade derivada, rejeição de Propriedade ativa com Titular
  desabilitado e rejeição do tipo de vínculo `titular`.

## Testes Que Podem Ser Smoke/Manual

- Conferir se a documentacao continua separando MVP mockado de backend futuro.
- Conferir se telas administrativas nao prometem seguranca real quando apenas
  alteram vinculos visuais no mock.
- Conferir se o frontend usa respostas de permissao para UX, sem tratar isso
  como fonte unica de seguranca.
- Conferir mensagens visuais de acesso negado quando o backend real existir.

## Testes Que Não Pertencem Ao Demo Mockado

- Qualquer teste que exija `POST /auth/login` real.
- Qualquer teste que dependa de token, sessao real, refresh ou revogacao.
- Qualquer teste que valide persistencia real de `usuario_propriedade`.
- Qualquer teste que espere `propriedades_atribuidas` como regra efetiva no
  mock atual.
- Qualquer teste que dependa de API real, banco, migrations, storage ou RBAC
  produtivo.

## Riscos Fora Do MVP

- Verticais futuras divergirem do contrato e aceitarem operacoes apenas porque
  o frontend esconde ou mostra botoes.
- Backend usar municipio/UF como permissao implicita, ampliando indevidamente
  o acesso.
- Novos recursos não cobrirem rotas diretas por id e vazarem dados fora do
  escopo; lista/detalhe de Propriedades já possuem essa cobertura na MP-33C.
- Migracao de `fazenda_id`, `produtor_id` e `proprietario_id` quebrar acesso do
  Produtor.
- Usuarios inativos/pendentes manterem sessoes validas.
- `403` e `404` serem usados sem estrategia, revelando recursos fora do escopo.

## Evidência Executada Da MP-33C

Com Docker disponível, a suíte real do backend passou em 36 cenários com
Testcontainers/PostgreSQL/PostGIS. Os testes HTTP e de integração cobrem lista,
detalhe, autenticação obrigatória, perfis ativos, Titularidade derivada,
vínculos ativos/inativos, Propriedade inativa, filtros, busca literal, cursor,
contrato `snake_case`, endpoint duplicado ausente e `404` indistinguível. Essa
evidência não antecipa as linhas atribuídas à MP-35 ou às verticais posteriores.
