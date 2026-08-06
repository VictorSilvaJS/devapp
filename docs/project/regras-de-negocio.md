# Regras de Negocio

Este documento registra regras de dominio e acesso que devem orientar modelagem, UX e implementacao. Quando um ponto ainda nao estiver fechado, ele nao deve ser transformado em regra aqui.

## Convencao de Linguagem

Na linguagem de produto, `Propriedade` e o termo oficial para a unidade operacional vista pelo usuario. `Produtor` e o usuario/perfil final, `Titular` e o responsavel cadastral ou vinculo principal da propriedade, e `Talhao` e a subdivisao interna.

No codigo legado e em documentos tecnicos, `fazenda`, `fazenda_id`, nomes de rotas, arquivos, contratos e campos internos podem permanecer temporariamente por compatibilidade. Alias historicos como `cliente` e `proprietario` podem aparecer ao explicar contexto antigo ou inconsistencias, mas nao devem conduzir a linguagem de produto.

## Regras de Dominio

### Produtor e propriedade

- O sistema deve considerar que um produtor pode estar vinculado a uma ou mais propriedades.
- Cada Propriedade do contrato v2 possui exatamente um Produtor como Titular
  principal ativo.
- Outros usuarios podem ser vinculados a Propriedade sem se tornarem
  Titulares.
- O perfil define quais acoes o usuario pode executar; o vinculo ativo em
  `usuario_propriedade` define em quais Propriedades essas acoes podem ser
  executadas.
- A navegacao, os dados e as permissoes devem respeitar essa relacao.
- O contexto de propriedade e parte central da leitura do dominio, nao apenas um detalhe cadastral.
- No mock administrativo, o vinculo entre usuario produtor e propriedade deve ser representado visualmente por uma relacao explicita `usuario_propriedade`, preservando compatibilidade com `produtor_id`/titular enquanto a base legada existir.
- No mock administrativo, produtor pode ter multiplas propriedades vinculadas e deve receber alerta visual quando uma propriedade selecionada ja tiver outro produtor principal no mock.
- O cadastro estrutural de Propriedade e exclusivo de Admin; Colaborador e
  Produtor nao criam Propriedades.
- O Produtor deve existir e estar ativo antes de ser escolhido como Titular.
- O cadastro grava `titular_id`, `municipio_id`, `municipio_nome`, `uf_id`,
  `uf_sigla` e cria o vinculo ativo de Titular em `usuario_propriedade`.
- Colaboradores opcionais sao selecionados nominalmente e recebem um vinculo
  direto ativo por Propriedade; localizacao nao cria vinculo automatico.
- No mock v2, a criacao da Propriedade e de todos os seus vinculos e atomica:
  qualquer falha desfaz o conjunto completo.
- A edicao cadastral comum da Propriedade tambem e exclusiva de Admin e deve
  atualizar os dados canonicos e os vinculos diretos de Colaboradores em uma
  unica operacao atomica.
- O `titular_id` e somente leitura na edicao cadastral comum. Uma futura troca
  de Titular exige fluxo administrativo proprio, transacional e auditado.
- A edicao v2 nao grava Regiao, Microrregiao, documento da Propriedade nem um
  campo legado de Colaborador responsavel; acesso continua representado por
  `usuario_propriedade`.
- A criacao combinada produtiva futura deve preservar a mesma atomicidade no
  backend.

### Modelo territorial canonico

O contrato canonico esta em `modelo-territorial.md`.

- UF e Municipio representam a localizacao oficial da Propriedade e devem usar
  codigos estaveis do IBGE.
- Municipio/UF nao concedem acesso por si so.
- Colaborador recebe escopo somente por vinculo administrativo direto e ativo
  com Propriedade.
- Colaborador consulta os proprios vinculos e nao pode altera-los pelo Perfil.
- Somente Admin autorizado altera vinculos, com justificativa, auditoria e
  revalidacao do escopo.
- `regiao`, `microregiao`, `sub_regioes` e `vinculos_microregioes` permanecem
  legados do mock v1 ate sua substituicao integral; nomes nao devem ser
  reclassificados automaticamente nem gravados no modelo v2.

### Territorio e vinculos visuais no mock

- Esta secao registra apenas a fronteira de compatibilidade do mock v1; ela nao
  orienta novas telas nem novas escritas v2.
- `territorioCompat`, `regiao`, `microregiao`, `sub_regioes` e
  `vinculos_microregioes` podem ser lidos somente durante migracao do v1.
- Novos cadastros, filtros, resumos e vinculos nao usam esses campos.
- `propriedades_atribuidas` e alias legado de leitura; o acesso v2 usa vinculo
  direto ativo `usuario_propriedade`.
- O Perfil do Colaborador nao deve editar `regiao`, `sub_regioes`,
  `vinculos_microregioes` ou `propriedades_atribuidas`; a consulta local deve
  orientar solicitacao de correcao ao Admin.

### Usuarios administrativos no mock

- Usuario representa a pessoa cadastrada para acesso presente ou futuro ao sistema.
- Propriedade representa a unidade produtiva/operacional e nao deve duplicar o cadastro completo da pessoa.
- Campos comuns de usuario no mock administrativo: nome, e-mail, telefone, documento, perfil, status e observacoes.
- Status de usuario no mock administrativo deve ser explicito: `ativo`, `inativo` ou `pendente`.
- O booleano `ativo` e apenas compatibilidade temporaria quando necessario.
- Admin pode ter nivel administrativo simples: Global, Operacional ou Suporte.
- O cadastro ou edicao de usuario no MVP visual/mockado nao cria login real, senha real, convite, reset de acesso ou sessao.

### Dados ligados ao contexto da propriedade

- Mapas, arquivos, visitas e registros de campo devem ser entendidos no contexto da propriedade a que pertencem.
- O sistema nao deve tratar mapas e materiais tecnicos como elementos soltos, desconectados do produtor e da propriedade.

## Regras de Acesso

### Administracao geral

- Possui visao ampla do sistema.
- Pode navegar entre regioes, produtores e propriedades.
- Seu fluxo deve privilegiar leitura consolidada e administracao dos dados autorizados.
- No MVP mockado, pode gerenciar visualmente usuarios, vinculos com propriedades e vinculos com microregioes sem criar autenticacao real.
- No MVP mockado, Admin ve todas as Propriedades; edicoes visuais de
  `propriedades_atribuidas` nao alteram acesso efetivo do colaborador.

### Colaborador

- Atua na manutencao operacional dos dados conforme permissao.
- No contrato v2, acessa somente Propriedades com vinculo direto ativo do tipo
  `colaborador` em `usuario_propriedade`.
- Nao deve acessar Propriedade sem vinculo ativo, inclusive por rota direta.
- Municipio e UF podem filtrar a interface administrativa, mas nao concedem
  acesso.
- Somente Admin autorizado atribui ou encerra vinculos.
- O motor v1 ainda usa `sub_regioes` e `vinculos_microregioes`; esse
  comportamento e legado em migracao e nao deve aparecer nos novos dados.

### Produtor

- Acessa os dados da sua propria realidade operacional.
- Deve conseguir consultar materiais e historicos autorizados.
- Nao deve ser tratado como responsavel por gerenciar a estrutura geral do sistema.
- No mock administrativo, produtor ativo deve ter ao menos uma propriedade vinculada.
- Produtor pendente pode existir sem propriedade vinculada.
- No MVP mockado, o acesso efetivo do Produtor a Propriedades ocorre por
  vinculo de titular/produtor compativel.

## Regra de Visibilidade

- A visualizacao do produtor deve ser a mais restrita entre os perfis principais.
- A visualizacao do colaborador deve respeitar os vinculos diretos ativos com
  Propriedades.
- A administracao geral deve conseguir enxergar o panorama consolidado da operacao.

## Regra Sobre Notificacoes

O contrato canonico esta em `contrato-notificacoes.md`.

- Notificacao produtiva e uma entrega individual vinculada a destinatario e
  organizacao; nao e uma lista global filtrada somente pelo cliente.
- Evento e entrega sao registros distintos.
- Recurso operacional deve possuir tipo, ID estavel e Propriedade; Talhao e
  opcional.
- Admin, Colaborador e Produtor recebem somente entregas compativeis com o
  escopo e a visibilidade vigentes.
- Leitura e descarte persistem por destinatario e nao concedem acesso.
- Abertura usa allowlist de recursos e reautorizacao no servidor; rota, texto e
  payload local nao sao autoridade.
- Troca de usuario, organizacao ou logout limpa lista, contador, requisicoes e
  destino pendente da identidade anterior.
- O contexto local atual permanece mock global e efemero. Ele nao deve ser
  descrito como isolamento ou persistencia produtiva.

## Contrato Futuro De Backend/RBAC

Status em 2026-08-05: a decisao 33 substituiu a recomendacao regional anterior.
O motor v1 continua territorial apenas ate a migracao tecnica; o contrato v2 e
o backend futuro usam vinculo direto por Propriedade para Colaborador.

Status em 2026-06-03 (Fase 14F): a matriz tecnica de testes e criterios de
aceite deste contrato foi registrada em `matriz-rbac-backend.md`. Ela deve
orientar a futura implementacao de backend/RBAC, mas nao implementa permissao
nova no MVP mockado.

### Matriz futura por perfil

| Perfil | Escopo de Propriedades | Leitura | Operacao |
|---|---|---|---|
| Admin | Global | Lista e abre todas as Propriedades autorizadas pela organizacao | Pode administrar cadastros e vinculos conforme papel administrativo |
| Produtor | Vinculo com Propriedade/Titular | Lista e abre Propriedades em que possui vinculo ativo | Consulta mapas/anexos, visitas e caderno autorizados; nao administra estrutura geral |
| Colaborador | `usuario_propriedade` direto e ativo | Lista e abre somente Propriedades atribuidas | Atua operacionalmente conforme permissoes por acao |

### Entidades minimas de backend

- `usuarios`: pessoa/acesso, perfil principal, status e dados de autenticacao.
- `propriedades`: unidade operacional, titular principal, Municipio/UF,
  status e dados cadastrais.
- `usuario_propriedade`: vinculos diretos entre usuario e Propriedade, com
  tipo de vinculo, status, principal quando aplicavel e origem do vinculo.
- `perfis`/`papeis`: definicao de capacidades por perfil e, se necessario,
  papeis administrativos mais granulares.

### Regras futuras de leitura e acao

- Listar Propriedades: Admin lista tudo; Produtor lista por
  `usuario_propriedade`/titularidade; Colaborador lista por
  `usuario_propriedade` direto e ativo.
- Abrir detalhe de Propriedade: permitido quando a Propriedade estiver dentro
  do escopo do perfil, seguindo a mesma precedencia de listagem.
- Ver mapas/anexos: permitido quando o usuario tem acesso a Propriedade e o
  material esta liberado para o perfil/acao correspondente.
- Criar visita: Admin e Colaborador podem criar conforme permissao de acao e
  escopo da Propriedade; Produtor nao deve criar visita tecnica por padrao.
- Editar cadastro: Admin pode editar conforme papel administrativo;
  Colaborador so deve editar se houver permissao explicita por acao e escopo;
  Produtor nao deve editar estrutura cadastral da Propriedade por padrao.

### Precedencia futura recomendada

1. Admin tem acesso global.
2. Produtor tem acesso por titularidade/vinculo direto com a Propriedade.
3. Colaborador tem acesso apenas por Propriedade atribuida diretamente.

### Localizacao e acesso direto

- Municipio/UF descrevem a localizacao e ajudam a selecionar Propriedades em
  lote.
- Acesso deriva de `usuario_propriedade` e concede escopo somente para a
  Propriedade especifica.
- Nova Propriedade no mesmo Municipio exige atribuicao administrativa propria.

### Riscos de divergencia

- Se o backend inferir acesso por Municipio/UF, uma nova Propriedade pode ser
  exposta sem atribuicao administrativa.
- Se o backend ignorar `usuario_propriedade`, o Admin pode cadastrar vinculos
  que nao produzem efeito real.
- Se mapas, visitas e caderno nao validarem permissao por Propriedade no
  backend, rotas diretas podem expor dados fora do escopo.
- Se `fazenda_id`, `propriedade_id`, titularidade e vinculos forem migrados sem
  leitura dupla, Produtor pode deixar de ver Propriedades vinculadas.

### Pendencias para modelagem real

- Implementar os ids canonicos definidos em `modelo-dados-mock-v2.md`.
- Definir validade, origem e auditoria dos vinculos `usuario_propriedade` no
  backend.
- Definir matriz de permissoes por acao: listar, abrir detalhe, criar visita,
  editar visita, criar caderno, editar caderno, liberar/download de anexos e
  editar cadastro.
- Definir como auditar alteracoes de vinculos e permissoes.
- Definir estrategia de descarte do mock v1 e migracao do codigo que usa
  `sub_regioes`, `vinculos_microregioes`, `propriedades_atribuidas`, `produtor_id`,
  `proprietario_id`, `titular_id`, `fazenda_id` e `propriedade_id`.

## Regra sobre Mapas e Arquivos

- Mapas e arquivos pertencem ao contexto da propriedade.
- Novos anexos locais devem ser organizados por `Propriedade -> Ano ->
  Categoria`, usando somente Fertilidade, Correcao de solo e Prescricao como
  categorias principais do MVP.
- Ano do arquivo e obrigatorio. Safra/Safrinha, quando informada, deve
  referenciar um periodo produtivo ativo da mesma Propriedade e nao substitui
  o ano.
- O nome original do arquivo deve ser preservado. O titulo pode ser gerado
  automaticamente a partir dele, sem transformar o nome em fonte exclusiva
  para Propriedade, ano, categoria ou permissao.
- Fertilidade pertence ao escopo da Propriedade e registra profundidade;
  Correcao de solo registra profundidade e pode pertencer a Propriedade inteira
  ou a um Talhao; Prescricao nao exige profundidade, camada ou Talhao no corte
  atual.
- Quando a profundidade nao for comprovada, deve ser registrada como `Nao
  informada`, sem inferencia silenciosa. Elemento ou subcategoria inferidos do
  nome sao informativos e nunca devem inventar classificacao desconhecida.
- PNG, PDF e ZIP podem ser catalogados como materiais locais. PNG pode ter
  visualizacao como imagem; PDF e ZIP nao devem ser apresentados como
  visualizados, descompactados ou processados quando essa capacidade nao
  existir.
- Arquivos fisicos devem ficar fora do `AsyncStorage`; o indice local guarda
  somente metadados pequenos.
- Registros mockados, PNG local e Prescricao ZIP anteriores permanecem
  legiveis por compatibilidade e nao devem ser duplicados automaticamente no
  indice unificado.
- A disponibilizacao desses materiais deve respeitar regra de perfil e liberacao.
- No MVP local, o Produtor consulta apenas material ativo e marcado como
  visivel em Propriedade do proprio vinculo, sem anexar, substituir ou remover.
- Download remoto, quando existir, deve ser autorizado pelo backend; a copia
  local atual nao deve ser descrita como download ou sincronizacao produtiva.
- Fluxos de ingestao, upload ou processamento interno devem ficar sob responsabilidade da equipe autorizada, quando existirem.

### GeoJSON e identidade de Talhoes

O contrato canonico esta em `versionamento-geojson-talhoes.md`.

- `talhao_id` e a identidade logica estavel; nome, codigo, indice da feature,
  ano e geometria nao sao chaves.
- Importacao, Talhao logico, versao geometrica e linhagem sao registros
  distintos.
- Cada arquivo cria importacao imutavel com original, checksum, Propriedade,
  vigencia, autor e auditoria.
- Rascunho e revisao nao alteram a demarcacao publicada.
- Publicacao exige reconciliacao concluida, permissao explicita e validacao de
  versao base no servidor.
- Nova publicacao arquiva a anterior ao fim de sua vigencia, sem apagar
  arquivo, geometria, reconciliacao ou vinculos historicos.
- Renome preserva `talhao_id`; mudanca de contorno cria nova versao geometrica
  quando a unidade operacional continua a mesma.
- Divisao e fusao encerram predecessores, criam sucessores e registram
  linhagem; registros antigos nao sao reatribuidos.
- Talhao ausente em arquivo novo exige revisao e nao e encerrado
  automaticamente.
- Caderno, Visitas, Safra/Safrinha e Materiais devem referenciar `talhao_id` e
  preservar snapshot textual; quando houver avaliacao espacial, devem
  preservar tambem `talhao_geometria_versao_id`.
- IDs locais derivados de indice/nome e textos legados exigem reconciliacao e
  nao podem ser promovidos automaticamente.
- Produtor consulta somente versoes publicadas e autorizadas; Colaborador
  autorizado prepara/reconcilia; publicacao cabe a Admin ou papel tecnico
  explicito no primeiro contrato.
- Importar, reconciliar, revisar, publicar, arquivar ou restaurar exige
  conexao. Cache offline de versao publicada deve informar fonte, versao e
  vigencia.

## Regra sobre Visitas Tecnicas

O contrato canonico de estados esta em `estados-visita.md`.

- Visitas devem estar associadas ao produtor e a propriedade atendida.
- Seu registro deve servir ao acompanhamento tecnico e ao historico operacional.
- Permissoes de criacao, edicao e consulta devem respeitar o perfil do usuario e o escopo de acesso.
- Criacao pode agendar uma Visita futura ou registrar diretamente uma Visita ja
  realizada pelo formulario de conclusao.
- `agendada` pode ser reagendada, concluida ou cancelada.
- `realizada` nao volta de estado; recebe apenas complemento, correcao auditada
  ou anulacao.
- `cancelada` e somente leitura e pode originar nova Visita vinculada.
- `atrasada` e indicador derivado de uma Visita ainda agendada com horario
  vencido.
- Conclusao exige confirmacao e dados minimos; cancelamento exige motivo.
- Estado nao pode ser alterado por update generico, rota direta ou payload
  manipulado.
- Nenhuma Visita persistida deve ser excluida fisicamente pelo fluxo comum.

`MP-27` implementou essas regras na interface, no dominio e na persistencia
local demonstrativa, com comandos versionados, idempotencia local, historico,
motivos, antes/depois, compatibilidade legada e projecao consultiva do Produtor.
Autorizacao server-side, armazenamento append-only, conflito distribuido,
sincronizacao e exigencia real de conexao permanecem fora desse corte local.

### Fotos existentes de Visita e Caderno

- Foto so pode ser ampliada ou baixada dentro de um detalhe de registro ao qual
  o perfil tenha acesso pela Propriedade e pelas regras do proprio dominio.
- Download exige referencia acionavel e disponibilidade real; falha de
  rede/storage nao pode gerar confirmacao de sucesso.
- A copia local demonstrativa fica no storage interno do aplicativo e nao
  representa download produtivo, publicacao, URL assinada ou sincronizacao.
- Fotos demonstrativas legadas permanecem legiveis. `MP-30` nao autoriza criar
  foto simulada nova nem implementa camera, galeria ou georreferenciamento.

## Regra sobre Caderno de Campo

O contrato canonico de ciclo de vida esta em `ciclo-vida-caderno.md`.

- O caderno de campo deve registrar apenas o que for relevante para a operacao.
- Nao deve nascer como modulo excessivamente generico ou pesado.
- Seu nivel de visibilidade deve ser controlado por regra de perfil e contexto.
- Rascunho pode ser alterado apenas pelo criador.
- Depois do envio, o corpo, a autoria, a origem, a Propriedade e a localizacao
  original ficam imutaveis.
- Complemento tecnico acrescenta informacao sem reescrever o original.
- Correcao excepcional exige permissao, motivo, antes/depois e controle de
  versao.
- Mudanca de visibilidade e evento auditado.
- Arquivamento, reativacao e anulacao preservam registro e historico.
- Produtor nao altera registro consolidado; Admin e Colaborador tambem nao
  recebem edicao destrutiva, apenas comandos autorizados e auditados.
- Ponto valido vinculado a Talhao com geometria resolvida recebe avaliacao
  `dentro`, `proximo` ou `fora`, preservando a versao da demarcacao usada.
- `Proximo` significa ponto externo cuja distancia ao limite cabe na precisao
  informada somada a tolerancia local de 15 m; precisao alta nao transforma o
  ponto em `dentro`.
- Sem `talhao_id` ou geometria valida, o app nao infere relacao por nome e
  apresenta a avaliacao como indisponivel.
- O Produtor recebe a leitura operacional por mini mapa, precisao e relacao;
  coordenadas cruas, autoria da captura e metadados da geometria ficam em
  detalhe tecnico recolhido para equipe autorizada.
- O alerta de baixa precisao permanece visivel depois do salvamento.
- A captura de localizacao e sempre pontual e acionada pelo usuario: solicita
  uma leitura atual de alta precisao e nao usa uma ultima posicao conhecida
  como se fosse a captura corrente.
- Quando houver leitura valida, mapa interativo e fallback vetorial devem
  manter marcador e circulo de precisao visiveis.
- Nova tentativa que falhar nao apaga o ultimo ponto valido. Ao sair durante
  uma leitura, sua resposta nao pode alterar outra instancia da tela; ao
  reabrir o mapa, o ponto salvo deve ser sincronizado depois da inicializacao.
- No formulario do Caderno, a leitura permanece transitoria ate o salvamento;
  sair sem salvar nao cria registro nem persiste o ponto. Nao ha watch
  continuo, background, trilha ou historico de deslocamento.
- Safra/Safrinha, quando existir no MVP local, e contexto opcional do Caderno
  por Propriedade. Admin e Colaborador autorizado podem gerenciar periodos
  locais; Produtor pode consultar e vincular ao registrar Caderno, mas nao
  gerencia periodos nesta fase.

O ciclo de vida esta fechado em nivel de contrato. `MP-25` implementou no app
e na persistencia local demonstrativa os campos obrigatorios por tipo, a UI e
os comandos versionados. Persistencia append-only, autorizacao e auditoria no
backend produtivo permanecem em `MP-36`.

`MP-26` implementou a apresentacao por mini mapa, a avaliacao espacial local,
o snapshot da versao da geometria, a abertura protegida do ponto no mapa e a
captura unica atual com marcador persistente na visualizacao. O provider e o
cancelamento sem salvar passaram em Android fisico; os cenarios reais
dentro/fora, permissao e offline permanecem em `MP-38`.

## Regra sobre Validacoes Do Mock Administrativo

Enquanto `Admin -> Usuarios` estiver em MVP visual/mockado, as validacoes minimas esperadas sao:

- nome obrigatorio
- e-mail obrigatorio
- formato simples de e-mail
- e-mail unico ao criar usuario
- e-mail unico ao editar usuario, ignorando o proprio usuario
- perfil obrigatorio
- status obrigatorio
- produtor ativo com pelo menos uma propriedade vinculada
- produtor ativo com propriedade existente vinculada ou cadastro rapido de propriedade valido
- produtor pendente podendo ficar sem propriedade vinculada
- cadastro rapido de propriedade ativo com campos minimos validos, evitando criacao vazia
- colaborador ativo com ao menos uma Propriedade vinculada diretamente
- admin sem obrigatoriedade de propriedade ou microregiao
- `User.update` validando o registro mesclado de forma equivalente ao `User.create`

Essas validacoes continuam sendo regras do mock administrativo e nao substituem validacoes finais de backend, banco, autenticacao ou permissoes futuras.

## Regra sobre Offline

- O contexto de uso em campo exige cautela com dependencias de conectividade continua.
- A prioridade do offline deve comecar por consulta e visualizacao.
- Nao se deve prometer experiencia offline total sem definicao tecnica e funcional clara.

## Regra Sobre Sessao E Retomada Segura

O contrato canonico esta em `politica-sessao.md`.

- A restauracao local atual de `@tche:user` e apenas comportamento do mock e
  nao representa sessao produtiva.
- Sessao produtiva usa access token curto de 15 minutos e refresh token
  protegido, rotativo e com validade absoluta de 30 dias.
- Perfil, status e escopo devem ser revalidados na renovacao, na reconexao e
  antes de liberar uma sessao restaurada quando houver rede.
- Depois de 15 minutos de inatividade/background, a interface deve exigir
  retomada segura antes de mostrar dados.
- A janela inicial de consulta offline e de 24 horas desde a ultima
  revalidacao, limitada a dados locais e ao ultimo escopo autorizado.
- Ate cada fluxo possuir contrato proprio, offline produtivo e somente leitura
  e rascunho local nao equivale a registro aceito pelo servidor.
- Logout limpa e bloqueia a sessao local imediatamente, revoga a sessao remota
  quando possivel e impede vazamento para o proximo usuario.
- PIN ou biometria podem destravar sessao ainda valida, mas nao substituem
  token, credencial, expiracao, revogacao ou autorizacao no backend.
- Rota direta, notificacao, cache e interface nunca substituem validacao de
  permissao por acao e Propriedade no servidor.

## Regra de Uso Deste Documento

Antes de propor mudanca de codigo, modelagem ou UX, use estas regras para verificar se a proposta:

- respeita a relacao entre produtor e propriedade
- respeita os perfis de acesso
- mantem mapas e arquivos no contexto correto
- evita transformar hipotese em regra consolidada

Se uma proposta depender de ponto ainda nao decidido, esse ponto deve ir para pendencia de definicao, e nao virar regra neste documento.
