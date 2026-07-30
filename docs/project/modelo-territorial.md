# Modelo Territorial

> Status: `ATIVO`
>
> Definido em: 2026-07-30
>
> Origem: `MP-02` / `QA-P0-02` / `QA-P2-08`

## Objetivo

Este documento separa localizacao oficial de escopo operacional e define quem
pode alterar cada vinculo territorial.

Ele nao migra os campos legados, nao altera o motor atual de acesso e nao
implementa backend ou auditoria produtiva.

## Problema Confirmado

O mock atual mistura conceitos diferentes:

- `regiao` pode representar UF, macrorregiao ou agrupamento operacional;
- `microregiao` e `sub_regioes` podem conter area operacional, municipio ou
  rotulo demonstrativo;
- `vinculos_microregioes` preserva a mesma ambiguidade;
- o Colaborador consegue editar `regiao` no proprio Perfil e persistir a
  alteracao na sessao local;
- IDs gerados a partir de texto pelo `territorioCompat` sao compatibilidade
  visual, nao identificadores mestres.

Nomes como `Mato Grosso`, `MT - Norte`, `Sorriso` e
`Lucas do Rio Verde` nao devem ser reclassificados automaticamente. A migracao
exige mapeamento administrativo explicito.

## Conceitos Canonicos

### Localizacao Oficial

Localizacao responde onde a Propriedade esta.

| Conceito | Identificador | Regra |
|---|---|---|
| UF | codigo IBGE da UF e sigla | lista oficial controlada |
| Municipio | codigo IBGE do Municipio | pertence a uma UF |
| Propriedade | `propriedade_id` | referencia um Municipio oficial |

Campos recomendados:

- `uf_id`;
- `uf_sigla`;
- `municipio_id`;
- `municipio_nome` como snapshot de apresentacao;
- `propriedade_id`.

`cidade` e `estado` permanecem aliases legados durante a migracao. Uma
Propriedade rural continua pertencendo ao Municipio oficial do territorio,
mesmo quando estiver fora da area urbana.

Municipio e UF nao concedem acesso por si so.

### Escopo Operacional

Escopo operacional responde onde a equipe esta autorizada a atuar.

| Conceito | Identificador | Regra |
|---|---|---|
| Regional | `regional_id` | agrupamento operacional da organizacao |
| Area operacional | `area_operacional_id` | subdivisao opcional de uma Regional |
| Vinculo direto | `usuario_propriedade` | acesso a uma Propriedade especifica |

Campos textuais de nome servem para apresentacao. Autorizacao deve usar IDs e
vinculos ativos.

Uma Regional ou Area pode abranger varios Municipios. Um Municipio pode
participar de configuracoes operacionais diferentes conforme a organizacao,
sem deixar de ser a localizacao oficial da Propriedade.

## Entidades Futuras Minimas

### `ufs`

- `id_ibge`;
- `sigla`;
- `nome`;
- `status`.

### `municipios`

- `id_ibge`;
- `uf_id`;
- `nome`;
- `status`.

### `regionais`

- `id`;
- `organizacao_id`;
- `nome`;
- `status`.

### `areas_operacionais`

- `id`;
- `regional_id`;
- `nome`;
- `status`.

### `propriedades`

- `id`;
- `municipio_id`;
- `regional_id`;
- `area_operacional_id` opcional;
- aliases legados durante a migracao.

### `usuario_regional`

- `usuario_id`;
- `regional_id`;
- `status`;
- `vigente_de`;
- `vigente_ate` opcional;
- `origem`;
- metadados de auditoria.

### `usuario_area_operacional`

- `usuario_id`;
- `area_operacional_id`;
- `status`;
- `vigente_de`;
- `vigente_ate` opcional;
- `origem`;
- metadados de auditoria.

### `usuario_propriedade`

Mantem o contrato ja previsto para vinculo direto e aditivo com Propriedade.

## Regra De Acesso Futura

1. Admin autorizado possui o escopo administrativo definido pelo seu papel.
2. Produtor acessa por vinculo ativo com Propriedade/Titular.
3. Colaborador acessa por vinculo operacional ativo com Regional ou Area e,
   de forma aditiva, por vinculo direto ativo com Propriedade.
4. Municipio/UF nunca substituem vinculo operacional.
5. Vinculo com Area concede somente a Area vinculada.
6. Vinculo com Regional sem restricao de Area concede a Regional conforme a
   politica da organizacao.
7. Vinculo direto com Propriedade pode ampliar o escopo quando a politica
   permitir; nao reduz automaticamente o escopo regional.
8. Toda operacao deve revalidar perfil, vinculos ativos, acao e Propriedade no
   servidor.

O cliente pode ocultar acoes, mas nao e autoridade para calcular ou ampliar o
escopo produtivo.

## Autoridade De Alteracao

- Colaborador consulta os proprios vinculos, mas nao cria, edita ou remove
  Regional, Area operacional ou Propriedade atribuida.
- Produtor nao altera vinculos estruturais de Propriedade pelo proprio Perfil.
- Somente Admin com permissao explicita pode alterar vinculos territoriais.
- Alteracao administrativa exige justificativa.
- O backend deve recalcular o escopo e invalidar/revalidar sessoes afetadas.
- Autoedicao via tela, rota direta, payload manual ou cache deve ser recusada.

O MVP local deve remover a edicao livre de `regiao` do Perfil do Colaborador e
recusar campos territoriais enviados por `updateProfile`. Essa defesa reduz a
incoerencia local, mas nao representa autorizacao produtiva.

## Auditoria Obrigatoria

Cada alteracao futura deve registrar:

- `evento_id`;
- usuario afetado;
- autor administrativo;
- tipo e id do vinculo;
- valor anterior;
- valor novo;
- justificativa;
- data/hora do servidor;
- origem da operacao;
- resultado;
- correlacao com a sessao/requisicao.

Historico nao pode ser substituido por sobrescrita silenciosa.

## Solicitacao De Correcao

O Perfil deve apresentar os vinculos como somente leitura e orientar o usuario
a solicitar correcao.

O fluxo produtivo futuro deve:

1. receber motivo e descricao sem alterar o escopo;
2. registrar solicitante e data;
3. encaminhar para Admin autorizado;
4. permitir aprovacao ou rejeicao com justificativa;
5. aplicar eventual alteracao pelo fluxo administrativo auditado;
6. revalidar a sessao depois da decisao.

Enquanto nao houver backend/workflow, a interface local pode apenas orientar a
solicitacao. Ela nao deve exibir confirmacao falsa de pedido enviado.

## Compatibilidade E Migracao

Campos atuais preservados temporariamente:

- `regiao`;
- `microregiao`;
- `sub_regioes`;
- `vinculos_microregioes`;
- `propriedades_atribuidas`;
- `regioes_acesso`.

Regras de migracao:

- nao renomear texto legado como se ele provasse o conceito canonico;
- criar tabela de correspondencia revisada por Admin;
- registrar ambiguidades e itens sem correspondencia;
- emitir IDs canonicos novos sem remover os aliases antigos;
- executar leitura dupla durante a transicao;
- comparar o escopo calculado antes e depois;
- testar Admin, Colaborador e Produtor, inclusive rotas diretas;
- remover o legado somente depois da implementacao e da regressao produtiva.

O motor atual continua usando `sub_regioes` e fallback
`vinculos_microregioes`. `propriedades_atribuidas` continua visual/preparatorio
no mock. Mudar essa regra pertence a `MP-35`.

## Criterios De Aceite Da MP-02

1. Municipio/UF e Regional/Area possuem conceitos e IDs distintos no contrato.
2. Localizacao oficial nao concede permissao.
3. Campos legados permanecem classificados como ambiguos e temporarios.
4. Perfil do Colaborador nao permite editar `regiao`.
5. A acao local de autoedicao recusa campos territoriais mesmo fora da tela.
6. Perfil apresenta escopo legado como consulta e orienta solicitar correcao.
7. Nenhum mock, seed ou motor de acesso e reinterpretado silenciosamente.
8. Backend futuro restringe alteracao a Admin autorizado e audita antes/depois.
9. Mudanca administrativa revalida sessoes e escopo.
10. Testes cobrem payload territorial direto e preservacao da edicao comum.

## Dependencias E Limites

O fechamento produtivo depende de:

- backend e banco;
- IDs mestres de UF/Municipio, Regional e Area;
- vinculos persistidos;
- autorizacao administrativa por acao;
- auditoria;
- revalidacao/revogacao de sessao;
- migracao dos campos legados;
- testes negativos de API e rota direta.

Essas dependencias pertencem a `MP-35 — Escopo territorial no backend`. Ate
essa tarefa ser concluida, a protecao permanece local e contratual.
