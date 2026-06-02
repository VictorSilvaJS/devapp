# Nomenclatura Oficial

Este documento resume a linguagem oficial de produto para evitar ambiguidade durante a estabilizacao de nomes. Ele complementa `estado-atual.md`, `regras-de-negocio.md` e `decisoes-consolidadas.md`.

## Termos Principais

- `Propriedade`: unidade operacional vista pelo usuario.
- `Propriedades`: plural oficial para a unidade operacional vista pelo usuario.
- `Produtor`: usuario/perfil final que consulta sua realidade operacional.
- `Titular`: responsavel cadastral ou vinculo principal da propriedade.
- `Colaborador`: usuario regional com escopo operacional restrito.
- `Administrador`: texto visivel para o perfil interno `admin`.
- `Vinculo`: relacao cadastral entre usuario e propriedade ou entre usuario e territorio.
- `Talhao`: subdivisao interna da propriedade.
- `Safra`: periodo agricola.
- `Regiao`: agrupamento territorial amplo.
- `Microregiao`: subdivisao territorial usada no MVP visual/mockado.
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

Rotas internas que permanecem legadas temporariamente:

- `Produtores`
- `Meus Produtores`

Rotas internas de stack ja migradas:

- `NovaPropriedade`
- `EditarPropriedade`

Na interface e em documentacao de produto, a linguagem preferencial e `Propriedade`. No modelo futuro de anexos, `propriedade_id` deve ser o nome preferencial, preservando `fazenda_id` enquanto o mock e os contratos existentes dependerem dele.

### Motivo Da Compatibilidade

Esses termos ainda sustentam rotas, mocks, contratos, helpers de compatibilidade, filtros, visitas, caderno, mapas e regras de acesso. As tabs legadas sao contratos de navegacao por string e ainda aparecem em `RootParamList`. Renomear essa base agora tem alto risco de quebrar navegacao, permissoes, filtros e dados mockados.

### Regra Para Novas Implementacoes

- Novos textos visiveis devem usar `Propriedade` ou `Propriedades`.
- Novos documentos ativos devem usar `Propriedade` ou `Propriedades`.
- Novos arquivos e componentes de telas de propriedade devem usar `Propriedade`.
- Novos modelos futuros devem preferir `propriedade_id`.
- Use `fazenda*` apenas quando estiver lidando com compatibilidade existente.
- Preserve as rotas legadas ate uma fase especifica de migracao ou aliases.

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
