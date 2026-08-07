# Tche Agro Mobile

Aplicativo mobile em React Native + Expo para operacao de consultoria agricola com foco em Produtores, Visitas tecnicas, Caderno de campo e mapas no contexto de Propriedades.

## Estado Atual

O repositorio esta funcional como base de front-end e demonstracao, mas ainda nao representa um produto pronto para entrega.

Hoje o projeto tem:

- navegacao por perfil (`admin`, `colaborador`, `produtor`)
- dashboards e fluxos principais de produtores, visitas, caderno e mapas
- autenticacao mock com persistencia local
- dataset demonstrativo v2 persistido localmente
- notificacoes in-app em memoria
- visualizacao de Talhoes/GeoJSON e cache local demonstrativo
- contratos aprovados para iniciar backend, banco, sessao e RBAC reais

Hoje o projeto ainda nao tem:

- backend real
- autenticacao real
- upload real de arquivos
- download real de mapas
- notificacoes push reais
- sincronizacao offline completa
- suite end-to-end produtiva cobrindo API, banco e todos os fluxos

## Stack Atual

- Expo SDK 56
- React Native 0.85
- React Navigation
- Context API
- AsyncStorage
- react-native-maps
- react-native-webview
- TypeScript

## Como Rodar

### Requisitos

- Node.js compativel com Expo SDK 56
- npm
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
- `npm run test:domain-compat`

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

A documentacao oficial do projeto esta em [docs/](docs/).

Para agentes de codigo, o ponto de entrada rapido e [AGENTS.md](AGENTS.md).

Para humanos e leitura completa, o ponto de entrada recomendado e [docs/README.md](docs/README.md), que organiza:

- a hierarquia de leitura
- o nucleo documental ativo em `docs/project/`
- o papel das pastas complementares
- a trilha recomendada para humanos e IA/agentes de codigo

## Observacoes Importantes

- `Propriedade`, `Produtor`, `Titular` e `Talhao` sao os termos oficiais de produto. Nomes com `fazenda*` permanecem somente por compatibilidade tecnica temporaria.
- Parte da documentacao antiga foi preservada em `docs/reviews` e `docs/archive`.
- Alguns documentos historicos ainda podem refletir decisoes antigas ou mais otimistas do que o codigo atual.
- Se houver conflito entre materiais historicos e a documentacao ativa, priorize `docs/project/` e o estado real do codigo.
