# Fase 16F - GeoJSON Local Por Propriedade

Este documento registra a Fase 16F.1, limitada a diagnostico da estrutura atual
de GeoJSON, limites e talhoes da propriedade Sela de Prata I. Ele prepara as
proximas microfases de importacao local de GeoJSON por Propriedade, sem
implementar seletor de arquivo, upload, persistencia nova, backend,
sincronizacao ou RBAC real.

## Escopo Da 16F.1

Objetivo:

- mapear como os limites/talhoes atuais sao carregados;
- mapear o formato bruto, o formato convertido e o formato consumido em
  runtime;
- mapear vinculo com Propriedade, permissao, renderizacao e persistencia;
- registrar riscos e microfases pequenas para 16F.2 em diante.

Fora de escopo nesta fase:

- seletor de arquivo;
- upload real;
- importacao real;
- persistencia de GeoJSON novo;
- edicao, substituicao ou exclusao de GeoJSON;
- backend, JWT, RBAC real ou sincronizacao;
- anexos PNG novos;
- alteracao visual grande;
- nova tela de cadastro de arquivo;
- instalacao de dependencias.

## Documentos Ativos Que Sustentam A Analise

- `docs/project/estado-atual.md`
- `docs/project/contexto-consolidado.md`
- `docs/project/escopo-mvp.md`
- `docs/project/regras-de-negocio.md`
- `docs/project/decisoes-consolidadas.md`
- `docs/project/pendencias-de-definicao.md`

Direcoes preservadas:

- `Propriedade` e o termo de produto para a unidade operacional.
- `Produtor` e o perfil final de consulta.
- `Titular` e o responsavel cadastral ou vinculo principal.
- `Talhao` e a subdivisao interna da Propriedade.
- `fazenda_id` permanece como chave tecnica interna temporaria para dados que
  pertencem a uma Propriedade.
- Limites/shapes sao camada tecnica de demarcacao dentro do panorama da
  Propriedade, nao uma experiencia separada para o usuario final.

## Arquivos Analisados

Fontes geoespaciais e manifesto:

- `data/processados/p_sela1/2025/limites_talhoes.geojson`
- `data/processados/p_sela1/2025/manifesto.json`
- `src/assets/geojson/selaDePrata1Talhoes.ts`
- `scripts/convertSelaDePrataShape.ps1`

Mocks, contratos e compatibilidade:

- `src/api/mock.ts`
- `src/api/mockCompat.ts`
- `src/api/mockLocalPersistence.ts`
- `src/domain/domainCompat.ts`
- `src/domain/contracts.ts`
- `entities/LimiteArea.json`
- `entities/Mapa.json`
- `src/types/mapa.ts`
- `src/utils/acessoControle.ts`
- `src/utils/fazendaUiCompat.ts`

Rotas e telas:

- `src/navigation/index.tsx`
- `src/navigation/mapaRouteCompat.ts`
- `src/screens/MapasScreen.tsx`
- `src/screens/FazendaMapaScreen.tsx`
- `src/screens/ProdutorScreen.tsx`
- `src/screens/PropriedadesScreen.tsx`

Componentes de mapa:

- `src/components/MapaFazendaView.tsx`
- `src/components/MapaFazendaNativoView.tsx`
- `src/components/ShapeRenderer.tsx`
- `src/components/TalhaoDetailModal.tsx`

Persistencia, cache e dependencias:

- `src/services/MapaCacheService.ts`
- `src/services/mapaOfflineCompat.ts`
- `src/services/MapaSincronizacaoService.ts`
- `package.json`

## Fontes GeoJSON Atuais

### GeoJSON processado bruto

Arquivo:

- `data/processados/p_sela1/2025/limites_talhoes.geojson`

Formato:

- GeoJSON `FeatureCollection`;
- 15 features;
- 37 partes/poligonos;
- geometrias `Polygon` e `MultiPolygon`;
- coordenadas em padrao GeoJSON `[lng, lat]`;
- propriedades por feature:
  - `id`
  - `fazenda_id`
  - `talhao`
  - `nome`
  - `ano`
  - `area_hectares`
  - `fonte`
  - `partes`

Resumo verificado:

- `type`: `FeatureCollection`
- `features`: 15
- `geometryTypes`: `MultiPolygon`, `Polygon`
- `polygonParts`: 37
- area somada: `1888.6 ha`
- primeiro talhao: `T01 - 230`
- primeiro `fazenda_id`: `p_sela1`

Este arquivo e a saida processada da amostra, mas nao e o arquivo importado
diretamente pelo app em runtime.

### Manifesto da amostra

Arquivo:

- `data/processados/p_sela1/2025/manifesto.json`

Formato:

- JSON de manifesto operacional;
- `schema_version: 1`;
- `tipo: importacao_geoespacial`;
- `importacao_id: p_sela1-2025-limites-talhoes-shp`;
- contexto da Propriedade por `fazenda.fazenda_id: p_sela1`;
- recorte `ano: 2025`, `safra: 2025/2026`, `camada: limites_talhoes`;
- origem declarada como SHP;
- campo de nome usado: `Campo`;
- fallback de nome: `Nome_Perim`;
- sistema de referencia declarado como WGS84;
- saida principal:
  - GeoJSON processado;
  - asset TypeScript do app;
  - 15 talhoes;
  - 37 poligonos/partes;
  - area total mapeada `1888.6 ha`;
- revisao `aprovado_para_amostra_mock`, nao aprovado para producao.

O manifesto registra rastreabilidade e revisao. Ele nao e consumido pela tela
de mapa em runtime.

### Asset TypeScript consumido pelo app

Arquivo:

- `src/assets/geojson/selaDePrata1Talhoes.ts`

Formato:

- exporta `SELA_DE_PRATA_1_SHAPE_FAZENDA_ID = 'p_sela1'`;
- exporta `talhoesSelaDePrata1Shape`;
- export default com o mesmo array;
- array de objetos compativeis com `MapaTalhao`;
- coordenadas convertidas para objetos `{ lat, lng }`;
- suporte a partes multiplas por `poligonos`;
- preserva `poligono` simples como fallback/principal.

Resumo verificado:

- 15 registros;
- 37 partes em `poligonos`;
- area somada `1888.6 ha`;
- campos do primeiro registro:
  - `id`
  - `fazenda_id`
  - `produtor_id`
  - `nome`
  - `ano`
  - `talhao`
  - `area_hectares`
  - `poligono`
  - `poligonos`
  - `cor`
  - `data_upload`
  - `safra`
  - `disponivel_offline`
  - `observacoes`

Este e o formato efetivamente consumido pelo mock/runtime, via `src/api/mock.ts`.

## Entidade De Limite E Talhao

A entidade atual relevante e `LimiteArea`.

Contrato documental:

- `entities/LimiteArea.json`

Campos principais:

- `id`
- `nome`
- `ano`
- `produtor_id`
- `fazenda_id`
- `talhao`
- `area_hectares`
- `perimetro_km`
- `textura`
- `tipo_solo`
- `elementos`
- `cultura_atual`
- `poligono`
- `cor`
- `data_upload`
- `safra`
- `disponivel_offline`
- `observacoes`

Obrigatorios no schema:

- `nome`
- `ano`
- `talhao`
- `poligono`
- `fazenda_id` ou `produtor_id`

Normalizacao efetiva:

- `src/domain/domainCompat.ts` usa `normalizeLimiteArea`;
- `fazenda_id` e resolvido por leitura dupla `fazenda_id` ou `produtor_id`;
- `toLimiteAreaCompativelBorda` reemite `produtor_id` como alias legado de
  `fazenda_id`;
- `src/api/mockCompat.ts` usa essa normalizacao em leitura, filtro e
  persistencia runtime.

Campos de vinculo:

- `fazenda_id`: chave tecnica canonica atual para o contexto de Propriedade;
- `produtor_id`: alias legado preservado;
- `propriedade_id`: nao aparece nos registros de `LimiteArea` atuais da Sela
  de Prata I;
- `fazendaId`: aparece em params de rota, nao no registro de `LimiteArea`.

Nome do talhao:

- no GeoJSON processado: `properties.talhao` e `properties.nome`;
- no asset TypeScript: `talhao` e `nome`;
- no mock: `talhao` e `nome`;
- em telas e filtros: fallback `talhao || nome`.

Area, codigo, safra e versao:

- area vem de `area_hectares`;
- codigo/nome operacional esta em `talhao`, por exemplo `T01 - 230`;
- ano vem de `ano`;
- safra vem de `safra` no asset/mock;
- nao ha campo formal de status ou versao por limite;
- `data_upload` funciona como data de importacao/amostra;
- `disponivel_offline` aparece como indicador, mas nao significa cache real de
  arquivo importado.

## Como A Sela De Prata I Entra No Mock

Em `src/api/mock.ts`:

- importa `talhoesSelaDePrata1Shape`;
- importa `SELA_DE_PRATA_1_SHAPE_FAZENDA_ID`;
- define `SELA_DEPRATA_1_PRODUTOR_ID = SELA_DE_PRATA_1_SHAPE_FAZENDA_ID`;
- a Propriedade principal tem `id: p_sela1`;
- a Propriedade tambem recebe aliases:
  - `propriedade_id: p_sela1`
  - `propriedadeId: p_sela1`
  - `titular_id: prop_sela1`
  - `titularId: prop_sela1`
- os limites sao adicionados ao array `limitesArea` por spread:
  - `...talhoesSelaDePrata1Shape.map(...)`;
- cada talhao recebe `produtor_id: p_sela1` e `fazenda_id: p_sela1`;
- o mock preserva `poligono` e `poligonos`;
- `LimiteArea.list()` retorna esses limites via `listMockLimitesArea`.

Como o app sabe que a Sela de Prata I tem limites:

- nao existe registro separado de "Propriedade com GeoJSON";
- a existencia e inferida por haver registros `LimiteArea` com
  `fazenda_id: p_sela1`;
- telas filtram limites por ids de Propriedade acessiveis.

Limites para outras propriedades:

- existem registros mockados manuais para outras propriedades, principalmente
  com `produtor_id` legado e `poligono` simples;
- a Sela de Prata I e a unica fonte atual derivada de shapefile real
  convertido para GeoJSON/asset.

## Fluxo De Exibicao No Mapa

### Entrada por telas

Rotas principais:

- `src/navigation/index.tsx` registra `Mapas` e `FazendaMapa` como telas de
  stack comuns para usuario logado.

Fluxos por perfil:

- Admin:
  - entra em `Propriedades`;
  - abre detalhe da Propriedade;
  - acessa mapas/talhoes pelo contexto da Propriedade.
- Colaborador:
  - entra em `PropriedadesColaborador`;
  - lista apenas Propriedades do escopo efetivo;
  - abre detalhe e mapas/talhoes se a Propriedade estiver no escopo.
- Produtor:
  - entra por `Minhas Fazendas`/`Minhas Propriedades`;
  - abre detalhe da propria Propriedade;
  - acessa mapas/talhoes e anexos autorizados.

### `ProdutorScreen.tsx`

No detalhe da Propriedade:

- carrega `LimiteArea.list()`;
- filtra dados por `fazendaAtualId`;
- mostra contagem de `Limites de Area`;
- monta params para `Mapas` com `buildMapasRouteParams`;
- monta params para `FazendaMapa` com
  `buildFazendaMapaRouteParamsFromPropriedade`;
- ao abrir mapa de um material, tenta selecionar talhao compativel com
  `buildMapaTalhaoRouteSelection`.

### `MapasScreen.tsx`

Papel:

- experiencia de panorama e biblioteca de materiais tecnicos;
- carrega `Mapa.list()` e `LimiteArea.list()`;
- filtra por acesso e contexto de Propriedade;
- exibe estatisticas de talhoes, area e materiais;
- renderiza uma pre-visualizacao vetorial com `ShapeRenderer`;
- abre a tela cheia de mapa via rota `FazendaMapa`;
- abre detalhes do talhao em `TalhaoDetailModal`.

Empty state:

- se a Propriedade/contexto nao tem limites, exibe mensagem de ausencia de
  demarcacao;
- a mensagem preserva a possibilidade de haver anexos/materiais mesmo sem mapa
  de talhoes;
- se a visao geral nao tem limites no escopo, informa que demarcacoes
  liberadas aparecerao quando existirem.

### `ShapeRenderer.tsx`

Papel:

- renderizacao SVG local na propria `MapasScreen`;
- nao usa Leaflet;
- nao usa WebView;
- recebe array de talhoes ja normalizados;
- usa `poligonos` quando existem, senao usa `poligono`;
- calcula bounds de todos os pontos `{ lat, lng }`;
- converte para coordenadas SVG;
- inverte eixo Y para desenhar a geometria corretamente;
- permite toque no talhao e na legenda;
- dispara `onTalhaoPress(talhao)`;
- mostra label curto e area.

### `FazendaMapaScreen.tsx`

Papel:

- tela cheia de mapa dos talhoes;
- carrega Propriedades por `Produtor.list()`;
- filtra Propriedades por acesso do usuario;
- se recebeu `fazendaId`, reavalia acesso com `avaliarAcessoFazendaPorId`;
- bloqueia rota direta quando a Propriedade nao existe ou esta fora do escopo;
- carrega `LimiteArea.list()`;
- filtra limites por ids permitidos via `filtrarLimitesPorFazendaIds`;
- seleciona ano mais recente por padrao;
- permite filtro por ano;
- passa `talhoesExibidos` para `MapaFazendaView`;
- abre drawer de detalhe ao tocar em talhao.

Estados:

- carregando;
- erro de carga;
- acesso negado;
- Propriedade nao encontrada;
- lista vazia de talhoes quando nao houver limite para o ano/periodo.

### `MapaFazendaView.tsx`

Papel:

- componente ativo da tela cheia;
- usa `react-native-webview` com Leaflet e tiles OpenStreetMap;
- gera HTML local com `gerarHTMLLeaflet`;
- reconverte os talhoes `{ lat, lng }` para GeoJSON in-memory;
- para um poligono usa `Polygon`;
- para varias partes usa `MultiPolygon`;
- monta um `FeatureCollection` dentro do HTML;
- chama `L.geoJSON`;
- aplica estilo por `properties.cor`;
- cria labels com nome do talhao e area;
- chama `fitBounds` para enquadramento/zoom;
- em clique no poligono, envia `talhaoPress` para React Native;
- expoe ref para `selecionarTalhao` e `ajustarLimites`.

Fallback:

- se Leaflet nao ficar pronto em aproximadamente `6500 ms`, ativa fallback SVG;
- se WebView gerar erro ou HTTP error, ativa fallback SVG;
- `FallbackShapeMap` usa os mesmos talhoes `{ lat, lng }` e suporta toque.

Dependencia externa em runtime:

- a tela inclui CSS/JS do Leaflet por `https://unpkg.com/leaflet@1.9.4`;
- os tiles vem de `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
- se esses recursos falharem, o fallback vetorial local ainda consegue mostrar
  os shapes sem mapa-base.

### `MapaFazendaNativoView.tsx`

Papel atual:

- componente experimental/historico com `react-native-maps`;
- nao e usado pela `FazendaMapaScreen` atual;
- usa apenas `poligono`, nao trata `poligonos` multiplos como o componente
  ativo;
- deve ser tratado como apoio historico, nao como fluxo principal da 16F.1.

## Normalizacao Esperada Pelo App

O app atual nao espera receber `FeatureCollection` puro diretamente nas telas.

Formato esperado em runtime:

- array de talhoes normalizados;
- cada item com:
  - `id`
  - `fazenda_id`
  - `produtor_id` como alias legado
  - `talhao`
  - `nome`
  - `ano`
  - `area_hectares`
  - `poligono: { lat, lng }[]`
  - `poligonos?: { lat, lng }[][]`
  - `cor`
  - `data_upload`
  - `safra`
  - `disponivel_offline`
  - `observacoes`

Coordenadas:

- GeoJSON processado guarda coordenadas `[lng, lat]`;
- asset TypeScript converte para `{ lat, lng }`;
- `ShapeRenderer` e fallback SVG trabalham com `{ lat, lng }`;
- `MapaFazendaView` reconverte para `[lng, lat]` somente para montar o
  `FeatureCollection` do Leaflet no HTML.

`Polygon` e `MultiPolygon`:

- o GeoJSON processado contem os dois tipos;
- o asset normalizado representa partes multiplas em `poligonos`;
- `MapaFazendaView` transforma `poligonos.length > 1` em `MultiPolygon`;
- `ShapeRenderer` tambem renderiza multiplas partes;
- `MapaFazendaNativoView` nao cobre plenamente `poligonos`.

Validacao e calculos:

- `validateLimiteArea` valida o contrato mockado;
- nao ha helper puro especifico para validar GeoJSON importado pelo usuario;
- nao ha validacao robusta de geometria GeoJSON;
- nao ha validacao explicita de CRS em importacao local;
- nao ha calculo de area no app a partir da geometria;
- area vem pronta em `area_hectares`;
- nao ha simplificacao ou reducao de precisao no runtime; a simplificacao, se
  houver, pertence ao processamento/conversor antes do app.

Dependencia de `properties` no GeoJSON bruto:

- para a amostra atual, os campos relevantes sao `id`, `fazenda_id`, `talhao`,
  `nome`, `ano` e `area_hectares`;
- o manifesto registra que, para SHP, o campo de nome usado foi `Campo`;
- para GeoJSON futuro, a proxima fase deve aceitar fallback controlado entre
  `talhao`, `nome`, `name`, `codigo` e `id`, mas isso ainda nao existe como
  helper implementado.

## Vinculo Com A Propriedade Sela De Prata I

Identificador principal:

- `p_sela1`

Campos usados hoje:

- Propriedade em `src/api/mock.ts`:
  - `id: p_sela1`
  - `propriedade_id: p_sela1`
  - `propriedadeId: p_sela1`
  - `fazenda: Fazenda Sela de Prata I`
  - `propriedade_nome: Fazenda Sela de Prata I`
  - `propriedadeNome: Fazenda Sela de Prata I`
- limites:
  - `fazenda_id: p_sela1`
  - `produtor_id: p_sela1`
- anexos PNG de fertilidade:
  - `fazenda_id: p_sela1`
  - `produtor_id: p_sela1`
  - `propriedade_id: p_sela1`

Campos futuros e legados:

- `propriedade_id` ja aparece em Propriedade e anexos de fertilidade;
- `propriedade_id` ainda nao substitui `fazenda_id` em `LimiteArea`;
- `fazendaId` e `produtorId` aparecem nos params de rota;
- `buildFazendaMapaRouteParams` emite `fazendaId` e `produtorId` com o mesmo
  valor por compatibilidade.

Ausencia de limites:

- nao existe flag por Propriedade;
- se nenhum `LimiteArea` filtra para o `fazenda_id` atual, as telas mostram
  empty state;
- `MapasScreen` diferencia ausencia de demarcacao/talhoes de ausencia de
  materiais tecnicos;
- `FazendaMapaScreen` mostra lista vazia quando nao ha talhoes no periodo.

## Permissoes Atuais

A 16F.1 apenas diagnostica permissao; nao altera RBAC.

Motor atual:

- `src/utils/acessoControle.ts`
- Admin ve todas as Propriedades;
- Produtor ve Propriedades por vinculo de titular/produtor compativel;
- Colaborador ve Propriedades por escopo regional/sub-regional;
- `propriedades_atribuidas` continua visual/preparatorio e nao e regra
  efetiva do MVP mockado.

Mapas e limites:

- `MapasScreen` filtra Propriedades por acesso e entao filtra mapas/limites por
  ids permitidos;
- para Produtor, mapas podem ser filtrados por `somenteDisponiveisDownload`;
- limites nao possuem filtro de download/publicacao por perfil; eles seguem o
  acesso a Propriedade;
- `FazendaMapaScreen` reavalia acesso quando recebe `fazendaId`, evitando que
  rota direta mostre limites fora do escopo.

Acoes atuais:

- Admin, Colaborador e Produtor podem abrir mapa de talhoes quando possuem
  acesso a Propriedade;
- nao existe acao real de importar GeoJSON;
- nao existe permissao visual especifica de importar/remover limites;
- existe biblioteca visual de materiais/anexos, mas sem upload real.

## Persistencia Atual

Snapshot mock local:

- `src/api/mockLocalPersistence.ts` persiste:
  - `users`
  - `produtores`
  - `usuarioPropriedade`
  - `usuarioMicroregiao`
  - `visitas`
  - `cadernos`
  - `mapas`
- chave: `@tche:mock-mvp:v1`;
- limites/talhoes nao entram no snapshot;
- arquivos e assets tambem nao entram no snapshot.

Limites atuais:

- os limites seed ficam em memoria no array `limitesArea` de `src/api/mock.ts`;
- a Sela de Prata I entra no seed a partir do asset TypeScript;
- `LimiteArea.create/update/delete` usa `mutateHydratedRuntime`, mas o estado
  de limites nao faz parte do snapshot persistente;
- portanto, limites criados/alterados em runtime nao sao a estrategia atual de
  persistencia duravel do MVP.

Cache/offline:

- `src/services/MapaCacheService.ts` existe como servico separado;
- grava talhoes em AsyncStorage com prefixos `@mapas_talhao_`;
- grava backup JSON por talhao em `FileSystem.documentDirectory/mapas_cache/`;
- tambem grava metadados de tiles;
- nao esta integrado ao fluxo atual de importacao de GeoJSON por Propriedade;
- nao e a fonte de runtime da Sela de Prata I no app atual.

Dependencia faltante:

- `MapaCacheService.ts` importa `expo-file-system`;
- `package.json` nao lista `expo-file-system`;
- `package.json` tambem nao lista `expo-document-picker` nem `expo-sharing`.

Risco de AsyncStorage:

- metadados pequenos podem ficar em AsyncStorage;
- GeoJSON grande ou lista completa de coordenadas nao deve ser gravada
  diretamente no snapshot `@tche:mock-mvp:v1`;
- para importacao futura, a direcao mais segura e guardar arquivo fisico em
  storage interno do app e persistir apenas metadados/indice no snapshot ou em
  banco futuro.

## Dependencias Para Importacao Futura

Sem instalar nada nesta fase, as dependencias provaveis sao:

- `expo-document-picker`
  - selecionar arquivo `.geojson`/`.json` no Android;
  - ler nome, tamanho, MIME e URI temporario.
- `expo-file-system`
  - copiar o arquivo escolhido para diretorio interno do app;
  - ler conteudo para validacao;
  - manter URI estavel no sandbox do app;
  - remover/substituir arquivo com seguranca.
- `expo-sharing`
  - opcional, apenas se houver necessidade futura de compartilhar/exportar
    arquivo ou diagnostico.

Compatibilidade Expo SDK 48:

- as dependencias devem ser instaladas com `npx expo install` na versao
  compativel;
- o uso em Android fisico deve validar acesso ao URI apos selecao;
- o app nao deve depender de permissao ampla de armazenamento externo quando o
  Document Picker e a copia interna resolverem o fluxo.

## Riscos Identificados Para 16F.2+

- GeoJSON grande demais para AsyncStorage ou snapshot mock;
- arquivo com `MultiPolygon` sem suporte correto na normalizacao;
- coordenadas invertidas `[lat, lng]` em arquivo que deveria usar `[lng, lat]`;
- geometria invalida, anel aberto ou poligono com menos de 3 pontos;
- arquivo sem `properties.talhao`, `properties.nome` ou equivalente;
- nomes duplicados de talhao dentro da mesma Propriedade;
- GeoJSON sem CRS explicito;
- arquivo fora de WGS84;
- area ausente ou divergente da area calculada;
- propriedade sem limites gerando confusao entre "sem demarcacao" e "sem
  materiais";
- Leaflet/WebView com performance ruim para muitos pontos;
- fallback SVG pesado se o arquivo tiver muitas coordenadas;
- `MapaFazendaNativoView` nao tratando `poligonos` multiplos;
- duplicidade de limites por Propriedade sem regra de versao/substituicao;
- substituicao acidental dos limites da Sela de Prata I;
- falta de `expo-file-system` no `package.json`;
- Android perder acesso ao URI temporario depois da selecao;
- ausencia de status/publicacao/revisao para limites importados;
- permissao visual futura de importacao ser confundida com RBAC real;
- falta de backend para sincronizar GeoJSON entre aparelhos;
- nome/localizacao/limites reais exigirem confirmacao de autorizacao antes de
  demonstracao externa.

## Arquitetura Minima Recomendada Para 16F.2+

### 16F.2 - Contrato local para GeoJSON importado

Definir contrato documental e tipos para metadados, sem UI:

- `id`
- `propriedade_id` futuro e `fazenda_id` compativel;
- `nome_arquivo_original`;
- `uri_local`;
- `tamanho_bytes`;
- `hash`;
- `features_count`;
- `talhoes_count`;
- `geometry_types`;
- `status_revisao`;
- `criado_em`;
- `criado_por`;
- `substitui_limite_id` ou grupo/versionamento, se aplicavel.

Guardar somente metadados no snapshot/banco local. Guardar o arquivo em
storage interno.

Status em 2026-06-05: a base tecnica da 16F.2 foi implementada sem seletor,
sem leitura de arquivo, sem copia para filesystem, sem validacao completa de
GeoJSON e sem integracao visual.

Arquivos criados:

- `src/types/geojsonImport.ts`
- `src/services/GeoJsonImportService.ts`
- `tests/geojsonImportService.test.js`

Arquivos alterados:

- `package.json`
- `tsconfig.domain-compat.json`
- `docs/project/fase-16f-geojson-local.md`
- `docs/project/estado-atual.md`

Contrato criado:

- `GeoJsonImportStatus`
- `GeoJsonImportOrigin`
- `GeoJsonImportMetadata`
- `GeoJsonImportMetadataInput`
- `GeoJsonImportMetadataPatch`

Status previstos:

- `rascunho`
- `validado`
- `ativo`
- `substituido`
- `removido`
- `erro`

Campos centrais do metadado:

- `id`
- `propriedade_id`
- `fazenda_id`
- `nome_propriedade`
- `arquivo_nome_original`
- `arquivo_uri_local`
- `arquivo_tamanho_bytes`
- `arquivo_mime`
- `importado_por_usuario_id`
- `importado_por_nome`
- `importado_em`
- `atualizado_em`
- `status`
- `talhoes_count`
- `polygon_parts_count`
- `geometry_types`
- `area_total_hectares`
- `safra`
- `ano`
- `observacoes`
- `erro_validacao`
- `origem`
- `versao`

Chave local criada:

- `@tche:geojson-imports:v1`

Regras da chave:

- nao usa `@tche:mock-mvp:v1`;
- nao usa `@tche:user`;
- nao usa `@tche:local-credentials:v1`;
- salva apenas metadados pequenos;
- nao salva `FeatureCollection`, `features`, `coordinates`, `poligono` ou
  `poligonos`.

Servico criado:

- `createGeoJsonImportService`
- singleton `GeoJsonImportService`
- constante `GEOJSON_IMPORT_STORAGE_KEY`

Operacoes disponiveis:

- `listGeoJsonImports`
- `listGeoJsonImportsByPropriedade`
- `getActiveGeoJsonImportForPropriedade`
- `getGeoJsonImportById`
- `createGeoJsonImportMetadata`
- `updateGeoJsonImportMetadata`
- `markGeoJsonImportAsActive`
- `markGeoJsonImportAsSubstituido`
- `markGeoJsonImportAsRemoved`
- `deleteGeoJsonImportMetadata`
- `__setStorageForTests`

Compatibilidade de identificadores:

- se vier apenas `propriedade_id`, o servico preenche `fazenda_id` com o
  mesmo valor;
- se vier apenas `fazenda_id`, o servico preenche `propriedade_id` com o
  mesmo valor;
- se vierem os dois, os dois sao preservados e a listagem por Propriedade
  tambem aceita a busca pelo `fazenda_id` legado.

Regra de ativo por Propriedade:

- somente um metadado pode ficar `ativo` por Propriedade;
- ao marcar um metadado como `ativo`, outro metadado `ativo` da mesma
  Propriedade vira `substituido`;
- metadado `removido` nao e retornado como ativo;
- `deleteGeoJsonImportMetadata` remove apenas o metadado, pois ainda nao ha
  arquivo fisico para remover nesta fase.

Comportamento de armazenamento:

- storage ausente retorna lista vazia;
- JSON corrompido retorna lista vazia com fallback seguro;
- ao salvar novamente depois de storage corrompido, o snapshot novo substitui
  o conteudo invalido;
- `id` e `importado_em` permanecem estaveis em update;
- `atualizado_em` muda em update e mudanca de status;
- IDs sao gerados apenas na criacao quando nao vierem no input.

Limites preservados:

- nenhuma chamada foi adicionada em `MapasScreen`;
- nenhuma chamada foi adicionada em `FazendaMapaScreen`;
- nenhuma chamada foi adicionada em `ProdutorScreen`;
- nenhuma chamada foi adicionada em `NovaPropriedadeScreen` ou
  `EditarPropriedadeScreen`;
- `LimiteArea.list` nao foi alterado;
- `src/api/mock.ts` nao foi alterado para limites da Sela de Prata I;
- `src/assets/geojson/selaDePrata1Talhoes.ts` nao foi alterado;
- `data/processados/p_sela1/2025/limites_talhoes.geojson` nao foi alterado;
- nenhuma dependencia foi instalada.

Relacao com `LimiteArea`:

- a 16F.2 registra apenas o indice de metadados;
- a transformacao futura de GeoJSON validado para o formato runtime de
  `LimiteArea` fica para fase posterior;
- a Sela de Prata I continua vindo do seed/assets.

Testes criados:

- `tests/geojsonImportService.test.js`

Cobertura principal:

- lista vazia sem storage;
- criacao de metadado;
- fallback `propriedade_id`/`fazenda_id`;
- busca por id;
- listagem por Propriedade;
- um ativo por Propriedade;
- ativo anterior vira `substituido`;
- `removido` nao volta como ativo;
- update preserva `id` e `importado_em`;
- delete remove metadado;
- JSON corrompido nao derruba;
- indice nao salva `FeatureCollection`, `features`, `coordinates`,
  `poligono` ou `poligonos`;
- nao usa `@tche:mock-mvp:v1`;
- Propriedade A nao vaza para Propriedade B.

Validacoes executadas na 16F.2:

- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonImportService.test.js` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

Proximos passos:

- 16F.3: criar validador puro de GeoJSON;
- 16F.4: adicionar seletor de arquivo com `expo-document-picker`, ainda sem
  publicar limites no mapa.

### 16F.3 - Validador puro de GeoJSON

Status em 2026-06-05: foi criado o helper puro de validacao e normalizacao de
GeoJSON bruto para o formato runtime de talhoes usado pelo app.

Arquivos criados:

- `src/utils/geojsonImportValidator.ts`
- `tests/geojsonImportValidator.test.js`

Arquivos alterados:

- `package.json`
- `tsconfig.domain-compat.json`
- `docs/project/fase-16f-geojson-local.md`
- `docs/project/estado-atual.md`

Helper criado:

- `validateAndNormalizeGeoJson(input, options)`

Entrada aceita:

- objeto JSON ja parseado;
- string JSON, quando valida.

Saida:

- `ok`;
- `errors`;
- `warnings`;
- `talhoes`;
- `summary`.

Tipos principais:

- `GeoJsonValidationIssue`;
- `GeoJsonNormalizeOptions`;
- `GeoJsonValidationSummary`;
- `GeoJsonNormalizedTalhao`;
- `GeoJsonValidationResult`.

Regras de validacao:

- aceita apenas `FeatureCollection`;
- `features` deve ser array e nao pode estar vazio;
- cada item deve ser `Feature` quando o campo `type` vier preenchido;
- aceita geometrias `Polygon` e `MultiPolygon`;
- rejeita `Point`, `LineString`, `MultiPoint`, `MultiLineString`,
  `GeometryCollection`, `geometry: null`, geometria sem `coordinates` e
  geometria vazia;
- cada coordenada deve ser array com pelo menos dois numeros finitos;
- strings numericas, `NaN`, `Infinity` e valores nao numericos sao rejeitados;
- longitude deve ficar entre `-180` e `180`;
- latitude deve ficar entre `-90` e `90`;
- anel externo com menos de quatro pontos e rejeitado.

Tratamento de coordenadas:

- GeoJSON entra como `[lng, lat]`;
- runtime sai como `{ lat, lng }`;
- terceiro valor da coordenada, quando existir, e ignorado;
- coordenada fora de faixa gera erro;
- provavel inversao evidente `[lat, lng]` gera warning
  `PROBABLE_LAT_LNG_INVERSION` e erro de latitude fora de faixa;
- a fase nao inverte coordenadas automaticamente quando ambos os valores sao
  plausiveis.

Tratamento de aneis:

- se o anel externo ja estiver fechado, ele e preservado;
- se tiver quatro ou mais pontos e estiver aberto, o helper fecha o anel em
  memoria e emite warning `RING_NOT_CLOSED`;
- se o anel externo tiver menos de quatro pontos, o helper rejeita a feature;
- aneis internos/holes sao ignorados nesta fase e geram warning
  `INTERIOR_RING_IGNORED`.

Normalizacao:

- `Polygon` vira um talhao com `poligono` igual ao anel externo e `poligonos`
  com uma parte;
- `MultiPolygon` vira um talhao com `poligonos` contendo cada parte externa e
  `poligono` apontando para a primeira parte;
- `fazenda_id` recebe `options.fazenda_id || options.propriedade_id`;
- `produtor_id` preserva o alias legado com
  `options.produtor_id || fazenda_id`;
- `talhao` e `nome` recebem o mesmo nome resolvido;
- `area_hectares` usa `properties.area_hectares`, `properties.area_ha` ou
  `properties.area` quando forem numeros positivos; se ausente, usa `0`
  porque `MapaTalhao.area_hectares` e numerico no contrato atual;
- `ano` usa `options.ano` ou `properties.ano`, sem data dinamica;
- `safra` usa `options.safra` ou `properties.safra`;
- `cor` usa `options.corPadrao` ou cor padrao local;
- `data_upload` so e preenchido quando vier em `options.data_upload`;
- `disponivel_offline` fica `true` por compatibilidade com o runtime atual;
- `id` e estavel, derivado de Propriedade, indice da feature e nome do
  talhao, sem `Date.now`.

Resolucao de nome do talhao:

1. `properties.talhao`
2. `properties.nome`
3. `properties.name`
4. `properties.codigo`
5. `properties.id`
6. `feature.id`
7. fallback `Talhao N`

Duplicidade:

- nomes duplicados geram warning `DUPLICATE_TALHAO_NAME`;
- duplicidade nao rejeita a normalizacao nesta fase.

Resumo produzido:

- `features_count`;
- `talhoes_count`;
- `polygon_parts_count`;
- `geometry_types`;
- `warnings_count`;
- `errors_count`.

Limites preservados:

- sem persistencia;
- sem chamada ao `GeoJsonImportService`;
- sem `AsyncStorage`;
- sem `expo-file-system`;
- sem `expo-document-picker`;
- sem `FileSystem`;
- sem `DocumentPicker`;
- sem leitura de arquivo do aparelho;
- sem alteracao de `LimiteArea.list`;
- sem alteracao em `MapasScreen`;
- sem alteracao em `FazendaMapaScreen`;
- sem alteracao em `MapaFazendaView`;
- sem alteracao em `ShapeRenderer`;
- sem alteracao da Sela de Prata I.

Testes criados:

- `tests/geojsonImportValidator.test.js`

Cobertura principal:

- `FeatureCollection` com `Polygon`;
- `FeatureCollection` com `MultiPolygon`;
- multiplas features;
- resolucao de nome por `talhao`, `nome`, `name`, `codigo`, `id`,
  `feature.id` e fallback;
- area por `area_hectares`, `area_ha` e `area`;
- conversao `[lng, lat]` para `{ lat, lng }`;
- preenchimento de `poligono` e `poligonos`;
- resumo de features, talhoes, partes e tipos de geometria;
- JSON string valido e JSON string invalido;
- objeto sem `type`, `type` diferente, `features` ausente e `features` vazio;
- geometrias incompativeis;
- `geometry: null`;
- `coordinates` vazias;
- coordenada nao numerica;
- coordenada fora de faixa;
- anel com pontos insuficientes;
- anel aberto fechado com warning;
- nomes duplicados;
- interior ring ignorado;
- provavel inversao lat/lng evidente;
- fallback de `fazenda_id` e `produtor_id`;
- IDs estaveis;
- amostra leve dos campos usados pela Sela de Prata I;
- ausencia de imports para storage, picker, filesystem, telas ou mocks;
- saida sem `FeatureCollection`, `features` ou `coordinates` brutas.

Validacoes executadas na 16F.3:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonImportService.test.js` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

### 16F.4 - Seletor de arquivo

Status em 2026-06-05: foi criada a infraestrutura isolada para selecionar,
ler e validar um arquivo GeoJSON local em memoria, ainda sem tela e sem
persistencia.

Dependencias instaladas com Expo SDK 48:

- `expo-document-picker@~11.2.2`;
- `expo-file-system@~15.2.2`.

Nao foi instalado:

- `expo-sharing`.

Arquivo criado:

- `src/services/GeoJsonFilePickerService.ts`

Arquivo de teste criado:

- `tests/geojsonFilePickerService.test.js`

Arquivos alterados:

- `package.json`;
- `package-lock.json`;
- `tsconfig.domain-compat.json`;
- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Servico criado:

- `GeoJsonFilePickerService`;
- `createGeoJsonFilePickerService`;
- funcoes puras/isoladas para validar nome, MIME, tamanho, resultado do picker,
  leitura e validacao.

Funcoes principais:

- `isSupportedGeoJsonFileName`;
- `isSupportedGeoJsonMimeType`;
- `normalizePickedDocumentResult`;
- `validatePickedGeoJsonFile`;
- `pickGeoJsonDocument`;
- `readGeoJsonFileAsString`;
- `readAndValidatePickedGeoJson`;
- `pickReadAndValidateGeoJson`.

Compatibilidade com DocumentPicker:

- formato antigo de sucesso:
  `{ type: 'success', uri, name, size, mimeType }`;
- formato antigo de cancelamento:
  `{ type: 'cancel' }`;
- formato novo de sucesso:
  `{ canceled: false, assets: [{ uri, name, size, mimeType }] }`;
- formato novo de cancelamento:
  `{ canceled: true }`.

O normalizador transforma os formatos aceitos em:

- `PickedGeoJsonFile`
  - `uri`;
  - `name`;
  - `size`;
  - `mimeType`.

Regras de arquivo:

- aceita `.geojson`;
- aceita `.json`;
- aceita MIME `application/geo+json`;
- aceita MIME `application/json`;
- aceita MIME `text/json`;
- aceita MIME `text/plain` apenas quando a extensao e `.geojson` ou `.json`;
- aceita MIME ausente quando a extensao e valida;
- rejeita `.zip`, `.kml`, `.kmz`, `.shp`, `.png`, `.jpg`, `.pdf` e nome sem
  extensao reconhecida.

Limite de tamanho:

- `MAX_GEOJSON_FILE_SIZE_BYTES = 10 * 1024 * 1024`;
- quando `size` vem acima do limite, rejeita antes de ler;
- quando `size` esta ausente, permite a leitura nesta fase e registra warning
  `FILE_SIZE_UNKNOWN`.

Leitura:

- usa `expo-file-system` sob demanda para
  `readAsStringAsync(uri, { encoding: UTF8 })`;
- nao loga conteudo;
- nao salva conteudo;
- nao chama `AsyncStorage`;
- nao copia definitivamente para storage interno;
- nao cria cache;
- o `DocumentPicker` usa `copyToCacheDirectory: true` apenas para permitir a
  leitura imediata do URI selecionado no Expo/Android, sem tratar isso como
  persistencia da importacao.

Integracao com validador:

- apos a leitura textual, chama `validateAndNormalizeGeoJson(text, options)`;
- retorna o arquivo selecionado, o resultado do validador e mensagens
  estruturadas;
- se o validador retornar `ok: false`, a fase apenas devolve erro controlado
  `INVALID_GEOJSON` ou `VALIDATION_FAILED`;
- nao salva o resultado em `GeoJsonImportService`.

Erros controlados:

- `PICKER_CANCELLED`;
- `PICKER_RESULT_INVALID`;
- `UNSUPPORTED_FILE_TYPE`;
- `FILE_TOO_LARGE`;
- `FILE_READ_FAILED`;
- `INVALID_GEOJSON`;
- `VALIDATION_FAILED`.

Limites preservados:

- nenhuma tela foi alterada;
- nenhuma acao visual foi criada;
- nenhuma chamada foi adicionada em `MapasScreen`;
- nenhuma chamada foi adicionada em `FazendaMapaScreen`;
- `LimiteArea.list` nao foi alterado;
- `GeoJsonImportService` nao e chamado;
- `@tche:mock-mvp:v1` nao e usado;
- `@tche:geojson-imports:v1` nao e usado nesta fase;
- a Sela de Prata I permanece no seed/assets.

Permissoes:

- Admin e Colaborador permanecem como perfis futuros esperados para acao de
  importacao;
- Produtor permanece como perfil de consulta/visualizacao;
- nesta fase nao ha integracao visual nem regra de permissao nova;
- RBAC real segue fora do escopo.

Testes criados:

- `tests/geojsonFilePickerService.test.js`

Cobertura principal:

- cancelamento antigo e novo do DocumentPicker;
- sucesso antigo e novo do DocumentPicker;
- resultado sem asset, sem `uri` e sem `name`;
- configuracao do picker com `copyToCacheDirectory: true`;
- extensao `.geojson` e `.json`;
- MIME aceitos e ausentes;
- rejeicao de extensoes incompativeis;
- rejeicao de MIME incompativel;
- limite de tamanho;
- leitura textual via `FileSystem` mockado;
- erro de leitura controlado;
- validacao com helper real;
- repasse de `propriedade_id`, `fazenda_id`, `produtor_id`, `ano` e `safra`
  ao validador;
- ausencia de imports para persistencia, telas, mocks e storage local.

Validacoes executadas na 16F.4:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` passou com acesso a rede liberado; em ambiente
  restrito, o mesmo comando nao conseguiu acessar os servidores Expo e caiu no
  mapa de dependencias em cache;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

### 16F.5 - Copia para storage interno

Status em 2026-06-05: foi criado o servico isolado para copiar GeoJSON
validado para storage interno do app, gerando URI local estavel para uso
posterior nos metadados da 16F.6.

Arquivo criado:

- `src/services/GeoJsonStorageService.ts`

Arquivo de teste criado:

- `tests/geojsonStorageService.test.js`

Arquivos alterados:

- `package.json`;
- `tsconfig.domain-compat.json`;
- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Servico criado:

- `GeoJsonStorageService`;
- `createGeoJsonStorageService`;
- funcoes puras/isoladas para sanitizar path e nome de arquivo;
- funcoes de copia, leitura, validacao posterior, consulta de info e remocao
  segura.

Funcoes principais:

- `sanitizeGeoJsonPathSegment`;
- `sanitizeGeoJsonFileName`;
- `buildGeoJsonStorageDirectoryUri`;
- `buildGeoJsonStorageUri`;
- `ensureGeoJsonStorageDirectory`;
- `copyGeoJsonToInternalStorage`;
- `readStoredGeoJson`;
- `validateStoredGeoJson`;
- `deleteStoredGeoJson`;
- `getStoredGeoJsonInfo`.

Diretorio interno adotado:

- base: `FileSystem.documentDirectory + 'tche-geojson-imports/'`;
- subdiretorio por Propriedade:
  `.../tche-geojson-imports/{propriedade_id_sanitizado}/`;
- arquivo final:
  `.../{propriedade_id_sanitizado}/{importId_sanitizado}-{arquivo_sanitizado}`.

Exemplo:

- `file:///.../tche-geojson-imports/p_sela1/import-001-limites-talhoes.geojson`

Regras de path:

- `propriedade_id` e sanitizado antes de entrar no caminho;
- nome cru de usuario ou Propriedade nao e usado no path;
- caracteres perigosos e traversal como `../` sao removidos;
- underscore de ids tecnicos, como `p_sela1`, e preservado para compatibilidade;
- `importId` pode vir de fora ou ser gerado por helper injetavel;
- testes injetam `generateImportId`, sem depender de `Date.now`.

Regras de nome de arquivo:

- preserva extensao `.geojson` ou `.json`;
- converte espacos e caracteres inseguros para `-`;
- remove componentes de caminho;
- limita o tamanho da base do nome;
- fallback para `limites-talhoes.geojson`;
- garante extensao valida.

Estrategia de copia:

- cria o diretorio base e o subdiretorio da Propriedade se nao existirem;
- verifica se o destino ja existe;
- por padrao, nao sobrescreve arquivo existente e retorna
  `DESTINATION_EXISTS`;
- sobrescreve apenas quando `overwrite: true` vier explicito;
- quando `overwrite: true` e o destino existe, remove o arquivo anterior dentro
  da area segura antes de copiar;
- tenta `FileSystem.copyAsync({ from: sourceUri, to: destinationUri })`;
- se `copyAsync` falhar e `content` estiver disponivel, usa
  `FileSystem.writeAsStringAsync(destinationUri, content, { encoding: UTF8 })`;
- se copia e fallback falharem, retorna erro controlado;
- nao loga conteudo;
- nao salva conteudo em `AsyncStorage`;
- apos a copia, chama `FileSystem.getInfoAsync(destinationUri)` para confirmar
  existencia e capturar tamanho.

Resultado da copia:

- `propriedade_id`;
- `fazenda_id`;
- `uri`;
- `name`;
- `originalName`;
- `size`;
- `copiedAt`.

Leitura e validacao posterior:

- `readStoredGeoJson(uri)` le apenas URIs dentro do diretorio interno de
  GeoJSON;
- `validateStoredGeoJson(uri, options)` le o arquivo armazenado e chama
  `validateAndNormalizeGeoJson`;
- a validacao retorna talhoes normalizados quando o GeoJSON e valido;
- conteudo invalido retorna `validation.ok: false`, sem salvar nada.

Remocao segura:

- `deleteStoredGeoJson(uri)` remove somente arquivo dentro do diretorio base de
  GeoJSON;
- path externo retorna `UNSAFE_DELETE_PATH`;
- diretorio base ou subdiretorio de Propriedade nao sao removidos;
- arquivo inexistente retorna sucesso controlado com `deleted: false`;
- assets e seed da Sela de Prata I nao sao tocados.

Erros controlados:

- `PROPRIEDADE_ID_REQUIRED`;
- `SOURCE_URI_REQUIRED`;
- `STORAGE_DIRECTORY_FAILED`;
- `INVALID_STORAGE_PATH`;
- `DESTINATION_EXISTS`;
- `COPY_FAILED`;
- `WRITE_FALLBACK_FAILED`;
- `STORED_FILE_NOT_FOUND`;
- `READ_STORED_FILE_FAILED`;
- `DELETE_FAILED`;
- `UNSAFE_DELETE_PATH`;
- `FILE_INFO_FAILED`.

Limites preservados:

- nenhuma tela foi alterada;
- nenhuma acao visual foi criada;
- nenhuma chamada foi adicionada em `MapasScreen`;
- nenhuma chamada foi adicionada em `FazendaMapaScreen`;
- `LimiteArea.list` nao foi alterado;
- `GeoJsonImportService` nao e chamado;
- `@tche:mock-mvp:v1` nao e usado;
- `@tche:geojson-imports:v1` nao e usado nesta fase;
- nenhum metadado e criado;
- nenhuma importacao e marcada como ativa;
- nenhum GeoJSON importado e associado visualmente a Propriedade;
- nenhuma renderizacao de GeoJSON importado foi adicionada;
- a Sela de Prata I permanece no seed/assets.

Testes criados:

- `tests/geojsonStorageService.test.js`

Cobertura principal:

- criacao do diretorio base;
- criacao do subdiretorio por Propriedade;
- sanitizacao de `propriedade_id`;
- sanitizacao de nome de arquivo;
- remocao de traversal;
- preservacao de `.geojson` e `.json`;
- fallback para `limites-talhoes.geojson`;
- copia via `copyAsync`;
- fallback textual via `writeAsStringAsync`;
- erro controlado quando copia e fallback falham;
- ausencia de sobrescrita por padrao;
- `overwrite: true` explicito;
- confirmacao de existencia com `getInfoAsync`;
- retorno de URI e tamanho;
- leitura posterior;
- validacao posterior com helper real;
- retorno `validation.ok: false` para conteudo invalido;
- remocao segura;
- recusa de path externo;
- arquivo inexistente sem derrubar;
- escopo sem imports para `GeoJsonImportService`, `LimiteArea`, `Mapa`,
  `User`, `Produtor`, React, telas, `AsyncStorage` ou chaves `@tche`.

Validacoes executadas na 16F.5:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` passou com acesso a rede liberado;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

### 16F.6 - Associacao do GeoJSON a Propriedade

Associar a URI local retornada pela 16F.5 aos metadados no contexto de
Propriedade:

- preservar `fazenda_id`;
- adicionar `propriedade_id` como alias futuro;
- criar metadado em `GeoJsonImportService`;
- salvar apenas metadados pequenos, nao o conteudo do GeoJSON;
- impedir associacao fora do escopo do usuario;
- manter Sela de Prata I protegida contra substituicao acidental.

### 16F.7 - Visualizacao do GeoJSON importado

Permitir que `MapasScreen`/`FazendaMapaScreen` leiam limites importados
normalizados, com fallback para seed/assets quando nao houver importacao local.

### 16F.8 - Substituicao e remocao segura

Adicionar operacoes controladas:

- marcar importacao como ativa/inativa;
- remover arquivo fisico;
- restaurar seed quando aplicavel;
- confirmar antes de substituir limites existentes.

### 16F.9 - Smoke Android

Validar em Android fisico:

- selecao de arquivo;
- copia interna;
- reinicio do app;
- carregamento offline;
- toque em talhao;
- empty state de Propriedade sem GeoJSON;
- tentativa fora do escopo;
- arquivo grande e arquivo invalido.

## Testes Recomendados

Na 16F.1 nao foi adicionado teste, porque o pedido era
diagnostico/documentacao e nao alterava comportamento.

Nas microfases seguintes ja foram adicionados testes para:

- `GeoJsonImportService`;
- `validateAndNormalizeGeoJson`;
- `GeoJsonFilePickerService`;
- `GeoJsonStorageService`.

Permanecem recomendados para as proximas fases:

- teste de caracterizacao do asset da Sela de Prata I;
- teste de contagem de features/talhoes;
- teste de compatibilidade de rota para selecionar talhao por id/nome.

## Conclusao Da 16F.1

O estado atual ja possui uma amostra robusta da Sela de Prata I, mas ela esta
embutida no app como asset TypeScript normalizado. O GeoJSON processado e o
manifesto servem como rastreabilidade e base para evolucao, nao como runtime
direto.

O caminho mais seguro para importacao local e nao gravar GeoJSON grande no
snapshot mock. A proxima fase deve primeiro fechar contrato e validador puro,
depois adicionar picker, copia interna, associacao por Propriedade e so entao
visualizacao no mapa.
