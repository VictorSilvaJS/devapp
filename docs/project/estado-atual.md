# Estado Atual do Projeto

Este documento descreve o estado atual do repositorio e do sistema como eles existem hoje. Seu foco e registrar o retrato presente da base, sem substituir documentos especificos de contexto, escopo, regras, decisoes ou pendencias.

Quando houver conflito entre documentos antigos e o codigo, priorize este arquivo e o proprio codigo-fonte para entender o que esta efetivamente no repositorio atual.

## Convencao Provisoria de Linguagem

Na documentacao ativa, o perfil final ligado a fazendas e tratado provisoriamente como `produtor`. Alias historicos como `cliente` e `proprietario` aparecem apenas quando ajudam a explicar inconsistencias ainda existentes no codigo, nos mocks ou em documentos antigos.

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

## Fechamento Formal Da Fase 2

A Fase 2 pode ser considerada formalmente encerrada.

- O dominio central foi estabilizado com contratos canonicos, compatibilidade de borda controlada e uso explicito de `fazenda_id` como chave operacional quando esse e o significado real.
- O alinhamento semantico ja cobre dominio, auth, validadores, schemas, mock persistence, acesso, navegacao principal, filtros, formularios e camada offline/sync/cache.
- As pendencias restantes foram reduzidas a aliases publicos de compatibilidade e nomes historicos localizados na superficie, sem contaminar o nucleo canonico.
- Esses residuos nao bloqueiam o encerramento da fase porque nao reintroduzem ambiguidade estrutural no miolo do sistema e ja estao isolados para limpeza incremental de baixo risco.

## Pontos de Atencao Tecnicos

- O dominio central ja foi estabilizado, mas ainda existem aliases historicos de compatibilidade na superficie publica
- Ainda existem nomes legados isolados em rotas, wrappers e algumas telas historicas
- Parte das acoes depende apenas de bloqueio visual, sem validacao defensiva no fluxo
- A camada offline-first ja esta alinhada semanticamente, mas ainda nao esta conectada a um backend real
- `src/services/MapaCacheService.ts` usa `expo-file-system`, mas essa dependencia nao aparece em `package.json`

## Complementares Oficiais

Use estes documentos junto com este retrato do presente:

- `docs/project/contexto-consolidado.md` para problema, proposito, usuarios e contexto do dominio
- `docs/project/escopo-mvp.md` para o limite atual do MVP
- `docs/project/regras-de-negocio.md` para regras de dominio e acesso
- `docs/project/decisoes-consolidadas.md` para direcoes ja assumidas pelo projeto
- `docs/project/pendencias-de-definicao.md` para pontos reais ainda em aberto
- `docs/project/plano-reorganizacao.md` para a ordem tecnica do trabalho
- `docs/project/roadmap-futuro.md` para backlog de evolucao apos a estabilizacao da base
- `docs/README.md` para a trilha geral de leitura da documentacao

## Proximo Passo Recomendado

Executar apenas um lote curto de limpeza nominal controlada, sem reabrir refatoracao estrutural ampla:

- limpar metadata local residual da superficie de mapas/fazenda
- manter aliases legados apenas em helpers e wrappers explicitamente marcados como compatibilidade temporaria
- adiar renomeacoes amplas de modulos, rotas e telas para uma etapa posterior e opcional
