# Smoke Funcional Ativo

> Atualizado em: 2026-08-24
>
> Última execução física registrada: 2026-08-17

Este arquivo contém somente o roteiro ainda útil. Evidências detalhadas e
rodadas anteriores foram movidas para docs/archive.

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
