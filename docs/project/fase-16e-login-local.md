# Fase 16E - Login Local Demonstrativo

Status em 2026-06-05: iniciada a Fase 16E.1 como diagnostico e preparacao
para uma futura autenticacao local demonstrativa. Esta etapa nao implementa
campo novo de senha, autenticacao de usuarios criados no Admin, hash,
redefinicao de senha, bloqueio por status, migracao, backend, JWT, upload,
GeoJSON ou PNG.

## Objetivo Da 16E.1

Mapear o funcionamento atual do login, cadastro administrativo de usuarios,
persistencia local do mock e sessao para preparar uma mudanca pequena e segura
nas proximas microfases.

## Arquivos Analisados

- `App.tsx`
- `src/screens/LoginScreen.tsx`
- `src/auth/AuthContext.tsx`
- `src/auth/authMock.ts`
- `src/navigation/index.tsx`
- `src/screens/PerfilScreen.tsx`
- `src/screens/NovoUsuarioScreen.tsx`
- `src/screens/UsuariosScreen.tsx`
- `src/screens/UsuarioDetailScreen.tsx`
- `src/api/mock.ts`
- `src/api/mockLocalPersistence.ts`
- `src/api/validators.ts`
- `src/domain/contracts.ts`
- `src/domain/domainCompat.ts`
- `src/utils/usuarioAdminCompat.ts`
- `package.json`

## Fluxo Atual Do Login

`LoginScreen.tsx` mantem estado local de `email`, `senha`, exibicao da senha,
erro e modo de acesso rapido. O login manual valida apenas se e-mail e senha
foram preenchidos e chama `login(email.trim(), senha.trim())` do
`AuthContext`. Erros sao mostrados no proprio formulario como textos
demonstrativos, por exemplo credenciais invalidas.

`AuthContext.tsx` chama `authLogin` em `src/auth/authMock.ts`, normaliza o
usuario com `normalizeUsuario`, salva o usuario canonico em estado React e
persiste esse usuario em `AsyncStorage` na chave `@tche:user`. A senha nao e
persistida na sessao porque `authMock.ts` remove `senha` antes de retornar o
usuario autenticado.

O acesso rapido chama `loginRapido(profileKey)`, que usa `authLoginByProfile`
em `authMock.ts` e segue a mesma normalizacao e persistencia da sessao.

`src/navigation/index.tsx` decide as abas depois do login pelo campo
`user.perfil`:

- `admin` abre `AdminTabs`
- `colaborador` abre `ColaboradorTabs`
- qualquer outro perfil autenticado cai no fluxo de produtor (`ClienteTabs`)

Enquanto `AuthContext` restaura a sessao, `Navigation` mostra `LoadingScreen`.
Sem usuario, renderiza `Login`; com usuario, renderiza `Main` e as rotas
autenticadas.

## Origem Atual Das Credenciais

A origem efetiva do login e `src/auth/authMock.ts`. Ali ficam os usuarios
demonstrativos com senha em texto dentro do array `users`. `authLogin` compara
`user.email.toLowerCase() === email.toLowerCase()` e `user.senha === senha`.

Credenciais principais preservadas:

- `admin.demonstracao@example.com` / `admin123`
- `colaborador.campo@example.com` / `colab123`
- `produtor.demonstracao@example.com` / `prod123`

`src/api/mock.ts` tambem possui usuarios iniciais com e-mails e senhas
equivalentes, mas essa nao e a fonte usada pelo login atual. Essa duplicidade
e o principal ponto de atencao para a 16E.2 em diante.

## Usuarios Persistidos

O cadastro administrativo usa `User.create` e `User.update` em
`src/api/mock.ts`, acionados por `NovoUsuarioScreen.tsx`.

O mock local e salvo por `src/api/mockLocalPersistence.ts` na chave
`@tche:mock-mvp:v1`, com `version`, `savedAt` e arrays:

- `users`
- `produtores`
- `usuarioPropriedade`
- `usuarioMicroregiao`
- `visitas`
- `cadernos`
- `mapas`

Na primeira hidratacao, se nao houver snapshot local valido, o app salva o seed
demonstrativo. Se houver snapshot valido, ele substitui os arrays em memoria.
Por isso usuarios criados localmente sobrevivem a reinicio do app no mesmo
dispositivo, mas nao a limpeza de dados/reinstalacao.

Formato atual de um usuario salvo no mock:

- `id`
- `nome`
- `email`
- `telefone`
- `documento`
- `perfil`
- `status`
- `ativo`
- `observacoes`
- `senha`
- campos por perfil, como `produtor_id`, `regiao`, `cargo`,
  `sub_regioes`, `propriedades_atribuidas`, `regioes_acesso`,
  `nivel_administrativo`, `acesso_global`
- relacoes derivadas/retornadas em leitura: `vinculos_propriedades` e
  `vinculos_microregioes`

Hoje o payload administrativo sempre inclui `senha: existing?.senha ||
'mock123'` apenas para satisfazer o validador legado de `User`. Essa senha nao
e exposta no formulario e nao autentica o usuario criado.

IDs novos sao gerados como `u${Date.now()}`. E-mails duplicados sao bloqueados
por comparacao `trim().toLowerCase()` em `User.create`/`User.update` e tambem
por validacao previa na tela.

## Sessao Atual

A sessao salva apenas o usuario canonico atual em `@tche:user`. Nao ha senha,
credencial original, token, JWT, refresh token ou opcao de lembrar acesso.

Na abertura do app, `AuthContext` le `@tche:user`, faz `JSON.parse`, normaliza
o usuario e preenche o estado. O logout chama `authLogout`, limpa contextos de
filtros/notificacoes em `PerfilScreen`, remove `@tche:user` e troca a rota
para `Login`.

## Tratamento Atual De E-mail

No login manual, a tela faz `trim()` antes de chamar `login`. A comparacao em
`authMock.ts` ignora caixa (`toLowerCase`), mas nao normaliza espacos dentro do
mock alem do `trim` feito pela tela.

No cadastro administrativo, a tela e o mock usam `trim().toLowerCase()` para
detectar duplicidade. O payload salvo preserva o e-mail com `trim()`, sem
forcar lowercase no valor armazenado. `User.getByEmail`, quando usado, compara
e-mail de forma exata e sensivel a caixa.

## Tratamento Atual De Status

O mock administrativo reconhece `ativo`, `inativo` e `pendente`. O booleano
`ativo` permanece como compatibilidade: quando `status` esta ausente, `ativo:
false` vira `inativo`; caso contrario o fallback e `ativo`.

No Admin, produtor ativo precisa ter ao menos uma Propriedade vinculada;
produtor pendente pode ficar sem Propriedade; colaborador ativo precisa ter
microregiao/sub-regiao ou Propriedade atribuida; admin nao exige escopo.

O login atual nao verifica `status` nem `ativo`. A regra futura deve ficar no
ponto unico de autenticacao local, antes de persistir a sessao:

- `ativo` pode entrar
- `pendente` deve ser bloqueado com mensagem propria
- `inativo` deve ser bloqueado com mensagem propria

Essa regra nao foi implementada nesta fase.

## Compatibilidade Com Demonstrativos

O acesso rapido e o login manual usam a mesma origem (`authMock.ts`), mas por
caminhos diferentes: manual por e-mail/senha, rapido por `profileKey`. Os tres
acessos principais devem continuar funcionando mesmo quando usuarios locais
passarem a autenticar.

Recomendacao de compatibilidade: na proxima fase, manter `authMock.ts` como
fonte demonstrativa de fallback e adicionar uma camada de autenticacao local
que consulte usuarios persistidos sem remover as credenciais fixas.

## Avaliacao De Senha Local

Opcoes avaliadas:

- Senha em texto no objeto de usuario: simples, mas ruim para privacidade e
  facil de vazar em listagens/snapshots.
- Senha em armazenamento separado: reduz risco de aparecer em listagens e
  permite migracao futura melhor.
- Hash local: melhor que texto puro, mas exige escolher implementacao segura no
  ambiente Expo atual.
- Hash + salt: melhor desenho para credencial local demonstrativa, desde que a
  implementacao seja pequena e testavel.
- Biblioteca instalada: nao ha `expo-crypto`, bcrypt, PBKDF ou biblioteca de
  hash/crypto em `package.json`.

Opcao recomendada para o escopo demonstrativo: criar armazenamento separado de
credenciais locais por `usuario_id`, com e-mail normalizado para busca,
`senha_hash`, `salt`, metadados minimos e sem retornar credenciais em
`User.list`. Para a 16E.2, decidir se vale adicionar `expo-crypto` ou, se nao
houver dependencia nova, manter a autenticacao local ainda atras de um contrato
documentado/testado ate a biblioteca ser aprovada.

Nao recomendar senha em texto no mesmo objeto de usuario como caminho principal,
porque o snapshot `@tche:mock-mvp:v1` e usado amplamente por listagens, testes e
telas administrativas.

## Arquitetura Minima Recomendada

1. 16E.2: criar contrato de credencial local e helper de normalizacao de
   e-mail, sem tela nova.
2. 16E.3: adicionar senha inicial ao cadastro administrativo, sem exibir senha
   em listagens/detalhes e sem logar valor.
3. 16E.4: autenticar usuarios persistidos via camada local e manter fallback
   para `authMock.ts`.
4. 16E.5: bloquear `pendente` e `inativo` no login com mensagens especificas e
   preparar redefinicao pelo Admin.
5. 16E.6: smoke manual no Android, documentacao e validacoes automaticas.

## Riscos Encontrados

- `authMock.ts` e `src/api/mock.ts` duplicam usuarios demonstrativos e podem
  divergir.
- Usuarios criados no Admin ja recebem `senha: 'mock123'` no payload legado;
  usar isso diretamente como senha real criaria um comportamento perigoso.
- `User.list` retorna o objeto lido com `senha`, entao credenciais reais no
  mesmo objeto poderiam vazar para telas, logs ou testes.
- `User.getByEmail` compara e-mail de forma exata, diferente da regra
  case-insensitive usada em login e duplicidade.
- Sessao persistida salva o usuario inteiro em `@tche:user`; uma mudanca futura
  deve evitar colocar credencial nesse objeto.
- Usuarios locais existentes podem nao ter credencial local futura; precisam de
  migracao comportamental ou estado "sem acesso definido".
- Atualizacao de usuario pode sobrescrever campos de credencial se eles ficarem
  no mesmo objeto de `User`.
- Login rapido nao deve quebrar quando a autenticacao local for adicionada.
- Dashboards, filtros e escopos dependem de `perfil`, `produtor_id`,
  `sub_regioes`, `vinculos_microregioes` e vinculos de propriedade; a camada de
  autenticacao local deve retornar o mesmo shape compatibilizado.

## Fora Do Escopo Desta Fase

- novo campo de senha no cadastro
- autenticacao de usuarios novos
- hash de senha
- redefinicao de senha
- bloqueio por status no login
- migracao de dados
- backend
- JWT
- upload
- alteracoes em GeoJSON/PNG
- mudancas visuais grandes

## Validacoes

Esta fase alterou apenas documentacao. Validacoes automaticas a executar apos
o registro:

- `npm run typecheck`
- `npm run test:domain-compat`
- `git diff --check`

## Pontos Que Precisam De Decisao

- Aprovar ou nao a adicao de `expo-crypto` para hash local no Expo atual.
- Definir se credenciais locais terao chave propria no `AsyncStorage`, separada
  de `@tche:mock-mvp:v1`.
- Definir comportamento para usuarios locais ja cadastrados sem senha.
- Definir se e-mail armazenado deve passar a ser normalizado para lowercase ou
  se apenas a chave de busca sera normalizada.
- Definir mensagens finais para bloqueio de `pendente` e `inativo`.
- Definir se o acesso rapido continua visivel no APK demonstravel ou apenas em
  build interna.
