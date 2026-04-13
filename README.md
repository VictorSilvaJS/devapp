# Tche Agro Mobile

Aplicativo mobile em React Native + Expo para operacao de consultoria agricola com foco em produtores, visitas tecnicas, caderno de campo e mapas de fazenda.

## Estado Atual

O repositorio esta funcional como base de front-end e demonstracao, mas ainda nao representa um produto pronto para entrega.

Hoje o projeto tem:

- navegacao por perfil (`admin`, `colaborador`, `produtor`)
- dashboards e fluxos principais de produtores, visitas, caderno e mapas
- autenticacao mock com persistencia local
- dados mockados em memoria
- trilha inicial de mapas nativos e arquitetura planejada de offline-first

Hoje o projeto ainda nao tem:

- backend real
- autenticacao real
- upload real de arquivos
- notificacoes push reais
- sincronizacao offline completa
- suite de testes automatizados integrada ao `package.json`

## Stack Atual

- Expo 48
- React Native 0.71
- React Navigation
- Context API
- AsyncStorage
- react-native-maps
- react-native-webview
- TypeScript

## Como Rodar

### Requisitos

- Node.js 16+
- npm 8+
- Expo CLI ou `npx expo`

### Comandos

```powershell
npm install
npm start
```

Comandos disponiveis em [package.json](package.json):

- `npm start`
- `npm run android`
- `npm run ios`
- `npm run web`
- `npm run typecheck`

## Estrutura Atual

```text
devapp/
  docs/        # documentacao organizada por categoria
  entities/    # schemas e referencias de entidades
  scripts/     # scripts auxiliares
  src/         # codigo da aplicacao
  android/     # projeto nativo Android
  README.md
```

## Documentacao

O ponto de entrada da documentacao agora e [docs/README.md](docs/README.md).

Leitura recomendada:

1. [Estado atual do projeto](docs/project/estado-atual.md)
2. [Plano de reorganizacao](docs/project/plano-reorganizacao.md)
3. [Organizacao do sistema](docs/project/organizacao-do-sistema.md)
4. [Arquitetura offline-first nativa](docs/architecture/offline-first-nativo.md)
5. [Guia de testes](docs/testing/guia-testes.md)
6. [Documentacao da API mock](src/api/README.md)

## Direcao de Reorganizacao

A ordem recomendada para evolucao do projeto e:

1. estabilizar documentacao e nomenclatura de dominio
2. padronizar contratos e entidades
3. separar mocks, services e regras de permissao
4. componentizar por feature
5. conectar backend e offline reais

## Observacoes Importantes

- Parte da documentacao antiga foi preservada em `docs/reviews` e `docs/archive`.
- Alguns documentos historicos ainda podem refletir decisoes antigas ou mais otimistas do que o codigo atual.
- Se houver conflito entre documentos antigos e o estado do codigo, priorize o codigo e o plano de reorganizacao.
