# AGENTS.md

Guia operacional para agentes de código neste repositório.

As regras completas estão em
[instruções para IA](docs/project/instrucoes-para-ia.md).

## Leitura obrigatória

Antes de uma mudança relevante, leia nesta ordem:

1. docs/project/instrucoes-para-ia.md
2. docs/README.md
3. docs/project/README.md
4. docs/project/estado-atual.md
5. docs/project/contexto-consolidado.md
6. docs/project/escopo-mvp.md
7. docs/project/regras-de-negocio.md
8. docs/project/decisoes-consolidadas.md
9. docs/project/pendencias-de-definicao.md
10. docs/project/proximos-passos.md

Quando a tarefa tocar backend, banco, sessão, API ou RBAC, leia também:

- docs/project/baseline-backend-v1-2026-08.md
- o contrato técnico específico listado em docs/project/README.md

Use docs/archive apenas como histórico ou evidência. Um documento arquivado
nunca prevalece sobre o código e o núcleo ativo.

## Planejamento mínimo

Antes de editar, delimite:

- contexto e objetivo;
- comportamento esperado;
- critérios de aceite;
- fora de escopo;
- arquivos prováveis;
- decisões e contratos aplicáveis;
- pendências que limitam a tarefa;
- validação final.

Se houver ambiguidade, prefira uma proposta pequena e reversível.

## Regras que devem ser preservadas

- Propriedade é a unidade operacional e o termo oficial de produto.
- Produtor é o perfil final.
- Titular é o responsável principal da Propriedade.
- Talhão é a subdivisão interna da Propriedade.
- Novos contratos usam propriedade_id.
- fazenda_id permanece somente em bordas de compatibilidade já existentes.
- Administrador é global dentro da única organização.
- Colaborador acessa por vínculo direto e ativo com Propriedade.
- Município e UF são localização e filtro; não concedem acesso.
- Produtor consulta sua própria realidade e não administra estrutura geral.
- O MVP local não comprova segurança, persistência ou auditoria produtivas.

Não promova ideia arquivada para código sem uma decisão explícita no núcleo
ativo.

## Execução e revisão

Implemente somente o necessário para a tarefa atual. Antes de encerrar, procure:

- regressão de acesso;
- quebra de contexto de Propriedade;
- ampliação indevida de escopo;
- mock apresentado como produto real;
- compatibilidade legada introduzida em escrita nova;
- documentação ativa desatualizada;
- teste ou smoke ausente.

## Validação

Para mudanças de código:

- npm run typecheck
- npm run test:domain-compat

Execute testes focados adicionais e use docs/project/smoke.md quando a mudança
tocar fluxo funcional, acesso, rotas diretas, Visitas, Caderno, Propriedade,
mapas, mídia ou compatibilidade.

Para mudanças somente documentais:

- git diff --check
- validação de links locais
- revisão de consistência com o código e os contratos

Se um teste falhar:

1. registre a falha específica;
2. corrija o menor ponto responsável;
3. reexecute a mesma validação;
4. registre regra, risco ou pendência nova quando necessário.

## Critério de pronto

Uma tarefa está pronta quando:

- respeita o núcleo ativo;
- código e documentação estão coerentes;
- pendências reais continuam registradas;
- validações aplicáveis foram executadas ou justificadas;
- o fechamento informa o que mudou, onde e como foi verificado.
