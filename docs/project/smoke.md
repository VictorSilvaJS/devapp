22-04-2026 - 10:14

Abaixo está o smoke funcional pronto para execução, sem abrir feature nova.

**Pontos Mais Arriscados**
1. Produtor por rota direta: `NovaVisita`, `EditarVisita`, `CadernoDetail` restrito, `EditarCaderno` de outro autor.
2. Colaborador fora de escopo regional: criação/edição/detalhe de visita e caderno.
3. Preservação de `fazenda_id` em edição de visita e caderno.
4. Caderno no detalhe da fazenda: registros corretos por fazenda e visibilidade para produtor.
5. Criação a partir do detalhe da fazenda: novo caderno nasce vinculado à fazenda atual.

**Checklist De Smoke**
| Perfil | Pré-condição | Ação | Resultado esperado |
|---|---|---|---|
| Admin | Existem fazendas com visitas | Abrir listagem de visitas | Vê visitas de múltiplas fazendas conforme filtros |
| Admin | Visita existente | Abrir detalhe da visita | Detalhe carrega e mostra contexto da fazenda |
| Admin | Fazenda existente | Criar visita para a fazenda | Salva com `fazenda_id`; aparece na listagem/detalhe |
| Admin | Visita existente | Editar visita | Fazenda permanece a mesma; alterações salvam |
| Admin | Registro de caderno existente | Abrir detalhe do caderno | Detalhe carrega mesmo se restrito ao produtor |
| Admin | Fazenda existente | Criar caderno pela listagem | Pode escolher fazenda autorizada e salvar |
| Admin | Fazenda no detalhe | Criar caderno pela aba Caderno | Abre `NovoCaderno` já no contexto da fazenda |
| Admin | Registro de caderno existente | Editar caderno | Fazenda fica travada; `fazenda_id` preservado |
| Admin | Detalhe da fazenda | Abrir aba Caderno | Vê registros reais da fazenda atual |

| Perfil | Pré-condição | Ação | Resultado esperado |
|---|---|---|---|
| Colaborador | Tem região/sub-região | Abrir visitas | Vê apenas visitas de fazendas no escopo |
| Colaborador | Visita dentro do escopo | Abrir detalhe | Acesso permitido |
| Colaborador | Visita fora do escopo | Abrir por rota direta | Acesso bloqueado/volta |
| Colaborador | Fazenda dentro do escopo | Criar visita | Permitido |
| Colaborador | Fazenda fora do escopo | Criar/editar por rota direta | Bloqueado |
| Colaborador | Registro de caderno dentro do escopo | Abrir detalhe | Permitido, inclusive restrito ao produtor |
| Colaborador | Registro fora do escopo | Abrir detalhe/editar por rota direta | Bloqueado |
| Colaborador | Fazenda dentro do escopo | Criar caderno pela aba da fazenda | Salva vinculado à fazenda atual |
| Colaborador | Caderno existente | Editar caderno | Fazenda travada; alterações salvam |
| Colaborador | Detalhe da fazenda | Aba Caderno | Mostra só registros daquela fazenda |

| Perfil | Pré-condição | Ação | Resultado esperado |
|---|---|---|---|
| Produtor | Tem uma ou mais fazendas | Abrir visitas | Vê visitas das próprias fazendas |
| Produtor | Visita própria | Abrir detalhe | Permitido |
| Produtor | Qualquer visita | Tentar criar visita por rota direta | Bloqueado |
| Produtor | Qualquer visita | Tentar editar visita por rota direta | Bloqueado |
| Produtor | Caderno visível da própria fazenda | Abrir listagem/detalhe | Permitido |
| Produtor | Caderno restrito da própria fazenda | Abrir por rota direta | Bloqueado |
| Produtor | Caderno de outra fazenda | Abrir por rota direta | Bloqueado |
| Produtor | Própria fazenda | Criar caderno | Permitido; visível ao produtor |
| Produtor | Fazenda de outro titular | Criar caderno por rota direta com `fazendaId` | Bloqueado |
| Produtor | Registro próprio | Editar caderno | Permitido; fazenda travada |
| Produtor | Registro de outro autor | Editar caderno por rota direta | Bloqueado |
| Produtor | Detalhe da própria fazenda | Aba Caderno | Mostra apenas registros visíveis daquela fazenda |

**Validações De Ponta A Ponta**
- Criar visita como admin/colaborador → abrir detalhe → editar → confirmar que a fazenda não mudou.
- Criar caderno pela aba da fazenda → cair no detalhe do registro → voltar à fazenda → registro aparece na aba.
- Editar caderno → salvar → detalhe atualizado → `fazenda_id` preservado.
- Produtor cria caderno próprio → registro aparece na listagem e no detalhe da fazenda.
- Produtor não vê caderno restrito, mesmo por rota direta.

**Critério Para Encerrar A Frente**
- Todos os casos P0/P1 acima passam para admin, colaborador e produtor.
- Nenhum produtor consegue criar/editar visita.
- Nenhum perfil acessa visita ou caderno fora da fazenda autorizada.
- Caderno restrito nunca aparece para produtor.
- Edição de visita e caderno nunca troca a fazenda.
- A aba Caderno da fazenda mostra somente registros daquela fazenda e permite criar no contexto correto.