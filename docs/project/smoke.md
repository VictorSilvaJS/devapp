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
6. Criação de visita pelo detalhe da propriedade: `NovaVisita` deve pré-selecionar/travar a propriedade contextual e manter bloqueio fora de escopo.
7. Material Técnico em mapas: botão/modal devem ficar claros como mock visual, sem upload real, storage, Drive ou cadastro persistente.
8. Padronização visual: componentes-base devem preservar comportamento, filtros, permissões, rotas e linguagem visível de `Propriedade` onde aplicável.
9. Mapas/anexos de fertilidade: nomenclatura visual deve diferenciar `Anexos de fertilidade`, `Mapa de fertilidade` e `Material técnico`, sem alterar download, filtros, permissões ou contratos.

**Rodada Cadastros - Padronização Visual/Textual Do Bloco 5C**

Observação geral: esta rodada valida apenas rótulos, títulos, subtítulos, seções,
mensagens de ajuda e leitura visual dos fluxos de cadastro. Não deve validar
mudança de payload, mock, rotas, permissões, contratos, helpers técnicos,
autenticação ou backend.

| ID | Criticidade | Perfil | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| CAD-01 | P0 | Admin | Usuários | Acessar Admin -> Usuários e abrir Novo/Editar Usuário | Perfis aparecem como `Produtor`, `Colaborador` e `Administrador`; não aparece `Admin` como label principal; seções `Dados do usuário` e `Perfil de acesso` aparecem corretamente | Reexecutar | Valor interno `admin` deve permanecer invisível como label principal |
| CAD-02 | P0 | Admin | Usuário Produtor | Criar/editar usuário com perfil Produtor | Seção `Vínculos do Produtor` aparece; texto deixa claro que Produtor é perfil de usuário; vínculos são com `Propriedades` | Reexecutar | Não confundir nome do usuário com nome da propriedade |
| CAD-03 | P0 | Admin | Cadastro rápido | No usuário Produtor, acionar cadastro rápido de propriedade quando disponível | Cadastro rápido aparece como propriedade visual/mockada; campos da propriedade ficam separados dos dados do usuário | Reexecutar | Não criar interpretação de backend, login real ou transação real |
| CAD-04 | P0 | Admin | Usuário Colaborador | Criar/editar usuário com perfil Colaborador | Seção `Escopo do Colaborador` aparece com Região, Microregião e Propriedades atribuídas; texto indica escopo territorial/propriedades | Reexecutar | Conferir que a tela não promete alteração da permissão real |
| CAD-05 | P0 | Admin | Usuário Administrador | Criar/editar usuário com perfil Administrador | Seção `Dados administrativos` aparece; label visível usa `Administrador`; valor interno `admin` não aparece para o usuário | Reexecutar | Não alterar valor interno do perfil |
| CAD-06 | P0 | Admin | Propriedades | Acessar listagem de propriedades | Tela/listagem aparece como `Propriedades`; ação principal aparece como `Nova Propriedade`; conferir leitura de Titular, Região, Microregião, Área e Status quando disponíveis | Reexecutar | Arquivo/componente atual: `PropriedadesScreen`; rota interna ainda legada: `Produtores` |
| CAD-07 | P0 | Admin | Nova Propriedade | Abrir cadastro de Nova Propriedade | Tela não aparece como `Novo Produtor`; seções `Dados da Propriedade`, `Titular da Propriedade`, `Localização e Região` e `Dados produtivos` aparecem | Reexecutar | Titular é produtor vinculado, não nome da propriedade |
| CAD-08 | P0 | Admin | Nova Propriedade | Preencher e salvar Nova Propriedade com dados válidos | Salvamento continua funcionando com os campos técnicos antigos preservados | Reexecutar | Preservar `fazenda_id`, `produtor_id`, `proprietario_id`, `fazendaNome` e `fazendaId` |
| CAD-09 | P0 | Admin | Editar Propriedade | Abrir edição de propriedade existente | Tela aparece como `Editar Propriedade`; seções `Dados da Propriedade`, `Titular preservado`, `Localização preservada` e `Dados produtivos` aparecem | Reexecutar | Titular e localização territorial devem ser lidos como preservados |
| CAD-10 | P0 | Admin | Editar Propriedade | Alterar dados permitidos e salvar | Salvamento continua funcionando sem trocar titular, rota, mock, payload ou permissão | Reexecutar | Validar apenas comportamento existente |
| CAD-11 | P1 | Produtor | Fluxo produtor | Entrar como produtor e abrir suas propriedades | Produtor vê suas `Propriedades`; não aparece `Fazenda` como texto principal; detalhe, mapa, anexos e caderno continuam acessíveis | Reexecutar | Nomes próprios como `Fazenda Sela de Prata I` podem permanecer |
| CAD-12 | P1 | Colaborador | Fluxo colaborador | Entrar como colaborador e abrir propriedades do escopo | Colaborador vê propriedades do escopo; Nova Visita continua funcionando; textos de escopo visual não prometem regra ainda inexistente | Reexecutar | Vinculos visuais não devem ampliar permissão efetiva |
| CAD-13 | P0 | Todos | Regressão rápida | Executar login produtor, colaborador e administrador | Três logins continuam funcionando nos fluxos esperados | Reexecutar | Usar usuários mockados existentes |
| CAD-14 | P0 | Todos | Regressão rápida | Abrir Mapas, Anexos de fertilidade, Visitas, Caderno e Perfil | Fluxos continuam abrindo e preservam linguagem principal de Propriedade quando aplicável | Reexecutar | Não deve haver regressão por padronização textual |

Cobertura confirmada em 2026-06-02: este checklist cobre criacao/edicao de
usuario Produtor, Colaborador e Administrador; Nova Propriedade; Editar
Propriedade; vinculos do Produtor; e escopo do Colaborador. A rodada continua
limitada a validacao manual dos fluxos mockados, sem assumir backend,
transacao real, RBAC final por propriedade ou integridade referencial real.

Atualizacao tecnica em 2026-06-02: as rotas de stack de criacao/edicao foram
migradas para `NovaPropriedade` e `EditarPropriedade`. As tabs `Produtores` e
`Meus Produtores` permanecem legadas temporariamente.

**Rodada Visual - Padronização Com Componentes-Base**

Observação geral: esta rodada valida apenas consistência visual e preservação de comportamento. Não envolve backend, mocks, rotas, permissões, payloads ou renomeação técnica de `Produtor`/`Fazenda`.

Componentes-base envolvidos: `FormField`, `FormFooter`, `SectionCard`, `InfoBox`, `EmptyState`, `SearchBar`, `SegmentedChips` e `RadioCardGroup`.

| ID | Criticidade | Área | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|
| V-01 | P1 | Formulários | Abrir `NovoCadernoScreen`, `EditarCadernoScreen`, `NovaVisitaScreen`, `EditarVisitaScreen`, `EditarPropriedadeScreen`, `NovaPropriedadeScreen`, `NovoUsuarioScreen` e `EditProfileScreen` | Campos, seções e rodapés usam componentes-base sem alterar payloads, permissões ou rotas | Reexecutar | Em `NovoUsuarioScreen`, conferir `SectionCard`, `FormField`, `FormFooter`, `InfoBox` e `SegmentedChips` nos grupos equivalentes |
| V-02 | P1 | Detalhes | Abrir `ProdutorScreen`, `UsuarioDetailScreen`, `PerfilScreen` e telas relacionadas | Seções, avisos e estados vazios usam padrão visual sem expor campo técnico cru como informação principal | Reexecutar | Preservar linguagem `Propriedade` quando aplicável |
| V-03 | P1 | Listagens | Abrir `CadernoCampoScreen`, `VisitasScreen`, `UsuariosScreen` e `MapasScreen` | Busca, chips/filtros equivalentes e estados vazios usam componentes-base sem mudar filtros existentes | Reexecutar | Em `MapasScreen`, conferir `SearchBar`, `EmptyState`, `SegmentedChips`, `SectionCard` e `InfoBox`; preservar navegação para detalhe/novo registro |
| V-04 | P1 | Propriedades | Abrir `PropriedadesScreen` pela rota `Produtores` | Listagem principal continua visível como `Propriedades`, preservando a rota técnica legada | Reexecutar | Não renomear rota; manter `Produtores` e `Meus Produtores` até fase de aliases/migração |
| V-05 | P0 | Regressão | Exercitar filtros, busca, limpeza de filtros e navegação nas listagens padronizadas | Resultado funcional idêntico ao comportamento anterior, apenas com composição visual padronizada | Reexecutar | Conferir status, período, ordenação e escopo |
| V-06 | P0 | Admin/Usuários | Abrir `NovoUsuarioScreen` e alternar entre perfis produtor, colaborador e admin | Blocos condicionais, validações e salvamento permanecem iguais; muda apenas a composição visual | Reexecutar | Preservar `buildUsuarioAdminPayload`, `buildUsuarioFormFromMock`, `Produtor.create`, `vinculos_propriedades`, `vinculos_microregioes` e campos legados |
| V-07 | P0 | Mapas | Abrir `MapasScreen`, exercitar busca, categoria, ordenação, safra, talhão, contexto de propriedade, mapa dos talhões e anexos | Padronização é apenas visual; materiais, demarcações, previews e navegação mantêm comportamento anterior | Reexecutar | Preservar `ShapeRenderer`, `FazendaMapaScreen`, `MapaFazendaView`, `buildFazendaMapaRouteParams`, `avaliarDownloadMapa`, `Mapa.update`, `ConfirmDialog`, preview de asset interno, permissões, filtros de acesso, mocks, rotas, payloads e campos legados |

**Rodada Mapas - Anexos De Fertilidade**

Observacao geral: esta rodada valida apenas a nomenclatura visual e a leitura defensiva de metadados ja existentes no mock. Nao envolve backend, upload, storage, Drive, rotas, permissoes, filtros, contratos ou integracao do tipo `AnexoFertilidade`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| M-01 | P0 | Produtor/Admin/Colaborador | Propriedade Sela de Prata I acessivel | Abrir `MapasScreen` no contexto da propriedade | A secao de fertilidade aparece como `Anexos de fertilidade` quando aplicavel | Reexecutar | Nao deve alterar permissao nem filtro |
| M-02 | P0 | Produtor/Admin/Colaborador | `MapasScreen` com filtro Fertilidade | Conferir os cinco PNGs da Sela de Prata I | Itens aparecem como `Anexo de fertilidade PNG` e mostram elemento, profundidade, safra, talhao/propriedade inteira e nome original quando existir | Reexecutar | Usa `elemento_label`, `talhao_nome` e `arquivo_nome_original` com fallback |
| M-03 | P0 | Produtor/Admin/Colaborador | Anexo de fertilidade disponivel | Tocar em `Abrir anexo` | Preview/abertura do anexo continua funcionando como antes | Reexecutar | Preservar `avaliarDownloadMapa` e preview de asset interno |
| M-04 | P1 | Produtor/Admin/Colaborador | Existem materiais de categorias diferentes | Alternar categorias/filtros | Materiais tecnicos genericos continuam separados dos anexos de fertilidade | Reexecutar | `Material tecnico` nao deve substituir `Anexo de fertilidade` |
| M-05 | P1 | Produtor/Admin/Colaborador | Lista de materiais aberta | Exercitar busca por elemento, safra, talhao/propriedade e nome original | Busca e filtros continuam com comportamento anterior | Reexecutar | Sem mudanca de contrato ou payload |

**Rodada Colaborador - Microfase Para Teste Interno**
Login principal de teste: `carlos@agrotche.com` / `colab123`.

| ID | Criticidade | Perfil | Pré-condição | Ação | Resultado esperado | Status | Observação |
|---|---|---|---|---|---|---|---|
| C-01 | P0 | Colaborador | Login `carlos@agrotche.com` / `colab123` | Entrar no app | Abre fluxo do colaborador com Home, Propriedades, Visitas, Caderno e Perfil | Reexecutar | Microfase validada tecnicamente; pendente teste manual interno |
| C-02 | P0 | Colaborador | Home aberta | Abrir listagem principal | Listagem visível favorece `Propriedades`, preservando nomes internos legados | Reexecutar | Não renomear rotas/arquivos/`fazenda_id` |
| C-03 | P0 | Colaborador | Propriedade dentro do escopo | Abrir detalhe -> Visitas Técnicas -> Nova Visita | `NovaVisita` abre com propriedade pré-selecionada e travada | Reexecutar | Usa `fazendaId` opcional por rota |
| C-04 | P0 | Colaborador | Nova visita aberta pelo detalhe | Preencher e salvar visita | Visita salva no mock com a propriedade contextual e respeita escopo | Reexecutar | Sem backend real |
| C-05 | P0 | Colaborador | Aba/listagem Visitas aberta | Tocar em Nova Visita global | Seletor normal de propriedade permanece disponível | Reexecutar | Fluxo global não deve ficar travado |
| C-06 | P0 | Colaborador | Propriedade fora do escopo | Tentar criar visita por rota/contexto direto | Acesso bloqueado; não cria visita fora do escopo | Reexecutar | Regra por região/sub-região |
| C-07 | P1 | Colaborador | Panorama/Mapas aberto | Revisar botão/modal de Material Técnico | Interface informa mock/protótipo visual, sem upload/storage/Drive/backend/cadastro real | Reexecutar | Conceito correto: Material Técnico; arquivo é recurso anexado |
| C-08 | P1 | Colaborador | Mapas sem dados em algum contexto | Ver mensagens vazias | Empty states diferenciam ausência de demarcação/talhões e ausência de materiais técnicos/anexos | Reexecutar | Mensagens simples para teste interno |
| C-09 | P1 | Produtor | Fluxo do produtor disponível | Conferir detalhe, visitas, mapas e caderno | Produtor não ganha criação de visita nem acesso administrativo a Material Técnico | Reexecutar | Risco de regressão baixo, mas deve ser conferido |

**Rodada Admin -> Usuarios - Microfase Backend-Ready Mockada**
Login principal de teste: usuario admin mockado disponivel no app.

Observacao geral: esta rodada valida apenas o MVP visual/mockado. Usuario criado ou editado em `Admin -> Usuarios` nao cria login real, senha real, convite, reset, sessao, API ou banco.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| U-01 | P0 | Admin | Login admin ativo | Abrir Admin -> Usuarios -> Novo Usuario | Formulario exibe nome, e-mail, telefone, documento, perfil, status e observacoes | Reexecutar | Campos comuns completos para o mock |
| U-02 | P0 | Admin | Novo Usuario aberto | Criar produtor ativo com ao menos uma propriedade vinculada | Usuario produtor e criado no mock; detalhe mostra propriedade vinculada, tipo de vinculo e principal | Reexecutar | Pode ter multiplas propriedades |
| U-03 | P0 | Admin | Novo Usuario aberto | Tentar criar produtor ativo sem propriedade vinculada | Salvamento bloqueado com aviso de vinculo obrigatorio | Reexecutar | Produtor ativo exige propriedade |
| U-04 | P0 | Admin | Novo Usuario aberto | Criar produtor pendente sem propriedade vinculada | Usuario pendente e criado no mock sem propriedade | Reexecutar | Pendente pode aguardar vinculo |
| U-05 | P0 | Admin | Novo Usuario aberto | Criar colaborador ativo com regiao e microregiao/sub-regiao | Usuario colaborador e criado; detalhe mostra microregiao/sub-regiao | Reexecutar | Usa relacao visual `usuario_microregiao` |
| U-06 | P0 | Admin | Novo Usuario aberto | Criar colaborador ativo com propriedade atribuida e sem microregiao | Usuario colaborador e criado; detalhe mostra propriedade atribuida | Reexecutar | Nao altera permissao efetiva |
| U-07 | P0 | Admin | Novo Usuario aberto | Tentar criar colaborador ativo sem microregiao e sem propriedade atribuida | Salvamento bloqueado por falta de escopo | Reexecutar | Escopo minimo obrigatorio no mock |
| U-08 | P0 | Admin | Novo Usuario aberto | Criar admin sem propriedade e sem microregiao | Usuario admin e criado; detalhe mostra acesso global e nivel administrativo | Reexecutar | Admin nao exige vinculos operacionais |
| U-09 | P0 | Admin | Existe usuario com e-mail conhecido | Tentar criar novo usuario com mesmo e-mail | Salvamento bloqueado por e-mail duplicado | Reexecutar | E-mail unico ao criar |
| U-10 | P0 | Admin | Usuario existente aberto em edicao | Salvar mantendo o proprio e-mail | Edicao permitida, sem falso bloqueio de e-mail duplicado | Reexecutar | Ignora o proprio usuario |
| U-11 | P0 | Admin | Existem ao menos dois usuarios | Editar um usuario usando e-mail de outro usuario | Salvamento bloqueado por e-mail duplicado | Reexecutar | E-mail unico ao editar |
| U-12 | P1 | Admin | Usuario criado pela tela admin | Tentar usar esse usuario como login real | Login real nao deve existir nesta fase | Reexecutar | Auth mock permanece separado |
| U-13 | P1 | Admin/Colaborador | Colaborador com propriedade atribuida visualmente | Entrar no fluxo efetivo do colaborador e verificar permissao | Vinculo visual nao amplia permissao efetiva fora do motor atual | Reexecutar | Nao altera `acessoControle` |
| U-14 | P1 | Admin | Usuario existente aberto em detalhe | Conferir textos visiveis | Nao exibe ID tecnico cru como informacao principal; usa termos Documento, Propriedades, Micro-regioes e Nivel administrativo | Reexecutar | Preservar nomes internos apenas onde necessario |

**Rodada Admin - Sincronizacao Territorial E Vinculos Visuais Mockados**

Login principal de teste: usuario admin mockado disponivel no app.

Observacao geral: esta rodada valida apenas a sincronizacao visual/mockada Regiao -> Microregiao -> Propriedade. Nao ha backend, banco, API real, autenticacao real, RBAC completo, upload/storage, Drive, CRUD real de regioes/microregioes ou migracao do `acessoControle`.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| T-01 | P0 | Admin | Admin -> Usuarios -> Novo Usuario aberto | Selecionar perfil Colaborador e escolher uma microregiao | Colaborador aceita microregiao derivada do mock territorial | Reexecutar | Usa `territorioCompat`; preserva campos legados |
| T-02 | P0 | Admin | Novo Usuario com perfil Colaborador | Selecionar duas ou mais microregioes | Tela mantem multiplas microregioes selecionadas | Reexecutar | Preparacao visual para `usuario_microregiao` |
| T-03 | P0 | Admin | Novo Usuario com perfil Colaborador | Atribuir propriedade especifica ao colaborador | Propriedade atribuida aparece como vinculo visual do mock | Reexecutar | Nao deve alterar permissao efetiva |
| T-04 | P0 | Admin | Colaborador com microregiao selecionada | Conferir previa de propriedades abrangidas | Tela mostra propriedades abrangidas pela microregiao selecionada | Reexecutar | Previa visual, nao filtro de permissao real |
| T-05 | P0 | Admin | Cadastro de Nova Propriedade aberto | Selecionar Regiao e Microregiao derivadas do mock | Formulario aceita selecao e continua salvando `regiao`/`microregiao` textuais | Reexecutar | Compatibilidade legada preservada |
| T-06 | P1 | Admin | Nova Propriedade com microregiao selecionada | Conferir colaboradores sugeridos | Tela sugere colaboradores compativeis com a microregiao | Reexecutar | Sugestao visual por `sub_regioes`/`usuario_microregiao` |
| T-07 | P0 | Admin | Novo Usuario com perfil Produtor | Selecionar propriedade que ja possui produtor principal no mock | Tela exibe alerta de outro produtor principal/titularizacao existente | Reexecutar | Nao reassocia titular automaticamente |
| T-08 | P1 | Admin | Detalhe de propriedade aberto | Conferir bloco de vinculos visuais | Detalhe mostra usuario produtor vinculado e colaboradores sugeridos/relacionados ao territorio | Reexecutar | Bloco administrativo/mockado |
| T-09 | P0 | Admin/Colaborador | Colaborador com vinculo visual novo | Entrar no fluxo efetivo do colaborador e tentar acessar fora do escopo atual | Vinculo visual nao altera permissao efetiva nem amplia acesso fora do motor atual | Reexecutar | `acessoControle` nao foi migrado |

**Rodada Admin - Cadastro Rapido De Propriedade No Usuario Produtor**

Login principal de teste: usuario admin mockado disponivel no app.

Observacao geral: esta rodada valida apenas o MVP visual/mockado. O cadastro rapido nao cria login real, nao usa backend, banco, API, migrations, RBAC completo, upload/storage, Drive, CRUD real de regioes/microregioes ou migracao do `acessoControle`.

Atualizacao visual em 2026-05-31: `NovoUsuarioScreen` foi padronizada com componentes-base, preservando payload, mocks, helpers, schemas, validacoes, permissoes, regras, relacoes visuais e campos legados. O cadastro rapido de propriedade dentro de usuario produtor permanece mockado e deve ser revisado futuramente na etapa de fluxos de cadastro.

Atualizacao visual em 2026-05-31: `MapasScreen` foi padronizada visualmente de forma minima com `SearchBar`, `EmptyState`, `SegmentedChips`, `SectionCard` e `InfoBox`. A alteracao preservou `ShapeRenderer`, `FazendaMapaScreen`, `MapaFazendaView`, `buildFazendaMapaRouteParams`, `avaliarDownloadMapa`, `Mapa.update`, `ConfirmDialog`, preview de asset interno, permissoes, filtros de acesso, mocks, rotas, payloads e campos legados. Nao foram criados upload real, download real ou backend; geometria, selecao de talhao, renderizacao vetorial e filtro de demarcacao/ano LT ficaram intactos. `npm run typecheck`, `npm run test:domain-compat` e `git diff --check` passaram.

| ID | Criticidade | Perfil | Pre-condicao | Acao | Resultado esperado | Status | Observacao |
|---|---|---|---|---|---|---|---|
| QP-01 | P0 | Admin | Admin -> Usuarios -> Novo Usuario -> Perfil Produtor | Preencher produtor ativo e cadastro rapido de propriedade valido | Usuario produtor e propriedade sao criados no mock; vinculo `usuario_propriedade` e criado | Reexecutar | Fluxo mockado de criacao combinada |
| QP-02 | P0 | Admin | Cadastro rapido ativo | Tentar salvar sem campos obrigatorios da propriedade rapida | Salvamento bloqueado; nao cria propriedade vazia | Reexecutar | Validar nome, regiao, microregiao, area total e status |
| QP-03 | P0 | Admin | Cadastro rapido ativo e parcialmente preenchido | Cancelar/limpar cadastro rapido e salvar produtor pendente sem propriedade | Cadastro rapido nao cria propriedade nem vinculo | Reexecutar | Pendente sem propriedade continua permitido |
| QP-04 | P0 | Admin | Novo Usuario com perfil Produtor | Criar produtor pendente sem propriedade existente e sem cadastro rapido | Usuario pendente e criado sem propriedade | Reexecutar | Mantem regra anterior |
| QP-05 | P1 | Admin | Produtor ativo criado com propriedade rapida | Abrir Admin -> Propriedades/listagem de propriedades | Propriedade criada aparece na listagem/mock de propriedades | Reexecutar | Salva via `Produtor.create` |
| QP-06 | P1 | Admin | Produtor criado com propriedade rapida | Abrir detalhe do usuario produtor | Detalhe mostra propriedade vinculada, tipo de vinculo e principal quando aplicavel | Reexecutar | Vinculo via `usuario_propriedade` |
| QP-07 | P1 | Admin | Propriedade criada pelo cadastro rapido | Abrir detalhe da propriedade | Detalhe mostra titular/vinculo visual do produtor no mock | Reexecutar | Preserva `produtor_id`/`proprietario_id`/`fazenda_id` |
| QP-08 | P1 | Admin | Cadastro rapido com microregiao selecionada | Conferir colaboradores sugeridos | Colaboradores aparecem apenas como sugestao visual | Reexecutar | Nao altera permissao efetiva |
| QP-09 | P1 | Admin | Usuario criado pelo cadastro rapido | Tentar usar esse usuario como login real | Login real nao deve existir nesta fase | Reexecutar | Auth mock permanece separado |

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
- No fluxo do colaborador, Nova Visita global mantém seletor normal e Nova Visita contextual trava a propriedade recebida por `fazendaId`.
- Material Técnico permanece claramente mockado e não deve sugerir upload, storage, Drive, backend ou cadastro real.

**Validações Técnicas Da Microfase Colaborador**
- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou.
- `git diff --check`: passou; no Windows, podem aparecer apenas avisos normais de LF/CRLF.
