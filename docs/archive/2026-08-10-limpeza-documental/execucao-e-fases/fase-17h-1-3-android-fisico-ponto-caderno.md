# Fase 17H.1.3 - Validacao Android Fisico Do Ponto Opcional No Caderno

Status final em 2026-07-22: `PARCIAL_ANDROID_FISICO`.

Um aparelho Android fisico autorizado foi usado para instalar e abrir o APK
release atual, conferir permissoes, executar o fluxo sem ponto, exercitar os
estados de erro e repetir a regressao de GeoJSON, PNG e ZIP. A leitura real do
provider, porem, nao foi obtida nas tres tentativas realizadas em ambiente
interno, sem ceu razoavelmente visivel. Por isso, os cenarios que dependem de
uma captura real permanecem `Reexecutar` e a Fase 17H.2 nao pode ser aberta.

Este resultado se limita ao recorte local demonstravel da 17H.1 no aparelho e
nas condicoes descritas abaixo. Ele nao representa produto pronto para
producao, backend ou sincronizacao prontos, RBAC real, precisao agronomica
certificada, rastreamento, cobertura universal de Android ou validacao
completa de uso em campo.

## Escopo E Restricoes Preservadas

A rodada nao implementou a Fase 17H.2 e nao alterou o contrato canonico do
ponto. Permaneceram fora do escopo:

- leitura de coordenadas persistidas do Caderno por `MapaFazendaView`;
- camada de marcadores persistidos, cluster, heatmap, rota, linha ou trilha;
- point-in-polygon ou afirmacao de pertencimento automatico a Talhao;
- chave `@tche:` nova ou storage separado para pontos;
- objeto `coords`, altitude, speed, heading, arrays ou extras do provider;
- background location, `TaskManager`, watch continuo e geofencing;
- camera, fotos reais, backend, upload, download produtivo e sync.

Nenhum ponto persistido do Caderno foi desenhado no mapa. O estado da
tentativa de posicao permaneceu transiente e nao produziu registro no Caderno.

## Aparelho E Ambiente

O serial do aparelho foi deliberadamente omitido deste documento.
Na fotografia do ADB havia um aparelho fisico autorizado e nenhum emulador
conectado.

| Item | Evidencia sanitizada |
|---|---|
| Fabricante | TCL |
| Modelo | 8483A |
| Android | 15 |
| API | 35 |
| Resolucao fisica | 800 x 1280 |
| Conexao e instalacao | USB, com alvo fisico selecionado explicitamente no ADB |
| Pacote | `com.tcheagro.mobile` |
| Versao instalada | `1.0.0` (`versionCode` 1) |
| Armazenamento em `/data` | 99 GB totais, aproximadamente 85 GB disponiveis na conferencia final |
| Bateria durante o roteiro | 100%, carregando; sem inferencia cientifica de consumo |
| Localizacao do sistema | Ativa no inicio e restaurada como ativa ao final |
| Condicao do provider | Ambiente interno, sem ceu razoavelmente visivel |

Nao foram usados `pm clear`, `adb uninstall`, `Wipe Data` ou edicao manual do
AsyncStorage. Sessao e dados locais existentes foram preservados.

## Privacidade Da Evidencia

Esta rodada tratou localizacao fisica como dado operacional sensivel. Foram
aplicadas as seguintes regras:

- nenhuma latitude ou longitude real foi transcrita para documentacao;
- nenhum endereco foi registrado;
- o serial completo do aparelho nao foi registrado;
- nenhuma coordenada real foi adicionada a fixture, teste, issue ou relatorio;
- nenhuma captura de tela com endereco sensivel foi mantida no repositorio;
- as observacoes usadas no Caderno foram genericas;
- logs com coordenadas nao foram incorporados a evidencia;
- somente condicao ambiental, duracao aproximada e ausencia de precisao foram
  registradas para as tentativas do provider.

As coordenadas numericas documentadas em rodadas anteriores da 17H.1.1 sao
leituras simuladas do AVD. Elas nao sao dados obtidos deste aparelho fisico.

## Baseline Automatizado

Passaram antes do fechamento manual:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- 28 de 28 suites focadas aplicaveis ao Caderno, acesso, validators, periodo,
  Talhao, GeoJSON, PNG, ZIP e Visita;
- `npx expo install --check`, com `Dependencies are up to date`.

O projeto permaneceu em Expo SDK 56, com `expo@56.0.16` e
`expo-location@56.0.21`.

## Build, Instalacao E Abertura

O build release passou e confirmou o artefato atual, que foi instalado por
cima no aparelho fisico e aberto pelo launcher com sucesso.

| Item | Resultado |
|---|---|
| Caminho | `android/app/build/outputs/apk/release/app-release.apk` |
| Data/hora do artefato | 2026-07-21 14:29:03 -03:00 |
| Tamanho | 91.922.508 bytes |
| SHA-256 | `3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B` |
| Build release | Passou |
| Instalacao `-r` | Passou |
| Abertura por `monkey` | Passou |

O Gradle validou o artefato contra a arvore de codigo sem regravar o APK; por
isso a data/hora do arquivo permaneceu anterior a esta rodada. Caminho,
tamanho e hash foram conferidos antes da instalacao.

Os comandos direcionados ao aparelho usaram selecao explicita por serial no
ADB. O valor do serial nao e reproduzido neste relato.

## Baseline Funcional No Aparelho

O aplicativo abriu sem crash. Os logins locais de Admin, Colaborador e
Produtor funcionaram, e Sela de Prata I, Talhoes, Caderno, Safra/Safrinha e
Material tecnico foram abertos no release instalado. Esses acessos continuam
demonstrativos/locais e nao foram promovidos a backend, JWT ou RBAC produtivos.

## Permissoes Instaladas

A permissao de localizacao foi concedida como permissao foreground durante o
uso do aplicativo. A tela do Android e o pacote instalado confirmaram:

- `ACCESS_FINE_LOCATION` presente;
- `ACCESS_COARSE_LOCATION` presente;
- `ACCESS_BACKGROUND_LOCATION` ausente;
- `CAMERA` ausente;
- permissoes modernas `READ_MEDIA_*` ausentes;
- nenhuma opcao de localizacao permanente ou em segundo plano foi usada.

Existem declaracoes legadas de storage limitadas por `maxSdkVersion` 32. Elas
nao equivalem a permissao moderna de galeria no Android 15 e nao alteraram o
recorte de localizacao foreground desta fase.

## Condicao Real Do Provider

Foram feitas tres tentativas reais de obter a posicao do aparelho em
2026-07-22. Todas ocorreram em ambiente interno, sem ceu razoavelmente
visivel, e terminaram de forma controlada entre aproximadamente 38 e 53
segundos. O horario de relogio exato das tentativas nao foi mantido na
evidencia; ele deve ser registrado na reexecucao do caso `17H113-11`.

| Tentativa | Duracao aproximada | Resultado |
|---|---:|---|
| Mapa de Talhoes | 53 s | Timeout controlado, sem leitura |
| Novo Caderno | 38 s | Timeout controlado, sem leitura |
| Novo Caderno, repeticao final | 38 s | Timeout controlado, sem leitura ou estado duplicado |

Em todas as tentativas:

- nenhuma leitura de posicao foi entregue pelo provider;
- nenhuma precisao foi informada;
- nao houve crash, espera infinita ou grupo parcial no Caderno;
- a interface saiu do estado de carregamento com mensagem controlada;
- o formulario continuou utilizavel e permitiu o fluxo comum sem ponto.

Esse resultado nao demonstra falha funcional do armazenamento do ponto, mas
tambem nao demonstra captura, precisao ou persistencia em condicao fisica
adequada. O provider deve ser reexecutado em area aberta ou com ceu
razoavelmente visivel. Uma leitura futura, se obtida, nao deve ser interpretada
como precisao garantida para toda a propriedade ou para todos os aparelhos.

## Checklist 17H113

| ID | Area | Status | Evidencia sanitizada |
|---|---|---|---|
| 17H113-01 | Aparelho fisico autorizado | Passou | TCL 8483A apareceu como dispositivo fisico autorizado; serial omitido |
| 17H113-02 | Instalacao release | Passou | Build, instalacao por cima e abertura do pacote release passaram por USB |
| 17H113-03 | Permissoes foreground | Passou | A permissao de localizacao precisa durante o uso foi concedida; Fine/Coarse presentes e Background ausente |
| 17H113-04 | Posicao temporaria no mapa | Reexecutar | Acao foi tentada e os Talhoes continuaram clicaveis, mas o provider nao entregou leitura; nenhum marcador persistente ou Caderno foi criado |
| 17H113-05 | Create sem ponto | Passou | Caderno comum foi salvo sem secao, selo ou grupo de localizacao, preservando Propriedade e Talhao; o Produtor nao recebeu acoes de edicao/remocao |
| 17H113-06 | Create com ponto | Reexecutar | Sem leitura real do provider, nao foi possivel salvar e conferir um ponto fisico |
| 17H113-07 | Captura e cancelamento | Reexecutar | O cancelamento de uma captura real valida depende de leitura do provider |
| 17H113-08 | Remocao antes do submit | Reexecutar | Nao houve draft real valido para remover antes do salvamento |
| 17H113-09 | Permissao negada | Passou | Negativa mostrou mensagem controlada, manteve submit disponivel e o salvamento sem ponto foi comprovado no mesmo APK |
| 17H113-10 | Localizacao desligada | Passou | Estado desligado terminou com mensagem controlada, sem crash ou espera infinita, e o fluxo sem ponto permaneceu disponivel |
| 17H113-11 | Provider real e precisao | Reexecutar | Tres tentativas internas terminaram controladamente entre cerca de 38 e 53 s, sem leitura ou precisao informada |
| 17H113-12 | Colaborador preserve/replace/remove | Reexecutar | Sem ponto real salvo, nao foi possivel exercer preserve, replace e remove no aparelho |
| 17H113-13 | Admin e visibilidade | Reexecutar | A visibilidade de um registro fisico com ponto nao pode ser comparada sem captura valida |
| 17H113-14 | Force-stop | Reexecutar | Sessao, Caderno sem ponto e materiais persistiram; ponto salvo/removido nao foi exercitado por ausencia de leitura |
| 17H113-15 | GeoJSON | Passou | Fixture sintetica renderizou Talhoes clicaveis, persistiu apos force-stop e depois foi removida pelo app |
| 17H113-16 | PNG | Passou | Fixture sintetica abriu como imagem, persistiu apos force-stop e permaneceu sem ponto do Caderno |
| 17H113-17 | ZIP | Passou | Pacote sintetico exibiu somente metadados, sem preview, unzip ou processamento; Produtor consultou sem acoes de gestao |
| 17H113-18 | Teclado e usabilidade | Passou | Retrato e paisagem permitiram rolagem; textos ficaram legiveis, o submit ficou alcancavel e o duplo toque rapido nao duplicou a requisicao ou o estado |
| 17H113-19 | Ausencia de background | Passou | Auditoria, processo, notificacao e reabertura nao indicaram tracking, leitura automatica ou atividade continua |
| 17H113-20 | Limpeza | Passou | Nenhuma localizacao real foi persistida; fixtures foram removidas pelo app e temporarios de Download foram removidos |

Resultado da matriz: 12 casos `Passou` e 8 casos `Reexecutar`.

## Evidencia Complementar Dos Fluxos

### Caderno sem ponto e estados de erro

O Caderno sem ponto continuou sendo o fluxo normal. O registro salvo nao
mostrou secao `Ponto registrado em campo`, selo `Com ponto geografico` ou
grupo parcial, e o Produtor nao recebeu acoes de edicao ou remocao. Negar
permissao e desligar a localizacao produziram mensagens controladas, sem
impedir o uso do formulario ou o salvamento comum.

Como nenhuma tentativa do provider retornou uma leitura, nao foram exercitados
com dado real:

- create com ponto;
- captura seguida de cancelamento;
- remocao do draft antes do primeiro submit;
- `preserve`, `replace` e `remove` pelo Colaborador;
- visibilidade Admin/Produtor de registro com ponto;
- restauracao de ponto salvo e nao restauracao de ponto removido apos
  `force-stop`.

Esses comportamentos continuam cobertos pelos 29 de 29 casos executaveis no
emulador, mas a evidencia virtual nao substitui a reexecucao fisica.
`17H111-30` e `17H1B-13` permanecem `Reexecutar`.

Uma tentativa de novo Caderno foi abandonada depois do timeout controlado. Ela
nao criou registro nem reapareceu depois de `force-stop`; isso confirma apenas
o cancelamento sem captura valida e nao promove o caso `17H113-07`.

### Force-stop e materiais locais

O `force-stop` preservou a sessao, o Caderno sem ponto e as associacoes locais
de GeoJSON, PNG e ZIP. O novo formulario e a tentativa cancelada nao
reapareceram com secao, selo ou registro de ponto. Isso confirma a parte do
caso que nao depende de uma leitura real, mas nao fecha a persistencia de ponto
salvo/removido no aparelho.

As fixtures usadas eram sinteticas e nao sensiveis:

- o GeoJSON renderizou Talhoes e manteve a interacao de clique;
- o PNG abriu somente como imagem;
- o ZIP abriu somente como pacote de metadados, sem preview,
  descompactacao ou processamento;
- os arquivos permaneceram fisicos e os indices locais guardaram somente
  metadados; o GeoJSON bruto nao foi gravado no AsyncStorage;
- nenhum ponto do Caderno apareceu em GeoJSON, PNG ou ZIP;
- o Produtor consultou os materiais sem acoes de gestao;
- as associacoes reapareceram depois de `force-stop` e foram removidas ao
  final pelo fluxo normal do aplicativo.

Os arquivos temporarios enviados para `Download` tambem foram removidos no
encerramento.

### Teclado, orientacao e observacao visual

Em retrato, os campos puderam ser rolados e o botao de salvar permaneceu
alcancavel. Em paisagem, o Android abriu seu editor de texto em tela cheia;
usar `Done` devolveu o formulario com o botao de salvar alcancavel. O fluxo
principal nao ficou bloqueado.

Um duplo toque rapido na acao de captura produziu somente uma finalizacao
controlada, sem estado duplicado. Como o provider nao entregou leitura, a
apresentacao de baixa precisao real nao foi exercitada e permanece abrangida
pelo caso `17H113-11` em `Reexecutar`.

Foi registrada uma observacao P2: os acessos rapidos da tela de login ficaram
apertados e parcialmente cortados em paisagem. O comportamento nao bloqueou o
uso em retrato e nao foi tratado nesta fase, porque nao interfere no gate P0
do ponto opcional.

### Background e consumo basico

A busca estatica e a observacao do aparelho nao encontraram `TaskManager`,
watch continuo, atualizacao em background, geofencing, notificacao de
localizacao ou nova leitura automatica depois de sair, executar `force-stop` e
reabrir. A bateria permaneceu em 100% e carregando durante o roteiro; esse dado
nao constitui benchmark nem permite inferencia cientifica de consumo.

## Bugs, Correcoes E Testes Novos

Nenhum bug P0 foi reproduzido. A ausencia de leitura nas tres tentativas foi
classificada como limitacao ambiental/provider inconclusivo, porque o teste
ocorreu em ambiente interno sem ceu razoavelmente visivel.

Nenhuma correcao funcional foi aplicada e nenhum teste novo foi adicionado.
A observacao P2 de paisagem foi apenas registrada para uma fase visual propria.

## Limpeza Da Evidencia Fisica

Nenhuma localizacao real chegou a ser persistida. Depois do `force-stop`, nao
havia secao ou selo de ponto para remover. GeoJSON, PNG e ZIP sinteticos foram
removidos pelas acoes normais do aplicativo, e seus arquivos temporarios foram
retirados de `Download`.

A permissao foreground, a localizacao do sistema e as configuracoes de
rotacao foram restauradas ao estado esperado ao final. Nenhum dado foi limpo
por filesystem, `pm clear`, desinstalacao ou edicao manual do AsyncStorage.

Essa limpeza nao substitui o caso ainda pendente de remover, pelo fluxo normal,
um ponto real previamente salvo e confirmar depois de `force-stop` que ele nao
reaparece. Esse caso permanece contido em `17H113-12`, `17H113-14` e no gate
fisico ainda inconclusivo.

## Gate Para A Fase 17H.2

A Fase 17H.2 nao pode ser aberta nesta rodada. Permanecem sem evidencia fisica
conclusiva os seguintes casos dependentes de captura real:

- posicao temporaria no mapa;
- create com ponto;
- captura e cancelamento;
- remocao antes do submit;
- provider real e precisao;
- `preserve`, `replace` e `remove` pelo Colaborador;
- Admin e visibilidade de registro com ponto;
- persistencia e remocao de ponto depois de `force-stop`.

Para reavaliar o gate, esses oito casos devem ser repetidos em area aberta ou
com ceu razoavelmente visivel. Bugs P0 eventualmente encontrados devem ser
corrigidos e revalidados antes de qualquer mudanca de status.

Mesmo depois de futura conclusao do gate, abrir a 17H.2 nao significara
backend, sync, producao, precisao universal ou cobertura de todos os modelos
Android. Nesta rodada, nenhum ponto persistido foi desenhado no mapa e nenhum
codigo da 17H.2 foi criado.

## Documentos Alterados

- `docs/project/fase-17h-1-3-android-fisico-ponto-caderno.md`;
- `docs/project/fase-17h-1-1-smoke-seguranca-ponto-caderno.md`;
- `docs/project/fase-17h-1b-ui-ponto-caderno.md`;
- `docs/project/fase-17h-marcacoes-campo.md`;
- `docs/project/estado-atual.md`;
- `docs/project/pendencias-de-definicao.md`;
- `docs/project/smoke.md`.

## Confirmacoes Finais

- Status final: `PARCIAL_ANDROID_FISICO`.
- 12 de 20 casos fisicos passaram; 8 permanecem `Reexecutar`.
- `17H111-30` e `17H1B-13` continuam `Reexecutar`.
- Os 29 de 29 casos executaveis no emulador permanecem passando.
- Nenhuma coordenada real, endereco ou serial foi registrado neste documento.
- Nao existe background, tracking, trilha, rota ou historico de posicoes.
- Nenhum ponto persistido do Caderno foi desenhado no mapa.
- PNG e ZIP continuam sem ponto do Caderno.
- Backend e sincronizacao continuam fora do escopo.
- Nenhuma correcao funcional ou teste novo foi adicionado.
- A Fase 17H.2 permanece bloqueada.
