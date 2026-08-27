# Contrato De Notificacoes

> Status: `ATIVO`
>
> Definido em: 2026-07-30
>
> Revisão técnica: 2026-08-24
>
> Estado da MP-34: `CONCLUIDA_TECNICAMENTE_E_INTEGRADA`; integração direta na
> branch `backend` pelo commit `e787707`, sem pull request e com CI pós-push
> aprovada
>
> Origem: `MP-03` / `QA-P0-01`

## Objetivo

Este documento define o contrato produtivo minimo para notificacoes in-app:
destinatario, escopo, recurso relacionado, persistencia, deduplicacao e
navegacao segura. A MP-34 implementou tecnicamente esse corte no backend e na
composição HTTP.

O corte não adiciona push, persistência local nem navegação ao mock atual. A
implementação foi integrada diretamente à branch `backend`, mas não foi
implantada nem liberada em ambiente produtivo.

## Corte Mínimo Consolidado Da MP-34

A MP-34 entrega a primeira vertical HTTP de notificações reais sem antecipar
recursos de negócio das fases seguintes. O corte mínimo implementado é:

- notificações exclusivamente in-app, persistidas no PostgreSQL e individuais
  por destinatário;
- eventos e entregas gravados atomicamente na mesma transação do fato de conta
  que os origina;
- lista paginada, contador não lido, leitura individual, leitura em lote,
  descarte e resolução segura de destino;
- composição HTTP com estado somente em memória e segregado por organização,
  usuário, versão de autorização e epoch da sessão;
- primeiro catálogo emissor limitado a fatos de conta já implementados na
  MP-33B: senha alterada, e-mail principal alterado e recuperação concluída;
- destino inicial limitado a `conta`, sempre com o próprio Usuário como recurso
  e destinatário;
- retenção padrão de 90 dias, conteúdo por template versionado e auditoria sem
  texto livre ou segredo;
- testes negativos de destinatário, organização, sessão, idempotência, troca de
  usuário, resposta tardia e rota direta.

Os três perfis podem receber eventos da própria conta. O catálogo técnico
inicial aprovado e implementado é:

| `tipo_evento` | Destinatário | Prioridade inicial | Destino |
|---|---|---|---|
| `conta.senha_alterada.v1` | Usuário afetado | `alta` | `conta` |
| `conta.email_principal_alterado.v1` | Usuário afetado | `alta` | `conta` |
| `conta.recuperacao_concluida.v1` | Usuário afetado | `alta` | `conta` |

Os templates aprovados são fixos e não recebem texto livre do produtor:

| `tipo_evento` | Título | Resumo |
|---|---|---|
| `conta.senha_alterada.v1` | `Senha alterada` | `A senha da sua conta foi alterada.` |
| `conta.email_principal_alterado.v1` | `E-mail principal alterado` | `O e-mail principal da sua conta foi alterado.` |
| `conta.recuperacao_concluida.v1` | `Recuperação concluída` | `A recuperação da sua conta foi concluída.` |

Há cinco fluxos emissores transacionais: troca autenticada de senha, alteração
normal do e-mail principal, recuperação comum, recuperação de Administrador
pelo segundo e-mail e recuperação assistida. Os dois primeiros usam seus tipos
específicos; os três fluxos de recuperação convergem no mesmo tipo genérico de
recuperação concluída, sem revelar na interface qual método foi usado.

Ficam fora desse corte:

- push, e-mail, SMS, WebSocket, atualização em background e entrega em tempo
  real;
- cadastro, armazenamento ou renovação de token de dispositivo;
- preferências, silenciamento, digest, campanhas ou comunicado administrativo;
- cache persistente, consulta offline e fila de mutações no aplicativo;
- eventos de Propriedade, Visita, Caderno, Material, mapa, GeoJSON ou Talhão
  enquanto a respectiva fonte e seu guard HTTP produtivo não existirem;
- qualquer escrita, vínculo ou ampliação de RBAC pertencente à MP-35;
- fases MP-35 e posteriores, release, deploy e publicação.

## Problema Confirmado

O contexto local atual:

- entrega a mesma lista para Admin, Colaborador e Produtor;
- nao possui destinatario nem organizacao;
- nao referencia `propriedade_id`/`fazenda_id`, Talhao ou recurso por ID;
- marca como lida e remove somente em memoria;
- recria os exemplos ao reiniciar ou trocar de usuario;
- ao tocar, apenas marca o item como lido;
- pode exibir ao Produtor texto sobre Propriedade fora do seu vinculo.

`NOTIFICACOES_INICIAIS`, `NotificacaoContext` e `NotificacoesScreen` continuam
demonstrativos. Eles nao comprovam isolamento, persistencia ou autorizacao.

## Principios

1. Notificacao e uma entrega individual, nunca uma lista global filtrada
   somente pelo cliente.
2. O destinatario autenticado e o escopo autorizado sao validados no servidor.
3. Texto, icone, papel ou rota recebidos no payload nao concedem acesso.
4. Leitura e descarte pertencem ao destinatario e persistem no servidor.
5. Uma notificacao referencia um recurso por tipo e ID estavel; a rota visual
   e derivada pelo cliente a partir de uma allowlist.
6. Abrir o recurso exige nova autorizacao, inclusive por rota direta.
7. Troca de usuario ou organizacao limpa imediatamente lista, contador,
   requisicoes e rotas pendentes da identidade anterior.
8. O cliente nao deve criar notificacao produtiva diretamente.

## Separacao Entre Evento E Entrega

### `notificacao_evento`

Representa o fato de dominio que pode gerar uma ou mais entregas.

| Campo | Regra |
|---|---|
| `id` | identificador imutavel do evento |
| `organizacao_id` | organizacao onde o evento ocorreu |
| `tipo_evento` | codigo versionado do evento |
| `chave_origem` | chave idempotente estável produzida pelo fato de domínio |
| `recurso_tipo` | tipo canonico do recurso relacionado |
| `recurso_id` | ID estavel do recurso |
| `propriedade_id` | Propriedade do recurso, quando operacional |
| `talhao_id` | opcional; exige `propriedade_id` |
| `autor_id` | usuario ou servico que originou o evento, quando aplicavel |
| `criado_em` | data/hora do servidor |
| `dados_apresentacao` | objeto tipado e limitado, sem texto livre ou autoridade de acesso |

Eventos de conta ou seguranca podem nao possuir Propriedade. Eventos de
Visita, Caderno, Mapa, Material ou Talhao devem possuir
`propriedade_id`.

### `notificacao_entrega`

Representa a notificacao efetivamente destinada a um usuario.

| Campo | Regra |
|---|---|
| `id` | identificador imutavel da entrega |
| `evento_id` | referencia a `notificacao_evento` |
| `destinatario_usuario_id` | usuario exato que pode consultar a entrega |
| `organizacao_id` | deve coincidir com sessao e evento |
| `prioridade` | `baixa`, `normal` ou `alta` |
| `criada_em` | data/hora do servidor |
| `lida_em` | `null` enquanto nao lida |
| `descartada_em` | `null` enquanto visivel |
| `chave_deduplicacao` | chave idempotente por destinatario |
| `expira_em` | obrigatório; exatamente 90 dias após `criada_em` no corte da MP-34 |

O corte inicial não persiste perfil como autoridade ou snapshot da entrega. A
autorizacao usa o usuario, a organizacao, os vinculos ativos e a regra atual do
recurso.

A unicidade minima deve considerar:

`organizacao_id + destinatario_usuario_id + chave_deduplicacao`

O evento também deve ser único por
`organizacao_id + tipo_evento + chave_origem`. A chave de origem não contém
e-mail, token, texto exibível ou outro dado pessoal previsível.

## Persistência, Outbox E Atomicidade Da MP-34

A implementação técnica criou uma migration append-only posterior às quatro
migrations integradas. Ela adiciona somente `notificacao_evento`,
`notificacao_entrega` e `notificacao_comando_idempotencia`. A terceira tabela
restringe a chave por organização/usuário, registra comando, alvo ou corte,
hash do pedido, resultado e expiração, sem guardar conteúdo de notificação. No
corte da MP-34, entregas e chaves idempotentes expiram exatamente 90 dias após
seu respectivo instante de criação/processamento. Nenhuma tabela existente é
alterada para aceitar alias legado ou conteúdo de notificação.

O corte mínimo não possui canal externo nem fan-out amplo: cada fato de conta
tem um único destinatário exato. Por isso, o serviço grava evento e entrega na
mesma transação PostgreSQL da mudança de conta. Se qualquer parte falhar, todo o
fato é revertido; não existe estado parcial que exija compensação ou retry de
worker.

`outbox_email` não é reutilizada nem ampliada. Ela contém payload SMTP
temporário cifrado, vínculos com desafios, ciclo de vida e privilégios próprios
da MP-33B; notificações in-app são conteúdo durável consultado pelo usuário.
Misturar as duas finalidades ampliaria privilégios e retenção sem necessidade.

Se uma fase futura introduzir fan-out amplo ou canal externo, deverá criar uma
outbox própria de notificações. Ela pode reutilizar os padrões já testados de
claim com `FOR UPDATE SKIP LOCKED`, lease comparado na escrita, tentativas
limitadas, backoff exponencial com jitter e estado terminal auditado, mas não a
tabela, o payload cifrado ou a credencial SMTP. Essa evolução não pertence ao
corte inicial da MP-34.

### Idempotência E Repetição

- repetir o mesmo `tipo_evento + chave_origem` não cria outro evento;
- repetir a criação da entrega não vence a unicidade por destinatário e chave
  de deduplicação;
- leitura e descarte são monotônicos: preservam o primeiro horário do servidor
  e repetir o comando retorna o estado já alcançado;
- comandos de estado exigem `Idempotency-Key`; a mesma chave com outro comando
  ou outro alvo é rejeitada;
- leitura individual, leitura em lote e descarte não aceitam `version` nem
  versão-base: o binding persistido associa a chave ao comando, alvo ou corte e
  hash do pedido;
- essa exceção existe somente porque esses três comandos são monotônicos; a
  versão-base continua obrigatória nas demais transições versionadas e comandos
  concorrentes do contrato geral;
- “marcar todas” fixa no primeiro processamento um corte de criação do servidor
  e o associa à chave idempotente durante toda a vida das entregas alcançáveis,
  para que um retry não marque notificações que chegaram depois;
- falha de transporte não gera retry oculto com uma chave nova; a interface
  mantém o estado confirmado e oferece repetição explícita com a mesma chave;
- conflitos de unicidade concorrentes são tratados como deduplicação, nunca
  como segunda entrega.

## Tipos De Recurso

O primeiro catalogo permitido e:

| `recurso_tipo` | ID esperado | Contexto obrigatorio |
|---|---|---|
| `visita` | `visita_id` | Propriedade |
| `caderno` | `caderno_id` | Propriedade |
| `mapa` | `mapa_id` | Propriedade |
| `material_tecnico` | `material_id` | Propriedade; Talhao opcional |
| `talhao` | `talhao_id` | Propriedade |
| `propriedade` | `propriedade_id` | Propriedade |
| `conta` | `usuario_id` | destinatario |
| `sistema` | ID do comunicado | organizacao ou destinatario |

Novos tipos exigem regra de autorizacao, destino seguro e teste negativo antes
de entrar na allowlist. URLs arbitrarias, nomes de tela e objetos de navegacao
nao fazem parte do contrato persistido.

Essa tabela é o catálogo de domínio aprovado, não a lista automaticamente
habilitada na MP-34. A implementação técnica habilita somente `conta`.
Os demais tipos, inclusive `propriedade`, continuam desabilitados até suas
verticais possuírem fonte autoritativa, rota HTTP e testes de autorização
próprios.

## Destinatario E Escopo

### Criacao Das Entregas

O backend:

1. recebe ou produz um evento valido;
2. resolve os destinatarios pelo escopo vigente;
3. cria uma entrega individual e idempotente para cada destinatario;
4. nao cria entrega quando o recurso nao esta autorizado para aquele usuario.

Regras minimas:

- Admin recebe somente eventos da organizacao e do escopo administrativo
  autorizado.
- Colaborador recebe somente eventos de Propriedades no escopo operacional
  vigente e recursos permitidos para seu papel.
- Produtor recebe somente eventos de suas Propriedades vinculadas e de
  recursos liberados para sua consulta.
- Vinculo territorial, perfil ou visibilidade alterados devem afetar a proxima
  consulta e a abertura do recurso.
- Perda de acesso torna a entrega indisponivel, mesmo que ainda exista no
  historico interno.

No corte mínimo, não existe seleção por perfil, Município, UF ou lista de
Propriedades: o destinatário é o próprio Usuário afetado pelo fato de conta.
Admin não consulta entregas de outra pessoa. A ampliação para destinatários de
recursos operacionais exige uma regra por `tipo_evento` e pertence à vertical
que possuir a fonte real desse evento.

### Consulta

A consulta usa a identidade da sessao; o cliente nao escolhe outro
`destinatario_usuario_id`.

O servidor deve:

- filtrar por destinatario e organizacao autenticados;
- excluir entregas descartadas da lista comum;
- revalidar o escopo atual do recurso;
- paginar por cursor estavel;
- retornar contador nao lido pelo mesmo filtro;
- nunca usar texto de mensagem como fonte de escopo.

## Estado E Persistencia

Estados derivados:

| Estado | Condicao |
|---|---|
| `nao_lida` | `lida_em = null` e `descartada_em = null` |
| `lida` | `lida_em != null` e `descartada_em = null` |
| `descartada` | `descartada_em != null` |
| `expirada` | `expira_em` anterior ao horario do servidor |

Marcar como lida, marcar todas como lidas e descartar devem ser operacoes
idempotentes, persistidas por destinatario e registradas com horario do
servidor. Descartar nao apaga o evento nem a trilha administrativa.

A retenção da entrega no corte da MP-34 é exatamente 90 dias desde `criada_em`.
O evento de auditoria segue a retenção independente do domínio de origem. A
retenção nunca pode fazer uma entrega reaparecer como não lida.

Entrega expirada deixa de aparecer na lista e no contador imediatamente. A
purga física deve ser um comando operacional explícito, idempotente e em lotes:
remove primeiro entregas vencidas e depois eventos de notificação sem entrega.
Ela não apaga `eventos_auditoria`, cujo prazo é independente, nem transforma a
tabela de notificações em arquivo permanente. O agendamento, a monitoração e a
aprovação jurídica/de privacidade dessa purga são portões anteriores à produção.

`lida_em` e `descartada_em` são dados comportamentais do destinatário. Apenas o
próprio usuário e os processos mínimos de operação podem acessá-los; eles não
alimentam analytics, perfilamento ou campanhas nesse corte.

## Navegacao Segura

Ao tocar em uma entrega:

1. o cliente envia o ID da entrega autenticada;
2. o servidor confirma destinatario, organizacao, sessao e escopo atual;
3. o servidor confirma que o recurso existe e continua visivel;
4. o cliente recebe uma referencia canonica autorizada;
5. uma allowlist local converte `recurso_tipo` em rota e monta parametros por
   IDs canonicos;
6. a tela de destino repete sua propria verificacao de acesso;
7. somente depois o recurso e exibido.

Marcar como lida nao significa autorizar ou abrir o recurso. Se a autorizacao
falhar, a interface informa indisponibilidade sem revelar dados adicionais,
remove o destino pendente e atualiza a lista.

Deep link, push, rota direta, titulo, mensagem, `fazenda_id` legado ou
parametros locais nao podem contornar esse fluxo.

## Troca De Usuario, Logout E Cache

Lista, contador, cursor, requisicao em andamento e destino pendente devem ser
particionados por:

`organizacao_id + destinatario_usuario_id + versao_autorizacao + epoch_da_sessao`

Na troca de usuario, organizacao ou logout:

1. cancelar/ignorar respostas da identidade anterior;
2. zerar lista e contador em memoria antes de renderizar a nova sessao;
3. limpar qualquer rota pendente;
4. impedir leitura de cache de outra particao;
5. consultar novamente depois da autenticacao e revalidacao.

Na MP-34, a composição HTTP permanece online-only e conserva a lista somente
em memória enquanto a identidade está válida. Não há cache persistente,
consulta offline nem fila de mutação. Uma fase posterior pode introduzir cache
segregado e cifrado dentro da política de sessão, mas não pode copiar o
`AsyncStorage` ou o contexto global do Demo para a composição HTTP. Leitura,
descarte e resolução de destino exigem conexão neste corte.

## Contrato De API Da MP-34

Todas as respostas usam `snake_case`, `Cache-Control: no-store`, o envelope de
erro vigente e a identidade derivada exclusivamente do access token.

| Método e rota | Comportamento mínimo |
|---|---|
| `GET /v1/notificacoes` | lista próprias entregas visíveis por cursor estável `criada_em + id`, limite padrão 50 e máximo 100 |
| `GET /v1/notificacoes/contador-nao-lidas` | retorna o total pelo mesmo filtro autorizado da lista |
| `POST /v1/notificacoes/:id/leitura` | marca uma entrega própria como lida e preserva o primeiro `lida_em` |
| `POST /v1/notificacoes/leituras` | marca como lidas as entregas elegíveis até o corte fixado pelo servidor |
| `DELETE /v1/notificacoes/:id` | registra `descartada_em`; não apaga evento ou entrega imediatamente |
| `POST /v1/notificacoes/:id/resolver-destino` | reautoriza e retorna somente tipo e IDs canônicos permitidos |

Lista aceita apenas `estado`, `limite` e `cursor`. `estado` pode ser
`nao_lida`, `lida` ou `todas`; descartadas e expiradas nunca entram na coleção
comum. O contador exclui lidas, descartadas, expiradas e qualquer entrega cujo
recurso não esteja mais autorizado.

Os comandos de leitura e descarte exigem `Idempotency-Key`. O comando em lote
não aceita destinatário, lista de IDs ou horário escolhido pelo cliente: o
servidor registra o próprio corte na primeira execução da chave. A resolução de
destino não marca como lida nem retorna nome de tela, URL ou objeto de
navegação.

Leitura individual, leitura em lote e descarte também não aceitam `version` ou
versão-base. O servidor vincula a chave idempotente ao comando, alvo/corte e hash
do pedido. Essa é uma exceção estreita para mutações monotônicas e não relaxa a
versão-base obrigatória nas demais transições versionadas.

As quatro rotas `POST`/`DELETE` de comando ou resolução não declaram nem aceitam
corpo. UUID hifenizado em caixa diferente é canonicalizado para minúsculas antes
do hash e da consulta; `urn:uuid:` e outras formas não canônicas respondem `400`.

A representação mínima de uma entrega contém `id`, `tipo_evento`,
`prioridade`, `criada_em`, `lida_em`, `expira_em`, `recurso_tipo`, `recurso_id`
e conteúdo seguro produzido pelo template versionado. Não inclui
`destinatario_usuario_id`, `organizacao_id`, e-mail, token ou payload interno.

IDs de destinatário enviados pelo cliente são recusados. Entrega inexistente,
de outro usuário, outra organização, descartada, expirada ou fora do escopo
responde com o mesmo `404`, sem confirmar a existência do dado. Ação inválida
sobre entrega própria e visível segue o contrato `403`/`409` vigente.

## Conteúdo Seguro E Privacidade

O produtor do evento informa somente `tipo_evento`, IDs canônicos e
`dados_apresentacao` validados por schema. Título e resumo são gerados no
servidor por template em português do Brasil e versão conhecida; produtor,
banco e cliente não enviam HTML, Markdown, URL ou texto arbitrário.

Limites iniciais: título de até 120 caracteres, resumo de até 500 e objeto de
apresentação de até 2 KiB. O conteúdo é texto puro e não inclui:

- senha, token, desafio, link de ação ou URL completa;
- e-mail, telefone, documento ou endereço;
- IP, agente do dispositivo, coordenada ou localização precisa;
- mensagem de exceção, SQL, header, payload livre ou dado de outro usuário;
- nome de rota, permissão ou instrução que possa ser tratada como autoridade.

Os três templates iniciais são genéricos e confirmam apenas que a senha, o
e-mail principal ou a recuperação da própria conta mudou. Detalhes operacionais
permanecem na auditoria restrita, também sem segredo. Alterar template ou seu
schema exige versão nova e teste de regressão para clientes antigos.

## Cliente HTTP E Ciclo Da Identidade

A composição HTTP recebeu uma nova porta/repositório de notificações, decoders
estritos e tela própria. Ela não importa `NotificacaoContext`,
`NOTIFICACOES_INICIAIS`, a tela do Demo ou qualquer implementação de
`src/api`.

Lista, contador, cursor, comandos em curso e destino pendente usam a partição
`organizacao_id + usuario_id + versao_autorizacao + epoch_da_sessao`. Logout,
troca de identidade, mudança conhecida de organização/escopo ou resposta tardia
invalidam a partição antes de renderizar. O estado confirmado pelo servidor só
é atualizado depois da resposta; falha mantém o último estado conhecido e
oferece nova tentativa explícita.

O contador é buscado após autenticação/revalidação e ao voltar à área
autenticada; lista e pull-to-refresh o reconciliam. Não existe polling em
background, push, serviço de localização ou nova permissão Android. Ao tocar,
o cliente resolve o destino no servidor e só então usa uma allowlist local. Na
primeira versão, `conta` é o único destino habilitado.

## Tokens De Dispositivo

A MP-34 inicial não coleta nem persiste token Expo, FCM, APNs, identificador de
instalação ou associação usuário-dispositivo. Não adiciona SDK de push,
receiver, canal do sistema ou permissão Android.

Uma fase futura de push deverá decidir provedor, consentimento, múltiplos
dispositivos, rotação, revogação em logout, expiração, criptografia, retenção,
tratamento de token inválido e prevenção de entrega à identidade anterior.
Essas decisões não bloqueiam notificações in-app e não podem ser antecipadas na
MP-34.

## Observabilidade E Auditoria

Registrar, sem incluir conteudo sensivel:

- evento e entrega;
- destinatario e organizacao;
- resultado da selecao de escopo;
- deduplicacao;
- leitura e descarte;
- tentativa de abrir;
- autorizacao concedida ou negada;
- correlacao da requisicao;
- horario do servidor.

Logs do cliente nao devem imprimir payload completo, tokens ou dados de outro
usuario.

Listagem e contador produzem somente métricas/logs estruturados, sem evento de
auditoria por item. Criação, deduplicação, leitura, leitura em lote, descarte e
resolução negada são eventos auditáveis por código e IDs. A auditoria não copia
título, resumo ou `dados_apresentacao`.

Na `000008` local da MP-35B, criação/deduplicação e resolução negada deixam de
ser wrappers isoladas executáveis pelo runtime. A tentativa de entrega recebe
somente o ID do fato de conta já auditado na transação corrente e um ID opaco
da tentativa, executa o `INSERT ... ON CONFLICT` e deriva do resultado
persistido se houve criação ou deduplicação. A resolução recebe somente sessão,
entrega e `requestId`, revalida a sessão no PostgreSQL e deriva ator,
organização, destinatário, recurso, resultado e horário. Em ambos os casos, a
auditoria é efeito interno da operação real, pertence à mesma transação e o
replay não cria outro evento. O runtime e `PUBLIC` não executam as wrappers
isoladas nem o escritor genérico interno.

## Criterios De Aceite Da MP-03

1. Evento e entrega individual possuem contratos distintos.
2. Destinatario e organizacao sao obrigatorios na entrega.
3. Recurso operacional possui tipo, ID e Propriedade; Talhao e opcional.
4. Leitura, descarte, prioridade, criacao e deduplicacao estao definidos.
5. Admin, Colaborador e Produtor recebem somente recursos autorizados.
6. Troca de usuario limpa estado e impede resposta/cache cruzado.
7. Navegacao usa allowlist e reautorizacao antes de abrir.
8. Leitura nao e tratada como autorizacao.
9. O comportamento global e efemero do mock permanece documentado como falha.
10. Backend, persistencia e testes negativos foram entregues tecnicamente na
    `MP-34`.

## Critérios De Aceite Da MP-34

1. A migration `000005-notificacoes.sql` é append-only, reversível, selada no
   manifesto e preserva as quatro migrations integradas.
2. Evento, entrega e fato de conta são atômicos; concorrência e repetição não
   criam duplicidade.
3. Usuário autenticado lista, conta e altera somente as próprias entregas da
   organização atual; Admin não recebe acesso ao histórico alheio.
4. Entrega inexistente, de outro destinatário/organização, expirada ou fora do
   escopo responde sem confirmar sua existência.
5. Lista e contador aplicam exatamente o mesmo filtro de visibilidade.
6. Leitura, leitura em lote e descarte são idempotentes, preservam o primeiro
   horário do servidor e não afetam itens posteriores ao corte do lote.
7. Resolver destino reautoriza no servidor e retorna somente referência
   canônica; a tela consulta novamente o recurso.
8. Templates e schemas recusam texto livre, HTML, URL, segredo e dado pessoal
   fora da allowlist.
9. Expiração de 90 dias, purga em lotes e separação da auditoria possuem testes
   de relógio e retenção.
10. Logout, troca de usuário/organização, mudança de versão e resposta tardia
    limpam lista, contador, cursor e destino pendente.
11. A composição HTTP não importa o mock, não usa `AsyncStorage` e não recebe
    SDK, token ou permissão de push.
12. Typecheck, contratos, testes HTTP, integração real com PostgreSQL/PostGIS e
    inspeção dos grafos HTTP/Demo passam em Node.js 22 para o aplicativo e
    Node.js 24 para o backend. O smoke funcional Android físico da MP-34 foi
    executado e aprovado em 2026-08-24, com escopo e limitações registrados
    separadamente em [smoke.md](smoke.md); nenhuma cobertura adicional é
    promovida por inferência.

## Implementação Técnica Concluída E Integrada

A execução autorizada entregou e a integração direta no commit `e787707`
preservou:

1. os três templates iniciais aprovados e seu catálogo fechado;
2. a migration append-only `000005-notificacoes.sql`, constraints, índices,
   grants mínimos, papel de manutenção e testes de migration/privilégio;
3. `backend/src/notifications/` com contratos, templates, repositório, serviço,
   rotas OpenAPI e comando one-shot de purga;
4. os cinco fluxos emissores transacionais dos fatos de conta usando o mesmo
   `PoolClient` da mudança de origem;
5. contratos, decoders, repositório, estado e tela exclusivos de `src/http`,
   contador e allowlist limitada a `conta`;
6. cobertura de concorrência, deduplicação, idempotência, RBAC negativo,
   retenção, conteúdo seguro, troca de identidade e separação Demo/HTTP;
7. documentação operacional e smoke do corte, sem tag, deploy, release ou
   publicação.

Os arquivos efetivos incluem `backend/migrations/000005-notificacoes.sql`, o
novo módulo `backend/src/notifications/`, o wiring do backend e dos produtores
transacionais de conta, além de contratos, repositório, estado, navegação, tela
e testes próprios em `src/http` e `tests`.

## Decisões Fechadas E Portões Produtivos

Foram fechados no corte técnico:

- catálogo de três tipos, prioridade `alta` dos cinco fluxos emissores e textos
  exatos dos templates;
- retenção das entregas e das chaves idempotentes por exatamente 90 dias;
- comando de purga one-shot em lotes e papel `NOLOGIN`
  `tche_agro_notifications_maintenance`, separado do runtime.

Continuam portões produtivos:

- definir responsável, frequência/agendamento e alertas externos da purga;
- provisionar a conta `LOGIN`, CA e segredo da manutenção com menor privilégio;
- validar externamente, na revisão jurídica/de privacidade, os 90 dias e a
  premissa aprovada de que a MP-34 não implementa legal hold nem suspensão de
  descarte. Se essa revisão exigir a capacidade, ela será uma alteração futura
  versionada e anterior à produção.

MP-34 permanecer online-only, não reutilizar `outbox_email`, limitar o destino a
`conta`, usar corte do servidor em “marcar todas” e manter push/tokens de
dispositivo fora do corte são decisões desta arquitetura. O catálogo de
recursos operacionais continua contrato futuro e não autoriza implementação.

## Dependências E Limites

Backend, banco, autenticação, organização confiável e sessão da MP-33B já estão
disponíveis; a composição HTTP e a autorização de Propriedades da MP-33C também.
Persistência, API, allowlist e guards da MP-34 foram implementados e testados no
commit integrado `e787707`. O fechamento produtivo ainda depende de:

- operação agendada da purga, observabilidade, backup/restauração e gestão de
  segredos;
- portões gerais de domínio, assinatura, dispositivo, MFA de Administrador e
  release ainda registrados no núcleo ativo.

Integração push, cache offline e MP-35 ficam fora. `QA-P0-01` está resolvida
tecnicamente pela MP-34, integrada diretamente à branch `backend` no commit
`e787707`, sem pull request. Os três jobs da CI pós-push foram aprovados; não
houve tag, deploy, release ou publicação dessa implementação.
