# Fase 16E - Login Local Demonstrativo

Status em 2026-06-05: iniciada a Fase 16E.1 como diagnostico e preparacao
para uma futura autenticacao local demonstrativa. Esta etapa nao implementa
campo novo de senha, autenticacao de usuarios criados no Admin, hash,
redefinicao de senha, bloqueio por status, migracao, backend, JWT, upload,
GeoJSON ou PNG.

Status em 2026-06-05: concluida a Fase 16E.2 com infraestrutura tecnica
isolada de credenciais locais. Esta etapa criou contrato, normalizacao unica de
e-mail, chave propria em `AsyncStorage`, servico de persistencia e testes
automatizados. Nao alterou `LoginScreen`, `AuthContext`, `authMock`, cadastro
administrativo, acesso rapido, sessoes existentes, filtros, GeoJSON ou PNG.

Status em 2026-06-05: concluida a Fase 16E.3 com integracao administrativa da
credencial local no cadastro de Usuarios. Esta etapa adicionou senha inicial na
criacao, redefinicao administrativa na edicao, indicador seguro no detalhe,
sincronizacao de e-mail da credencial, compensacao em falha de criacao e helper
para exclusao de usuario com remocao de credencial. Nao alterou
`LoginScreen`, `AuthContext`, `authMock`, acesso rapido, sessao, backend, JWT,
GeoJSON, PNG, filtros ou dashboards.

## Objetivo Da 16E.1

Mapear o funcionamento atual do login, cadastro administrativo de usuarios,
persistencia local do mock e sessao para preparar uma mudanca pequena e segura
nas proximas microfases.

## Resultado Da 16E.2

A Fase 16E.2 criou `src/auth/localCredentials.ts` como servico isolado para
credenciais locais demonstrativas. Ele nao e chamado pelo login atual e nao
cria credenciais automaticamente para usuarios existentes.

Chave nova de armazenamento:

- `@tche:local-credentials:v1`

Essa chave fica separada de:

- `@tche:mock-mvp:v1`
- `@tche:user`
- objetos retornados por `User.list`
- contratos visuais do Admin

Contrato da credencial local:

- `usuario_id`
- `email_normalizado`
- `senha_hash`
- `salt`
- `versao`
- `criado_em`
- `atualizado_em`

As consultas publicas do servico retornam metadados sem `senha_hash` e sem
`salt`. O snapshot persistido contem hash e salt, mas nao deve conter senha em
texto.

Operacoes implementadas:

- `listCredentialMetadata`
- `findCredentialByUserId`
- `findCredentialByEmail`
- `hasCredential`
- `createCredential`
- `updateCredential`
- `removeCredential`
- `verifyCredential`

Comportamentos definidos:

- `normalizeEmail` aplica `trim()` nas extremidades e `lowercase`, sem alterar
  caracteres internos.
- Usuario sem credencial retorna `false` em `hasCredential`.
- Nenhuma credencial automatica e criada para usuarios antigos.
- `mock123` nao e migrado nem usado como credencial.
- Duplicidade de `usuario_id` e de e-mail normalizado e bloqueada.
- Atualizacao preserva `criado_em` e altera `atualizado_em`.
- JSON invalido no armazenamento e tratado como snapshot vazio, sem derrubar o
  app.
- `updateCredentialEmail`, para atualizar apenas o e-mail normalizado da
  credencial sem trocar hash, salt ou `criado_em`.

Estrategia de hash:

- Foi adicionada a dependencia `expo-crypto` na versao compativel com Expo 48:
  `~12.2.1`.
- O servico encapsula `expo-crypto` em `createExpoLocalCredentialHasher`.
- O salt e gerado com `getRandomBytesAsync(16)` e armazenado em hexadecimal.
- O hash usa `digestStringAsync` com `CryptoDigestAlgorithm.SHA256` sobre uma
  string versionada que combina versao, salt e senha.
- Essa estrategia e local/demonstrativa e nao deve ser descrita como seguranca
  equivalente a backend de producao.
- Para testes, o servico aceita hasher injetavel, evitando dependencia de modulo
  nativo no ambiente Node.

Testes adicionados em `tests/localCredentials.test.js` cobrem:

- normalizacao de e-mail;
- criacao de credencial;
- busca por usuario;
- busca por e-mail ignorando caixa e espacos externos;
- duplicidade de e-mail;
- duplicidade de `usuario_id`;
- verificacao de senha correta;
- rejeicao de senha incorreta;
- atualizacao de senha;
- atualizacao apenas de e-mail, preservando hash, salt e `criado_em`;
- remocao;
- usuario sem credencial;
- armazenamento corrompido/JSON invalido;
- credencial ausente em objetos administrativos;
- ausencia de senha em texto no snapshot persistido.

Validacoes executadas na 16E.2:

- `npm run typecheck`
- `npm run test:domain-compat`
- `npx tsc -p tsconfig.domain-compat.json && node tests/localCredentials.test.js`
- `npx expo install expo-crypto --check`
- `npx expo install --check`
- `npx expo-doctor`
- `git diff --check`

Observacao: `npx expo install expo-crypto` executou `npm install` e o `npm`
relatou vulnerabilidades ja existentes/pendentes no audit. Nao foi executado
`npm audit fix`, porque isso alteraria dependencias fora do escopo desta
microfase.

Resultado do `expo-doctor`: 14 de 16 verificacoes passaram. As duas falhas
registradas nao foram introduzidas pela integracao do servico de credenciais:

- `@types/react-native` esta instalado diretamente, embora o pacote
  `react-native` ja inclua tipos;
- Expo SDK 48 mira Android API 33 ou inferior por padrao, abaixo do requisito
  atual de envio para Google Play. O proprio diagnostico recomenda Expo SDK 50
  ou superior para submissao em loja.

Esses pontos ficam como risco de build/publicacao futura. Nao foram corrigidos
na 16E.2 porque exigem limpeza/upgrade de dependencias fora do escopo desta
microfase.

## Resultado Da 16E.3

A Fase 16E.3 integrou o servico de credenciais locais ao cadastro
administrativo de Usuarios, mantendo a credencial separada do objeto de usuario
e do snapshot do mock.

Arquivos principais:

- `src/screens/NovoUsuarioScreen.tsx`
- `src/screens/UsuarioDetailScreen.tsx`
- `src/auth/localCredentials.ts`
- `src/utils/usuarioLocalAccessAdmin.ts`
- `tests/usuarioLocalAccessAdmin.test.js`
- `tests/localCredentials.test.js`

No cadastro de novo usuario, a tela agora possui:

- `Senha inicial`
- `Confirmar senha inicial`
- botao de mostrar/ocultar senha nos dois campos

A senha inicial e obrigatoria para criar usuario nesta etapa, com minimo de 6
caracteres, confirmacao exata e rejeicao de senha composta apenas por espacos.
A senha nao e aparada silenciosamente, nao recebe valor demonstrativo fixo e
nao usa `mock123`.

Fluxo de criacao:

1. valida o formulario administrativo;
2. valida senha inicial e confirmacao;
3. cria o usuario via `User.create`;
4. usa o `id` retornado pelo mock;
5. cria a credencial via `LocalCredentialService.createCredential`;
6. navega para o detalhe somente depois de usuario e credencial passarem.

Se `User.create` passar e a credencial falhar, o helper
`createUsuarioAdminWithLocalCredential` tenta compensar com `User.delete` do
usuario recem-criado. No mock atual essa remocao e segura para esse ponto
porque remove o usuario e os vinculos administrativos do mesmo `usuario_id`.
Se o rollback tambem falhar, o erro recebe metadados internos
`rollbackFailed`/`rollbackError`, sem registrar senha.

Na edicao de usuario existente, a tela exibe a secao `Redefinir senha local`:

- `Nova senha`
- `Confirmar nova senha`

Campos vazios significam manter a credencial atual. Se um campo for preenchido,
os dois passam pela mesma validacao. Quando ja existe credencial, a tela chama
`updateCredential`; quando o usuario antigo nao possui credencial, chama
`createCredential`. Edicoes comuns de nome, telefone, perfil, status,
observacoes e vinculos nao removem nem trocam a senha local.

Ao editar e-mail de usuario com credencial, a operacao
`updateCredentialEmail(usuarioId, novoEmail)` atualiza somente
`email_normalizado` e `atualizado_em`, preservando `senha_hash`, `salt` e
`criado_em`. A duplicidade de e-mail da credencial e verificada antes de
atualizar o usuario, reduzindo risco de inconsistencia.

Usuarios existentes sem credencial continuam aparecendo normalmente. O detalhe
mostra `Acesso local nao configurado`, e o Admin pode entrar na edicao para
definir senha local. Nao ha criacao automatica de credencial e `mock123` nao e
migrado.

`UsuarioDetailScreen.tsx` mostra apenas o indicador seguro:

- `Acesso local configurado`
- `Acesso local nao configurado`

O indicador usa `hasCredential(usuarioId)`. A tela nao mostra senha, hash, salt
ou datas tecnicas da credencial. Tambem oferece acao para abrir a edicao como
`Definir senha local` ou `Redefinir senha local`.

Exclusao:

- o app ainda nao possui botao especifico de exclusao administrativa de
  usuario nesta tela;
- foi criado o helper `deleteUsuarioAdminAndLocalCredential`, que executa
  `User.delete` e depois `removeCredential(usuarioId)`;
- esse helper foi testado para evitar credencial orfa quando um fluxo de
  exclusao administrativa vier a chamá-lo.

Status:

- credencial pode ser configurada para usuario `ativo`, `pendente` ou
  `inativo`;
- status ainda nao bloqueia login, porque o login local permanece fora desta
  microfase.

Dados que continuam sem senha local:

- payload administrativo salvo em `User.create`/`User.update`;
- snapshot `@tche:mock-mvp:v1`;
- sessao `@tche:user`;
- objetos de `User.list`/`User.get`;
- logs e mensagens de erro.

Testes adicionados/atualizados cobrem:

- criacao com senha valida;
- confirmacao diferente;
- senha menor que 6 caracteres;
- senha apenas com espacos;
- credencial criada com o `id` retornado por `User.create`;
- senha inicial ausente do objeto de usuario e do snapshot
  `@tche:mock-mvp:v1`;
- edicao sem senha preservando credencial;
- redefinicao de senha e rejeicao da senha antiga;
- usuario antigo sem credencial recebendo senha;
- alteracao de e-mail preservando senha;
- duplicidade de e-mail de credencial bloqueada;
- rollback quando a criacao da credencial falha;
- exclusao com remocao de credencial pelo helper;
- indicador baseado em `hasCredential`;
- metadados publicos sem hash e sem salt.

Limites preservados:

- `LoginScreen.tsx` nao foi alterado;
- `AuthContext.tsx` nao foi alterado;
- `authMock.ts` nao foi alterado;
- usuarios criados no Admin ainda nao autenticam;
- acesso rapido demonstrativo continua preservado;
- bloqueio de login por status permanece para fase futura;
- backend, JWT, GeoJSON, PNG, filtros e dashboards nao foram alterados.

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
