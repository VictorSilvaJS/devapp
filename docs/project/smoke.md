22-04-2026 - 10:14

Abaixo está o smoke funcional pronto para execução, sem abrir feature nova.

**Como Usar**
- Atualize a coluna `Status` com `Passou`, `Falhou` ou `Reexecutar`.
- Use `Observação` só para evidência mínima ou descrição curta da falha.
- Em caso de falha, corrija o ponto específico, reexecute o mesmo caso e siga o smoke.

**Pontos Mais Arriscados**
1. Produtor por rota direta: `NovaVisita`, `EditarVisita`, `CadernoDetail` restrito, `EditarCaderno` de outro autor.
2. Colaborador fora de escopo regional: criação/edição/detalhe de visita e caderno.
3. Preservação de `fazenda_id` em edição de visita e caderno.
4. Caderno no detalhe da propriedade: registros corretos por propriedade e visibilidade para produtor.
5. Criação a partir do detalhe da propriedade: novo caderno nasce vinculado à propriedade atual.

**Rodada Produtor - Fluxo Visual/Mockado Pós-Nomenclatura**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| P-01 | P0 | Produtor | Login produtor válido | Entrar no app | Abre fluxo do produtor em `Minhas Propriedades` | Passou | Validado manualmente após padronização de nomenclatura |
| P-02 | P0 | Produtor | Propriedade disponível | Abrir card da propriedade | Detalhe da propriedade abre corretamente | Passou | Card permite acesso claro ao detalhe |
| P-03 | P0 | Produtor | Detalhe da propriedade aberto | Abrir mapa dos talhões | Mapa base dos talhões abre e permite consulta visual | Passou | MVP visual/mockado validado |
| P-04 | P1 | Produtor | Mapas/anexos disponíveis | Abrir anexos de fertilidade | Anexos de fertilidade abrem para consulta | Passou | Validado com amostra mockada |
| P-05 | P1 | Produtor | Detalhe/listagem disponível | Consultar visitas | Visitas aparecem/abrem para consulta quando disponíveis | Passou | Produtor consulta sem editar |
| P-06 | P1 | Produtor | Caderno disponível | Consultar caderno | Caderno abre em modo permitido para o produtor | Passou | Respeita visibilidade do produtor |
| P-07 | P1 | Produtor | Áreas sem dados | Ver mensagens vazias | Mensagens vazias explicam o estado sem parecer erro | Passou | Textos revisados usando propriedade |
| P-08 | P1 | Produtor | Fluxo completo | Revisar textos visíveis | Interface usa `Propriedade` como termo de produto | Passou | Nomes próprios como `Fazenda Sela de Prata I` permanecem preservados |

**Rodada 1 - Bloqueios E Escopo**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-01 | P0 | Produtor | Qualquer visita | Tentar criar visita por rota direta | Bloqueado | Passou | Exibiu acesso restrito |
| S-02 | P0 | Produtor | Qualquer visita | Tentar editar visita por rota direta | Bloqueado | Passou | Exibiu acesso negado |
| S-03 | P0 | Produtor | Caderno restrito da própria propriedade | Abrir por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-04 | P0 | Produtor | Registro de outro autor | Editar caderno por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-05 | P0 | Colaborador | Visita fora do escopo | Abrir por rota direta | Acesso bloqueado/volta | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-06 | P0 | Colaborador | Propriedade fora do escopo | Criar/editar visita por rota direta | Bloqueado | Passou | Edição direta de visita fora do escopo exibiu mensagem sem permissão |
| S-07 | P0 | Colaborador | Registro de caderno fora do escopo | Abrir detalhe/editar por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-08 | P0 | Produtor | Caderno de outra propriedade | Abrir por rota direta | Bloqueado | Passou | Exibiu mensagem sem permissão para acessar o registro |
| S-09 | P1 | Admin | Registro de caderno existente | Abrir detalhe do caderno | Detalhe carrega mesmo se restrito ao produtor | Passou | Detalhe do caderno abriu para admin |
| S-10 | P1 | Colaborador | Registro de caderno dentro do escopo | Abrir detalhe | Permitido, inclusive restrito ao produtor | Passou | Detalhe do caderno abriu para colaborador |

**Rodada 2 - Integridade De Contexto**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-11 | P0 | Admin | Visita existente | Editar visita | Propriedade permanece a mesma; alterações salvam | Passou | Propriedade vinculada ficou travada e edição salvou |
| S-12 | P0 | Admin | Registro de caderno existente | Editar caderno | Propriedade fica travada; `fazenda_id` preservado | Passou | Propriedade vinculada ficou travada e edição salvou |
| S-13 | P0 | Colaborador | Caderno existente | Editar caderno | Propriedade travada; alterações salvam | Passou | Propriedade vinculada ficou travada e edição salvou |
| S-14 | P0 | Produtor | Registro próprio | Editar caderno | Permitido; propriedade travada | Passou | Produtor editou registro próprio com propriedade vinculada travada |
| S-15 | P1 | Admin | Propriedade existente | Criar visita para a propriedade | Salva com `fazenda_id`; aparece na listagem/detalhe | Passou | Visita criada como admin e salva sem erro |
| S-16 | P1 | Colaborador | Propriedade dentro do escopo | Criar visita | Permitido; salva com `fazenda_id` correto | Passou | Visita criada como colaborador em propriedade autorizada |
| S-17 | P1 | Admin | Propriedade existente | Criar caderno pela listagem | Pode escolher propriedade autorizada e salvar | Passou | Caderno criado como admin e detalhe abriu |
| S-18 | P1 | Produtor | Própria propriedade | Criar caderno | Permitido; visível ao produtor | Passou | Registro criado no contexto da própria propriedade e detalhe abriu |
| S-19 | P1 | Produtor | Propriedade de outro titular | Criar caderno por rota direta com `fazendaId` | Bloqueado | Passou | Acesso restrito após ajuste para não exibir formulário antes da permissão |

**Rodada 3 - Integração Na Propriedade**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-20 | P0 | Admin | Propriedade no detalhe | Criar caderno pela aba Caderno | Abre `NovoCaderno` já no contexto da propriedade | Passou | Criou pela aba e registro apareceu na propriedade após ajuste de recarregamento |
| S-21 | P0 | Colaborador | Propriedade dentro do escopo | Criar caderno pela aba da propriedade | Salva vinculado à propriedade atual | Passou | Criou pela aba da propriedade dentro do escopo |
| S-22 | P1 | Admin | Detalhe da propriedade | Abrir aba Caderno | Vê registros reais da propriedade atual | Passou | Aba Caderno abriu e mostrou registros da propriedade |
| S-23 | P1 | Colaborador | Detalhe da propriedade | Aba Caderno | Mostra só registros daquela propriedade | Passou | Aba Caderno abriu e mostrou registros da propriedade do escopo |
| S-24 | P1 | Produtor | Detalhe da própria propriedade | Aba Caderno | Mostra apenas registros visíveis daquela propriedade | Passou | Aba Caderno abriu para produtor sem exibir registro restrito |

**Cobertura Complementar**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-25 | P2 | Admin | Existem propriedades com visitas | Abrir listagem de visitas | Vê visitas de múltiplas propriedades conforme filtros | Passou | Listagem de visitas abriu para admin |
| S-26 | P2 | Admin | Visita existente | Abrir detalhe da visita | Detalhe carrega e mostra contexto da propriedade | Passou | Detalhe de visita abriu para admin |
| S-27 | P2 | Colaborador | Tem região/sub-região | Abrir visitas | Vê apenas visitas de propriedades no escopo | Passou | Listagem de visitas abriu para colaborador |
| S-28 | P2 | Colaborador | Visita dentro do escopo | Abrir detalhe | Acesso permitido | Passou | Detalhe de visita dentro do escopo abriu |
| S-29 | P2 | Produtor | Tem uma ou mais propriedades | Abrir visitas | Vê visitas das próprias propriedades | Passou | Produtor vê histórico das próprias propriedades |
| S-30 | P2 | Produtor | Visita própria | Abrir detalhe | Permitido | Passou | Detalhe abriu por rota direta; caminho visual para produtor fica como decisão de produto |
| S-31 | P2 | Produtor | Caderno visível da própria propriedade | Abrir listagem/detalhe | Permitido | Passou | Caderno visível abriu para produtor |

**Validações De Ponta A Ponta**
| ID | Fluxo | Resultado esperado | Status | Observação |
|---|---|---|---|---|
| E2E-01 | Criar visita como admin/colaborador -> abrir detalhe -> editar | Propriedade não mudou | Passou | Fluxo literal criado, aberto em detalhe e editado com propriedade preservada |
| E2E-02 | Criar caderno pela aba da propriedade -> cair no detalhe do registro -> voltar à propriedade | Registro aparece na aba | Passou | Coberto por S-20 após ajuste de recarregamento |
| E2E-03 | Editar caderno -> salvar -> abrir detalhe atualizado | `fazenda_id` preservado | Passou | Coberto por S-12, S-13 e S-14 |
| E2E-04 | Produtor cria caderno próprio -> abrir listagem e detalhe da propriedade | Registro aparece nos dois lugares | Passou | Coberto por S-18, S-24 e S-31 |
| E2E-05 | Produtor tenta acessar caderno restrito por listagem/detalhe/rota direta | Registro não aparece e rota direta bloqueia | Passou | Coberto por S-03 e S-24 |

**Critério Para Encerrar A Frente**
- Todos os casos P0 passam.
- Todos os casos P1 passam ou têm exceção documentada e aceita.
- Nenhum produtor consegue criar/editar visita.
- Nenhum perfil acessa visita ou caderno fora da propriedade autorizada.
- Caderno restrito nunca aparece para produtor.
- Edição de visita e caderno nunca troca a propriedade.
- A aba Caderno da propriedade mostra somente registros daquela propriedade e permite criar no contexto correto.
