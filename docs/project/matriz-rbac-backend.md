# Matriz Tecnica De RBAC/Backend

Status em 2026-06-03 (Fase 14F): este documento transforma o contrato futuro
de RBAC/backend em matriz tecnica de testes e criterios de aceite. Ele nao
altera codigo, mocks, telas, rotas, permissoes ou comportamento funcional do
MVP mockado.

## Separacao De Escopo

### Regra atual do MVP mockado

- Admin ve todas as Propriedades.
- Produtor ve Propriedades por vinculo titular/produtor compativel.
- Colaborador ve Propriedades por `sub_regioes`.
- Colaborador sem `sub_regioes` usa `vinculos_microregioes` como fallback.
- `propriedades_atribuidas` e visual/admin preparatorio e nao restringe nem
  amplia acesso efetivo.

Esse comportamento e diagnosticado por
`tests/acessoEscopoPerfilDiagnostico.test.js`.

### Regra futura desejada no backend

- Admin: acesso global.
- Produtor: acesso por vinculo com Propriedade/Titular.
- Colaborador: acesso combinado/aditivo por microregiao vinculada OU
  Propriedade atribuida diretamente.

No backend futuro, Propriedade atribuida diretamente ao colaborador deve
ampliar acesso direto. Ela nao deve restringir automaticamente o acesso
regional. Qualquer regra restritiva deve ser uma politica futura explicita.

### Fora do escopo desta fase

- Implementar backend.
- Implementar RBAC.
- Alterar `src/utils/acessoControle.ts`.
- Alterar mocks principais.
- Alterar telas, rotas ou fluxo de login.
- Converter `propriedades_atribuidas` em regra efetiva no MVP mockado.

## Entidades Minimas Futuras

| Entidade | Papel no RBAC/backend | Requisitos minimos |
|---|---|---|
| `usuarios` | Pessoa/acesso e perfil principal | id canonico, perfil, status, autenticacao, dados cadastrais |
| `propriedades` | Unidade operacional protegida | id canonico, titular, regiao/microregiao, status |
| `usuario_propriedade` | Vinculo direto usuario-Propriedade | usuario_id, propriedade_id, tipo, status, origem, auditoria |
| `usuario_microregiao` | Vinculo territorial usuario-microregiao | usuario_id, microregiao_id, status, origem, auditoria |
| `perfis`/`papeis` | Capacidades por perfil e papel | permissoes por acao e, quando necessario, nivel administrativo |

## Matriz De Permissoes Por Perfil

| Perfil | Escopo futuro | Regra de acesso | Observacao de aceite |
|---|---|---|---|
| Admin | Global | Acessa Propriedades, usuarios e vinculos conforme papel administrativo | Deve validar permissao no backend, nao apenas no frontend |
| Produtor | Propriedades vinculadas | Acessa Propriedades onde possui vinculo ativo ou titularidade | Nao pode acessar Propriedade de outro titular |
| Colaborador | Microregiao OU Propriedade direta | Acessa Propriedades da microregiao vinculada e Propriedades atribuidas diretamente | Acesso direto e aditivo, nao restritivo |

## Matriz Por Acao

| Acao | Admin | Produtor | Colaborador |
|---|---|---|---|
| Listar Propriedades | Sim, global | Sim, apenas vinculadas | Sim, por microregiao OU atribuicao direta |
| Abrir detalhe da Propriedade | Sim, global | Sim, se vinculada | Sim, se dentro do escopo aditivo |
| Visualizar mapas/anexos | Sim, se material existir/liberado por politica | Sim, se Propriedade vinculada e material liberado ao produtor | Sim, se Propriedade no escopo e material liberado a equipe |
| Criar visita | Sim, conforme papel | Nao por padrao | Sim, se Propriedade no escopo e permissao de acao ativa |
| Visualizar visitas | Sim, global | Sim, das Propriedades vinculadas quando liberadas | Sim, das Propriedades no escopo |
| Criar registro no caderno | Sim, conforme papel | Sim, na propria Propriedade quando permitido | Sim, se Propriedade no escopo e permissao de acao ativa |
| Visualizar caderno | Sim, global | Sim, da propria Propriedade conforme visibilidade | Sim, das Propriedades no escopo |
| Editar cadastro de Propriedade | Sim, conforme papel administrativo | Nao por padrao | Somente com permissao explicita por acao |
| Editar usuarios/vinculos | Sim, conforme papel administrativo | Nao | Nao por padrao |

## Casos Positivos De Aceite

| ID | Caso | Pre-condicao | Resultado esperado |
|---|---|---|---|
| RBAC-BE-P01 | Admin acessa tudo | Usuario admin ativo e autenticado | Lista, detalhe, mapas/anexos, visitas, caderno e cadastros autorizados retornam dados |
| RBAC-BE-P02 | Produtor acessa Propriedade vinculada | `usuario_propriedade` ativo ou titularidade compativel | Lista e abre apenas a Propriedade vinculada |
| RBAC-BE-P03 | Colaborador acessa por microregiao | `usuario_microregiao` ativo para a microregiao da Propriedade | Lista e abre Propriedades da microregiao |
| RBAC-BE-P04 | Colaborador acessa por atribuicao direta | `usuario_propriedade` ativo para a Propriedade | Lista e abre a Propriedade atribuida diretamente |
| RBAC-BE-P05 | Colaborador acessa fora da microregiao por atribuicao direta | Microregiao nao vinculada, mas `usuario_propriedade` ativo | Acesso permitido pela regra aditiva futura |
| RBAC-BE-P06 | Colaborador cria visita dentro do escopo | Propriedade no escopo e permissao `criar_visita` ativa | Criacao permitida e auditada |
| RBAC-BE-P07 | Produtor visualiza mapas liberados | Propriedade vinculada e material liberado para produtor | Mapa/anexo aparece sem expor materiais nao liberados |

## Casos Negativos De Aceite

| ID | Caso | Pre-condicao | Resultado esperado |
|---|---|---|---|
| RBAC-BE-N01 | Produtor tenta acessar Propriedade de outro titular | Sem vinculo ativo com a Propriedade | Backend nega acesso de forma segura |
| RBAC-BE-N02 | Colaborador sem microregiao e sem atribuicao direta | Nenhum vinculo territorial ou direto ativo | Backend nao lista nem abre a Propriedade |
| RBAC-BE-N03 | Colaborador tenta editar cadastro sem permissao | Escopo valido, mas sem permissao de acao | Backend nega edicao, mesmo que frontend esconda botao |
| RBAC-BE-N04 | Usuario inativo tenta acessar area protegida | `usuarios.status = inativo` | Backend bloqueia acesso protegido |
| RBAC-BE-N05 | Usuario pendente tenta acessar area protegida | `usuarios.status = pendente` sem ativacao | Backend bloqueia acesso protegido |
| RBAC-BE-N06 | Vinculo inativo e usado para acesso | `usuario_propriedade.status` ou `usuario_microregiao.status` inativo | Vinculo nao concede permissao |
| RBAC-BE-N07 | Alteracao visual no mock e tratada como seguranca real | Somente mock/frontend alterado, sem vinculo persistente real | Nao deve ser aceito como criterio de seguranca |
| RBAC-BE-N08 | Rota direta acessa dado fora do escopo | Usuario chama API por id de Propriedade fora do escopo | Backend nega sem retornar dados sensiveis |

## Criterios De Aceite Para Backend

- Toda permissao deve ser validada no backend, nao apenas no frontend.
- Toda Propriedade, usuario, microregiao e vinculo deve usar id canonico.
- `fazenda_id`, `produtor_id`, `proprietario_id`, `titular_id` e
  `propriedade_id` devem ter migracao planejada com leitura dupla enquanto
  houver compatibilidade.
- Vinculos `usuario_propriedade` e `usuario_microregiao` devem ser persistentes.
- Vinculos devem ter status ativo/inativo e, quando necessario, validade
  temporal.
- Criacao, alteracao e remocao de vinculos devem ter auditoria minima.
- Usuarios inativos ou pendentes nao devem acessar areas protegidas do backend.
- Acesso negado deve retornar resposta segura e consistente, sem vazar dados da
  Propriedade ou do material solicitado.
- Mapas/anexos, visitas e caderno devem validar permissao por Propriedade em
  cada operacao.
- Testes automatizados devem cobrir casos positivos e negativos por perfil,
  acao e origem do acesso.
- Testes devem cobrir rotas diretas/API por id, nao apenas listagens.
- Qualquer politica restritiva sobre propriedades atribuidas deve ter testes
  proprios e decisao documentada antes da implementacao.

## Riscos Fora Do MVP Atual

- O backend implementar `propriedades_atribuidas` como restricao implicita e
  remover acesso regional esperado.
- O backend ignorar atribuicao direta e deixar o Admin visual sem efeito real.
- O frontend esconder botoes, mas APIs aceitarem operacoes fora do escopo.
- Usuarios inativos/pendentes manterem acesso por sessao antiga.
- Migracao de ids quebrar acesso do Produtor a Propriedades vinculadas.
- Mapas/anexos serem liberados por Propriedade, mas acessados por URL direta
  sem checagem de permissao.

## Evidencias Atuais Do MVP

`tests/acessoEscopoPerfilDiagnostico.test.js` registra o comportamento atual do
mock:

- Admin ve todas as Propriedades.
- Produtor ve Propriedades onde e titular/produtor compativel.
- Colaborador ve por `sub_regioes`.
- `vinculos_microregioes` e fallback quando `sub_regioes` esta ausente/vazio.
- `sub_regioes` tem prioridade quando os dois campos existem.
- `propriedades_atribuidas` nao e regra efetiva no MVP mockado.
- Alias futuros `propriedade_id` e `titular_id` existem, mas legado ainda
  sustenta parte do acesso efetivo.

Essa evidencia nao substitui testes de backend futuros. Ela apenas preserva o
retrato atual para orientar a migracao.
