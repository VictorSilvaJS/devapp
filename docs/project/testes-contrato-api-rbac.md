# Testes De Contrato/API Para RBAC

Status revisado em 2026-09-11:
`MP-35A/B/C integradas; MP-35D-1/2 concluídas na feat/mp-35d; MP-35D-3
concluída, auditada e enviada em 92bba62; MP-35D em andamento;
pré-requisito decimal MP-35D-4 aprovado para commit na auditoria independente; D-4 em andamento`.
Este documento
define a matriz baseada em `contrato-api-rbac.md`, nas decisões consolidadas e
em D1-D13, distinguindo o corte já executável das linhas planejadas.

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
