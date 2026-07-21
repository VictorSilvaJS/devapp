# Fase 17H.0.1 - Auditoria Consolidada Das Pendencias Funcionais Do MVP

Data da auditoria: 2026-07-21.

## Objetivo E Limites

Esta auditoria registra o estado comprovavel do MVP antes de qualquer
implementacao de persistencia de coordenadas, marcacoes de campo ou fotos
georreferenciadas. Foram revisados codigo, contratos, testes automatizados,
storage local, documentos ativos, historico de smoke e capacidade de gerar o
APK release.

Esta fase nao implementou funcionalidade, nao alterou contratos sensiveis,
`src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, seeds/assets da Sela de
Prata I ou dependencias. Nenhuma chave `@tche:` foi criada, nenhuma coordenada
foi persistida e nenhum fluxo de camera, foto, marcador, backend, sync,
upload/download real, descompactacao de ZIP ou desenho de Talhao foi criado.

## Resultado Executivo

- Material tecnico, Prescricao em ZIP, localizacao foreground e gestao local
  de Talhoes importados possuem implementacao e evidencia de smoke anterior em
  emulador.
- Caderno por Talhao e Safra/Safrinha possuem implementacao e cobertura
  automatizada, mas ainda mantem casos manuais especificos sem fechamento.
- Area/perimetro e parcial: existe area total informada para a Propriedade e
  area mapeada em parte dos dados processados, mas o perimetro nao esta
  comprovado no pipeline da Sela de Prata I e a UI atual pode confundir area
  ausente, area mapeada e area total.
- Marcacoes de fertilizacao/correcao permanecem somente documentadas.
- Processamento remoto, publicacao, sincronizacao e download real dependem de
  backend e infraestrutura que nao existem no produto atual.
- Fotos com data, hora, latitude e longitude nao estao implementadas. As telas
  de Visita ainda possuem botoes simulados, sem camera ou geotag real.
- O APK release foi gerado, mas nao havia emulador nem Android fisico listado
  no ADB para instalacao e nova rodada interativa.

## Fotografia Do Repositorio E Ambiente

| Verificacao | Resultado em 2026-07-21 |
|---|---|
| `git status --short` antes da auditoria | limpo; nenhum arquivo modificado ou nao rastreado |
| `git diff --stat` antes da auditoria | sem diff |
| `git diff --check` antes da auditoria | passou |
| Node.js | `v22.20.0` |
| npm | `10.9.3` |
| Expo CLI por `npx expo --version` | `56.1.15` |
| Expo do projeto | `expo@56.0.11` |
| `adb devices -l` | lista vazia; sem emulador e sem Android fisico |
| APK release | `:app:assembleRelease` passou; arquivo com 91.881.352 bytes e SHA-256 `D7965DCFB61536E42917A3A80F078E846EAF2765DBC1B4D7A14075983AF2D4E5` |
| Instalacao e `monkey` | nao executados porque nao havia dispositivo ADB |

`npx expo install --check` confirmou a divergencia conhecida e, na consulta
feita nesta auditoria, reportou `expo@56.0.11` com esperado `~56.0.16` e
`expo-location@56.0.20` com esperado `~56.0.21`. A referencia `~56.0.15`
registrada na rodada anterior ficou desatualizada em relacao a essa consulta.
Nenhuma versao foi alterada nesta fase.

## Scripts E Cobertura Disponivel

| Script | Objetivo | Modulos cobertos | Modulos nao cobertos |
|---|---|---|---|
| `npm run start` | iniciar o servidor de desenvolvimento Expo | carregamento do app para exploracao manual | nao possui assercoes nem cobre permissao, persistencia ou Android fisico |
| `npm run android` | compilar/abrir o app no Android | integracao Android quando ha dispositivo | nao e teste automatizado; nao havia dispositivo nesta auditoria |
| `npm run ios` | compilar/abrir o app no iOS | integracao iOS quando ha ambiente Apple | nao executado no Windows e sem assercoes |
| `npm run web` | iniciar a variante web | renderizacao web exploratoria | nao valida comportamento nativo, DocumentPicker, filesystem ou localizacao Android |
| `npm run typecheck` | executar `tsc --noEmit` | projeto TypeScript, telas, servicos, tipos e contratos compilados pelo `tsconfig.json` | nao prova runtime, permissao, storage real ou UX |
| `npm run test:domain-compat` | compilar o recorte de dominio e executar testes JS sequenciais | contratos/validators, mock, acesso, Caderno, Visita, Safra/Safrinha, Talhao, GeoJSON, PNG, ZIP, mapas, auth e dashboard | nao cobre renderizacao React, Android fisico, camera real, backend produtivo e o runtime nativo de `LocationForegroundService` |

O `tsconfig.domain-compat.json` compila um recorte intencional do dominio e dos
servicos usados pelos testes. Ele nao substitui o `typecheck` completo nem
smoke das telas e APIs nativas.

## Matriz Consolidada Obrigatoria

| Requisito | Codigo existente | Teste automatizado | Smoke emulador | Android fisico | Status | Pendencia objetiva |
|---|---|---|---|---|---|---|
| 1. Tipos de Material tecnico: Fertilidade, Correcao de solo e Prescricao | `MapasScreen.tsx` limita os tres tipos principais; PNG cobre Fertilidade/Correcao e exclui Prescricao | suites PNG, ZIP, conversao para Mapa e acesso passaram | 17C.1 passou para categorias, consulta e gestao local | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | repetir em aparelho fisico; manter taxonomia final subordinada ao produto |
| 2. Prescricao em ZIP | picker, validacao leve, copia local, metadados, detalhe, substituicao e remocao; nenhum unzip/processamento | suites `prescriptionZip*` passaram | 17C.1 passou inclusive arquivo invalido, substituicao, remocao e Produtor consultivo | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | repetir em aparelho fisico; pipeline produtivo continua externo |
| 3. Localizacao foreground sobre Talhoes | `LocationForegroundService`, botao no mapa, marcador temporario e circulo de precisao; sem persistencia | typecheck passa; nao ha teste automatizado do modulo nativo de localizacao | 17G.2/17G.3 passaram sobre seed/mock e GeoJSON local, incluindo negacao e GPS desligado | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | validar permissao, provider e precisao informada em aparelho fisico |
| 4. Marcacoes futuras de fertilizacao/correcao | nenhum contrato, storage, criacao ou camada de marcadores; apenas proposta 17H.0 | inexistente | nao aplicavel enquanto nao houver implementacao | futuro | SOMENTE_DOCUMENTADO | fechar decisao de contrato, consentimento, permissao e UX antes da 17H.1 |
| 5. Caderno associado ao Talhao e historico por datas | rotas, formulario, detalhe, filtros por Talhao, visibilidade, autoria e ordenacao recente | Caderno, acesso, validators e consulta por Talhao passaram | Produtor pelo Talhao passou; Colaborador pelo Talhao, Admin e force-stop especifico continuam sem fechamento | pendente e nao aprovado | IMPLEMENTADO_SMOKE_INCOMPLETO | executar AUD-04, AUD-05 e persistencia do historico apos force-stop |
| 6. Safra e Safrinha | storage local de metadados, formulario, permissao e vinculo opcional no Caderno | `periodoProdutivoService` e compatibilidade do Caderno passaram | Colaborador e persistencia do periodo passaram; Admin, Produtor com periodo no Caderno e criacao pelo Talhao permanecem incompletos | pendente e nao aprovado | IMPLEMENTADO_SMOKE_INCOMPLETO | executar AUD-05/AUD-06 e criacao pelo contexto do Talhao |
| 7. Gestao de Talhoes importados/processados, sem desenho no celular | importacao/validacao/copia/ativacao/substituicao/remocao de GeoJSON, runtime Polygon/MultiPolygon e fallback seed/mock | suites GeoJSON e consulta por Talhao passaram | DocumentPicker, reabertura, force-stop e mapa local passaram em rodadas 16H/17G | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | repetir fluxo de campo; pipeline produtivo de preparo/publicacao continua externo |
| 8. Area e perimetro dos Talhoes | area pode vir do GeoJSON/asset processado; conversor local calcula area aproximada; UI soma areas; perimetro nao e calculado para a Sela | validator cobre area opcional, mas nao existe teste de calculo/proveniencia de perimetro nem da semantica visual | area da amostra foi exibida; sem evidencia de perimetro processado | pendente e nao aprovado | PARCIAL | separar visualmente area total informada de area mapeada, tratar ausencia sem `0 ha` e definir origem/confiabilidade do perimetro |
| 9. Processamento externo futuro de mapas | servicos locais e stubs/mocks; nenhuma API produtiva, publicacao, sync ou download real | ha compatibilidade de sync mockado e referencias locais, nao integracao produtiva | UI local nao gera mapas; nenhum fluxo remoto produtivo foi validado | nao aplicavel ao backend inexistente | DEPENDE_BACKEND | projetar e implementar ingestao, processamento, storage, publicacao, permissao e download no servidor |
| 10. Fotos com data, hora, latitude e longitude | apenas arrays/URLs demonstrativas e botoes simulados de Visita; sem camera, arquivo fisico, metadado geografico ou consentimento | compatibilidade de Visita preserva arrays existentes, mas nao testa foto real | nenhum smoke de captura/geotag; ausencia confirmada por auditoria | nao testavel | NAO_IMPLEMENTADO | criar fase propria somente apos decisao de escopo, privacidade, storage e Android fisico |

Os bloqueios adicionais `BLOQUEADO_ANDROID_FISICO` se aplicam a todos os
fluxos nativos que precisam de aprovacao de campo, mas nao substituem o status
principal da implementacao. Android fisico continua pendente e nao aprovado.

### Recorte Por Nivel De Prontidao

- Prontas no limite comprovado de emulador: tipos de Material tecnico,
  Prescricao ZIP, localizacao foreground temporaria e gestao local de Talhoes
  importados/processados.
- Implementadas com smoke incompleto: Caderno por Talhao/historico e
  Safra/Safrinha.
- Parcial: area/perimetro dos Talhoes.
- Somente documentada: marcacoes futuras de fertilizacao/correcao.
- Dependente de backend: processamento externo, publicacao, sync e download
  real.
- Inexistente como funcionalidade real: fotos com data, hora, latitude e
  longitude.

## Material Tecnico E ZIP

- Os tipos principais visiveis sao somente Fertilidade, Correcao de solo e
  Prescricao.
- O formulario PNG oferece categorias de Fertilidade/Correcao e rejeita a
  camada Prescricao.
- Prescricao local aceita somente ZIP e grava o arquivo no filesystem interno
  sob `tche-prescription-zips/{propriedade_id}`.
- O indice `@tche:prescription-zip-imports:v1` guarda somente metadados
  pequenos. Conteudo, base64, bytes, blob, buffer e arquivo bruto sao
  recusados pelos servicos/testes.
- Produtor consulta material liberado, mas nao anexa, substitui ou remove.
- Admin e Colaborador autorizado seguem a regra atual de gestao.
- O ZIP nao e aberto, descompactado ou processado. Nao ha `JSZip`, `AdmZip` ou
  equivalente no projeto.
- `Mapa.list` continua como estava no baseline; a tela apenas combina os itens
  locais em memoria para consulta.

## Caderno Por Talhao E Historico

- `fazenda_id`/`fazendaId` e `talhao_id`/`talhaoId`/`talhao_nome`/`talhao`
  sao preservados pelos helpers e rotas atuais.
- `propriedade_id`/`propriedadeId`, quando ja existem no registro, nao sao
  apagados por uma atualizacao parcial do snapshot. O formulario atual nao
  promove esses aliases a novo contrato canonico; `fazenda_id` continua sendo
  o contexto operacional temporario.
- O filtro por Talhao usa primeiro o id e depois o nome normalizado. Registros
  gerais da Propriedade nao entram no historico especifico do Talhao.
- A data e exibida e a ordenacao usa a atividade mais recente primeiro.
- Produtor cria na propria Propriedade, recebe autoria/visibilidade coerentes e
  nao edita/remove pelo fluxo atual.
- Admin e Colaborador autorizado seguem o escopo vigente. Registro interno
  nao e mostrado ao Produtor.
- Faltam evidencias manuais consolidadas para Colaborador criando pelo Talhao,
  Admin consultando/criando pelo Talhao e historico do Caderno apos
  `force-stop`.

## Safra E Safrinha

- A chave e `@tche:periodos-produtivos:v1` e contem somente metadados pequenos.
- Propriedade, cultura e ano agricola sao obrigatorios; Talhao e opcional.
- O tipo aceita Safra/Safrinha e o contrato preserva status e aliases de
  Propriedade/fazenda.
- O Caderno pode guardar um vinculo opcional com o periodo.
- Produtor consulta periodos; Admin e Colaborador no escopo gerenciam.
- Faltam smokes manuais de Admin, Produtor criando Caderno com periodo e
  criacao de periodo iniciada no contexto de Talhao.

## Talhoes, Area E Perimetro

### Gestao Local

- Nao existe desenho nem edicao de limites no celular.
- GeoJSON final e importado/processado previamente, copiado para filesystem
  interno e validado em runtime.
- O indice do AsyncStorage guarda metadados; `FeatureCollection`, `features` e
  `coordinates` brutas ficam fora dele.
- Polygon e MultiPolygon sao suportados.
- O seed/mock permanece fallback quando nao ha GeoJSON local ativo ou quando a
  leitura local falha.

### Origem E Semantica Das Medidas

- `6200 ha` vem de `area_total` informada no cadastro mockado da Propriedade
  Sela de Prata I. Nao e resultado da soma do GeoJSON.
- `1888,6 ha` vem do manifesto dos 15 Talhoes/37 poligonos processados. O
  script local de conversao estima area com aproximacao plana e registra
  `area_hectares`; ele e evidencia de preparo demonstrativo, nao levantamento
  geodesico certificado.
- O validador aceita `area_hectares` ou `area_ha` quando o arquivo ja traz o
  valor. Ele nao calcula area para todo GeoJSON arbitrario.
- O pipeline/manifesto atual da Sela nao comprova `perimetro_km`. A UI pode
  mostrar perimetro de fixtures que ja tragam esse campo, mas isso nao prova
  perimetro processado da amostra real.
- A diferenca entre `6200 ha` e `1888,6 ha` continua sem confirmacao de
  cobertura. A leitura segura e que o primeiro valor e area total informada e
  o segundo e soma mapeada da amostra processada; nao se deve afirmar que a
  amostra cobre toda a Propriedade.

Conclusao de linguagem permitida:

| Expressao | Pode ser usada? | Condicao |
|---|---|---|
| `Area total informada` | sim | para `area_total` cadastral, deixando claro que foi informada |
| `Area mapeada` | sim | somente quando os Talhoes trazem area; para a amostra atual, soma de 1888,6 ha |
| `Perimetro processado` | nao para a Sela | nao existe origem/processamento comprovado no pipeline atual |
| `Nao informado` | sim | quando area ou perimetro nao existe; nao substituir ausencia por zero |

Bug funcional identificado: `FazendaMapaScreen.tsx` reduz areas ausentes para
zero e sempre monta `0 ha total`, alem de chamar a soma dos Talhoes de area
`total`. Reproducao: associar GeoJSON valido Polygon/MultiPolygon sem
`area_hectares`/`area_ha` e abrir o mapa; a tela apresenta zero em vez de
`Nao informado`. Na Sela, a mesma rotulagem pode confundir os 1888,6 ha
mapeados com os 6200 ha informados. O impacto e semantica de medida incorreta,
sem perda de dado. A correcao deve ocorrer em microfase propria, com teste de
UI/helper para ausente, mapeada e total informada.

## Localizacao E Marcacoes

| Componente | Status | Evidencia e limite |
|---|---|---|
| localizacao atual | IMPLEMENTADO_VALIDADO_EMULADOR | `expo-location` foreground, leitura pontual, marcador temporario e circulo de precisao sobre seed/mock e GeoJSON local |
| ponto persistido no Caderno | NAO_IMPLEMENTADO | Caderno nao possui latitude, longitude, accuracy ou instante de captura |
| marcacao de fertilizacao/correcao | SOMENTE_DOCUMENTADO | proposta futura da Fase 17H.0, sem contrato/storage/tela |
| visualizacao de marcacoes persistidas no mapa | SOMENTE_DOCUMENTADO | somente a posicao atual temporaria e desenhada; nao ha camada de ocorrencias |

A capacidade atual e somente a posicao aproximada do aparelho e precisao
informada. O projeto nao pede `ACCESS_BACKGROUND_LOCATION`, nao usa
`TaskManager`, watch continuo, geofencing, tracking, trilha, rota ou historico.
O ponto atual fica em memoria, nao entra no Caderno e nao aparece em PNG/ZIP.

## Processamento Externo

| Parte | Classificacao | Situacao real |
|---|---|---|
| direcao arquitetural | SOMENTE_DOCUMENTADO | o app deve consumir material final normalizado/preparado externamente |
| implementacao local | IMPLEMENTADO_VALIDADO_EMULADOR | importacao e consulta local de GeoJSON/PNG/ZIP, sem gerar mapas no celular |
| servidor produtivo | DEPENDE_BACKEND | inexistem API, fila/processador, storage produtivo, RBAC e publicacao reais |
| download/publicacao/sync real | DEPENDE_BACKEND | existem helpers/stubs/mocks, mas nenhum fluxo produtivo integrado |

`MapaSincronizacaoService` e os endpoints locais de compatibilidade nao devem
ser apresentados como servidor pronto. A implementacao padrao nao publica nem
baixa acervo real; URLs mockadas e assets locais servem somente a demonstracao.

## Fotos Com Coordenadas

| Pergunta | Resposta comprovada |
|---|---|
| existe dependencia de camera? | nao; nao ha `expo-camera` nem `expo-image-picker` |
| existe permissao de camera? | nao |
| existe captura real? | nao |
| existe selecao apenas de arquivo? | nao para foto; os pickers existentes sao de GeoJSON/PNG/ZIP |
| existe armazenamento fisico de foto? | nao |
| existe metadado de foto? | nao existe contrato real; a simulacao de Visita cria apenas URL demonstrativa e `dataCaptura` local |
| existe vinculo com Caderno/Visita? | existem arrays `fotos` e exibicao demonstrativa; nao existe associacao de arquivo real |
| existe data/hora real de captura? | nao; somente instante gerado pela simulacao |
| existe latitude/longitude? | nao |
| existe consentimento? | nao |
| existe teste real? | nao; o teste de Visita apenas preserva arrays fornecidos |
| existe smoke? | nao |

As telas `NovaVisitaScreen.tsx` e `EditarVisitaScreen.tsx` exibem acoes
`Camera` e `Galeria` que chamam `adicionarFotoSimulada` e geram URLs
`picsum.photos`. Mesmo com indicacao visual de simulacao, isso pode ser
interpretado como captura funcional no APK de campo e depender de rede para a
imagem. Deve ser corrigido em microfase propria antes de um APK de campo, sem
tratar o placeholder como fluxo real.

## Chaves De Storage Conhecidas

| Chave | Responsabilidade | Conteudo bruto? |
|---|---|---|
| `@tche:user` | sessao local sanitizada | nao guarda senha/hash/token |
| `@tche:local-credentials:v1` | credenciais locais com hash/salt e metadados controlados | nao guarda senha em texto puro |
| `@tche:mock-mvp:v1` | snapshot estruturado do MVP mockado: usuarios, Propriedades, Visitas, Caderno e metadados compativeis | pode preservar URLs demonstrativas existentes; nao e storage de arquivo fisico |
| `@tche:geojson-imports:v1` | indice de metadados dos GeoJSONs locais | nao; arquivo fica no filesystem e features/coordinates ficam fora do indice |
| `@tche:png-map-imports:v1` | indice de metadados dos PNGs locais | nao; imagem fica no filesystem |
| `@tche:prescription-zip-imports:v1` | indice de metadados dos ZIPs locais | nao; ZIP fica no filesystem |
| `@tche:periodos-produtivos:v1` | metadados locais de Safra/Safrinha | nao |
| localizacao atual | nenhuma chave | posicao somente em memoria |
| fotos reais | nenhuma chave nova | funcionalidade inexistente |

## Checklist Consolidado AUD-01 A AUD-12

Esta rodada nao teve novo smoke interativo porque `adb devices -l` ficou sem
dispositivos. `Passou` abaixo consolida evidencia anterior de emulador ou
auditoria estatica; `Reexecutar` nao deve ser promovido por inferencia.

| ID | Cenario | Status | Evidencia/pendencia |
|---|---|---|---|
| AUD-01 | Tipos Fertilidade/Correcao/Prescricao | Passou | codigo, testes e smoke 17C.1 |
| AUD-02 | ZIP Prescricao: anexar, detalhe, substituir, remover e invalido | Passou | suites ZIP e smoke 17C.1 |
| AUD-03 | Produtor cria Caderno pelo Talhao e ve historico | Passou | 17F.2; regras e filtro cobertos por teste |
| AUD-04 | Colaborador cria Caderno pelo Talhao | Reexecutar | codigo/permissao cobertos; caso manual especifico nao fechado |
| AUD-05 | Admin abre Talhao, Caderno e Safra/Safrinha | Reexecutar | permissao automatizada; roteiro manual consolidado nao fechado |
| AUD-06 | Produtor cria Caderno com Safra/Safrinha opcional | Reexecutar | contrato opcional coberto; caso manual do Produtor nao fechado |
| AUD-07 | GeoJSON local, area mapeada e selecao de Talhao | Passou | 16H.6/17G.3; ressalva de semantica da area registrada como bug P1 |
| AUD-08 | Localizacao foreground, permissao negada e GPS desligado | Passou | 17G.2/17G.3 em emulador |
| AUD-09 | PNG e ZIP nao recebem localizacao | Passou | auditoria de contratos/storage e 17G.3 |
| AUD-10 | Processamento/download remoto nao e apresentado como pronto | Passou | fluxos visiveis permanecem locais; stubs/mocks nao estao integrados como servidor produtivo |
| AUD-11 | Ausencia de fluxo de foto georreferenciada | Passou | dependencia, permissao, contrato, storage, testes e telas auditados; botoes simulados registrados como P1 |
| AUD-12 | Android fisico permanece pendente | Reexecutar | sem dispositivo ADB; nao aprovado |

## Problemas E Microfases Recomendadas

### P0 - Bloqueia A Proxima Implementacao

#### P0-01 - Contrato E Consentimento De Marcacao Ainda Nao Decididos

- Descricao: falta fechar se a coordenada opcional ficara no Caderno, quais
  campos serao aceitos, quem pode registrar/ver/remover e qual texto de
  consentimento sera usado.
- Evidencia: `docs/project/fase-17h-marcacoes-campo.md` e pendencia 4B.
- Arquivo provavel: tipos/helpers/formularios do Caderno, somente depois da
  decisao.
- Teste que detectou: auditoria documental; nao ha teste de implementacao.
- Microfase recomendada: `17H.0.2 - Decisao final do contrato de ponto`.
- Tipo: decisao de produto/privacidade; nao exige codigo nesta etapa.

#### P0-02 - Baseline Manual De Caderno/Safra Ainda Tem Lacunas

- Descricao: AUD-04, AUD-05, AUD-06 e o historico do Caderno apos force-stop
  nao estao fechados; adicionar coordenadas antes disso mistura regressao nova
  com evidencia antiga incompleta.
- Evidencia: roteiros 17D/17E/17F em `smoke.md`.
- Arquivo provavel: nenhum por padrao; corrigir codigo apenas se o smoke
  reproduzir falha.
- Teste que detectou: comparacao entre checklist ativo e evidencias de smoke.
- Microfase recomendada: `17H.0.3 - Fechamento do baseline em emulador`.
- Tipo: smoke em emulador; Android fisico continua como bloqueio adicional.

#### P0-03 - Criterio Para Abrir 17H.1 Com Android Fisico Pendente

- Descricao: a documentacao exige validar aparelho autorizado ou aceitar
  explicitamente a pendencia antes de implementar persistencia de ponto.
- Evidencia: Fase 17H.0 e `adb devices -l` vazio nesta auditoria.
- Arquivo provavel: documentos de decisao/pendencia, nao codigo.
- Teste que detectou: verificacao ADB.
- Microfase recomendada: `17H.0.4 - Gate de Android fisico`.
- Tipo: decisao e Android fisico.

### P1 - Corrigir Antes Do APK De Campo

#### P1-01 - Area Ausente Exibida Como Zero E Area Mapeada Rotulada Como Total

- Descricao: o mapa soma valores opcionais com fallback zero e sempre mostra
  `ha total`.
- Reproducao: importar GeoJSON valido sem area e abrir o mapa; observar
  `0 ha total`. Na Sela, comparar o rotulo com 6200 ha informados e 1888,6 ha
  mapeados.
- Impacto: informacao agronomica/cadastral ambigua, sem perda de dado.
- Evidencia/arquivo provavel: `src/screens/FazendaMapaScreen.tsx`.
- Teste que detectou: auditoria de codigo e manifesto; falta teste de helper/UI.
- Microfase recomendada: `17H.0.5 - Semantica de area e perimetro`.
- Tipo: codigo, linguagem de produto e testes.

#### P1-02 - Camera/Galeria Simuladas Podem Parecer Funcionais

- Descricao: botoes de Visita geram URLs `picsum.photos` e instante simulado,
  sem camera, arquivo local ou geotag.
- Reproducao: abrir Nova/Editar Visita e tocar em Camera ou Galeria.
- Impacto: falsa expectativa no APK de campo e dependencia de URL externa.
- Evidencia/arquivo provavel: `NovaVisitaScreen.tsx` e
  `EditarVisitaScreen.tsx`.
- Teste que detectou: auditoria textual; nao existe teste de foto real.
- Microfase recomendada: `17H.0.6 - Segregacao dos placeholders de foto`.
- Tipo: decisao e codigo; nao implica implementar camera.

#### P1-03 - Android Fisico Ainda Nao Validado

- Descricao: DocumentPicker, filesystem, GPS, permissao, teclado, force-stop e
  persistencia ainda nao tem aprovacao no aparelho de campo.
- Evidencia: ADB sem dispositivo e AUD-12 `Reexecutar`.
- Arquivo provavel: nenhum por padrao.
- Teste que detectou: verificacao ADB e checklist de smoke.
- Microfase recomendada: `17H.PHY - Smoke Android fisico consolidado`.
- Tipo: Android fisico autorizado.

#### P1-04 - Divergencia De Pacotes Expo

- Descricao: a checagem atual espera `expo ~56.0.16` e `expo-location
  ~56.0.21`, enquanto o projeto usa 56.0.11/56.0.20.
- Evidencia: `npx expo install --check` falhou por dependencias desatualizadas.
- Arquivo provavel: `package.json`/lockfile, somente em fase propria.
- Teste que detectou: checagem oficial Expo.
- Microfase recomendada: fase tecnica isolada de alinhamento SDK 56.
- Tipo: dependencia; proibido corrigir nesta auditoria.

### P2 - Evolucao Futura Ou Backend

#### P2-01 - Pipeline Produtivo De Mapas Inexistente

- Descricao: faltam ingestao, processamento, revisao, storage, publicacao,
  RBAC, historico e download/sync reais.
- Evidencia: stubs/TODOs de sincronizacao e fluxo atual somente local/mockado.
- Arquivo provavel: futuro backend e contratos de API.
- Teste que detectou: auditoria arquitetural; nao existe teste de integracao.
- Microfase recomendada: trilha de backend para acervo tecnico.
- Tipo: backend/infraestrutura/decisao.

#### P2-02 - Perimetro E Cobertura Das Areas Sem Fonte Fechada

- Descricao: nao ha perimetro processado para a Sela nem confirmacao de que
  1888,6 ha mapeados representam subconjunto dos 6200 ha informados.
- Evidencia: manifesto/conversor local e cadastro mockado.
- Arquivo provavel: pipeline externo, manifesto e contrato futuro de medidas.
- Teste que detectou: auditoria de dados; nao ha teste de proveniencia.
- Microfase recomendada: definicao de metrologia/proveniencia do pipeline.
- Tipo: decisao de dados e processamento externo.

#### P2-03 - Fotos Reais E Georreferenciadas Inexistentes

- Descricao: falta decidir origem da foto, permissao, storage, privacidade,
  consentimento, data/hora, latitude/longitude, accuracy, associacao e
  sincronizacao.
- Evidencia: ausencia de dependencias/permissoes/contratos; UI simulada.
- Arquivo provavel: fase futura de foto, tipos e storage/backend.
- Teste que detectou: auditoria textual; nao existe teste/smoke real.
- Microfase recomendada: somente apos estabilizar 17H.1 e Android fisico.
- Tipo: produto, privacidade, codigo nativo, storage e possivel backend.

#### P2-04 - Cobertura Automatizada Do Runtime De Localizacao

- Descricao: a regra pura do resultado e o comportamento nativo dependem hoje
  de smoke; o modulo nao possui teste focado com adapter mockado.
- Evidencia: inventario de `tests/` e `tsconfig.domain-compat.json`.
- Arquivo provavel: teste futuro de `LocationForegroundService` sem ampliar
  permissao ou persistencia.
- Teste que detectou: inventario de cobertura.
- Microfase recomendada: endurecimento tecnico de localizacao foreground.
- Tipo: teste automatizado.

## Ordem Recomendada Das Proximas Fases

1. Fechar P0-01 e P0-03: contrato/consentimento e gate de Android fisico.
2. Executar P0-02 em emulador: AUD-04, AUD-05, AUD-06 e force-stop do
   historico do Caderno.
3. Corrigir em microfases isoladas P1-01 e P1-02, com testes, antes de chamar
   o APK de apto a campo.
4. Alinhar Expo/`expo-location` em fase tecnica separada e revalidar o APK.
5. Somente entao abrir 17H.1 para coordenada opcional no Caderno por acao
   explicita, sem background, tracking ou nova chave dedicada no primeiro
   corte.
6. Abrir visualizacao de marcacoes no mapa apenas depois de persistencia,
   permissao e cancelamento estarem provados.
7. Executar smoke completo em Android fisico autorizado antes de aprovacao de
   campo.
8. Tratar fotos reais/georreferenciadas em fase propria posterior.
9. Manter processamento/publicacao/download reais na trilha de backend.

## Validacoes Executadas

- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou integralmente.
- Testes focados de Caderno, acesso, validators, periodo produtivo, Talhao,
  GeoJSON, PNG e ZIP: passaram.
- `npx expo install --check`: executou e reportou somente as divergencias de
  versao descritas; nenhuma dependencia foi alterada.
- `git diff --check` antes da documentacao: passou.
- `android/.\gradlew.bat :app:assembleRelease`: `BUILD SUCCESSFUL`.
- `adb install -r` e `adb shell monkey`: nao executados por ausencia de
  dispositivo listado.

`docs/project/decisoes-consolidadas.md` nao foi alterado porque esta auditoria
nao fechou decisao nova; ela confirmou implementacoes, lacunas e decisoes ainda
pendentes.
