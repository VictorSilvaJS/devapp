# Smoke Funcional Ativo

> Atualizado em: 2026-09-22
>
> Última execução física registrada: 2026-09-21 (TCL API 35, Demo/HTTP Bug 3 em QA novo isolado)
> Última execução emulada registrada: 2026-09-18 (API 32, correção Bug 3)

Este arquivo contém somente o roteiro ainda útil. Evidências detalhadas e
rodadas anteriores foram movidas para docs/archive.

## Bug 3 — aprovação independente — 2026-09-22

**APROVADO PARA COMMIT DA CORREÇÃO DO BUG 3 — DEMO/EXPOASSET.**
O parecer independente original confirmou sete critérios técnicos e apontou
somente AUD-B3-01. O complemento do auditor fornecido pelo usuário na conversa
encerrou esse achado na rechecagem documental de 22/09/2026, sem pendência
técnica ou documental do parecer. O fechamento Git está sendo realizado nesta
etapa; isso não registra push antecipadamente.

O reteste físico Demo e o controle HTTP autenticado com Demo → HTTP → Demo
foram concluídos em 21/09 no QA novo autorizado `mp35d4_bug3_validation_qa`.
O auditor conferiu as evidências fornecidas de builds e execução física;
executou seus quatro gates (typecheck, native-graph, bundle e domain-compat)
e o controle negativo do autolinking. Não repetiu builds ou testes físicos.
D-4 340/340 e privacidade 25/25 são resultados herdados, não execuções deste
fechamento, que se limita a documentação, hashes e verificações Git.

A aprovação cobre as amostras, fluxos e intervalos observados, não comparação
integral da base nem captura universal de tráfego. Bug 2/F-01 permanece fechado
em `f0fa1f6`. Bug 1 do teclado, revalidação integrada e fechamento da D-4
continuam pendentes. Integração na `backend` e release não realizados; QA antigo
não recuperado. Os registros históricos abaixo, incluindo o smoke reprovado,
permanecem preservados.

## Bug 3 — controle HTTP em QA novo isolado — 2026-09-21

Registro histórico de 21/09; a aprovação posterior está registrada acima.

**CONTROLE HTTP AUTENTICADO E DEMO→HTTP→DEMO CONCLUÍDO EM QA NOVO ISOLADO —
BUG 3 AGUARDANDO AUDITORIA INDEPENDENTE.**

Autorização expressa substituiu a recuperação do acesso antigo por um QA
adicional: projeto `mp35d4-bug3-validation-20260921`, banco
`mp35d4_bug3_validation_qa`, volume próprio. PostgreSQL/PostGIS e Mailpit usam
as imagens oficiais existentes, somente em loopback; API em 3103, banco em
5543, SMTP em 1125 e Mailpit em 8125. O QA antigo `mp35d4-smoke-20260915` /
`mp35d4_android_qa` ficou parado e inalterado, assim como `backend/.env.local`.
Não houve teste sobre massa/sessões históricas ou recuperação de chaves antigas.

Dez migrations, fixture oficial com três Propriedades e bootstrap/convite/aceite
do Admin `[QA BUG3] Admin Validacao 20260921` passaram. API usa `bug3_runtime`,
membro de `tche_agro_runtime`, sem superusuário, criação de banco/role,
associação a plataforma/worker ou UPDATE direto de Propriedades. Configuração
durável em `%LOCALAPPDATA%\TcheAgro\qa\bug3-validation-20260921\config.dpapi`,
cifrada por DPAPI CurrentUser e com ACL de usuário atual/SYSTEM. Duas partidas
da API pela mesma configuração passaram em readiness/login/lista/detalhe;
a segunda não executou migrations, fixtures, bootstrap ou troca de segredos.

| Controle físico no TCL API 35 | Resultado |
| --- | --- |
| Demo antes | `QA-BUG3-20260921-TCL-EDITADA` presente; 74 Propriedades e dataset anterior preservados |
| HTTP novo | Admin sintético autenticado, lista das três Propriedades e detalhe da Ativa, com acesso administrativo |
| `/v1/auth/me` físico | Respostas 200 na revalidação após Home/Recentes, distintas das chamadas auxiliares |
| Busca positiva | `Propriedade Ativa` aplicada na interface, retornando `[QA] Propriedade Ativa` |
| Ausência do sintético Demo | Busca exata `QA-BUG3-20260921-TCL`, sem status/UF/Município, retornou vazia; confirmação auxiliar no servidor com cursor seguinte nulo |
| Demo após | Mesmo sintético editado e totais 74/39/3/75/74/7; sem nova criação/edição e sem substituição pela massa HTTP |
| Privacidade HTTP | Raiz e modal de filtros capturáveis quando autorizados; miniatura HTTP oculta em Recentes; retorno com revalidação 200, sem mutação de Propriedade |

Nos intervalos Demo 17:51:49–17:55:48 e 18:05:54–18:07:26 UTC, a API nova
continuou disponível e não registrou requisições; nenhum cliente auxiliar foi
executado nesses intervalos. Bundle Demo real continua sem transporte/entry
HTTP; bundle HTTP real usa `src/entry/http.tsx`, sem seed Demo. Inspector
conectado não capturou os requests HTTP positivos e não foi usado como prova
autossuficiente de ausência de tráfego. Observação por logs da API alvo e
composição executada, não captura universal de pacotes.

APKs aprovados reutilizados, hashes conferidos; nenhum build, reinstalação,
mudança de código/dependência ou repetição dos dez gates. A primeira abertura
antecipou a disponibilidade do Metro; a passagem foi executada após carregamento.
Capturas transitórias e buscas incompletas não foram promovidas a resultado.
Dispensar teclado continua contorno do Bug 1, sem correção. Evidências, limites,
partida/parada e hashes no [relatório A–J](../../dist/validate-bug3-newqa-20260921/relatorio-final.md).

Serviços novos encerrados, volume/configuração preservados; nenhum listener
próprio remanescente. Reverses próprios removidos e `stay_on_while_plugged_in=0`
confirmado. Critério 36 passou neste QA novo; auditoria independente pendente.
Acesso ao QA antigo é pendência operacional separada. Bug 2/F-01 permanece
fechado; Bug 1 e D-4 abertos. Sem staging, commit, push, integração ou release.

## Bug 3 — reteste físico Demo e pendência QA — 2026-09-21

Registro da rodada anterior à autorização do QA adicional. O bloqueio de acesso
abaixo não foi resolvido no ambiente antigo; o controle posterior está acima.

**DEMO VALIDADO FISICAMENTE; CONTROLE HTTP AUTENTICADO/ISOLAMENTO COMPLETO
BLOQUEADOS PELO ACESSO QA. BUG 3 NÃO ENCERRADO.**
Continuação sobre `f0fa1f6` + a mesma correção de 18/09. Nenhuma mudança de
código, teste, dependência ou configuração da correção. Os dois hashes não
documentais e o lockfile foram preservados; 611 arquivos não documentais
coincidem com a cópia física que produziu o APK corrigido. Evidência e limites
no [relatório A–G](../../dist/validate-bug3-physical-20260921/relatorio-final.md).

O TCL 8483A/API 35, arm64-v8a, foi identificado e a opção
`stay_on_while_plugged_in` restaurada de `2` para `0`, com leitura posterior.
Uma interrupção USB durante a leitura do APK foi resolvida por reconexão
manual do usuário, antes de qualquer instalação. A leitura do hash no aparelho
confirmou que `demo-isolated-1.apk` já estava instalado: SHA-256
`3910c1193bfbaedf51321cc6185f10a10b4274e6f9dd8de5ef5900a3fca8dfc6`,
`com.tcheagro.mobile.demo` 1.0.0(1), arm64-v8a. Nenhum novo build/reinstall.

| Matriz executada no TCL | Resultado desta rodada |
| --- | --- |
| Login demonstrativo e assets | Logout somente da sessão Demo, tela de login e acesso Admin pela interface passaram; logo e ícones visíveis; ExpoAsset/Constants acessíveis ao JS |
| Seletores e cancelar | Titular QA ativo, UF e Município locais passaram; cancelamento manteve 73 Propriedades |
| Criar/editar | Novo registro `QA-BUG3-20260921-TCL`, editado para `QA-BUG3-20260921-TCL-EDITADA`; somente esse registro foi editado |
| Persistência física | Duas partidas independentes por force-stop/start; busca final recuperou o nome editado, Titular e Cláudia/MT |
| Dataset anterior | 73 → 74 Propriedades; 39 Produtores, 3 Colaboradores, 75 Visitas, 74 registros de Caderno e 7 materiais mantidos; 37 Titulares e área total 1.313,46 ha mantidos na amostra. Não é comparação integral da base |
| Composição executada | Metro `demo/` em 8083; bundle `index.js` → `src/entry/demo.tsx`, SHA-256 igual ao testado no AVD em 18/09 |
| Chamadas Demo de negócio | Inspector entre 13:15:20 e 13:27:20 UTC, cobrindo login local, seletores, cancelar, criar e editar: nenhuma solicitação observada; bundle sem FetchHttpTransport/entrypoint HTTP/endpoints de autenticação. Não é captura universal de tráfego nativo |
| Inicialização/logs | Sem erro impeditivo observado; logcat sanitizado disponível para as duas partidas finais, com PIDs distintos |

Dispensar o teclado foi somente contorno; Bug 1 não foi corrigido. Registro
criado diretamente no TCL, sem importar o overlay AVD de 18/09. Apps e dados
anteriores preservados; nenhuma limpeza de armazenamento ou desinstalação.

HTTP instalado corresponde ao artefato aprovado Bug 2/F-01, hash `0f95c287…`
integral no relatório. Os serviços QA `mp35d4-smoke-20260915` estão parados;
o `.env.local` conhecido aponta a `tche_agro_local_qa`, outro banco. O caminho
da configuração atual foi solicitado e não recebido. Nenhum runner de resume,
reset, recuperação, bootstrap, fixture, migration ou SQL foi executado.
HTTP autenticado, lista/detalhe/busca do sintético, passagem Demo → HTTP → Demo
e amostra de privacidade raiz/modal **não foram executados nesta continuação**.
O controle emulado parcial de 18/09 permanece histórico, sem promovê-lo a físico.

Critério **35 passou no TCL**; **37 passou no recorte de inicialização Demo**;
**36 e controle HTTP permanecem pendentes**. Os dez gates de 18/09 não foram
repetidos porque seus insumos não mudaram; hashes, proveniência, execução,
links e diff foram verificados nesta rodada. Auditoria independente do Bug 3
pendente. Smoke original preservado; Bug 2/F-01 fechado em `f0fa1f6`, Bug 1 e
D-4 abertos. Sem staging, commit, push, release ou consulta à CI remota.

## Bug 3 — correção focal com validação emulada — 2026-09-18

Esta seção registra o alcance de 18/09; o reteste físico posterior está acima.

**CAUSA CONFIRMADA E CORREÇÃO VALIDADA NO AVD; RETESTE FÍSICO PENDENTE.**
Base `feat/mp-35d`, `f0fa1f6f29590078db8749472e65028c5143f5c9`, inicialmente
limpa. Bug 2/F-01 está fechado nesse commit; política HTTP preservada.
O [relatório A–K](../../dist/fix-bug3-demo-expoasset-20260918/relatorio-final.md)
contém experimentos, comandos, hashes, capturas e limites desta rodada.

O APK Demo original, preservado e idêntico ao smoke de 15/09, reproduziu
`ExponentConstants` ausente e `Cannot find native module 'ExpoAsset'` no TCL
com Metro Demo correto. Seu DEX não contém AssetModule/ConstantsModule.
`demo/package.json` não declarava dependências: `searchPaths` descobria Expo
na raiz, mas não percorria `node_modules/expo/node_modules`. Expo carregava os
JavaScripts de asset/constants, ausentes do APK. O erro posterior de registro
de `main` era consequência; o registro da aplicação não foi alterado.

A correção declara `expo ~56.0.18`, `react 19.2.3` e `react-native 0.85.3`
no Demo, usando a instalação e o lockfile existentes da raiz. O gate
`test:native-graph:mp33c` agora exige asset/constants/core nas duas variantes e
confere caminho, versão e classe de registro de asset/constants com a resolução
JavaScript de Expo. Também verifica a coerência do manifesto Demo com a raiz e
o lock. O gate anterior passava com o defeito; o novo falhou no controle negativo.
Não houve atualização de SDK, alteração de exclusões ou de script oficial.

| Verificação desta rodada | Resultado e alcance |
| --- | --- |
| Geração isolada + build oficial | Passou em cópia física com a mesma topologia; arm64 e x86_64 gerados, módulos registrados; instalação arm64 no TCL não confirmada após desconexão |
| Build oficial na árvore normal | Passou reaproveitando o Android existente; APK x86_64 instalado in-place no AVD; assets/constants acessíveis ao JS no AVD |
| Login, logo/ícones e acesso Demo | Passou no AVD API 32 |
| Nova Propriedade, Titular/UF/Município e cancelar | Passou no AVD; dispensar teclado foi somente contorno do Bug 1 |
| Criar/editar e reabrir | Propriedade sintética `QA-BUG3-20260918-AVD-EDITADA` persistiu; 73 → 74 Propriedades, demais contadores preservados na amostra |
| Partidas independentes | AVD abriu após force-stop e após rebuild in-place; retorno HTTP → Demo preservou a sessão e o dataset local observado |
| Demo → HTTP → Demo | Parcial no AVD: pacotes/entrypoints distintos, HTTP sem acesso Demo e retorno ao dataset Demo; autenticação/lista/detalhe HTTP e isolamento completo pendentes |
| Ausência de API no fluxo local Demo | Inspector sem solicitações no intervalo 19:12:24–19:19:16 UTC de seletores/criação/edição; bundle/grafo sem transporte HTTP de negócio. Não é prova de tráfego nativo universal nem do login anterior ao intervalo |
| Gates reexecutados | typecheck, domain-compat, D-4 340/340, privacidade 25/25, native-config, native-graph, bundles, MP13, MP15 e final-complements passaram |

O AVD API 32 foi aberto com disco original somente leitura e sem salvar snapshot;
suas evidências são complementares. O TCL API 35 desconectou durante a instalação
do primeiro APK corrigido e não voltou: **não há validação física nova da correção**.
O QA documentado estava desligado e suas credenciais atuais não estavam disponíveis;
nenhum volume, fixture, migration ou credencial foi alterado. O controle HTTP usou
o APK preservado, pois manifesto raiz, lock, geração e política HTTP não mudaram.
Recentes/screenshot raiz/modal HTTP não foram reexecutados nesta rodada. D-1/D-2/D-3
e instrumentação nativa de privacidade não foram reexecutados: nenhuma dependência,
harness ou composição desses cortes foi alterada; os gates JS pertinentes passaram.

Critérios **35 (sanity físico Demo), 37 (inicialização física/logs) e 36
(isolamento funcional)** continuam pendentes de nova aprovação; a reprovação
original não foi apagada. Bug 3 aguarda reteste físico, controle HTTP completo
e auditoria independente. Bug 1, revalidação integrada e fechamento D-4 seguem
pendentes. CI remota não consultada; sem staging, commit, push ou release.

## Bug 2 e F-01 — aprovação independente — 2026-09-18

**APROVADO PARA COMMIT DA CORREÇÃO DO BUG 2 — PROTEÇÃO EM RECENTES.**
O [parecer independente final](../../dist/reaudit-f01-20260918/relatorio-reauditoria.md)
encerrou F-01 e não encontrou defeito impeditivo ou correção obrigatória
remanescente deste corte. API 32 x86_64 emulada e TCL 8483A/API 35 físico
passaram, este com o APK arm64 novo da fonte corrigida. A pendência de testar
esse novo APK no TCL deixou de ser atual; permanece no registro histórico de 17/09.

Cronologia preservada: smoke de 15/09 encontrou Bug 2; primeira correção
passou na API 35; complemento API 32 revelou F-01; tentativa intermediária
tratou apenas parte da causa e foi insuficiente; a correção final tratou a
Window/decor e a cópia da flag antes do attach; a reauditoria de 18/09 aprovou
API 32 e a regressão física API 35 do novo APK.

| Evidência | Execução própria do auditor em 18/09 |
| --- | --- |
| Typecheck | Passou |
| Privacidade | 25/25: 14 de privacidade e 11 herdados/importados no runner, todos executados nessa invocação |
| Instrumentação Android | 12/12; controle negativo independente sensível à divergência Window/decor |
| API 32 | Primeiras capturas/reaberturas de status, Titular, filtros e confirmação; ciclo aninhado e amostra de Recentes passaram |
| TCL 8483A/API 35 | Sete superfícies A–G, screenshots autorizados, Recentes direto/Home → Recentes e retornos passaram no APK arm64 novo |
| Camadas e sessão | Janela superior liberada sem liberar inferiores; descarte pendente, erro neutro, recuperação online e force-stop/reabertura aprovados |
| Proveniência/preservação | Fontes, APKs instalados, bundles e objeto Git conferidos pelo auditor |

Os dez gates completos do implementador, inclusive D-4 340/340 e demais
suítes da seção de 17/09, são **históricos**. Não foram reexecutados pela
reauditoria final nem por este fechamento documental/Git. Suítes sobrepostas
não são somadas como cobertura única. Neste fechamento foram conferidos
hashes, delta documental, links e Git; nenhum serviço Android/QA foi iniciado.

Qualificações do parecer preservadas:

- A instrumentação libera o mecanismo nativo diretamente; HTTP/provider foi
  observado separadamente no app conectado.
- O controle negativo parou na primeira assertion; comprova sensibilidade à
  divergência Window/decor, sem alegar controle negativo independente da segunda causa.
- A primeira confirmação teve diferença de maiúsculas no argumento textual
  do probe. O auditor resolveu por inspeção do PNG/XML/flags, conservando o
  `result.json` original reprovado. Não substituiu essa captura por outra.
- O ensaio histórico com `clientAlreadyClosed=true` não comprova entrega de
  callback HTTP tardio. Gerações antigas são sustentadas pelos testes nativos/JS.
- Demais APIs/fabricantes, casting e análise quadro a quadro não foram
  executados. Debug/Metro/QA não certificam release ou operação produtiva.

Bugs 1 (teclado sobre Titular) e 3 (Demo/ExpoAsset), isolamento funcional
completo Demo/HTTP, revalidação integrada final e fechamento da D-4,
integração posterior na `backend` e release/deploy/produção seguem pendentes.
O smoke original não foi promovido integralmente para aprovado. CI remota
permanece não consultada. Esta aprovação técnica não declara commit/push realizados.

## F-01 — FLAG_SECURE em Dialog — 2026-09-17

Registro histórico da execução do implementador. As pendências abaixo refletem
17/09; a reauditoria e a amostra física API 35 foram concluídas em 18/09, acima.

Correção focal do achado da [auditoria complementar API 32](../../dist/audit-bug2-api32-20260917/relatorio-complementar.md),
que emitiu **CORREÇÕES OBRIGATÓRIAS**. A [auditoria de 16/09](../../dist/audit-bug2-independent-20260916/relatorio-independente.md)
passou na amostra física API 35, mas não aprovou o objeto integral por falta
de execução API 24–32. Essa lacuna foi resolvida pelo AVD API 32 e revelou F-01.
Os pareceres, APKs e capturas anteriores permanecem preservados.

Antes da edição funcional, status e filtros reproduziram o defeito: conteúdo
visível no display, Dialog superior com `FLAG_SECURE` e primeiro PNG SystemUI
preto. A causa confirmada reúne atributos da `Window` divergentes do decor
após cópia de `LayoutParams` e perda do registro da flag própria no intervalo
entre criação e attach de Dialog RN. A correção usa a Window efetiva e mantém
a propriedade dessa cópia; não muda sessão, timeout, negócios ou API 33+.

Execução própria: AVD existente `Tche_Bug2_API32`, Android API 32, x86_64,
imagem oficial revisão 2, APK HTTP debug novo, Metro e QA local preservado.

| Reteste API 32 | Resultado |
| --- | --- |
| Status, Titular, filtros e confirmação | 3 aberturas por superfície; 12 primeiros PNGs SystemUI legíveis |
| Activity e Dialogs inferiores | Protegidos antes das capturas; só a janela superior autorizada liberada |
| Matriz A–G | Recentes direto e Home → Recentes protegidos nas sete superfícies; retorno autorizado |
| Raiz → status → seletor → status → raiz | 3 ciclos; captura de retorno funciona e janelas descartadas não permanecem |
| Regressão nativa permanente | 12 verificações em Activity/RN Dialog/WindowManager reais, incluindo geração antiga e flags externas |

O [relatório focal A–K](../../dist/fix-f01-api32-20260917/relatorio-final.md)
discrimina cada primeira captura, tentativas com pré-condição inválida,
falhas intermediárias, pendência real de `/me`, descarte, erro/recuperação,
orientação, force-stop, proveniência e preservação. Nenhuma captura falha foi
substituída. O [roteiro permanente](http-privacy-android-regression.md) documenta
o runner nativo e o probe SystemUI; a suíte JS sozinha não comprova WindowManager.

Gates reexecutados sobre a fonte final: typecheck; privacidade **25/25**;
D-4 **340/340**; D-3 **106/106**; D-2 **85/85**; D-1 **55/55**;
domain-compat; configuração nativa; grafo nativo; bundles HTTP/Demo. Todos
passaram. Há casos compartilhados: não somar os números como cobertura única.
O teste nativo demonstrou falha antes e sucesso depois, além das telas reais.

**API 35 física do código novo: pendente.** O TCL não estava conectado.
O APK arm64 novo foi gerado da mesma fonte corrigida; a aprovação física de
15–16/09 é histórica e não prova esse novo binário. Não foram executadas todas
as APIs/fabricantes nem casting. O ambiente debug/Metro não certifica release.
Backend/PostgreSQL integral não foi repetido, pois não houve alteração backend.

**F-01 corrigido e validado na API 32; aguardando reauditoria independente.**
Bugs 1 e 3, isolamento funcional completo do Demo, fechamento da D-4,
integração final na `backend` e release permanecem pendentes. Sem staging,
commit ou push nesta rodada.

## MP-35D-4 — Bug 2 Recentes — 2026-09-15

Registro histórico da rodada de 15/09; o complemento API 32 e a correção
F-01 de 17/09 estão na seção acima. As limitações e o parecer abaixo refletem
o momento daquela execução.

O [smoke físico original](../../dist/smoke-mp35d4-android/relatorio-final.md)
em `1874ff5690d95c1c01b999bcdfc63c249706cb38` foi **REPROVADO**:
Bug 1, teclado cobrindo Titular; Bug 2, formulário HTTP exposto em Recentes;
Bug 3, Demo não inicia por ExpoAsset. O diretório original foi preservado
integralmente, com manifesto SHA-256 anterior à correção.

Esta rodada trata **somente Bug 2**, em `feat/mp-35d`, HEAD acima + worktree,
sem staging/commit/push. [Relatório focal A–K, APK, hashes e capturas](../../dist/fix-bug2-recents-20260915/relatorio-final.md).

O defeito foi reproduzido novamente antes de alterar código: Recentes direto
e Home → 2 s → Recentes exibiam o formulário preenchido. A proteção anterior
dependia de `AppState.change` e de atualização React; não havia política
nativa de snapshot nem cobertura própria de `Dialog`. O instante exato de
captura do compositor não foi instrumentado. A solução gera política de
Recentes na Activity HTTP e cobertura nativa por janela, com liberação
vinculada à geração de foco e à política existente de sessão.

Alvo físico: TCL 8483A, Android 15/API 35, 800×1280, 240 dpi, ARM64. Backend
QA preservado, sem recriação de fixtures ou migrations. Formulários não
enviados; propriedade QA existente permaneceu ativa, versão 6.

| Superfície | Recentes direto | Home → aguardar → Recentes | Resultado observado |
| --- | --- | --- | --- |
| A. Nova preenchida | 3 | 3 | Neutra; rascunho preservado |
| B. Editar autoritativa + alteração local | 3 | 3 | Neutra; alteração não enviada preservada |
| C. Seletor Titular | 1 | 1 | Modal protegido; retorno funcional |
| D. Status, Outro + detalhe sintético | 1 | 1 | Modal protegido; sem PATCH |
| E. Detalhe autenticado | 1 | 1 | Neutra; retorno autorizado |
| Complemento: Filtros / Confirmar saída | 1 cada | 1 cada | Janelas protegidas; canceladas sem ação |

São **18 ciclos obrigatórios**, além de 4 complementares, com captura real
do Android inspecionada visualmente. Nos ciclos diretos com teclado, o IME
do sistema aparece sem os valores de negócio; a área HTTP fica coberta.
Snapshots Home aparecem neutros em cinza. Screenshots no foreground funcionam.

Controle de falha: o reverse da API foi direcionado temporariamente a um
receptor local que não responde; o timeout original de 8 s foi preservado.
A captura física durante `/me` pendente ficou coberta. Após a falha, a tela
mostrou indisponibilidade; restaurar o reverse e tentar novamente recuperou
o acesso. Ao desmontar o modal, o foco da raiz iniciou outra revalidação,
também coberta. Não houve mutação de negócio nas transições.

Force-stop/reabertura e desbloqueio passaram após reinício controlado do Metro,
que inicialmente respondia `/status` mas não entregava o bundle. Nenhuma
limpeza de dados/cache foi feita. Logcat após a instalação corrigida: zero
fatal e zero ANR; avisos `ReactNoCrashSoftException` de foco antes do contexto
React pronto permanecem registrados. O fatal anterior, de 14:06, pertence ao
APK original iniciado sem Metro disponível e não foi apagado do relatório.

Gates executados sequencialmente: `typecheck`; D-4 **340/340**; D-3 **106/106**;
D-2 **85/85**; D-1 **55/55**; `test:domain-compat`; geração nativa repetida e
idempotente; `test:native-graph:mp33c`; `test:bundle:mp33c`; build HTTP real.
Suíte nova `test:privacy:mp35d4`: **25/25**, sendo 11 casos herdados do harness
de navegação e 14 focados, incluindo pendência/erro/retorno, StrictMode,
callbacks antigos, listeners, fronteira de 15 minutos e lock sem logout.
As suítes compartilham casos; esses números não devem ser somados como testes
únicos. Logs, falhas intermediárias de desenvolvimento/ambiente e reabertura
final estão discriminados no relatório focal.

Limitações: minSdk **24** mantido. O caminho API 24–32 com flag temporária
por janela foi compilado/inspecionado, sem dispositivo ou imagem de emulador
compatível disponível; a API 35 não comprova essas versões. Build debug
depende do Metro e não é validação de release/loja. Configuração, grafos e
bundles Demo foram preservados, mas seu isolamento funcional continua
bloqueado pelo Bug 3. Bugs 1 e 3 permanecem abertos. **Bug 2 aguarda auditoria
independente; MP-35D/D-4 continuam abertas.**

## MP-35D-4 — smoke automatizado do status visual — 2026-09-14

Sobre `e5db497`, com componentes e React Navigation reais; transporte e
primitivas nativas controlados. Não é Android físico nem backend implantado.

1. Admin abre detalhe ativo e Inativar Propriedade.
2. Seleciona motivo, revisa a alteração e confirma explicitamente a inativação.
3. PATCH de status recebe recibo; GET autoritativo publica estado inativo.
4. Modal fecha e o detalhe original permanece, com a mesma key e estado inativo.
5. Abre Reativar Propriedade, informa motivo e confirma.
6. PATCH + GET publicam estado ativo no mesmo detalhe, sem duplicação N1.

Complementos permanentes: Outro sem/com detalhe, limite/NFC, cancelamento,
payload exato, duplo Confirmar, versão GET igual/superior ao recibo, ID/versão
incompatíveis, recovery com duas falhas e terceiro GET bem-sucedido nos dois
destinos, transporte ambíguo e GET incidental, version/business conflicts,
lista ativa recarregada, 401/403 antes/durante PATCH/GET, redução de perfil,
callbacks antigos após retomada, respostas tardias, StrictMode e edição sem
status. Fechar após recibo não oferece cancelamento/rollback do comando aceito.

Auditoria independente: 38/38 critérios e 33/33 probes; nenhum achado obrigatório.
Inativação/reativação, D10, recovery GET, conflitos seguros, F1/N1 e Demo aprovados.
Evidências herdadas, sem nova execução funcional no fechamento Git autorizado.

38 casos renderizados novos e 6 de arquitetura; D-4 **340/340** incluindo os
296 anteriores. Composição e comandos em [testes de contrato](testes-contrato-api-rbac.md).
Status visual **aprovado independentemente para commit**; D-4 continua
em andamento, Android físico e integração final na `backend` posteriores.

Reauditoria independente dos formulários HTTP: **20/20 critérios e 14/14 probes
aprovados**, incluindo estado reconciliado com versão GET superior ao recibo.
N1 encerrado; criação/edição e navegação mínima aprovadas para commit. Evidência
herdada, sem nova execução funcional neste fechamento documental/Git.

## MP-35D-4 — smoke focal N1 — 2026-09-14

Primeira auditoria: **CORREÇÕES OBRIGATÓRIAS**, somente N1. Regressão permanente
com React Navigation real falhou antes da alteração funcional: um PATCH e um
GET deixavam dois detalhes da mesma Propriedade, com keys diferentes; Voltar
revelava o detalhe duplicado. Correção implementada e aprovada na reauditoria; N1 encerrado.

| Entrada | Antes de salvar | Após reconciliação | Após Voltar |
|---|---|---|---|
| Detalhe existente | Main / Detail(A,k1) / Edit(A) | Main / Detail(A,k1) | Main |
| Direta | Main / Edit(A) | Main / Detail(A,k2) | Main |

O teste verifica routes, nomes, keys, IDs e índice ativo, além de um PATCH/um
GET e Nome/Área/Município atualizados na mesma instância de detalhe, sem refetch
compensatório. Cinco origens inválidas são cobertas: removida, nova key, outra
Propriedade, outro nome de rota e rota intermediária. O fallback deixa um único
detalhe A e preserva o histórico não relacionado.

GET pós-recibo indisponível não navega; após duas falhas, o terceiro GET revela
o detalhe original em uma transição. StrictMode, callback repetido, resposta
antiga após retomada, Cancelar/Voltar e entrada direta também são cobertos.
Criação mantém um detalhe com o ID reconciliado e uma transição. Version conflict
continua coberto pela suíte existente, sem saída automática da edição.

Rodada focal **7/7**; D-4 **296/296**, preservando os 289 anteriores e acrescentando
sete regressões N1. Comandos e composição em [testes de contrato](testes-contrato-api-rbac.md).
Demo e apresentação compartilhada preservados por hash; sem imports/dependências
novos ou backend alterado durante N1. Fechamento Git agora autorizado.
Bundles/grafos não exigem repetição por
esta mudança exclusiva de navegação. Status visual, Android físico e integração
final na `backend` continuam pendentes. D-4 não concluída nem aprovada.

## MP-35D-4 — smoke dos formulários HTTP e navegação mínima — 2026-09-14

Automação executada em `tests/mp35d4RenderedForms.test.js`, com componentes,
React Navigation, runtime e fluxos reais; transporte e primitivas nativas
controlados. Não é Android físico nem execução contra backend implantado.
Base `37a8790`, Titular/Localidades já fechados; D-3 `92bba62`, decimal `dab3ac4`
e HTTP administrativo `27df733` preservados. Sem staging, commit ou push.

1. Admin abre **Nova Propriedade** pela lista existente e informa Nome.
2. Busca e escolhe Titular por nome/e-mail; confirma e revalida o detalhe antes
   do submit. O POST usa o Produtor confirmado, nunca a identidade do Usuário.
3. Escolhe UF/Município remotos, informa área/cultura e salva; duplo toque envia
   uma mutação. Recibo e GET autoritativo precedem a navegação para o detalhe.
4. Abre **Editar Propriedade** pelo detalhe. Titular/status são somente leitura;
   Município atual aparece mesmo fora da primeira página, sem varredura.
5. Altera Nome/Área/Município e salva PATCH parcial. A releitura publica o detalhe
   reconciliado, sem valores do draft antigo e com uma conclusão.
6. POST e PATCH confirmados: primeiro GET falha; **Tentar atualizar** falha de
   novo; terceiro GET funciona. Total por comando: uma mutação, três GETs,
   nenhuma nova intenção e navegação somente após a última leitura.
7. PATCH conflita: GET/rebase v2 e v3 mantêm Nome/Área/Município local e conflitos;
   campos intocados adotam servidor. Salvar bloqueado até resolução explícita;
   próximo PATCH usa a versão atual, sem repetição automática.
8. Produtor/Colaborador não veem ações nem montam formulário por rota direta.
   Perda de Admin durante POST/GET descarta dados e torna respostas inertes.
   Após retomada, Cancelar/Voltar/submit antigos de A não alteram a nova tela B.
9. StrictMode executa setup/cleanup/setup com nova instância, sem submit automático
   nem assinatura residual. Retry concorrente A1 preserva páginas/seleções;
   catálogo/cursor inválido permite reinício explícito; buscas não apagam draft.

Resultado: D-4 **289/289** (246 anteriores, 28 novos de tela, 4 de arquitetura,
11 D-2 reutilizados). D-3 106/106, D-2 85/85, D-1 55/55, typecheck,
domain-compat, gates focados de navegação/foco/teclado, grafos nativos e bundles
HTTP/Demo passaram. [Comandos, composição e falhas intermediárias](testes-contrato-api-rbac.md).

**Snapshot anterior à auditoria que identificou N1**; correção focal descrita acima. Status visual de Propriedade existente,
Android físico e integração final na `backend` permanecem pendentes. Nenhuma
marcação de ATUAL-13 foi promovida a nova evidência física; não há fluxo de
vínculos/transferência ou backend alterado neste corte.

## MP-35D-4 — Titular/Localidades internos — 2026-09-14

Smoke automatizado desta etapa sobre `27df733` + worktree, com runtime,
sessão e repositório reais e transporte controlado nos testes permanentes:

1. Titular: busca remota filtra Produtor e status conforme criação ativa/inativa;
   candidato conserva identidades distintas, detalhe confirma o mesmo cadastro
   e o modelo serializa somente `produtor_id` como `titular_id`. Zero resultados
   e Produtor sem consulta a Propriedades são válidos. Mudança de status remove
   confirmação; divergência no detalhe impede seleção pronta.
2. Localidades: coleção das 27 UFs da fixture extraída do seed HTTP; Município
   exige UF, omite busca vazia e normaliza NFC/trim. Paginação deduplicada e
   única por cursor preserva seleção e páginas após falha; retry repete o GET.
   Cursor inválido/cíclico e versão divergente exigem reinício pela primeira página.
3. Deferreds BA/`ilh` → BA/`ita`, BA → SP e buscas/status do Titular, em ambos
   os ordenamentos: sucesso, erro e paginação antigos não publicam nem alteram
   loading/seleção. Callbacks antigos são recusados. UFs também cobrem refresh
   fora de ordem e respostas tardias depois de invalidação de sessão/dispose.
4. Município autoritativo da edição, ausente da primeira página, permanece
   selecionado/exibível sem GET por ID nem varredura. PATCH só inclui ID se
   alterado. Troca de UF limpa o conjunto municipal; seleção durante próxima
   página é permitida e não é recalculada quando a página chega.
5. 401/403 nas quatro leituras, Admin → Produtor/Colaborador, identidade,
   logout, dispose e reconciliação: descarte próprio antes da notificação;
   retomada cria instâncias novas e não ressuscita requests/callbacks antigos.
   Dispose antes de start e cancelamento durante confirmação também cobertos.

6. A1 da primeira auditoria: falha 503 na página 2 e retries concorrentes em
   Titular/Município foram reproduzidos antes da correção. Os 13 testes novos
   falharam; a correção compartilha a operação pendente antes de decidir retry.
   Com e sem seleção, página 1/geração permanecem e página 2 é anexada uma vez.
   Recovery que falha novamente permite retry posterior. Nova busca, UF,
   refresh explícito, dispose e perda de autorização descartam recovery antiga;
   após sucesso, retry tardio conserva a semântica anterior de refresh.
   Probe focal: por consumidor, um GET com cursor e zero GETs sem cursor na
   recuperação concorrente, com seleção preservada.

`test:mp35d4`: **246/246**, sendo os 233 anteriores preservados e 13 regressões
A1 novas (total: 58 Localidades e 57 Titular/sessão/arquitetura, além dos 131
casos do corte HTTP anterior). Resultados próprios, falhas
intermediárias e gates em [testes de contrato](testes-contrato-api-rbac.md).
Reauditoria independente: A1 encerrado, nenhum achado obrigatório remanescente,
20/20 critérios e 42/42 probes. Confirmou retries na mesma promise, geração/
páginas/seleção preservadas e um GET com cursor/zero sem cursor. Mutação de
sensibilidade: os 233 anteriores permanecem e as 13 regressões A1 falham sem
a correção. D-4 246/246, D-3 106/106, D-2 85/85, D-1 55/55, typecheck e
domain-compat passaram na reauditoria; não são novas execuções do fechamento.

Estado: **TITULAR E LOCALIDADES DA MP-35D-4 — APROVADOS PARA COMMIT**.
Fechamento Git autorizado na `feat/mp-35d`. D-3 fechada em `92bba62`, decimal em `dab3ac4` e integração HTTP
administrativa em `27df733`. Naquele snapshot, formulários/navegação pendentes; sem Android físico
nesta etapa, CI remota não consultada, backend inalterado e integração final
na `backend` posterior. Este registro antecede o commit; conclusão do fechamento
exige push e hash remoto confirmado. Sem nova UI/formulário de criação/edição,
tela de status, navegação, release/deploy/produção; Demo preservado.

## MP-35D-4 — integração HTTP administrativa anterior — 2026-09-14

Smoke automatizado nesta rodada, sobre `dab3ac4` + worktree:

1. Criar com Produtor/Município fornecidos diretamente, editar somente campos
   dirty e alterar status pela rota própria: payloads exatos, recibo + GET,
   ID autoritativo da criação e leitura Admin de inativa passaram.
2. Falhar GET após confirmação, falhar novamente e recuperar: uma mutação,
   somente GETs posteriores, correlação de ID/versão e conclusão única passaram.
3. Rebase com campos distintos, conflito no mesmo campo e segundo rebase:
   intenção local, decimal exato e município coerente preservados, sem retry automático.
4. Runtime real com `/me` concorrente, 401/403, retomada, Admin → Produtor/
   Colaborador, troca de identidade, logout, dispose e StrictMode sem UI:
   novos fluxos autorizados funcionam e fluxos antigos permanecem inertes.
   Regressão F1: edição iniciada sem submit perde body/baseline/draft após
   redução; criação/status também descartam intenção. Dispose é definitivo
   antes de submit/start; o novo setup usa nova instância. Identidade nova,
   401/403 e respostas tardias não restauram dados. Recovery válido conserva
   intenção/recibo até concluir somente por GET ou sofrer invalidação definitiva.
5. Listas filtradas invalidadas conservam consulta e recarregam do servidor;
   respostas antigas não restauram dados. Grafo/bundle HTTP continua isolado do Demo.

`test:mp35d4` passou 131/131 após correção de F1; os nove casos novos falharam
antes da alteração funcional. Regressões e comandos completos em
[testes de contrato](testes-contrato-api-rbac.md). Na implementação anterior à
correção F1, backend HTTP incluiu prova
explícita de preservação `400`/`422` após descrições OpenAPI. O gate de bundle
passou na execução isolada após colisão de limpeza da pasta temporária; detalhes
da ocorrência estão na mesma matriz.

D-3 fechada em `92bba62`; pré-requisito decimal fechado e enviado em `dab3ac4`.
Auditoria independente encontrou somente F1, reproduzido e corrigido;
reauditoria focal aprovou F1 e a integração HTTP interna para commit, sem
achado obrigatório remanescente. O fechamento posterior foi concluído em
`27df733` na `feat/mp-35d`, com hash remoto confirmado.
O auditor executou D-4 131/131, D-3 106/106, D-2 85/85, typecheck,
domain-compat e probes focais. A composição D-4 é 35 contratos, 29 modelos,
26 comandos, 36 lifecycle e 5 arquitetura; detalhes e a distinção dos dois
probes exploratórios de 403 estão nos [testes de contrato](testes-contrato-api-rbac.md).
Esses resultados são do auditor. Naquele fechamento somente documental não se
reexecutaram suítes integrais; backend/PostgreSQL também não foram reexecutados
na reauditoria porque permaneceram inalterados.
Seletores não foram implementados naquele corte; a etapa interna posterior
está descrita acima. Formulários, navegação, vínculos e transferência fora.
Android físico não executado nessa etapa; CI remota não
consultada; integração final na `backend` posterior. Nenhuma liberação produtiva.

## MP-35D-4 — smoke focal do pré-requisito decimal

Executado automaticamente em 2026-09-11, sobre `92bba62` + worktree:

1. Persistir no Testcontainer null, `0.0001`, `1.2345`, `1.2300`, `1` e
   `9999999999.9999`; listar e detalhar com mesmo JSON, texto canonicalizado,
   número legado, versão, timestamps e acesso calculado preservados: passou.
2. Impedir o uso do parser numeric na conexão de leitura e verificar o texto
   proveniente de `area_total::text`: passou.
3. Executar leitor operacional congelado do commit base com contratos anterior
   e ampliado; exigir texto válido no decoder administrativo e erro controlado
   quando ausente/corrompido: passou.
4. Recusar terminadores e demais formatos decimais inválidos sem trim; recusar
   `area_total_decimal` na escrita com 400; preservar 400/422, omissão/null de
   `area_total` e PATCH omitido no PostgreSQL: passou.
5. Revalidar suites D-1/D-2/D-3, domain-compat, backend unit/HTTP, integração
   focal, typechecks, manifesto de migrations, build e smoke ESM: passou.

Comandos, contagens, arquivos de teste e ocorrências estão em
[testes de contrato](testes-contrato-api-rbac.md). O cenário PostgreSQL usou
somente bancos descartáveis documentados; não houve smoke Android físico ou
fluxo de formulário D-4. Estado ao término da implementação: pré-requisito
implementado, aguardando auditoria independente.

Parecer independente posterior: **APROVADO PARA COMMIT DO PRÉ-REQUISITO DECIMAL
DA MP-35D-4**, sem achado obrigatório ou evidência crítica pendente.
Executado pelo auditor: typechecks mobile/backend; D-1 55/55, D-2 85/85,
D-3 106/106; domain-compat com MP-33C 46/46, MP-34 35/35 e convergência 7/7;
backend unit 190/190, HTTP 42/42, integração focal 32/32, dez migrations
íntegras, build backend e smoke ESM; diff check, 79 links locais e probes
independentes de compatibilidade e ligação ao decoder passaram.
Esses resultados não são novas execuções do fechamento documental.

A integração PostgreSQL foi focal; o probe com identidade injetada não equivale
a novo E2E de autenticação. Nenhum Android físico, build mobile de release ou
validação produtiva. D-3 concluída; MP-35D/D-4 em andamento. Demais fluxos exigem
próxima autorização; integração final na `backend` e revisão geral do OpenAPI
de escrita, preservando `400`/`422`, permanecem posteriores.

## Matriz atual

| ID | Portão | Cenário | Estado |
|---|---|---|---|
| ATUAL-01 | Release | Perfil e logs sem painel Smoke Dev ou dado pessoal | PASSOU |
| ATUAL-02 | Mídia | Câmera, galeria, cancelamento, persistência e limites | PASSOU |
| ATUAL-03 | Exportação | Pasta, cancelamento e nome físico real | PASSOU |
| ATUAL-04 | Mapa e Caderno | Ponto salvo, reabertura centralizada e três estados do painel | PASSOU |
| ATUAL-05 | Acesso v2 | Três perfis, vínculos e rotas diretas | PASSOU |
| ATUAL-06 | MP-38 | Dentro, fora e próximo de Talhão em campo | PENDENTE DE CAMPO |
| ATUAL-07 | Release | Orientação, teclado, TalkBack e matriz Android | PENDENTE DE RELEASE |
| ATUAL-08 | Visitas | Conclusão e correção em telas dedicadas | PASSOU |
| ATUAL-09 | Desempenho | Listas virtualizadas e abas suspensas fora de foco | PASSOU |
| ATUAL-10 | Usuários | Exclusão administrativa remove usuário, credencial e vínculos | PASSOU |
| ATUAL-11 | Acesso v2 | Produtor autorizado abre Propriedade e somente Materiais liberados | PASSOU |
| ATUAL-12 | Usuários e acesso | Admin vincula, desvincula e revincula Produtor autorizado | PASSOU |
| ATUAL-13 | Rotas e formulários | Contexto de Propriedade, rascunho, edição auditada, data/hora e teclado | PASSOU |
| ATUAL-14 | MP-34 | Notificações HTTP self-only, persistência, idempotência e separação Demo/HTTP | PASSOU AUTOMATIZADO E NO ANDROID FÍSICO; PORTÕES PRODUTIVOS PENDENTES |
| ATUAL-15 | Interface HTTP | Login, Propriedades, Perfil e Notificações no padrão visual aprovado | PASSOU AUTOMATIZADO E NO ANDROID FÍSICO |
| ATUAL-16 | MP-35A | Upgrade, convites, constraints, concorrência, privilégios, versões e catálogo IBGE | PASSOU AUTOMATIZADO; INTEGRADA EM `a51389e`; PORTÕES PRODUTIVOS PENDENTES |
| ATUAL-17 | MP-35B | Seis rotas de Usuários, privilégios, cursor, códigos HTTP e concorrência | PASSOU NA RODADA AUTOMATIZADA INTEGRAL; REAUDITORIA INDEPENDENTE APROVADA; INTEGRADA EM `60144c2`; CI PÓS-PUSH APROVADA |
| ATUAL-18 | MP-35C | Sete rotas de Propriedades, vínculos e Localidades, privilégios, cursores, D13 e concorrência | PASSOU NA RODADA AUTOMATIZADA INTEGRAL; AUDITADA INDEPENDENTEMENTE; INTEGRADA EM `e6789bf`; CI PÓS-PUSH E CONFIRMAÇÃO PÓS-INTEGRAÇÃO APROVADAS |

Em 2026-08-17, uma nova evidência física confirmou que o ponto do Caderno era
persistido com latitude, longitude, precisão e horário corretos, mas a primeira
centralização podia se perder enquanto a WebView do mapa terminava de iniciar.
O comando agora é repetido depois da estabilização do mapa, com cancelamento do
temporizador ao remontar a camada. O APK corrigido foi instalado preservando
sessão e dados, e o caminho `Caderno > registro com ponto > Ver no mapa` passou
na repetição manual no Android.

Na mesma verificação, o ponto persistido reapareceu sem rede e partes já
visitadas do mapa-base continuaram visíveis em alguns níveis de zoom. Isso é
somente evidência parcial: o Caderno do mock usa armazenamento local, enquanto
o mapa-base depende de cache oportunista da WebView e não constitui pacote
offline completo. A repetição offline integral continua pendente.

Na verificação física de 2026-08-17, a fonte ampliada não apresentou corte ou
inacessibilidade bloqueante nos fluxos percorridos. Variações específicas de
aparelho, conteúdo real e escalas extremas permanecem como risco residual para
feedback de uso. Texto secundário encurtado pode ser refinado depois; botão,
campo, estado ou dado essencial inacessível continua sendo falha de release.
Na mesma rodada, o percurso orientado com TalkBack passou no dispositivo
conectado; a ampliação para outros modelos continua pertencendo à matriz de
release.

## Rodada final do mock v2

Status: EXECUTADA PARCIALMENTE, SEM BUG ABERTO.

| Grupo | Resultado |
|---|---|
| Atualização sem limpar armazenamento | Passou |
| Usuários ativos, pendentes e inativos | Passou |
| Propriedade sem Talhões, inativa e vínculo inativo | Passou |
| Estados de Visita e comandos terminais | Passou |
| Tipos, estados e visibilidade do Caderno | Passou após correção |
| Períodos, Plantio e Colheita | Passou |
| PNG, PDF ou ZIP ausente e Material restrito | Passou após correção |
| Talhão lógico sem geometria | Passou após correção |
| Regressão principal ATUAL-01 a ATUAL-05 | Passou; mídia e exportação integrais não foram repetidas |
| Retrato, paisagem, teclado, reinício, TalkBack e offline | Parcial; TalkBack e offline continuam pendentes |

## Cenários que devem ser repetidos antes do release

1. atualizar o APK sem desinstalar e confirmar preservação do snapshot;
2. testar login e bloqueio dos três perfis e estados de usuário;
3. repetir câmera, galeria, limites, persistência e exportação;
4. abrir Propriedade, Visita, Caderno e Material por lista e rota direta;
5. testar recurso autorizado, fora de escopo, inativo e ausente;
6. testar estado vazio de Propriedade e Talhão sem geometria;
7. reiniciar sem rede e observar quais dados abrem e quais dependências são
   informadas;
8. testar retrato, paisagem, teclado aberto, fonte ampliada e TalkBack;
9. inspecionar logs para fatal, ANR, token, sessão ou dado pessoal;
10. registrar cada falha como BUG, LIMITAÇÃO DO MOCK ou EVIDÊNCIA PENDENTE.

Na revalidação de Visitas, concluir uma agendada pela tela completa, voltar ao
detalhe e conferir os dados; depois corrigir mais de um campo de uma realizada
com um único motivo e confirmar o antes/depois no histórico. Complementar,
cancelar e anular devem continuar como ações curtas.

Na revalidação de desempenho, percorrer do início ao fim Propriedades, Visitas
e Caderno; usar busca, filtros e atualização por gesto; abrir um item no meio
da lista e voltar; alternar entre as três abas e confirmar que filtros e
posição permanecem. Observar cartões em branco, saltos de rolagem, duplicidade
e demora perceptível na troca de abas.

Na execução física de 2026-08-12, esse roteiro passou. Após o percurso completo,
o processo manteve 1.629 views contra 4.386 na medição anterior à otimização.
Não houve fatal, ANR, falta de memória nem bloqueio longo novo da thread
JavaScript. A passagem pelo mapa manteve uma WebView e elevou temporariamente o
PSS a cerca de 408 MB; após reinício controlado, sem limpar sessão ou dados, o
app restaurou o Dashboard com 171 views, nenhuma WebView e cerca de 178 MB.

Na revalidação da exclusão administrativa, usar um Usuário temporário diferente
da sessão atual; cancelar a primeira confirmação e conferir que nada mudou;
confirmar na segunda tentativa; verificar a remoção da lista e a recusa do login
com a credencial anterior. Propriedades e registros operacionais devem
permanecer. No próprio Usuário administrador conectado, a exclusão deve estar
bloqueada.

Na execução física de 2026-08-12, o cenário passou: a confirmação pôde ser
cancelada sem alteração; a exclusão removeu o Usuário temporário, sua credencial
local e o vínculo direto; o login anterior foi recusado e as Propriedades foram
preservadas.

Na revalidação do Produtor autorizado, entrar como Altair, abrir `[QA]
Propriedade Cenários Operacionais` e confirmar Talhão, Safra/Safrinha, Caderno
visível e Materiais publicados. O ZIP restrito à equipe e o material em
rascunho não podem aparecer. O PDF indisponível pode aparecer, mas deve informar
honestamente que o arquivo não está disponível. A Fazenda_Backes deve continuar
acessível e nenhuma ação estrutural deve ser exibida.

Na revalidação administrativa dos vínculos, entrar como Admin, editar `[QA]
Propriedade Cenários Operacionais` e abrir `Produtores autorizados`. Confirmar
que o Titular não aparece, buscar Altair por nome ou e-mail, desmarcá-lo e
salvar. No detalhe administrativo do Altair e no detalhe da Propriedade QA, ele
não deve mais ser contado ou apresentado como vinculado. Na sessão do Altair,
a Propriedade QA deve desaparecer também de `Perfil > Minhas Propriedades`, e
Fazenda_Backes deve permanecer. Reiniciar o app sem limpar os dados e repetir a
consulta com a sessão restaurada. Voltar como Admin, marcar Altair novamente e
salvar; uma nova sessão do Altair deve recuperar a Propriedade QA sem criar
vínculo duplicado.

Na execução física de 2026-08-12, o cenário passou após a correção das
projeções de vínculo atual: o vínculo inativo deixou de aparecer no Perfil do
Altair e nas telas administrativas, a Propriedade própria permaneceu acessível
e a reativação recuperou a Propriedade autorizada sem duplicidade.

Na revalidação `ATUAL-13`, executar na ordem:

1. como Colaborador, abrir uma Propriedade e tocar em `Nova Visita`; confirmar
   que a mesma Propriedade já vem selecionada, bloqueada e que o registro volta
   para o contexto correto. Pela aba global de Visitas, confirmar que a seleção
   continua livre somente entre Propriedades autorizadas;
2. dentro da mesma Propriedade, abrir `Novo Caderno` e `Nova Safra/Safrinha` e
   confirmar o mesmo contexto canônico bloqueado. Repetir um acesso por Mapa ao
   novo Caderno para cobrir a leitura compatível da rota;
3. salvar um Caderno como rascunho, voltar ao detalhe da Propriedade e confirmar
   que ele reaparece apenas para o autor. No detalhe do rascunho, continuar a
   edição, salvar novamente e depois testar o descarte com cancelamento e com
   confirmação em um segundo rascunho;
4. enviar um registro, abrir `Ações auditáveis > Editar dados`, trocar o tipo e
   preencher os campos dependentes apresentados (Safra/Safrinha, Talhão ou
   dados operacionais), além de alterar outro campo com um único motivo.
   Confirmar antes/depois no histórico; o registro original deve permanecer
   preservado e não pode oferecer exclusão nem sobrescrita direta;
5. em Nova/Editar Visita e Caderno, abrir data, trocar por meses com quatro,
   cinco e seis semanas visuais, tocar no ano e confirmar a faixa uniforme de
   2000 a 2100. A altura do modal deve permanecer estável, sem espaços vazios;
   dias adjacentes aparecem em tom secundário e a regra mínimo/máximo continua
   protegida na escolha do dia. Abrir horário e confirmar que a hora e o minuto
   atuais/selecionados aparecem visíveis sem rolagem inicial;
6. focar os últimos campos de texto de Visita, Caderno, Propriedade, Usuário e
   Safra/Safrinha. Com o teclado aberto, o campo e o texto digitado devem ficar
   visíveis; arrastar a tela deve dispensar o teclado sem bloquear botões.

Na execução física de 2026-08-17, o cenário passou após os ajustes finais do
calendário e da edição auditada do Caderno. A faixa de 2000 a 2100, a grade
mensal estável, os campos dependentes do tipo, a remoção da ação de complemento
e os demais itens de `ATUAL-13` foram confirmados no Android sem limpar os
dados.

## Cenários HTTP da MP-34 antes do release

Com backend real e duas identidades sintéticas, repetir:

1. listar por `estado`, paginar por cursor e reconciliar contador pelo mesmo
   filtro;
2. marcar uma entrega e todas as elegíveis como lidas, atualizar a tela e
   confirmar persistência do primeiro horário e do corte do servidor;
3. repetir resultado de transporte ambíguo com a mesma `Idempotency-Key` e
   confirmar que ação nova após sucesso usa chave nova;
4. descartar uma entrega, atualizar e confirmar que ela não reaparece;
5. resolver destino `conta`, revalidar a sessão e só então abrir a própria conta;
6. trocar Usuário/organização ou avançar o epoch com requisições pendentes e
   confirmar que lista, contador, cursor e navegação antigos não reaparecem;
7. tentar acessar entrega de outro destinatário/organização e observar o mesmo
   `404`, sem confirmação de existência;
8. retirar a rede e confirmar indisponibilidade honesta, sem cache persistente,
   fila offline ou fallback para o mock;
9. inspecionar o grafo/runtime HTTP para ausência de `NotificacaoContext`,
   `NOTIFICACOES_INICIAIS`, `src/api`, `AsyncStorage`, push e token de
   dispositivo; confirmar que o Demo continua intacto.

Os gates automatizados correspondentes passaram. O corte funcional exposto na
interface foi executado no Android físico em 2026-08-24 e está detalhado em
`MP34-07`. Paginação com mais de uma página, repetição após transporte ambíguo
com a mesma `Idempotency-Key` e `404` direto entre destinatários continuam
comprovados pelas suítes HTTP/de integração, não por uma tela que não expõe
esses mecanismos; essa cobertura não é promovida a física por inferência.

## Cenário de convergência visual anterior à MP-35

Com backend/PostgreSQL reais e ao menos duas identidades sintéticas:

1. abrir a variante HTTP e confirmar o login no padrão visual aprovado, sem
   acesso rápido demonstrativo;
2. autenticar e verificar cabeçalho, avatar, barra inferior e badge sem conteúdo
   ou identidade do Demo;
3. em Propriedades, conferir cartões, busca enviada ao servidor, filtros de
   status/UF/Município, limpeza, gesto de atualização, estado vazio e cursor;
4. abrir uma Propriedade autorizada e conferir somente nome, localização,
   Titular, área, cultura, status e tipo de acesso reais; Talhões, mapas,
   Visitas, Caderno, Materiais e métricas não podem ser simulados;
5. abrir Perfil, trocar entre suas ações reais e voltar sem perder a identidade;
6. abrir Notificações, alternar filtros, ler, descartar e resolver destino
   `conta`, preservando os gates da MP-34;
7. trocar de Usuário e confirmar que lista, badge, filtros, respostas tardias e
   destino da identidade anterior não reaparecem;
8. interromper a API e confirmar indisponibilidade honesta, sem cache
   persistente nem fallback demonstrativo;
9. repetir o Demo e confirmar login rápido, dados locais e telas ainda
   demonstrativas preservados em seu identificador separado.

O cenário passou em 2026-08-24 no TCL 8483A, Android 15/API 35, ARM64, tela
800×1280 e conexão USB. A primeira execução revelou que a barra inferior usava
altura fixa e ocupava a área de gestos do Android. Depois da correção
compartilhada por `useSafeAreaInsets`, os alvos das abas ficaram entre
`y=1162–1238`, acima da área gestual, e os toques no centro passaram nas três
abas HTTP e nas seis abas do Demo.

Na composição HTTP também passaram login conectado, lista, busca, filtros,
estado vazio, detalhe de Propriedade, Perfil, sessões, Notificações, troca de
identidade e indisponibilidade honesta sem fallback. O Demo foi instalado sob
seu identificador separado, preservou login rápido e dados locais. A massa
física de Propriedades não produziu uma segunda página; cursor continua coberto
pela automação e não é promovido a evidência física por inferência. O corte foi
integrado diretamente à branch `backend` no commit `e47bb02`, e os três jobs da
CI pós-push foram aprovados. Não houve tag, deploy, release ou publicação.

## Correção focal do recibo de convite — 2026-09-08

Executada em `fix/mp35b-recibo-convite`, base `origin/backend` em `c40e8fa`,
com Node.js 24.19.0 no backend, Node.js 22.20.0 na raiz e PostgreSQL/PostGIS
real `postgis/postgis:17-3.5` via Testcontainers. Somente bancos efêmeros
`_test`, com as três travas de teste destrutivo; nenhum banco persistente foi
inspecionado ou migrado. Nenhum arquivo do aplicativo foi alterado.

| Validação | Resultado |
|---|---|
| migrations:verify | 10/10 |
| migrations:verify-base -- --base-ref origin/backend | 10/10; 000001–000009 intactas |
| Backend typecheck, build, smoke:dist | PASSOU |
| Unitários e contratos | 189/189 |
| HTTP e OpenAPI | 40/40 |
| Integração completa PostgreSQL/PostGIS | 107/107; zero skips/cancelamentos |
| Raiz typecheck e test:domain-compat | PASSOU |
| git diff --check | PASSOU |
| Links locais do núcleo ativo e READMEs | 87/87 em 30 arquivos; zero quebrados |

A suíte real inclui emissão inicial e substituição com bearer e LOGIN
runtime, `201`, os quatro campos exatos do recibo do Usuário, versão corrente
sem incremento, GET com mesmo ID/versão, auditoria referenciando Usuário,
replay sem efeitos adicionais, outro pedido com a mesma chave em `409`,
aceite público em `204` e replay preservado depois da ativação. Uma falha
diferida no COMMIT confirma rollback de substituição, desafio, outbox,
auditoria e recibo, seguido por retry bem-sucedido da mesma chave.

`000010` passou por up/down/up real e falha induzida após DDL; OIDs, owners,
SECURITY DEFINER, search_path e ACLs foram comparados. PUBLIC permanece sem
EXECUTE e LOGIN runtime sem DML administrativo direto. Os preflights
bloqueiam legados de 1, 89 e 91 dias e downgrade com recibo novo retido,
preservando exatamente dados e replay. A regressão completa MP-35B/C inclui
RBAC, sessões, concorrência, outbox e as migrations anteriores.

Durante a implementação foram corrigidos a importação da guarda do serviço,
o tipo UUID do helper, a sintaxe da constraint nova e o campo do teste de
aceite (`senha`). As validações correspondentes foram reexecutadas e passaram.
O runner inicialmente recebeu `spawn EPERM` no sandbox; os testes passaram
na execução autorizada com acesso ao Docker e aos subprocessos. A primeira
tentativa de verify-base não iniciou por nome de log inválido no Windows;
a execução explícita contra `origin/backend` passou.

O corte permanece local, pronto para revisão independente. Não houve commit,
push, deploy ou publicação; MP-35D-4 não foi iniciada. O procedimento futuro
para recibos incompatíveis está no [README do backend](../../backend/README.md).

SHA-256 da `000010` (UTF-8/LF):
`b46325e4acd773f18f7c5a5fba7790251ceda812a6459c82f8cf8c86e27352cf`.

Arquivos deste corte (23):

| Diretório | Arquivos alterados ou criados |
|---|---|
| `backend/` | `README.md` |
| `backend/migrations/` | `000010-alinhar-recibo-convite-administrativo.sql` (novo), `manifest.json` |
| `backend/src/administration/` | `contracts.ts`, `postgres-user-repository.ts`, `user-routes.ts`, `user-service.ts`, `validation.ts` |
| `backend/tests/http/` | `administrative-user-routes.test.ts` |
| `backend/tests/integration/` | `administrative-user-e2e.integration.test.ts`, `migrations.integration.test.ts`, `invitation-receipt-migration.integration.test.ts` (novo) |
| `backend/tests/migrations/` | `mp33b-schema-contract.test.ts` |
| `backend/tests/unit/` | `administration-contracts.test.ts`, `administrative-user-service.test.ts`, `invitation-receipt-repository.test.ts` (novo) |
| `docs/project/` | `contrato-administracao-mp35.md`, `contrato-api-rbac.md`, `estado-atual.md`, `pendencias-de-definicao.md`, `proximos-passos.md`, `smoke.md`, `testes-contrato-api-rbac.md` |

## Cenários HTTP da MP-35B antes da MP-35D

Com PostgreSQL real, Admin ativo e identidades sintéticas, repetir:

1. listar e detalhar Usuários com filtros, busca literal e cursor, sem expor
   credencial, token, desafio ou payload da outbox;
2. criar Produtor e confirmar Usuário pendente, cadastro Produtor inativo,
   convite/desafio/outbox/auditoria e recibo na mesma transação;
3. repetir a criação com a mesma `Idempotency-Key` e corpo e obter o mesmo
   status/recibo; reutilizar a chave com outro corpo e obter `409`;
4. trocar o e-mail de Usuário pendente e confirmar revogação/cancelamento do
   convite, desafio e outbox anteriores antes do convite substituto;
5. tentar trocar e-mail de ativo/inativo, ativar sem credencial, inativar o
   próprio Admin ou Produtor Titular de Propriedade ativa e confirmar recusa;
6. inativar outro Usuário ativo e confirmar avanço único da versão e revogação
   de sessão/access/refresh; reativar somente com credencial ativa;
7. reemitir convite somente com `modo_ativacao=ativar_usuario`; campo
   desconhecido retorna `400` e modo histórico retorna `422`;
8. confirmar que Colaborador/Produtor não acessam `/v1/usuarios`, que a emissão
   antiga em `/v1/auth/invitations` não existe e que o aceite público continua
   em `/v1/auth/invitations/accept` com `204`;
9. provocar falha depois da reserva e confirmar rollback sem Usuário, convite,
   auditoria ou linha idempotente `processando` órfã.

Os cenários automatizados correspondentes receberam a correção focal e passaram
na rodada integral de 2026-08-27. A MP-35B não expõe tela na composição HTTP;
por isso nenhum cenário é promovido a evidência física. A validação Android
administrativa continua reservada à MP-35D.

## Retomada administrativa após 403 — MP-35D-3, 2026-09-10

Cenário permanente com tela e React Navigation reais: criar Usuário, aceitar
recibo, falhar o GET, receber `403` na recuperação, revalidar Admin por
`/v1/auth/me` na mesma partição, desmontar e abrir nova criação com dados novos.
Executar com e sem GET administrativo incidental. O novo submit deve levar o
total de POSTs de um para dois, usando chave idempotente nova, e concluir/navegar
uma vez. Callbacks e respostas antigos permanecem inertes depois da retomada e
da conclusão nova; montagem antes da revalidação não restaura acesso.

Resultado automatizado da rodada anterior: **PASSOU**, após reprodução de `1 !== 2`
nas duas variantes. A suíte D-3 passou em 86/86, incluindo rotina sem limpeza
indevida, dois ciclos de retomada e casos negativos de sessão/concorrência.
Detalhes e composição estão na [matriz de testes](testes-contrato-api-rbac.md).

A reauditoria daquela rodada aprovou essa retomada sequencial, com e sem GET incidental.
Os 86 casos são a referência anterior. Naquele momento D-3 não estava formalmente aprovada;
D-4 não foi iniciada. Smoke Android físico,
build de release e liberação produtiva: **NÃO EXECUTADOS** nesta rodada.

### Concorrência de /me e Cancelar antigo — nova rodada de 2026-09-10

Repetir o cenário acima iniciando `/me` A antes do `403` e B após ele. Entregar
A e B nas duas ordens, com B Admin, Produtor e Colaborador. A nunca deve retomar
acesso; B Admin válida libera nova criação na mesma partição, com e sem GET
incidental, sem terceiro `/me`. B Produtor/Colaborador deve retirar rotas, dados
e drafts administrativos. Nova invalidação após capturar B deve impedir retomada.

Capturar Cancelar antes de descartar a criação antiga; após a retomada, preencher
nova criação e invocar o callback antigo. A chave da nova rota, seu draft e o
total de requisições devem permanecer intactos. Cancelar atual deve navegar
normalmente, inclusive após recibo confirmado. Cobrir o Cancelar da edição e
Voltar das quatro telas do componente, inclusive com origem ainda montada sob
outra criação de chave distinta.

Resultado automatizado: **PASSOU**, com sessão, runtime e React Navigation reais
e respostas deferred. Os achados falharam antes do reparo e passaram depois;
D-3 agora soma 106/106. Composição e demais checks estão na
[matriz de testes](testes-contrato-api-rbac.md).
Estado ao término daquela implementação: **Correções de concorrência de /me e
Cancelar implementadas, aguardando reauditoria independente**. Naquele momento
D-3 estava sem aprovação formal; D-4 não iniciada. Smoke
Android físico, build de release e liberação produtiva: **NÃO EXECUTADOS**.

### Parecer independente final da MP-35D-3 — 2026-09-10

**APROVADA PARA COMMIT DO MP-35D-3**, cobrindo HEAD + worktree e as correções
anteriores, preservadas e verificadas. Nenhum achado obrigatório remanescente
ou evidência crítica pendente nesse parecer.

Executado pelo auditor independente: typecheck passou; MP-35D-1 52/52;
MP-35D-2 85/85; MP-35D-3 106/106; MP-33C 46/46; domain-compat e
`git diff --check` passaram. Essas execuções pertencem à auditoria; o fechamento
documental não as repete nem altera código/testes aprovados.

MP-35D segue em andamento; D-4 não iniciada; integração final na `backend`
posterior. Smoke Android físico, build de release e validação produtiva:
**NÃO EXECUTADOS**. O fechamento da D-3 não libera produção ou release.

## Cenários de campo de MP-38

- posição dentro de Talhão;
- posição fora de Talhão;
- posição próxima do limite;
- precisão boa e ruim;
- permissão negada;
- localização desligada;
- timeout e cancelamento;
- operação sem rede;
- confirmação de que não existe rastreamento em background.

## Regras de resultado

- PASSOU exige execução observável e resultado esperado.
- NÃO EXECUTADO nunca pode ser marcado como passou por inferência.
- LIMITAÇÃO DO MOCK descreve uma fronteira conhecida, não um bug corrigido.
- BUG exige reprodução, menor correção responsável e repetição do cenário.
- Mudança de backend exige testes de API e banco; este smoke local não comprova
  segurança produtiva.

## Baseline automatizada

### Evidência da MP-33A em 2026-08-18

| ID | Cenário executável | Resultado |
|---|---|---|
| MP33A-01 | Node.js 24: manifesto, typecheck, 38 testes unitários, 5 HTTP, build e carga do ESM compilado | PASSOU |
| MP33A-02 | Testcontainer `postgis/postgis:17-3.5`: 12 cenários de migration, constraints, concorrência e rollback | PASSOU |
| MP33A-03 | Compose local: banco saudável, `up`, backend compilado, health/readiness/OpenAPI, `down` e limpeza dos recursos temporários | PASSOU |
| MP33A-04 | Aplicativo em Node.js 22: typecheck e `test:domain-compat`, sem alteração do mock | PASSOU |

Essa rodada valida a fundação local da MP-33A; não representa deploy,
autenticação, RBAC produtivo nem integração HTTP do aplicativo.

### Evidência da MP-33B em 2026-08-19

| ID | Cenário executável | Resultado |
|---|---|---|
| MP33B-01 | Node.js 24.19.0: manifesto e comparação append-only das 4 migrations, typecheck, 114 testes unitários/contratos de DDL, 19 HTTP, build e smoke ESM da API, servidor, worker, bootstrap e parser break-glass fail-closed | PASSOU |
| MP33B-02 | Integração destrutiva sem `NODE_ENV=test` e `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true` | PASSOU — bloqueada pela guarda antes de abrir o banco |
| MP33B-03 | Testcontainer `postgis/postgis:17-3.5`: 27 cenários com as duas flags e banco gerado terminado em `_test`, cobrindo migrations, repositórios, papéis de menor privilégio, guards por `SESSION_USER`, estado final diferido, concorrência e rollback | PASSOU |
| MP33B-04 | Compose local: Postgres e Mailpit saudáveis, entrega SMTP real pelo worker, auditoria gravada, payload criptografado removido e limpeza dos recursos temporários | PASSOU |
| MP33B-05 | Aplicativo em Node.js 22: typecheck e `test:domain-compat`, sem alteração nem conexão do mock | PASSOU |
| MP33B-06 | Dependências produtivas do backend: `npm audit --omit=dev` | PASSOU — 0 vulnerabilidades conhecidas na execução |

A rodada conclui tecnicamente a MP-33B, mas não a libera para produção. MFA de
Admin, política operacional de identidade, SMTP e segredos produtivos,
benchmark Argon2id no ambiente-alvo, backup/restauração e observabilidade
continuam portões. Break-glass não está implementado; Ed25519 ou serviço externo
equivalente com dois aprovadores é requisito anterior a essa futura capacidade.
Não houve commit, tag ou deploy nesta execução.

### Evidência da MP-33C em 2026-08-21

| ID | Cenário executável | Resultado |
|---|---|---|
| MP33C-01 | Node.js 24: manifesto, typecheck, 126 testes unitários/contratos, 23 HTTP, build e smoke ESM | PASSOU |
| MP33C-02 | Testcontainer `postgis/postgis:17-3.5`: 36 cenários de autorização, filtros, cursor, fixtures e privilégios | PASSOU |
| MP33C-03 | Node.js 22: typecheck, `test:domain-compat` e 38 focados — 8 contratos, 25 sessão/concorrência e 5 arquitetura | PASSOU |
| MP33C-04 | Bundles HTTP/Demo, Autolinking, grafo Android e prebuild temporário inspecionados separadamente | PASSOU |
| MP33C-05 | PR #2 integrado em `cc78a9f` e CI pós-merge da branch `backend` | PASSOU |

O fechamento da MP-33C preservou o mock apenas no Demo/testes e confirmou que o
aplicativo HTTP não possui fallback. Não houve tag, deploy, release ou
publicação.

### Evidência da MP-34 em 2026-08-24

| ID | Cenário executável | Resultado |
|---|---|---|
| MP34-01 | Node.js 22: typecheck, `test:domain-compat` e `test:mp34` com 10 contratos, 12 repositório e 13 arquitetura; 5 gates comportamentais — 2 open gate + 3 context coordinator | PASSOU — 35/35 |
| MP34-02 | Node.js 24: manifesto, typecheck, 138 testes unitários/contratos de migration, 26 HTTP, build e smoke ESM | PASSOU |
| MP34-03 | Testcontainer: 41 cenários reais — 15 migrations, 8 autenticação, 7 ações de conta, 9 Propriedades/QA e 2 notificações | PASSOU |
| MP34-04 | Grafo HTTP sem mock legado, `src/api`, `AsyncStorage`, push ou token de dispositivo; Demo preservado | PASSOU |
| MP34-05 | Integração direta na branch `backend` pelo commit `e787707` e três jobs da CI pós-push | PASSOU |
| MP34-06 | Node.js 24: cinco migrations e `000005` append-only comparadas com o commit-base anterior `3dd8f42` | PASSOU |
| MP34-07 | TCL 8483A, Android 15/API 35, ARM64 e USB: variante HTTP debug com backend/PostgreSQL reais; login de duas identidades; estado vazio; evento de senha; badge, lista e filtros; destino `conta`; leitura individual e em lote; persistência após reinício/reautenticação; descarte; isolamento entre destinatários; indisponibilidade honesta sem API/mock | PASSOU |

No aparelho, duas trocas autenticadas de senha produziram duas entregas reais
`conta.senha_alterada.v1` para o primeiro Usuário. A senha sintética foi
restaurada ao valor inicial da fixture. O PostgreSQL confirmou duas entregas,
ambas lidas e uma descartada; a segunda identidade abriu a lista vazia, sem
badge ou conteúdo do primeiro destinatário. Todas as chamadas observadas da
vertical conectada concluíram com sucesso; ao remover apenas o túnel da API, o
aplicativo ocultou os dados e informou que não conseguiu confirmar a renovação,
sem cache persistente ou fallback para o mock.

A execução física não criou massa suficiente para paginação por cursor e não
simulou transporte ambíguo nem acesso direto por ID de outro destinatário. Esses
três mecanismos permanecem cobertos pelos testes HTTP/de integração já
registrados em `MP34-02` e `MP34-03`.

A rodada valida tecnicamente migration `000005`, cinco fluxos emissores
transacionais para três tipos de evento, API self-only, idempotência, conteúdo
seguro, retenção exata de 90 dias, purga one-shot e composição HTTP. Ela não
comprova operação produtiva da purga, revisão jurídica/de privacidade,
observabilidade, backup/restauração ou release.

A MP-34 foi integrada diretamente à branch `backend` no commit `e787707`, sem
pull request e com CI pós-push aprovada. Não houve tag, deploy, release ou
publicação.

### Evidência automatizada da MP-35A em 2026-08-25

O portão `ATUAL-16` exige aplicação `000005 -> 000006`, rollback/reaplicação em
banco efêmero, preflight atômico sem Admin ativo, compatibilidade de convite
histórico, convite novo `ativar_usuario`, ativação conjunta de Produtor,
ativação sem credencial negada ao runtime, incremento unitário de versões,
preservação de timestamps, catálogo IBGE imutável e concorrência com duas
conexões e barreira de lock observada em `pg_stat_activity`. Também exige
typecheck/build/smoke do backend, testes HTTP, typecheck/compatibilidade do app,
integridade das migrations, links ativos e `git diff --check`.

A rodada focalizada passou em oito cenários adversariais com
login runtime real, `current_user=session_user`, função estreita de ativação de
Produtor, rollback integral, vínculo ator-sessão, purga por papel exclusivo e
concorrência com barreira. A rodada completa aprovou typecheck/compatibilidade
do aplicativo, typecheck/build do backend, 152 testes unitários/contratos, 26
HTTP, 54 integrações reais, `up/down/reaplicação`, smoke do artefato, integridade
das sete migrations, links ativos e higiene do diff.

A MP-35A foi integrada diretamente à branch `backend` no commit `a51389e`, e
os três jobs executados da CI pós-push foram aprovados. Não houve tag, deploy,
release ou publicação.

Como a MP-35A não altera tela, navegação nem artefato mobile, ela não cria novo
teste físico. A validação Android física pertence à MP-35D; o smoke físico
anterior de convergência permanece como baseline e não é reapresentado como
evidência da fundação de banco.

### Evidência automatizada da MP-35B em 2026-08-27

A cobertura automatizada focada já executada usa um LOGIN PostgreSQL runtime
real e confirma `current_user=session_user`, papel não-superuser e não-owner,
DML administrativo direto recusado e as quatro mutações funcionando apenas
pelas interfaces estreitas. Ela também confirma criação de Admin, Colaborador
e Produtor, sincronização de nomes, auditoria com motivo, versão de Produtor
estável sem alteração real, revogação de sessões, idempotência e rollback
atômico.

`administrative-user-e2e.integration.test.ts` atravessa bearer, autenticação,
revalidação de sessão, RBAC, cada uma das seis rotas, serviço e PostgreSQL com
o login runtime. A matriz focal contém exatamente as seis rotas para Admin,
ausência de autenticação, sessão stale, Produtor e Colaborador, além de alvo
inexistente, códigos HTTP, JSON malformado, enum, limite, conflito de versão,
idempotência e e-mail duplicado. Isolamento entre organizações não se aplica ao
modelo singleton atual e não é apresentado como automatizado.

`administrative-user-repository.integration.test.ts` observa PIDs e
`wait_event` em PostgreSQL para as corridas de idempotência com corpo igual e
diferente, mesma versão de cadastro, e-mail, convite, status e Produtor versus
ativação da Propriedade. A mesma suíte prova a expiração efetiva enquanto o
worker espera pelo lock, preservando os dois ordenamentos anteriores. Os testes
de cursor cobrem vazio, excesso formal, truncamento, malformação, adulteração e
versão desconhecida; Unicode N/N+1 cobre e-mail e nome após NFC, inclusive
fora do BMP. A suíte de notificações comprova também ACL do runtime e de
`PUBLIC`, criação/deduplicação derivadas do `INSERT`, replay sem nova auditoria,
resolução negada autenticada, sessão inválida, wrappers isoladas recusadas e
rollback atômico. A rodada integral aprovou typecheck e compatibilidade na raiz;
manifesto e comparação append-only com `fb7cfb0`; typecheck, build e smoke ESM
do backend; 166 unitários/contratos, 33 HTTP e 74 integrações
PostgreSQL/PostGIS; ciclo explícito `000008 up/down/up`; links locais e higiene
do diff. A reauditoria independente aprovou o resultado, integrado diretamente
no commit `60144c2`, com CI pós-push aprovada. Isso não autoriza tag, deploy,
release ou publicação. A MP-35C foi integrada diretamente no commit `e6789bf`,
com CI pós-push aprovada, foi auditada independentemente e recebeu confirmação
pós-integração aprovada; a MP-35D não foi iniciada.

### MP-35C concluída, auditada e integrada no backend

Validar as sete rotas Admin-only, os dois cursores exclusivos, a migration
`000009` em ciclo up/down/up, DML adversarial com login runtime real,
idempotência, rollback atômico, concorrência observável, D13, revogação de
sessões/tokens, OpenAPI e regressão completa. Não executar MP-35D, aplicativo,
deploy ou publicação neste corte.

No corte focal, validar ainda: precedência estrutural `400` antes da semântica
`422`; UUID v4 minúsculo/RFC em HTTP e SQL; catálogo sensível idêntico em TS,
MP-35B e MP-35C; `area_total` como string decimal exata em HTTP, domínio e SQL,
incluindo a matriz de tipos/formato/faixa e LF, CR, CRLF, U+2028 e U+2029;
decoder integral antes do `COMMIT`
com rollback real; Testcontainers em processos simultâneos com portas
dinâmicas e sem lock global; `22023` allowlisted como `422` e falha inesperada
como `503`; e os dois ordenamentos Titular × ativação.
Cada ordenamento deve repetir três vezes com dois PIDs e espera advisory
observada antes de liberar a barreira.

Rodada integral de 2026-08-31: esses itens possuem evidência verde, incluindo
186 testes unitários/contratos, 40 HTTP e 100 integrações. A suíte PostgreSQL
completa passou 100/100 em três execuções consecutivas; em cada execução, os
três processos de Testcontainers iniciaram de forma sobreposta, obtiveram
portas, bancos e containers distintos e encerraram sem `EADDRINUSE`. Cada ordem
da corrida de domínio repetiu três vezes, com espera `Lock:advisory` observada
em `pg_stat_activity`. A implementação foi integrada no commit `e6789bf`, com
CI pós-push aprovada. A auditoria independente e a confirmação pós-integração
foram aprovadas.

Correção focal de 2026-08-31: a gramática TypeScript/OpenAPI passou a usar
fim absoluto `(?![\s\S])`, sem `$`, `trim` ou limpeza prévia. Domínio, HTTP e
PostgreSQL rejeitaram LF, CR, CRLF, U+2028 e U+2029, com snapshots sem reserva,
recibo, mutação, versão, auditoria ou revogação. O teste que inicia duas
operações rejeitadas agora associa ambos os `assert.rejects` no mesmo turno por
`Promise.all`. Sob `NODE_OPTIONS=--unhandled-rejections=strict`, passaram 20/20
execuções consecutivas do teste PostgreSQL focal, 5/5 da suíte MP-35C com
61/61 testes por rodada e 3/3 da integração completa com 100/100 por rodada,
sem falha, cancelamento, warning de Promise ou rerun corretivo.

### Comandos gerais

Antes e depois de mudança de código:

- npm run typecheck
- npm run test:mp34
- npm run test:domain-compat

No backend, em Node.js 24:

- npm run migrations:verify
- npm run typecheck
- npm run test:unit
- npm run test:http
- npm run test:integration
- npm run build
- npm run smoke:dist

Acrescente testes focados da vertical. Para mudança somente documental, valide
links locais e execute git diff --check.
