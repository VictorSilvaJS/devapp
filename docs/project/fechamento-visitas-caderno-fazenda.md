# Fechamento Da Frente Visitas E Caderno Por Propriedade

Status em 2026-05-19: a frente funcional de visitas tecnicas por propriedade e caderno de campo por propriedade foi validada no nivel necessario para o MVP atual. Internamente, o fluxo ainda preserva `fazenda_id` como chave tecnica.

Este documento registra o fechamento operacional da frente apos execucao do smoke manual descrito em `docs/project/smoke.md`.

## Resultado Do Smoke

- Todos os casos `S-01` a `S-31` passaram.
- Todos os fluxos `E2E-01` a `E2E-05` passaram.
- O comando `npm run typecheck` passou sem erros apos os ajustes.
- O criterio de encerramento definido no smoke foi atendido.

## Alteracoes Necessarias Durante A Validacao

### Checklist De Smoke

O arquivo `docs/project/smoke.md` foi atualizado com:

- status real de cada caso executado;
- observacao curta de evidencia para cada validacao;
- registro dos fluxos E2E cobertos diretamente ou por combinacao dos casos manuais.

### Painel Temporario De Smoke

Foi adicionado um painel `Smoke Dev` em `src/screens/PerfilScreen.tsx`.

Objetivo:

- permitir teste rapido de rotas diretas;
- simular tentativas de acesso fora da navegacao normal;
- validar casos de permissao defensiva para produtor, colaborador e admin.

Rotas cobertas pelo painel:

- `NovaVisita`;
- `EditarVisita`;
- `VisitaDetail`;
- `CadernoDetail`;
- `EditarCaderno`;
- `NovoCaderno`;
- `ProdutorDetail`.

O painel esta protegido por `__DEV__`, portanto aparece apenas em ambiente de desenvolvimento.

Decisao operacional atual:

- manter o painel `Smoke Dev` enquanto a estabilizacao do MVP ainda estiver em andamento;
- remover antes de uma entrega formal, build de demonstracao externa ou publicacao;
- ponto de remocao: `src/screens/PerfilScreen.tsx`, bloco `smokeRoutes` e secao visual `Smoke Dev`.

### Bloqueio Visual Em Novo Caderno

Arquivo ajustado: `src/screens/NovoCadernoScreen.tsx`.

Problema encontrado:

- ao abrir `NovoCaderno` por rota direta com uma propriedade sem permissao, o formulario aparecia rapidamente antes da tela de bloqueio.

Ajuste aplicado:

- enquanto as propriedades autorizadas carregam, a tela mostra estado de carregamento;
- se a propriedade da rota nao for permitida, a tela vai para `Acesso restrito` sem exibir o formulario antes.

Impacto:

- a permissao ja bloqueava funcionalmente;
- o ajuste removeu o vazamento visual temporario e deixou a experiencia mais defensiva.

### Recarregamento Do Detalhe Da Propriedade

Arquivo ajustado: `src/screens/ProdutorScreen.tsx`.

Problema encontrado:

- ao criar um caderno pela aba Caderno da propriedade, o registro era salvo e o detalhe abria, mas ao voltar para a propriedade a aba podia continuar com a lista antiga.

Ajuste aplicado:

- o detalhe da propriedade recarrega seus dados sempre que a tela recebe foco e existe `id` na rota.

Impacto:

- registros criados pela aba Caderno passam a aparecer corretamente quando o usuario volta para o detalhe da propriedade.

## Validacoes Consolidadas

### Permissoes E Escopo

- Produtor nao cria visita, nem por rota direta.
- Produtor nao edita visita, nem por rota direta.
- Produtor nao acessa caderno restrito.
- Produtor nao acessa caderno de outra propriedade.
- Produtor nao cria caderno em propriedade de outro titular.
- Colaborador nao acessa visita fora do escopo regional.
- Colaborador nao acessa caderno fora do escopo regional.
- Admin acessa registros restritos quando esperado.
- Colaborador acessa registros dentro do escopo quando esperado.

### Integridade De Contexto

- Edicao de visita preserva a propriedade vinculada.
- Edicao de caderno preserva a propriedade vinculada.
- Campos de propriedade em edicao aparecem travados.
- Criacao de visita salva no contexto da propriedade selecionada.
- Criacao de caderno salva no contexto da propriedade selecionada.
- Criacao de caderno pela aba da propriedade nasce no contexto da propriedade atual.

### Integracao No Detalhe Da Propriedade

- Aba Caderno mostra registros da propriedade atual.
- Aba Caderno respeita visibilidade para produtor.
- Novo registro criado pela aba aparece na aba da propriedade apos retorno.
- Produtor ve apenas registros visiveis.

## Decisao Pendente Para Produto

O caso `S-30` passou por rota direta: produtor consegue abrir o detalhe de uma visita propria.

Ponto ainda nao decidido:

- o produtor deve ter um caminho visual claro na interface para acessar detalhes de visitas?

Opcoes futuras:

- criar uma entrada de visitas dentro de `Minhas Propriedades`;
- criar uma secao de visitas dentro do detalhe da propriedade;
- manter visitas do produtor apenas como historico resumido, sem detalhe exposto na navegacao principal.

Essa decisao nao bloqueia o fechamento MVP desta frente, porque a permissao e o detalhe funcionam quando acessados por rota valida.

## Pendencias Futuras Fora Do Fechamento

- Remover o painel `Smoke Dev` antes de uma entrega formal, build de demonstracao externa ou publicacao.
- Automatizar testes de permissao e preservacao de `fazenda_id`.
- Implementar backend real.
- Implementar autenticacao real.
- Implementar upload/anexos/fotos reais.
- Evoluir sincronizacao offline real.
- Decidir a experiencia final de visitas para produtor.

## Conclusao

A frente de visitas tecnicas por propriedade e caderno de campo por propriedade pode ser considerada encerrada no nivel MVP.

O fluxo esta validado para admin, colaborador e produtor, incluindo bloqueios por rota direta, escopo regional, preservacao de `fazenda_id`, visibilidade de caderno para produtor e criacao contextual a partir do detalhe da propriedade.
