# Pendencias de Definicao

Este documento lista pontos reais ainda abertos no projeto. Seu papel e registrar o que precisa de definicao adicional sem transformar o tema em backlog automatico, decisao consolidada ou hipotese solta.

## Como Usar Este Documento

- Use este arquivo para identificar o que ainda precisa ser fechado antes de estabilizar dominio, contratos e regras.
- Se um ponto ja estiver decidido, ele deve ir para `decisoes-consolidadas.md`, nao permanecer aqui.
- Se um ponto for apenas possibilidade futura sem necessidade atual, ele deve permanecer fora deste documento.

## Pendencias de Dominio

### 1. Limpeza tecnica futura da nomenclatura interna

A nomenclatura de produto foi consolidada em `decisoes-consolidadas.md`: `Propriedade`, `Produtor`, `Titular` e `Talhao` sao os termos oficiais de superficie.

Nao permanece pendente a definicao da linguagem de produto. O que ainda fica para uma fase futura separada e a limpeza tecnica interna de nomes legados como `fazenda`, `fazenda_id`, `getFazendaId`, rotas, arquivos, contratos e campos internos, caso o projeto decida reduzir essa compatibilidade.

Termos tecnicos legados atualmente permitidos por compatibilidade incluem `fazenda_id`, `fazendaId`, `fazenda_nome`, `fazendaNome`, `produtor_id`, `proprietario_id`, `produtor_nome`, `FazendaMapa`, `FazendaMapaScreen`, `MapaFazendaView`, `getFazenda*`, `fazendaUiCompat`, `fazendaCadastroCompat`, `FazendaCanonica` e `FazendaLegada`.

Esses termos permanecem porque ainda estao ligados a rotas, mocks, contratos, helpers de compatibilidade, filtros, visitas, caderno, mapas e regras de acesso. Uma migracao tecnica deve planejar leitura dupla quando necessario, preferindo `propriedade_id` para modelos novos sem remover `fazenda_id` antes de validar todos os fluxos afetados.

Status em 2026-06-03: foi criada compatibilidade dupla aditiva para
Propriedade/Titular. Os helpers centrais ficam em
`src/utils/propriedadeCompat.ts`, e os helpers `fazendaUiCompat.ts`,
`filtroCompat.ts`, `usuarioAdminCompat.ts`, `visitaFormCompat.ts` e
`cadernoFormCompat.ts` ja usam esses resolvers em leituras de borda. Os 11
registros estaticos de produtores/propriedades do mock foram enriquecidos com
`propriedade_id`, `propriedadeId`, `propriedade_nome`, `propriedadeNome`,
`titular_id`, `titularId` e `titular_nome`; `src/api/produtorCompat.ts`
preserva e emite esses aliases em leitura e persistencia mockada. Essa etapa
nao remove legado, nao altera contratos, nao altera payloads de visita/caderno
e nao fecha a migracao real de backend.

**Por que importa**

- evita refatoracao ampla e arriscada durante o MVP
- preserva compatibilidade com fluxos e contratos existentes
- separa decisao de linguagem de produto de renomeacao tecnica interna
- reduz risco de quebrar navegacao, permissoes, filtros e dados mockados

**Pendencia futura**

- planejar migracao tecnica controlada de `fazenda_id` para `propriedade_id`
- avaliar `acessoControle.ts` e o motor de permissoes antes de qualquer remocao de legado
- manter documentada a regra efetiva atual: Admin ve todas as Propriedades,
  Produtor ve por vinculo titular/produtor compativel e Colaborador ve por
  `sub_regioes` com fallback para `vinculos_microregioes`
- avaliar `propriedades_atribuidas` apenas como decisao futura de RBAC por
  propriedade, nao como regra efetiva do MVP mockado
- avaliar `usuario_propriedade`
- planejar migracao real de contrato/backend
- testar fluxos de produtor, colaborador, admin, mapas, visitas, caderno e filtros antes de remover legado
- remover legado somente em fase futura, depois de backend, contratos e testes
- manter `fazenda*` apenas para compatibilidade existente ate a migracao estar validada

### 2. Contratos centrais do dominio

Ainda falta fechar a forma final de alguns contratos que hoje aparecem com variacoes no repositorio e na documentacao, como:

- nomes de campos pessoais e cadastrais
- contratos de disponibilidade de download
- relacao entre produtor, propriedade e identificadores tecnicos associados, incluindo `fazenda_id` enquanto a compatibilidade for mantida

**Por que importa**

Esse fechamento e base da Fase 2 e reduz ambiguidade entre schemas, mocks, telas e regras.

## Pendencias Funcionais

### 3. Escopo final do caderno de campo

O caderno ja esta definido como modulo enxuto e operacional, mas ainda faltam definicoes sobre:

- campos minimos obrigatorios
- campos opcionais
- nivel de detalhe esperado
- criterios de visibilidade por perfil

Status em 2026-07-03 (Fase 17D): o MVP demonstravel passou a ter um corte
operacional mais claro para Caderno de Campo: Produtor fica somente leitura e
ve apenas registros liberados, Admin/Colaborador mantem criacao e edicao
local/mockada, e telas de listagem, detalhe, novo e editar exibem Propriedade,
Talhao, data, tipo, responsavel, visibilidade e observacao. Registros legados
sem Talhao ou sem visibilidade explicita continuam compatíveis. A pendencia
permanece aberta porque isso nao fecha a modelagem final do Caderno,
backend/RBAC real, matriz completa de permissoes por acao, storage/sync,
auditoria, nem a validacao completa desta frente. O smoke parcial em emulador
foi executado para o perfil Produtor; permanecem pendentes ampliar o smoke para
Admin/Colaborador e validar em Android fisico.

Status em 2026-07-06 (Fase 17D.2): a regra funcional foi corrigida para
permitir que Produtor tambem registre Caderno de Campo na propria Propriedade,
sempre com visibilidade para ele e para a equipe autorizada. Admin/Colaborador
mantem criacao/edicao local conforme escopo e registros internos continuam
podendo ficar ocultos do Produtor. A pendencia permanece aberta porque a edicao
de registro proprio pelo Produtor, remocao, auditoria, aprovacao, backend/RBAC
real, sync e validacao em Android fisico ainda nao foram fechados.

Status em 2026-07-06 (Fase 17D.3): o smoke completo do Caderno de Campo foi
executado em emulador Android para Produtor, Admin e Colaborador. Foram
validados: Produtor criando registro na propria Propriedade sem poder editar ou
remover; Admin vendo o registro do Produtor e criando registro interno; Produtor
nao vendo registro interno; Colaborador vendo registros do escopo e criando
registro na Propriedade Sela de Prata I. A pendencia permanece aberta para
fechar modelagem final, edicao/remocao pelo Produtor se for desejado,
auditoria, aprovacao, backend/RBAC real, sync e validacao em Android fisico.

Status em 2026-07-07 (Fase 17D.4): a validacao em Android fisico foi iniciada,
mas ficou bloqueada porque `adb devices -l` mostrou apenas o emulador
`emulator-5554` (`Pixel_Tablet`) e nenhum aparelho fisico autorizado com status
`device`. As validacoes automatizadas e o build release passaram, mas a
instalacao e o smoke manual em Android fisico nao foram executados. Android
fisico segue pendente e nao aprovado.

Status em 2026-07-08 (Fase 17E): Safra/Safrinha foi implementada apenas como
organizacao local e opcional por Propriedade, com metadados pequenos em
`@tche:periodos-produtivos:v1` e vinculo opcional no Caderno de Campo.
Admin/Colaborador autorizado podem criar/editar periodos locais; Produtor
consulta e pode vincular ao registrar Caderno, mas nao gerencia periodos. A
pendencia permanece aberta porque ainda nao ha modelagem final de periodo
produtivo, backend/RBAC real, sync, auditoria, regras completas de
encerramento/remocao, nem validacao em Android fisico.

Status em 2026-07-08 (Fase 17E.1): o smoke em emulador validou a criacao,
edicao, consulta e persistencia local de Safra/Safrinha na Sela de Prata I
usando Colaborador autorizado e Produtor em modo consulta. Tambem foi validado
o vinculo opcional no Caderno pelo Colaborador, incluindo remocao do vinculo
sem trocar a Propriedade. A pendencia permanece aberta para repetir Admin de
forma manual, registrar Caderno pelo Produtor com vinculo de periodo,
revalidar PNG/ZIP individualmente e executar a rodada completa em Android
fisico autorizado.

Status em 2026-07-08 (Fase 17F): Talhao passou a funcionar como centro de
consulta local dentro da Propriedade, reunindo periodos, Caderno e materiais
relacionados sem persistir coordenadas ou criar nova modelagem produtiva.
Caderno criado pelo contexto de Talhao preserva Propriedade travada e aliases
de Talhao quando existirem. A pendencia permanece aberta porque o detalhe final
do Caderno, regras de edicao/remocao pelo Produtor, auditoria, aprovacao,
backend/RBAC real, sync e validacao visual completa em emulador/Android fisico
ainda nao foram fechados.

Status em 2026-07-09 (Fase 17F.1): o smoke visual em emulador validou para
Produtor a entrada por Propriedade/Talhao, o modal do Talhao, a consulta de
Safra/Safrinha sem criacao de periodo e a abertura de Novo Caderno com
Propriedade travada e Talhao preenchido. A pendencia permanece aberta para
submissao visual completa do Caderno pelo Talhao, repeticao com
Colaborador/Admin, reabertura individual de PNG/ZIP e validacao em Android
fisico autorizado.

Status em 2026-07-09 (Fase 17F.2): o ambiente do emulador foi corrigido e o
APK release atual foi instalado. O smoke em emulador fechou o fluxo principal
do Produtor registrando Caderno pelo Talhao `T01 - 230` e validou a consulta
do Colaborador dentro do escopo da Sela de Prata I. A pendencia permanece
aberta para criacao de Caderno pelo Talhao como Colaborador, validacao manual
de Admin, reabertura individual de PNG/ZIP apos recriar imports locais e
validacao em Android fisico autorizado.

### 4. Taxonomia final de mapas

Mapas e arquivos sao parte central do produto, mas a classificacao final ainda precisa de consolidacao adicional, especialmente em temas como:

- categorias base
- tratamento de panorama
- recorte temporal por safra, ano ou periodo

O corte atual do MVP ja define que limite/shape e camada tecnica de demarcacao dentro do panorama da propriedade, nao uma experiencia separada para o usuario. Tambem ja define, para a primeira versao de testes, que os materiais tecnicos liberaveis devem ser organizados por propriedade, campo/talhao, recorte temporal e elemento/camada quando aplicavel, priorizando diagnosticos como fertilidade por argila, fosforo, pH, potassio e materia organica.

Status em 2026-07-01: a taxonomia operacional inicial da interface foi
orientada para tres tipos principais de mapas: fertilidade, correcao de solo e
prescricao, com filtros principais restritos a esses tres tipos. Na Fase 17C,
Prescricao passou a ter fluxo local demonstrativo por ZIP, com metadados em
AsyncStorage e arquivo copiado para storage interno do app, sem processamento
do conteudo. Permanece pendente a taxonomia final alem desse corte inicial, os
nomes finais de todos os elementos/camadas, a forma de evoluir panoramas alem
da demarcacao basica e o fluxo produtivo para revisar, publicar, sincronizar e
servir arquivos ZIP de prescricao por backend/storage real.

Status em 2026-07-03: a rodada 17C.1 aprovou em emulador o corte operacional
inicial de `Material tecnico` com Fertilidade, Correcao de solo e Prescricao,
incluindo PNG local restrito a Fertilidade/Correcao de solo, ZIP de prescricao
como pacote de detalhe sem preview de imagem e consulta do Produtor sem acoes
administrativas. A pendencia permanece aberta para taxonomia final, pipeline
produtivo, backend/storage real, publicacao/sync e validacao em Android fisico.

Status em 2026-07-07 (Fase 17D.4): a validacao fisica de `Material tecnico`,
DocumentPicker real, PNG, ZIP de Prescricao e GeoJSON/talhoes permaneceu
bloqueada pela ausencia de Android fisico autorizado no `adb`. A cobertura
automatizada de compatibilidade continuou passando e o APK release foi gerado,
mas isso nao substitui o smoke no aparelho.

Status em 2026-07-08 (Fase 17E): o recorte temporal por Safra/Safrinha entrou
como metadado local opcional separado de mapas e arquivos tecnicos. Isso nao
fecha a taxonomia final de mapas nem o pipeline produtivo; PNG, ZIP e GeoJSON
continuam com seus storages/chaves proprias e sem conteudo bruto em
AsyncStorage.

Status em 2026-07-08 (Fase 17E.1): durante o smoke em emulador, `Material
tecnico` abriu no contexto da Sela de Prata I, os materiais base de
fertilidade/PNG permaneceram listados e GeoJSON/talhoes foram renderizados. A
reabertura individual de anexos PNG e do detalhe de ZIP de Prescricao nao foi
repetida nesta rodada e deve continuar no roteiro de Android fisico.

Status em 2026-07-08 (Fase 17F): o detalhe do Talhao passou a separar
materiais especificos do Talhao e materiais de Propriedade inteira, mantendo
os tres tipos principais da taxonomia atual: Fertilidade, Correcao de solo e
Prescricao. Isso nao fecha a taxonomia final, nao cria georreferenciamento de
PNG, nao processa ZIP e nao altera o pipeline produtivo de mapas/arquivos.

Status em 2026-07-09 (Fase 17F.1): o panorama do Material tecnico e o mapa
local dos Talhoes foram reabertos no emulador como Produtor, com GeoJSON local
ativo e Talhoes renderizados. PNG e ZIP individuais nao foram reabertos nesta
rodada e seguem no roteiro de repeticao.

Status em 2026-07-09 (Fase 17F.2): apos a correcao de espaco do emulador, o
estado local do app foi reiniciado. O Material tecnico abriu novamente na Sela
de Prata I, com filtros de Demarcacao, Talhao e Safra e estado vazio de
GeoJSON local. Isso nao invalida as aprovacoes anteriores de GeoJSON/PNG/ZIP,
mas exige recriar imports locais para repetir a reabertura individual de PNG e
ZIP. Android fisico segue pendente e nao aprovado.

Status em 2026-07-22: o corte operacional para novos anexos locais foi
consolidado em `modelo-material-tecnico.md`: navegacao por
`Propriedade -> Ano -> Fertilidade/Correcao de solo/Prescricao`, fluxo
unificado para PNG/PDF/ZIP, nome original preservado, titulo automatico,
periodo produtivo opcional e campos condicionais por categoria. Os contratos
PNG e ZIP anteriores permanecem legiveis. Isso fecha a organizacao minima do
MVP local, mas nao fecha taxonomia agronomica final, elementos/subcategorias,
agrupamento de varias representacoes, pipeline produtivo, backend ou sync.

Status em 2026-07-23: uma rodada complementar em Android fisico 15/API 35
validou parcialmente, como Admin, o DocumentPicker real, cadastro e abertura
de PNG/PDF/ZIP, organizacao por ano/categoria, campos condicionais,
persistencia apos `force-stop` e remocao isolada das fixtures. O material
anterior permaneceu e nao houve crash fatal. A pendencia fisica fica reduzida,
mas continua aberta para Colaborador/Produtor, entradas invalidas/limites,
periodo produtivo, variantes restantes, multiplos anos, regressao completa e
offline com conectividade explicitamente desligada. Backend/storage remoto,
publicacao, download e sync continuam nao implementados.

### 4A. Localizacao em tempo real sobre Talhoes

A localizacao em tempo real existe apenas em corte minimo foreground sobre o
mapa de Talhoes. Ela nao deve ser tratada como funcionalidade de campo
aprovada ate haver smoke em Android fisico autorizado e fechamento de
plataformas.

Status em 2026-07-09 (Fase 17G.0): foi criada a analise tecnica
`docs/project/fase-17g-localizacao-tempo-real.md`. A recomendacao para uma
fase futura 17G.1 e implementar a localizacao minima sobre
`FazendaMapaScreen`/`MapaFazendaView`, mantendo WebView/Leaflet, permissao
foreground only, estado efemero em memoria e ausencia total de persistencia de
coordenadas do usuario. Naquele momento, `expo-location` nao estava instalado
e deveria depender de aprovacao explicita posterior. `react-native-maps`
existe no projeto, mas `MapaFazendaNativoView` permanece experimento historico
fora do fluxo ativo.

Pontos que seguem pendentes apos a implementacao minima:

- dependencia de localizacao usada na fase 17G.1: `expo-location@~56.0.20`;
- permissao foreground only, sem background;
- garantia de nao persistir coordenadas, trilha, rota ou historico;
- teste em Android fisico autorizado;
- criterio para iOS ou registro formal de iOS pendente;
- comportamento quando WebView/Leaflet cair no fallback SVG;
- confirmacao de que PNG e ZIP continuam materiais nao georreferenciados;
- confirmacao de que nao havera backend, sync, upload, download real ou
  storage remoto.

Status em 2026-07-09 (Fase 17G.1): foi implementado o botao `Mostrar minha
posicao` em `FazendaMapaScreen`, usando permissao foreground sob demanda,
leitura unica atual e estado React efemero. `MapaFazendaView` exibe marcador e
circulo de precisao apenas no Leaflet/WebView; o fallback SVG informa que a
posicao do aparelho esta disponivel somente no mapa interativo. Nao ha
background location, TaskManager, watch continuo, geofencing, trilha,
historico, rota, ultimo ponto persistido, chave nova de storage, coordenada no
Caderno, backend, sync, upload, download real ou storage remoto. PNG e ZIP
continuam materiais nao georreferenciados. A build release foi instalada e
aberta em emulador, e o pacote instalado confirmou permissoes foreground
`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`, sem background. A pendencia
permanece aberta porque o smoke visual de botao/marcador/permissao ainda deve
ser repetido com GeoJSON local disponivel, alem de Android fisico autorizado,
criterio de iOS, precisao/consumo em campo e eventual politica futura de
offline/mapa-base.

Status em 2026-07-10 (Fase 17G.2): o smoke visual de botao, permissao concedida,
permissao negada, servicos de localizacao desligados, marcador e nao
restauracao apos `force-stop` foi executado em emulador sobre a camada de
Talhoes seed/mock da Sela de Prata I. A auditoria confirmou ausencia de
AsyncStorage, chave nova, watch continuo, TaskManager, background location,
geofencing, historico, rota ou coordenada nova no Caderno. A pendencia continua
aberta para reexecutar GeoJSON local via DocumentPicker nesta frente, forcar o
fallback SVG/WebView, definir criterio de iOS, validar precisao/consumo em
campo e executar Android fisico autorizado. Android fisico segue pendente e nao
aprovado.

Status em 2026-07-10 (Fase 17G.3): o GeoJSON local foi reanexado pelo
DocumentPicker na Sela de Prata I e permaneceu ativo com 15 Talhoes/37 partes.
A localizacao foreground apareceu no Leaflet sobre a camada local com precisao
simulada de 8 m, o Talhao continuou clicavel e a posicao nao foi restaurada
depois de `force-stop`, embora o GeoJSON tenha persistido. PNG local e ZIP de
Prescricao foram reanexados/reabertos sem localizacao, georreferenciamento,
preview de ZIP, unzip ou processamento; Caderno preservou Propriedade/Talhao
sem coordenadas; Produtor continuou sem acoes administrativas; permissao
negada e localizacao desligada passaram novamente. A auditoria manteve
foreground only, sem AsyncStorage de coordenadas, chave nova, watch continuo,
TaskManager, background, geofencing, trilha, historico, rota ou geotag. A
pendencia permanece aberta apenas para forcar o fallback SVG/WebView de forma
segura, definir criterio de iOS, validar precisao/consumo em campo e executar
Android fisico autorizado. Android fisico segue pendente e nao aprovado.

Status em 2026-07-21 (Fase 17H.0.2): ficou consolidado que desenvolvimento e
smoke tecnico podem continuar em emulador, enquanto aprovacao para campo
permanece bloqueada ate Android fisico autorizado. Foreground pontual, ausencia
de persistencia implicita e ausencia de background/tracking passaram a ser
restricoes consolidadas, nao escolhas em aberto. Permanecem pendentes o
fallback SVG/WebView, criterio de iOS, precisao/consumo em campo, cobertura
automatizada do adapter nativo e Android fisico.

### 4B. Marcacoes de campo vinculadas ao Caderno

O contrato tecnico, a UI e a captura foreground explicita do primeiro ponto
geografico opcional existem no Caderno e foram validados em emulador. O ponto
nao deve ser confundido com a localizacao temporaria do mapa de Talhoes nem
com PNG/ZIP de Material tecnico. Aprovacao de campo continua bloqueada ate
Android fisico autorizado.

Status em 2026-07-14 (Fase 17H.0): foi criada a analise tecnica
`docs/project/fase-17h-marcacoes-campo.md`. A recomendacao para uma futura
17H.1 e usar o Caderno como armazenamento principal do MVP demonstravel, com
metadados opcionais de localizacao salvos somente quando houver acao explicita
do usuario e salvamento do registro. Nenhuma implementacao foi feita nesta
fase, nenhuma coordenada foi salva, nenhum storage novo foi criado e nenhuma
chave `@tche:` nova foi criada.

Status em 2026-07-21 (Fase 17H.0.2): a direcao deixou de ser recomendacao e
virou decisao consolidada. O primeiro ponto persistido sera metadado opcional
do Caderno, sem `@tche:field-markers:v1`; registros antigos continuam sem
localizacao; somente acao explicita seguida do submit do Caderno podera
persistir; cancelamento e remocao antes de salvar nao persistem; abrir mapa,
Talhao/Caderno ou tocar em `Mostrar minha posicao` nunca salva. Produtor segue
a regra da propria Propriedade/Talhao sem editar/remover, Colaborador segue o
escopo atual e Admin o acesso global local/mockado, sem RBAC novo. Background,
tracking, trilha, rota, historico, geofencing e watch continuo permanecem
proibidos no corte.

Status em 2026-07-21 (Fase 17H.1A): o shape final, helper puro, validators e a
compatibilidade de create/get/list/update/remocao foram implementados e
validados no emulador. Os seis campos planos vivem somente no Caderno; o
snapshot continua em `@tche:mock-mvp:v1`; registros antigos permanecem
validos; remocao nao deixa sentinel ou residuo. Nenhuma UI, captura, chamada de
Location API ou chave nova foi criada.

Status em 2026-07-21 (Fase 17H.1B): a UI opcional, leitura foreground unica,
state transitorio, submit explicito, detalhe e selo foram implementados e
validados no emulador. Create sem/com ponto, erro/timeout, baixa precisao,
contexto de Talhao, `preserve`, `replace`, `remove`, desfazer e remocao
persistida passaram com GPS simulado; o provider foi restaurado ao final.
Nenhuma captura automatica, chave nova, background, tracking, trilha,
historico, point-in-polygon ou ponto persistido no mapa foi criado.

Status em 2026-07-22 (Fases 17H.1.1/17H.1.2): o smoke de seguranca tem status
`APROVADA_EM_EMULADOR`, com 29 de 29 casos executaveis no emulador aprovados.
Cancelamento sem persistencia, remocao antes do primeiro submit, falhas
recuperaveis de permissao/GPS/provider, protecao de concorrencia, troca de
Propriedade/Talhao, semanticas completas de `preserve`/`replace`/`remove`,
force-stop e regras dos tres perfis passaram. GeoJSON/Talhoes, PNG, Material
tecnico, ZIP e Visitas foram reabertos sem localizacao do Caderno; a auditoria
permaneceu limpa para storage, background/tracking e contaminacao entre
dominios. A lacuna do ZIP foi fechada com fixture valida de 286 B criada fora
do repositorio, importada pelo picker real, reaberta apos `force-stop` e
consultada pelo Produtor sem acoes de gestao.

Status em 2026-07-22 (Fase 17H.1.3): `PARCIAL_ANDROID_FISICO`. O release foi
instalado; abertura, logins locais e telas funcionais basicas passaram. Do checklist fisico, passaram
`17H113-01`, `17H113-02`, `17H113-03`, `17H113-05`, `17H113-09`,
`17H113-10` e `17H113-15` a `17H113-20`. Tres tentativas do provider em
ambiente interno, sem ceu razoavelmente visivel, terminaram de forma
controlada entre aproximadamente 38 e 53 segundos, sem leitura ou precisao.
Por isso, `17H113-04`, `17H113-06`, `17H113-07`, `17H113-08`, `17H113-11`,
`17H113-12`, `17H113-13` e `17H113-14` permanecem `Reexecutar`.

Nenhuma localizacao fisica foi persistida. GeoJSON, PNG e ZIP sinteticos
passaram, persistiram apos `force-stop`, foram consultados pelo Produtor sem
gestao e depois removidos pelo fluxo normal do aplicativo; os temporarios
foram apagados. A ausencia de background/tracking foi preservada. O relato
esta em `fase-17h-1-3-android-fisico-ponto-caderno.md`.

Pontos que continuam pendentes para evidencia:

- repetir em area aberta ou com ceu razoavelmente visivel a posicao temporaria
  do mapa, create com ponto, captura/cancelamento e remocao antes do submit;
- obter leitura e precisao do provider para entao repetir
  `preserve`/`replace`/`remove`, visibilidade e `force-stop` com ponto
  salvo/removido.

A evidencia Android fisica segue parcial. A Fase 17H.2 permanece bloqueada ate
o fechamento desses oito casos.

### 4C. Fechamento funcional antes de coordenadas, marcacoes e fotos

Status em 2026-07-21 (Fase 17H.0.1): a auditoria consolidada foi registrada em
`docs/project/auditoria-pendencias-mvp-antes-evidencias.md`. Ela nao
implementou funcionalidade nem corrigiu bugs; apenas classificou codigo,
testes, smoke e bloqueios.

Status em 2026-07-21 (Fase 17H.0.2): foram removidas como pendencias de
decisao a escolha entre Caderno/storage auxiliar, a regra de persistencia
explicita/cancelamento/remocao, as permissoes por perfil, o gate de
emulador/campo, a linguagem de area/perimetro, a natureza simulada das fotos,
o limite do processamento externo e o isolamento do alinhamento Expo. Essas
regras estao nas decisoes 15 a 21 de `decisoes-consolidadas.md`.

Status em 2026-07-21 (Fase 17H.0.3): as pendencias P0 de evidencia do baseline
foram encerradas em emulador. AUD-04, AUD-05 e AUD-06 passaram no Talhao
`T01 - 230`; o periodo `AUD05-ADMIN-PERIODO-20260721` foi criado e editado
pelo Admin; o Produtor o vinculou explicitamente ao Caderno; e Cadernos,
Talhao, periodo, sessao e ordenacao permaneceram apos `force-stop`. Nenhum bug
funcional foi reproduzido e nenhum patch foi necessario.

Esses itens deixam de ser pendencias de definicao/evidencia em emulador. Eles
continuam incluidos no smoke fisico obrigatorio e nao representam aprovacao de
campo.

Status em 2026-07-21 (Fase 17H.0.5): a pendencia P1 de apresentacao de area foi
encerrada no emulador. A UI separa `Area total informada`, `Area mapeada` e
`Area mapeada parcial`, usa `Nao informado` para ausencia e nao exibe
perimetro sem valor, unidade e origem comprovados. Os 6200 ha cadastrais e os
1888,6 ha mapeados da Sela permanecem distintos e inalterados.

Status em 2026-07-21 (Fase 17H.0.6): a pendencia P1 de Camera/Galeria simuladas
foi encerrada no emulador. Nova/Editar Visita nao geram mais URLs
`picsum.photos`; exibem aviso explicito do MVP local; criacao sem foto e edicao
de outro campo passaram; e fotos demonstrativas existentes permaneceram
legiveis e preservadas. Isso nao implementa foto real ou georreferenciada.

Status em 2026-07-21 (Fase 17H.0.7): a divergencia P1 de `expo` e
`expo-location` foi encerrada no SDK 56. Os pacotes foram alinhados de
56.0.11/56.0.20 para 56.0.16/56.0.21, `expo install --check` ficou limpo,
typecheck, suites, build, instalacao e smoke passaram em emulador. Os avisos
preexistentes de schema `splash` e `expo-font` ficaram registrados para fase
propria; Android fisico continua pendente e nao aprovado.

Status em 2026-07-21 (Fase 17H.1B): a implementacao de UI/captura do ponto
opcional foi encerrada no emulador. O ponto permanece em state ate o submit do
Caderno; create sem ponto continua inalterado; edicao preserva, substitui ou
remove apenas ao salvar; detalhe e selo reconhecem somente grupo valido. A
auditoria confirmou ausencia de chave nova, captura automatica,
background/tracking e `localizacao_*` em Visita, PNG, ZIP, GeoJSON ou mapa.

Status em 2026-07-22 (Fases 17H.1.1/17H.1.2): 29 de 29 casos executaveis no
emulador passaram. `17H111-26` passou com fixture ZIP temporaria valida,
DocumentPicker, detalhe, `force-stop`, Produtor e regressao sem localizacao fora
do Caderno. Naquele fechamento, `17H111-30` permaneceu `Reexecutar` porque
nenhum Android fisico estava disponivel.
A rodada confirmou que cancelamento nao persiste, localizacao somente persiste
no submit, `Mostrar minha posição` continua transitorio, ponto removido nao
reaparece e registro interno com ponto nao vaza ao Produtor.

Status em 2026-07-22 (Fase 17H.1.3): o aparelho autorizado, a instalacao do
release e 12 de 20 casos fisicos passaram, mas a rodada terminou
`PARCIAL_ANDROID_FISICO`. Sem leitura nas tres tentativas internas do
provider, oito casos dependentes de captura real ficaram `Reexecutar`:
`17H113-04`, `17H113-06`, `17H113-07`, `17H113-08`, `17H113-11`,
`17H113-12`, `17H113-13` e `17H113-14`. Nenhuma localizacao fisica foi
persistida, e a regressao de GeoJSON/PNG/ZIP, a limpeza e a ausencia de
background/tracking passaram.

Pendencias P1 antes de declarar APK apto a campo:

- repetir os oito casos fisicos dependentes do provider em area aberta ou com
  ceu razoavelmente visivel;
- manter a Fase 17H.2 bloqueada ate a captura real e seus fluxos dependentes
  passarem.

Pendencias P2/futuras:

- revisar os acessos rapidos do login em paisagem; no aparelho testado eles
  ficaram apertados e parcialmente cortados, sem bloquear o uso em retrato;
- definir fonte, metodo, unidade e confiabilidade do perimetro processado;
- confirmar a relacao entre 6200 ha informados e 1888,6 ha mapeados na Sela de
  Prata I, sem alterar os valores por inferencia;
- criar eventual fluxo real de fotos somente em fase propria, com decisao de
  camera/arquivo, storage, consentimento, data/hora, latitude/longitude,
  accuracy, privacidade e sincronizacao;
- implementar pipeline produtivo de mapas, publicacao, download e sync no
  backend.

Implementacoes/evidencias mantidas como pendentes, sem ambiguidade decisoria:

- concluir a validacao fisica do ponto opcional em condicao adequada para o
  provider;
- implementar foto real apenas em fase propria;
- implementar backend/processamento externo quando essa trilha for aberta.

Classificacao atual relevante:

- contrato do ponto opcional no Caderno:
  `IMPLEMENTADO_VALIDADO_EMULADOR`;
- UI/captura do ponto opcional: `IMPLEMENTADO_VALIDADO_EMULADOR`;
- smoke de seguranca/regressao 17H.1.1: `APROVADA_EM_EMULADOR`, com 29/29
  casos executaveis aprovados; `17H111-30` e `17H1B-13` continuam
  `Reexecutar`;
- validacao Android fisica 17H.1.3: `PARCIAL_ANDROID_FISICO`, com 12/20 casos
  aprovados e 8 casos dependentes de captura real em `Reexecutar`;
- area/perimetro: `PARCIAL`;
- semantica de area: `IMPLEMENTADO_VALIDADO_EMULADOR`;
- perimetro: `NAO_DISPONIVEL_NO_PIPELINE_ATUAL`, com obtencao produtiva
  dependente de processamento externo/backend;
- segregacao dos placeholders de foto: `IMPLEMENTADO_VALIDADO_EMULADOR`;
- alinhamento Expo SDK 56: `IMPLEMENTADO_VALIDADO_EMULADOR`;
- avisos remanescentes do Expo Doctor: `PENDENTE_FASE_TECNICA_PROPRIA`;
- processamento externo real: `DEPENDE_BACKEND`;
- fotos com data, hora, latitude e longitude: `NAO_IMPLEMENTADO`;
- Android fisico: `PARCIAL_ANDROID_FISICO`; release e parte do roteiro
  passaram, mas o gate do ponto continua inconclusivo e bloqueia a Fase
  17H.2.

### 5. Experiencia detalhada do produtor

O papel do produtor esta claro em nivel alto, mas ainda faltam definicoes mais finas sobre:

- como navegar entre uma ou mais propriedades
- como acessar historico, mapas e arquivos de modo simples
- onde termina consulta e onde comecam operacoes que exigem permissao da equipe

Status em 2026-07-01 (Fase 17B): a experiencia do Produtor foi parcialmente
tratada no MVP demonstravel, com linguagem mais consultiva no detalhe da
Propriedade, atalhos para Talhoes, Materiais tecnicos, Historico de visitas e
Caderno de campo, e estados vazios orientados a materiais/registros liberados.
A pendencia permanece aberta porque isso nao fecha a experiencia final do
produto, nao define backend/RBAC real, nao fecha matriz completa de permissoes
por acao e ainda exige smoke visual em emulador e validacao final em Android
fisico.

Status em 2026-07-08 (Fase 17F): a experiencia do Produtor ganhou consulta
por Talhao com resumo, Safra/Safrinha, Caderno e Material tecnico relacionados
no contexto da propria Propriedade. A pendencia permanece aberta para validar
o fluxo visual completo em emulador e Android fisico, incluindo Produtor
registrando Caderno pelo Talhao e sem acesso a acoes administrativas de
periodo/material.

Status em 2026-07-09 (Fase 17F.1): Produtor foi validado visualmente no
emulador consultando o Talhao `T01 - 230`, sem acao de criacao de
Safra/Safrinha, e abrindo Novo Caderno com Talhao preenchido. O salvamento
visual completo do Caderno pelo Talhao ainda deve ser reexecutado, assim como
a validacao em Android fisico.

Status em 2026-07-09 (Fase 17F.2): Produtor salvou um registro de Caderno a
partir do Talhao `T01 - 230`; o detalhe exibiu Propriedade, Talhao, autoria do
Produtor e nao exibiu editar/remover. A experiencia do Produtor em emulador
fica coberta para esse fluxo principal, mas Android fisico segue pendente e
nao aprovado.

### 6. Revisao do fluxo de cadastro de Propriedade e Produtor

Ainda falta avaliar se a tela de Nova Propriedade deve permitir criar novo titular/produtor dentro do proprio cadastro.

A tendencia para o MVP e centralizar o cadastro de novos usuarios/produtores em `NovoUsuarioScreen` e deixar `NovaPropriedadeScreen` apenas para selecionar um produtor/titular ja existente.

Status em 2026-05-30: esta pendencia permanece aberta apos a microfase de padronizacao visual. A padronizacao nao alterou fluxo, regra, mock, rota ou payload de cadastro. A recomendacao operacional para o MVP continua sendo manter o cadastro de usuario/produtor centralizado em `Admin -> Usuarios` e usar Nova Propriedade apenas para vincular produtor/titular ja cadastrado, ate haver decisao especifica em uma fase de revisao de fluxos.

Status em 2026-06-01: a matriz oficial de cadastros do MVP foi criada em `docs/project/matriz-cadastros-mvp.md`. Ela consolida os conceitos, campos obrigatorios, campos opcionais/mockados, nomes legados preservados, riscos e ordem futura recomendada. A pendencia funcional continua aberta porque a matriz nao altera fluxo, regra, mock, rota, payload ou permissao.

Status em 2026-06-02: o reforco visual do Bloco 6B deixou explicitos os limites atuais dos cadastros, sem alterar fluxo, mock estrutural, rota, payload, contrato, permissao ou helper tecnico. Permanecem como pendencias:

- fluxo combinado `Usuario + Propriedade` ainda nao e transacional;
- cadastro de novo titular minimo cria apenas vinculo mockado/preparatorio e nao cria login ou autenticacao real;
- `Propriedades atribuidas` ao colaborador ainda nao devem ser tratadas como RBAC final por propriedade;
- integridade referencial real entre usuarios, propriedades, titulares e vinculos fica para backend.

Status em 2026-06-02 (Bloco 6C): o fechamento documental registrou esse estado
em `estado-atual.md`, `matriz-cadastros-mvp.md` e `smoke.md`. A pendencia segue
aberta para revisao futura de fluxo, backend, transacao e integridade real.

Status em 2026-06-03 (Fase 14D): para o MVP mockado, ficou documentado que
`propriedades_atribuidas` e vinculo visual/admin preparatorio e ainda nao e
regra efetiva de RBAC. A regra efetiva do colaborador permanece regional:
`sub_regioes` primeiro e `vinculos_microregioes` como fallback quando
`sub_regioes` estiver ausente ou vazio. A pendencia futura e decidir no
backend/RBAC se acesso sera por microregiao, por propriedade atribuida ou por
combinacao das duas.

Status em 2026-06-03 (Fase 14E): a direcao futura recomendada para
backend/RBAC foi documentada como regra combinada/aditiva para colaborador:
acesso por microregiao vinculada OU por Propriedade atribuida diretamente.
`propriedades_atribuidas` no backend deve ampliar acesso direto, nao restringir
automaticamente o acesso regional. Permanece pendente transformar essa direcao
em modelagem real, politicas por acao, API, persistencia e testes de backend.

Status em 2026-06-02 (Fase 12C): os arquivos/componentes de telas de
Propriedade foram renomeados para `PropriedadesScreen`,
`NovaPropriedadeScreen` e `EditarPropriedadeScreen`.

Status em 2026-06-02 (Fase 12E): as rotas de stack de criacao/edicao foram
migradas para `NovaPropriedade` e `EditarPropriedade`, preservando os params de
edicao.

Status em 2026-06-02 (Fase 12G): as rotas tecnicas das tabs foram migradas para
`Propriedades` no fluxo admin e `PropriedadesColaborador` no fluxo colaborador,
preservando o label visual `Propriedades` nas duas tabs. Esta migracao nao
alterou motor de permissoes, mocks, payloads, contratos de dados, helpers
tecnicos ou logica de listagem/filtro. Permanece pendente apenas validar o
smoke manual completo da navegacao apos a migracao.

Status em 2026-06-04 (Fase 16B): o diagnostico de campo confirmou que Nova
Propriedade possui um conjunto minimo adequado, mas `Novo Titular` e o cadastro
rapido de Propriedade dentro de Novo Usuario devem ficar fora do fluxo
principal do APK. Permanece pendente decidir, em etapa futura, se esses fluxos
serao mantidos, removidos ou substituidos por criacao transacional no backend.
Para o APK mockado, a recomendacao e priorizar Titular existente e manter
Usuario administrativo como demonstracao assistida.

Essa decisao deve ser tratada em uma fase separada de Revisao de Fluxos e Regras de Cadastro, junto com outros fluxos necessarios para padronizar conceitos, responsabilidades e nomenclatura.

## Pendencias de Regra e Permissao

### 7. Fechamento completo das regras de permissao por acao

As diretrizes principais de acesso ja estao claras, mas ainda falta consolidar o detalhamento de permissao por acao em todo o dominio, especialmente quando houver diferenca entre:

- visualizacao
- criacao
- edicao
- download
- visibilidade de registros

Status em 2026-06-03 (Fase 14D): a semantica de
`propriedades_atribuidas` foi fechada apenas para o MVP mockado. Ela nao
restringe nem amplia acesso efetivo. Permanece pendente a regra final de
backend/RBAC, incluindo persistencia de vinculos reais usuario-propriedade e
validacao de permissao por acao e por Propriedade.

Status em 2026-06-03 (Fase 14E): a proposta futura recomendada agora esta
registrada: Admin com acesso global, Produtor por vinculo com
Propriedade/Titular e Colaborador por microregiao OU Propriedade atribuida.
Ainda precisam ser definidos:

- ids canonicos e contratos de `usuarios`, `propriedades`,
  `usuario_propriedade`, `usuario_microregiao` e `perfis`/`papeis`;
- status, validade, origem e auditoria dos vinculos;
- matriz por acao para listar, abrir detalhe, ver mapas/anexos, criar visita,
  editar visita, criar/editar caderno, editar cadastro e liberar/download de
  anexos;
- politica explicita caso a organizacao queira uma regra restritiva em vez da
  regra aditiva recomendada;
- migracao controlada de `sub_regioes`, `vinculos_microregioes`,
  `propriedades_atribuidas`, `produtor_id`, `proprietario_id`, `titular_id`,
  `fazenda_id` e `propriedade_id`;
- validacao de permissao no backend para rotas diretas e operacoes por
  Propriedade.

Status em 2026-06-03 (Fase 14F): foi criada
`docs/project/matriz-rbac-backend.md` com matriz tecnica de permissoes por
perfil, matriz por acao, casos positivos/negativos e criterios de aceite para
backend. A pendencia agora nao e mais documentar o formato inicial da matriz,
mas implementar backend/RBAC real e transformar esses criterios em testes
automatizados de API e dominio quando a frente de backend existir.

Status em 2026-06-03 (Fase 14G): foi criado
`docs/project/contrato-api-rbac.md` com contrato futuro de endpoints,
payloads minimos, respostas padrao e regras de permissao por endpoint. A
pendencia permanece implementar backend real, autenticacao real, RBAC e testes
automatizados de API; o documento apenas prepara o contrato esperado.

Status em 2026-06-03 (Fase 14H): foi criado
`docs/project/testes-contrato-api-rbac.md` com matriz tecnica de testes de
contrato/API por endpoint, perfil, pre-condicao, payload, status HTTP esperado
e regra validada. A pendencia permanece transformar essa matriz em testes
automatizados quando houver backend real.

Status em 2026-06-03 (Fase 14I): foi criado
`docs/project/fechamento-fase-14-rbac.md` como indice consolidado da Fase 14.
Ele facilita consulta, mas nao fecha as pendencias de backend, autenticacao,
RBAC real, API, persistencia e testes automatizados.

### 8. Relacao final entre regra de negocio e comportamento efetivo da implementacao atual

Ainda e necessario revisar e fechar, de forma mais precisa, onde a implementacao atual:

- ja segue a regra consolidada
- ainda depende de comportamento mock
- ainda possui duplicacao ou divergencia em telas especificas

Esse ponto nao e backlog tecnico generico. Ele e uma pendencia de alinhamento entre regra e repositorio atual.

## Pendencias de Escopo Tecnico-Funcional

### 9. Remocao do painel temporario `Smoke Dev`

Durante o fechamento da frente de visitas tecnicas por propriedade e caderno de campo por propriedade, foi criado um painel temporario `Smoke Dev` em `src/screens/PerfilScreen.tsx`.

**Status atual**

- manter enquanto a estabilizacao do MVP estiver em andamento
- remover antes de uma entrega formal, build de demonstracao externa ou publicacao

**O que remover**

- constante `smokeRoutes`
- bloco visual `Smoke Dev`
- estilos usados exclusivamente por esse painel

**Por que importa**

O painel esta protegido por `__DEV__`, mas ainda e uma ferramenta interna de teste manual. Ele nao deve ser confundido com funcionalidade do produto.

### 10. Capacidade offline declarada por fluxo

Ja existe a diretriz de priorizar uso em contexto de internet ruim, mas ainda falta declarar com clareza:

- o que deve funcionar apenas para consulta
- o que pode depender de sincronizacao posterior
- o que exige conexao

Sem esse fechamento, o projeto corre risco de descrever offline de forma mais ampla do que a capacidade real.

Status em 2026-06-04 (Fase 16B): alem da capacidade offline de consulta,
o Bloco 16B.2 implementou o corte minimo de persistencia local para Usuario,
vinculos administrativos, Propriedade, Visita, Caderno e metadados de Mapa. A
borda usa snapshot versionado em `AsyncStorage`, restauracao controlada do seed
demonstrativo e preservacao de `fazenda_id`, sem implementar sincronizacao.
Permanecem pendentes a validacao em Android fisico, politica de migracao entre
versoes do snapshot, tratamento de limite/cota de armazenamento, criptografia
quando houver dado real e estrategia produtiva futura com backend.

Status em 2026-07-30 (`MP-01`): `politica-sessao.md` fechou a fronteira da
sessao produtiva para offline. Uma sessao previamente revalidada pode consultar
dados locais por ate 24 horas desde a ultima revalidacao, dentro do ultimo
escopo autorizado e com retomada segura. Nao ha login ou troca de usuario
offline e, ate cada fluxo possuir contrato proprio, o corte produtivo e
somente leitura. Continua pendente definir por fluxo o que pode ser consultado,
rascunhado, sincronizado ou exigir conexao, alem de retencao, criptografia,
conflitos e limpeza dos caches.

### 11. Estrategia funcional para ingestao e disponibilizacao de mapas e arquivos

O produto ja depende de mapas e arquivos no contexto da propriedade. Para a primeira versao de testes, ficou definido que a biblioteca deve priorizar arquivos tecnicos acessiveis por produtor/equipe, anexados por campo/talhao e elemento/camada quando aplicavel.

Ainda faltam definicoes sobre:

- qual o nivel minimo de tratamento desses materiais no MVP
- como separar consulta simples de manutencao operacional do acervo
- pipeline produtivo para receber arquivos do acervo/drive, validar, armazenar, liberar e manter historico

Decisao ja assumida para o MVP: o app deve consumir uma demarcacao final normalizada, preferencialmente GeoJSON ou JSON equivalente, e nao carregar o pacote bruto de origem no dispositivo. Ainda falta definir o pipeline de producao para conversao, validacao, armazenamento, permissao e publicacao desses arquivos finais.

Estado atual do teste local: existe uma amostragem da propriedade Sela de Prata I convertida a partir de shapefile para validar a exibicao dos talhoes no mock. Essa amostra possui manifesto em `data/processados/p_sela1/2025/manifesto.json`, mas o conversor local nao fecha a estrategia produtiva; ele apenas prova o formato de entrada esperado pelo app e o registro minimo de revisao.

Estado atual dos anexos visuais: existe uma amostra pequena de PNGs de fertilidade da propriedade Sela de Prata I cadastrada manualmente no mock como registros da entidade `Mapa`. Esses PNGs sao assets internos do app apenas para validacao visual do MVP. Eles nao representam upload real, cadastro administrativo completo, persistencia em banco/storage, API de anexos, importacao automatica ou gestao completa do acervo.

Atualizacao em 2026-06-01: os cinco PNGs da Sela de Prata I foram enriquecidos de forma aditiva no mock com metadados conceituais do futuro `AnexoFertilidade`, preservando campos legados como `fazenda_id`, `produtor_id`, `talhao`, `subcategoria`, `data_criacao` e `disponivel_download`. Tambem existe o tipo isolado `src/types/anexoFertilidade.ts`, ainda nao integrado ao dominio real.

Status em 2026-06-04 (Fase 16B): a revisao do pacote demonstrativo identificou
que a Sela de Prata I informa `area_total: 6200`, enquanto o manifesto dos 15
talhoes informa soma mapeada de `1888,6 ha`. Permanece pendente confirmar se os
valores representam area total e area mapeada ou se o mock deve ser corrigido.
Tambem permanece pendente confirmar autorizacao de nome, localizacao, limites e
anexos. O Bloco 16B.1 substituiu o nome da Propriedade usado como Usuario
produtor/Titular pela persona `Produtor Demonstracao`, sem inferir ou incluir
um nome pessoal real. A area e os materiais/localizacao permanecem sem
alteracao ate confirmacao.

Status em 2026-06-11 (Fase 16H.6): no APK SDK 56 instalado em emulador Android,
o DocumentPicker de PNG local passou em selecao, metadados, salvamento e
reabertura para a Sela de Prata I, e o fluxo de GeoJSON local foi corrigido e
reexecutado. `limites_talhoes.geojson` e `limites_talhoes.json` abriram modal
com 15 talhoes/37 partes, foram anexados/substituidos e permaneceram visiveis
apos `force-stop`, reabertura e retorno a Mapas/Arquivos tecnicos. Permanece
pendente apenas a validacao final em Android fisico para campo.

Status em 2026-07-03 (Fase 17C.1): no APK release instalado em emulador
Android, o fluxo local de `Material tecnico` passou com PNG de fertilidade,
ZIP de prescricao, validacao de arquivo invalido no fluxo ZIP, substituicao e
remocao de ZIP local, persistencia visual na listagem e consulta do Produtor
sem acoes administrativas. Isso nao fecha a estrategia produtiva de ingestao:
backend/storage real, pipeline de revisao/publicacao, sincronizacao, download
real e validacao em Android fisico continuam pendentes.

Status em 2026-07-21 (Fase 17H.0.1): a auditoria confirmou que o celular nao
gera mapas e que GeoJSON/PNG/ZIP atuais sao preparados previamente ou
importados localmente. `MapaSincronizacaoService`, endpoints simulados e
helpers de referencia nao formam servidor produtivo nem download/publicacao
real. A direcao arquitetural continua documentada, a implementacao local tem
evidencia em emulador e servidor/download/sync reais permanecem
`DEPENDE_BACKEND`.

Status em 2026-07-22: novos anexos do MVP local passaram a usar o modelo
unificado de `Material tecnico`, com formatos PNG/PDF/ZIP, indice separado de
metadados pequenos e arquivo fisico no storage interno. Ano e obrigatorio;
Safra/Safrinha e referencia opcional; profundidade e escopo seguem regras
condicionais. A leitura dos indices PNG/ZIP anteriores deve ser preservada sem
duplicacao. PDF e ZIP podem ser catalogados, mas nao possuem promessa de
visualizacao, download remoto ou processamento. Essa entrega nao fecha a
estrategia produtiva de ingestao e disponibilizacao.

Permanece pendente definir e implementar:

- migracao futura do contrato local canonico de `Material tecnico` para o
  dominio/backend real, sem quebrar PNG/ZIP legados
- fluxo administrativo produtivo para cadastrar, revisar e liberar PNG, PDF,
  ZIP e outros anexos autorizados
- estrategia de armazenamento remoto persistente dos arquivos
- backend/storage/upload para anexos e materiais tecnicos
- API/backend para anexos de mapas
- fluxo de confirmacao manual dos metadados antes da publicacao
- status real de publicacao/liberacao dos anexos
- regras de permissao por acao para criacao, edicao, remocao, liberacao e download
- tratamento de versoes, historico e revisao dos materiais
- pipeline produtivo para receber, validar, armazenar e publicar materiais tecnicos
- migracao futura de `fazenda_id` para `propriedade_id`, preservando compatibilidade durante a transicao
- separacao clara entre amostras mockadas e acervo operacional real

## Regra de Governanca

Uma pendencia deve sair deste documento quando ocorrer uma destas situacoes:

- foi consolidada como decisao do projeto
- foi removida do escopo atual por definicao explicita
- foi desmembrada em detalhe tecnico subordinado a um documento mais especifico

Enquanto isso nao acontecer, o tema deve permanecer aqui, e nao ser tratado como verdade fechada.
