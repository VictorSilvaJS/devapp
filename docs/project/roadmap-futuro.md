# Backlog Futuro de Evolucao

> Status: backlog ativo de evolucao do produto. Este documento nao define fases tecnicas, nao substitui `docs/project/plano-reorganizacao.md` e nao representa compromisso de prazo.

## Como Ler Este Documento

- Use este arquivo para listar entregas candidatas depois da estabilizacao da base.
- Use `docs/project/plano-reorganizacao.md` para a ordem tecnica da refatoracao.
- Na documentacao ativa, o perfil final ligado a fazendas e tratado provisoriamente como `produtor`.
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

- Backend real para autenticacao, usuarios, produtores, visitas, caderno e mapas
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

### Analise e apoio operacional

- Graficos de evolucao de visitas e mapas
- Indicadores por talhao e por fazenda
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
