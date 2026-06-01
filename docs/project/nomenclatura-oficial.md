# Nomenclatura Oficial

Este documento resume a linguagem oficial de produto para evitar ambiguidade durante a estabilizacao de nomes. Ele complementa `estado-atual.md`, `regras-de-negocio.md` e `decisoes-consolidadas.md`.

## Termos Principais

- `Propriedade`: unidade operacional vista pelo usuario.
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

Campos, rotas, helpers e contratos legados como `fazenda`, `fazenda_id`, `fazendaId`, `getFazendaId` e `FazendaMapa` podem permanecer temporariamente por compatibilidade.

Na interface e em documentacao de produto, a linguagem preferencial e `Propriedade`. No modelo futuro de anexos, `propriedade_id` deve ser o nome preferencial, preservando `fazenda_id` enquanto o mock e os contratos existentes dependerem dele.

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

