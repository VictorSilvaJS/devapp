# Auditoria de Compatibilidade de `fazenda_id` — 2026-08-06

> Status: CONCLUÍDA SEM REMOÇÃO
>
> Base auditada: commit `b3a5768`
>
> Escopo: inventariar e classificar os identificadores legados ligados a
> Propriedade, especialmente `fazenda_id`, sem alterar o comportamento do app.

## 1. Objetivo

Esta auditoria identifica onde a compatibilidade legada ainda é necessária,
onde ela já funciona apenas como leitura de borda e quais pontos podem ser
migrados depois. Ela não autoriza apagar campos, renomear rotas, modificar
storages ou reparar problemas encontrados.

O contrato canônico continua sendo:

- `propriedade_id` para o contexto operacional da Propriedade;
- `titular_id` para o Produtor Titular principal;
- `talhao_id` para a subdivisão interna;
- nenhum alias `fazenda*` gravado no snapshot v2.

## 2. Método e alcance

Foram cruzados os documentos ativos, os contratos, adaptadores, telas,
serviços, rotas, fixtures e testes. A busca textual encontrou:

- 435 ocorrências exatas de `fazenda_id` em 94 arquivos não documentais;
- aliases da família `fazenda*` em 73 arquivos de `src/` e 52 arquivos de
  testes;
- maior concentração em telas, serviços, utilitários, API e navegação.

Esses números medem referências textuais. Eles não representam 435 alterações
nem autorizam substituição mecânica: várias ocorrências são testes de
compatibilidade, leitores de dados antigos ou fronteiras deliberadas.

Esta entrega cobre somente a parte de identificadores do item `PRE-06`. O
inventário e o mapeamento dos valores territoriais legados continuam fora do
escopo e, portanto, `PRE-06` não está concluído integralmente.

## 3. Classificação

| Superfície | Situação encontrada | Decisão desta auditoria | Condição para remoção futura |
|---|---|---|---|
| Snapshot e validação v2 | O seed demonstrativo usa `propriedade_id`; o validador rejeita aliases e a persistência remove aliases antes da gravação | Não admitir `fazenda_id` no v2 | Manter os testes de ausência de aliases e restaurar primeiro o contrato TypeScript v2 |
| Contratos e adaptadores de borda | `contracts.ts`, `domainCompat.ts`, `propriedadeCompat.ts`, `mockCompat.ts` e `produtorCompat.ts` fazem leitura dupla e projetam o v2 para consumidores antigos | Manter temporariamente | Todos os consumidores precisam ler o contrato canônico e os dados locais antigos precisam estar migrados ou descartados de forma controlada |
| Controle de acesso | O acesso normaliza registros para Propriedade, mas helpers e entradas ainda aceitam `fazenda_id`/`fazendaId` | Manter; risco funcional alto | Validar Admin, Colaborador e Produtor, inclusive rotas diretas e registros com aliases conflitantes |
| Visitas | Novos payloads usam `propriedade_id`; rotas, variáveis e eventos de ciclo de vida ainda leem ou nomeiam aliases antigos | Manter leitura de borda | Migrar rotas e eventos, depois executar testes de criação, edição, conclusão, correção e acesso |
| Caderno | Novos payloads usam `propriedade_id`; rotas e eventos de ciclo de vida ainda preservam aliases | Manter leitura de borda | Migrar rotas e eventos, depois executar testes de criação, edição, confirmação, complemento, correção e acesso |
| Navegação, filtros e interface | Builders novos já priorizam `propriedadeId`, mas parâmetros antigos, nomes de tela e propriedades de contexto continuam aceitos | Candidato a migração posterior | Todos os chamadores e links diretos precisam emitir o nome canônico antes de retirar a leitura antiga |
| Mapas, cache, offline e sincronização | Modelos, chaves, metadados, backups, importação e endpoints simulados ainda usam amplamente `fazenda_id` | Manter; maior migração pendente | Criar versão de storage/chaves, migrar índices e backups, manter importação compatível e validar rollback/cache |
| Índices locais de materiais e importações | GeoJSON, PNG, ZIP, material técnico e período produtivo aceitam `fazenda_id` na leitura, normalizam e gravam `propriedade_id` nas operações novas | Manter apenas a leitura temporária | Confirmar migração ou limpeza dos índices v1 já instalados e encerrar uma janela explícita de compatibilidade |
| Fixtures, assets e scripts | Há dados históricos e geradores ainda baseados no identificador antigo | Não promover ao contrato produtivo | Migrar geradores e assets usados pelo runtime; manter histórico apenas como evidência identificada |
| Testes | Há testes de legado, de compatibilidade e testes canônicos que proíbem aliases no v2 | Não renomear em massa | Atualizar cada grupo junto com a respectiva superfície de produção |

## 4. Achados críticos

### P0 — contrato v2 vazio — resolvido em 2026-08-06

`src/domain/contractsV2.ts` tem zero bytes na base auditada. Como consequência,
o TypeScript não encontra `MockV2State`, `ORGANIZACAO_TCHE_ID` e os demais
tipos v2, produzindo erros também nos módulos de bootstrap, persistência,
runtime e validação.

Isso foi identificado como uma regressão de base independente da auditoria.
Em tarefa posterior autorizada, o contrato foi restaurado a partir da versão
imediatamente anterior e conferido com `modelo-dados-mock-v2.md`. Nenhum mock,
snapshot ou registro instalado foi revertido. O typecheck e os testes de
compatibilidade voltaram a passar.

### P1 — precedência ambígua no acesso

`src/utils/acessoControle.ts` ainda possui resolução que pode priorizar
`fazenda_id` sobre o identificador canônico quando ambos aparecem. Um registro
com IDs divergentes pode ser incluído ou excluído do escopo incorretamente.
A migração futura precisa definir `propriedade_id` como fonte autoritativa e
testar explicitamente o conflito antes de retirar o fallback.

### P1 — mapas e armazenamento offline

A superfície de mapas não contém apenas nomes antigos: `fazenda_id` participa
de contratos, chaves de cache, arquivos, metadados, backups, importação e
sincronização simulada. Uma troca textual apagaria a capacidade de ler dados
instalados. Essa área exige migração versionada própria.

### P1 — eventos internos de Visitas e Caderno

Eventos de ciclo de vida ainda registram contexto como `fazenda_id`, enquanto
a sanitização do snapshot v2 remove aliases recursivamente. Antes de considerar
o histórico canônico, os schemas desses eventos devem passar a usar
`propriedade_id`; apenas remover o campo antigo pode eliminar contexto do
evento.

## 5. Ordem segura para uma implementação futura

1. Restaurar `contractsV2.ts` e obter uma linha de base com TypeScript verde.
   Concluído em 2026-08-06.
2. Tornar nomes internos, builders e saídas de rota canônicos, preservando a
   leitura dos aliases na borda.
3. Migrar os eventos de Visitas e Caderno para `propriedade_id`.
4. Criar migração versionada para mapas, cache, backups, índices e arquivos
   offline.
5. Validar os três perfis e todos os fluxos do `smoke.md`.
6. Retirar fallbacks somente quando não houver consumidor nem dado local v1
   dependente deles.

## 6. Resultado e evidências

Resultado desta tarefa:

- nenhum campo legado foi removido;
- nenhum contrato, fluxo, storage ou teste de aplicação foi alterado;
- `fazenda_id` continua permitido somente como compatibilidade temporária;
- novas entidades e gravações v2 continuam obrigadas a usar
  `propriedade_id`;
- o bloqueio P0 encontrado durante a auditoria foi reparado posteriormente,
  sem iniciar a remoção dos aliases.

Validações executadas:

- inventário com `rg`: concluído;
- ausência dos aliases `fazenda_id`, `fazendaId`, `fazenda_nome` e
  `fazendaNome` em `src/api/generated/mockV2DemoSeed.json`: confirmada;
- na auditoria inicial, `npx tsc --noEmit --pretty false` falhou devido ao
  arquivo `src/domain/contractsV2.ts` vazio;
- após o reparo autorizado, `npm run typecheck` passou;
- após o reparo autorizado, `npm run test:domain-compat` passou integralmente.
