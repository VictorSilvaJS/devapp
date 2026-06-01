# Nomenclatura Oficial

Este documento resume a linguagem oficial de produto para evitar ambiguidade durante a estabilizacao de nomes. Ele complementa `estado-atual.md`, `regras-de-negocio.md` e `decisoes-consolidadas.md`.

## Termos Principais

- `Propriedade`: unidade operacional vista pelo usuario.
- `Propriedades`: plural oficial para a unidade operacional vista pelo usuario.
- `Produtor`: usuario/perfil final que consulta sua realidade operacional.
- `Titular`: responsavel cadastral ou vinculo principal da propriedade.
- `Colaborador`: usuario regional com escopo operacional restrito.
- `Administrador`: texto visivel para o perfil interno `admin`.
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
- `fazendaNome`
- `FazendaMapa`
- `FazendaMapaScreen`
- `MapaFazendaView`
- `getFazenda*`
- `fazendaUiCompat`
- `fazendaCadastroCompat`
- `FazendaCanonica`
- `FazendaLegada`

Na interface e em documentacao de produto, a linguagem preferencial e `Propriedade`. No modelo futuro de anexos, `propriedade_id` deve ser o nome preferencial, preservando `fazenda_id` enquanto o mock e os contratos existentes dependerem dele.

### Motivo Da Compatibilidade

Esses termos ainda sustentam rotas, mocks, contratos, helpers de compatibilidade, filtros, visitas, caderno, mapas e regras de acesso. Renomear essa base agora tem alto risco de quebrar navegacao, permissoes, filtros e dados mockados.

### Regra Para Novas Implementacoes

- Novos textos visiveis devem usar `Propriedade` ou `Propriedades`.
- Novos documentos ativos devem usar `Propriedade` ou `Propriedades`.
- Novos modelos futuros devem preferir `propriedade_id`.
- Use `fazenda*` apenas quando estiver lidando com compatibilidade existente.

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
