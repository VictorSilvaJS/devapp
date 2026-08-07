# Contrato Futuro De API Para RBAC/Backend

Status em 2026-06-03 (Fase 14G): este documento registra endpoints, payloads
minimos e respostas esperadas para um backend/RBAC futuro. Ele nao implementa
backend, autenticacao real, RBAC, mocks, telas, rotas ou comportamento
funcional. O MVP atual continua mockado.

Status em 2026-06-03 (Fase 14H): a matriz tecnica de testes de contrato/API
derivada deste contrato foi registrada em `testes-contrato-api-rbac.md`. Ela
deve orientar testes automatizados futuros de backend/API, mas tambem nao
implementa backend nem altera o MVP mockado.

Revisao em 2026-08-07: `APROVADO_PARA_IMPLEMENTACAO`. O contrato de escopo foi alinhado a
`modelo-dados-mock-v2.md`. Regional/Microregiao deixaram de ser fonte futura de
acesso; Colaborador usa somente vinculo direto ativo com Propriedade. As
convencoes finais de fundacao estao em `baseline-backend-v1-2026-08.md`.

## Decisoes De Base

- Backend valida permissao por acao e por Propriedade.
- Frontend nao e fonte de seguranca.
- Admin tem acesso global.
- Produtor acessa Propriedade por vinculo/titularidade.
- Colaborador acessa somente Propriedade atribuida diretamente por vinculo
  ativo.
- Municipio/UF sao localizacao e filtro, nao fonte de autorizacao.
- Campos legados como `fazenda_id`, `produtor_id` e `proprietario_id` devem
  existir apenas como compatibilidade/migracao, nao como contrato final.
- Contratos novos usam `organizacao_id`, `propriedade_id`, `titular_id`,
  `usuario_id`, `municipio_id`, `uf_id` e ids canonicos equivalentes.

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
como desempate. Criacoes e comandos de transicao exigem `Idempotency-Key`;
comandos concorrentes exigem a versao-base do recurso. Erros incluem
`request_id` e nao retornam detalhes sensiveis.

## Autenticacao E Sessao

### `POST /auth/login`

- Objetivo: autenticar usuario e iniciar sessao real.
- Payload minimo:

```json
{
  "email": "usuario@exemplo.com",
  "senha": "senha"
}
```

- Resposta de sucesso: `200 OK` com token/sessao e dados minimos do usuario.
- Acesso negado: `401 Unauthorized` para credenciais invalidas; `403
  Forbidden` para usuario inativo ou pendente.
- Regra de permissao: usuario precisa existir, estar autenticavel e com status
  permitido.
- Compatibilidade: login mock atual nao e contrato final.

### `GET /auth/me`

- Objetivo: retornar usuario autenticado, perfil, status e resumo de escopo.
- Payload minimo: nenhum.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: sessao valida.
- Compatibilidade: pode expor ids canonicos e, temporariamente, aliases legados
  apenas para migracao controlada.

Resposta minima:

```json
{
  "usuario": {
    "id": "usr_1",
    "perfil": "colaborador",
    "status": "ativo"
  },
  "escopo": {
    "propriedades": ["prop_1"]
  }
}
```

## Usuarios

### `GET /usuarios`

- Objetivo: listar usuarios para administracao.
- Payload minimo: filtros opcionais por perfil, status ou texto.
- Resposta de sucesso: `200 OK` com lista paginada.
- Acesso negado: `401 Unauthorized`; `403 Forbidden` se nao for admin/papel
  autorizado.
- Regra de permissao: somente Admin ou papel administrativo.
- Compatibilidade: `ativo` pode ser campo derivado temporario; contrato final
  deve usar `status`.

### `GET /usuarios/:id`

- Objetivo: abrir detalhe administrativo de usuario.
- Payload minimo: `id` canonico na rota.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: Admin/papel autorizado; o proprio usuario pode consultar
  dados basicos se a politica permitir.
- Compatibilidade: ids legados nao devem ser rota final.

### `POST /usuarios`

- Objetivo: criar usuario administrativo.
- Payload minimo:

```json
{
  "nome": "Nome",
  "email": "usuario@exemplo.com",
  "perfil": "produtor",
  "status": "pendente"
}
```

- Resposta de sucesso: `201 Created`.
- Acesso negado: `401 Unauthorized`; `403 Forbidden`.
- Outros erros: `400 Bad Request`; `409 Conflict` para e-mail duplicado.
- Regra de permissao: Admin/papel autorizado.
- Compatibilidade: criacao no MVP mockado nao cria login real.

### `PATCH /usuarios/:id`

- Objetivo: atualizar dados cadastrais de usuario.
- Payload minimo: campos parciais permitidos.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para conflito de e-mail ou
  regra.
- Regra de permissao: Admin/papel autorizado ou regra explicita de autoedicao.
- Compatibilidade: nao usar `ativo` como fonte final; preferir `status`.

### `PATCH /usuarios/:id/status`

- Objetivo: ativar, inativar ou marcar pendencia de usuario.
- Payload minimo:

```json
{
  "status": "ativo"
}
```

- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` se a mudanca violar regra de
  vinculo obrigatorio.
- Regra de permissao: Admin/papel autorizado.
- Compatibilidade: status futuro substitui booleanos legados.

## Propriedades

### `GET /propriedades`

- Objetivo: listar Propriedades conforme escopo do usuario.
- Payload minimo: filtros opcionais por status, UF, Municipio e busca.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: Admin lista global; Produtor lista vinculadas;
  Colaborador lista somente as atribuidas diretamente.
- Compatibilidade: resposta pode incluir `fazenda_id` temporario, mas contrato
  final deve usar `propriedade_id`.

### `GET /propriedades/:id`

- Objetivo: abrir detalhe de Propriedade.
- Payload minimo: `id` canonico da Propriedade.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: acesso por perfil e escopo da Propriedade.
- Compatibilidade: `produtor_id`/`proprietario_id` nao devem substituir
  `titular_id` no contrato final.

### `POST /propriedades`

- Objetivo: criar Propriedade.
- Payload minimo:

```json
{
  "nome": "Propriedade Exemplo",
  "titular_id": "prod_1",
  "municipio_id": "4306106",
  "uf_id": "43",
  "uf_sigla": "RS",
  "area_total": 120.5,
  "status": "ativa"
}
```

- Resposta de sucesso: `201 Created`.
- Acesso negado: `401 Unauthorized`; `403 Forbidden`.
- Outros erros: `400 Bad Request`; `409 Conflict` para regra de titular/vinculo
  conflitante.
- Regra de permissao: Admin/papel autorizado; Colaborador somente se politica
  futura explicita permitir.
- Compatibilidade: o backend deve repetir a transacao v2 já aprovada: criar a
  Propriedade, criar o vínculo de Titular e ativar Produtor pendente quando for
  a primeira Titularidade. Não existe cadastro rápido de Propriedade dentro de
  Novo Usuário.

### `PATCH /propriedades/:id`

- Objetivo: atualizar cadastro de Propriedade.
- Payload minimo: campos parciais permitidos.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para titularidade ou estado
  conflitante.
- Regra de permissao: Admin/papel autorizado; Colaborador apenas com permissao
  explicita por acao.
- Compatibilidade: preservar leitura dupla enquanto `fazenda_id` existir.

## Vinculos

### `GET /usuarios/:id/propriedades`

- Objetivo: listar vinculos diretos usuario-Propriedade.
- Payload minimo: `id` canonico do usuario.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Regra de permissao: Admin/papel autorizado; proprio usuario apenas se a
  politica permitir consulta de escopo.
- Compatibilidade: corresponde ao futuro real de `usuario_propriedade`.

### `PUT /usuarios/:id/propriedades`

- Objetivo: substituir ou sincronizar vinculos diretos usuario-Propriedade.
- Payload minimo:

```json
{
  "propriedades": [
    {
      "propriedade_id": "prop_1",
      "tipo_vinculo": "colaborador",
      "status": "ativo"
    }
  ]
}
```

- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`, `403 Forbidden` ou `404 Not Found`.
- Outros erros: `400 Bad Request`; `409 Conflict` para vinculo duplicado ou
  regra conflitante.
- Regra de permissao: Admin/papel autorizado.
- Compatibilidade: `propriedades_atribuidas` deve migrar para vinculos
  persistentes, auditaveis e com status.

## Permissao E Escopo

### `GET /me/propriedades`

- Objetivo: listar Propriedades acessiveis ao usuario autenticado.
- Payload minimo: filtros opcionais.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: Admin global; Produtor por vinculo/titularidade;
  Colaborador por vinculo direto ativo.
- Compatibilidade: endpoint substitui dependencia de filtro frontend como fonte
  de seguranca.

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
  "origens": ["vinculo_direto"],
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

## Implementacao Pendente

As decisões de fundação estão encerradas na baseline v1. Durante `MP-33` e
`MP-35`, ainda é necessário:

- materializar autenticação, refresh, revogação e sessão;
- gerar OpenAPI e migrations a partir deste contrato;
- aplicar cursor, limites e envelope definidos na baseline;
- aplicar `404` fora do escopo e `403` para ação negada dentro do escopo;
- persistir auditoria dos vínculos ativos/inativos, sem expiração automática;
- transformar a matriz de `testes-contrato-api-rbac.md` em testes executáveis.
