# Regras de Negocio

> Revisão documental: 2026-08-25

Este documento registra regras de dominio e acesso que devem orientar modelagem, UX e implementacao. Quando um ponto ainda nao estiver fechado, ele nao deve ser transformado em regra aqui.

## Convencao de Linguagem

Na linguagem de produto, `Propriedade` e o termo oficial para a unidade operacional vista pelo usuario. `Produtor` e o usuario/perfil final, `Titular` e o responsavel cadastral ou vinculo principal da propriedade, e `Talhao` e a subdivisao interna.

No codigo legado e em documentos tecnicos, `fazenda`, `fazenda_id`, nomes de rotas, arquivos, contratos e campos internos podem permanecer temporariamente por compatibilidade. Alias historicos como `cliente` e `proprietario` podem aparecer ao explicar contexto antigo ou inconsistencias, mas nao devem conduzir a linguagem de produto.

## Regras de Dominio

### Produtor e propriedade

- O sistema deve considerar que um produtor pode estar vinculado a uma ou mais propriedades.
- Cada Propriedade do contrato v2 possui exatamente um Produtor como Titular
  principal atual.
- Outros usuarios podem ser vinculados a Propriedade sem se tornarem
  Titulares.
- O perfil define quais acoes o usuario pode executar. A Titularidade e os
  vinculos adicionais ativos definem em quais Propriedades essas acoes podem
  ser executadas.
- A navegacao, os dados e as permissoes devem respeitar essa relacao.
- O contexto de propriedade e parte central da leitura do dominio, nao apenas um detalhe cadastral.
- No mock administrativo, o vinculo entre usuario produtor e propriedade deve ser representado visualmente por uma relacao explicita `usuario_propriedade`, preservando compatibilidade com `produtor_id`/titular enquanto a base legada existir.
- No mock administrativo, produtor pode ter multiplas propriedades vinculadas e deve receber alerta visual quando uma propriedade selecionada ja tiver outro produtor principal no mock.
- O cadastro estrutural de Propriedade e exclusivo de Admin; Colaborador e
  Produtor nao criam Propriedades.
- A exclusao estrutural de Propriedade tambem e exclusiva de Admin e permanece
  bloqueada quando existem dependencias operacionais vinculadas.
- O Produtor deve existir antes de ser escolhido como Titular. No backend, o
  convite aceito ativa Usuario e Produtor mesmo com zero Propriedades. Uma
  Propriedade inativa pode apontar para Titular ainda pendente/inativo; uma
  Propriedade ativa exige Titular habilitado.
- No mock, o cadastro grava `titular_id`, `municipio_id`, `municipio_nome`,
  `uf_id`, `uf_sigla` e cria o vinculo ativo de Titular em
  `usuario_propriedade`.
- Colaboradores opcionais sao selecionados nominalmente e recebem um vinculo
  direto ativo por Propriedade; localizacao nao cria vinculo automatico.
- No mock v2, a criacao da Propriedade e de todos os seus vinculos e atomica:
  qualquer falha desfaz o conjunto completo.
- A edicao cadastral comum da Propriedade tambem e exclusiva de Admin e deve
  atualizar os dados canonicos e os vinculos diretos de Colaboradores e
  Produtores autorizados em uma unica operacao atomica.
- Somente usuários com perfil Produtor podem receber vínculo
  `usuario_autorizado`. O vínculo pode ser preparado enquanto a conta está
  pendente, mas só concede acesso com Usuário, vínculo e Propriedade ativos. O
  Titular atual não integra essa seleção, e conceder ou encerrar esse acesso
  não altera o `titular_id` da Propriedade.
- No mock local, desmarcar um Produtor autorizado inativa o vinculo existente
  em vez de criar duplicidade ou apagar a relacao. A reducao de escopo
  produtiva continua dependente de auditoria, revogacao/revalidacao de sessao e
  limpeza de cache no backend.
- Um vinculo inativo permanece somente como historico e possibilidade de
  reativacao. Ele nao concede acesso, nao aparece como Propriedade atual do
  usuario e nao entra em contadores, selecoes ou indicadores de vinculo ativo.
- Ao compor o Perfil local, o cadastro persistido mais recente prevalece sobre
  o snapshot restaurado da sessao para status e vinculos.
- O `titular_id` e somente leitura na edicao cadastral comum. Uma futura troca
  de Titular exige fluxo administrativo proprio, transacional e auditado.
- A edicao do mock v2 nao grava Regiao, Microrregiao, documento da Propriedade nem um
  campo legado de Colaborador responsavel; acesso continua representado por
  `usuario_propriedade`.
- A criacao combinada produtiva futura deve preservar a mesma atomicidade no
  backend.

No backend, `propriedades.titular_id` e a unica fonte persistida da
Titularidade. `usuario_propriedade` aceita somente `usuario_autorizado` e
`colaborador`; `titular` nao e aceito nem persistido. O acesso do Titular e
derivado por Propriedade, Produtor Titular e Usuario principal. A API
projeta `tipo_acesso=titular`, mas nao duplica esse fato no banco.

A MP-33A armazena somente o Titular atual. Transferencia e historico exigem
contrato transacional e de auditoria posterior. A conta do Usuario principal
pode ser inativada sem desfazer a Titularidade cadastral e sem bloqueio por
constraint permanente. Usuario inativo nao obtem acesso quando a futura
autenticacao/autorizacao estiver em vigor.

### Primeira vertical HTTP de Propriedades

- A MP-33C oferece somente lista e detalhe de Propriedades em leitura.
- O backend restringe primeiro por organização, perfil, Titularidade ou vínculo
  ativo e somente depois aplica busca, filtros, ordenação e cursor.
- Administrador ativo consulta o escopo da organização; Produtor ativo consulta
  por Titularidade derivada ou `usuario_autorizado` ativo; Colaborador ativo
  consulta por vínculo `colaborador` ativo.
- Produtor e Colaborador recebem somente Propriedades ativas na MP-33C. O
  Administrador pode filtrar ativas ou inativas.
- Consulta por ID inexistente ou fora do escopo retorna o mesmo `404`.
- A projeção HTTP usa `tipo_acesso` calculado. O contrato não aceita
  `tipoAcesso` nem persiste `titular` em `usuario_propriedade`.
- A API nova usa exclusivamente `snake_case`; aliases do mock permanecem
  confinados ao adaptador Demo.
- Paginação parcial não produz totalizadores. Métricas permanecem ocultas até
  existir endpoint agregado e autorizado.
- Criar, editar, inativar ou transferir Propriedade e administrar Usuários ou
  vínculos permanecem na MP-35.

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
- Somente Admin cria ou edita Usuarios no fluxo administrativo local.
- Somente Admin exclui Usuarios no fluxo administrativo local; o usuario da
  sessao atual nao pode excluir a si proprio.
- A exclusao administrativa local remove o Usuario, sua credencial local e os
  vinculos diretos. Propriedades e registros operacionais nao sao excluidos por
  essa acao.
- Perfil e um dado estrutural: a edicao comum nao transforma Admin,
  Colaborador e Produtor entre si.
- O Usuario Produtor nasce `pendente` e o cadastro `produtores` nasce
  `inativo`. A aceitação do convite define credencial e ativa ambos
  atomicamente; zero Propriedades acessíveis continua sendo estado válido.
- As Propriedades de um Produtor sao apresentadas como leitura no cadastro de
  Usuario. Titularidade e novos vinculos sao definidos no fluxo de
  Propriedade, permitindo que o mesmo Produtor seja Titular de varias delas.
- Colaborador ativo pode ter zero vínculos. Seu acesso exige vínculo direto
  ativo do tipo `colaborador` e Propriedade ativa; Admin não recebe vínculo com
  Propriedade.
- Novas escritas de Usuario nao gravam nivel administrativo, Regiao,
  Microregiao, `sub_regioes`, `propriedades_atribuidas`,
  `vinculos_microregioes`, `senha` ou aliases equivalentes do v1.
- O MVP pode criar ou atualizar uma credencial local demonstrativa, sem senha
  em texto no Usuario. Falha na credencial deve desfazer a alteracao do
  Usuario e de seus vinculos.
- Credencial local nao representa backend, convite, reset, token, sessao ou
  autenticacao produtiva.

### Dados ligados ao contexto da propriedade

- Mapas, arquivos, visitas e registros de campo devem ser entendidos no contexto da propriedade a que pertencem.
- O sistema nao deve tratar mapas e materiais tecnicos como elementos soltos, desconectados do produtor e da propriedade.

## Regras de Acesso

### Administracao geral

- Possui visao ampla do sistema.
- Pode navegar entre UF, Municipio, Produtores e Propriedades.
- Seu fluxo deve privilegiar leitura consolidada e administracao dos dados autorizados.
- No MVP local, pode gerenciar Usuarios e vinculos diretos com Propriedades;
  nao gerencia vinculos por Regiao ou Microregiao.
- No MVP local, Admin ve todas as Propriedades. O acesso do Colaborador muda
  somente pela persistencia de `usuario_propriedade` direto e ativo.

### Colaborador

- Atua na manutencao operacional dos dados conforme permissao.
- No contrato v2, acessa somente Propriedades com vinculo direto ativo do tipo
  `colaborador` em `usuario_propriedade`.
- Nao deve acessar Propriedade sem vinculo ativo, inclusive por rota direta.
- Municipio e UF podem filtrar a interface administrativa, mas nao concedem
  acesso.
- Somente Admin autorizado atribui ou encerra vinculos.
- Adaptadores de compatibilidade ainda podem ler `sub_regioes` e
  `vinculos_microregioes`; o runtime v2 ativo não autoriza por esses campos.

### Produtor

- Acessa os dados da sua propria realidade operacional.
- Deve conseguir consultar materiais e historicos autorizados.
- Nao deve ser tratado como responsavel por gerenciar a estrutura geral do sistema.
- Produtor ativo pode ter zero Propriedades acessíveis; seu estado cadastral não
  acompanha a quantidade de acessos.
- Produtor Titular de Propriedade ativa não pode ser inativado sem que a mesma
  transação também deixe a Propriedade em estado válido. Transferência de
  Titularidade exige fluxo próprio e permanece fora da MP-35.
- No runtime v2, o acesso efetivo do Produtor ocorre por vínculo ativo de
  Titular ou usuário autorizado; aliases antigos permanecem apenas na borda.
- No backend, o equivalente ao vínculo local de Titular e calculado por
  `propriedades.titular_id`; somente o acesso adicional
  `usuario_autorizado` e persistido em `usuario_propriedade`.

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

## Contrato Aprovado De Backend/RBAC

Status em 2026-08-07: as decisões 33 e 37 substituíram a recomendação regional
anterior. O runtime v2 e o backend usam vínculo direto por Propriedade para
Colaborador. Em 2026-08-21, a leitura de Propriedades desse contrato está
implementada e validada na MP-33C; escritas e demais recursos continuam por
fase.

Status em 2026-06-03 (Fase 14F): a matriz tecnica de testes e criterios de
aceite deste contrato foi registrada em `matriz-rbac-backend.md`. Ela deve
orientar a futura implementacao de backend/RBAC, mas nao implementa permissao
nova no MVP mockado.

### Matriz aprovada por perfil

| Perfil | Escopo de Propriedades | Leitura | Operacao |
|---|---|---|---|
| Admin | Global | Lista e abre todas as Propriedades autorizadas pela organizacao | Pode administrar cadastros e vinculos conforme papel administrativo |
| Produtor | Titularidade ou acesso adicional | Lista e abre Propriedades em que e Titular ou possui `usuario_autorizado` ativo | Consulta mapas/anexos, visitas e caderno autorizados; nao administra estrutura geral |
| Colaborador | `usuario_propriedade` direto e ativo | Lista e abre somente Propriedades atribuidas | Atua operacionalmente conforme permissoes por acao |

### Entidades minimas de backend

- `usuarios`: pessoa/acesso, perfil principal, status e dados de autenticacao.
- `propriedades`: unidade operacional, titular principal, Municipio/UF,
  status e dados cadastrais.
- `usuario_propriedade`: acessos adicionais entre usuario e Propriedade, dos
  tipos `usuario_autorizado` e `colaborador`, com status e origem.
- `perfis`/`papeis`: definicao de capacidades por perfil e, se necessario,
  papeis administrativos mais granulares.

### Regras aprovadas de leitura e acao

- Listar Propriedades: Admin lista tudo; Produtor lista por Titularidade
  derivada ou `usuario_propriedade` adicional; Colaborador lista por
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

### Precedencia aprovada

1. Admin tem acesso global.
2. Produtor tem acesso por titularidade/vinculo direto com a Propriedade.
3. Colaborador tem acesso apenas por Propriedade atribuida diretamente.

### Localizacao e acesso direto

- Municipio/UF descrevem a localizacao e ajudam a selecionar Propriedades em
  lote.
- Acesso deriva de `usuario_propriedade` e concede escopo somente para a
  Propriedade especifica.
- Nova Propriedade no mesmo Municipio exige atribuicao administrativa propria.
- Rotas que transportam contexto operacional de Propriedade emitem
  `propriedadeId`. Consumidores usam o resolvedor central, priorizam esse campo
  e aceitam `fazendaId`, `fazenda_id` ou `produtorId` somente na borda de
  leitura compativel.
- Parametro de rota nunca concede acesso; depois de resolver o identificador,
  cada fluxo revalida perfil, vinculo, acao e Propriedade.

### Riscos de divergencia

- Se o backend inferir acesso por Municipio/UF, uma nova Propriedade pode ser
  exposta sem atribuicao administrativa.
- Se o backend ignorar `usuario_propriedade`, o Admin pode cadastrar vinculos
  que nao produzem efeito real.
- Se mapas, visitas e caderno nao validarem permissao por Propriedade no
  backend, rotas diretas podem expor dados fora do escopo.
- Se `fazenda_id`, `propriedade_id`, titularidade e vinculos forem migrados sem
  leitura dupla, Produtor pode deixar de ver Propriedades vinculadas.

### Implementação por fase

- IDs canônicos e autorização de lista/detalhe de Propriedades estão
  implementados no backend da MP-33A/MP-33C.
- Implementar na MP-35 as escritas administrativas e, em cada vertical, o
  restante da matriz de permissões por ação aprovada nos contratos específicos.
- Implementar a auditoria de alteracoes de vinculos e permissoes na fase
  prevista.
- Executar a estrategia aprovada de descarte do mock v1 e migracao do codigo que usa
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
- Conclusao usa tela de revisao completa, confirmacao e dados minimos;
  cancelamento exige motivo.
- Correcao de Visita realizada usa tela dedicada com os valores atuais e pode
  reunir varios campos permitidos sob uma unica justificativa. Nao e edicao
  geral nem reabertura da Visita.
- Estado nao pode ser alterado por update generico, rota direta ou payload
  manipulado.
- Nenhuma Visita persistida deve ser excluida fisicamente pelo fluxo comum.

`MP-27` implementou essas regras na interface, no dominio e na persistencia
local demonstrativa, com comandos versionados, idempotencia local, historico,
motivos, antes/depois, compatibilidade legada e projecao consultiva do Produtor.
Na interface, concluir e corrigir usam telas dedicadas; cancelamento,
complemento e anulacao permanecem acoes curtas com confirmacao contextual.
Autorizacao server-side, armazenamento append-only, conflito distribuido,
sincronizacao e exigencia real de conexao permanecem fora desse corte local.

### Fotos de Visita e Caderno

- Foto so pode ser ampliada ou baixada dentro de um detalhe de registro ao qual
  o perfil tenha acesso pela Propriedade e pelas regras do proprio dominio.
- Download exige referencia acionavel e disponibilidade real; falha de
  rede/storage nao pode gerar confirmacao de sucesso.
- No Android, a acao de salvar midia deve abrir o seletor de pasta do sistema,
  preservar um nome legivel e confirmar sucesso somente depois da gravacao.
  Cancelamento nao pode ser apresentado como sucesso.
- Nova/Editar Visita podem receber fotos reais por acao explicita de camera ou
  galeria. O arquivo e copiado para o storage interno do aplicativo e o
  registro preserva URI local, nome original, MIME, dimensoes quando
  disponiveis, origem e data de inclusao.
- A selecao/captura local nao coleta EXIF, coordenadas ou geotag e nao cria
  acompanhamento em segundo plano. O corte nao representa upload, backend,
  publicacao, URL assinada nem sincronizacao.
- Fotos demonstrativas legadas permanecem legiveis e nao devem ser geradas por
  novos formularios.

## Regra sobre Caderno de Campo

O contrato canonico de ciclo de vida esta em `ciclo-vida-caderno.md`.

- O caderno de campo deve registrar apenas o que for relevante para a operacao.
- Nao deve nascer como modulo excessivamente generico ou pesado.
- Seu nivel de visibilidade deve ser controlado por regra de perfil e contexto.
- Rascunho pode ser alterado apenas pelo criador.
- O proprio criador pode retomar ou descartar o rascunho; o descarte local e
  definitivo e nunca se aplica a registro enviado.
- Listas globais e o detalhe da Propriedade exibem somente o rascunho do
  usuario atual, mantendo rascunhos de outros autores ocultos.
- Depois do envio, o corpo, a autoria, a origem, a Propriedade e a localizacao
  original ficam imutaveis.
- Complementos antigos permanecem legiveis no historico, mas o MVP nao cria
  novos complementos no Caderno; ajustes usam edicao auditada.
- Correcao excepcional exige permissao, motivo, antes/depois e controle de
  versao.
- A correcao usa tela dedicada, pode reunir varios campos operacionais sob uma
  unica justificativa e nao reabre edicao destrutiva do registro consolidado.
- Para reduzir ambiguidade, a interface apresenta esse comando como `Editar
  dados`; tipo de registro, Talhao, Safra/Safrinha e respectivos campos
  dependentes podem mudar desde que o resultado cumpra as validacoes do novo
  tipo. A persistencia continua sendo uma correcao versionada e auditada.
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
- perfil imutavel na edicao comum
- produtor ativo podendo ficar com zero Propriedades acessíveis
- convite aceito ativando Usuario e Produtor atomicamente
- Propriedade inativa aceitando cadastro com Usuário pendente/inativo e
  Produtor inativo
- Propriedade ativa exigindo Usuario e Produtor Titular ativos
- vinculo de Titular correspondendo ao `titular_id` real da Propriedade
- Produtor Titular não pode terminar inativo enquanto alguma Propriedade sua
  continuar ativa; a mesma transação pode inativar essas Propriedades, sem
  transferir nem apagar a Titularidade
- colaborador ativo podendo ter zero vínculos e, nesse caso, zero acesso
- colaborador usando somente vinculos do tipo `colaborador`
- admin sem vinculo de Propriedade ou Microregiao
- payload v2 sem campos territoriais, senha ou aliases administrativos do v1
- `User.update` validando o registro mesclado de forma equivalente ao `User.create`

Essas validacoes continuam sendo regras do mock administrativo e nao substituem validacoes finais de backend, banco, autenticacao ou permissoes futuras.

## Regra sobre Offline

- O contexto de uso em campo exige cautela com dependencias de conectividade continua.
- A prioridade do offline deve comecar por consulta e visualizacao.
- Nao se deve prometer experiencia offline total sem definicao tecnica e funcional clara.
- A composição HTTP da MP-33C é online-only: não persiste respostas de negócio,
  não restaura lista/detalhe por cache e não possui fila de sincronização.
- Falha de conectividade na composição HTTP mostra indisponibilidade e nunca
  seleciona o mock como fallback.
- O comportamento offline/local atual pertence somente ao Demo. Offline
  produtivo seguro exige fase posterior, cache cifrado e segregado, invalidação
  de escopo e testes específicos.

## Regra Sobre Sessao E Retomada Segura

O contrato canonico esta em `politica-sessao.md`.

- A restauracao local atual de `@tche:user` e apenas comportamento do mock e
  nao representa sessao produtiva.
- Sessao produtiva usa access token curto de 15 minutos e refresh token
  protegido, rotativo e com validade absoluta de 30 dias.
- Perfil, status e escopo devem ser revalidados na renovacao, na reconexao e
  antes de liberar uma sessao restaurada quando houver rede.
- Ao entrar em background, a composição HTTP cobre os dados imediatamente. Com
  15 minutos ou mais em background, exige novo login.
- Depois de 15 minutos sem interação no foreground, a interface aplica bloqueio
  local, sem logout ou revogação automáticos baseados apenas em ausência de
  toque.
- A MP-33C não habilita a janela de consulta offline de 24 horas. Essa janela é
  teto de uma evolução futura e depende de cache seguro por fluxo.
- Access token fica somente em memória e refresh token somente no storage
  seguro nativo; token e sessão HTTP nunca usam `AsyncStorage`.
- Renovação concorrente é single-flight, cada chamada repete no máximo uma vez
  e produção nunca recua para mock.
- Ate cada fluxo possuir contrato proprio, offline produtivo e somente leitura
  e rascunho local nao equivale a registro aceito pelo servidor.
- Logout limpa e bloqueia a sessao local imediatamente, revoga a sessao remota
  quando possivel e impede vazamento para o proximo usuario.
- PIN ou biometria podem destravar sessao ainda valida, mas nao substituem
  token, credencial, expiracao, revogacao ou autorizacao no backend.
- Rota direta, notificacao, cache e interface nunca substituem validacao de
  permissao por acao e Propriedade no servidor.

## Regras De Autenticação E Recuperação Do Backend

O contrato canônico da MP-33B está em
`contrato-autenticacao-mp33b.md`.

- Senha é definida pelo próprio usuário, nunca entregue em texto pelo Admin,
  bootstrap, convite ou recuperação.
- A senha usa NFC, preserva espaços, possui 8–128 pontos de código Unicode,
  exige ao menos uma categoria entre maiúscula, número ou pontuação/símbolo e
  não pode corresponder integralmente à blocklist vigente.
- O mínimo de oito sem MFA é risco aceito. MFA permanece obrigatório antes da
  liberação pública de contas Administradoras.
- E-mail inexistente, senha incorreta, conta pendente/inativa e ausência de
  credencial não podem ser distinguidos pela resposta de login.
- Convite comum se aplica a Usuário pendente já existente e não cria
  Propriedade, Titularidade ou vínculo. Convite novo usa `ativar_usuario` e
  ativa também o cadastro Produtor já criado; `manter_status` permanece apenas
  para compatibilidade de convites históricos.
- Recuperação comum usa o endereço principal verificado, revoga todas as
  sessões ao concluir e não autentica automaticamente.
- Troca normal do e-mail principal exige sessão, senha atual e confirmações
  separadas no endereço atual e no novo endereço.
- Admin pode manter um contato secundário previamente confirmado. Esse contato
  não é login e só habilita recuperação restrita com confirmação do secundário,
  confirmação do novo principal e senha definida pelo próprio usuário.
- Recuperação assistida por Admin se restringe a Produtor ou Colaborador ativo
  da mesma organização. Exige motivo, referência operacional, confirmação do
  novo endereço e auditoria; fica desabilitada em produção sem política de
  identidade versionada.
- Nome, documento, data de nascimento, Município, Propriedade ou telefone não
  verificado não provam isoladamente a identidade.
- Conta Administradora nunca é alvo da recuperação assistida HTTP. Sua
  recuperação operacional usa somente o segundo e-mail previamente verificado.
  Se os dois e-mails forem perdidos, a MP-33B não oferece recuperação.
- CLI, schema e continuações break-glass são scaffold fail-closed e
  inalcançável, sem start, HMAC ou privilégio de plataforma. Ed25519 ou serviço
  externo equivalente com dois aprovadores é pré-requisito técnico antes de
  implementar ou habilitar essa capacidade.
- Bootstrap do primeiro Admin é one-shot e somente CLI. A correção de e-mail
  fica disponível apenas antes do aceite e não reabre bootstrap selado.
- Conclusão de recuperação revoga sessões, tokens e desafios incompatíveis,
  incrementa a versão de autorização quando aplicável e nunca ativa usuário,
  muda perfil, Titularidade ou vínculo.
- Auditoria crítica é append-only, separada dos logs e não recebe senha,
  token, headers, payload livre, string de conexão ou evidência pessoal
  integral.

## Regra de Uso Deste Documento

Antes de propor mudanca de codigo, modelagem ou UX, use estas regras para verificar se a proposta:

- respeita a relacao entre produtor e propriedade
- respeita os perfis de acesso
- mantem mapas e arquivos no contexto correto
- evita transformar hipotese em regra consolidada

Se uma proposta depender de ponto ainda nao decidido, esse ponto deve ir para pendencia de definicao, e nao virar regra neste documento.
