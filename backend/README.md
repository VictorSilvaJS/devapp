# Backend Tchê Agro

Fundação da MP-33A em Node.js 24, Fastify 5, TypeScript e PostgreSQL/PostGIS.
Este corte expõe somente sinais operacionais e OpenAPI. Não implementa
autenticação, sessões, RBAC, rotas de negócio, integração HTTP do aplicativo,
storage de objetos ou alteração do mock.

## Requisitos

- Node.js 24 LTS; o `package.json` exige `>=24 <25` e `.nvmrc` fixa `24`;
- npm, usando o `package-lock.json` desta pasta;
- Docker para o PostgreSQL/PostGIS local opcional e para `test:integration`;
- nenhuma instalação local de `psql` é necessária.

O aplicativo na raiz continua com seu runtime compatível atual. Instale e
execute o backend a partir desta pasta:

```console
npm ci
npm run typecheck
npm run test:unit
npm run test:http
npm run build
npm run smoke:dist
```

## Configuração

| Variável | Obrigatória | Padrão | Regra |
|---|---:|---|---|
| `DATABASE_URL` | Sim | — | URL `postgresql://` ou `postgres://`, com host, banco, porta válida e sem query/fragmento |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `DATABASE_SSL_CA` | Não | raízes do sistema | um ou mais certificados X.509 PEM válidos; também aceita quebras representadas por `\n` |
| `HOST` | Não | `0.0.0.0` | host da porta HTTP |
| `PORT` | Não | `3000` | inteiro entre 1 e 65535 |
| `LOG_LEVEL` | Não | `info` | nível reconhecido pelo Pino |

Configuração inválida encerra o processo antes de abrir a porta. A
indisponibilidade do banco não: o pool é criado sem consulta inicial, permitindo
que o processo responda health enquanto o PostgreSQL se recupera.

Em `production`, SSL do PostgreSQL é sempre criado com
`rejectUnauthorized: true`. Não inclua parâmetros de consulta em
`DATABASE_URL`; eles são rejeitados para impedir que o parser do driver
sobrescreva TLS, `search_path`, timeouts ou outros valores tipados. Não inclua
fragmento nem use porta zero. Use `DATABASE_SSL_CA` quando a autoridade
certificadora não estiver nas raízes confiáveis do sistema.

Exemplo de execução local em PowerShell, apontando para um banco já existente:

```powershell
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://usuario:senha@localhost:5432/tche_agro_dev'
npm run dev
```

O backend não carrega arquivo `.env` implicitamente e nunca deve registrar a
configuração completa ou valores de conexão.

## PostgreSQL/PostGIS local

[compose.yaml](compose.yaml) sobe somente o PostgreSQL/PostGIS de
desenvolvimento. Ele usa `postgis/postgis:17-3.5`, publica a porta
exclusivamente em `127.0.0.1`, possui healthcheck e mantém os dados no volume
nomeado `postgres_data`. A API continua sendo executada separadamente pelo
Node.js.

[.env.example](.env.example) contém apenas valores de exemplo e placeholders.
Para uso local, copie-o para o arquivo ignorado `.env.local`, substitua todos os
valores `replace_*` e mantenha `DATABASE_URL` coerente com `POSTGRES_DB`,
`POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_PORT`. Caracteres reservados de
usuário ou senha precisam ser codificados para uso na URL.

```powershell
Copy-Item .env.example .env.local
npm run db:local:config
npm run db:local:up
npm run migrate:local:up
npm run dev:local
```

Os comandos locais disponíveis são:

| Comando | Efeito |
|---|---|
| `npm run db:local:config` | valida silenciosamente a configuração do Compose |
| `npm run db:local:up` | inicia o banco e aguarda o healthcheck |
| `npm run db:local:logs` | acompanha os logs do serviço `postgres` |
| `npm run db:local:down` | encerra os containers e preserva o volume nomeado |
| `npm run migrate:local:up` | aplica migrations usando explicitamente `.env.local` |
| `npm run migrate:local:down -- 1` | desfaz migrations usando explicitamente `.env.local` |
| `npm run migrate:local:redo -- 1` | refaz migrations usando explicitamente `.env.local` |
| `npm run dev:local` | inicia a API carregando explicitamente `.env.local` |

O Compose não executa migrations nem inicia a API automaticamente. `down` e
`redo` continuam sendo operações destrutivas sobre o banco selecionado; confira
o alvo antes de executá-los. Não existe comando de remoção automática do volume.

`.env.local`, o Compose e os scripts `*:local` são exclusivos do
desenvolvimento. Em produção, use `npm start` com variáveis e segredos injetados
externamente pela plataforma; o processo produtivo não lê esses arquivos.

## Endpoints operacionais

| Endpoint | Comportamento |
|---|---|
| `GET /v1/health` | `200` enquanto o processo HTTP estiver ativo; não consulta o banco |
| `GET /v1/readiness` | `200` somente com PostgreSQL e PostGIS disponíveis; caso contrário, `503` |
| `GET /v1/openapi.json` | documento OpenAPI 3.1 gerado pelas rotas registradas |

A readiness possui timeout de até 2 segundos e volta a `200` quando a conexão
se recupera. Toda resposta possui `x-request-id`, gerado pelo servidor. Os logs
são estruturados e ocultam authorization, cookie, senhas, tokens e valores de
conexão. Falhas de PostgreSQL são expostas e registradas apenas com mensagens
seguras.

`SIGINT` e `SIGTERM` usam o mesmo shutdown idempotente: primeiro
`fastify.close()`, depois `pool.end()`. Chamadas repetidas aguardam a mesma
promessa e não fecham recursos novamente.

## Migrations

As migrations não rodam no startup da API. Execute-as explicitamente:

```console
npm run migrate:up
npm run migrate:down -- 1
npm run migrate:redo -- 1
```

`down` e `redo` alteram o banco indicado em `DATABASE_URL`; confirme o alvo
antes de executá-los. Cada comando verifica o manifesto antes de acessar o
banco.

Cada migration:

- usa um arquivo `NNNNNN-descricao.sql` em UTF-8 sem BOM e LF;
- contém exatamente uma seção `-- Up Migration` e uma
  `-- Down Migration`;
- possui uma entrada correspondente em `migrations/manifest.json`;
- é normalizada para UTF-8/LF antes do cálculo SHA-256;
- depois de integrada na branch-base, nunca é alterada, renomeada, removida ou
  reordenada.

Uma migration nova pode mudar enquanto o pull request estiver em construção.
Ao estabilizá-la, calcule o SHA-256 do texto normalizado e acrescente sua entrada
ao final do manifesto. Então execute:

```console
npm run migrations:verify
npm run migrations:verify-base -- --base-ref origin/nome-da-branch-base
```

A segunda verificação considera integrada somente a lista existente na
branch-base protegida. Ela detecta hash divergente, arquivo ou entrada ausente,
identificador duplicado, renomeação, exclusão, reordenação e alteração de uma
migration integrada. Uma correção posterior exige novo arquivo.

O `up` pode executar `CREATE EXTENSION IF NOT EXISTS postgis`. O `down` nunca
remove a extensão e desfaz somente objetos pertencentes ao aplicativo.

## Testes

| Comando | Dependência externa |
|---|---|
| `npm run test:unit` | nenhuma |
| `npm run test:http` | nenhuma; usa injeção HTTP do Fastify |
| `npm run test:integration` | daemon Docker acessível |

A integração usa exclusivamente a URL produzida por um Testcontainer
`postgis/postgis:17-3.5`, com banco `tche_agro_test`, ignorando qualquer
`DATABASE_URL` herdada do ambiente. O hook `pretest:integration` verifica o
manifesto antes de iniciar a suíte.

Testes destrutivos só podem prosseguir quando as três condições forem
verdadeiras simultaneamente:

1. `NODE_ENV=test`;
2. o nome do banco terminar em `_test`;
3. `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`.

Exemplo:

```powershell
$env:NODE_ENV = 'test'
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = 'true'
npm run test:integration
```

Se Docker estiver indisponível, a integração está bloqueada. Não substitua o
container por mock nem registre a suíte como aprovada. Os demais comandos
continuam obrigatórios.

## Build produtivo

```console
npm run build
npm run smoke:dist
npm start
```

`build` gera JavaScript ESM com `tsc`; `start` executa somente o conteúdo de
`dist`. O smoke confirma que o artefato compilado pode ser carregado sem usar o
loader TypeScript.
