# Tche Agro Mobile

Aplicativo mobile em React Native + Expo para operacao de consultoria agricola com foco em produtores, visitas tecnicas, caderno de campo e mapas de fazenda.

## Estado Atual

O repositorio esta funcional como base de front-end e demonstracao, mas ainda nao representa um produto pronto para entrega.

Hoje o projeto tem:

- navegacao por perfil (`admin`, `colaborador`, `produtor`)
- dashboards e fluxos principais de produtores, visitas, caderno e mapas
- autenticacao mock com persistencia local
- dados mockados em memoria
- notificacoes in-app em memoria
- trilha experimental de mapas nativos e offline-first ainda incompleta

Hoje o projeto ainda nao tem:

- backend real
- autenticacao real
- upload real de arquivos
- download real de mapas
- notificacoes push reais
- sincronizacao offline completa
- suite de testes automatizados completa cobrindo todos os fluxos de produto

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

- Na documentacao ativa, usamos `produtor` como termo provisório para o perfil final ligado a fazendas ate a consolidacao da Fase 2.
- Parte da documentacao antiga foi preservada em `docs/reviews` e `docs/archive`.
- Alguns documentos historicos ainda podem refletir decisoes antigas ou mais otimistas do que o codigo atual.
- Se houver conflito entre materiais historicos e a documentacao ativa, priorize `docs/project/` e o estado real do codigo.
