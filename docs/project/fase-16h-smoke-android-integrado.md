# Fase 16H - Smoke Android Fisico Integrado

## Status

Status em 2026-06-10: a Fase 16H.1 foi tentada para executar o smoke Android
fisico integrado de GeoJSON local, PNG local e regressao minima do APK
demonstravel. O smoke operacional nao foi executado porque nenhum aparelho
Android fisico apareceu conectado e autorizado no `adb`.

Resultado final desta rodada:

- `adb` existe localmente em
  `C:\Users\e_vsjesus\AppData\Local\Android\Sdk\platform-tools\adb.exe`, mas
  nao esta no `PATH`;
- `adb devices`, chamado diretamente pelo nome, falhou por comando nao
  reconhecido;
- o binario direto de `adb` listou apenas `emulator-5554`, identificado como
  `Pixel_Tablet`;
- nenhum Android fisico foi detectado;
- nenhum APK foi instalado ou aberto em aparelho fisico;
- nenhum arquivo GeoJSON ou PNG foi selecionado pelo DocumentPicker no
  aparelho;
- nenhuma correcao funcional foi aplicada;
- 16F e 16G permanecem abertas operacionalmente ate smoke Android fisico
  aprovado.

## Base Documental Ativa

- `docs/project/estado-atual.md`
- `docs/project/contexto-consolidado.md`
- `docs/project/escopo-mvp.md`
- `docs/project/regras-de-negocio.md`
- `docs/project/decisoes-consolidadas.md`
- `docs/project/pendencias-de-definicao.md`
- `docs/project/fase-16f-geojson-local.md`
- `docs/project/fase-16g-anexos-png-local.md`

## Objetivo Da Rodada

Executar, em aparelho Android fisico, o smoke integrado das frentes locais:

- GeoJSON local por Propriedade;
- PNG local por Propriedade;
- regressao minima do fluxo demonstravel do app;
- verificacao visual por Admin, Colaborador e Produtor.

Como nao houve Android fisico disponivel, a rodada ficou limitada a verificacao
de ambiente, packageId, APK disponivel e validacoes automatizadas.

## Ambiente Detectado

| Item | Resultado |
|---|---|
| Data da tentativa | 2026-06-10 |
| Sistema da sessao | Windows / PowerShell |
| `adb` no `PATH` | Nao |
| `adb` local encontrado | `C:\Users\e_vsjesus\AppData\Local\Android\Sdk\platform-tools\adb.exe` |
| Android fisico conectado/autorizado | Nao |
| Dispositivo listado por `adb` direto | `emulator-5554 device product:sdk_gtablet_x86_64 model:Pixel_Tablet device:emu64xa transport_id:2` |
| Android version do aparelho fisico | Nao aplicavel; nenhum aparelho fisico usado |
| packageId | `com.tcheagro.mobile` |
| Fonte do packageId | `app.json` e `android/app/build.gradle` |
| Execucao disponivel | APK release existente, mas nao instalado em Android fisico nesta rodada |

APKs encontrados:

- `dist/tche-agro-mobile-1.0.0-android-release.apk`
- `dist/tche-agro-mobile-2026-06-05-geojson-release.apk`
- `android/app/build/outputs/apk/release/app-release.apk`

Nao foi gerado novo APK, nao houve mudanca em `app.json`, `build.gradle`,
versao, fluxo de build ou configuracao nativa.

## Resultado Dos Comandos De Ambiente

| Comando | Resultado |
|---|---|
| `adb devices` | Falhou: `adb` nao reconhecido no `PATH` |
| `C:\Users\e_vsjesus\AppData\Local\Android\Sdk\platform-tools\adb.exe devices` | Passou, mas listou apenas `emulator-5554` |
| `C:\Users\e_vsjesus\AppData\Local\Android\Sdk\platform-tools\adb.exe devices -l` | Passou, listando apenas emulador Pixel Tablet |

Conclusao: havia `adb` local utilizavel por caminho absoluto, mas nao havia
aparelho Android fisico conectado/autorizado. O emulador listado nao atende ao
criterio operacional da Fase 16H.1.

## Arquivos De Teste

Nenhum arquivo de teste foi usado no aparelho nesta rodada.

Nao foram preparados, enviados por `adb push` ou selecionados via
DocumentPicker:

- PNG valido 1;
- PNG valido 2;
- arquivo nao PNG invalido;
- GeoJSON valido 1;
- GeoJSON valido 2;
- arquivo `.json` ou `.geojson` invalido.

Motivo: sem Android fisico disponivel, nao havia smoke operacional para
executar. A preparacao deve ser feita em diretorio temporario ou fora do
controle de versao quando houver aparelho fisico conectado.

## Smoke Base Do App

| Item | Resultado | Observacao |
|---|---|---|
| 1. Instalar ou abrir o app no Android fisico | Bloqueado | Sem aparelho fisico |
| 2. Confirmar abertura sem tela vermelha/crash | Bloqueado | App nao foi aberto em aparelho fisico |
| 3. Login como Admin Demonstracao | Bloqueado | Depende do aparelho |
| 4. Abrir Propriedade Sela de Prata I | Bloqueado | Depende do aparelho |
| 5. Confirmar mapa base/talhoes | Bloqueado | Depende do aparelho |
| 6. Tocar em talhao e confirmar detalhe | Bloqueado | Depende do aparelho |
| 7. Ir para `Mapas/Arquivos tecnicos` | Bloqueado | Depende do aparelho |
| 8. Confirmar cinco PNGs demonstrativos da Sela | Bloqueado | Depende do aparelho |
| 9. Abrir cada PNG demonstrativo | Bloqueado | Depende do aparelho |
| 10. Confirmar ausencia de gestao em PNG asset/mockado | Bloqueado | Depende do aparelho |

## Smoke GeoJSON Local - Admin

| Item | Resultado | Observacao |
|---|---|---|
| 1. Usar `Anexar GeoJSON dos talhoes` | Bloqueado | Sem aparelho fisico |
| 2. Selecionar GeoJSON valido | Bloqueado | Sem DocumentPicker no aparelho |
| 3. Confirmar pre-visualizacao | Bloqueado | Depende do aparelho |
| 4. Confirmar anexo | Bloqueado | Depende do aparelho |
| 5. Confirmar camada local em runtime | Bloqueado | Depende do aparelho |
| 6. Confirmar nomes dos talhoes de smoke | Bloqueado | Depende do aparelho |
| 7. Fechar e reabrir app | Bloqueado | Depende do aparelho |
| 8. Confirmar persistencia do GeoJSON local | Bloqueado | Depende do aparelho |
| 9. Usar `Substituir GeoJSON dos talhoes` | Bloqueado | Depende do aparelho |
| 10. Selecionar segundo GeoJSON valido | Bloqueado | Depende do aparelho |
| 11. Confirmar substituicao e modal sem travar | Bloqueado | Depende do aparelho |
| 12. Usar `Remover GeoJSON local` | Bloqueado | Depende do aparelho |
| 13. Confirmar fallback para seed/mock | Bloqueado | Depende do aparelho |
| 14. Reabrir app e confirmar remocao persistida | Bloqueado | Depende do aparelho |
| 15. Testar cancelamento do picker | Bloqueado | Depende do aparelho |
| 16. Testar arquivo invalido | Bloqueado | Depende do aparelho |

Resultado GeoJSON: nao aprovado operacionalmente. A frente permanece
tecnicamente pronta por validacoes automatizadas anteriores e desta sessao,
mas ainda sem smoke Android fisico aprovado.

## Smoke PNG Local - Admin

| Item | Resultado | Observacao |
|---|---|---|
| 1. Usar `Anexar mapa PNG` | Bloqueado | Sem aparelho fisico |
| 2. Selecionar PNG valido | Bloqueado | Sem DocumentPicker no aparelho |
| 3. Preencher formulario minimo | Bloqueado | Depende do aparelho |
| 4. Salvar | Bloqueado | Depende do aparelho |
| 5. Confirmar PNG local na listagem | Bloqueado | Depende do aparelho |
| 6. Confirmar que URI local crua nao aparece | Bloqueado | Depende do aparelho |
| 7. Abrir PNG local | Bloqueado | Depende do aparelho |
| 8. Confirmar `Image` com URI local | Bloqueado | Depende do aparelho |
| 9. Fechar e reabrir app | Bloqueado | Depende do aparelho |
| 10. Confirmar persistencia do PNG local | Bloqueado | Depende do aparelho |
| 11. Usar `Substituir PNG` | Bloqueado | Depende do aparelho |
| 12. Selecionar segundo PNG valido | Bloqueado | Depende do aparelho |
| 13. Confirmar novo PNG abrindo | Bloqueado | Depende do aparelho |
| 14. Confirmar item anterior nao ativo no fluxo substituido | Bloqueado | Depende do aparelho |
| 15. Confirmar tela sem ficar presa | Bloqueado | Depende do aparelho |
| 16. Usar `Remover PNG local` | Bloqueado | Depende do aparelho |
| 17. Confirmar saida da listagem ativa | Bloqueado | Depende do aparelho |
| 18. Reabrir app e confirmar remocao persistida | Bloqueado | Depende do aparelho |
| 19. Confirmar PNGs demonstrativos intactos | Bloqueado | Depende do aparelho |
| 20. Testar cancelamento do picker | Bloqueado | Depende do aparelho |
| 21. Testar arquivo nao PNG | Bloqueado | Depende do aparelho |

Resultado PNG: nao aprovado operacionalmente. A frente permanece tecnicamente
revisada, mas ainda sem validacao fisica de `Image` com `file://`, picker,
substituicao, remocao e reabertura do app.

## Resultado Por Perfil

| Perfil | Resultado | Observacao |
|---|---|---|
| Admin Demonstracao | Bloqueado | Login e gestao GeoJSON/PNG nao executados em aparelho fisico |
| Produtor Demonstracao | Bloqueado | Consulta e ausencia de acoes administrativas nao executadas em aparelho fisico |
| Colaborador de Campo | Bloqueado | Gestao dentro do escopo e bloqueio fora do escopo nao executados em aparelho fisico |

## Persistencia Local

| Item | Resultado | Observacao |
|---|---|---|
| Force-stop por `adb shell am force-stop <packageId>` | Bloqueado | Sem aparelho fisico |
| Reabrir app e confirmar sessao/comportamento | Bloqueado | Sem aparelho fisico |
| Confirmar mock local preservado | Bloqueado | Sem aparelho fisico |
| Confirmar `@tche:mock-mvp:v1` sem PNG/GeoJSON bruto | Bloqueado no aparelho | Coberto indiretamente por testes automatizados |
| Confirmar stores separadas de GeoJSON e PNG | Bloqueado no aparelho | Coberto indiretamente por testes automatizados |

## Bugs Encontrados E Correcoes

Nenhum bug funcional foi encontrado durante smoke, porque o smoke operacional
nao foi executado.

Nenhuma correcao pequena foi aplicada.

Arquivos preservados sem alteracao funcional:

- `Mapa.list`;
- `src/api/mock.ts`;
- `@tche:mock-mvp:v1`;
- assets, seed e registros mockados da Sela de Prata I.

Escopo preservado:

- sem backend;
- sem JWT;
- sem RBAC real;
- sem sync;
- sem upload remoto;
- sem download/compartilhamento;
- sem zoom avancado;
- sem APK final novo;
- sem `expo-image-picker`;
- sem leitura de bytes/string/conteudo de PNG em JS;
- sem salvar GeoJSON bruto ou PNG em AsyncStorage.

## Validacoes Automatizadas Executadas

Validacoes iniciais da rodada:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` falhou primeiro sem rede externa e passou depois
  com acesso aos servidores da Expo;
- `git diff --check` passou.

Validacoes finais da rodada:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/geojsonPropertyManageWorkflow.test.js` passou;
- `node tests/geojsonTalhoesLayerService.test.js` passou;
- `node tests/geojsonPropertyImportWorkflow.test.js` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `node tests/pngMapPropertyManageWorkflow.test.js` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` falhou primeiro sem rede externa e passou depois
  com acesso aos servidores da Expo;
- `git diff --check` passou; no Windows, emitiu apenas avisos normais de
  LF/CRLF nos documentos alterados.

As validacoes automatizadas confirmam a consistencia tecnica atual, mas nao
substituem o smoke em Android fisico.

## 16H.2 - Smoke Tecnico Em Emulador E APK Atual

Status em 2026-06-10: com o emulador Android ligado, foi executado um smoke
tecnico preparatorio do APK atual, ainda em Expo SDK 48. Esta rodada nao
substitui o criterio operacional em Android fisico, mas confirma que o build
release atual instala e abre no emulador.

Ambiente:

- emulador detectado por `adb`:
  `emulator-5554 device product:sdk_gtablet_x86_64 model:Pixel_Tablet`;
- Node local: `v22.20.0`;
- npm local: `10.9.3`;
- Expo CLI local: `0.7.3`;
- SDK atual do projeto: Expo SDK `48.0.0`;
- packageId: `com.tcheagro.mobile`.

Validador de dependencias:

- `npx expo install --check` falhou sem rede externa e passou com acesso aos
  servidores da Expo;
- para o SDK 48 atual, as dependencias instaladas estao alinhadas;
- `npm outdated --long` confirmou que o npm publica Expo `56.0.9` como versao
  mais recente, mas essa informacao bruta nao deve ser usada para atualizar
  pacotes isolados fora da matriz de compatibilidade do Expo SDK.

Referencias oficiais consultadas:

- a documentacao oficial do Expo lista SDK 56 como referencia atual;
- SDK 56 usa React Native `0.85`, React `19.2.3` e requer Node minimo
  `22.13.x`;
- o guia oficial de upgrade recomenda instalar o novo `expo`, rodar
  `npx expo install --fix`, atualizar projetos nativos e seguir changelogs;
- pelo salto do projeto de SDK 48 para SDK 56, a migracao deve ser tratada como
  frente propria e preferencialmente incremental, sem misturar com o smoke de
  fechamento operacional da 16F/16G.

Validacoes locais executadas antes do build:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run test:domain-compat` passou.

APK gerado:

- comando: `.\gradlew.bat assembleRelease`, executado em `android/`;
- resultado: `BUILD SUCCESSFUL`;
- APK principal atualizado:
  `android/app/build/outputs/apk/release/app-release.apk`;
- copia de teste preservada fora do controle de versao:
  `dist/tche-agro-mobile-2026-06-10-emulator-release.apk`;
- tamanho da copia: `28514417` bytes.

Warnings do build:

- warnings normais do bundle Hermes sobre variaveis globais;
- avisos de Gradle/Kotlin em dependencias antigas do SDK 48;
- aviso de recursos Gradle depreciados e incompatibilidade futura com Gradle
  8.0;
- nenhum desses avisos bloqueou o build desta rodada.

Smoke no emulador:

- `adb install -r android\app\build\outputs\apk\release\app-release.apk`
  passou;
- abertura via `adb shell monkey -p com.tcheagro.mobile -c
  android.intent.category.LAUNCHER 1` passou;
- o app abriu sem tela vermelha ou crash visivel;
- a primeira abertura exibiu a tela de acesso demonstrativo local;
- apos reinstall/abertura do APK recem-gerado, a sessao local de Admin foi
  restaurada e o app abriu no Dashboard;
- `adb shell am force-stop com.tcheagro.mobile` seguido de nova abertura
  restaurou o Dashboard Admin novamente.

Resultado:

- aprovado como smoke tecnico em emulador do APK atual;
- nao aprovado como smoke operacional de 16F/16G, porque o criterio ativo pede
  Android fisico;
- nenhum fluxo de DocumentPicker foi exercitado nesta rodada;
- nenhum GeoJSON ou PNG local foi anexado/substituido/removido no emulador;
- nenhuma correcao funcional foi aplicada.

## Status Final Recomendado

16F GeoJSON:

- manter tecnicamente pronta;
- manter operacionalmente aberta;
- nao marcar como aprovada em Android fisico nesta rodada;
- registrar a 16H.2 apenas como evidencia preparatoria em emulador.

16G PNG:

- manter tecnicamente revisada;
- manter operacionalmente aberta;
- nao marcar como aprovada em Android fisico nesta rodada;
- registrar a 16H.2 apenas como evidencia preparatoria em emulador.

Fase 16H.1:

- registrar como tentativa bloqueada por ausencia de aparelho Android fisico
  conectado/autorizado;
- reexecutar quando houver aparelho fisico disponivel no `adb`.

## Pendencias Residuais

- colocar Android fisico em modo depuracao USB;
- autorizar o computador no prompt do aparelho;
- garantir que o aparelho apareca em `adb devices` como `device`, nao apenas
  emulador;
- instalar ou abrir o APK/dev build existente sem mudar versao/configuracao;
- preparar arquivos temporarios de smoke para GeoJSON e PNG;
- executar o checklist integrado completo;
- registrar Android version, modelo do aparelho, arquivos usados e evidencias
  operacionais;
- fechar 16F e 16G operacionalmente apenas se os itens criticos passarem.
- abrir uma frente separada para migracao Expo SDK 48 -> SDK 56, com upgrade
  de dependencias, projetos nativos e build Android proprio, antes de trocar a
  base de demonstracao.
