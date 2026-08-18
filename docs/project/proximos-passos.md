# Próximos Passos

> Atualizado em: 2026-08-18
>
> Próxima tarefa: MP-33B — Autenticação e sessão reais
>
> Estado: MP-33A CONCLUÍDA; MP-33B PRÓXIMA

## Ponto de partida

O corte local MP-00 a MP-32 e a fundação MP-33A estão concluídos. A corrida
visual ao reabrir no mapa um ponto já persistido no Caderno foi corrigida e
revalidada no Android em `ATUAL-04`; ela não altera os contratos nem a sequência
do backend. O trabalho agora deve evitar novas simulações de segurança no
frontend e iniciar a MP-33B, com autenticação e sessão reais. Essa implementação
não deve antecipar a integração HTTP reservada à MP-33C.

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

| Ordem | Tarefa | Objetivo | Estado |
|---:|---|---|---|
| 33A | MP-33A | Fundação, DDL, operação, testes e CI | CONCLUÍDA |
| 33B | MP-33B | Autenticação, sessões, refresh, convites, recuperação e auditoria genérica | PRÓXIMA |
| 33C | MP-33C | Repositórios, seleção mock/HTTP e vertical de Propriedades | BACKLOG |

O mock permanece integralmente inalterado na MP-33A. A MP-33C adaptará o
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
