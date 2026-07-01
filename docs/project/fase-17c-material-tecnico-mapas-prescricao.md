# Fase 17C - Material Tecnico: Mapas E Prescricao

Status em 2026-07-01: implementado no MVP local/demonstrativo.

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
- `git diff --check`

Observacao: `npx expo install --check` foi executado. No sandbox falhou com
`ECONNREFUSED 127.0.0.1:9`; repetido fora do sandbox, confirmou divergencia
ja conhecida de dependencia: `expo@56.0.11`, esperado `~56.0.13`. A
dependencia nao foi atualizada nesta fase.

Pendente:

- smoke visual em emulador;
- validacao final em Android fisico.
