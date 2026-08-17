# Próximos Passos

> Atualizado em: 2026-08-10
>
> Próxima tarefa: MP-33 — Autenticação e sessão reais
>
> Estado: PRONTO

## Ponto de partida

O corte local MP-00 a MP-32 está concluído. A corrida visual ao reabrir no mapa
um ponto já persistido no Caderno foi corrigida e revalidada no Android em
`ATUAL-04`; ela não altera os contratos nem a sequência do backend. O trabalho
agora deve evitar novas simulações de segurança no frontend e iniciar a
fundação produtiva.

## MP-33 — Fundação, autenticação e sessão

Objetivo: criar o primeiro corte executável do backend e substituir a
autenticação local por um caminho real, sem trocar todas as telas de uma vez.

Entrega mínima:

1. serviço modular em Node.js e TypeScript;
2. API REST sob versão v1 e contrato OpenAPI;
3. PostgreSQL/PostGIS com migrations repetíveis;
4. usuários, credenciais, refresh tokens, revogação e auditoria mínima;
5. access token de 15 minutos e refresh token de 30 dias;
6. regra de inatividade e janela offline conforme política de sessão;
7. endpoint de login, refresh, logout e sessão atual;
8. listagem de Propriedades autorizadas;
9. criação administrativa mínima de Propriedade;
10. interfaces de repositório e primeiro adaptador HTTP no aplicativo;
11. testes positivos, negativos e de isolamento;
12. CI mínima para typecheck, testes e migrations.

Critério de aceite:

- nenhuma credencial produtiva em AsyncStorage;
- autorização não depende de dado confiado do cliente;
- logout e revogação invalidam a retomada;
- recurso fora do escopo não vaza existência;
- mock continua disponível apenas como modo demonstrativo explicitamente
  separado;
- contratos e código usam propriedade_id nas novas superfícies.

## Sequência depois de MP-33

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

MP-38 não bloqueia MP-33. Ele depende de ambiente de campo e deve permanecer
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
