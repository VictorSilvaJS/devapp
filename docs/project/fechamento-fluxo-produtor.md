# Fechamento Do Fluxo Do Produtor

Status em 2026-05-27: o fluxo do produtor foi validado manualmente no MVP visual/mockado apos a consolidacao da nomenclatura oficial de produto.

## Contexto

A decisao documental consolidou `Propriedade` como termo oficial de interface e produto, mantendo `fazenda_id`, rotas, arquivos, contratos e nomes tecnicos legados por compatibilidade interna.

Este fechamento registra apenas a experiencia visivel do produtor no app. Nao representa implementacao de backend, upload, storage, pipeline produtivo, permissao nova ou refatoracao de modelagem.

## Fluxo Validado

O teste manual validou:

- login como produtor
- entrada em `Minhas Propriedades`
- abertura da propriedade
- detalhe da propriedade
- mapa dos talhoes
- anexos de fertilidade
- visitas tecnicas
- caderno de campo
- mensagens vazias
- nomenclatura visivel usando `Propriedade`

## Resultado

O fluxo passou no teste manual do MVP visual/mockado.

O produtor consegue percorrer a experiencia principal de consulta da propria propriedade, acessando detalhe, mapa dos talhoes, anexos de fertilidade, visitas tecnicas e caderno de campo com linguagem de interface alinhada a decisao oficial.

## Limites Do Fechamento

Continuam fora deste fechamento:

- backend real
- autenticacao real
- upload real
- storage local gerenciado ou remoto
- pipeline produtivo de importacao/publicacao de arquivos
- cadastro administrativo persistente de anexos
- refatoracao interna de `fazenda` para `propriedade`
- alteracao de permissoes
- alteracao de modelagem

## Compatibilidade Tecnica Mantida

Permanecem temporariamente por compatibilidade:

- `fazenda_id`
- `fazendaId`
- `getFazendaId`
- nomes de rotas como `FazendaMapa`
- nomes de arquivos e componentes legados
- contratos e campos internos legados

Esses nomes nao devem guiar a linguagem de produto, mas tambem nao devem ser renomeados sem uma fase tecnica separada.

## Complemento Pos-Revisao: Fluxo Do Colaborador

Status em 2026-05-27: apos o fechamento do fluxo do produtor, foi concluida e revisada tecnicamente uma microfase de ajustes finais no fluxo do colaborador para teste manual interno do MVP visual/mockado.

Login principal de teste:

- `carlos@agrotche.com`
- senha: `colab123`

O colaborador acessa:

- Home
- Propriedades
- Visitas
- Caderno
- Perfil

A superficie visivel do fluxo favorece `Propriedades`, preservando nomes internos legados como `fazenda`, `fazendaId`, `fazenda_id`, rotas, arquivos e contratos tecnicos.

## Visitas No Fluxo Do Colaborador

O colaborador consegue criar visita por dois caminhos:

- fluxo global: Visitas -> Nova Visita
- contexto da propriedade: Propriedade -> Visitas Tecnicas -> Nova Visita

No fluxo contextual, `NovaVisitaScreen` aceita `fazendaId` opcional por rota, pre-seleciona a propriedade correspondente e trava a selecao para deixar claro que a propriedade foi definida pelo contexto.

No fluxo global, `NovaVisitaScreen` permanece com o seletor normal de propriedade.

A criacao de visita continua respeitando escopo regional/sub-regional. Colaborador fora do escopo da propriedade permanece bloqueado.

## Material Tecnico Mockado

O fluxo de mapas passa a tratar o conceito visivel como `Material Tecnico`.

Nesta fase, Material Tecnico e apenas mock/prototipo visual. O arquivo e entendido como recurso anexado ao material, mas nao existe:

- upload real
- backend
- storage local gerenciado ou remoto
- integracao com Drive
- cadastro real persistente
- pipeline de mapas
- nova modelagem

Os empty states de mapas foram ajustados para diferenciar:

- ausencia de demarcacao/talhoes no mock
- ausencia de anexos ou materiais tecnicos disponiveis

## Fora Do Escopo Mantido

Continuam fora desta microfase:

- backend
- upload real
- storage
- Drive
- pipeline produtivo de mapas
- nova modelagem
- permissoes complexas novas
- renomeacao interna de `fazenda_id`, `fazenda`, rotas, arquivos ou contratos legados

## Validacoes Da Microfase Colaborador

As validacoes tecnicas executadas apos a revisao passaram:

- `npm run typecheck`
- `npm run test:domain-compat`
- `git diff --check`

No Windows, `git diff --check` pode emitir apenas avisos normais de LF/CRLF.
