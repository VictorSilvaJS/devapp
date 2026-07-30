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
- `MapasScreen.tsx` usa `Material tecnico` como nome da area e organiza a
  consulta por ano e pelas categorias Fertilidade, Correcao de solo e
  Prescricao; nomes especificos de itens legados permanecem apenas na leitura
  de seus respectivos registros
- `MapasScreen.tsx` exibe metadados de elemento, safra, talhao/propriedade inteira, profundidade e nome original quando esses dados existem, usando campos futuros com fallback para campos legados
- Os fluxos anteriores de PNG por `@tche:png-map-imports:v1` e Prescricao ZIP
  por `@tche:prescription-zip-imports:v1` permanecem legiveis como
  compatibilidade, sem alterar `Mapa.list` nem os assets demonstrativos.
- `src/utils/pngMapToMapaCompat.ts` converte metadados PNG locais em itens compativeis com a listagem de mapas, preservando `arquivo_uri_local`, visibilidade por perfil e indicador `PNG local`; PNG local ativo agora abre em modal com `Image` e source `{ uri: arquivo_uri_local }` apos validacao de URI segura e existencia no storage interno, e pode ser substituido/removido localmente por Admin ou Colaborador autorizado
- Para novos anexos, `Material tecnico` usa contrato local unificado por
  Propriedade, ano e categoria, aceita PNG/PDF/ZIP, preserva o nome original,
  gera titulo automaticamente e guarda apenas metadados pequenos em
  `@tche:material-tecnico-imports:v1`; o arquivo fisico continua no storage
  interno. Fertilidade, Correcao de solo e Prescricao possuem campos
  condicionais conforme `modelo-material-tecnico.md`. PDF e ZIP nao possuem
  promessa de visualizacao ou processamento.
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
- leitura e gestao segura dos PNGs locais legados por Propriedade para Admin e
  Colaborador dentro do escopo; novos anexos usam o fluxo unificado de Material
  tecnico
- fluxo unificado para novos anexos de Material tecnico em PNG, PDF ou ZIP,
  organizado por Propriedade, ano e Fertilidade/Correcao de solo/Prescricao,
  preservando a leitura dos PNGs e ZIPs legados
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
- salvamento persistente de anexos em banco ou storage remoto; para PNG existe
  apenas storage local demonstrativo do MVP
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

Comportamento do corte 16G.5:

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

## Fase 16G.2 - Servico Local De Metadados PNG

Status em 2026-06-05: foi criada a infraestrutura local minima para
metadados de anexos PNG importados futuramente, sem selecionar arquivo, sem
copiar imagem, sem botao e sem integrar com `Mapa.list` ou `MapasScreen`.

Arquivos principais:

- `src/services/PngMapImportService.ts`;
- `src/types/anexoPngLocal.ts`;
- `tests/pngMapImportService.test.js`;
- `docs/project/fase-16g-anexos-png-local.md`.

O servico usa `AsyncStorage` na chave separada
`@tche:png-map-imports:v1`, com snapshot versionado contendo apenas
metadados pequenos de `PngMapImportMetadata`. A chave `@tche:mock-mvp:v1` nao
e usada por esta frente.

Operacoes disponiveis:

- listar todos os metadados PNG;
- listar por Propriedade, aceitando `propriedade_id` ou `fazenda_id`;
- listar apenas ativos por Propriedade;
- buscar por id;
- criar e atualizar metadado;
- marcar como `ativo`, `substituido` ou `removido`;
- deletar apenas o metadado.

Regras implementadas:

- todo item precisa de `propriedade_id` ou `fazenda_id`, com preenchimento
  duplo por fallback;
- `origem` deve ser `arquivo_local`;
- `escopo: 'talhao'` exige `talhao_id` ou `talhao_nome`;
- `visivel_para_produtor` usa default `true`, mantendo alinhamento com os
  anexos demonstrativos atuais;
- multiplos PNGs `ativo` sao permitidos para a mesma Propriedade, porque PNG e
  biblioteca de anexos e nao camada unica de talhoes;
- `removido` e `substituido` nao aparecem na listagem de ativos;
- JSON corrompido retorna lista vazia sem derrubar o app;
- campos suspeitos de conteudo bruto, como `base64`, `content`, `bytes`,
  `data`, `blob`, `buffer`, `image`, `asset`, `source` e `require`, sao
  rejeitados.

Escopo preservado:

- nao alterou `src/assets/mapas/sela-prata-i/2025/fertilidade/`;
- nao alterou os registros de `Mapa` da Sela de Prata I em `src/api/mock.ts`;
- nao alterou `resolveSelaPrataIFertilidadeAssetSource`;
- nao alterou `MapasScreen`;
- nao alterou `Mapa.list`;
- nao criou picker, leitura de PNG, copia para storage interno, visualizador,
  botao, backend, RBAC real, sincronizacao ou APK.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16G.3 - Seletor E Validacao Leve De PNG

Status em 2026-06-05: foi criado o servico isolado
`src/services/PngFilePickerService.ts` para selecionar e validar um PNG local
futuro via `expo-document-picker`, sem tela, sem botao, sem leitura de
conteudo, sem copia para storage interno, sem persistencia e sem integracao
com `Mapa.list` ou `MapasScreen`.

Arquivos principais:

- `src/services/PngFilePickerService.ts`;
- `tests/pngFilePickerService.test.js`;
- `docs/project/fase-16g-anexos-png-local.md`.

Regras implementadas:

- aceita somente extensao `.png`, sem diferenciar maiusculas e minusculas;
- aceita MIME `image/png`;
- aceita MIME ausente quando o nome termina em `.png`;
- aceita `application/octet-stream` como fallback de Android apenas quando o
  nome termina em `.png`;
- rejeita formatos como `.jpg`, `.jpeg`, `.webp`, `.gif`, `.pdf`, `.zip`,
  `.geojson`, `.json` e arquivos sem extensao PNG;
- aplica limite de `25 MB`;
- retorna warning `UNKNOWN_FILE_SIZE` quando o tamanho nao vem do seletor;
- retorna erros controlados para cancelamento, resultado invalido, URI ausente,
  nome ausente, formato nao suportado, MIME nao suportado e tamanho excedido.

Escopo preservado:

- nao usa `expo-image-picker`;
- nao usa `expo-file-system`;
- nao le bytes, binario, string ou conteudo do PNG;
- nao usa `AsyncStorage`;
- nao escreve em `@tche:png-map-imports:v1`;
- nao escreve em `@tche:mock-mvp:v1`;
- nao chama `PngMapImportService`;
- nao altera `Mapa.list`;
- nao altera `MapasScreen`;
- nao altera registros ou assets da Sela de Prata I;
- nao cria visualizador, formulario, botao, backend, RBAC real, sincronizacao
  ou APK.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16G.4 - Storage Interno De PNG

Status em 2026-06-05: foi criado o servico isolado
`src/services/PngStorageService.ts` para copiar PNG validado para storage
interno controlado do app, sem tela, sem botao, sem metadados persistidos e
sem integracao com `Mapa.list` ou `MapasScreen`.

Arquivos principais:

- `src/services/PngStorageService.ts`;
- `tests/pngStorageService.test.js`;
- `docs/project/fase-16g-anexos-png-local.md`.

Diretorio interno:

- `FileSystem.documentDirectory + 'tche-png-imports/'`.

Regras implementadas:

- cria diretorio base e subdiretorio por Propriedade;
- sanitiza `propriedade_id`, `importId` e nome original;
- preserva e normaliza extensao `.png`;
- remove componentes de path, barras, `../` e caracteres perigosos;
- aplica fallback `mapa-tecnico.png`;
- constroi URI segura no formato
  `.../tche-png-imports/{propriedade_id}/{importId}-{nome}.png`;
- usa `FileSystem.copyAsync` para copiar o PNG;
- confirma existencia com `FileSystem.getInfoAsync`;
- retorna URI local estavel, nome final, nome original, tamanho quando
  disponivel, MIME `image/png`, `propriedade_id`, `fazenda_id` e `copiedAt`;
- bloqueia sobrescrita por padrao e permite `overwrite: true` apenas quando
  explicito;
- remove de forma segura apenas arquivos dentro de `tche-png-imports/`;
- trata arquivo inexistente na remocao como sucesso controlado com
  `deleted: false`.

Escopo preservado:

- nao le bytes, string ou conteudo do PNG em JS;
- nao converte PNG para base64;
- nao usa fallback textual;
- nao chama `PngMapImportService`;
- nao escreve em `@tche:png-map-imports:v1`;
- nao escreve em `@tche:mock-mvp:v1`;
- nao altera `Mapa.list`;
- nao altera `MapasScreen`;
- nao altera registros ou assets da Sela de Prata I;
- nao cria visualizador, formulario, botao, backend, RBAC real, sincronizacao
  ou APK.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF;
- `npx expo install --check` passou.

## Fase 16G.5 - Botao Anexar Mapa PNG E Formulario Minimo

Status em 2026-06-05: foi criado
`src/services/PngMapPropertyImportWorkflow.ts` e a `MapasScreen.tsx` passou a
exibir o botao `Anexar mapa PNG` em contexto de uma Propriedade quando o usuario
tem permissao de edicao local.

Arquivos principais:

- `src/services/PngMapPropertyImportWorkflow.ts`;
- `tests/pngMapPropertyImportWorkflow.test.js`;
- `src/screens/MapasScreen.tsx`;
- `docs/project/fase-16g-anexos-png-local.md`.

Comportamento atual:

- Admin pode anexar PNG local;
- Colaborador pode anexar PNG local apenas dentro do escopo territorial atual;
- Produtor nao recebe acao de anexo PNG;
- o fluxo usa o seletor/validador da 16G.3, o storage interno da 16G.4 e o
  servico de metadados da 16G.2;
- o formulario minimo coleta titulo, categoria/elemento tecnico, safra, ano,
  profundidade, escopo, talhao quando aplicavel, observacoes e
  `visivel_para_produtor`;
- o arquivo fisico e copiado para `tche-png-imports/{propriedade_id}/`;
- os metadados pequenos sao persistidos em `@tche:png-map-imports:v1`;
- em falha de metadados apos copia, o workflow tenta remover o arquivo copiado;
- a tela mostra apenas resumo local dos PNGs ativos da Propriedade.

Escopo preservado no corte 16G.5:

- `Mapa.list` nao foi alterado;
- os PNGs locais ainda nao aparecem na listagem principal de materiais/anexos;
- naquele corte, a visualizacao local ainda nao existia;
- nao ha substituicao/remocao de PNG pela tela;
- registros e assets da Sela de Prata I nao foram alterados;
- nao ha backend, upload remoto, RBAC real, sincronizacao ou APK final.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF;
- `npx expo install --check` passou.

## Fase 16G.6 - PNG Local Na Listagem Principal

Status em 2026-06-05: foi criado `src/utils/pngMapToMapaCompat.ts` e os PNGs
locais ativos passaram a aparecer na listagem principal de
`Mapas/Arquivos tecnicos` da `MapasScreen`.

Arquivos principais:

- `src/utils/pngMapToMapaCompat.ts`;
- `tests/pngMapToMapaCompat.test.js`;
- `src/screens/MapasScreen.tsx`;
- `docs/project/fase-16g-anexos-png-local.md`.

Comportamento atual:

- `MapasScreen` continua carregando `Mapa.list()` como antes;
- PNGs locais ativos sao carregados por Propriedade permitida a partir dos
  metadados em `@tche:png-map-imports:v1`;
- a listagem principal usa uma lista derivada em runtime combinando mapas
  mockados filtrados com PNGs locais convertidos;
- o helper de compatibilidade preenche os campos usados pela tela, como
  titulo, categoria, subcategoria/elemento, `fazenda_id`, `propriedade_id`,
  talhao, safra, profundidade, nome original, `arquivo_uri_local`, formato
  `png`, `tipo_anexo: 'anexo_png_local'`, `origem: 'arquivo_local'` e
  indicador `PNG local`;
- Admin e Colaborador veem PNGs locais ativos das Propriedades dentro do seu
  escopo;
- Produtor ve apenas PNG local ativo da propria Propriedade quando
  `visivel_para_produtor === true`;
- os filtros existentes de Propriedade, categoria, safra/ano, talhao, busca e
  ordenacao passam a considerar a lista combinada.

Acao de abrir:

- PNGs asset/mockados da Sela de Prata I continuam abrindo no modal atual;
- durante a 16G.6, PNG local ainda nao abria e ficava reservado para 16G.7.

Escopo preservado:

- `Mapa.list` nao foi alterado;
- `@tche:mock-mvp:v1` nao recebe dados do PNG local;
- registros e assets da Sela de Prata I nao foram alterados;
- nao ha preview real neste corte historico da 16G.6;
- nao ha zoom, substituicao ou remocao de PNG local pela tela;
- nao ha backend, upload remoto, RBAC real, sincronizacao ou APK final.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF;
- `npx expo install --check` passou.

## Fase 16G.7 - Visualizacao De PNG Local Em Modal

Status em 2026-06-06: PNGs locais ativos listados na `MapasScreen` agora
abrem em modal com `Image`, usando source `{ uri: arquivo_uri_local }` do
storage interno.

Implementacao:

- `src/utils/pngMapToMapaCompat.ts` passou a expor
  `resolveMapaPngImageSource`, que retorna `{ uri }` apenas para PNG local
  valido;
- `isPngLocalMapa` identifica PNG local por `tipo_anexo:
  'anexo_png_local'`, `is_png_local: true` ou por `origem: 'arquivo_local'`
  com `formato_arquivo: 'png'` e `arquivo_uri_local`;
- `MapasScreen.tsx` valida a URI com
  `PngStorageService.isSafePngStorageUri` e confirma existencia com
  `PngStorageService.getStoredPngInfo` antes de abrir;
- o modal atual mostra titulo, tipo `PNG local`, elemento/categoria,
  safra/ano, talhao ou Propriedade inteira, profundidade e nome original,
  sem exibir a URI local crua;
- erro de arquivo ausente mostra
  `Arquivo PNG local não encontrado neste aparelho.`;
- URI fora do diretorio seguro mostra
  `Este arquivo local não pode ser aberto por segurança.`;
- erro de carregamento do `Image` mostra
  `Não foi possível abrir este PNG local.` e mantem o modal fechavel.

Preservado:

- PNGs asset/mockados da Sela de Prata I continuam abrindo pelo resolvedor
  `resolveSelaPrataIFertilidadeAssetSource`;
- `Mapa.list`, `src/api/mock.ts` e os assets da Sela de Prata I nao foram
  alterados;
- nao ha zoom avancado, substituicao/remocao de PNG local, download,
  compartilhamento, backend, RBAC real, sincronizacao, GeoJSON ou APK final.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16G.8 - Substituicao E Remocao Segura De PNG Local

Status em 2026-06-06: foi criado
`src/services/PngMapPropertyManageWorkflow.ts` para substituir e remover PNG
local por Propriedade com rollback e remocao fisica segura dentro do storage
controlado da 16G.4.

Implementacao:

- `canManagePngMapItem` libera gestao somente para PNG local e para Admin ou
  Colaborador dentro do escopo da Propriedade;
- Produtor nao recebe acao de substituir/remover PNG local;
- `replacePngMapForPropriedade` valida novo PNG pelo seletor da 16G.3, copia
  para storage interno, cria novo metadado ativo preservando os metadados
  principais, marca o anterior como `substituido` e tenta apagar o arquivo
  local anterior;
- `removePngMapForPropriedade` marca o metadado ativo como `removido` e tenta
  apagar apenas arquivo dentro do diretorio seguro de PNG local;
- `MapasScreen.tsx` mostra `Substituir PNG` e `Remover PNG local` no modal de
  preview apenas quando o item e gerenciavel;
- o dialogo de remocao informa que a Propriedade, outros mapas/anexos e PNGs
  demonstrativos da Sela de Prata I nao serao apagados.

Preservado:

- `Mapa.list`, `src/api/mock.ts`, `@tche:mock-mvp:v1` e os assets da Sela de
  Prata I nao foram alterados;
- PNG asset/mockado da Sela continua abrindo pelo resolvedor de asset e nao
  recebe botoes de gestao;
- PNG local anexado a Sela pode ser gerido como PNG local, sem substituir os
  cinco PNGs demonstrativos embutidos;
- nao ha zoom avancado, edicao livre de metadados, download,
  compartilhamento, backend, RBAC real, sincronizacao, GeoJSON ou APK final.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapPropertyManageWorkflow.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16G.9 - Revisao Tecnica E Checklist Android PNG

Status em 2026-06-09: a 16G.9 executou revisao tecnica final da frente PNG
local e preparou o checklist de smoke Android fisico. O smoke fisico nao foi
executado neste ambiente porque `adb` nao esta disponivel e nao ha aparelho
Android acessivel pela sessao.

Resultado:

- frente PNG aprovada tecnicamente por revisao de codigo e validacoes
  automatizadas;
- status operacional da frente PNG permanece pendente ate smoke Android fisico
  aprovado;
- nenhum bug pequeno foi encontrado e nenhuma correcao funcional foi aplicada;
- `Mapa.list`, `src/api/mock.ts`, `@tche:mock-mvp:v1` e os assets da Sela de
  Prata I permanecem sem alteracao;
- backend, JWT, RBAC real, sincronizacao, upload remoto,
  download/compartilhamento, zoom avancado e APK final seguem fora do escopo;
- a 16F GeoJSON continua dependendo do proprio smoke Android fisico e nao deve
  ser considerada fechada por causa da revisao da 16G.

Validacoes executadas:

- `npm run typecheck` passou;
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json` passou;
- `node tests/pngMapPropertyManageWorkflow.test.js` passou;
- `node tests/pngMapToMapaCompat.test.js` passou;
- `node tests/pngMapPropertyImportWorkflow.test.js` passou;
- `node tests/pngStorageService.test.js` passou;
- `node tests/pngFilePickerService.test.js` passou;
- `node tests/pngMapImportService.test.js` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou com acesso externo aprovado apos falha de
  rede/sandbox na primeira tentativa;
- `git diff --check` passou; no Windows, pode emitir apenas avisos normais de
  LF/CRLF.

## Fase 16H.1 - Smoke Android Fisico Integrado

Status em 2026-06-10: foi tentada a rodada 16H.1 para smoke Android fisico
integrado de GeoJSON local, PNG local e regressao minima do APK demonstravel.
O smoke operacional nao foi executado porque nenhum aparelho Android fisico
apareceu conectado/autorizado no `adb`.

Ambiente verificado:

- `adb devices` falhou porque `adb` nao esta no `PATH`;
- o binario local
  `C:\Users\e_vsjesus\AppData\Local\Android\Sdk\platform-tools\adb.exe`
  funcionou por caminho absoluto;
- `adb devices -l` pelo binario direto listou apenas `emulator-5554`,
  `product:sdk_gtablet_x86_64`, `model:Pixel_Tablet`;
- nenhum Android fisico foi detectado;
- packageId confirmado em `app.json` e `android/app/build.gradle`:
  `com.tcheagro.mobile`;
- APKs release existentes foram encontrados em `dist/` e
  `android/app/build/outputs/apk/release/`, mas nenhum foi instalado/aberto em
  aparelho fisico nesta rodada.

Resultado:

- smoke base do app bloqueado;
- smoke GeoJSON local bloqueado;
- smoke PNG local bloqueado;
- validacao por Admin, Colaborador e Produtor bloqueada;
- persistencia local por reabertura/force-stop bloqueada;
- nenhum bug pequeno foi comprovado em aparelho;
- nenhuma correcao funcional foi aplicada;
- 16F permanece tecnicamente pronta, mas operacionalmente aberta;
- 16G permanece tecnicamente revisada, mas operacionalmente aberta.

Documento principal da rodada:

- `docs/project/fase-16h-smoke-android-integrado.md`

## Fase 16H.2 - Smoke Tecnico Em Emulador E APK Atual

Status em 2026-06-10: com o emulador Android ativo, foi executado um smoke
tecnico preparatorio do APK atual, ainda em Expo SDK 48. Esta rodada nao fecha
operacionalmente 16F nem 16G, porque o criterio ativo continua exigindo smoke
em Android fisico.

Resultado:

- emulador detectado: `emulator-5554`, `model:Pixel_Tablet`;
- Node local `v22.20.0`, npm `10.9.3`, Expo CLI `0.7.3`;
- SDK atual do projeto confirmado como Expo SDK 48;
- `npx expo install --check` passou com rede liberada para o SDK 48 atual;
- `npm run typecheck`, `.\node_modules\.bin\tsc -p
  tsconfig.domain-compat.json` e `npm run test:domain-compat` passaram;
- `.\gradlew.bat assembleRelease` passou com `BUILD SUCCESSFUL`;
- APK de teste copiado para
  `dist/tche-agro-mobile-2026-06-10-emulator-release.apk`;
- o APK foi instalado no emulador por `adb install -r`;
- o app abriu sem tela vermelha/crash visivel;
- apos `force-stop` e reabertura, a sessao local de Admin foi restaurada e o
  Dashboard abriu novamente;
- nenhum fluxo de DocumentPicker, GeoJSON local ou PNG local foi exercitado
  nesta rodada;
- nenhuma correcao funcional foi aplicada.

Diagnostico de SDK:

- a documentacao oficial do Expo lista SDK 56 como referencia atual;
- SDK 56 exige salto de React Native/React e atualizacao dos projetos nativos;
- a migracao de SDK 48 para SDK 56 deve ser tratada como frente propria,
  preferencialmente incremental, para nao misturar risco de plataforma com o
  fechamento operacional das fases 16F/16G.

Documento principal da rodada:

- `docs/project/fase-16h-smoke-android-integrado.md`

## Fase 16H.3 - Migracao Expo SDK 56 E APK De Teste

Status em 2026-06-10: foi executada a migracao tecnica do app de Expo SDK 48
para Expo SDK 56, motivada pela incompatibilidade pratica do Expo Go atual em
celular com a base antiga. Esta frente atualiza a base Android e gera um APK
novo, mas nao fecha operacionalmente 16F nem 16G porque ainda falta o smoke
fisico com DocumentPicker, GeoJSON local e PNG local.

Estado tecnico apos a migracao:

- `app.json` usa `sdkVersion: "56.0.0"`;
- dependencias principais alinhadas: `expo@56.0.9`,
  `react-native@0.85.3`, `react@19.2.3`, `typescript@6.0.3` e
  `babel-preset-expo@56.0.14`;
- `npx expo install --fix`/`npx expo install --check` alinharam a matriz de
  pacotes do SDK 56;
- `npx expo prebuild --platform android --clean --no-install` regenerou o
  Android nativo local;
- o build Android usa compile/target SDK 36, build tools 36.0.0, Gradle 9.3.1,
  Kotlin 2.1.20 e minSdk 24;
- `expo-file-system/legacy` foi usado nos servicos locais de storage/cache para
  preservar a API antiga sem reescrever GeoJSON/PNG nesta rodada.

Validacoes e APK:

- `npm run typecheck` passou;
- `npm run test:domain-compat` passou;
- `npx expo install --check` passou;
- `.\gradlew.bat assembleRelease --console=plain` passou com
  `BUILD SUCCESSFUL`;
- APK gerado em `android/app/build/outputs/apk/release/app-release.apk`;
- copia preservada em
  `dist/tche-agro-mobile-2026-06-10-sdk56-release.apk` com `91669372` bytes;
- `adb install -r dist\tche-agro-mobile-2026-06-10-sdk56-release.apk` passou no
  AVD `tche_test`;
- abertura do app no emulador passou sem tela vermelha/crash visivel;
- login manual `admin.demonstracao@example.com` / `admin123` passou;
- Dashboard Admin abriu no APK SDK 56.

Limites mantidos:

- teste em Expo Go no celular fisico ainda pendente;
- Android fisico ainda precisa aparecer em `adb devices` como `device`;
- DocumentPicker de GeoJSON/PNG nao foi exercitado nesta rodada;
- 16F GeoJSON e 16G PNG continuam tecnicamente prontas/revisadas, mas
  operacionalmente abertas ate o smoke fisico aprovado;
- `npm install` ainda reporta 10 vulnerabilidades moderadas no audit do npm,
  sem `npm audit fix` aplicado.

Documento principal da rodada:

- `docs/project/fase-16h-smoke-android-integrado.md`

## Fase 16H.4 - Smoke Operacional Em Emulador SDK 56

Status em 2026-06-11: por decisao operacional da rodada, o APK SDK 56 foi
instalado e testado no emulador Android conectado ao PC. Esta validacao serve
como smoke operacional em Android/emulador dos fluxos principais do app, mas
nao substitui a validacao final em Android fisico.

Ambiente:

- dispositivo: `emulator-5554`;
- modelo: `Pixel_Tablet`;
- packageId: `com.tcheagro.mobile`;
- APK usado: `dist/tche-agro-mobile-2026-06-10-sdk56-release.apk`;
- instalacao via `adb install -r` passou com `Success`;
- abertura via `adb shell monkey -p com.tcheagro.mobile -c
  android.intent.category.LAUNCHER 1` passou.

Resultado:

- app abriu sem tela vermelha/crash visivel;
- login manual de Admin, Colaborador e Produtor passou;
- Dashboard Admin abriu com navegacao esperada;
- Colaborador abriu sem aba administrativa de `Usuarios`;
- Produtor abriu `Minhas Propriedades` com a Sela de Prata I;
- detalhe da Sela exibiu Titular `Produtor Demonstracao`, `6200 ha`, cultura
  `Soja`, `2` visitas, `5` mapas, `1` caderno e `15` limites;
- aba `Lavoura` exibiu mapas/anexos;
- `Visualizar Mapa` abriu panorama de talhoes com 15 talhoes e `1888.6 ha`;
- selecao do talhao `T01 - 230` exibiu detalhe coerente;
- abas `Visitas` e `Caderno` abriram com dados demonstrativos esperados;
- `force-stop` e reabertura restauraram sessao local sem crash.

Limites:

- nenhum Android fisico foi usado;
- DocumentPicker real de GeoJSON/PNG ainda nao foi exercitado nesta rodada;
- nenhum arquivo local foi anexado/substituido/removido.

Documento principal da rodada:

- `docs/project/fase-16h-smoke-android-integrado.md`

## Fase 16H.5 - Smoke DocumentPicker Em Emulador SDK 56

Status em 2026-06-11: foi executado smoke complementar no mesmo emulador SDK
56 para exercitar DocumentPicker real de GeoJSON e PNG em contexto da
Propriedade Sela de Prata I. A rodada aprovou PNG local em emulador e revelou
falha funcional no anexo local de GeoJSON.

Ambiente e arquivos:

- dispositivo: `emulator-5554`;
- modelo: `Pixel_Tablet`;
- APK usado: `dist/tche-agro-mobile-2026-06-10-sdk56-release.apk`;
- perfil usado: Admin Demonstracao;
- Propriedade usada: `Fazenda Sela de Prata I`;
- arquivos testados:
  - `/sdcard/Download/limites_talhoes.geojson`;
  - `/sdcard/Download/limites_talhoes.json`;
  - `/sdcard/Download/smoke_ph_10a20.png`.

Resultado GeoJSON:

- `Anexar GeoJSON dos talhoes` abriu o DocumentPicker Android;
- arquivos `.geojson` e `.json` apareceram e puderam ser selecionados;
- apos selecionar `limites_talhoes.geojson` e `limites_talhoes.json`, o app
  voltou para Mapas/Arquivos tecnicos;
- a tela continuou exibindo `Nenhum GeoJSON local anexado a esta Propriedade`
  e `Anexar GeoJSON dos talhoes`;
- portanto, GeoJSON local permanece bloqueado operacionalmente em emulador por
  falha de atualizacao/persistencia visual apos selecao.

Resultado PNG:

- `Anexar mapa PNG` abriu o DocumentPicker Android;
- `smoke_ph_10a20.png` foi selecionado em Downloads;
- o modal `Anexar mapa PNG` exibiu arquivo selecionado, titulo automatico
  `smoke ph 10a20`, categoria `Outro` e ano `2026`;
- `Anexar PNG` salvou o PNG local;
- a tela passou a exibir `smoke ph 10a20`, arquivo `smoke_ph_10a20.png`,
  status `ativo` e contador `6 Materiais`;
- apos `force-stop` e reabertura, a sessao Admin restaurou e a tela de mapas da
  Sela manteve o contador `6 Materiais`.

Situacao atual:

- 16G/PNG local esta aprovado em emulador para DocumentPicker, metadados,
  salvamento local e reabertura;
- 16F/GeoJSON local continua tecnicamente implementada, mas operacionalmente
  bloqueada ate corrigir o fluxo que deve atualizar/persistir o anexo apos a
  selecao no DocumentPicker;
- Android fisico continua pendente para validacao final de campo.

Documentos principais da rodada:

- `docs/project/fase-16h-smoke-android-integrado.md`
- `docs/project/smoke.md`

## Fase 16H.6 - Correcao GeoJSON Pos-DocumentPicker Em Emulador SDK 56

Status em 2026-06-11: foi corrigido o fluxo local de GeoJSON que falhava apos
a selecao pelo DocumentPicker no APK SDK 56. A causa foi o uso de
`expo-file-system` no servico de leitura do GeoJSON selecionado; o fluxo foi
alinhado para `expo-file-system/legacy`, consistente com os servicos de storage
e cache que ainda dependem da API antiga no SDK 56.

O build `dist/tche-agro-mobile-2026-06-11-geojson-fix-sdk56-release.apk` foi
gerado, instalado no `emulator-5554` (`Pixel_Tablet`) e reexecutou os casos
GeoJSON da 16H.5 na Sela de Prata I:

- `Anexar GeoJSON dos talhoes` abriu o DocumentPicker Android em Downloads;
- `limites_talhoes.geojson` abriu modal de confirmacao com 15 talhoes e 37
  partes/poligonos e passou a aparecer como `GeoJSON anexado`;
- `limites_talhoes.json` substituiu o anexo local com o mesmo resumo de 15
  talhoes e 37 partes/poligonos;
- apos `force-stop`, reabertura do app e retorno a Mapas/Arquivos tecnicos da
  Sela, `limites_talhoes.json` permaneceu anexado e ativo.

Validacoes executadas: `npm run typecheck`,
`.\node_modules\.bin\tsc -p tsconfig.domain-compat.json`, testes unitarios dos
servicos GeoJSON, `npm run test:domain-compat`, `npx expo install --check`,
build release Android e `git diff --check`.

Situacao atual:

- 16F/GeoJSON local esta aprovada em emulador SDK 56 para DocumentPicker,
  leitura, validacao, associacao, substituicao e persistencia local;
- 16G/PNG local permanece aprovada em emulador desde a 16H.5;
- Android fisico continua pendente para validacao final de campo.

Documentos principais da rodada:

- `docs/project/fase-16h-smoke-android-integrado.md`
- `docs/project/smoke.md`

## Fase 17A - Analise De Desenvolvimento Do MVP Pos-SDK 56

Status em 2026-06-12: foi criada
`docs/project/fase-17a-analise-desenvolvimento-mvp.md` como analise tecnica e
funcional do MVP demonstravel em emulador, sem alterar comportamento funcional.

A analise confirma que 16F/GeoJSON local e 16G/PNG local estao aprovadas em
emulador SDK 56, enquanto Android fisico continua pendente para validacao final
de campo. A recomendacao unica de proxima implementacao e a Fase 17B:
simplificar a UX do fluxo do Produtor em emulador, preservando consulta por
Propriedade, `fazenda_id`, mocks, `Mapa.list`, `LimiteArea.list`, assets da
Sela de Prata I e os limites de escopo sem backend/RBAC/sync/upload/download
real.

## Fase 17B - Simplificacao Da UX Do Produtor

Status em 2026-07-01: foi criada
`docs/project/fase-17b-ux-produtor.md` e aplicada a simplificacao visual/textual
do fluxo do Produtor em emulador.

A fase reforca o Produtor como perfil de acompanhamento e consulta da propria
Propriedade. O detalhe da Propriedade passou a destacar modo acompanhamento,
atalhos para Panorama/Talhoes, Materiais tecnicos, Historico de visitas e
Caderno de campo, alem de estados vazios orientados a registros ou materiais
liberados para consulta.

Tambem foram ajustados textos de `PropriedadesScreen`, `MapasScreen`,
`FazendaMapaScreen`, `VisitasScreen` e `CadernoCampoScreen` para reduzir
linguagem de manutencao para Produtor, sem alterar mocks, `Mapa.list`,
`LimiteArea.list`, assets da Sela de Prata I, stores locais, compatibilidade
`fazenda_id`/`fazendaId` ou regra efetiva de acesso.

Validacoes executadas: `npm run typecheck`,
`.\node_modules\.bin\tsc -p tsconfig.domain-compat.json`,
`npm run test:domain-compat` e `git diff --check` passaram. `npx expo install
--check` foi executado e falhou por divergencia de dependencia (`expo@56.0.11`,
esperado `~56.0.13`); dependencias nao foram atualizadas porque a fase proibe
upgrade.

Smoke visual 17B em emulador foi executado parcialmente no `emulator-5554` com
build debug instalada por `npm run android`. Passaram login do Produtor via
acesso rapido, abertura de `Minhas Propriedades`, detalhe da Sela de Prata I,
materiais tecnicos, historico de visitas e caderno sem acao de criacao para
Produtor. Permanecem como `Reexecutar` a selecao detalhada de talhao, abertura
do anexo PNG de fertilidade, rotas diretas de bloqueio e regressoes de
Colaborador/Admin. Android fisico continua pendente para validacao final de
campo.

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
- `src/services/MapaCacheService.ts`, `GeoJsonStorageService` e
  `PngStorageService` usam `expo-file-system/legacy`; a dependencia agora esta
  declarada em `package.json` e alinhada ao Expo SDK 56

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

## Fase 17C - Material Tecnico: PNG E ZIP De Prescricao

Status em 2026-07-03: a frente de `Material tecnico` em `MapasScreen` foi
organizada para o corte operacional atual e aprovada em smoke visual no
emulador Android: mapas de fertilidade, mapas de correcao de solo e
prescricoes.

Entregas implementadas:

- `MapasScreen.tsx` usa o titulo visual `Material tecnico` e filtros
  principais restritos a `Fertilidade`, `Correcao de solo` e `Prescricao`;
- o fluxo PNG local continua abrindo imagem/anexo, mas agora aceita apenas
  opcoes de fertilidade e correcao de solo, sem prescricao no formulario PNG;
- foi criado fluxo local demonstrativo de prescricao ZIP com seletor,
  validacao leve, copia para storage interno seguro e metadados em
  `@tche:prescription-zip-imports:v1`;
- Prescricao ZIP aparece na listagem principal como material de prescricao,
  com tipo/camada, safra/ano, escopo, nome original e tamanho quando
  disponivel;
- o modal de prescricao mostra apenas detalhes do pacote tecnico e a mensagem:
  `Pacote técnico anexado localmente. A abertura ou processamento do ZIP não faz parte do MVP atual.`;
- Admin e Colaborador autorizado podem anexar, substituir e remover ZIP local;
  Produtor consulta somente itens visiveis, sem acoes administrativas;
- `Mapa.list`, `src/api/mock.ts`, `LimiteArea.list`, assets existentes e
  `fazenda_id` foram preservados.

Smoke visual 17C.1 executado em 2026-07-03 no emulador `emulator-5554`
(`Pixel Tablet`, API 35), com APK release
`android/app/build/outputs/apk/release/app-release.apk` gerado por
`.\gradlew.bat :app:assembleRelease` e instalado por `adb install -r`.

Resultado da rodada:

- filtros principais com Fertilidade, Correcao de solo e Prescricao;
- PNG local aceitando somente Fertilidade/Correcao de solo;
- ZIP de prescricao anexado, detalhado, substituido e removido sem preview de
  imagem, unzip, backend, upload, sync ou download real;
- PDF invalido no fluxo ZIP nao criou metadado invalido;
- Produtor consultou PNG e ZIP sem ver anexar, substituir ou remover;
- descricao do bloco `PNG local de mapa` corrigida para nao citar Prescricao.

Fora do escopo mantido:

- backend, API, banco real, upload remoto, sync e download real;
- unzip, leitura/processamento do conteudo do ZIP ou conversao automatica;
- sobreposicao de PNG ou ZIP no mapa interativo;
- alteracao dos PNGs demonstrativos da Sela de Prata I.

Validacoes automatizadas executadas nesta frente:

- `npm run typecheck`;
- `tsc -p tsconfig.domain-compat.json`;
- `npm run test:domain-compat`;
- testes focados de PNG/ZIP em `tests/pngMapPropertyImportWorkflow.test.js`,
  `tests/prescriptionZipImportService.test.js`,
  `tests/prescriptionZipFilePickerService.test.js`,
  `tests/prescriptionZipStorageService.test.js`,
  `tests/prescriptionZipPropertyImportWorkflow.test.js` e
  `tests/prescriptionZipToMapaCompat.test.js`;
- `.\gradlew.bat :app:assembleRelease`;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- `git diff --check` passou com avisos normais de LF/CRLF no Windows;
- `npx expo install --check` confirmou divergencia ja conhecida:
  `expo@56.0.11`, esperado `~56.0.14`; a divergencia foi aceita
  temporariamente para nao misturar upgrade de SDK com a correcao/smoke 17C.1.

Documento de fechamento: `docs/project/fase-17c-material-tecnico-mapas-prescricao.md`.

## Fase 17D - Caderno De Campo Enxuto Por Propriedade

Status em 2026-07-03: a frente de `Caderno de Campo` foi ajustada para o
corte operacional do MVP demonstravel, mantendo fluxo local/mockado,
compatibilidade de `fazenda_id`/`fazendaId` e sem abrir backend, sync, upload,
download ou storage remoto.

Entregas implementadas:

- Produtor consulta apenas registros liberados para ele e nao ve acoes de
  criar, editar ou remover Caderno;
- Admin e Colaborador continuam criando e editando registros conforme a regra
  local existente e o escopo da Propriedade;
- listagem, detalhe e formulários exibem campos minimos claros: Propriedade,
  Talhao, data do registro, tipo, responsavel, visibilidade e observacao;
- registros antigos sem Talhao exibem `Sem talhão vinculado`;
- registros legados sem campo explicito de visibilidade continuam tratados como
  liberados ao Produtor por compatibilidade;
- a lista do Caderno e o bloco de Caderno no detalhe da Propriedade passaram a
  ordenar registros por data mais recente primeiro;
- os tipos de Caderno usados no formulario foram alinhados ao corte enxuto da
  Fase 17D, preservando valores legados como `vistoria`, `adubacao`,
  `aplicacao` e `analise_solo`.

Preservado nesta fase:

- `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, assets e seeds da Sela de
  Prata I;
- chaves locais existentes, incluindo `@tche:mock-mvp:v1`,
  `@tche:geojson-imports:v1`, `@tche:png-map-imports:v1` e
  `@tche:prescription-zip-imports:v1`;
- Material tecnico com Fertilidade/Correcao de solo em PNG e Prescricao em ZIP;
- ausência de backend, JWT, RBAC real, sync, upload remoto, download real,
  unzip ou processamento de ZIP.

Validacoes executadas nesta frente:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `git diff --check` passou com avisos normais de LF/CRLF no Windows;
- `.\gradlew.bat :app:assembleRelease`;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- smoke visual parcial em emulador `emulator-5554` (`Pixel Tablet`), usando
  `adb` pelo caminho direto do Android SDK.

Resultado do smoke visual parcial em emulador:

- no perfil Produtor, a lista do Caderno exibiu apenas registro liberado para
  consulta;
- o card exibiu Propriedade, Talhao, tipo, data, responsavel, visibilidade e
  observacao;
- o botao de novo registro nao apareceu para Produtor;
- o detalhe abriu em modo de consulta, com Propriedade, tipo, data,
  responsavel, Talhao e visibilidade, sem acao de edicao visivel.

Limitacoes de validacao: ainda e recomendado ampliar o smoke manual em
emulador para Admin/Colaborador criando e editando registros. Android fisico
continua pendente e nao aprovado.

## Fase 17D.2 - Correcao De Regra Do Caderno Para Produtor

Status em 2026-07-06: a Fase 17D.2 corrigiu a regra funcional do Caderno de
Campo para permitir que o Produtor registre informacoes de campo na propria
Propriedade, mantendo o corte enxuto, local/mockado e por contexto de
`fazenda_id`/`fazendaId`.

Entregas implementadas:

- Produtor pode criar registro de Caderno apenas em Propriedades do proprio
  vinculo efetivo;
- no contexto de uma Propriedade, o formulario de novo Caderno preserva a
  Propriedade da rota e impede troca quando o contexto vem travado;
- registros criados pelo Produtor ficam sempre visiveis para o proprio
  Produtor e para Admin/Colaborador autorizado;
- a tela de novo registro reaproveita o formulario existente, sem criar fluxo
  paralelo para Produtor;
- a visibilidade administrativa continua disponivel para Admin/Colaborador,
  preservando registros internos ocultaveis ao Produtor;
- o detalhe do Caderno exibe selo discreto para registro criado pelo Produtor;
- tipos de registro do Caderno incluem o corte pratico para Produtor:
  Observacao, Plantio, Aplicacao, Colheita, Ocorrencia e Outro, preservando os
  tipos tecnicos e legados ja aceitos.

Limites mantidos nesta fase:

- Produtor nao edita nem remove registros do Caderno nesta etapa; a autoria
  local existe como metadado preparatorio, mas a regra completa de edicao de
  registro proprio permanece para definicao futura;
- Produtor continua sem criar, editar ou remover Visitas Tecnicas;
- Produtor continua sem acoes administrativas em Material tecnico, PNG,
  GeoJSON ou ZIP;
- nao houve backend, JWT, RBAC real, sync, upload remoto, download real,
  storage remoto, unzip ou processamento de ZIP;
- `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, assets/seeds da Sela de
  Prata I e chaves locais versionadas foram preservados.

Validacoes executadas nesta frente:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests/cadernoFormCompat.test.js`;
- `git diff --check` passou com avisos normais de LF/CRLF no Windows;
- `.\gradlew.bat :app:assembleRelease`;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- smoke visual em emulador `emulator-5554` (`Pixel Tablet`) para Produtor
  criando Caderno na propria Propriedade.

Resultado do smoke visual em emulador:

- Produtor acessou a Propriedade `Fazenda Sela de Prata I`;
- aba Caderno exibiu acao `Registrar`;
- formulario abriu como `Registrar no Caderno`, com Propriedade travada pela
  rota e tipos praticos para campo;
- registro `Observacao` foi salvo em 06/07/2026 para `Produtor Demonstracao`;
- detalhe exibiu `Liberado ao produtor` e `Registrado pelo produtor`, sem
  acao de edicao visivel para Produtor;
- ao retornar para a Propriedade, a aba Caderno exibiu contador `2` e listou o
  novo registro antes do registro demonstrativo anterior.

## Fase 17D.3 - Smoke Completo E Fechamento Do Caderno De Campo

Status em 2026-07-06: o Caderno de Campo enxuto foi validado em smoke completo
no emulador Android para Produtor, Admin e Colaborador, mantendo a regra
local/mockada, o contexto por Propriedade e a compatibilidade de
`fazenda_id`/`fazendaId`.

Resultado por perfil no emulador:

- Produtor criou registro `Observacao` na propria Propriedade
  `Fazenda Sela de Prata I`, com Propriedade travada pela rota, status
  `Liberado ao produtor`, selo `Registrado pelo produtor` e sem acao de
  edicao/remocao visivel;
- Admin visualizou o registro criado pelo Produtor, criou um registro interno
  na mesma Propriedade e confirmou que o detalhe permite edicao para perfil
  autorizado;
- Produtor reabriu a Propriedade depois do registro interno do Admin e continuou
  vendo somente os registros liberados para ele, sem exposicao do registro
  `Interno`;
- Colaborador visualizou registros liberados e internos dentro do escopo
  regional, criou novo registro na `Fazenda Sela de Prata I` e confirmou
  Propriedade, responsavel, Talhao, visibilidade e acao `Editar` no detalhe;
- a listagem do Colaborador mostrou o novo registro no topo, seguido do
  registro interno do Admin e do registro liberado do Produtor.

Regressao de Material tecnico:

- no fluxo do Produtor, a Propriedade manteve acesso ao atalho `Material
  tecnico`;
- a tela `Material tecnico` abriu no contexto da `Fazenda Sela de Prata I`,
  preservando consulta da Propriedade e filtros do corte Fertilidade, Correcao
  de solo e Prescricao;
- as validacoes automatizadas de compatibilidade de GeoJSON, PNG local e ZIP de
  prescricao continuaram passando em `npm run test:domain-compat`;
- o estado local do emulador possuia importacoes anteriores, por isso a tela de
  materiais pode somar itens locais aos cinco materiais base da Propriedade.

Validacoes executadas:

- `npm run typecheck`;
- `node tests/cadernoFormCompat.test.js`;
- `node tests/acessoControleCompat.test.js`;
- `node tests/validatorsCompat.test.js`;
- `npm run test:domain-compat`;
- `.\gradlew.bat :app:assembleRelease` em `android`;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- `adb shell monkey -p com.tcheagro.mobile -c android.intent.category.LAUNCHER 1`;
- smoke manual por `adb` no emulador `emulator-5554` (`Pixel Tablet`).

Observacoes da rodada:

- o primeiro build release dentro do sandbox falhou por permissao de acesso ao
  lock do cache global do Gradle; a repeticao com permissao aprovada concluiu
  com sucesso;
- o build exibiu o aviso conhecido de `NODE_ENV` ausente, sem bloquear a APK;
- nao foram aplicadas correcoes de codigo na Fase 17D.3, apenas fechamento
  documental do smoke completo;
- nao houve upgrade amplo de SDK/dependencias, `npm audit fix`, backend, JWT,
  RBAC real, sync, upload/download remoto, storage remoto, unzip ou
  processamento produtivo.

Limitacao remanescente: Android fisico continua pendente e nao aprovado para
campo.

## Fase 17D.4 - Validacao Android Fisico Do Caderno E Material Tecnico

Status em 2026-07-07: a validacao em Android fisico foi iniciada, mas ficou
bloqueada porque nenhum aparelho fisico apareceu autorizado no `adb`.

Resultado da conferencia de dispositivo:

- comando executado: `adb devices -l`;
- resultado encontrado: apenas `emulator-5554`, modelo `Pixel_Tablet`, status
  `device`;
- nenhum Android fisico apareceu com status `device`;
- modelo e versao de Android fisico nao foram obtidos;
- instalacao em Android fisico nao foi executada;
- smoke manual fisico de Caderno, Material tecnico, DocumentPicker,
  persistencia local e usabilidade nao foi executado.

Validacoes tecnicas executadas apesar do bloqueio fisico:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests/cadernoFormCompat.test.js`;
- `node tests/acessoControleCompat.test.js`;
- `node tests/validatorsCompat.test.js`;
- `.\gradlew.bat :app:assembleRelease` em `android`;
- `git diff --check`.

Resultado tecnico:

- as validacoes automatizadas passaram;
- o primeiro build release dentro do sandbox falhou por permissao de acesso ao
  lock do cache global do Gradle;
- a repeticao com permissao aprovada gerou o APK release com sucesso em
  `android/app/build/outputs/apk/release/app-release.apk`;
- o APK gerado em 2026-07-07 tinha 91.713.808 bytes;
- o build manteve avisos conhecidos de `NODE_ENV` ausente e depreciações
  Gradle, sem bloquear a geracao do APK;
- nao houve instalacao no Android fisico;
- nao houve correcao de codigo nesta fase.

Status final da Fase 17D.4 nesta rodada: Android fisico segue pendente e nao
aprovado. Para aprovar campo, ainda e necessario conectar um aparelho fisico
autorizado no `adb`, instalar o APK e executar o roteiro manual completo no
dispositivo.

## Fase 17E - Safra/Safrinha Local E Opcional

Status em 2026-07-08: foi implementada a organizacao local e opcional de
Safra/Safrinha por Propriedade, sem alterar o mock central, `Mapa.list`,
`LimiteArea.list`, assets/seeds da Sela de Prata I ou os fluxos de Material
tecnico.

Entregas implementadas:

- novo servico local `PeriodoProdutivoService` com metadados pequenos em
  `@tche:periodos-produtivos:v1`;
- preservacao de `propriedade_id`/`propriedadeId` e
  `fazenda_id`/`fazendaId` nos registros locais de periodo;
- bloqueio defensivo contra salvamento de GeoJSON bruto, features,
  coordinates, PNG, ZIP, base64, bytes, binario, arquivos ou conteudo bruto no
  storage de periodos;
- secao `Safras e Safrinha` no detalhe da Propriedade, dentro da aba de
  lavoura/materiais, com consulta para Produtor e criacao/edicao para
  Admin/Colaborador autorizado;
- formularios locais de criacao/edicao de periodo com Propriedade travada,
  tipo Safra/Safrinha, cultura, ano agricola, datas opcionais, status,
  observacao e Talhao opcional;
- vinculo opcional de Safra/Safrinha em novo/editar Caderno de Campo;
- exibicao do vinculo opcional em listagem, detalhe e cards de Caderno quando
  existir.

Preservado nesta fase:

- `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, assets e seeds da Sela de
  Prata I;
- chaves locais existentes: `@tche:mock-mvp:v1`,
  `@tche:geojson-imports:v1`, `@tche:png-map-imports:v1` e
  `@tche:prescription-zip-imports:v1`;
- Material tecnico com Fertilidade/Correcao de solo em PNG e Prescricao em ZIP;
- ausencia de backend, JWT, RBAC real, sync, upload remoto, download real,
  storage remoto, unzip, processamento de ZIP ou pipeline produtivo.

Smoke 17E.1 executado em 2026-07-08 no emulador `emulator-5554`
(`Pixel_Tablet`), com APK release gerado em
`android/app/build/outputs/apk/release/app-release.apk` e instalado por
`adb install -r`.

Resultado da rodada:

- Colaborador autorizado criou uma Safra `Soja` `2025/2026` na Propriedade
  `Fazenda Sela de Prata I`, confirmou validacao de campos obrigatorios e
  editou/salvou o periodo sem criar duplicidade;
- o contador de `Safras` da Propriedade passou para `1`, persistiu apos
  `force-stop` e reabertura do app, e o card continuou visivel em
  `Talhoes > Safras e Safrinha`;
- Produtor Demonstração abriu a mesma Propriedade, consultou a Safra local e
  nao viu acao de criar ou editar periodo;
- Colaborador criou registro de Caderno com vinculo opcional ao periodo,
  conferiu o vinculo no detalhe e depois removeu o vinculo em edicao,
  preservando a Propriedade do registro;
- a tela de `Material tecnico` abriu no contexto da Sela de Prata I, manteve
  materiais base de fertilidade/PNG e renderizou GeoJSON/talhoes; a reabertura
  individual de PNG e ZIP deve ser repetida no roteiro fisico;
- auditoria textual de storage manteve a regra de metadados pequenos e nao
  identificou salvamento de conteudo bruto no storage de periodos.

Validacoes executadas na rodada 17E.1:

- `adb devices -l`;
- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests/periodoProdutivoService.test.js`;
- `node tests/cadernoFormCompat.test.js`;
- `node tests/acessoControleCompat.test.js`;
- `node tests/validatorsCompat.test.js`;
- `.\gradlew.bat :app:assembleRelease` em `android`;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- `adb shell monkey -p com.tcheagro.mobile -c android.intent.category.LAUNCHER 1`;
- `rg -n "@tche:periodos-produtivos|periodos-produtivos|base64|GeoJSON|coordinates|features|png|zip|bytes|blob|AsyncStorage" src tests -S`.

Limitacoes remanescentes:

- Safra/Safrinha e apenas organizacao local demonstrativa e opcional;
- nao ha sincronizacao, publicacao, auditoria completa, backend ou modelo
  produtivo definitivo para periodos;
- o smoke manual de Admin gerenciando periodo, Produtor criando Caderno com
  vinculo de Safra/Safrinha e reabertura individual de PNG/ZIP deve ser
  repetido em rodada de campo;
- Android fisico segue pendente e nao aprovado.

## Fase 17F - Talhao Como Centro De Consulta Da Propriedade

Status em 2026-07-08: foi implementado um centro de consulta enxuto por
Talhao dentro do fluxo atual de `Material tecnico`/panorama da Propriedade,
sem criar nova modelagem pesada e sem alterar a origem dos limites/talhoes.

Entregas implementadas:

- a aba `Talhoes` do detalhe da Propriedade passou a indicar uma entrada clara
  para abrir os detalhes dos Talhoes no panorama;
- o modal de detalhe do Talhao foi enriquecido com resumo, Propriedade,
  area/ano, origem da demarcacao segura (`Seed/mock` ou `GeoJSON local
  ativo`), Safra/Safrinha, Caderno de Campo, Material tecnico e acoes
  contextuais;
- Safra/Safrinha mostra periodos especificos do Talhao e, quando nao houver,
  periodos gerais da Propriedade com o label `Periodos da Propriedade`;
- Caderno de Campo mostra somente registros vinculados ao Talhao; registros
  antigos ou gerais sem Talhao nao aparecem como se fossem do Talhao;
- Material tecnico separa materiais do Talhao e materiais da Propriedade
  inteira, sem alterar PNG, ZIP, GeoJSON ou taxonomia principal;
- `NovoCadernoScreen` aceita contexto de Talhao por rota, mantendo
  Propriedade travada e preservando aliases `talhao_id`, `talhaoId`,
  `talhao_nome` e `talhao`;
- `PeriodoProdutivoFormScreen` aceita Talhao pre-selecionado por rota para
  Admin/Colaborador autorizado, reaproveitando o fluxo local da Fase 17E;
- foi criado `talhaoConsultaCompat.ts` para filtros de Talhao em periodos,
  Caderno e materiais sem persistir coordenadas.

Preservado nesta fase:

- `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, assets e seeds da Sela de
  Prata I;
- chaves locais `@tche:mock-mvp:v1`, `@tche:geojson-imports:v1`,
  `@tche:png-map-imports:v1`, `@tche:prescription-zip-imports:v1` e
  `@tche:periodos-produtivos:v1`;
- Material tecnico restrito a Fertilidade, Correcao de solo e Prescricao;
- ausencia de salvamento de coordenadas, GeoJSON bruto, PNG, ZIP, base64,
  bytes, binario ou arquivo bruto em AsyncStorage;
- ausencia de localizacao em tempo real, marcacao geografica, edicao de
  limites, georreferenciamento de PNG, unzip/processamento de ZIP, backend,
  RBAC real, sync, upload/download remoto ou storage remoto.

Validacoes automaticas executadas nesta frente:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `node tests/talhaoConsultaCompat.test.js`;
- `node tests/cadernoFormCompat.test.js`.

Limitacoes remanescentes:

- smoke visual 17F em emulador ainda deve ser executado para Produtor,
  Colaborador e Admin;
- regressao individual de PNG, ZIP de Prescricao e GeoJSON/talhoes ainda deve
  ser repetida na rodada visual;
- Android fisico segue pendente e nao aprovado.

## Fase 17F.1 - Smoke Visual Do Talhao Como Centro De Consulta

Status em 2026-07-09: smoke visual executado parcialmente no emulador
`emulator-5554` (`Pixel_Tablet`) sobre o APK release ja instalado. A
reinstalacao do APK release atual nao foi concluida porque o emulador estava
com `/data` quase cheio e `adb install -r` retornou
`INSTALL_FAILED_INSUFFICIENT_STORAGE`; o app existente abriu normalmente.

Validado visualmente como Produtor:

- entrada pela Propriedade `Fazenda Sela de Prata I` e aba `Talhoes`;
- panorama `Material tecnico` com filtros de Talhao/Safra, indicador de
  demarcacao e estatisticas de 15 Talhoes/1888.6 ha/7 materiais;
- mapa local dos Talhoes renderizado no proprio panorama;
- modal do Talhao `T01 - 230` com Propriedade, area, ano e origem
  `GeoJSON local ativo`;
- Produtor com `Registrar no Caderno`, `Ver materiais do Talhao` e `Ver no
  mapa`, sem acao `Nova Safra/Safrinha`;
- bloco `Safra/Safrinha` em modo de consulta, exibindo periodo da
  Propriedade;
- abertura de `Registrar no Caderno` a partir do Talhao com Propriedade
  travada em Sela de Prata I e campo `Talhao` preenchido com `T01 - 230`.

Ajuste pequeno aplicado durante o smoke:

- correcao de pluralizacao visual de Talhoes/disponiveis na aba do Produtor e
  no resumo do mapa legado.

Continuam pendentes:

- submissao visual completa do Caderno pelo Talhao e retorno para conferir o
  registro no detalhe/lista;
- repeticao visual com Colaborador e Admin para Caderno e Safra/Safrinha pelo
  Talhao;
- reabertura individual de PNG e ZIP de Prescricao nesta rodada;
- instalacao/repeticao no Android fisico. Android fisico segue pendente e nao
  aprovado.

## Fase 17F.2 - Fechamento Do Smoke Do Talhao Em Emulador

Status em 2026-07-09: o ambiente do emulador `emulator-5554`
(`Pixel_Tablet`) foi corrigido para permitir a instalacao do APK release atual.
A causa operacional era falta de espaco em `/data`. A correcao foi limitada ao
ambiente de teste: limpeza/desinstalacao do pacote do app e remocao do Expo Go
no emulador, sem wipe do AVD e sem upgrade de SDK/dependencias. Como efeito
colateral, o estado local do app foi reiniciado; por isso importacoes locais
anteriores de GeoJSON, PNG e ZIP nao estavam presentes nesta rodada.

Validado em emulador depois da reinstalacao do APK release:

- Produtor abriu `Fazenda Sela de Prata I`, aba `Talhoes`, Material tecnico e
  modal do Talhao `T01 - 230`;
- Produtor nao viu acao administrativa `Nova Safra/Safrinha`;
- `Registrar no Caderno` pelo Talhao abriu `NovoCadernoScreen` com
  Propriedade travada, Talhao `T01 - 230` e Safra/Safrinha opcional;
- registro de Caderno salvo pelo Produtor abriu detalhe com Propriedade,
  Talhao, autoria `Registrado pelo produtor` e sem acoes de editar/remover;
- Colaborador abriu Dashboard, lista de Propriedades, Sela de Prata I no
  escopo, detalhe da Propriedade, aba `Talhoes` e Material tecnico;
- Colaborador viu `15 talhoes disponiveis para consulta no panorama da
  Propriedade`, acao autorizada de Safra/Safrinha e filtros de Material
  tecnico por Demarcacao, Talhao e Safra;
- Material tecnico exibiu estado vazio de GeoJSON local apos a limpeza do
  ambiente, sem reimportar arquivos nesta fase;
- pluralizacao visual de microrregioes no Dashboard do Colaborador foi
  corrigida.

Validacoes tecnicas executadas:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `.\gradlew.bat :app:assembleRelease`;
- instalacao do APK release por `adb install -r`;
- dumps de UI por `uiautomator` no emulador.

Continuam pendentes:

- reabrir individualmente PNG local e ZIP de Prescricao apos recriar/importar
  esses arquivos no estado local do emulador;
- repetir a criacao de Caderno pelo Talhao como Colaborador e a validacao
  manual de Admin;
- executar a validacao em Android fisico autorizado. Android fisico segue
  pendente e nao aprovado;
- manter a divergencia conhecida `expo@56.0.11`, esperado `~56.0.14`, para
  fase propria de alinhamento, sem misturar com este fechamento funcional.

## Fase 17G.0 - Analise Tecnica De Localizacao Em Tempo Real Sobre Talhoes

Status em 2026-07-09: foi criada a analise tecnica
`docs/project/fase-17g-localizacao-tempo-real.md` para orientar uma fase futura
de localizacao em tempo real sobre o mapa de Talhoes da Propriedade. Esta fase
foi apenas documental: nenhuma localizacao foi implementada, nenhuma
dependencia foi instalada e nenhuma coordenada do usuario foi salva.

Diagnostico registrado:

- `FazendaMapaScreen` e a tela ativa mais segura para uma primeira localizacao,
  porque ja valida acesso por Propriedade, carrega Talhoes e usa
  `MapaFazendaView`;
- `MapaFazendaView` segue como componente ativo, com WebView/Leaflet,
  OpenStreetMap online, comandos por `injectJavaScript` e fallback SVG;
- `MapaFazendaNativoView` existe como experimento historico com
  `react-native-maps`, mas nao esta em rota ou tela ativa;
- `MapasScreen` e `ShapeRenderer` continuam como panorama/preview de Material
  tecnico e consulta por Talhao, nao como ponto primario recomendado para GPS;
- `GeoJsonTalhoesLayerService` decide entre seed/mock e GeoJSON local ativo,
  sem persistir Talhoes normalizados;
- naquele momento, `package.json` possuia `react-native-maps`, mas nao possuia
  `expo-location`;
- naquele momento, `app.json` nao possuia configuracao de permissao de
  localizacao.

Recomendacao registrada na analise 17G.0:

- implementar, se aprovado depois, uma versao minima no
  `FazendaMapaScreen`/`MapaFazendaView` atual;
- usar localizacao foreground only, acionada por botao, sem background, sem
  trilha/historico e sem persistencia;
- passar latitude/longitude apenas em memoria para o WebView e atualizar um
  marcador Leaflet por comando injetado;
- nao exibir marcador em PNG, ZIP ou materiais tecnicos;
- manter mapa nativo como alternativa futura, nao como primeira entrega do MVP.

Continuam pendentes:

- validar a dependencia de localizacao no build e smoke da implementacao 17G.1;
- confirmar Android fisico para smoke de permissao, precisao e consumo;
- manter PNG/ZIP como materiais nao georreferenciados;
- repetir Material tecnico, PNG, ZIP e GeoJSON local em rodada propria depois
  da limpeza do estado do emulador;
- Android fisico segue pendente e nao aprovado.

## Fase 17G.1 - Localizacao Foreground No Mapa De Talhoes

Status em 2026-07-09: implementada a primeira visualizacao de localizacao
foreground no mapa de Talhoes da Propriedade, sobre o fluxo ativo
`FazendaMapaScreen` + `MapaFazendaView` com WebView/Leaflet.

O que mudou:

- `expo-location@~56.0.20` foi instalado com
  `npx expo install expo-location`;
- `app.json` recebeu texto de permissao foreground e configuracao sem
  background location;
- foi criado `src/services/LocationForegroundService.ts` para solicitar
  permissao foreground sob demanda, verificar servicos de localizacao e obter
  uma leitura atual controlada;
- `FazendaMapaScreen` recebeu o botao `Mostrar minha posicao`, visivel apenas
  quando ha contexto de Propriedade e Talhoes exibidos;
- a coordenada fica somente em state React e e descartada naturalmente ao sair
  da tela ou trocar de Propriedade;
- `MapaFazendaView` recebeu a prop transiente `userLocation` e injeta no
  Leaflet um payload serializado com latitude, longitude, accuracy e
  `capturedAt`;
- o Leaflet cria/atualiza marcador e circulo de precisao em runtime, sem
  alterar Talhoes, GeoJSON local, PNG, ZIP ou Caderno;
- o fallback SVG nao desenha marcador e exibe a mensagem de que a posicao do
  aparelho esta disponivel apenas no mapa interativo.

Limites preservados:

- nao ha localizacao em background;
- nao ha `TaskManager`, `startLocationUpdatesAsync`, watch continuo,
  geofencing, trilha, rota, historico, ultimo ponto persistido ou geotag;
- nenhuma coordenada do usuario e salva em AsyncStorage;
- nenhuma chave nova de storage de localizacao foi criada;
- `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`, seeds/assets da Sela de
  Prata I e as chaves locais existentes permanecem sem alteracao;
- PNG e ZIP continuam materiais tecnicos/anexos nao georreferenciados;
- Caderno de Campo nao recebe coordenada automaticamente;
- backend, RBAC real, sync, upload, download real e storage remoto seguem fora
  do escopo.

Validacao tecnica inicial:

- `npm run typecheck` passou apos a implementacao;
- `npm run test:domain-compat` passou;
- `npx expo install --check` reportou somente divergencia de Expo:
  `expo@56.0.11 - expected version: ~56.0.15`;
- essa divergencia foi mantida sem correcao nesta fase funcional.
- `.\gradlew.bat :app:assembleRelease` falhou inicialmente por limite de
  memoria no Kotlin daemon em `:expo:compileReleaseKotlin`;
- a build release passou depois com Gradle em modo mais economico
  (`--no-daemon --max-workers=1 --no-parallel`, Kotlin in-process e heap
  limitado);
- o APK `android/app/build/outputs/apk/release/app-release.apk` foi instalado
  no emulador `emulator-5554` e aberto via `monkey` sem crash inicial;
- `adb dumpsys package com.tcheagro.mobile` confirmou as permissoes
  `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION` no pacote instalado, sem
  `ACCESS_BACKGROUND_LOCATION`;
- o app abriu como Colaborador, a lista de Propriedades exibiu Sela de Prata I
  e a navegacao por `uiautomator` chegou ao contexto de Material tecnico da
  Propriedade;
- o estado local atual do emulador nao possuia GeoJSON local anexado para a
  Propriedade, entao o smoke visual de marcador/permissao da localizacao nao
  foi considerado aprovado nesta rodada.

Status em 2026-07-10 (Fase 17G.2): o smoke visual da localizacao foreground foi
executado em emulador na Sela de Prata I sobre a camada de Talhoes seed/mock.
Foram feitos ajustes localizados para usar uma ultima leitura recente do sistema
quando a leitura atual expira no emulador e para desenhar o marcador em uma
pane Leaflet acima dos rotulos dos Talhoes. O botao `Mostrar minha posicao`
exibiu sucesso com precisao de 8 m na posicao simulada, o marcador azul ficou
visivel, a consulta de Talhao continuou funcional, permissao negada e servicos
de localizacao desligados geraram mensagens controladas, e apos `force-stop` a
posicao nao foi restaurada automaticamente. A auditoria confirmou ausencia de
AsyncStorage, chave nova, watch continuo, TaskManager, background location,
geofencing, historico, rota ou coordenada nova no Caderno.

Pendencias registradas ao fim da 17G.2, tratadas quando indicado na 17G.3 abaixo:

- reexecutar anexo/importacao de GeoJSON local via DocumentPicker nesta frente;
- forcar manualmente o fallback SVG/WebView;
- repetir login manual separado de Produtor em Material tecnico quando houver
  rodada visual dedicada;
- validar em Android fisico autorizado. Android fisico segue pendente e nao
  aprovado.

## Fase 17G.3 - Revalidacao GeoJSON Local, PNG/ZIP E Foreground

Status em 2026-07-10: a localizacao foreground foi revalidada no emulador
`emulator-5554` (`Pixel_Tablet`, API 35) sobre GeoJSON local ativo da Sela de
Prata I, sem implementar feature nova e sem exigir correcao de codigo.

Resultado da rodada:

- `limites_talhoes.geojson` foi reanexado pelo DocumentPicker e confirmado com
  15 Talhoes, 37 partes/poligonos e geometrias `MultiPolygon`/`Polygon`;
- a tela e o Leaflet passaram a indicar `GeoJSON local`/`GEOJSON LOCAL`, com os
  Talhoes renderizados e clicaveis;
- uma posicao simulada no emulador apareceu como marcador azul e circulo de
  precisao de 8 m, sem afirmar dentro/fora de Talhao;
- o detalhe de `T01 - 230` continuou abrindo depois da localizacao;
- apos `force-stop`, o GeoJSON local permaneceu ativo, mas a posicao anterior
  nao foi restaurada e o marcador so voltou apos nova solicitacao;
- `smoke_ph_10a20.png` abriu como imagem local, sem localizacao;
- `prescricao_taxa_variavel_2026.zip` abriu apenas o detalhe do pacote, sem
  preview, unzip, processamento ou localizacao;
- um registro de Caderno do Talhao `T01 - 230` preservou Propriedade e Talhao
  e nao exibiu latitude, longitude, accuracy, `capturedAt`, geotag ou campo de
  localizacao;
- Produtor reabriu PNG e ZIP sem acoes de anexar, substituir ou remover;
- permissao negada e servicos de localizacao desligados voltaram a exibir
  mensagens controladas, sem crash.

Auditoria da 17G.3:

- localizacao continua foreground only e acionada por botao;
- nao ha background location, `TaskManager`, `startLocationUpdates`, watch
  continuo, geofencing, trilha, rota, historico, ultimo ponto ou geotag;
- nenhuma coordenada e salva em AsyncStorage, Caderno, mock ou logs;
- nenhuma chave `@tche:*` de localizacao foi criada;
- GeoJSON, PNG e ZIP continuam guardando arquivo fisico no storage interno e
  apenas metadados pequenos nas chaves locais existentes;
- PNG e ZIP continuam nao georreferenciados.

Validacoes executadas:

- `npm run typecheck`;
- `npm run test:domain-compat`;
- `npx expo install --check`, mantendo a divergencia conhecida
  `expo@56.0.11` versus `~56.0.15`;
- `.\gradlew.bat :app:assembleRelease`, com repeticao fora do sandbox apenas
  para acessar o cache Gradle local;
- `adb install -r android\app\build\outputs\apk\release\app-release.apk`;
- `adb shell am start`/`monkey`, `uiautomator`, capturas de tela, simulacao de
  localizacao, `force-stop`, revogacao de permissao e desligamento dos servicos;
- auditoria ampla por `rg` e buscas focadas de storage/localizacao;
- `dumpsys package` com `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`, sem
  `ACCESS_BACKGROUND_LOCATION`.

Pendencias remanescentes:

- forcar o fallback SVG/WebView continua `Reexecutar`, porque nao existe chave
  segura de teste sem alterar o app ou interferir de forma arriscada no
  WebView;
- o caso seed/mock permanece aprovado pela 17G.2 e nao foi removido/repetido
  durante a revalidacao da camada local;
- Android fisico segue pendente e nao aprovado;
- iOS, precisao/consumo em campo e politica futura de mapa-base/offline seguem
  pendentes;
- backend, RBAC real, sync, upload/download real e storage remoto continuam
  fora do escopo.

## Fase 17H.0 - Analise Tecnica De Marcacoes De Campo

Status em 2026-07-14: foi criada a analise tecnica
`docs/project/fase-17h-marcacoes-campo.md` para orientar uma futura
implementacao de marcacoes de campo vinculadas ao Caderno. Esta fase foi apenas
documental: nenhuma marcacao foi implementada, nenhum storage novo foi criado,
nenhuma chave `@tche:` nova foi criada e nenhuma coordenada foi salva.

Diagnostico registrado:

- localizacao foreground da 17G continua apenas temporaria no mapa de Talhoes,
  acionada por `Mostrar minha posicao`;
- Caderno atual ja preserva Propriedade, `fazenda_id`/`fazendaId`, Talhao,
  autoria, visibilidade e Safra/Safrinha opcional;
- `TalhaoDetailModal` ja possui acao `Registrar no Caderno`, que pode ser o
  encaixe futuro para uma acao explicita de ponto;
- PNG e ZIP continuam materiais tecnicos nao georreferenciados;
- Caderno ainda nao possui campos de latitude, longitude, accuracy,
  `capturedAt`, geotag ou localizacao do registro.

Recomendacao da analise:

- para o MVP demonstravel, preferir Caderno com metadados opcionais de
  localizacao em fase futura;
- nao criar `@tche:field-markers:v1` no primeiro corte;
- salvar coordenada somente apos acao explicita como `Registrar ponto` ou
  `Usar minha posicao neste registro` e somente junto com o salvamento do
  Caderno;
- manter Caderno sem coordenada como fluxo normal;
- nunca salvar coordenada apenas por abrir mapa, tocar em `Mostrar minha
  posicao`, abrir Talhao ou abrir Caderno;
- manter sem background, sem `TaskManager`, sem watch continuo, sem geofencing,
  sem trilha, sem rota, sem historico, sem ultimo ponto e sem tracking.

Pendencias para 17H.1:

- confirmar decisao final de armazenamento no Caderno ou aprovar storage
  auxiliar;
- definir campos opcionais finais;
- confirmar mensagem de consentimento e UX de remover localizacao antes de
  salvar;
- testar cancelamento sem persistencia e persistencia apenas ao salvar
  Caderno;
- confirmar que PNG/ZIP seguem sem marcador ou georreferenciamento;
- validar Android fisico autorizado ou aceitar explicitamente a pendencia antes
  de abrir implementacao. Android fisico segue pendente e nao aprovado.

## Rodada De Estabilizacao Visual E Rotas - 2026-07-14

Status em 2026-07-14: foi executada uma rodada de estabilizacao sobre o APK
release e o emulador `emulator-5554` (`Pixel_Tablet`, API 35), sem abrir feature
nova, alterar regra de acesso, contrato de rota, storage ou dependencia.

Correcoes aplicadas a partir de falhas visuais reproduzidas:

- o resumo do GeoJSON passou a exibir corretamente `talhao`/`talhoes`, sem a
  forma incorreta `talhaos`;
- a contagem de Talhoes no contexto da Propriedade passou a usar o plural
  correto, sem formar `talhaoes`;
- a observacao tecnica do Talhao carregado de GeoJSON foi reescrita com
  acentuacao e linguagem consultiva;
- os warnings de aneis internos do validador GeoJSON receberam acentuacao;
- o atalho do Caderno para Produtor passou de `Ver e registrar campo` para
  `Ver e registrar ocorrencias`.

Smoke visual e de rotas:

- Admin abriu Dashboard, Propriedades, Sela de Prata I, aba Talhoes, Material
  tecnico, GeoJSON local ativo, Panorama/mapa e detalhe de `T01 - 230`;
- Produtor abriu Minhas Propriedades, Sela de Prata I, Talhoes, Material
  tecnico, Panorama/mapa e Caderno, sem acoes administrativas;
- `Registrar no Caderno` abriu `NovoCaderno` com a Propriedade Sela de Prata I
  travada pelo contexto da rota e Safra/Safrinha opcional;
- a reinstalacao com `adb install -r` e o boot frio preservaram sessao e
  GeoJSON local;
- o APK corrigido exibiu `15 talhoes`, `Ver e registrar ocorrencias` e a nova
  observacao do GeoJSON;
- nenhuma rota quebrada ou perda de `fazenda_id` foi reproduzida nessa rodada.

Localizacao:

- `dumpsys package` confirmou `ACCESS_FINE_LOCATION` e
  `ACCESS_COARSE_LOCATION` concedidas;
- no boot headless, o provider do emulador nao entregou coordenada nem depois
  de `adb emu geo fix`; o app exibiu `Nao foi possivel obter a posicao atual do
  aparelho.` sem crash e manteve o mapa navegavel;
- o marcador de sucesso nao foi reprovado, pois permanece coberto pela 17G.3,
  mas ficou como `Reexecutar` nesta rodada e segue obrigatorio no Android
  fisico.

Validacoes executadas:

- `npm run typecheck`: passou;
- `npm run test:domain-compat`: passou integralmente;
- `npx expo install --check`: manteve somente a divergencia conhecida
  `expo@56.0.11` versus `~56.0.15`, sem alteracao de dependencia;
- a primeira build release caiu por falta de memoria nativa da JVM com heap de
  2 GiB; o ambiente Android gerado localmente foi ajustado para heap de 1 GiB,
  Kotlin in-process, sem paralelismo e um worker;
- `:app:packageRelease` passou na repeticao isolada e a validacao final
  `:app:assembleRelease` concluiu com `BUILD SUCCESSFUL`, gerando
  `android/app/build/outputs/apk/release/app-release.apk` com 91.881.352 bytes
  e SHA-256
  `D7965DCFB61536E42917A3A80F078E846EAF2765DBC1B4D7A14075983AF2D4E5`;
- o APK foi reinstalado e aberto no emulador sem crash inicial.

Pendencias remanescentes:

- repetir o marcador de localizacao em Android fisico autorizado;
- repetir Colaborador manualmente em aparelho fisico; o perfil permaneceu
  coberto pela suite automatizada e pelos smokes anteriores;
- alinhar a versao Expo somente em fase propria;
- a configuracao economica foi aplicada em `android/`, pasta gerada e ignorada
  pelo Git, portanto deve ser reaplicada apos uma regeneracao nativa se a
  maquina voltar a apresentar falta de memoria.

## Fase 17H.0.1 - Auditoria Consolidada Das Pendencias Do MVP

Status em 2026-07-21: foi concluida a auditoria anterior a qualquer
implementacao de persistencia de coordenadas, marcacoes de campo ou fotos
georreferenciadas. A matriz completa, evidencias, storage, checklist
AUD-01..AUD-12 e problemas P0/P1/P2 estao em
`docs/project/auditoria-pendencias-mvp-antes-evidencias.md`.

Classificacao consolidada:

- Material tecnico, Prescricao ZIP, localizacao foreground e gestao local de
  Talhoes importados: `IMPLEMENTADO_VALIDADO_EMULADOR`, com Android fisico
  pendente;
- Caderno por Talhao/historico e Safra/Safrinha:
  `IMPLEMENTADO_SMOKE_INCOMPLETO`, por faltarem casos manuais especificos de
  Colaborador, Admin, Produtor com periodo e force-stop do historico;
- area/perimetro: `PARCIAL`; 6200 ha e area total informada da Propriedade,
  1888,6 ha e soma mapeada no manifesto processado, e nao ha perimetro
  processado comprovado para a Sela de Prata I;
- marcacoes de fertilizacao/correcao: `SOMENTE_DOCUMENTADO`;
- processamento remoto, publicacao, sync e download real:
  `DEPENDE_BACKEND`;
- fotos com data, hora, latitude e longitude: `NAO_IMPLEMENTADO`.

Achados funcionais registrados, sem correcao nesta fase:

- `FazendaMapaScreen` pode exibir area ausente como `0 ha total` e chamar a
  soma mapeada dos Talhoes de area total;
- Nova/Editar Visita ainda oferecem Camera/Galeria simuladas por URLs
  `picsum.photos`, sem camera, arquivo local ou geotag real.

Validacoes da auditoria:

- baseline Git estava limpo, sem arquivo modificado ou nao rastreado;
- `npm run typecheck`, `npm run test:domain-compat` e os grupos focados de
  Caderno, acesso, validators, periodo, Talhao, GeoJSON, PNG e ZIP passaram;
- `npx expo install --check` reportou o esperado atual `expo ~56.0.16` e
  `expo-location ~56.0.21` para as versoes instaladas 56.0.11/56.0.20; nenhuma
  dependencia foi alterada;
- `:app:assembleRelease` concluiu com `BUILD SUCCESSFUL` e preservou o APK de
  91.881.352 bytes;
- `adb devices -l` permaneceu vazio; nao houve instalacao, `monkey` ou novo
  smoke interativo. Android fisico continua pendente e nao aprovado.

Nenhuma funcionalidade foi implementada, nenhuma chave `@tche:` foi criada e
nenhuma coordenada foi persistida. `decisoes-consolidadas.md` nao foi alterado
porque a auditoria nao fechou decisao nova.

## Fase 17H.0.2 - Consolidacao Das Decisoes Funcionais

Status em 2026-07-21: as direcoes funcionais com maturidade suficiente foram
promovidas a decisoes 15 a 21 em
`docs/project/decisoes-consolidadas.md`, sem alterar codigo, contratos,
storage, dependencias, mocks, seeds ou assets.

- `DECISOES_CONSOLIDADAS_PARA_FECHAMENTO_DO_BASELINE`
- `DESENVOLVIMENTO_EM_EMULADOR_AUTORIZADO`
- `CAMPO_BLOQUEADO_ATE_ANDROID_FISICO`

Decisoes consolidadas:

- desenvolvimento, testes e smoke tecnico podem continuar em emulador;
- Android fisico autorizado continua obrigatorio para validacao fisica e
  aprovacao de campo;
- o primeiro ponto persistido sera metadado opcional do Caderno, sem
  `@tche:field-markers:v1`, somente apos acao explicita e submit;
- abrir mapa/Talhao/Caderno, usar `Mostrar minha posicao`, cancelar ou remover
  a localizacao antes de salvar nunca persiste coordenada;
- a marcacao reutilizara as permissoes atuais do Caderno, sem RBAC novo;
- `area_total` deve aparecer como `Area total informada`, a soma disponivel dos
  Talhoes como `Area mapeada`, ausencia como `Nao informado` e perimetro apenas
  com valor/origem comprovados;
- as acoes `picsum.photos` sao simulacoes e devem ser removidas ou desativadas
  em microfase posterior, preservando leitura dos mocks;
- o celular nao gera mapas e processamento/publicacao/sync/download reais
  continuam na trilha de backend;
- Expo e `expo-location` serao alinhados somente em fase tecnica isolada, sem
  `npm audit fix`.

Pendencias de decisao removidas:

- Caderno versus storage auxiliar no primeiro corte;
- gate entre desenvolvimento em emulador e aprovacao de campo;
- permissao dos perfis para o ponto futuro;
- semantica de apresentacao de area/perimetro;
- classificacao das fotos atuais como simulacao;
- limite do processamento local versus backend;
- separacao entre alinhamento Expo e correcoes funcionais.

Pendencias mantidas:

- AUD-04, AUD-05, AUD-06 e historico do Caderno apos `force-stop`;
- Android fisico autorizado e aprovacao de campo;
- implementacao/testes da correcao de area;
- remocao ou desativacao dos placeholders ativos de foto;
- alinhamento tecnico Expo;
- shape final, UX, implementacao e testes do ponto opcional no Caderno;
- foto real/georreferenciada em fase propria;
- backend e processamento externo produtivo.

Nenhuma funcionalidade foi implementada, nenhuma coordenada foi salva e
nenhuma chave `@tche:` foi criada na 17H.0.2. Android fisico segue pendente e
nao aprovado.

## Fase 17H.0.3 - Fechamento Manual Do Baseline Caderno/Talhao/Safra

Status em 2026-07-21: AUD-04, AUD-05, AUD-06 e a persistencia do historico
apos `force-stop` passaram no AVD `Teste_Tche`, Pixel Tablet, Android 15/API
35. O APK release foi instalado por cima com `adb install -r`; nao houve
`pm clear`, desinstalacao ou `Wipe Data`.

Evidencias funcionais no `T01 - 230` da Fazenda Sela de Prata I:

- Colaborador criou, abriu e editou o Caderno
  `AUD04-COLAB-T01-20260721-EDITADO`, preservando Propriedade, Talhao,
  autoria, visibilidade e um unico registro no historico especifico;
- Admin criou o Caderno `AUD05-ADMIN-T01-20260721` e a Safra
  `AUD05-ADMIN-PERIODO-20260721`, ano `2026/2027`, vinculada ao mesmo Talhao;
  a edicao alterou o status para `Em andamento` e registrou a observacao
  `AUD05-ADMIN-PERIODO-20260721-EDITADO` sem duplicar o periodo;
- Produtor consultou o periodo sem acoes de criar/editar/remover e criou
  `AUD06-PRODUTOR-SAFRA-20260721`, selecionando explicitamente a Safra do
  Admin; o detalhe preservou autoria do Produtor, visibilidade liberada,
  Propriedade, Talhao e vinculo opcional;
- apos `am force-stop` e reabertura por `monkey`, a sessao do Produtor foi
  restaurada. Produtor e Admin reencontraram AUD-06, AUD-05 e AUD-04 editado
  na ordem recente; o Admin reencontrou o periodo editado e o historico
  especifico do Talhao com os tres registros, sem converter registros gerais
  em registros especificos.

Validacoes executadas e aprovadas:

- `npm run typecheck` e `npm run test:domain-compat`;
- testes focados de Caderno, acesso, validators, periodo produtivo e consulta
  por Talhao;
- `:app:assembleRelease`, instalacao `-r`, abertura por `monkey` e
  `git diff --check`;
- buscas de nao regressao para coordenadas/chaves e aliases de
  Propriedade/Talhao/periodo.

Nenhum bug funcional foi reproduzido, portanto nenhum codigo ou teste novo foi
adicionado. `src/api/mock.ts`, listas, seeds/assets, 6200 ha, 1888,6 ha,
area/perimetro, fotos simuladas, Expo/dependencias, backend e storage remoto
nao foram alterados. Nenhuma coordenada/geotag foi persistida e nenhuma chave
`@tche:` foi criada. Android fisico continua pendente e nao aprovado.

## Fase 17H.0.5 - Semantica Segura De Area E Perimetro

Status em 2026-07-21: a apresentacao de medidas foi corrigida e validada no
AVD `Teste_Tche`, Pixel Tablet, Android 15/API 35. O requisito geral de
area/perimetro permanece `PARCIAL`: a semantica de area esta
`IMPLEMENTADO_VALIDADO_EMULADOR`, enquanto o perimetro esta
`NAO_DISPONIVEL_NO_PIPELINE_ATUAL`.

Origem e leitura das medidas:

- `area_total` do cadastro da Propriedade e exibida como `Area total
  informada`; na Sela de Prata I permanece 6200 ha;
- apenas valores numericos finitos e positivos de `area_hectares` dos Talhoes
  entram em `Area mapeada`; os 15 Talhoes da amostra permanecem em 1888,6 ha;
- se parte dos Talhoes nao tiver area valida, a UI usa `Area mapeada parcial`;
  sem nenhuma area valida, usa `Nao informado`, nunca zero como fallback;
- o detalhe usa `Area do Talhao`; o `T01 - 230` exibiu 274,1 ha;
- perimetro exige valor positivo, unidade conhecida e origem especifica da
  medida. A camada atual da Sela nao possui essa proveniencia, portanto nenhum
  perimetro foi inventado ou derivado da geometria.

Implementacao e cobertura:

- `src/utils/talhaoMedidasCompat.ts` centraliza normalizacao, formatacao,
  resumo de cobertura das areas e gate de perimetro, sem storage, filesystem,
  GeoJSON bruto, arrays de coordenadas ou APIs de mapa;
- mapa, panorama, cards e detalhes deixaram de usar `ha total`, zero ou hifen
  com unidade para representar ausencia;
- `tests/talhaoMedidasCompat.test.js` cobre 23 cenarios, inclusive a fixture
  minima das 15 areas da Sela, separacao 6200/1888,6, cobertura completa,
  parcial/ausente e proveniencia do perimetro;
- o teste novo foi incorporado a `test:domain-compat` e ao recorte do
  `tsconfig.domain-compat.json`.

Validacoes aprovadas:

- `npm run typecheck`, `npm run test:domain-compat`, teste novo, consulta por
  Talhao e testes focados de validacao/camada GeoJSON;
- `:app:assembleRelease`, `adb install -r` e `monkey`; APK final com
  91.892.900 bytes e SHA-256
  `4206B1A3DBFBC5BEE4EAA38164C45EBA5E0F2570672BD65B6DE364271642AB22`;
- smoke visual confirmou `Area total informada: 6.200 ha`, `Area mapeada:
  1.888,6 ha`, selecao do `T01 - 230`, `Area do Talhao: 274,1 ha`, botao
  `Mostrar minha posicao`, categorias de Material tecnico e reabertura de
  Caderno/Safra;
- nao havia cenario visual de area ausente; cobertura parcial/ausente foi
  validada pelo teste automatizado, sem criar dado mockado para o smoke.

Nao foram alterados `src/api/mock.ts`, `Mapa.list`, `LimiteArea.list`,
seeds/assets, manifesto ou GeoJSON da Sela. Nenhuma medida ou coordenada foi
calculada/persistida, nenhuma chave `@tche:` foi criada e fotos, Expo,
dependencias, backend e storage remoto continuaram fora do escopo. A instalacao
preservou o estado: nao houve `pm clear`, desinstalacao ou `Wipe Data`. Android
fisico continua pendente e nao aprovado.

## Fase 17H.0.6 - Segregacao Dos Placeholders De Foto Em Visitas

Status em 2026-07-21: a pendencia P1-02 foi encerrada no emulador. Nova e
Editar Visita nao oferecem mais acoes de Camera/Galeria, nao geram
`picsum.photos` e nao criam instante para simular captura. A segregacao dos
placeholders esta `IMPLEMENTADO_VALIDADO_EMULADOR`; foto real e foto
georreferenciada continuam `NAO_IMPLEMENTADO`.

Comportamento atual:

- Nova Visita exibe o aviso `Fotos no MVP local`, continua salvando sem foto e
  emite o campo legado `fotos` como array vazio;
- Editar Visita preserva o array `fotos` exatamente como foi carregado quando
  outro campo e alterado. A remocao explicita existente continua disponivel e
  remove somente o item escolhido;
- `VisitaDetailScreen` e a listagem identificam as imagens existentes como
  demonstrativas. Falha de URL no detalhe produz `Imagem indisponivel`, sem
  crash e sem impedir a leitura do registro;
- `getVisitaFotoUri` e `removeVisitaFotoAtIndex` foram adicionados ao helper
  puro `visitaFormCompat`, sem storage, arquivo, camera, EXIF ou coordenadas;
- o contrato/array legado `fotos` e os aliases operacionais de Propriedade
  permaneceram inalterados.

Validacoes aprovadas:

- `npm run typecheck`, `npm run test:domain-compat`, `validatorsCompat`,
  `mockCompat` e os 16 cenarios de `visitaFormCompat` passaram;
- a auditoria textual nao encontrou gerador ativo, `adicionarFotoSimulada`,
  acao Camera/Galeria, biblioteca de camera/seletor, geotag ou storage novo nos
  formularios. `picsum.photos` permanece somente no seed demonstrativo
  preservado e nas fixtures de compatibilidade;
- `:app:assembleRelease`, `adb install -r` e `monkey` passaram no AVD
  `Teste_Tche`, Pixel Tablet, Android 15/API 35. O APK possui 91.891.676 bytes
  e SHA-256
  `BFA15F6D8492A808BA3BD5394F9AB59DA7894C06401572FBBBC48DCB2067E124`;
- no smoke, Admin criou Visita sem foto, abriu o detalhe sem secao vazia,
  editou o status e salvou. Um registro legado com duas imagens continuou
  exibindo as duas apos edicao de outro campo, com o label demonstrativo;
- Caderno abriu com Safra/Safrinha, o mapa abriu 15 Talhoes com a acao de
  localizacao disponivel e Material tecnico abriu no contexto da Sela.

Nao foram alterados `src/api/mock.ts`, contratos de dominio, validators,
listas, seeds/assets, Caderno, Safra/Safrinha, GeoJSON, PNG, ZIP, package ou
permissoes. Nenhuma camera/galeria real, arquivo, upload, base64, coordenada,
geotag, chave `@tche:` ou storage de foto foi criado. A instalacao preservou o
estado: nao houve `pm clear`, desinstalacao ou `Wipe Data`. Android fisico
continua pendente e nao aprovado.

## Fase 17H.0.7 - Alinhamento Tecnico Pontual Do Expo SDK 56

Status em 2026-07-21: `APROVADA_EM_EMULADOR`. O projeto permaneceu no Expo
SDK 56 e somente as dependencias diretas `expo` e `expo-location` foram
alinhadas com as versoes indicadas pela consulta oficial executada nesta fase:

- `expo`: `~56.0.11`/56.0.11 -> `~56.0.16`/56.0.16;
- `expo-location`: `~56.0.20`/56.0.20 -> `~56.0.21`/56.0.21;
- `npx expo install --check` e o check dirigido dos dois pacotes passaram
  depois da instalacao com `Dependencies are up to date`;
- React 19.2.3, React Native 0.85.3, TypeScript 6.0.3 e as demais dependencias
  diretas permaneceram inalteradas;
- o lockfile recebeu apenas a resolucao transitiva correspondente aos patches
  do Expo SDK 56. `app.json`, `android/`, `ios/`, codigo funcional, mocks,
  listas, contratos e assets nao mudaram.

O Expo Doctor passou de 17/21 para 18/21. A divergencia de `expo` e
`expo-location` foi eliminada; ficaram registrados, sem correcao fora do
escopo, os avisos preexistentes de schema `splash`, peer direto `expo-font` e
duplicidade de `expo-font`.

Validacoes aprovadas:

- `npm run typecheck` e `npm run test:domain-compat` passaram antes e depois;
- a suite completa cobriu Caderno, acesso, validators, Periodo Produtivo,
  Talhao, Visitas, GeoJSON, PNG, ZIP e autenticacao local;
- o build inicial revelou falta de `Metaspace`; o fallback local sem daemon,
  com um worker e sem paralelismo passou sem alterar configuracao;
- APK release com 91.892.916 bytes, SHA-256
  `6254AB718E716CDD76D45E42DF1A9B7BE4126EF7ACC47465F4FE932A6300C26A`;
- `adb install -r`, `monkey` e abertura do Dashboard passaram no Pixel
  Tablet/API 35, preservando sessao e estado;
- `dumpsys package` confirmou localizacao fina/aproximada e ausencia de
  background location, camera e permissoes de galeria/arquivos.

No smoke, a Sela preservou 6200 ha informados, 1888,6 ha mapeados, 15 Talhoes
e `T01 - 230` com 274,1 ha; PNG de Fosforo, Caderno/Safra e imagens
demonstrativas de Visita abriram. O provider do AVD nao retornou posicao e o
app exibiu a mensagem controlada, sem crash ou persistencia; nao havia GeoJSON
ou ZIP local ativo no snapshot, e suas suites focadas passaram. O relato
completo esta em `fase-17h-07-alinhamento-expo-sdk56.md`.

Nao houve `npm update`, `npm audit fix`, `expo install --fix`, prebuild,
regeneracao nativa, nova chave `@tche:`, coordenada persistida, camera/foto
real, backend ou sync. Android fisico continua pendente e nao aprovado.

## Fase 17H.1A - Contrato Do Ponto Opcional No Caderno

Status em 2026-07-21: `IMPLEMENTADO_VALIDADO_EMULADOR`. O primeiro ponto
geografico opcional agora possui contrato tecnico, validacao e compatibilidade
de persistencia local no Caderno, ainda sem qualquer UI ou captura.

Shape canonico:

- `localizacao_latitude` e `localizacao_longitude` finitas, presentes juntas e
  dentro dos limites geograficos;
- `localizacao_captured_at` como ISO string valida e `localizacao_origem`
  restrita a `foreground_explicit`;
- `localizacao_accuracy` ausente, nula ou nao negativa e
  `localizacao_captured_by` opcional, mas nao vazio quando informado;
- os seis campos ficam ausentes em Caderno sem ponto. Nao existe objeto
  `localizacao`, `coords` ou alias camelCase persistido.

`cadernoLocalizacaoCompat` e puro e implementa leitura defensiva, validacao e
as intencoes `preserve`, `replace` e `remove`. A borda `mockCompat` preserva o
ponto em update comum, substitui o grupo integralmente e converte a remocao em
registro final sem campos ou sentinel. O snapshot permanece exclusivamente em
`@tche:mock-mvp:v1`.

Validacoes aprovadas:

- `npm run typecheck`, `npm run test:domain-compat` e todos os testes focados;
- 51 cenarios novos de contrato/persistencia/restauracao;
- `npx expo install --check` com `Dependencies are up to date`;
- build release pelo fallback de um worker, APK com 91.899.152 bytes e
  SHA-256
  `08BD45C2AF986B00B3591AE2CBEF5979B97DD2AA6410F57F7EB9EB8E0F27DEEC`;
- `adb install -r`, `monkey` e smoke minimo no Pixel Tablet/API 35.

O smoke preservou sessao/dados, Caderno comum e formularios sem secao de
localizacao, 15 Talhoes e areas seguras, Material tecnico com Fertilidade,
Correcao e Prescricao e Visitas sem Camera/Galeria. `Mostrar minha posicao`
continuou transitorio e terminou com falha controlada do provider do AVD, sem
persistencia.

Nao foram alterados `src/api/mock.ts`, telas de Caderno/mapa, servico de
localizacao, listas, seeds/assets, GeoJSON, PNG, ZIP, dependencias, app.json ou
fontes nativas. Nenhuma UI, captura, chave nova, coordenada real, background,
tracking, trilha ou historico foi criado. Android fisico continua pendente e
nao aprovado. O relato completo esta em
`fase-17h-1a-contrato-ponto-caderno.md`.

## Fase 17H.1B - UI E Captura Explicita Do Ponto No Caderno

Status em 2026-07-21: `IMPLEMENTADO_VALIDADO_EMULADOR`. Novo e Editar Caderno
agora exibem uma secao opcional de localizacao, sem captura automatica. A
leitura foreground unica so inicia depois da acao explicita do usuario, passa
por `LocationForegroundService` e permanece em state React ate o submit.

Comportamento atual:

- Caderno sem ponto continua emitindo o payload anterior, sem qualquer
  `localizacao_*`;
- captura valida acrescenta somente os seis campos canonicos imediatamente
  antes de `CadernoCampo.create` ou `CadernoCampo.update`;
- captura pendente bloqueia submit concorrente, tem timeout finito de 15
  segundos e descarta resposta antiga, posterior a cancelamento ou
  desmontagem;
- mudanca de Propriedade remove o draft; Talhao nao e selecionado nem validado
  automaticamente pela coordenada;
- edicao inicia em `preserve`; `replace` e `remove` ficam pendentes em memoria
  e so alteram o registro ao salvar; a remocao pode ser desfeita;
- detalhe mostra somente ponto canonico valido, com coordenadas formatadas,
  precisao, horario e nome resolvido sem expor id tecnico cru;
- cards de Caderno na listagem, detalhe da Propriedade e modal do Talhao
  mostram apenas o selo `Com ponto geográfico` quando o ponto e valido.

Validacoes aprovadas:

- `npm run typecheck`, `npm run test:domain-compat` e testes focados de
  Caderno, acesso, validators, periodo e consulta por Talhao;
- 33 cenarios no novo teste puro de UI/localizacao e cobertura adicional nos
  testes contratuais/formulario/validators;
- `npx expo install --check` com `Dependencies are up to date`;
- `:app:assembleRelease`, `adb install -r` e `monkey` no Pixel Tablet,
  Android 15/API 35. APK com 91.922.508 bytes e SHA-256
  `3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B`;
- smoke com create sem/com ponto, erro/timeout controlado, GPS simulado, baixa
  precisao, aviso de Talhao, detalhe/nome, selo, `preserve`, `replace`,
  `remove`, desfazer e remocao persistida. O provider simulado foi restaurado
  ao final. O fluxo do Produtor tambem passou pela Sela de Prata I e pelo
  Talhao `T01 - 230`, com create sem ponto e com ponto de 18 m.

Nao foram criados storage ou chave `@tche:` novos, background, tracking,
watch, TaskManager, trilha, rota, historico, geofencing, point-in-polygon ou
marcador persistido no mapa. `Mostrar minha posição` continua transitorio.
Auditoria estatica confirmou Visita, PNG, ZIP, GeoJSON e mapa sem
`localizacao_*`.

Android fisico continua pendente e nao aprovado. A regressao visual minima de
PNG/ZIP/mapa foi fechada na 17H.1.2. O relato completo esta em
`fase-17h-1b-ui-ponto-caderno.md`.

## Fase 17H.1.1 - Smoke De Seguranca E Regressao Do Ponto Opcional

Status em 2026-07-22: `APROVADA_EM_EMULADOR`. A rodada original e o fechamento
visual 17H.1.2 nao alteraram codigo, contratos, dependencias, mocks, seeds ou
assets. Os 29/29 casos executaveis no emulador passaram. Typecheck, suite
completa, testes focados de Caderno/acesso/validators/periodo/Talhao e suites
de GeoJSON, PNG, ZIP e Visita passaram; `expo install --check` permaneceu
limpo. Na rodada original, build release, instalacao por cima e `monkey`
passaram no Pixel Tablet, Android 15/API 35.

O smoke confirmou:

- create sem/com ponto e persistencia somente no submit;
- captura cancelada e remocao antes do primeiro submit sem persistencia;
- permissao negada, GPS desligado e timeout de 15 segundos como falhas
  recuperaveis, sem bloquear Caderno comum;
- duplo toque e resposta tardia sem segunda operacao, crash, alerta ou draft;
- baixa precisao sem alteracao do valor e sem afirmacao de posicao exata;
- troca de Propriedade descartando draft e troca de Talhao sem inferencia;
- `preserve`, `replace` e `remove`, incluindo cancelamento, desfazer e submit;
- regras de Produtor, Colaborador e Admin, inclusive registro interno do Admin
  invisivel ao Produtor;
- force-stop restaurando somente registros/pontos salvos e sem ressuscitar
  draft, ponto removido ou ultimo ponto global;
- `Mostrar minha posição` somente em state/runtime do mapa, sem alimentar
  Novo Caderno e sem restauracao depois de force-stop;
- GeoJSON local com 15 Talhoes/37 partes, PNG base/local, filtros de Material
  tecnico e Visitas sem ponto, coordenada ou geotag do Caderno;
- ZIP temporario valido selecionado pelo DocumentPicker, importado e reaberto
  depois de `force-stop`, inclusive como Produtor, somente com metadados e sem
  preview, descompactacao, processamento ou localizacao;
- auditoria sem chave nova, objeto bruto persistido, background, tracking,
  watch, trilha, historico ou `localizacao_*` fora do Caderno.

Na 17H.1.2, a fixture `prescricao_smoke_17h112.zip` foi criada fora do
repositorio com 286 B, copiada para `Download` e importada no fluxo real. O
detalhe e a associacao local persistiram apos `force-stop`; o Produtor viu o
item sem acoes de gestao. Mapa, PNG e ZIP permaneceram sem ponto do Caderno, e
a fixture externa foi removida ao final. Assim, `17H111-26` e `17H1B-12`
passaram. Naquela rodada, `17H111-30` e `17H1B-13` ficaram `Reexecutar`, pois
somente `emulator-5554` estava disponivel e Android fisico continuava pendente
e nao aprovado.

Nao houve rebuild ou reinstalacao na 17H.1.2. O APK local e o `base.apk`
instalado tinham os mesmos 91.922.508 bytes e SHA-256
`3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B`,
portanto o release existente foi reutilizado.
O relato completo esta em
`fase-17h-1-1-smoke-seguranca-ponto-caderno.md`.

## Fase 17H.1.3 - Validacao Android Fisico Do Ponto Opcional

Status final em 2026-07-22: `PARCIAL_ANDROID_FISICO`.

O build release confirmou o artefato atual, que foi instalado por cima e
aberto em um aparelho Android fisico autorizado. A abertura, os tres logins locais e as telas funcionais
basicas previstas no roteiro passaram. Tambem passaram permissoes foreground, create sem ponto, permissao negada,
localizacao desligada, GeoJSON, PNG, ZIP, teclado/usabilidade, ausencia de
background e limpeza.

O provider foi acionado tres vezes em ambiente interno, sem ceu razoavelmente
visivel. As tres tentativas terminaram de forma controlada entre
aproximadamente 38 e 53 segundos, sem entregar leitura ou precisao. Nao houve
crash, espera infinita ou grupo parcial, e o Caderno continuou utilizavel sem
ponto. Nenhuma localizacao fisica foi persistida.

Resultado do checklist 17H113:

- `Passou`: `17H113-01`, `17H113-02`, `17H113-03`, `17H113-05`,
  `17H113-09`, `17H113-10`, `17H113-15`, `17H113-16`, `17H113-17`,
  `17H113-18`, `17H113-19` e `17H113-20`;
- `Reexecutar`: `17H113-04`, `17H113-06`, `17H113-07`, `17H113-08`,
  `17H113-11`, `17H113-12`, `17H113-13` e `17H113-14`.

As fixtures sinteticas e nao sensiveis de GeoJSON, PNG e ZIP foram
selecionadas no DocumentPicker, persistiram depois de `force-stop` e foram
consultadas pelo Produtor sem acoes de gestao. Nenhum ponto do Caderno foi
exibido nesses materiais. As associacoes foram removidas pelo fluxo normal do
aplicativo e os temporarios foram apagados ao final.

Como observacao P2, os acessos rapidos do login ficaram apertados e
parcialmente cortados em paisagem no aparelho testado, sem bloquear o fluxo em
retrato. A revisao visual permanece registrada em
`pendencias-de-definicao.md`.

Nao foi criada captura automatica, background, tracking, watch, geofencing,
storage ou chave nova. Nenhum ponto persistido foi desenhado no mapa. A
17H.1.1 permanece `APROVADA_EM_EMULADOR`, com 29/29 casos executaveis no
emulador aprovados; `17H111-30` e `17H1B-13` permanecem `Reexecutar`.

Os oito casos dependentes de leitura real devem ser repetidos em area aberta
ou com ceu razoavelmente visivel. Ate esse fechamento, a Fase 17H.2 nao pode
ser aberta. O relato completo esta em
`fase-17h-1-3-android-fisico-ponto-caderno.md`.

## Atualizacao De Material Tecnico Unificado - 2026-07-22

O contrato canonico para novos anexos locais passou a ser
`docs/project/modelo-material-tecnico.md`. A organizacao visivel espelha
`Propriedade -> Ano -> Fertilidade/Correcao de solo/Prescricao`, sem usar o
caminho de pastas ou o nome do arquivo como relacionamento principal.

Comportamento consolidado para novos anexos:

- um unico fluxo de `Anexar material` aceita PNG, PDF ou ZIP;
- ano e categoria sao obrigatorios;
- nome original e preservado e o titulo e gerado automaticamente;
- Safra/Safrinha e opcional e referencia periodo ativo da mesma Propriedade;
- Fertilidade solicita profundidade e usa escopo da Propriedade;
- Correcao solicita profundidade e permite Propriedade inteira ou Talhao;
- Prescricao nao solicita profundidade, camada ou Talhao;
- `Nao informada` e valor explicito de profundidade quando o acervo nao a
  comprova;
- visibilidade para o Produtor continua explicita;
- arquivo fisico fica no storage interno e o indice
  `@tche:material-tecnico-imports:v1` guarda somente metadados pequenos;
- registros mockados, PNG local e Prescricao ZIP anteriores continuam
  legiveis, sem migracao destrutiva ou duplicacao automatica.

PNG pode abrir como imagem quando o arquivo local existir e a URI for segura.
PDF e ZIP entram no catalogo e no detalhe por metadados; nao ha visualizador
PDF integrado, preview/unzip/processamento de ZIP, backend, upload/download
remoto ou sincronizacao. A consulta sem conexao vale somente para os arquivos
ja presentes no mesmo aparelho e nao deve ser comunicada como offline total.

Esta atualizacao nao reescreve nem invalida a evidencia historica da Fase 17C;
ela descreve a evolucao posterior para novos anexos. GeoJSON/talhoes,
`Mapa.list`, assets da Sela e regras de acesso por Propriedade continuam
preservados.

## Validacao Fisica Complementar De Material Tecnico - 2026-07-23

Status: `PARCIAL_ANDROID_FISICO`.

Um build debug atual foi gerado com `npm run android`, instalado por cima e
aberto em aparelho Android 15/API 35, preservando o estado. Como Admin, o
DocumentPicker real importou fixtures controladas em PNG, PDF e ZIP para a
Sela de Prata I. A interface confirmou nome original, ano, categoria e campos
condicionais: Fertilidade com profundidade nao informada, Correcao de solo
`10-20 cm` no Talhao `T01 - 230` e Prescricao sem campos residuais, com
inferencia apenas informativa de Potassio para `KCL`.

O catalogo agrupou os itens em `Ano 2026` e nas tres categorias. PNG abriu
como imagem; PDF e ZIP mantiveram detalhes honestos, sem falso
preview/processamento. Depois de `force-stop`, a sessao voltou e os arquivos e
metadados de PDF/ZIP permaneceram consultaveis. Os tres itens de teste foram
removidos pela propria interface; somente as fixtures correspondentes
mudaram, o material local anterior permaneceu e os temporarios de `Download`
foram apagados. O processo corrente nao apresentou crash ou excecao fatal no
log.

Esta rodada nao fecha aprovacao de campo nem offline total. Continuam
pendentes os perfis Colaborador/Produtor, limites de formato/tamanho,
Safra/Safrinha, todas as variantes de campos, multiplos anos, rota direta,
rollback, regressao funcional completa e reabertura com a conectividade
explicitamente desligada. O build debug dependeu do servidor de
desenvolvimento para carregar o bundle.

## Proximo Passo Recomendado

Repetir em area aberta ou com ceu razoavelmente visivel os casos
`17H113-04`, `17H113-06`, `17H113-07`, `17H113-08`, `17H113-11`,
`17H113-12`, `17H113-13` e `17H113-14`. A visualizacao de pontos persistidos
no mapa, prevista para a 17H.2, permanece bloqueada. A origem produtiva de
perimetro, fotos reais e os avisos remanescentes do Expo Doctor continuam em
trilhas proprias.

## MP-01 - Politica De Sessao

Status em 2026-07-30: a politica de sessao produtiva foi definida em
`politica-sessao.md`, sem alteracao de codigo.

O contrato inicial usa access token de 15 minutos, refresh token rotativo com
validade absoluta de 30 dias, bloqueio local depois de 15 minutos de
inatividade/background e consulta offline por ate 24 horas desde a ultima
revalidacao. Perfil, status, organizacao e escopo devem ser revalidados na
renovacao, na reconexao e antes de liberar sessao restaurada quando houver
rede. Logout deve limpar e bloquear o estado local imediatamente e revogar a
sessao remota quando possivel.

O estado efetivo do repositorio nao mudou: `AuthContext` ainda restaura o
usuario sanitizado de `@tche:user` sem token, expiracao, revogacao,
revalidacao, janela offline ou bloqueio por inatividade. Esse comportamento
continua local/demonstrativo e nao deve ser descrito como seguranca produtiva.
A implementacao real permanece bloqueada por backend, storage seguro,
autorizacao no servidor e `MP-33`.

## MP-02 - Modelo Territorial E Bloqueio De Autoedicao

Status em 2026-07-30: o contrato territorial canonico foi definido em
`modelo-territorial.md`.

UF/Municipio passaram a representar localizacao oficial, enquanto
Regional/Area operacional representam escopo de trabalho. Localizacao nao
concede acesso. Vinculos operacionais devem ser atribuidos por Admin
autorizado, com justificativa, auditoria e revalidacao futura do escopo.

O motor atual continua inalterado: `sub_regioes` permanece a fonte prioritaria
e `vinculos_microregioes` o fallback; `propriedades_atribuidas` continua
visual/preparatorio. Campos textuais legados nao foram reclassificados nem
migrados.

No corte local, a edicao livre de `regiao` foi removida do Perfil do
Colaborador e a acao de autoedicao passou a recusar campos territoriais. O
Perfil apresenta esses vinculos como consulta legada e orienta solicitar
correcao ao Admin. Backend, IDs mestres, auditoria e seguranca produtiva
permanecem em `MP-35`.

## MP-03 - Contrato De Notificacoes

Status em 2026-07-30: o contrato canonico foi definido em
`contrato-notificacoes.md`, sem alteracao de codigo.

Evento e entrega ao destinatario passaram a ser conceitos distintos. A entrega
futura deve pertencer a usuario e organizacao, referenciar recurso e escopo por
IDs, persistir leitura/descarte e usar chave de deduplicacao. A abertura deve
resolver o destino por allowlist e revalidar a autorizacao no servidor e na
tela de destino.

O estado efetivo continua inalterado: `NotificacaoContext` mantem duas
notificacoes globais em memoria, sem destinatario, organizacao, Propriedade,
Talhao ou recurso navegavel. Leitura e remocao nao persistem e os exemplos
reaparecem. Esse comportamento e demonstrativo e permanece inadequado para
isolamento produtivo.

Backend, banco, cache segregado, persistencia, navegacao segura, push e testes
negativos permanecem em `MP-34`.

## MP-04 - Ciclo De Vida Do Caderno

Status em 2026-07-30: o ciclo canonico foi definido em
`ciclo-vida-caderno.md`, sem alteracao de codigo.

Rascunho e editavel somente pelo criador. O envio consolida um snapshot
original imutavel. Complemento, correcao, visibilidade, arquivamento,
reativacao e anulacao passam a ser eventos auditados, com controle de versao e
sem exclusao destrutiva. Propriedade, autoria e origem nunca sao reatribuidas.

O estado efetivo continua inalterado: o mock nao possui estado explicito e
`CadernoCampo.update` ainda substitui o registro. Admin/Colaborador continuam
vendo a tela de edicao completa e nao existe trilha, evento append-only ou
controle de concorrencia. Registros atuais devem ser tratados como
consolidados na migracao, sem inventar historico.

Implementacao do ciclo, obrigatorios por tipo e protecoes locais permanecem em
`MP-25`. Banco imutavel, autorizacao e concorrencia produtiva permanecem em
`MP-36`.

## MP-05 - Estados De Visita

Status em 2026-07-30: a maquina de estados canonica foi definida em
`estados-visita.md`, sem alteracao de codigo.

Visita pode nascer agendada ou ser registrada diretamente como realizada pelo
fluxo de conclusao. Agendada pode ser reagendada, concluida ou cancelada.
Realizada nao regride e somente recebe complemento, correcao ou anulacao.
Cancelada fica somente leitura e pode originar nova Visita vinculada. Atraso e
indicador derivado, sem transicao automatica.

O estado efetivo continua inalterado: `EditarVisitaScreen` oferece os tres
status livremente, `Visita.update` nao valida transicao, conclusao no detalhe e
imediata, cancelamento nao persiste motivo e Admin ainda pode excluir o
registro. Nao existe historico ou controle de concorrencia.

Implementacao no dominio/interface permanece em `MP-27`; a organizacao visual
da lista permanece em `MP-22`. Validacao e autorizacao produtivas dependem do
backend.

## MP-06 - Contrato De Versao Do GeoJSON

Status em 2026-07-30: o contrato canonico foi definido em
`versionamento-geojson-talhoes.md`, sem alteracao de codigo.

Talhao logico, importacao, versao geometrica e linhagem passaram a ser
conceitos separados. `talhao_id` e estavel; nome, codigo, indice, ordem e
geometria nao definem identidade. Cada arquivo produtivo deve gerar importacao
imutavel com original, checksum, vigencia e auditoria.

O fluxo aprovado e rascunho, revisao, publicacao e arquivamento. Publicar exige
reconciliacao de mantidos, renomeados, alterados, novos, ausentes, divisoes,
fusoes e ambiguidades. Renome preserva identidade, mudanca de contorno cria
nova geometria, e divisao/fusao preservam predecessores e sucessores. Versao
publicada anterior nunca e apagada automaticamente.

O estado efetivo continua inalterado: `GeoJsonImportService` mantem um item
`ativo` por Propriedade; `GeoJsonPropertyManageWorkflow` tenta apagar o
arquivo anterior; `GeoJsonTalhoesLayerService` le somente o ativo; e o
validador gera IDs a partir de Propriedade, indice e nome. `versao = 1`
continua sendo versao do schema local, nao da demarcacao.

IDs estaveis e migracao dos vinculos textuais permanecem em `MP-24`;
persistencia, storage, reconciliacao, publicacao, historico e cache em
`MP-37`; regressao de renome, area, divisao, fusao e restauracao em `MP-39`.

## MP-07 - Login Responsivo

Status em 2026-07-30: `PARCIAL`.

`LoginScreen` passou a usar safe area e uma unica `ScrollView`. No Android, o
layout depende somente do `adjustResize` nativo, sem uma segunda reducao de
altura pelo `KeyboardAvoidingView`. O campo focado e reposicionado sobre o
teclado e as mudancas de largura/altura recalculam a rolagem.

Retrato, paisagem e teclado usam espacamento e marca compactos quando a altura
e reduzida. Os acessos rapidos mantem largura integral em retrato e tres
colunas explicitas em paisagem, inclusive quando a orientacao muda com o bloco
ja expandido. Autenticacao, sessao, credenciais, perfis e textos funcionais
nao foram alterados.

Typecheck, `test:domain-compat` e `assembleRelease` passaram. O APK release foi
instalado via `adb` no Android fisico. O smoke passou em retrato com teclado
aberto/fechado, em paisagem com teclado fechado, na rolagem e na sequencia
retrato -> paisagem -> retrato.

O Gboard testado ignorou `IME_FLAG_NO_FULLSCREEN`, enviado pelos dois campos,
e abriu editor de extracao em tela cheia na paisagem. Falta repetir somente o
aceite visual com um IME/aparelho que permita teclado inline. Evidencias:
`dist/qa-session-2026-07-30/mp-07-login-responsivo/`.

## MP-08 - Semantica Do X Nos Filtros

Status em 2026-07-30: `CONCLUIDO`.

Os filtros de Propriedades e Visitas passaram a separar estado aplicado de
rascunho. Ao abrir o modal, o rascunho recebe uma copia dos filtros aplicados.
Alteracoes feitas no modal nao mudam badge, chips nem lista ate a acao
`Aplicar Filtros`.

X, toque no backdrop e botao Voltar do Android fecham o modal descartando o
rascunho. `Limpar Filtros` limpa somente o rascunho; para remover os filtros
da lista e necessario confirmar com `Aplicar Filtros`. Os chips externos
continuam removendo filtros ja aplicados de forma direta.

Typecheck, `test:domain-compat`, `git diff --check` e `assembleRelease`
passaram. O APK release foi instalado no Android fisico e o smoke confirmou
cancelamento, aplicacao e limpeza nos dois fluxos. Evidencias:
`dist/qa-session-2026-07-30/mp-08-filtros-rascunho/`.

Componente comum, bottom sheet e gesto real de arraste foram entregues em
`MP-09`.

## MP-09 - Componente Padrao De Filtros

Status em 2026-07-30: `CONCLUIDO`.

`FilterBottomSheet` passou a concentrar backdrop, animacao, safe area,
cabecalho, conteudo rolavel, X, Limpar, Aplicar, botao Voltar do Android e
arraste real para baixo. O mesmo modulo oferece o acionador com badge, secoes
de conteudo e a faixa rolavel de chips ativos.

Propriedades e Visitas preservam os filtros e a separacao entre aplicado e
rascunho criada na `MP-08`. Usuarios moveu o filtro de perfil para a folha
padrao. Caderno passou a filtrar pelos tipos de atividade ja presentes nos
registros. Materiais moveu categoria e ordenacao para a folha padrao.

O filtro abre dispensando o teclado e `SegmentedChips` executa a selecao no
mesmo toque que fecha o teclado. X, backdrop, Voltar e arraste descartam o
rascunho; Limpar somente altera o resultado depois de Aplicar. Badge e chips
externos refletem apenas o estado aplicado.

Typecheck, `test:domain-compat`, `git diff --check` e `assembleRelease`
passaram. O smoke no Android fisico cobriu as cinco telas, teclado, retrato,
paisagem e os caminhos de cancelamento/aplicacao. Evidencias:
`dist/qa-session-2026-07-30/mp-09-filtros-padrao/`.

A reorganizacao funcional dos filtros de contexto de Materiais permanece em
`MP-17`. `MP-10` foi concluida depois deste corte; `MP-17` nao foi iniciada.

## MP-10 - Cabecalhos E Retorno

Status em 2026-07-30: `CONCLUIDO`.

O `Header` comum passou a oferecer um unico contrato `showBack`. A seta tem
rotulo e dica de acessibilidade, area de toque ampliada e executa o `onBack`
especifico quando fornecido ou `navigation.goBack()` nos demais fluxos. O
alias duplicado `showBackButton` foi removido e seus usos foram migrados.

Todas as rotas internas do native stack agora possuem retorno superior. O
detalhe da Propriedade exibe a seta tambem em carregamento, erro ou acesso
negado; Notificacoes exibe retorno e nao oferece atalho para empilhar outra
copia da propria tela; autoedicao exibe retorno nos dois estados de perfil. O
mapa de limites preserva seu cabecalho proprio, que ja oferecia retorno nos
estados normal, carregando, erro e bloqueio. As telas-raiz das abas continuam
exibindo a marca sem seta.

O retorno superior e o botao Android usam o historico do native stack, sem
reset ou navegacao para uma rota substituta. Assim a instancia anterior
permanece montada. No smoke fisico foram preservados o filtro `Pendente`, a
busca `S`, a aba `Caderno` e o contexto do `Sitio Esperanca`, tanto pela seta
quanto pelo botao do sistema.

O teste `navigationHeaderCompat.test.js` audita o contrato comum, todos os
estados de `Header` das telas internas, as telas-raiz sem seta, o cabecalho
proprio do mapa e as 18 rotas internas. Typecheck, `test:domain-compat`,
`git diff --check` e `assembleRelease` passaram. O APK release foi instalado
via `adb`; o smoke passou em retrato e paisagem. Evidencias:
`dist/qa-session-2026-07-30/mp-10-cabecalhos-retorno/`.

Arquitetura de informacao da Propriedade permanece em `MP-15` e filtros de
Materiais em `MP-17`. `MP-11` foi executada na sequencia.

## MP-11 - Contraste E Opacidade

Status em 2026-07-30: `CONCLUIDO`.

O tema agora define pares semanticos explicitos de superficie, texto e borda
para estados primario, sucesso, aviso, informacao, erro e desabilitado. Os
tokens de primeiro plano relevantes atendem 4,5:1 para texto normal; icones e
bordas essenciais atendem 3:1. `primaryLight` passou a ser uma superficie
clara, enquanto `primary` permanece como primeiro plano.

Os exemplos `Registrado pelo produtor` e `Ver mais 2 materiais`, as caixas
informativas e os status de Usuarios usam esses pares. Controles reutilizaveis
de formulario, selecao, confirmacao, data, chips, radio e localizacao deixaram
de aplicar opacidade ao componente inteiro quando desabilitados; eles usam
superficie, texto e borda especificos.

O teste `themeContrastCompat.test.js` calcula os contrastes diretamente dos
tokens e audita os contratos semanticos e os estados desabilitados. Typecheck,
`test:domain-compat`, `git diff --check` e `assembleRelease` passaram. O APK
release foi instalado via `adb`; o smoke passou em retrato e paisagem no
Dashboard, status de Usuarios, estado desabilitado, busca com teclado e
materiais da Sela de Prata. Evidencias:
`dist/qa-session-2026-07-30/mp-11-contraste-opacidade/`.

O sistema de cartoes permanece em `MP-21` e a matriz completa de
acessibilidade em `MP-40`. `MP-12` foi executada na sequencia.

## MP-12 - Linguagem E Formatacao

Status em 2026-07-30: `CONCLUIDO`.

O objetivo interno `coleta_solo` preserva seu valor de dominio e usa
`Coleta de Solo` como rotulo publico centralizado em lista, detalhe, criacao e
edicao de Visitas. Areas exibidas em Dashboard, Propriedades e Caderno usam o
formatador brasileiro compartilhado, sem abreviacao em `k`.

Materiais tecnicos passaram a separar a apresentacao publica do detalhe
tecnico. Cartoes mostram titulo legivel, camada ou elemento, profundidade,
data, safra, escopo, Propriedade e versao. Codigos de fixture e nomes de
arquivo nao aparecem na listagem; o nome original fica restrito ao detalhe do
anexo. Os cinco anexos Sela persistidos antes do campo `versao` recebem
compatibilidade visual `v1`, sem alterar outros materiais sem versao.

Testes focados, typecheck, `test:domain-compat`, `git diff --check` e
`assembleRelease` passaram. O APK release foi instalado via `adb`; o smoke
fisico passou em retrato e paisagem para areas, Visitas e materiais da Fazenda
Sela de Prata I. Evidencias:
`dist/qa-session-2026-07-30/mp-12-linguagem-formatacao/`.

Filtros de Materiais permanecem em `MP-17` e o sistema de cartoes em `MP-21`.
`MP-13` nao foi iniciada.
