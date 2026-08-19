# Contrato De API Para RBAC/Backend

Este documento registra endpoints, payloads mínimos e respostas esperadas. Em
2026-06-03 (Fase 14G), todo o conteúdo era contrato futuro. Em 2026-08-19, a
parte de autenticação da MP-33B está concluída tecnicamente; as rotas de
negócio/RBAC continuam futuras. O aplicativo permanece mockado.

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
validados tecnicamente. Rotas de negócio e RBAC por Propriedade continuam
contrato futuro da MP-33C/MP-35; o aplicativo permanece no mock, e a MP-33B
não está liberada para produção.

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
- A API pode projetar `tipoAcesso=titular`, calculado pela cadeia Propriedade,
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
como desempate. Criacoes e comandos de transicao exigem `Idempotency-Key`;
comandos concorrentes exigem a versao-base do recurso. Erros incluem
`request_id` e nao retornam detalhes sensiveis.

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
  a projecao de acesso operacional pertence a MP-33C/MP-35.

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
- Outros erros: `400 Bad Request`; `409 Conflict` para conflito cadastral que
  nao seja a mera existencia de Propriedade titularizada.
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
- Outros erros: `400 Bad Request`; `409 Conflict` para regra de Titularidade
  conflitante.
- Regra de permissao: Admin/papel autorizado; Colaborador somente se politica
  futura explicita permitir.
- Compatibilidade: o backend cria a Propriedade e registra somente
  `titular_id`; nao cria vinculo `titular`. A ativacao inicial e o restante da
  vertical administrativa pertencem a MP-33C. Nao existe cadastro rapido de
  Propriedade dentro de Novo Usuario.

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
- Regra de validacao: `tipo_vinculo=titular` e rejeitado; somente
  `usuario_autorizado` e `colaborador` podem ser persistidos.
- Compatibilidade: `propriedades_atribuidas` deve migrar para vinculos
  persistentes, auditaveis e com status.

## Permissao E Escopo

### `GET /me/propriedades`

- Objetivo: listar Propriedades acessiveis ao usuario autenticado.
- Payload minimo: filtros opcionais.
- Resposta de sucesso: `200 OK`.
- Acesso negado: `401 Unauthorized`.
- Regra de permissao: Admin global; Produtor por Titularidade derivada ou
  vinculo adicional;
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
  "tipoAcesso": "titular",
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

## Implementação pendente

As decisões de fundação estão encerradas na baseline v1. Autenticação, refresh,
revogação e sessão da MP-33B estão concluídos tecnicamente. Ainda é necessário:

- implementar a vertical de Propriedades e sua projeção de acesso na MP-33C;
- aplicar cursor, limites e envelope definidos na baseline;
- aplicar `404` fora do escopo e `403` para ação negada dentro do escopo;
- persistir auditoria dos vínculos ativos/inativos, sem expiração automática;
- transformar a matriz de `testes-contrato-api-rbac.md` em testes executáveis.
