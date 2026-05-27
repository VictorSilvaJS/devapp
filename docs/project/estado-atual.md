# Estado Atual do Projeto

Este documento descreve o estado atual do repositorio e do sistema como eles existem hoje. Seu foco e registrar o retrato presente da base, sem substituir documentos especificos de contexto, escopo, regras, decisoes ou pendencias.

Quando houver conflito entre documentos antigos e o codigo, priorize este arquivo e o proprio codigo-fonte para entender o que esta efetivamente no repositorio atual.

## Convencao Oficial de Linguagem

Na linguagem de produto, o termo oficial para a unidade operacional vista pelo usuario e `Propriedade`.

Termos consolidados:

- `Produtor`: usuario/perfil final que consulta sua realidade operacional.
- `Titular`: responsavel cadastral ou vinculo principal da propriedade.
- `Talhao`: subdivisao interna da propriedade.

No codigo legado e na documentacao tecnica, nomes como `fazenda`, `fazenda_id`, `getFazendaId`, rotas, arquivos, contratos e campos internos permanecem temporariamente por compatibilidade. Alias historicos como `cliente` e `proprietario` aparecem apenas quando ajudam a explicar inconsistencias ainda existentes no codigo, nos mocks ou em documentos antigos.

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

- `src/auth/authMock.ts` faz login mock e acesso rapido de desenvolvimento
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
- `MapasScreen.tsx` exibe a profundidade quando informada e pode abrir os PNGs internos da amostra da propriedade Sela de Prata I como imagem/anexo
- `src/services/MapaSincronizacaoService.ts` e `src/services/MapaCacheService.ts` ainda estao incompletos

## O Que Ja Funciona

- navegacao por perfil com tabs diferentes para `admin`, `colaborador` e `produtor`
- login mock com persistencia local
- CRUD em memoria para produtores, visitas, caderno e mapas
- filtros regionais via `FiltroContext`
- fluxo principal de visitas com listagem, criacao, edicao e detalhe
- frente funcional de `Produtor` / `Propriedade` concluida no nivel necessario para o MVP atual, embora codigo e rotas ainda usem nomes tecnicos legados de fazenda
- frente funcional de visitas tecnicas por propriedade e caderno de campo por propriedade validada no nivel necessario para o MVP atual
- fluxo completo do produtor validado no MVP visual/mockado apos a padronizacao da nomenclatura visivel para `Propriedade`
- visualizacao de panorama/mapas e detalhe de propriedade
- mapa base dos talhoes da propriedade Sela de Prata I a partir de `LimiteArea`/GeoJSON normalizado
- clique/toque em talhao no mapa base, com exibicao do nome/codigo e detalhes do talhao
- registros mockados de `Mapa` para uma amostra pequena de PNGs de fertilidade da propriedade Sela de Prata I
- exibicao de profundidade em materiais de mapa quando o campo opcional estiver preenchido

## O Que Ainda E Mock, Parcial Ou Incompleto

- autenticacao real
- backend real
- upload real de arquivos
- cadastro administrativo real de PNGs ou outros anexos tecnicos
- salvamento persistente de anexos em banco, storage local gerenciado ou storage remoto
- API/backend para anexos de mapas
- importacao automatica dos arquivos da pasta de origem
- gestao completa do acervo de arquivos tecnicos
- notificacoes push reais
- sincronizacao offline de verdade
- download real de mapas
- suite de testes automatizados integrada ao projeto

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

O mapa interativo da propriedade usa apenas talhoes/limites vindos de `LimiteArea`, alimentados pelo GeoJSON normalizado de `src/assets/geojson/selaDePrata1Talhoes.ts`, derivado de `data/processados/p_sela1/2025/limites_talhoes.geojson`.

Os mapas de elementos de fertilidade sao registros mockados da entidade `Mapa`. Na amostra atual, os PNGs ficam como anexos visuais internos do app em `src/assets/mapas/sela-prata-i/2025/fertilidade/`. Esses PNGs nao sao camadas georreferenciadas e nao sao sobrepostos ao mapa. Eles devem ser tratados apenas como imagens/anexos para consulta.

Nao existe ainda:

- upload real de arquivo pelo admin ou colaborador
- cadastro administrativo persistente de PNG/anexo
- persistencia real em banco ou storage
- API/backend para anexos
- pipeline de importacao automatica
- leitura/importacao de todos os arquivos da pasta `PANORAMA-DAS-LAVOURAS`
- gestao completa de versoes, liberacao, historico ou revisao do acervo

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
