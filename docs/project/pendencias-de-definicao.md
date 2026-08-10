# Pendências Ativas

> Revisão documental: 2026-08-10

Não existe decisão de domínio pendente que impeça o início do backend. MP-33
está pronta. Os itens abaixo são implementações ainda não realizadas ou
portões que devem ser fechados na entrada da respectiva vertical.

## Implementação imediata

- criar scaffold do backend, OpenAPI, PostgreSQL/PostGIS e migrations;
- configurar integração contínua mínima;
- criar interfaces de repositório e adaptadores HTTP no aplicativo;
- implementar autenticação e sessão reais de MP-33;
- implementar autorização no servidor de MP-35;
- definir e executar observabilidade, backup, restauração e gestão de segredos;
- remover gradualmente as leituras de fazenda_id depois que cada borda estiver
  coberta pelo contrato canônico.

## Portões por vertical

### Materiais e arquivos

Antes da vertical produtiva, fechar:

- limites de arquivo e quota;
- retenção e descarte;
- criptografia e acesso ao storage;
- upload interrompido, repetição e idempotência;
- política de disponibilidade e exportação.

### GeoJSON e Talhões

Antes de MP-37, fechar:

- limiares de reconciliação automática e revisão humana;
- retenção de versões rejeitadas e rascunhos;
- quota e invalidação do cache local;
- operação de split, merge, renome, rollback e troca de vigência.

### Campo

Executar em ambiente real:

- dentro, fora e próximo do limite de Talhão;
- variação de precisão;
- permissão negada;
- serviço de localização desligado;
- offline e cancelamento;
- captura, persistência e exportação de mídia nas condições de campo.

### Release

Antes da distribuição produtiva, fechar:

- keystore oficial e processo de assinatura;
- privacidade, consentimento e retenção;
- telemetria e política de logs;
- aprovação do dataset ou migração para dados reais;
- TalkBack, tamanho de fonte, contraste, toque e matriz de aparelhos;
- regressão integral dos três perfis.

## Manutenção técnica separada

- aplicar patches gerais do Expo em tarefa controlada;
- tratar deprecações do Gradle;
- revisar dependências e permissões Android;
- remover artefatos temporários e evidências geradas que não precisem ser
  versionadas.

## Itens que não estão mais em aberto

- organização única;
- propriedade_id como identificador canônico novo;
- um Titular principal por Propriedade;
- Colaborador por vínculo direto;
- Município e UF sem efeito de permissão;
- perfis e matriz de RBAC do primeiro backend;
- respostas HTTP de escopo e autorização;
- offline conservador;
- notificações in-app sem push no primeiro corte;
- Android como primeira plataforma.

## Governança

- Decisão fechada vai para decisoes-consolidadas.md.
- Entrega executável vai para proximos-passos.md.
- Cenário de validação vai para smoke.md.
- Ideia sem compromisso de execução não deve ser tratada como pendência.
- Histórico de itens encerrados permanece em docs/archive.
