# Nomenclatura Oficial

> Revisão documental: 2026-08-10

## Termos de produto

| Termo | Significado |
|---|---|
| Propriedade | Unidade operacional central vista pelo usuário |
| Produtor | Perfil final que consulta sua realidade operacional |
| Titular | Produtor responsável principal por uma Propriedade |
| Colaborador | Usuário operacional com vínculos diretos a Propriedades |
| Administrador | Perfil global dentro da organização |
| Vínculo | Relação explícita entre Usuário e Propriedade |
| Talhão | Subdivisão interna da Propriedade |
| Período produtivo | Contexto de Safra ou Safrinha |
| Material técnico | Arquivo técnico ligado a Propriedade e contexto aplicável |
| Município e UF | Localização e filtro; nunca fonte de permissão |

## Valores internos de perfil

- admin
- colaborador
- produtor

Não use cliente ou proprietário como nome novo do perfil. Proprietário pode
aparecer em dado legado, mas Titular é o termo cadastral vigente.

## Identificadores canônicos

Novos contratos e escritas usam:

- propriedade_id;
- titular_id;
- usuario_id;
- talhao_id;
- material_id;
- visita_id;
- caderno_id.

O servidor produtivo deve gerar identificadores opacos.

## Compatibilidade legada

Nomes como fazenda_id, fazendaId, produtor_id, proprietário_id e componentes
com Fazenda ainda existem em bordas do código. Eles podem ser lidos por
adaptadores de compatibilidade, mas não devem ser introduzidos em contrato ou
escrita nova.

Quando uma tela ainda depender de dado legado, prefira os resolvers de
src/utils/propriedadeCompat.ts e registre explicitamente que se trata de uma
borda de migração.

## Território e acesso

Regional, Área Operacional, Região, Microrregião, sub_regioes e
vinculos_microregioes são legado do mock v1. O runtime v2 e o futuro backend
autorizam o Colaborador somente por usuario_propriedade ativo.

Município e UF podem ajudar na seleção administrativa em lote. A seleção deve
materializar vínculos individuais; o filtro nunca vira permissão implícita.

## Regras de escrita

- Textos visíveis e documentos ativos usam Propriedade.
- Arquivo, rota ou componente novo usa nome baseado em Propriedade.
- Contrato novo usa propriedade_id.
- Alias legado só aparece em adaptador claramente identificado.
- Remoção de legado exige teste de rotas, storage, mapas, Visitas, Caderno e
  permissões afetadas.

## Materiais e cadastros

O contrato de anexos está em
[modelo-material-tecnico.md](modelo-material-tecnico.md).

O contrato de entidades e vínculos está em
[modelo-dados-mock-v2.md](modelo-dados-mock-v2.md).

As regras de acesso estão em
[regras-de-negocio.md](regras-de-negocio.md) e
[matriz-rbac-backend.md](matriz-rbac-backend.md).
