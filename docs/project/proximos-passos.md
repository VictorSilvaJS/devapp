# Próximos Passos

> Atualizado em: 2026-08-19
>
> Próxima tarefa de desenvolvimento: preparar a MP-33C
>
> Estado: MP-33A CONCLUÍDA; MP-33B CONCLUÍDA TECNICAMENTE E NÃO LIBERADA PARA PRODUÇÃO

## Ponto de partida

O corte local MP-00 a MP-32 e a fundação MP-33A estão concluídos. A corrida
visual ao reabrir no mapa um ponto já persistido no Caderno foi corrigida e
revalidada no Android em `ATUAL-04`; ela não altera os contratos nem a sequência
do backend. A MP-33B foi concluída tecnicamente, sem alterar o mock nem conectar
o aplicativo. O próximo corte deve primeiro planejar a integração da branch
`backend` com a linha do aplicativo e então preparar a MP-33C, sem tratar os
portões de produção abaixo como já resolvidos.

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
| 33C | MP-33C | Repositórios, seleção mock/HTTP e vertical de Propriedades | BACKLOG |

O mock permanece integralmente inalterado nas MP-33A e MP-33B. A MP-33C adaptará o
vínculo local `titular` para o acesso calculado pelo backend.

## Sequência depois de MP-33C

| Ordem | Tarefa | Objetivo | Estado |
|---:|---|---|---|
| 34 | MP-34 | Notificações reais, persistidas e isoladas | BACKLOG |
| 35 | MP-35 | Escopo por Propriedade e vínculos no servidor | BACKLOG |
| 36 | MP-36 | Caderno auditável, imutável e concorrente | BACKLOG |
| 37 | MP-37 | Versionamento produtivo do GeoJSON | BACKLOG |
| 38 | MP-38 | Teste real de localização em campo | BLOQUEADO POR CAMPO |
| 39 | MP-39 | Regressão histórica de GeoJSON | BACKLOG |
| 40 | MP-40 | Acessibilidade e matriz de dispositivos | BACKLOG |
| 41 | MP-41 | Regressão completa dos três perfis | BACKLOG |

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
