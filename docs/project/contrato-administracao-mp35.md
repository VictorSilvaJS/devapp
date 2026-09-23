# Contrato de Administração da MP-35

> Status: `MP-35A/B/C integradas; MP-35D-1/2 concluídas na feat/mp-35d;
> MP-35D-3 concluída, auditada e enviada em 92bba62;
> decimal fechado em dab3ac4; HTTP administrativo de Propriedades fechado em 27df733;
> Titular/Localidades fechados em 37a8790; formulários/navegação fechados em e5db497; status fechado em 1874ff5; D-4 concluída no escopo validado em fea8ec3, com aceite residual temporário de 23/09; MP-35D em andamento`
>
> Definido em: 2026-08-25
>
> Revisão: 2026-09-23
>
> Integração da MP-35A: 2026-08-26, commit `a51389e`, CI pós-push aprovada
>
> Integração da MP-35B: 2026-08-27, commit `60144c2`, reauditoria independente
> e CI pós-push aprovadas
>
> Integração da MP-35C: 2026-09-01, commit `e6789bf`, CI pós-push, auditoria
> independente e confirmação pós-integração aprovadas
>
> Correção do recibo administrativo de convite: commit `7c5256e` integrado na
> `backend` e incorporado à `feat/mp-35d` pelo merge `963eb0f`
>
> Escopo deste documento: contrato consolidado de Usuários, Propriedades,
> vínculos, concorrência e fundação persistente da MP-35.

## Fases e fronteiras

| Fase | Conteúdo | Estado |
|---|---|---|
| MP-35A | contratos, migrations append-only, constraints, versões, catálogos, snapshot IBGE e idempotência persistente | concluída e integrada diretamente em `a51389e`; CI pós-push aprovada |
| MP-35B | administração HTTP de Usuários e convites | concluída e integrada diretamente em `60144c2`; reauditoria independente e CI pós-push aprovadas |
| MP-35C | Propriedades, vínculos e Localidades no backend | concluída, auditada independentemente e integrada diretamente em `e6789bf`; CI pós-push e confirmação pós-integração aprovadas |
| MP-35D | integração das telas administrativas existentes e validação física | em andamento; D-1/D-2/D-3 concluídas; decimal em `dab3ac4`; HTTP administrativo de Propriedades em `27df733`; Titular/Localidades fechados em `37a8790`; formulários/navegação fechados em `e5db497`; status fechado em `1874ff5`; D-4 concluída no escopo validado em `fea8ec3`, após percurso físico e aceite residual temporário de 23/09; demais cortes e integração final na `backend` posteriores |

## MP-35D-4 — estado da etapa — 2026-09-23

MP-35D-4 concluída no escopo funcional validado, com limitações residuais
temporariamente aceitas para esta etapa de desenvolvimento. Código funcional
validado na revisão `fea8ec3`. Integração na `backend` e release não
autorizados por este fechamento. MP-35D permanece em andamento; o fechamento
não conclui todo o aplicativo, iOS ou o processo de publicação.

O aceite residual de 23/09 decorre da decisão do usuário na conversa de condução
do projeto, posterior ao percurso integrado no TCL API 35. Combina auditorias
dos cortes anteriores, revalidação integrada e aceite delimitado; não constitui
nova auditoria independente global. Bug 2/F-01 fechado em `f0fa1f6`, Bug 3 em
`ac42443` e melhoria parcial do Bug 1 em retrato consolidada em `fea8ec3`.
Paisagem e captura API 32 com IME continuam pendentes de tratamento posterior,
temporariamente aceitas apenas para fechar D-4. Ver [fechamento e alcance da D-4](smoke.md#mp-35d-4--fechamento-com-aceite-residual--2026-09-23).

As seções datadas anteriores abaixo preservam o estado e as evidências de cada
corte à época; suas pendências de validação/aceite da D-4 não são o estado atual.

## MP-35D-4 — fluxo visual de status — 2026-09-14

Implementado sobre formulários/navegação fechados em `e5db497`, **aprovado independentemente para commit**, sem achado obrigatório.
Fechamento Git autorizado somente na `feat/mp-35d`. O detalhe HTTP abre modal local
somente para Admin ativo, com projeção autoritativa e UUID válido. Não há rota
nova ou deep link; edição cadastral e seu PATCH continuam sem status.

Destino fixo: ativa → inativa ou inativa → ativa. Motivos usam o catálogo D10
com rótulos amigáveis; detalhe é opcional, exceto em Outro, com validação NFC e
300 pontos de código pelo modelo puro existente. Ausência é omitida. Confirmação
explícita antecede `administrativePropertyCommands.changeStatus`, que reutiliza
coordenador, recibo, sessão e lifecycle. Corpo exclusivo: `versao`, `status`,
`motivo` e `motivo_detalhe?`. Backend decide elegibilidade do Titular.

Recibo não encerra a UI: GET com mesmo ID e versão >= recibo publica a boundary;
então fecha o modal, preservando o detalhe/key e N1. Duplo Confirmar é uma
mutação; transporte ambíguo preserva chave/corpo/versão, mesmo com GET incidental.
Falha após recibo oferece Tentar atualizar → `retryReconciliation()` somente GET.
Conflito atualiza o estado autoritativo e exige Nova decisão de status, novo
motivo e confirmação; se a releitura falhar, nova decisão fica bloqueada.
Erro de regra usa mensagem controlada, sem expor detalhes internos.

Cancelar antes do comando não envia PATCH; após recibo a saída chama Fechar e
não promete rollback. Desmontagem, perda de Admin/401/403 e troca de identidade
aposentam a instância. Callbacks antigos verificam instância, token do modal e
key ativa. StrictMode cria instância nova, sem envio automático.

Sem mudanças em Demo, componentes compartilhados, modelos/serviços aprovados,
backend, RBAC ou persistência. D-4 permanece em andamento: Android físico,
fechamento e integração final na `backend` posteriores. D-3 `92bba62`, decimal
`dab3ac4`, HTTP `27df733`, Titular/Localidades `37a8790` preservados.
Validações em [testes de contrato](testes-contrato-api-rbac.md).

Auditoria do status visual: **38/38 critérios e 33/33 probes independentes**;
D-4 **340/340**. Inativação/reativação, motivos D10, recovery somente GET,
business_rule_conflict seguro e version_conflict sem retry automático aprovados.
F1/N1, edição cadastral sem status e Demo preservados. Evidências herdadas da
implementação/auditoria em [testes de contrato](testes-contrato-api-rbac.md);
suítes não reexecutadas neste fechamento exclusivamente documental/Git.

## MP-35D-4 — formulários HTTP de Propriedade e navegação mínima — 2026-09-14

Implementados sobre `37a87909e10e50baa8b13201c1c7c5f8c86bd131`, na
`feat/mp-35d`. **FORMULÁRIOS HTTP DE PROPRIEDADE E NAVEGAÇÃO MÍNIMA —
APROVADOS PARA COMMIT** foi o parecer pré-commit após reauditoria de N1.
Fechamento concluído na `feat/mp-35d` em `e5db497`, com hash remoto confirmado.
D-3 fechada em `92bba62`, decimal em `dab3ac4`, HTTP administrativo em `27df733`
e Titular/Localidades em `37a8790`, com F1/A1 encerrados nos cortes anteriores.

Nova Propriedade e Editar Propriedade usam `PropertyFormLayout`,
`PropertyCadastralFields`, `SelectField` e os componentes visuais aprovados do
Demo. A apresentação recebe dados/ações; a composição Demo preserva suas
regras, vínculos, armazenamento e capacidades locais. O container HTTP compõe
os modelos, controllers de seleção e comandos existentes, sem backend alterado.

A lista e o detalhe existentes oferecem somente as duas ações Admin ativo.
As rotas administrativas são removidas quando a capacidade é perdida; cada
montagem cria um controller novo, também no replay de efeitos de StrictMode.
Cancelar, Voltar, submit e conclusão verificam instância, lifecycle e chave da
rota. Logout/401/403 descartam o estado próprio e tornam callbacks antigos inertes.

Na criação, busca/paginação de Titular e UF/Município são remotas e independentes.
Titular exige confirmação e nova revalidação antes do POST; somente o
`produtor_id` validado chega ao modelo. Status inicial ativa/inativa é exclusivo
da criação. Na edição, Titular/status são informativos, Município atual vem do
detalhe mesmo fora das páginas, e o modelo mantém baseline/draft/dirtyFields/
conflitos. Área parte exclusivamente do decimal textual; omissão preserva,
limpeza explícita envia `null` no PATCH e equivalência canônica remove dirty.

Recibo confirmado bloqueia nova escrita. Falha posterior mostra confirmação e
recuperação exclusivamente por `retryReconciliation()` (GET); conclusão/navegação
acontecem uma vez após releitura válida, inclusive versão superior ao recibo.
Rebases consecutivos preservam conflitos; Nome, Área e Município mostram valores
do servidor/operador e exigem resolução explícita. Uma troca de UF ainda sem
Município não é desfeita por releitura de campos intocados.

D-4 permanece em andamento. Alteração visual de status existente, Android físico
e integração final na `backend` continuam pendentes; vínculos e transferência
não pertencem a este corte. Sem release, deploy, fila offline ou fallback Demo.
Execuções próprias e smoke estão em [testes de contrato](testes-contrato-api-rbac.md)
e [smoke](smoke.md).

A reauditoria aprovou 20/20 critérios e 14/14 probes, incluindo detalhe
reconciliado com versão GET superior ao recibo. Demo, SelectField e apresentação
compartilhada preservados. Evidências herdadas e protocolo do fechamento em
[testes de contrato](testes-contrato-api-rbac.md).

### Correção focal N1 — navegação após edição

A primeira auditoria independente encontrou somente **N1 — salvar edição
duplicava o detalhe da Propriedade na pilha**; os outros 33 critérios receberam
PASSA. A regressão permanente falhou antes da mudança funcional, após um PATCH
e um GET de reconciliação: `Main → Detail(A,k1) → Detail(A,k2)`, com keys
incluindo `k1 != k2`; Voltar revelava novamente `Detail(A,k1)`.

Correção focal implementada e **aprovada na reauditoria independente**.
N1 encerrado, sem achado obrigatório remanescente. O detalhe passa sua key e a identidade da Propriedade
como origem interna da edição. Após reconciliação, a conclusão verifica essa
origem contra a rota imediatamente anterior (key, nome e ID): se válida,
fecha somente a edição e revela o mesmo detalhe, que já observa a projeção
publicada pela boundary. Entrada direta/origem inválida termina em um detalhe
canônico, retirando do histórico apenas detalhes/edições da mesma Propriedade
e preservando rotas não relacionadas. Não usa `canGoBack()` como prova de origem.

Criação conserva `replace`; falha de GET pós-recibo mantém a edição aberta.
As guardas de instância, rota atual e lifecycle permanecem; uma conclusão
consumida não navega novamente. Demo, apresentação compartilhada, seletores,
modelos, comandos, lifecycle, sessão, boundary, runtime e backend não mudaram
nesta correção. Detalhes dos testes e preservação em
[testes de contrato](testes-contrato-api-rbac.md).

### Titular e Localidades internos — 2026-09-14

Implementação sobre `27df733`, aprovada para commit na reauditoria após correção
focal A1. A primeira auditoria exigiu somente corrigir retry concorrente que
reiniciava a busca e descartava páginas válidas, reproduzido em ambos os
consumidores antes da alteração funcional. A1 está encerrado e nenhum achado
obrigatório permanece. Fechamento Git autorizado somente na `feat/mp-35d`.
Fechado em `37a8790`. Esse corte interno não criou UI,
rotas de navegação ou comandos de Propriedade; a composição visual atual está descrita acima. Factories internas no runtime:
`administrativePropertySelectors.createHolder(status, limite?)` e
`createLocalities(limite?)`. Construção não faz HTTP; `start()` inicia a lista
de Titulares ou a coleção de UFs. `subscribe()` observa snapshots imutáveis.

| Leitura | Porta reutilizada/adicionada | Regras |
|---|---|---|
| `GET /v1/usuarios` | `AdministrativeUserRepository.list` existente | `perfil=produtor`; `status=ativo` somente para criação ativa; busca/limite/cursor; sem filtro territorial, vínculo ou quantidade de Propriedades |
| `GET /v1/usuarios/:usuario_id` | `AdministrativeUserRepository.getById` existente | detalhe autoritativo obrigatório em cada `prepareSelection()` |
| `GET /v1/localidades/ufs` | `BackendApi.listLocalityUfs` | coleção integral de até 27, sem parâmetros/paginação artificial |
| `GET /v1/localidades/municipios` | `BackendApi.listLocalityMunicipalities` | `uf_id` obrigatório, busca NFC + trim (vazia omitida), limite 1–100/padrão 50, cursor opaco de até 2.048 caracteres |

Decoders de Localidades exigem envelopes/chaves exatos, nomes nos limites do
backend, ID de UF com dois dígitos, Município com sete e prefixo da UF da
consulta, sigla com duas letras maiúsculas, cursor string não vazio ou `null`.
`versao_id` segue `ibge-localidades-AAAA-MM-DD`, conforme o contrato persistente;
não é UUID nem campo editável de Propriedade. A primeira página registra a
versão; próxima página divergente falha sem anexar dados. Busca municipal tem
até 200 caracteres Unicode após normalização, sem regras do decimal.

Titular conserva `{ usuario_id, produtor_id, nome, email, status }` separado
das opções. `select`/`selectionCallback` aceitam somente candidatos da geração
vigente. `prepareSelection()` relê o Usuário e exige mesmo ID, perfil Produtor,
mesmo `produtor_id` canônico presente e estado elegível: ativo para Propriedade
ativa; ativo, pendente ou inativo para inativa. Retorna somente `{ produtor_id }`
ou `null` com estado de erro/invalidez. O modelo de criação existente converte
`produtor_id` em `titular_id`; o comando backend conserva autoridade transacional.
Cada chamada concluída exige nova releitura antes de outro futuro submit;
chamadas simultâneas compartilham a releitura em voo. Busca não troca seleção.
`setInitialStatus()` reinicia filtros/geração e remove confirmação; ao passar
para ativa, candidato inelegível fica explicitamente inválido, sem substituição.
Revalidação pode reconhecer habilitação posterior. Trocar/limpar seleção ou
status invalida o detalhe anterior em voo.

`setUf` usa opção remota válida, limpa seleção municipal e inicia primeira
página. `initializeFromProperty(detail)` é a exceção explícita: valida pelo
modelo administrativo de edição existente, copia somente o conjunto
`{ municipio_id, municipio_nome, uf_id, uf_sigla }` e não executa GET.
O chamador pode iniciar busca normalmente; Município atual ausente das páginas
continua selecionado/exibível. `selectionInput()` entrega o conjunto coerente
para criação/edição; somente `municipio_id` pode entrar na escrita. Aplicar a
seleção ao modelo de edição existente não marca dirty quando o ID é o original.

`search`, `refresh`, `retry` e `loadMore` são remotos. Nova busca reinicia cursor,
páginas, erros e geração, preservando seleção compatível. Paginação mantém UF/
busca, deduplica IDs, compartilha chamada concorrente e permite selecionar
opção de página anterior. Falha posterior preserva páginas/seleção e permite
retry do mesmo GET. Cursor inválido/cíclico ou contrato/versão incompatível na
paginação expõe `nextPageFailure.restartRequired`: `refresh()` reinicia desde
a primeira página, sem inventar cursor. Respostas/callbacks antigos não alteram
dados, erros, loading ou seleção atuais.

Após A1, `retry()` verifica primeiro a mesma promise pendente usada por
`loadMore()`. `#load` já captura filtros (inclusive UF), geração e cursor;
`reset`/`dispose` retiram a referência e revogam o lease. Assim, a limpeza
transitória de `nextPageFailure` não transforma retries concorrentes em
refresh, não avança geração e não apaga páginas/seleção. Não há fila, boolean
paralelo ou retenção nova. Falha compartilhada reapresenta `nextPageFailure`
e permite tentativa posterior. Após sucesso concluído, retry sem falha mantém
a semântica anterior de refresh. `refresh()` explícito continua iniciando
primeira página em nova geração mesmo durante recovery; busca/UF nova e
cancelamento tornam a recuperação anterior inerte. Testes passaram 246/246.

A reauditoria confirmou 20/20 critérios e 42/42 probes: mesma promise, nenhuma
mudança de geração, páginas/seleção preservadas, um GET com cursor e zero sem
cursor. As 13 regressões A1 falharam na mutação sem correção, mantendo os 233
anteriores. A primeira auditoria também confirmou que o gate D-2 não foi
enfraquecido: instância única, referência compartilhada e mesmo repositório/
sessão/fronteira para Titular; treze mutações arquiteturais proibidas recusadas.
Resultados herdados, sem reexecução das suítes neste fechamento documental.

Os dois controllers usam leases da `AdministrativeUserDataBoundary` já
conectada à sessão real. Admin ativo é obrigatório; 401/403, redução de perfil,
identidade/logout e dispose cancelam definitivamente. Qualquer nova geração
da fronteira de Usuários, inclusive reconciliação/D13, também cancela de forma
conservadora; a factory cria outro controller quando há Admin válido. O código
de `/me`, o coordenador idempotente e o lifecycle aprovado não mudam. F1 é
preservado nos novos objetos: cancelamento anula referências próprias a
seleções, queries, resultados, cursores, erros, promises pendentes e listeners
antes da notificação terminal. Promises antigas podem terminar, mas não
publicam; referências externas guardadas pelo consumidor não são mutadas.

Sem persistência, Demo, catálogo local de runtime, consulta externa ao IBGE,
GET municipal por ID ou mudança backend. Testes permanentes e resultados em
[testes de contrato](testes-contrato-api-rbac.md). O corte visual atual está descrito acima;
Android físico e integração final na `backend` permanecem posteriores;
CI remota não consultada. A aprovação autoriza commit/push somente deste corte
na `feat/mp-35d`; não conclui D-4 nem libera produção.

### Integração HTTP administrativa de Propriedades — 2026-09-14

Implementada na `feat/mp-35d`, sobre `dab3ac4`; auditoria independente encontrou
F1, reproduzido e corrigido focalmente. A reauditoria aprovou a correção e a
integração HTTP interna para commit, sem achado obrigatório remanescente.
Estado do corte anterior: **FECHADO EM `27df733` NA feat/mp-35d**, com hash
remoto confirmado. Código e testes aprovados foram preservados no fechamento;
resultados do auditor e limites estão nos [testes de contrato](testes-contrato-api-rbac.md).
D-3 permanece fechada em `92bba62`; o pré-requisito decimal foi fechado e enviado
em `dab3ac4`. Não há nova capacidade visual neste corte.

| Porta BackendApi | Método/rota | Contrato |
|---|---|---|
| `listAdministrativeProperties` | `GET /v1/propriedades` | filtros/cursor existentes; itens administrativos completos |
| `getAdministrativeProperty` | `GET /v1/propriedades/:id` | representação administrativa completa, inclusive inativa para Admin |
| `createAdministrativeProperty` | `POST /v1/propriedades` | nome, titular_id de Produtor, municipio_id, status; área/cultura opcionais; sem versão |
| `updateAdministrativeProperty` | `PATCH /v1/propriedades/:id` | versao e somente alterações de nome, municipio_id, area_total, cultura_principal |
| `changeAdministrativePropertyStatus` | `PATCH /v1/propriedades/:id/status` | versao, status, motivo D10, motivo_detalhe obrigatório para outro |

Comandos exigem `Idempotency-Key`. Recibos contêm exatamente `resultado`,
`recurso_tipo=propriedade`, `recurso_id` UUID v4 canônico e `versao` inteira
positiva; resultados: `criado`, `atualizado`, `status_alterado`. PATCH/status
exigem ID alvo; na criação o ID nasce exclusivamente no recibo. O leitor
administrativo exige decimal/versão/timestamps, sem preenchimento operacional.
`decodeProperty` e `decodePropertyPage` permanecem intactos.

`AdministrativePropertyCommandService.create/update/changeStatus` devolvem um
`AdministrativePropertyCommandLifecycle`. Construção e `start()` não enviam
comandos. `submit()` executa a intenção imutável pelo coordenador D-1; duplo
submit compartilha operação. Transporte ambíguo conserva chave/payload/versão.
Falha definitiva ou conflito exige revisão e nova intenção explícita.

Recibo válido confirma a mutação antes do GET, fora da chamada autenticada da
mutação: refresh após `401` do GET nunca repete POST/PATCH. A reconciliação
exige mesmo ID e `versao >= versao_recibo`; campos concorrentes posteriores são
aceitos. Só então há publicação e uma emissão de `onCompleted`.
`confirmed_reconciliation_failed` preserva recibo/confirmação, bloqueia submit
e permite `retryReconciliation()` somente por GET, inclusive após novas falhas.

`AdministrativePropertyDataBoundary` possui partição, geração de dados, geração
de autorização e leases próprios. Detalhes/listas ficam em memória; invalidação
conserva filtros, sem inserir/remover itens pelo draft. Leituras antigas da mesma
consulta são descartadas. `dispose`, perda de autorização, identidade nova e
logout limpam dados e tornam fluxos antigos inertes. O runtime captura leases
no observer de `/me` existente; retomada aceita libera novos fluxos e nunca
revive os anteriores. Após F1, o lifecycle mantém a intenção em um único campo
privado anulável; o cancelamento zera esse armazenamento antes de notificar
observadores, descarta a referência à operação pendente e limpa callbacks.
`intent` retorna `null` e o snapshot cancelado não expõe body, baseline/draft,
conflitos ou resultado. Referências externas já guardadas pelo chamador não são
mutadas. `dispose()` é definitivo inclusive sem submit; cada novo setup, também
em StrictMode, cria outra instância. `confirmed_reconciliation_failed` ainda
válido conserva intenção/recibo e permite recuperação exclusivamente por GET.
Não há alteração no algoritmo de concorrência de sessão D-3.

Modelos puros em `administrativePropertyModels.ts`:

- criação recebe `{ produtor_id }`, sem aceitar `{ usuario_id }`; o servidor
  valida existência/habilitação. Titular e município são obrigatórios;
- edição mantém `baseline`, `draft`, `dirtyFields` e `fieldConflicts`;
  Titular fica no baseline de leitura e status usa modelo separado;
- área parte de `area_total_decimal`; equivalência canônica textual remove
  dirty. Omissão preserva e `null` no PATCH significa limpeza explícita;
- conflito de versão relê detalhe e devolve modelo rebaseado para revisão:
  campos intocados adotam o servidor; intenção local e conflitos sobrevivem
  a rebases consecutivos até resolução explícita;
- seleção municipal mantém ID, nome, UF e sigla juntos; somente ID é enviado.
  NFC/limites D9/whitespace seguem o HTTP e decimal usa o normalizador existente.

D13: criação/status invalidam projeções administrativas de Usuários por
`AdministrativeUserDataBoundary.invalidateReconciliation`, com lease capturado
antes da mutação. Nenhum ID afetado é inventado; dados dos domínios continuam
separados. Edição cadastral preserva as projeções de Usuários.

OpenAPI recebeu somente descrições dos três comandos. Schemas ainda reconhecem
campos proibidos e `null` na criação para preservar `422` semântico; estrutura/
tipo inválido segue `400`. `area_total_decimal` continua `readOnly` na resposta
e desconhecido na escrita. Sem transferência de Titularidade, mudança de SQL,
migration, serviço MP-35C ou RBAC. Teste HTTP explícito cobre essa distinção.

Suíte própria e resultados em [testes de contrato](testes-contrato-api-rbac.md).
Seletores ficaram fora daquele corte; a etapa interna seguinte está descrita
acima. Vínculos e transferência continuam fora; o corte visual atual está descrito no início.
Android físico não executado; CI remota não consultada; integração final na
`backend` é posterior. A aprovação independente cobre somente este corte HTTP
interno e F1; não conclui toda a D-4 nem libera release ou produção.

### Leitura decimal administrativa — pré-requisito da MP-35D-4

Em 2026-09-11, o worktree da `feat/mp-35d`, sobre `92bba62`, implementa somente
o alinhamento aditivo de `GET /v1/propriedades` e `GET /v1/propriedades/:id`:

| Campo de resposta | Tipo | Uso |
|---|---|---|
| `area_total` | `number` ou `null` | representação operacional existente, preservada por compatibilidade |
| `area_total_decimal` | `string` ou `null` | representação textual autoritativa administrativa, obrigatória nas novas respostas e somente de leitura |

Ambos vêm da única coluna `propriedades.area_total`, `numeric(14,4)`.
`area_total::text` evita o parser numérico do driver; o repositório valida o
texto positivo de até dez dígitos inteiros e quatro fracionários e remove
somente zeros fracionários finais. Exemplos: `1.2300` → `1.23`, `1.0000` → `1`,
`0.0001` e `9999999999.9999` preservados. Ausência produz `null` nos dois campos.
Somente o campo legado é convertido para número, depois da canonicalização.

O decoder operacional continua aceitando também a resposta anterior sem o
novo campo. O administrativo exige o texto e valida sua nulabilidade junto à
área legada; texto ausente/inválido falha com `InvalidBackendResponseError`,
sem baseline reconstruído do número. Não há trim, arredondamento, formatação
visual ou fallback para Demo. O schema de resposta/OpenAPI anuncia o campo
como `readOnly` e compartilha a mesma definição em lista e detalhe.

POST/PATCH continuam recebendo somente `area_total` textual: criação aceita
omissão e rejeita `null` com `422`; PATCH omitido preserva e `null` limpa.
`area_total_decimal` na escrita é campo desconhecido, rejeitado com `400`,
mesmo junto de `area_total`. Naquele corte, schemas de escrita e classificação
estrutural/semântica foram preservados; a revisão documental dos três comandos
foi realizada na integração HTTP de 2026-09-14 descrita acima.

A D-3 está concluída, auditada e enviada. Este pré-requisito recebeu o parecer
**APROVADO PARA COMMIT DO PRÉ-REQUISITO DECIMAL DA MP-35D-4**, sem achado
obrigatório ou evidência crítica pendente, cobrindo HEAD + worktree + snapshot.
A compatibilidade do leitor anterior foi comprovada e o pré-requisito foi fechado
e enviado em `dab3ac4`. Naquela etapa, o corte não incluía
formulários, comandos mobile de Propriedade,
seletores de Titular/Localidades, novos fluxos de navegação, migration ou RBAC.

### Estado da integração no aplicativo

Os cortes MP-35D-1 e MP-35D-2 foram concluídos na branch
`feat/mp-35d`, respectivamente nos commits `3e2bc2e` e `cf3b4fa`. O corte
MP-35D-3, registrado no commit `a92d6d6`, implementa somente os quatro
comandos administrativos de Usuário: criação de Produtor/Colaborador, edição
cadastral, transição explícita
`ativo`/`inativo` e emissão ou reemissão de convite no modo fixo
`ativar_usuario`.

A composição HTTP reutiliza o coordenador idempotente D-1 e a fronteira de
dados D-2. Todo recibo válido é seguido por releitura de detalhe, que atualiza
coordenadamente lista e detalhe e invalida respostas anteriores. Rascunhos e
intenções permanecem apenas em memória e são limpos com a partição da sessão.
O corte não cria Admin, senha, exclusão, edição de perfil, vínculos,
Propriedades, Localidades, fila offline ou dependência do Demo/mock.

A primeira auditoria independente desta sequência da MP-35D-3 resultou em **CORREÇÕES
OBRIGATÓRIAS**: conflito pendente descartado em rebase consecutivo e falha de
releitura após recibo ocultada por carregamento indefinido. As correções focais
preservam conflitos até escolha explícita, atualizam campos intocados e mantêm
Salvar bloqueado enquanto houver conflito. Edição, status e convite exibem a
falha após comando confirmado e permitem recuperar somente o GET autoritativo,
sem repetir a mutação. A conclusão exige o mesmo `recurso_id` e
`versao_relida >= versao_recibo`, com autorização e lifecycle revalidados.

Estado ao término daquela correção: **CORREÇÕES IMPLEMENTADAS — AGUARDANDO REAUDITORIA
INDEPENDENTE**. A validação da correção é automatizada e não constitui
aprovação independente, fechamento da D-3, teste Android físico, build de
release, integração ou autorização para iniciar a MP-35D-4. As regressões
permanentes estão descritas em [testes de contrato](testes-contrato-api-rbac.md).

Na reauditoria posterior, os defeitos de rebase consecutivo e recuperação
somente por GET passaram, assim como correlação de recibo, bloqueio de callback
após confirmação e conclusão/navegação únicas. O novo bloqueador P2 foi a
permanência de `forbidden` após revalidação aceita do Admin na mesma partição.
A correção focal distingue acesso compartilhado de validade da operação:
`SessionCoordinator` notifica a aceitação validada de `/v1/auth/me`, e a
fronteira usa um lease capturado antes da requisição para restaurar o acesso
somente na geração/partição atuais. Respostas obsoletas não restauram acesso;
revalidação rotineira não limpa drafts ou cancela comandos válidos.

Lifecycles afetados por perda de acesso permanecem cancelados, inclusive depois
da retomada e de `start`/remontagem. Um 403 tardio não pode usar lease novo para
invalidar a operação atual. Novos fluxos autorizados podem executar comandos e
leituras; o fluxo bloqueado exibe feedback no padrão existente. Isso não altera
contratos backend, idempotência, recibos ou D1-D13.

A reauditoria seguinte aprovou a retomada sequencial, com e sem GET incidental,
validada na rodada anterior com 86 testes D-3. Identificou dois achados
obrigatórios adicionais, reproduzidos e corrigidos nesta rodada:

- Concorrência de `/me`: A iniciada antes do `403` substituía o objeto de
  snapshot, descartando B iniciada após a invalidação por igualdade referencial.
  A regra local passa a ser a ordem de início das revalidações: só a mais recente
  iniciada pode publicar e notificar aceitação. Epoch, identidade ativa e token
  da tentativa efetiva, incluindo refresh/retry, continuam necessários; rotação
  posterior torna a resposta obsoleta. A ordem de chegada não define prioridade.
  B aplica Admin, Produtor ou Colaborador nas duas ordens de entrega. Retomar
  administração ainda exige Admin autorizado e lease da fronteira atual; nova
  invalidação após a captura de B bloqueia a retomada. Não há terceiro `/me`
  automático nem dependência de GET incidental.
- Cancelar antigo: o callback preexistente podia executar `goBack` depois do
  descarte e perder o draft de nova criação. A navegação de saída exige a
  instância montada e sua chave como rota atual, independentemente da guarda de
  mutações. A proteção cobre também Voltar, reproduzido nas quatro telas do
  mesmo componente, inclusive quando a rota de origem ainda está montada sob
  outra criação. Cancelar atual continua válido após confirmação do comando.

Estado ao término daquela implementação: **CORREÇÕES DE CONCORRÊNCIA /me E CALLBACK CANCELAR IMPLEMENTADAS —
AGUARDANDO REAUDITORIA INDEPENDENTE**. A implementação e os 106 testes D-3 não
constituem aprovação independente ou fechamento formal da D-3. D-4 permanece
não iniciada; não houve smoke Android físico, release ou liberação produtiva.

O parecer independente final posterior emitiu **APROVADA PARA COMMIT DO
MP-35D-3**, cobrindo HEAD + worktree e todas as correções anteriores, preservadas
e verificadas, sem achado obrigatório remanescente ou evidência crítica pendente.
As [validações do auditor](testes-contrato-api-rbac.md) passaram. O registro desta
aprovação não alterava contratos. Naquele momento, D-4 não estava iniciada e a
integração final na `backend` era posterior. Produção e release não estão liberados;
não houve smoke Android físico, build de release ou validação produtiva.

A correção integrada em `7c5256e` faz o recibo de convite identificar o Usuário
alvo e informar sua versão, permitindo a correlação sem inferência exigida pela
D-3. O decoder e o fluxo móvel já exigem exatamente esse contrato e continuam
falhando fechados diante de formato legado ou incompatível. Esta validação não
altera novamente o backend.

A MP-35A não cria handlers, serviços ou grants de escrita do runtime para os
comandos das fases seguintes. MP-36 e as verticais posteriores permanecem fora.

## Decisões D1-D13

### D1 — criação de Usuários

Somente Administrador ativo cria Admin, Produtor ou Colaborador. A conta nasce
`pendente`, sem senha, e recebe convite. O convite habilita a conta depois da
definição válida de credencial. Administrador é global dentro da organização;
MFA continua portão produtivo.

### D2 — estado do Produtor e Titularidade

Aceitar convite novo ativa `usuarios` e, para perfil Produtor, também
`produtores`. O estado de Produtor representa habilitação cadastral e não a
quantidade de Propriedades acessíveis. Zero acesso efetivo é válido.

Toda Propriedade possui `titular_id` não nulo. Propriedade inativa pode apontar
para cadastro cujo Usuário esteja pendente/inativo e cujo Produtor esteja
inativo; Propriedade ativa exige Usuário e Produtor Titular ativos. Somente
Admin escolhe o Titular inicial. Transferência de
Titularidade não pertence à MP-35.

### D3 — acesso do Colaborador

Aceitar o convite ativa o Colaborador mesmo com zero vínculos. O acesso a uma
Propriedade resulta da combinação:

```text
Usuário ativo
+ perfil Colaborador
+ vínculo direto ativo
+ Propriedade ativa
= acesso efetivo
```

Município e UF nunca concedem acesso.

### D4 — credencial e ativação

Convite novo conclui credencial e ativação atomicamente. O modo persistido novo
é `ativar_usuario`. Os modos históricos `manter_status` e
`ativar_admin_bootstrap` permanecem consumíveis e não são reescritos;
`manter_status` preserva o Usuário pendente e não pode ser emitido por fluxo
novo. Ativação
administrativa posterior serve somente para reativação ou compatibilidade e
nunca pode deixar Usuário ativo sem credencial ativa.

### D5 — alteração de vínculos

Vínculos mudam por delta versionado (`adicionar[]` e `remover[]`), nunca pela
substituição cega da lista completa. Cada comando informa a versão esperada e
aceita no máximo 100 identificadores somando o delta.

### D6 — remoção do último acesso

É permitido remover o último acesso efetivo. O Usuário permanece ativo, pode
autenticar e recebe coleção vazia. Nenhuma remoção de vínculo inativa a conta
automaticamente.

### D7 — proteção administrativa

Auto-inativação de Admin é proibida. Depois de concluído o bootstrap, a
organização preserva transacionalmente ao menos um Administrador ativo, inclusive
sob concorrência. A validação ocorre também no preflight do upgrade, e escritas
de conclusão do bootstrap usam o mesmo lock singleton das mutações de Usuário.

### D8 — localização IBGE

O backend usa snapshot nacional, local e versionado da API de Localidades do
IBGE. A versão inicial contém 27 UFs e 5.571 Municípios, capturados em
2026-08-25. No contrato externo de escrita, o cliente envia somente
`municipio_id`; o backend valida o Município na versão ativa e deriva `uf_id`,
`municipio_nome` e `uf_sigla`. Esses campos derivados não são entradas
autoritativas. Internamente, `municipio_id` e `uf_id` permanecem persistidos e
referencialmente coerentes. Uma versão publicada e suas linhas são imutáveis;
somente seu estado pode avançar de `ativo` para `substituido`. Não há consulta
externa em runtime.

### D9 — limites

| Campo | Limite |
|---|---:|
| Nome de Usuário, Produtor ou Propriedade | 200 caracteres |
| E-mail | 254 caracteres |
| Telefone | 32 caracteres |
| Documento | 64 caracteres |
| Observações | 2.000 caracteres |
| Cultura principal | 120 caracteres |
| Detalhe de motivo | 300 caracteres |
| IDs por delta de vínculos | 100 |

Os limites textuais contam pontos de código Unicode depois de normalização NFC.
HTTP e domínio normalizam antes da persistência; PostgreSQL usa `char_length`
sobre o valor canônico, e o cursor conserva exatamente a chave calculada pelo
SQL. Unidades UTF-16 não são a métrica do contrato.

### D10 — motivos administrativos

O catálogo único é `fim_relacao`, `mudanca_responsabilidade`,
`cadastro_duplicado`, `correcao_administrativa`, `suspensao_operacional` e
`outro`. `outro` exige detalhe; nos demais códigos o detalhe é opcional. O texto
legado de inativação de vínculo é preservado e projetado para o catálogo, sem
perda do valor original.

### D11 — idempotência

Comandos administrativos mutáveis exigirão chave idempotente. A chave é
armazenada somente como SHA-256, no escopo de organização e ator, por 90 dias.
Mesma chave e mesmo corpo devolvem o mesmo recibo; mesma chave com hash de corpo
diferente retorna `409`. A purga usa papel separado e remove somente registros
expirados. Cada reserva registra `sessao_id`, `request_id` e `correlation_id`;
uma referência composta garante que a sessão pertence ao mesmo ator e à mesma
organização. O recibo aceita somente resultado, tipo/ID do recurso e a versão
obrigatória para recursos versionados. Desde a migration `000010`, o recibo
administrativo de convite identifica o Usuário da rota e inclui sua versão
autoritativa. Não entram PII, senha, token ou payload arbitrário.

A unicidade persistente é exclusivamente organização + ator + hash da
`Idempotency-Key`. `actorSessionId` é obrigatório, deve estar ativo e vinculado
ao mesmo ator/organização e é auditado, mas não participa da unicidade. Assim,
outra sessão válida do mesmo ator recebe o replay exato sem novo efeito,
auditoria, versão ou revogação; outro ator possui escopo idempotente distinto.

### D12 — notificações

A MP-35 não cria eventos de notificação. Auditoria e revogação de sessão cobrem
as consequências necessárias.

### D13 — sessões

No MVP, qualquer alteração que mude autorização revoga as sessões dos Usuários
diretamente afetados, inclusive ampliações. É uma simplificação temporária:
evolução futura pode preservar sessão quando o acesso apenas aumentar. Mudanças
exclusivamente cadastrais, como nome, telefone, observações ou cultura, mantêm
a sessão.

## Contratos persistentes da MP-35A

- `usuarios`, `produtores`, `propriedades` e `usuario_propriedade` possuem
  versão positiva para concorrência otimista, incrementada exatamente uma vez
  em cada `UPDATE`; saltos, regressões e incrementos duplicados são rejeitados;
- a habilitação de `produtores.status` acompanha `usuarios.status`: Produtor só
  está ativo quando o Usuário correspondente está ativo;
- Propriedade ativa exige Titular habilitado;
- o último Admin ativo é protegido depois do bootstrap;
- ativar um Usuário por `UPDATE` exige credencial ativa no estado final da
  mesma transação, inclusive quando a escrita usa o papel runtime;
- o runtime ativa o cadastro de Produtor durante o aceite somente por função
  `SECURITY DEFINER` estreita, derivada do convite válido; o papel não recebe
  `UPDATE` em `produtores`;
- convite administrativo novo exige emissor Administrador ativo;
- `motivos_administrativos` persiste o catálogo D10;
- `comandos_administrativos_idempotencia` reserva e conclui recibos por 90 dias;
- a reserva usa referência composta para impedir que um ator associe comando à
  sessão de outro Usuário ou organização;
- `catalogo_localidades_ibge_versoes`, `ufs_ibge` e `municipios_ibge` persistem
  a fonte nacional versionada;
- `propriedades.localidades_versao_id`, `municipio_id` e `uf_id` formam a
  referência oficial, e nome/sigla são derivados;
- o modo `ativar_usuario` é acrescentado aos convites sem remover os modos
  históricos.

O backfill de motivos converte apenas os campos novos: `criado_em`,
`atualizado_em` e os demais metadados históricos permanecem inalterados.

Migrations antigas são imutáveis. Dados incompatíveis fazem a nova migration
falhar antes de qualquer correção silenciosa.

O `down` da fundação é validado em banco efêmero sem registros novos exclusivos
do modo `ativar_usuario`. Como o fluxo de convite já existente passa a emitir
esse modo, qualquer ambiente que o tenha consumido deve tratar o downgrade como
incompatível: o esquema anterior não representa fielmente o histórico e a
operação deve falhar com segurança em vez de reescrever ou apagar convites.

## Contratos HTTP implementados nas MP-35B e MP-35C

### Correção integrada do recibo de convite — 2026-09-08

A divergência identificada durante a MP-35D-3 foi corrigida na `backend` pelo
commit `7c5256e` e incorporada à `feat/mp-35d` pelo merge `963eb0f`, sem
alterar o aplicativo, iniciar MP-35D-4 ou reabrir D1-D13. A migration `000010`
substitui somente `tche_admin_emitir_convite_usuario_mp35b(jsonb)` e a
constraint do recibo. A rota permanece `201` e responde exatamente:

```json
{
  "resultado": "convite_emitido",
  "recurso_tipo": "usuario",
  "recurso_id": "00000000-0000-4000-8000-000000000001",
  "versao": 2
}
```

O ID é o Usuário da rota, e a versão é lida ao final dos efeitos, sob lock,
sem incremento artificial. A auditoria dessa operação também referencia o
Usuário. Convite, desafio, token e outbox continuam internos. O repositório
valida o recibo e sua correlação com o alvo antes do COMMIT; serviço e schema
HTTP exigem o mesmo contrato. As outras rotas MP-35B/C e o aceite `204` ficam
preservados.

Recibos antigos guardavam o ID do convite, sem a versão histórica do Usuário;
nem o hash do pedido nem o estado atual permitem recuperá-la sem ambiguidade.
O preflight bloqueia atomicamente se houver qualquer comando de emissão
retido, inclusive expirado ainda não purgado. Isso cobre os 90 dias e a
consulta atual de replay. O down restaura explicitamente função e constraint
anteriores, sob a mesma restrição para recibos novos. Nenhum comando é
reescrito, excluído ou exposto em dois formatos. O
[procedimento operacional](../../backend/README.md) não autoriza purga
antecipada. O fix backend está integrado e incorporado à feature nos commits
acima. As correções focais do aplicativo MP-35D-3 foram aprovadas na auditoria
independente final para commit. A integração final da MP-35D na `backend`
permanece posterior; o fix de recibo já está integrado.

### Precisões de execução da MP-35B

- mutações de Usuário respondem com recibo seguro composto somente por
  `resultado`, `recurso_tipo`, `recurso_id` e, quando aplicável, `versao`;
  a repetição idempotente devolve exatamente o mesmo status e recibo, sem
  persistir PII ou reconstruir uma representação possivelmente mais nova;
- a projeção administrativa de Usuário expõe `produtor_id` somente quando o
  perfil for Produtor. Esse ID canônico permite que a MP-35C selecione o
  `titular_id` sem confundir Usuário e Produtor;
- a edição administrativa do e-mail principal é aceita somente para Usuário
  `pendente`. A mesma transação revoga convite, desafio e outbox anteriores e
  emite substituto para o novo endereço. Usuários ativos ou inativos usam os
  fluxos verificados de conta/recuperação da MP-33B;
- `PATCH /v1/usuarios/:id/status` opera somente `ativo <-> inativo`.
  `pendente` pertence exclusivamente à criação e ao aceite do convite e, como
  destino dessa rota, retorna `422 validation_error`, nunca conflito `409`;
- a emissão administrativa canônica passa a ser
  `POST /v1/usuarios/:id/convites`. A antiga emissão em
  `POST /v1/auth/invitations` é removida para não conservar uma escrita
  paralela sem a idempotência D11. O aceite público continua exclusivamente
  em `POST /v1/auth/invitations/accept` e preserva `204 No Content`;
- a resposta de leitura usa `snake_case`; lista e detalhe não incluem senha,
  credencial, token, hash, desafio, payload da outbox ou aliases do mock.
- o runtime não possui `INSERT`, `UPDATE` ou `DELETE` administrativo direto em
  `usuarios`, `produtores` ou na tabela de idempotência. As quatro mutações
  usam funções transacionais estreitas, owned por papel seguro `NOLOGIN`, com
  `EXECUTE` removido de `PUBLIC` e concedido somente ao papel operacional;
- criação de Admin fica fechada na composição de produção enquanto o portão de
  MFA não estiver implementado. Testes e ambientes não produtivos podem criar
  Admin pendente para validar D1, sem converter isso em autorização produtiva;
- lista usa cursor AES-256-GCM versionado, confidencial, autenticado, expirável
  e vinculado ao fingerprint canônico de `busca`, `perfil` e `status`. A chave
  de ordenação vem diretamente de `lower(nome)` no PostgreSQL. O keyring
  dedicado `ADMIN_USER_CURSOR_*` é obrigatório no startup, não possui fallback
  e não pode reutilizar material criptográfico da outbox;

| Método e rota | Fase | Ação | RBAC |
|---|---|---|---|
| `GET /v1/usuarios` | B | listar com cursor e filtros | somente Admin |
| `POST /v1/usuarios` | B | criar pendente e emitir convite | somente Admin |
| `GET /v1/usuarios/:id` | B | detalhar cadastro | somente Admin |
| `PATCH /v1/usuarios/:id` | B | alterar dados cadastrais versionados | somente Admin |
| `PATCH /v1/usuarios/:id/status` | B | ativar/inativar com motivo | somente Admin |
| `POST /v1/usuarios/:id/convites` | B | emitir/reemitir convite | somente Admin |
| `GET /v1/usuarios/:id/propriedades` | C | listar vínculos diretos | somente Admin |
| `PATCH /v1/usuarios/:id/propriedades` | C | aplicar delta versionado | somente Admin |
| `POST /v1/propriedades` | C | criar com Titular inicial | somente Admin |
| `PATCH /v1/propriedades/:id` | C | alterar cadastro, sem transferir Titular | somente Admin |
| `PATCH /v1/propriedades/:id/status` | C | ativar/inativar com motivo | somente Admin |
| `GET /v1/localidades/ufs` | C | listar UFs do snapshot ativo | Admin autenticado |
| `GET /v1/localidades/municipios` | C | listar Municípios por UF e cursor | Admin autenticado |

Produtor não administra estrutura geral. Colaborador não cria Usuário, não
altera vínculos e não define Titular. O acesso operacional já existente em
`GET /v1/propriedades` continua filtrado dentro da consulta.

## Concorrência, erros e privacidade

- mutações versionadas com versão divergente retornam
  `409 version_conflict`;
- chave idempotente reutilizada com outro corpo retorna
  `409 idempotency_conflict`;
- regra de negócio retorna `409 business_rule_conflict`;
- JSON malformado ou estrutura inválida retorna `400 invalid_request`; valor,
  enum ou limite D9 semanticamente inválido retorna `422 validation_error`;
- recurso administrativo inexistente retorna `404 not_found`; sessão ausente,
  revogada, expirada ou stale retorna `401 invalid_session`; perfil ativo sem
  permissão retorna `403 forbidden`;
- listas usam cursor confidencial e autenticado por nome/ID, nunca offset como
  contrato público; valor vazio, acima do limite formal, truncado, malformado,
  adulterado, expirado, com chave/versão desconhecida ou trocado entre filtros
  falha com `400 invalid_request`;
- todas as mutações administrativas usam `Idempotency-Key`; comandos
  versionados também exigem a versão-base;
- e-mail, telefone, documento, detalhe de motivo e conteúdo do comando não são
  copiados para logs nem para a chave idempotente;
- auditoria registra ator, sessão, recurso, resultado, motivo, correlação e
  Usuários afetados sem armazenar segredo ou token.
- cada item de delta registra exatamente um evento interno `criado`,
  `reativado` ou `inativado`, com estado anterior/posterior, tipo derivado,
  motivo D10/detalhe permitido e horário do PostgreSQL; rollback e replay não
  deixam eventos adicionais;
- lista de Usuários usa cursor opaco estável por nome normalizado e ID, com
  limite padrão 50 e máximo 100; `busca` compara literalmente nome, e-mail ou
  documento depois do escopo Admin e nunca concede autorização. A busca infixa
  com `ILIKE` exige benchmark no volume produtivo esperado antes da liberação;
- o corpo HTTP de alteração de status usa `motivo` como código D10 e
  `motivo_detalhe` opcional; `outro` exige detalhe;
- `POST /v1/usuarios/:id/convites` recebe somente
  `modo_ativacao=ativar_usuario`; modo histórico bem formado é erro semântico
  `422` e campo desconhecido é erro estrutural `400`;
- a reserva idempotente, o efeito, a auditoria e o recibo pertencem à mesma
  transação. Falha anterior ao commit não conserva linha `processando`;
- o worker obtém o horário corrente do PostgreSQL depois dos locks coordenados
  e revalida mensagem, lease, desafio e convite imediatamente antes do envio.
  O SMTP ocorre com transação e lock abertos; capacidade e latência sob carga
  representativa são portão produtivo explícito.

## Critérios de aceite por fase

MP-35A termina somente com migrations anteriores imutáveis, `up/down/redo`
válidos, snapshot com 27 UFs/5.571 Municípios, constraints e contratos
automatizados, preflight/concorrência/privilégios exercitados em PostgreSQL com
duas conexões e barreira explícita, documentação coerente e nenhuma rota
administrativa nova.

MP-35B termina somente com E2E das seis rotas usando bearer, autenticação e
login runtime real, incluindo matriz 6 x 5 para Admin, ausência de autenticação,
sessão stale, Produtor e Colaborador; DML adversarial negado; criação dos três
perfis; erros HTTP exatos; paginação acima de 100; as sete corridas da
reauditoria observadas em `pg_stat_activity`/`wait_event` com duas conexões;
outbox em voo linearizável, inclusive expiração enquanto espera pelo lock;
compatibilidade dos fluxos de conta; OpenAPI e documentação validados.
Isolamento entre organizações é não aplicável ao modelo singleton atual e não
justifica inventar uma segunda organização.

## Portões operacionais anteriores à produção

A fundação fornece a função one-shot, idempotente e em lotes:

```sql
SELECT public.tche_purgar_comandos_administrativos_mp35a(1000);
```

Ela aceita limite entre 1 e 5.000, usa 1.000 quando o argumento é omitido e
rejeita `NULL` explícito ou valor fora do intervalo com SQLSTATE `22023`, antes
de qualquer remoção. Remove somente reservas já expiradas e deve ser executada
por conta `LOGIN` exclusiva, membro apenas de
`tche_agro_administration_maintenance`. O papel não possui `SELECT` ou `DELETE`
direto na tabela. Continuam como portões produtivos:

- provisionar/rotacionar a credencial exclusiva e definir responsável,
  frequência, timeout, alertas, métricas, repetição e revisão de privacidade;
- ensaiar `000006` e `000007` em cópia representativa e anonimizada do volume
  produtivo, com `lock_timeout` compatível com a janela aprovada, monitorando
  duração, espera por lock, transações abortadas e espaço temporário;
- aceitar o ensaio somente se a migration for atômica, não exceder a janela de
  manutenção aprovada, não deixar lock após rollback e preservar contagens e
  timestamps amostrados antes/depois;
- executar no ambiente de ensaio `npm run migrations:verify` e
  `npm run migrate:up`, registrar tempos pelo orquestrador e consultar
  `pg_stat_activity`/`pg_locks` durante a execução. Testcontainers locais são
  evidência funcional, não representam o volume nem a contenção produtivos;
- provisionar e rotacionar o keyring dedicado de cursor sem compartilhar chave
  com a outbox, medir a busca infixa `ILIKE` no volume esperado e ensaiar a
  capacidade/latência do SMTP com a transação e o lock do worker abertos.

A MP-35C acrescenta a migration append-only `000009`, quatro operações
transacionais estreitas, as sete rotas Admin-only, cursores exclusivos,
Localidades versionadas, RBAC, auditoria, revogação de sessões, idempotência e
testes HTTP/PostgreSQL para Propriedades e vínculos. Ela foi concluída e
integrada diretamente em `e6789bf`, com CI pós-push, auditoria independente e
confirmação pós-integração aprovadas. Na MP-35D, os cortes D-1/D-2 estão
concluídos na `feat/mp-35d`; D-3 foi fechada em `92bba62` e o pré-requisito
decimal em `dab3ac4`. A integração HTTP administrativa de Propriedades está
aprovada independentemente, com F1 encerrado, e fechada em `27df733`;
Titular/Localidades fechados em `37a8790` após A1. D-4 concluída no escopo
funcional validado em `fea8ec3`, com aceite residual temporário de 23/09, nos
limites descritos no início. MP-35D segue em andamento; integração e release
não autorizados por esse fechamento.

- as quatro operações estreitas validam o tipo JSON original, presença,
  nulabilidade e formato de cada entrada antes de contexto, reserva de
  idempotência, locks ou qualquer efeito; coerções por `->>` não constituem
  validação de fronteira;
- a classificação HTTP é específica por rota: `titular_id` é válido na criação,
  `status` inicial é válido no POST e a alteração posterior somente na rota
  de status; `tipo_vinculo` é derivado. Erro
  estrutural prevalece como `400`; campo semanticamente proibido, quando a
  estrutura é válida, retorna `422`;
- o `versao` recebido nas mutações versionadas é somente a precondição de
  concorrência otimista. No `PATCH` cadastral de Propriedade ele nunca é
  atribuído como dado; `titular_id`, `status`, timestamps e campos territoriais
  derivados são recusados como campos do patch;
- o cursor de vínculos é AES-256-GCM, confidencial, autenticado e vinculado ao
  `usuario_id` e aos filtros. O cursor de Municípios autentica a versão imutável
  escolhida na primeira página e é vinculado a `uf_id` e `busca`;
- `ADMIN_LINK_CURSOR_*` e `ADMIN_MUNICIPALITY_CURSOR_*` são keyrings exclusivos
  e materialmente distintos entre si, de `ADMIN_USER_CURSOR_*` e da outbox;
- todas as respostas das sete rotas usam `snake_case` e
  `Cache-Control: no-store`.
- UUID administrativo canônico é UUID v4 hifenizado, minúsculo e com variante
  RFC (`8`, `9`, `a` ou `b`). O inventário de migrations, fixtures, seeds e
  contratos ativos confirmou compatibilidade; forma malformada é estrutural
  `400`, enquanto versão ou variante inválida em forma UUID é semântica `422`;
- nas mutações, `area_total` é decimal exato em string de formato simples, sem
  expoente, sinal, whitespace ou zero à esquerda. Deve ser maior que zero, ter
  até dez dígitos inteiros, no máximo quatro casas e máximo
  `9999999999.9999`. A correspondência cobre o lexema inteiro com fim absoluto,
  sem depender de `$`: LF, CR, CRLF, U+2028, U+2029, tab, espaço ou qualquer
  caractere adicional são recusados antes da canonicalização. Não há `trim`
  nem limpeza de whitespace. Somente depois dessa validação o backend remove
  zeros fracionários finais e envia o valor ao PostgreSQL, sem `Number`,
  aproximação ou arredondamento. Número JSON e tipos estruturais incompatíveis
  retornam `400`; string decimal fora do domínio, inclusive com terminador
  escapado em JSON válido, retorna `422`; JSON com LF bruto dentro da string é
  malformado e retorna `400`; `null` existe somente como limpeza no PATCH;
- o executor transacional único das quatro mutações executa `BEGIN`, chama a
  função SQL, valida cardinalidade, linha, resultado, HTTP e recibo completo e
  coerente, e somente então executa `COMMIT`. Qualquer resposta inesperada
  produz `ROLLBACK`, `503 service_unavailable` e nenhum efeito persistido;
- Testcontainers expõe apenas a porta interna `5432` e usa a porta dinâmica
  atribuída pelo Docker após o `start`, com banco e role únicos por processo.
  Não há reserva manual de porta, mutex em arquivo nem recuperação
  `stat`/`unlink`;
- TypeScript, MP-35B e MP-35C compartilham a política sensível
  `senha`, `password`, `token`, `documento`, `cpf`, `cnpj`, `segredo`,
  `credential`, `authorization` e `cookie`; a igualdade exata das
  representações TS/SQL é teste de integração;
- somente `SQLSTATE 22023` identificado por
  `ck_mp35c_input_validation` é traduzido localmente para
  `422 validation_error`. Qualquer erro PostgreSQL não allowlisted permanece
  fail-closed como `503 service_unavailable`;
- a corrida Titular × ativação possui dois ordenamentos válidos e testados com
  dois PIDs reais. Se a ativação obtiver os locks primeiro, ela conclui e a
  inativação retorna `active_holder_conflict`; se a inativação obtiver primeiro,
  ela conclui e a ativação retorna `invalid_holder`. Cada caso exige um único
  efeito concluído, sem reserva `processando`, sem deadlock e com versões,
  auditoria e revogação coerentes.

## Fora de escopo

- transferência de Titularidade;
- administração estrutural por Produtor ou Colaborador;
- autorização por Município/UF;
- notificações novas;
- endpoints de MP-36 ou posteriores;
- deploy, release, tag, publicação, infraestrutura produtiva e ativação de
  serviços externos.
