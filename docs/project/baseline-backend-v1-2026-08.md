# Baseline Aprovada Para O Backend V1

> Status: `ATIVO`; `MP-33A`, `MP-33B`, `MP-33C`, `MP-34`, o corte de
> convergência pré-MP-35 e a `MP-35A` integrados à branch `backend`; a MP-35A
> entrou diretamente no commit `a51389e`
>
> Fechamento: 2026-08-07
>
> Revisão: 2026-08-26
>
> Escopo: baseline do backend e do banco. A fundação foi implementada na
> `MP-33A`; autenticação/conta, na `MP-33B`; integração e primeira leitura de
> Propriedades, na `MP-33C`; notificações in-app, na `MP-34`. A autorização de
> release não está concluída.

## 1. Veredito

As decisões de domínio necessárias para iniciar o backend estão fechadas.
A MP-33 foi dividida em três cortes. A MP-33A criou a fundação, o DDL e as
garantias operacionais; autenticação e sessão foram concluídas na MP-33B; a
integração do aplicativo e a vertical de Propriedades, na MP-33C.

MP-33B e MP-33C foram implementadas e validadas tecnicamente. A MP-33C conecta
somente sua composição HTTP às rotas já disponíveis e à leitura autorizada de
Propriedades; o Demo continua isolado. Isso não implanta ambiente, não fecha os
portões de produção e não autoriza release.

A MP-34 acrescenta notificações individuais da própria conta, persistência,
API, cliente HTTP e purga de retenção. Ela está concluída tecnicamente e foi
integrada diretamente à branch `backend` no commit `e787707`, sem pull request;
os três jobs da CI pós-push foram aprovados. Não houve tag, deploy, release ou
publicação. O smoke funcional específico da fase passou em Android físico em
2026-08-24; os portões de ambiente, operação e release permanecem pendentes.

Um corte corretivo anterior à MP-35 aplica a regra de apresentação
compartilhada que já constava da arquitetura: a interface aprovada no Demo é
reutilizada por componentes que recebem dados e ações, enquanto os adaptadores
locais e HTTP continuam separados. O primeiro corte cobre as capacidades reais
de login, Propriedades, Perfil e Notificações; a validação física da interface
convergida passou em 2026-08-24 nas composições Demo e HTTP. O commit
`e47bb02` integrou o corte diretamente à branch `backend`, e os três jobs da CI
pós-push foram aprovados. Isso não realizou tag, deploy, release ou publicação.

A MP-35A acrescentou os contratos e a fundação persistente administrativa sem
criar endpoints. Ela foi integrada diretamente à branch `backend` no commit
`a51389e`, com os três jobs executados da CI pós-push aprovados. Não houve tag,
deploy, release ou publicação; MP-35B/C/D permanecem fora desse corte.

Não é necessário concluir Materiais produtivos, GeoJSON produtivo, smoke de
campo ou assinatura oficial do APK antes de criar a API e o banco. Esses itens
possuem portões próprios antes de suas respectivas verticais ou do release.

## 2. Arquitetura De Fundação

O primeiro backend seguirá estas decisões:

- backend modular único, sem microserviços no primeiro corte;
- runtime Node.js 24 LTS, com `engines` restrito a `>=24 <25`;
- Fastify 5, `pg` e `env-schema`, sem ORM;
- ESM com `type=module` e TypeScript `NodeNext`;
- API REST JSON versionada em `/v1` e documentada por OpenAPI;
- banco relacional PostgreSQL;
- extensão PostGIS para geometrias e operações espaciais;
- imagem de desenvolvimento e integração `postgis/postgis:17-3.5`;
- migrations SQL versionadas com `node-pg-migrate@9.0.0`, executadas por
  comando ou pipeline e nunca automaticamente no startup da API;
- object storage privado e compatível com S3 para arquivos e geometrias de
  origem;
- URLs temporárias e autorizadas para upload/download;
- processamento assíncrono somente para arquivos, validações pesadas e tarefas
  geoespaciais;
- frontend acessando casos de uso/repositórios, sem trocar importações do mock
  diretamente por HTTP dentro das telas;
- Demo e produção HTTP compostos em raízes distintas, com identificadores e
  namespaces locais separados; o mock continua no repositório para Demo/testes,
  mas não integra o grafo nem o artefato produtivo.

O build produtivo usa `tsc` para gerar JavaScript. Testes TypeScript usam
`node --import=tsx --test`, mantendo `node:test` como runner. Testes
unitários/HTTP não dependem de Docker; integração com PostgreSQL/PostGIS é uma
suíte separada com Testcontainers. O job do aplicativo permanece em Node.js
22, sem ser elevado junto com o backend.

PNG, PDF e ZIP não serão blobs no PostgreSQL. O banco guardará metadados e
chaves do futuro object storage; o PostGIS guardará os dados geoespaciais.

### 2.1 Disciplina das migrations

- cada migration é um arquivo SQL com `-- Up Migration` e
  `-- Down Migration` explícitos;
- `CREATE EXTENSION IF NOT EXISTS postgis` pode fazer parte do `up`, mas o
  `down` não remove a extensão e desfaz somente objetos do aplicativo;
- o manifesto guarda uma entrada SHA-256 por arquivo, com bytes normalizados
  deterministicamente em UTF-8/LF;
- o verificador detecta hash divergente, arquivo sem entrada, entrada sem
  arquivo, identificador duplicado, renomeação, exclusão ou alteração de
  migration já integrada;
- a verificação ocorre antes de `up`, `down`, `redo` e da integração;
- somente migrations presentes na branch-base protegida são imutáveis; as
  novas da MP-33A podem ser ajustadas e seladas depois de estabilizadas;
- a CI de pull request compara as migrations com a branch-base; uma correção
  posterior sempre cria outro arquivo;
- não existe tabela adicional de checksum no PostgreSQL nesta fase.

### 2.2 Garantias operacionais da MP-33A

- configuração inválida falha antes da abertura da porta;
- indisponibilidade temporária do PostgreSQL não impede a API de escutar;
- `/v1/health` independe do banco;
- `/v1/readiness` usa timeout curto, responde `503` enquanto PostgreSQL ou
  PostGIS estiverem indisponíveis e volta a `200` após recuperação;
- `SIGTERM` e `SIGINT` executam shutdown idempotente, fechando Fastify e o pool
  PostgreSQL;
- logs estruturados possuem request ID e ocultam cabeçalhos, credenciais,
  tokens e valores de conexão; configuração integral e mensagens internas do
  PostgreSQL não são registradas;
- produção exige SSL PostgreSQL com validação de certificado X.509; não se usa
  `rejectUnauthorized=false`; a `DATABASE_URL` não aceita parâmetros de
  consulta nem fragmento, evitando que o parser sobrescreva TLS, `search_path`
  ou timeouts tipados;
- testes destrutivos exigem simultaneamente `NODE_ENV=test`, banco terminado
  em `_test` e `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`;
- integração ignora qualquer `DATABASE_URL` do ambiente e usa somente a URL
  produzida pelo Testcontainer;
- se Docker estiver indisponível, a integração é registrada como bloqueada,
  nunca simulada ou declarada aprovada.

### 2.3 Convenções do DDL inicial

- IDs das entidades usam UUID v4 gerado por `gen_random_uuid()`, exceto o ID
  técnico textual e imutável `org_tche_fertilidade`;
- o nome de exibição da organização é um atributo separado de seu ID;
- datas usam `timestamptz`, CHECK constraints possuem nomes estáveis e
  `atualizado_em` é mantido por trigger pequeno e testado;
- PKs, FKs compostas, UNIQUEs, índices únicos parciais e CHECKs locais têm
  prioridade;
- triggers de constraint diferidas existem somente para invariantes realmente
  entre tabelas, e os testes exercitam ordens diferentes dentro da transação;
- os DMLs que participam dessas invariantes são serializados pela linha da
  organização antes de adquirir locks de linha; a validação diferida testa o
  estado final e um cenário concorrente impede write-skew;
- FKs declaram `ON DELETE RESTRICT` ou `NO ACTION` conforme a necessidade de
  diferimento; não existem cascatas destrutivas.

### 2.4 Fundação de segurança da MP-33B

- a API usa credencial membro de `tche_agro_runtime`; migrations usam
  proprietário/migrador; o worker usa `tche_agro_outbox_worker`; o bootstrap
  inicial usa `tche_agro_platform_ops`;
- essas quatro credenciais são independentes em produção, e as três funções de
  concessão criadas pelo DDL são `NOLOGIN`;
- a MP-34 acrescenta uma quinta credencial, membro exclusivo do novo papel
  `NOLOGIN` `tche_agro_notifications_maintenance`, para a purga one-shot de
  notificações; runtime e manutenção não podem ser combinados;
- `tche_agro_platform_ops` opera somente o bootstrap inicial e a correção de
  seu convite pendente; não recebe DML de credenciais, sessões, tokens,
  autorizações, recuperações ou break-glass;
- os DMLs colunares de plataforma sobre Usuário, desafio, convite, outbox,
  bootstrap e auditoria possuem guards por `SESSION_USER` e validação diferida
  do estado final, impedindo papéis combinados e transações parciais;
- a senha usa NFC, 8–128 pontos de código Unicode, regra deliberada `1-de-3`,
  blocklist versionada e Argon2id com trabalho ativo e fila limitados; os
  prechecks por IP e identificador precedem o Argon2, e saturação retorna `429`
  sem contar falha de credencial;
- tokens access e refresh são opacos, stateful e persistidos somente por hash;
- outbox criptografada e worker SMTP são processos separados; Mailpit existe
  somente para desenvolvimento/teste;
- bootstrap do primeiro Admin e sua correção anterior ao aceite são comandos
  CLI one-shot, sem rota HTTP ou emissão de segredo;
- break-glass não possui start operacional: a CLI é scaffold fail-closed; a
  porta e o serviço de domínio não têm implementação concreta do
  verificador/emissor, configuração ou wiring, script npm, HMAC ou privilégio
  de plataforma;
- schema e `POST` de continuação permanecem scaffold inalcançável nesta fase;
  assinatura Ed25519 ou serviço externo equivalente com dois aprovadores é
  pré-requisito técnico antes de implementar ou habilitar um start;
- contato secundário de Admin é previamente confirmado; recuperação assistida
  HTTP de Admin é proibida, e a de Produtor/Colaborador fica condicionada a
  política operacional versionada em produção;
- auditoria é append-only e separada dos logs, sem senha, token, payload
  completo ou dado pessoal usado como evidência; sessão pertence ao ator,
  Usuário afetado é uma referência separada e continuações públicas usam ator
  `sistema`.

## 3. Organização E Identificadores

- Existe uma única organização no primeiro contrato:
  `org_tche_fertilidade`.
- Admin é global somente dentro dessa organização.
- Multiempresa e seletor de organização ficam fora do backend v1.
- IDs produtivos são opacos, imutáveis e gerados pelo servidor.
- Nome, e-mail, Município, UF, código de Talhão e nome de arquivo não são
  chaves de relacionamento.
- Recursos novos usam `propriedade_id`.
- `fazenda_id` e aliases antigos existem apenas na borda de leitura do app
  durante a migração; API e banco v1 não criam esses campos.
- Datas persistidas pelo backend usam UTC; a apresentação converte para o fuso
  do usuário.

## 4. Modelo De Acesso

### 4.1 Perfis do primeiro backend

O primeiro backend possui apenas três perfis:

- `admin`;
- `colaborador`;
- `produtor`.

Não haverá Admin Operacional, Apoio ou papel customizável no primeiro corte.
Caso surja essa necessidade, ela entra como evolução explícita de RBAC.

### 4.2 Escopo

- Admin acessa toda a organização.
- Produtor acessa Propriedades pela Titularidade derivada ou por vínculo ativo
  `usuario_autorizado`.
- Colaborador acessa somente Propriedades com vínculo direto ativo
  `colaborador`.
- Município e UF servem para cadastro e filtro; nunca concedem acesso.
- Rota, ID recebido do cliente ou botão visível não concedem permissão.

### 4.3 Matriz de ações aprovada

| Recurso/ação | Admin | Colaborador | Produtor |
|---|---|---|---|
| Usuários: listar, criar, editar e alterar status | Sim | Não | Apenas autoedição cadastral permitida |
| Vínculos usuário–Propriedade | Sim | Não | Não |
| Propriedade: listar e consultar | Global | Somente vinculada | Somente vinculada |
| Propriedade: criar, editar cadastro e inativar | Sim | Não | Não |
| Titularidade: transferir | Fluxo futuro auditado | Não | Não |
| Talhão publicado: consultar | Global | Somente vinculada | Somente vinculada |
| Safra/Safrinha: administrar | Sim | Somente vinculada | Não |
| Visita: consultar | Global | Somente vinculada | Somente vinculada e liberada |
| Visita: criar, editar agendada, reagendar, concluir e cancelar | Sim | Somente vinculada | Não |
| Visita: complementar, corrigir e anular | Sim | Somente vinculada | Não |
| Caderno: criar, editar e enviar o próprio rascunho | Sim | Somente vinculada | Somente vinculada |
| Caderno consolidado: consultar | Global | Somente vinculada | Somente vinculada e visível |
| Caderno: complementar, corrigir, visibilidade, arquivar, reativar e anular | Sim | Somente vinculada | Não |
| Material: consultar | Global | Somente vinculada | Somente vinculado, publicado e visível |
| Material: criar/substituir rascunho | Sim | Somente vinculada | Não |
| Material: publicar, rejeitar ou arquivar | Sim | Não | Não |
| GeoJSON: importar/reconciliar rascunho | Sim | Somente vinculada | Não |
| GeoJSON: publicar, rejeitar, arquivar ou restaurar | Sim | Não | Não |
| Notificação: listar, ler e descartar | Somente próprias | Somente próprias | Somente próprias |
| Exportar arquivo | Somente recurso autorizado | Somente recurso autorizado | Somente recurso autorizado e liberado |

As ações excepcionais de Caderno e Visita continuam obrigadas a respeitar
estado, versão, motivo, idempotência e auditoria. Escopo não substitui a
permissão da ação.

## 5. Ciclo Dos Vínculos

`usuario_propriedade` no backend v1 guarda somente acessos adicionais e possui:

- `id`;
- `organizacao_id`;
- `usuario_id`;
- `propriedade_id`;
- `tipo_vinculo`: `usuario_autorizado` ou `colaborador`;
- `status`: `ativo` ou `inativo`;
- `origem`: inicialmente `admin_manual`;
- `criado_por`, `criado_em`, `atualizado_por` e `atualizado_em`;
- motivo obrigatório para inativação.

Regras:

- não existe validade temporal automática no primeiro backend;
- vínculo não é apagado fisicamente;
- não pode existir vínculo ativo duplicado de mesmo usuário, Propriedade e
  tipo;
- o convite pode deixar um Colaborador ativo com zero vínculos; nesse estado a
  autenticação é válida, mas a coleção de Propriedades fica vazia até existir
  vínculo direto ativo;
- `titular` não é valor aceito nem persistido em `usuario_propriedade`;
- `propriedades.titular_id` é a única fonte persistida da Titularidade;
- o acesso efetivo do Titular é derivado pela cadeia Propriedade → Produtor
  Titular → Usuário principal;
- uma resposta pode projetar `tipo_acesso=titular`, sem persistir esse
  valor como vínculo;
- o primeiro banco guarda somente o Titular atual; transferência e histórico
  aguardam contrato transacional e de auditoria;
- redução de escopo revoga/revalida sessão e invalida cache não autorizado.

As garantias do banco cobrem organização comum, referências válidas, tipos
permitidos, ausência de duplicidade ativa e compatibilidade dos vínculos
adicionais. A conta do usuário principal pode ser inativada sem apagar a
Titularidade cadastral, mas uma Propriedade ativa não pode terminar a transação
sem Titular habilitado. A autenticação/autorização bloqueia usuário inativo.

## 6. Usuário, Ativação E Sessão

Estados cadastrais do primeiro backend:

- `pendente`;
- `ativo`;
- `inativo`.

Bloqueio temporário de segurança e remoção lógica são atributos de segurança e
auditoria, não novos valores de `status` no primeiro contrato.

Fluxo aprovado:

1. Admin cria Usuário Produtor como `pendente`.
2. Backend envia convite de uso único para definição de senha; convite novo
   cria credencial e ativa Usuário/Produtor na mesma transação.
3. Produtor e Colaborador ativos podem ter zero Propriedades acessíveis.
4. A criação da Propriedade seleciona Titular obrigatoriamente; se a
   Propriedade for ativa, o Titular precisa estar habilitado.
5. Admin adicional também nasce pendente e aceita convite; senha inicial
   não integra o cadastro nem o seed.
6. Convite e recuperação usam token aleatório, armazenado somente como hash,
   com expiração configurável e uso único.
7. Alteração de e-mail exige nova verificação antes de substituir o endereço
   autenticável.
8. Na MP-35B/C, qualquer mudança de autorização revoga todas as sessões dos
   Usuários diretamente afetados, inclusive ampliações; alterações apenas
   cadastrais preservam a sessão.

A política de sessão de `politica-sessao.md` permanece válida para tokens e
backend: access token de 15 minutos e refresh rotativo com validade absoluta de
30 dias. No cliente da MP-33C, background cobre os dados imediatamente, 15
minutos em background exigem novo login e inatividade no foreground aplica
lock local sem logout automático. A antiga janela de consulta offline de até
24 horas é apenas teto de evolução futura e não é habilitada neste piloto
online-only.

Na MP-33B, a inatividade do backend é de 14 dias desde o último refresh
bem-sucedido. A recuperação comum e a alteração concluída de e-mail revogam
todas as sessões e não autenticam automaticamente. A troca autenticada de
senha revoga as outras sessões e gira access/refresh da sessão atual.

Convite geral aceita `usuario` pendente já existente. Convites novos usam
`ativar_usuario`; `manter_status` permanece compatibilidade histórica. O primeiro Admin
é a única identidade criada pelo bootstrap one-shot. Admin pode confirmar um
e-mail secundário diferente do login; esse é o único caminho operacional de
recuperação Administradora nesta fase. Perda dos dois endereços não é resolvida
por outro Admin, pela plataforma ou pelo scaffold break-glass. Uma evolução só
pode implementar o start depois de adotar Ed25519 ou serviço externo equivalente
que comprove dois aprovadores distintos.

## 7. Respostas, Paginação E Concorrência

### 7.1 Regra `403`/`404`

- `401`: identidade ausente, inválida, expirada ou sessão revogada.
- `403`: usuário autenticado conhece o contexto autorizado, mas não possui a
  ação solicitada.
- `404`: recurso não existe ou está fora do escopo de Propriedades do usuário.
- `409`: duplicidade, versão desatualizada, transição inválida ou conflito de
  integridade.
- `422`: payload bem formado, mas com campos semanticamente inválidos.

Assim, consulta direta a uma Propriedade não vinculada retorna `404`. Tentativa
de um Colaborador vinculado editar o cadastro estrutural retorna `403`.

### 7.2 Envelope de erro

```json
{
  "error": {
    "code": "forbidden",
    "message": "Acesso negado.",
    "request_id": "req_...",
    "details": []
  }
}
```

`message` é segura para apresentação. `details` não inclui dado de outro
usuário, segredo ou confirmação de recurso fora do escopo.

### 7.3 Coleções e comandos

- paginação por cursor estável;
- limite padrão 50 e máximo 100;
- ordenação determinística com ID como desempate;
- filtros em allowlist por endpoint;
- `Idempotency-Key` obrigatória em criações e comandos de transição;
- `version`/versão-base obrigatória nas transições versionadas e nos comandos
  concorrentes cujo contrato avança ou substitui a versão do recurso;
- como exceção estrita, leitura individual, leitura em lote e descarte de
  notificações da MP-34 são comandos monotônicos e não aceitam `version` nem
  versão-base; usam `Idempotency-Key` vinculada ao comando, alvo/corte e hash do
  pedido. Essa exceção não se estende a outra transição;
- nenhuma exclusão física de entidade operacional pelo fluxo comum.

## 8. Política Offline Aprovada

A matriz abaixo continua sendo o alvo conservador das verticais futuras. As
composições HTTP da MP-33C e da MP-34 são online-only, sem cache persistente de
negócio, restauração offline ou fila de sincronização. O Demo preserva seu
funcionamento local, isolado do artefato produtivo.

| Fluxo | Leitura offline | Escrita offline no primeiro corte |
|---|---|---|
| Login, convite, troca de usuário e recuperação | Não | Não |
| Sessão revalidada | Até 24 horas | Não |
| Usuários e vínculos administrativos | Não | Não |
| Propriedades e Talhões publicados | Cache autorizado | Não |
| Caderno | Cache autorizado | Somente rascunho local do próprio usuário |
| Visitas | Agenda/histórico em cache | Não; transições exigem rede |
| Foto nova de Visita | Prévia local no formulário | Upload/envio exige rede; sem fila em background |
| Materiais publicados | Somente arquivo já baixado | Não |
| Importação/publicação de Material | Não | Não |
| GeoJSON publicado | Somente versão já baixada | Não |
| Importação/reconciliação/publicação GeoJSON | Não | Não |
| Notificações | Não; estado somente em memória na composição HTTP | Leitura/descarte exigem rede |

Regras comuns:

- cache segregado por organização e usuário;
- logout e redução de escopo removem chaves e índices não autorizados;
- tokens ficam em storage seguro nativo, nunca em `AsyncStorage`;
- UI identifica dado cacheado e operação que exige conexão;
- não há promessa de sincronização geral ou fila de mutações no primeiro
  backend.

## 9. Notificações E Primeira Plataforma

- Notificações do primeiro corte foram implementadas como in-app individuais
  da própria conta, persistidas e online-only.
- Push, tokens de dispositivo e cache persistente ficam explicitamente fora da
  `MP-34` inicial.
- Entregas e chaves idempotentes expiram exatamente 90 dias após seus
  respectivos instantes de criação/processamento; o evento de auditoria segue a
  retenção independente do domínio de origem.
- `outbox_email` permanece separada; os cinco fluxos emissores de conta gravam
  evento e entrega na mesma transação do fato, convergindo em três tipos de
  evento.
- A purga é one-shot, em lotes e usa a credencial exclusiva de manutenção; seu
  responsável, agendamento, alertas e operação produtiva ainda não estão
  definidos.
- Estado lida/descartada nunca reaparece por expiração ou sincronização.
- A primeira entrega produtiva é Android.
- iOS permanece fora do primeiro release e não bloqueia backend, banco ou QA
  Android.

A validação final do backend executou 41 cenários reais de integração: 15 de
migrations, 8 de autenticação, 7 de ações de conta, 9 de Propriedades/QA e 2 de
notificações.

## 10. Migração Do Mock

Os dados v1 são demonstrativos. Não haverá migração registro a registro para o
backend.

- o app já substitui o snapshot v1 pelo dataset v2 aprovado;
- Região/Microregião não será convertida para autorização;
- o dataset v2 e os contratos v2 são a referência para seed e fixtures;
- aliases legados continuam apenas na leitura das bordas ainda não migradas;
- a remoção desses aliases ocorre por fluxo, com testes;
- dados produtivos futuros entram por carga revisada e autorizada, não por
  promoção automática do `AsyncStorage`.

Isso encerra a necessidade de planilha de migração territorial do mock v1.
O comportamento e a representação atuais do mock permanecem integralmente
inalterados nas MP-33A e MP-33B. A adaptação entre o vínculo local `titular` e a
Titularidade derivada do backend foi implementada exclusivamente na composição
HTTP da MP-33C.

Na MP-33C, o mock permanece como implementação do Demo e dos testes. Produção
usa somente HTTP e não contém fallback nem importação estática do mock. Não há
migração de dados demonstrativos, e a composição HTTP não usa `AsyncStorage`
para token, sessão ou cache de negócio.

## 11. O Que Está Fechado E O Que Continua

### Fechado para iniciar o backend

- organização;
- identidade e IDs;
- Propriedade, Produtor e Titular;
- localização Município/UF;
- escopo direto do Colaborador;
- cadastro em duas etapas;
- perfis e ações do RBAC v1;
- ciclo dos vínculos;
- regra `401`/`403`/`404`/`409`/`422`;
- paginação, idempotência e concorrência;
- matriz offline;
- escopo de notificações sem push;
- Android como primeira plataforma;
- descarte, e não migração, do mock v1.

### Entregas que começam com o backend

- scaffold, migrations, DDL, OpenAPI e garantias operacionais (`MP-33A`);
- autenticação, sessões, refresh tokens, convites, recuperação, outbox e
  auditoria genérica, concluídas tecnicamente (`MP-33B`);
- raízes de composição, interfaces de repositório, sessão segura e primeira
  vertical somente leitura de Propriedades no aplicativo, concluídas na
  `MP-33C`;
- autorização mínima de leitura por Propriedade na própria consulta,
  concluída na `MP-33C`;
- notificações in-app self-only, migration append-only, cinco fluxos emissores
  transacionais, API, composição HTTP e purga one-shot, concluídas tecnicamente
  e integradas diretamente na `MP-34` pelo commit `e787707`;
- convergência da apresentação aprovada nas capacidades HTTP existentes,
  implementada, aprovada no smoke físico e integrada diretamente no commit
  `e47bb02`, com os três jobs da CI pós-push aprovados;
- contratos e fundação persistente administrativa (`MP-35A`), concluídos e
  integrados diretamente no commit `a51389e`, sem endpoints e com CI pós-push
  aprovada;
- escritas administrativas e o restante do RBAC por ação no servidor
  (`MP-35B/C`), seguidos pela integração das telas existentes (`MP-35D`);
- CI do backend;
- observabilidade, backup e restauração.

### Portões posteriores e de release

- MFA de contas Administradoras;
- política operacional versionada para recuperação assistida;
- SMTP, segredos, benchmark Argon2id e capacidade do ambiente-alvo;
- antes de implementar break-glass, Ed25519 ou serviço externo equivalente,
  dois aprovadores distintos, procedimento e teste de ponta a ponta;
- retenção de auditoria, observabilidade, backup e restauração;
- responsável, agendamento, alertas, credencial/segredo e observabilidade da
  purga de notificações;
- validação jurídica/de privacidade externa da retenção exata de 90 dias e da
  premissa aprovada de não implementar legal hold nesse corte; se a revisão
  exigir suspensão de descarte, será necessária alteração futura versionada
  antes da produção;
- parâmetros de retenção e limites de Materiais antes da vertical de arquivos;
- limiares geoespaciais e retenção de rascunhos antes de `MP-37`;
- smoke de localização em campo em `MP-38`;
- keystore, privacidade, telemetria e dados produtivos antes do release;
- patches gerais do Expo em tarefa de manutenção separada.

## 12. Primeira Entrega Recomendada

A MP-33A foi delimitada para conter somente:

1. scaffold do backend em Node.js 24, Fastify 5 e TypeScript;
2. conexão PostgreSQL/PostGIS e migrations de organização, usuários,
   produtores, Propriedades e vínculos adicionais;
3. OpenAPI, health, readiness, logs e graceful shutdown;
4. manifesto e verificação append-only das migrations;
5. testes unitários/HTTP separados da integração com Testcontainers;
6. CI com runtime do aplicativo e do backend separados;
7. documentação operacional.

Autenticação, sessões, refresh tokens, convites, recuperação e auditoria
genérica compõem a MP-33B concluída tecnicamente. Separação Demo/HTTP, sessão
segura no cliente e lista/detalhe HTTP de Propriedades foram concluídas na
MP-33C. Notificações in-app da própria conta, persistência, API e composição HTTP
foram concluídas tecnicamente e integradas diretamente na MP-34 pelo commit
`e787707`, sem pull request e com os três jobs da CI pós-push aprovados. Não
houve tag, deploy, release ou publicação dessa fase; o smoke funcional da MP-34
passou em Android físico em 2026-08-24. A MP-35A acrescenta somente contratos,
constraints, versões, catálogos, snapshot IBGE e idempotência persistente;
escritas administrativas permanecem na MP-35B/C. Materiais, GeoJSON produtivo e Caderno append-only entram
depois que a fundação estiver implantada e observável.
