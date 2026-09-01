# Backend Tchê Agro

Backend modular em Node.js 24, Fastify 5, TypeScript e PostgreSQL/PostGIS.
A fundação da MP-33A e a autenticação stateful, ações de conta, e-mail
transacional e auditoria da MP-33B estão concluídas tecnicamente.

A MP-33C conectou uma composição HTTP separada à autenticação e à leitura
autorizada de Propriedades. Ela foi integrada à branch `backend` pelo PR #2 no
commit `cc78a9f`, com CI pós-merge aprovada. O mock permanece somente no Demo e
nos testes; o aplicativo HTTP não possui fallback para ele.

A MP-34 acrescenta notificações in-app persistidas da própria conta, cinco
fluxos emissores transacionais, API, composição HTTP e purga one-shot. Ela está
concluída tecnicamente e integrada diretamente à branch `backend` no commit
`e787707`, sem pull request e com os três jobs da CI pós-push aprovados. Não
houve tag, deploy, release ou publicação. Os portões produtivos continuam
abertos, e o smoke Android físico específico da fase passou em 2026-08-24.

A MP-35A está concluída tecnicamente e integrada diretamente à branch
`backend` no commit `a51389e`, com os três jobs executados da CI pós-push
aprovados. Ela não cria endpoints: acrescenta contratos TypeScript e as
migrations append-only `000006`/`000007` com versões, limites, estados,
motivos, proteção do último Admin, idempotência administrativa e snapshot
nacional IBGE. Não houve tag, deploy, release ou publicação.

A MP-35B foi aprovada em reauditoria independente e integrada diretamente no
commit `60144c2`, com CI pós-push aprovada. A migration `000008` acrescenta
seis operações em `/v1/usuarios`, RBAC Admin revalidado no SQL, cursor cifrado
e autenticado, versão, idempotência, auditoria e convite/outbox atômicos. A
emissão antiga em `/v1/auth/invitations` foi removida; o aceite público
permanece. A MP-35C foi concluída e integrada diretamente à branch `backend`
no commit `e6789bf`, com CI pós-push aprovada; a auditoria independente
pós-correção foi aprovada, assim como a confirmação pós-integração. A MP-35D
não foi iniciada. Não houve tag, deploy, release ou publicação.

## Requisitos

- Node.js 24 LTS; o `package.json` exige `>=24 <25` e `.nvmrc` fixa `24`;
- npm, usando o `package-lock.json` próprio desta pasta;
- Docker para PostgreSQL/PostGIS, Mailpit local e `test:integration`;
- nenhuma instalação local de `psql` é necessária.

O aplicativo na raiz mantém Node.js 22 no respectivo job de CI. Instale e
valide o backend a partir desta pasta:

```console
npm ci
npm run migrations:verify
npm run typecheck
npm run test:unit
npm run test:http
npm run build
npm run smoke:dist
```

`npm run test:integration` é deliberadamente separado porque exige Docker.

## Processos e credenciais de banco

Produção usa cinco credenciais separadas no corte integrado. A MP-35A acrescenta
o sexto papel `NOLOGIN` `tche_agro_administration_maintenance`, com função SQL
one-shot estreita, ainda sem conta `LOGIN`, agendamento ou operação produtiva.
Os papéis criados pelas
migrations são `NOLOGIN`;
a plataforma deve provisionar contas `LOGIN` próprias
e conceder a associação correspondente.

| Processo | URL | Função/privilégio esperado |
|---|---|---|
| API | `DATABASE_URL` | membro de `tche_agro_runtime` |
| migrations | `MIGRATIONS_DATABASE_URL` | proprietário/migrador do schema |
| worker de e-mail | `OUTBOX_DATABASE_URL` | membro de `tche_agro_outbox_worker` |
| manutenção de notificações | `NOTIFICATIONS_MAINTENANCE_DATABASE_URL` | membro de `tche_agro_notifications_maintenance` |
| bootstrap de plataforma | `PLATFORM_DATABASE_URL` | membro de `tche_agro_platform_ops` |
| purga de idempotência administrativa | cliente SQL/credencial exclusiva ainda não provisionados | membro somente de `tche_agro_administration_maintenance` |

Em produção, não reutilize uma credencial entre esses processos. A credencial
de runtime não possui privilégio para alterar, excluir ou truncar auditoria; o
worker só recebe as operações necessárias da outbox; a manutenção de
notificações só consulta o backlog mínimo e exclui entregas/chaves expiradas e
eventos órfãos pelo comando de purga; a operação de plataforma fica limitada ao
primeiro bootstrap e à correção de seu convite pendente. Ela não recebe DML de
credenciais, sessões, access/refresh, autorizações, recuperações ou break-glass,
nem lê hashes de token, payload da outbox, Propriedades ou o histórico de
auditoria. Os DMLs colunares de Usuário, desafio, convite, outbox, bootstrap e
auditoria são aceitos somente quando compõem esse fluxo.

Os guards consideram `SESSION_USER`, impedem uma credencial de combinar os
papéis runtime/plataforma ou runtime/manutenção e validam, por constraints
diferidas, que a transação termine com Admin pendente, convite, desafio, outbox
e auditoria coerentes. O proprietário/migrador não é usado para servir HTTP.

O aceite de convite de Produtor e os fluxos legados de conta usam funções
`SECURITY DEFINER` estreitas que derivam e travam o agregado a partir da prova
válida. A `000008` revoga do runtime todo `INSERT`, `UPDATE` e `DELETE`
administrativo direto em `usuarios` e `produtores`, inclusive os grants
colunares herdados. As quatro mutações HTTP chamam funções transacionais
owned por `tche_agro_administration_owner`, papel seguro `NOLOGIN`, e somente
as interfaces operacionais necessárias possuem `EXECUTE` para
`tche_agro_runtime`; `PUBLIC` não executa nenhuma delas.

Para cada URL existe um CA opcional específico:
`DATABASE_SSL_CA`, `MIGRATIONS_DATABASE_SSL_CA`,
`OUTBOX_DATABASE_SSL_CA`, `NOTIFICATIONS_MAINTENANCE_DATABASE_SSL_CA` e
`PLATFORM_DATABASE_SSL_CA`. Em produção, SSL é obrigatório e sempre verifica o
certificado. As URLs não aceitam query nem fragmento, evitando conflito entre
`sslmode` e o objeto SSL tipado.

No desenvolvimento local, as cinco URLs executáveis podem apontar temporariamente para o
mesmo PostgreSQL do Compose. Isso é conveniência local e não modelo de
privilégios para produção.

## Configuração

[.env.example](.env.example) enumera as variáveis operacionais. Copie para o
arquivo ignorado `.env.local`, substitua todos os valores `replace_*` e não
versione segredos.

### API e banco

| Variável | Obrigatória | Padrão | Regra |
|---|---:|---|---|
| `DATABASE_URL` | Sim | — | URL `postgresql://` ou `postgres://`, com host, banco e porta válida |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `DATABASE_SSL_CA` | Não | raízes do sistema | certificado X.509 PEM válido |
| `HOST` | Não | `0.0.0.0` | host da porta HTTP |
| `PORT` | Não | `3000` | inteiro entre 1 e 65535 |
| `LOG_LEVEL` | Não | `info` | nível reconhecido pelo Pino |

Configuração inválida encerra o processo antes de abrir a porta. Uma
indisponibilidade temporária do PostgreSQL não impede a API de escutar: a
composição dos serviços valida configuração, blocklist e criptografia sem
consultar o banco. `/v1/readiness` passa a responder `503` até o banco se
recuperar, enquanto `/v1/health` permanece independente.

### Autenticação e senha

Os principais valores são:

- `PASSWORD_MIN_LENGTH=8` e `PASSWORD_MAX_LENGTH=128`;
- `PASSWORD_POLICY_VERSION` e `PASSWORD_BLOCKLIST_MANIFEST_PATH`;
- `ARGON2_MEMORY_KIB`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM` e
  `ARGON2_MAX_CONCURRENCY`;
- `AUTH_EMAIL_HMAC_KEY`, `AUTH_IP_HMAC_KEY` e
  `AUTH_EXTERNAL_REFERENCE_HMAC_KEY`, com chaves base64 distintas de pelo
  menos 32 bytes;
- validades `AUTH_ACCESS_TOKEN_TTL_SECONDS`,
  `AUTH_SESSION_ABSOLUTE_TTL_SECONDS`,
  `AUTH_SESSION_INACTIVITY_TTL_SECONDS`, `AUTH_INVITE_TTL_SECONDS`,
  `AUTH_ACTION_TTL_SECONDS`, `AUTH_PASSWORD_RECOVERY_TTL_SECONDS` e
  `AUTH_RESTRICTED_AUTHORIZATION_TTL_SECONDS`;
- proteção de login `AUTH_LOGIN_FAILURE_WINDOW_SECONDS`,
  `AUTH_LOGIN_FAILURE_THRESHOLD` e `AUTH_LOGIN_LOCK_SCHEDULE_SECONDS`;
- `ASSISTED_RECOVERY_ENABLED` e `ASSISTED_RECOVERY_POLICY_VERSION`.

A paginação administrativa de Usuários exige
`ADMIN_USER_CURSOR_ACTIVE_KEY_ID` e `ADMIN_USER_CURSOR_KEYS`. Esse keyring é
AES-256-GCM, não possui valor padrão ou fallback e deve ser materialmente
distinto de todas as chaves de `OUTBOX_ENCRYPTION_KEYS`; configuração ausente,
malformada, curta ou reutilizada impede o startup.

A MP-35C exige também `ADMIN_LINK_CURSOR_ACTIVE_KEY_ID`/
`ADMIN_LINK_CURSOR_KEYS` e `ADMIN_MUNICIPALITY_CURSOR_ACTIVE_KEY_ID`/
`ADMIN_MUNICIPALITY_CURSOR_KEYS`. Os três keyrings de cursor devem ser
distintos entre si e das chaves da outbox.

O carregador aplica os pisos e tetos aprovados; uma variável não pode reduzir
silenciosamente a segurança abaixo deles. Em produção, recuperação assistida
só pode ser habilitada com uma versão de política operacional informada.

### Outbox e SMTP

- `AUTH_ACTION_BASE_URL` é a única origem dos links de ação; produção exige
  HTTPS;
- `OUTBOX_ACTIVE_KEY_ID` e `OUTBOX_ENCRYPTION_KEYS` formam o keyring externo
  que protege o payload temporário;
- `OUTBOX_WORKER_ID`, `OUTBOX_WORKER_CONCURRENCY`,
  `OUTBOX_WORKER_BATCH_SIZE` e `OUTBOX_WORKER_POLL_INTERVAL_MS` controlam o
  worker;
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_FROM` e,
  quando necessários, `SMTP_USERNAME`/`SMTP_PASSWORD` configuram o envio;
- produção exige SMTP com TLS verificado; Mailpit é exclusivo de
  `development` e `test`.

Não registre a configuração completa, URLs de conexão, senhas, tokens, chaves
ou payloads da outbox. Os logs estruturados ocultam os campos sensíveis
previstos no contrato.

### Notificações e purga

O corte da MP-34 persiste entregas e chaves idempotentes por exatamente 90 dias.
A purga física não roda no startup nem em loop interno: é um comando one-shot,
idempotente e em lotes, com lock concorrente, tentativas limitadas para falhas
transitórias e log estruturado do resultado.

- `NOTIFICATIONS_MAINTENANCE_DATABASE_URL` identifica a credencial exclusiva de
  manutenção e é obrigatória em produção;
- `NOTIFICATIONS_MAINTENANCE_DATABASE_SSL_CA` configura seu CA opcional;
- `NOTIFICATIONS_PURGE_BATCH_SIZE` aceita de 1 a 5000 e usa 1000 por padrão.

O responsável, o agendamento/frequência e os alertas externos ainda são portões
produtivos. A revisão jurídica/de privacidade externa deve validar os 90 dias e
a premissa aprovada de que a MP-34 não implementa legal hold ou suspensão de
descarte. Se essa premissa for recusada, a mudança será futura e versionada antes
da produção.

### Idempotência administrativa e purga

Reservas administrativas expiram exatamente 90 dias após a criação. Uma conta
`LOGIN` exclusiva, membro apenas de `tche_agro_administration_maintenance`,
executa uma rodada explícita por cliente SQL:

```sql
SELECT public.tche_purgar_comandos_administrativos_mp35a(1000);
```

O limite aceito é de 1 a 5.000; `NULL` explícito e valores fora desse intervalo
são recusados com SQLSTATE `22023` antes de qualquer remoção. A omissão usa o
default limitado de 1.000. A função usa lote ordenado com
`FOR UPDATE SKIP LOCKED`, remove somente registros expirados e pode ser repetida.
O papel executor tem apenas `USAGE` no schema e `EXECUTE` nessa função; não tem
`SELECT`/`DELETE` direto na tabela. Conta que combine manutenção e runtime é
recusada. Provisionamento, frequência, timeout, monitoramento, alertas e
responsável permanecem portões produtivos; não há scheduler neste corte.

## Ambiente local com PostgreSQL e Mailpit

[compose.yaml](compose.yaml) usa `postgis/postgis:17-3.5` e
`axllent/mailpit:v1.30.4`, publicados somente em `127.0.0.1`. O Postgres mantém
os dados no volume nomeado `postgres_data`; a API e o worker continuam sendo
processos Node.js separados.

```powershell
Copy-Item .env.example .env.local
# Edite .env.local, substitua todos os replace_* e use chaves distintas.
npm run db:local:config
npm run db:local:up
npm run migrate:local:up
```

Para gerar uma chave base64 local de 32 bytes no PowerShell:

```powershell
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Gere um valor novo para cada finalidade. Para o keyring da outbox, associe uma
dessas chaves ao ID ativo no JSON de `OUTBOX_ENCRYPTION_KEYS`.

Depois das migrations, execute API e worker em terminais separados:

```powershell
npm run dev:local
npm run dev:outbox:local
```

A interface local do Mailpit fica em `http://127.0.0.1:8025`. O SMTP local usa
`127.0.0.1:1025`. Mailpit captura mensagens de teste; ele não é provedor de
produção.

| Comando | Efeito |
|---|---|
| `npm run db:local:config` | valida silenciosamente a configuração do Compose |
| `npm run db:local:up` | inicia Postgres e Mailpit e aguarda os healthchecks |
| `npm run db:local:logs` | acompanha os logs do serviço `postgres` |
| `npm run db:local:down` | encerra os containers e preserva o volume nomeado |
| `npm run migrate:local:up` | aplica migrations com `.env.local` |
| `npm run migrate:local:down -- 1` | desfaz migrations com `.env.local` |
| `npm run migrate:local:redo -- 1` | refaz migrations com `.env.local` |
| `npm run dev:local` | inicia a API com `.env.local` |
| `npm run dev:outbox:local` | inicia o worker de e-mail com `.env.local` |
| `npm run notifications:purge:local` | executa uma rodada explícita da purga com `.env.local` |

O Compose não executa migrations, API, worker, purga nem bootstrap
automaticamente.
Não existe comando de remoção automática do volume.

## Bootstrap do primeiro Administrador

O bootstrap é CLI, one-shot e não possui rota HTTP. Ele cria o primeiro Admin
e enfileira seu convite; não imprime senha nem token. Antes de executar:

1. aplique as migrations;
2. configure `PLATFORM_DATABASE_URL`;
3. inicie Mailpit/SMTP e o worker;
4. habilite explicitamente `INITIAL_ADMIN_BOOTSTRAP_ENABLED=true` somente
   durante a operação.

No desenvolvimento local:

```powershell
npm run bootstrap:admin:local:init -- --name "Nome do Admin" --email "admin@example.com"
```

Se o endereço foi digitado incorretamente e o convite ainda não foi aceito:

```powershell
npm run bootstrap:admin:local:correct -- --email "correto@example.com"
```

`--organization-id` é opcional e usa `org_tche_fertilidade` por padrão. A
correção revoga convite/outbox anteriores, cria novo convite e fica bloqueada
depois do aceite. Desabilite novamente o flag após a operação. No artefato
compilado, o entrypoint é `npm run bootstrap:admin -- initialize ...` ou
`npm run bootstrap:admin -- correct-email ...`.

Convites comuns posteriores usam a API e aceitam somente um `usuario`
pendente já existente.

## Break-glass de Administrador: indisponível

A MP-33B não implementa o início break-glass. Se um Admin perder os dois
endereços, não há recuperação operacional neste backend; o caminho disponível
é a recuperação pelo segundo e-mail previamente verificado.

[break-glass-admin.ts](src/cli/break-glass-admin.ts) permanece somente como
scaffold fail-closed: o parser compila, mas qualquer tentativa de `start` falha
antes de acessar o banco. A porta e o serviço de domínio permanecem apenas como
abstrações não conectadas. Não existe script npm, configuração ou wiring
operacional, implementação concreta do verificador/emissor, chave HMAC nem
permissão de start para `tche_agro_platform_ops`.

O schema e os dois `POST` de continuação permanecem como scaffold inalcançável:
esta fase não consegue criar um caso, desafio ou autorização que eles possam
consumir. Eles não devem ser apresentados nem operados como recuperação pronta.

Antes de implementar ou habilitar qualquer start, é pré-requisito técnico
adotar assinatura assimétrica Ed25519, mantendo apenas a chave pública no
backend, ou um serviço externo equivalente. A solução deve comprovar dois
aprovadores distintos, finalidade, expiração, anti-replay e custódia externa,
além de testes ponta a ponta e nova migration append-only quando houver impacto
persistido. HMAC simétrico não é uma opção aprovada para esse fluxo.

## Endpoints HTTP

### Operação

| Endpoint | Comportamento |
|---|---|
| `GET /v1/health` | `200` enquanto o processo HTTP estiver ativo; não consulta o banco |
| `GET /v1/readiness` | `200` somente com PostgreSQL e PostGIS disponíveis; caso contrário, `503` |
| `GET /v1/openapi.json` | OpenAPI 3.1 das rotas registradas |

### Autenticação e sessão

Todas as rotas abaixo começam em `/v1/auth`.

| Método e caminho | Comportamento |
|---|---|
| `POST /login` | autentica e cria sessão stateful |
| `POST /refresh` | gira access e refresh de forma atômica |
| `POST /logout` | revoga a sessão atual de forma idempotente |
| `POST /logout-all` | revoga todas as sessões do usuário |
| `GET /me` | retorna identidade, sessão e versão/modo de escopo, sem Propriedades |
| `GET /sessions` | lista as sessões do próprio usuário |
| `DELETE /sessions/:sessionId` | revoga uma sessão pertencente ao usuário |
| `POST /password/change` | troca senha, revoga outras sessões e gira a sessão atual |
| `POST /password-recovery/request` | responde uniformemente e enfileira recuperação quando aplicável |
| `POST /password-recovery/complete` | define nova senha, revoga tudo e não autentica automaticamente |

Access e refresh são tokens opacos de 256 bits. Somente SHA-256 é persistido.
Access vale no máximo 15 minutos; a sessão possui limite absoluto de 30 dias e
inatividade de 14 dias desde o refresh bem-sucedido. Replay de refresh revoga
a família comprometida, sem janela de tolerância.

As respostas que emitem ou giram tokens preservam `expires_in` e acrescentam
os instantes efetivamente persistidos: `emitido_em`, `access_expira_em`,
`sessao.expira_inatividade_em` e `sessao.expira_absolutamente_em`. O cliente
não precisa reconstruir esses limites a partir de seu próprio relógio.

### Propriedades somente leitura

| Endpoint | Comportamento |
|---|---|
| `GET /v1/propriedades` | lista o escopo autorizado com cursor estável `nome` + `id`, limite padrão 50 e máximo 100 |
| `GET /v1/propriedades/:id` | retorna o detalhe autorizado; inexistente e fora do escopo respondem o mesmo `404` |

Os filtros aceitos são somente `busca`, `status`, `uf` e `municipio`. `uf`
compara `uf_id` ou `uf_sigla`; `municipio` compara `municipio_id` ou nome; a
busca trata `%`, `_` e `\` como caracteres literais. Filtros sempre reduzem o
escopo calculado no SQL e nunca concedem acesso.

Admin vê as Propriedades ativas e inativas da organização. Produtor vê apenas
ativas por Titularidade derivada ou vínculo `usuario_autorizado` ativo, desde
que Usuário e cadastro de Produtor estejam ativos. Colaborador vê apenas
ativas por vínculo `colaborador` direto e ativo. `tipo_acesso` é calculado e
`titular_id` continua sendo a única fonte persistida da Titularidade. As
respostas são `no-store` e não incluem aliases legados.

### Convites e ações de conta

Também sob `/v1/auth`:

| Caminho | Comportamento |
|---|---|
| `/invitations/accept` | aceite público de convite com definição de senha; responde `204 No Content` |
| `/email-change/*` | troca autenticada com senha atual e duas confirmações |
| `/secondary-email/*` | cadastro e confirmação do contato secundário de Admin |
| `/admin-secondary-recovery/*` | recuperação de Admin pelo contato secundário já verificado, sem login automático |
| `/admin-break-glass/confirm-email` e `/admin-break-glass/complete` | scaffold público `no-store`, inalcançável enquanto não existir um start assimétrico aprovado |
| `/assisted-recovery/*` | recuperação de Produtor/Colaborador iniciada por Admin e concluída pelo usuário |

Recuperação assistida de conta Administradora por HTTP é proibida. A de
Produtor/Colaborador fica desabilitada por padrão em produção até existir
política operacional versionada de comprovação de identidade. Nome, documento,
Município, Propriedade ou telefone não verificado não constituem isoladamente
prova suficiente.

O fluxo operacional de recuperação de Admin usa exclusivamente o segundo e-mail
previamente verificado. Perda dos dois endereços permanece sem solução nesta
fase; o scaffold break-glass não cria caso, token, sessão ou auto-login.

Respostas com segredos usam `Cache-Control: no-store`, `Pragma: no-cache` e
`Referrer-Policy: no-referrer`. Toda resposta possui `x-request-id`.

A emissão administrativa não fica sob `/v1/auth`: a única rota é
`POST /v1/usuarios/:id/convites`, autenticada e exclusiva de Admin. A antiga
`POST /v1/auth/invitations` não existe.

### Notificações in-app

Todas as rotas usam a identidade da sessão e retornam somente entregas do
próprio Usuário na organização atual. Admin não consulta histórico alheio;
entrega ausente, expirada, descartada ou de outro destinatário/organização usa o
mesmo `404`. As respostas são `no-store`.

| Método e caminho | Comportamento |
|---|---|
| `GET /v1/notificacoes` | lista por cursor estável, com `estado`, `limite` e `cursor` como únicos filtros |
| `GET /v1/notificacoes/contador-nao-lidas` | conta pelo mesmo filtro autorizado da lista |
| `POST /v1/notificacoes/:id/leitura` | preserva o primeiro horário de leitura |
| `POST /v1/notificacoes/leituras` | marca elegíveis até o corte fixado pelo servidor |
| `DELETE /v1/notificacoes/:id` | registra descarte sem exclusão física imediata |
| `POST /v1/notificacoes/:id/resolver-destino` | reautoriza e retorna somente `conta` + UUID canônico |

Leitura individual, leitura em lote e descarte exigem `Idempotency-Key`. Retry
explícito de resultado ambíguo reutiliza a mesma chave; uma nova ação após
sucesso usa outra. O cliente não informa destinatário, organização, horário de
corte, URL ou nome de tela. Esses três comandos monotônicos não aceitam
`version` nem versão-base: a chave fica vinculada ao comando, alvo/corte e hash
do pedido. Isso não altera a versão-base obrigatória de outras transições
versionadas.

As quatro rotas `POST`/`DELETE` de comando ou resolução não declaram nem aceitam
corpo. UUID hifenizado em caixa diferente é normalizado para minúsculas antes
do hash e da consulta; URN e outras formas não canônicas respondem `400`.

O catálogo inicial contém três tipos: senha alterada, e-mail principal alterado
e recuperação concluída. Cinco fluxos emissores transacionais os produzem:
troca de senha, alteração normal de e-mail, recuperação comum, recuperação de
Administrador por segundo e-mail e recuperação assistida. Todos gravam evento e
entrega para o próprio Usuário na mesma transação do fato de conta e usam
templates fixos, sem dado pessoal, segredo, HTML, URL ou texto livre.
`outbox_email` permanece separada; push, tokens de dispositivo, cache persistente
e operação offline não entram.

## Senhas, blocklist e benchmark Argon2id

A senha é normalizada em NFC, preserva espaços, possui 8–128 pontos de código
Unicode, exige a regra aprovada `1-de-3` (`Lu` ou `Nd` ou `P`/`S`) e é comparada
integralmente, em chave normalizada separada, contra a blocklist. Não há
`trim`, busca por substring ou troca periódica sem evidência.

O manifesto [passwords.manifest.json](security/blocklists/passwords.manifest.json)
fixa fonte, licença, versão, contagem e SHA-256 de cada artefato. Em `test` e
`production`, arquivo ausente, vazio, com contagem ou hash divergente bloqueia
os fluxos. A atualização da lista é deliberada e revisada.

Argon2id usa PHC completo e a versão exata da dependência. Os parâmetros têm
piso de 19 MiB, duas iterações e paralelismo 1. Antes do Argon2, o login faz
precheck persistido primeiro por IP e depois pelo HMAC do identificador; um
bloqueio responde `429` com `Retry-After` e não consome Argon2.

Um semáforo limita o trabalho ativo a `ARGON2_MAX_CONCURRENCY` e admite no
máximo a mesma quantidade de requisições aguardando. Acima desses dois limites,
o backend falha rapidamente com `429` genérico e `Retry-After: 1`, sem registrar
falha de credencial nem criar bloqueio falso. Login válido executa rehash quando
necessário.

Calibre no mesmo tipo de CPU e limite de memória do ambiente-alvo:

```console
npm run benchmark:argon2
```

O comando emite cinco amostras de hash+verificação e os tempos resumidos. Ele é
um portão manual de capacidade, não um gate de duração da CI; os testes da CI
continuam exercitando Argon2id real. Registre os valores escolhidos e valide o
produto `ARGON2_MEMORY_KIB × ARGON2_MAX_CONCURRENCY` antes de liberar.

## Worker da outbox

O worker é um processo separado da API:

```console
npm run dev:outbox
npm run start:outbox
```

Ele faz claim concorrente com lease e, depois de obter os locks coordenados,
consulta novamente o relógio do PostgreSQL e revalida imediatamente antes do
dispatch a mensagem, o lease, o desafio e o convite aplicável. Só então
descriptografa o payload para entrega, usa timeout/backoff/tentativas limitadas
e grava aceitação SMTP antes de limpar o material sensível. A entrega é pelo
menos uma vez; desafios são de uso único, tornando repetição inofensiva.
`SIGINT` e `SIGTERM` encerram o loop e o pool de forma idempotente.

O dispatch SMTP ainda ocorre com a transação e o advisory lock da entidade
abertos para preservar essa fronteira linearizável. Antes de produção, a
capacidade e a latência precisam ser ensaiadas com SMTP e contenção
representativos; Testcontainers e Mailpit não dimensionam esse custo.

## Auditoria

Eventos críticos são inseridos na mesma transação da mudança de estado. A
tabela append-only distingue `ator_usuario_id`, `sessao_id` do ator e
`usuario_afetado_id`, todos protegidos por referências da mesma organização;
também preserva request ID, recurso, resultado, motivo categorizado e metadados
em allowlist quando aplicáveis.

A sessão de auditoria sempre pertence ao ator informado. Fluxos públicos sem
sessão usam ator `sistema` e mantêm separado o Usuário afetado. A operação de
plataforma só pode inserir os dois eventos do bootstrap corrente, na mesma
transação e com estado final coerente.

Senha, token, endereço desconhecido desnecessário, documentos, conversa,
headers, payload completo, conexão e chave não entram na auditoria. API,
worker e bootstrap de plataforma podem inserir somente os eventos permitidos
de seu fluxo, mas não atualizar, excluir ou truncar o histórico.

## Migrations

As migrations usam exatamente `node-pg-migrate@9.0.0` e não rodam no startup
da API ou do worker:

```console
npm run migrate:up
npm run migrate:down -- 1
npm run migrate:redo -- 1
```

Em produção, esses comandos exigem `MIGRATIONS_DATABASE_URL`. Cada comando
verifica o manifesto antes de acessar o banco. `down` e `redo` são destrutivos
para o alvo selecionado; confirme a URL e a quantidade.

Cada migration:

- usa `NNNNNN-descricao.sql` em UTF-8 sem BOM e LF;
- contém `-- Up Migration` e `-- Down Migration` explícitos;
- possui entrada em `migrations/manifest.json` calculada sobre UTF-8/LF;
- depois de integrada na branch-base, nunca é alterada, renomeada, removida ou
  reordenada.

```console
npm run migrations:verify
npm run migrations:verify-base -- --base-ref origin/backend
```

A verificação contra a branch-base detecta hash divergente, arquivo ou entrada
ausente, identificador duplicado, renomeação, exclusão, reordenação e alteração
integrada. Correção posterior exige nova migration. O `down` não remove
PostGIS e não usa cascata destrutiva.

Na MP-35A, `000006-fundacao-administrativa-mp35a.sql` cria a fundação de
administração e `000007-catalogo-ibge-2026-08-25.sql` carrega 27 UFs e 5.571
Municípios. O snapshot é gerado de uma captura explícita da API oficial pelo
script `scripts/generate-ibge-snapshot-migration.mjs`; o backend não consulta o
IBGE em runtime. O gerador recusa sobrescrever destino existente, valida
consistência dos metadados de UF e produz versões publicadas imutáveis; o banco
permite somente marcar a versão ativa como `substituido`.

Na MP-35B, `000008-administracao-usuarios-mp35b.sql` retira o DML direto de
Usuários, Produtores e da idempotência administrativa do runtime. Funções
estreitas reservam e concluem o comando, validam sessão/ator/alvo/versão,
aplicam mutação, convite/outbox, auditoria e recibo no mesmo commit. Um trigger
preserva o ciclo e a identidade do recibo; sua função também tem `EXECUTE`
explicitamente revogado de `PUBLIC`.

A mesma migration revoga do runtime todo `INSERT` direto, de tabela ou coluna,
em `eventos_auditoria`. Os quatro eventos administrativos são gravados somente
dentro das respectivas operações `SECURITY DEFINER`, com ator, sessão,
organização, recurso e ação derivados pelo servidor. Autenticação, ações de
conta e notificações usam interfaces de evento fixo que exigem a transição de
domínio na transação corrente; o escritor genérico é interno ao owner `NOLOGIN`
e não possui `EXECUTE` para runtime nem `PUBLIC`. Plataforma de bootstrap e
worker de outbox conservam seus escritores separados, já limitados pelas
triggers transacionais da MP-33B.

## Testes e validação

| Comando | Cobertura | Dependência externa |
|---|---|---|
| `npm run test:unit` | configuração, blocklist/Argon2, serviços, adaptadores, outbox, notificações, purga e contratos estáticos de migration | nenhuma |
| `npm run test:http` | health/readiness, OpenAPI, autenticação, ações de conta, administração de Usuários e notificações por injeção Fastify | nenhuma |
| `npm run test:integration` | migrations, upgrade adversarial MP-35A, administração MP-35B/C, duas conexões com barreira de lock, repositórios reais, atomicidade, concorrência, retenção/purga e privilégios dos papéis | Docker |

Na rodada técnica da MP-34 foram confirmados 138 testes unitários/contratos de
migration, 26 HTTP e 41 cenários reais de integração: 15 de migrations, 8 de
autenticação, 7 de ações de conta, 9 de Propriedades/QA e 2 de notificações.

A rodada focalizada da MP-35A confirmou 152 testes unitários/contratos, 26 HTTP
e 54 cenários reais de integração. Entre eles estão oito cenários adversariais
de upgrade, login runtime real, atomicidade, vínculo ator-sessão, papel mínimo
de purga e concorrência. O corte foi integrado diretamente à branch `backend`
no commit `a51389e`, e os três jobs executados da CI pós-push foram aprovados.
Não houve tag, deploy, release ou publicação.

A reauditoria focal acrescenta em
`administrative-user-e2e.integration.test.ts` a matriz exata das seis rotas
para Admin, ausência de bearer, sessão stale, Produtor e Colaborador; e em
`administrative-user-repository.integration.test.ts` a observação dos PIDs e
`wait_event` reais nas sete corridas exigidas. A rodada integral de 2026-08-27
passou com 166 testes unitários/contratos, 33 HTTP e 74 integrações
PostgreSQL/PostGIS, incluindo o ciclo explícito `000008 up/down/up`. A fase foi
integrada diretamente no commit `60144c2`, com CI pós-push aprovada e sem tag,
deploy, release ou publicação.

A validação final local da MP-35C em 2026-08-31 passou com 186 testes
unitários/contratos, 40 HTTP e 100 integrações PostgreSQL/PostGIS. A integração
completa passou 100/100 em três execuções consecutivas, incluindo decimal
textual exato, decoder anterior ao `COMMIT`, rollback real, `000009` up/down/up,
roles/ACLs, D13, concorrência de domínio e três containers iniciados em
processos simultâneos com portas dinâmicas. A fase foi integrada diretamente
no commit `e6789bf`, com CI pós-push aprovada.

A correção focal adicional validou `area_total` com fim absoluto, sem `$`,
contra LF, CR, CRLF, U+2028 e U+2029 nas fronteiras HTTP, TypeScript e SQL. Sob
`--unhandled-rejections=strict`, passaram 20/20 execuções do teste focal, 5/5
da suíte MP-35C com 61/61 testes por rodada e 3/3 da integração completa com
100/100 por rodada, sem warning, cancelamento ou rerun corretivo.

A integração usa exclusivamente a URL de um Testcontainer
`postgis/postgis:17-3.5`, com banco terminado em `_test`, ignorando
`DATABASE_URL` do ambiente. Cada processo usa banco e role exclusivos; Docker
escolhe atomicamente a porta do host para a porta interna `5432`, e o teste lê
o mapeamento somente depois do `start`. Não existe reserva manual de porta,
arquivo global de lock ou recuperação artesanal por `stat`/`unlink`. O hook
`pretest:integration` verifica o manifesto.

Testes destrutivos só prosseguem com as três travas simultâneas:

1. `NODE_ENV=test`;
2. nome do banco terminado em `_test`;
3. `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`.

```powershell
$env:NODE_ENV = 'test'
$env:ALLOW_DESTRUCTIVE_DATABASE_TESTS = 'true'
npm run test:integration
```

Se Docker estiver indisponível, a integração está bloqueada. Não use mock nem
registre a suíte como aprovada. As validações independentes continuam
obrigatórias.

## Fixtures sintéticas manuais

O loader de QA é um comando explícito e separado; não roda no startup, nas
migrations ou nos testes automaticamente. Ele cria Usuários sintéticos ativos
e PHCs Argon2id a partir de uma senha temporária obrigatória fornecida pelo
operador; a senha não é fixa, não é impressa nem persistida em texto.

| E-mail sintético | Perfil | Cenário principal |
|---|---|---|
| `qa.produtor.1@qa.invalid` | Produtor | Titular de Propriedade ativa e inativa |
| `qa.produtor.2@qa.invalid` | Produtor | Titular de uma ativa e autorizado em outra |
| `qa.colaborador@qa.invalid` | Colaborador | Vínculo direto em duas Propriedades ativas |

Os três logins usam exclusivamente a senha temporária informada no comando.

```powershell
$env:NODE_ENV = 'development' # também aceita test ou qa
$env:ALLOW_QA_FIXTURES = 'true'
$env:QA_FIXTURES_DATABASE_URL = 'postgresql://usuario:senha@127.0.0.1:5432/tche_agro_qa'
$env:QA_FIXTURES_PASSWORD = '<senha temporária exclusiva de QA>'
npm run fixtures:qa
```

As três travas são simultâneas: ambiente permitido, flag exatamente `true` e
banco terminado em `_test` ou `_qa`. `production` é recusado sempre. O comando
exige `QA_FIXTURES_DATABASE_URL`, nunca usa `DATABASE_URL` como fallback, é
idempotente para seus IDs reservados e contém somente dados sintéticos. Se um
ID reservado já existir com campos divergentes, ou se a senha não validar os
PHCs existentes, toda a execução é revertida sem sobrescrever esse estado.
Remova `QA_FIXTURES_PASSWORD` do ambiente após a execução.

## Build e execução produtiva

```console
npm run build
npm run smoke:dist
npm start
npm run start:outbox
npm run notifications:purge
```

`build` gera JavaScript ESM com `tsc`; a API, o worker e a CLI produtiva de
bootstrap executam somente `dist`; a purga também usa seu módulo compilado.
`smoke:dist` carrega API, servidor, worker, bootstrap e o parser do scaffold
fail-closed de break-glass sem executar comandos operacionais. Isso não
transforma o scaffold em CLI disponível. API e worker devem ser supervisionados
como processos separados. A purga é uma execução one-shot disparada por
orquestração externa e recebe sua própria credencial.

`SIGINT` e `SIGTERM` fecham Fastify/pool na API e loop/pool no worker. Migrations,
purga e CLI de bootstrap continuam comandos explícitos, nunca efeitos
colaterais de startup.

Antes de liberação pública ainda são obrigatórios MFA de Admin, política
operacional de recuperação assistida, benchmark Argon2id no ambiente real,
benchmark da busca infixa `ILIKE` de Usuários no volume esperado, ensaio de
capacidade/latência do SMTP enquanto a transação e o lock do outbox permanecem
abertos, provisionamento/rotação independente do keyring de cursor,
SMTP/segredos, observabilidade, backup/restauração, responsável/agendamento e
alertas da purga, credencial/CA/segredo de manutenção e validação
jurídica/de privacidade externa da retenção de 90 dias. O Android físico da
MP-34 passou em 2026-08-24; a MP-35A não altera o aplicativo.
Antes das escritas administrativas produtivas também são obrigatórios o
provisionamento/runbook/operação da purga idempotente e o ensaio de
`000006`/`000007` em cópia
anonimizada com volume e contenção representativos. Testcontainers não
substituem esse ensaio.
Break-glass permanece uma capacidade não implementada; Ed25519 ou serviço
externo equivalente com dois aprovadores é pré-requisito para iniciá-la.

A MP-34 está concluída tecnicamente e integrada diretamente à branch `backend`
no commit `e787707`, sem pull request e com os três jobs da CI pós-push
aprovados. Não houve tag, deploy, release ou publicação dessa fase.
