# Fase 17H.0.7 - Alinhamento Tecnico Pontual Do Expo SDK 56

Status em 2026-07-21: `APROVADA_EM_EMULADOR`.

Esta fase alinhou exclusivamente `expo` e `expo-location` com as versoes
indicadas pelo Expo CLI para o SDK 56. Nao houve upgrade de SDK, mudanca
funcional, alteracao nativa manual ou atualizacao ampla de dependencias
diretas.

## Estado Inicial

- Git limpo, sem alteracoes pendentes da Fase 17H.0.6;
- Node `v22.20.0`;
- npm `10.9.3`;
- Expo CLI `56.1.15`;
- `expo@56.0.11`, declarado como `~56.0.11`;
- `expo-location@56.0.20`, declarado como `~56.0.20`;
- `npm run typecheck` e `npm run test:domain-compat`: passaram antes do
  alinhamento.

O primeiro `npx expo install --check` no sandbox falhou por rede bloqueada
com `ECONNREFUSED 127.0.0.1:9`. A consulta foi repetida com acesso de rede
aprovado e retornou integralmente:

```text
The following packages should be updated for best compatibility with the installed expo version:
  expo@56.0.11 - expected version: ~56.0.16
  expo-location@56.0.20 - expected version: ~56.0.21
Your project may not work correctly until you install the expected versions of the packages.
Found outdated dependencies
```

`npx expo install expo expo-location --check` retornou as mesmas duas
divergencias. Nenhum outro pacote foi indicado.

## Expo Doctor Antes

`npx expo-doctor@latest` executou 21 verificacoes: 17 passaram e quatro
falharam:

1. `splash` apontado como propriedade adicional no schema de `app.json`;
2. `expo-font` nao declarado diretamente, requerido por
   `@expo/vector-icons`;
3. duplicidade de `expo-font@56.0.5` e `expo-font@56.0.6`;
4. patches incompatíveis de `expo` e `expo-location`.

Os tres primeiros pontos eram preexistentes e ficaram fora do escopo. O
quarto era o alvo desta fase.

## Atualizacao Dirigida

Comando utilizado:

```powershell
npx expo install "expo@~56.0.16" "expo-location@~56.0.21" --npm
```

Versoes depois:

- `expo@56.0.16`, declarado como `~56.0.16`;
- `expo-location@56.0.21`, declarado como `~56.0.21`;
- Expo CLI transitivo `56.1.20`;
- `app.json` continua declarando `sdkVersion: 56.0.0`.

Somente `expo` e `expo-location` mudaram entre as dependencias diretas.
`package-lock.json` incorporou os patches transitivos do proprio Expo SDK 56;
o npm informou quatro pacotes adicionados, um removido e 41 alterados na
primeira resolucao, seguidos de um ajuste final de `expo-location`.

Permaneceram inalterados:

- React `19.2.3`;
- React Native `0.85.3`;
- TypeScript `6.0.3`;
- `react-native-webview` `13.16.1`;
- `react-native-maps` `1.27.2`;
- `expo-document-picker` `56.0.4`;
- `expo-file-system` `56.0.8`;
- `expo-crypto` `56.0.4`;
- `app.json`, `android/`, `ios/`, codigo funcional, mocks, listas, contratos e
  assets.

Nao foram executados `npm update`, `npm audit fix`, `npm audit fix --force`,
`expo install --fix`, `prebuild --clean`, remocao de lockfile ou remocao de
`node_modules`.

## Confirmacao Do Alinhamento

Depois da instalacao:

```text
npx expo install --check
Dependencies are up to date

npx expo install expo expo-location --check
Dependencies are up to date
```

O Expo Doctor passou de 17/21 para 18/21. A divergencia de pacotes foi
eliminada. Permaneceram somente os tres avisos preexistentes de schema
`splash`, peer direto `expo-font` e duplicidade de `expo-font` agora entre
`56.0.5` e `56.0.7`. Eles nao foram ocultados nem corrigidos fora do escopo.

## Testes E Auditoria

- `npm run typecheck`: passou antes e depois;
- `npm run test:domain-compat`: passou integralmente antes e depois;
- a suite completa incluiu Caderno, acesso, validators, Periodo Produtivo,
  consulta/medidas de Talhao, Visitas, GeoJSON, PNG, ZIP de Prescricao e
  autenticacao local;
- `git diff --check`: passou;
- a comparacao de dependencias diretas encontrou somente `expo` e
  `expo-location`;
- auditoria textual confirmou que nenhuma coordenada, chave `@tche:`, camera,
  seletor de imagem, tracking ou background foi adicionado;
- `picsum.photos` continua somente nos seeds demonstrativos preservados e em
  fixtures de compatibilidade.

## Build E APK

O primeiro build excedeu o limite de tres minutos do terminal enquanto
processos Gradle continuavam ativos. A repeticao revelou falha de memoria
`Metaspace` em `lintVitalAnalyzeRelease`/Kotlin. Sem editar configuracao, foi
aplicado o fallback previsto:

```powershell
.\gradlew.bat :app:assembleRelease --no-daemon --max-workers=1 --no-parallel
```

Resultado: `BUILD SUCCESSFUL` em 1 min 47 s.

- APK: `android/app/build/outputs/apk/release/app-release.apk`;
- tamanho: 91.892.916 bytes;
- gerado em: 2026-07-21 11:27:33 -03:00;
- SHA-256:
  `6254AB718E716CDD76D45E42DF1A9B7BE4126EF7ACC47465F4FE932A6300C26A`;
- `adb install -r`: passou;
- `monkey` com categoria launcher: passou;
- AVD: `emulator-5554`, Pixel Tablet, Android 15/API 35;
- nao houve `pm clear`, desinstalacao ou `Wipe Data`.

## Permissoes Android

`adb shell dumpsys package com.tcheagro.mobile` confirmou:

- `ACCESS_FINE_LOCATION`: presente e concedida;
- `ACCESS_COARSE_LOCATION`: presente e concedida;
- `ACCESS_BACKGROUND_LOCATION`: ausente;
- `CAMERA`: ausente;
- `READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` e `WRITE_EXTERNAL_STORAGE`:
  ausentes.

`app.json` permaneceu inalterado, com permissao foreground, textos existentes
e flags de background Android/iOS em `false`.

## Smoke No Emulador

- app abriu sem crash e restaurou a sessao Admin;
- Sela de Prata I exibiu `Area total informada: 6.200 ha`, 15 Talhoes e
  `Area mapeada: 1.888,6 ha`;
- `T01 - 230` continuou clicavel e exibiu 274,1 ha;
- `Mostrar minha posicao` solicitou a leitura foreground. O provider do AVD
  nao entregou posicao mesmo apos injecao de coordenada e o app exibiu a
  mensagem controlada `Nao foi possivel obter a posicao atual do aparelho`,
  sem crash ou persistencia. Marcador/circulo nao foram re-evidenciados nesta
  rodada;
- apos `force-stop`, o app reabriu no Dashboard com a sessao preservada e sem
  restaurar tela ou posicao de mapa;
- nao havia GeoJSON local ativo nem ZIP local visivel no snapshot preservado
  da Sela. Os 15 Talhoes da camada local/seed abriram e as suites focadas de
  GeoJSON e ZIP passaram;
- um PNG de Fosforo abriu como anexo, sem acao de localizacao;
- Caderno preservou `AUD04-COLAB-T01-20260721-EDITADO`,
  `AUD05-ADMIN-T01-20260721`, `AUD06-PRODUTOR-SAFRA-20260721` e o periodo
  `AUD05-ADMIN-PERIODO-20260721`;
- Nova Visita permaneceu sem Camera/Galeria e mostrou `Fotos no MVP local`;
- Visita antiga preservou duas imagens e mostrou `Imagem demonstrativa` e
  `Exemplo visual do registro`;
- Material tecnico permaneceu local no contexto da Sela e abriu anexos de
  fertilidade; nenhum backend, download ou processamento foi criado.

## Limitacoes E Fechamento

Status: `APROVADA_EM_EMULADOR` para o alinhamento tecnico do SDK 56.

Limitacoes registradas:

- os tres avisos preexistentes do Expo Doctor exigem fase tecnica propria se
  forem priorizados;
- o provider de localizacao do AVD exerceu o fallback controlado, sem nova
  evidencia visual de marcador/circulo;
- nao havia GeoJSON ou ZIP local ativo no snapshot para reabertura visual;
- Android fisico continua pendente, nao aprovado e bloqueia aptidao para
  campo.

Confirmacoes finais:

- o projeto permanece no Expo SDK 56;
- nao houve upgrade amplo nem alteracao de React/React Native;
- nao houve `npm audit fix`;
- nenhuma coordenada foi persistida;
- nenhuma chave local foi criada;
- camera/foto real nao foi implementada;
- Android fisico segue pendente e nao aprovado.
