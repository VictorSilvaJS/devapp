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
9. Material tecnico: novos anexos devem seguir Propriedade, ano e
   Fertilidade/Correcao de solo/Prescricao, preservando nome original,
   visibilidade, compatibilidade dos materiais antigos e separacao de
   GeoJSON/talhoes.
10. Admin visual: `propriedades_atribuidas` no cadastro/detalhe do colaborador não deve ser interpretado como alteração real de acesso.
11. APK demonstrável: não entregar build em modo `__DEV__`; o acesso rápido deve aparecer como demonstrativo/local e usuários administrativos, fotos, anexos, uploads, downloads, autenticação e RBAC continuam mockados/preparatórios.

**Rodada Material Tecnico Unificado - Novos Anexos Locais**

Checklist para validar a evolucao posterior a Fase 17C. A evidencia historica
da 17C permanece inalterada. O fluxo novo e local/demonstrativo, aceita PNG,
PDF e ZIP e preserva a leitura dos indices anteriores. PDF e ZIP nao possuem
promessa de visualizacao ou processamento.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| MTU-01 | P0 | Admin/Colaborador | Entrada | Abrir uma Propriedade e tocar `Anexar material` | Existe um unico fluxo para novo material, restrito a usuario autorizado | Reexecutar | Validar tambem Colaborador fora do escopo |
| MTU-02 | P0 | Admin/Colaborador | Arquivo | Selecionar separadamente PNG, PDF e ZIP validos | Os tres formatos sao aceitos; arquivo invalido ou acima do limite falha sem criar metadado | Reexecutar | Usar DocumentPicker real |
| MTU-03 | P0 | Admin/Colaborador | Campos comuns | Selecionar categoria e ano, mantendo periodo vazio | Ano/categoria obrigatorios; periodo e opcional; nome original e preservado e titulo nasce automaticamente | Reexecutar | Ano nao deve ser confundido com Safra/Safrinha |
| MTU-04 | P0 | Admin/Colaborador | Periodo | Vincular Safra/Safrinha | Somente periodo ativo da mesma Propriedade e referenciado por id/label | Reexecutar | Material tambem salva sem periodo |
| MTU-05 | P0 | Admin/Colaborador | Fertilidade | Anexar com profundidade e repetir com `Nao informada` | Profundidade e confirmada; escopo fica Propriedade; Talhao nao aparece nem persiste | Reexecutar | Troca de categoria limpa campos residuais |
| MTU-06 | P0 | Admin/Colaborador | Correcao | Anexar para Propriedade inteira e para Talhao | Profundidade e exigida; Talhao e exigido apenas no escopo Talhao | Reexecutar | Escopo Propriedade nao guarda Talhao residual |
| MTU-07 | P0 | Admin/Colaborador | Prescricao | Anexar arquivo com nome reconhecivel e outro desconhecido | Nao pede profundidade/camada/Talhao; inferencia e apenas informativa e nome desconhecido continua valido | Reexecutar | Nao inventar elemento |
| MTU-08 | P0 | Todos | Organizacao | Criar materiais em dois anos e alternar ano/categoria | Catalogo espelha Propriedade > Ano > Fertilidade/Correcao/Prescricao sem misturar outra Propriedade | Reexecutar | `Todos` pode existir apenas como agregador |
| MTU-09 | P0 | Produtor | Visibilidade | Abrir como Produtor apos criar item visivel e item interno | Ve somente ativo+visivel da propria Propriedade e nao ve anexar/substituir/remover | Reexecutar | Repetir rota direta e outra Propriedade |
| MTU-10 | P0 | Todos | Compatibilidade | Abrir catalogo com Mapa mock, PNG local antigo, ZIP antigo e item novo | Legados continuam legiveis uma unica vez; nenhuma migracao destrutiva ou duplicacao | Reexecutar | Preservar `fazenda_id`/`propriedade_id` |
| MTU-11 | P0 | Todos | Abertura | Abrir PNG, PDF e ZIP locais | PNG abre como imagem; PDF/ZIP mostram somente capacidade realmente existente, sem falso preview/unzip/processamento | Reexecutar | Nome original e formato permanecem visiveis |
| MTU-12 | P0 | Todos | Persistencia local | Executar `force-stop`, reabrir sem rede e consultar os tres formatos | Metadados e arquivos ja copiados continuam no mesmo aparelho; UI nao chama isso de sync/download remoto | Reexecutar | Nao promete restauracao apos desinstalar |
| MTU-13 | P0 | Admin/Colaborador | Seguranca local | Remover item novo e, se necessario, anexar outro arquivo | Somente arquivo em diretorio seguro e metadado correspondente mudam; outra Propriedade, seed, PNG/ZIP legado e GeoJSON permanecem | Reexecutar | Validar rollback em falha de metadado |
| MTU-14 | P0 | Todos | Regressao | Abrir GeoJSON/Talhoes, Caderno, Safra e materiais antigos | Contexto, acesso e fluxos existentes continuam funcionando | Reexecutar | Executar `typecheck` e `test:domain-compat` antes do smoke |

**Execucao parcial em Android fisico - 2026-07-23**

Status: `PARCIAL_ANDROID_FISICO`. O build debug foi gerado por
`npm run android`, instalado por cima e aberto em aparelho Android 15/API 35,
sem limpar dados. A rodada usou o perfil Admin e o DocumentPicker real.

Evidencias aprovadas nesta execucao:

- o fluxo unico aceitou PNG, PDF e ZIP validos e preservou os nomes originais;
- Fertilidade salvou PNG com profundidade `Nao informada`;
- Correcao de solo salvou PDF com profundidade `10-20 cm`, escopo Talhao e
  `T01 - 230`;
- Prescricao salvou ZIP sem pedir profundidade/escopo/Talhao e apresentou a
  indicacao informativa `Potassio` para o nome contendo `KCL`;
- os tres registros apareceram em `Ano 2026`, separados por categoria;
- PNG abriu como imagem; PDF e ZIP exibiram apenas metadados e as limitacoes
  reais, sem prometer visualizador, preview, descompactacao ou processamento;
- depois de `force-stop`, a sessao, os arquivos privados e os metadados de PDF
  e ZIP reapareceram na interface;
- a remocao pelo fluxo normal apagou somente cada fixture nova. O material
  local anterior da Propriedade permaneceu, e os tres arquivos temporarios em
  `Download` foram removidos ao final;
- o processo corrente terminou a verificacao sem crash ou excecao fatal no
  log.

Permanecem em `Reexecutar`: Colaborador dentro/fora do escopo, Produtor e rota
direta, arquivo invalido/acima do limite, periodo Safra/Safrinha, dois anos,
variantes condicionais restantes, nome de Prescricao desconhecido, rollback
em falha de metadado, regressao funcional completa e o caso offline com a
conectividade explicitamente desligada. A reabertura comprovou persistencia
local, mas o build debug precisou do servidor de desenvolvimento; por isso nao
fecha sozinho o requisito offline de `MTU-12`.

**Rodada Fase 17H.1.3 - Validacao Android Fisico Do Ponto Opcional No Caderno**

Status geral em 2026-07-22: `PARCIAL_ANDROID_FISICO`. Um aparelho fisico
autorizado recebeu e abriu o APK release. Foreground, Caderno sem ponto,
negativa de permissao, localizacao do sistema desligada, GeoJSON, PNG, ZIP,
teclado/usabilidade e ausencia de background passaram. Nenhuma coordenada real,
endereco ou serial do aparelho foi registrado.

O provider real encerrou tres tentativas com timeout controlado em
aproximadamente 38 a 53 segundos, em ambiente interno sem ceu razoavelmente visivel. Nao
houve leitura nem precisao a registrar; os cenarios dependentes de ponto real
continuam pendentes. A Fase 17H.2 nao esta autorizada. Relato completo em
`fase-17h-1-3-android-fisico-ponto-caderno.md`.

| ID | Criticidade | Area | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|
| 17H113-01 | P0 | Aparelho fisico | Dispositivo autorizado e selecionado explicitamente | Passou | Aparelho fisico autorizado reconhecido; serial omitido |
| 17H113-02 | P0 | Instalacao release | APK release instala e abre sem crash | Passou | Instalacao e abertura do pacote release passaram |
| 17H113-03 | P0 | Permissoes foreground | Localizacao limitada ao uso foreground, sem permissao inesperada | Passou | Permissoes foreground confirmadas; nenhuma autorizacao de background |
| 17H113-04 | P0 | Posicao temporaria no mapa | Leitura real aparece somente em runtime e nao persiste | Reexecutar | Provider terminou em timeout; marcador temporario real nao pôde ser confirmado |
| 17H113-05 | P0 | Create sem ponto | Caderno comum salva sem secao, selo ou grupo de localizacao | Passou | Registro sem ponto permaneceu o fluxo normal |
| 17H113-06 | P0 | Create com ponto | Captura explicita persiste somente no submit | Reexecutar | Sem leitura do provider, nenhum ponto real foi criado |
| 17H113-07 | P0 | Cancelamento | Sair apos capturar nao persiste draft ou registro | Reexecutar | Captura real nao foi obtida; cancelamento de draft com ponto ficou pendente |
| 17H113-08 | P0 | Remocao antes do submit | Remover captura e salvar produz registro sem ponto | Reexecutar | Sem captura real, remocao do draft com ponto nao foi exercitada |
| 17H113-09 | P0 | Permissao negada | Falha controlada e Caderno sem ponto continua permitido | Passou | Negativa foi recuperavel, sem crash ou persistencia de localizacao |
| 17H113-10 | P0 | Localizacao desligada | Mensagem controlada, sem espera infinita, e submit sem ponto | Passou | Location off foi recuperavel e o sistema foi restaurado ao final |
| 17H113-11 | P0 | Provider real/precisao | Obter leitura e registrar apenas tempo/precisao informada | Reexecutar | Tres timeouts controlados de aproximadamente 38 a 53 s em ambiente interno sem ceu razoavelmente visivel; sem precisao |
| 17H113-12 | P0 | Colaborador | Exercitar ponto real, `preserve`, `replace` e `remove` | Reexecutar | Sem leitura real, as semanticas de ponto do perfil nao foram exercitadas |
| 17H113-13 | P0 | Admin/visibilidade | Validar ponto interno/liberado sem vazamento | Reexecutar | Visibilidade dependente de ponto real permaneceu pendente |
| 17H113-14 | P0 | Force-stop | Restaurar somente ponto salvo e manter ponto removido ausente | Reexecutar | Parcial para dados sem ponto e fixtures; ponto salvo/removido nao foi exercitado |
| 17H113-15 | P0 | GeoJSON | Selecionar, renderizar Talhoes e manter Caderno segregado | Passou | DocumentPicker e Talhoes passaram, sem ponto do Caderno |
| 17H113-16 | P0 | PNG | Selecionar e abrir imagem sem ponto | Passou | PNG abriu como imagem, sem marcador ou localizacao do Caderno |
| 17H113-17 | P0 | ZIP | Selecionar e abrir detalhe sem preview ou processamento | Passou | ZIP abriu somente metadados, sem preview, unzip, processamento ou ponto |
| 17H113-18 | P1 | Teclado/usabilidade | Campos, rolagem e submit permanecem alcancaveis e legiveis | Passou | Formulario permaneceu utilizavel no aparelho testado |
| 17H113-19 | P0 | Ausencia de background | Sem atualizacao, notificacao ou leitura automatica fora da tela | Passou | Nenhum comportamento de background ou tracking foi observado |
| 17H113-20 | P0 | Limpeza | Remover dados temporarios sem manipular storage interno | Passou | Nenhuma localizacao real persistiu; fixtures foram limpas, sem substituir a remocao de ponto salvo |

Os casos `17H113-04`, `17H113-06`, `17H113-07`, `17H113-08`,
`17H113-11`, `17H113-12`, `17H113-13` e `17H113-14` devem ser reexecutados em
condicao adequada ao provider real. O resultado nao declara producao, cobertura
de todos os Android, precisao garantida ou backend prontos.

**Rodada Fase 17H.1.1 - Smoke De Seguranca, Cancelamento E Regressao Do Ponto Opcional No Caderno**

Status geral em 2026-07-22: `APROVADA_EM_EMULADOR`. Rodada executada no
`emulator-5554`, Pixel Tablet, Android 15/API 35, preservando sessao e estado
local. Nao foram usados `pm clear`, desinstalacao, `Wipe Data` ou restauracao
do seed. Typecheck, suite completa, testes focados, build release, instalacao
por cima e `monkey` passaram na rodada original.

O complemento 17H.1.2 fechou a abertura visual do ZIP com fixture valida de
286 B criada fora do repositorio, importada pelo DocumentPicker e removida ao
final. Detalhe, `force-stop`, Produtor e regressao Caderno/mapa/PNG/ZIP
passaram, sem preview, descompactacao, processamento ou localizacao fora do
Caderno. Assim, os 29/29 casos executaveis no emulador passaram. Android fisico
continua pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H111-01 | P0 | Produtor | Create sem ponto | Criar pelo `T01 - 230` sem tocar em localizacao | Registro sem seis campos, secao ou selo | Passou | `17H111-SEM-PONTO-20260721`; Propriedade/Talhao preservados e sem Editar/Remover |
| 17H111-02 | P0 | Produtor | Create com ponto | Capturar e salvar | Ponto aparece somente depois do submit | Passou | `17H111-COM-PONTO-20260721`; `-9,87`/`-56,09`, 15 m, 01:25, autoria Produtor e selo |
| 17H111-03 | P0 | Produtor/Admin | Cancelamento | Capturar e cancelar sem salvar | Nenhum registro, selo ou draft reaproveitado | Passou | `17H111-CANCELADO-20260721` nao gerou id e Novo Caderno reabriu limpo |
| 17H111-04 | P0 | Produtor/Admin | Remocao pre-submit | Capturar, remover e salvar | Caderno termina sem ponto | Passou | `17H111-REMOVIDO-ANTES-SALVAR-20260721` sem secao, selo ou campos |
| 17H111-05 | P0 | Produtor/Admin | Permissao negada | Negar permissao e salvar Caderno comum | Mensagem controlada e nenhum ponto | Passou | `17H111-PERMISSAO-NEGADA-20260721` salvo sem ponto; permissao restaurada |
| 17H111-06 | P0 | Produtor/Admin | GPS desligado | Desligar localizacao, capturar e salvar | Orientacao controlada e nenhum ponto | Passou | `17H111-GPS-DESLIGADO-20260721` salvo sem ponto; GPS restaurado |
| 17H111-07 | P0 | Produtor/Admin | Provider/timeout | Deixar provider sem leitura | Sair de espera em ate 15 s e liberar submit | Passou | Timeout real mostrou erro recuperavel, sem crash, loop ou grupo parcial |
| 17H111-08 | P0 | Produtor/Admin | Concorrencia | Duplo toque e saida durante leitura | Uma operacao; nenhuma resposta tardia aplicada | Passou | Sem segunda operacao, crash, alerta, draft ou registro |
| 17H111-09 | P1 | Produtor/Admin | Baixa precisao | Fornecer leitura de 100 m | Aviso sem alterar valor ou bloquear submit | Passou | 100 m exibidos integralmente, sem afirmacao de posicao exata |
| 17H111-10 | P0 | Admin | Troca de Propriedade | Capturar em Boa Vista e trocar para Horizonte | Remover draft e nao reaproveitar ao voltar | Passou | Aviso de remocao exibido; nenhum campo tecnico auxiliar no payload |
| 17H111-11 | P0 | Admin | Troca de Talhao | Capturar no T01 e selecionar T02 | Coordenada permanece sem inferencia geografica | Passou | Leitura/horario preservados e aviso sem texto `dentro do Talhão` |
| 17H111-12 | P0 | Admin | Preserve | Editar somente observacao | Ponto e `captured_at` permanecem | Passou | `-9,87`/`-56,09`, 15 m e 01:25 mantidos; sem captura ao abrir |
| 17H111-13 | P0 | Admin | Replace cancelado | Capturar ponto diferente e cancelar | Ponto anterior permanece integralmente | Passou | Draft `-10`/`-57`, 25 m, 01:41 foi descartado |
| 17H111-14 | P0 | Admin | Replace salvo | Capturar ponto diferente e salvar | Um unico grupo novo substitui o anterior | Passou | `-10,1`/`-57,1`, 20 m, 01:42 e autoria Admin, sem opcionais antigos |
| 17H111-15 | P0 | Admin | Remove cancelado | Marcar remocao e cancelar | Ponto anterior permanece | Passou | Detalhe reabriu com ponto e selo |
| 17H111-16 | P0 | Admin | Remove/desfazer | Marcar, desfazer e salvar outro campo | Voltar a `preserve` | Passou | Observacao final `17H111-COM-PONTO-20260721-PRESERVE-UNDO`; ponto preservado |
| 17H111-17 | P0 | Admin | Remove salvo | Marcar remocao e salvar | Eliminar os seis campos sem residuo | Passou | Secao/selo desapareceram e edicao reabriu limpa, sem `null` ou sentinel |
| 17H111-18 | P0 | Produtor | Perfil | Criar/consultar na propria Propriedade | Contexto travado e sem acoes administrativas | Passou | Criou/viu detalhe e selo; sem Editar/Remover; rotas protegidas por teste |
| 17H111-19 | P0 | Colaborador | Perfil/escopo | Criar no escopo e editar em preserve | Autoria/contexto/ponto preservados | Passou | `17H111-COLAB-PONTO-20260721`, T01, `-9,88`/`-56,1`, 12 m, 01:48; fora do escopo por teste |
| 17H111-20 | P0 | Admin | Perfil/global | Criar interno e exercitar edicao | Operacao global sem ampliar outros perfis | Passou | `17H111-ADMIN-PONTO-20260721`, Sela/`T01`, `-9,89`/`-56,11`, 10 m, 01:52; semanticas exercitadas no registro controlado da sessao |
| 17H111-21 | P0 | Todos | Visibilidade | Comparar liberado e interno | Sem vazamento do interno ao Produtor | Passou | Produtor viu Colaborador com selo; busca do Admin interno retornou `Nenhum` |
| 17H111-22 | P0 | Todos | Force-stop | Parar/reabrir e conferir todos os estados | Restaurar somente o que foi salvo | Passou | Sem ponto/erros sem selo; Colaborador com selo; cancelado ausente; removido nao voltou; novo form limpo |
| 17H111-23 | P0 | Todos | Posicao do mapa | Mostrar posicao, sair e executar force-stop | Marcador somente transitorio e sem Caderno | Passou | 18 m/01:57 no mapa; nao restaurou marcador nem preencheu Novo Caderno |
| 17H111-24 | P0 | Admin/Produtor | GeoJSON/Talhoes | Reanexar fixture existente e abrir mapa | Talhoes clicaveis sem pontos do Caderno | Passou | `limites_talhoes.geojson`, 15 Talhoes/37 partes, `GEOJSON LOCAL`, T01 clicavel |
| 17H111-25 | P0 | Admin/Colaborador | PNG | Importar/abrir PNG local e base | Sem marcador, coordenada ou controle de ponto | Passou | Asset `ph_10a20.png` copiado para `Download`; `smoke_ph_10a20.png` e base abriram |
| 17H111-26 | P0 | Admin/Colaborador | ZIP de Prescricao | Abrir ZIP local valido e detalhe | Pacote sem preview, unzip, processamento ou localizacao | Passou | Fixture temporaria de 286 B passou pelo picker/importacao, persistiu apos `force-stop` e foi consultada pelo Produtor somente como detalhe/metadados |
| 17H111-27 | P0 | Todos | Material tecnico | Conferir tres filtros e detalhes | Nenhuma UI ou marcador do ponto | Passou | Fertilidade, Correcao de solo e Prescricao funcionaram sem localizacao |
| 17H111-28 | P0 | Todos | Visitas | Abrir Nova e registro demonstrativo | Sem Camera/Galeria, geotag ou campos do Caderno | Passou | `Imagens do registro (2)`, `Imagem demonstrativa` e `Exemplo visual do registro` preservados |
| 17H111-29 | P0 | Todos | Auditoria | Buscar chaves, APIs e contaminacao | Sem storage novo, tracking/background ou localizacao fora do Caderno | Passou | Seis campos somente no Caderno; mapa temporario; nenhuma ocorrencia em PNG/ZIP/GeoJSON/Visita |
| 17H111-30 | P0 | Todos | Android fisico | Completar o gate fisico antes de campo | Evidencia fisica antes de campo | Reexecutar | A 17H.1.3 usou aparelho autorizado, mas os casos dependentes de ponto real ficaram pendentes |

Build desta rodada: APK de 91.922.508 bytes, SHA-256
`3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B`;
`:app:assembleRelease`, `adb install -r` e `monkey` passaram. Relato completo
em `fase-17h-1-1-smoke-seguranca-ponto-caderno.md`.

Na 17H.1.2 nao houve novo build ou instalacao: o `base.apk` instalado foi
comparado ao release atual, com mesmo tamanho e SHA-256, e reutilizado.

**Rodada Fase 17H.1B - UI, Captura Foreground E Persistencia Explicita Do Ponto No Caderno**

Observacao geral em 2026-07-21: rodada executada no AVD Pixel Tablet,
Android 15/API 35, com APK release instalado por cima. O fluxo foi exercitado
com provider indisponivel/timeout e depois com GPS simulado, incluindo leitura
de baixa precisao. O provider simulado foi restaurado ao final. Nao foram
usados `pm clear`, desinstalacao ou `Wipe Data`. A regressao visual minima de
PNG/ZIP/mapa passou na 17H.1.2; Android fisico continua pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H1B-01 | P0 | Produtor/Admin | Secao opcional | Abrir Novo/Editar Caderno sem tocar na acao | Secao aparece e nenhuma captura ocorre automaticamente | Passou | Produtor abriu pela Sela de Prata I/Talhao `T01 - 230`; formulario permaneceu comum ate o toque explicito |
| 17H1B-02 | P0 | Produtor/Admin | Captura foreground | Tocar em `Usar minha posição neste registro` | Uma unica leitura foreground inicia; submit fica indisponivel enquanto pendente | Passou | Sem chamada direta de Expo Location na tela e sem watch |
| 17H1B-03 | P0 | Produtor/Admin | Transparencia | Concluir captura simulada e exercitar accuracy baixa | Mostrar horario, precisao e aviso sem bloquear submit | Passou | Produtor viu 18 m/horario; Admin confirmou baixa precisao e aviso de contexto do Talhao |
| 17H1B-04 | P0 | Produtor/Admin | Create sem ponto | Salvar Caderno sem usar localizacao | Registro e detalhe ficam sem grupo/secao de ponto | Passou | Fluxo do Produtor pelo `T01 - 230` e fluxo global do Admin passaram sem `localizacao_*` |
| 17H1B-05 | P0 | Produtor/Admin | Create com ponto | Capturar GPS simulado e salvar | Grupo canonico persiste somente depois do submit | Passou | Detalhe do Produtor mostrou 18 m e nome resolvido; nenhum draft foi persistido antes |
| 17H1B-06 | P0 | Admin | Erro/timeout | Tentar capturar com provider indisponivel | Mensagem controlada e Caderno sem ponto continua permitido | Passou | Timeout terminou como indisponivel, sem crash ou grupo parcial |
| 17H1B-07 | P0 | Admin | Edit preserve | Abrir ponto existente, alterar campo comum e salvar | Coordenadas e `captured_at` permanecem | Passou | Abrir a edicao nao disparou nova captura |
| 17H1B-08 | P0 | Admin | Edit replace | Usar nova posicao simulada e salvar | Novo grupo substitui integralmente o anterior no submit | Passou | Substituicao ficou apenas em state antes de salvar |
| 17H1B-09 | P0 | Admin | Edit remove/desfazer | Marcar remocao, desfazer, marcar novamente e salvar | Desfazer restaura `preserve`; remocao persiste somente no submit | Passou | Detalhe e selo desapareceram depois da remocao salva |
| 17H1B-10 | P0 | Admin | Detalhe e selo | Abrir detalhe e cards com ponto valido | Mostrar coordenadas/nome no detalhe e apenas selo nos cards | Passou | Nome foi resolvido sem exibir id tecnico cru; cards nao mostraram coordenadas |
| 17H1B-11 | P0 | Todos | Auditoria | Buscar storage, chaves, tracking e shapes proibidos | Sem chave nova, background, tracking, trilha, historico ou campos extras | Passou | Localizacao entra somente no submit do Caderno |
| 17H1B-12 | P0 | Todos | Regressao PNG/ZIP/mapa | Auditar e reabrir todos os materiais/mapa | Nenhum `localizacao_*` ou ponto persistido fora do Caderno | Passou | Caderno liberado manteve selo/secao de ponto; mapa de 15 Talhoes, PNG local e ZIP real foram reabertos sem ponto persistido fora do Caderno |
| 17H1B-13 | P0 | Todos | Android fisico | Completar captura, precisao, submit e edicao com ponto real | Validacao fisica antes de campo | Reexecutar | A rodada fisica 17H.1.3 ficou parcial apos timeouts controlados do provider |

Build desta rodada: `:app:assembleRelease`, `adb install -r` e `monkey`
passaram. APK com 91.922.508 bytes e SHA-256
`3EC83F8B165EE9F941CA39E058CD6474A702DE6229A5BDCA7A6221A0AC76107B`.

**Rodada Fase 17H.1A - Contrato Do Ponto Opcional No Caderno**

Observacao geral em 2026-07-21: rodada executada no AVD Pixel Tablet, Android
15/API 35, com APK release instalado por cima. Esta fase valida o contrato por
testes e apenas a ausencia de regressao visual; nao existe UI de localizacao e
nenhum ponto deve ser criado pela interface. Nao foram usados `pm clear`,
desinstalacao ou `Wipe Data`. Android fisico continua pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H1A-01 | P0 | Todos | Shape canonico | Auditar contratos e helper | Somente seis campos planos opcionais no Caderno | Passou | Sem objeto `localizacao`, `coords` ou alias camelCase no snapshot |
| 17H1A-02 | P0 | Todos | Helper puro | Executar testes de validacao/normalizacao/intencao | Sem UI, Expo, storage, filesystem, mock, navegacao, log ou timestamp automatico | Passou | 51 cenarios novos no total |
| 17H1A-03 | P0 | Todos | Registros antigos | Ler Caderno ausente e grupo parcial legado | Ausencia e valida; parcial nao derruba nem vaza para UI | Passou | Cobertura direta do helper e `normalizeCadernoCampo` |
| 17H1A-04 | P0 | Todos | Validators | Validar Caderno comum, grupo completo e parcial | Comum/completo passam; parcial falha de forma controlada | Passou | `validatorsCompat` e teste novo passaram |
| 17H1A-05 | P0 | Todos | Create/get | Criar por codigo e consultar get/list | Seis campos validos fazem round-trip | Passou | Coordenadas ficticias somente em teste |
| 17H1A-06 | P0 | Todos | Update preserve | Atualizar campo comum sem `localizacao_*` | Ponto e `captured_at` permanecem inalterados | Passou | Cobertura automatizada na API publica mockada |
| 17H1A-07 | P0 | Todos | Update replace | Fornecer novo grupo valido | Grupo anterior e integralmente substituido | Passou | Opcionais antigos nao vazam para o novo ponto |
| 17H1A-08 | P0 | Todos | Update remove | Aplicar patch explicito de remocao | Registro/snapshot terminam sem os seis campos e sem sentinel | Passou | Serializacao JSON confirmada |
| 17H1A-09 | P0 | Todos | Restauracao | Recarregar snapshot antes/depois da remocao | Ponto valido permanece; removido nao reaparece | Passou | Somente `@tche:mock-mvp:v1` foi usado |
| 17H1A-10 | P0 | Admin | Nao regressao visual | Abrir Caderno, novo, detalhe e edicao | Fluxos abrem sem secao ou acao de localizacao | Passou | Sessao/dados, Propriedade, Talhao e Safra permaneceram |
| 17H1A-11 | P0 | Admin | Auditoria/regressao | Conferir mapa, materiais, visitas, chaves e APIs | Posicao segue transitoria; sem captura/chave/tracking; fluxos anteriores intactos | Passou | 15 Talhoes, areas 6200/1888,6; filtros Fertilidade/Correcao/Prescricao; Visita sem Camera/Galeria |
| 17H1A-12 | P0 | Todos | Android fisico | Instalar e repetir o roteiro em aparelho autorizado | Validacao fisica antes de campo | Reexecutar | Somente emulador; Android fisico segue pendente e nao aprovado |

**Rodada Fase 17H.0.7 - Alinhamento Tecnico Pontual Do Expo SDK 56**

Observacao geral em 2026-07-21: rodada executada no AVD `Teste_Tche`, Pixel
Tablet, Android 15/API 35, com APK release instalado por cima. O projeto
permaneceu no SDK 56; somente `expo` e `expo-location` mudaram entre
dependencias diretas. Nao foram usados `pm clear`, desinstalacao ou `Wipe
Data`. O provider do AVD nao entregou posicao e o app mostrou o fallback
controlado. Nao havia GeoJSON ou ZIP local ativo na Sela; as suites focadas
passaram. Android fisico continua pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H07-01 | P0 | Todos | Baseline | Registrar Git, runtime, versoes e suites antes | Estado inicial conhecido sem descartar mudancas | Passou | Git limpo; Node 22.20.0; npm 10.9.3; Expo CLI 56.1.15; typecheck/dominio passaram |
| 17H07-02 | P0 | Todos | Versoes indicadas | Executar checks oficiais sem correcao automatica | Capturar apenas os patches atuais do SDK 56 | Passou | `expo ~56.0.16` e `expo-location ~56.0.21`; nenhum outro pacote apontado |
| 17H07-03 | P0 | Todos | Dependencias | Atualizar somente os dois pacotes autorizados | Apenas duas dependencias diretas mudam | Passou | React, React Native, TypeScript e demais dependencias diretas permaneceram |
| 17H07-04 | P0 | Todos | Expo check | Repetir check geral e dirigido | `Dependencies are up to date` | Passou | Os dois comandos passaram depois da instalacao |
| 17H07-05 | P1 | Todos | Expo Doctor | Comparar diagnostico antes/depois | Divergencia alvo removida; avisos alheios registrados | Passou | 17/21 -> 18/21; restaram `splash` e dois avisos de `expo-font` preexistentes |
| 17H07-06 | P0 | Todos | Typecheck/suites | Executar validacao completa depois | Nenhuma regressao automatizada | Passou | Typecheck e suite completa de dominio passaram antes/depois |
| 17H07-07 | P0 | Todos | Build/APK | Gerar release, instalar por cima e abrir | Build e launcher passam sem limpar estado | Passou | Fallback de Metaspace com um worker; APK 91.892.916 bytes; install/monkey passaram |
| 17H07-08 | P0 | Admin | Localizacao foreground | Abrir mapa e solicitar posicao | Talhoes clicaveis e fallback controlado se provider falhar | Passou | 15 Talhoes e T01 abriram; provider nao respondeu e app mostrou mensagem controlada; sem background/persistencia |
| 17H07-09 | P0 | Admin | GeoJSON/PNG/ZIP | Reabrir materiais e executar suites focadas | Fluxos locais nao regridem | Passou | Sem GeoJSON/ZIP ativo no snapshot; camada de 15 Talhoes e PNG de Fosforo abriram; suites GeoJSON/PNG/ZIP passaram |
| 17H07-10 | P0 | Admin | Caderno/Safra/Visitas | Reabrir estado preservado e formularios | AUD-04/05/06, Safra e segregacao de fotos permanecem | Passou | Cadernos/periodo visiveis; Nova Visita sem Camera/Galeria; visita antiga com label demonstrativo |
| 17H07-11 | P0 | Todos | Storage/permissoes | Auditar codigo, app.json e pacote instalado | Sem coordenada/chave/camera/background novo | Passou | Fine/Coarse presentes; background, camera e galeria ausentes; nenhuma chave ou coordenada criada |
| 17H07-12 | P0 | Todos | Android fisico | Repetir roteiro em aparelho autorizado | Validacao fisica antes de campo | Reexecutar | Somente emulador; Android fisico segue pendente e nao aprovado |

**Rodada Fase 17H.0.6 - Segregacao Dos Placeholders De Foto Em Visitas**

Observacao geral em 2026-07-21: rodada executada com Admin no AVD `Teste_Tche`,
Pixel Tablet, Android 15/API 35, com APK release instalado por cima. Nao foram
usados `pm clear`, desinstalacao ou `Wipe Data`. As URLs demonstrativas do seed
foram preservadas somente para leitura; nenhuma foto real foi criada. Android
fisico continua pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H06-01 | P0 | Todos | Geracao simulada | Auditar producao e testes | Nenhum gerador ativo de `picsum.photos` | Passou | Ocorrencias ficaram somente no seed preservado e fixtures de compatibilidade |
| 17H06-02 | P0 | Admin | Nova Visita | Abrir formulario e secao Fotos | Sem Camera/Galeria; aviso `Fotos no MVP local` visivel | Passou | Formulario permaneceu utilizavel e informou que pode salvar sem imagens |
| 17H06-03 | P0 | Admin | Editar Visita | Abrir registro com e sem foto | Sem Camera/Galeria; fotos existentes somente para consulta/remocao explicita | Passou | Aviso visivel nos dois cenarios; nenhuma acao de adicionar imagem |
| 17H06-04 | P0 | Admin | Criacao sem foto | Criar e abrir Visita sem imagem | Registro salva e detalhe nao exibe secao vazia problematica | Passou | Visita de Consultoria criada, aberta, editada para Cancelada e salva |
| 17H06-05 | P0 | Admin | Foto demonstrativa | Editar outro campo de registro legado com duas imagens | Array existente permanece e detalhe identifica exemplo visual | Passou | Duas imagens permaneceram apos salvar; label `Imagem demonstrativa` visivel |
| 17H06-06 | P0 | Todos | Camera/permissao/geotag | Executar auditoria textual e testes | Nenhuma integracao, permissao, coordenada, EXIF, chave ou storage novo | Passou | 16 cenarios de Visita, validators, mock e auditoria textual passaram |
| 17H06-07 | P0 | Admin | Regressao | Abrir Caderno/Safra, Talhoes/mapa e Material tecnico | Fluxos existentes continuam acessiveis | Passou | Caderno mostrou Safra vinculada; mapa abriu 15 Talhoes/localizacao; Material tecnico abriu na Sela |
| 17H06-08 | P0 | Todos | Android fisico | Repetir roteiro em aparelho autorizado | Validacao fisica antes de campo | Reexecutar | Somente emulador; Android fisico segue pendente e nao aprovado |

**Rodada Fase 17H.0.5 - Semantica Segura De Area E Perimetro**

Observacao geral em 2026-07-21: rodada executada no AVD `Teste_Tche`, Pixel
Tablet, Android 15/API 35, com APK release instalado por cima. Nao foram usados
`pm clear`, desinstalacao ou `Wipe Data`. O cenario visual nao possui Talhao sem
area; cobertura parcial/ausente foi validada pelo teste automatizado sem criar
dado mockado. Android fisico continua pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H05-01 | P0 | Todos | Helper/normalizacao | Executar teste novo e suite de dominio | Somente numeros finitos positivos; ausencia nunca vira zero | Passou | 23 cenarios; `test:domain-compat` passou |
| 17H05-02 | P0 | Produtor | Area total informada | Abrir Sela de Prata I | Exibir `Area total informada: 6.200 ha` sem alterar o cadastro | Passou | Card, detalhe e painel final exibiram 6200 ha |
| 17H05-03 | P0 | Produtor | Area mapeada | Abrir panorama e mapa de Talhoes | Exibir `Area mapeada: 1.888,6 ha`, sem `ha total` | Passou | 15 Talhoes; valor igual ao manifesto processado |
| 17H05-04 | P0 | Todos | Area parcial/ausente | Exercitar resumo com parte/nenhuma area valida | Usar `Area mapeada parcial` ou `Nao informado`, nunca zero | Passou | Cobertura automatizada; nao havia fixture visual ausente |
| 17H05-05 | P0 | Produtor | Area do Talhao | Selecionar `T01 - 230` | Detalhe mostra `Area do Talhao: 274,1 ha`; selecao continua funcional | Passou | Card, poligono e drawer continuaram clicaveis |
| 17H05-06 | P0 | Todos | Perimetro | Auditar detalhe e helper | Nao exibir/formatar sem valor, unidade e origem comprovados | Passou | Sela nao exibiu perimetro; casos invalidos/sem origem cobertos por teste |
| 17H05-07 | P0 | Produtor | Regressao | Conferir GeoJSON/Talhoes/localizacao, Material tecnico, Caderno e Safra | Fluxos existentes continuam abrindo sem coordenada persistida | Passou | Suites GeoJSON passaram; mapa abriu 15 Talhoes; botao de posicao presente; Fertilidade/Correcao/Prescricao, Caderno e Safra visiveis |
| 17H05-08 | P0 | Todos | Android fisico | Repetir roteiro em aparelho autorizado | Validacao fisica antes de campo | Reexecutar | Somente emulador; Android fisico segue pendente e nao aprovado |

**Rodada Fase 17H.0.3 - Fechamento Manual Do Baseline Caderno/Talhao/Safra**

Observacao geral em 2026-07-21: rodada executada no AVD `Teste_Tche`, Pixel
Tablet, Android 15/API 35. O app ja estava instalado e possuia sessao/estado
local anterior; o APK release foi instalado por cima. Nao foram usados
`pm clear`, desinstalacao ou `Wipe Data`. Nenhuma funcionalidade, coordenada,
chave `@tche:`, dependencia, mock, lista, seed ou asset foi alterado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H03-01 | P0 | Todos | Ambiente | Fotografar Git, ADB, pacote e espaco | Emulador utilizavel sem limpar estado anterior | Passou | Git limpo; `emulator-5554`; Pixel Tablet/API 35; cerca de 10 GiB livres em `/data`; app release ja instalado |
| 17H03-02 | P0 | Todos | Regressao | Executar typecheck, dominio e testes focados | Suites passam antes do smoke | Passou | `typecheck`, `test:domain-compat`, Caderno, acesso, validators, periodo e consulta por Talhao passaram |
| 17H03-03 | P0 | Todos | APK | Montar release, instalar por cima e abrir | APK abre sem perda previa de estado | Passou | `:app:assembleRelease` passou; `adb install -r` e `monkey` passaram |
| 17H03-04 | P0 | Colaborador | AUD-04 | Criar, detalhar, localizar no Talhao e editar Caderno | Contexto preservado e sem duplicidade | Passou | `T01 - 230`; `AUD04-COLAB-T01-20260721-EDITADO`; Propriedade, Talhao, autoria e visibilidade preservados |
| 17H03-05 | P0 | Admin | AUD-05 | Criar Caderno e criar/editar periodo pelo Talhao | Caderno e periodo preservam Propriedade/Talhao | Passou | Caderno `AUD05-ADMIN-T01-20260721`; Safra `AUD05-ADMIN-PERIODO-20260721`, `2026/2027`, editada para Em andamento com observacao `-EDITADO` |
| 17H03-06 | P0 | Produtor | AUD-06 | Vincular periodo opcional ao novo Caderno | Vinculo persiste sem conceder gestao do periodo | Passou | `AUD06-PRODUTOR-SAFRA-20260721`; detalhe mostrou autoria do Produtor, visibilidade liberada, `T01 - 230` e Safra do AUD-05; sem criar/editar/remover periodo |
| 17H03-07 | P0 | Todos | Persistencia | Executar `force-stop`, reabrir e conferir historico | Sessao, Cadernos, Talhao, periodo e ordem permanecem | Passou | Sessao Produtor restaurada; AUD-06, AUD-05 e AUD-04 editado reapareceram na ordem recente; Admin reencontrou periodo editado e tres Cadernos no historico especifico do Talhao, sem duplicidade |
| 17H03-08 | P0 | Todos | Nao regressao | Auditar coordenadas, chaves e aliases | Nenhuma coordenada/chave nova; aliases preservados | Passou | Buscas focadas e diff confirmaram ausencia de alteracao em codigo, contratos, mocks, area, fotos e dependencias |
| 17H03-09 | P0 | Todos | Android fisico | Repetir em aparelho autorizado | Validacao fisica antes de campo | Reexecutar | Emulador nao substitui aparelho fisico; campo continua pendente e nao aprovado |

**Rodada Fase 17H.0.2 - Consolidacao Das Decisoes Funcionais**

Observacao geral em 2026-07-21: rodada exclusivamente documental. As decisoes
15 a 21 foram consolidadas sem executar novo smoke interativo e sem promover
evidencia anterior. Nenhuma funcionalidade, coordenada, chave de storage,
dependencia, contrato, mock, seed ou asset foi alterado.

- `DECISOES_CONSOLIDADAS_PARA_FECHAMENTO_DO_BASELINE`
- `DESENVOLVIMENTO_EM_EMULADOR_AUTORIZADO`
- `CAMPO_BLOQUEADO_ATE_ANDROID_FISICO`

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H02-01 | P0 | Todos | Decisoes | Registrar gate de emulador/campo | Desenvolvimento pode seguir em emulador; campo exige Android fisico autorizado | Passou | Decisao 15 consolidada; nao e aprovacao fisica |
| 17H02-02 | P0 | Todos | Caderno/ponto | Registrar armazenamento e persistencia futura | Metadado opcional no Caderno, sem chave dedicada, somente por acao explicita e submit | Passou | Decisoes 16 e 17 consolidadas; nenhuma implementacao criada |
| 17H02-03 | P1 | Todos | Area/perimetro | Registrar linguagem segura | Area total informada, area mapeada, ausencia nao informada e perimetro somente com origem | Passou | Decisao 18; correcao de UI continua pendente |
| 17H02-04 | P1 | Todos | Fotos | Registrar natureza dos placeholders | `picsum.photos` permanece simulacao e sera segregado em microfase propria | Passou | Decisao 19; foto real continua fora do escopo |
| 17H02-05 | P2 | Todos | Backend/dependencias | Registrar limites tecnicos | Celular nao processa mapas; backend e alinhamento Expo ficam em fases isoladas | Passou | Decisoes 20 e 21; nenhuma dependencia alterada |
| 17H02-06 | P0 | Colaborador/Admin/Produtor | Baseline | Executar AUD-04, AUD-05, AUD-06 e force-stop | Evidencias manuais fechadas sem regressao | Passou | Executado na 17H.0.3 em Pixel Tablet/API 35; Android fisico permanece em 17H02-07 |
| 17H02-07 | P0 | Todos | Android fisico | Executar roteiro em aparelho autorizado | Validado fisicamente antes de declarar apto para campo | Reexecutar | Android fisico segue pendente e nao aprovado |

**Rodada Fase 17H.0.1 - Auditoria Consolidada Das Pendencias Do MVP**

Observacao geral em 2026-07-21: esta foi uma auditoria de codigo, contratos,
storage, testes e evidencias anteriores de smoke. Nao havia emulador nem
Android fisico listado em `adb devices -l`, portanto nao ocorreu nova rodada
interativa, instalacao ou `monkey`. `Passou` consolida evidencia anterior de
emulador ou uma verificacao estatica explicita; `Reexecutar` identifica os
casos manuais ainda sem fechamento. O APK release foi gerado com sucesso.
Nenhuma funcionalidade, chave `@tche:` ou coordenada persistida foi criada.
Android fisico segue pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| AUD-01 | P0 | Todos | Material tecnico | Conferir Fertilidade, Correcao de solo e Prescricao | Somente os tres tipos principais; PNG sem Prescricao | Passou | Codigo/testes e smoke 17C.1 |
| AUD-02 | P0 | Admin/Colaborador/Produtor | Prescricao ZIP | Anexar, abrir detalhe, substituir, remover e tentar invalido | ZIP local por metadados, sem unzip/processamento; Produtor somente consulta | Passou | Suites ZIP e smoke 17C.1 |
| AUD-03 | P0 | Produtor | Caderno por Talhao | Criar pelo Talhao e ver historico | Registro permanece no Talhao correto e aparece por data | Passou | 17F.2 e testes de consulta/Caderno |
| AUD-04 | P0 | Colaborador | Caderno por Talhao | Criar pelo Talhao dentro do escopo | Contexto, autoria, visibilidade e ordenacao preservados | Passou | 17H.0.3: `T01 - 230`, detalhe/historico e edicao `AUD04-COLAB-T01-20260721-EDITADO` sem duplicidade |
| AUD-05 | P0 | Admin | Talhao/Caderno/Safra | Abrir Talhao, Caderno e Safra/Safrinha | Consulta e gestao autorizadas sem perda de contexto | Passou | 17H.0.3: Caderno AUD-05 e Safra AUD-05 criados/editados no mesmo Talhao; contexto preservado |
| AUD-06 | P0 | Produtor | Caderno/Safra | Criar Caderno com Safra/Safrinha opcional | Vinculo opcional persiste sem dar gestao do periodo ao Produtor | Passou | 17H.0.3: periodo selecionado explicitamente em AUD-06; detalhe/lista e permissoes corretos |
| AUD-07 | P1 | Admin/Colaborador | GeoJSON/Talhao | Abrir GeoJSON local, area mapeada e selecionar Talhao | Polygon/MultiPolygon e Talhao funcionam; area aparece somente quando disponivel | Passou | 16H.6/17G.3; bug de rotulo/zero registrado para microfase propria |
| AUD-08 | P0 | Todos | Localizacao | Testar sucesso foreground, negacao e GPS desligado | Posicao aproximada do aparelho e precisao informada, sem persistencia ou crash | Passou | 17G.2/17G.3 em emulador |
| AUD-09 | P0 | Todos | Material/localizacao | Abrir PNG e ZIP apos usar localizacao | Nenhuma coordenada ou marcador entra em PNG/ZIP | Passou | Auditoria de contratos/storage e evidencia 17G.3 |
| AUD-10 | P1 | Todos | Processamento externo | Conferir linguagem e fluxos remotos | Stubs/mocks nao aparecem como servidor, processamento ou download real pronto | Passou | Fluxos visiveis permanecem locais; backend continua inexistente |
| AUD-11 | P1 | Todos | Fotos | Confirmar ausencia de foto georreferenciada | Sem camera, permissao, arquivo, geotag, consentimento, teste ou smoke real | Passou | Botoes simulados de Visita registrados como problema P1 |
| AUD-12 | P0 | Todos | Android fisico | Instalar APK e repetir roteiro de campo | Dispositivo autorizado listado, app instalado e fluxo validado | Reexecutar | `adb devices -l` vazio; Android fisico nao aprovado |

Problemas que devem permanecer visiveis no proximo smoke:

- a tela do mapa pode exibir area ausente como `0 ha total` e chamar area
  mapeada de area total;
- Camera/Galeria em Nova/Editar Visita ainda sao simuladas com
  `picsum.photos`, sem captura/geotag real;
- historico do Caderno apos `force-stop` passou na 17H.0.3 com AUD-04, AUD-05,
  AUD-06 e o periodo do Admin; repetir somente no smoke fisico obrigatorio;
- `npx expo install --check` reportou esperado `expo ~56.0.16` e
  `expo-location ~56.0.21`; nao corrigir dentro do smoke funcional.

**Rodada Fase 17H.0 - Analise De Marcacoes De Campo**

Observacao geral em 2026-07-14 (Fase 17H.0): rodada apenas documental para
analisar marcacoes de campo vinculadas ao Caderno. Nenhuma marcacao foi
implementada, nenhuma coordenada foi salva, nenhum storage novo foi criado e
nenhuma chave `@tche:` nova foi criada. A recomendacao para uma futura 17H.1 e
usar o Caderno como armazenamento principal do MVP demonstravel, com metadados
opcionais de localizacao salvos somente por acao explicita e apenas junto com o
salvamento do registro. Localizacao continua foreground only, sem background,
tracking, watch, TaskManager, geofencing, trilha, rota, historico ou marcador
em PNG/ZIP. Android fisico segue pendente e nao aprovado.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17H-00 | P0 | Todos | Analise | Criar documento tecnico 17H.0 | Diagnostico, recomendacao, modelo futuro, permissoes, UX, riscos e criterios 17H.1 documentados | Passou | `docs/project/fase-17h-marcacoes-campo.md` criado sem alterar codigo |
| 17H-01 | P0 | Todos | Escopo | Confirmar ausencia de implementacao | Nenhuma marcacao, coordenada, storage novo ou chave nova criada | Passou | Fase documental; validar por diff e auditoria textual |
| 17H1-01 | P0 | Todos | Caderno | Criar Caderno sem coordenada | Fluxo atual continua permitido e sem campo obrigatorio de localizacao | Reexecutar | Caso da futura 17H.1; nao existe implementacao de ponto nesta rodada |
| 17H1-02 | P0 | Todos | Consentimento | Usar posicao atual no registro e salvar | Coordenada persiste somente apos acao explicita e salvamento do Caderno | Reexecutar | Exige implementacao futura |
| 17H1-03 | P0 | Todos | Cancelamento | Capturar posicao e cancelar formulario | Nenhuma coordenada e salva | Reexecutar | Exige implementacao futura |
| 17H1-04 | P0 | Todos | Remocao | Remover localizacao antes de salvar | Caderno salva sem coordenada | Reexecutar | Exige implementacao futura |
| 17H1-05 | P0 | Todos | Material tecnico | Abrir PNG/ZIP com marcacoes futuras existentes | PNG/ZIP seguem sem marcador, georreferenciamento, unzip ou processamento | Reexecutar | Deve permanecer separado do mapa de Talhoes |
| 17H1-06 | P0 | Todos | Tracking | Auditar APIs de localizacao | Sem background, TaskManager, watch continuo, geofencing, trilha, rota ou historico | Reexecutar | Deve ser repetido quando houver codigo da 17H.1 |
| 17H1-07 | P0 | Todos | Android fisico | Repetir fluxo em aparelho autorizado | Permissao, precisao, consentimento e persistencia explicita validados em campo | Reexecutar | Android fisico segue pendente e nao aprovado |

**Rodada De Estabilizacao Visual E Rotas - 2026-07-14**

Observacao geral: rodada executada no `emulator-5554` (`Pixel_Tablet`, API 35)
com perfis Admin e Produtor. Foram corrigidas somente falhas visuais
reproduziveis de pluralizacao e texto. As rotas de Propriedade, Talhoes,
Material tecnico, Panorama/mapa e Caderno preservaram contexto e permissao. O
APK release foi gerado e reinstalado por cima, preservando o GeoJSON local. O
provider de localizacao do boot headless nao retornou coordenada; o erro foi
controlado, mas o marcador deve ser repetido no Android fisico.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| EST-01 | P0 | Todos | Baseline | Executar typecheck e suite de compatibilidade | Nenhuma regressao tecnica ou de dominio | Passou | `npm run typecheck` e `npm run test:domain-compat` passaram integralmente |
| EST-02 | P0 | Admin | Rotas | Abrir Sela > Talhoes > Material tecnico > Panorama > T01 | Contexto da Propriedade e GeoJSON local permanecem ativos | Passou | Fluxo completo abriu; detalhe de `T01 - 230` permaneceu consultavel |
| EST-03 | P0 | Produtor | Permissao/rotas | Abrir a propria Sela, Talhoes, Material, mapa e Caderno | Sem acao administrativa e sem acesso fora da propria realidade | Passou | Produtor viu somente a propria Propriedade e abriu `Registrar no Caderno` com Propriedade travada |
| EST-04 | P1 | Todos | Texto visual | Conferir plural de Talhao, observacao GeoJSON e atalho do Caderno | Textos corretos e legiveis | Passou | APK exibiu `15 talhoes`, `Talhao carregado de um GeoJSON local...` e `Ver e registrar ocorrencias` |
| EST-05 | P0 | Todos | Build/APK | Gerar, instalar por cima e abrir release | APK atual abre e preserva dados locais | Passou | `:app:assembleRelease`, `adb install -r` e abertura passaram; GeoJSON local permaneceu ativo |
| EST-06 | P0 | Todos | Localizacao indisponivel | Solicitar posicao sem leitura do provider | Mensagem controlada, sem crash e mapa navegavel | Passou | Permissoes concedidas; exibiu mensagem de impossibilidade de obter posicao |
| EST-07 | P0 | Todos | Marcador/localizacao | Injetar coordenada e solicitar posicao | Marcador e precisao aparecem no mapa | Reexecutar | Boot headless nao entregou leitura ao Expo; sucesso anterior permanece coberto pela 17G.3 e deve ser repetido no fisico |
| EST-08 | P0 | Todos | Android fisico | Instalar APK e repetir rotas/campo | Fluxos, teclado, GPS e persistencia passam no aparelho | Reexecutar | Nenhum Android fisico autorizado apareceu em `adb devices -l` |

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
| 17F-05 | P0 | Colaborador | Talhao | Abrir Talhao dentro do escopo e criar Caderno | Colaborador ve contexto e salva Caderno no Talhao correto | Passou | 17H.0.3: `AUD04-COLAB-T01-20260721-EDITADO` criado/editado no `T01 - 230`, sem perder contexto |
| 17F-06 | P0 | Admin/Colaborador | Safra/Safrinha | Criar periodo pelo Talhao | Formulario reaproveitado abre com Propriedade travada e Talhao pre-selecionado | Passou | 17H.0.3: Admin criou pelo Talhao e editou `AUD05-ADMIN-PERIODO-20260721`; Propriedade/Talhao preservados |
| 17F-07 | P0 | Todos | Material tecnico | Abrir materiais do Talhao e Propriedade inteira | Materiais especificos e gerais aparecem separados; Produtor sem acoes administrativas | Passou | 17F.2: Material tecnico abriu para Produtor/Colaborador com filtros de Propriedade, Demarcacao, Talhao e Safra; Admin manual deve repetir no fisico |
| 17F-08 | P0 | Todos | Regressao | Reabrir PNG, ZIP e GeoJSON/talhoes | PNG abre como imagem; ZIP detalha sem unzip; Talhoes renderizam | Reexecutar | 17F.2: Talhoes seed/mock renderizados; imports locais de GeoJSON/PNG/ZIP foram apagados pela correcao de ambiente e devem ser recriados/reabertos |
| 17F-09 | P0 | Todos | Storage | Auditar storage local | Nenhuma coordenada, GeoJSON bruto, PNG, ZIP, base64, bytes ou binario salvo em AsyncStorage | Passou | Coberto por testes de dominio, busca textual e diff restrito a pluralizacao visual |
| 17F-10 | P0 | Todos | Android fisico | Instalar APK e repetir casos em aparelho | Passa em Android fisico autorizado | Reexecutar | Android fisico segue pendente e nao aprovado |

**Rodada Fase 17G - Localizacao Foreground Sobre Talhoes**

Observacao geral em 2026-07-10 (Fase 17G.3): depois do smoke seed/mock da
17G.2, a localizacao foreground foi revalidada no emulador sobre GeoJSON local
ativo da Sela de Prata I. `limites_talhoes.geojson` foi reanexado com 15
Talhoes/37 partes, o marcador apareceu com precisao simulada de 8 m, o Talhao
continuou clicavel e `force-stop` preservou o GeoJSON sem restaurar a posicao.
PNG, ZIP, Caderno, permissao negada, localizacao desligada e perfil Produtor
foram revalidados sem regressao. A localizacao permanece sem background,
trilha/historico, AsyncStorage, backend/sync ou marcador em PNG/ZIP. Android
fisico segue pendente e nao aprovado.

Validacao tecnica da rodada: `npm run typecheck` e
`npm run test:domain-compat` passaram; `npx expo install --check` reportou
somente `expo@56.0.11 - expected version: ~56.0.15`, mantido sem correcao.
O APK release foi gerado, instalado no emulador `emulator-5554` e aberto sem
crash funcional. O pacote instalado possui `ACCESS_FINE_LOCATION` e
`ACCESS_COARSE_LOCATION`, sem `ACCESS_BACKGROUND_LOCATION`. A auditoria ampla
e as buscas focadas nao encontraram persistencia de coordenadas nem API de
background. O fallback SVG/WebView forcado ainda deve ser repetido em rodada
propria.

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| 17G-01 | P0 | Todos | Dependencia | Confirmar dependencia e permissao | Dependencia aprovada explicitamente e permissao foreground only documentada | Passou | `expo-location@~56.0.20` instalado; `app.json` sem background location |
| 17G-02 | P0 | Todos | Mapa de Talhoes | Abrir Sela > mapa de Talhoes > Mostrar minha posicao | Marcador aparece apenas sobre Talhoes/GeoJSON georreferenciado | Passou | 17G.2 aprovou seed/mock; 17G.3 aprovou GeoJSON local ativo com origem visivel, marcador azul/circulo de 8 m e `T01 - 230` ainda clicavel |
| 17G-03 | P0 | Todos | Permissao negada | Negar permissao de localizacao | Mensagem clara, sem crash e sem marcador | Passou | 17G.3: permissao revogada, `Don't allow` selecionado e mensagem controlada exibida sem quebrar GeoJSON/Talhoes |
| 17G-04 | P0 | Todos | GPS indisponivel | Simular indisponibilidade/erro de leitura | Mensagem clara e mapa segue navegavel | Passou | 17G.3: `cmd location set-location-enabled false` exibiu mensagem para ativar localizacao; servico reativado ao fim |
| 17G-05 | P0 | Todos | Storage | Auditar AsyncStorage e codigo | Nenhuma coordenada, trilha, rota ou historico salvo | Passou | 17G.3: auditoria ampla/focada sem chave ou persistencia de localizacao; `force-stop` preservou GeoJSON, mas nao restaurou marcador/posicao |
| 17G-06 | P0 | Todos | Fallback | Forcar falha do Leaflet/WebView | Fallback SVG nao promete localizacao real sem helper seguro | Reexecutar | Fallback SVG/WebView nao foi forcado manualmente nesta rodada |
| 17G-07 | P0 | Todos | Android fisico | Repetir em aparelho autorizado | Permissao, precisao e consumo basico validados em campo | Reexecutar | Android fisico segue pendente e nao aprovado |
| 17G-08 | P0 | Todos | Material tecnico | Abrir PNG/ZIP/Material tecnico | Nao ha botao/marcador de localizacao em materiais tecnicos | Passou | 17G.3: `smoke_ph_10a20.png` abriu como imagem e ZIP abriu somente detalhe sem preview/unzip; Produtor reabriu ambos sem anexar/substituir/remover |
| 17G-09 | P0 | Todos | Caderno | Auditar criacao/detalhe de Caderno | Caderno nao recebe coordenada automaticamente | Passou | 17G.3: detalhe `Observacao` preservou Sela de Prata I e `T01 - 230`, sem latitude/longitude/accuracy/capturedAt/geotag; auditoria e testes confirmaram |
| 17G-10 | P1 | Admin/Colaborador | GeoJSON local | Reanexar GeoJSON local e repetir mapa | Marcador funciona sobre GeoJSON local ativo, sem salvar GeoJSON bruto em AsyncStorage | Passou | 17G.3: `limites_talhoes.geojson`, 15 Talhoes/37 partes, ativo apos `force-stop`; camada runtime e metadados pequenos, sem FeatureCollection/features/coordinates no indice |

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
| 17E-05 | P0 | Produtor | Caderno | Registrar Caderno e selecionar Safra/Safrinha opcional | Registro salva visivel ao produtor e mostra vinculo no detalhe/lista | Passou | 17H.0.3: `AUD06-PRODUTOR-SAFRA-20260721` vinculou explicitamente a Safra AUD-05 e persistiu no detalhe/lista apos `force-stop` |
| 17E-06 | P0 | Admin/Colaborador | Caderno | Criar/editar Caderno removendo ou trocando periodo | Vinculo opcional atualiza sem trocar Propriedade | Passou | Colaborador criou Caderno com periodo, viu no detalhe e removeu o vinculo preservando a Propriedade |
| 17E-07 | P1 | Todos | Persistencia | Fechar app e reabrir | Periodos e vinculos locais continuam visiveis | Passou | 17H.0.3 confirmou novamente: Safra AUD-05 editada e vinculo do Caderno AUD-06 permaneceram apos `force-stop` |
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

**Rodada MP-02 - Modelo Territorial E Bloqueio De Autoedicao**

Esta rodada valida somente o contrato canonico e a defesa local. O motor atual
continua usando `sub_regioes` e fallback `vinculos_microregioes`; backend,
auditoria e migracao permanecem em `MP-35`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| MP02-01 | P0 | Colaborador | Sessao do Colaborador ativa | Abrir Perfil e localizar o escopo | Secao usa `Escopo operacional`, identifica vinculos legados como somente leitura e orienta solicitar correcao ao Admin | Reexecutar | Nao reclassificar nomes legados por inferencia |
| MP02-02 | P0 | Colaborador | Perfil aberto | Tocar `Editar dados` | Formulario permite editar nome, mas nao possui campo livre de Regiao, Regional, Area ou Propriedade atribuida | Reexecutar | Salvar nome nao altera o escopo |
| MP02-03 | P0 | Colaborador | Rota `EditProfile` aberta diretamente | Inspecionar e salvar | Rota direta tambem nao oferece autoedicao territorial | Reexecutar | Payload territorial direto e coberto por teste automatizado |
| MP02-04 | P0 | Colaborador | Escopo conhecido antes da edicao | Editar nome, voltar ao Perfil, forcar parada e reabrir | Nome pode mudar; `regiao`, `sub_regioes`, vinculos e Propriedades permanecem iguais | Reexecutar | Nao usar `pm clear` ou reinstalacao destrutiva |
| MP02-05 | P0 | Admin | Admin -> Usuarios -> Colaborador | Abrir cadastro/edicao administrativa legada | Campos territoriais continuam disponiveis somente no fluxo administrativo e permanecem declarados como mock/legado | Reexecutar | Nao afirma auditoria ou RBAC produtivo |
| MP02-06 | P0 | Produtor | Perfil do Produtor aberto | Tentar acessar autoedicao estrutural | Produtor continua sem editar vinculos de Propriedade/Titular | Reexecutar | Preservar orientacao de solicitacao de atualizacao |
| MP02-07 | P0 | Todos | Fluxos principais acessiveis | Abrir Propriedades, Visitas e Caderno apos a mudanca | Motor de acesso e contexto de `fazenda_id` permanecem inalterados | Reexecutar | Regressao dos tres perfis |

**Rodada MP-03 - Contrato De Notificacoes**

Esta matriz prepara a validacao produtiva de `MP-34`. A MP-03 nao altera o
mock atual; portanto, os casos abaixo permanecem `Bloqueado` ate existirem
backend, persistencia e navegacao segura.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| MP03-01 | P0 | Produtor | Produtor vinculado somente a Propriedade A | Consultar notificacoes quando existe evento da Propriedade B | Nenhum texto, contador ou entrega da Propriedade B e retornado | Bloqueado | Exige consulta server-side por destinatario/escopo |
| MP03-02 | P0 | Colaborador | Escopo limitado a uma Area/Regional | Consultar lista e contador | Lista e contador contem somente recursos do escopo atual | Bloqueado | Revalidar reducao de escopo |
| MP03-03 | P0 | Admin | Duas organizacoes isoladas | Consultar notificacoes na organizacao atual | Nenhuma entrega da outra organizacao aparece | Bloqueado | Tenant vem da sessao |
| MP03-04 | P0 | Todos | Notificacao autorizada nao lida | Marcar como lida e reiniciar | Estado lido e contador persistem para o mesmo destinatario | Bloqueado | Horario do servidor e operacao idempotente |
| MP03-05 | P0 | Todos | Notificacao autorizada visivel | Descartar e reiniciar | Entrega nao reaparece; evento/historico nao e apagado | Bloqueado | Retencao final ainda sera configurada |
| MP03-06 | P0 | Todos | Notificacao referencia recurso autorizado | Tocar na notificacao | Servidor reautoriza e allowlist abre exatamente o recurso indicado | Bloqueado | Tela de destino repete o guard |
| MP03-07 | P0 | Todos | Entrega antiga perdeu autorizacao | Tocar por lista, deep link e rota direta | Acesso negado sem revelar o recurso; destino pendente e limpo | Bloqueado | Leitura nao concede acesso |
| MP03-08 | P0 | Dois usuarios | Usuario A possui lista carregada | Fazer logout e entrar como Usuario B | Lista, contador, cursor, resposta tardia e rota do Usuario A nao aparecem | Bloqueado | Testar resposta de rede atrasada |
| MP03-09 | P0 | Todos | Mesma chave de evento processada duas vezes | Reprocessar o evento | Existe somente uma entrega por destinatario/chave | Bloqueado | Deduplicacao server-side |
| MP03-10 | P1 | Todos | Sessao offline ainda valida | Abrir cache de notificacoes | Apenas consulta segregada e autorizada; leitura, descarte e destino exigem rede | Bloqueado | Sem fila de mutacao offline no primeiro corte |

**Rodada MP-04 - Ciclo De Vida Do Caderno**

Esta matriz prepara `MP-25` e `MP-36`. A MP-04 nao altera o mock; portanto, os
casos abaixo permanecem `Bloqueado` ate existirem estados, eventos e
persistencia auditavel.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| MP04-01 | P0 | Produtor | Rascunho proprio na propria Propriedade | Editar e descartar antes do envio | Somente o criador altera o rascunho; nenhum registro consolidado e criado | Bloqueado | Rascunho nao aparece como registrado |
| MP04-02 | P0 | Produtor | Rascunho valido | Revisar, confirmar e enviar | Transicao atomica para `registrado`, com autoria/origem e snapshot original | Bloqueado | Validacao por tipo entra em `MP-25` |
| MP04-03 | P0 | Produtor | Registro proprio ja enviado | Tentar editar pela UI, rota direta e payload | Corpo e localizacao original permanecem inalterados | Bloqueado | Produtor nao altera consolidado |
| MP04-04 | P0 | Colaborador | Registro do Produtor dentro do escopo | Tentar usar edicao completa atual | Edicao destrutiva e recusada; origem e original permanecem | Bloqueado | Acesso ao detalhe nao concede correcao |
| MP04-05 | P0 | Colaborador | Registro autorizado e permissao de complemento | Adicionar complemento | Complemento aparece separado, com autor/data, sem mudar original | Bloqueado | Produtor ve somente se liberado |
| MP04-06 | P0 | Admin/Colaborador | Permissao explicita de correcao | Corrigir campo com motivo e versao atual | Evento preserva antes/depois, autor, motivo e incrementa versao | Bloqueado | Propriedade/autoria fora da allowlist |
| MP04-07 | P0 | Admin/Colaborador | Registro com ponto original | Corrigir localizacao | Novo grupo integral vira valor vigente e grupo original continua consultavel | Bloqueado | Grupo parcial e recusado |
| MP04-08 | P0 | Admin/Colaborador | Registro autorizado | Alterar visibilidade | Evento registra antes/depois e Produtor recebe apenas o permitido | Bloqueado | Visibilidade nao amplia escopo |
| MP04-09 | P0 | Admin/Colaborador | Registro consolidado | Arquivar e reativar com justificativa | Sai/volta da lista comum sem perder original ou historico | Bloqueado | Duas transicoes auditadas |
| MP04-10 | P0 | Admin/Colaborador | Registro consolidado ou arquivado | Anular com justificativa | Registro fica `anulado`, preservado e sem efeito operacional | Bloqueado | Estado terminal; sem delete |
| MP04-11 | P0 | Dois operadores | Ambos carregaram a mesma versao | Primeiro corrige; segundo envia comando antigo | Segundo recebe conflito e nenhuma alteracao e perdida | Bloqueado | Sem `last write wins` |
| MP04-12 | P0 | Todos | Registro legado sem estado | Migrar/abrir depois da implementacao | Tratado como consolidado, bloqueado para edicao e sem historico inventado | Bloqueado | Snapshot de migracao identificado |
| MP04-13 | P0 | Produtor | Sessao offline valida | Criar rascunho e tentar enviar offline | Rascunho local permanece; envio exige reconexao, revisao e confirmacao | Bloqueado | Sem envio automatico |
| MP04-14 | P0 | Admin/Colaborador | Registro fora do escopo | Tentar complemento/correcao por rota direta | Operacao recusada sem criar evento ou revelar dados adicionais | Bloqueado | Exige autorizacao server-side |

**Rodada MP-05 - Estados De Visita**

Esta matriz prepara `MP-27` e a validacao produtiva correspondente. A MP-05
nao altera o mock; portanto, os casos permanecem `Bloqueado`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| MP05-01 | P1 | Admin/Colaborador | Nova Visita | Escolher Agendar e salvar data futura | Cria `agendada` com evento inicial e Propriedade preservada | Bloqueado | Comando tipado |
| MP05-02 | P1 | Admin/Colaborador | Nova Visita | Escolher Registrar realizada e concluir formulario | Cria `realizada` com os mesmos minimos da conclusao | Bloqueado | Nao passa por `agendada` ficticia |
| MP05-03 | P1 | Admin/Colaborador | Visita agendada futura | Reagendar com motivo | Continua `agendada` e registra data anterior/nova, autor e versao | Bloqueado | Propriedade nao muda |
| MP05-04 | P1 | Todos | Visita agendada com horario vencido | Abrir lista e detalhe | Exibe `Agendada · Atrasada` sem mudar estado automaticamente | Bloqueado | Comparacao pelo servidor |
| MP05-05 | P1 | Admin/Colaborador | Visita agendada autorizada | Concluir | Exige confirmacao, inicio real e resumo antes de virar `realizada` | Bloqueado | Acao imediata atual deve sair |
| MP05-06 | P1 | Admin/Colaborador | Visita agendada autorizada | Cancelar | Exibe contexto completo, exige motivo e grava evento `cancelada` | Bloqueado | Sem exclusao |
| MP05-07 | P1 | Admin/Colaborador | Visita realizada | Tentar voltar para agendada ou cancelar pela UI/payload | Transicao recusada sem alterar registro ou historico | Bloqueado | Rota direta incluida |
| MP05-08 | P1 | Admin/Colaborador | Visita cancelada | Tentar reativar/realizar; depois criar nova vinculada | Antiga fica somente leitura; nova possui `visita_origem_id` | Bloqueado | Nao reutilizar ID |
| MP05-09 | P1 | Admin/Colaborador | Visita realizada e permissao explicita | Complementar ou corrigir com motivo | Eventos separados preservam conclusao e antes/depois | Bloqueado | Sem edicao geral |
| MP05-10 | P1 | Admin | Visita realizada | Anular com justificativa | Estado vira `anulada`, historico permanece e nenhuma exclusao ocorre | Bloqueado | Estado terminal |
| MP05-11 | P1 | Admin | Qualquer Visita persistida | Tentar excluir pela UI, rota direta e API | Exclusao fisica recusada; usar cancelamento/anulacao cabivel | Bloqueado | Remove botao atual |
| MP05-12 | P1 | Dois operadores | Mesma Visita/versao carregada | Primeiro conclui; segundo tenta cancelar | Segundo recebe conflito e estado realizado permanece | Bloqueado | Validar estado e versao |
| MP05-13 | P1 | Produtor | Visita da propria Propriedade | Consultar e tentar comandos diretos | Consulta permitida; toda mutacao recusada | Bloqueado | Perfil consultivo |
| MP05-14 | P1 | Colaborador | Visita fora do escopo | Tentar reagendar/concluir/cancelar por rota direta | Operacao recusada sem evento ou vazamento | Bloqueado | Autorizacao server-side |
| MP05-15 | P1 | Todos | Sessao offline valida | Consultar e tentar mudar estado | Consulta local autorizada; mutacao exige conexao | Bloqueado | Sem fila offline |

**Rodada MP-06 - Versionamento De GeoJSON E Talhoes**

Esta matriz prepara `MP-37` e `MP-39`. A MP-06 nao altera o importador local;
portanto, os casos produtivos permanecem `Bloqueado`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| MP06-01 | P1 | Admin/Tecnico | Versao publicada A | Importar arquivo B | A permanece consultavel; B nasce rascunho e nao muda o mapa publicado | Bloqueado | Arquivo imutavel |
| MP06-02 | P1 | Admin/Tecnico | Rascunho B reconciliado | Publicar B | B vira publicada atomicamente e A e arquivada sem exclusao | Bloqueado | Uma vigente por instante |
| MP06-03 | P1 | Todos | A e B publicadas em vigencias sucessivas | Consultar registro criado durante A | Resolve a geometria A, mesmo com B vigente hoje | Bloqueado | Por ID salvo ou data |
| MP06-04 | P1 | Admin/Tecnico | Mesmo Talhao com nome novo | Reconciliar B | Mantem `talhao_id`, registra alias e snapshot anterior | Bloqueado | Nome nao e chave |
| MP06-05 | P1 | Admin/Tecnico | Mesmo arquivo com features reordenadas | Reconciliar B | Ordem nao troca identidades nem cria Talhoes | Bloqueado | Indice nao e chave |
| MP06-06 | P1 | Admin/Tecnico | Mesmo Talhao com contorno/area nova | Reconciliar e publicar | Mantem `talhao_id` e cria nova versao geometrica | Bloqueado | Antes/depois auditado |
| MP06-07 | P1 | Admin/Tecnico | Talhao ausente em B | Tentar publicar sem decisao | Publicacao bloqueada ate manter ou encerrar explicitamente | Bloqueado | Sem exclusao automatica |
| MP06-08 | P1 | Admin/Tecnico | Um Talhao dividido em dois | Reconciliar e publicar | Predecessor e encerrado; sucessores novos preservam linhagem | Bloqueado | Registros antigos ficam no predecessor |
| MP06-09 | P1 | Admin/Tecnico | Dois Talhoes fundidos | Reconciliar e publicar | Predecessores encerrados; resultado novo preserva todas as relacoes | Bloqueado | Sem reatribuicao historica |
| MP06-10 | P1 | Admin/Tecnico | Feature sem ID e correspondencia ambigua | Tentar submeter/publicar | Exige decisao humana e bloqueia enquanto ambigua | Bloqueado | Nome/sobreposicao sao sugestoes |
| MP06-11 | P1 | Colaborador | Propriedade dentro do escopo | Criar rascunho, reconciliar e tentar publicar | Pode preparar/submeter conforme permissao; publicacao e recusada | Bloqueado | Primeiro contrato |
| MP06-12 | P1 | Produtor | Propria Propriedade | Consultar atual/historico e tentar importacao por rota direta | Ve somente versoes autorizadas; toda mutacao e recusada | Bloqueado | Sem rascunhos administrativos |
| MP06-13 | P1 | Dois revisores | Mesma versao base A | Primeiro publica B; segundo tenta publicar C reconciliada sobre A | Segundo recebe conflito e precisa reconciliar novamente | Bloqueado | Sem `last write wins` |
| MP06-14 | P1 | Todos | Versao publicada em cache e sessao offline valida | Consultar e tentar publicar/restaurar | Consulta informa versao/vigencia; mutacoes exigem conexao | Bloqueado | Sem publicacao otimista |
| MP06-15 | P1 | Admin/Tecnico | Registro legado com Talhao textual | Executar migracao | Correspondencia confirmada recebe ID; ambigua fica nao resolvida e preserva texto | Bloqueado | Sem historico inventado |
| MP06-16 | P1 | Admin/Tecnico | Versao A arquivada e B vigente | Restaurar conteudo de A | Cria nova publicacao/vigencia auditada; B continua preservada | Bloqueado | Restauracao nao reescreve |
| MP06-17 | P1 | Admin/Tecnico | Arquivo identico ao ja importado | Repetir comando/chave | Checksum sinaliza duplicata e idempotencia nao cria versao/evento duplicado | Bloqueado | Checksum nao define Talhao |

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
