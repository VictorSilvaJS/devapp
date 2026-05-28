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

### Territorio e vinculos visuais no mock

- A leitura territorial do MVP visual/mockado deve favorecer a cadeia Regiao -> Microregiao -> Propriedade.
- Enquanto nao houver backend/banco real para territorio, `territorioCompat` deriva regioes e microregioes a partir das propriedades mockadas.
- Os campos textuais legados `regiao` e `microregiao` continuam validos e devem ser preservados para compatibilidade.
- O cadastro de propriedade pode usar selecao visual de Regiao e Microregiao derivada do mock, mas deve continuar salvando os campos textuais legados.
- Ao selecionar uma microregiao no cadastro de propriedade, a interface pode sugerir colaboradores compativeis pelo territorio.
- No detalhe da propriedade, a administracao pode ver vinculos visuais mockados de usuario produtor vinculado e colaboradores sugeridos/relacionados ao territorio.
- Esses vinculos territoriais sao preparacao visual para backend/banco e nao devem ser tratados como permissao efetiva enquanto o motor atual de permissoes nao for migrado.

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

### Colaborador regional

- Possui escopo regional ou sub-regional.
- Nao deve acessar dados fora do seu escopo.
- Atua na manutencao operacional dos dados conforme permissao.
- No mock administrativo, pode ter microregioes/sub-regioes e propriedades atribuidas visualmente.
- No cadastro visual/mockado, pode selecionar uma ou mais microregioes e ver previa das propriedades abrangidas por essas microregioes.
- Tambem pode ter propriedades atribuidas diretamente no mock visual.
- Esses vinculos visuais ainda nao alteram o motor efetivo de permissoes enquanto nao houver decisao e implementacao especifica.

### Produtor

- Acessa os dados da sua propria realidade operacional.
- Deve conseguir consultar materiais e historicos autorizados.
- Nao deve ser tratado como responsavel por gerenciar a estrutura geral do sistema.
- No mock administrativo, produtor ativo deve ter ao menos uma propriedade vinculada.
- Produtor pendente pode existir sem propriedade vinculada.

## Regra de Visibilidade

- A visualizacao do produtor deve ser a mais restrita entre os perfis principais.
- A visualizacao do colaborador deve respeitar seu escopo geografico.
- A administracao geral deve conseguir enxergar o panorama consolidado da operacao.

## Regra sobre Mapas e Arquivos

- Mapas e arquivos pertencem ao contexto da propriedade.
- Na primeira versao de testes, cada material tecnico deve estar vinculado ao campo/talhao correspondente e, quando for diagnostico, ao elemento/camada representado, como argila, fosforo, pH ou outro atributo tecnico.
- A disponibilizacao desses materiais deve respeitar regra de perfil e liberacao.
- O produtor pode consultar e baixar materiais autorizados.
- Fluxos de ingestao, upload ou processamento interno devem ficar sob responsabilidade da equipe autorizada, quando existirem.

## Regra sobre Visitas Tecnicas

- Visitas devem estar associadas ao produtor e a propriedade atendida.
- Seu registro deve servir ao acompanhamento tecnico e ao historico operacional.
- Permissoes de criacao, edicao e consulta devem respeitar o perfil do usuario e o escopo de acesso.

## Regra sobre Caderno de Campo

- O caderno de campo deve registrar apenas o que for relevante para a operacao.
- Nao deve nascer como modulo excessivamente generico ou pesado.
- Seu nivel de visibilidade deve ser controlado por regra de perfil e contexto.

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
- produtor pendente podendo ficar sem propriedade vinculada
- colaborador ativo com microregiao/sub-regiao ou propriedade atribuida
- admin sem obrigatoriedade de propriedade ou microregiao
- `User.update` validando o registro mesclado de forma equivalente ao `User.create`

Essas validacoes continuam sendo regras do mock administrativo e nao substituem validacoes finais de backend, banco, autenticacao ou permissoes futuras.

## Regra sobre Offline

- O contexto de uso em campo exige cautela com dependencias de conectividade continua.
- A prioridade do offline deve comecar por consulta e visualizacao.
- Nao se deve prometer experiencia offline total sem definicao tecnica e funcional clara.

## Regra de Uso Deste Documento

Antes de propor mudanca de codigo, modelagem ou UX, use estas regras para verificar se a proposta:

- respeita a relacao entre produtor e propriedade
- respeita os perfis de acesso
- mantem mapas e arquivos no contexto correto
- evita transformar hipotese em regra consolidada

Se uma proposta depender de ponto ainda nao decidido, esse ponto deve ir para pendencia de definicao, e nao virar regra neste documento.
