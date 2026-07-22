# Fase 17H.1.1 - Smoke De Seguranca, Cancelamento E Regressao Do Ponto Opcional No Caderno

Status em 2026-07-22: `APROVADA_EM_EMULADOR`.

A rodada confirmou em emulador que a localizacao opcional somente persiste
depois de acao explicita e submit do Caderno. Cancelamento, remocao antes do
primeiro submit, `replace` cancelado e `remove` cancelado nao alteraram o
registro persistido. Permissao negada, GPS desligado e timeout do provider
foram recuperaveis e nao impediram salvar um Caderno comum sem ponto.

O fechamento complementar da Fase 17H.1.2 reexecutou a lacuna visual com um
ZIP temporario valido, criado fora do repositorio e selecionado pelo
DocumentPicker real. Importacao, detalhe, `force-stop`, reabertura, consulta do
Produtor e regressao de Caderno/mapa/PNG/ZIP passaram. Assim, os 29/29 casos
executaveis no emulador estao aprovados. O gate fisico foi iniciado depois, na
Fase 17H.1.3, mas terminou `PARCIAL_ANDROID_FISICO`; por isso `17H111-30`
permanece `Reexecutar` e a aptidao para campo nao foi aprovada.

Nenhuma funcionalidade nova, patch de codigo ou teste foi criado nesta fase.
O objetivo foi exclusivamente exercitar seguranca, cancelamento, persistencia,
perfis e regressao das superficies que nao podem receber o ponto do Caderno.

## Ambiente E Estado Inicial

- Git inicialmente limpo; `git diff --check` sem erro.
- Dispositivo: `emulator-5554`, Pixel Tablet, Android 15/API 35.
- Espaco livre em `/data`: aproximadamente 10 GB.
- Pacote: `com.tcheagro.mobile`, instalado por cima e com estado local anterior
  preservado.
- Permissoes: `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION` foreground;
  nenhuma `ACCESS_BACKGROUND_LOCATION`.
- Dependencias: `expo@56.0.16` e `expo-location@56.0.21`.
- `npx expo install --check`: `Dependencies are up to date`.
- Nao foram usados `pm clear`, `adb uninstall`, `Wipe Data`, limpeza de
  snapshot ou restauracao do seed.

## Validacoes Automatizadas

Passaram:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests\cadernoLocalizacaoCompat.test.js`;
- `node tests\cadernoLocalizacaoUiCompat.test.js`;
- `node tests\cadernoFormCompat.test.js`;
- `node tests\acessoControleCompat.test.js`;
- `node tests\validatorsCompat.test.js`;
- `node tests\periodoProdutivoService.test.js`;
- `node tests\talhaoConsultaCompat.test.js`;
- `node tests\talhaoMedidasCompat.test.js`;
- suites focadas `tests\geojson*.test.js`;
- suites focadas `tests\png*.test.js`;
- suites focadas `tests\prescriptionZip*.test.js`;
- suite focada `tests\visitaFormCompat.test.js`;
- `npx expo install --check`;
- `git diff --check`.

As suites de ZIP comprovam contrato, picker, importacao, storage, associacao e
compatibilidade sem processar ou descompactar o pacote. Na Fase 17H.1.2, essa
cobertura foi complementada pela reabertura visual real com fixture temporaria
valida.

## Build E Instalacao

Passaram:

- `.\gradlew.bat :app:assembleRelease`;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- `adb shell monkey -p com.tcheagro.mobile -c android.intent.category.LAUNCHER 1`.

APK gerado em 2026-07-21 14:29:03, horario local:

- caminho: `android/app/build/outputs/apk/release/app-release.apk`;
- tamanho: 91.922.508 bytes;
- SHA-256:
  `3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B`.

## Fechamento Visual Do ZIP Na Fase 17H.1.2

Em 2026-07-22, a unica lacuna executavel no emulador foi fechada no mesmo
`emulator-5554`, preservando o estado local:

- a fixture `prescricao_smoke_17h112.zip` foi criada com `Compress-Archive` em
  `%LOCALAPPDATA%\Temp\tche-17h112-zip`, fora do repositorio;
- o ZIP tinha 286 bytes, assinatura `PK`, uma unica entrada textual ficticia e
  SHA-256
  `DFD247D617505FC34AE6D621FF98743B21B3C779B95919E9992122BCBBD3E27D`;
- o arquivo foi enviado para `Download`, selecionado pelo DocumentPicker real
  e importado como `prescricao smoke 17h112`, camada `Prescrição`, ano `2026`,
  escopo `Propriedade inteira` e visivel ao Produtor;
- a listagem e o detalhe mostraram nome original, 286 B e formato ZIP, com o
  aviso de que abertura ou processamento nao fazem parte do MVP, sem preview,
  descompactacao, coordenada ou acao de Caderno;
- depois de `force-stop`, sessao, item, metadados e associacao local
  reapareceram;
- o Produtor consultou o mesmo item e detalhe, sem `Anexar prescrição ZIP`,
  `Substituir ZIP` ou `Remover prescrição local`;
- o registro liberado do Caderno manteve selo `Com ponto geográfico` e secao
  `Ponto registrado em campo`, enquanto mapa de 15 Talhoes, PNG local e ZIP
  permaneceram sem ponto persistido do Caderno;
- a auditoria confirmou chaves separadas, ausencia de `localizacao_*` no fluxo
  ZIP/mapa e ausencia de leitura binaria, preview ou descompactacao do pacote;
- a fixture externa foi removida do `Download` e do diretorio temporario ao
  final; nenhum ZIP foi adicionado ao repositorio.

Nao houve rebuild nem reinstalacao nesta complementacao. O `base.apk`
instalado foi comparado ao release atual e tinha os mesmos 91.922.508 bytes e
o mesmo SHA-256 documentado acima, portanto o APK existente foi reutilizado.
`npm run typecheck`, `npm run test:domain-compat`, suites focadas de ZIP/PNG/
GeoJSON/Caderno, `npx expo install --check` e `git diff --check` passaram.

## Registros E Evidencias

- `17H111-SEM-PONTO-20260721`: criado pelo Produtor sem ponto.
- `17H111-COM-PONTO-20260721`: criado inicialmente com `-9,87`, `-56,09`,
  precisao de 15 m, horario 01:25 e autoria do Produtor. Foi o alvo controlado
  de `preserve`, `replace` e `remove`; ao final ficou sem ponto e com observacao
  `17H111-COM-PONTO-20260721-PRESERVE-UNDO`.
- `17H111-CANCELADO-20260721`: digitado em formulario cancelado; nenhum
  registro/id foi criado.
- `17H111-REMOVIDO-ANTES-SALVAR-20260721`: salvo sem ponto depois de remover o
  draft antes do primeiro submit.
- `17H111-PERMISSAO-NEGADA-20260721`: salvo sem ponto depois da negativa; a
  permissao foreground foi restaurada.
- `17H111-GPS-DESLIGADO-20260721`: salvo sem ponto; o GPS foi religado ao final.
- `17H111-COLAB-PONTO-20260721`: criado pelo Colaborador no `T01 - 230`, com
  `-9,88`, `-56,1`, precisao de 12 m e horario 01:48.
- `17H111-ADMIN-PONTO-20260721`: registro interno do Admin na Sela de Prata I,
  `T01`, com `-9,89`, `-56,11`, precisao de 10 m e horario 01:52.

As coordenadas acima sao leituras simuladas do AVD. Nao demonstram posicao
exata nem pertencimento automatico a qualquer Talhao.

## Checklist 17H111

| ID | Area | Status | Evidencia atual |
|---|---|---|---|
| 17H111-01 | Create sem ponto | Passou | Produtor criou `17H111-SEM-PONTO-20260721` pelo `T01 - 230`; detalhe e card ficaram sem secao/selo e o perfil continuou sem editar/remover |
| 17H111-02 | Create com ponto | Passou | Draft exibiu precisao/horario/transparencia; o ponto de 15 m apareceu no detalhe e no selo somente depois do submit |
| 17H111-03 | Captura e cancelamento | Passou | `17H111-CANCELADO-20260721` nao gerou id, selo ou registro; novo formulario reabriu sem draft |
| 17H111-04 | Remocao antes do submit | Passou | Draft removido voltou ao estado sem ponto; `17H111-REMOVIDO-ANTES-SALVAR-20260721` foi salvo sem secao/selo/campos |
| 17H111-05 | Permissao negada | Passou | Mensagem controlada, formulario utilizavel e registro salvo sem ponto; permissao foreground restaurada |
| 17H111-06 | GPS desligado | Passou | Mensagem orientou ativar localizacao e permitiu salvar sem ponto; GPS restaurado |
| 17H111-07 | Provider/timeout | Passou | Timeout real de ate 15 s saiu de `Obtendo posição...`, mostrou erro recuperavel e reabilitou submit sem grupo parcial |
| 17H111-08 | Concorrencia/resposta tardia | Passou | Duplo toque nao iniciou segunda operacao; sair com captura pendente nao causou crash, alerta tardio, draft ou registro |
| 17H111-09 | Baixa precisao | Passou | Leitura de 100 m mostrou aviso, preservou o valor e manteve submit permitido sem alegar posicao exata |
| 17H111-10 | Troca de Propriedade | Passou | Admin trocou Boa Vista por Horizonte; draft foi removido com aviso e nao reapareceu ao voltar |
| 17H111-11 | Troca de Talhao | Passou | Troca `T01` -> `T02` preservou leitura/horario e aviso; nao houve inferencia nem texto `dentro do Talhão` |
| 17H111-12 | Preserve | Passou | Alteracao comum manteve `-9,87`, `-56,09`, 15 m e 01:25; abrir edicao nao capturou novamente |
| 17H111-13 | Replace cancelado | Passou | Nova leitura `-10`, `-57`, 25 m, 01:41 ficou em state; cancelar preservou integralmente o ponto anterior |
| 17H111-14 | Replace salvo | Passou | Submit substituiu por `-10,1`, `-57,1`, 20 m, 01:42 e autoria Admin, sem opcionais antigos ou segundo ponto |
| 17H111-15 | Remove cancelado | Passou | Remocao pendente foi cancelada; detalhe reabriu com o ponto preservado |
| 17H111-16 | Remove/desfazer | Passou | `Desfazer remoção` voltou a `preserve`; observacao foi salva e o ponto permaneceu |
| 17H111-17 | Remove salvo | Passou | Submit eliminou secao, selo e seis campos; edicao reabriu limpa, sem `null`, sentinel ou grupo parcial |
| 17H111-18 | Produtor | Passou | Propriedade contextual travada; criou/viu ponto na propria Propriedade; sem Editar/Remover; rotas e demais bloqueios cobertos por teste |
| 17H111-19 | Colaborador | Passou | Criou `17H111-COLAB-PONTO-20260721` no escopo e preservou o ponto em edicao; bloqueio fora de escopo coberto por testes por falta de dado visual adequado |
| 17H111-20 | Admin | Passou | Criou o registro interno; `preserve`, `replace` e `remove` foram exercitados pelo Admin no registro controlado da sessao, mantendo o interno como evidencia de visibilidade |
| 17H111-21 | Visibilidade | Passou | Produtor viu registro liberado do Colaborador com selo; busca do registro interno do Admin retornou `Nenhum` e nao vazou coordenada |
| 17H111-22 | Force-stop | Passou | Sem ponto continuou sem selo; Colaborador continuou com selo; cancelado ausente; removidos/erros sem selo; interno invisivel; novo formulario limpo |
| 17H111-23 | Posicao temporaria do mapa | Passou | Mapa mostrou posicao de 18 m/01:57 somente em runtime; apos force-stop nao restaurou marcador, nao criou Caderno e novo formulario abriu limpo |
| 17H111-24 | GeoJSON/Talhoes | Passou | `limites_talhoes.geojson` reanexado pelo picker; 15 Talhoes/37 partes, `GEOJSON LOCAL` e `T01` clicavel, sem pontos do Caderno ou point-in-polygon |
| 17H111-25 | PNG | Passou | Asset existente `ph_10a20.png` foi usado como fixture em `Download`; `smoke_ph_10a20.png` e PNG base abriram sem ponto, coordenada ou controle de localizacao |
| 17H111-26 | ZIP de Prescricao | Passou | Fixture temporaria valida de 286 B foi selecionada pelo picker, importada e reaberta apos `force-stop`; Admin e Produtor viram somente metadados/detalhe, sem preview, unzip, processamento ou localizacao |
| 17H111-27 | Material tecnico | Passou | Filtros Fertilidade, Correcao de solo e Prescricao funcionaram sem secao, marcador ou acao de ponto do Caderno |
| 17H111-28 | Visitas | Passou | Nova Visita sem Camera/Galeria/localizacao; registro antigo mostrou `Imagens do registro (2)`, `Imagem demonstrativa` e `Exemplo visual do registro`, sem geotag |
| 17H111-29 | Auditoria sem chave/tracking | Passou | Sem chave nova, objeto bruto persistido, background, tracking, watch, trilha, historico ou `localizacao_*` fora do Caderno |
| 17H111-30 | Android fisico | Reexecutar | A Fase 17H.1.3 usou aparelho fisico autorizado, mas o provider real encerrou tres tentativas em timeout controlado e os casos dependentes de ponto real ficaram pendentes |

## Force-stop E Perfis

Apos `force-stop` e reabertura, somente dados submetidos reapareceram. O
registro sem ponto continuou sem selo; o ponto liberado do Colaborador
continuou com selo; drafts cancelados nao reapareceram; o ponto removido nao
ressuscitou; e Novo Caderno abriu sem ultimo ponto global.

Por perfil:

- Produtor: criou na propria Propriedade contextual, viu detalhe/selo de
  registro liberado e continuou sem editar/remover, gerenciar Safra ou
  Material tecnico;
- Colaborador: criou e preservou ponto dentro do escopo; a negativa fora do
  escopo permaneceu coberta pelas rotas/testes existentes;
- Admin: criou o registro interno e exercitou todas as semanticas de edicao no
  registro controlado da sessao; o interno foi mantido como evidencia e nao
  apareceu para o Produtor.

## Regressao De Mapa E Materiais

- `Mostrar minha posição` continuou foreground e transitorio. O marcador foi
  removido com o fim do runtime/force-stop e nao alimentou o Caderno.
- O GeoJSON local apresentou 15 Talhoes e 37 partes sem receber
  `localizacao_*` ou pontos persistidos do Caderno.
- PNG base e PNG local abriram como imagem/anexo, sem marcador, coordenada ou
  botao de localizacao.
- Material tecnico preservou os tres filtros e nao ganhou UI do ponto.
- Visita permaneceu sem captura real, geotag ou campos do Caderno.
- O ZIP temporario valido foi importado e reaberto como detalhe de pacote,
  inclusive depois de `force-stop` e como Produtor, sem preview, processamento,
  descompactacao ou ponto do Caderno.

Assim, `17H1B-12` passou. `17H1B-13` continua `Reexecutar` ate a captura e os
cenarios dependentes de um ponto real serem concluidos no aparelho fisico.

## Gate Android Fisico Da Fase 17H.1.3

Status em 2026-07-22: `PARCIAL_ANDROID_FISICO`.

Um aparelho Android fisico autorizado recebeu o APK release e abriu o app sem
crash. Permissoes foreground, Caderno sem ponto, negativa de permissao,
localizacao do sistema desligada, GeoJSON, PNG, ZIP, teclado/usabilidade e
ausencia de background passaram. Nenhuma coordenada real, endereco ou serial
do aparelho foi registrado nesta documentacao.

Em ambiente interno, sem ceu razoavelmente visivel, o provider real encerrou
tres tentativas com timeouts controlados em aproximadamente 38 a 53 segundos. Nao houve
leitura nem precisao a registrar. Por isso permaneceram pendentes a posicao
temporaria no mapa, create com ponto, cancelamento e remocao de um draft com
ponto, fluxos de Colaborador/Admin dependentes de ponto e a persistencia/
remocao desse ponto apos `force-stop`.

O `force-stop` passou para dados sem ponto e para as fixtures importadas, mas
nao exercitou ponto salvo ou removido. A limpeza removeu as fixtures
temporarias; nenhuma localizacao real chegou a ser persistida, portanto essa
limpeza nao substitui a remocao de um ponto salvo pelo fluxo normal do app.

O resultado nao altera a aprovacao dos 29/29 casos executaveis no emulador,
nao promove `17H111-30` nem `17H1B-13` e nao autoriza abrir a Fase 17H.2. O
relato completo esta em
`fase-17h-1-3-android-fisico-ponto-caderno.md`.

## Auditoria Tecnica

Foram executadas as buscas obrigatorias por:

- seis campos `localizacao_*`;
- `coords`, altitude, `altitudeAccuracy`, speed e heading;
- `TaskManager`, watch, updates em background, geofence e
  `ACCESS_BACKGROUND_LOCATION`;
- chaves `@tche:` relacionadas a marcadores/localizacao;
- `localizacao_*` em mapa, PNG, ZIP, GeoJSON e Visita;
- `AsyncStorage` no componente, hook e helper de UI.

Resultado:

- os seis campos persistem somente no dominio Caderno;
- `coords` e lido apenas na borda do provider e convertido para o shape
  minimo; extras sao cobertos por testes de descarte;
- `speed: 12` em `LoginScreen` pertence a `Animated.spring`, nao a GPS;
- ocorrencias amplas de `background` sao estilos/CSS, flags explicitamente
  `false` no `app.json` ou testes que rejeitam origem `background`;
- nenhuma chave de localizacao nova, API de tracking/background ou
  `ACCESS_BACKGROUND_LOCATION` existe;
- nenhum `localizacao_*` entrou em PNG, ZIP, GeoJSON, Visita ou mapa;
- o marcador de `userLocation` do mapa continua state React transitorio e nao
  le os pontos persistidos do Caderno.

O comando da especificacao com wildcards de caminho retornou erro 123 no
Windows; o mesmo escopo foi reexecutado com filtros `rg -g`, sem ocorrencias.

## Bugs, Codigo E Testes

Nenhum bug funcional foi reproduzido nesta rodada e nenhum patch de codigo ou
teste novo foi necessario. Alteracoes operacionais de permissao, GPS e leitura
simulada foram usadas somente no AVD e restauradas no encerramento. Os unicos
arquivos da entrega sao documentos ativos da fase.

## Arquivos Documentais Da Entrega

- `docs/project/fase-17h-1-1-smoke-seguranca-ponto-caderno.md`;
- `docs/project/fase-17h-1-3-android-fisico-ponto-caderno.md`;
- `docs/project/fase-17h-1b-ui-ponto-caderno.md`;
- `docs/project/fase-17h-marcacoes-campo.md`;
- `docs/project/estado-atual.md`;
- `docs/project/pendencias-de-definicao.md`;
- `docs/project/smoke.md`.

`docs/project/decisoes-consolidadas.md` nao foi alterado, pois nao surgiu
decisao nova nesta rodada.

## Pendencias Para A Proxima Etapa

- repetir o provider real em condicao ambiental adequada, com ceu visivel, e
  registrar somente tempo aproximado e precisao informada, sem coordenadas;
- concluir no aparelho fisico os casos dependentes de ponto real: create,
  cancelamento, remocao antes do submit, perfis, visibilidade e `force-stop`;
- manter fora da 17H.2 qualquer marcador persistido ate o gate documental e
  de evidencia correspondente ser explicitamente aberto.

## Confirmacoes Explicitas

- Cancelamento nao persiste localizacao.
- Localizacao somente persiste no submit do Caderno.
- Capturar, remover e salvar produz Caderno sem ponto.
- `replace` e `remove` cancelados preservam o ponto anterior.
- `Mostrar minha posição` nao salva.
- Nao existe chave nova.
- Nao existe background, tracking, trilha, rota ou historico.
- Pontos persistidos do Caderno ainda nao sao desenhados no mapa.
- Android fisico esta `PARCIAL_ANDROID_FISICO`, ainda pendente e nao aprovado
  para liberar a Fase 17H.2.
