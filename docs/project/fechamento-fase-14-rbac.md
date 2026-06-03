# Fechamento Da Fase 14 - RBAC E Escopo Do Colaborador

Status em 2026-06-03: este documento consolida a Fase 14 como roteiro de
consulta. Ele nao altera codigo, telas, rotas, mocks, backend ou RBAC. O MVP
atual continua mockado.

## Objetivo Da Fase 14

Mapear, estabilizar e documentar como o app decide hoje o acesso a
Propriedades por perfil, corrigindo apenas o fallback territorial do
colaborador e preparando a direcao futura de RBAC/backend.

## O Que Foi Diagnosticado

- Admin ve todas as Propriedades no MVP mockado.
- Produtor ve Propriedades por vinculo titular/produtor compativel.
- Colaborador ve Propriedades por `sub_regioes`.
- `vinculos_microregioes` existia como vinculo territorial visual/admin e foi
  definido como fallback de `sub_regioes`.
- `propriedades_atribuidas` e visual/admin preparatorio no MVP mockado.
- `propriedades_atribuidas` nao restringe nem amplia acesso efetivo no MVP.
- Campos futuros como `propriedade_id` e `titular_id` existem como aliases,
  mas legados como `fazenda_id`, `produtor_id` e `proprietario_id` ainda
  sustentam compatibilidade.

## O Que Foi Alterado Funcionalmente

A unica mudanca funcional da Fase 14 foi pequena e aditiva:

- Colaborador continua usando `sub_regioes` quando houver valores.
- Se `sub_regioes` estiver ausente ou vazio, passa a usar
  `vinculos_microregioes` como fallback.
- Se ambos existirem, `sub_regioes` continua tendo prioridade.
- `propriedades_atribuidas` continua sem efeito de acesso no MVP mockado.

Arquivos funcionais envolvidos:

- `src/utils/acessoControle.ts`
- `tests/acessoEscopoPerfilDiagnostico.test.js`

## O Que Foi Apenas Documentado

- Semantica oficial de `propriedades_atribuidas` no MVP.
- Contrato futuro recomendado de RBAC/backend.
- Matriz futura de permissoes e aceite.
- Contrato futuro de API para RBAC/backend.
- Matriz futura de testes de contrato/API.
- Riscos e pendencias para backend.

## Regra Atual Do MVP Mockado

| Perfil | Regra efetiva atual |
|---|---|
| Admin | Ve todas as Propriedades |
| Produtor | Ve Propriedades por titular/produtor compativel |
| Colaborador | Ve por `sub_regioes`; se vazio/ausente, usa `vinculos_microregioes` |

Notas:

- `propriedades_atribuidas` e vinculo visual/admin preparatorio.
- `propriedades_atribuidas` nao e RBAC efetivo no MVP.
- O Admin visual nao deve ser interpretado como seguranca real.

## Regra Futura Recomendada

| Perfil | Regra futura recomendada |
|---|---|
| Admin | Acesso global |
| Produtor | Acesso por vinculo com Propriedade/Titular |
| Colaborador | Acesso por microregiao vinculada OU Propriedade atribuida diretamente |

No backend futuro, Propriedade atribuida diretamente ao colaborador deve ser
regra aditiva: amplia acesso direto e nao restringe automaticamente o acesso
regional. Qualquer politica restritiva deve ser decisao explicita futura.

## Arquivos Principais Da Fase 14

- `docs/project/estado-atual.md`: retrato atual e status das fases 14D-14H.
- `docs/project/regras-de-negocio.md`: contrato futuro de backend/RBAC.
- `docs/project/matriz-cadastros-mvp.md`: semantica atual e futura nos
  cadastros.
- `docs/project/matriz-rbac-backend.md`: matriz futura de permissoes, casos de
  aceite e riscos.
- `docs/project/contrato-api-rbac.md`: endpoints, payloads minimos, respostas e
  regras por endpoint.
- `docs/project/testes-contrato-api-rbac.md`: matriz de testes de contrato/API.
- `docs/project/pendencias-de-definicao.md`: pendencias remanescentes para
  backend.
- `docs/project/roadmap-futuro.md`: proximos passos de backend/RBAC.
- `docs/project/smoke.md`: rodadas documentais e manuais recomendadas.

## Testes Criados Ou Ajustados

- `tests/acessoEscopoPerfilDiagnostico.test.js`

Cobertura principal:

- Admin ve todas as Propriedades.
- Produtor ve Propriedades onde e titular/produtor compativel.
- Colaborador ve por `sub_regioes`.
- Colaborador sem `sub_regioes` usa `vinculos_microregioes`.
- `sub_regioes` tem prioridade sobre `vinculos_microregioes`.
- `propriedades_atribuidas` nao e regra efetiva no MVP mockado.
- Colaborador com propriedade atribuida, mas sem microregiao efetiva, fica sem
  acesso efetivo no MVP.

## Validacoes Esperadas

Para fechar ou revalidar a Fase 14:

```powershell
npm run typecheck
npm run test:domain-compat
git diff --check
```

Validacao manual/documental recomendada:

- `docs/project/smoke.md`, rodadas Fase 14D, 14F, 14H e 14I.

## Riscos Remanescentes

- Alguem tratar `propriedades_atribuidas` visual do Admin como permissao real.
- Backend futuro implementar `propriedades_atribuidas` como restricao implicita.
- Backend futuro depender apenas do frontend para bloquear acoes.
- Rotas diretas/API por id exporem Propriedades fora do escopo.
- Migracao de `fazenda_id`, `produtor_id`, `proprietario_id`, `titular_id` e
  `propriedade_id` quebrar acesso do Produtor.
- Usuarios inativos/pendentes manterem sessoes validas no backend futuro.
- Uso inconsistente de `403 Forbidden` e `404 Not Found` revelar recursos fora
  do escopo.

## Pendencias Para Backend

- Implementar autenticacao real, sessao, refresh e revogacao.
- Persistir `usuarios`, `propriedades`, `usuario_propriedade`,
  `usuario_microregiao` e `perfis`/`papeis`.
- Definir ids canonicos e migracao de campos legados.
- Auditar criacao, alteracao e remocao de vinculos.
- Definir status, validade e origem dos vinculos.
- Validar permissao por acao e por Propriedade no backend.
- Transformar `matriz-rbac-backend.md`, `contrato-api-rbac.md` e
  `testes-contrato-api-rbac.md` em testes automatizados quando houver API real.

## Proxima Fase Recomendada

Fase 15A: iniciar a consolidacao tecnica de contratos canonicos de
Propriedade/Titular e campos legados, sem remover compatibilidade. O objetivo
natural e preparar a migracao controlada entre `fazenda_id`,
`propriedade_id`, `produtor_id`, `proprietario_id` e `titular_id`, mantendo
visitas, caderno, mapas, filtros e acesso funcionando.
