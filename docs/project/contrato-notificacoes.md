# Contrato De Notificacoes

> Status: `ATIVO`
>
> Definido em: 2026-07-30
>
> Origem: `MP-03` / `QA-P0-01`

## Objetivo

Este documento define o contrato produtivo minimo para notificacoes in-app:
destinatario, escopo, recurso relacionado, persistencia, deduplicacao e
navegacao segura.

Ele nao implementa backend, push, persistencia local ou navegacao no mock
atual. A implementacao produtiva pertence a `MP-34`.

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
| `recurso_tipo` | tipo canonico do recurso relacionado |
| `recurso_id` | ID estavel do recurso |
| `propriedade_id` | Propriedade do recurso, quando operacional |
| `talhao_id` | opcional; exige `propriedade_id` |
| `autor_id` | usuario ou servico que originou o evento, quando aplicavel |
| `criado_em` | data/hora do servidor |
| `dados_apresentacao` | metadados minimos, sem autoridade de acesso |

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
| `perfil_snapshot` | opcional, somente auditoria/apresentacao |
| `prioridade` | `baixa`, `normal` ou `alta` |
| `criada_em` | data/hora do servidor |
| `lida_em` | `null` enquanto nao lida |
| `descartada_em` | `null` enquanto visivel |
| `chave_deduplicacao` | chave idempotente por destinatario |
| `expira_em` | opcional conforme politica do tipo |

O perfil registrado e apenas snapshot. A autorizacao usa o usuario, a
organizacao, os vinculos ativos e a regra atual do recurso.

A unicidade minima deve considerar:

`organizacao_id + destinatario_usuario_id + chave_deduplicacao`

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

A retenção padrão do primeiro backend é de 90 dias desde `criada_em`, salvo
`expira_em` anterior definido pelo evento. O evento de auditoria segue a
retenção do domínio de origem. A retenção nunca pode fazer uma entrega
reaparecer como não lida.

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

`organizacao_id + destinatario_usuario_id`

Na troca de usuario, organizacao ou logout:

1. cancelar/ignorar respostas da identidade anterior;
2. zerar lista e contador em memoria antes de renderizar a nova sessao;
3. limpar qualquer rota pendente;
4. impedir leitura de cache de outra particao;
5. consultar novamente depois da autenticacao e revalidacao.

Cache produtivo futuro deve ser segregado e cifrado. No primeiro corte,
notificacoes em cache podem ser consultadas offline somente dentro da politica
de sessao e do ultimo escopo autorizado. Marcar como lida, descartar e abrir
destino exigem conexao; nao ha fila de mutacao offline nesta versao do
contrato.

## Contrato De API Futuro

Operacoes minimas:

| Operacao | Comportamento |
|---|---|
| listar minhas notificacoes | pagina por destinatario/organizacao autenticados |
| obter contador nao lido | usa o mesmo filtro autorizado da lista |
| marcar uma como lida | altera somente entrega do destinatario |
| marcar pagina/todas como lidas | escopo explicito da identidade autenticada |
| descartar uma entrega | cria `descartada_em`, sem apagar evento |
| resolver destino | reautoriza e retorna referencia canonica permitida |

IDs de destinatario enviados pelo cliente devem ser ignorados ou recusados.
Operacoes sobre entrega inexistente, de outro usuario, outra organizacao ou
recurso fora do escopo devem responder de forma controlada sem confirmar a
existencia do dado.

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
10. Backend, persistencia e testes negativos ficam explicitamente em `MP-34`.

## Dependencias E Limites

O fechamento produtivo depende de:

- backend e banco;
- autenticacao e organizacao confiaveis;
- RBAC e escopo territorial no servidor;
- IDs estaveis dos recursos;
- persistencia de leitura/descarte;
- allowlist de destinos e guards nas telas;
- cache segregado e cifrado;
- testes negativos de API, troca de usuario, deep link e rota direta;
- integração push fica fora do primeiro corte de `MP-34`.

Essas dependencias pertencem a `MP-34 — Notificacoes reais e isoladas`. Ate
essa tarefa ser concluida, `QA-P0-01` permanece resolvida somente em nivel de
contrato.
