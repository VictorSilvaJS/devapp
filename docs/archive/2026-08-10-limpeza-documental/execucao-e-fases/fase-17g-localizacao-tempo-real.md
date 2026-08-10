# Fase 17G - Localizacao Foreground Em Tempo Real Sobre Talhoes

Status em 2026-07-09 (Fase 17G.0): analise tecnica concluida. Nenhuma
localizacao foi implementada, nenhuma dependencia foi instalada e nenhuma
coordenada do usuario foi salva nesta etapa documental.

Status em 2026-07-09 (Fase 17G.1): implementada a primeira visualizacao de
localizacao foreground no mapa de Talhoes, acionada por botao, usando
`expo-location` e a tela ativa `FazendaMapaScreen` + `MapaFazendaView`.
A coordenada fica apenas em estado React e no runtime do Leaflet/WebView; nao
ha AsyncStorage, chave nova, trilha, historico, rota, geotag, Caderno com
coordenada, background location, TaskManager, geofencing, backend, sync,
upload, download real ou storage remoto.

Status em 2026-07-10 (Fase 17G.2): executado smoke visual em emulador do corte
foreground sobre o mapa de Talhoes da Sela de Prata I. Foram feitos dois
ajustes localizados: fallback para a ultima leitura recente do sistema quando a
leitura atual expira no emulador, e pane propria no Leaflet para manter o
marcador do usuario acima dos rotulos dos Talhoes. A auditoria continuou sem
persistencia de coordenadas ou uso de APIs de background.

Status em 2026-07-10 (Fase 17G.3): revalidacao concluida no emulador sobre
GeoJSON local ativo. `limites_talhoes.geojson` foi reanexado pelo
DocumentPicker com 15 Talhoes/37 partes, a localizacao foreground apareceu no
Leaflet com precisao simulada de 8 m, o Talhao permaneceu clicavel e, apos
`force-stop`, o GeoJSON continuou ativo sem restaurar o marcador. PNG local,
ZIP de Prescricao, Caderno, permissao negada e localizacao desligada foram
revalidados sem regressao. Fallback SVG/WebView e Android fisico permanecem
pendentes.

Este arquivo documenta a analise 17G.0, a implementacao minima 17G.1 e o smoke
visual 17G.2/17G.3. A localizacao so deve ser considerada sobre camada
georreferenciada de Talhoes/GeoJSON. PNG e ZIP continuam sendo materiais
tecnicos/anexos, nao mapas georreferenciados.

## Implementacao Da Fase 17G.1

Arquivos principais:

- `package.json` e `package-lock.json`: adicionam `expo-location@~56.0.20`.
- `app.json`: configura permissao foreground de localizacao, sem permissao de
  background e sem `UIBackgroundModes location`.
- `src/services/LocationForegroundService.ts`: helper isolado para permissao
  foreground, disponibilidade de servicos e leitura atual sob demanda.
- `src/screens/FazendaMapaScreen.tsx`: adiciona botao `Mostrar minha posicao`,
  estado transiente de localizacao e mensagem de precisao/horario.
- `src/components/MapaFazendaView.tsx`: adiciona prop `userLocation`, injeta
  payload serializado no Leaflet e cria/atualiza marcador e circulo de
  precisao apenas no runtime do mapa interativo.

Comportamento implementado:

- botao aparece somente quando ha contexto de Propriedade e Talhoes exibidos;
- permissao foreground e solicitada sob demanda;
- uma unica leitura atual e obtida por toque, sem `watchPosition`;
- latitude, longitude, accuracy e horario da leitura ficam apenas em memoria;
- marcador azul e circulo de precisao aparecem no Leaflet;
- fallback SVG nao tenta converter lat/lng e exibe aviso de que a posicao do
  aparelho so esta disponivel no mapa interativo;
- permissao negada, servicos desligados e erro de leitura retornam mensagens
  controladas;
- PNG e ZIP continuam sem marcador de localizacao;
- Caderno de Campo nao recebe coordenada automaticamente.

Observacao de compatibilidade Expo: `npx expo install --check` em 2026-07-09
reportou `expo@56.0.11 - expected version: ~56.0.15`. A divergencia foi mantida
sem correcao nesta fase funcional, conforme restricao do projeto.

## Escopo Da Analise 17G.0

- Diagnosticar o estado atual de mapas, Talhoes, GeoJSON local e dependencias.
- Comparar implementacao futura no WebView/Leaflet atual versus mapa nativo.
- Definir regras de produto para localizacao em tempo real.
- Recomendar uma implementacao minima para a futura Fase 17G.1.
- Registrar riscos e criterios antes de abrir implementacao.

## Fora De Escopo Na Analise 17G.0

- Implementar GPS/localizacao.
- Instalar `expo-location` ou qualquer dependencia nova.
- Persistir coordenadas, trilha, historico, rota ou ultimo ponto do usuario.
- Implementar localizacao em background.
- Enviar localizacao para backend ou sincronizar dados.
- Georreferenciar PNG, sobrepor marcador em PNG ou processar ZIP.
- Criar ponto de aplicacao, fertilizacao/correcao por ponto ou calculo
  agronomico.
- Desenhar, editar ou corrigir limites de Talhao pelo celular.
- Alterar `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, seeds/assets da
  Sela de Prata I ou chaves locais existentes.

## Estado Atual Dos Mapas

### `FazendaMapaScreen`

`src/screens/FazendaMapaScreen.tsx` e a tela dedicada ao mapa de Talhoes. Ela:

- recebe contexto por rota usando `resolveRouteFazendaId`,
  `resolveRouteTitularNome` e `resolveTalhaoSelecionadoFromRoute`;
- valida acesso por Propriedade com `avaliarAcessoFazendaPorId`;
- carrega Propriedades via `Produtor.list` e limites via `LimiteArea.list`;
- filtra Talhoes por escopo usando `filtrarLimitesPorFazendaIds`;
- tenta carregar GeoJSON local ativo com `loadGeoJsonTalhoesLayer`;
- decide a camada efetiva com `resolveEffectiveTalhoesLayer`;
- guarda a selecao em `talhaoSelecionadoId`;
- passa `talhoes`, `talhaoSelecionadoId` e `onTalhaoPress` para
  `MapaFazendaView`;
- usa a ref de `MapaFazendaView` para `selecionarTalhao` e `ajustarLimites`.

O ponto mais seguro para uma primeira localizacao futura e esta tela, porque
ela ja isola o contexto de Propriedade, carrega Talhoes georreferenciados e
possui o mapa interativo de limites.

### `MapaFazendaView`

`src/components/MapaFazendaView.tsx` e o componente ativo do mapa interativo.
Ele:

- gera um `FeatureCollection` em memoria a partir dos Talhoes normalizados;
- converte cada ponto runtime `{ lat, lng }` para coordenadas GeoJSON
  `[lng, lat]`;
- renderiza Leaflet dentro de `react-native-webview`;
- usa tiles online do OpenStreetMap (`https://tile.openstreetmap.org/...`);
- registra camadas por id de Talhao em `layersById`;
- envia eventos ao app com `window.ReactNativeWebView.postMessage`;
- recebe comandos do app por `injectJavaScript`, hoje para selecionar Talhao e
  ajustar limites;
- ativa fallback vetorial se o Leaflet nao carregar no tempo limite ou se o
  WebView reportar erro.

Para 17G.1, o desenho mais simples seria adicionar uma prop transiente, por
exemplo `userLocation`, e expor no HTML uma funcao `atualizarLocalizacaoUsuario`
que atualize/crie um `L.marker` e um circulo de precisao. O app passaria
latitude/longitude/accuracy apenas em memoria e atualizaria o WebView via
`injectJavaScript`.

### Fallback Vetorial

O fallback de `MapaFazendaView` usa SVG local (`FallbackShapeMap`) e a mesma
transformacao proporcional de lat/lng para tela. Ele mantem toque em Talhao e
labels, mas nao tem mapa-base, zoom/pan Leaflet nem semantica cartografica
visual completa.

Na primeira 17G.1, recomenda-se nao exibir a posicao do usuario no fallback
SVG. Se o Leaflet falhar, a UI deve mostrar mensagem controlada de que a
posicao so aparece no mapa interativo de Talhoes. Uma segunda etapa poderia
criar helper testado de conversao lat/lng -> SVG e point-in-bounds, mas isso
deve ser criterio proprio.

### `MapasScreen` E `ShapeRenderer`

`src/screens/MapasScreen.tsx` e o panorama de Material tecnico. Ele:

- carrega mapas, limites, cadernos, periodos e imports locais;
- mescla PNG local e ZIP de Prescricao em runtime sem alterar `Mapa.list`;
- carrega GeoJSON local ativo por Propriedade quando ha contexto unico;
- usa `ShapeRenderer` para preview SVG de Talhoes no panorama;
- guarda o Talhao selecionado em `selectedTalhao`;
- abre `TalhaoDetailModal` com Caderno, Safra/Safrinha e materiais do Talhao;
- permite ir para `FazendaMapaScreen` por `handleVerTalhaoNoMapa`.

`ShapeRenderer` e uma pre-visualizacao SVG dentro do panorama. Ele usa bounds
dos Talhoes para converter lat/lng em pontos de tela, mas nao e o melhor lugar
para localizacao real na primeira etapa, porque a tela tambem exibe biblioteca
de materiais e anexos. A experiencia de "Mostrar minha posicao" deve morar no
mapa de Talhoes (`FazendaMapaScreen`/`MapaFazendaView`) ou, no maximo, chamar
essa tela a partir do panorama.

### `GeoJsonTalhoesLayerService`

`src/services/GeoJsonTalhoesLayerService.ts` decide a origem dos Talhoes:

- sem GeoJSON ativo: retorna `sem_geojson_ativo` e a tela usa seed/mock;
- GeoJSON local ativo valido: retorna `geojson_local_ativo` com Talhoes
  normalizados em memoria;
- erro de GeoJSON local: retorna `erro_geojson_local` e
  `resolveEffectiveTalhoesLayer` usa seed como fallback.

O servico nao persiste Talhoes normalizados. Ele valida o arquivo armazenado e
entrega a camada runtime para a tela.

### `GeoJsonImportService` E Validador

`GeoJsonImportService` guarda apenas metadados pequenos na chave
`@tche:geojson-imports:v1`: ids de Propriedade/Fazenda, nome do arquivo, URI
local, tamanho/MIME, status, contagens e informacoes auxiliares. Ele nao guarda
`FeatureCollection`, `features` ou `coordinates` no indice.

`geojsonImportValidator.ts` valida `FeatureCollection`, `Polygon` e
`MultiPolygon`, exige coordenadas GeoJSON em `[lng, lat]`, converte em memoria
para `{ lat, lng }`, detecta inversao provavel e normaliza Talhoes para o
runtime do app.

## Estado Atual Das Dependencias

`package.json` registra:

- `expo@~56.0.11`;
- `expo-location@~56.0.20`;
- `react-native-webview@13.16.1`;
- `react-native-svg@15.15.4`;
- `react-native-maps@1.27.2`;
- `expo-document-picker@~56.0.4`;
- `expo-file-system@~56.0.8`.

`app.json` possui configuracao de permissao foreground para localizacao. Nao
ha permissao de localizacao em background, nao ha `UIBackgroundModes location`
e nao ha habilitacao de background location pelo plugin.

`react-native-maps` existe como dependencia e e importado por
`MapaFazendaNativoView.tsx`, mas esse componente nao aparece em nenhuma rota
ou tela ativa. A rota ativa para Talhoes e `FazendaMapaScreen`, usando
`MapaFazendaView` com WebView/Leaflet.

## Estrategia A - Localizacao No WebView/Leaflet Atual

### Proposta

Na futura 17G.1, adicionar localizacao foreground only no fluxo atual:

1. instalar e configurar a dependencia aprovada, provavelmente `expo-location`;
2. adicionar botao "Mostrar minha posicao" em `FazendaMapaScreen`;
3. pedir permissao foreground sob demanda;
4. obter leitura atual com precisao quando permitido;
5. manter a leitura em estado React transiente;
6. passar a leitura para `MapaFazendaView`;
7. dentro do HTML Leaflet, criar/atualizar `L.marker` e `L.circle` de precisao;
8. nunca salvar coordenadas no AsyncStorage;
9. limpar estado ao sair da tela ou ao desligar a exibicao.

### Como Passar Latitude/Longitude Para O WebView

`MapaFazendaView` ja usa `injectJavaScript` para comandos. A mesma ponte pode
ser ampliada com uma funcao no HTML:

- `window.atualizarLocalizacaoUsuario(payload)`;
- payload transiente: `{ latitude, longitude, accuracy, capturedAt }`;
- validar numeros finitos antes de injetar;
- no WebView, converter para `L.latLng(latitude, longitude)`;
- atualizar marker/circle existentes em vez de recriar a camada toda;
- opcionalmente centralizar o mapa apenas na primeira leitura ou quando o
  usuario tocar explicitamente em "centralizar".

### Pros

- Aproveita a tela ativa e aprovada no MVP.
- Evita refatoracao para mapa nativo.
- Usa os Talhoes ja normalizados e a selecao existente.
- Permite implementar uma experiencia pequena e reversivel.
- Mantem PNG/ZIP fora da localizacao.
- Reduz impacto em build comparado a trocar o motor de mapa.

### Contras

- Leaflet e CSS/JS sao carregados de CDN; se a rede falhar, o fallback SVG
  entra.
- Atualizacao de marcador depende da ponte WebView.
- Exige cuidado com escape/serializacao de payload injetado.
- Teste em Android fisico e importante para permissao e precisao real.

### Riscos

- OSM online pode falhar em campo.
- WebView pode atrasar `ready`, ativando fallback.
- Precisao de GPS pode variar muito em area rural.
- Usuario pode interpretar a precisao como recomendacao agronomica.
- Se nao houver Talhoes validos, nao deve haver marcador sobre material.

## Estrategia B - Localizacao Em Mapa Nativo Futuro

### Proposta

Reativar ou refatorar `MapaFazendaNativoView.tsx` para usar
`react-native-maps`, com `Polygon`, `Marker`, regiao nativa e eventual
integracao de posicao do usuario.

### Pros

- Marcadores, regioes e gestos sao nativos.
- Integra melhor com APIs de mapa do Android/iOS.
- Pode ser base futura para recursos mais complexos.
- Pode evitar parte da complexidade da ponte WebView.

### Contras

- O componente atual e experimento historico e nao esta no fluxo ativo.
- Exigiria revalidar profundamente a tela de Talhoes.
- Pode exigir ajustes nativos, providers e permissoes por plataforma.
- Tem maior risco de regressao no MVP ja aprovado em emulador.
- Nao resolve sozinho offline real nem mapa-base em campo.

### Riscos

- Impacto em build Android/iOS maior que a abordagem WebView.
- Necessidade de validar provider de mapas e permissoes nativas.
- Possivel divergencia visual/comportamental em relacao ao fluxo atual.
- Android fisico e iOS ainda nao foram validados para esse uso.

### Recomendacao Sobre Mapa Nativo

Nao usar mapa nativo para a 17G.1 minima. Manter como alternativa futura, apos
validar Android fisico, iOS, provider de mapa, permissoes e impacto de build.

## Decisao Aplicada Na 17G.1

Foi implementada a primeira localizacao sobre `FazendaMapaScreen` +
`MapaFazendaView` com WebView/Leaflet.

O recurso deve ser:

- foreground only;
- acionado por botao;
- sem watch continuo obrigatorio na primeira versao;
- sem background;
- sem persistencia de coordenadas;
- sem envio remoto;
- sem overlay em PNG;
- limitado a mapas com Talhoes georreferenciados carregados.

Dependencia instalada: `expo-location@~56.0.20`, via
`npx expo install expo-location`, sem instalar bibliotecas extras.

## UX Implementada Na 17G.1

`FazendaMapaScreen` recebeu um botao discreto:

- "Mostrar minha posicao" ou "Usar minha localizacao";
- icone de alvo/localizacao;
- visivel apenas quando houver Talhoes exibidos;
- desabilitado ou oculto quando a tela nao tiver contexto de Propriedade ou
  demarcacao.

Fluxo implementado:

1. Usuario toca no botao.
2. App solicita permissao de localizacao foreground.
3. Se permitido:
   - obter posicao atual;
   - mostrar marcador no mapa de Talhoes;
   - mostrar precisao, quando disponivel;
   - mostrar data/hora da ultima leitura;
   - opcionalmente indicar "dentro/fora da area visual da Propriedade" apenas
     se houver helper seguro e testado.
4. Se negado:
   - exibir mensagem clara e sem crash.
5. Se GPS indisponivel:
   - exibir mensagem clara e manter mapa funcionando.
6. Se Leaflet cair no fallback SVG:
   - nao exibir marcador na primeira versao;
   - informar que a posicao fica disponivel no mapa interativo de Talhoes.
7. Se nao houver Talhoes:
   - o botao nao aparece.

## Regras De Produto Para Localizacao

- Localizacao deve ser foreground only.
- Nao implementar localizacao em background.
- Nao salvar trilha, rota, historico ou ultimo ponto em storage local.
- Nao salvar coordenadas do usuario em AsyncStorage.
- Nao enviar coordenadas para backend.
- Nao sincronizar localizacao.
- Nao compartilhar localizacao.
- Nao criar ponto de aplicacao, fertilizacao ou correcao por ponto.
- Nao criar marcacoes produtivas.
- Nao executar calculo agronomico.
- Nao sobrepor localizacao em PNG.
- Localizacao so faz sentido sobre Talhoes, GeoJSON ou mapa georreferenciado.
- PNG continua anexo visual nao georreferenciado.
- ZIP de Prescricao continua pacote tecnico sem processamento.

## Riscos Tecnicos

- Permissoes Android/iOS exigem configuracao e teste em aparelho real.
- Android fisico segue pendente e nao aprovado.
- iOS segue pendente.
- Precisao de GPS pode ser baixa em campo ou sob cobertura.
- Consumo de bateria aumenta se houver watch continuo; primeira versao deve
  preferir leitura sob demanda.
- WebView/Leaflet exige ponte segura para atualizar marcador.
- Coordenadas usam lat/lng no runtime e `[lng, lat]` no GeoJSON; erro de ordem
  pode deslocar marcador.
- Talhoes seed/mock e GeoJSON local ativo podem ter origens diferentes; a UI
  deve indicar origem da demarcacao.
- OSM online pode falhar em campo.
- Fallback vetorial nao deve ser tratado como mapa-base completo.
- Usuario pode achar que PNG de fertilidade/correcao e georreferenciado; a UI
  deve evitar essa associacao.
- Sem helper point-in-polygon testado, nao afirmar com certeza que o usuario
  esta dentro de um Talhao especifico.

## Checklist Da 17G.1

- Dependencia de localizacao definida: `expo-location@~56.0.20`.
- Permissao foreground only configurada.
- Sem persistencia de coordenadas.
- Android fisico ainda deve ser testado.
- Confirmar criterio para iOS ou registrar iOS como pendente.
- PNG/ZIP continuam materiais, nao camadas georreferenciadas.
- Leitura implementada como unica sob demanda, sem watch continuo.
- Fallback SVG mostra aviso e nao desenha marcador de localizacao.
- Mensagens controladas para permissao negada, servicos desligados, erro de
  leitura e mapa sem contexto.
- Calculo dentro/fora da Propriedade/Talhao nao foi implementado.

## Criterios De Aceite Da 17G.1

- `expo-location` instalado somente na fase aprovada.
- `app.json` configurado com textos de permissao necessarios, sem permissao de
  background.
- Botao aparece apenas no mapa de Talhoes georreferenciado.
- Permissao foreground solicitada sob demanda.
- Marcador aparece no Leaflet quando ha coordenada valida.
- Precisao e horario da leitura aparecem quando disponiveis.
- Permissao negada e GPS indisponivel geram mensagens controladas.
- Coordenadas nao sao salvas em AsyncStorage, nem em chave nova, nem em chaves
  existentes.
- Nenhuma trilha/historico/rota e mantida.
- Nenhum envio remoto e feito.
- PNG/ZIP nao recebem marcador de localizacao.
- Android fisico deve executar smoke especifico antes de aprovar campo.

## Validacao Executada Na 17G.1

- `npm run typecheck` passou.
- `npm run test:domain-compat` passou.
- `npx expo install --check` reportou somente a divergencia de Expo
  `expo@56.0.11 - expected version: ~56.0.15`; ela foi mantida sem correcao.
- `.\gradlew.bat :app:assembleRelease` falhou inicialmente por limite de
  memoria no Kotlin daemon, mas passou depois com Gradle em modo economico
  (`--no-daemon --max-workers=1 --no-parallel`, Kotlin in-process e heap
  limitado).
- O APK release gerado foi instalado no emulador `emulator-5554` e aberto por
  `monkey` sem crash inicial.
- `adb dumpsys package com.tcheagro.mobile` confirmou
  `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION` no pacote instalado, sem
  `ACCESS_BACKGROUND_LOCATION`.
- A auditoria focada nao encontrou AsyncStorage, chave nova de storage,
  `TaskManager`, background location, watch continuo ou geofencing nos
  arquivos alterados.
- A navegacao por `uiautomator` abriu Sela de Prata I e chegou ao contexto de
  Material tecnico/Talhoes, mas o estado local do emulador estava sem GeoJSON
  local anexado para a Propriedade. Por isso, o toque no botao
  `Mostrar minha posicao`, o marcador, permissao concedida e permissao negada
  seguem para reexecucao visual.
- `adb devices -l` mostrou apenas `emulator-5554`; Android fisico segue
  pendente e nao aprovado.

## Ajustes E Validacao Executada Na 17G.2

A 17G.2 manteve o escopo funcional da 17G.1 e corrigiu apenas pontos
necessarios para fechar o smoke visual em emulador:

- `src/services/LocationForegroundService.ts` passou a tentar uma leitura
  recente do sistema com `getLastKnownPositionAsync` quando
  `getCurrentPositionAsync` expira. O limite usado e de 2 minutos e precisao
  maxima requerida de 200 m, mantendo a leitura como estado efemero e sem
  AsyncStorage.
- `src/components/MapaFazendaView.tsx` passou a desenhar o marcador e o circulo
  de precisao em uma pane Leaflet propria (`user-location-pane`), acima dos
  rotulos de Talhao e sem interceptar toques.

Validacao em emulador:

- `npm run typecheck` passou.
- `npm run test:domain-compat` passou.
- `npx expo install --check` foi executado sem instalar dependencias; no
  sandbox falhou com `ECONNREFUSED 127.0.0.1:9`, e fora do sandbox reportou
  somente `expo@56.0.11 - expected version: ~56.0.15`. A divergencia foi
  mantida sem correcao.
- `.\gradlew.bat :app:assembleRelease` falhou inicialmente no sandbox por
  acesso ao lock do Gradle em `%USERPROFILE%\.gradle`, mas passou quando
  reexecutado com permissao para acessar o cache local.
- O APK release foi instalado no emulador `emulator-5554` (`Pixel_Tablet`) com
  `adb install -r` e aberto via `monkey`.
- `adb devices -l` mostrou apenas o emulador; nenhum Android fisico apareceu
  como `device`.
- `adb dumpsys package com.tcheagro.mobile` confirmou
  `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`, sem
  `ACCESS_BACKGROUND_LOCATION`.

Smoke funcional em emulador:

- Em Sela de Prata I > Panorama e Talhoes, o botao `Mostrar minha posicao`
  apareceu no mapa de Talhoes seed/mock.
- Com permissao concedida e posicao simulada no provedor do emulador, o app
  exibiu mensagem de sucesso com precisao informada de 8 m e horario da
  leitura; o marcador azul ficou visivel sobre os Talhoes.
- A consulta do Talhao continuou funcional apos o marcador: o card/lista abriu
  o detalhe de `T01 - 230`.
- Ao negar permissao, o app exibiu mensagem controlada e nao quebrou a tela.
- Com servicos de localizacao desligados no emulador, o app exibiu mensagem
  controlada para ativar a localizacao do aparelho.
- Apos `force-stop` e reabertura, a posicao anterior nao foi restaurada; o
  botao voltou sem marcador/mensagem de sucesso ate novo toque.
- Material tecnico da Sela foi reaberto e nao exibiu botao de localizacao.
- As regras de Produtor sem acoes administrativas de PNG/ZIP permanecem
  cobertas pelos testes de dominio existentes; nao foi feito login manual
  separado de Produtor nesta rodada.

Auditoria de nao persistencia:

- Busca textual focada nao encontrou `watchPosition`,
  `watchPositionAsync`, `startLocationUpdates`, `TaskManager`,
  `ACCESS_BACKGROUND_LOCATION`, `UIBackgroundModes`, geofence/geofencing ou
  nova chave `@tche:` ligada a localizacao.
- Nos arquivos novos/alterados de localizacao nao ha `AsyncStorage` nem chave
  persistente.
- Auditoria do Caderno encontrou apenas localizacao textual da Propriedade em
  detalhe e campos legados de contrato, sem latitude/longitude/accuracy/coords
  novos no formulario, edicao, detalhe ou compatibilidade de Caderno.

Limitacoes da 17G.2:

- O reanexo/reimportacao de GeoJSON local via DocumentPicker nao foi repetido
  nesta rodada; o smoke visual usou a camada seed/mock da Sela de Prata I.
- O fallback SVG/WebView nao foi forçado manualmente.
- Nao foi criado novo Caderno manual a partir do Talhao nesta rodada; a ausencia
  de coordenadas no Caderno ficou coberta por auditoria e testes automatizados.
- Android fisico segue pendente e nao aprovado.

## Revalidacao Executada Na 17G.3

A 17G.3 revalidou o fluxo foreground no AVD `tche_test`, identificado pelo
`adb` como `emulator-5554` (`Pixel_Tablet`, API 35), usando o APK release atual.
Nenhuma feature nova ou correcao funcional foi necessaria.

GeoJSON local e localizacao:

- `limites_talhoes.geojson`, ja presente em `Downloads`, foi selecionado pelo
  DocumentPicker e abriu a confirmacao com 15 Talhoes, 37 partes/poligonos,
  geometrias `MultiPolygon`/`Polygon`, nome original e tamanho de 171,9 KB;
- a associacao foi confirmada e a tela passou a mostrar `GeoJSON anexado`,
  `limites_talhoes.geojson` e `Talhoes carregados do GeoJSON local`;
- o mapa interativo mostrou a origem `GEOJSON LOCAL`, manteve os 15 Talhoes e
  renderizou o marcador azul/circulo de precisao com leitura simulada de 8 m;
- o card de `T01 - 230` continuou clicavel e abriu o detalhe do Talhao depois
  da localizacao;
- a UI nao afirmou que o aparelho estava dentro ou fora de um Talhao;
- apos `adb shell am force-stop com.tcheagro.mobile`, o GeoJSON local voltou
  ativo na reabertura, mas o marcador e a mensagem de sucesso nao voltaram;
  foi necessario um novo toque em `Mostrar minha posicao`.

Regressoes de Material tecnico e Caderno:

- `smoke_ph_10a20.png` foi reanexado como PNG local de Fertilidade/pH, abriu
  como imagem e nao mostrou botao, marcador ou circulo de localizacao;
- `prescricao_taxa_variavel_2026.zip` foi reanexado como Prescricao e abriu
  somente o detalhe do pacote tecnico, sem preview de imagem, unzip,
  processamento ou localizacao;
- em login separado de Produtor, PNG e ZIP continuaram consultaveis e seus
  modais exibiram somente fechar, sem anexar, substituir ou remover;
- o registro de Caderno `Observacao` do Talhao `T01 - 230` foi reaberto com a
  Propriedade Sela de Prata I preservada, sem latitude, longitude, accuracy,
  `capturedAt`, geotag ou campo novo de localizacao;
- nao havia PDF invalido em `Downloads`; a rejeicao de PDF no fluxo ZIP
  permaneceu coberta pelo teste automatizado do picker, sem novo caso manual.

Mensagens controladas:

- a permissao Android foi revogada e o caso `Don't allow` exibiu
  `Permissao de localizacao negada...`, sem crash e sem marcador;
- com `cmd location set-location-enabled false`, o app exibiu
  `Ative a localizacao do aparelho para usar este recurso.`, mantendo o mapa;
- a localizacao foi reativada ao fim da rodada e o provedor de teste do
  emulador foi removido;
- a camada seed/mock nao foi removida nesta rodada; o caso segue aprovado pela
  17G.2 no mesmo fluxo, e a 17G.3 concentrou a revalidacao na camada local.

Auditoria e validacoes:

- `npm run typecheck` passou;
- `npm run test:domain-compat` passou, incluindo GeoJSON, PNG, ZIP e Caderno;
- `npx expo install --check` confirmou somente a divergencia conhecida
  `expo@56.0.11 - expected version: ~56.0.15`, mantida sem correcao;
- `.\gradlew.bat :app:assembleRelease` falhou primeiro apenas pelo bloqueio do
  cache Gradle no sandbox e passou ao ser repetido com acesso ao cache local;
- o APK foi instalado por `adb install -r` e aberto sem crash funcional;
- `dumpsys package` confirmou `ACCESS_FINE_LOCATION` e
  `ACCESS_COARSE_LOCATION`, sem `ACCESS_BACKGROUND_LOCATION`;
- a busca ampla solicitada e buscas focadas nao encontraram AsyncStorage/chave
  de localizacao nos arquivos do recurso, campos de coordenada no Caderno,
  `watchPosition`, `startLocationUpdates`, `TaskManager`, geofencing ou
  background location;
- as chaves `@tche:*` continuaram restritas as sete chaves existentes, sem
  chave nova de localizacao; GeoJSON, PNG e ZIP continuam com arquivo fisico
  no storage interno e somente metadados pequenos em AsyncStorage.

Pendencias preservadas:

- o fallback SVG/WebView nao foi forcado porque nao ha chave segura de teste e
  provocar falha exigiria alterar o app, limpar WebView ou interferir de forma
  arriscada no ambiente; o caso permanece `Reexecutar`;
- Android fisico segue pendente e nao aprovado;
- iOS, precisao/consumo em campo, backend/RBAC real, sync, upload/download real
  e storage remoto seguem fora deste fechamento.

## Conclusao

A 17G.3 fecha a revalidacao em emulador para localizacao foreground sobre
GeoJSON local ativo e confirma ausencia de regressao em PNG, ZIP e Caderno. A
localizacao continua efemera, sem background, trilha, historico, rota, geotag
ou coordenada persistida. O mapa nativo deve permanecer como alternativa
futura, porque reativar `MapaFazendaNativoView` agora ampliaria o risco e
mudaria uma base de Talhoes ja validada em emulador. Fallback forcado e Android
fisico seguem pendentes; Android fisico nao esta aprovado.
