# Visão Geral de Arquitetura

## Objetivo deste documento

Registrar a visão técnica do projeto sem transformar hipóteses em verdades definitivas antes da hora.

## Princípios arquiteturais

- refletir o domínio real do negócio;
- suportar perfis de acesso distintos;
- permitir organização por produtor/fazenda/região;
- considerar operação em campo com conectividade ruim;
- separar claramente o que é implementado, o que está em estudo e o que é futuro.

## Capacidades técnicas centrais

A arquitetura precisa sustentar pelo menos:
- autenticação e autorização por perfil;
- modelagem de produtor, fazenda, mapas, arquivos, visitas e registros;
- consulta contextualizada por propriedade;
- suporte a materiais associados a mapas;
- operação offline mínima para consulta.

## Regra de governança técnica

Qualquer decisão arquitetural definitiva deve sair deste fluxo:

1. necessidade real do produto;
2. decisão registrada;
3. atualização em `decisoes-em-estudo.md` ou promoção para documento ativo.
