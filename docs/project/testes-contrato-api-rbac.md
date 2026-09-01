# Testes De Contrato/API Para RBAC

Status revisado em 2026-08-31:
`MP-35A/B integradas; MP-35C corrigida localmente, não integrada e em validação
final; MP-35D não iniciada`. Este documento
define a matriz baseada em `contrato-api-rbac.md`, nas decisões consolidadas e
em D1-D13, distinguindo o corte já executável das linhas planejadas.

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
