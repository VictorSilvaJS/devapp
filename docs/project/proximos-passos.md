# Próximos Passos

> Atualizado em: 2026-08-24
>
> Próxima tarefa: revisar e, mediante autorização explícita, criar o commit
> local do corte de convergência visual; depois preparar a MP-35
>
> Estado: MP-33A, MP-33B, MP-33C E MP-34 INTEGRADAS; CONVERGÊNCIA VISUAL
> IMPLEMENTADA E APROVADA NO ANDROID FÍSICO, AINDA NÃO COMITADA; SEM TAG,
> DEPLOY, RELEASE OU PUBLICAÇÃO; PORTÕES PRODUTIVOS PENDENTES

## Ponto de partida

O corte local MP-00 a MP-32 e a fundação MP-33A estão concluídos. A corrida
visual ao reabrir no mapa um ponto já persistido no Caderno foi corrigida e
revalidada no Android em `ATUAL-04`; ela não altera os contratos nem a sequência
do backend. A MP-33B foi concluída tecnicamente, sem alterar o mock nem conectar
o aplicativo, e integrada à branch-base `backend`. A MP-33C também foi
concluída tecnicamente e integrada à mesma base pelo PR #2 no commit `cc78a9f`:
o Demo foi preservado, a composição HTTP recebeu sessão segura e ações
self-service, e o backend passou a oferecer lista/detalhe autorizados de
Propriedades. A CI pós-merge foi aprovada. Não houve tag, deploy, release,
assinatura ou publicação.

A MP-34 implementou notificações in-app reais, persistidas e isoladas para fatos
da própria conta. Ela foi integrada diretamente à branch `backend` no commit
`e787707`, sem pull request; os três jobs da CI pós-push foram aprovados. A
verificação complementar confirmou as cinco migrations e o caráter append-only
da `000005` contra `3dd8f42`. Não houve tag, deploy, release ou publicação. O
smoke funcional Android físico específico da MP-34 passou em 2026-08-24.

Uma auditoria posterior confirmou que a fila MP-35 a MP-41 não continha uma
entrega explícita de convergência entre a interface aprovada no Demo e as
verticais HTTP. O corte corretivo anterior à MP-35 passa a reutilizar
apresentações e componentes existentes, sem misturar fontes de dados. Sua
validação em Android físico era o portão anterior às escritas administrativas e
passou em 2026-08-24 depois da correção da barra inferior para respeitar a safe
area gestual nas composições Demo e HTTP.

## MP-33A — Fundação do backend e banco

Objetivo: criar o primeiro corte executável do backend e do banco sem alterar
o mock, introduzir autenticação parcial ou conectar o aplicativo por HTTP.

Resultado em 2026-08-18: concluído e validado, inclusive com PostgreSQL/PostGIS
real em Testcontainers. A execução não criou tag nem realizou deploy.

Entrega mínima:

1. serviço modular em Node.js 24 LTS, Fastify 5, `pg`, `env-schema`, ESM e
   TypeScript `NodeNext`, sem ORM;
2. API REST sob `/v1`, OpenAPI, health e readiness recuperável;
3. PostgreSQL/PostGIS 17-3.5 com DDL e migrations SQL reversíveis;
4. tabelas de organização, Usuários, Produtores, Propriedades e acessos
   adicionais;
5. `propriedades.titular_id` como única fonte persistida da Titularidade;
6. manifesto SHA-256 e proteção append-only das migrations;
7. SSL produtivo verificado, logs estruturados e graceful shutdown;
8. testes unitários/HTTP sem Docker e integração separada com Testcontainers;
9. CI com o aplicativo em Node.js 22 e o backend em Node.js 24;
10. documentação operacional e contratos ativos alinhados.

Critério de aceite:

- mock e job do aplicativo permanecem inalterados;
- nenhuma autenticação, sessão ou integração HTTP parcial é introduzida;
- configuração inválida falha cedo, mas banco indisponível não impede a porta
  HTTP de abrir;
- `/v1/health` independe do banco e `/v1/readiness` reflete PostgreSQL e
  PostGIS com timeout curto e recuperação;
- migrations não executam no startup, possuem `up/down` explícitos e não
  removem automaticamente o PostGIS;
- testes destrutivos exigem as três travas aprovadas e integração usa somente
  a URL do Testcontainer;
- todas as validações independentes de Docker passam; indisponibilidade do
  Docker é registrada como bloqueio da integração, nunca como aprovação.

## Sequência interna da MP-33

### MP-33B — Autenticação, ações de conta e e-mail

O código concluído tecnicamente inclui:

1. senha Unicode/NFC com blocklist versionada e Argon2id com trabalho ativo e
   fila limitados; saturação falha com `429` sem contar erro de credencial;
2. login uniforme, prechecks por IP/HMAC antes do Argon2id, sessões stateful,
   access/refresh opacos, rotação estrita e revogação;
3. convites para Usuário pendente existente, recuperação comum, troca de
   senha/e-mail e gestão de sessões;
4. contato secundário e recuperação self-service de Admin, sem login
   automático;
5. recuperação assistida somente de Produtor/Colaborador, condicionada a
   política operacional versionada em produção;
6. outbox criptografada, worker SMTP separado e Mailpit exclusivamente local;
7. auditoria append-only e quatro credenciais separadas: runtime, migrations,
   outbox e plataforma bootstrap-only, protegida por `SESSION_USER` e estado
   final diferido;
8. bootstrap one-shot e correção de e-mail por CLI; break-glass preservado
   somente como scaffold fail-closed/inalcançável, sem start, HMAC ou script;
9. migrations novas com manifesto SHA-256, OpenAPI e testes unitários, HTTP e
   de integração ampliados.

Validação executada com Node.js 24.19.0:

- manifesto e comparação append-only: 4/4 migrations;
- testes unitários e contratos estáticos de migration: 114/114;
- testes HTTP: 19/19;
- integração real com PostgreSQL/PostGIS por Testcontainers: 27/27;
- typecheck, build e smoke ESM compilado da API, worker, bootstrap e parser
  fail-closed: passaram;
- Compose e ciclo local Postgres + Mailpit + worker SMTP: passaram;
- aplicativo em Node.js 22: typecheck e `test:domain-compat` passaram;
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas no resultado
  executado.

Antes da produção, ainda é necessário executar o benchmark Argon2id no
ambiente-alvo e fechar MFA de Admin, política de identidade, SMTP/segredos,
backup/restauração e observabilidade. Break-glass não está implementado;
Ed25519 ou serviço externo equivalente com dois aprovadores é pré-requisito
técnico para qualquer evolução desse scaffold.

| Ordem | Tarefa | Objetivo | Estado |
|---:|---|---|---|
| 33A | MP-33A | Fundação, DDL, operação, testes e CI | CONCLUÍDA |
| 33B | MP-33B | Autenticação, sessões, refresh, convites, recuperação e auditoria genérica | CONCLUÍDA TECNICAMENTE; NÃO LIBERADA PARA PRODUÇÃO |
| 33C | MP-33C | Demo/HTTP separados, sessão segura e leitura de Propriedades | CONCLUÍDA E INTEGRADA PELO PR #2 EM `cc78a9f`; PORTÕES PRODUTIVOS PENDENTES |

O mock permanece integralmente inalterado nas MP-33A e MP-33B. Na MP-33C ele
continua no Demo e nos testes, mas fica fisicamente fora do grafo de produção.
A composição HTTP adapta o vínculo local `titular` para o `tipo_acesso`
calculado pelo backend sem mudar a representação persistida do Demo.

## MP-33C — Integração do aplicativo e primeira vertical

Contrato: [contrato-integracao-app-mp33c.md](contrato-integracao-app-mp33c.md).

Resultado implementado:

1. raízes/configurações separadas para HTTP e Demo, com
   `com.tcheagro.mobile` e `com.tcheagro.mobile.demo`;
2. mock preservado no Demo/testes e ausente dos grafos JavaScript e Android da
   composição HTTP, sem fallback;
3. portas HTTP de autenticação, conta e Propriedades, com access token em
   memória, refresh no SecureStore, single-flight e rotações serializadas;
4. restauração sob lock, proteção visual imediata no background, novo login
   depois de 15 minutos em background e lock local por inatividade sem logout;
5. `GET /v1/propriedades` e `GET /v1/propriedades/:id`, somente leitura, com
   autorização na consulta, cursor e filtros no servidor;
6. lista/detalhe HTTP sem métricas incompletas ou ações exclusivas do Demo;
7. ações self-service da MP-33B, inclusive segundo e-mail verificado do Admin,
   com tokens de link somente em memória;
8. App Links/Universal Links configuráveis por origem e caminho dedicados;
9. fixtures sintéticas de integração e carregador manual protegido por
   ambiente, flag, URL dedicada, sufixo do banco e senha;
10. CI, inspeção de bundles e prebuild temporário da composição HTTP.

Validação executada:

- aplicativo Node.js 22: typecheck, `test:domain-compat` e 38/38 testes focados
  da MP-33C;
- exports Android HTTP/Demo: passaram; o scanner confirmou mock e
  `AsyncStorage` ausentes do bundle HTTP e Demo preservado;
- Expo Autolinking: passou; dependências exclusivas do Demo ficaram fora do
  grafo nativo Android HTTP e permaneceram disponíveis no Demo;
- prebuild HTTP: passou com ID definitivo, App Link dedicado, backup seguro e
  somente permissão efetiva `INTERNET`;
- backend Node.js 24: manifesto, typecheck, 126/126 unitários/contratos,
  23/23 HTTP, build e smoke ESM passaram;
- integração real com Testcontainers/PostGIS: 36/36; Docker esteve disponível.

Critérios satisfeitos no corte técnico:

- produção usa somente HTTP e nunca recua para mock;
- Demo preserva o funcionamento e os testes atuais;
- sessão/tokens HTTP não usam `AsyncStorage`;
- navegação e deep links HTTP expõem somente funcionalidades reais;
- lista/detalhe usam contrato `snake_case`, `tipo_acesso` calculado, cursor,
  filtros no servidor e escopo validado pelo backend;
- a composição HTTP é online-only e comunica indisponibilidade honestamente;
- nenhum seed automático/produtivo, tag, deploy, release ou publicação;
- a execução real da integração usou Docker; uma futura indisponibilidade deve
  continuar sendo registrada como bloqueio, nunca como aprovação simulada.

Continuam fora da MP-33C: criação/edição/inativação de Propriedades,
transferência de Titularidade, gestão de Usuários/vínculos, demais recursos de
negócio HTTP, offline seguro, MFA, deploy e publicação. As operações
administrativas e o restante do RBAC por ação permanecem na MP-35.

Antes de tratar a composição HTTP como candidata produtiva, ainda é obrigatório
definir o domínio oficial, publicar/validar `assetlinks.json` e AASA, configurar
a assinatura oficial e executar a validação ponta a ponta em dispositivo e
ambiente de release. MFA de Admin e os portões operacionais da MP-33B também
continuam ativos.

## Estado da sequência depois de MP-33C

A MP-33C já está integrada. A MP-34 também foi concluída tecnicamente e
integrada diretamente à branch `backend` no commit `e787707`, sem pull request.
Esse estado não autoriza tag, deploy, release ou publicação por si só.

| Ordem | Tarefa | Objetivo | Estado |
|---:|---|---|---|
| 34 | MP-34 | Notificações in-app reais, persistidas e isoladas | CONCLUÍDA E INTEGRADA DIRETAMENTE EM `e787707`; CI PÓS-PUSH APROVADA; PORTÕES PRODUTIVOS PENDENTES |
| 34.1 | Convergência visual pré-MP-35 | Reutilizar no HTTP a interface aprovada para capacidades já conectadas | CONCLUÍDA TECNICAMENTE E APROVADA NO ANDROID FÍSICO; COMMIT LOCAL PENDENTE DE AUTORIZAÇÃO |
| 35 | MP-35 | Escritas de Propriedade, Usuários/vínculos, RBAC e integração das telas administrativas existentes | BACKLOG |
| 36 | MP-36 | Caderno auditável, imutável e concorrente | BACKLOG |
| 37 | MP-37 | Versionamento produtivo do GeoJSON | BACKLOG |
| 38 | MP-38 | Teste real de localização em campo | BLOQUEADO POR CAMPO |
| 39 | MP-39 | Regressão histórica de GeoJSON | BACKLOG |
| 40 | MP-40 | Acessibilidade e matriz de dispositivos | BACKLOG |
| 41 | MP-41 | Regressão completa dos três perfis | BACKLOG |

### Resultado técnico da MP-34

Contrato: [contrato-notificacoes.md](contrato-notificacoes.md).

O corte implementado permanece online-only e inclui somente notificações in-app
de fatos de conta já reais na MP-33B: senha alterada, e-mail principal alterado
e recuperação concluída. Cada fato cria evento e entrega individual para o
próprio Usuário na mesma transação, com deduplicação, leitura/descarte
persistentes, contador, cursor, resolução segura de destino e retenção de
exatamente 90 dias. A chave idempotente também expira exatamente 90 dias após o
processamento.

`outbox_email` não foi reutilizada; push e tokens de dispositivo não entram.
O Demo e seu contexto local permanecem inalterados. Eventos de Propriedade,
Visita, Caderno, Material, mapa, GeoJSON e Talhão aguardam as fontes e guards de
suas próprias verticais. MP-35 e fases seguintes ficam fora.

Foram entregues a migration `000005`, o módulo backend e OpenAPI, cinco fluxos
emissores transacionais de conta para três tipos de evento, porta/tela
exclusivas da composição HTTP, papel de manutenção e comando one-shot de purga.
Essa quinta credencial operacional é separada das quatro credenciais
introduzidas na MP-33B.

A rodada confirmada registra no aplicativo `test:mp34` com 35/35 casos: 10 de
contratos, 12 de repositório e 13 de arquitetura. Há cinco gates
comportamentais: dois do open gate e três do context coordinator. No backend,
foram confirmados 138 testes unitários/contratos de migration, 26 HTTP e 41
cenários reais de integração: 15 de migrations, 8 de autenticação, 7 de ações
de conta, 9 de Propriedades/QA e 2 de notificações. O smoke funcional Android
físico da MP-34 passou em 2026-08-24 no TCL 8483A com Android 15/API 35; o
escopo e as limitações da execução estão registrados em
[smoke.md](smoke.md).

Antes de produção ainda faltam responsável, agendamento e alertas da purga,
provisionamento da credencial/CA/segredo de manutenção, revisão
jurídica/de privacidade da retenção, observabilidade, backup/restauração e os
portões gerais de release. A integração ocorreu diretamente no commit
`e787707`, sem pull request; não houve tag, deploy, release ou publicação da
MP-34.

### Convergência visual anterior à MP-35

Contrato:
[contrato-convergencia-interface-http.md](contrato-convergencia-interface-http.md).

O primeiro corte implementado localmente:

1. compartilha a apresentação de login entre Demo e HTTP, mantendo acesso
   rápido exclusivamente demonstrativo;
2. compartilha cabeçalho, identidade visual, cartões e estados vazios sem
   compartilhar fonte de dados;
3. aplica à lista/detalhe HTTP de Propriedades o padrão visual existente, com
   busca, filtros e cursor ainda executados pelo servidor;
4. apresenta Perfil e ações self-service reais no padrão visual aprovado;
5. preserva toda a semântica segura de Notificações da MP-34 no layout
   convergido;
6. mantém métricas sem agregado, Talhões, mapas, Visitas, Caderno, Materiais e
   Dashboard fora da navegação HTTP até suas verticais reais.

Critério de fechamento:

- typecheck, `test:domain-compat`, MP-33C, MP-34 e teste focado de arquitetura
  aprovados em Node.js 22;
- grafos HTTP/Demo continuam isolados; somente `expo-linear-gradient` é
  promovido como dependência visual HTTP, sem promover storage, localização,
  mapas, mídia ou dados demonstrativos;
- smoke Android físico confirma login, lista/filtros/detalhe de Propriedades,
  Perfil, Notificações, troca de identidade e indisponibilidade honesta;
- documentação e código permanecem coerentes, sem commit, tag, deploy ou
  publicação automáticos.

O fechamento técnico passou em 2026-08-24 no TCL 8483A, Android 15/API 35. A
barra inferior inicialmente invadia a área de gestos; a safe area corrigida
deixou os alvos entre `y=1162–1238`. Toques centrais passaram em 3/3 abas HTTP e
6/6 abas Demo, sem fatal no log. O cenário HTTP conectado também confirmou os
fluxos acima e a ausência de fallback. Cursor permaneceu automatizado porque a
massa física não gerou segunda página.

Depois desse fechamento, a MP-35 deve integrar as telas administrativas já
existentes no mesmo corte das escritas e do RBAC. MP-36 e MP-37 repetem o padrão
para Caderno e GeoJSON/Talhões. Visitas, Materiais e agregados do Dashboard
precisam entrar como verticais explícitas antes da MP-40/41; não surgem
automaticamente ao final da fila.

MP-38 não bloqueia MP-33A. Ele depende de ambiente de campo e deve permanecer
como portão próprio.

## Como iniciar cada tarefa

Antes de alterar código:

1. confirmar a decisão e o contrato ativo;
2. delimitar comportamento esperado, aceite e fora de escopo;
3. identificar arquivos e superfícies afetadas;
4. escolher testes automáticos e smoke proporcional ao risco;
5. executar o menor corte vertical utilizável;
6. atualizar estado, pendências e este arquivo no fechamento.

## Validação mínima

Mudança de código:

- npm run typecheck
- npm run test:domain-compat
- testes focados da nova vertical
- smoke aplicável de smoke.md
- revisão de diff e links documentais

Mudança somente documental:

- git diff --check
- validação dos links locais
- revisão contra o código e os contratos vigentes

## Fora do caminho crítico atual

- iOS;
- multiempresa;
- papéis customizáveis;
- push;
- rastreamento em background;
- processamento agronômico no aparelho;
- fila geral de mutações offline;
- expansão de escopo baseada apenas em ideias arquivadas.
