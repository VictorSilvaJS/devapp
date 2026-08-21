# Pendências Ativas

> Revisão documental: 2026-08-21

Não existe decisão arquitetural pendente dentro do corte da MP-33C. MP-33A,
MP-33B e MP-33C estão concluídas tecnicamente e integradas. A MP-33C entrou na
branch `backend` pelo PR #2 no commit `cc78a9f`, e a CI pós-merge foi aprovada,
mas não houve deploy, release ou publicação. Os itens abaixo são decisões da
MP-34, implementações de fases posteriores ou portões que devem ser fechados na
entrada da respectiva vertical/release.

## MP-34 — decisões anteriores ao código

- ratificar os três eventos iniciais de conta, suas prioridades e o texto dos
  templates: senha alterada, e-mail principal alterado e recuperação concluída;
- fixar a retenção da chave de idempotência dos comandos; a proposta inicial é
  acompanhar os 90 dias das entregas, e ela nunca pode terminar antes do maior
  `expira_em` alcançável pelo comando;
- definir responsável, periodicidade, credencial de menor privilégio e alertas
  da purga física em lotes;
- concluir a revisão jurídica/de privacidade dos 90 dias e confirmar se existe
  obrigação de suspender descarte.

Não permanecem em aberto para o corte mínimo: operação online-only, entrega
in-app individual, evento e entrega na mesma transação, `outbox_email` separada,
destino inicial somente `conta`, nenhum cache persistente, nenhum push e nenhum
token de dispositivo. Esses limites estão consolidados em
`contrato-notificacoes.md`.

## Implementação por fase

- implementar a MP-34 somente depois de aprovar seu catálogo inicial de eventos,
  conteúdo seguro e operação de retenção;
- implementar na MP-35 escritas de Propriedade, administração de
  Usuários/vínculos e o restante do RBAC por ação;
- implementar offline seguro em fase própria, com cache cifrado, segregação por
  identidade e invalidação de escopo;
- definir e executar observabilidade, backup, restauração e gestão de segredos;
- remover gradualmente as leituras de fazenda_id depois que cada borda estiver
  coberta pelo contrato canônico.

## Portões por vertical

### Autenticação e recuperação

Antes de habilitar a MP-33B em produção pública, fechar:

- política operacional versionada de comprovação de identidade para
  recuperação assistida;
- MFA obrigatório para contas Administradoras;
- provedor SMTP, reputação de envio e gestão dos segredos TLS;
- benchmark Argon2id e limite de concorrência no ambiente real;
- CIDRs confiáveis quando existir proxy de produção;
- antes de implementar break-glass, escolher e construir Ed25519 ou serviço
  externo equivalente com dois aprovadores distintos, finalidade, expiração,
  anti-replay, custódia e teste ponta a ponta;
- somente depois desse pré-requisito, decidir o start e conectar de forma
  deliberada o schema/continuações hoje inalcançáveis, com nova migration
  append-only quando houver impacto persistido;
- retenção jurídica, de privacidade e operacional da auditoria;
- cadastro e confirmação de contato secundário dos Administradores.

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

- escolher o domínio oficial da empresa e publicar/validar os arquivos de
  associação de Android App Links e iOS Universal Links;
- validar os links de ação ponta a ponta no domínio oficial e no Android real;
- keystore oficial e processo de assinatura;
- gerar e inspecionar o AAB assinado candidato à loja;
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
- acesso do Titular derivado e bloqueio de usuário inativo na camada de
  autenticação/autorização, sem impedir sua desativação por constraint;
- armazenamento somente do Titular atual na MP-33A;
- Colaborador por vínculo direto;
- Município e UF sem efeito de permissão;
- perfis e matriz de RBAC do primeiro backend;
- respostas HTTP de escopo e autorização;
- offline conservador;
- notificações in-app sem push no primeiro corte;
- Android como primeira plataforma;
- mock somente no Demo/testes e fisicamente fora do grafo de produção;
- Demo e produção HTTP com identificadores e namespaces distintos;
- produção exclusivamente HTTP, sem fallback para mock;
- MP-33C limitada a lista/detalhe de Propriedades em leitura, com cursor,
  filtros e autorização no servidor;
- `/v1/propriedades` como endpoint canônico, sem
  `/v1/me/propriedades` duplicado;
- contrato HTTP `snake_case`, `tipo_acesso` calculado e métricas ocultas;
- access token em memória, refresh no storage seguro, single-flight e nenhum
  token/sessão HTTP em `AsyncStorage`;
- proteção visual imediata em background, novo login após 15 minutos em
  background e lock por inatividade sem logout automático;
- composição HTTP online-only no piloto;
- segundo e-mail verificado do Administrador mantido;
- Testcontainers para integração, fixture manual protegida e nenhum seed
  automático ou produtivo;
- carregador manual de QA protegido por ambiente, flag, URL dedicada, banco
  `_test`/`_qa` e senha explícita compatível com a política;
- MP-33C implementada e validada tecnicamente, incluindo separação de bundles,
  grafo nativo Android e prebuild temporário;
- escritas e administração de negócio adiadas para MP-35;
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
