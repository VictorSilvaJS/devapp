# Testes De Contrato/API Para RBAC

Status em 2026-06-03 (Fase 14H): este documento define uma matriz tecnica de
testes de contrato/API baseada em `contrato-api-rbac.md`. Ele nao implementa
backend, autenticacao real, RBAC, mocks, telas, rotas ou comportamento
funcional. O MVP atual continua mockado.

## Escopo Da Matriz

Esta matriz deve orientar testes automatizados futuros de API/backend quando a
frente real existir. Hoje ela e apenas documentacao tecnica.

Separacao obrigatoria:

- MVP atual: continua usando mock, `sub_regioes`, fallback
  `vinculos_microregioes` e `propriedades_atribuidas` apenas como vinculo
  visual/admin preparatorio.
- Backend futuro: deve validar permissao por acao e por Propriedade.
- Fora desta fase: implementar backend, autenticar de verdade, alterar mocks,
  converter `propriedades_atribuidas` em regra efetiva no MVP ou depender do
  frontend como fonte de seguranca.

## Estrategia Para `403` E `404`

- Usar `401 Unauthorized` quando nao houver usuario autenticado ou a sessao for
  invalida.
- Usar `403 Forbidden` quando o usuario autenticado pode saber que o recurso ou
  area existe, mas nao tem permissao para executar a acao.
- Usar `404 Not Found` quando o recurso nao existe ou quando revelar sua
  existencia criaria vazamento de escopo.
- Usar `400 Bad Request` para payload invalido.
- Usar `409 Conflict` para vinculo duplicado, conflito de regra ou estado
  incompativel.

## Classificacao Dos Testes

| Tipo | Destino |
|---|---|
| Automatizado backend/API | Deve virar teste de contrato, dominio ou integracao quando houver backend |
| Smoke/manual | Pode virar checklist de documentacao ou validacao manual de fluxo |
| Fora do MVP mockado | Nao deve ser executado como exigencia funcional no app atual |

## Autenticacao E Sessao

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-AUTH-01 | Login valido | Admin | Usuario ativo com credenciais validas | `POST /auth/login` | `{ "email": "...", "senha": "..." }` | `200 OK` | Usuario ativo pode iniciar sessao | Automatizado backend/API |
| API-RBAC-AUTH-02 | Login invalido | Nao autenticado | Credenciais incorretas | `POST /auth/login` | `{ "email": "...", "senha": "errada" }` | `401 Unauthorized` | Credenciais invalidas nao autenticam | Automatizado backend/API |
| API-RBAC-AUTH-03 | Usuario inativo tenta login | Usuario inativo | Credenciais validas, status inativo | `POST /auth/login` | `{ "email": "...", "senha": "..." }` | `403 Forbidden` | Usuario inativo nao acessa area protegida | Automatizado backend/API |
| API-RBAC-AUTH-04 | Usuario pendente tenta login | Usuario pendente | Credenciais validas, status pendente | `POST /auth/login` | `{ "email": "...", "senha": "..." }` | `403 Forbidden` | Usuario pendente nao acessa area protegida | Automatizado backend/API |
| API-RBAC-AUTH-05 | Consultar sessao valida | Colaborador | Sessao valida | `GET /auth/me` | Nao se aplica | `200 OK` | Sessao retorna usuario, perfil, status e escopo | Automatizado backend/API |
| API-RBAC-AUTH-06 | Consultar sessao sem token | Nao autenticado | Sem sessao | `GET /auth/me` | Nao se aplica | `401 Unauthorized` | Area protegida exige autenticacao | Automatizado backend/API |

## Usuarios

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-USR-01 | Admin lista usuarios | Admin | Admin ativo | `GET /usuarios` | Filtros opcionais | `200 OK` | Admin/papel autorizado gerencia usuarios | Automatizado backend/API |
| API-RBAC-USR-02 | Produtor tenta listar usuarios | Produtor | Produtor autenticado | `GET /usuarios` | Filtros opcionais | `403 Forbidden` | Produtor nao edita usuarios/vinculos | Automatizado backend/API |
| API-RBAC-USR-03 | Nao autenticado lista usuarios | Nao autenticado | Sem sessao | `GET /usuarios` | Filtros opcionais | `401 Unauthorized` | Autenticacao obrigatoria | Automatizado backend/API |
| API-RBAC-USR-04 | Admin abre detalhe de usuario | Admin | Usuario existe | `GET /usuarios/:id` | Nao se aplica | `200 OK` | Admin pode abrir detalhe administrativo | Automatizado backend/API |
| API-RBAC-USR-05 | Usuario inexistente | Admin | Id nao existe | `GET /usuarios/:id` | Nao se aplica | `404 Not Found` | Recurso inexistente retorna 404 | Automatizado backend/API |
| API-RBAC-USR-06 | Admin cria usuario valido | Admin | E-mail nao existe | `POST /usuarios` | `{ "nome": "...", "email": "...", "perfil": "produtor", "status": "pendente" }` | `201 Created` | Criacao administrativa permitida | Automatizado backend/API |
| API-RBAC-USR-07 | Criar usuario com payload invalido | Admin | Campo obrigatorio ausente | `POST /usuarios` | `{ "email": "invalido" }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |
| API-RBAC-USR-08 | Criar usuario com e-mail duplicado | Admin | E-mail ja cadastrado | `POST /usuarios` | `{ "nome": "...", "email": "...", "perfil": "produtor", "status": "ativo" }` | `409 Conflict` | Conflito de regra retorna 409 | Automatizado backend/API |
| API-RBAC-USR-09 | Admin atualiza usuario | Admin | Usuario existe | `PATCH /usuarios/:id` | Campos parciais permitidos | `200 OK` | Admin/papel autorizado atualiza usuario | Automatizado backend/API |
| API-RBAC-USR-10 | Colaborador atualiza usuario sem permissao | Colaborador | Sem papel administrativo | `PATCH /usuarios/:id` | Campos parciais | `403 Forbidden` | Colaborador nao edita usuarios por padrao | Automatizado backend/API |
| API-RBAC-USR-11 | Admin altera status | Admin | Usuario existe e regra permite | `PATCH /usuarios/:id/status` | `{ "status": "inativo" }` | `200 OK` | Status e controlado por admin | Automatizado backend/API |
| API-RBAC-USR-12 | Alterar status com regra conflitante | Admin | Mudanca viola vinculo obrigatorio | `PATCH /usuarios/:id/status` | `{ "status": "ativo" }` | `409 Conflict` | Conflito de regra retorna 409 | Automatizado backend/API |

## Propriedades

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-PROP-01 | Admin lista Propriedades | Admin | Admin ativo | `GET /propriedades` | Filtros opcionais | `200 OK` | Admin tem acesso global | Automatizado backend/API |
| API-RBAC-PROP-02 | Produtor lista vinculadas | Produtor | `usuario_propriedade` ativo ou titularidade | `GET /propriedades` | Filtros opcionais | `200 OK` | Produtor acessa Propriedades vinculadas | Automatizado backend/API |
| API-RBAC-PROP-03 | Colaborador lista por microregiao | Colaborador | `usuario_microregiao` ativo | `GET /propriedades` | Filtros opcionais | `200 OK` | Colaborador acessa por microregiao | Automatizado backend/API |
| API-RBAC-PROP-04 | Colaborador lista por atribuicao direta | Colaborador | `usuario_propriedade` ativo | `GET /propriedades` | Filtros opcionais | `200 OK` | Propriedade atribuida e regra aditiva futura | Automatizado backend/API |
| API-RBAC-PROP-05 | Colaborador acessa fora da microregiao por atribuicao direta | Colaborador | Sem microregiao da Propriedade, com atribuicao direta ativa | `GET /propriedades/:id` | Nao se aplica | `200 OK` | Acesso direto amplia escopo | Automatizado backend/API |
| API-RBAC-PROP-06 | Produtor tenta abrir Propriedade de outro titular | Produtor | Sem vinculo ativo | `GET /propriedades/:id` | Nao se aplica | `403 Forbidden` ou `404 Not Found` | Produtor nao acessa outro titular | Automatizado backend/API |
| API-RBAC-PROP-07 | Colaborador sem vinculo tenta abrir Propriedade | Colaborador | Sem microregiao e sem atribuicao direta | `GET /propriedades/:id` | Nao se aplica | `403 Forbidden` ou `404 Not Found` | Escopo aditivo exige ao menos um vinculo | Automatizado backend/API |
| API-RBAC-PROP-08 | Recurso inexistente | Admin | Id inexistente | `GET /propriedades/:id` | Nao se aplica | `404 Not Found` | Recurso inexistente retorna 404 | Automatizado backend/API |
| API-RBAC-PROP-09 | Admin cria Propriedade | Admin | Payload valido | `POST /propriedades` | `{ "nome": "...", "titular_id": "...", "microregiao_id": "...", "area_total": 120.5, "status": "ativa" }` | `201 Created` | Admin cria cadastro | Automatizado backend/API |
| API-RBAC-PROP-10 | Criar Propriedade com payload invalido | Admin | Campo obrigatorio ausente | `POST /propriedades` | `{ "nome": "..." }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |
| API-RBAC-PROP-11 | Conflito de titular/vinculo | Admin | Regra de titular conflita | `POST /propriedades` | Payload valido formalmente | `409 Conflict` | Conflito de regra retorna 409 | Automatizado backend/API |
| API-RBAC-PROP-12 | Admin edita Propriedade | Admin | Propriedade existe | `PATCH /propriedades/:id` | Campos parciais | `200 OK` | Admin edita cadastro | Automatizado backend/API |
| API-RBAC-PROP-13 | Colaborador edita cadastro sem permissao | Colaborador | Escopo valido, sem permissao de acao | `PATCH /propriedades/:id` | Campos parciais | `403 Forbidden` | Escopo nao implica editar cadastro | Automatizado backend/API |

## Vinculos

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-VINC-01 | Admin lista Propriedades vinculadas ao usuario | Admin | Usuario existe | `GET /usuarios/:id/propriedades` | Nao se aplica | `200 OK` | Admin consulta vinculos diretos | Automatizado backend/API |
| API-RBAC-VINC-02 | Produtor tenta listar vinculos de outro usuario | Produtor | Sem permissao administrativa | `GET /usuarios/:id/propriedades` | Nao se aplica | `403 Forbidden` ou `404 Not Found` | Vinculos nao devem vazar escopo | Automatizado backend/API |
| API-RBAC-VINC-03 | Admin grava vinculos de Propriedade | Admin | Payload valido | `PUT /usuarios/:id/propriedades` | `{ "propriedades": [{ "propriedade_id": "prop_1", "tipo_vinculo": "colaborador_atribuido", "status": "ativo" }] }` | `200 OK` | `usuario_propriedade` persistente e auditavel | Automatizado backend/API |
| API-RBAC-VINC-04 | Vinculo duplicado | Admin | Payload duplica vinculo ativo | `PUT /usuarios/:id/propriedades` | Lista com duplicidade | `409 Conflict` | Duplicidade retorna conflito | Automatizado backend/API |
| API-RBAC-VINC-05 | Payload invalido de vinculo | Admin | Falta `propriedade_id` | `PUT /usuarios/:id/propriedades` | `{ "propriedades": [{ "status": "ativo" }] }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |
| API-RBAC-VINC-06 | Admin lista microregioes do usuario | Admin | Usuario existe | `GET /usuarios/:id/microregioes` | Nao se aplica | `200 OK` | Admin consulta vinculos territoriais | Automatizado backend/API |
| API-RBAC-VINC-07 | Admin grava microregioes do usuario | Admin | Payload valido | `PUT /usuarios/:id/microregioes` | `{ "microregioes": [{ "microregiao_id": "mic_1", "status": "ativo" }] }` | `200 OK` | `usuario_microregiao` persistente e auditavel | Automatizado backend/API |
| API-RBAC-VINC-08 | Microregiao inexistente | Admin | `microregiao_id` nao existe | `PUT /usuarios/:id/microregioes` | Payload com id inexistente | `404 Not Found` ou `409 Conflict` | Nao criar vinculo para recurso invalido | Automatizado backend/API |
| API-RBAC-VINC-09 | Colaborador tenta alterar vinculos | Colaborador | Sem papel administrativo | `PUT /usuarios/:id/propriedades` | Payload valido | `403 Forbidden` | Colaborador nao administra vinculos por padrao | Automatizado backend/API |

## Permissao E Escopo

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-SCOPE-01 | Usuario lista seu escopo | Colaborador | Sessao valida | `GET /me/propriedades` | Filtros opcionais | `200 OK` | Escopo calculado no backend | Automatizado backend/API |
| API-RBAC-SCOPE-02 | Nao autenticado consulta escopo | Nao autenticado | Sem sessao | `GET /me/propriedades` | Filtros opcionais | `401 Unauthorized` | Autenticacao obrigatoria | Automatizado backend/API |
| API-RBAC-SCOPE-03 | Usuario recebe permissoes | Produtor | Sessao valida | `GET /me/permissoes` | Nao se aplica | `200 OK` | Usuario autenticado recebe capacidades | Automatizado backend/API |
| API-RBAC-SCOPE-04 | Permissao por Propriedade permitida | Colaborador | Propriedade por microregiao ou atribuicao direta | `GET /propriedades/:id/permissao` | Nao se aplica | `200 OK` | Backend valida por Propriedade | Automatizado backend/API |
| API-RBAC-SCOPE-05 | Permissao por Propriedade negada | Colaborador | Sem microregiao e sem atribuicao direta | `GET /propriedades/:id/permissao` | Nao se aplica | `404 Not Found` | Nao revelar recurso fora do escopo | Automatizado backend/API |
| API-RBAC-SCOPE-06 | Usuario inativo consulta permissoes | Usuario inativo | Sessao invalida ou bloqueada | `GET /me/permissoes` | Nao se aplica | `401 Unauthorized` ou `403 Forbidden` | Inativo nao acessa area protegida | Automatizado backend/API |

## Mapas E Anexos

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-MAPA-01 | Admin lista mapas | Admin | Propriedade existe | `GET /propriedades/:id/mapas` | Filtros opcionais | `200 OK` | Admin global, material filtrado por politica | Automatizado backend/API |
| API-RBAC-MAPA-02 | Produtor lista mapas liberados | Produtor | Propriedade vinculada, material liberado | `GET /propriedades/:id/mapas` | Filtros opcionais | `200 OK` | Produtor ve materiais autorizados | Automatizado backend/API |
| API-RBAC-MAPA-03 | Produtor tenta mapas de outra Propriedade | Produtor | Sem vinculo | `GET /propriedades/:id/mapas` | Filtros opcionais | `403 Forbidden` ou `404 Not Found` | Propriedade fora do escopo bloqueada | Automatizado backend/API |
| API-RBAC-MAPA-04 | Colaborador lista anexos por microregiao | Colaborador | Propriedade na microregiao vinculada | `GET /propriedades/:id/anexos` | Filtros opcionais | `200 OK` | Colaborador acessa por microregiao | Automatizado backend/API |
| API-RBAC-MAPA-05 | Colaborador lista anexos por atribuicao direta | Colaborador | Propriedade atribuida diretamente | `GET /propriedades/:id/anexos` | Filtros opcionais | `200 OK` | Atribuicao direta amplia acesso | Automatizado backend/API |
| API-RBAC-MAPA-06 | Recurso inexistente de Propriedade | Admin | Propriedade nao existe | `GET /propriedades/:id/anexos` | Filtros opcionais | `404 Not Found` | Recurso inexistente retorna 404 | Automatizado backend/API |

## Visitas

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-VIS-01 | Admin lista visitas | Admin | Admin ativo | `GET /visitas` | Filtros opcionais | `200 OK` | Admin global | Automatizado backend/API |
| API-RBAC-VIS-02 | Produtor lista visitas proprias | Produtor | Propriedade vinculada | `GET /visitas` | `propriedade_id` opcional | `200 OK` | Produtor ve Propriedades vinculadas quando liberado | Automatizado backend/API |
| API-RBAC-VIS-03 | Colaborador lista visitas no escopo | Colaborador | Microregiao ou atribuicao direta | `GET /visitas` | Filtros opcionais | `200 OK` | Colaborador por escopo aditivo | Automatizado backend/API |
| API-RBAC-VIS-04 | Nao autenticado lista visitas | Nao autenticado | Sem sessao | `GET /visitas` | Filtros opcionais | `401 Unauthorized` | Autenticacao obrigatoria | Automatizado backend/API |
| API-RBAC-VIS-05 | Admin cria visita | Admin | Propriedade existe | `POST /visitas` | `{ "propriedade_id": "prop_1", "data": "2026-06-03", "tipo": "tecnica", "observacoes": "..." }` | `201 Created` | Admin cria visita | Automatizado backend/API |
| API-RBAC-VIS-06 | Colaborador cria visita no escopo | Colaborador | Propriedade no escopo e permissao ativa | `POST /visitas` | Payload minimo valido | `201 Created` | Colaborador cria dentro do escopo | Automatizado backend/API |
| API-RBAC-VIS-07 | Colaborador cria visita fora do escopo | Colaborador | Sem microregiao e sem atribuicao direta | `POST /visitas` | Payload minimo valido | `403 Forbidden` ou `404 Not Found` | Rotas diretas nao burlam escopo | Automatizado backend/API |
| API-RBAC-VIS-08 | Produtor tenta criar visita tecnica | Produtor | Propriedade vinculada | `POST /visitas` | Payload minimo valido | `403 Forbidden` | Produtor nao cria visita tecnica por padrao | Automatizado backend/API |
| API-RBAC-VIS-09 | Criar visita com payload invalido | Admin | Falta `propriedade_id` ou `data` | `POST /visitas` | `{ "observacoes": "..." }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |

## Caderno

| ID | Cenario | Perfil usado | Pre-condicao | Endpoint | Payload minimo | Status esperado | Regra validada | Observacao |
|---|---|---|---|---|---|---|---|---|
| API-RBAC-CAD-01 | Admin lista caderno | Admin | Admin ativo | `GET /caderno` | Filtros opcionais | `200 OK` | Admin global | Automatizado backend/API |
| API-RBAC-CAD-02 | Produtor lista caderno da Propriedade vinculada | Produtor | Propriedade vinculada e visibilidade permitida | `GET /caderno` | `propriedade_id` opcional | `200 OK` | Produtor ve propria realidade operacional | Automatizado backend/API |
| API-RBAC-CAD-03 | Colaborador lista caderno no escopo | Colaborador | Microregiao ou atribuicao direta | `GET /caderno` | Filtros opcionais | `200 OK` | Colaborador por escopo aditivo | Automatizado backend/API |
| API-RBAC-CAD-04 | Produtor tenta caderno de outra Propriedade | Produtor | Sem vinculo ativo | `GET /caderno` | `propriedade_id` de outro titular | `403 Forbidden` ou `404 Not Found` | Produtor nao acessa outro titular | Automatizado backend/API |
| API-RBAC-CAD-05 | Admin cria registro no caderno | Admin | Propriedade existe | `POST /caderno` | `{ "propriedade_id": "prop_1", "data": "2026-06-03", "atividade": "...", "observacoes": "..." }` | `201 Created` | Admin cria registro | Automatizado backend/API |
| API-RBAC-CAD-06 | Colaborador cria caderno no escopo | Colaborador | Propriedade no escopo e permissao ativa | `POST /caderno` | Payload minimo valido | `201 Created` | Colaborador cria dentro do escopo | Automatizado backend/API |
| API-RBAC-CAD-07 | Colaborador cria caderno fora do escopo | Colaborador | Sem microregiao e sem atribuicao direta | `POST /caderno` | Payload minimo valido | `403 Forbidden` ou `404 Not Found` | Escopo validado no backend | Automatizado backend/API |
| API-RBAC-CAD-08 | Produtor cria caderno na propria Propriedade | Produtor | Propriedade vinculada e politica permite criacao | `POST /caderno` | Payload minimo valido | `201 Created` | Produtor cria apenas quando politica permitir | Automatizado backend/API |
| API-RBAC-CAD-09 | Criar caderno com payload invalido | Admin | Campo obrigatorio ausente | `POST /caderno` | `{ "observacoes": "..." }` | `400 Bad Request` | Payload invalido e recusado | Automatizado backend/API |

## Testes Que Devem Virar Automatizados

- Todos os casos marcados como `Automatizado backend/API`.
- Casos de acesso permitido e negado para cada endpoint protegido.
- Casos de `401`, `403`, `404`, `400` e `409`.
- Casos por origem de acesso do colaborador: microregiao, atribuicao direta e
  ausencia de ambos.
- Casos de usuario inativo/pendente.
- Casos de rota direta/API por id fora do escopo.
- Casos de payload invalido para criacao/alteracao.
- Casos de vinculo duplicado ou conflito de regra.

## Testes Que Podem Ser Smoke/Manual

- Conferir se a documentacao continua separando MVP mockado de backend futuro.
- Conferir se telas administrativas nao prometem seguranca real quando apenas
  alteram vinculos visuais no mock.
- Conferir se o frontend usa respostas de permissao para UX, sem tratar isso
  como fonte unica de seguranca.
- Conferir mensagens visuais de acesso negado quando o backend real existir.

## Testes Que Nao Pertencem Ao MVP Mockado

- Qualquer teste que exija `POST /auth/login` real.
- Qualquer teste que dependa de token, sessao real, refresh ou revogacao.
- Qualquer teste que valide persistencia real de `usuario_propriedade` ou
  `usuario_microregiao`.
- Qualquer teste que espere `propriedades_atribuidas` como regra efetiva no
  mock atual.
- Qualquer teste que dependa de API real, banco, migrations, storage ou RBAC
  produtivo.

## Riscos Fora Do MVP

- API futura divergir do contrato e aceitar operacoes apenas porque o frontend
  esconde ou mostra botoes.
- Backend usar `propriedades_atribuidas` como restricao implicita, removendo
  acesso regional esperado.
- Backend nao cobrir rotas diretas por id e vazar Propriedades fora do escopo.
- Migracao de `fazenda_id`, `produtor_id` e `proprietario_id` quebrar acesso do
  Produtor.
- Usuarios inativos/pendentes manterem sessoes validas.
- `403` e `404` serem usados sem estrategia, revelando recursos fora do escopo.
