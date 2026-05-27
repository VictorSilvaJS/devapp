# AGENTS.md

Guia operacional para agentes de codigo neste repositorio.

Este arquivo e o ponto de entrada rapido. As regras completas ficam em
`docs/project/instrucoes-para-ia.md`.

## Objetivo

Manter o projeto evoluindo com contexto controlado, escopo claro,
implementacao verificavel e separacao entre estado atual, historico,
hipoteses e pendencias.

## Primeira Leitura Obrigatoria

Antes de propor ou executar mudancas relevantes, leia nesta ordem:

1. `docs/project/instrucoes-para-ia.md`
2. `docs/README.md`
3. `docs/project/estado-atual.md`
4. `docs/project/contexto-consolidado.md`
5. `docs/project/escopo-mvp.md`
6. `docs/project/regras-de-negocio.md`
7. `docs/project/decisoes-consolidadas.md`
8. `docs/project/pendencias-de-definicao.md`

Use `docs/architecture/`, `docs/guides/` e `docs/testing/` apenas como apoio
subordinado ao nucleo ativo em `docs/project/`.

Use `docs/reviews/` e `docs/archive/` somente como contexto historico ou
evidencia auxiliar. Eles nao definem estado atual sem confirmacao nos
documentos ativos ou no codigo.

## Protocolo De Trabalho

### 1. Planejar

Para cada tarefa, delimite:

- objetivo da mudanca
- arquivos provaveis
- documentos ativos que sustentam a decisao
- pendencias que bloqueiam ou limitam a implementacao
- comandos de validacao aplicaveis

O planejamento deve funcionar como uma spec minima da tarefa:

- contexto
- comportamento esperado
- criterios de aceite
- fora de escopo
- validacao final

Se a tarefa estiver ambigua, prefira uma proposta pequena e reversivel.

### 2. Executar

Implemente apenas o necessario para a tarefa atual.

Preserve:

- `Propriedade` como termo oficial de produto para a unidade operacional vista pelo usuario
- `Produtor` como usuario/perfil final
- `Titular` como responsavel cadastral ou vinculo principal da propriedade
- `Talhao` como subdivisao interna da propriedade
- `fazenda_id` como contexto operacional interno temporario quando o dado pertence a uma propriedade
- escopo regional do colaborador
- produtor como perfil de consulta da propria realidade operacional
- MVP focado em consulta organizada, mapas, visitas, caderno e uso em campo

Nao promova ideias de `docs/archive/`, `docs/reviews/` ou `docs/ideas/` para
codigo sem uma decisao explicita em `docs/project/`.

### 3. Revisar

Antes de encerrar uma tarefa, revise o diff procurando:

- regressao de regra de acesso
- quebra de contexto de propriedade
- ampliacao indevida de escopo
- dependencia em comportamento mock tratado como se fosse produto final
- documentacao ativa desatualizada
- teste ou smoke necessario que ficou sem cobertura

Quando houver agentes paralelos, use preferencialmente:

- agente mais forte para planejamento e revisao
- agente executor para mudancas bem delimitadas
- uma revisao final independente antes de considerar a tarefa pronta

### 4. Validar

Comandos disponiveis:

```powershell
npm run typecheck
npm run test:domain-compat
```

Use `docs/project/smoke.md` para validacao manual de fluxos funcionais quando
a mudanca tocar visitas, caderno, propriedade, permissao, rotas diretas ou
contexto de `fazenda_id`.

Se um teste falhar:

1. registre a falha especifica
2. corrija o menor ponto responsavel
3. reexecute a mesma validacao
4. documente a descoberta se ela representar regra, pendencia ou risco novo

## Controle De Contexto

Trabalhe com uma tarefa por conversa ou sessao de agente sempre que possivel.

Se o contexto ficar grande, produza um resumo operacional antes de continuar:

- objetivo
- decisoes tomadas
- arquivos alterados
- testes executados
- pendencias restantes

Evite carregar documentos historicos extensos sem necessidade. Priorize a
trilha ativa e abra documentos complementares apenas quando eles forem
relevantes para a tarefa.

## Criterio De Pronto

Uma tarefa so deve ser considerada pronta quando:

- a mudanca respeita os documentos ativos
- o codigo ou documento alterado esta consistente com o estado atual
- as pendencias reais continuam registradas em `pendencias-de-definicao.md`
- as validacoes aplicaveis foram executadas ou a impossibilidade foi explicada
- o resultado final informa o que mudou, onde mudou e como foi verificado
