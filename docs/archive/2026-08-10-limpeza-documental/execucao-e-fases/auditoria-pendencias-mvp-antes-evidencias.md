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
- Caderno por Talhao e Safra/Safrinha possuem implementacao, cobertura
  automatizada e fechamento manual em emulador na Fase 17H.0.3; Android fisico
  continua pendente e nao aprovado.
- Area/perimetro permanece parcial: a 17H.0.5 corrigiu e validou em emulador a
  semantica de area total informada, area mapeada, parcial e ausente; o
  perimetro continua sem origem comprovada no pipeline da Sela de Prata I.
- Marcacoes de fertilizacao/correcao permanecem somente documentadas.
- Processamento remoto, publicacao, sincronizacao e download real dependem de
  backend e infraestrutura que nao existem no produto atual.
- Fotos com data, hora, latitude e longitude nao estao implementadas. A 17H.0.6
  removeu os botoes simulados de Nova/Editar Visita e preservou somente a
  leitura identificada das imagens demonstrativas existentes.
- Na auditoria 17H.0.1 nao havia dispositivo ADB; a 17H.0.3 iniciou um AVD
  existente, instalou o APK por cima e concluiu a rodada interativa. Android
  fisico continuou ausente e nao aprovado.

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

Atualizacao 17H.0.3: o AVD `Teste_Tche` apareceu como `emulator-5554`, Pixel
Tablet, Android 15/API 35, com cerca de 10 GiB livres em `/data`. O pacote
release ja estava instalado e havia sessao/estado local anterior. A build
release, `adb install -r` e `monkey` passaram sem limpar ou desinstalar o app.

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
| 5. Caderno associado ao Talhao e historico por datas | rotas, formulario, detalhe, filtros por Talhao, visibilidade, autoria e ordenacao recente | Caderno, acesso, validators e consulta por Talhao passaram | 17H.0.3 passou para Colaborador, Admin e Produtor no `T01 - 230`; historico e vinculos persistiram apos `force-stop` | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | repetir em Android fisico autorizado |
| 6. Safra e Safrinha | storage local de metadados, formulario, permissao e vinculo opcional no Caderno | `periodoProdutivoService` e compatibilidade do Caderno passaram | 17H.0.3 passou para criacao/edicao Admin pelo Talhao e vinculo opcional no Caderno do Produtor, inclusive apos `force-stop` | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | repetir em Android fisico autorizado |
| 7. Gestao de Talhoes importados/processados, sem desenho no celular | importacao/validacao/copia/ativacao/substituicao/remocao de GeoJSON, runtime Polygon/MultiPolygon e fallback seed/mock | suites GeoJSON e consulta por Talhao passaram | DocumentPicker, reabertura, force-stop e mapa local passaram em rodadas 16H/17G | pendente e nao aprovado | IMPLEMENTADO_VALIDADO_EMULADOR | repetir fluxo de campo; pipeline produtivo de preparo/publicacao continua externo |
| 8. Area e perimetro dos Talhoes | helper puro normaliza somente medidas positivas; UI separa area total informada, mapeada, parcial/ausente e exige proveniencia para perimetro | 23 cenarios de `talhaoMedidasCompat`, validator e camada GeoJSON passaram | 17H.0.5 exibiu 6200 ha cadastrais, 1888,6 ha mapeados e 274,1 ha no T01 sem inventar perimetro | pendente e nao aprovado | PARCIAL | area: `IMPLEMENTADO_VALIDADO_EMULADOR`; perimetro: `NAO_DISPONIVEL_NO_PIPELINE_ATUAL`, dependente de processamento externo/backend |
| 9. Processamento externo futuro de mapas | servicos locais e stubs/mocks; nenhuma API produtiva, publicacao, sync ou download real | ha compatibilidade de sync mockado e referencias locais, nao integracao produtiva | UI local nao gera mapas; nenhum fluxo remoto produtivo foi validado | nao aplicavel ao backend inexistente | DEPENDE_BACKEND | projetar e implementar ingestao, processamento, storage, publicacao, permissao e download no servidor |
| 10. Fotos com data, hora, latitude e longitude | somente arrays/URLs demonstrativas legadas; botoes simulados removidos de Nova/Editar Visita; sem camera, arquivo fisico, metadado geografico ou consentimento | 16 cenarios de Visita cobrem criacao vazia, preservacao, remocao explicita e ausencia de gerador/geotag/storage | 17H.0.6 criou/editou sem foto e preservou duas imagens demonstrativas existentes, sem acao de captura | nao testavel como foto real | NAO_IMPLEMENTADO | segregacao da UI esta `IMPLEMENTADO_VALIDADO_EMULADOR`; foto real/georreferenciada exige fase propria de produto, privacidade, storage e Android fisico |

Os bloqueios adicionais `BLOQUEADO_ANDROID_FISICO` se aplicam a todos os
fluxos nativos que precisam de aprovacao de campo, mas nao substituem o status
principal da implementacao. Android fisico continua pendente e nao aprovado.

### Recorte Por Nivel De Prontidao

- Prontas no limite comprovado de emulador: tipos de Material tecnico,
  Prescricao ZIP, localizacao foreground temporaria e gestao local de Talhoes
  importados/processados.
- Implementadas com smoke incompleto: Caderno por Talhao/historico e
  Safra/Safrinha.
- Parcial: area/perimetro dos Talhoes; a area esta validada em emulador e o
  perimetro nao esta disponivel no pipeline atual.
- Somente documentada: marcacoes futuras de fertilizacao/correcao.
- Dependente de backend: processamento externo, publicacao, sync e download
  real.
- Segregacao concluida em emulador: placeholders ativos de foto em Visita,
  preservando leitura dos registros demonstrativos.
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

Atualizacao em 2026-07-21 (Fase 17H.0.3): o AVD `Teste_Tche`, Pixel Tablet,
Android 15/API 35, permitiu fechar AUD-04, AUD-05, AUD-06 e o historico apos
`force-stop`. `Reexecutar` continua aplicado ao Android fisico, que nao foi
testado nem aprovado.

| ID | Cenario | Status | Evidencia/pendencia |
|---|---|---|---|
| AUD-01 | Tipos Fertilidade/Correcao/Prescricao | Passou | codigo, testes e smoke 17C.1 |
| AUD-02 | ZIP Prescricao: anexar, detalhe, substituir, remover e invalido | Passou | suites ZIP e smoke 17C.1 |
| AUD-03 | Produtor cria Caderno pelo Talhao e ve historico | Passou | 17F.2; regras e filtro cobertos por teste |
| AUD-04 | Colaborador cria Caderno pelo Talhao | Passou | `T01 - 230`; `AUD04-COLAB-T01-20260721-EDITADO` preservou Propriedade/Talhao, detalhe, historico e edicao sem duplicar |
| AUD-05 | Admin abre Talhao, Caderno e Safra/Safrinha | Passou | Caderno `AUD05-ADMIN-T01-20260721`; Safra `AUD05-ADMIN-PERIODO-20260721`, `2026/2027`, `T01 - 230`, editada para Em andamento |
| AUD-06 | Produtor cria Caderno com Safra/Safrinha opcional | Passou | `AUD06-PRODUTOR-SAFRA-20260721` vinculou explicitamente a Safra do AUD-05; autoria/visibilidade preservadas e gestao de periodo ausente |
| AUD-07 | GeoJSON local, area mapeada e selecao de Talhao | Passou | 16H.6/17G.3 e 17H.0.5; 15 Talhoes, 1888,6 ha mapeados, selecao do T01 e suites GeoJSON sem regressao |
| AUD-08 | Localizacao foreground, permissao negada e GPS desligado | Passou | 17G.2/17G.3 em emulador |
| AUD-09 | PNG e ZIP nao recebem localizacao | Passou | auditoria de contratos/storage e 17G.3 |
| AUD-10 | Processamento/download remoto nao e apresentado como pronto | Passou | fluxos visiveis permanecem locais; stubs/mocks nao estao integrados como servidor produtivo |
| AUD-11 | Ausencia de fluxo de foto georreferenciada | Passou | dependencia, permissao, contrato, storage, testes e telas auditados; botoes simulados registrados como P1 |
| AUD-12 | Android fisico permanece pendente | Reexecutar | sem dispositivo ADB; nao aprovado |

## Problemas E Microfases Recomendadas

### P0 - Bloqueia A Proxima Implementacao

Atualizacao em 2026-07-21 (Fase 17H.0.3): P0-01 e P0-03 foram encerrados como
decisoes funcionais, e P0-02 foi encerrado por smoke em emulador.
Desenvolvimento e smoke tecnico em emulador estao autorizados; campo continua
bloqueado ate Android fisico. Os itens permanecem abaixo apenas para preservar
a rastreabilidade da auditoria 17H.0.1.

#### P0-01 - Encerrado: Direcao De Contrato E Consentimento Da Marcacao

- Status 17H.0.2: encerrado como decisao. O ponto ficara como metadado
  opcional do Caderno, sem chave dedicada, com acao explicita e persistencia
  somente no submit. Permissoes reutilizam as regras atuais do Caderno.
- Trabalho remanescente: shape final dos campos, texto visual de consentimento,
  implementacao e testes continuam pendentes.
- Evidencia: `docs/project/fase-17h-marcacoes-campo.md` e pendencia 4B.
- Arquivo provavel: tipos/helpers/formularios do Caderno, somente depois da
  decisao.
- Teste que detectou: auditoria documental; nao ha teste de implementacao.
- Microfase recomendada: `17H.0.2 - Decisao final do contrato de ponto`.
- Tipo: decisao de produto/privacidade; nao exige codigo nesta etapa.

#### P0-02 - Encerrado: Baseline Manual De Caderno/Safra

- Status 17H.0.3: encerrado em emulador. AUD-04, AUD-05, AUD-06 e o historico
  do Caderno apos `force-stop` passaram no `T01 - 230`, sem perda de
  Propriedade, Talhao, periodo, autoria, visibilidade ou ordenacao.
- Evidencia: rodada 17H.0.3 em `smoke.md`, com os identificadores AUD-04/05/06
  e o periodo do Admin.
- Correcao/teste novo: nenhum; nao houve bug funcional reproduzido.
- Tipo: smoke em emulador concluido; Android fisico continua como bloqueio
  adicional para campo.

#### P0-03 - Encerrado: Gate Para Emulador E Android Fisico

- Status 17H.0.2: encerrado como decisao. Desenvolvimento e smoke tecnico
  podem continuar em emulador; aprovacao para campo permanece bloqueada ate
  Android fisico autorizado.
- Evidencia: Fase 17H.0 e `adb devices -l` vazio nesta auditoria.
- Arquivo provavel: documentos de decisao/pendencia, nao codigo.
- Teste que detectou: verificacao ADB.
- Microfase recomendada: `17H.0.4 - Gate de Android fisico`.
- Tipo: decisao e Android fisico.

### P1 - Corrigir Antes Do APK De Campo

#### P1-01 - Encerrado: Semantica Segura De Area

- Status 17H.0.5: encerrado em emulador. Ausencia nao vira zero, a soma dos
  Talhoes e `Area mapeada`/`Area mapeada parcial`, e `area_total` permanece
  `Area total informada`.
- Evidencia: helper puro, 23 cenarios automatizados, suite de dominio e smoke
  visual da Sela com 6200 ha, 1888,6 ha e `T01 - 230` com 274,1 ha.
- Limite: a obtencao produtiva de perimetro permanece em P2/backend e Android
  fisico continua pendente.
- Tipo: codigo, linguagem de produto e testes concluidos em emulador.

#### P1-02 - Encerrado: Camera/Galeria Simuladas

- Status 17H.0.6: encerrado em emulador. Nova/Editar Visita nao exibem acoes
  Camera/Galeria e nao geram URL ou instante simulado.
- Evidencia: helper/testes de compatibilidade, auditoria textual e smoke de
  criacao sem foto, edicao e preservacao de duas imagens legadas.
- Limite: `picsum.photos` permanece somente no seed demonstrativo e nas
  fixtures de compatibilidade; foto real/georreferenciada continua P2 e
  `NAO_IMPLEMENTADO`.
- Tipo: codigo, linguagem de produto e testes concluidos em emulador.

#### P1-03 - Android Fisico Ainda Nao Validado

- Descricao: DocumentPicker, filesystem, GPS, permissao, teclado, force-stop e
  persistencia ainda nao tem aprovacao no aparelho de campo.
- Evidencia: ADB sem dispositivo e AUD-12 `Reexecutar`.
- Arquivo provavel: nenhum por padrao.
- Teste que detectou: verificacao ADB e checklist de smoke.
- Microfase recomendada: `17H.PHY - Smoke Android fisico consolidado`.
- Tipo: Android fisico autorizado.

#### P1-04 - Encerrado: Divergencia De Pacotes Expo

- Status 17H.0.7: encerrado em emulador e mantido no SDK 56.
- Mudanca: `expo` 56.0.11 -> 56.0.16 e `expo-location` 56.0.20 ->
  56.0.21; nenhuma outra dependencia direta mudou.
- Evidencia: os dois comandos de `expo install --check` retornaram
  `Dependencies are up to date`; typecheck, suites, build, instalacao e smoke
  passaram.
- Limite: avisos preexistentes de schema `splash` e `expo-font` ficaram fora
  do escopo e Android fisico continua pendente.
- Tipo: dependencia concluida em fase tecnica isolada.

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
- Evidencia: ausencia de dependencias/permissoes/contratos; a UI simulada foi
  segregada na 17H.0.6 sem implementar captura real.
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

Atualizacao 17H.0.7: P0-01, P0-02, P0-03, P1-01, P1-02 e P1-04 estao
encerrados no escopo documental/emulador. A ordem atual passa a ser:

1. Especificar na 17H.1 o shape opcional e o texto visual de consentimento,
   respeitando as decisoes 15 a 17.
2. Implementar a 17H.1 para coordenada opcional no Caderno por acao explicita,
   sem background, tracking ou nova chave dedicada no primeiro corte.
3. Abrir visualizacao de marcacoes no mapa apenas depois de persistencia,
   permissao e cancelamento estarem provados.
4. Executar smoke completo em Android fisico autorizado antes de aprovacao de
   campo.
5. Tratar fotos reais/georreferenciadas em fase propria posterior.
6. Manter processamento/publicacao/download reais na trilha de backend.

## Validacoes Executadas

- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou integralmente.
- Testes focados de Caderno, acesso, validators, periodo produtivo, Talhao,
  GeoJSON, PNG e ZIP: passaram.
- `npx expo install --check`: executou e reportou somente as divergencias de
  versao descritas; nenhuma dependencia foi alterada.
- `git diff --check` antes da documentacao: passou.
- `android/.\gradlew.bat :app:assembleRelease`: `BUILD SUCCESSFUL`.
- `adb install -r` e `adb shell monkey`: passaram na atualizacao 17H.0.3 no
  AVD `Teste_Tche`; na fotografia original 17H.0.1 nao havia dispositivo.

Atualizacao 17H.0.5:

- `npm run typecheck`, `npm run test:domain-compat`, os 23 cenarios de medidas,
  consulta por Talhao e testes focados de validator/camada GeoJSON passaram;
- `:app:assembleRelease`, instalacao `-r` e `monkey` passaram no Pixel
  Tablet/API 35, sem limpar ou desinstalar o app;
- o smoke visual confirmou as medidas separadas, selecao de Talhao,
  localizacao disponivel, categorias de Material tecnico e Caderno/Safra;
- Android fisico permaneceu pendente e nao aprovado.

Atualizacao 17H.0.6:

- `npm run typecheck`, `npm run test:domain-compat`, `validatorsCompat`,
  `mockCompat` e os 16 cenarios de `visitaFormCompat` passaram;
- auditoria textual confirmou ausencia de gerador ativo, acoes Camera/Galeria,
  biblioteca de camera/seletor, geotag e storage novo nos formularios;
- `:app:assembleRelease`, instalacao `-r` e `monkey` passaram no Pixel
  Tablet/API 35, sem limpar ou desinstalar o app;
- o smoke criou e editou Visita sem foto, preservou duas imagens legadas com
  identificacao demonstrativa e reabriu Caderno/Safra, Talhoes e Material
  tecnico;
- Android fisico permaneceu pendente e nao aprovado.

Atualizacao 17H.0.7:

- `expo`/`expo-location` foram alinhados para 56.0.16/56.0.21, ainda no SDK
  56, e somente esses dois pacotes mudaram entre dependencias diretas;
- os checks finais retornaram `Dependencies are up to date`; Expo Doctor
  melhorou de 17/21 para 18/21 e manteve tres avisos preexistentes fora do
  escopo;
- `npm run typecheck` e `npm run test:domain-compat` passaram antes e depois;
- apos uma falha de `Metaspace`, o build com um worker e sem paralelismo
  passou; instalacao `-r` e `monkey` passaram no Pixel Tablet/API 35;
- `dumpsys` confirmou foreground location sem background, camera ou galeria;
- areas, Talhoes, PNG, Caderno/Safra e Visitas passaram no smoke. O provider
  do AVD exerceu a mensagem controlada de posicao indisponivel; GeoJSON/ZIP
  nao estavam ativos no snapshot e suas suites focadas passaram;
- nenhuma coordenada ou chave foi criada e Android fisico permaneceu pendente
  e nao aprovado.

Atualizacao em 2026-07-21: a Fase 17H.0.2 alterou
`docs/project/decisoes-consolidadas.md` para fechar as decisoes 15 a 21. A
auditoria 17H.0.1 permanece como fotografia das evidencias; as decisoes nao
mudam os status de implementacao nem promovem Android fisico.
