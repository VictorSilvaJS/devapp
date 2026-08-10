# Checklist Para Propor Implementacao

Antes de propor ou executar implementacao relevante, leia:

1. `AGENTS.md`
2. `docs/project/instrucoes-para-ia.md`
3. `docs/README.md`
4. documentos ativos de `docs/project/` relacionados a tarefa

Depois registre, de forma objetiva:

1. quais documentos ativos sustentam a proposta
2. qual e o objetivo exato da tarefa
3. quais arquivos ou areas devem ser afetados
4. quais restricoes de dominio se aplicam
5. se existe pendencia de definicao que bloqueia ou limita a implementacao
6. quais comandos, testes ou smoke devem validar a mudanca

## Spec curta da tarefa

Use este bloco como base antes de implementar:

```text
Contexto:
Objetivo:
Comportamento esperado:
Criterios de aceite:
Fora de escopo:
Arquivos/areas afetadas:
Validacao:
Pendencias ou riscos:
```

## Regra pratica

Se a proposta depender apenas de documento historico, ideia futura, revisao antiga
ou comportamento mock nao consolidado, nao implemente como verdade do produto.

Nesse caso:

- aponte a origem da informacao
- confira se existe sustentacao em `docs/project/`
- promova para decisao, regra ou pendencia apenas se houver definicao explicita

## Fechamento esperado

Ao finalizar a tarefa, informe:

- o que mudou
- onde mudou
- como foi validado
- quais riscos ou pendencias permanecem
