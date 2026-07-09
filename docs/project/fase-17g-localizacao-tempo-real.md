# Fase 17G.0 - Analise Tecnica De Localizacao Em Tempo Real Sobre Talhoes

Status em 2026-07-09: analise tecnica concluida. Nenhuma localizacao foi
implementada, nenhuma dependencia foi instalada e nenhuma coordenada do usuario
foi salva.

Esta fase documenta como uma fase futura pode exibir a posicao atual do usuario
sobre o mapa de Talhoes da Propriedade. A localizacao so deve ser considerada
sobre camada georreferenciada de Talhoes/GeoJSON. PNG e ZIP continuam sendo
materiais tecnicos/anexos, nao mapas georreferenciados.

## Escopo Da Analise

- Diagnosticar o estado atual de mapas, Talhoes, GeoJSON local e dependencias.
- Comparar implementacao futura no WebView/Leaflet atual versus mapa nativo.
- Definir regras de produto para localizacao em tempo real.
- Recomendar uma implementacao minima para a futura Fase 17G.1.
- Registrar riscos e criterios antes de abrir implementacao.

## Fora De Escopo Nesta Fase

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
- `react-native-webview@13.16.1`;
- `react-native-svg@15.15.4`;
- `react-native-maps@1.27.2`;
- `expo-document-picker@~56.0.4`;
- `expo-file-system@~56.0.8`.

Nao ha `expo-location` em `package.json`, nem configuracao de permissao de
localizacao em `app.json`.

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
- payload transiente: `{ latitude, longitude, accuracy, timestamp }`;
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

## Decisao Recomendada Para 17G.1

Implementar, se aprovado depois, a primeira localizacao sobre
`FazendaMapaScreen` + `MapaFazendaView` com WebView/Leaflet.

O recurso deve ser:

- foreground only;
- acionado por botao;
- sem watch continuo obrigatorio na primeira versao;
- sem background;
- sem persistencia de coordenadas;
- sem envio remoto;
- sem overlay em PNG;
- limitado a mapas com Talhoes georreferenciados carregados.

Dependencia candidata: `expo-location`, apenas apos aprovacao explicita da
fase de implementacao. Esta analise nao instala dependencia.

## UX Sugerida Para 17G.1

Adicionar em `FazendaMapaScreen` um botao discreto:

- "Mostrar minha posicao" ou "Usar minha localizacao";
- icone de alvo/localizacao;
- visivel apenas quando houver Talhoes exibidos;
- desabilitado ou oculto quando a tela nao tiver contexto de Propriedade ou
  demarcacao.

Fluxo permitido:

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
   - nao mostrar localizacao sobre PNG/material tecnico.

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

## Checklist Futuro Para 17G.1

- Confirmar dependencia de localizacao a usar.
- Confirmar permissao foreground only.
- Confirmar que nao havera persistencia de coordenadas.
- Confirmar que Android fisico sera testado.
- Confirmar criterio para iOS ou registrar iOS como pendente.
- Confirmar que PNG/ZIP continuam materiais, nao camadas georreferenciadas.
- Definir se a leitura sera unica sob demanda ou watch enquanto a tela estiver
  aberta.
- Definir comportamento quando Leaflet cair no fallback SVG.
- Definir mensagens para permissao negada, GPS indisponivel e mapa sem Talhoes.
- Criar testes de helper puro se houver calculo dentro/fora da Propriedade.

## Criterios De Aceite Para Implementacao Futura

- `expo-location` ou dependencia escolhida instalada somente em fase aprovada.
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
- Android fisico executa smoke especifico antes de aprovar campo.

## Conclusao

A 17G.1 deve ser uma evolucao pequena sobre o mapa WebView/Leaflet atual,
mantendo a localizacao como estado efemero de UI em foreground. O mapa nativo
deve permanecer como alternativa futura, porque reativar `MapaFazendaNativoView`
agora ampliaria o risco e mudaria uma base de Talhoes ja validada em emulador.
