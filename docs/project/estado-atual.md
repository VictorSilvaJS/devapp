# Estado Atual do Projeto

> Revisão documental: 2026-08-24
>
> Última rodada funcional completa registrada: 2026-08-07

## Resumo executivo

O projeto é um aplicativo Android em React Native com Expo SDK 56. O frontend
está funcional como MVP local e demonstrável, com dados persistidos no
aparelho, três perfis, Propriedades, Talhões, Visitas, Caderno de Campo,
Materiais técnicos e mapas.

O aplicativo ainda não é um produto implantado em produção. A MP-33A introduziu
a fundação do backend e o DDL inicial; a MP-33B acrescentou autenticação
stateful, ações de conta, outbox e auditoria. A MP-33C separa o Demo interno da
composição HTTP, conecta sessão e ações self-service e entrega a primeira
vertical de Propriedades somente leitura com autorização no backend. Ela foi
concluída tecnicamente e integrada à branch `backend` pelo PR #2 no commit
`cc78a9f`; a CI pós-merge foi aprovada.

O mock e seu funcionamento permanecem preservados no Demo e nos testes. A
composição HTTP não contém fallback, módulos, seed, bootstrap ou credenciais do
mock em seus grafos JavaScript e Android. Isso ainda não representa deploy,
release ou loja: não existe ambiente produtivo implantado, domínio oficial
associado, assinatura oficial nem validação final em dispositivo/loja.

A MP-34 acrescenta notificações in-app reais, persistidas e isoladas para fatos
da própria conta. Ela está concluída tecnicamente somente no working tree: não
existe commit, pull request, integração, tag, deploy, release ou publicação da
fase. O smoke Android físico específico da MP-34 permanece `NÃO EXECUTADO`.

## Estado por camada

| Camada | Situação atual |
|---|---|
| Aplicativo Android | Demo local preservado e composição HTTP com sessão, Propriedades e notificações da MP-34; sem release produtivo |
| Dados | Dataset local somente no Demo; HTTP sem seed produtivo e com fixtures manuais protegidas para development/QA |
| Autenticação | Backend MP-33B e cliente HTTP com access em memória/refresh em SecureStore; fator único, sem MFA |
| Autorização | Lista/detalhe de Propriedades autorizados no backend; escritas e demais recursos continuam pendentes |
| API | Health, readiness, OpenAPI, `/v1/auth`, `/v1/propriedades` e `/v1/notificacoes` validados |
| Banco | Quatro migrations integradas e `000005-notificacoes.sql` validada somente no working tree; nenhum ambiente produtivo implantado |
| E-mail | Outbox e worker SMTP validados localmente; Mailpit somente local, sem provedor produtivo definido |
| Arquivos | Importação, consulta e exportação locais; sem storage remoto |
| Offline | Demo mantém leitura local por fluxo; composição HTTP é online-only e não possui fila de sincronização |
| Notificações | Mock local somente no Demo; vertical HTTP in-app persistida, individual, online-only e sem push |
| Testes | MP-34: app Node.js 22 com 35/35 focados; backend Node.js 24 com 138 unitários/migration, 26 HTTP e 41 integrações reais |

## Corte implementado da MP-33C

O comportamento implementado e seus limites estão congelados no
[contrato de integração da MP-33C](contrato-integracao-app-mp33c.md):

- mock mantido no repositório apenas para Demo interno e testes, fora do grafo
  de dependências e do artefato de produção;
- Demo e produção com identificadores e namespaces locais distintos; somente a
  composição HTTP pode ser futura candidata às lojas;
- access token somente em memória, refresh token no `SecureStore`,
  refresh single-flight, nenhum token/sessão HTTP no `AsyncStorage` e nenhum
  fallback para mock;
- proteção visual imediata ao entrar em background, novo login depois de 15
  minutos em background e bloqueio local por inatividade sem logout automático;
- primeira vertical limitada a lista e detalhe somente leitura por
  `/v1/propriedades`, com cursor, filtros no servidor e autorização aplicada no
  backend;
- contrato HTTP exclusivamente `snake_case`, `tipo_acesso` calculado e métricas
  ocultas enquanto não existir agregado autorizado;
- composição HTTP online-only no piloto, sem cache persistente ou sincronização;
- configuração para App Links/Universal Links com caminho dedicado; domínio
  oficial e arquivos de associação continuam obrigatórios antes da aprovação
  produtiva;
- dados sintéticos por Testcontainers e fixture manual protegida somente em
  desenvolvimento/QA, sem seed automático ou produtivo.

Escritas de Propriedade, administração de Usuários/vínculos e RBAC por ação
continuam na MP-35. O segundo e-mail verificado do Administrador e a
recuperação da MP-33B permanecem válidos.

## Fonte de dados ativa

No Demo, o dataset demonstrativo v2 é a fonte estruturada principal instalada
pelo bootstrap. A complementação de QA foi feita no mesmo modelo e no mesmo
snapshot, preservando dados locais existentes.

O runtime ainda projeta dados v2 para adaptadores de compatibilidade usados por
partes da interface. Novos contratos usam propriedade_id. Nomes como
fazenda_id permanecem somente em bordas legadas que ainda precisam ser
removidas gradualmente.

Na última evidência física, o Dashboard mostrou 73 Propriedades, 39 Produtores,
3 Colaboradores, 77 Visitas, 76 Cadernos e 8 Materiais. Esses números são
evidência do dataset local, não volume produtivo.

## Perfis e acesso

- Administrador: visão global dentro da única organização do primeiro contrato.
- Colaborador: acessa somente Propriedades com vínculo direto e ativo.
- Produtor: consulta sua realidade operacional por Titularidade ou vínculo
  autorizado e pode enviar o próprio rascunho de Caderno conforme o contrato.
- Município e UF são localização e filtro; não concedem acesso.
- Regional, Área Operacional, Região e Microrregião não fazem parte do contrato
  canônico v2.

## Fluxos disponíveis no corte local

- login demonstrativo e restauração de sessão local;
- dashboards e navegação para os três perfis;
- consulta e administração mockada de Usuários e Propriedades;
- Propriedades com Talhões, limites e estados vazios controlados;
- Visitas com estados, fotos locais, exportação explícita e telas dedicadas para
  conclusão e correção auditada;
- Caderno com tipos, ciclo local, ponto opcional, controle de visibilidade,
  retomada/descarte do próprio rascunho e correção auditada em tela dedicada;
- listas extensas de Propriedades, Visitas e Caderno com renderização
  virtualizada e estado das abas preservado;
- Períodos produtivos, Plantio e Colheita no recorte local;
- Materiais técnicos PNG, PDF e ZIP com tratamento honesto de indisponibilidade;
- GeoJSON local e mapa de Talhões com localização foreground;
- rotas diretas protegidas pelas regras locais e testes de compatibilidade.

## Limites que não podem ser confundidos com produto pronto

- O cliente ainda pode ser inspecionado ou alterado; segurança exige servidor.
- A composição HTTP não tem ambiente produtivo, domínio oficial, assinatura ou
  publicação; o corte foi validado tecnicamente com configurações de teste.
- A MP-33C é online-only e não possui cache persistente de negócio, restauração
  offline ou fila de sincronização. O offline local continua exclusivo do Demo.
- Mutação offline geral e resolução de conflitos ainda não existem.
- Arquivos não têm upload, criptografia, retenção ou storage remoto definidos em
  execução.
- GeoJSON não possui publicação, versionamento e reconciliação produtivos.
- A composição HTTP possui entrega persistida e isolamento técnico de
  notificações, mas ainda não existe ambiente produtivo, operação agendada da
  purga ou push. O mock global permanece somente no Demo.
- Logs estruturados básicos e CI de fundação não equivalem a observabilidade
  produtiva; backup, restauração e gestão de segredos ainda precisam ser
  implementados.
- A MP-33B permanece sem MFA; conta Administradora não pode ser liberada
  publicamente antes desse portão.
- Recuperação assistida exige política operacional de comprovação de identidade
  e permanece desabilitada por padrão em produção.
- Break-glass não possui start operacional. CLI, schema e continuações são
  scaffold fail-closed e inalcançável, sem script npm, HMAC ou permissão de
  plataforma; perda dos dois e-mails de Admin não é resolvida nesta fase.
- Ed25519 ou serviço externo equivalente com dois aprovadores é pré-requisito
  técnico antes de implementar ou habilitar break-glass.
- iOS não faz parte da primeira entrega produtiva.

## Resultado da última rodada de QA

Os cenários principais do mock v2 passaram sem bug aberto no Android físico.
Foram corrigidos:

- Talhão lógico sem geometria exibido sem polígono inventado;
- PDF local ausente tratado com mensagem honesta;
- estado terminal do Caderno destacado;
- exclusão estrutural de Propriedade restrita ao Administrador;
- nome físico de exportação alinhado ao nome informado pela interface.
- conclusão e correção de Visita reorganizadas em telas dedicadas;
- carga duplicada de Propriedades removida e listas operacionais virtualizadas.
- exclusão administrativa de outro Usuário exposta no detalhe com confirmação,
  remoção da credencial local e dos vínculos diretos, sem apagar Propriedades
  ou registros operacionais.
- acesso do Produtor por vínculo ativo `usuario_autorizado` alinhado entre
  listagem, detalhe da Propriedade, Visitas, Caderno e Materiais liberados.
- criação e edição administrativa de Propriedade com seleção pesquisável de
  Produtores autorizados; vínculo, desvínculo por inativação e reativação são
  salvos atomicamente sem alterar o Titular.
- projeções de vínculo atual alinhadas no Perfil, detalhe de Usuário e detalhe
  de Propriedade: vínculo inativo permanece no histórico local, mas não aparece
  em listas ou contadores atuais. O Perfil também prioriza o cadastro persistido
  mais recente sobre o snapshot restaurado da sessão.
- contexto operacional de Propriedade centralizado nas rotas de Nova Visita,
  Novo Caderno e Safra/Safrinha: produtores emitem `propriedadeId`, consumidores
  priorizam o valor canônico e aliases antigos permanecem somente na leitura;
- rascunho próprio do Caderno volta a aparecer também dentro do detalhe da
  Propriedade, sem expor rascunho de outro usuário;
- calendário reutilizável passa a respeitar limites na escolha do dia, navegar
  por mês e exibir a faixa uniforme de 2000 a 2100; a grade fixa de seis
  semanas mostra dias adjacentes em tom secundário e evita saltos ou espaços
  vazios entre meses; horário selecionado abre visível, com hora e minuto;
- a ação auditável do Caderno aparece como `Editar dados`, permite alterar o
  tipo e apresenta Safra/Safrinha, Talhão e campos operacionais dependentes;
  por baixo, continua emitindo correção versionada com motivo e antes/depois,
  sem sobrescrever o registro enviado;
- a criação de complemento foi retirada do Caderno; complementos já existentes
  permanecem disponíveis somente para leitura histórica compatível;
- formulários roláveis ajustam a área útil ao teclado e trazem o campo focado
  para a região visível.
- o ponto persistido no Caderno volta a ser centralizado após a inicialização
  efetiva da WebView; um segundo envio controlado evita que o comando inicial
  se perca enquanto o mapa termina de montar, sem recapturar nem alterar a
  coordenada salva.

A revalidação física das listas passou. Depois do percurso completo, o processo
manteve 1.629 views, contra 4.386 antes da otimização. Não houve fatal, ANR,
falta de memória nem bloqueio longo novo da thread JavaScript. O mapa deixou uma
WebView residente e elevou temporariamente o PSS a cerca de 408 MB; após
reinício controlado, sem apagar sessão ou dados, o Dashboard foi restaurado com
171 views, nenhuma WebView e cerca de 178 MB.

Continuam como evidência pendente:

- teste real de localização dentro, fora e próximo de Talhão;
- leitor de tela;
- repetição offline completa;
- matriz final de aparelhos, orientação e acessibilidade;
- regressão integral depois da implementação produtiva.

O gerenciamento de Produtores autorizados foi revalidado no Android físico:
vínculo, desvínculo, sessão restaurada, Perfil e reativação passaram sem
duplicidade ou ampliação indevida de escopo.

As últimas complementações de rotas, Caderno, data/hora e teclado passaram por
typecheck, testes automatizados focados e revalidação manual no Android físico
em 2026-08-17, registrada como `ATUAL-13` em `smoke.md`.

Na mesma data, a persistência do ponto do Caderno foi confirmada no aparelho,
mas sua centralização inicial no mapa revelou uma corrida de inicialização. A
correção passou por typecheck, testes focados, suíte `test:domain-compat`, build
release e atualização preservando o armazenamento. A reabertura centralizada
foi confirmada manualmente no Android e `ATUAL-04` voltou a `PASSOU`.

O mesmo ensaio mostrou o ponto do mock persistido sem rede e alguns mosaicos
já visitados disponíveis em certos níveis de zoom. Isso não comprova mapa
offline completo: os dados vetoriais locais continuam disponíveis, mas o
mapa-base remoto depende do cache oportunista da WebView.

O roteiro atual está em [smoke.md](smoke.md).

## Validação da MP-33A

Em 2026-08-18, a fundação passou com Node.js 24.19.0 por instalação limpa,
verificação do manifesto, typecheck, 38 testes unitários, 5 testes HTTP, build
produtivo e smoke do JavaScript ESM compilado. A suíte HTTP comprovou health
independente e readiness recuperável. A integração real executou 12 cenários
com Testcontainers e `postgis/postgis:17-3.5`, incluindo startup sem migration
automática, aplicação e rollback, constraints transacionais, proteção contra
write-skew concorrente, isolamento do schema `public` e preservação do PostGIS.
Um smoke adicional subiu o Compose local, aplicou a migration, abriu o backend
compilado, validou health/readiness/OpenAPI e confirmou o rollback antes de
remover os recursos temporários criados para o ensaio.

O aplicativo permaneceu inalterado e também passou por `npm run typecheck` e
`npm run test:domain-compat`. A validação não criou tag nem realizou deploy.

## Validação da MP-33B

O corte concluído tecnicamente contém novas migrations append-only, credenciais
separadas para runtime, migrations, worker e bootstrap de plataforma,
blocklist versionada, Argon2id com fila limitada, sessões e tokens opacos,
convites, recuperação
comum, troca de e-mail, contato secundário de Admin, recuperação assistida
condicionada, outbox SMTP, auditoria append-only e bootstrap one-shot. A
credencial `platform_ops` é bootstrap-only, com guards por `SESSION_USER` e
estado final diferido; não possui DML de credenciais, sessões, tokens,
recuperações ou break-glass. O parser, schema e continuações break-glass são
somente scaffold inalcançável.

A validação com Node.js 24.19.0 passou em manifesto e comparação append-only
das 4 migrations, typecheck, 114 testes unitários/contratos de migration, 19
HTTP, build e smoke ESM compilado. A integração real passou em 27 cenários com
Testcontainers/PostGIS. O smoke operacional confirmou Postgres, Mailpit,
entrega SMTP real pelo worker, auditoria e remoção do payload criptografado. O
`npm audit --omit=dev` reportou zero vulnerabilidades conhecidas na execução.

O aplicativo permaneceu integralmente no mock e passou em Node.js 22 por
typecheck e `test:domain-compat`. Não houve commit, tag ou deploy.

## Validação da MP-33C

O backend passou com Node.js 24 em verificação do manifesto de migrations,
typecheck, 126 testes unitários/contratos, 23 testes HTTP, build e smoke ESM.
A integração real executou 36 cenários com Testcontainers e
`postgis/postgis:17-3.5`, incluindo autorização, filtros, cursor e fixtures de
QA; Docker esteve disponível e a suíte não foi simulada.

O aplicativo passou com Node.js 22 em typecheck, na suíte completa
`test:domain-compat` e em 38 testes focados da MP-33C: 8 de contrato, 25 de
sessão/concorrência e 5 de arquitetura. Exports Android reais das composições
HTTP e Demo foram inspecionados separadamente; o bundle HTTP não contém os
marcadores, módulos ou `AsyncStorage` do mock, e o Demo preserva sua composição
local. O gate de Expo Autolinking confirmou que módulos nativos exclusivos do
Demo não integram o grafo Android HTTP. O prebuild HTTP temporário confirmou
`com.tcheagro.mobile`, App Link em caminho dedicado, regras de backup do
SecureStore e somente `INTERNET` como permissão efetiva.

O carregador manual de QA é sintético, transacional e fail-closed. Ele exige
ambiente permitido, flag explícita, URL própria para banco `_test`/`_qa` e
senha compatível com a política; não roda em migration, startup ou produção.

O fechamento pós-merge confirmou o PR #2 integrado no commit `cc78a9f` e a CI
da branch `backend` aprovada para o aplicativo em Node.js 22 e o backend em
Node.js 24. Não houve tag, deploy, release, assinatura ou publicação. Ainda
faltam domínio oficial com `assetlinks.json`/AASA, configuração de assinatura e
validação ponta a ponta em aparelho/ambiente de release.

## Validação da MP-34

O aplicativo passou em Node.js 22 no typecheck, `test:domain-compat` e nos 35/35
testes focados de `test:mp34`: 10 de contratos, 12 de repositório e 13 de
arquitetura. A arquitetura inclui cinco gates comportamentais: dois do open gate
e três do context coordinator. O grafo HTTP permanece sem mock legado,
`src/api`, `AsyncStorage`, push ou token de dispositivo; o Demo continua
intacto.

O backend passou em Node.js 24 no manifesto, typecheck, build/smoke e nas suítes
confirmadas de 138 testes unitários/contratos de migration, 26 HTTP e 41
cenários reais de integração: 15 de migrations, 8 de autenticação, 7 de ações de
conta, 9 de Propriedades/QA e 2 de notificações. O corte inclui a migration
`000005`, cinco fluxos emissores transacionais, API self-only, idempotência,
retenção exata de 90 dias e purga one-shot com credencial de menor privilégio.

A validação é técnica e local. O Android físico da MP-34 não foi executado, e
não houve commit, pull request, integração, tag, deploy, release ou publicação.

## Próxima etapa

A MP-33A concluiu a fundação do backend e banco, DDL, migrations, OpenAPI,
health/readiness, garantias operacionais, testes e CI. Naquela fase, o mock e o
aplicativo permaneceram inalterados.

A MP-33B está concluída tecnicamente e integrada à branch-base `backend`, com
autenticação, sessões, refresh tokens, convites, recuperação, e-mail
transacional e auditoria genérica. A MP-33C também está concluída tecnicamente
e integrada nessa base pelo PR #2 no commit `cc78a9f`, sem alterar o
comportamento persistido do Demo.

A MP-34 está concluída tecnicamente somente no working tree. A próxima decisão
é autorizar ou não seu commit e pull request; essa decisão não implica
integração nem liberação produtiva. Antes de produção, permanecem responsável,
agendamento e alertas da purga, provisionamento da credencial/CA/segredo de
manutenção, validação jurídica/de privacidade externa da retenção de 90 dias,
observabilidade, backup/restauração e os portões de domínio, associação de
links, assinatura e dispositivo. Escritas administrativas e o restante do RBAC
continuam fora da MP-34.

Conclusão técnica não significa liberação produtiva. MFA, identidade assistida,
SMTP/segredos, observabilidade, backup/restauração e validação externa da
retenção continuam portões ativos. A MP-34 não implementa legal hold ou
suspensão de descarte; eventual exigência da revisão jurídica/de privacidade
produzirá alteração futura versionada antes da produção. Break-glass segue não
implementado; Ed25519 ou serviço externo com dois aprovadores deve existir antes
dessa futura capacidade.

As decisões de fundação estão em
[baseline-backend-v1-2026-08.md](baseline-backend-v1-2026-08.md), e a sequência
está em [proximos-passos.md](proximos-passos.md).

## Onde olhar no código

| Área | Pasta principal |
|---|---|
| Telas e fluxos visuais | src/screens |
| Componentes reutilizáveis | src/components e src/layout |
| Rotas e navegação | src/navigation |
| Regras e contratos | src/domain, src/types e src/utils |
| Dados, mocks e integrações | src/api e src/services |
| Composição HTTP e sessão segura | src/http e src/entry/http.tsx |
| Composição Demo preservada | demo e src/entry/demo.tsx |
| Fundação do backend e banco | backend |
| Login e sessão locais do Demo | src/auth e src/contexts |
| Imagens e recursos visuais | src/assets |
| Testes e verificações | tests e scripts |
| Projeto Android nativo | android |

## Fontes complementares

- [Contexto consolidado](contexto-consolidado.md)
- [Escopo do MVP](escopo-mvp.md)
- [Regras de negócio](regras-de-negocio.md)
- [Decisões consolidadas](decisoes-consolidadas.md)
- [Pendências reais](pendencias-de-definicao.md)

Relatórios completos das fases, auditorias e rodadas anteriores foram
preservados em docs/archive e não representam o estado atual isoladamente.
