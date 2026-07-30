# Ciclo De Vida Do Caderno De Campo

> Status: `ATIVO`
>
> Definido em: 2026-07-30
>
> Origem: `MP-04` / `QA-P0-03`

## Objetivo

Este documento define o ciclo de vida produtivo do Caderno de Campo:
rascunho, registro consolidado, complemento, correcao, visibilidade,
arquivamento, anulacao, autoria, concorrencia e auditoria.

Ele nao altera o mock atual. A implementacao do ciclo no aplicativo pertence a
`MP-25`; persistencia imutavel, autorizacao e concorrencia no servidor
pertencem a `MP-36`.

## Problema Confirmado

O comportamento local atual:

- cria registros sem estado explicito de rascunho ou consolidacao;
- permite a Admin e Colaborador substituir o corpo completo por
  `CadernoCampo.update`;
- permite trocar data, tipo, responsavel, Talhao, produtos, dose, area, clima,
  observacoes, localizacao e visibilidade;
- preserva `origem_registro`, mas nao preserva o conteudo anterior;
- nao possui complemento, correcao versionada, arquivamento ou anulacao;
- remove registros fisicamente por `CadernoCampo.delete`;
- nao possui trilha de auditoria ou controle de concorrencia.

Assim, um relato do Produtor pode continuar rotulado como `Registrado pelo
produtor` depois de ter sido reescrito pela equipe.

## Principios

1. Rascunho e conteudo de trabalho editavel; registro enviado e fato
   operacional consolidado.
2. O envio e uma transicao explicita e atomica.
3. O corpo original de um registro consolidado nunca e sobrescrito.
4. Complemento acrescenta informacao sem alterar o relato original.
5. Correcao excepcional cria nova versao efetiva e preserva antes/depois.
6. Visibilidade e mudanca auditada, separada do corpo.
7. Arquivamento e anulacao preservam o registro e o historico.
8. Autoria, origem, Propriedade e datas do envio nao podem ser reatribuidas.
9. Toda operacao revalida perfil, acao, Propriedade e versao no servidor.
10. Interface, rota direta, cache ou payload local nao sao autoridade.

## Estados Canonicos

| Estado | Significado |
|---|---|
| `rascunho` | conteudo ainda nao enviado; editavel somente pelo criador |
| `registrado` | relato consolidado e disponivel conforme visibilidade |
| `arquivado` | retirado da consulta operacional comum, mas ainda valido no historico |
| `anulado` | declarado invalido, preservado integralmente e sem efeito operacional |

`complemento`, `correcao` e `alteracao_visibilidade` sao eventos; nao sao
estados do registro principal.

## Transicoes Permitidas

| Origem | Acao | Destino | Autoridade minima |
|---|---|---|---|
| novo | salvar rascunho | `rascunho` | criador autorizado na Propriedade |
| `rascunho` | editar | `rascunho` | mesmo criador |
| `rascunho` | descartar | removido dos rascunhos ativos | mesmo criador |
| `rascunho` | revisar e enviar | `registrado` | mesmo criador, apos validacao e reautorizacao |
| `registrado` | arquivar | `arquivado` | equipe com permissao explicita e justificativa |
| `arquivado` | reativar | `registrado` | equipe com permissao explicita e justificativa |
| `registrado` ou `arquivado` | anular | `anulado` | equipe com permissao explicita e justificativa |

Regras:

- registro consolidado nunca volta a `rascunho`;
- `anulado` e terminal no primeiro contrato;
- registro anulado nao pode receber complemento ou correcao;
- registro arquivado deve ser reativado antes de novo complemento ou correcao;
- nao existe exclusao fisica de registro que ja foi enviado.

## Rascunho

O rascunho:

- pertence a `organizacao_id`, `propriedade_id` e `criado_por_usuario_id`;
- pode ser editado e descartado somente pelo criador;
- nao aparece como registro operacional para outros usuarios;
- nao gera a afirmacao `registrado`;
- usa `rascunho_id` local/servidor estavel para idempotencia;
- deve mostrar revisao final antes do envio, especialmente ao Produtor.

Admin nao reescreve rascunho de outro usuario. Suporte excepcional deve usar
fluxo proprio auditado, fora do primeiro corte.

## Registro Consolidado E Original Imutavel

No envio, o servidor valida permissao, campos obrigatorios e versao do
rascunho, e grava atomicamente:

- `registro_id`;
- `organizacao_id`;
- `propriedade_id`;
- `talhao_id` opcional e snapshot legivel;
- `tipo_atividade`;
- `data_atividade`;
- `responsavel_usuario_id` e snapshot legivel;
- `criado_por_usuario_id`;
- `origem_registro` (`produtor` ou `equipe`);
- corpo operacional original;
- grupo de localizacao original, quando existir;
- visibilidade inicial;
- `registrado_em` e `registrado_por_usuario_id`;
- `versao_atual = 1`;
- primeiro evento de auditoria.

O snapshot original permanece imutavel. Uma visao atual pode projetar
correcoes posteriores, mas deve permitir distinguir o original do valor
vigente.

Campos que nunca podem ser corrigidos:

- `registro_id`;
- `organizacao_id`;
- `propriedade_id`;
- criador e origem;
- `registrado_em` e autor do envio.

Se a Propriedade estiver errada, o registro deve ser anulado e outro deve ser
criado. Nao ha transferencia de registro entre Propriedades.

## Complemento Tecnico

Equipe autorizada pode acrescentar complemento a registro `registrado` dentro
do proprio escopo.

Cada complemento possui:

- `complemento_id`;
- `registro_id`;
- autor por ID e snapshot legivel;
- texto ou dados tecnicos adicionais;
- referencias de anexo, quando autorizadas;
- `criado_em` pelo servidor;
- sequencia do evento;
- chave de idempotencia.

Complemento:

- nao substitui campos do registro;
- aparece separado do relato original;
- nao muda autoria ou origem;
- nao pode ser apagado silenciosamente;
- se incorreto, recebe evento de correcao proprio ou e invalidado com motivo.

O Produtor ve somente complementos liberados e necessarios ao contexto
operacional.

## Correcao Excepcional

Correcao nao e edicao comum. Exige permissao explicita, justificativa e
`versao_base`.

O evento registra:

- `correcao_id`;
- `registro_id`;
- autor e perfil em snapshot;
- motivo obrigatorio;
- campos alterados em allowlist;
- valores `antes` e `depois`;
- `versao_base` e `versao_resultante`;
- data/hora do servidor;
- origem e correlacao da requisicao.

Regras:

- o snapshot original nao muda;
- a projecao atual aplica eventos na ordem da sequencia;
- autoria, origem e Propriedade nao entram na allowlist;
- correcao de localizacao grava o grupo anterior e o novo grupo integral;
- grupo parcial de localizacao continua invalido;
- erro de Propriedade exige anulacao e novo registro;
- tentativa com versao desatualizada retorna conflito e nao aplica alteracao.

## Visibilidade

Visibilidade inicial faz parte do envio, mas toda mudanca posterior e evento
independente:

- valor anterior e novo;
- autor;
- horario do servidor;
- `versao_base` e resultante;
- motivo quando a politica exigir;
- escopo afetado.

Ocultar do Produtor nao apaga o registro. Tornar visivel nao amplia o acesso
para Produtor sem vinculo com a Propriedade.

## Arquivamento E Anulacao

### Arquivamento

- remove o item da lista operacional comum;
- preserva validade historica;
- exige justificativa;
- pode ser revertido por reativacao auditada;
- nao apaga original, eventos ou anexos referenciados.

### Anulacao

- declara que o registro nao deve produzir efeito operacional;
- exige justificativa clara;
- e terminal no primeiro contrato;
- preserva original, correcoes, complementos e autoria;
- deve aparecer como anulado nas consultas autorizadas;
- nao pode ser implementada como exclusao.

## Modelo De Eventos E Auditoria

Tipos minimos:

- `rascunho_criado`;
- `rascunho_atualizado`;
- `registro_enviado`;
- `complemento_adicionado`;
- `complemento_corrigido` ou `complemento_invalidado`;
- `correcao_aplicada`;
- `visibilidade_alterada`;
- `registro_arquivado`;
- `registro_reativado`;
- `registro_anulado`.

Cada evento produtivo registra:

- `evento_id`;
- `registro_id` ou `rascunho_id`;
- tipo e sequencia monotona;
- organizacao e Propriedade;
- autor por ID e perfil em snapshot;
- data/hora do servidor;
- `versao_base` e resultante, quando aplicavel;
- motivo obrigatorio para correcao, arquivamento, reativacao e anulacao;
- antes/depois quando houver alteracao;
- origem, idempotencia e correlacao da requisicao.

Eventos sao append-only. Correcao de evento gera outro evento; nao sobrescreve
a trilha anterior.

## Autoridade Por Perfil

### Produtor

- cria, edita e descarta o proprio rascunho na propria Propriedade;
- revisa e envia o proprio rascunho;
- nao altera registro consolidado;
- nao corrige, arquiva, anula ou muda visibilidade;
- ve original, estado, valores operacionais vigentes e complementos liberados;
- nao recebe justificativas internas, metadados administrativos excessivos ou
  trilha tecnica completa.

### Colaborador

- cria e envia os proprios rascunhos dentro do escopo;
- consulta registros autorizados;
- adiciona complemento quando possuir a acao;
- corrige, altera visibilidade, arquiva, reativa ou anula somente com permissao
  explicita, dentro do escopo e conforme justificativa exigida;
- nao recebe poder de correcao apenas por conseguir abrir o detalhe.

### Admin

- atua dentro da organizacao e do escopo administrativo autorizado;
- pode receber as acoes excepcionais conforme o papel;
- consulta a trilha completa;
- nao sobrescreve o original nem ignora concorrencia.

## Concorrencia E Idempotencia

Toda mutacao de registro consolidado envia:

- `registro_id`;
- `versao_base`;
- chave de idempotencia;
- comando tipado;
- payload permitido para o comando.

Se `versao_base` nao for a atual, o servidor recusa com conflito, devolve a
versao vigente e exige revisao. Nao existe `last write wins`.

Repetir a mesma chave de idempotencia nao cria complemento, correcao ou
transicao duplicados.

## Offline E Sincronizacao

O primeiro corte permite:

- criar e editar rascunho local offline, segregado por usuario, organizacao e
  Propriedade;
- consultar registros ja autorizados dentro da politica de sessao.

O primeiro corte nao permite offline:

- transformar rascunho em `registrado`;
- adicionar complemento;
- corrigir;
- alterar visibilidade;
- arquivar, reativar ou anular.

Ao reconectar:

1. revalidar sessao, perfil e escopo;
2. recarregar a versao atual;
3. validar o rascunho;
4. mostrar revisao;
5. exigir confirmacao explicita para enviar.

Rascunho local nunca deve aparecer como aceito pelo servidor nem ser enviado
automaticamente em segundo plano.

## Compatibilidade Com Registros Atuais

Registros legados sem estado explicito devem ser tratados como
`registrado_legado` para migracao e como consolidados para bloqueio de edicao.

Na migracao:

- o conteudo persistido naquele momento vira snapshot original;
- autoria e origem ausentes permanecem `nao informadas`, sem inferencia;
- nao se inventa trilha anterior;
- `fazenda_id` permanece alias temporario de contexto da Propriedade;
- Talhao e responsavel textuais permanecem snapshots ate `MP-24`;
- a migracao recebe evento tecnico identificando origem legada.

O mock atual continua aceitando update destrutivo ate `MP-25`. Essa
compatibilidade e estado atual, nao regra aprovada.

## Criterios De Aceite Da MP-04

1. Estados e transicoes permitidas estao definidos.
2. Rascunho pode ser alterado apenas pelo criador.
3. Envio torna o corpo original imutavel.
4. Complemento, correcao e visibilidade sao eventos separados.
5. Correcao preserva antes/depois, motivo, autor e versao.
6. Localizacao corrigida preserva o grupo original.
7. Arquivamento e anulacao nao excluem o registro.
8. Produtor nao altera registro consolidado e recebe visao operacional minima.
9. Colaborador/Admin dependem de acao explicita e escopo.
10. Concorrencia usa versao base e nao aceita `last write wins`.
11. Registros legados sao protegidos sem inventar historico.
12. Implementacao local e backend permanecem separados em `MP-25` e `MP-36`.

## Dependencias E Limites

Este contrato nao define os campos obrigatorios por tipo; essa validacao
pertence a `MP-25` e `QA-P1-08`.

O fechamento depende de:

- IDs estaveis de responsavel e Talhao em `MP-24`;
- UI, comandos e projecao local em `MP-25`;
- backend, banco append-only, autorizacao e concorrencia em `MP-36`;
- politica de anexos e retencao;
- testes negativos de API, rota direta, payload indevido, offline e conflito;
- smoke dos tres perfis.

Ate `MP-25` e `MP-36`, `QA-P0-03` permanece resolvida somente em nivel de
contrato.
