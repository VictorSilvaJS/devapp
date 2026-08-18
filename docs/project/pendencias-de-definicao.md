# Pendências Ativas

> Revisão documental: 2026-08-18

Não existe decisão de domínio pendente que impeça o backend. A arquitetura e a
implementação da MP-33A estão fechadas e validadas. Os itens abaixo são
implementações ainda não realizadas ou
portões que devem ser fechados na entrada da respectiva vertical.

## Implementação por fase

- implementar autenticação, sessões, refresh tokens, convites, recuperação e
  auditoria genérica na MP-33B;
- criar interfaces de repositório, seleção mock/HTTP e a primeira vertical de
  Propriedades no aplicativo na MP-33C, preservando o mock até essa fase;
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
- `propriedades.titular_id` como única fonte persistida da Titularidade no
  backend;
- `usuario_propriedade` restrita aos acessos adicionais
  `usuario_autorizado` e `colaborador` no backend;
- acesso do Titular derivado e bloqueio de usuário inativo na futura camada de
  autenticação/autorização, sem impedir sua desativação por constraint;
- armazenamento somente do Titular atual na MP-33A;
- Colaborador por vínculo direto;
- Município e UF sem efeito de permissão;
- perfis e matriz de RBAC do primeiro backend;
- respostas HTTP de escopo e autorização;
- offline conservador;
- notificações in-app sem push no primeiro corte;
- Android como primeira plataforma.
- migrations com manifesto SHA-256 e proteção append-only contra a
  branch-base;
- PNG, PDF e ZIP fora do PostgreSQL, com metadados/chaves no banco e dados
  geoespaciais no PostGIS.

## Governança

- Decisão fechada vai para decisoes-consolidadas.md.
- Entrega executável vai para proximos-passos.md.
- Cenário de validação vai para smoke.md.
- Ideia sem compromisso de execução não deve ser tratada como pendência.
- Histórico de itens encerrados permanece em docs/archive.
