# Matriz Tecnica De RBAC/Backend

Status revisado em 2026-08-18: `APROVADO_PARA_IMPLEMENTACAO`. Este documento
transforma o contrato de RBAC/backend em matriz tecnica de testes e criterios
de aceite. A regra segue as decisoes 31 a 42 de
`decisoes-consolidadas.md` e `baseline-backend-v1-2026-08.md`.

## Separacao De Escopo

### Legado preservado somente nas bordas do mock v1

- Admin ve todas as Propriedades.
- Produtor ve Propriedades por vinculo titular/produtor compativel.
- Colaborador ve Propriedades por `sub_regioes`.
- Colaborador sem `sub_regioes` usa `vinculos_microregioes` como fallback.
- `propriedades_atribuidas` e visual/admin preparatorio e nao restringe nem
  amplia acesso efetivo.

Esse comportamento e apenas evidencia historica de compatibilidade. O runtime
v2 ativo usa vinculo direto e nao deve voltar a autorizar por texto.

### Regra aprovada para o mock v2 e para o backend

- Admin: acesso global.
- Produtor: no mock, acesso por vinculo com Propriedade/Titular; no backend,
  acesso pela Titularidade derivada ou por `usuario_autorizado` ativo.
- Colaborador: acesso somente por vinculo direto ativo com a Propriedade.
- Municipio e UF pertencem ao endereco e aos filtros; nao concedem acesso.
- Nao existe entidade de Regiao Operacional, Area Operacional ou Microregiao
  no modelo aprovado.

### Fora do escopo deste documento

- Implementar backend.
- Implementar autenticação/RBAC e as rotas; essa execucao pertence a
  `MP-33B`/`MP-33C`/`MP-35`. A MP-33A implementa somente fundacao e DDL.
- Inventar registros produtivos sem carga autorizada.
- Criar novos perfis administrativos ou autorizacao por Municipio/UF.

## Entidades Minimas Futuras

| Entidade | Papel no RBAC/backend | Requisitos minimos |
|---|---|---|
| `usuarios` | Pessoa/acesso e perfil principal | id canonico, perfil, status, autenticacao, dados cadastrais |
| `produtores` | Perfil final que pode ser titular | id canonico, usuario_id quando houver acesso, dados cadastrais, status |
| `propriedades` | Unidade operacional protegida | id canonico, `titular_id`, `municipio_id`, `uf_id`, status |
| `usuario_propriedade` | Acesso adicional usuario-Propriedade | usuario_id, propriedade_id, tipo `usuario_autorizado` ou `colaborador`, status, origem, auditoria |
| `perfis`/`papeis` | Capacidades por perfil e papel | permissoes por acao e, quando necessario, nivel administrativo |

## Matriz De Permissoes Por Perfil

| Perfil | Escopo futuro | Regra de acesso | Observacao de aceite |
|---|---|---|---|
| Admin | Global | Acessa Propriedades, usuarios e vinculos conforme papel administrativo | Deve validar permissao no backend, nao apenas no frontend |
| Produtor | Propriedades vinculadas | Acessa por Titularidade derivada ou vinculo adicional ativo | Nao pode acessar Propriedade de outro titular |
| Colaborador | Propriedades vinculadas diretamente | Acessa apenas Propriedades com `usuario_propriedade` ativo | Municipio e UF nao concedem permissao |

## Matriz Por Acao

| Acao | Admin | Produtor | Colaborador |
|---|---|---|---|
| Listar Propriedades | Sim, global | Sim, apenas vinculadas | Sim, apenas por vinculo direto ativo |
| Abrir detalhe da Propriedade | Sim, global | Sim, se vinculada | Sim, se possuir vinculo direto ativo |
| Visualizar mapas/anexos | Sim, se material existir/liberado por politica | Sim, se Propriedade vinculada e material liberado ao produtor | Sim, se Propriedade no escopo e material liberado a equipe |
| Criar visita | Sim | Nao | Sim, se Propriedade vinculada |
| Visualizar visitas | Sim, global | Sim, das Propriedades vinculadas quando liberadas | Sim, das Propriedades no escopo |
| Criar registro no caderno | Sim | Sim, na propria Propriedade | Sim, se Propriedade vinculada |
| Visualizar caderno | Sim, global | Sim, da propria Propriedade conforme visibilidade | Sim, das Propriedades no escopo |
| Editar cadastro de Propriedade | Sim | Nao | Nao |
| Editar usuarios/vinculos | Sim | Nao | Nao |
| Publicar Material ou GeoJSON | Sim | Nao | Nao |

## Casos Positivos De Aceite

| ID | Caso | Pre-condicao | Resultado esperado |
|---|---|---|---|
| RBAC-BE-P01 | Admin acessa tudo | Usuario admin ativo e autenticado | Lista, detalhe, mapas/anexos, visitas, caderno e cadastros autorizados retornam dados |
| RBAC-BE-P02 | Produtor acessa Propriedade vinculada | Titularidade derivada ou `usuario_propriedade` adicional ativo | Lista e abre apenas a Propriedade vinculada |
| RBAC-BE-P03 | Colaborador acessa por vinculo direto | `usuario_propriedade` ativo para a Propriedade | Lista e abre a Propriedade vinculada |
| RBAC-BE-P04 | Colaborador acessa Propriedades em municipios diferentes | Vinculos diretos ativos para cada Propriedade | Acessa todas as vinculadas, independentemente de municipio ou UF |
| RBAC-BE-P05 | Admin atribui varias Propriedades filtradas por localizacao | Admin filtra municipio/UF e confirma a selecao | Sao criados vinculos diretos individuais e auditaveis |
| RBAC-BE-P06 | Colaborador cria visita dentro do escopo | Propriedade no escopo e permissao `criar_visita` ativa | Criacao permitida e auditada |
| RBAC-BE-P07 | Produtor visualiza mapas liberados | Propriedade vinculada e material liberado para produtor | Mapa/anexo aparece sem expor materiais nao liberados |
| RBAC-BE-P08 | Backend projeta acesso do Titular | Usuario principal ativo do Produtor indicado por `titular_id` | Retorna acesso `titular` calculado sem linha correspondente em `usuario_propriedade` |

## Casos Negativos De Aceite

| ID | Caso | Pre-condicao | Resultado esperado |
|---|---|---|---|
| RBAC-BE-N01 | Produtor tenta acessar Propriedade de outro titular | Sem vinculo ativo com a Propriedade | Backend nega acesso de forma segura |
| RBAC-BE-N02 | Colaborador sem vinculo direto | Nenhum `usuario_propriedade` ativo | Backend nao lista nem abre a Propriedade |
| RBAC-BE-N03 | Colaborador tenta editar cadastro sem permissao | Escopo valido, mas sem permissao de acao | Backend nega edicao, mesmo que frontend esconda botao |
| RBAC-BE-N04 | Usuario inativo tenta acessar area protegida | `usuarios.status = inativo` | Backend bloqueia acesso protegido |
| RBAC-BE-N05 | Usuario pendente tenta acessar area protegida | `usuarios.status = pendente` sem ativacao | Backend bloqueia acesso protegido |
| RBAC-BE-N06 | Vinculo inativo e usado para acesso | `usuario_propriedade.status` inativo | Vinculo nao concede permissao |
| RBAC-BE-N07 | Alteracao visual no mock e tratada como seguranca real | Somente mock/frontend alterado, sem vinculo persistente real | Nao deve ser aceito como criterio de seguranca |
| RBAC-BE-N08 | Rota direta acessa dado fora do escopo | Usuario chama API por id de Propriedade fora do escopo | Backend nega sem retornar dados sensiveis |
| RBAC-BE-N09 | Tipo `titular` e enviado como vinculo adicional | Payload tenta gravar `usuario_propriedade.tipo_vinculo=titular` | Banco/API rejeitam o valor |
| RBAC-BE-N10 | Usuario principal inativo tenta usar Titularidade | Propriedade conserva `titular_id`, mas Usuario principal esta inativo | Autenticacao/autorizacao nega acesso sem invalidar o cadastro da Propriedade |

## Criterios De Aceite Para Backend

- Toda permissao deve ser validada no backend, nao apenas no frontend.
- Toda Propriedade, Produtor, usuario e vinculo deve usar id canonico.
- `fazenda_id`, `produtor_id`, `proprietario_id`, `titular_id` e
  `propriedade_id` devem ter migracao planejada com leitura dupla enquanto
  houver compatibilidade.
- Vinculos `usuario_propriedade` adicionais devem ser persistentes e aceitar
  somente `usuario_autorizado` ou `colaborador`.
- `propriedades.titular_id` e a unica fonte persistida da Titularidade; o
  acesso `titular` e derivado.
- A conta do Usuario principal pode ser inativada sem constraint impeditiva e
  sem invalidar a Titularidade cadastral; Usuario inativo nao recebe acesso.
- Vinculos têm status ativo/inativo e não expiram automaticamente no primeiro
  backend.
- Criacao, alteracao e remocao de vinculos devem ter auditoria minima.
- Usuarios inativos ou pendentes nao devem acessar areas protegidas do backend.
- Recurso por ID fora do escopo retorna `404`; acao negada sobre recurso
  conhecido e dentro do escopo retorna `403`.
- Mapas/anexos, visitas e caderno devem validar permissao por Propriedade em
  cada operacao.
- Testes automatizados devem cobrir casos positivos e negativos por perfil,
  acao e origem do acesso.
- Testes devem cobrir rotas diretas/API por id, nao apenas listagens.
- Filtros por municipio/UF usados em atribuicoes em lote devem materializar
  vinculos diretos; o filtro nao pode virar autorizacao implicita.

## Riscos Fora Do MVP Atual

- O backend tratar municipio/UF como autorizacao territorial implicita.
- O backend ignorar atribuicao direta e deixar o Admin visual sem efeito real.
- O frontend esconder botoes, mas APIs aceitarem operacoes fora do escopo.
- Usuarios inativos/pendentes manterem acesso por sessao antiga.
- Migracao de ids quebrar acesso do Produtor a Propriedades vinculadas.
- Mapas/anexos serem liberados por Propriedade, mas acessados por URL direta
  sem checagem de permissao.

## Evidencias Historicas Do Legado V1

`tests/acessoEscopoPerfilDiagnostico.test.js` preserva cenarios de
compatibilidade e migracao do mock antigo:

- Admin ve todas as Propriedades.
- Produtor ve Propriedades onde e titular/produtor compativel.
- Colaborador ve por `sub_regioes`.
- `vinculos_microregioes` e fallback quando `sub_regioes` esta ausente/vazio.
- `sub_regioes` tem prioridade quando os dois campos existem.
- `propriedades_atribuidas` nao e regra efetiva no MVP mockado.
- Alias futuros `propriedade_id` e `titular_id` existem, mas legado ainda
  sustenta parte do acesso efetivo.

Essa evidencia nao define a regra futura. Ela preserva o retrato do v1 apenas
para orientar a remocao segura durante a migracao para o mock v2.
