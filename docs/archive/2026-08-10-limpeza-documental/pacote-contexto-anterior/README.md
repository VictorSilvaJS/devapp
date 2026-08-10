# Pacote de Documentação Estruturada — Projeto Tchê

Este pacote organiza o histórico e o estado operacional do projeto para uso conjunto com IA, Codex e acompanhamento de fases.

## Regra de leitura

1. `docs/project/` = fonte operacional atual do projeto.
2. `docs/product/` = decisões de produto, perfis e experiência.
3. `docs/architecture/` = visão técnica atual e pontos em estudo.
4. `docs/ideas/` = hipóteses, possibilidades e módulos futuros.
5. `docs/archive/` = contexto histórico. Não tratar como verdade atual sem confirmação.

## Ordem recomendada para IA / Codex

1. `docs/project/estado-atual.md`
2. `docs/project/contexto-consolidado.md`
3. `docs/project/escopo-mvp.md`
4. `docs/project/regras-de-negocio.md`
5. `docs/project/decisoes-consolidadas.md`
6. `docs/project/pendencias-de-definicao.md`
7. `docs/product/perfis-de-acesso.md`
8. `docs/product/navegacao-e-experiencia.md`
9. `docs/product/mapas-e-categorias.md`
10. `docs/product/caderno-de-campo.md`
11. `docs/architecture/visao-geral.md`
12. `docs/architecture/integracoes-e-mapas.md`
13. `docs/architecture/offline-e-sincronizacao.md`
14. `docs/architecture/decisoes-em-estudo.md`
15. `docs/ideas/hipoteses-tecnicas.md`
16. `docs/ideas/modulos-futuros.md`
17. `docs/archive/` somente como apoio histórico.

## Regra principal

- Reuniões, propostas, transcrições e protótipos = evidência histórica.
- Documento ativo = fonte para execução.
- Quando houver conflito, vale o documento ativo mais recente.
- Quando um ponto não estiver confirmado, marcar como `incerto` ou `em estudo`.

## Como usar com Codex

Cole no prompt inicial algo como:

> Leia primeiro `README.md` e todos os arquivos em `docs/project/`. Trate `docs/archive/` apenas como histórico. Não assuma como implementado nada que esteja em `docs/ideas/` ou `docs/archive/`.
