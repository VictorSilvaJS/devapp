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
- `MapasScreen.tsx` usa nomenclatura visual padronizada para a area de materiais, incluindo `Anexos de fertilidade`, `Anexo de fertilidade PNG`, `Mapa de fertilidade`, `Material tecnico` e `Abrir anexo`
- `MapasScreen.tsx` exibe metadados de elemento, safra, talhao/propriedade inteira, profundidade e nome original quando esses dados existem, usando campos futuros com fallback para campos legados
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

## O Que Ainda E Mock, Parcial Ou Incompleto

- autenticacao real
- backend real
- banco real, migrations e API real
- criacao real de login a partir do cadastro administrativo de usuario
- senha real, convite, reset de senha e sessao real
- RBAC/permissoes granulares completas
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
- `EditarProdutorScreen`
- `NovoProdutorScreen`
- `ProdutorScreen`
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
- vinculos visuais de colaborador ainda nao alteram o motor efetivo de permissoes
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
- vinculos visuais ainda nao alteram o motor efetivo de permissoes
- `acessoControle` nao foi migrado

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
- migracao do `acessoControle`

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

- os vinculos visuais de colaborador ainda nao alteram o motor efetivo de permissoes
- `acessoControle` nao foi migrado
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
- migracao do `acessoControle`

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
- a interface visivel favorece `Propriedades`, preservando nomes internos legados como rotas, arquivos, `fazenda`, `fazendaId` e `fazenda_id`
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

O mapa interativo da propriedade usa apenas talhoes/limites vindos de `LimiteArea`, alimentados pelo GeoJSON normalizado de `src/assets/geojson/selaDePrata1Talhoes.ts`, derivado de `data/processados/p_sela1/2025/limites_talhoes.geojson`.

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
