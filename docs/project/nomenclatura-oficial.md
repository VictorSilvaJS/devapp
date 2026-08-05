# Nomenclatura Oficial

Este documento resume a linguagem oficial de produto para evitar ambiguidade durante a estabilizacao de nomes. Ele complementa `estado-atual.md`, `regras-de-negocio.md` e `decisoes-consolidadas.md`.

## Termos Principais

- `Propriedade`: unidade operacional vista pelo usuario.
- `Propriedades`: plural oficial para a unidade operacional vista pelo usuario.
- `Produtor`: usuario/perfil final que consulta sua realidade operacional.
- `Titular`: responsavel cadastral ou vinculo principal da propriedade.
- `Colaborador`: usuario operacional com escopo restrito as Propriedades
  vinculadas diretamente.
- `Administrador`: texto visivel para o perfil interno `admin`.
- `Vinculo`: relacao cadastral entre usuario e Propriedade.
- `Talhao`: subdivisao interna da propriedade.
- `Safra`: periodo agricola.
- `Municipio`: localizacao oficial da Propriedade; nao concede acesso.
- `UF`: unidade federativa da localizacao; nao concede acesso.
- `Regiao` e `Microregiao`: termos legados do mock v1, sem lugar no contrato
  v2 inicial.
- `Anexo de fertilidade`: arquivo ou imagem tecnica de fertilidade vinculado a propriedade, talhao e safra quando aplicavel.

## Compatibilidade Tecnica

Os valores internos de perfil continuam:

- `produtor`
- `colaborador`
- `admin`

Campos, rotas, helpers, arquivos, componentes e contratos legados podem permanecer temporariamente por compatibilidade quando estiverem ligados a comportamento existente.

Termos tecnicos legados permitidos no codigo:

- `fazenda_id`
- `fazendaId`
- `fazenda_nome`
- `fazendaNome`
- `produtor_id`
- `proprietario_id`
- `produtores`
- `FazendaMapa`
- `FazendaMapaScreen`
- `MapaFazendaView`
- `getFazenda*`
- `fazendaUiCompat`
- `fazendaCadastroCompat`
- `FazendaCanonica`
- `FazendaLegada`

Arquivos e componentes atuais das telas de Propriedade:

- `PropriedadesScreen`
- `NovaPropriedadeScreen`
- `EditarPropriedadeScreen`

Rotas internas atuais das tabs de Propriedades:

- `Propriedades`
- `PropriedadesColaborador`

`PropriedadesColaborador` e a rota tecnica para a tab de Propriedades no fluxo
do colaborador. O label visual permanece `Propriedades`.

Rotas internas de stack ja migradas:

- `NovaPropriedade`
- `EditarPropriedade`

Na interface e em documentacao de produto, a linguagem preferencial e `Propriedade`. No modelo futuro de anexos, `propriedade_id` deve ser o nome preferencial, preservando `fazenda_id` enquanto o mock e os contratos existentes dependerem dele.

### Compatibilidade Dupla De Campos

Status em 2026-06-03: a base possui compatibilidade dupla aditiva para
Propriedade e Titular. Os helpers centrais ficam em
`src/utils/propriedadeCompat.ts` e devem ser a primeira escolha para leituras
novas:

- `getPropriedadeId`
- `getPropriedadeNome`
- `getTitularId`
- `getTitularNome`
- `withPropriedadeCompat`
- `withTitularCompat`

Os helpers `fazendaUiCompat.ts`, `filtroCompat.ts`, `usuarioAdminCompat.ts`,
`visitaFormCompat.ts` e `cadernoFormCompat.ts` ja usam esses resolvers em suas
leituras de compatibilidade.

Campos futuros ja emitidos/preservados na borda mockada de Propriedade:

- `propriedade_id`
- `propriedadeId`
- `propriedade_nome`
- `propriedadeNome`
- `titular_id`
- `titularId`
- `titular_nome`

Os 11 registros estaticos de produtores/propriedades em `src/api/mock.ts`
foram enriquecidos com esses aliases, e `src/api/produtorCompat.ts` preserva e
emite os aliases em leitura e persistencia mockada.

### Motivo Da Compatibilidade

Esses termos ainda sustentam mocks, contratos, helpers de compatibilidade, filtros, visitas, caderno, mapas e regras de acesso. A migracao tecnica das tabs de Propriedades nao alterou motor de permissoes, mocks, payloads, contratos de dados, helpers tecnicos ou logica de listagem/filtro.

### Semantica De Escopo Do Colaborador

No contrato v2, o Colaborador acessa somente Propriedades com vinculo direto
ativo em `usuario_propriedade`. Municipio e UF sao filtros de localizacao e
nao concedem permissao.

No mock v1 ainda executado, `sub_regioes` e `vinculos_microregioes` pertencem
ao escopo regional legado do colaborador:

- `sub_regioes`: fonte prioritaria do escopo territorial.
- `vinculos_microregioes`: fallback quando `sub_regioes` estiver ausente ou
  vazio.

`propriedades_atribuidas` tem outra semantica: representa um vinculo direto
visual/admin preparatorio com uma Propriedade, planejado para backend/RBAC
futuro. Nesta fase, esse campo nao restringe nem amplia acesso efetivo.

A diferenca operacional e:

- escopo regional decide quais Propriedades o colaborador pode ver hoje;
- propriedade atribuida documenta um vinculo direto previsto, mas ainda sem
  efeito de permissao no MVP mockado.

Durante a migracao, a interface v1 nao deve ser confundida com a regra
aprovada. No v2, a atribuicao administrativa deve criar ou encerrar vinculos
diretos efetivos.

### Regra Para Novas Implementacoes

- Novos textos visiveis devem usar `Propriedade` ou `Propriedades`.
- Novos documentos ativos devem usar `Propriedade` ou `Propriedades`.
- Novos arquivos e componentes de telas de propriedade devem usar `Propriedade`.
- Novos modelos futuros devem preferir `propriedade_id`.
- Codigo novo deve preferir os resolvers de `src/utils/propriedadeCompat.ts`.
- Use `fazenda*` apenas quando estiver lidando com compatibilidade existente.
- Nao acesse diretamente `fazenda_id`, `produtor_id` ou `proprietario_id` em novas telas/helpers, salvo compatibilidade explicita.
- Remova campos legados somente depois que payloads, mocks, permissoes,
  visitas, caderno, mapas, storage e testes locais estiverem migrados.
- Payloads de visita, caderno e cadastro ainda podem usar `fazenda_id` por compatibilidade.
- Rotas novas de Propriedade devem usar nomes tecnicos baseados em `Propriedade`.

## Anexos Tecnicos

Arquivos tecnicos nao devem ser entendidos como anexos soltos. Sempre que possivel, devem carregar contexto:

- propriedade
- talhao
- safra
- categoria
- tipo de anexo
- elemento tecnico
- profundidade
- status de publicacao
- visibilidade para produtor

O modelo conceitual detalhado para fertilidade esta em `modelo-anexos-fertilidade.md`.

## Cadastros Do MVP

A matriz oficial de campos, obrigatoriedades, vinculos e riscos dos cadastros
do MVP esta em `matriz-cadastros-mvp.md`. Ela separa Usuario, Produtor,
Colaborador, Administrador, Propriedade, Titular e Vinculo sem alterar codigo,
mock, rotas, permissoes ou contratos.
