# Núcleo Ativo do Projeto

> Revisão documental: 2026-08-27

Esta pasta contém somente documentos que descrevem o projeto como ele é hoje ou
contratos aprovados, estejam eles implementados ou reservados para um corte
futuro autorizado.

## Leitura rápida

Para entender o projeto sem percorrer o histórico, leia:

1. [Estado atual](estado-atual.md)
2. [Próximos passos](proximos-passos.md)
3. [Pendências reais](pendencias-de-definicao.md)
4. [Smoke funcional](smoke.md)

## Leitura de produto e domínio

- [Contexto consolidado](contexto-consolidado.md): problema, usuários e propósito.
- [Escopo do MVP](escopo-mvp.md): o que pertence e o que não pertence ao corte atual.
- [Regras de negócio](regras-de-negocio.md): comportamento e permissões.
- [Decisões consolidadas](decisoes-consolidadas.md): decisões vigentes.
- [Nomenclatura oficial](nomenclatura-oficial.md): termos visíveis e técnicos.

## Contratos técnicos vigentes

- [Baseline do backend v1](baseline-backend-v1-2026-08.md)
- [Operação do backend](../../backend/README.md)
- [Modelo de dados canônico v2](modelo-dados-mock-v2.md)
- [Dataset demonstrativo v2](dataset-demonstrativo-v2.md)
- [Modelo territorial](modelo-territorial.md)
- [Matriz de RBAC](matriz-rbac-backend.md)
- [Contrato de API e RBAC](contrato-api-rbac.md)
- [Testes de contrato da API](testes-contrato-api-rbac.md)
- [Política de sessão](politica-sessao.md)
- [Contrato de autenticação e recuperação da MP-33B](contrato-autenticacao-mp33b.md)
- [Contrato de integração do aplicativo da MP-33C](contrato-integracao-app-mp33c.md)
- [Contrato de convergência da interface Demo/HTTP](contrato-convergencia-interface-http.md)
- [Contrato de notificações](contrato-notificacoes.md)
- [Contrato de administração da MP-35](contrato-administracao-mp35.md)
- [Ciclo de vida do Caderno](ciclo-vida-caderno.md)
- [Estados de Visita](estados-visita.md)
- [Modelo de Material técnico](modelo-material-tecnico.md)
- [Versionamento de GeoJSON e Talhões](versionamento-geojson-talhoes.md)

## Dados gerados

A pasta [generated](generated/) contém evidência derivada do dataset
demonstrativo. Ela não substitui o seed executável nem o código.

## Regra de manutenção

- Atualize estado-atual.md quando a fotografia do projeto mudar.
- Atualize proximos-passos.md quando uma etapa começar ou terminar.
- Mantenha em pendencias-de-definicao.md somente itens realmente abertos.
- Registre decisões novas em decisoes-consolidadas.md.
- Mova relatórios de fase e revisões concluídas para docs/archive.
- Não use conteúdo arquivado como fonte de verdade sem confirmação no código
  e neste núcleo ativo.
