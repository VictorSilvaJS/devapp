# Decisões Consolidadas

> Revisão documental: 2026-08-24

Este arquivo contém somente decisões vigentes. A cronologia detalhada das
decisões 1 a 38 foi preservada no snapshot arquivado.

## Produto e domínio

1. O produto possui três perfis no primeiro contrato: Administrador,
   Colaborador e Produtor.
2. Propriedade é a unidade operacional e o termo oficial da interface.
3. Produtor é o perfil final; Titular é o responsável principal pela
   Propriedade; Talhão é sua subdivisão interna.
4. Um Produtor pode ser Titular de mais de uma Propriedade.
5. Dados operacionais pertencem ao contexto de uma Propriedade.
6. O MVP prioriza consulta organizada, mapas, Materiais técnicos, Visitas,
   Caderno e uso em campo.
7. O Produtor não administra a estrutura geral do sistema.
8. Internet instável é uma premissa, mas o primeiro offline produtivo é
   conservador e definido por fluxo.

## Acesso e território

- Administrador possui visão global dentro da organização.
- Colaborador depende de vínculo direto e ativo com cada Propriedade.
- Produtor depende de Titularidade ou vínculo autorizado.
- Município e UF servem para localização, busca e filtro.
- Município, UF, Região ou Microrregião não concedem acesso.
- Recurso por identificador fora do escopo deve responder como não encontrado
  no backend; ação negada sobre recurso dentro do escopo deve responder como
  proibida.

Esta decisão substitui a antiga regra territorial do colaborador que usava
sub-regiões ou microrregiões como fonte de autorização.

## Cadastros

- Usuário, Produtor, Propriedade e vínculo são conceitos separados.
- O Administrador cria primeiro o Usuário Produtor.
- Um Produtor sem Propriedade permanece pendente.
- A primeira Propriedade é criada em etapa própria, seleciona o Titular e ativa
  Usuário e Produtor em uma operação atômica. O mock também preserva seu
  vínculo local `titular`; o backend registra a Titularidade somente em
  `propriedades.titular_id`.
- Troca de perfil, troca de Titular e inativação de vínculo são operações
  estruturais e auditáveis.

## Operação local

- Visita usa estados explícitos e não oferece transição inválida em estados
  terminais.
- Caderno nasce enxuto, usa ciclo de vida explícito e preserva autoria e
  histórico.
- Área informada, área mapeada e perímetro são conceitos diferentes.
- O celular consome mapas preparados; não realiza processamento agronômico
  produtivo.
- Foto simulada nunca deve ser apresentada como captura real.
- Visita aceita foto local por câmera ou galeria, por ação explícita.
- Exportação Android só confirma sucesso depois da gravação em destino
  escolhido pelo usuário.
- Localização é foreground e opcional; não há rastreamento em background.

## Decisões de fundação do backend

### 31. Organização única

A Tchê Fertilidade é a única organização do primeiro contrato, identificada
internamente por `org_tche_fertilidade`. Esse ID técnico textual é imutável e
separado do nome de exibição. Multiempresa fica fora do primeiro backend.

### 32. Titular principal

Cada Propriedade possui exatamente um Produtor Titular principal atual. Outros
usuários podem ter vínculo sem se tornarem Titulares. Estados necessários para
autorização não alteram essa responsabilidade cadastral.

### 33. Colaborador por vínculo direto

Colaborador acessa somente Propriedades atribuídas por vínculo
usuario_propriedade ativo. Campos territoriais não fazem parte da autorização
canônica.

### 34. Produtor e primeira Propriedade em duas etapas

O cadastro do Usuário Produtor e a criação da primeira Propriedade são
operações separadas. A segunda operação cria Propriedade, Titularidade e
ativação de forma transacional.

### 35. Mídia local explícita

Cada Visita admite até oito fotos locais de no máximo 20 MB por arquivo.
Captura, seleção, persistência e exportação exigem ação explícita. Não há EXIF,
geotag, upload ou sincronização produtiva.

### 36. Arquitetura do backend v1

O backend será um serviço modular único em Node.js e TypeScript, com REST JSON
versionado, OpenAPI, PostgreSQL/PostGIS, migrations SQL e object storage
privado compatível com S3. IDs são opacos e gerados no servidor. Contratos
novos usam propriedade_id.

### 37. RBAC fixo do primeiro backend

O primeiro backend possui somente Administrador global da organização,
Colaborador por vínculo direto e Produtor por Titularidade ou vínculo.
Permissão é revalidada no servidor por perfil, organização, vínculo, ação e
Propriedade.

### 38. Offline conservador e Android primeiro

Não haverá fila geral de mutações offline no primeiro corte. Consulta
autorizada pode usar cache; Caderno admite rascunho local próprio. Transições,
publicações e envios sensíveis exigem conexão. Notificações iniciais são
in-app, e Android é a primeira plataforma produtiva.

### 39. Titularidade sem duplicação no backend

No banco do backend, `propriedades.titular_id` é a única fonte persistida da
Titularidade e referencia o cadastro de Produtor. `usuario_propriedade` guarda
somente acessos adicionais dos tipos `usuario_autorizado` e `colaborador`; o
tipo `titular` não é aceito nessa tabela.

O acesso do Titular é calculado pela cadeia Propriedade → Produtor Titular
→ Usuário principal. A API pode apresentar `tipo_acesso=titular`,
mas esse valor será derivado. O mock v2 permanece inalterado e sua adaptação
para o contrato do backend pertence à MP-33C.

A MP-33A armazena somente o Titular atual. Histórico e operação de
transferência exigem contrato transacional e auditoria futuros. A conta do
usuário principal pode ser inativada sem invalidar a Titularidade cadastral;
usuário inativo não obtém acesso quando autenticação e autorização forem
implementadas.

### 40. Migrations SQL imutáveis

O backend fixa `node-pg-migrate@9.0.0` e possui `package-lock.json` próprio.
Cada migration usa um arquivo SQL com seções explícitas `-- Up Migration` e
`-- Down Migration` e uma entrada SHA-256 no manifesto.

Durante o desenvolvimento da MP-33A, uma migration nova pode ser ajustada até
ser estabilizada e selada. Depois de integrar a branch-base protegida, ela é
append-only: alteração, renomeação, exclusão, divergência de hash, arquivo sem
entrada, entrada sem arquivo ou identificador duplicado devem falhar antes de
`up`, `down`, `redo` e testes de integração. Correções posteriores sempre usam
uma nova migration. Não há tabela adicional de checksums no PostgreSQL nesta
fase.

### 41. Binários fora do PostgreSQL

PNG, PDF e ZIP não serão armazenados como blobs no PostgreSQL. O banco guardará
metadados e chaves de um futuro object storage privado; o PostGIS será usado
para dados geoespaciais e operações espaciais. A MP-33A não implementa o
storage de objetos.

### 42. Faseamento da MP-33

- MP-33A: fundação do backend, DDL, migrations, saúde/readiness, operação,
  testes e CI;
- MP-33B: autenticação, sessões, refresh tokens, convites, recuperação e
  auditoria genérica;
- MP-33C: raízes de composição separadas para Demo/HTTP, interfaces de
  repositório, sessão segura no cliente e primeira vertical somente leitura de
  Propriedades.

MP-33A e MP-33B não alteraram o mock nem conectaram o aplicativo. Essa
adaptação foi implementada na MP-33C.

As três fases estão concluídas tecnicamente. A MP-33C foi integrada à branch
`backend` pelo PR #2 no commit `cc78a9f`, com CI pós-merge aprovada. Essa
integração não implica deploy, release, publicação ou fechamento dos portões
produtivos.

### 43. Autenticação de fator único da MP-33B

A MP-33B usa tokens opacos stateful e credenciais Argon2id, sem JWT, cookies
ou MFA. A senha possui de 8 a 128 pontos de código Unicode após NFC, blocklist
versionada e regra deliberada `1-de-3` — maiúscula, número ou pontuação/símbolo.
O mínimo de oito sem MFA e essa composição são riscos aceitos; MFA continua
portão obrigatório antes da liberação pública de contas Administradoras.

Prechecks persistidos por IP e identificador ocorrem antes do Argon2id. O
trabalho ativo e a fila são limitados; saturação retorna `429` sem registrar
falha de credencial.

Access vale quinze minutos. A sessão possui trinta dias absolutos e quatorze
dias de inatividade desde o último refresh bem-sucedido. Refresh é rotativo,
sem tolerância a replay, e somente hashes de tokens são persistidos.

### 44. Recuperação, contato secundário e break-glass

Recuperação comum depende do e-mail verificado. Um Admin pode manter um contato
secundário previamente confirmado para recuperar o endereço principal sem
criar sessão automática. Esse é o único caminho operacional de recuperação
Administradora na MP-33B. Se ambos os endereços forem perdidos, não há
recuperação assistida, de plataforma ou break-glass disponível.

Um único Admin pode aprovar recuperação assistida de Produtor ou Colaborador,
com risco aceito, motivo categorizado e auditoria. O recurso fica desabilitado
em produção até existir política operacional versionada de validação de
identidade. Recuperação assistida HTTP de conta Administradora permanece
proibida na MP-33B.

O parser de CLI, schema e dois `POST` públicos de continuação permanecem apenas
scaffold fail-closed e inalcançável. A porta e o serviço de domínio não têm
implementação concreta do verificador/emissor, configuração ou wiring
operacional; não existe script npm, HMAC nem privilégio de banco que crie um
caso consumível.

`tche_agro_platform_ops` é exclusivo do bootstrap inicial e da correção de seu
convite pendente. Ele não recebe DML de credenciais, sessões, tokens,
autorizações, recuperações ou break-glass; guards por `SESSION_USER` e estado
final diferido impedem papéis combinados e operações parciais.

Antes de implementar ou habilitar break-glass, é obrigatório adotar Ed25519 ou
serviço externo equivalente que comprove dois aprovadores distintos, finalidade,
expiração e anti-replay. A evolução usa mudança deliberada, testes e migration
append-only quando afetar persistência.

Convite geral opera somente sobre `usuario` pendente existente e não cria
Produtor, Propriedade, Titularidade ou vínculo. A auditoria é append-only, a
outbox usa payload temporário criptografado e o runtime do banco não possui
privilégios de atualização, exclusão ou truncate sobre auditoria.

### 45. Demo e produção são composições distintas

O mock permanece no repositório e preserva integralmente o comportamento atual,
mas é usado somente pelo Demo interno e pelos testes. Demo e produção possuem
identificadores de aplicativo e namespaces locais distintos. O grafo estático
e o bundle JavaScript, assim como o grafo nativo Android da composição HTTP,
não contêm módulos, seeds, bootstrap ou credenciais do mock.

No Android, produção preserva `com.tcheagro.mobile` e o Demo usa
`com.tcheagro.mobile.demo`.

A composição produtiva usa exclusivamente HTTP, é a única preparada para as
lojas e não possui fallback para mock. A seleção ocorre no build por raízes de
composição separadas, nunca por preferência persistida ou alternância feita
pelo usuário. A navegação HTTP mostra apenas funcionalidades realmente
conectadas e bloqueia rotas do Demo inclusive quando chamadas por deep link.

### 46. Sessão e proteção local da MP-33C

Na composição HTTP, access token fica somente em memória e refresh token fica
somente no storage seguro nativo (`SecureStore`). Senha, tokens e sessão HTTP
não usam `AsyncStorage`. A renovação é single-flight; cada chamada pode repetir no
máximo uma vez depois de refresh bem-sucedido e nunca reutiliza um refresh
antigo após resultado ambíguo.

No cold start, refresh aceito restaura a sessão sob lock e exige a senha
completa. Somente `503` explícito durante refresh/restauração preserva o segredo;
falha de transporte ambígua limpa a sessão. Com sessão carregada, transporte,
`429` ou `5xx` em `/v1/auth/me` preserva a identidade local sob tela
indisponível.
Logout invalida a identidade e descarta respostas em curso; ele não promete
desfazer mutação já aceita pelo servidor.

Entrar em background cobre os dados imediatamente. Com 15 minutos ou mais em
background, o aplicativo exige novo login. Quinze minutos sem interação no
foreground aplicam bloqueio local, mas ausência de toque não encerra nem revoga
a sessão automaticamente. Bloqueio visual e logout são operações distintas.

A composição HTTP da MP-33C é online-only. Não existe cache persistente de
negócio, restauração offline ou fila de sincronização nesse piloto. Offline
seguro será uma evolução posterior; indisponibilidade nunca seleciona o mock.

### 47. Vertical de Propriedades da MP-33C

A primeira vertical HTTP usa exclusivamente `GET /v1/propriedades` e
`GET /v1/propriedades/:id`; não existe duplicação por
`/v1/me/propriedades`. Ela é somente leitura, usa cursor estável e aplica
busca/filtros no servidor depois de restringir a consulta ao escopo autorizado.

O contrato JSON é exclusivamente `snake_case`. `tipo_acesso` é calculado como
`admin`, `titular`, `usuario_autorizado` ou `colaborador`; não é persistido.
Métricas dependentes do conjunto completo ficam ocultas até existir endpoint
agregado autorizado. Escritas de Propriedades e administração de Usuários ou
vínculos permanecem na MP-35.

### 48. Conta, links e dados de QA da MP-33C

Convite, senha, e-mail e recuperação são apresentados como fluxos concluídos
pela própria pessoa. O segundo e-mail previamente verificado do Administrador
é mantido, a recuperação assistida segue as restrições da MP-33B e operações
administrativas de negócio permanecem na MP-35.

Links de ação usam Android App Links e o contrato equivalente de iOS Universal
Links. O domínio oficial e seus arquivos de associação devem estar definidos e
validados antes da aprovação produtiva; Android continua sendo a primeira
plataforma.

Testes automatizados usam dados sintéticos criados no PostgreSQL do
Testcontainers. Fixture manual exige comando explícito, ambiente permitido,
`ALLOW_QA_FIXTURES=true`, `QA_FIXTURES_DATABASE_URL` dedicada a banco
`_test`/`_qa` e `QA_FIXTURES_PASSWORD` compatível com a política. Não existe
seed automático nem produtivo, e dados do mock não são promovidos ao backend.

### 49. Corte mínimo de notificações da MP-34

O corte mínimo aprovado da MP-34 usa notificações in-app individuais,
persistidas e online-only para fatos reais da própria conta. Evento e entrega
são gravados na mesma transação do fato de origem. `outbox_email` permanece
separada e não é reutilizada como armazenamento ou transporte de notificação
in-app.

O primeiro destino permitido é somente `conta`, e o destinatário é o próprio
Usuário afetado. Não entram cache persistente, operação offline, push, token de
dispositivo, fan-out de Propriedade nem ampliação de RBAC. Recursos operacionais,
MP-35 e fases posteriores permanecem fora desse corte.

### 50. Catálogo, retenção e manutenção de notificações da MP-34

O catálogo emissor inicial contém somente `conta.senha_alterada.v1`,
`conta.email_principal_alterado.v1` e `conta.recuperacao_concluida.v1`. Cinco
fluxos emissores transacionais produzem esses três tipos: troca de senha,
alteração normal de e-mail, recuperação comum, recuperação de Administrador por
segundo e-mail e recuperação assistida. Todos emitem prioridade `alta`; o
contrato de entrega continua aceitando `baixa`, `normal` e `alta` para evolução
compatível.

Os textos aprovados são, respectivamente, `Senha alterada` / `A senha da sua
conta foi alterada.`, `E-mail principal alterado` / `O e-mail principal da sua
conta foi alterado.` e `Recuperação concluída` / `A recuperação da sua conta foi
concluída.`. Produtores não enviam título, resumo, HTML, URL ou texto livre.

Entregas e chaves idempotentes do corte expiram exatamente 90 dias após seus
respectivos instantes de criação/processamento. A purga é um comando one-shot
em lotes, executado por credencial membro do papel `NOLOGIN`
`tche_agro_notifications_maintenance`, sempre separado do runtime. Responsável,
agendamento/frequência, alertas, provisionamento do segredo e revisão
jurídica/de privacidade continuam portões produtivos, não decisões em aberto do
código.

Versão-base continua obrigatória para transições versionadas. Leitura
individual, leitura em lote e descarte de notificações são a exceção estrita:
por serem monotônicos, não aceitam `version`/versão-base e usam
`Idempotency-Key` vinculada ao comando, alvo/corte e hash do pedido. Essa
exceção não pode ser generalizada para outro comando.

A MP-34 não implementa legal hold nem suspensão de descarte. A revisão
jurídica/de privacidade externa deve validar essa premissa junto com os 90 dias;
se ela exigir a capacidade, a mudança será futura, explícita e versionada antes
da produção.

A implementação dessas decisões foi concluída tecnicamente e integrada
diretamente à branch `backend` no commit `e787707`, sem pull request e com os
três jobs da CI pós-push aprovados. Não houve tag, deploy, release ou publicação
da MP-34.

## Contratos que detalham as decisões

- [Baseline do backend v1](baseline-backend-v1-2026-08.md)
- [Modelo de dados v2](modelo-dados-mock-v2.md)
- [Modelo territorial](modelo-territorial.md)
- [Modelo de Material técnico](modelo-material-tecnico.md)
- [Matriz de RBAC](matriz-rbac-backend.md)
- [Política de sessão](politica-sessao.md)
- [Contrato de autenticação e recuperação da MP-33B](contrato-autenticacao-mp33b.md)
- [Contrato de integração do aplicativo da MP-33C](contrato-integracao-app-mp33c.md)
- [Contrato de notificações](contrato-notificacoes.md)
- [Ciclo do Caderno](ciclo-vida-caderno.md)
- [Estados de Visita](estados-visita.md)
- [Versionamento de GeoJSON](versionamento-geojson-talhoes.md)

## Como alterar uma decisão

Uma decisão só deve ser modificada com evidência nova, impacto registrado nos
contratos relacionados e atualização simultânea de estado, pendências e
testes aplicáveis.
