# Estado Atual do Projeto

Este documento descreve o estado atual do repositorio e do sistema como eles existem hoje. Seu foco e registrar o retrato presente da base, sem substituir documentos especificos de contexto, escopo, regras, decisoes ou pendencias.

Quando houver conflito entre documentos antigos e o codigo, priorize este arquivo e o proprio codigo-fonte para entender o que esta efetivamente no repositorio atual.

## Convencao Oficial de Linguagem

Na linguagem de produto, o termo oficial para a unidade operacional vista pelo usuario e `Propriedade`. No plural, usar `Propriedades`.

Termos consolidados:

- `Produtor`: usuario/perfil final que consulta sua realidade operacional.
- `Titular`: responsavel cadastral ou vinculo principal da propriedade.
- `Talhao`: subdivisao interna da propriedade.

No codigo legado e na documentacao tecnica, nomes como `fazenda`, `fazenda_id`, `fazendaId`, `fazendaNome`, `getFazenda*`, `FazendaMapa`, `FazendaMapaScreen`, `MapaFazendaView`, `fazendaUiCompat`, `fazendaCadastroCompat`, `FazendaCanonica` e `FazendaLegada` permanecem temporariamente por compatibilidade. Alias historicos como `cliente` e `proprietario` aparecem apenas quando ajudam a explicar inconsistencias ainda existentes no codigo, nos mocks ou em documentos antigos.

Esses nomes tecnicos continuam vinculados a rotas, mocks, contratos, helpers de compatibilidade, filtros, visitas, caderno, mapas e regras de acesso. A limpeza visual feita ate aqui nao renomeia essa base porque isso teria alto risco de quebrar navegacao, permissoes, filtros e dados mockados.

Para novas implementacoes, novos textos visiveis e novos documentos ativos devem usar `Propriedade`/`Propriedades`. Novos modelos futuros devem preferir `propriedade_id`. O uso de `fazenda*` deve ficar restrito a compatibilidade com codigo existente.

## Compatibilidade Dupla De Propriedade E Titular

Status em 2026-06-03: o projeto possui compatibilidade dupla aditiva para
Propriedade e Titular no mock e na borda de compatibilidade, sem remover campos
legados.

Os helpers centrais de leitura ficam em `src/utils/propriedadeCompat.ts`:

- `getPropriedadeId`
- `getPropriedadeNome`
- `getTitularId`
- `getTitularNome`
- `withPropriedadeCompat`
- `withTitularCompat`

Helpers de compatibilidade ja usam esses resolvers em leituras de borda e UI:

- `fazendaUiCompat.ts`
- `filtroCompat.ts`
- `usuarioAdminCompat.ts`
- `visitaFormCompat.ts`
- `cadernoFormCompat.ts`

Os 11 registros estaticos de produtores/propriedades em `src/api/mock.ts`
foram enriquecidos com aliases futuros:

- `propriedade_id`
- `propriedadeId`
- `propriedade_nome`
- `propriedadeNome`
- `titular_id`
- `titularId`
- `titular_nome`

A borda `src/api/produtorCompat.ts` preserva e emite esses aliases em leitura
e persistencia mockada de Propriedade.

Legados preservados:

- `fazenda_id`
- `fazendaId`
- `fazenda_nome`
- `fazendaNome`
- `produtor_id`
- `proprietario_id`
- `produtor_nome`
- nomes publicos antigos de helpers com `Fazenda`

Regra atual: codigo novo deve preferir os resolvers de
`src/utils/propriedadeCompat.ts`. Novas telas e novos helpers nao devem acessar
diretamente `fazenda_id`, `produtor_id` ou `proprietario_id`, salvo quando a
intencao for compatibilidade explicita. Campos legados nao devem ser removidos
nesta fase. Payloads de visitas, caderno e cadastro ainda podem continuar
usando `fazenda_id` por compatibilidade.

## Regra Efetiva Atual De Acesso A Propriedades

Status em 2026-06-03 (Fase 14D): no MVP mockado, a regra efetiva de acesso a
Propriedades permanece concentrada em `src/utils/acessoControle.ts` e segue
este corte:

- Admin ve todas as Propriedades.
- Produtor ve Propriedades pelo vinculo de titular/produtor compativel,
  preservando campos legados como `produtor_id` e `proprietario_id` e aliases
  futuros como `titular_id` quando passarem pela borda de compatibilidade.
- Colaborador ve Propriedades pelo escopo territorial de `sub_regioes`.
- Quando `sub_regioes` estiver ausente ou vazio, Colaborador usa
  `vinculos_microregioes` como fallback territorial.
- Quando `sub_regioes` e `vinculos_microregioes` existirem ao mesmo tempo, a
  prioridade continua sendo `sub_regioes`.
- `propriedades_atribuidas` representa vinculo direto visual/admin
  preparatorio no MVP mockado, mas ainda nao restringe nem amplia acesso
  efetivo.

Escopo regional e diferente de propriedade atribuida. O escopo regional e o
conjunto de microregioes usado pelo motor atual para filtrar Propriedades do
colaborador. A propriedade atribuida e um vinculo direto planejado para
administracao futura, exibido no mock como preparacao para backend/RBAC, mas
sem efeito de permissao nesta fase.

Risco conhecido: se alguem interpretar o bloco visual de propriedades
atribuidas no Admin como permissao real, pode esperar que ele altere o acesso
do colaborador. Isso nao ocorre no MVP atual. A decisao futura de backend/RBAC
deve escolher se o acesso sera por microregiao, por propriedade atribuida ou
por combinacao das duas, persistindo vinculos reais usuario-propriedade e
validando permissoes por acao e por Propriedade no backend.

Status em 2026-06-03 (Fase 14E): o contrato futuro recomendado de
backend/RBAC foi documentado em `regras-de-negocio.md`,
`matriz-cadastros-mvp.md`, `pendencias-de-definicao.md` e
`roadmap-futuro.md`. Essa documentacao nao altera o comportamento funcional do
MVP mockado.

A direcao futura recomendada e:

- Admin com acesso global.
- Produtor por vinculo com Propriedade/Titular.
- Colaborador por regra combinada/aditiva: microregiao vinculada OU
  Propriedade atribuida diretamente.

No backend futuro, `propriedades_atribuidas` deve ampliar acesso direto do
colaborador quando houver uma Propriedade atribuida fora do escopo regional.
Ela nao deve restringir automaticamente o acesso regional. Qualquer regra
restritiva deve ser politica explicita futura, nao inferencia implicita do
campo.

Status em 2026-06-03 (Fase 14F): foi criada
`docs/project/matriz-rbac-backend.md` como matriz tecnica futura de testes e
criterios de aceite para RBAC/backend. Ela registra permissoes por perfil,
matriz por acao, casos positivos, casos negativos, criterios de aceite e riscos
fora do MVP. Essa matriz nao altera o motor atual de acesso do MVP mockado.

Status em 2026-06-03 (Fase 14G): foi criado
`docs/project/contrato-api-rbac.md` com endpoints, payloads minimos, respostas
esperadas e regras de permissao para uma API futura de RBAC/backend. Esse
contrato nao implementa backend, autenticacao real, RBAC ou mudanca funcional;
o app continua operando com o MVP mockado.

Status em 2026-06-03 (Fase 14H): foi criado
`docs/project/testes-contrato-api-rbac.md` com matriz futura de testes de
contrato/API para RBAC. Ela cobre endpoints, status HTTP esperados, cenarios
positivos e negativos, estrategia `403`/`404` e separacao entre testes
automatizados futuros, smoke/manual e itens fora do MVP mockado. Essa matriz
nao altera comportamento funcional.

Status em 2026-06-03 (Fase 14I): foi criado
`docs/project/fechamento-fase-14-rbac.md` como indice consolidado da Fase 14.
Ele reune diagnostico, regra atual do MVP, fallback implementado, contrato
futuro de RBAC/backend, matriz de aceite, contrato de API, matriz de testes/API
e pendencias para backend.

## Objetivo Aparente

Aplicativo mobile em React Native + Expo para operacao de consultoria agricola. O foco aparente e atender tres perfis:

- `admin`: visao ampla da operacao
- `colaborador`: atuacao regional
- `produtor`: acompanhamento da propria propriedade

O fluxo principal gira em torno de produtores, propriedades, visitas tecnicas, caderno de campo e mapas.

## Arquitetura Identificada

### Camada de app

- `App.tsx` monta `AuthProvider`, `FiltroProvider`, `NotificacaoProvider`, `ToastProvider` e `NavigationContainer`
- `src/navigation/index.tsx` define um `Stack` principal com `Bottom Tabs` por perfil
- `src/theme.ts` centraliza tema visual

### Camada de interface

- `src/screens/` concentra as telas principais
- `src/components/` concentra componentes reutilizaveis de UI e visualizacao de mapas
- `src/contexts/` guarda estado transversal de filtros e notificacoes

### Camada de autenticacao e regras

- `src/auth/authMock.ts` faz login mock e acesso rapido demonstrativo/local
- `src/utils/acessoControle.ts` concentra boa parte das regras de permissao por perfil, produtor e regiao

### Camada de dados

- `src/api/mock.ts` e a fonte principal de dados do app hoje
- `src/api/validators.ts` valida entidades mock
- `src/api/index.ts` reexporta a camada mock
- `entities/` guarda os schemas de referencia

### Camada experimental de mapas/offline

- `src/screens/MapasScreen.tsx` apresenta uma experiencia unificada de panorama da propriedade; `LimiteArea` alimenta a demarcacao e nao aparece mais como aba funcional separada
- `src/components/MapaFazendaView.tsx` representa a trilha visual atual do MVP com WebView, Leaflet e tiles OpenStreetMap
- `src/screens/FazendaMapaScreen.tsx` usa `MapaFazendaView.tsx` para exibir talhoes e limites no contexto da propriedade, mantendo o nome tecnico legado
- `src/components/MapaFazendaNativoView.tsx` permanece como experimento historico com `react-native-maps`, mas nao e a tela ativa no fluxo atual
- a visualizacao atual prioriza mostrar a demarcacao; quando o mapa-base nao carrega, ha fallback vetorial local para os shapes
- o mock atual da propriedade Sela de Prata I usa demarcacao derivada de shapefile real convertida previamente para GeoJSON/JSON em `data/processados/p_sela1/2025/limites_talhoes.geojson` e `src/assets/geojson/selaDePrata1Talhoes.ts`
- a importacao controlada da propriedade Sela de Prata I possui manifesto em `data/processados/p_sela1/2025/manifesto.json`, registrando campos de origem, campo de nome usado, contagens e status de revisao da amostra
- a biblioteca mock de mapas agora aceita material tecnico por `fazenda_id`, campo/talhao e elemento/camada; esse identificador permanece como chave tecnica interna do contexto de propriedade; a propriedade Sela de Prata I possui uma amostra pequena de PNGs de diagnostico de fertilidade como anexos visuais por pH, argila, materia organica, fosforo e potassio
- a entidade `Mapa` possui `profundidade` como campo opcional simples, usado no mock para exibir recortes como `10-20 cm` quando essa informacao aparece no nome do arquivo
- `MapasScreen.tsx` usa nomenclatura visual padronizada para a area de materiais, incluindo `Anexos de fertilidade`, `Anexo de fertilidade PNG`, `Mapa de fertilidade`, `Material tecnico` e `Abrir anexo`
- `MapasScreen.tsx` exibe metadados de elemento, safra, talhao/propriedade inteira, profundidade e nome original quando esses dados existem, usando campos futuros com fallback para campos legados
- `src/services/MapaSincronizacaoService.ts` e `src/services/MapaCacheService.ts` ainda estao incompletos

## O Que Ja Funciona

- navegacao por perfil com tabs diferentes para `admin`, `colaborador` e `produtor`
- login mock com persistencia local
- CRUD local persistente para usuarios, propriedades, visitas, caderno e
  metadados de mapas; limites/talhoes continuam no seed/assets
- filtros regionais via `FiltroContext`
- fluxo principal de visitas com listagem, criacao, edicao e detalhe
- frente funcional de `Produtor` / `Propriedade` concluida no nivel necessario para o MVP atual, embora codigo e rotas ainda usem nomes tecnicos legados de fazenda
- frente funcional de visitas tecnicas por propriedade e caderno de campo por propriedade validada no nivel necessario para o MVP atual
- fluxo completo do produtor validado no MVP visual/mockado apos a padronizacao da nomenclatura visivel para `Propriedade`
- fluxo do colaborador pronto para teste manual interno no MVP visual/mockado, com acesso a Home, Propriedades, Visitas, Caderno e Perfil
- modulo administrativo `Admin -> Usuarios` em MVP visual/mockado, com cadastro e edicao de usuarios separados de propriedades
- mock de usuarios mais proximo do backend futuro, com campos comuns completos, status explicito e relacoes visuais `usuario_propriedade` e `usuario_microregiao`
- sincronizacao territorial visual/mockada entre `Admin -> Usuarios`, propriedades, regioes e microregioes, usando `territorioCompat` para derivar Regiao -> Microregiao -> Propriedade a partir das propriedades mockadas
- cadastro rapido de propriedade dentro do cadastro de usuario produtor, permitindo criar propriedade mockada e vincular via `usuario_propriedade` quando a propriedade ainda nao existe
- criacao de visita pelo colaborador validada tecnicamente pelo fluxo global e pelo contexto da propriedade, respeitando escopo regional/sub-regional
- visualizacao de panorama/mapas e detalhe de propriedade
- mapa base dos talhoes da propriedade Sela de Prata I a partir de `LimiteArea`/GeoJSON normalizado
- clique/toque em talhao no mapa base, com exibicao do nome/codigo e detalhes do talhao
- registros mockados de `Mapa` para uma amostra pequena de PNGs de fertilidade da propriedade Sela de Prata I
- exibicao de profundidade, elemento, safra, talhao/propriedade inteira e nome original em materiais/anexos quando esses campos estiverem preenchidos
- empty states de mapas/anexos diferenciando ausencia de demarcacao/talhoes e ausencia de materiais tecnicos
- base visual reutilizavel para formularios, detalhes e listagens, aplicada sem alterar backend, mocks, rotas, permissoes ou payloads

## Matriz De Cadastros Do MVP

Status em 2026-06-01: foi criada a matriz oficial de cadastros do MVP em
`docs/project/matriz-cadastros-mvp.md`, apenas como documentacao.

A matriz consolida a separacao entre:

- `Usuario` como pessoa/acesso
- `Produtor` como perfil de usuario
- `Colaborador` como usuario com escopo territorial/propriedades
- `Administrador` como usuario gestor
- `Propriedade` como unidade rural/operacional
- `Titular` como produtor vinculado a propriedade
- `Vinculo` como relacao entre usuario, propriedade e/ou territorio

O documento tambem registra campos obrigatorios do MVP, campos opcionais ou
mockados, nomes legados preservados e riscos conhecidos dos fluxos de cadastro.
Esta etapa nao alterou codigo, mock, telas, rotas, permissoes, contratos ou
nomes de arquivos.

Status em 2026-06-02: apos os Blocos 5A-5D e 6A-6B, os cadastros estao
padronizados visualmente conforme a matriz do MVP. A interface diferencia
`Usuario`, `Produtor`, `Colaborador`, `Administrador`, `Propriedade` e
`Titular`, preservando os fluxos mockados, payloads, contratos, rotas,
permissoes e campos legados como `fazenda_id`, `produtor_id` e
`proprietario_id`.

Limitacoes logicas conhecidas: o fluxo combinado `Usuario + Propriedade` nao e
transacional; novo titular minimo nao cria login real; `Propriedades
atribuidas` ao colaborador ainda nao representam RBAC final por propriedade; a
regra efetiva do colaborador continua territorial por `sub_regioes`, com
fallback para `vinculos_microregioes`; a integridade referencial real entre
usuarios, propriedades, titulares e vinculos fica para backend.

## Transicao Tecnica Das Telas De Propriedade

Status em 2026-06-02: os arquivos e componentes das telas que representam
Propriedades foram renomeados tecnicamente para a linguagem oficial de produto:

- `src/screens/PropriedadesScreen.tsx`
- `src/screens/NovaPropriedadeScreen.tsx`
- `src/screens/EditarPropriedadeScreen.tsx`

Os arquivos legados `ProdutoresScreen.tsx`, `NovoProdutorScreen.tsx` e
`EditarProdutorScreen.tsx` foram renomeados/removidos como arquivos atuais.
As rotas internas de stack para criacao/edicao tambem foram migradas:

- `NovaPropriedade`
- `EditarPropriedade`

As rotas internas de tabs tambem foram migradas:

- `Propriedades`
- `PropriedadesColaborador`

`PropriedadesColaborador` e a rota tecnica da tab de Propriedades no fluxo do
colaborador. O label visual das duas tabs permanece `Propriedades`. Esta
migracao nao alterou o motor de permissoes, mocks, payloads, contratos de
dados, helpers tecnicos ou logica de listagem/filtro.

Regra atual: produto/interface usa `Propriedade`; arquivos e componentes novos
usam `Propriedade`; rotas de stack usam `NovaPropriedade` e
`EditarPropriedade`; rotas de tabs usam `Propriedades` e
`PropriedadesColaborador`.

## O Que Ainda E Mock, Parcial Ou Incompleto

- autenticacao real
- backend real
- banco real, migrations e API real
- criacao real de login a partir do cadastro administrativo de usuario
- senha real, convite, reset de senha e sessao real
- RBAC/permissoes granulares completas
- implementacao do contrato futuro de RBAC/backend com escopo aditivo do
  colaborador por microregiao OU Propriedade atribuida
- transacao real no fluxo combinado `Usuario + Propriedade`
- integridade referencial real entre usuarios, propriedades, titulares e vinculos
- upload real de arquivos
- cadastro administrativo real de PNGs ou outros anexos tecnicos
- salvamento persistente de anexos em banco, storage local gerenciado ou storage remoto
- API/backend para anexos de mapas
- importacao automatica dos arquivos da pasta de origem
- importacao automatica do Drive
- fluxo de aprovacao/publicacao real para anexos tecnicos
- gestao completa do acervo de arquivos tecnicos
- notificacoes push reais
- sincronizacao offline de verdade
- download real de mapas
- suite de testes automatizados integrada ao projeto

## Fase 16A - Preparacao Do APK Demonstravel

Status em 2026-06-03: foi iniciado o congelamento operacional para preparar um
APK demonstravel de teste em campo, registrado em
`docs/project/fase-16a-apk-demonstravel.md`.

Esta fase nao continua refatoracao de rotas/payloads, nao implementa backend,
nao implementa RBAC real, nao remove compatibilidade legada e nao altera
contratos `fazenda_id`/`fazendaId`. O objetivo e estabilizar a demonstracao,
separar fluxos liberados de fluxos mockados/preparatorios, revisar dados
mockados sob LGPD/privacidade e definir checklists de geracao e smoke manual no
celular.

Diagnostico da Fase 16A: o app esta tecnicamente apto para uma rodada de APK
demonstravel desde que seja comunicado como MVP visual/mockado. Os principais
cuidados antes de entregar o APK sao evitar build em modo `__DEV__`, confirmar
autorizacao dos dados reais/semi-reais usados na Sela de Prata I e deixar
claro que Admin Usuarios, fotos, anexos, uploads, downloads, autenticacao e
permissoes continuam mockados ou preparatorios.

Validacoes automaticas executadas nesta abertura:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou

## Fase 16B - Revisao De Cadastros E Mock Realista Para Campo

Status em 2026-06-04: foi iniciada a Fase 16B com diagnostico documental dos
formularios de Propriedade e Usuario, do pacote mock principal, dos vinculos
por perfil, dos exemplos de visitas/caderno, da superficie de Mapas/Arquivos
tecnicos e da preparacao minima para persistencia local.

Documento principal:

- `docs/project/fase-16b-revisao-cadastros-mock-campo.md`

Principais achados da abertura:

- os formularios possuem nucleo adequado ao MVP, mas Novo Usuario e cadastro
  rapido de Propriedade devem ficar fora do fluxo principal de campo;
- a Sela de Prata I possui demarcacao e cinco anexos, mas nao possui visitas
  nem caderno vinculados a `p_sela1`;
- o Usuario produtor e o Titular da Sela de Prata I usam o nome da propria
  Propriedade, confundindo pessoa/perfil com unidade operacional;
- `area_total: 6200` e a soma mapeada de `1888,6 ha` podem representar area
  total e area mapeada, mas essa semantica ainda precisa ser confirmada;
- na abertura da Fase 16B, MapasScreen ainda possuia associacao interna de
  referencia com URL, formato e tamanho; esse achado foi tratado no Bloco
  16B.3;
- na abertura, o CRUD mockado ainda era somente em memoria; esse achado foi
  tratado no Bloco 16B.2 sem implementar sincronizacao ou backend;
- nomes, contatos, enderecos, credenciais e fotos externas do mock precisam de
  minimizacao para reduzir risco de LGPD/confusao.

Atualizacao do Bloco 16B.1 em 2026-06-04:

- `authMock` e `api/mock` agora alinham as personas principais `Admin
  Demonstracao`, `Colaborador de Campo` e `Produtor Demonstracao`;
- o nome da Propriedade Sela de Prata I foi separado do Usuario produtor e do
  Titular demonstrativo;
- `u_sela1` permanece vinculado ao titular `prop_sela1` e a Propriedade
  `p_sela1`;
- `u5` permanece com escopo efetivo `Mato Grosso` / `MT - Norte` e recebeu
  vinculo visual demonstrativo com `p_sela1`;
- `p_sela1` agora possui uma visita realizada, uma visita agendada e um
  caderno visivel ao Produtor, com datas fixas, textos neutros e sem fotos
  externas;
- nomes e contatos dos cadastros seed foram minimizados com personas, e-mails
  `example.com` e telefone/endereco/CEP vazios;
- `area_total: 6200` foi preservada; a relacao com os `1888,6 ha` mapeados
  continua pendente;
- mapas, talhoes, cinco PNGs, rotas, payloads, contratos, `fazenda_id` e
  fallbacks das Fases 14/15 foram preservados.
- o desalinhamento visual dos rotulos de acesso rapido, deixado fora da 16B.1,
  foi tratado no Bloco 16B.5.

O Bloco 16B.1 nao implementa backend, login real, RBAC real, persistencia
local, upload remoto ou sincronizacao.

Atualizacao do Bloco 16B.2 em 2026-06-04:

- os cadastros estruturados do mock agora usam persistencia local versionada
  em `AsyncStorage`, na chave `@tche:mock-mvp:v1`;
- a API mock hidrata o snapshot salvo antes da primeira operacao e usa/salva o
  seed demonstrativo quando ainda nao existe estado local valido;
- `User`, vinculos administrativos, `Produtor`/Propriedade, `Visita`,
  `CadernoCampo` e metadados de `Mapa` sao salvos apos `create`, `update` e
  `delete`;
- `MockLocalData.restoreSeed()` restaura de forma controlada o pacote
  demonstrativo inicial;
- limites/talhoes, GeoJSON, arquivos, imagens, PNGs, cache, autenticacao e
  dados de sincronizacao nao entram nesse snapshot;
- usuarios criados no Admin continuam sem virar login em `authMock`;
- ids, aliases futuros, `fazenda_id`, `fazendaId`, `produtor_id` e
  `proprietario_id` continuam preservados;
- nao foi criado botao visual de restauracao nesta fase;
- a simplificacao de Mapas/Arquivos tecnicos passa a ser a recomendacao para o
  Bloco 16B.3.

O Bloco 16B.2 nao implementa backend, login real, RBAC real, sincronizacao,
upload ou storage remoto.

Atualizacao do Bloco 16B.3 em 2026-06-04:

- `MapasScreen` passou a usar o titulo visivel `Mapas/Arquivos tecnicos`;
- cards priorizam titulo, descricao, contexto da Propriedade e metadados
  operacionais ja existentes;
- formato, tamanho, origem e URL nao aparecem mais como informacao principal;
- a acao e o modal internos de associacao de referencia foram removidos da
  experiencia de campo;
- confirmacoes e mensagens nao prometem upload, download, publicacao, Drive
  ou storage;
- filtros por Propriedade, categoria, safra, talhao e busca foram preservados;
- ordenacao por tamanho foi removida por nao ser relevante para a consulta de
  campo; ordenacao por recencia e titulo permanece;
- abertura dos PNGs da Sela de Prata I, mapa de talhoes,
  `FazendaMapaScreen`, contratos, rotas, permissao, pipeline, persistencia de
  metadados e `fazenda_id`/`fazendaId` foram preservados.

O Bloco 16B.3 nao altera `src/api/mock.ts`, `mockLocalPersistence.ts`,
`FazendaMapaScreen`, backend, RBAC, rotas, pipeline ou arquivos persistidos.

Atualizacao do Bloco 16B.4 em 2026-06-04:

- Nova/Editar Propriedade informam que o cadastro fica salvo localmente no
  aparelho e nao possui backend ou sincronizacao;
- a area aparece como `Area total informada`, sem afirmar que corresponde a
  area mapeada;
- Titular existente e o caminho principal de Nova Propriedade; Novo Titular
  permanece como alternativa demonstrativa sem Usuario/login real;
- cidade, UF e cultura sao identificadas como opcionais;
- Editar Propriedade preserva e nao libera troca de Titular, Regiao ou
  Microregiao;
- Novo Usuario apresenta Produtor, Colaborador e Administrador como perfis
  demonstrativos e informa que o cadastro nao cria login, autenticacao ou
  RBAC real;
- telefone e documento permanecem opcionais e recebem orientacao de
  minimizacao de dados;
- Usuario Detail nao destaca telefone/documento vazios e reforca que os
  vinculos sao demonstrativos.

O Bloco 16B.4 nao altera `src/api/mock.ts`, `src/api/validators.ts`, helpers de
payload, contratos, compatibilidade legada, permissao ou persistencia local.

Atualizacao do Bloco 16B.5 em 2026-06-04:

- `LoginScreen` passou a apresentar `Acesso demonstrativo local`;
- `Acesso rapido (dev)` foi substituido por `Acesso rapido para demonstracao`;
- botoes principais usam `Admin Demonstracao`, `Colaborador de Campo` e
  `Produtor Demonstracao`;
- nomes legados de pessoas e da Propriedade foram removidos dos rotulos;
- a tela informa que as credenciais nao representam autenticacao real;
- chaves `admin`, `colaborador` e `produtor`, credenciais mockadas, roteamento
  por perfil e `AuthContext` foram preservados;
- Usuario criado no Admin continua sem virar login real.

O Bloco 16B.5 nao altera backend, login real, `AuthContext` estruturalmente,
RBAC, contratos, cadastros ou persistencia local.

Validacoes executadas na abertura e reexecutadas para os Blocos
16B.1/16B.2/16B.3/16B.4/16B.5:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou; no Windows, emitiu apenas avisos normais de
  conversao LF/CRLF

## Fase 16C - Build E Smoke Final Do APK

Status em 2026-06-04: foi gerado um APK Android local na variante `release`,
sem `__DEV__`, registrado em
`docs/project/fase-16c-build-smoke-final-apk.md`.

O projeto permanece Expo managed, sem `eas.json`. O build usou `expo prebuild`
e Gradle local para gerar um APK universal com pacote `com.tcheagro.mobile`,
versao `1.0.0`, `versionCode` 1 e icone derivado do logo existente.

O primeiro build revelou ausencia da cor de splash gerada; o bloqueio foi
corrigido somente com configuracao minima de splash branco em `app.json`.
Nenhum fluxo funcional, contrato, mock, permissao ou persistencia foi alterado.

O APK foi gerado e inspecionado, mas a instalacao e o smoke completo em Android
fisico continuam pendentes porque nenhum aparelho estava conectado/autorizado
no `adb`. A decisao atual e nao liberar o APK para campo antes desse smoke.

## Microfase De Padronizacao Visual Reutilizavel

Status em 2026-05-30: foi criada e aplicada uma base visual reutilizavel em telas de formulario, detalhe e listagem, sem alterar dominio, backend, mocks, rotas, permissoes, payloads ou nomes tecnicos legados.

Componentes-base consolidados nesta microfase:

- `FormField`
- `FormFooter`
- `SectionCard`
- `InfoBox`
- `EmptyState`
- `SearchBar`
- `SegmentedChips`
- `RadioCardGroup`

Telas padronizadas nesta frente:

- `NovoCadernoScreen`
- `EditarCadernoScreen`
- `CadernoCampoScreen`
- `NovaVisitaScreen`
- `EditarVisitaScreen`
- `VisitasScreen`
- `EditarPropriedadeScreen`
- `NovaPropriedadeScreen`
- `ProdutorScreen`
- `PropriedadesScreen`
- `NovoUsuarioScreen`
- `UsuarioDetailScreen`
- `UsuariosScreen`
- `PerfilScreen`
- `EditProfileScreen`
- `MapasScreen`

Atualizacao em 2026-05-31: apos diagnostico especifico, `NovoUsuarioScreen` tambem foi padronizada visualmente. A tela passou a usar `SectionCard`, `FormField`, `FormFooter`, `InfoBox` e `SegmentedChips` nos grupos equivalentes, preservando a tela como fluxo sensivel de cadastro administrativo de usuario, perfil, status, vinculos com propriedade, vinculos territoriais, nivel administrativo e cadastro rapido de propriedade mockada para produtor.

Atualizacao em 2026-05-31: apos diagnostico controlado da frente de mapas, `MapasScreen` tambem foi padronizada visualmente de forma minima. A tela passou a usar `SearchBar`, `EmptyState`, `SegmentedChips`, `SectionCard` e `InfoBox` em blocos equivalentes ja existentes, preservando comportamento, filtros, permissao, navegacao, mock e payload.

Garantias preservadas:

- sem alteracao de backend
- sem alteracao de mocks
- sem alteracao de rotas
- sem alteracao de permissoes
- sem alteracao de payloads
- sem alteracao de helpers, schemas, validacoes ou regras de negocio
- sem alteracao de `buildUsuarioAdminPayload`, `buildUsuarioFormFromMock`, `Produtor.create`, `vinculos_propriedades`, `vinculos_microregioes`, `produtor_id`, `fazenda_id` ou `proprietario_id`
- sem alteracao de `ShapeRenderer`, `FazendaMapaScreen`, `MapaFazendaView`, `buildFazendaMapaRouteParams`, `avaliarDownloadMapa`, `Mapa.update`, `ConfirmDialog`, preview de asset interno, permissoes, filtros de acesso, mocks, rotas, payloads ou campos legados
- sem renomear legado tecnico `Produtor`/`Fazenda`, arquivos, rotas, helpers ou campos como `fazenda_id`
- linguagem visivel preservada como `Propriedade` quando aplicavel

O cadastro rapido de propriedade dentro do cadastro de usuario produtor permanece mockado. Sua revisao funcional continua reservada para uma etapa futura de fluxos de cadastro, sem mudanca de regra nesta padronizacao visual.

Na padronizacao visual de `MapasScreen`, nao foram criados upload real, download real ou backend. Ficaram intactos geometria, selecao de talhao, renderizacao vetorial e filtro de demarcacao/ano LT. Titulos mockados existentes, como os que usam `Fazenda Sela de Prata I`, foram preservados.

Validacoes executadas durante a microfase:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de LF/CRLF

## Microfase Backend-Ready Do Admin -> Usuarios

Status em 2026-05-28: o modulo `Admin -> Usuarios` continua 100% visual/mockado, mas foi evoluido para reduzir retrabalho futuro quando houver backend, banco e autenticacao real.

O cadastro administrativo de usuario agora trabalha com campos comuns mais completos:

- nome
- e-mail
- telefone
- documento
- perfil
- status
- observacoes

O status do usuario passou a ser explicito no mock:

- `ativo`
- `inativo`
- `pendente`

O booleano `ativo` permanece apenas como compatibilidade temporaria quando alguma parte antiga do app ainda precisar desse formato. A origem preferencial para novas leituras do modulo administrativo e `status`.

O mock agora possui relacoes explicitas para preparar o modelo futuro:

- `usuario_propriedade`, representado no mock por vinculos com `usuario_id`, `propriedade_id`, `tipo_vinculo` e `principal`
- `usuario_microregiao`, representado no mock por vinculos com `usuario_id`, `regiao` e `microregiao`

Com isso:

- produtor pode ter uma ou mais propriedades vinculadas
- cada vinculo de produtor pode indicar tipo de vinculo, como titular, responsavel ou outro
- um dos vinculos pode ser marcado como principal
- colaborador pode ter microregioes/sub-regioes e propriedades atribuidas visualmente
- admin possui nivel administrativo simples: Global, Operacional ou Suporte

Foram implementadas validacoes no mock administrativo:

- nome obrigatorio
- e-mail obrigatorio
- formato simples de e-mail
- e-mail unico ao criar usuario
- e-mail unico ao editar usuario, ignorando o proprio usuario
- perfil obrigatorio
- status obrigatorio
- produtor ativo precisa ter ao menos uma propriedade vinculada
- produtor pendente pode ficar sem propriedade vinculada
- colaborador ativo precisa ter microregiao/sub-regiao ou propriedade atribuida
- admin nao exige propriedade nem microregiao
- `User.update` valida o registro mesclado de forma equivalente ao `User.create`

Limites importantes desta microfase:

- usuario criado ou editado no `Admin -> Usuarios` nao cria login real
- o login mock atual permanece separado da gestao administrativa visual
- propriedades atribuidas ao colaborador continuam como vinculo visual/admin
  preparatorio e ainda nao alteram o motor efetivo de permissoes
- `produtor_id`, `fazenda_id` e nomes internos legados continuam preservados onde ainda sustentam compatibilidade

Fora do escopo mantido:

- backend
- banco real
- migrations
- API real
- autenticacao real
- senha real
- convite por e-mail
- reset de senha
- sessao real
- RBAC/permissoes granulares completas
- upload/storage
- Drive

Validacoes executadas na implementacao:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou; quando executado no Windows, pode emitir apenas avisos normais de LF/CRLF

## Fase 16E.1 - Diagnostico E Preparacao Do Login Local

Status em 2026-06-05: foi criado o diagnostico da Fase 16E.1 em
`docs/project/fase-16e-login-local.md`.

Esta fase nao implementa autenticacao local nova. Ela mapeia o login atual,
cadastro administrativo de usuarios, persistencia local do mock, sessao,
tratamento de e-mail/status, credenciais demonstrativas e riscos para preparar
microfases futuras.

Principais achados:

- o login efetivo usa `src/auth/authMock.ts`, nao os usuarios persistidos em
  `src/api/mock.ts`;
- `authMock.ts` e `src/api/mock.ts` duplicam usuarios demonstrativos e senhas;
- a sessao salva apenas o usuario canonico atual em `@tche:user`, sem senha ou
  token;
- o mock administrativo persiste dados em `@tche:mock-mvp:v1` e usuarios
  criados localmente sobrevivem ao reinicio no mesmo dispositivo;
- usuarios do Admin recebem `senha: 'mock123'` por compatibilidade com o
  validador legado, mas essa senha nao autentica e nao deve ser tratada como
  credencial real;
- o login atual nao bloqueia por `status` ou `ativo`;
- a recomendacao para fases futuras e separar credenciais locais do objeto de
  usuario listado pelo Admin, preservando as credenciais demonstrativas como
  fallback.

Status em 2026-06-05 (Fase 16E.2): foi criada a infraestrutura tecnica isolada
de credenciais locais em `src/auth/localCredentials.ts`.

Esta microfase adicionou:

- chave separada `@tche:local-credentials:v1`;
- contrato `LocalCredential` com `usuario_id`, `email_normalizado`,
  `senha_hash`, `salt`, `versao`, `criado_em` e `atualizado_em`;
- helper `normalizeEmail`;
- servico `LocalCredentialService` com listagem de metadados, busca por usuario
  ou e-mail, criacao, atualizacao, remocao e verificacao de credencial;
- dependencia `expo-crypto` `~12.2.1`, compativel com Expo 48, encapsulada no
  hasher local demonstrativo;
- testes em `tests/localCredentials.test.js`.

Limites preservados:

- `LoginScreen.tsx` nao foi alterado;
- `AuthContext.tsx` nao foi alterado;
- `authMock.ts` continua sendo a origem efetiva do login demonstrativo;
- usuarios criados no Admin ainda nao autenticam;
- nenhuma credencial foi criada automaticamente para usuarios existentes;
- `senha: 'mock123'` nao foi migrada nem usada como credencial;
- `@tche:user`, `@tche:mock-mvp:v1`, dashboards, navegacao por perfil, filtros,
  GeoJSON e PNG permanecem sem mudanca funcional.

Status em 2026-06-05 (Fase 16E.3): o cadastro administrativo de Usuarios foi
integrado ao servico de credenciais locais, ainda sem autenticar usuarios
persistidos.

Esta microfase adicionou:

- campos `Senha inicial` e `Confirmar senha inicial` na criacao de usuario;
- secao `Redefinir senha local` na edicao, com `Nova senha` e
  `Confirmar nova senha`;
- validacao de minimo de 6 caracteres, confirmacao igual e rejeicao de senha
  composta apenas por espacos;
- criacao de usuario seguida de `LocalCredentialService.createCredential` com
  o `id` retornado por `User.create`;
- compensacao por `User.delete` quando a credencial falha apos criar usuario;
- operacao `updateCredentialEmail` para trocar apenas o e-mail normalizado da
  credencial, preservando hash, salt e `criado_em`;
- indicador seguro no detalhe do usuario: `Acesso local configurado` ou
  `Acesso local nao configurado`, baseado em `hasCredential`;
- helper `deleteUsuarioAdminAndLocalCredential` para fluxos de exclusao
  administrativa removerem usuario e credencial;
- testes em `tests/usuarioLocalAccessAdmin.test.js` e ampliacao de
  `tests/localCredentials.test.js`.

Limites preservados na 16E.3:

- `LoginScreen.tsx`, `AuthContext.tsx` e `authMock.ts` nao foram alterados;
- usuarios criados no Admin ainda nao autenticam;
- a credencial local pode ser configurada para usuarios ativos, pendentes ou
  inativos, mas status ainda nao bloqueia login;
- nenhuma credencial e criada automaticamente para usuarios existentes;
- `senha: 'mock123'` continua apenas como campo legado de compatibilidade e
  nao e migrada nem usada como credencial;
- a senha inicial nao entra no payload administrativo, no snapshot
  `@tche:mock-mvp:v1`, na sessao `@tche:user` nem em objetos de `User.list`;
- o app ainda nao possui botao visual de exclusao administrativa de usuario,
  mas o helper de exclusao com remocao de credencial ja esta pronto e testado.

Status em 2026-06-05 (Fase 16E.4): o login manual passou a autenticar usuarios
persistidos pelo Admin quando houver credencial local configurada no mesmo
aparelho.

Esta microfase adicionou:

- `src/auth/authLocal.ts`, com `authenticateWithEmailAndPassword`;
- `src/auth/authSession.ts`, com sanitizacao e persistencia testavel da sessao;
- integracao minima do `AuthContext.login` com a nova camada manual;
- ajuste textual no `LoginScreen` para credenciais locais ou demonstrativas;
- testes em `tests/authLocal.test.js`.

Ordem atual do login manual:

1. procurar credencial local por e-mail normalizado;
2. se existir, verificar senha local;
3. se senha local estiver errada, nao tentar fallback;
4. se senha local estiver correta, carregar usuario via `User.get(usuario_id)`;
5. sanitizar e normalizar usuario para a sessao;
6. se nao houver credencial local, usar `authMock.ts` como fallback
   demonstrativo.

Comportamento atual:

- usuarios persistidos preservam `perfil`, `status`, `ativo`, `produtor_id`,
  `regiao`, `sub_regioes`, `vinculos_microregioes`,
  `vinculos_propriedades`, `propriedades_atribuidas` e campos compativeis
  retornados por `User.get`;
- `@tche:user` continua salvando somente usuario normalizado, sem senha,
  hash, salt, credencial ou token;
- `authMock.ts` permanece intacto e segue como fallback demonstrativo;
- acesso rapido continua usando `authLoginByProfile`;
- credencial local tem prioridade sobre credencial demonstrativa no mesmo
  e-mail;
- credencial orfa nao autentica e nao e removida automaticamente;
- `mock123` continua apenas como campo legado de compatibilidade e nao
  autentica usuario administrativo sem credencial local;
- status `ativo`, `pendente` e `inativo` ainda nao bloqueiam login.

Limites preservados na 16E.4:

- sem bloqueio por status;
- sem recuperacao ou troca de senha pelo usuario;
- sem backend, JWT, RBAC real, GeoJSON, PNG, filtros ou dashboards;
- sem APK final nesta microfase.

Status em 2026-06-05 (Fase 16E.5): novos logins manuais e acessos rapidos
passaram a respeitar o status efetivo do usuario antes de gravar sessao.

Esta microfase adicionou:

- `src/auth/authStatus.ts`, com `getUsuarioStatusEfetivo`,
  `canUsuarioLogin` e `assertUsuarioPodeEntrar`;
- validacao de status no fluxo local de `authLocal.ts`;
- validacao de status no resultado do `loginRapido` em `AuthContext.tsx`;
- mensagens especificas no `LoginScreen` para usuario pendente e inativo;
- ampliacao dos testes em `tests/authLocal.test.js`.

Regra atual de status no login:

- `ativo`: pode entrar;
- `pendente`: bloqueado com `Seu acesso ainda esta pendente de liberacao pelo
  administrador.`;
- `inativo`: bloqueado com `Seu acesso esta inativo. Solicite a reativacao ao
  administrador.`;
- status ausente com `ativo === false`: tratado como `inativo`;
- status ausente com `ativo !== false`: tratado como `ativo`;
- status desconhecido: bloqueado com mensagem controlada.

Comportamento atual da 16E.5:

- senha errada continua retornando erro generico de credenciais invalidas;
- bloqueio por status nao cria sessao parcial;
- credencial local bloqueada por status permanece intacta;
- `authMock.ts` continua sem alteracao;
- fallback demonstrativo sem status e tratado como ativo por compatibilidade;
- os tres logins demonstrativos e os tres acessos rapidos principais continuam
  funcionando;
- `@tche:user` continua sem senha, hash, salt, credencial ou token.

Limite preservado: sessao antiga ja restaurada nao e revalidada profundamente
nesta microfase. O corte atual bloqueia novos logins; revalidacao de sessao
persistida quando o status mudar fica para evolucao futura.

Status em 2026-06-05 (Fase 16E.6): a frente de login local demonstrativo foi
fechada com smoke tecnico, revisao leve de seguranca local, reforco de testes e
registro documental.

Resultado da revisao:

- login local demonstrativo esta funcional para usuarios persistidos com
  credencial local;
- novos logins respeitam status efetivo antes de gravar `@tche:user`;
- acesso rapido demonstrativo continua funcionando para Admin Demonstracao,
  Colaborador de Campo e Produtor Demonstracao;
- `@tche:user` continua sanitizado, sem senha, hash, salt, credencial ou token;
- senha inicial e nova senha digitadas no Admin nao aparecem em sessao,
  `User.list`, detalhe de usuario, navegacao, dashboards ou mensagens de erro;
- `UsuarioDetailScreen` mostra apenas indicador seguro de credencial local;
- mensagens finais de pendente, inativo, cadastro inconsistente e credencial
  invalida permanecem controladas.

Observacao de seguranca local: o snapshot `@tche:mock-mvp:v1` ainda preserva o
campo legado `senha` nos usuarios do seed e `senha: 'mock123'` em usuarios
administrativos criados, por compatibilidade com o mock antigo. Esse campo nao
recebe a senha inicial nem a nova senha local, nao e usado como credencial
local real e nao autentica usuario administrativo sem registro em
`@tche:local-credentials:v1`.

Limites preservados na 16E.6:

- sessao antiga restaurada ainda nao e revalidada profundamente;
- credenciais locais sao locais ao aparelho;
- usuarios e credenciais nao sincronizam entre dispositivos;
- sem backend, JWT, RBAC real, recuperacao/troca de senha pelo proprio usuario,
  GeoJSON, PNG, filtros, dashboards ou APK final.

Verificacao Expo apos adicionar `expo-crypto`: `npx expo install --check`
indicou dependencias atualizadas. `npx expo-doctor` passou em 14 de 16
verificacoes e apontou dois riscos preexistentes/de publicacao futura:
`@types/react-native` instalado diretamente e Expo SDK 48 mirando Android API
33 ou inferior por padrao para submissao na Google Play. Nenhum desses pontos
foi corrigido nesta microfase para evitar upgrade/limpeza ampla fora do escopo.

## Fase 16F.1 - Diagnostico De GeoJSON Local Por Propriedade

Status em 2026-06-05: foi criado o diagnostico da Fase 16F.1 em
`docs/project/fase-16f-geojson-local.md`.

Esta fase nao implementa importacao real. Ela mapeia a estrutura atual de
GeoJSON/limites/talhoes da Sela de Prata I, o fluxo de runtime em
`LimiteArea`, `MapasScreen`, `FazendaMapaScreen`, `MapaFazendaView` e
`ShapeRenderer`, a persistencia atual e as dependencias necessarias para uma
importacao local futura.

Principais achados:

- o GeoJSON processado fica em
  `data/processados/p_sela1/2025/limites_talhoes.geojson`, com
  `FeatureCollection`, 15 talhoes, 37 partes e geometrias `Polygon` e
  `MultiPolygon`;
- o app consome em runtime o asset normalizado
  `src/assets/geojson/selaDePrata1Talhoes.ts`, convertido para objetos
  `{ lat, lng }` e inserido no mock como `LimiteArea`;
- a Sela de Prata I e vinculada por `fazenda_id: p_sela1`, preservando
  `produtor_id` como alias legado; `propriedade_id` ainda nao substitui esse
  contrato em limites;
- `MapasScreen` usa `ShapeRenderer` para pre-visualizacao SVG e
  `FazendaMapaScreen` usa `MapaFazendaView` com WebView/Leaflet, com fallback
  vetorial local;
- limites/talhoes nao entram no snapshot `@tche:mock-mvp:v1`; permanecem no
  seed/assets, enquanto metadados de mapas sim entram no snapshot;
- `MapaCacheService.ts` importa `expo-file-system`, mas essa dependencia nao
  aparece em `package.json`; `expo-document-picker` e `expo-sharing` tambem
  nao estao instalados.

Riscos principais para as proximas microfases: GeoJSON grande em AsyncStorage,
`MultiPolygon`, coordenadas invertidas, geometria invalida, arquivo fora de
WGS84, nomes de talhao ausentes, duplicidade/substituicao acidental de limites
por Propriedade, performance de WebView/SVG e falta de dependencia de
filesystem.

Microfases recomendadas: contrato local de metadados, validador puro de
GeoJSON, seletor com `expo-document-picker`, copia para storage interno com
`expo-file-system`, associacao segura por Propriedade, visualizacao no mapa,
substituicao/remocao controlada e smoke Android.

## Fase 16F.2 - Contrato Local De Metadados GeoJSON

Status em 2026-06-05: foi criada a base tecnica isolada para indice local de
metadados de GeoJSON importado por Propriedade.

Esta microfase nao implementa seletor de arquivo, leitura de arquivo, copia
para filesystem, validacao completa de GeoJSON, renderizacao de GeoJSON
importado, alteracao em `MapasScreen`, alteracao em `FazendaMapaScreen`,
alteracao em `LimiteArea.list`, backend, upload remoto ou sincronizacao.

Arquivos principais:

- `src/types/geojsonImport.ts`
- `src/services/GeoJsonImportService.ts`
- `tests/geojsonImportService.test.js`

Contrato criado:

- `GeoJsonImportMetadata`, com vinculo por `propriedade_id` e `fazenda_id`,
  nome original do arquivo, URI local futura, tamanho/MIME, responsavel,
  datas, status, contagens, area, safra/ano, observacoes, erro de validacao,
  origem `arquivo_local` e versao.

Chave local:

- `@tche:geojson-imports:v1`

Regras implementadas:

- o indice salva somente metadados pequenos;
- nao salva `FeatureCollection`, `features`, `coordinates`, `poligono` ou
  `poligonos`;
- nao usa `@tche:mock-mvp:v1`, `@tche:user` ou
  `@tche:local-credentials:v1`;
- se vier apenas `propriedade_id`, preenche `fazenda_id` igual;
- se vier apenas `fazenda_id`, preenche `propriedade_id` igual;
- permite apenas um metadado `ativo` por Propriedade, substituindo o ativo
  anterior para `substituido`;
- metadado `removido` nao aparece como ativo;
- storage ausente ou JSON corrompido retorna lista vazia sem derrubar o app;
- `delete` remove apenas o metadado, pois ainda nao ha arquivo fisico nesta
  fase.

A Sela de Prata I permanece intacta: seed/assets, GeoJSON processado,
`LimiteArea.list`, `MapasScreen`, `FazendaMapaScreen`, `MapaFazendaView` e
`ShapeRenderer` nao foram alterados para consumir esse indice.

Validacoes executadas:

- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonImportService.test.js` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

Proximos passos recomendados:

- 16F.3: validador puro de GeoJSON;
- 16F.4: seletor de arquivo com `expo-document-picker`, sem publicar ainda no
  mapa.

## Fase 16F.3 - Validador Puro De GeoJSON

Status em 2026-06-05: foi criado o helper puro
`src/utils/geojsonImportValidator.ts` para validar GeoJSON bruto e normalizar
talhoes em memoria para o formato runtime do app.

Esta microfase nao implementa seletor de arquivo, leitura do aparelho, copia
para filesystem, persistencia, associacao ativa com Propriedade, alteracao de
`LimiteArea.list`, alteracao em telas, renderizacao de GeoJSON importado,
backend, upload remoto ou sincronizacao.

Entrada aceita:

- objeto JSON ja parseado;
- string JSON valida.

Saida:

- `ok`;
- `errors`;
- `warnings`;
- `talhoes`;
- `summary`.

Regras principais:

- aceita apenas `FeatureCollection`;
- aceita `Polygon` e `MultiPolygon`;
- rejeita geometrias vazias, ausentes ou incompativeis;
- valida coordenadas numericas finitas em padrao GeoJSON `[lng, lat]`;
- converte para runtime `{ lat, lng }`;
- rejeita longitude fora de `-180..180` e latitude fora de `-90..90`;
- detecta provavel inversao evidente `[lat, lng]`, emitindo warning e erro,
  sem inverter automaticamente;
- rejeita anel externo com menos de quatro pontos;
- fecha anel externo aberto em memoria quando ha pontos suficientes, emitindo
  warning;
- ignora holes/interior rings nesta fase, emitindo warning;
- normaliza `Polygon` para `poligono` e `poligonos` com uma parte;
- normaliza `MultiPolygon` para `poligonos` com varias partes e `poligono`
  apontando para a primeira;
- resolve nome do talhao por `properties.talhao`, `properties.nome`,
  `properties.name`, `properties.codigo`, `properties.id`, `feature.id` e
  fallback `Talhao N`;
- nomes duplicados geram warning, mas nao rejeitam a importacao nesta fase;
- `fazenda_id` usa `options.fazenda_id || options.propriedade_id`;
- `produtor_id` preserva o alias legado com `options.produtor_id ||
  fazenda_id`;
- IDs normalizados sao estaveis e nao dependem de data dinamica.

Resumo produzido:

- `features_count`;
- `talhoes_count`;
- `polygon_parts_count`;
- `geometry_types`;
- `warnings_count`;
- `errors_count`.

Arquivos principais:

- `src/utils/geojsonImportValidator.ts`;
- `tests/geojsonImportValidator.test.js`.

A Sela de Prata I permanece intacta: seed/assets, GeoJSON processado,
`LimiteArea.list`, `MapasScreen`, `FazendaMapaScreen`, `MapaFazendaView` e
`ShapeRenderer` nao foram alterados para consumir o helper.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16F.4 - Seletor E Leitura Controlada De GeoJSON

Status em 2026-06-05: foi criada a infraestrutura isolada para selecionar,
ler e validar GeoJSON local em memoria, sem abrir esse fluxo na interface e
sem persistir importacao.

Dependencias instaladas com Expo SDK 48:

- `expo-document-picker@~11.2.2`;
- `expo-file-system@~15.2.2`.

Nao foi instalado:

- `expo-sharing`.

Servico criado:

- `src/services/GeoJsonFilePickerService.ts`.

Teste criado:

- `tests/geojsonFilePickerService.test.js`.

O servico cobre:

- normalizacao do retorno antigo do DocumentPicker
  `{ type: 'success', uri, name, size, mimeType }`;
- normalizacao do retorno novo do DocumentPicker
  `{ canceled: false, assets: [...] }`;
- cancelamento antigo e novo;
- validacao de extensao;
- validacao de MIME;
- limite de tamanho;
- leitura textual com `expo-file-system`;
- chamada ao helper `validateAndNormalizeGeoJson`;
- retorno estruturado com arquivo, resultado de validacao, warnings e erro
  controlado.

Formatos aceitos:

- `.geojson`;
- `.json`;
- MIME `application/geo+json`;
- MIME `application/json`;
- MIME `text/json`;
- MIME `text/plain` apenas com extensao valida;
- MIME ausente quando a extensao e valida.

Formatos rejeitados:

- `.zip`;
- `.kml`;
- `.kmz`;
- `.shp`;
- `.png`;
- `.jpg`;
- `.pdf`;
- arquivo sem nome/extensao reconhecida.

Limite de tamanho:

- `MAX_GEOJSON_FILE_SIZE_BYTES = 10 * 1024 * 1024`;
- arquivo maior que o limite e rejeitado antes da leitura quando `size` esta
  disponivel;
- `size` ausente ainda permite leitura nesta fase e gera warning
  `FILE_SIZE_UNKNOWN`.

Leitura e validacao:

- `FileSystem.readAsStringAsync(uri, { encoding: UTF8 })` le o conteudo em
  memoria;
- o conteudo nao e logado;
- o conteudo nao e salvo;
- o resultado chama `validateAndNormalizeGeoJson(text, options)`;
- `propriedade_id`, `fazenda_id`, `produtor_id`, `ano` e `safra` sao
  repassados ao validador.

Limites preservados:

- sem tela;
- sem botao de importacao;
- sem chamada ao `GeoJsonImportService`;
- sem escrita em `@tche:geojson-imports:v1`;
- sem escrita em `@tche:mock-mvp:v1`;
- sem copia definitiva para storage interno;
- sem cache;
- sem alteracao em `MapasScreen`;
- sem alteracao em `FazendaMapaScreen`;
- sem alteracao em `LimiteArea.list`;
- sem renderizacao de GeoJSON importado;
- sem alteracao na Sela de Prata I.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` passou com acesso a rede liberado; em ambiente
  restrito, o mesmo comando nao conseguiu acessar os servidores Expo e caiu no
  mapa de dependencias em cache;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16F.5 - Storage Interno De GeoJSON

Status em 2026-06-05: foi criado o servico isolado para copiar um GeoJSON
validado para o storage interno do app, mantendo o conteudo grande fora de
`AsyncStorage` e retornando uma URI local estavel para a 16F.6.

Arquivo criado:

- `src/services/GeoJsonStorageService.ts`.

Teste criado:

- `tests/geojsonStorageService.test.js`.

Arquivos alterados:

- `package.json`;
- `tsconfig.domain-compat.json`;
- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Diretorio adotado:

- `FileSystem.documentDirectory + 'tche-geojson-imports/'`;
- subdiretorio por Propriedade:
  `tche-geojson-imports/{propriedade_id_sanitizado}/`;
- arquivo final com `importId` e nome sanitizados, por exemplo:
  `tche-geojson-imports/p_sela1/import-001-limites-talhoes.geojson`.

O servico cobre:

- sanitizacao de `propriedade_id`;
- sanitizacao de nome de arquivo;
- preservacao de `.geojson` e `.json`;
- fallback para `limites-talhoes.geojson`;
- criacao de diretorio base e subdiretorio por Propriedade;
- copia por `FileSystem.copyAsync({ from, to })`;
- fallback por `FileSystem.writeAsStringAsync` quando `copyAsync` falha e
  `content` esta disponivel;
- bloqueio de sobrescrita por padrao, com `overwrite: true` explicito;
- remocao segura do destino anterior antes da copia quando `overwrite: true`
  e usado;
- confirmacao da copia com `FileSystem.getInfoAsync`;
- leitura posterior via `readStoredGeoJson`;
- validacao posterior via `validateStoredGeoJson` e
  `validateAndNormalizeGeoJson`;
- consulta de info via `getStoredGeoJsonInfo`;
- remocao segura via `deleteStoredGeoJson`.

Remocao segura:

- so remove arquivo dentro de `tche-geojson-imports/`;
- recusa paths externos com `UNSAFE_DELETE_PATH`;
- recusa remover diretorio base ou subdiretorio amplo;
- arquivo inexistente retorna sucesso controlado com `deleted: false`.

Limites preservados:

- sem tela;
- sem botao ou fluxo visual;
- sem chamada ao `GeoJsonImportService`;
- sem escrita em `@tche:geojson-imports:v1`;
- sem escrita em `@tche:mock-mvp:v1`;
- sem metadado criado;
- sem associacao visual a Propriedade;
- sem renderizacao de GeoJSON importado;
- sem alteracao em `MapasScreen`;
- sem alteracao em `FazendaMapaScreen`;
- sem alteracao em `LimiteArea.list`;
- sem alteracao na Sela de Prata I.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` passou com acesso a rede liberado;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16F.6 - Associacao Local De GeoJSON A Propriedade

Status em 2026-06-05: foi criado o fluxo minimo para anexar um GeoJSON local
de talhoes a uma Propriedade, usando picker, validacao, copia para storage
interno e metadados em `@tche:geojson-imports:v1`.

Arquivo criado:

- `src/services/GeoJsonPropertyImportWorkflow.ts`.

Teste criado:

- `tests/geojsonPropertyImportWorkflow.test.js`.

Arquivos alterados:

- `src/screens/MapasScreen.tsx`;
- `package.json`;
- `tsconfig.domain-compat.json`;
- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Comportamento atual:

- em `MapasScreen`, o botao `Anexar GeoJSON dos talhoes` aparece apenas em
  contexto de uma Propriedade especifica;
- Admin pode iniciar o fluxo;
- Colaborador pode iniciar somente quando a Propriedade esta dentro do escopo
  regional efetivo;
- Produtor nao ve o botao;
- a visao geral/global nao mostra o botao;
- a tela mostra texto de apoio informando que o arquivo ficara salvo
  localmente no aparelho;
- depois de selecionar e validar o arquivo, a tela mostra pre-visualizacao com
  nome, contagem de talhoes, partes/poligonos, tipos de geometria, tamanho,
  ano, safra e avisos;
- ao confirmar, o arquivo e copiado para `tche-geojson-imports/` e o metadado
  ativo e criado no `GeoJsonImportService`;
- se ja houver um ativo da mesma Propriedade, ele passa para `substituido`;
- depois do sucesso, a tela recarrega os metadados e mostra `GeoJSON anexado`
  com nome do arquivo, quantidade de talhoes, data e status.

Protecoes:

- o indice salva apenas metadados pequenos;
- nao salva `FeatureCollection`, `features`, `coordinates`, `poligono` ou
  `poligonos`;
- se a copia passar e a criacao de metadado falhar, o workflow tenta remover o
  arquivo copiado;
- se o rollback falhar, retorna erro controlado `ROLLBACK_FAILED`;
- para a Propriedade `p_sela1`, o modal exibe aviso de que ja existe
  demarcacao demonstrativa e o arquivo sera salvo apenas como anexo local ate
  a proxima etapa.

Limites preservados:

- `LimiteArea.list` continua sendo a fonte visual dos talhoes;
- `FazendaMapaScreen` e `MapaFazendaView` nao leem importacoes locais;
- nenhum GeoJSON importado e renderizado nesta fase;
- seed/assets da Sela de Prata I e PNGs de fertilidade nao foram alterados;
- sem backend, sync, RBAC real ou APK.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonPropertyImportWorkflow.test.js` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` falhou no sandbox restrito por bloqueio de rede e
  depois passou com rede liberada;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16F.7 - Visualizacao Do GeoJSON Local Ativo Nos Mapas

Status em 2026-06-05: foi criada a camada de runtime que permite visualizar o
GeoJSON local ativo da Propriedade em `MapasScreen` e `FazendaMapaScreen`, com
fallback controlado para os talhoes do seed/mock.

Arquivo criado:

- `src/services/GeoJsonTalhoesLayerService.ts`.

Teste criado:

- `tests/geojsonTalhoesLayerService.test.js`.

Arquivos alterados:

- `src/screens/MapasScreen.tsx`;
- `src/screens/FazendaMapaScreen.tsx`;
- `package.json`;
- `tsconfig.domain-compat.json`;
- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Comportamento atual:

- sem GeoJSON local ativo, os mapas continuam usando `LimiteArea.list`;
- com GeoJSON local ativo e valido, o arquivo interno e relido e validado em
  runtime, e os talhoes normalizados em memoria viram a camada visual efetiva;
- se houver metadado ativo, mas a URI, leitura ou validacao falhar, a tela
  mostra aviso e volta para a demarcacao disponivel no seed/mock;
- `MapasScreen` usa a camada efetiva em estatisticas, filtros de ano/talhao,
  pre-visualizacao SVG, listagem e detalhe do talhao;
- `FazendaMapaScreen` usa a camada efetiva no mapa interativo, drawer, lista de
  talhoes e selecao por rota;
- apos confirmar um novo anexo GeoJSON, `MapasScreen` recarrega a camada local
  e passa a informar que os talhoes foram carregados do GeoJSON local;
- Produtor nao recebe permissao para anexar arquivo, mas visualiza a camada
  local ativa quando acessa a propria Propriedade autorizada.

Persistencia e limites preservados:

- talhoes normalizados nao sao salvos em `AsyncStorage`;
- o indice continua salvando somente metadados pequenos;
- `FeatureCollection`, `features`, `coordinates`, `poligono` e `poligonos`
  nao sao gravados no indice;
- `LimiteArea.list`, `src/api/mock.ts`, seed/assets da Sela de Prata I,
  `ShapeRenderer`, `MapaFazendaView` e `TalhaoDetailModal` nao foram alterados;
- sem backend, upload remoto, sync, substituicao/remocao segura, RBAC real ou
  APK nesta fase.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonTalhoesLayerService.test.js` passou;
- `node tests/geojsonPropertyImportWorkflow.test.js` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` falhou no sandbox restrito por bloqueio de rede e
  depois passou com rede liberada;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16F.8 - Substituicao E Remocao Segura De GeoJSON Local

Status em 2026-06-05: foi criado o fluxo minimo para Admin e Colaborador no
escopo substituirem ou removerem com seguranca o GeoJSON local ativo de uma
Propriedade.

Arquivo criado:

- `src/services/GeoJsonPropertyManageWorkflow.ts`.

Teste criado:

- `tests/geojsonPropertyManageWorkflow.test.js`.

Arquivos alterados:

- `src/screens/MapasScreen.tsx`;
- `package.json`;
- `tsconfig.domain-compat.json`;
- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Comportamento atual:

- quando nao ha GeoJSON ativo, `MapasScreen` mostra
  `Anexar GeoJSON dos talhoes`;
- quando ha GeoJSON ativo, o painel mostra
  `Substituir GeoJSON dos talhoes` e `Remover GeoJSON local`;
- Admin pode gerenciar em contexto de Propriedade;
- Colaborador pode gerenciar apenas dentro do escopo efetivo;
- Produtor nao ve acoes administrativas, mas continua visualizando a camada
  local ativa quando possui acesso a Propriedade;
- antes da substituicao, a tela avisa que o novo arquivo substituira a camada
  local atual;
- antes da remocao, a tela explica que a Propriedade e anexos tecnicos nao
  serao apagados e que o seed/mock volta a aparecer quando existir.

Ordem segura de substituicao:

- o fluxo reutiliza picker, leitura, validacao e pre-visualizacao da 16F.6;
- o novo arquivo e copiado para o storage interno;
- o novo metadado e criado como `ativo`;
- o metadado ativo anterior vira `substituido`;
- somente depois disso o workflow tenta apagar o arquivo fisico antigo;
- se a copia ou o metadado novo falhar, o ativo anterior permanece ativo;
- se apagar o arquivo antigo falhar depois do novo ativo existir, a
  substituicao permanece valida e a tela recebe warning controlado.

Ordem segura de remocao:

- o metadado ativo e marcado como `removido`;
- depois o workflow tenta apagar o arquivo fisico via
  `GeoJsonStorageService.deleteStoredGeoJson`;
- caminhos fora de `tche-geojson-imports` sao recusados pelo storage;
- arquivo fisico inexistente nao derruba o fluxo;
- se apagar o arquivo falhar, o metadado permanece `removido` e a tela mostra
  aviso controlado;
- apos remover, a tela recarrega metadados e camada efetiva, voltando para
  seed/mock quando houver.

Protecoes preservadas:

- nao apaga seed/assets da Sela de Prata I;
- nao apaga `data/processados/p_sela1`;
- nao altera `src/api/mock.ts`;
- nao altera `LimiteArea.list`;
- nao salva `FeatureCollection`, `features`, `coordinates`, `poligono` ou
  `poligonos` no indice;
- nao altera `@tche:mock-mvp:v1`;
- sem backend, upload remoto, sync, RBAC real, PNG real, gestao completa de
  historico ou APK nesta fase.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `node tests/geojsonPropertyManageWorkflow.test.js` passou;
- `node tests/geojsonTalhoesLayerService.test.js` passou;
- `node tests/geojsonPropertyImportWorkflow.test.js` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` falhou no sandbox restrito por bloqueio de rede e
  depois passou com rede liberada;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16F.9 - Revisao Tecnica E Checklist Android Do GeoJSON Local

Status em 2026-06-05: foi executada revisao tecnica final da frente GeoJSON
local e preparado o checklist de smoke Android fisico. O smoke em aparelho
fisico ainda nao foi executado nesta sessao.

Arquivo alterado por correcao pequena:

- `src/screens/MapasScreen.tsx`;
- `src/services/GeoJsonFilePickerService.ts`;
- `tests/geojsonFilePickerService.test.js`.

Arquivos de documentacao alterados:

- `docs/project/fase-16f-geojson-local.md`;
- `docs/project/estado-atual.md`.

Correcao aplicada:

- depois de confirmar anexo ou substituicao com metadado salvo, a modal de
  pre-visualizacao fecha antes da recarga da camada;
- se a recarga posterior da camada falhar, a tela mostra warning controlado em
  vez de tratar a operacao inteira como falha;
- isso reduz risco de modal presa apos gravacao bem-sucedida;
- o picker aceita MIME generico Android `application/octet-stream` quando o
  nome do arquivo continua tendo extensao `.geojson` ou `.json`;
- arquivos com extensoes invalidas continuam bloqueados mesmo quando o MIME
  informado pelo Android e generico.

Resultado da revisao:

- picker cancelado permanece sem erro agressivo;
- arquivo invalido retorna mensagem controlada;
- falha de leitura/validacao de GeoJSON ativo usa warning e fallback para
  seed/mock;
- substituicao so remove arquivo antigo depois do novo ativo existir;
- remocao marca metadado como `removido` e tenta apagar apenas arquivo local
  seguro;
- Produtor nao ve acoes administrativas e continua podendo visualizar camada
  local ativa quando possui acesso;
- Admin e Colaborador no escopo podem anexar, substituir e remover;
- Sela de Prata I preserva seed/assets, `data/processados/p_sela1`,
  `src/api/mock.ts`, `LimiteArea.list` e PNGs existentes.

Escopo preservado:

- nao iniciou PNG;
- nao implementou backend;
- nao implementou sync;
- nao implementou RBAC real;
- nao alterou modelo de dados;
- nao refatorou arquitetura;
- nao gerou APK final.

Validacoes executadas:

- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- validacao direta de `data/processados/p_sela1/2025/manifesto.json` confirmou
  que o manifesto nao e importavel como GeoJSON;
- validacao direta de `data/processados/p_sela1/2025/limites_talhoes.geojson`
  passou com 15 talhoes e sem warnings;
- `node tests/geojsonPropertyManageWorkflow.test.js` passou;
- `node tests/geojsonTalhoesLayerService.test.js` passou;
- `node tests/geojsonPropertyImportWorkflow.test.js` passou;
- `node tests/geojsonStorageService.test.js` passou;
- `node tests/geojsonFilePickerService.test.js` passou, incluindo MIME
  generico Android `application/octet-stream`;
- `node tests/geojsonImportValidator.test.js` passou;
- `node tests/geojsonImportService.test.js` passou;
- `npx expo install --check` falhou no sandbox restrito por bloqueio de rede e
  passou apos liberacao de rede, sem divergencias de dependencias Expo;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

Recomendacao:

- a frente GeoJSON esta tecnicamente pronta para smoke Android;
- manter a Fase 16F aberta operacionalmente ate o smoke fisico passar;
- nao iniciar 16G/PNG antes de registrar o resultado do smoke Android.

## Fase 16G.1 - Diagnostico E Contrato Local De Anexos PNG

Status em 2026-06-05: foi aberta a Fase 16G.1 em paralelo a pendencia
operacional da 16F, por necessidade de adiantar o diagnostico de anexos PNG de
mapas tecnicos/fertilidade. Isso nao fecha a Fase 16F: o smoke Android fisico
do GeoJSON local continua pendente.

Documento principal:

- `docs/project/fase-16g-anexos-png-local.md`

Entregas desta abertura:

- diagnostico dos PNGs demonstrativos da Sela de Prata I;
- mapeamento de como os anexos atuais sao cadastrados em `Mapa`;
- mapeamento de filtros, listagem e abertura do PNG em `MapasScreen`;
- criacao do tipo isolado `src/types/anexoPngLocal.ts`, com
  `PngMapImportMetadata` e chave futura recomendada
  `@tche:png-map-imports:v1`;
- recomendacao de manter PNG fisico fora do `AsyncStorage`, copiando arquivo
  para storage interno do app e salvando apenas metadados pequenos.

Escopo preservado:

- nao alterou `MapasScreen`;
- nao criou botao de anexar PNG;
- nao adicionou seletor de imagem/documento;
- nao instalou dependencia nova;
- nao copiou arquivo para storage;
- nao criou persistencia local nova;
- nao alterou `Mapa.list`;
- nao alterou os registros nem os PNGs da Sela de Prata I;
- nao implementou backend, RBAC real, sincronizacao, GeoJSON ou APK.

## Microfase De Cadastro Rapido De Propriedade No Cadastro De Produtor

Status em 2026-05-29: o fluxo `Admin -> Usuarios -> Novo Usuario -> Perfil Produtor` continua 100% visual/mockado, mas agora permite criar uma propriedade rapida quando ela ainda nao existe.

No cadastro de usuario produtor, o admin pode:

- selecionar uma ou mais propriedades existentes
- cadastrar uma nova propriedade rapida no mesmo fluxo

O cadastro rapido de propriedade inclui:

- nome da propriedade
- municipio
- UF/Estado
- regiao
- micro-regiao
- area total
- status
- tipo de vinculo
- vinculo principal
- observacoes

Regiao e micro-regiao usam `territorioCompat` quando houver dados suficientes no mock, com fallback textual para preservar compatibilidade. Ao escolher uma micro-regiao, a tela exibe colaboradores sugeridos apenas de forma visual.

Ao salvar:

- o mock cria a propriedade via `Produtor.create`
- o mock vincula a propriedade ao usuario produtor por `usuario_propriedade`
- o vinculo usa o tipo escolhido, como titular ou responsavel
- o vinculo pode ser marcado como principal
- campos legados como `produtor_id`, `proprietario_id`, `regiao`, `microregiao` e `fazenda_id` continuam preservados

Validacoes mantidas nesta microfase:

- produtor ativo exige propriedade existente ou cadastro rapido valido
- produtor pendente sem propriedade continua permitido
- cadastro rapido ativo exige campos minimos validos, evitando criar propriedade vazia
- cadastro rapido cancelado/limpo nao cria propriedade nem vinculo

Este fluxo prepara a futura criacao combinada:

- `usuario`
- `propriedade`
- `usuario_propriedade`

Risco residual conhecido:

- como o mock nao possui transacao, pode haver inconsistencia se a propriedade for criada e uma etapa posterior do salvamento do usuario falhar
- no backend futuro, esse fluxo deve ser transacional

Limites importantes desta microfase:

- usuario criado ou editado continua nao criando login real
- colaboradores sugeridos continuam sendo apenas indicacao visual
- propriedades atribuidas diretamente ao colaborador continuam sem efeito de
  permissao no motor atual
- o motor atual ja usa `sub_regioes` e, quando elas estiverem vazias ou
  ausentes, `vinculos_microregioes` como fallback territorial do colaborador

Fora do escopo mantido:

- backend
- banco real
- API real
- migrations
- autenticacao real
- senha real
- convite
- reset
- RBAC/permissoes granulares completas
- upload/storage
- Drive
- CRUD real de regioes/microregioes
- RBAC final por propriedade atribuida

Validacoes executadas na implementacao:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou; quando executado no Windows, pode emitir apenas avisos normais de LF/CRLF

## Microfase De Sincronizacao Territorial E Vinculos Visuais

Status em 2026-05-28: a frente territorial continua 100% visual/mockada, mas foi sincronizada para reduzir retrabalho futuro na transicao para backend/banco.

Foi criado o helper `territorioCompat`, que deriva regioes e microregioes a partir das propriedades mockadas. A estrutura visual passa a favorecer a leitura:

- Regiao
- Microregiao
- Propriedade

Regiao e microregiao ainda preservam compatibilidade com os campos textuais legados `regiao` e `microregiao`. Nao existe cadastro CRUD real de regioes/microregioes nesta fase.

No `Admin -> Usuarios`:

- colaborador pode selecionar visualmente regioes e uma ou mais microregioes
- a tela mostra uma previa das propriedades abrangidas pelas microregioes escolhidas
- colaborador tambem pode ter propriedades atribuidas diretamente no mock visual
- produtor pode ter multiplas propriedades vinculadas
- ao vincular produtor a uma propriedade que ja tem outro produtor principal no mock, a tela exibe alerta visual

No cadastro de propriedade:

- a tela usa selecao de Regiao e Microregiao derivada do mock quando ha dados suficientes
- ao escolher uma microregiao, a tela sugere colaboradores compativeis
- o payload continua salvando `regiao` e `microregiao` textuais para compatibilidade

No detalhe da propriedade, para administracao:

- a tela mostra vinculos visuais mockados de usuario produtor vinculado
- a tela mostra colaboradores sugeridos ou relacionados ao territorio
- a interface deixa claro que esses vinculos sao preparacao visual/mockada

Limites importantes desta microfase:

- `vinculos_microregioes` agora e fallback territorial efetivo quando
  `sub_regioes` estiver vazio ou ausente
- `propriedades_atribuidas` continua sendo vinculo visual/admin preparatorio,
  sem restringir nem ampliar acesso efetivo
- a compatibilidade foi preservada com `produtor_id`, `proprietario_id`, `sub_regioes`, `propriedades_atribuidas`, `regiao`, `microregiao`, `fazenda_id` e o motor atual de permissoes

Fora do escopo mantido:

- backend
- banco real
- migrations
- API real
- autenticacao real
- senha real
- convite
- reset
- RBAC/permissoes granulares completas
- upload/storage
- Drive
- CRUD real de regioes/microregioes
- RBAC final por propriedade atribuida

Validacoes executadas na implementacao:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou; quando executado no Windows, pode emitir apenas avisos normais de LF/CRLF

## Microfase Do Fluxo Do Colaborador

Status em 2026-05-27: o fluxo do colaborador esta pronto para teste manual interno no MVP visual/mockado apos revisao e validacao tecnica.

Login principal de teste:

- `carlos@agrotche.com`
- senha: `colab123`

Fluxo coberto:

- colaborador acessa Home, Propriedades, Visitas, Caderno e Perfil
- a interface visivel favorece `Propriedades`; a rota tecnica da tab do colaborador e `PropriedadesColaborador`, preservando campos internos legados como `fazenda`, `fazendaId` e `fazenda_id`
- o colaborador consegue criar visita pelo fluxo global de Visitas -> Nova Visita
- o colaborador consegue criar visita pelo contexto da propriedade, em Propriedade -> Visitas Tecnicas -> Nova Visita
- `NovaVisitaScreen` aceita `fazendaId` opcional por rota, pre-seleciona a propriedade contextual e trava a selecao nesse contexto
- a criacao de visita continua validando o escopo; colaborador fora da regiao/sub-regiao permitida permanece bloqueado

Material Tecnico no fluxo de mapas:

- `Material Tecnico` esta apenas como mock/prototipo visual
- o botao/modal nao representa upload real, storage, Drive, backend ou cadastro persistente
- o arquivo e tratado conceitualmente como recurso anexado ao material tecnico
- os empty states de mapas diferenciam ausencia de demarcacao/talhoes e ausencia de materiais tecnicos/anexos

Fora do escopo desta microfase:

- backend
- upload real
- storage local gerenciado ou remoto
- Drive
- pipeline de mapas
- nova modelagem
- permissoes complexas novas
- renomeacao interna de `fazenda_id`, `fazenda`, rotas, arquivos ou contratos legados

Validacoes executadas:

- `npm run typecheck` passou
- `npm run test:domain-compat` passou
- `git diff --check` passou; quando executado no Windows, pode emitir apenas avisos normais de LF/CRLF

## Estado Atual Dos Mapas Da Propriedade Sela De Prata I

O estado atual desta frente e um MVP visual/mockado. Ele serve para validar a experiencia minima de consulta dentro do app, mas nao representa uma implementacao completa de insercao, upload, catalogacao ou gestao de arquivos.

Status do teste manual interno em 2026-05-26: a frente visual/mockada de mapas e anexos da propriedade Sela de Prata I passou no teste manual do MVP.

Fluxo validado:

- login como produtor da Sela de Prata I
- acesso a propriedade
- abertura do mapa base dos talhoes
- toque em talhao com exibicao de nome/codigo
- abertura da tela de mapas/anexos
- filtro de Fertilidade
- abertura dos cinco PNGs da amostra: pH, Argila, Materia Organica, Fosforo e Potassio
- exibicao da profundidade `10-20 cm`

Esse resultado valida apenas a experiencia visual/mockada prevista para o MVP atual. Ele nao significa que upload, backend, storage, pipeline de importacao, cadastro administrativo real ou gestao completa de arquivos estejam implementados.

O mapa interativo da propriedade usa, por padrao, talhoes/limites vindos de
`LimiteArea`, alimentados pelo GeoJSON normalizado de
`src/assets/geojson/selaDePrata1Talhoes.ts`, derivado de
`data/processados/p_sela1/2025/limites_talhoes.geojson`. Desde a Fase 16F.7,
quando existe GeoJSON local ativo, valido e acessivel para a Propriedade, a
camada visual efetiva usa esse arquivo local em runtime; se a leitura ou
validacao falhar, volta para a demarcacao disponivel no seed/mock.

Os mapas de elementos de fertilidade sao registros mockados da entidade `Mapa`. Na amostra atual, os PNGs ficam como anexos visuais internos do app em `src/assets/mapas/sela-prata-i/2025/fertilidade/`. Esses PNGs nao sao camadas georreferenciadas e nao sao sobrepostos ao mapa. Eles devem ser tratados como anexos de fertilidade para consulta.

Atualizacao em 2026-06-01: a nomenclatura visual da `MapasScreen` foi padronizada para diferenciar anexos de fertilidade, mapas de fertilidade e materiais tecnicos genericos. A tela passou a exibir textos como `Anexos de fertilidade`, `Anexo de fertilidade PNG`, `Mapa de fertilidade`, `Material tecnico` e `Abrir anexo`, sem alterar filtros, download, permissao, rotas ou contratos.

Os cinco PNGs de fertilidade da Sela de Prata I foram enriquecidos no mock com metadados conceituais do modelo futuro:

- `propriedade_id`
- `tipo_anexo`
- `elemento_label`
- `talhao_id`
- `talhao_nome`
- `arquivo_nome_original`
- `origem`
- `status`
- `visivel_para_produtor`

Os campos legados foram preservados para compatibilidade:

- `fazenda_id`
- `produtor_id`
- `talhao`
- `subcategoria`
- `data_criacao`
- `disponivel_download`

O tipo `src/types/anexoFertilidade.ts` existe como contrato futuro isolado, mas ainda nao esta integrado a telas, mocks estruturais, contratos de dominio, filtros, download ou permissoes.

Nao existe ainda:

- upload real de arquivo pelo admin ou colaborador
- cadastro administrativo persistente de PNG/anexo
- persistencia real em banco ou storage
- API/backend para anexos
- pipeline de importacao automatica
- importacao automatica do Drive
- leitura/importacao de todos os arquivos da pasta `PANORAMA-DAS-LAVOURAS`
- fluxo real de aprovacao/publicacao
- gestao completa de versoes, liberacao, historico ou revisao do acervo

No futuro, cada PNG, PDF, KML, KMZ ou GeoJSON devera virar um registro tecnico com metadados confirmados manualmente antes da publicacao. O arquivo fisico deve ficar em storage/backend, enquanto o app deve consumir metadados, URL e regras de visibilidade/publicacao.

A proxima evolucao de arquivos reais permanece pendente e deve tratar fluxo administrativo, persistencia, storage/backend, permissoes por acao e pipeline produtivo de recebimento, validacao e publicacao.

Documento de fechamento: `docs/project/fechamento-mapas-anexos-sela-prata-i.md`.

## Fechamento Do Fluxo Do Produtor No MVP Visual/Mockado

Status em 2026-05-27: o fluxo do produtor passou no teste manual do MVP visual/mockado apos a decisao oficial de nomenclatura de produto.

Fluxo validado:

- login produtor
- entrada em `Minhas Propriedades`
- abertura da propriedade
- detalhe da propriedade
- mapa dos talhoes
- anexos de fertilidade
- visitas tecnicas
- caderno de campo
- mensagens vazias
- nomenclatura visivel usando `Propriedade`

Esse resultado valida a experiencia principal de consulta do produtor na propria propriedade. Ele nao altera o estado de backend, upload, storage, pipeline produtivo, permissoes ou modelagem.

Documento de fechamento: `docs/project/fechamento-fluxo-produtor.md`.

## Fechamento Formal Da Fase 2

A Fase 2 pode ser considerada formalmente encerrada.

- O dominio central foi estabilizado com contratos canonicos, compatibilidade de borda controlada e uso explicito de `fazenda_id` como chave operacional interna quando esse e o significado real do contexto de propriedade.
- O alinhamento semantico ja cobre dominio, auth, validadores, schemas, mock persistence, acesso, navegacao principal, filtros, formularios e camada offline/sync/cache.
- As pendencias restantes foram reduzidas a aliases publicos de compatibilidade e nomes historicos localizados na superficie, sem contaminar o nucleo canonico.
- Esses residuos nao bloqueiam o encerramento da fase porque nao reintroduzem ambiguidade estrutural no miolo do sistema e ja estao isolados para limpeza incremental de baixo risco.

## Fechamento Da Frente Funcional Produtor / Propriedade

Status em 2026-04-21: a frente funcional de `Produtor` / `Propriedade` esta concluida no nivel necessario para o MVP atual. A implementacao ainda usa nomes internos historicos de fazenda em rotas, arquivos, contratos e campos.

Entregas consolidadas:

- cadastro de propriedade com vinculo real ao titular
- permissoes defensivas em detalhe e edicao
- listagem orientada a Propriedade + Titular
- detalhe com contexto real de propriedade atual e titular
- edicao de propriedade sem quebrar vinculo com titular
- exclusao de propriedade com validacao de integridade

Decisoes funcionais aplicadas:

- a entidade operacional de produto nesse fluxo e a propriedade, mesmo que nomes historicos de modulos, rotas e componentes ainda usem `Produtor` ou `Fazenda`
- o titular e tratado como vinculo da propriedade e nao deve ser alterado acidentalmente em edicao simples
- mapas, visitas, caderno e limites devem usar `fazenda_id` como contexto operacional interno enquanto a compatibilidade tecnica for mantida
- colaborador opera apenas dentro do proprio escopo regional/sub-regional
- exclusao de propriedade fica bloqueada quando houver mapas, visitas, registros de caderno ou limites vinculados

Limites assumidos para evolucao posterior:

- reassociacao de titular nao foi implementada
- edicao centralizada dos dados do titular nao foi implementada
- limpeza assistida ou reassociacao de dependencias antes da exclusao nao foi implementada
- exclusao em cascata controlada nao foi implementada

Esses limites nao bloqueiam o MVP atual e devem ser tratados como evolucao posterior, nao como pendencia de fechamento desta frente.

## Fechamento Da Frente Visitas / Caderno Por Propriedade

Status em 2026-05-19: a frente funcional de visitas tecnicas por propriedade e caderno de campo por propriedade esta concluida no nivel necessario para o MVP atual. Internamente, o vinculo ainda e preservado por `fazenda_id`.

Entregas consolidadas:

- permissoes defensivas para rotas diretas de visitas e caderno
- bloqueio de produtor para criacao e edicao de visitas
- bloqueio de colaborador fora do proprio escopo regional/sub-regional
- preservacao de `fazenda_id` em edicao de visita e caderno
- criacao de caderno no contexto real da propriedade
- aba Caderno no detalhe da propriedade com registros da propriedade atual
- visibilidade de caderno respeitando restricao para produtor

Durante o smoke foram aplicados dois ajustes pontuais:

- `NovoCadernoScreen` passou a exibir carregamento enquanto valida propriedades autorizadas, evitando flash de formulario antes do bloqueio
- `ProdutorScreen` passou a recarregar dados ao receber foco, garantindo que cadernos criados pela aba aparecam ao voltar para a propriedade

Decisao funcional pendente para evolucao posterior:

- definir se produtor tera caminho visual explicito para abrir detalhe de visitas proprias; a permissao por rota valida ja foi validada

Documento de fechamento: `docs/project/fechamento-visitas-caderno-fazenda.md`.

## Pontos de Atencao Tecnicos

- O dominio central ja foi estabilizado, mas ainda existem aliases historicos de compatibilidade na superficie publica
- Ainda existem nomes legados isolados em rotas, wrappers e algumas telas historicas
- A frente `Produtor` / `Propriedade` ja possui permissoes defensivas e integridade de exclusao; outros fluxos ainda podem exigir a mesma revisao pontual
- A camada offline-first ja esta alinhada semanticamente, mas ainda nao esta conectada a um backend real
- A visualizacao atual de mapas usa tiles online OpenStreetMap no MVP; cache/offline de tiles e estrategia de provedor ainda precisam de decisao antes de producao
- A ingestao ideal de demarcacoes para o app e um GeoJSON/JSON final ja normalizado fora do celular; o conversor local de shapefile e o importador KML sao ferramentas de desenvolvimento, nao pipeline definitivo de producao
- O fluxo real de importacao geoespacial deve passar por pre-visualizacao e aprovacao antes de publicar o GeoJSON/JSON final no app ou backend
- `src/services/MapaCacheService.ts` usa `expo-file-system`, mas essa dependencia nao aparece em `package.json`

## Complementares Oficiais

Use estes documentos junto com este retrato do presente:

- `docs/project/contexto-consolidado.md` para problema, proposito, usuarios e contexto do dominio
- `docs/project/escopo-mvp.md` para o limite atual do MVP
- `docs/project/regras-de-negocio.md` para regras de dominio e acesso
- `docs/project/decisoes-consolidadas.md` para direcoes ja assumidas pelo projeto
- `docs/project/matriz-cadastros-mvp.md` para campos, obrigatoriedades e riscos dos cadastros do MVP
- `docs/project/pendencias-de-definicao.md` para pontos reais ainda em aberto
- `docs/project/plano-reorganizacao.md` para a ordem tecnica do trabalho
- `docs/project/roadmap-futuro.md` para backlog de evolucao apos a estabilizacao da base
- `docs/README.md` para a trilha geral de leitura da documentacao

## Proximo Passo Recomendado

Com a frente `Produtor` / `Propriedade` fechada para o MVP atual, o proximo trabalho deve escolher uma nova frente funcional ou tecnica sem reabrir a limpeza estrutural ja encerrada.

Opcoes seguras:

- evoluir outra frente funcional do MVP, como visitas, caderno ou mapas
- iniciar a separacao gradual da camada mock quando houver decisao sobre backend
- executar apenas limpeza nominal pequena e localizada, se ela desbloquear trabalho funcional real
