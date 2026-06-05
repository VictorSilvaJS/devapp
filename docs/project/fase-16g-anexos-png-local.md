# Fase 16G - Anexos PNG Locais De Mapas Tecnicos

## Status

Status em 2026-06-05: a Fase 16G.1 foi aberta como diagnostico e contrato
isolado para anexos PNG locais por Propriedade.

Status em 2026-06-05: a Fase 16G.2 criou o servico local isolado de metadados
PNG em `src/services/PngMapImportService.ts`, persistindo somente metadados
pequenos em `@tche:png-map-imports:v1`.

Status em 2026-06-05: a Fase 16G.3 criou o servico isolado de selecao e
validacao leve de PNG em `src/services/PngFilePickerService.ts`, usando
`expo-document-picker` por adapter injetavel, sem ler conteudo, sem copiar para
storage interno e sem persistir metadados.

Status em 2026-06-05: a Fase 16G.4 criou o servico isolado de storage interno
de PNG em `src/services/PngStorageService.ts`, copiando arquivo validado para
diretorio controlado do app por Propriedade, sem tela, sem botao, sem salvar
metadados e sem integrar com `Mapa.list` ou `MapasScreen`.

A frente GeoJSON da Fase 16F continua tecnicamente pronta, mas o smoke Android
fisico permanece pendente. A abertura da 16G ocorre em paralelo por necessidade
operacional e nao fecha operacionalmente a 16F.

Esta frente ainda nao altera telas, nao adiciona botao, nao persiste metadados
do PNG selecionado, nao altera `Mapa.list`, nao muda os registros da Sela de
Prata I e nao implementa backend, JWT, RBAC real, sincronizacao ou APK final.

## Base Documental Ativa

- `docs/project/estado-atual.md`
- `docs/project/escopo-mvp.md`
- `docs/project/regras-de-negocio.md`
- `docs/project/decisoes-consolidadas.md`
- `docs/project/pendencias-de-definicao.md`
- `docs/project/fase-16f-geojson-local.md`

Regras preservadas:

- `Propriedade` e o termo visual oficial para a unidade operacional.
- `fazenda_id` continua chave tecnica interna temporaria quando o dado pertence
  a uma Propriedade.
- Mapas e arquivos devem existir no contexto da Propriedade.
- PNGs de fertilidade da Sela de Prata I sao anexos visuais da biblioteca de
  materiais, nao camadas georreferenciadas sobrepostas ao mapa interativo.
- Fluxos de upload, storage/backend, RBAC real e sincronizacao continuam fora
  do MVP demonstravel atual.

## Arquivos Analisados

- `src/screens/MapasScreen.tsx`
- `src/api/mock.ts`
- `entities/Mapa.json`
- `src/types/mapa.ts`
- `src/types/anexoFertilidade.ts`
- `src/assets/mapas/sela-prata-i/2025/fertilidade/`
- `src/assets/mapas/sela-prata-i/2025/fertilidade/index.ts`
- `src/utils/mapaDownloadCompat.ts`
- `src/services/MapaCacheService.ts`
- `src/services/MapaSincronizacaoService.ts`
- `src/services/mapaOfflineCompat.ts`
- `src/services/GeoJsonImportService.ts`
- `src/types/geojsonImport.ts`
- `src/navigation/index.tsx`
- `src/screens/ProdutorScreen.tsx`
- `docs/project/fase-16f-geojson-local.md`

## Diagnostico Dos PNGs Atuais

### Onde ficam os PNGs fisicos

Os PNGs demonstrativos ficam embutidos no app em:

- `src/assets/mapas/sela-prata-i/2025/fertilidade/ph_10a20.png`
- `src/assets/mapas/sela-prata-i/2025/fertilidade/ar_10a20.png`
- `src/assets/mapas/sela-prata-i/2025/fertilidade/mo_10a20.png`
- `src/assets/mapas/sela-prata-i/2025/fertilidade/pp_10a20.png`
- `src/assets/mapas/sela-prata-i/2025/fertilidade/kk_10a20.png`

O arquivo `src/assets/mapas/sela-prata-i/2025/fertilidade/index.ts` declara a
base `asset://mapas/sela-prata-i/2025/fertilidade`, mapeia cada URL interna
para `require('./*.png')` e exporta `resolveSelaPrataIFertilidadeAssetSource`.

Nao existe miniatura separada. A mesma imagem e usada como anexo aberto no
modal.

### Como sao importados no codigo

Os registros de `Mapa` em `src/api/mock.ts` usam `arquivo_url` com esquema
`asset://`. A tela `MapasScreen.tsx` chama `avaliarDownloadMapa`, tenta
resolver a URL com `resolveSelaPrataIFertilidadeAssetSource` e, quando encontra
asset interno, abre o PNG em um modal com `Image`.

O fluxo atual nao usa `file://`, `content://`, picker, copia para storage
interno ou cadastro administrativo persistente de PNG.

### Representacao atual em `Mapa`

Os cinco PNGs da Sela de Prata I sao registros de `Mapa` em `src/api/mock.ts`,
com ids:

- `m_sela1_ph_10a20_2025`
- `m_sela1_argila_10a20_2025`
- `m_sela1_materia_organica_10a20_2025`
- `m_sela1_fosforo_10a20_2025`
- `m_sela1_potassio_10a20_2025`

Campos comuns nesses registros:

- `titulo`
- `categoria: 'fertilidade'`
- `subcategoria`
- `tipo_material: 'diagnostico'`
- `elemento`
- `elemento_label`
- `profundidade: '10-20 cm'`
- `produtor_id`
- `fazenda_id`
- `propriedade_id`
- `tipo_anexo: 'anexo_fertilidade'`
- `talhao: 'Propriedade inteira'`
- `talhao_id: null`
- `talhao_nome: 'Propriedade inteira'`
- `data_criacao`
- `safra: '2025'`
- `arquivo_nome_original`
- `arquivo_url`
- `formato_arquivo: 'png'`
- `tamanho_arquivo`
- `origem: 'drive_importado'`
- `status: 'liberado'`
- `visivel_para_produtor: true`
- `disponivel_download: true`
- `observacoes`

### Campos obrigatorios atuais

Pelo schema `entities/Mapa.json`, os obrigatorios formais sao:

- `titulo`
- `categoria`
- `talhao`
- `fazenda_id` ou `produtor_id`

Na pratica da UI atual, para o PNG aparecer e abrir corretamente, tambem
importam:

- `id`
- `arquivo_url`
- `formato_arquivo`
- `disponivel_download` ou `disponivel_para_download`
- `categoria`
- `data_criacao`, quando a ordenacao por recente for usada

### Campos legados

- `fazenda_id`: chave tecnica operacional do contexto de Propriedade.
- `produtor_id`: ainda aparece como compatibilidade; nos mapas, pode carregar
  o mesmo valor de `fazenda_id` quando o dado pertence a uma Propriedade.
- `disponivel_para_download`: alias legado tratado em compatibilidade.
- Nomes publicos de tela/servico com `Fazenda` permanecem por compatibilidade.

### Campos futuros ou preparatorios

- `propriedade_id`
- `tipo_anexo`
- `elemento_label`
- `talhao_id`
- `talhao_nome`
- `arquivo_nome_original`
- `origem`
- `status`
- `visivel_para_produtor`

Esses campos ja ajudam a aproximar os PNGs de um contrato futuro de anexos,
mas ainda nao substituem a entidade `Mapa` nem representam backend/storage real.

## Filtros E Listagem Na Tela

`MapasScreen.tsx` carrega `Mapa.list()` e `LimiteArea.list()`. Depois filtra os
mapas por propriedades permitidas com `filtrarMapasPorFazendaIds`.

Regras relevantes:

- Produtor recebe filtro adicional `somenteDisponiveisDownload`, entao so ve
  materiais com `disponivel_download` efetivo.
- Admin e Colaborador veem materiais dentro do escopo calculado pela tela e
  pelas regras de acesso.
- Em contexto de Propriedade especifica, a tela trabalha com o `fazendaId` da
  rota.
- Em contexto geral, a tela pode filtrar por Propriedade operacional.

Filtros visuais atuais:

- categoria: `todos`, `fertilidade`, `correcao`, `indice_vegetacao`,
  `panorama`, `plantio`;
- busca textual;
- safra/ano;
- talhao;
- ordenacao por recente ou titulo;
- Propriedade, quando a tela nao esta em contexto fixo de uma Propriedade.

A busca considera titulo, subcategoria, elemento, profundidade, tipo de
material, talhao, safra, observacoes, nome da Propriedade e Titular.

Quando todos os materiais do contexto sao de fertilidade, ou o filtro ativo e
`fertilidade`, a secao aparece como `Anexos de fertilidade`. O card de um PNG
com `tipo_anexo: 'anexo_fertilidade'` aparece como `Anexo de fertilidade` e o
comando visual fica `Abrir anexo`.

## Categorias Atuais

Nos PNGs da Sela de Prata I:

| Elemento | `categoria` | `subcategoria` | `elemento` | `elemento_label` | Arquivo |
|---|---|---|---|---|---|
| pH | `fertilidade` | `pH` | `ph` | `pH` | `PH_10a20.png` |
| Argila | `fertilidade` | `Argila` | `argila` | `Argila` | `AR_10a20.png` |
| Materia organica | `fertilidade` | `Materia Organica` | `materia_organica` | `Materia organica` | `MO_10a20.png` |
| Fosforo | `fertilidade` | `Fosforo` | `fosforo` | `Fosforo` | `PP_10a20.png` |
| Potassio | `fertilidade` | `Potassio` | `potassio` | `Potassio` | `KK_10a20.png` |

O campo usado para categoria principal e `categoria`. Para a Sela, ele e sempre
`fertilidade`.

O elemento tecnico aparece principalmente em `elemento` e `elemento_label`, com
fallback visual para `subcategoria` quando `elemento_label` nao existe.

## Vinculo Com Propriedade E Talhao

O vinculo tecnico atual dos mapas e feito por `fazenda_id`, com apoio de
`getMapaFazendaId` e `filtrarMapasPorFazendaIds`.

Nos PNGs da Sela:

- `fazenda_id: p_sela1`
- `produtor_id: p_sela1`
- `propriedade_id: p_sela1`

O vinculo com talhao esta representado como Propriedade inteira:

- `talhao: 'Propriedade inteira'`
- `talhao_id: null`
- `talhao_nome: 'Propriedade inteira'`

A tela decide o texto do talhao por `talhao_nome` primeiro e depois por
`talhao`. Nao ha regra especial para `talhao_id: null`; o label textual e que
comunica Propriedade inteira.

## Visualizacao Do PNG

O usuario toca no card do material. Se `avaliarDownloadMapa` considerar o
arquivo abrivel, `handleDownload` tenta resolver a URL como asset da Sela de
Prata I. Quando encontra, abre um modal de preview com `Image`.

Comportamento atual:

- abre em modal dentro da propria `MapasScreen`;
- usa `Image` do React Native;
- usa `resizeMode="contain"`;
- exibe titulo, elemento e profundidade;
- tem botao de fechar;
- nao possui zoom/pinch;
- nao possui fallback visual sofisticado se o `Image` falhar;
- se a URL `asset://` nao for reconhecida pelo resolvedor da Sela, exibe erro
  de asset interno nao localizado;
- para URLs nao-asset, confirma e tenta `Linking.openURL`.

Compatibilidade futura:

- `mapaDownloadCompat.ts` aceita `file://`, `content://`, `data:` e `asset://`
  como esquemas abríveis;
- um PNG copiado para storage interno com URI `file://` pode ser abrivel pela
  logica de download, mas a experiencia atual tenderia a usar `Linking` se nao
  houver novo resolvedor/componente;
- para uma experiencia local consistente, a 16G futura deve criar visualizador
  que aceite `ImageSourcePropType` de asset e tambem `{ uri: arquivo_uri_local }`
  para PNG local;
- o fluxo atual de modal sugere que `Image` e caminho viavel para `file://`,
  mas isso deve ser validado no Android fisico durante 16G.7/16G.9.

## Entidade Atual `Mapa`

### Campos usados em runtime pela UI

- `id`
- `titulo`
- `categoria`
- `subcategoria`
- `elemento`
- `elemento_label`
- `profundidade`
- `tipo_material`
- `fazenda_id` / alias resolvido por `getMapaFazendaId`
- `produtor_id`, como legado quando usado no resolvedor de contexto
- `talhao`
- `talhao_nome`
- `safra`
- `data_criacao`
- `arquivo_nome_original`
- `arquivo_url`
- `arquivo_panorama_url`, como fallback de URL
- `formato_arquivo`
- `tamanho_arquivo`
- `observacoes`
- `tipo_anexo`
- `disponivel_download`
- `disponivel_para_download`, como alias legado

### Campos apenas mockados ou preparatorios

- `propriedade_id`
- `tipo_anexo`
- `talhao_id`
- `origem`
- `status`
- `visivel_para_produtor`
- `arquivo_nome_original`

Esses campos aparecem no mock da Sela e/ou no tipo futuro
`AnexoFertilidade`, mas ainda nao sao contrato de runtime completo para
cadastro local de PNG.

### Campos recomendados para PNG local futuro

- `id`
- `propriedade_id`
- `fazenda_id`
- `nome_propriedade`
- `titulo`
- `descricao`
- `categoria`
- `categoria_label`
- `elemento`
- `elemento_label`
- `safra`
- `ano`
- `profundidade`
- `escopo`
- `talhao_id`
- `talhao_nome`
- `arquivo_nome_original`
- `arquivo_uri_local`
- `arquivo_tamanho_bytes`
- `arquivo_mime`
- `importado_por_usuario_id`
- `importado_por_nome`
- `importado_em`
- `atualizado_em`
- `status`
- `visivel_para_produtor`
- `origem`
- `versao`

## Contrato Local Recomendado

Foi criado o tipo isolado `src/types/anexoPngLocal.ts`.

Nome principal:

- `PngMapImportMetadata`

Constantes:

- `PNG_MAP_IMPORT_VERSION = 1`
- `PNG_MAP_IMPORT_STORAGE_KEY = '@tche:png-map-imports:v1'`

Decisoes do contrato:

- `propriedade_id` e `fazenda_id` ficam ambos obrigatorios para leitura dupla.
- `fazenda_id` permanece por compatibilidade com a tela e regras atuais.
- `categoria` segue o padrao amplo de `Mapa`, por exemplo `fertilidade`,
  `indice_vegetacao`, `produtividade`, `plantio`, `operacional` ou `outro`.
- O elemento tecnico especifico fica em `elemento`, por exemplo `ph`,
  `fosforo`, `potassio`, `argila`, `materia_organica`, `ndvi`, `sementes` ou
  `linhas_plantio`.
- `escopo` separa `propriedade` de `talhao`.
- `arquivo_uri_local` aponta para o arquivo copiado ao storage interno, quando
  a fase de storage existir.
- `origem` fica restrita a `arquivo_local` para esta frente.
- `versao` permite migracao futura do snapshot de metadados.

Relacao com `Mapa` atual:

- este tipo nao substitui `Mapa`;
- nao migra os PNGs mockados da Sela de Prata I;
- uma fase futura pode integrar os metadados locais a listagem por uma camada
  compatível, montando registros semelhantes a `Mapa` para a UI;
- essa integracao deve preservar `fazenda_id`, `propriedade_id`,
  `disponivel_download`, `tipo_anexo`, `elemento_label`, `talhao_nome` e
  `arquivo_url`/`arquivo_uri_local` sem quebrar os anexos existentes.

## Estrategia Futura De Persistencia

Recomendacao:

- PNG fisico nao deve ir para `AsyncStorage`;
- PNG deve ser copiado para storage interno do app;
- `AsyncStorage` deve guardar apenas metadados pequenos;
- chave futura recomendada: `@tche:png-map-imports:v1`;
- metadados locais podem ser integrados futuramente aos anexos de `Mapa` por
  uma camada compatível, sem alterar o seed da Sela;
- arquivos removidos/substituidos devem ser apagados apenas quando estiverem
  dentro do diretorio controlado da 16G futura;
- o snapshot mock `@tche:mock-mvp:v1` nao deve receber o binario do PNG.

Essa estrategia segue o criterio ja adotado na 16F: conteudo grande em storage
interno, metadados pequenos em chave propria.

## 16G.2 - Servico Local De Metadados PNG

Status em 2026-06-05: foi criado o servico local de metadados PNG em
`src/services/PngMapImportService.ts`.

Arquivos criados:

- `src/services/PngMapImportService.ts`
- `tests/pngMapImportService.test.js`

Arquivos alterados:

- `src/types/anexoPngLocal.ts`
- `tsconfig.domain-compat.json`
- `package.json`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Chave de persistencia:

- `@tche:png-map-imports:v1`

Formato do snapshot:

```ts
interface PngMapImportSnapshot {
  version: number;
  savedAt: string;
  items: PngMapImportMetadata[];
}
```

Operacoes disponiveis:

- `listPngMapImports`
- `listPngMapImportsByPropriedade`
- `listActivePngMapImportsByPropriedade`
- `getPngMapImportById`
- `createPngMapImportMetadata`
- `updatePngMapImportMetadata`
- `markPngMapImportAsActive`
- `markPngMapImportAsSubstituido`
- `markPngMapImportAsRemoved`
- `deletePngMapImportMetadata`

Regras implementadas:

- todo metadado criado precisa de `propriedade_id` ou `fazenda_id`;
- quando so um dos ids vem preenchido, o outro e preenchido com o mesmo valor;
- `origem` deve ser `arquivo_local`;
- `escopo: 'talhao'` exige `talhao_id` ou `talhao_nome`;
- `visivel_para_produtor` usa default `true`, seguindo os anexos de fertilidade
  demonstrativos atuais;
- JSON corrompido em `@tche:png-map-imports:v1` retorna lista vazia e nao
  derruba o app;
- `deletePngMapImportMetadata` remove apenas metadado, sem remover arquivo
  fisico;
- multiplos PNGs `ativo` sao permitidos por Propriedade, porque PNG e
  biblioteca de anexos e nao camada unica de talhoes;
- `removido` e `substituido` nao aparecem em
  `listActivePngMapImportsByPropriedade`.

Sanitizacao:

- o servico rejeita campos suspeitos como `base64`, `content`, `bytes`, `data`,
  `blob`, `buffer`, `file`, `image`, `asset`, `source` e `require`;
- `arquivo_tamanho_bytes` e permitido como metadado numerico pequeno;
- strings grandes demais sao rejeitadas;
- arrays, objetos e funcoes no input sao rejeitados para evitar salvar imagem,
  `require`, buffer, objeto `Image` ou conteudo bruto no indice.

Relacao com `Mapa`:

- `Mapa.list` nao foi alterado;
- `PngMapImportMetadata` ainda nao e convertido para `Mapa`;
- `MapasScreen` nao foi alterada;
- a integracao futura deve acontecer na 16G.6 por camada compativel.

Relacao com storage:

- nao ha picker;
- nao ha leitura de PNG;
- nao ha copia para storage interno;
- nao ha remocao fisica de arquivo;
- `arquivo_uri_local` continua opcional nesta fase e sera preenchido quando a
  frente de storage PNG existir.

Compatibilidade com Sela de Prata I:

- `src/assets/mapas/sela-prata-i/2025/fertilidade/` nao foi alterado;
- `src/assets/mapas/sela-prata-i/2025/fertilidade/index.ts` nao foi alterado;
- registros de `Mapa` da Sela em `src/api/mock.ts` nao foram alterados;
- `resolveSelaPrataIFertilidadeAssetSource` nao foi alterado;
- a tela `MapasScreen` e seus filtros atuais nao foram alterados.

Validacoes da 16G.2:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## 16G.3 - Seletor E Validacao Leve De PNG

Status em 2026-06-05: foi criado o servico isolado de selecao e validacao leve
de PNG em `src/services/PngFilePickerService.ts`.

Arquivos criados:

- `src/services/PngFilePickerService.ts`
- `tests/pngFilePickerService.test.js`

Arquivos alterados:

- `tsconfig.domain-compat.json`
- `package.json`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Operacoes disponiveis:

- `isSupportedPngFileName`
- `isSupportedPngMimeType`
- `normalizePickedPngDocumentResult`
- `validatePickedPngFile`
- `pickPngDocument`
- `pickAndValidatePngDocument`
- `createPngFilePickerService`

Regras implementadas:

- aceita somente arquivos com extensao `.png`, sem diferenciar maiusculas e
  minusculas;
- aceita MIME `image/png`;
- aceita MIME ausente quando o nome do arquivo termina em `.png`;
- aceita `application/octet-stream` somente como fallback de Android quando o
  nome do arquivo termina em `.png`;
- rejeita `.jpg`, `.jpeg`, `.webp`, `.gif`, `.pdf`, `.zip`, `.geojson`,
  `.json` e arquivos sem extensao PNG;
- limita o arquivo selecionado a `25 MB`;
- quando o tamanho nao vem do seletor, retorna warning `UNKNOWN_FILE_SIZE` sem
  reprovar automaticamente;
- normaliza tanto o retorno antigo do `expo-document-picker` (`type:
  'success'`) quanto o formato novo (`canceled: false`, `assets`);
- retorna erro controlado para cancelamento, resultado invalido, falta de URI,
  falta de nome, tipo nao suportado, MIME nao suportado e tamanho excedido.

Uso do `DocumentPicker`:

- usa `expo-document-picker` de forma lazy e por adapter injetavel;
- configura `type` como `['image/png', 'application/octet-stream']`;
- configura `multiple: false`;
- configura `copyToCacheDirectory: true` apenas como cache temporario do picker;
- nao usa `expo-image-picker`;
- nao usa `expo-file-system`;
- nao le string, bytes, binario ou conteudo do PNG.

Relacao com metadados e storage:

- nao importa nem chama `PngMapImportService`;
- nao usa `AsyncStorage`;
- nao escreve em `@tche:png-map-imports:v1`;
- nao escreve em `@tche:mock-mvp:v1`;
- nao copia arquivo para storage interno controlado;
- nao remove arquivo fisico;
- nao persiste metadados;
- a copia para storage interno fica reservada para 16G.4.

Compatibilidade com `Mapa` e Sela de Prata I:

- `Mapa.list` nao foi alterado nem chamado;
- `MapasScreen` nao foi alterada;
- os registros de `Mapa` da Sela de Prata I nao foram alterados;
- `src/assets/mapas/sela-prata-i/2025/fertilidade/` nao foi alterado;
- `resolveSelaPrataIFertilidadeAssetSource` nao foi alterado.

Validacoes da 16G.3:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## 16G.4 - Storage Interno De PNG

Status em 2026-06-05: foi criado o servico isolado de storage interno de PNG em
`src/services/PngStorageService.ts`.

Arquivos criados:

- `src/services/PngStorageService.ts`
- `tests/pngStorageService.test.js`

Arquivos alterados:

- `tsconfig.domain-compat.json`
- `package.json`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Diretorio interno adotado:

- `FileSystem.documentDirectory + 'tche-png-imports/'`

Estrutura de path:

- subdiretorio por `propriedade_id` sanitizado;
- arquivo no formato `{importId}-{nome-sanitizado}.png`;
- exemplo: `.../tche-png-imports/p_sela1/import-001-mapa-ph.png`;
- nao usa nome de Propriedade, nome de usuario ou path recebido do usuario sem
  sanitizacao.

Operacoes disponiveis:

- `sanitizePngFileName`
- `sanitizePngPathSegment`
- `buildPngStorageDirectoryUri`
- `buildPngStorageUri`
- `ensurePngStorageDirectory`
- `copyPngToInternalStorage`
- `getStoredPngInfo`
- `deleteStoredPng`
- `isSafePngStorageUri`
- `createPngStorageService`

Regras implementadas:

- cria diretorio base e subdiretorio da Propriedade quando necessario;
- sanitiza `propriedade_id`, `importId` e nome original;
- aceita `.PNG` e normaliza para `.png`;
- remove componentes de path, barras, `../`, bytes nulos e caracteres
  perigosos;
- limita os segmentos de path e aplica fallback `mapa-tecnico.png`;
- usa `importId` recebido de fora ou gerador injetavel para testes;
- bloqueia sobrescrita por padrao;
- permite `overwrite: true` somente quando explicito;
- valida que destino e remocao ficam dentro de `tche-png-imports/`;
- retorna erro controlado quando diretorio, destino, copia, info ou remocao
  falham.

Estrategia de copia:

- usa `FileSystem.copyAsync({ from: sourceUri, to: destinationUri })`;
- confirma existencia com `FileSystem.getInfoAsync(destinationUri)`;
- captura tamanho quando disponivel;
- retorna `uri`, nome final, nome original, tamanho, MIME `image/png`,
  `propriedade_id`, `fazenda_id` e `copiedAt`;
- nao le bytes/conteudo do PNG em JS;
- nao converte PNG para texto;
- nao usa fallback textual.

Remocao segura:

- `deleteStoredPng` remove apenas arquivo seguro dentro de
  `tche-png-imports/{propriedade_id}/`;
- recusa path fora do diretorio base;
- recusa remover o diretorio base;
- recusa remover subdiretorio de Propriedade;
- trata arquivo inexistente como sucesso controlado com `deleted: false`;
- nao toca nos assets da Sela de Prata I nem em `src/assets`.

Relacao com a 16G.3:

- `PngFilePickerService` continua responsavel por selecionar e validar o PNG
  temporario/cache;
- `PngStorageService` recebe `sourceUri` e copia para URI local estavel;
- o storage service nao abre picker.

Relacao com a 16G.2:

- nao chama `PngMapImportService`;
- nao cria metadado;
- nao escreve em `@tche:png-map-imports:v1`;
- nao escreve em `@tche:mock-mvp:v1`.

Compatibilidade com Sela de Prata I:

- `src/assets/mapas/sela-prata-i/2025/fertilidade/` nao foi alterado;
- `src/assets/mapas/sela-prata-i/2025/fertilidade/index.ts` nao foi alterado;
- registros de `Mapa` da Sela em `src/api/mock.ts` nao foram alterados;
- `resolveSelaPrataIFertilidadeAssetSource` nao foi alterado;
- `MapasScreen` nao foi alterada.

Validacoes da 16G.4:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF;
- `npx expo install --check` passou.

## Proximas Microfases Recomendadas

- 16G.5A: botao `Anexar mapa PNG`.
- 16G.5B: formulario minimo de metadados.
- 16G.5C: persistencia local dos metadados.
- 16G.6: listagem dos PNGs locais junto aos anexos existentes.
- 16G.7: visualizacao do PNG local.
- 16G.8: substituicao/remocao segura.
- 16G.9: smoke Android PNG.

## Riscos Residuais

- A 16F ainda depende de smoke Android fisico; a 16G nao deve mascarar essa
  pendencia.
- `Image` com `file://` precisa ser validado no Android fisico antes de assumir
  que o visualizador local esta pronto.
- `Linking.openURL` pode nao entregar boa experiencia para PNG local; um
  componente de preview proprio deve ser preferido.
- `categoria` em `Mapa` e ampla, enquanto os elementos de fertilidade ficam em
  `elemento`; misturar esses eixos pode quebrar filtros.
- `visivel_para_produtor` existe no mock, mas a regra efetiva atual de produtor
  ainda passa principalmente por acesso a Propriedade e
  `disponivel_download`.
- Sem backend/RBAC real, a administracao de anexos PNG sera local/mockada e
  deve ser comunicada como demonstrativa.

## Escopo Preservado Nesta Fase

Nao foi feito:

- botao de anexar PNG;
- seletor visivel em tela;
- `expo-image-picker`;
- nova dependencia;
- leitura de conteudo do PNG;
- nova persistencia de metadados alem da 16G.2;
- alteracao em `Mapa.list`;
- alteracao em `MapasScreen`;
- alteracao nos registros da Sela de Prata I;
- alteracao nos PNGs da Sela;
- backend;
- RBAC;
- sincronizacao;
- GeoJSON;
- APK.
