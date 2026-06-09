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

Status em 2026-06-05: a Fase 16G.5 criou o workflow local de anexo PNG por
Propriedade em `src/services/PngMapPropertyImportWorkflow.ts` e integrou o
botao `Anexar mapa PNG` com formulario minimo em `MapasScreen.tsx`, copiando o
arquivo para storage interno e salvando somente metadados pequenos em
`@tche:png-map-imports:v1`.

Status em 2026-06-05: a Fase 16G.6 criou o helper puro
`src/utils/pngMapToMapaCompat.ts` e integrou os PNGs locais ativos a listagem
principal da `MapasScreen` por lista derivada em runtime, sem alterar
`Mapa.list`.

Status em 2026-06-06: a Fase 16G.7 habilitou a visualizacao de PNG local em
modal na `MapasScreen`, usando `Image` com source `{ uri: arquivo_uri_local }`
apos validacao de URI segura e existencia do arquivo no storage interno.

Status em 2026-06-06: a Fase 16G.8 criou o workflow local de gestao de PNG por
Propriedade em `src/services/PngMapPropertyManageWorkflow.ts` e integrou
substituicao/remocao segura no modal de preview da `MapasScreen`, somente para
Admin ou Colaborador autorizado.

Status em 2026-06-09: a Fase 16G.9 executou revisao tecnica final dos anexos
PNG locais e preparou o checklist de smoke Android fisico. As validacoes
automatizadas passaram, mas o smoke fisico nao foi executado neste ambiente
porque `adb` nao esta disponivel e nao ha aparelho Android acessivel pela
sessao. Portanto, a 16G permanece tecnicamente revisada, mas ainda nao esta
operacionalmente fechada.

A frente GeoJSON da Fase 16F continua tecnicamente pronta, mas o smoke Android
fisico permanece pendente. A abertura da 16G ocorre em paralelo por necessidade
operacional e nao fecha operacionalmente a 16F.

Esta frente ja possui selecao, validacao leve, copia local, metadados locais e
formulario minimo de anexo PNG por Propriedade. Os PNGs locais ativos agora
aparecem na listagem principal de materiais por compatibilidade derivada em
runtime e podem ser abertos, substituidos e removidos localmente pelo modal de
preview quando o usuario tem permissao. Ela ainda nao altera `Mapa.list`, nao
muda os registros da Sela de Prata I e nao implementa zoom avancado,
download/compartilhamento, backend, JWT, RBAC real, sincronizacao ou APK final.
O fechamento operacional ainda depende do smoke Android fisico da 16G.9.

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

## 16G.5 - Botao Anexar Mapa PNG E Formulario Minimo

Status em 2026-06-05: foi criado o workflow local de anexo PNG por
Propriedade e o botao `Anexar mapa PNG` em `MapasScreen.tsx`.

Arquivos criados:

- `src/services/PngMapPropertyImportWorkflow.ts`
- `tests/pngMapPropertyImportWorkflow.test.js`

Arquivos alterados:

- `src/screens/MapasScreen.tsx`
- `tsconfig.domain-compat.json`
- `package.json`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Operacoes disponiveis:

- `canStartPngMapPropertyImport`
- `preparePngMapPropertyImport`
- `confirmPngMapPropertyImport`
- `importPngMapForPropriedade`
- `listPngMapImportsForPropriedade`
- `listActivePngMapImportsForPropriedade`

Regras implementadas:

- o botao aparece apenas em consulta de uma Propriedade especifica;
- Admin pode anexar PNG;
- Colaborador pode anexar PNG somente quando a Propriedade esta dentro do seu
  escopo atual de acesso;
- Produtor nao pode anexar PNG;
- o fluxo exige `propriedade_id` e preserva `fazenda_id` como chave tecnica de
  compatibilidade;
- o seletor aceita apenas PNG validado pela 16G.3;
- o arquivo validado e copiado para storage interno controlado pela 16G.4;
- depois da copia, os metadados pequenos sao salvos em
  `@tche:png-map-imports:v1` pela 16G.2;
- se a persistencia de metadados falhar depois da copia, o workflow tenta
  remover o arquivo copiado;
- multiplos PNGs ativos continuam permitidos para a mesma Propriedade.

Formulario minimo:

- titulo;
- categoria/elemento tecnico;
- safra;
- ano;
- profundidade;
- escopo `Propriedade inteira` ou `Talhao especifico`;
- talhao, quando o escopo for `Talhao especifico`;
- observacoes;
- flag `visivel_para_produtor`.

Mapeamento de categoria:

- `ph`, `fosforo`, `potassio`, `argila` e `materia_organica` geram
  `categoria: 'fertilidade'`;
- `ndvi` gera `categoria: 'indice_vegetacao'`;
- `produtividade` gera `categoria: 'produtividade'`;
- `sementes` e `linhas_plantio` geram `categoria: 'plantio'`;
- `outro` gera `categoria: 'outro'`.

Comportamento visual na `MapasScreen`:

- o painel PNG fica dentro da secao de materiais/anexos da Propriedade;
- quando nao ha PNG local ativo, mostra `Nenhum PNG local anexado a esta
  Propriedade`;
- quando ha PNG local ativo, mostra resumo local com titulo, categoria,
  safra/ano, escopo, arquivo original e data de importacao;
- apos salvar, a tela recarrega o resumo local e informa que a listagem
  integrada dos anexos locais sera consolidada em etapa futura.

Escopo preservado:

- `Mapa.list` nao foi alterado;
- os metadados PNG locais ainda nao sao convertidos em registros de `Mapa`;
- a listagem principal de materiais ainda nao exibe os PNGs locais;
- nao ha preview/abertura do PNG local;
- nao ha substituicao/remocao de PNG pela tela;
- registros e assets da Sela de Prata I nao foram alterados;
- nao ha backend, upload remoto, RBAC real, sincronizacao ou APK final.

Validacoes da 16G.5:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF;
- `npx expo install --check` passou.

## 16G.6 - PNG Local Na Listagem Principal De Materiais

Status em 2026-06-05: os PNGs locais ativos passaram a aparecer na listagem
principal de `Mapas/Arquivos tecnicos` da `MapasScreen`.

Arquivos criados:

- `src/utils/pngMapToMapaCompat.ts`
- `tests/pngMapToMapaCompat.test.js`

Arquivos alterados:

- `src/screens/MapasScreen.tsx`
- `tsconfig.domain-compat.json`
- `package.json`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Helper de compatibilidade:

- converte `PngMapImportMetadata` para um item compativel com os campos usados
  pela listagem atual de mapas;
- preserva `arquivo_uri_local` e o replica apenas como referencia de
  `arquivo_url` para compatibilidade visual, sem transformar em asset;
- nao usa `asset://`;
- nao chama `require`;
- nao importa tela, mock, assets, storage ou backend;
- nao salva o item convertido em storage;
- marca o item como `tipo_anexo: 'anexo_png_local'`, `origem:
  'arquivo_local'` e `is_png_local: true`.

Lista combinada:

- `MapasScreen` continua carregando `Mapa.list()` normalmente;
- os PNGs locais ativos sao carregados de `@tche:png-map-imports:v1` por
  Propriedade permitida;
- a lista principal passa a usar uma lista derivada em runtime:
  `mapas mockados filtrados + PNGs locais convertidos`;
- `Mapa.list` nao foi alterado;
- `@tche:mock-mvp:v1` nao recebe dados de PNG local;
- nao ha copia entre stores.

Visibilidade por perfil:

- Admin ve PNGs locais ativos das Propriedades acessiveis;
- Colaborador ve PNGs locais ativos dentro do seu escopo efetivo;
- Produtor ve apenas PNG local ativo da propria Propriedade quando
  `visivel_para_produtor === true`;
- Admin e Colaborador podem ver PNG ativo mesmo quando nao estiver visivel
  para Produtor.

Filtros e ordenacao:

- PNG local participa de filtro por Propriedade, categoria, safra/ano, talhao
  e busca;
- escopo `propriedade` aparece como `Propriedade inteira`;
- escopo `talhao` usa `talhao_nome`;
- a busca considera titulo, descricao/observacoes, elemento, categoria, nome
  original e o termo `PNG local`;
- a ordenacao por recente usa `importado_em` como `data_criacao`;
- a ordenacao por titulo usa o titulo convertido.

Card/listagem:

- o card mostra o indicador `PNG local`;
- mostra `Anexo local` como detalhe operacional;
- preserva titulo, categoria/elemento, Propriedade, safra/ano, talhao,
  profundidade e nome original quando esses dados existem;
- nao exibe a URI local crua como informacao principal.

Acao de abrir:

- PNG asset/mockado da Sela de Prata I continua abrindo pelo resolvedor
  `resolveSelaPrataIFertilidadeAssetSource`;
- durante a 16G.6, PNG local ainda nao abria e o card mostrava aviso
  controlado;
- a abertura com `Image` usando `file://` ficou reservada para 16G.7.

Compatibilidade com Sela de Prata I:

- os cinco PNGs mockados atuais nao foram alterados;
- os assets atuais nao foram alterados;
- `src/api/mock.ts` nao foi alterado;
- se houver PNG local anexado a Sela de Prata I, ele aparece adicionalmente na
  lista e nao substitui os PNGs mockados.

Escopo preservado:

- nao ha preview/abertura real de PNG local neste corte historico da 16G.6;
- nao ha zoom;
- nao ha substituicao/remocao de PNG pela tela;
- nao ha alteracao em `Mapa.list`;
- nao ha alteracao nos registros ou assets da Sela de Prata I;
- nao ha backend, upload remoto, RBAC real, sincronizacao ou APK final.

Validacoes da 16G.6:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF;
- `npx expo install --check` passou.

## 16G.7 - Visualizacao Do PNG Local Em Modal

Status em 2026-06-06: PNG local anexado, ativo e listado na `MapasScreen`
passou a abrir em modal com `Image`, usando source `{ uri:
arquivo_uri_local }`.

Arquivos alterados:

- `src/utils/pngMapToMapaCompat.ts`
- `src/screens/MapasScreen.tsx`
- `tests/pngMapToMapaCompat.test.js`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Helper de abertura:

- `isPngLocalMapa` identifica PNG local por `tipo_anexo:
  'anexo_png_local'`, `is_png_local: true` ou por `origem: 'arquivo_local'`
  com `formato_arquivo: 'png'` e `arquivo_uri_local` preenchido;
- `resolveMapaPngImageSource` retorna somente `{ uri }` para PNG local valido;
- o helper nao chama `require`, nao converte para base64, nao le bytes em JS e
  nao importa tela, mock, assets, AsyncStorage ou `expo-file-system`;
- URI ausente retorna `Arquivo PNG local não encontrado neste aparelho.`;
- URI fora do diretorio seguro retorna
  `Este arquivo local não pode ser aberto por segurança.`;
- falha de consulta de arquivo retorna `Não foi possível abrir este PNG local.`;
- item nao PNG local retorna `not_png_local` e nao tenta abrir como source
  local.

Integracao na `MapasScreen`:

- ao tocar em PNG local, a tela chama `resolveMapaPngImageSource` com
  `PngStorageService.isSafePngStorageUri` e
  `PngStorageService.getStoredPngInfo`;
- quando a URI e segura e o arquivo existe, o modal atual abre o PNG com
  `Image` e `resizeMode="contain"`;
- o modal mostra titulo, tipo `PNG local`, elemento/categoria, safra/ano,
  talhao ou `Propriedade inteira`, profundidade e nome original quando esses
  dados existem;
- `onError` do `Image` mostra a mensagem controlada
  `Não foi possível abrir este PNG local.` e mantem o modal fechavel;
- a URI local nao e exibida como titulo nem como texto principal.

Compatibilidade preservada:

- os cinco PNGs asset/mockados da Sela de Prata I continuam abrindo por
  `resolveSelaPrataIFertilidadeAssetSource`;
- `src/api/mock.ts`, `Mapa.list` e os assets da Sela de Prata I nao foram
  alterados;
- a visibilidade continua seguindo a lista ja filtrada na 16G.6: Admin e
  Colaborador dentro do escopo, e Produtor apenas quando
  `visivel_para_produtor === true`.

Escopo preservado:

- nao ha zoom/pinch avancado;
- nao ha substituicao/remocao de PNG local;
- nao ha edicao de metadados;
- nao ha download/compartilhamento;
- nao ha backend, sync, RBAC real, GeoJSON ou APK final;
- nao houve alteracao em `Mapa.list`, `src/api/mock.ts` ou nos assets da Sela.

Validacoes da 16G.7:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## 16G.8 - Substituicao E Remocao Segura De PNG Local

Status em 2026-06-06: PNG local anexado, ativo e listado na `MapasScreen`
passou a poder ser substituido ou removido localmente pelo modal de preview,
somente por Admin ou Colaborador dentro do escopo da Propriedade.

Arquivos criados:

- `src/services/PngMapPropertyManageWorkflow.ts`
- `tests/pngMapPropertyManageWorkflow.test.js`

Arquivos alterados:

- `src/screens/MapasScreen.tsx`
- `tsconfig.domain-compat.json`
- `package.json`
- `docs/project/fase-16g-anexos-png-local.md`
- `docs/project/estado-atual.md`

Workflow de gestao:

- `canManagePngMapForPropriedade` reutiliza a regra da 16G.5: Admin pode
  gerir PNG local e Colaborador pode gerir apenas dentro do escopo territorial
  efetivo;
- `canManagePngMapItem` exige permissao de gestao e item identificado como
  PNG local, impedindo acao sobre asset/mock da Sela de Prata I;
- `replacePngMapForPropriedade` seleciona novo PNG pelo seletor validado,
  copia para storage interno controlado, cria novo metadado ativo preservando
  titulo/categoria/elemento/safra/ano/profundidade/escopo/talhao/visibilidade,
  marca o metadado anterior como `substituido` e tenta apagar o arquivo local
  anterior;
- `removePngMapForPropriedade` marca o metadado ativo como `removido` e tenta
  apagar o arquivo fisico apenas quando a URI pertence ao diretorio seguro de
  PNG da 16G.4;
- falhas de copia, criacao de metadado ou marcacao do metadado anterior mantem
  o PNG anterior ativo ou tentam rollback do novo arquivo/metadado;
- arquivo anterior ausente ou falha de remocao fisica vira warning controlado,
  sem apagar a Propriedade nem outros anexos.

Integracao na `MapasScreen`:

- as acoes aparecem dentro do modal de preview apenas para PNG local
  gerenciavel;
- Produtor nao ve as acoes de gestao;
- asset/mock da Sela de Prata I continua abrindo normalmente, sem botoes de
  substituicao/remocao;
- o dialogo de remocao informa que a Propriedade nao sera apagada, que outros
  mapas/anexos nao serao apagados e que PNGs demonstrativos da Sela de Prata I
  nao serao afetados;
- apos substituir ou remover, a tela recarrega os PNGs locais ativos da
  Propriedade e fecha o preview atual.

Compatibilidade preservada:

- `Mapa.list` nao foi alterado;
- `src/api/mock.ts` nao foi alterado;
- `@tche:mock-mvp:v1` nao recebe PNG local nem metadado local;
- os registros e assets PNG da Sela de Prata I nao foram alterados;
- um PNG local anexado a Sela de Prata I pode ser gerido como PNG local, mas
  os PNGs asset/mockados demonstrativos permanecem intactos e nao sao
  substituidos.

Escopo preservado:

- nao ha zoom/pinch avancado;
- nao ha edicao livre de metadados;
- nao ha download/compartilhamento;
- nao ha backend, upload remoto, RBAC real, sincronizacao, GeoJSON ou APK final;
- nao houve alteracao em `Mapa.list`, `src/api/mock.ts` ou nos assets da Sela.

Validacoes da 16G.8:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapPropertyManageWorkflow.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## 16G.9 - Revisao Tecnica E Checklist Android PNG

Status em 2026-06-09: revisao tecnica final executada e checklist de smoke
Android fisico preparado. O smoke fisico nao foi executado neste ambiente:
`adb` nao esta disponivel na sessao (`Get-Command adb` nao encontrou o
comando) e nenhum aparelho Android fisico ficou acessivel para instalacao,
abertura do app e validacao manual.

Resultado operacional da 16G.9:

- aprovado tecnicamente por revisao de codigo e validacoes automatizadas;
- pendente operacionalmente ate executar o smoke Android fisico;
- nenhum bug pequeno foi encontrado na revisao permitida;
- nenhuma alteracao funcional foi aplicada nesta microfase;
- a 16G nao deve ser considerada fechada operacionalmente enquanto o smoke
  fisico nao passar.

Arquivos revisados:

- `src/services/PngMapPropertyManageWorkflow.ts`
- `src/services/PngMapPropertyImportWorkflow.ts`
- `src/services/PngStorageService.ts`
- `src/services/PngFilePickerService.ts`
- `src/services/PngMapImportService.ts`
- `src/utils/pngMapToMapaCompat.ts`
- `src/screens/MapasScreen.tsx`
- `tests/pngMapPropertyManageWorkflow.test.js`
- `tests/pngMapToMapaCompat.test.js`
- `tests/pngMapPropertyImportWorkflow.test.js`
- `tests/pngStorageService.test.js`
- `tests/pngFilePickerService.test.js`
- `tests/pngMapImportService.test.js`

Checklist tecnico revisado:

| Item | Resultado |
|---|---|
| `canManagePngMapItem` so libera PNG local real | Aprovado por revisao e teste |
| Produtor nao ve `Substituir PNG` nem `Remover PNG local` | Aprovado por revisao e teste |
| Admin ve acoes em Propriedade permitida | Aprovado por revisao e teste |
| Colaborador so ve/usa acoes dentro do escopo efetivo | Aprovado por revisao e teste |
| PNG asset/mockado da Sela abre normalmente e nao mostra gestao | Aprovado por revisao e teste |
| PNG local anexado a Sela aparece adicionalmente | Aprovado por revisao e teste |
| Substituicao cria novo ativo e marca anterior como `substituido` | Aprovado por revisao e teste |
| Remocao marca metadado como `removido` e remove so URI segura | Aprovado por revisao e teste |
| Arquivo ausente gera warning/mensagem controlada | Aprovado por revisao e teste |
| URI fora do diretorio seguro nao abre e nao e removida | Aprovado por revisao e teste |
| URI local crua nao aparece como texto principal da UI | Aprovado por revisao e teste |

Checklist Android fisico:

| Item | Resultado em 2026-06-09 |
|---|---|
| 1. Instalar/abrir app no Android fisico | Pendente: sem aparelho/`adb` |
| 2. Login como Admin Demonstracao | Pendente: sem aparelho/`adb` |
| 3. Abrir Propriedade especifica | Pendente: sem aparelho/`adb` |
| 4. Entrar em Mapas/Arquivos tecnicos | Pendente: sem aparelho/`adb` |
| 5. Confirmar cinco PNGs demonstrativos da Sela | Pendente: sem aparelho/`adb` |
| 6. Confirmar ausencia de gestao nos PNGs asset/mockados | Pendente: sem aparelho/`adb` |
| 7. Usar `Anexar mapa PNG` | Pendente: sem aparelho/`adb` |
| 8. Selecionar `.png` valido pelo DocumentPicker | Pendente: sem aparelho/`adb` |
| 9. Preencher formulario minimo e salvar | Pendente: sem aparelho/`adb` |
| 10. Confirmar PNG local na listagem com indicador | Pendente: sem aparelho/`adb` |
| 11. Abrir PNG local no modal com `Image` | Pendente: sem aparelho/`adb` |
| 12. Fechar e reabrir o app | Pendente: sem aparelho/`adb` |
| 13. Confirmar persistencia apos reabertura | Pendente: sem aparelho/`adb` |
| 14. Usar `Substituir PNG` como Admin | Pendente: sem aparelho/`adb` |
| 15. Selecionar outro `.png` valido | Pendente: sem aparelho/`adb` |
| 16. Confirmar novo PNG, recarga e tela sem travar | Pendente: sem aparelho/`adb` |
| 17. Usar `Remover PNG local` | Pendente: sem aparelho/`adb` |
| 18. Confirmar saida da listagem ativa | Pendente: sem aparelho/`adb` |
| 19. Reabrir app e confirmar que segue removido | Pendente: sem aparelho/`adb` |
| 20. Confirmar PNGs demonstrativos da Sela intactos | Pendente: sem aparelho/`adb` |
| 21. Login como Produtor Demonstracao | Pendente: sem aparelho/`adb` |
| 22. Confirmar Produtor sem acoes de gestao | Pendente: sem aparelho/`adb` |
| 23. Confirmar visibilidade do PNG local para Produtor | Pendente: sem aparelho/`adb` |
| 24. Login como Colaborador de Campo | Pendente: sem aparelho/`adb` |
| 25. Confirmar acoes so dentro do escopo efetivo | Pendente: sem aparelho/`adb` |
| 26. Testar cancelamento do picker | Pendente: sem aparelho/`adb` |
| 27. Testar selecao de arquivo nao PNG | Pendente: sem aparelho/`adb` |
| 28. Testar arquivo removido manualmente/URI quebrada | Pendente: sem aparelho/`adb` |

Bugs e correcoes:

- Nenhum bug pequeno foi encontrado na revisao tecnica da 16G.9.
- Nenhuma correcao funcional foi aplicada.

Compatibilidade preservada:

- `Mapa.list` nao foi alterado;
- `src/api/mock.ts` nao foi alterado;
- `@tche:mock-mvp:v1` nao foi alterado;
- assets e registros mockados da Sela de Prata I nao foram alterados;
- nenhum fluxo salva base64/binario/conteudo de PNG em `AsyncStorage`;
- nenhum fluxo le bytes/string/conteudo do PNG em JS;
- `expo-image-picker` nao foi usado;
- backend, JWT, RBAC real, sincronizacao, upload remoto,
  download/compartilhamento, zoom avancado e APK final continuam fora do
  escopo.

Validacoes da 16G.9:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapPropertyManageWorkflow.test.js` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou com acesso externo aprovado apos falha de
  rede/sandbox na primeira tentativa;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Proximas Microfases Recomendadas

- Executar o smoke Android fisico da 16G.9 quando houver aparelho disponivel,
  incluindo abrir, anexar, substituir e remover PNG local, alem de confirmar
  que os PNGs asset/mockados da Sela seguem intactos.
- So considerar a 16G operacionalmente fechada depois de registrar o aparelho,
  ambiente e resultado aprovado do checklist fisico.

## Riscos Residuais

- A 16F ainda depende de smoke Android fisico; a 16G nao deve mascarar essa
  pendencia.
- `Image` com `file://` precisa ser validado no Android fisico antes de
  considerar a visualizacao local operacionalmente fechada em campo.
- o smoke Android ainda deve confirmar reabertura do app, substituicao,
  remocao, arquivo removido manualmente e continuidade dos PNGs asset/mockados
  da Sela.
- `categoria` em `Mapa` e ampla, enquanto os elementos de fertilidade ficam em
  `elemento`; misturar esses eixos pode quebrar filtros.
- `visivel_para_produtor` existe no mock, mas a regra efetiva atual de produtor
  ainda passa principalmente por acesso a Propriedade e
  `disponivel_download`.
- Sem backend/RBAC real, a administracao de anexos PNG sera local/mockada e
  deve ser comunicada como demonstrativa.
- A 16G.9 deixou o checklist preparado, mas a ausencia de aparelho Android
  fisico/`adb` nesta sessao impede aprovar o comportamento operacional em
  campo.

## Escopo Preservado Nesta Fase

Nao foi feito:

- `expo-image-picker`;
- nova dependencia;
- leitura de conteudo do PNG;
- alteracao em `Mapa.list`;
- zoom avancado;
- download/compartilhamento;
- alteracao nos registros da Sela de Prata I;
- alteracao nos PNGs da Sela;
- smoke Android fisico aprovado;
- fechamento operacional da 16G;
- backend;
- RBAC;
- sincronizacao;
- GeoJSON;
- APK.
