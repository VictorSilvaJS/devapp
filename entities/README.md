# Schemas Legados de Entidades

Os arquivos JSON desta pasta são referências históricas da primeira API mock.
Eles não são a fonte canônica do runtime v2 nem o modelo aprovado para o
backend.

Alguns schemas ainda usam termos e relações antigas, como cliente, produtor_id
ou Fazenda. Não copie esses campos para contrato novo.

Fontes vigentes:

- [Modelo de dados v2](../docs/project/modelo-dados-mock-v2.md)
- [Baseline do backend v1](../docs/project/baseline-backend-v1-2026-08.md)
- [Contrato de API e RBAC](../docs/project/contrato-api-rbac.md)

Mantenha esta pasta somente enquanto houver uso verificável ou necessidade de
compatibilidade. Uma remoção futura deve confirmar primeiro que código, scripts
e testes não consomem os schemas.
