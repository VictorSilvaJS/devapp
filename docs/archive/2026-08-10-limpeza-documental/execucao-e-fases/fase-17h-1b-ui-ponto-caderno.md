# Fase 17H.1B - UI, Captura Foreground E Persistencia Explicita Do Ponto No Caderno

Status em 2026-07-21: `IMPLEMENTADO_VALIDADO_EMULADOR`.

Esta microfase conectou o contrato opcional da 17H.1A a uma interface
explicita de captura foreground no Novo/Editar Caderno. A posicao permanece
somente em state React durante o formulario e os campos canonicos so entram
em `CadernoCampo.create` ou `CadernoCampo.update` no submit. Caderno sem ponto
continua sendo o fluxo normal.

O gate Android fisico foi iniciado na Fase 17H.1.3, mas terminou
`PARCIAL_ANDROID_FISICO` porque o provider real nao entregou leitura no
ambiente interno do teste. A implementacao nao cria background, tracking,
trilha, historico, geofencing, point-in-polygon, chave de storage ou marcador
persistido no mapa.

## Superficies Alteradas

Foram criados:

- `src/components/CadernoLocalizacaoSection.tsx`: secao apresentacional
  reutilizavel e selo `Com ponto geográfico`;
- `src/hooks/useCadernoLocalizacaoCapture.ts`: coordenacao da leitura unica,
  estado pendente, cancelamento e protecao contra resposta tardia;
- `src/utils/cadernoLocalizacaoUiCompat.ts`: composicao pura de draft/patch,
  mensagens, formatacao e regras de apresentacao;
- `tests/cadernoLocalizacaoUiCompat.test.js`: cobertura do comportamento de UI
  testavel sem snapshot fragil de JSX.

Foram integrados:

- `NovoCadernoScreen` e `EditarCadernoScreen`, para captura e submit;
- `CadernoDetailScreen`, para a secao do ponto valido;
- `CadernoCampoScreen`, `ProdutorScreen` e `TalhaoDetailModal`, para o selo;
- `LocationForegroundService`, com limite finito de 15 segundos para a espera
  da leitura do provider;
- suites de Caderno/formulario/validators, `test:domain-compat` e o recorte de
  compilacao de compatibilidade.

Nao foram alterados `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`,
`MapaFazendaView`, seeds/assets, dependencias, `app.json`, PNG, ZIP ou GeoJSON.

## Captura E Estado Transitorio

A captura acontece somente depois do toque em `Usar minha posição neste
registro` ou, quando ja existe ponto, em `Atualizar usando posição atual`.
As telas usam exclusivamente `LocationForegroundService`, que solicita
permissao foreground e executa uma unica leitura. Nenhuma tela chama
`expo-location` diretamente.

Do retorno nativo, apenas latitude, longitude, accuracy e `capturedAt` sao
considerados. O helper acrescenta `localizacao_origem` como
`foreground_explicit` e inclui `localizacao_captured_by` somente quando o id
do usuario logado e uma string nao vazia. `coords`, altitude,
`altitudeAccuracy`, speed, heading e outros extras do provider nao entram no
draft nem no payload.

O hook usa id de requisicao, referencias de montagem e de operacao em curso
para impedir duplo toque, resposta antiga, atualizacao depois de desmontagem e
resultado posterior a cancelamento/navegacao. Enquanto a captura esta
pendente, nova captura e submit ficam desabilitados. Falha ou timeout de
provider vira estado controlado `unavailable`; nenhuma localizacao parcial e
guardada.

## Textos E Estados Da Interface

Os textos visiveis centrais sao:

- titulo: `Localização do registro`;
- transparencia inicial: `Localização opcional. A posição só será incluída
  neste registro se você usar a ação abaixo e depois salvar o Caderno.`;
- acao inicial: `Usar minha posição neste registro`;
- espera: `Obtendo posição...`;
- estado pronto: `Posição pronta para salvar`;
- transparencia depois da captura: `Ao salvar este registro, a posição
  aproximada do aparelho, a precisão informada e o horário da leitura serão
  armazenados localmente no Caderno de Campo. O aplicativo não acompanha sua
  localização em segundo plano.`;
- precisao ausente: `Precisão não informada`;
- baixa precisao: `A precisão desta leitura está baixa. Confirme visualmente
  o local antes de salvar.`;
- contexto de Talhao: `O Talhão foi selecionado pelo contexto do registro. O
  aplicativo não confirmou automaticamente que a posição está dentro dele.`;
- mudanca de Propriedade: `A localização foi removida porque a Propriedade do
  registro foi alterada. Capture uma nova posição se desejar.`;
- edicao: `Localização registrada`, `Atualizar usando posição atual`,
  `Remover localização`, `A localização será removida quando você salvar as
  alterações.` e `Desfazer remoção`.

Accuracy maior que 50 metros mostra o aviso de baixa precisao sem bloquear o
salvamento. Trocar Talhao nao altera a coordenada e nao executa
point-in-polygon.

Os erros sao apresentados sem bloquear Caderno comum:

- `Permissão de localização negada. Você ainda pode salvar o Caderno sem
  localização.`;
- `Ative a localização do aparelho para incluir a posição neste registro.
  Você ainda pode salvar sem localização.`;
- `Não foi possível obter a posição atual do aparelho. Você ainda pode salvar
  o Caderno sem localização.`;
- `Não foi possível usar a localização neste momento.`.

## Novo Caderno

Sem draft valido, o submit preserva o payload anterior e nao emite nenhum
`localizacao_*`. Com draft valido, `appendCadernoLocalizacaoDraft` acrescenta
somente os seis campos canonicos imediatamente antes de
`CadernoCampo.create`.

No fluxo global, o id da Propriedade no instante da captura existe apenas no
state de UI. Se a Propriedade mudar, a captura pendente e invalidada, o draft
e removido e a tela pede uma nova captura. Uma verificacao final antes do
submit impede que um draft ligado a outra Propriedade seja enviado. Esse id
auxiliar nunca entra no payload.

Cancelar, voltar, perder foco ou desmontar descarta o state e invalida a
requisicao pendente sem chamar persistencia. Sucesso do create limpa o draft;
falha do create o mantem para nova tentativa.

## Editar Caderno

A edicao extrai defensivamente o ponto existente e inicia em `preserve`, sem
captura automatica e sem alterar `captured_at`.

- `preserve`: editar observacao ou outro campo comum nao emite patch de
  localizacao e mantem o grupo existente integralmente;
- `replace`: uma nova captura explicita fica somente no state e substitui o
  grupo completo apenas no submit;
- `remove`: a UI mostra que a remocao sera aplicada ao salvar e oferece
  `Desfazer remoção`; o submit usa o patch canonico da 17H.1A, sem sentinel ou
  `null` residual.

Cancelar a edicao preserva o ponto anterior. Produtor continua sem acesso a
editar/remover, conforme a regra existente do Caderno; Admin e Colaborador
reutilizam os controles de acesso atuais, sem RBAC novo.

## Detalhe E Selo

`CadernoDetailScreen` mostra `Ponto registrado em campo` somente para grupo
canonico valido. A secao apresenta origem explicita, latitude/longitude com
ate seis casas decimais, precisao, data/hora local e nome do usuario quando o
id pode ser resolvido com seguranca por `User.list`. Id tecnico cru nunca e
exibido. Grupo legado parcial ou invalido nao cria secao e nao derruba o
detalhe.

O selo discreto `Com ponto geográfico` aparece somente para Caderno com ponto
valido nos cards efetivos da listagem de Caderno, detalhe da Propriedade e
modal do Talhao. Coordenadas nao aparecem nos cards, e ordenacao, filtro e
visibilidade nao foram alterados.

## Cobertura Automatizada E Auditoria

Passaram:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests\cadernoLocalizacaoCompat.test.js`;
- `node tests\cadernoLocalizacaoUiCompat.test.js`, com 33 cenarios;
- `node tests\cadernoFormCompat.test.js`;
- `node tests\acessoControleCompat.test.js`;
- `node tests\validatorsCompat.test.js`;
- `node tests\periodoProdutivoService.test.js`;
- `node tests\talhaoConsultaCompat.test.js`;
- `npx expo install --check`, com `Dependencies are up to date`.

A cobertura inclui create com/sem draft, omissao de autoria, rejeicao de
draft invalido, descarte de extras do provider, precisao nula/baixa, mudanca
de Propriedade, Talhao sem inferencia, abertura da edicao em `preserve`,
`replace`, `remove`, desfazer, detalhe/selo somente para ponto valido,
mensagens de erro, resposta tardia, duplo toque e timeout.

A auditoria estatica confirmou:

- nenhum `AsyncStorage` nas telas/componente de localizacao;
- nenhuma chave `@tche:` nova;
- nenhuma API de background, watch, TaskManager, geofencing ou tracking;
- nenhum campo proibido do provider no payload;
- nenhum campo `localizacao_*` em Visita, PNG, ZIP, GeoJSON ou mapa;
- localizacao entrando somente no submit do Caderno.

## Build E Smoke No Emulador

`:app:assembleRelease` concluiu com `BUILD SUCCESSFUL`. O APK final em
`android/app/build/outputs/apk/release/app-release.apk` possui 91.922.508
bytes e SHA-256
`3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B`.
`adb install -r` e a abertura por `monkey` passaram no Pixel Tablet, Android
15/API 35, preservando sessao e estado. Nao foram usados `pm clear`,
desinstalacao ou `Wipe Data`.

O smoke no emulador confirmou:

- login como Produtor, abertura da Sela de Prata I e criacao pelo Talhao
  `T01 - 230`, tanto sem ponto quanto com ponto;
- secao opcional sem captura automatica e criacao de Caderno sem ponto;
- falha/timeout do provider com mensagem controlada e salvamento comum
  liberado;
- captura por GPS simulado, com horario e precisao exibidos;
- aviso de baixa precisao e aviso de contexto de Talhao;
- persistencia somente depois do submit;
- detalhe com coordenadas/nome resolvido e selo nos cards;
- edicao em `preserve`, substituicao por nova captura, remocao pendente,
  desfazer e remocao efetivamente persistida depois de salvar.

No fluxo do Produtor, a captura simulada exibiu precisao de 18 m e o detalhe
resolveu `Produtor Demonstração` sem expor id tecnico. A regressao tambem
reconfirmou area total informada de 6.200 ha, area mapeada de 1.888,6 ha e o
Talhao `T01 - 230`.

Ao final, o provider/GPS simulado do AVD foi restaurado ao estado anterior.

## Limites E Pendencias

Permanecem pendentes:

- repetir o provider real em condicao ambiental adequada, com ceu visivel;
- concluir no aparelho fisico create com ponto, cancelamento, remocao,
  `preserve`/`replace`, visibilidade e persistencia apos `force-stop`;
- obter e registrar somente a precisao informada pelo aparelho, sem coordenada
  real, antes de qualquer liberacao da Fase 17H.2.

A auditoria estatica e a reabertura visual minima da Fase 17H.1.2 cobrem a
ausencia de georreferenciamento em PNG, ZIP, GeoJSON, Visita e mapa. Nenhum
ponto persistido foi desenhado no mapa. `Mostrar minha posição` continua
transitorio e independente do Caderno. PNG e ZIP continuam nao
georreferenciados.

| ID | Area | Criterio | Status |
|---|---|---|---|
| 17H1B-01 | UI | Secao opcional sem captura automatica | Passou |
| 17H1B-02 | Captura | Leitura foreground unica somente apos acao explicita | Passou |
| 17H1B-03 | Transparencia | Texto contextual, precisao e horario | Passou |
| 17H1B-04 | Create sem ponto | Payload anterior sem qualquer `localizacao_*` | Passou |
| 17H1B-05 | Create com ponto | Grupo canonico persiste somente no submit | Passou |
| 17H1B-06 | Erro | Falha/timeout permite salvar Caderno sem ponto | Passou |
| 17H1B-07 | Edit preserve | Edicao comum preserva grupo e timestamp | Passou |
| 17H1B-08 | Edit replace | Nova captura substitui integralmente no submit | Passou |
| 17H1B-09 | Edit remove/desfazer | Remocao fica pendente, pode ser desfeita e persiste so ao salvar | Passou |
| 17H1B-10 | Detalhe e selo | Ponto valido aparece sem expor id cru ou coordenadas no card | Passou |
| 17H1B-11 | Auditoria | Sem chave nova, background, tracking, trilha ou historico | Passou |
| 17H1B-12 | Regressao PNG/ZIP/mapa | Caderno com ponto preservou selo/secao; mapa, PNG e ZIP foram reabertos sem ponto persistido fora do Caderno | Passou |
| 17H1B-13 | Android fisico | Completar captura, precisao e persistencia de ponto real no aparelho autorizado; a rodada 17H.1.3 ficou parcial | Reexecutar |

## Revalidacao De Seguranca Na Fase 17H.1.1

Status em 2026-07-22: `APROVADA_EM_EMULADOR`.

A rodada 17H.1.1 ampliou a evidencia interativa de seguranca da UI desta fase.
Passaram captura seguida de cancelamento, remocao antes do primeiro submit,
permissao negada, GPS desligado, timeout real de 15 segundos, duplo toque,
resposta posterior a saida da tela, baixa precisao, troca de Propriedade,
troca de Talhao, `preserve`, `replace` salvo/cancelado, `remove`
salvo/cancelado e desfazer. O force-stop restaurou somente dados efetivamente
submetidos e nao restaurou draft, ultimo ponto global ou marcador temporario
do mapa.

Produtor, Colaborador e Admin mantiveram o acesso atual do Caderno. O Produtor
viu o registro liberado com selo e nao viu o registro interno do Admin.
GeoJSON/Talhoes, PNG, Material tecnico e Visitas foram reabertos sem ponto ou
campos do Caderno. A auditoria estatica permaneceu limpa para chaves,
background, tracking, objeto bruto do provider e contaminacao entre dominios.

O fechamento 17H.1.2 criou uma fixture ZIP valida de 286 B fora do repositorio,
selecionou-a pelo DocumentPicker e importou-a como Prescricao da Propriedade.
O detalhe mostrou somente metadados e a mensagem de pacote local, sem preview,
descompactacao, processamento ou localizacao. Item e associacao reapareceram
apos `force-stop`; o Produtor consultou o mesmo detalhe sem acoes de anexar,
substituir ou remover. Caderno com ponto, mapa, PNG e ZIP foram reabertos e
confirmaram a segregacao visual.

Assim, `17H1B-12` passou e os 29/29 casos executaveis no emulador estao
aprovados. `17H1B-13` permanece `Reexecutar`: o aparelho fisico foi usado na
Fase 17H.1.3, mas os cenarios dependentes de uma leitura real nao foram
concluidos.

O relato e o checklist 17H111-01 a 17H111-30 estao em
`fase-17h-1-1-smoke-seguranca-ponto-caderno.md`.

## Validacao Parcial Em Android Fisico Na Fase 17H.1.3

Status em 2026-07-22: `PARCIAL_ANDROID_FISICO`.

No aparelho fisico autorizado, APK release, permissao foreground, Caderno sem
ponto, negativa de permissao, localizacao do sistema desligada, GeoJSON, PNG,
ZIP, teclado/usabilidade e ausencia de background passaram. O provider real,
testado tres vezes em ambiente interno sem ceu razoavelmente visivel, terminou
em timeouts controlados de aproximadamente 38 a 53 segundos, sem leitura e
sem precisao a registrar.

Consequentemente, create com ponto, cancelamento/remocao de ponto, semanticas
de edicao dos perfis, visibilidade com ponto real e `force-stop` de ponto
salvo/removido continuam pendentes. O `force-stop` foi confirmado apenas para
dados sem ponto e fixtures; a limpeza removeu as fixtures temporarias, mas nao
substitui a remocao de um ponto salvo, pois nenhuma localizacao real foi
persistida.

Nenhuma coordenada real, endereco ou serial foi documentado. Este resultado
nao significa aprovacao para producao, outros modelos Android, precisao
agronomica ou backend, e nao autoriza abrir a Fase 17H.2. O relato completo
esta em `fase-17h-1-3-android-fisico-ponto-caderno.md`.
