# Backlog Futuro de Evolucao

> Status: backlog ativo de evolucao do produto. Este documento nao define fases tecnicas, nao substitui `docs/project/plano-reorganizacao.md` e nao representa compromisso de prazo.

## Como Ler Este Documento

- Use este arquivo para listar entregas candidatas depois da estabilizacao da base.
- Use `docs/project/plano-reorganizacao.md` para a ordem tecnica da refatoracao.
- Na linguagem de produto, `Propriedade`, `Produtor`, `Titular` e `Talhao` sao os termos oficiais. Nomes internos como `fazenda_id` permanecem temporariamente por compatibilidade tecnica.
- Quando uma funcionalidade hoje for apenas simulada, isso deve aparecer explicitamente neste backlog.

## Ponto de Partida

Hoje o projeto ainda depende de simulacoes ou implementacoes parciais para fluxos importantes:

- autenticacao e dados ainda sao mock
- upload e download de mapas ainda nao sao reais
- notificacoes atuais sao in-app, nao push
- offline-first existe apenas como trilha parcial
- testes automatizados ainda nao fazem parte do fluxo normal do projeto

## Backlog Prioritario

### 1. Tirar os fluxos principais do mock

- Backend real para autenticacao, usuarios, propriedades, visitas, caderno e mapas
- Persistencia real para `usuarios`, `propriedades`, `usuario_propriedade`, `usuario_microregiao` e estrutura territorial
- Definir tabelas/colecoes reais para `regioes` e `microregioes`, substituindo gradualmente a derivacao visual feita por `territorioCompat`
- Definir se sera necessario `usuario_regiao` alem de `usuario_microregiao`, sem quebrar escopo regional atual
- Migrar o modulo `Admin -> Usuarios` do mock backend-ready para API/banco real
- Implementar criacao combinada transacional de `usuario` + `propriedade` + `usuario_propriedade` para substituir o cadastro rapido mockado de propriedade no usuario produtor
- Sincronizar cadastro administrativo de usuario com autenticacao real, convites, senha/reset e sessao quando essa frente for definida
- Definir RBAC/permissoes granulares a partir dos perfis atuais e dos niveis administrativos simples
- Persistencia real de arquivos de mapas e limites
- Upload real de mapas e shapes
- Download real de arquivos para o produtor
- Visualizador real de PDF e imagens

### 2. Fechar a trilha de offline e sincronizacao

- Concluir cache local de mapas e limites
- Detectar conectividade e exibir estado de sincronizacao
- Criar fila de sincronizacao
- Sincronizar automaticamente ao reconectar
- Definir estrategia minima de resolucao de conflitos

### 3. Consolidar comunicacao e acompanhamento

- Evoluir notificacoes in-app para push quando houver backend real
- Relatorios exportaveis por periodo
- Compartilhamento de arquivos e relatorios
- Melhorias de busca e filtros por safra, talhao e periodo

## Backlog Secundario

### Evolucao posterior de Produtor / Propriedade

A frente funcional de `Produtor` / `Propriedade` esta fechada para o MVP atual. Os itens abaixo nao bloqueiam o MVP e so devem ser retomados quando houver necessidade funcional clara:

- reassociacao segura de titular
- edicao centralizada dos dados compartilhados do titular
- fluxo assistido para limpar ou reassociar dependencias antes da exclusao de propriedade
- exclusao em cascata controlada, com confirmacao explicita e regra de integridade bem definida
- renomeacao ampla de modulos, telas ou rotas historicas que ainda usam `Produtor` ou `Fazenda` para representar propriedade

### Evolucao posterior de Admin -> Usuarios

O modulo `Admin -> Usuarios` esta em MVP visual/mockado com estrutura preparada para backend, mas ainda nao possui autenticacao real nem persistencia externa. Itens futuros:

- transformar as relacoes mock `usuario_propriedade` e `usuario_microregiao` em tabelas/colecoes reais
- transformar o cadastro rapido de propriedade no usuario produtor em operacao transacional de backend
- garantir rollback/consistencia quando a criacao combinada de usuario, propriedade e vinculo falhar parcialmente
- transformar a leitura visual Regiao -> Microregiao -> Propriedade em modelo persistente real
- substituir a derivacao de regioes/microregioes por cadastro ou fonte territorial controlada quando houver backend
- decidir como propriedades passam a referenciar `regiao_id` e `microregiao_id`, preservando compatibilidade temporaria com `regiao` e `microregiao` textuais
- definir se colaboradores poderao ser vinculados a regioes inteiras, microregioes e/ou propriedades especificas no backend
- ligar usuario administrativo a conta/login real sem duplicar dados pessoais
- definir fluxo de convite, ativacao, reset de senha e bloqueio/desbloqueio
- consolidar status de usuario em banco como `ativo`, `inativo` ou `pendente`
- manter `ativo` apenas como campo derivado/compatibilidade enquanto necessario
- definir como vinculos visuais de colaborador passam a influenciar permissoes efetivas
- migrar o `acessoControle` apenas em fase propria, depois de decidir o modelo territorial e as permissoes efetivas
- evoluir nivel administrativo simples para um modelo de permissoes quando houver necessidade real
- migrar validacoes de e-mail unico, vinculo de produtor ativo e escopo de colaborador ativo para backend

### Analise e apoio operacional

- Graficos de evolucao de visitas e mapas
- Indicadores por talhao e por propriedade
- Comparacoes historicas simples para apoiar consultoria

### Experiencia do produto

- Onboarding inicial mais claro para cada perfil
- Melhorias de acessibilidade
- Refinos de interface para listas, estados vazios e feedbacks de acao

## Exploracoes Condicionadas

Estes itens so fazem sentido depois que a base principal estiver confiavel e que os fluxos essenciais deixarem de ser mock:

- Integracoes com maquinas e formatos agricolas
- Integracoes com clima, satelite e laboratorios
- Versao web ou paineis administrativos mais robustos
- Recursos de IA dependentes de dados reais e historico consistente

## Itens Fora Do Backlog Ativo Por Enquanto

- Migracao para TypeScript: ja concluida
- KPIs corporativos e analytics avancados sem backend real
- Pagamentos, monetizacao e planos
- Features especificas de plataforma sem validacao de necessidade

## Dependencias Tecnicas

Este backlog depende diretamente do avanco do plano tecnico:

- Fase 2 para consolidar dominio e contratos
- Fase 3 para separar a camada de dados do mock
- Fase 4 para estabilizar permissoes e regras de acesso

Sem essas etapas, a tendencia e transformar backlog em mais acoplamento e retrabalho.
