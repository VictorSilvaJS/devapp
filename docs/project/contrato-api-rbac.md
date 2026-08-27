# Contrato De API Para RBAC/Backend

> Revisão documental: 2026-08-26

Este documento registra endpoints, payloads mínimos e respostas esperadas. Em
2026-06-03 (Fase 14G), todo o conteúdo era contrato futuro. Em 2026-08-21,
autenticação da MP-33B e a leitura autorizada de Propriedades da MP-33C foram
concluídas tecnicamente. Em 2026-08-24, notificações da própria conta da MP-34
foram concluídas tecnicamente e integradas diretamente à branch `backend` no
commit `e787707`, sem pull request e com os três jobs da CI pós-push aprovados.
Não houve tag, deploy, release ou publicação. As demais rotas de negócio/RBAC
continuam futuras. O Demo permanece mockado, e a composição HTTP consome
somente capacidades reais.

A validação final do backend com a MP-34 executou 41 cenários reais de
integração: 15 de migrations, 8 de autenticação, 7 de ações de conta, 9 de
Propriedades/QA e 2 de notificações. Os 36 cenários registrados nos documentos
da MP-33C permanecem evidência histórica daquele recorte, não o total atual.

Status em 2026-06-03 (Fase 14H): a matriz tecnica de testes de contrato/API
derivada deste contrato foi registrada em `testes-contrato-api-rbac.md`. Ela
deve orientar testes automatizados futuros de backend/API, mas tambem nao
implementa backend nem altera o MVP mockado.

Revisao em 2026-08-07: `APROVADO_PARA_IMPLEMENTACAO`. O contrato de escopo foi alinhado a
`modelo-dados-mock-v2.md`. Regional/Microregiao deixaram de ser fonte futura de
acesso; Colaborador usa somente vinculo direto ativo com Propriedade. As
convencoes finais de fundacao estao em `baseline-backend-v1-2026-08.md`.

Revisao em 2026-08-18: a MP-33A implementa apenas fundacao e DDL. Endpoints de
autenticacao pertencem a MP-33B e a primeira vertical HTTP de Propriedades, a
MP-33C. O mock permanece inalterado.

Revisão em 2026-08-19: os endpoints `/v1/auth` da MP-33B foram implementados e
validados tecnicamente. Naquele checkpoint, rotas de negócio e RBAC por
Propriedade ainda eram contrato futuro da MP-33C/MP-35, e o aplicativo
permanecia no mock. A MP-33B não foi liberada para produção.

Revisão em 2026-08-21: a primeira vertical da MP-33C foi implementada e
validada em `GET /v1/propriedades` e
`GET /v1/propriedades/:id`, sem endpoint duplicado em `/v1/me/propriedades`.
Ela é somente leitura e inclui a autorização mínima necessária dentro da
consulta. Escritas e administração continuam na MP-35. O contrato detalhado do
cliente está em `contrato-integracao-app-mp33c.md`.

Revisão em 2026-08-25: D1-D13 e a divisão MP-35A-D foram consolidadas em
`contrato-administracao-mp35.md`. A MP-35A implementa somente contratos e
fundação persistente.

Revisão em 2026-08-26: a MP-35B está corrigida localmente, não integrada e em
validação final. As seis rotas de Usuários abaixo são executáveis; escritas de
Propriedades e vínculos permanecem reservadas à MP-35C, e telas à MP-35D.

## Decisoes De Base

- Backend valida permissao por acao e por Propriedade.
- Frontend nao e fonte de seguranca.
- Admin tem acesso global.
- Produtor acessa Propriedade pela Titularidade derivada ou pelo vinculo
  adicional `usuario_autorizado`.
- Colaborador acessa somente Propriedade atribuida diretamente por vinculo
  ativo.
- Municipio/UF sao localizacao e filtro, nao fonte de autorizacao.
- Campos legados como `fazenda_id`, `produtor_id` e `proprietario_id` devem
  existir apenas como compatibilidade/migracao, nao como contrato final.
- Contratos novos usam `organizacao_id`, `propriedade_id`, `titular_id`,
  `usuario_id`, `municipio_id`, `uf_id` e ids canonicos equivalentes.
- `propriedades.titular_id` e a unica fonte persistida da Titularidade;
  `usuario_propriedade` aceita somente `usuario_autorizado` e `colaborador`.
- A API pode projetar `tipo_acesso=titular`, calculado pela cadeia Propriedade,
  Produtor Titular e Usuario principal.
- Usuario principal inativo conserva a Titularidade cadastral, mas nao obtem
  acesso; sua desativacao nao e impedida por constraint permanente.

## Respostas Padrao

| Status | Uso esperado |
|---|---|
| `200 OK` | Leitura ou atualizacao permitida |
| `201 Created` | Criacao bem-sucedida |
| `400 Bad Request` | Requisicao malformada ou parametro estrutural invalido |
| `401 Unauthorized` | Usuario nao autenticado ou sessao invalida |
| `403 Forbidden` | Usuario autenticado, mas sem permissao para a acao/recurso |
| `404 Not Found` | Recurso nao existe ou nao deve ser revelado ao usuario |
| `409 Conflict` | Vinculo duplicado, regra conflitante ou estado incompativel |
| `422 Unprocessable Entity` | Payload bem formado com campo semanticamente invalido |

Formato minimo recomendado para erro:

```json
{
  "error": {
    "code": "forbidden",
    "message": "Acesso negado.",
    "resource": "propriedade",
    "action": "read"
  }
}
```

Regra obrigatoria: recurso individual fora do escopo retorna `404 Not Found`.
Recurso conhecido e dentro do escopo, mas com acao nao permitida, retorna `403
Forbidden`. Colecao administrativa sem capacidade retorna `403`. Essa regra
evita escolhas diferentes entre endpoints.

Todas as colecoes usam cursor estavel, limite padrao 50 e maximo 100, com ID
como desempate. Toda mutação administrativa exige `Idempotency-Key`;
transições versionadas e comandos concorrentes que avançam ou substituem a
versão do recurso exigem a versão-base. Erros incluem `request_id` e não
retornam detalhes sensíveis.

A exceção é restrita à leitura individual, leitura em lote e descarte de
notificações da MP-34. Esses comandos são monotônicos, não aceitam `version` nem
versão-base e usam `Idempotency-Key` com binding persistido de comando,
alvo/corte e hash do pedido. A exceção não altera a exigência de versão-base de
nenhuma outra transição versionada.

## Autenticacao E Sessao

### `POST /v1/auth/login`

- Objetivo: autenticar usuario e iniciar sessao real.
- Payload minimo:

```json
{
  "email": "usuario@exemplo.com",
  "senha": "senha"
}
```

- Resposta de sucesso: `200 OK` com access/refresh opacos, sessao e dados
  minimos do usuario; a resposta usa `Cache-Control: no-store` e
  `Pragma: no-cache`.
- Acesso negado: o mesmo `401 Unauthorized` para credenciais invalidas,
  identidade inexistente, usuario inativo/pendente ou ausencia de credencial.
- Regra de permissao: usuario precisa existir, estar autenticavel e com status
  permitido.
- Compatibilidade: login mock atual nao e contrato final.

### `GET /v1/auth/me`

- Objetivo: retornar usuario autenticado, perfil, status, sessao, modo de
  escopo e versao de autorizacao.
- Payload minimo: nenhum.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: sessao valida.
- Compatibilidade: a MP-33B nao lista Propriedades nem expõe aliases legados;
  `tipo_acesso` de leitura pertence à MP-33C e capacidades administrativas, à
  MP-35.

Resposta minima:

```json
{
  "usuario": {
    "id": "00000000-0000-4000-8000-000000000001",
    "perfil": "colaborador",
    "status": "ativo",
    "versao_autorizacao": 1
  },
  "sessao": {
    "id": "00000000-0000-4000-8000-000000000002"
  },
  "escopo": {
    "modo": "vinculos_propriedade",
    "versao": 1
  }
}
```

Os demais endpoints de credenciais, sessoes, convites, e-mail e recuperacao
da MP-33B seguem o contrato especifico em
`contrato-autenticacao-mp33b.md`. RBAC de recursos continua fora deste corte.
O endpoint existente `POST /v1/auth/invitations/accept` preserva o contrato
implementado de sucesso `204 No Content`; a MP-35A não o altera para `200`.

## Usuarios

### `GET /v1/usuarios`

- Objetivo: listar usuarios para administracao.
- Payload minimo: filtros opcionais por perfil, status ou texto.
- Resposta de sucesso: `200 OK` com lista paginada.
- Acesso negado: `401 Unauthorized`; `403 Forbidden` se nao for admin/papel
  autorizado.
- Regra de permissao: somente Admin.
- Ordenação e paginação: cursor estável por nome normalizado e ID; limite
  padrão 50 e máximo 100. `busca` compara literalmente nome, e-mail ou
  documento por busca infixa `ILIKE`, cujo custo deve ser medido com volume
  representativo antes de produção.
- O cursor de Usuários é AES-256-GCM versionado, confidencial, autenticado,
  expirável e vinculado ao fingerprint de `busca`, `perfil` e `status`; a
  chave de ordenação é a expressão `lower(nome)` devolvida pelo PostgreSQL. O
  keyring `ADMIN_USER_CURSOR_*` é obrigatório, sem fallback, e deve ser
  criptograficamente distinto do keyring da outbox.
- Projeção: a lista usa somente `snake_case` e inclui `produtor_id` para o
  perfil Produtor, sem credencial, token, desafio, outbox ou aliases do mock.
- Compatibilidade: `ativo` pode ser campo derivado temporario; contrato final
  deve usar `status`.

### `GET /v1/usuarios/:id`

- Objetivo: abrir detalhe administrativo de usuario.
- Payload minimo: `id` canonico na rota.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: somente Admin; autoedição continua nos endpoints de conta
  da MP-33B.
- Compatibilidade: ids legados nao devem ser rota final.
- A resposta detalhada inclui `versao`, datas e campos cadastrais opcionais;
  `produtor_id` é nulo para Admin/Colaborador.

### `POST /v1/usuarios`

- Objetivo: criar usuario administrativo.
- Payload minimo:

```json
{
  "nome": "Nome",
  "email": "usuario@exemplo.com",
  "perfil": "produtor"
}
```

- Resposta de sucesso: `201 Created`.
- Acesso negado: `401 Unauthorized`; `403 Forbidden`.
- Outros erros: `400 Bad Request`; `409 Conflict` para e-mail duplicado.
- Regra de permissao: somente Admin; o servidor fixa `status=pendente`, cria o
  cadastro Produtor inativo quando aplicável e emite convite sem senha.
- Idempotência: `Idempotency-Key` obrigatória, retenção de 90 dias.
- A criação, o cadastro Produtor aplicável, o convite `ativar_usuario`, o
  desafio, a outbox, a auditoria e o recibo são uma única transação.

### `PATCH /v1/usuarios/:id`

- Objetivo: atualizar dados cadastrais de usuario.
- Payload minimo: campos parciais permitidos e `versao` esperada.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para conflito de e-mail ou
  regra.
- Regra de permissao: somente Admin.
- Idempotência: `Idempotency-Key` obrigatória.
- Compatibilidade: nao usar `ativo` como fonte final; preferir `status`.
- Perfil e status não são campos desta rota. E-mail pode mudar somente quando
  o alvo está `pendente`; a troca substitui convite/desafio/outbox na mesma
  transação. Conta ativa ou inativa usa os fluxos verificados da MP-33B.

### `PATCH /v1/usuarios/:id/status`

- Objetivo: reativar ou inativar usuario; `pendente` é estado de criação e
  convite, não transição administrativa desta rota.
- Payload minimo:

```json
{
  "status": "inativo",
  "versao": 3,
  "motivo": "suspensao_operacional"
}
```

- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para versão, auto-inativação
  ou proteção do último Admin; `422 validation_error` para estado semântico
  inválido, inclusive destino `pendente`.
- Regra de permissao: somente Admin. Ativação sem credencial ativa é proibida;
  Produtor e Propriedades titularizadas devem terminar a transação em estado
  coerente.
- Idempotência: `Idempotency-Key` obrigatória.
- Compatibilidade: status futuro substitui booleanos legados.
- A rota aceita somente origem e destino em `ativo <-> inativo`; alvo
  `pendente` recebe `422 validation_error`, nunca `409`. O motivo externo usa `motivo` e
  `motivo_detalhe`, exigido quando `motivo=outro`.

### `POST /v1/usuarios/:id/convites`

- Objetivo: emitir ou reemitir convite para Usuário pendente.
- Regra de permissão: somente Admin; `Idempotency-Key` obrigatória.
- Convite novo usa `ativar_usuario`. `manter_status` continua aceito somente
  para convites históricos e fluxos explícitos de compatibilidade.
- Aceite cria a credencial e ativa a conta na mesma transação; perfil Produtor
  ativa também `produtores.status`.
- O aceite existente responde `204 No Content`; os endpoints administrativos
  desta seção estão implementados localmente na MP-35B.
- O corpo administrativo contém somente
  `{ "modo_ativacao": "ativar_usuario" }`. `manter_status` é recusado com
  `422` e não pode ser emitido novamente.
- Esta é a única rota administrativa de emissão. A antiga
  `POST /v1/auth/invitations` é removida na MP-35B; o aceite público em
  `/v1/auth/invitations/accept` permanece inalterado.

### Recibo seguro das mutações de Usuário

As quatro mutações da MP-35B — criação, atualização, status e convite —
respondem somente com o recibo persistido e seguro; as outras duas operações
são leituras:

```json
{
  "resultado": "atualizado",
  "recurso_tipo": "usuario",
  "recurso_id": "00000000-0000-4000-8000-000000000001",
  "versao": 2
}
```

Convite usa `recurso_tipo=convite`, `resultado=convite_emitido` e não possui
`versao`. Depois de uma mutação, o cliente relê o detalhe quando precisar da
representação cadastral. O recibo não contém nome, e-mail, telefone, documento,
observações, motivo livre, token ou payload.

Para as rotas de Usuários, JSON malformado ou estrutura inválida é
`400 invalid_request`; sessão ausente/revogada/expirada/stale é
`401 invalid_session`; perfil ativo sem permissão é `403 forbidden`; recurso
ausente é `404 not_found`; versão divergente é `409 version_conflict`; chave
idempotente com corpo diferente é `409 idempotency_conflict`; regra de negócio
é `409 business_rule_conflict`; enum, valor ou limite D9 semanticamente
inválido é `422 validation_error`. Todas as respostas usam `snake_case`,
`Cache-Control: no-store` e não incluem PII ou detalhe PostgreSQL.

Cursor vazio, acima do limite formal, truncado, malformado, adulterado ou com
versão/chave desconhecida também é sempre `400 invalid_request`. No worker, o
relógio do banco e os estados de mensagem, lease, desafio e convite são
revalidados depois dos locks e imediatamente antes do dispatch. O SMTP dentro
da transação e do lock preserva linearização, mas exige ensaio produtivo de
capacidade e latência.

## Propriedades

### `GET /v1/propriedades`

- Objetivo: listar Propriedades conforme escopo do usuario.
- Query: `busca`, `status`, `uf`, `municipio`, `limite` e `cursor`, todos
  opcionais; limite padrão 50 e máximo 100.
- `busca`: substring literal no nome da Propriedade, do Titular ou do
  Município.
- `uf`: compara `uf_id` ou `uf_sigla`, sem distinguir maiúsculas de
  minúsculas.
- `municipio`: compara `municipio_id` ou `municipio_nome`, sem distinguir
  maiúsculas de minúsculas.
- Resposta de sucesso: `200 OK` com `itens` e
  `paginacao.proximo_cursor`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: Admin ativo lista o escopo da organização; Produtor ativo
  lista Propriedades ativas por Titularidade derivada ou
  `usuario_autorizado` ativo; Colaborador ativo lista Propriedades ativas por
  vínculo `colaborador` ativo.
- Escopo é aplicado antes de filtros, ordenação e cursor. Filtros nunca
  concedem acesso.
- Ordenação estável por nome e ID; cursor é opaco e representa apenas essa
  posição canônica. Cursor malformado falha com `400`; o contrato não declara
  vínculo criptográfico do cursor com os filtros.
- Compatibilidade: resposta usa somente `snake_case` e IDs canônicos, sem
  aliases `fazenda_id`, `produtor_id`, `proprietario_id` ou `tipoAcesso`.

### `GET /v1/propriedades/:id`

- Objetivo: abrir detalhe de Propriedade.
- Payload minimo: `id` canonico da Propriedade.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`; `404 Not Found` tanto para inexistente
  quanto para fora do escopo.
- Regra de permissao: acesso por perfil e escopo da Propriedade.
- Compatibilidade: usa `titular_id`, projeção `titular` e `tipo_acesso`
  calculado; aliases legados não integram a resposta HTTP.

Representação mínima comum à lista e ao detalhe:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "organizacao_id": "org_tche_fertilidade",
  "titular_id": "00000000-0000-4000-8000-000000000002",
  "titular": {
    "id": "00000000-0000-4000-8000-000000000002",
    "nome": "Produtor"
  },
  "nome": "Propriedade Exemplo",
  "municipio_id": "4306106",
  "municipio_nome": "Caçapava do Sul",
  "uf_id": "43",
  "uf_sigla": "RS",
  "area_total": 120.5,
  "cultura_principal": "Soja",
  "status": "ativa",
  "tipo_acesso": "titular"
}
```

`tipo_acesso` aceita `admin`, `titular`, `usuario_autorizado` ou
`colaborador`. Métricas dependentes do conjunto completo não fazem parte deste
contrato; não se calcula total a partir de uma página. Para Produtor que também
possua acesso adicional à mesma Propriedade, `titular` tem precedência.

### `POST /v1/propriedades`

- Objetivo: criar Propriedade.
- Payload minimo:

```json
{
  "nome": "Propriedade Exemplo",
  "titular_id": "0c57bed2-b18a-45c4-aeca-4cb5696716d7",
  "municipio_id": "4306106",
  "area_total": 120.5,
  "status": "ativa"
}
```

- Resposta de sucesso: `201 Created`.
- Acesso negado: `401 Unauthorized`; `403 Forbidden`.
- Outros erros: `400 Bad Request`; `409 Conflict` para regra de Titularidade
  conflitante.
- Regra de permissao: somente Admin.
- Localização: o cliente envia somente `municipio_id`; o backend valida o
  Município no snapshot ativo e deriva `uf_id`, `municipio_nome` e `uf_sigla`.
  `uf_id`, nome e sigla são rejeitados como escrita autoritativa.
- Idempotência: `Idempotency-Key` obrigatória, retenção de 90 dias.
- Fase: MP-35C.
- Compatibilidade: o backend cria a Propriedade e registra somente
  `titular_id`; nao cria vinculo `titular`. Nao existe cadastro rapido de
  Propriedade dentro de Novo Usuario.

### `PATCH /v1/propriedades/:id`

- Objetivo: atualizar cadastro de Propriedade.
- Payload minimo: campos parciais permitidos e `versao` esperada; Titularidade
  não pode ser transferida por esta rota.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para titularidade ou estado
  conflitante.
- Regra de permissao: somente Admin.
- Localização: quando alterada, recebe somente `municipio_id`; o backend deriva
  todos os campos de UF/nome. `titular_id` não é aceito no `PATCH` ordinário.
- Fase: MP-35C.
- Compatibilidade: preservar leitura dupla enquanto `fazenda_id` existir.

### `PATCH /v1/propriedades/:id/status`

- Objetivo: ativar ou inativar Propriedade com `versao`, motivo e detalhe
  opcional; `outro` exige detalhe.
- Regra: somente Admin. Ativação exige Titular habilitado; inativação revoga as
  sessões dos Usuários diretamente afetados no MVP.
- Resposta: `200 OK`; `409` para versão divergente; `422` para estado inválido.
- Idempotência: `Idempotency-Key` obrigatória.

## Vinculos

### `GET /v1/usuarios/:id/propriedades`

- Objetivo: listar vinculos diretos usuario-Propriedade.
- Payload minimo: `id` canonico do usuario.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: somente Admin.
- Compatibilidade: corresponde ao futuro real de `usuario_propriedade`.

### `PATCH /v1/usuarios/:id/propriedades`

- Objetivo: aplicar delta versionado de vínculos diretos
  Usuário-Propriedade, sem substituir a lista completa.
- Payload minimo:

```json
{
  "versao": 4,
  "adicionar": [
    {
      "propriedade_id": "prop_1",
      "tipo_vinculo": "colaborador"
    }
  ],
  "remover": [],
  "motivo": "mudanca_responsabilidade"
}
```

- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para vinculo duplicado ou
  regra conflitante.
- Regra de permissao: somente Admin.
- Regra de validacao: `tipo_vinculo=titular` e rejeitado; somente
  `usuario_autorizado` e `colaborador` podem ser persistidos; o total do delta
  é limitado a 100 IDs e remover o último acesso é permitido.
- Idempotência: `Idempotency-Key` obrigatória.
- Compatibilidade: `propriedades_atribuidas` deve migrar para vinculos
  persistentes, auditaveis e com status.

## Localidades

### `GET /v1/localidades/ufs`

- Objetivo: listar as 27 UFs da versão ativa do snapshot local IBGE.
- Regra de permissão: somente Admin autenticado; nenhuma localidade concede
  escopo operacional.
- Resposta: `200 OK`, ordenada por nome e ID; sem consulta externa em runtime.
- Fase: MP-35C.

### `GET /v1/localidades/municipios`

- Objetivo: listar Municípios da versão ativa, exigindo filtro `uf_id` e usando
  `busca`, `limite` e cursor estável por nome/ID.
- Regra de permissão: somente Admin autenticado.
- Resposta: `200 OK`; `400` para UF/cursor inválido.
- Fase: MP-35C.

## Permissao E Escopo

### Sem duplicação de coleção pessoal

Não será criado `GET /v1/me/propriedades`. A coleção canônica
`GET /v1/propriedades` já retorna exclusivamente o escopo da identidade
autenticada e substitui qualquer filtro do frontend como fonte de segurança.

### `GET /me/permissoes`

- Objetivo: retornar capacidades do usuario autenticado.
- Payload minimo: nenhum.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: sessao valida; backend calcula a partir de perfil, papeis
  e vinculos.
- Compatibilidade: frontend pode usar para exibir/ocultar UI, mas nao como
  unica validacao de seguranca.

Resposta minima:

```json
{
  "perfil": "colaborador",
  "acoes": ["listar_propriedades", "abrir_propriedade", "criar_visita"]
}
```

### `GET /propriedades/:id/permissao`

- Objetivo: avaliar permissoes do usuario autenticado para uma Propriedade.
- Payload minimo: `id` canonico da Propriedade.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`; `404 Not Found` quando a Propriedade nao
  existe ou nao deve ser revelada.
- Regra de permissao: backend valida perfil, vinculos e acoes por Propriedade.
- Compatibilidade: nao substituir por checagem local de `fazenda_id`.

Resposta minima:

```json
{
  "propriedade_id": "prop_1",
  "permitido": true,
  "tipo_acesso": "titular",
  "origens": ["titularidade_derivada"],
  "acoes": ["read", "create_visita"]
}
```

## Mapas E Anexos

### `GET /propriedades/:id/mapas`

- Objetivo: listar mapas da Propriedade.
- Payload minimo: filtros opcionais por safra, talhao, categoria ou elemento.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: usuario precisa ter acesso a Propriedade e ao material
  conforme perfil/liberacao.
- Compatibilidade: `fazenda_id` pode aparecer apenas em migracao; contrato final
  usa `propriedade_id`.

### `GET /propriedades/:id/anexos`

- Objetivo: listar anexos e materiais tecnicos da Propriedade.
- Payload minimo: filtros opcionais por tipo, safra, talhao, status de
  publicacao.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: acesso a Propriedade e liberacao do anexo por perfil.
- Compatibilidade: anexos mockados atuais nao representam storage/API real.

## Visitas

### `GET /visitas`

- Objetivo: listar visitas conforme escopo do usuario.
- Payload minimo: filtros opcionais por `propriedade_id`, periodo, status.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: Admin global; Produtor por Propriedades vinculadas quando
  liberado; Colaborador por vinculo direto ativo.
- Compatibilidade: `fazenda_id` temporario deve migrar para `propriedade_id`.

### `POST /visitas`

- Objetivo: criar visita tecnica.
- Payload minimo:

```json
{
  "propriedade_id": "prop_1",
  "data": "2026-06-03",
  "tipo": "tecnica",
  "observacoes": "Registro inicial"
}
```

- Resposta de sucesso: `201 Created`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`.
- Regra de permissao: Admin ou Colaborador com permissao de criar visita na
  Propriedade; Produtor nao cria visita tecnica por padrao.
- Compatibilidade: payload mockado atual pode usar `fazenda_id`; contrato final
  deve usar `propriedade_id`.

## Caderno

### `GET /caderno`

- Objetivo: listar registros de caderno conforme escopo do usuario.
- Payload minimo: filtros opcionais por `propriedade_id`, periodo, visibilidade.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: Admin global; Produtor por Propriedades vinculadas e
  visibilidade; Colaborador por vinculo direto ativo.
- Compatibilidade: migrar `fazenda_id` para `propriedade_id` com leitura dupla.

### `POST /caderno`

- Objetivo: criar registro no caderno.
- Payload minimo:

```json
{
  "propriedade_id": "prop_1",
  "data": "2026-06-03",
  "atividade": "Aplicacao",
  "observacoes": "Registro operacional"
}
```

- Resposta de sucesso: `201 Created`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`.
- Regra de permissao: Admin, Colaborador dentro do escopo e Produtor na propria
  Propriedade quando a politica permitir criacao.
- Compatibilidade: payload mockado atual pode usar `fazenda_id`; contrato final
  deve usar `propriedade_id`.

## Implementação restante

As decisões de fundação estão encerradas na baseline v1. Autenticação, refresh,
revogação e sessão da MP-33B estão concluídos tecnicamente. A MP-33C também
concluiu lista/detalhe, projeção `tipo_acesso`, cursor/filtros e `404`
indistinguível. Ainda é necessário:

- concluir a validação final e integrar separadamente a MP-35B já corrigida;
  implementar na MP-35C apenas as escritas de Propriedade, auditoria de
  vínculos, idempotência e o RBAC por ação ainda pertencente a essa fase;
- transformar em testes executáveis somente as linhas das fases futuras em
  `testes-contrato-api-rbac.md`.
