# Regras de Negocio

Este documento registra regras de dominio e acesso que devem orientar modelagem, UX e implementacao. Quando um ponto ainda nao estiver fechado, ele nao deve ser transformado em regra aqui.

## Convencao de Linguagem

Na linguagem de produto, `Propriedade` e o termo oficial para a unidade operacional vista pelo usuario. `Produtor` e o usuario/perfil final, `Titular` e o responsavel cadastral ou vinculo principal da propriedade, e `Talhao` e a subdivisao interna.

No codigo legado e em documentos tecnicos, `fazenda`, `fazenda_id`, nomes de rotas, arquivos, contratos e campos internos podem permanecer temporariamente por compatibilidade. Alias historicos como `cliente` e `proprietario` podem aparecer ao explicar contexto antigo ou inconsistencias, mas nao devem conduzir a linguagem de produto.

## Regras de Dominio

### Produtor e propriedade

- O sistema deve considerar que um produtor pode estar vinculado a uma ou mais propriedades.
- A navegacao, os dados e as permissoes devem respeitar essa relacao.
- O contexto de propriedade e parte central da leitura do dominio, nao apenas um detalhe cadastral.
- No mock administrativo, o vinculo entre usuario produtor e propriedade deve ser representado visualmente por uma relacao explicita `usuario_propriedade`, preservando compatibilidade com `produtor_id`/titular enquanto a base legada existir.
- No mock administrativo, produtor pode ter multiplas propriedades vinculadas e deve receber alerta visual quando uma propriedade selecionada ja tiver outro produtor principal no mock.
- No cadastro visual/mockado de usuario produtor, o admin pode selecionar propriedade existente ou cadastrar uma propriedade rapida quando ela ainda nao existir.
- O cadastro rapido deve criar a propriedade no mock e vincula-la ao usuario produtor via `usuario_propriedade`, preservando `produtor_id`, `proprietario_id`, `regiao`, `microregiao` e `fazenda_id` quando aplicavel.
- O fluxo de cadastro rapido e preparacao para uma criacao combinada futura de `usuario` + `propriedade` + `usuario_propriedade`.
- Enquanto a camada for apenas mockada, o fluxo nao e transacional; no backend futuro, a criacao combinada deve ser transacional para evitar propriedade criada sem usuario/vinculo.

### Territorio e vinculos visuais no mock

- A leitura territorial do MVP visual/mockado deve favorecer a cadeia Regiao -> Microregiao -> Propriedade.
- Enquanto nao houver backend/banco real para territorio, `territorioCompat` deriva regioes e microregioes a partir das propriedades mockadas.
- Os campos textuais legados `regiao` e `microregiao` continuam validos e devem ser preservados para compatibilidade.
- O cadastro de propriedade pode usar selecao visual de Regiao e Microregiao derivada do mock, mas deve continuar salvando os campos textuais legados.
- O cadastro rapido de propriedade dentro do cadastro de produtor tambem pode usar `territorioCompat`, mantendo fallback textual.
- Ao selecionar uma microregiao no cadastro de propriedade, a interface pode sugerir colaboradores compativeis pelo territorio.
- Colaboradores sugeridos por microregiao sao apenas indicacao visual nesta fase.
- No detalhe da propriedade, a administracao pode ver vinculos visuais mockados de usuario produtor vinculado e colaboradores sugeridos/relacionados ao territorio.
- O escopo regional efetivo do colaborador usa `sub_regioes`; se
  `sub_regioes` estiver ausente ou vazio, usa `vinculos_microregioes` como
  fallback.
- `propriedades_atribuidas` representa vinculo direto visual/admin
  preparatorio e nao deve ser tratado como permissao efetiva no MVP mockado.

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

### Colaborador regional

- Possui escopo regional ou sub-regional.
- Nao deve acessar dados fora do seu escopo.
- Atua na manutencao operacional dos dados conforme permissao.
- No mock administrativo, pode ter microregioes/sub-regioes e propriedades atribuidas visualmente.
- No cadastro visual/mockado, pode selecionar uma ou mais microregioes e ver previa das propriedades abrangidas por essas microregioes.
- Tambem pode ter propriedades atribuidas diretamente no mock visual.
- A regra efetiva atual usa `sub_regioes` como fonte prioritaria do escopo.
- Se `sub_regioes` estiver ausente ou vazio, a regra efetiva usa
  `vinculos_microregioes` como fallback.
- `propriedades_atribuidas` continua sendo vinculo direto preparatorio e nao
  restringe nem amplia acesso efetivo nesta fase.

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
- A visualizacao do colaborador deve respeitar seu escopo geografico por
  `sub_regioes` ou fallback `vinculos_microregioes`.
- A administracao geral deve conseguir enxergar o panorama consolidado da operacao.

## Contrato Futuro De Backend/RBAC

Status em 2026-06-03 (Fase 14E): este contrato e direcao futura recomendada
para backend/RBAC e nao altera o comportamento funcional do MVP mockado. O MVP
atual continua usando `sub_regioes` e fallback `vinculos_microregioes` para o
colaborador; `propriedades_atribuidas` continua visual/preparatorio ate haver
backend.

Status em 2026-06-03 (Fase 14F): a matriz tecnica de testes e criterios de
aceite deste contrato foi registrada em `matriz-rbac-backend.md`. Ela deve
orientar a futura implementacao de backend/RBAC, mas nao implementa permissao
nova no MVP mockado.

### Matriz futura por perfil

| Perfil | Escopo de Propriedades | Leitura | Operacao |
|---|---|---|---|
| Admin | Global | Lista e abre todas as Propriedades autorizadas pela organizacao | Pode administrar cadastros e vinculos conforme papel administrativo |
| Produtor | Vinculo com Propriedade/Titular | Lista e abre Propriedades em que possui vinculo ativo | Consulta mapas/anexos, visitas e caderno autorizados; nao administra estrutura geral |
| Colaborador | Microregiao vinculada OU Propriedade atribuida diretamente | Lista e abre Propriedades dentro do escopo combinado/aditivo | Atua operacionalmente conforme permissoes por acao |

### Entidades minimas de backend

- `usuarios`: pessoa/acesso, perfil principal, status e dados de autenticacao.
- `propriedades`: unidade operacional, titular principal, regiao,
  microregiao, status e dados cadastrais.
- `usuario_propriedade`: vinculos diretos entre usuario e Propriedade, com
  tipo de vinculo, status, principal quando aplicavel e origem do vinculo.
- `usuario_microregiao`: vinculos territoriais entre usuario e microregiao,
  com status e periodo de validade quando necessario.
- `perfis`/`papeis`: definicao de capacidades por perfil e, se necessario,
  papeis administrativos mais granulares.

### Regras futuras de leitura e acao

- Listar Propriedades: Admin lista tudo; Produtor lista por
  `usuario_propriedade`/titularidade; Colaborador lista por
  `usuario_microregiao` ou por `usuario_propriedade` direto.
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
3. Colaborador tem acesso aditivo por microregiao vinculada OU Propriedade
   atribuida diretamente.

Para Colaborador, `propriedades_atribuidas` no backend deve ampliar acesso
direto quando a Propriedade nao estiver na microregiao vinculada. Ela nao deve
restringir automaticamente o acesso regional. Qualquer politica restritiva,
como "somente propriedades atribuidas dentro da microregiao", deve ser uma
decisao futura explicita e implementada como regra propria, nao inferida do
campo.

### Diferenca entre acesso regional e acesso direto

- Acesso regional: deriva de `usuario_microregiao` e cobre todas as
  Propriedades ativas daquela microregiao conforme regra da organizacao.
- Acesso direto: deriva de `usuario_propriedade` e concede acesso a uma
  Propriedade especifica, mesmo que ela esteja fora das microregioes
  vinculadas ao colaborador, quando a politica permitir.

### Riscos de divergencia

- Se o backend tratar `propriedades_atribuidas` como restricao implicita, o
  colaborador pode perder acesso regional que hoje e esperado no MVP.
- Se o backend ignorar o acesso direto por Propriedade atribuida, o Admin
  pode cadastrar vinculos que nao produzem efeito real.
- Se mapas, visitas e caderno nao validarem permissao por Propriedade no
  backend, rotas diretas podem expor dados fora do escopo.
- Se `fazenda_id`, `propriedade_id`, titularidade e vinculos forem migrados sem
  leitura dupla, Produtor pode deixar de ver Propriedades vinculadas.

### Pendencias para modelagem real

- Definir ids canonicos para Propriedade, microregiao e usuario.
- Definir status e validade dos vinculos `usuario_propriedade` e
  `usuario_microregiao`.
- Definir se existe escopo por regiao alem de microregiao.
- Definir matriz de permissoes por acao: listar, abrir detalhe, criar visita,
  editar visita, criar caderno, editar caderno, liberar/download de anexos e
  editar cadastro.
- Definir como auditar alteracoes de vinculos e permissoes.
- Definir estrategia de migracao a partir de `sub_regioes`,
  `vinculos_microregioes`, `propriedades_atribuidas`, `produtor_id`,
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

## Regra sobre Visitas Tecnicas

- Visitas devem estar associadas ao produtor e a propriedade atendida.
- Seu registro deve servir ao acompanhamento tecnico e ao historico operacional.
- Permissoes de criacao, edicao e consulta devem respeitar o perfil do usuario e o escopo de acesso.

## Regra sobre Caderno de Campo

- O caderno de campo deve registrar apenas o que for relevante para a operacao.
- Nao deve nascer como modulo excessivamente generico ou pesado.
- Seu nivel de visibilidade deve ser controlado por regra de perfil e contexto.
- Safra/Safrinha, quando existir no MVP local, e contexto opcional do Caderno
  por Propriedade. Admin e Colaborador autorizado podem gerenciar periodos
  locais; Produtor pode consultar e vincular ao registrar Caderno, mas nao
  gerencia periodos nesta fase.

Este documento nao fecha ainda todos os campos, obrigatoriedades ou fluxos do caderno. Esses detalhes pertencem a consolidacao futura das pendencias.

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
- colaborador ativo com microregiao/sub-regiao ou propriedade atribuida
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
