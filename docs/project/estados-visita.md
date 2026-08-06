# Estados E Transicoes De Visita

> Status: `ATIVO`
>
> Definido em: 2026-07-30
>
> Origem: `MP-05` / `QA-P1-04`

## Objetivo

Este documento define a maquina de estados produtiva das Visitas Tecnicas,
incluindo criacao, reagendamento, atraso, conclusao, cancelamento, complemento,
correcao, anulacao, concorrencia e auditoria.

Ele nao altera o mock atual. A implementacao no dominio e na interface pertence
a `MP-27`; validacao e autorizacao produtivas continuam dependentes do
backend.

## Problema Confirmado

O comportamento local atual:

- trata `status` como texto aceito por `Visita.update`;
- permite que a edicao escolha `agendada`, `realizada` ou `cancelada` sem
  validar a transicao anterior;
- permite reabrir Visita realizada e voltar para agendada;
- marca uma Visita como realizada imediatamente, sem confirmacao ou formulario
  minimo de conclusao;
- cancela sem persistir motivo;
- mantem Visita vencida apenas como `agendada`;
- nao preserva historico de estado, autor, data ou valores anteriores;
- permite exclusao fisica pelo Admin.

## Principios

1. Estado muda somente por comando tipado e autorizado.
2. A interface nunca envia `status` livre como edicao comum.
3. Conclusao e cancelamento exigem confirmacao e dados proprios.
4. Visita realizada nao volta a agendada nem vira cancelada.
5. Visita cancelada fica somente leitura e pode originar nova Visita vinculada.
6. Atraso e indicador derivado, nao novo estado persistido.
7. Correcao e complemento preservam o registro e o historico.
8. Nenhuma Visita persistida e excluida fisicamente pelo fluxo comum.
9. Propriedade, criador e historico de estados nunca sao reatribuidos.
10. Backend revalida perfil, acao, Propriedade, estado e versao.

## Estados Canonicos

| Estado | Significado |
|---|---|
| `agendada` | Visita futura ou pendente de conclusao/cancelamento |
| `realizada` | Visita concluida com registro minimo de execucao |
| `cancelada` | Visita nao realizada, encerrada com motivo |
| `anulada` | registro de realizacao declarado invalido, preservado no historico |

`atrasada` nao e estado. A apresentacao usa `Agendada · Atrasada` quando:

- `estado = agendada`;
- horario atual do servidor ultrapassou `agendada_para`;
- nao existe evento posterior de conclusao, cancelamento ou anulacao.

`atrasada_desde` deriva de `agendada_para`. Fuso horario de apresentacao vem da
organizacao/Propriedade; comparacao usa instante absoluto do servidor.

## Criacao

Existem dois fluxos explicitos:

### Agendar Visita

Cria em `agendada` e exige:

- organizacao e Propriedade autorizadas;
- `agendada_para` futura;
- objetivo;
- responsavel por ID, quando o cadastro estiver disponivel, e snapshot legivel;
- criador e horario do servidor.

### Registrar Visita Ja Realizada

Cria diretamente em `realizada`, sem passar por `agendada`, e exige os mesmos
dados minimos do formulario de conclusao.

O fluxo visual deve deixar claro se o usuario esta agendando ou registrando
algo que ja aconteceu. `cancelada` e `anulada` nunca sao estados iniciais.

## Transicoes Permitidas

| Origem | Comando | Destino |
|---|---|---|
| `agendada` | reagendar | `agendada` |
| `agendada` | concluir | `realizada` |
| `agendada` | cancelar | `cancelada` |
| `realizada` | anular | `anulada` |

Complemento e correcao sao eventos e nao mudam o estado principal.

Transicoes proibidas:

- `realizada -> agendada`;
- `realizada -> cancelada`;
- `cancelada -> agendada`;
- `cancelada -> realizada`;
- `anulada -> qualquer outro estado`;
- qualquer mudanca por update generico ou payload com `status`.

Para refazer uma Visita cancelada, cria-se nova Visita com
`visita_origem_id` apontando para a cancelada. A Visita anterior permanece
intacta.

## Edicao Enquanto Agendada

Antes do encerramento, equipe autorizada pode ajustar dados de agenda dentro
do mesmo escopo. Propriedade e criador permanecem imutaveis.

Mudancas relevantes geram evento `agendamento_alterado`, com:

- valores anteriores e novos;
- autor;
- horario do servidor;
- motivo quando data/hora ou responsavel mudarem;
- `versao_base` e resultante.

Alterar `agendada_para` e um reagendamento, mesmo quando o estado continua
`agendada`. Reagendamento nao apaga o fato de que a Visita ficou atrasada em
algum momento.

## Conclusao

O comando `concluir_visita` exige tela/formulario de confirmacao com contexto
da Propriedade, responsavel e horario agendado.

Campos minimos:

- `inicio_real_em`, nao futuro;
- `concluida_em`, gerado pelo servidor;
- `concluida_por_usuario_id`;
- responsavel executante por ID/snapshot quando aplicavel;
- resumo operacional da conclusao;
- `versao_base`;
- chave de idempotencia.

Observacoes, recomendacoes, clima, proxima Visita e anexos podem ser
acrescentados conforme o formulario aprovado em `MP-27`. Marcar como realizada
nao pode ser acao imediata sem revisar os dados.

Uma Visita criada diretamente como realizada usa o mesmo contrato de
conclusao.

## Cancelamento

O comando `cancelar_visita` existe somente para `agendada` e exige:

- codigo de motivo;
- descricao obrigatoria quando o motivo for `outro`;
- autor;
- `cancelada_em` pelo servidor;
- `versao_base`;
- confirmacao mostrando Propriedade, data/hora, objetivo e responsavel.

Catalogo inicial de motivos:

- `solicitacao_produtor`;
- `indisponibilidade_equipe`;
- `clima`;
- `reagendada_com_nova_visita`;
- `duplicidade`;
- `outro`.

Cancelamento nao remove a Visita e nao pode ser desfeito. Se houver nova data
depois do cancelamento, outra Visita e criada e vinculada.

## Complemento

Equipe autorizada pode adicionar complemento a Visita `realizada`:

- nota tecnica adicional;
- recomendacao posterior;
- referencia de anexo autorizado;
- autor e horario do servidor;
- chave de idempotencia.

Complemento aparece separado do registro de conclusao, nao troca estado e nao
reescreve o relato anterior. Se incorreto, recebe correcao/inativacao auditada.

## Correcao Excepcional

Visita `realizada` nao abre formulario de edicao geral. Correcao exige comando
tipado, permissao explicita, justificativa e `versao_base`.

O evento registra:

- campos em allowlist;
- valores `antes` e `depois`;
- motivo;
- autor;
- horario do servidor;
- versao base e resultante;
- origem e correlacao.

Nunca podem ser corrigidos:

- `visita_id`;
- `organizacao_id`;
- `propriedade_id`;
- criador;
- historico de estados;
- `concluida_em` e autor do comando de conclusao.

Propriedade errada exige anulacao da Visita realizada e criacao de outra. A
correcao nao inventa nova transicao nem apaga a anterior.

## Anulacao

Anulacao existe para Visita `realizada` registrada indevidamente ou sem
validade operacional.

Ela:

- exige permissao explicita e justificativa;
- gera evento `visita_anulada`;
- preserva conclusao, correcoes, complementos e anexos;
- torna o estado `anulada`;
- e terminal no primeiro contrato;
- nao equivale a exclusao.

Visita apenas agendada deve ser cancelada, nao anulada.

## Modelo Minimo

### `visita`

- `id`;
- `organizacao_id`;
- `propriedade_id`;
- `estado`;
- `agendada_para` quando aplicavel;
- `inicio_real_em` quando realizada;
- `objetivo`;
- responsavel por ID e snapshot;
- `criada_por_usuario_id`;
- `criada_em`;
- `versao_atual`;
- `visita_origem_id` opcional;
- projecao operacional atual.

### `visita_evento`

- `evento_id`;
- `visita_id`;
- sequencia monotona;
- tipo do evento;
- estado anterior e novo, quando houver;
- autor por ID e perfil em snapshot;
- data/hora do servidor;
- `versao_base` e resultante;
- motivo, quando exigido;
- valores antes/depois;
- idempotencia, origem e correlacao.

Eventos sao append-only.

## Eventos Minimos

- `visita_agendada`;
- `visita_realizada_registrada`;
- `agendamento_alterado`;
- `visita_concluida`;
- `visita_cancelada`;
- `visita_complementada`;
- `visita_corrigida`;
- `visita_anulada`;
- `nova_visita_vinculada`.

## Autoridade Por Perfil

### Produtor

- consulta Visitas autorizadas das proprias Propriedades;
- ve estado, atraso, agenda, conclusao, cancelamento e informacao operacional
  liberada;
- nao cria, edita, conclui, cancela, corrige, complementa, anula ou exclui;
- nao recebe metadados administrativos excessivos.

### Colaborador

- cria e registra Visitas dentro do escopo;
- reage a agenda, conclui e cancela quando possuir a acao;
- complementa, corrige ou anula somente com permissao explicita;
- nao recebe poder de transicao apenas por conseguir abrir o detalhe.

### Admin

- atua dentro da organizacao e do escopo administrativo autorizado;
- pode receber todas as acoes conforme papel;
- consulta historico completo;
- nao ignora transicoes, motivo, versao ou auditoria;
- nao exclui Visita persistida pelo fluxo comum.

## Concorrencia E Idempotencia

Todo comando envia:

- `visita_id`;
- estado esperado;
- `versao_base`;
- comando;
- chave de idempotencia;
- payload permitido.

Se estado ou versao divergirem, o servidor recusa com conflito e retorna a
versao vigente. Nao existe `last write wins`.

Repetir a mesma chave nao duplica conclusao, cancelamento, complemento,
correcao ou anulacao.

## Offline

Consulta de Visitas em cache segue a politica de sessao e o ultimo escopo
autorizado.

No primeiro corte, exigem conexao:

- criar/agendar;
- registrar realizada;
- reagendar;
- concluir;
- cancelar;
- complementar;
- corrigir;
- anular.

O app nao enfileira transicao offline nem mostra sucesso antes da confirmacao
do servidor. Ao reconectar, revalida sessao, escopo, estado e versao antes de
aceitar qualquer comando.

## Compatibilidade Com Registros Atuais

Na migracao:

- `agendada`, `realizada` e `cancelada` conhecidos sao preservados;
- Visita `agendada` com horario passado recebe apenas o indicador derivado de
  atraso;
- Visita realizada/cancelada fica somente leitura ate haver comandos
  auditados;
- registros sem status recebem classificacao administrativa explicita; nao se
  inventa transicao;
- historico anterior inexistente nao e sintetizado;
- `fazenda_id` permanece alias temporario de `propriedade_id`;
- responsavel textual permanece snapshot legivel ate existir ID estavel.

Atualizacao em 2026-08-06: eventos novos usam somente `propriedade_id` como
contexto da Propriedade. Eventos locais antigos com aliases sao normalizados
na leitura antes de nova persistencia; o campo canonico do proprio evento tem
prioridade e o contexto do registro e usado apenas como fallback.

Estado desconhecido bloqueia mutacoes e exige reconciliacao. O mock atual
continua aceitando transicoes incoerentes ate `MP-27`; isso e compatibilidade,
nao regra aprovada.

## Criterios De Aceite Da MP-05

1. Estados e transicoes permitidas/proibidas estao definidos.
2. Registro direto de Visita realizada usa o contrato de conclusao.
3. Atraso e derivado sem mudar automaticamente o estado.
4. Reagendamento preserva antes/depois e motivo.
5. Conclusao exige formulario minimo e confirmacao.
6. Cancelamento exige motivo e contexto completo.
7. Realizada nao volta a agendada nem vira cancelada.
8. Cancelada permanece somente leitura e pode originar nova Visita.
9. Correcao, complemento e anulacao preservam o historico.
10. Nenhuma Visita persistida e excluida pelo fluxo comum.
11. Concorrencia valida estado e versao no servidor.
12. Rotas diretas e payload com `status` nao contornam o dominio.

## Dependencias E Limites

A implementacao pertence a `MP-27` e depende de:

- componentes de validacao da `MP-13`;
- comandos de dominio e telas especificas;
- IDs confiaveis de usuario/responsavel;
- persistencia de eventos e autorizacao no backend;
- testes de conflito, idempotencia, rota direta e payload manipulado;
- smoke de Admin, Colaborador e Produtor.

Organizacao visual das listas e rotulos derivados pertence a `MP-22`.

Ate `MP-27` e o backend correspondente, `QA-P1-04` permanece resolvida somente
em nivel de contrato.
