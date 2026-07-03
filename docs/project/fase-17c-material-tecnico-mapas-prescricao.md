# Fase 17C - Material Tecnico: Mapas E Prescricao

Status em 2026-07-03: implementado no MVP local/demonstrativo e aprovado em
smoke visual no emulador. Android fisico continua pendente.

## Objetivo

Organizar a area de `Material tecnico` em tres tipos principais:

- Fertilidade
- Correcao de solo
- Prescricao

O PNG local fica para mapas de fertilidade e correcao de solo. Prescricao fica
como pacote tecnico ZIP, anexado localmente e exibido apenas em modal de
detalhes.

## Implementado

- `MapasScreen.tsx` usa filtros principais restritos aos tres tipos definidos.
- O titulo visual da area de anexos passa a ser `Material tecnico`.
- `Anexar PNG` aceita somente tipos de fertilidade e correcao de solo.
- `Anexar prescrição ZIP` valida `.zip`, copia o arquivo para storage interno e
  salva apenas metadados pequenos.
- ZIPs locais ficam em `tche-prescription-zips/{propriedade_id}/`.
- Metadados ficam em `@tche:prescription-zip-imports:v1`.
- Cards mostram tipo, camada/elemento, safra/ano, escopo, nome original e
  tamanho quando disponivel.
- O detalhe de ZIP mostra a mensagem:
  `Pacote técnico anexado localmente. A abertura ou processamento do ZIP não faz parte do MVP atual.`
- Admin e Colaborador autorizado podem anexar, substituir e remover materiais
  locais.
- Produtor consulta materiais visiveis, sem acoes administrativas.

## Fora Do Escopo

- backend, API, banco real, upload remoto, sync e download real;
- unzip, leitura de bytes ou processamento do conteudo do ZIP;
- preview de imagem para ZIP;
- sobreposicao de PNG ou ZIP no mapa interativo;
- alteracao de `Mapa.list`, `src/api/mock.ts`, `LimiteArea.list`, assets ou
  stores existentes.

## Smoke Visual 17C.1

Rodada executada em 2026-07-03 no emulador Android `emulator-5554`
(`Pixel Tablet`, API 35), com APK release
`android/app/build/outputs/apk/release/app-release.apk` gerado por
`.\gradlew.bat :app:assembleRelease` e instalado por `adb install -r`.

Arquivos usados em `/sdcard/Download`:

- `smoke_ph_10a20.png`;
- `prescricao_taxa_variavel_2026.zip`;
- `arquivo_invalido.pdf`;
- `limites_talhoes.json`.

Resultados:

- 17C-01 passou: filtros principais exibiram `Todos`, `Fertilidade`,
  `Correcao de solo` e `Prescricao`; `Todos` e agregador, nao tipo tecnico.
- 17C-02 passou: o formulario PNG ofereceu apenas Fertilidade e Correcao de
  solo; Prescricao nao apareceu no fluxo PNG.
- 17C-03 passou: o ZIP valido abriu modal com tipo/camada, safra/ano, escopo,
  nome original e tamanho.
- 17C-04 passou com comportamento do DocumentPicker: o PDF invalido ficou
  visivel no seletor, mas nao retornou para o app nem criou metadado invalido.
- 17C-05 passou: o ZIP apareceu como Prescricao, abriu detalhe de pacote
  tecnico e nao exibiu preview de imagem.
- 17C-06 passou: substituicao e remocao do ZIP local atualizaram a lista sem
  afetar GeoJSON, PNG local, `Mapa.list` ou seed da Sela.
- 17C-07 passou: Produtor consultou PNG e ZIP, sem botoes de anexar,
  substituir ou remover; detalhe de ZIP permaneceu consultivo e sem preview.

Ajuste pontual feito apos o smoke: a descricao do bloco `PNG local de mapa`
foi corrigida para nao citar Prescricao, mantendo PNG restrito a Fertilidade e
Correcao de solo.

## Validacao

Executado:

- `npm run typecheck`
- `tsc -p tsconfig.domain-compat.json`
- `npm run test:domain-compat`
- `node tests/pngMapPropertyImportWorkflow.test.js`
- `node tests/prescriptionZipImportService.test.js`
- `node tests/prescriptionZipFilePickerService.test.js`
- `node tests/prescriptionZipStorageService.test.js`
- `node tests/prescriptionZipPropertyImportWorkflow.test.js`
- `node tests/prescriptionZipToMapaCompat.test.js`
- `.\gradlew.bat :app:assembleRelease`
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`
- `git diff --check`

Observacao: `npx expo install --check` foi executado. No sandbox falhou com
`ECONNREFUSED 127.0.0.1:9`; repetido fora do sandbox, confirmou divergencia
ja conhecida de dependencia: `expo@56.0.11`, esperado `~56.0.14`. A
dependencia nao foi atualizada nesta fase; a divergencia foi aceita
temporariamente para nao misturar upgrade de SDK com smoke/correcao 17C.1.

Pendente:

- validacao final em Android fisico.
