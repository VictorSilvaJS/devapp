22-04-2026 - 10:14

Abaixo está o smoke funcional pronto para execução, sem abrir feature nova.

**Como Usar**
- Atualize a coluna `Status` com `Passou`, `Falhou` ou `Reexecutar`.
- Use `Observação` só para evidência mínima ou descrição curta da falha.
- Em caso de falha, corrija o ponto específico, reexecute o mesmo caso e siga o smoke.

**Pontos Mais Arriscados**
1. Produtor por rota direta: `NovaVisita`, `EditarVisita`, `CadernoDetail` restrito, `EditarCaderno` de outro autor.
2. Colaborador fora de escopo regional: criação/edição/detalhe de visita e caderno.
3. Preservação de `fazenda_id` em edição de visita e caderno.
4. Caderno no detalhe da propriedade: registros corretos por propriedade e visibilidade para produtor.
5. Criação a partir do detalhe da propriedade: novo caderno nasce vinculado à propriedade atual.
6. Criação de visita pelo detalhe da propriedade: `NovaVisita` deve pré-selecionar/travar a propriedade contextual e manter bloqueio fora de escopo.
7. Mapas/Arquivos técnicos: consulta deve ser priorizada e a associação interna de referência não deve aparecer no fluxo de campo.
8. Padronização visual: componentes-base devem preservar comportamento, filtros, permissões, rotas e linguagem visível de `Propriedade` onde aplicável.
9. Mapas/anexos de fertilidade: nomenclatura visual deve diferenciar `Anexos de fertilidade`, `Mapa de fertilidade` e `Arquivo técnico`, sem alterar abertura, filtros, permissões ou contratos.
10. Admin visual: `propriedades_atribuidas` no cadastro/detalhe do colaborador não deve ser interpretado como alteração real de acesso.
11. APK demonstrável: não entregar build em modo `__DEV__`; o acesso rápido deve aparecer como demonstrativo/local e usuários administrativos, fotos, anexos, uploads, downloads, autenticação e RBAC continuam mockados/preparatórios.

**Rodada Fase 17F - Talhao Como Centro De Consulta Da Propriedade**

Observacao geral em 2026-07-09 (Fase 17F.2): ambiente do emulador
`emulator-5554` (`Pixel_Tablet`) corrigido sem wipe do AVD. Para liberar
espaco em `/data`, foi necessario limpar/desinstalar o pacote do app e remover
o Expo Go do emulador; depois o APK release atual foi recompilado e instalado
com sucesso. Essa limpeza reiniciou o estado local do app, portanto as
importacoes locais anteriores de GeoJSON/PNG/ZIP nao estavam presentes nesta
rodada. O smoke foi repetido em emulador com os Talhoes seed/mock da Sela de
Prata I, mantendo a consulta por Propriedade e sem salvar conteudo bruto em
AsyncStorage. Validado como Produtor: abertura da Sela, aba Talhoes, modal do
Talhao `T01 - 230`, ausencia de acao administrativa de Safra/Safrinha, abertura
de Novo Caderno pelo Talhao, salvamento do registro e detalhe exibindo Talhao,
Propriedade, autoria do Produtor e sem editar/remover. Validado como
Colaborador: Dashboard, Sela no escopo, detalhe da Propriedade, aba Talhoes
com `15 talhoes disponiveis`, acao de Safra/Safrinha autorizada, Material
tecnico no contexto da Sela, filtros por Demarcacao/Talhao/Safra e estado
vazio de GeoJSON local apos a limpeza. Foi corrigida a pluralizacao visual de
microrregioes no Dashboard do Colaborador. A
validacao manual de Admin e a reabertura individual de PNG/ZIP ficam no roteiro
de repeticao, especialmente no Android fisico. Android fisico segue pendente e
nao aprovado.

Observacao geral em 2026-07-09 (Fase 17F.1): smoke visual iniciado no
emulador `emulator-5554` (`Pixel_Tablet`) com APK release ja instalado. A
reinstalacao do APK release gerado ficou bloqueada por falta de espaco em
`/data` no emulador; o pacote existente abriu normalmente. Validado como
Produtor: Propriedade Sela de Prata I, aba Talhoes, panorama/Material tecnico,
mapa local dos Talhoes, modal do Talhao `T01 - 230`, consulta de
Safra/Safrinha sem acao de criacao de periodo, e abertura de Novo Caderno com
Propriedade travada e Talhao preenchido. O salvamento completo do Caderno pelo
Talhao, os perfis Colaborador/Admin e a reabertura individual de PNG/ZIP ainda
devem ser reexecutados. Android fisico segue pendente e nao aprovado.

Observacao geral: checklist para validar a consulta por Talhao dentro da
Propriedade. A implementacao reutiliza o panorama/Material tecnico e guarda
somente metadados ja existentes; nao salva coordenadas, GeoJSON bruto, PNG,
ZIP, base64, bytes, binario ou arquivo bruto em AsyncStorage. Nao ha
localizacao em tempo real, marcacao geografica, edicao de limites,
georreferenciamento de PNG, processamento de ZIP, backend, RBAC real, sync,
upload/download remoto ou storage remoto. Android fisico segue pendente.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17F-01 | P0 | Produtor | Propriedade | Abrir Sela de Prata I > Talhoes > detalhes de um Talhao | Modal mostra resumo, Propriedade, area/ano e origem segura da demarcacao | Passou | 17F.2: modal `T01 - 230` abriu em emulador com Propriedade, origem `Seed/mock` apos limpeza do estado local, e sem salvar GeoJSON bruto |
| 17F-02 | P0 | Produtor | Safra/Safrinha | Consultar bloco do Talhao | Mostra periodos do Talhao ou `Periodos da Propriedade`; sem criar/editar periodo | Passou | Produtor nao viu `Nova Safra/Safrinha`; permissao administrativa segue bloqueada no perfil |
| 17F-03 | P0 | Produtor | Caderno | Registrar no Caderno pelo Talhao | Novo Caderno abre com Propriedade travada, Talhao preenchido e periodo opcional | Passou | 17F.2: Propriedade travada em Sela de Prata I, Talhao `T01 - 230` e periodo opcional `Sem Safra/Safrinha vinculada` |
| 17F-04 | P0 | Produtor | Caderno | Salvar registro do Talhao e voltar ao detalhe/lista | Registro aparece no Talhao; registros sem Talhao nao aparecem como especificos | Passou | 17F.2: registro salvo como Produtor, detalhe abriu com Talhao `T01 - 230`, Propriedade correta, autoria do Produtor e sem editar/remover |
| 17F-05 | P0 | Colaborador | Talhao | Abrir Talhao dentro do escopo e criar Caderno | Colaborador ve contexto e salva Caderno no Talhao correto | Reexecutar | 17F.2: Colaborador abriu Sela no escopo e Talhoes; criacao de Caderno pelo Talhao como Colaborador deve ser repetida |
| 17F-06 | P0 | Admin/Colaborador | Safra/Safrinha | Criar periodo pelo Talhao | Formulario reaproveitado abre com Propriedade travada e Talhao pre-selecionado | Reexecutar | 17F.2: Colaborador viu acao autorizada `Novo`; criacao manual de periodo pelo Talhao e Admin manual ficam para repeticao |
| 17F-07 | P0 | Todos | Material tecnico | Abrir materiais do Talhao e Propriedade inteira | Materiais especificos e gerais aparecem separados; Produtor sem acoes administrativas | Passou | 17F.2: Material tecnico abriu para Produtor/Colaborador com filtros de Propriedade, Demarcacao, Talhao e Safra; Admin manual deve repetir no fisico |
| 17F-08 | P0 | Todos | Regressao | Reabrir PNG, ZIP e GeoJSON/talhoes | PNG abre como imagem; ZIP detalha sem unzip; Talhoes renderizam | Reexecutar | 17F.2: Talhoes seed/mock renderizados; imports locais de GeoJSON/PNG/ZIP foram apagados pela correcao de ambiente e devem ser recriados/reabertos |
| 17F-09 | P0 | Todos | Storage | Auditar storage local | Nenhuma coordenada, GeoJSON bruto, PNG, ZIP, base64, bytes ou binario salvo em AsyncStorage | Passou | Coberto por testes de dominio, busca textual e diff restrito a pluralizacao visual |
| 17F-10 | P0 | Todos | Android fisico | Instalar APK e repetir casos em aparelho | Passa em Android fisico autorizado | Reexecutar | Android fisico segue pendente e nao aprovado |

**Rodada Fase 17G.1 - Localizacao Foreground Sobre Talhoes**

Observacao geral em 2026-07-09 (Fase 17G.1): implementacao minima criada a
partir da analise tecnica `docs/project/fase-17g-localizacao-tempo-real.md`.
`expo-location@~56.0.20` foi instalado, `app.json` recebeu permissao
foreground only, e o mapa ativo de Talhoes passou a ter botao `Mostrar minha
posicao`. A localizacao permanece sem background, sem trilha/historico, sem
AsyncStorage, sem backend/sync e sem marcador em PNG/ZIP.

Validacao tecnica da rodada: `npm run typecheck` e
`npm run test:domain-compat` passaram; `npx expo install --check` reportou
somente `expo@56.0.11 - expected version: ~56.0.15`, mantido sem correcao.
O APK release passou em build com Gradle em modo economico, foi instalado no
emulador `emulator-5554` e abriu via `monkey` sem crash inicial. O pacote
instalado possui `ACCESS_FINE_LOCATION` e `ACCESS_COARSE_LOCATION`, sem
`ACCESS_BACKGROUND_LOCATION`. O smoke visual de marcador/permissao nao foi
fechado porque o estado local atual do emulador nao possuia GeoJSON local
anexado para a Sela de Prata I. Android fisico segue pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17G-01 | P0 | Todos | Dependencia | Confirmar dependencia e permissao | Dependencia aprovada explicitamente e permissao foreground only documentada | Passou | `expo-location@~56.0.20` instalado; `app.json` sem background location |
| 17G-02 | P0 | Todos | Mapa de Talhoes | Abrir Sela > mapa de Talhoes > Mostrar minha posicao | Marcador aparece apenas sobre Talhoes/GeoJSON georreferenciado | Reexecutar | APK abriu e Sela foi acessada; estado local sem GeoJSON local anexado impediu validar botao/marcador |
| 17G-03 | P0 | Todos | Permissao negada | Negar permissao de localizacao | Mensagem clara, sem crash e sem marcador | Reexecutar | Nao executado nesta rodada; sem fallback para permissao background |
| 17G-04 | P0 | Todos | GPS indisponivel | Simular indisponibilidade/erro de leitura | Mensagem clara e mapa segue navegavel | Reexecutar | Nao executado; sem persistir erro como coordenada |
| 17G-05 | P0 | Todos | Storage | Auditar AsyncStorage e codigo | Nenhuma coordenada, trilha, rota ou historico salvo | Passou | Auditoria focada nao encontrou AsyncStorage/chave nova/background APIs nos arquivos alterados |
| 17G-06 | P0 | Todos | Fallback | Forcar falha do Leaflet/WebView | Fallback SVG nao promete localizacao real sem helper seguro | Reexecutar | Preferir mensagem controlada na primeira versao |
| 17G-07 | P0 | Todos | Android fisico | Repetir em aparelho autorizado | Permissao, precisao e consumo basico validados em campo | Reexecutar | Android fisico segue pendente e nao aprovado |

**Rodada Fase 17E - Safra/Safrinha Local E Opcional**

Observacao geral em 2026-07-08: smoke 17E.1 executado no emulador
`emulator-5554` (`Pixel_Tablet`) com APK release instalado. A implementacao e
local/demonstrativa, guarda apenas metadados pequenos em
`@tche:periodos-produtivos:v1` e nao abre backend, sync, upload, download,
storage remoto, mapas novos, processamento de ZIP ou pipeline produtivo.
Android fisico segue pendente ate haver aparelho autorizado no `adb`.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17E-01 | P0 | Admin | Propriedade | Abrir Sela de Prata I > Talhoes | Secao `Safras e Safrinha` aparece sem alterar Material tecnico | Passou | Executado como Colaborador autorizado em emulador; permissao Admin coberta por testes de acesso; repetir Admin manual no fisico |
| 17E-02 | P0 | Admin | Safra/Safrinha | Criar Safra com cultura, ano agricola, status e Talhao opcional | Periodo salva localmente e volta para a Propriedade | Passou | Criada Safra `Soja` `2025/2026` na Sela; validacao obrigatoria funcionou; repetir Admin manual |
| 17E-03 | P0 | Admin | Safra/Safrinha | Editar periodo criado | Alteracoes aparecem no card sem criar duplicidade | Passou | Periodo salvo em edicao sem duplicar; contador permaneceu `1` |
| 17E-04 | P0 | Produtor | Propriedade | Abrir mesma Propriedade | Produtor consulta Safra/Safrinha sem botao de criar/editar | Passou | Produtor viu `Safras = 1` e card sem `Novo`/editar |
| 17E-05 | P0 | Produtor | Caderno | Registrar Caderno e selecionar Safra/Safrinha opcional | Registro salva visivel ao produtor e mostra vinculo no detalhe/lista | Reexecutar | Produtor consulta validada; registro de Caderno pelo Produtor com periodo deve ser repetido manualmente |
| 17E-06 | P0 | Admin/Colaborador | Caderno | Criar/editar Caderno removendo ou trocando periodo | Vinculo opcional atualiza sem trocar Propriedade | Passou | Colaborador criou Caderno com periodo, viu no detalhe e removeu o vinculo preservando a Propriedade |
| 17E-07 | P1 | Todos | Persistencia | Fechar app e reabrir | Periodos e vinculos locais continuam visiveis | Passou | `force-stop` e reabertura preservaram Safra `Soja` `2025/2026` e contador `Safras = 1` |
| 17E-08 | P0 | Todos | Regressao | Abrir Material tecnico, PNG, ZIP e GeoJSON/talhoes | Fluxos 16F/16G/17C seguem funcionando | Reexecutar | Material tecnico e GeoJSON/talhoes abriram; item PNG base visivel; detalhe PNG/ZIP individual deve ser repetido |
| 17E-09 | P0 | Todos | Android fisico | Instalar APK e repetir casos em aparelho | Passa em Android fisico autorizado | Reexecutar | Android fisico segue pendente e nao aprovado |

**Rodada Fase 17D.4 - Validacao Android Fisico Do Caderno E Material Tecnico**

Observacao geral em 2026-07-07: rodada iniciada para validar Caderno de Campo,
Material tecnico, DocumentPicker real, persistencia local e usabilidade em
Android fisico. A execucao manual ficou bloqueada porque `adb devices -l`
mostrou apenas o emulador `emulator-5554` (`Pixel_Tablet`) com status
`device`; nenhum aparelho fisico apareceu autorizado. Android fisico segue
pendente e nao aprovado.

APK release gerado:
`android/app/build/outputs/apk/release/app-release.apk` com 91.713.808 bytes,
gerado em 2026-07-07. O primeiro build no sandbox falhou por acesso negado ao
lock do cache global do Gradle; a repeticao com permissao aprovada passou.

Validacoes tecnicas executadas:

- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou.
- `node tests/cadernoFormCompat.test.js`: passou.
- `node tests/acessoControleCompat.test.js`: passou.
- `node tests/validatorsCompat.test.js`: passou.
- `.\gradlew.bat :app:assembleRelease`: passou apos permissao para o cache
  global do Gradle.
- `git diff --check`: passou.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17D4-01 | P0 | Todos | Dispositivo | Rodar `adb devices -l` | Aparelho fisico aparece como `device` | Bloqueado | Apenas `emulator-5554` (`Pixel_Tablet`) apareceu; nenhum Android fisico autorizado |
| 17D4-02 | P0 | Todos | Build | Gerar APK release atual | APK release gerado sem alterar SDK/dependencias | Passou | APK gerado em `android/app/build/outputs/apk/release/app-release.apk`; sem `npm audit fix` e sem upgrade de SDK |
| 17D4-03 | P0 | Todos | Instalacao fisica | Instalar APK no Android fisico | `adb install -r` passa no aparelho | Reexecutar | Nao executado por ausencia de Android fisico autorizado |
| 17D4-04 | P0 | Todos | Abertura fisica | Abrir app no Android fisico | App abre sem crash/tela vermelha | Reexecutar | Nao executado por ausencia de Android fisico autorizado |
| 17D4-05 | P0 | Produtor | Caderno | Criar Caderno na Sela com teclado real | Registro proprio salvo, visivel e sem editar/remover | Reexecutar | Nao executado no aparelho fisico |
| 17D4-06 | P0 | Admin | Caderno | Ver registro do Produtor e criar interno | Admin ve ambos e consegue editar quando o fluxo existir | Reexecutar | Nao executado no aparelho fisico |
| 17D4-07 | P0 | Produtor | Visibilidade | Reabrir como Produtor apos registro interno | Registro interno do Admin nao aparece | Reexecutar | Nao executado no aparelho fisico |
| 17D4-08 | P0 | Colaborador | Caderno | Criar registro na Sela dentro do escopo | Registro aparece e detalhe mostra editar quando disponivel | Reexecutar | Nao executado no aparelho fisico |
| 17D4-09 | P0 | Produtor | Material tecnico | Abrir Fertilidade, Correcao de solo e Prescricao | Filtros mantidos e sem acoes administrativas para Produtor | Reexecutar | Nao executado no aparelho fisico |
| 17D4-10 | P0 | Admin/Colaborador | DocumentPicker | Anexar PNG valido e ZIP valido; tentar invalido | PNG abre, ZIP detalha sem unzip/processamento e invalido nao cria metadado | Reexecutar | Nao executado no aparelho fisico |
| 17D4-11 | P0 | Todos | GeoJSON/Talhoes | Abrir Panorama/Talhoes da Sela | Talhoes abrem; local se existir, seed/mock como fallback | Reexecutar | Nao executado no aparelho fisico |
| 17D4-12 | P0 | Todos | Persistencia | Fechar app e reabrir no aparelho | Registros/metadados locais permanecem | Reexecutar | Nao executado no aparelho fisico |

**Rodada Fase 17C - Material Tecnico PNG/ZIP**

Observacao geral: checklist preparado para validar em emulador a organizacao de
`Material tecnico`. A implementacao e local/demonstrativa: PNG abre como
imagem, prescricao ZIP abre apenas como detalhe do pacote tecnico. Nao ha
backend, upload remoto, sync, unzip, processamento de conteudo ou download
real.

Rodada 17C.1 executada em 2026-07-03 no emulador `emulator-5554`
(`Pixel Tablet`, API 35), com APK release
`android/app/build/outputs/apk/release/app-release.apk`. Arquivos usados:
`smoke_ph_10a20.png`, `prescricao_taxa_variavel_2026.zip`,
`arquivo_invalido.pdf` e `limites_talhoes.json`.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17C-01 | P0 | Todos | Filtros | Abrir `Material tecnico` em uma Propriedade | Filtros principais exibem apenas Fertilidade, Correcao de solo e Prescricao | Passou | `Todos` aparece como agregador; tipos tecnicos visiveis: Fertilidade, Correcao de solo e Prescricao |
| 17C-02 | P0 | Admin/Colaborador | PNG | Acionar `Anexar PNG` | Formulario oferece apenas Fertilidade/Correcao de solo | Passou | Dropdown exibiu pH, Fosforo, Potassio, Argila, Materia organica, Calcario e Gesso; Prescricao nao apareceu |
| 17C-03 | P0 | Admin/Colaborador | ZIP | Acionar `Anexar prescrição ZIP` e selecionar `.zip` | Modal mostra tipo Prescricao, camada, safra/ano, escopo, nome original e tamanho | Passou | `prescricao_taxa_variavel_2026.zip` abriu modal com 174 B, camada Prescricao e ano 2026 |
| 17C-04 | P0 | Admin/Colaborador | ZIP | Tentar selecionar PNG/PDF/GeoJSON/JSON/SHP/KML/KMZ no fluxo ZIP | Arquivo e recusado com erro controlado | Passou | `arquivo_invalido.pdf` ficou visivel no picker, mas nao retornou para o app nem criou metadado invalido |
| 17C-05 | P0 | Admin/Colaborador | ZIP | Confirmar anexo ZIP | Card aparece como Prescricao e abre detalhe do pacote tecnico | Passou | Detalhe mostrou `Pacote tecnico ZIP`, formato ZIP, sem preview de imagem |
| 17C-06 | P1 | Admin/Colaborador | ZIP | Substituir e remover prescricao ZIP local | Lista atualiza sem afetar `Mapa.list`, PNGs ou demarcacao | Passou | Substituicao/remocao do ZIP local preservaram GeoJSON, PNG local e seed; ZIP foi reanexado para consulta do Produtor |
| 17C-07 | P0 | Produtor | Consulta | Abrir Material tecnico com prescricao visivel | Produtor ve detalhe consultivo e nao ve anexar/substituir/remover | Passou | Produtor viu PNG e ZIP com `Abrir anexo`/`Ver detalhes`; modais sem substituir/remover/anexar e ZIP sem preview |

**Rodada Fase 17B - Checklist Em Emulador Para Simplificacao Do Produtor**

Observacao geral: checklist proposto pela analise 17A para a fase 17B. Em
2026-07-01 a implementacao de UX/textos foi aplicada e o smoke visual parcial
foi executado no emulador `emulator-5554` com build debug instalada por
`npm run android`. Nao substitui validacao Android fisico e nao abre backend,
RBAC real, sync, upload remoto, download real ou pipeline produtivo.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17B-01 | P0 | Produtor | Login | Entrar como `produtor.demonstracao@example.com` | Abre em `Minhas Propriedades` sem crash | Passou | Acesso rapido `Produtor Demonstracao` abriu `Minhas Propriedades` |
| 17B-02 | P0 | Produtor | Propriedade | Abrir Sela de Prata I | Detalhe usa linguagem de consulta e preserva resumo principal | Passou | Exibiu subtitulo consultivo, `Titular`, `Materiais`, `Talhoes`, modo acompanhamento e atalhos |
| 17B-03 | P0 | Produtor | Talhoes | Abrir panorama e selecionar talhao | Talhoes renderizam e detalhe continua legivel | Reexecutar | Mapa/lista de talhoes renderizou; selecao detalhada de talhao ficou para rodada especifica |
| 17B-04 | P0 | Produtor | Mapas | Abrir Mapas/Arquivos tecnicos | Materiais aparecem sem sugerir upload/backend/sync | Passou | Tela exibiu `Consulta da Propriedade`, `Talhoes disponiveis para consulta` e materiais sem acao administrativa |
| 17B-05 | P1 | Produtor | PNG asset | Abrir anexo de fertilidade demonstrativo | Imagem abre e metadados nao confundem com acao administrativa | Reexecutar | Nao exercitado nesta rodada; confirmar anexo PNG de fertilidade como material de consulta |
| 17B-06 | P1 | Produtor | Visitas | Abrir visitas da Propriedade | Historico aparece para consulta, sem criacao/edicao | Passou | Secao `Historico de visitas` visivel com registros e sem acao de criacao |
| 17B-07 | P1 | Produtor | Caderno | Abrir caderno da Propriedade | Registros visiveis aparecem; restritos continuam ocultos | Passou | Caderno da Propriedade e Caderno global exibiram registros liberados sem `Novo Registro` |
| 17B-08 | P0 | Produtor | Rotas diretas | Tentar `NovaVisita` e `EditarVisita` por rota interna de smoke | Produtor permanece bloqueado | Reexecutar | Nao executado: coberto por teste de dominio, exige smoke visual |
| 17B-09 | P0 | Colaborador | Regressao | Abrir Propriedade do escopo e criar visita contextual | `fazenda_id` preservado e contexto travado | Reexecutar | Nao executado: validar regressao visual/funcional em emulador |
| 17B-10 | P0 | Admin | Regressao | Abrir Sela em Mapas/Arquivos tecnicos | GeoJSON/PNG locais continuam acessiveis conforme estado do emulador | Reexecutar | Nao executado: nao declarar Android fisico aprovado |

**Rodada Fase 16H.6 - Reexecucao GeoJSON Em Emulador Android SDK 56**

Observacao geral em 2026-06-11: correcao pontual aplicada ao fluxo local de
GeoJSON pos-DocumentPicker no SDK 56 e reexecutada no emulador Android
conectado ao PC (`emulator-5554`, `Pixel_Tablet`). Esta rodada substitui o
resultado falho dos casos GeoJSON da 16H.5 em emulador, mas nao substitui a
validacao final em Android fisico.

APK usado: `dist/tche-agro-mobile-2026-06-11-geojson-fix-sdk56-release.apk`.

Arquivos usados:

- `/sdcard/Download/limites_talhoes.geojson`;
- `/sdcard/Download/limites_talhoes.json`.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| APK16H5-02-R1 | P0 | Admin | GeoJSON local | Acionar `Anexar GeoJSON dos talhões` | DocumentPicker abre e lista arquivos locais compativeis | Passou | Picker Android abriu em Downloads e exibiu `.geojson`/`.json` |
| APK16H5-03-R1 | P0 | Admin | GeoJSON local | Selecionar `limites_talhoes.geojson` e confirmar associacao | GeoJSON aparece como anexado localmente | Passou | Modal leu 15 talhoes/37 partes; tela exibiu `GeoJSON anexado`, `limites_talhoes.geojson`, 15 talhoes e status ativo |
| APK16H5-04-R1 | P0 | Admin | GeoJSON local | Substituir por `limites_talhoes.json` e confirmar substituicao | JSON aparece como anexado localmente | Passou | Modal leu 15 talhoes/37 partes; tela exibiu `GeoJSON anexado`, `limites_talhoes.json`, 15 talhoes e status ativo |
| APK16H6-01 | P1 | Admin | Persistencia local | Executar force-stop, reabrir app e voltar aos mapas da Sela | GeoJSON local permanece visivel no contexto | Passou | Apos reabertura, Admin voltou sem crash; Sela abriu Mapas e `limites_talhoes.json` permaneceu anexado/ativo |

**Rodada Fase 16H.5 - DocumentPicker Em Emulador Android SDK 56**

Observacao geral em 2026-06-11: smoke complementar executado no mesmo APK SDK
56 e no emulador Android conectado ao PC (`emulator-5554`, `Pixel_Tablet`).
Esta rodada validou DocumentPicker real em emulador para PNG local e encontrou
falha funcional no anexo local de GeoJSON.

APK usado: `dist/tche-agro-mobile-2026-06-10-sdk56-release.apk`.

Arquivos usados:

- `/sdcard/Download/limites_talhoes.geojson`;
- `/sdcard/Download/limites_talhoes.json`;
- `/sdcard/Download/smoke_ph_10a20.png`.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| APK16H5-01 | P0 | Admin | Navegacao | Abrir Sela de Prata I em Mapas/Arquivos técnicos | Tela tecnica abre no contexto da Propriedade | Passou | Admin restaurou sessao; filtro `Sela` abriu a Propriedade e `Lavoura > Ver Todos` abriu Mapas |
| APK16H5-02 | P0 | Admin | GeoJSON local | Acionar `Anexar GeoJSON dos talhões` | DocumentPicker abre e lista arquivos locais compativeis | Passou | Picker Android abriu e exibiu `.geojson`/`.json` em Downloads/Recentes |
| APK16H5-03 | P0 | Admin | GeoJSON local | Selecionar `limites_talhoes.geojson` | GeoJSON aparece como anexado localmente | Falhou | App voltou para Mapas, mas continuou exibindo `Nenhum GeoJSON local anexado a esta Propriedade` |
| APK16H5-04 | P0 | Admin | GeoJSON local | Selecionar `limites_talhoes.json` | JSON aparece como anexado localmente | Falhou | Mesmo comportamento do `.geojson`: picker seleciona, tela nao atualiza estado local |
| APK16H5-05 | P0 | Admin | PNG local | Acionar `Anexar mapa PNG` e selecionar `smoke_ph_10a20.png` | Picker abre, arquivo e metadados aparecem no modal | Passou | Modal `Anexar mapa PNG` exibiu arquivo, titulo `smoke ph 10a20`, categoria `Outro` e ano `2026` |
| APK16H5-06 | P0 | Admin | PNG local | Confirmar `Anexar PNG` | PNG fica salvo localmente e aparece na tela | Passou | Tela exibiu `smoke ph 10a20`, `smoke_ph_10a20.png`, status ativo e contador `6 Materiais` |
| APK16H5-07 | P1 | Admin | Persistencia local | Executar force-stop, reabrir app e voltar aos mapas da Sela | PNG local permanece contabilizado/visivel no contexto | Passou | Apos reabertura, Admin voltou sem crash; Sela abriu Mapas e contador `6 Materiais` persistiu |

**Rodada Fase 16H.4 - Smoke Em Emulador Android SDK 56**

Observacao geral em 2026-06-11: por decisao operacional da rodada, o APK SDK
56 foi instalado e testado no emulador Android conectado ao PC
(`emulator-5554`, `Pixel_Tablet`). Esta rodada valida execucao operacional em
Android/emulador, mas nao substitui os casos que exigem Android fisico e
DocumentPicker real no aparelho.

APK usado: `dist/tche-agro-mobile-2026-06-10-sdk56-release.apk`.

Validacoes automaticas antes do smoke:

- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| APK16H4-01 | P0 | Todos | Instalacao | Instalar APK SDK 56 no emulador | Instalacao passa e app abre sem crash visivel | Passou | `adb install -r` passou com `Success`; abertura via `monkey` passou |
| APK16H4-02 | P0 | Todos | Login | Conferir tela de login | Linguagem demonstrativa/local aparece sem prometer producao | Passou | Textos `Acesso demonstrativo local` e `Acesso rapido para demonstracao` visiveis |
| APK16H4-03 | P0 | Todos | Login | Entrar manualmente como Admin, Colaborador e Produtor | Cada persona entra no perfil esperado | Passou | Admin, Colaborador de Campo e Produtor Demonstracao autenticaram com credenciais principais |
| APK16H4-04 | P0 | Admin | Dashboard | Abrir Dashboard Admin | Dashboard abre com navegacao inferior esperada | Passou | Sem tela vermelha/crash; aba `Usuarios` visivel para Admin |
| APK16H4-05 | P0 | Colaborador | Dashboard/Perfil | Abrir fluxo do Colaborador | Colaborador abre sem aba administrativa de `Usuarios` | Passou | Perfil exibiu escopo territorial e propriedades atribuidas demonstrativas |
| APK16H4-06 | P0 | Produtor | Propriedades | Abrir Minhas Propriedades | Produtor ve a Sela de Prata I vinculada | Passou | Sela aparece com Titular `Produtor Demonstracao`, 6200 ha e Soja |
| APK16H4-07 | P0 | Produtor | Detalhe da Propriedade | Abrir Sela de Prata I | Detalhe carrega contexto principal da Propriedade | Passou | Exibiu 2 visitas, 5 mapas, 1 caderno e 15 limites |
| APK16H4-08 | P0 | Produtor | Mapa/Talhoes | Abrir panorama e selecionar talhao | Mapa renderiza talhoes e selecao mostra detalhe | Passou | 15 talhoes, 1888.6 ha; `T01 - 230` exibiu 274.1 ha e safra 2025/2026 |
| APK16H4-09 | P0 | Produtor | Visitas | Abrir aba Visitas da Propriedade | Visitas demonstrativas aparecem no contexto correto | Passou | 2 visitas tecnicas visiveis; sem criacao de visita pelo Produtor |
| APK16H4-10 | P0 | Produtor | Caderno | Abrir aba Caderno da Propriedade | Registro demonstrativo aparece no contexto correto | Passou | 1 registro `Vistoria`, vinculado ao talhao T01 - 230 |
| APK16H4-11 | P1 | Todos | Sessao/Persistencia | Executar force-stop e reabrir app | Sessao local restaura sem crash | Passou | Reabriu em `Minhas Propriedades` como Produtor |
| APK16H4-12 | P0 | Admin/Colaborador | GeoJSON/PNG local | Exercitar DocumentPicker de arquivos locais | GeoJSON/PNG local anexado/substituido/removido | Nao executado | Emulador validou mapa seed/talhoes; DocumentPicker fisico segue pendente |

**Rodada Fase 16C - Build E Smoke Final Do APK**

Observacao geral em 2026-06-04: o APK `release` foi gerado e inspecionado, mas
nenhum Android fisico estava conectado/autorizado no `adb`. Casos de aparelho
permanecem em `Reexecutar`; nao liberar para campo antes da aprovacao completa.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| APK16C-01 | P0 | Todos | Build | Gerar e inspecionar APK release | APK universal, nao debuggable, pacote e versao corretos | Passou | `com.tcheagro.mobile`, `1.0.0`/`1`, SHA-256 registrado |
| APK16C-02 | P0 | Todos | Instalacao | Instalar e abrir em Android fisico | App inicia sem painel `Smoke Dev` e sem erro | Reexecutar | `adb`: `no devices/emulators found` |
| APK16C-03 | P0 | Todos | Login | Entrar manualmente com as tres credenciais | Cada persona entra no perfil esperado | Reexecutar | Depende de aparelho |
| APK16C-04 | P0 | Todos | Acesso rapido | Testar as tres opcoes demonstrativas | Cada opcao entra no perfil esperado | Reexecutar | Depende de aparelho |
| APK16C-05 | P0 | Admin | Propriedade | Criar, fechar e reabrir app | Propriedade continua salva localmente | Reexecutar | Depende de aparelho |
| APK16C-06 | P0 | Admin | Usuario | Criar, fechar e reabrir app | Usuario continua salvo e nao autentica | Reexecutar | Depende de aparelho |
| APK16C-07 | P0 | Admin/Colaborador | Visita/Caderno | Criar registros, fechar e reabrir app | Registros continuam salvos com `fazenda_id` | Reexecutar | Depende de aparelho |
| APK16C-08 | P0 | Todos | Sela de Prata I | Abrir propriedade, mapa e talhoes | Consulta principal funciona | Reexecutar | Depende de aparelho |
| APK16C-09 | P0 | Todos | Mapas/Arquivos tecnicos | Abrir biblioteca e PNGs internos | Materiais preparados abrem sem sugerir upload/storage | Reexecutar | Depende de aparelho |
| APK16C-10 | P0 | Todos | Offline | Repetir consulta e cadastros sem internet | Dados locais e assets internos continuam disponiveis | Reexecutar | Tiles online podem degradar; depende de aparelho |

**Rodada Fase 16B - Cadastros E Mock Realista Para Campo**

Observação geral: esta rodada valida o pacote demonstrativo da Fase 16B. Ela
nao implementa backend, login real, RBAC real, upload remoto, sincronizacao ou
migracao de `fazenda_id`/`fazendaId`.

Na 16B.2, Usuario, vinculos, Propriedade, Visita, Caderno e metadados de Mapa
passaram a usar persistencia local em `AsyncStorage`. Arquivos, limites/talhoes,
autenticacao e sincronizacao continuam fora do snapshot.

Na 16B.3, `MapasScreen` passou a priorizar titulo, descricao e consulta dos
materiais preparados. A associacao interna de referencia e os campos visiveis
de URL, formato, tamanho e origem foram removidos da experiencia de campo.

Na 16B.4, os cadastros de Propriedade e Usuario passaram a explicar o
salvamento local e seus limites. Telefone/documento sao opcionais, Usuario
administrativo nao cria login real e os perfis/vinculos continuam
demonstrativos.

Na 16B.5, a tela de Login e o acesso rapido passaram a usar linguagem
demonstrativa/local e os mesmos nomes das tres personas principais.

Credenciais principais alinhadas na 16B.1 e preservadas na 16B.5:

- Admin Demonstração: `admin.demonstracao@example.com` / `admin123`
- Colaborador de Campo: `colaborador.campo@example.com` / `colab123`
- Produtor Demonstração: `produtor.demonstracao@example.com` / `prod123`

| ID | Criticidade | Perfil | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| APK16B-01 | P0 | Todos | Dados demonstrativos | Conferir as credenciais principais de Admin, Colaborador e Produtor | As três personas são claramente demonstrativas e não expõem telefone/documento pessoal real | Reexecutar | Seed e rótulos do acesso rápido alinhados |
| APK16B-02 | P0 | Produtor | Sela de Prata I | Abrir a Propriedade principal e conferir Titular/Usuario | Nome do Usuario/Titular não é confundido com nome da Propriedade | Reexecutar | Esperado: Produtor Demonstração; não inserir Titular real |
| APK16B-03 | P0 | Todos | Sela de Prata I | Conferir área cadastrada e área coberta pelos talhões | Diferença entre área total e área mapeada está confirmada/explicada ou registrada como pendência | Reexecutar | Mock atual: 6200 ha; manifesto: 1888,6 ha |
| APK16B-04 | P0 | Produtor/Colaborador/Admin | Fluxo principal | Abrir mapa, anexos, visitas e caderno da Sela de Prata I | Os quatro grupos possuem dados coerentes no contexto de `p_sela1` | Reexecutar | Seed e teste automatizado preparados; preservar `fazenda_id` |
| APK16B-05 | P0 | Todos | Visitas/Caderno | Conferir os exemplos principais | Datas são estáveis, textos são neutros, talhões são coerentes e fotos externas não são necessárias | Reexecutar | Registros principais adicionados na 16B.1; não tratar conteúdo mock como recomendação real |
| APK16B-06 | P0 | Admin/Colaborador | Mapas/Arquivos técnicos | Abrir a biblioteca no APK de campo | Consulta é priorizada, título/descrição têm destaque e nenhuma ação sugere associação, upload/download real, Drive ou storage | Reexecutar | Implementado na 16B.3; conferir ausência da ação interna |
| APK16B-07 | P0 | Admin | Nova Propriedade | Criar Propriedade com Titular existente e campos mínimos | Salva localmente preservando Titular, Região, Microregião e contratos legados | Reexecutar | Titular existente é o caminho principal; Novo Titular é alternativa demonstrativa |
| APK16B-08 | P1 | Admin | Usuários | Abrir Novo Usuario e detalhe | Fluxo explica salvamento local; telefone/documento são opcionais; Usuario criado não autentica | Reexecutar | Perfis e cadastro rápido são demonstrativos |
| APK16B-09 | P0 | Todos | LGPD | Revisar telas e detalhes do pacote principal | Nenhum dado pessoal real não autorizado, foto imprevisível ou endereço sensível aparece | Reexecutar | Cadastros seed minimizados; confirmar autorização de nome, limites, localização e anexos da Sela de Prata I |
| APK16B-10 | P0 | Todos | Persistência local | Criar Usuario, Propriedade, Visita e Caderno; fechar e abrir o app | Cadastros continuam disponíveis, preservando ids, vínculos e `fazenda_id` sem sincronização | Reexecutar | Implementado na 16B.2; validar em Android físico |
| APK16B-11 | P0 | Admin/Dev controlado | Restaurar demonstração | Executar `MockLocalData.restoreSeed()` em ambiente controlado e reabrir o app | Alterações locais são removidas e Sela de Prata I volta ao pacote inicial | Reexecutar | Sem botão visual nesta fase; ação destrutiva controlada |
| APK16B-12 | P1 | Admin/Dev controlado | Mapas locais | Alterar metadado mockado de Mapa pela camada controlada, fechar e abrir o app | Metadado continua disponível; nenhum arquivo físico é copiado ou enviado | Reexecutar | Persistência cobre somente metadados estruturados; associação interna não aparece na tela |
| APK16B-13 | P0 | Admin | Editar Propriedade | Alterar nome, Área total informada ou campo opcional e salvar | Alteração fica salva localmente; Titular, Região e Microregião não podem ser trocados | Reexecutar | Implementado visualmente na 16B.4; validar em Android físico |
| APK16B-14 | P1 | Admin | Detalhe de Usuario | Abrir Usuario sem telefone/documento | Campos vazios não recebem destaque e a tela explica que vínculos/perfis são demonstrativos | Reexecutar | Cadastro não cria login ou RBAC real |
| APK16B-15 | P0 | Todos | Login/Acesso rápido | Abrir a tela de Login e expandir o acesso rápido | Tela usa `Acesso rápido para demonstração` e exibe Admin Demonstração, Colaborador de Campo e Produtor Demonstração | Reexecutar | Não deve aparecer `dev`, Bruna, Marcos ou Sela como rótulo de acesso |
| APK16B-16 | P0 | Todos | Login/Acesso rápido | Entrar pelas três opções rápidas e pelas credenciais principais | Cada persona entra no perfil esperado; nenhuma opção cria ou promete autenticação real | Reexecutar | Usuário criado no Admin continua fora do `authMock` |

**Rodada Fase 16A - APK Demonstrável Para Campo**

Observação geral: esta rodada valida a entrega demonstrável em celular Android.
O diagnóstico completo, riscos e checklists estão em
`docs/project/fase-16a-apk-demonstravel.md`. Não implementar backend, RBAC real,
refatoração de rotas/payloads ou remoção de compatibilidade legada durante esta
rodada.

| ID | Criticidade | Perfil | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| APK16A-01 | P0 | Todos | Build | Instalar APK em aparelho Android físico | App abre sem painel `Smoke Dev` e sem erro inicial | Reexecutar | Build deve ser de entrega, não modo `__DEV__` |
| APK16A-02 | P0 | Todos | Login | Entrar como Admin, Colaborador e Produtor | Três perfis entram e navegam para tabs corretas | Reexecutar | Login continua mockado |
| APK16A-03 | P0 | Produtor | Fluxo principal | Abrir Propriedade Sela de Prata I, mapa de talhões, anexos, visitas e caderno | Fluxo de consulta funciona e textos usam `Propriedade` | Reexecutar | Validar PNGs internos de fertilidade |
| APK16A-04 | P0 | Colaborador | Campo | Abrir Propriedades do escopo, criar visita contextual e criar caderno | Registros salvam no mock preservando contexto de Propriedade | Reexecutar | Sem prometer persistência real |
| APK16A-05 | P0 | Admin | Cadastros | Criar/editar Propriedade e criar usuários Produtor, Colaborador e Administrador | Cadastros funcionam como MVP visual/mockado | Reexecutar | Usuário criado não vira login real |
| APK16A-06 | P0 | Admin/Colaborador | Mapas | Abrir Mapas/Arquivos técnicos, filtrar Fertilidade/Safra/Talhão e abrir anexo | Consulta visual funciona; associação interna não aparece no fluxo de campo | Reexecutar | Sem upload/storage/Drive real |
| APK16A-07 | P0 | Todos | LGPD | Conferir dados mockados visíveis durante demonstração | Nenhum dado pessoal real sensível é exposto sem autorização | Reexecutar | Ver nomes, e-mails, telefones, endereços e coordenadas |
| APK16A-08 | P1 | Todos | Conectividade | Testar com internet instável ou desligada | App mantém consulta de assets internos; recursos online podem degradar sem parecer erro de produto final | Reexecutar | Tiles externos e URLs mockadas podem depender de rede |
| APK16A-09 | P1 | Todos | Comunicação | Explicar ao tester o que é mock antes do uso | Tester entende que APK é demonstrável e não sistema produtivo | Reexecutar | Evita coleta real indevida |

**Rodada Fase 14D - Semântica De Propriedades Atribuídas**

Observação geral: esta rodada valida a decisão documental do MVP mockado. Não
deve alterar mocks, telas, rotas, permissões ou comportamento funcional.
`propriedades_atribuidas` é vínculo visual/admin preparatório e não RBAC
efetivo por propriedade.

| ID | Criticidade | Perfil | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| RBAC-01 | P0 | Admin | Propriedades | Entrar como admin e abrir a listagem de Propriedades | Admin vê todas as Propriedades disponíveis no mock | Reexecutar | Regra efetiva atual: acesso amplo |
| RBAC-02 | P0 | Produtor | Minhas Propriedades | Entrar como produtor e abrir suas Propriedades | Produtor vê apenas Propriedades vinculadas por titular/produtor compatível | Reexecutar | Preservar compatibilidade com `produtor_id`, `proprietario_id` e aliases de titular |
| RBAC-03 | P0 | Colaborador | Propriedades | Entrar como colaborador com `sub_regioes` e abrir Propriedades | Colaborador vê Propriedades do escopo regional de `sub_regioes` | Reexecutar | `sub_regioes` tem prioridade |
| RBAC-04 | P0 | Colaborador | Propriedades | Validar colaborador sem `sub_regioes` e com `vinculos_microregioes` por teste diagnóstico ou cenário mockado controlado | Colaborador vê Propriedades da microregião de fallback | Reexecutar | Fallback coberto por teste automatizado quando não houver login manual correspondente |
| RBAC-05 | P0 | Admin/Colaborador | Usuários/Propriedades | Atribuir ou conferir `propriedades_atribuidas` no Admin e depois validar acesso efetivo do colaborador | Propriedade atribuída aparece como vínculo visual/admin, mas não restringe nem amplia acesso efetivo | Reexecutar | Risco principal: confundir Admin visual com RBAC real |
| RBAC-06 | P1 | Colaborador | Visitas/Caderno | Abrir visitas e caderno dentro e fora do escopo regional | Acesso respeita escopo regional efetivo; propriedade atribuída direta não deve liberar fora do escopo | Reexecutar | Conferir rotas diretas quando possível |

**Rodada Fase 14F - Matriz Futura De Aceite RBAC/Backend**

Observação geral: esta rodada não é execução funcional do MVP. Ela serve para
conferir se a documentação futura de RBAC/backend cobre os critérios mínimos
antes de uma implementação real. O MVP atual continua mockado e sem RBAC de
backend.

| ID | Criticidade | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|
| RBACF-01 | P0 | Documento | Abrir `docs/project/matriz-rbac-backend.md` | Documento separa regra atual do MVP, regra futura e fora de escopo | Reexecutar | Não deve prometer implementação atual |
| RBACF-02 | P0 | Perfis | Conferir matriz por perfil | Admin, Produtor e Colaborador têm escopo futuro descrito | Reexecutar | Colaborador deve ser microregião OU atribuição direta |
| RBACF-03 | P0 | Ações | Conferir matriz por ação | Listar, detalhe, mapas/anexos, visitas, caderno, cadastro e usuários/vínculos aparecem na matriz | Reexecutar | Critério de aceite futuro |
| RBACF-04 | P0 | Casos positivos | Conferir casos positivos | Admin global, Produtor vinculado, Colaborador por microregião e Colaborador por atribuição direta estão cobertos | Reexecutar | Inclui fora da microregião por atribuição direta futura |
| RBACF-05 | P0 | Casos negativos | Conferir casos negativos | Produtor fora do titular, Colaborador sem vínculo, usuário inativo/pendente e rota direta fora de escopo estão cobertos | Reexecutar | Backend deve negar de forma segura |
| RBACF-06 | P0 | Aceite backend | Conferir critérios de backend | Validação no backend, ids canônicos, vínculos persistentes, auditoria, status de vínculo e testes automatizados estão registrados | Reexecutar | Não substituir por validação só de frontend |

**Rodada Fase 14H - Testes De Contrato/API RBAC**

Observação geral: esta rodada é documental. Ela confere se
`docs/project/testes-contrato-api-rbac.md` cobre a matriz futura de testes de
API/backend. Não deve ser executada como smoke funcional do MVP mockado.

| ID | Criticidade | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|
| RBACH-01 | P0 | Documento | Abrir `docs/project/testes-contrato-api-rbac.md` | Documento declara que não implementa backend e que o MVP continua mockado | Reexecutar | Separar contrato futuro de comportamento atual |
| RBACH-02 | P0 | Endpoints | Conferir grupos de endpoints | Auth, usuários, propriedades, vínculos, permissões, mapas/anexos, visitas e caderno estão cobertos | Reexecutar | Mesmos grupos de `contrato-api-rbac.md` |
| RBACH-03 | P0 | Status HTTP | Conferir estratégia de status | `200`, `201`, `400`, `401`, `403`, `404` e `409` aparecem com uso esperado | Reexecutar | Inclui regra de `404` para não revelar recurso |
| RBACH-04 | P0 | Positivos | Conferir casos positivos | Admin global, Produtor vinculado, Colaborador por microregião, Colaborador por atribuição direta e `/me/permissoes` estão cobertos | Reexecutar | Futuro backend |
| RBACH-05 | P0 | Negativos | Conferir casos negativos | Não autenticado, sem permissão, outro titular, sem vínculo, inativo/pendente, payload inválido, conflito e inexistente estão cobertos | Reexecutar | Futuro backend |
| RBACH-06 | P1 | Escopo | Conferir classificação dos testes | Documento separa automatizados de backend, smoke/manual e casos fora do MVP mockado | Reexecutar | Não transformar em requisito funcional atual |

**Rodada Fase 14I - Fechamento RBAC**

Observação geral: esta rodada é documental. Ela confere se
`docs/project/fechamento-fase-14-rbac.md` serve como índice curto da Fase 14 e
não deve ser executada como smoke funcional do MVP mockado.

| ID | Criticidade | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|
| RBACI-01 | P0 | Documento | Abrir `docs/project/fechamento-fase-14-rbac.md` | Documento resume objetivo, diagnóstico, regra atual, regra futura e pendências | Reexecutar | Índice de consulta |
| RBACI-02 | P0 | MVP atual | Conferir regra atual | Admin vê tudo, Produtor vê por vínculo compatível, Colaborador vê por `sub_regioes` ou fallback `vinculos_microregioes` | Reexecutar | `propriedades_atribuidas` segue visual/preparatório |
| RBACI-03 | P0 | Futuro backend | Conferir regra futura | Admin global, Produtor por vínculo/titularidade, Colaborador por microregião OU Propriedade atribuída | Reexecutar | Regra aditiva |
| RBACI-04 | P1 | Navegação | Conferir arquivos listados | Matriz RBAC, contrato API, testes de contrato/API, pendências, roadmap e smoke estão referenciados | Reexecutar | Roteiro consolidado |

**Rodada Cadastros - Padronização Visual/Textual Do Bloco 5C**

Observação geral: esta rodada valida apenas rótulos, títulos, subtítulos, seções,
mensagens de ajuda e leitura visual dos fluxos de cadastro. Não deve validar
mudança de payload, mock, rotas, permissões, contratos, helpers técnicos,
autenticação ou backend.

| ID | Criticidade | Perfil | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| CAD-01 | P0 | Admin | Usuários | Acessar Admin -> Usuários e abrir Novo/Editar Usuário | Perfis aparecem como `Produtor`, `Colaborador` e `Administrador`; seções usam `Dados do usuário demonstrativo` e `Perfil demonstrativo` | Reexecutar | Valor interno `admin` deve permanecer invisível como label principal |
| CAD-02 | P0 | Admin | Usuário Produtor | Criar/editar usuário com perfil Produtor | Seção `Vínculos do Produtor` aparece; texto deixa claro que Produtor é perfil de usuário; vínculos são com `Propriedades` | Reexecutar | Não confundir nome do usuário com nome da propriedade |
| CAD-03 | P0 | Admin | Cadastro rápido | No usuário Produtor, acionar cadastro rápido de propriedade quando disponível | Cadastro rápido aparece como propriedade visual/mockada; campos da propriedade ficam separados dos dados do usuário | Reexecutar | Não criar interpretação de backend, login real ou transação real |
| CAD-04 | P0 | Admin | Usuário Colaborador | Criar/editar usuário com perfil Colaborador | Seção `Escopo do Colaborador` aparece com Região, Microregião e Propriedades atribuídas; texto indica escopo territorial/propriedades | Reexecutar | Conferir que a tela não promete alteração da permissão real |
| CAD-05 | P0 | Admin | Usuário Administrador | Criar/editar usuário com perfil Administrador | Seção `Dados administrativos` aparece; label visível usa `Administrador`; valor interno `admin` não aparece para o usuário | Reexecutar | Não alterar valor interno do perfil |
| CAD-06 | P0 | Admin | Propriedades | Acessar listagem de propriedades | Tela/listagem aparece como `Propriedades`; ação principal aparece como `Nova Propriedade`; conferir leitura de Titular, Região, Microregião, Área e Status quando disponíveis | Reexecutar | Arquivo/componente atual: `PropriedadesScreen`; rota técnica admin: `Propriedades` |
| CAD-07 | P0 | Admin | Nova Propriedade | Abrir cadastro de Nova Propriedade | Tela explica salvamento local, usa `Área total informada` e apresenta Titular existente como caminho principal | Reexecutar | Cidade, UF e cultura são opcionais; Novo Titular é demonstrativo |
| CAD-08 | P0 | Admin | Nova Propriedade | Preencher e salvar Nova Propriedade com dados válidos | Salvamento continua funcionando com os campos técnicos antigos preservados | Reexecutar | Preservar `fazenda_id`, `produtor_id`, `proprietario_id`, `fazendaNome` e `fazendaId` |
| CAD-09 | P0 | Admin | Editar Propriedade | Abrir edição de propriedade existente | Tela explica salvamento local, usa `Área total informada` e mantém Titular/Região/Microregião bloqueados | Reexecutar | Cidade, UF e cultura permanecem opcionais |
| CAD-10 | P0 | Admin | Editar Propriedade | Alterar dados permitidos e salvar | Salvamento continua funcionando sem trocar titular, rota, mock, payload ou permissão | Reexecutar | Validar apenas comportamento existente |
| CAD-11 | P1 | Produtor | Fluxo produtor | Entrar como produtor e abrir suas propriedades | Produtor vê suas `Propriedades`; não aparece `Fazenda` como texto principal; detalhe, mapa, anexos e caderno continuam acessíveis | Reexecutar | Nomes próprios como `Fazenda Sela de Prata I` podem permanecer |
| CAD-12 | P1 | Colaborador | Fluxo colaborador | Entrar como colaborador e abrir propriedades do escopo | Colaborador vê propriedades do escopo; Nova Visita continua funcionando; textos de escopo visual não prometem RBAC por propriedade atribuída | Reexecutar | `sub_regioes` ou fallback `vinculos_microregioes`; `propriedades_atribuidas` não amplia permissão efetiva |
| CAD-13 | P0 | Todos | Regressão rápida | Executar login produtor, colaborador e administrador | Três logins continuam funcionando nos fluxos esperados | Reexecutar | Usar usuários mockados existentes |
| CAD-14 | P0 | Todos | Regressão rápida | Abrir Mapas, Anexos de fertilidade, Visitas, Caderno e Perfil | Fluxos continuam abrindo e preservam linguagem principal de Propriedade quando aplicável | Reexecutar | Não deve haver regressão por padronização textual |

Cobertura confirmada em 2026-06-02: este checklist cobre criacao/edicao de
usuario Produtor, Colaborador e Administrador; Nova Propriedade; Editar
Propriedade; vinculos do Produtor; e escopo do Colaborador. A rodada continua
limitada a validacao manual dos fluxos mockados, sem assumir backend,
transacao real, RBAC final por propriedade ou integridade referencial real.

Atualizacao tecnica em 2026-06-02: as rotas de stack de criacao/edicao foram
migradas para `NovaPropriedade` e `EditarPropriedade`. As rotas tecnicas das
tabs foram migradas para `Propriedades` e `PropriedadesColaborador`, mantendo o
label visual `Propriedades` nas duas tabs.

**Rodada Compatibilidade - Aliases De Propriedade E Titular**

Observação geral: esta rodada valida apenas que a compatibilidade dupla
aditiva de Propriedade/Titular não quebrou fluxos existentes. Não deve validar
backend, contrato real, migração definitiva, remoção de legados ou mudança de
permissão.

| ID | Criticidade | Perfil | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| ALIAS-01 | P0 | Admin | Nova Propriedade | Criar Nova Propriedade com dados válidos e voltar para a listagem | Propriedade criada continua aparecendo e abrindo na listagem de `Propriedades` | Reexecutar | Aliases futuros não devem quebrar `fazenda_id`, `produtor_id` ou `proprietario_id` |
| ALIAS-02 | P0 | Admin | Editar Propriedade | Editar propriedade existente e abrir o detalhe após salvar | Detalhe continua abrindo com leitura correta de Propriedade e Titular | Reexecutar | Aliases não devem trocar titular, rota, payload ou permissão |
| ALIAS-03 | P0 | Produtor | Propriedades vinculadas | Entrar como produtor e abrir suas propriedades | Produtor continua vendo somente suas `Propriedades` vinculadas | Reexecutar | Preservar leitura por vínculo/titular legado |
| ALIAS-04 | P0 | Colaborador | Propriedades do escopo | Entrar como colaborador e abrir propriedades do escopo | Colaborador continua vendo propriedades dentro do escopo esperado | Reexecutar | Não tratar `propriedades_atribuidas` como RBAC final |
| ALIAS-05 | P0 | Todos | Visitas e Caderno | Abrir/criar quando aplicável Visitas e Caderno no contexto da propriedade | Fluxos continuam funcionando com `fazenda_id` preservado | Reexecutar | Payloads de visita/caderno ainda podem usar `fazenda_id` |
| ALIAS-06 | P0 | Todos | Mapas e anexos | Abrir Mapas, mapa dos talhões e anexos de fertilidade | Mapas/anexos continuam abrindo sem regressão de filtros, permissões ou download | Reexecutar | Preservar `fazenda_id` e compatibilidade de mapas/anexos |

**Rodada Visual - Padronização Com Componentes-Base**

Observação geral: esta rodada valida apenas consistência visual e preservação de comportamento. Não envolve backend, mocks, rotas, permissões, payloads ou renomeação técnica de `Produtor`/`Fazenda`.

Componentes-base envolvidos: `FormField`, `FormFooter`, `SectionCard`, `InfoBox`, `EmptyState`, `SearchBar`, `SegmentedChips` e `RadioCardGroup`.

| ID | Criticidade | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|
| V-01 | P1 | Formulários | Abrir `NovoCadernoScreen`, `EditarCadernoScreen`, `NovaVisitaScreen`, `EditarVisitaScreen`, `EditarPropriedadeScreen`, `NovaPropriedadeScreen`, `NovoUsuarioScreen` e `EditProfileScreen` | Campos, seções e rodapés usam componentes-base sem alterar payloads, permissões ou rotas | Reexecutar | Em `NovoUsuarioScreen`, conferir `SectionCard`, `FormField`, `FormFooter`, `InfoBox` e `SegmentedChips` nos grupos equivalentes |
| V-02 | P1 | Detalhes | Abrir `ProdutorScreen`, `UsuarioDetailScreen`, `PerfilScreen` e telas relacionadas | Seções, avisos e estados vazios usam padrão visual sem expor campo técnico cru como informação principal | Reexecutar | Preservar linguagem `Propriedade` quando aplicável |
| V-03 | P1 | Listagens | Abrir `CadernoCampoScreen`, `VisitasScreen`, `UsuariosScreen` e `MapasScreen` | Busca, chips/filtros equivalentes e estados vazios usam componentes-base sem mudar filtros existentes | Reexecutar | Em `MapasScreen`, conferir `SearchBar`, `EmptyState`, `SegmentedChips`, `SectionCard` e `InfoBox`; preservar navegação para detalhe/novo registro |
| V-04 | P1 | Propriedades | Abrir `PropriedadesScreen` pelas rotas `Propriedades` e `PropriedadesColaborador` | Listagem principal continua visível como `Propriedades` para admin e colaborador | Reexecutar | `PropriedadesColaborador` é rota técnica; label visual permanece `Propriedades` |
| V-05 | P0 | Regressão | Exercitar filtros, busca, limpeza de filtros e navegação nas listagens padronizadas | Resultado funcional idêntico ao comportamento anterior, apenas com composição visual padronizada | Reexecutar | Conferir status, período, ordenação e escopo |
| V-06 | P0 | Admin/Usuários | Abrir `NovoUsuarioScreen` e alternar entre perfis produtor, colaborador e admin | Blocos condicionais, validações e salvamento permanecem iguais; muda apenas a composição visual | Reexecutar | Preservar `buildUsuarioAdminPayload`, `buildUsuarioFormFromMock`, `Produtor.create`, `vinculos_propriedades`, `vinculos_microregioes` e campos legados |
| V-07 | P0 | Mapas | Abrir `MapasScreen`, exercitar busca, categoria, ordenação, safra, talhão, contexto de propriedade, mapa dos talhões e anexos | Materiais, demarcações, previews e navegação mantêm comportamento; ação interna de associação não aparece | Reexecutar | Preservar `ShapeRenderer`, `FazendaMapaScreen`, `MapaFazendaView`, `buildFazendaMapaRouteParams`, `avaliarDownloadMapa`, `ConfirmDialog`, preview de asset interno, permissões, filtros de acesso, mocks, rotas, payloads e campos legados |

**Rodada Mapas - Anexos De Fertilidade**

Observacao geral: esta rodada valida apenas a nomenclatura visual e a leitura defensiva de metadados ja existentes no mock. Nao envolve backend, upload, storage, Drive, rotas, permissoes, filtros, contratos ou integracao do tipo `AnexoFertilidade`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| M-01 | P0 | Produtor/Admin/Colaborador | Propriedade Sela de Prata I acessivel | Abrir `MapasScreen` no contexto da propriedade | A secao de fertilidade aparece como `Anexos de fertilidade` quando aplicavel | Reexecutar | Nao deve alterar permissao nem filtro |
| M-02 | P0 | Produtor/Admin/Colaborador | `MapasScreen` com filtro Fertilidade | Conferir os cinco PNGs da Sela de Prata I | Itens aparecem como `Anexo de fertilidade`, priorizam título/descrição e mostram contexto operacional sem destacar formato ou tamanho | Reexecutar | Usa metadados existentes com fallback; URL e origem não ficam visíveis |
| M-03 | P0 | Produtor/Admin/Colaborador | Anexo de fertilidade disponivel | Tocar em `Abrir anexo` | Preview/abertura do anexo continua funcionando como antes | Reexecutar | Preservar `avaliarDownloadMapa` e preview de asset interno |
| M-04 | P1 | Produtor/Admin/Colaborador | Existem materiais de categorias diferentes | Alternar categorias/filtros | Materiais tecnicos genericos continuam separados dos anexos de fertilidade | Reexecutar | `Material tecnico` nao deve substituir `Anexo de fertilidade` |
| M-05 | P1 | Produtor/Admin/Colaborador | Lista de materiais aberta | Exercitar busca por elemento, safra, talhao/propriedade e nome original | Busca e filtros continuam com comportamento anterior | Reexecutar | Sem mudanca de contrato ou payload |

**Rodada Colaborador - Microfase Para Teste Interno**
Login principal de teste: `carlos@agrotche.com` / `colab123`.

| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| C-01 | P0 | Colaborador | Login `carlos@agrotche.com` / `colab123` | Entrar no app | Abre fluxo do colaborador com Home, Propriedades, Visitas, Caderno e Perfil | Reexecutar | Microfase validada tecnicamente; pendente teste manual interno |
| C-02 | P0 | Colaborador | Home aberta | Abrir listagem principal | Listagem visível favorece `Propriedades` pela rota técnica `PropriedadesColaborador` | Reexecutar | Preservar `fazenda_id` e motor de permissões |
| C-03 | P0 | Colaborador | Propriedade dentro do escopo | Abrir detalhe -> Visitas Técnicas -> Nova Visita | `NovaVisita` abre com propriedade pré-selecionada e travada | Reexecutar | Usa `fazendaId` opcional por rota |
| C-04 | P0 | Colaborador | Nova visita aberta pelo detalhe | Preencher e salvar visita | Visita salva no mock com a propriedade contextual e respeita escopo | Reexecutar | Sem backend real |
| C-05 | P0 | Colaborador | Aba/listagem Visitas aberta | Tocar em Nova Visita global | Seletor normal de propriedade permanece disponível | Reexecutar | Fluxo global não deve ficar travado |
| C-06 | P0 | Colaborador | Propriedade fora do escopo | Tentar criar visita por rota/contexto direto | Acesso bloqueado; não cria visita fora do escopo | Reexecutar | Regra por região/sub-região |
| C-07 | P1 | Colaborador | Mapas/Arquivos técnicos aberto | Consultar materiais preparados | Interface prioriza consulta e não exibe associação interna, upload/storage/Drive/backend/cadastro real | Reexecutar | Arquivo é recurso previamente preparado |
| C-08 | P1 | Colaborador | Mapas sem dados em algum contexto | Ver mensagens vazias | Empty states diferenciam ausência de demarcação/talhões e ausência de materiais técnicos/anexos | Reexecutar | Mensagens simples para teste interno |
| C-09 | P1 | Produtor | Fluxo do produtor disponível | Conferir detalhe, visitas, mapas e caderno | Produtor não ganha criação de visita nem acesso administrativo a Material Técnico | Reexecutar | Risco de regressão baixo, mas deve ser conferido |

**Rodada Admin -> Usuarios - Microfase Backend-Ready Mockada**
Login principal de teste: usuario admin mockado disponivel no app.

Observacao geral: esta rodada valida apenas o MVP visual/mockado. Usuario criado ou editado em `Admin -> Usuarios` nao cria login real, senha real, convite, reset, sessao, API ou banco.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| U-01 | P0 | Admin | Login admin ativo | Abrir Admin -> Usuarios -> Novo Usuario | Formulario identifica nome/e-mail como obrigatórios e telefone/documento/observações como opcionais | Reexecutar | Cadastro local demonstrativo; não usar dados reais desnecessários |
| U-02 | P0 | Admin | Novo Usuario aberto | Criar produtor ativo com ao menos uma propriedade vinculada | Usuario produtor e criado no mock; detalhe mostra propriedade vinculada, tipo de vinculo e principal | Reexecutar | Pode ter multiplas propriedades |
| U-03 | P0 | Admin | Novo Usuario aberto | Tentar criar produtor ativo sem propriedade vinculada | Salvamento bloqueado com aviso de vinculo obrigatorio | Reexecutar | Produtor ativo exige propriedade |
| U-04 | P0 | Admin | Novo Usuario aberto | Criar produtor pendente sem propriedade vinculada | Usuario pendente e criado no mock sem propriedade | Reexecutar | Pendente pode aguardar vinculo |
| U-05 | P0 | Admin | Novo Usuario aberto | Criar colaborador ativo com regiao e microregiao/sub-regiao | Usuario colaborador e criado; detalhe mostra microregiao/sub-regiao | Reexecutar | Usa relacao visual `usuario_microregiao` |
| U-06 | P0 | Admin | Novo Usuario aberto | Criar colaborador ativo com propriedade atribuida e sem microregiao | Usuario colaborador e criado; detalhe mostra propriedade atribuida | Reexecutar | Nao altera permissao efetiva |
| U-07 | P0 | Admin | Novo Usuario aberto | Tentar criar colaborador ativo sem microregiao e sem propriedade atribuida | Salvamento bloqueado por falta de escopo | Reexecutar | Escopo minimo obrigatorio no mock |
| U-08 | P0 | Admin | Novo Usuario aberto | Criar admin sem propriedade e sem microregiao | Usuario admin e criado; detalhe mostra acesso global e nivel administrativo | Reexecutar | Admin nao exige vinculos operacionais |
| U-09 | P0 | Admin | Existe usuario com e-mail conhecido | Tentar criar novo usuario com mesmo e-mail | Salvamento bloqueado por e-mail duplicado | Reexecutar | E-mail unico ao criar |
| U-10 | P0 | Admin | Usuario existente aberto em edicao | Salvar mantendo o proprio e-mail | Edicao permitida, sem falso bloqueio de e-mail duplicado | Reexecutar | Ignora o proprio usuario |
| U-11 | P0 | Admin | Existem ao menos dois usuarios | Editar um usuario usando e-mail de outro usuario | Salvamento bloqueado por e-mail duplicado | Reexecutar | E-mail unico ao editar |
| U-12 | P1 | Admin | Usuario criado pela tela admin | Tentar usar esse usuario como login real | Login real nao deve existir nesta fase | Reexecutar | Auth mock permanece separado |
| U-13 | P1 | Admin/Colaborador | Colaborador com propriedade atribuida visualmente | Entrar no fluxo efetivo do colaborador e verificar permissao | Vinculo visual nao amplia permissao efetiva fora do motor atual | Reexecutar | Nao altera `acessoControle` |
| U-14 | P1 | Admin | Usuario existente aberto em detalhe | Conferir textos visiveis | Nao exibe ID tecnico cru como informacao principal; usa termos Documento, Propriedades, Micro-regioes e Nivel administrativo | Reexecutar | Preservar nomes internos apenas onde necessario |
| U-15 | P1 | Admin | Usuario sem telefone/documento aberto em detalhe | Conferir Dados do usuário | Telefone/documento vazios não aparecem como linhas principais; tela informa que são opcionais | Reexecutar | Não altera payload nem validação |

**Rodada Admin - Sincronizacao Territorial E Vinculos Visuais Mockados**

Login principal de teste: usuario admin mockado disponivel no app.

Observacao geral: esta rodada valida apenas a sincronizacao visual/mockada Regiao -> Microregiao -> Propriedade. Nao ha backend, banco, API real, autenticacao real, RBAC completo, upload/storage, Drive, CRUD real de regioes/microregioes ou migracao do `acessoControle`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| T-01 | P0 | Admin | Admin -> Usuarios -> Novo Usuario aberto | Selecionar perfil Colaborador e escolher uma microregiao | Colaborador aceita microregiao derivada do mock territorial | Reexecutar | Usa `territorioCompat`; preserva campos legados |
| T-02 | P0 | Admin | Novo Usuario com perfil Colaborador | Selecionar duas ou mais microregioes | Tela mantem multiplas microregioes selecionadas | Reexecutar | Preparacao visual para `usuario_microregiao` |
| T-03 | P0 | Admin | Novo Usuario com perfil Colaborador | Atribuir propriedade especifica ao colaborador | Propriedade atribuida aparece como vinculo visual do mock | Reexecutar | Nao deve alterar permissao efetiva |
| T-04 | P0 | Admin | Colaborador com microregiao selecionada | Conferir previa de propriedades abrangidas | Tela mostra propriedades abrangidas pela microregiao selecionada | Reexecutar | Previa visual, nao filtro de permissao real |
| T-05 | P0 | Admin | Cadastro de Nova Propriedade aberto | Selecionar Regiao e Microregiao derivadas do mock | Formulario aceita selecao e continua salvando `regiao`/`microregiao` textuais | Reexecutar | Compatibilidade legada preservada |
| T-06 | P1 | Admin | Nova Propriedade com microregiao selecionada | Conferir colaboradores sugeridos | Tela sugere colaboradores compativeis com a microregiao | Reexecutar | Sugestao visual por `sub_regioes`/`usuario_microregiao` |
| T-07 | P0 | Admin | Novo Usuario com perfil Produtor | Selecionar propriedade que ja possui produtor principal no mock | Tela exibe alerta de outro produtor principal/titularizacao existente | Reexecutar | Nao reassocia titular automaticamente |
| T-08 | P1 | Admin | Detalhe de propriedade aberto | Conferir bloco de vinculos visuais | Detalhe mostra usuario produtor vinculado e colaboradores sugeridos/relacionados ao territorio | Reexecutar | Bloco administrativo/mockado |
| T-09 | P0 | Admin/Colaborador | Colaborador com propriedade atribuida visual nova | Entrar no fluxo efetivo do colaborador e tentar acessar fora do escopo regional | Propriedade atribuida visual nao altera permissao efetiva nem amplia acesso fora do escopo regional | Reexecutar | Regra efetiva: `sub_regioes` ou fallback `vinculos_microregioes` |

**Rodada Admin - Cadastro Rapido De Propriedade No Usuario Produtor**

Login principal de teste: usuario admin mockado disponivel no app.

Observacao geral: esta rodada valida apenas o MVP visual/mockado. O cadastro rapido nao cria login real, nao usa backend, banco, API, migrations, RBAC completo, upload/storage, Drive, CRUD real de regioes/microregioes ou migracao do `acessoControle`.

Atualizacao visual em 2026-05-31: `NovoUsuarioScreen` foi padronizada com componentes-base, preservando payload, mocks, helpers, schemas, validacoes, permissoes, regras, relacoes visuais e campos legados. O cadastro rapido de propriedade dentro de usuario produtor permanece mockado e deve ser revisado futuramente na etapa de fluxos de cadastro.

Atualizacao visual em 2026-05-31: `MapasScreen` foi padronizada visualmente de forma minima com `SearchBar`, `EmptyState`, `SegmentedChips`, `SectionCard` e `InfoBox`. A alteracao preservou `ShapeRenderer`, `FazendaMapaScreen`, `MapaFazendaView`, `buildFazendaMapaRouteParams`, `avaliarDownloadMapa`, `Mapa.update`, `ConfirmDialog`, preview de asset interno, permissoes, filtros de acesso, mocks, rotas, payloads e campos legados. Nao foram criados upload real, download real ou backend; geometria, selecao de talhao, renderizacao vetorial e filtro de demarcacao/ano LT ficaram intactos. `npm run typecheck`, `npm run test:domain-compat` e `git diff --check` passaram.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| QP-01 | P0 | Admin | Admin -> Usuarios -> Novo Usuario -> Perfil Produtor | Preencher produtor ativo e cadastro rapido de propriedade valido | Usuario produtor e propriedade sao criados no mock; vinculo `usuario_propriedade` e criado | Reexecutar | Fluxo mockado de criacao combinada |
| QP-02 | P0 | Admin | Cadastro rapido ativo | Tentar salvar sem campos obrigatorios da propriedade rapida | Salvamento bloqueado; nao cria propriedade vazia | Reexecutar | Validar nome, regiao, microregiao, area total e status |
| QP-03 | P0 | Admin | Cadastro rapido ativo e parcialmente preenchido | Cancelar/limpar cadastro rapido e salvar produtor pendente sem propriedade | Cadastro rapido nao cria propriedade nem vinculo | Reexecutar | Pendente sem propriedade continua permitido |
| QP-04 | P0 | Admin | Novo Usuario com perfil Produtor | Criar produtor pendente sem propriedade existente e sem cadastro rapido | Usuario pendente e criado sem propriedade | Reexecutar | Mantem regra anterior |
| QP-05 | P1 | Admin | Produtor ativo criado com propriedade rapida | Abrir Admin -> Propriedades/listagem de propriedades | Propriedade criada aparece na listagem/mock de propriedades | Reexecutar | Salva via `Produtor.create` |
| QP-06 | P1 | Admin | Produtor criado com propriedade rapida | Abrir detalhe do usuario produtor | Detalhe mostra propriedade vinculada, tipo de vinculo e principal quando aplicavel | Reexecutar | Vinculo via `usuario_propriedade` |
| QP-07 | P1 | Admin | Propriedade criada pelo cadastro rapido | Abrir detalhe da propriedade | Detalhe mostra titular/vinculo visual do produtor no mock | Reexecutar | Preserva `produtor_id`/`proprietario_id`/`fazenda_id` |
| QP-08 | P1 | Admin | Cadastro rapido com microregiao selecionada | Conferir colaboradores sugeridos | Colaboradores aparecem apenas como sugestao visual | Reexecutar | Nao altera permissao efetiva |
| QP-09 | P1 | Admin | Usuario criado pelo cadastro rapido | Tentar usar esse usuario como login real | Login real nao deve existir nesta fase | Reexecutar | Auth mock permanece separado |

**Rodada Produtor - Fluxo Visual/Mockado Pós-Nomenclatura**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| P-01 | P0 | Produtor | Login produtor válido | Entrar no app | Abre fluxo do produtor em `Minhas Propriedades` | Passou | Validado manualmente após padronização de nomenclatura |
| P-02 | P0 | Produtor | Propriedade disponível | Abrir card da propriedade | Detalhe da propriedade abre corretamente | Passou | Card permite acesso claro ao detalhe |
| P-03 | P0 | Produtor | Detalhe da propriedade aberto | Abrir mapa dos talhões | Mapa base dos talhões abre e permite consulta visual | Passou | MVP visual/mockado validado |
| P-04 | P1 | Produtor | Mapas/anexos disponíveis | Abrir anexos de fertilidade | Anexos de fertilidade abrem para consulta | Passou | Validado com amostra mockada |
| P-05 | P1 | Produtor | Detalhe/listagem disponível | Consultar visitas | Visitas aparecem/abrem para consulta quando disponíveis | Passou | Produtor consulta sem editar |
| P-06 | P1 | Produtor | Caderno disponível | Consultar caderno | Caderno abre em modo permitido para o produtor | Passou | Respeita visibilidade do produtor |
| P-07 | P1 | Produtor | Áreas sem dados | Ver mensagens vazias | Mensagens vazias explicam o estado sem parecer erro | Passou | Textos revisados usando propriedade |
| P-08 | P1 | Produtor | Fluxo completo | Revisar textos visíveis | Interface usa `Propriedade` como termo de produto | Passou | Nomes próprios como `Fazenda Sela de Prata I` permanecem preservados |

**Rodada 1 - Bloqueios E Escopo**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-01 | P0 | Produtor | Qualquer visita | Tentar criar visita por rota direta | Bloqueado | Passou | Exibiu acesso restrito |
| S-02 | P0 | Produtor | Qualquer visita | Tentar editar visita por rota direta | Bloqueado | Passou | Exibiu acesso negado |
| S-03 | P0 | Produtor | Caderno restrito da própria propriedade | Abrir por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-04 | P0 | Produtor | Registro de outro autor | Editar caderno por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-05 | P0 | Colaborador | Visita fora do escopo | Abrir por rota direta | Acesso bloqueado/volta | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-06 | P0 | Colaborador | Propriedade fora do escopo | Criar/editar visita por rota direta | Bloqueado | Passou | Edição direta de visita fora do escopo exibiu mensagem sem permissão |
| S-07 | P0 | Colaborador | Registro de caderno fora do escopo | Abrir detalhe/editar por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-08 | P0 | Produtor | Caderno de outra propriedade | Abrir por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-09 | P1 | Admin | Registro de caderno existente | Abrir detalhe do caderno | Detalhe carrega mesmo se restrito ao produtor | Passou | Detalhe do caderno abriu para admin |
| S-10 | P1 | Colaborador | Registro de caderno dentro do escopo | Abrir detalhe | Permitido, inclusive restrito ao produtor | Passou | Detalhe do caderno abriu para colaborador |

**Rodada 2 - Integridade De Contexto**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-11 | P0 | Admin | Visita existente | Editar visita | Propriedade permanece a mesma; alterações salvam | Passou | Propriedade vinculada ficou travada e edição salvou |
| S-12 | P0 | Admin | Registro de caderno existente | Editar caderno | Propriedade fica travada; `fazenda_id` preservado | Passou | Propriedade vinculada ficou travada e edição salvou |
| S-13 | P0 | Colaborador | Caderno existente | Editar caderno | Propriedade travada; alterações salvam | Passou | Propriedade vinculada ficou travada e edição salvou |
| S-14 | P0 | Produtor | Registro próprio | Editar caderno | Permitido; propriedade travada | Passou | Produtor editou registro próprio com propriedade vinculada travada |
| S-15 | P1 | Admin | Propriedade existente | Criar visita para a propriedade | Salva com `fazenda_id`; aparece na listagem/detalhe | Passou | Visita criada como admin e salva sem erro |
| S-16 | P1 | Colaborador | Propriedade dentro do escopo | Criar visita | Permitido; salva com `fazenda_id` correto | Passou | Visita criada como colaborador em propriedade autorizada |
| S-17 | P1 | Admin | Propriedade existente | Criar caderno pela listagem | Pode escolher propriedade autorizada e salvar | Passou | Caderno criado como admin e detalhe abriu |
| S-18 | P1 | Produtor | Própria propriedade | Criar caderno | Permitido; visível ao produtor | Passou | Registro criado no contexto da própria propriedade e detalhe abriu |
| S-19 | P1 | Produtor | Propriedade de outro titular | Criar caderno por rota direta com `fazendaId` | Bloqueado | Passou | Acesso restrito após ajuste para não exibir formulário antes da permissão |

**Rodada 3 - Integração Na Propriedade**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-20 | P0 | Admin | Propriedade no detalhe | Criar caderno pela aba Caderno | Abre `NovoCaderno` já no contexto da propriedade | Passou | Criou pela aba e registro apareceu na propriedade após ajuste de recarregamento |
| S-21 | P0 | Colaborador | Propriedade dentro do escopo | Criar caderno pela aba da propriedade | Salva vinculado à propriedade atual | Passou | Criou pela aba da propriedade dentro do escopo |
| S-22 | P1 | Admin | Detalhe da propriedade | Abrir aba Caderno | Vê registros reais da propriedade atual | Passou | Aba Caderno abriu e mostrou registros da propriedade |
| S-23 | P1 | Colaborador | Detalhe da propriedade | Aba Caderno | Mostra só registros daquela propriedade | Passou | Aba Caderno abriu e mostrou registros da propriedade do escopo |
| S-24 | P1 | Produtor | Detalhe da própria propriedade | Aba Caderno | Mostra apenas registros visíveis daquela propriedade | Passou | Aba Caderno abriu para produtor sem exibir registro restrito |

**Cobertura Complementar**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-25 | P2 | Admin | Existem propriedades com visitas | Abrir listagem de visitas | Vê visitas de múltiplas propriedades conforme filtros | Passou | Listagem de visitas abriu para admin |
| S-26 | P2 | Admin | Visita existente | Abrir detalhe da visita | Detalhe carrega e mostra contexto da propriedade | Passou | Detalhe de visita abriu para admin |
| S-27 | P2 | Colaborador | Tem região/sub-região | Abrir visitas | Vê apenas visitas de propriedades no escopo | Passou | Listagem de visitas abriu para colaborador |
| S-28 | P2 | Colaborador | Visita dentro do escopo | Abrir detalhe | Acesso permitido | Passou | Detalhe de visita dentro do escopo abriu |
| S-29 | P2 | Produtor | Tem uma ou mais propriedades | Abrir visitas | Vê visitas das próprias propriedades | Passou | Produtor vê histórico das próprias propriedades |
| S-30 | P2 | Produtor | Visita própria | Abrir detalhe | Permitido | Passou | Detalhe abriu por rota direta; caminho visual para produtor fica como decisão de produto |
| S-31 | P2 | Produtor | Caderno visível da própria propriedade | Abrir listagem/detalhe | Permitido | Passou | Caderno visível abriu para produtor |

**Validações De Ponta A Ponta**
| ID | Fluxo | Resultado esperado | Status | Observação |
|---|---|---|---|---|
| E2E-01 | Criar visita como admin/colaborador -> abrir detalhe -> editar | Propriedade não mudou | Passou | Fluxo literal criado, aberto em detalhe e editado com propriedade preservada |
| E2E-02 | Criar caderno pela aba da propriedade -> cair no detalhe do registro -> voltar à propriedade | Registro aparece na aba | Passou | Coberto por S-20 após ajuste de recarregamento |
| E2E-03 | Editar caderno -> salvar -> abrir detalhe atualizado | `fazenda_id` preservado | Passou | Coberto por S-12, S-13 e S-14 |
| E2E-04 | Produtor cria caderno próprio -> abrir listagem e detalhe da propriedade | Registro aparece nos dois lugares | Passou | Coberto por S-18, S-24 e S-31 |
| E2E-05 | Produtor tenta acessar caderno restrito por listagem/detalhe/rota direta | Registro não aparece e rota direta bloqueia | Passou | Coberto por S-03 e S-24 |

**Critério Para Encerrar A Frente**
- Todos os casos P0 passam.
- Todos os casos P1 passam ou têm exceção documentada e aceita.
- Nenhum produtor consegue criar/editar visita.
- Nenhum perfil acessa visita ou caderno fora da propriedade autorizada.
- Caderno restrito nunca aparece para produtor.
- Edição de visita e caderno nunca troca a propriedade.
- A aba Caderno da propriedade mostra somente registros daquela propriedade e permite criar no contexto correto.
- No fluxo do colaborador, Nova Visita global mantém seletor normal e Nova Visita contextual trava a propriedade recebida por `fazendaId`.
- Material Técnico permanece claramente mockado e não deve sugerir upload, storage, Drive, backend ou cadastro real.

**Validações Técnicas Da Microfase Colaborador**
- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou.
- `git diff --check`: passou; no Windows, podem aparecer apenas avisos normais de LF/CRLF.
