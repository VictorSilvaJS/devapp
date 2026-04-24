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
4. Caderno no detalhe da fazenda: registros corretos por fazenda e visibilidade para produtor.
5. Criação a partir do detalhe da fazenda: novo caderno nasce vinculado à fazenda atual.

**Rodada 1 - Bloqueios E Escopo**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-01 | P0 | Produtor | Qualquer visita | Tentar criar visita por rota direta | Bloqueado | Pendente |  |
| S-02 | P0 | Produtor | Qualquer visita | Tentar editar visita por rota direta | Bloqueado | Pendente |  |
| S-03 | P0 | Produtor | Caderno restrito da própria fazenda | Abrir por rota direta | Bloqueado | Pendente |  |
| S-04 | P0 | Produtor | Registro de outro autor | Editar caderno por rota direta | Bloqueado | Pendente |  |
| S-05 | P0 | Colaborador | Visita fora do escopo | Abrir por rota direta | Acesso bloqueado/volta | Pendente |  |
| S-06 | P0 | Colaborador | Fazenda fora do escopo | Criar/editar visita por rota direta | Bloqueado | Pendente |  |
| S-07 | P0 | Colaborador | Registro de caderno fora do escopo | Abrir detalhe/editar por rota direta | Bloqueado | Pendente |  |
| S-08 | P0 | Produtor | Caderno de outra fazenda | Abrir por rota direta | Bloqueado | Pendente |  |
| S-09 | P1 | Admin | Registro de caderno existente | Abrir detalhe do caderno | Detalhe carrega mesmo se restrito ao produtor | Pendente |  |
| S-10 | P1 | Colaborador | Registro de caderno dentro do escopo | Abrir detalhe | Permitido, inclusive restrito ao produtor | Pendente |  |

**Rodada 2 - Integridade De Contexto**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-11 | P0 | Admin | Visita existente | Editar visita | Fazenda permanece a mesma; alterações salvam | Pendente |  |
| S-12 | P0 | Admin | Registro de caderno existente | Editar caderno | Fazenda fica travada; `fazenda_id` preservado | Pendente |  |
| S-13 | P0 | Colaborador | Caderno existente | Editar caderno | Fazenda travada; alterações salvam | Pendente |  |
| S-14 | P0 | Produtor | Registro próprio | Editar caderno | Permitido; fazenda travada | Pendente |  |
| S-15 | P1 | Admin | Fazenda existente | Criar visita para a fazenda | Salva com `fazenda_id`; aparece na listagem/detalhe | Pendente |  |
| S-16 | P1 | Colaborador | Fazenda dentro do escopo | Criar visita | Permitido; salva com `fazenda_id` correto | Pendente |  |
| S-17 | P1 | Admin | Fazenda existente | Criar caderno pela listagem | Pode escolher fazenda autorizada e salvar | Pendente |  |
| S-18 | P1 | Produtor | Própria fazenda | Criar caderno | Permitido; visível ao produtor | Pendente |  |
| S-19 | P1 | Produtor | Fazenda de outro titular | Criar caderno por rota direta com `fazendaId` | Bloqueado | Pendente |  |

**Rodada 3 - Integração Na Fazenda**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-20 | P0 | Admin | Fazenda no detalhe | Criar caderno pela aba Caderno | Abre `NovoCaderno` já no contexto da fazenda | Pendente |  |
| S-21 | P0 | Colaborador | Fazenda dentro do escopo | Criar caderno pela aba da fazenda | Salva vinculado à fazenda atual | Pendente |  |
| S-22 | P1 | Admin | Detalhe da fazenda | Abrir aba Caderno | Vê registros reais da fazenda atual | Pendente |  |
| S-23 | P1 | Colaborador | Detalhe da fazenda | Aba Caderno | Mostra só registros daquela fazenda | Pendente |  |
| S-24 | P1 | Produtor | Detalhe da própria fazenda | Aba Caderno | Mostra apenas registros visíveis daquela fazenda | Pendente |  |

**Cobertura Complementar**
| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| S-25 | P2 | Admin | Existem fazendas com visitas | Abrir listagem de visitas | Vê visitas de múltiplas fazendas conforme filtros | Pendente |  |
| S-26 | P2 | Admin | Visita existente | Abrir detalhe da visita | Detalhe carrega e mostra contexto da fazenda | Pendente |  |
| S-27 | P2 | Colaborador | Tem região/sub-região | Abrir visitas | Vê apenas visitas de fazendas no escopo | Pendente |  |
| S-28 | P2 | Colaborador | Visita dentro do escopo | Abrir detalhe | Acesso permitido | Pendente |  |
| S-29 | P2 | Produtor | Tem uma ou mais fazendas | Abrir visitas | Vê visitas das próprias fazendas | Pendente |  |
| S-30 | P2 | Produtor | Visita própria | Abrir detalhe | Permitido | Pendente |  |
| S-31 | P2 | Produtor | Caderno visível da própria fazenda | Abrir listagem/detalhe | Permitido | Pendente |  |

**Validações De Ponta A Ponta**
| ID | Fluxo | Resultado esperado | Status | Observação |
|---|---|---|---|---|
| E2E-01 | Criar visita como admin/colaborador -> abrir detalhe -> editar | Fazenda não mudou | Pendente |  |
| E2E-02 | Criar caderno pela aba da fazenda -> cair no detalhe do registro -> voltar à fazenda | Registro aparece na aba | Pendente |  |
| E2E-03 | Editar caderno -> salvar -> abrir detalhe atualizado | `fazenda_id` preservado | Pendente |  |
| E2E-04 | Produtor cria caderno próprio -> abrir listagem e detalhe da fazenda | Registro aparece nos dois lugares | Pendente |  |
| E2E-05 | Produtor tenta acessar caderno restrito por listagem/detalhe/rota direta | Registro não aparece e rota direta bloqueia | Pendente |  |

**Critério Para Encerrar A Frente**
- Todos os casos P0 passam.
- Todos os casos P1 passam ou têm exceção documentada e aceita.
- Nenhum produtor consegue criar/editar visita.
- Nenhum perfil acessa visita ou caderno fora da fazenda autorizada.
- Caderno restrito nunca aparece para produtor.
- Edição de visita e caderno nunca troca a fazenda.
- A aba Caderno da fazenda mostra somente registros daquela fazenda e permite criar no contexto correto.
