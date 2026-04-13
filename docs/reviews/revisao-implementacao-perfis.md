# Revisão de Implementação — Sistema de Perfis de Usuário

**Data:** 26/02/2026  
**Escopo:** Reestruturação completa do sistema de autenticação e controle de acesso com 3 níveis de perfil.

---

## Resumo Geral

O sistema foi alterado para suportar **3 perfis** com permissões distintas:

| Perfil | Quem usa | Acesso |
|--------|----------|--------|
| **admin** | Bruna, César | Acesso total ao Brasil, todas as funcionalidades |
| **colaborador** | Carlos, Ana, Marcos, Patrícia | Mesmas funções do admin, limitado à sua região/sub-regiões |
| **produtor** | João, Maria, Roberto, Fernanda | Apenas visualização/download + incluir dados no caderno de campo |

**Conceito-chave:** `Produtor = Cliente = Proprietário` (mesma pessoa, dono da fazenda).

---

## Índice de Arquivos Alterados

1. [src/auth/authMock.js](#1-srcauthauthMockjs) — Mock de usuários e funções de login
2. [src/auth/AuthContext.js](#2-srcauthAuthContextjs) — Contexto React de autenticação
3. [src/screens/LoginScreen.js](#3-srcscreensLoginScreenjs) — Tela de login
4. [src/utils/acessoControle.js](#4-srcutilsacessoControlejs) — Funções de controle de acesso
5. [src/api/mock.js](#5-srcapimockjs) — Dados mockados (produtores/fazendas)
6. [src/navigation/index.js](#6-srcnavigationindexjs) — Navegação por tabs
7. [src/screens/DashboardScreen.js](#7-srcscreensDashboardScreenjs) — Dashboard principal
8. [src/screens/ClienteDashboardScreen.js](#8-srcscreensClienteDashboardScreenjs) — Dashboard do produtor/proprietário
9. [src/screens/VisitasScreen.js](#9-srcscreensVisitasScreenjs) — Listagem de visitas
10. [src/screens/CadernoCampoScreen.js](#10-srcscreensCadernoCampoScreenjs) — Caderno de campo
11. [src/screens/MapasScreen.js](#11-srcscreensMapasScreenjs) — Tela de mapas
12. [src/screens/NovaVisitaScreen.js](#12-srcscreensNovaVisitaScreenjs) — Formulário de nova visita
13. [src/screens/EditarVisitaScreen.js](#13-srcscreensEditarVisitaScreenjs) — Formulário de edição de visita
14. [src/api/validators.js](#14-srcapivalidatorsjs) — Validadores de dados
15. [src/api/index.js](#15-srcapiindexjs) — Constantes da API
16. [src/api/examples.js](#16-srcapiexamplesjs) — Exemplos de uso da API
17. [src/components/UserProfile.js](#17-srccomponentsUserProfilejs) — Componente de perfil do usuário
18. [entities/User.json](#18-entitiesUserjson) — Schema da entidade User
19. [entities/Produtor.json](#19-entitiesProdutorjson) — Schema da entidade Produtor

---

## Detalhamento por Arquivo

---

### 1. src/auth/authMock.js

**O que era antes:** Objeto simples mapeando perfis para usuários. Login era feito escolhendo o perfil na tela.

**O que mudou:**

- **Estrutura de usuários:** Agora é um array `users[]` com 10 usuários, cada um com campos `email` e `senha`.
- **Usuários cadastrados:**
  - 2 admins: Bruna (`bruna@agrotche.com` / `admin123`), César (`cesar@agrotche.com` / `admin123`)
  - 4 colaboradores: Carlos (Goiás, sub: Goiás 1, Rio Verde, Jataí), Ana (Sul), Marcos (MT), Patrícia (Goiás 2, Goiânia, Anápolis)
    essa parte ficou meio confusa pois esta dando conflito do dashboard com os dados apresentados.
  - 4 produtores: João (`prop1`), Maria (`prop1` — mesma família do João), Roberto (`prop2`), Fernanda (`prop3`)
  verificar como se faz a vinculação e o cadastro.
- **Novas funções exportadas:**
  - `authLogin(email, senha)` — busca por email+senha, retorna dados sem a senha
  - `authLoginByProfile(profileKey)` — atalho para dev/testes (mapa: admin→Bruna, colaborador→Carlos, produtor→João)
  - `authLogout()` — simulação de logout

**Pontos de atenção para revisão:**
- Verificar se as senhas mock estão adequadas para testes ok
- Verificar se os `produtor_id` (prop1, prop2, prop3) estão corretos e batem com os dados do mock.js ok
- Maria e João compartilham `produtor_id: 'prop1'` (login familiar) ok

---

### 2. src/auth/AuthContext.js

**O que era antes:** Função `login(profileKey)` recebia nome do perfil.

**O que mudou:**

- `login(email, senha)` — chama `authLogin(email, senha)`, persiste em AsyncStorage
- `loginRapido(profileKey)` — nova função para dev, chama `authLoginByProfile(profileKey)`
- `actionsValue` agora exporta ambas: `{ login, loginRapido, logout, updateProfile, loading }`
- Imports alterados para: `{ authLogin, authLoginByProfile, authLogout }`

**Pontos de atenção para revisão:**
- Verificar se todos os locais que usavam `login('admin')` foram atualizados para usar `loginRapido('admin')` ou `login(email, senha)`DD

---

### 3. src/screens/LoginScreen.js

**O que era antes:** 3 botões grandes na tela: "Administrador", "Colaborador", "Cliente". Ao clicar, fazia login direto.

**O que mudou:**

- **Formulário de email/senha:** Campos `TextInput` para email e senha
- **Botão de mostrar/ocultar senha** (ícone de olho)
- **Validação básica:** verifica se email e senha estão preenchidos
- **Mensagem de erro** com ícone quando login falha
- **Botão "Entrar"** com gradiente que chama `login(email, senha)`
- **Seção dev colapsável:** link "Acesso rápido (dev)" que expande 3 mini-botões:
  - Admin (Bruna) → `loginRapido('admin')`
  - Colab. (Carlos) → `loginRapido('colaborador')`
  - Produtor (João) → `loginRapido('produtor')`
- **"Colaborador" não aparece** como opção de login para o usuário final — o roteamento é automático
- `KeyboardAvoidingView` + `ScrollView` para evitar teclado sobrepondo campos

**Pontos de atenção para revisão:**
- A seção de dev deve ser removida em produção (ou controlada por variável de ambiente)DD
- Verificar se o layout dos campos está bem posicionado em diferentes tamanhos de telaDD

---

### 4. src/utils/acessoControle.js

**O que era antes:** Funções genéricas com verificações `perfil === 'cliente'`.

**O que mudou (reescrita completa):**

**Helpers de perfil:**
- `isAdmin(user)` — `user.perfil === 'admin'`
- `isColaborador(user)` — `user.perfil === 'colaborador'`
- `isProdutor(user)` — `user.perfil === 'produtor'`
- `podeGerenciar(user)` — `true` se admin OU colaborador

**Acesso regional:**
- `produtorNaRegiao(user, produtor)` — verifica:
  - Admin → sempre `true`
  - Colaborador → compara `user.regiao` com `produtor.regiao` OU `user.sub_regioes` com `produtor.microregiao`
  - Outros → `false`
- `getRegioesDisponiveis(user, produtores)` — retorna lista de regiões acessíveis
- `getSubRegioes(user)` — retorna `user.sub_regioes` de um colaborador

**Acesso a dados (filtros):**
- `temAcessoProdutor(user, produtor)` — Admin=tudo, Produtor=por `proprietario_id`, Colaborador=por região
- `filtrarProdutoresPorAcesso(produtores, user)` — filtra lista completa
- `temAcessoMapa(user, mapa, produtor)` — Produtor só vê se `disponivel_download === true`
- `filtrarMapasPorAcesso(mapas, user, produtores)` — filtra mapas
- `temAcessoCaderno(user, registro, produtor)` — Produtor só vê se `visivel_para_produtor === true`
- `filtrarCadernosPorAcesso(registros, user, produtores)` — filtra cadernos
- `temAcessoVisita(user, visita, produtor)` — Produtor vê visitas das suas fazendas
- `filtrarVisitasPorAcesso(visitas, user, produtores)` — filtra visitas

**Permissões de edição/criação:**
- `podeEditarProdutor(user, produtor)` — Produtor NÃO pode. Admin=sim, Colaborador=se na região
- `podeCriarProdutor(user)` — Apenas admin ou colaborador
- `podeCriarVisita(user)` — Apenas admin ou colaborador
- `podeEditarVisita(user, visita, produtor)` — Produtor NÃO pode
- `podeIncluirCaderno(user)` — **Todos podem** (incluindo produtor — única exceção)
- `podeEditarCaderno(user, registro)` — Produtor pode editar apenas seus próprios registros (`registro.criado_por === user.id`)
- `podeBaixarMapa(user, mapa)` — Produtor só baixa se `disponivel_download`

**Títulos e labels:**
- `getTituloTela(user, tela)` — retorna título conforme perfil (ex: produtor vê "Minhas Fazendas")
- `getLabelPerfil(user)` — admin→"Administrador", colaborador→"Consultor Regional", produtor→"Proprietário"

**Pontos de atenção para revisão:**---
- Campo `visivel_para_produtor` nos dados foi mantido com esse nome (é campo de dados, não de perfil)DD
- A lógica de `produtorNaRegiao` depende de `produtor.microregiao` bater com `user.sub_regioes`DD
- `podeIncluirCaderno` retorna `true` para TODOS — confirmar se esse é o comportamento desejado DD

---

### 5. src/api/mock.js

**O que era antes:** Array de produtores sem vínculo proprietário. Cada produtor era 1 fazenda.

**O que mudou:**

- **Array `users` recriado** espelhando exatamente o authMock.js
- **Campo `proprietario_id` adicionado** a todos os produtores, criando a relação fazenda → proprietário
- **Fazendas expandidas (1:N):**
  - João (`prop1`): p1 "Fazenda Boa Vista" + p1b "Fazenda Horizonte"
  - Roberto (`prop2`): p4 "Fazenda Planalto" (Rio Verde) + p4b "Fazenda Cerrado Alto" (Jataí)
  - Fernanda (`prop3`): p5 "Agrícola Cerrado Verde" (Sorriso) + p5b "Fazenda Ouro Verde" (Lucas do Rio Verde)
  - Pedro (`prop_pedro`): p3 "Estância Santa Clara" (mantido, 1 fazenda)
- **Microregiões atualizadas** para corresponder às sub-regiões dos colaboradores:
  - Ex: "Rio Verde", "Jataí", "Sorriso" — em vez de "GO - Sul", "MT - Norte"
  nao vejo as microegioes

**Pontos de atenção para revisão:**
- Verificar se Pedro Santos (p3, `proprietario_id: 'prop_pedro'`) precisa de um login de usuário correspondente no authMock.js — atualmente ele NÃO tem login
- Verificar se todas as microregiões dos produtores batem com as sub_regioes dos colaboradores
- Revisar se as áreas totais e culturas das fazendas são coerentes

---

### 6. src/navigation/index.js

**O que era antes:** `ClienteTabs` tinha tabs "Minha Propriedade" e "Histórico".

**O que mudou:**

- Tab `"Minha Propriedade"` → renomeada para `"Minhas Fazendas"` (reflete relação 1:N)
- Tab `"Histórico"` → renomeada para `"Caderno"` (mais claro)
- Ícone do tab "Minhas Fazendas" adicionado no `tabScreenOptions`
- Comentário `// produtor = cliente = proprietário` adicionado no `MainTabsComponent`
- `AdminTabs` e `ColaboradorTabs` mantidas sem alteração funcional

**Estrutura de tabs por perfil:**

| Admin | Colaborador | Produtor |
|-------|-------------|----------|
| Dashboard | Dashboard | Minhas Fazendas |
| Produtores | Meus Produtores | Caderno |
| Visitas | Minhas Visitas | Perfil |
| Caderno | Caderno | |
| Perfil | Perfil | |

---

### 7. src/screens/DashboardScreen.js

**O que era antes:** Verificava `perfil === 'cliente'` para redirecionar. Carregava dados de 1 fazenda.

**O que mudou:**

- `'cliente'` → `'produtor'` em todas as verificações de perfil
- Carregamento de dados agora busca **todas as fazendas** do proprietário via `proprietario_id`
- Variável `isProdutorPerfil` criada para clareza
- Cards de estatísticas do produtor agora mostram:
  - "Minhas Fazendas" (contagem)
  - "Minha Área Total" (soma de todas)
- Variável renomeada: `isLastCardForCliente` → `isLastCardForProdutor`

---

### 8. src/screens/ClienteDashboardScreen.js

**O que era antes:** Carregava 1 única propriedade (`propriedade`). Header "Minha Propriedade".

**O que mudou:**

- `propriedade` (singular) → `propriedades` (array) — suporta múltiplas fazendas
- Header alterado para **"Minhas Fazendas"**
- Carregamento filtra por `proprietario_id` para trazer TODAS as fazendas do proprietário
- **Renderização de múltiplos cards de fazenda** com `.map()` — cada card mostra:
  - Nome da fazenda
  - Cidade/Estado
  - Área e cultura
- Seção de estatísticas agrupadas:
  - "Fazendas" (contagem total)
  - "Área Total" (soma de hectares)
  - "Culturas" (lista combinada sem duplicatas)
- Mapas e visitas filtrados por IDs de TODAS as fazendas (`meusIds`)
- Navegação para Mapas usa `primeiraFazenda.id`

em ClienteDashboardScreen.js manter geral com uma melhor vizualização, porem colocar filtro para exibir uma fazenda por vez com seus dados. dd
---

### 9. src/screens/VisitasScreen.js

**O que era antes:** Verificava `perfil === 'cliente'` e buscava 1 produtor.

**O que mudou:**

- `'cliente'` → `'produtor'` na verificação de perfil
- Filtra fazendas por `proprietario_id` para mostrar visitas de TODAS as fazendas do proprietário

em colaborador na parte de visitas tecnicas as informcoes nao estao se apresentando de forma correta,DD
nao encontra os produtores corretos e nao associa correntamente ao colaborador e regiao. com os numeros corretos.?DD
analise e  corrija.DD
tambem analisar  no caso em que o colaborador contorola mais regioes colocar a opção de filtros.DD

faltam ter o campo de adicao de fotos em visitas. DD
---

### 10. src/screens/CadernoCampoScreen.js

**O que era antes:** Mesmo padrão do VisitasScreen com `'cliente'`.

**O que mudou:**

- `'cliente'` → `'produtor'`
- Filtra por `proprietario_id`
- Comentário adicionado: "PODE incluir novos registros no caderno de campo"

-------- no caderno de campo não ha o crud ainda e nao se vizualiza os dados - FALTA RESOLVER

---

### 11. src/screens/MapasScreen.js

**O que era antes:** Sem tratamento específico para colaborador, verificava `'cliente'`.

**O que mudou:**

- `'cliente'` → `'produtor'`
- **Colaborador:** filtra mapas por região/sub-regiões do colaborador
- **Produtor:** filtra mapas apenas das suas fazendas (por `proprietario_id`), e apenas com `disponivel_download === true`
 
 a mesma coisa de dados corretos para aparecer em colaborador
---

### 12. src/screens/NovaVisitaScreen.js

**O que era antes:** Picker de produtores verificava `'cliente'`.

**O que mudou:**

- `'cliente'` → `'produtor'`
- Picker de produtores filtra por `proprietario_id` quando logado como produtor

---

### 13. src/screens/EditarVisitaScreen.js

**O que era antes:** Mesmo padrão com `'cliente'`.

**O que mudou:**

- `'cliente'` → `'produtor'`
- Picker filtra por `proprietario_id`

---

### 14. src/api/validators.js

**O que era antes:** `validateEnum` usava `['admin', 'colaborador', 'cliente']`.

**O que mudou:**

- Enum atualizado para `['admin', 'colaborador', 'produtor']`
- Warning atualizado: `'User: Produtor/Proprietário sem produtor_id vinculado'`

---

### 15. src/api/index.js

**O que era antes:** `PERFIS_USUARIO` continha `'cliente'`.

**O que mudou:**

- `'cliente'` → `'produtor'` na constante `PERFIS_USUARIO`

---

### 16. src/api/examples.js

**O que era antes:** Exemplos usavam `perfil: 'cliente'` e nome "João Cliente".

**O que mudou:**

- Exemplos atualizados para `perfil: 'produtor'` com nomes como "João Proprietário"

---

### 17. src/components/UserProfile.js

**O que era antes:** Default de perfil era `'cliente'`, texto de fallback era `'Cliente'`.

**O que mudou:**

- Default → `'produtor'`
- Fallback display → `'Produtor'`

---

### 18. entities/User.json

**O que era antes:** Enum `["admin", "colaborador", "cliente"]`, sem campo `sub_regioes`.

**O que mudou:**

- Enum → `["admin", "colaborador", "produtor"]`
- Default → `"produtor"`
- **Novo campo `sub_regioes`:** array de strings para sub-regiões do colaborador
- `description` do campo `perfil` atualizada explicando os 3 níveis
- `description` do campo `regiao` atualizada: "Região principal do colaborador"
- `description` do campo `regioes_acesso` atualizada: "Lista de regiões que o admin tem acesso"
- `description` do campo `produtor_id` atualizada: explica relação 1:N e logins familiares

---

### 19. entities/Produtor.json

**O que era antes:** Sem campo `proprietario_id`. ID descrito como "ID do produtor".

**O que mudou:**

- **Novo campo `proprietario_id`:** vincula fazenda ao proprietário (relação 1:N)
- `id` description → "ID único da fazenda/propriedade"
- `nome` description → "Nome do proprietário/produtor"
- `microregiao` description → exemplos atualizados (Goiás 1, Goiás 2, Goiânia, Rio Verde, RS - Norte)

---

## Regras de Negócio Implementadas

### Relação 1:N (Proprietário → Fazendas)
- Um `proprietario_id` pode estar vinculado a MÚLTIPLAS entradas na tabela de Produtores
- Cada entrada = 1 fazenda
- Exemplo: `prop1` (João) → p1 (Fazenda Boa Vista) + p1b (Fazenda Horizonte)

### Logins Familiares
- Múltiplos usuários podem ter o mesmo `produtor_id`
- Exemplo: João (u7) e Maria (u8) ambos têm `produtor_id: 'prop1'`
- Ambos veem as mesmas fazendas

### Sub-regiões de Colaboradores
- Cada colaborador tem uma `regiao` principal e um array `sub_regioes`
- A filtragem compara `user.sub_regioes` com `produtor.microregiao`
- Exemplo: Carlos (Goiás) vê fazendas com microregiao "Goiás 1", "Rio Verde" ou "Jataí"

### Permissões do Produtor
| Ação | Permitido? |
|------|-----------|
| Visualizar dados das suas fazendas | ✅ |
| Baixar mapas (se `disponivel_download`) | ✅ |
| Incluir no caderno de campo | ✅ |
| Editar seus próprios registros do caderno | ✅ |
| Criar/editar produtores | ❌ |
| Criar/editar visitas | ❌ |
| Editar registros de caderno de outros | ❌ |
| Ver dados de outras fazendas | ❌ |

---

## Credenciais de Teste

| Perfil | Email | Senha | Atalho dev |
|--------|-------|-------|------------|
| Admin (Bruna) | bruna@agrotche.com | admin123 | `admin` |
| Admin (César) | cesar@agrotche.com | admin123 | `admin2` |
| Colaborador (Carlos) | carlos@agrotche.com | colab123 | `colaborador` |
| Colaborador (Ana) | ana@agrotche.com | colab123 | `colaborador2` |
| Colaborador (Marcos) | marcos@agrotche.com | colab123 | — |
| Colaborador (Patrícia) | patricia@agrotche.com | colab123 | — |
| Produtor (João) | joao.silva@email.com | prod123 | `produtor` |
| Produtor (Maria) | maria.silva@email.com | prod123 | — |
| Produtor (Roberto) | roberto@email.com | prod123 | `produtor2` |
| Produtor (Fernanda) | fernanda@email.com | prod123 | — |

---

## Pontos Pendentes / Para Discussão


3. **Seção de dev no login:** Os botões de acesso rápido devem ser removidos ou ocultados por flag em produção? POR ENQUANTO APARECE
4. **Funcionalidades do Colaborador:** O colaborador tem exatamente as mesmas telas/botões do admin — a limitação é apenas na filtragem de dados por região. Correto?


**Pontos de atenção para revisão:**
- Verificar se todos os locais que usavam `login('admin')` foram atualizados para usar `loginRapido('admin')` ou `login(email, senha)`
- Verificar se o layout dos campos está bem posicionado em diferentes tamanhos de tela
- Pedro Santos (p3, `proprietario_id: 'prop_pedro'`) precisa de um login de usuário correspondente no authMock.js — atualmente ele NÃO tem login
- A lógica de `produtorNaRegiao` depende de `produtor.microregiao` bater com `user.sub_regioes`
- Verificar se todas as microregiões dos produtores batem com as sub_regioes dos colaboradores - Ex: "Rio Verde", "Jataí", "Sorriso" — em vez de "GO - Sul", "MT - Norte", Pois nao vejo as microegioes para filtrar e ver uma por vez no colaborador
- Revisar se as áreas totais e culturas das fazendas são coerentes
- em ClienteDashboardScreen.js manter geral com uma melhor vizualização, porem colocar filtro para exibir uma fazenda por vez com seus dados.
- em colaborador na parte de visitas tecnicas as informacoes nao estao se apresentando de forma correta,
nao encontra os produtores corretos associados corretamente ao colaborador e regiao, com os numeros corretos. analise e  corrija.
- tambem analisar no caso em que o colaborador contorola mais regioes colocar a opção de filtros para ver por regiao/microregiao separadamente.
- faltam ter o campo de adicao de fotos em visitas.