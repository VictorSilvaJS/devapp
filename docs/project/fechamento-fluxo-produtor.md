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
