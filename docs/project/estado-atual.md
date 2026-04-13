# Estado Atual do Projeto

Este e o documento-base para entender o repositorio como ele existe hoje. Quando houver conflito entre documentos antigos e o codigo, priorize este arquivo e o proprio codigo-fonte.

## Objetivo Aparente

Aplicativo mobile em React Native + Expo para operacao de consultoria agricola. O foco aparente e atender tres perfis:

- `admin`: visao ampla da operacao
- `colaborador`: atuacao regional
- `produtor`: acompanhamento da propria fazenda

O fluxo principal gira em torno de produtores, visitas tecnicas, caderno de campo e mapas.

## Arquitetura Identificada

### Camada de app

- `App.tsx` monta `AuthProvider`, `FiltroProvider`, `NotificacaoProvider`, `ToastProvider` e `NavigationContainer`
- `src/navigation/index.tsx` define um `Stack` principal com `Bottom Tabs` por perfil
- `src/theme.ts` centraliza tema visual

### Camada de interface

- `src/screens/` concentra as telas principais
- `src/components/` concentra componentes reutilizaveis de UI e visualizacao de mapas
- `src/contexts/` guarda estado transversal de filtros e notificacoes

### Camada de autenticacao e regras

- `src/auth/authMock.ts` faz login mock e acesso rapido de desenvolvimento
- `src/utils/acessoControle.ts` concentra boa parte das regras de permissao por perfil, produtor e regiao

### Camada de dados

- `src/api/mock.ts` e a fonte principal de dados do app hoje
- `src/api/validators.ts` valida entidades mock
- `src/api/index.ts` reexporta a camada mock
- `entities/` guarda os schemas de referencia

### Camada experimental de mapas/offline

- `src/components/MapaFazendaView.tsx` ainda representa a trilha com WebView
- `src/components/MapaFazendaNativoView.tsx` e `src/screens/FazendaMapaScreen.tsx` apontam para a migracao nativa
- `src/services/MapaSincronizacaoService.ts` e `src/services/MapaCacheService.ts` ainda estao incompletos

## O Que Ja Funciona

- navegacao por perfil com tabs diferentes para `admin`, `colaborador` e `produtor`
- login mock com persistencia local
- CRUD em memoria para produtores, visitas, caderno e mapas
- filtros regionais via `FiltroContext`
- fluxo principal de visitas com listagem, criacao, edicao e detalhe
- fluxo principal de produtores com lista e detalhe
- visualizacao de mapas e detalhe de fazenda

## O Que Ainda E Mock, Parcial Ou Incompleto

- autenticacao real
- backend real
- upload real de arquivos
- notificacoes push reais
- sincronizacao offline de verdade
- download real de mapas
- suite de testes automatizados integrada ao projeto

## Pontos de Atencao Tecnicos

- O dominio ainda mistura termos como `produtor`, `cliente` e `proprietario`
- Ha inconsistencias de contrato entre schemas, mocks e telas
- Existem regras de permissao duplicadas em telas alem de `src/utils/acessoControle.ts`
- Parte das acoes depende apenas de bloqueio visual, sem validacao defensiva no fluxo
- A camada offline-first ainda nao esta conectada ao fluxo principal
- `src/services/MapaCacheService.ts` usa `expo-file-system`, mas essa dependencia nao aparece em `package.json`

## Documentos Prioritarios

Leia nesta ordem:

1. `docs/project/estado-atual.md`
2. `docs/project/plano-reorganizacao.md`
3. `README.md`
4. `docs/project/organizacao-do-sistema.md`

## Proximo Passo Recomendado

Antes de mover codigo entre pastas ou quebrar telas em componentes menores, estabilizar o dominio e os contratos:

- escolher o vocabulario oficial do produto
- alinhar schemas, mocks e telas
- reduzir divergencia entre documentacao e implementacao
