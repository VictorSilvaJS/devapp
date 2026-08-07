# Plano de Fechamento das Pendências Pré-Backend

> Status: `FECHADO_PARA_INICIO_DO_BACKEND`
>
> Auditoria-base: 2026-08-05; revisão de fechamento: 2026-08-07
>
> Escopo: decisões, contratos, implementações preparatórias, testes e evidências
> que precisam ser fechados antes ou durante a entrada no backend e no banco.
>
> Relação com o plano mestre: este documento não substitui as fases `MP-33` em
> diante. Ele organiza os pré-requisitos anteriores e os portões de entrada de
> cada uma delas.

## 1. Objetivo

Este documento responde, de forma operacional, a quatro perguntas:

1. O que já está decidido e não deve ser rediscutido?
2. Quais decisões ainda precisam de aprovação humana?
3. O que falta implementar antes de trocar o mock por API e banco reais?
4. Quais testes e evidências são necessários para considerar essa transição
   segura?

A auditoria cruzou a documentação ativa de `docs/project/`, o código atual, os
scripts de validação, os contratos complementares e o histórico de smoke. O
resultado é uma fotografia do repositório em 2026-08-05, e não uma autorização
automática para promover hipóteses históricas ao produto.

## 2. Resultado Executivo

Atualização de 2026-08-07: as decisões de fundação foram encerradas em
`baseline-backend-v1-2026-08.md`. Organização, modelo v2, escopo direto,
cadastros, RBAC, vínculos, respostas HTTP, offline e primeira plataforma não
estão mais em aberto. O backend ainda não existe, mas já pode ser iniciado por
`MP-33`; as lacunas restantes são entregas da implementação ou portões de
verticais posteriores.

O corte local demonstrativo está consistente e as fases `MP-00` a `MP-32`
estão registradas como concluídas. Nesta auditoria:

- `npm run typecheck` passou;
- `npm run test:domain-compat` passou integralmente;
- a aplicação continua sem backend, banco, migrações ou contrato OpenAPI reais;
- autenticação, notificações, materiais, GeoJSON, Safra/Safrinha, Visitas e
  Caderno ainda dependem total ou parcialmente de memória, mock, arquivos
  locais ou `AsyncStorage`;
- 30 módulos de execução ainda referenciam `src/api/mock.ts` diretamente;
- `src/api/index.ts` ainda é uma fachada da API mock;
- a sincronização de mapas contém endpoint de exemplo e métodos simulados;
- não foi encontrado workflow de integração contínua em `.github/`;
- a divergência territorial foi encerrada: o v2 não usa Regional,
  Microregião ou Área Operacional e autoriza Colaborador por vínculo direto;
- os documentos `pendencias-de-definicao.md`, `plano-reorganizacao.md` e o
  `README.md` da raiz misturam ou exibem estados anteriores ao corte atual.

Conclusão atual: o projeto está pronto para iniciar o scaffold, o banco e
`MP-33`. A camada de repositórios do app deve começar junto da integração, não
ser usada como justificativa para adiar a construção do servidor.

## 3. Como Usar Este Plano

### 3.1 Prioridades

| Prioridade | Significado |
|---|---|
| `P0-A` | Fechar antes de desenhar o schema produtivo e a API |
| `P0-B` | Fechar antes de iniciar `MP-33` |
| `P1-V` | Fechar antes da vertical produtiva indicada (`MP-34` a `MP-37`) |
| `P1-R` | Fechar antes de APK de campo ou release formal |
| `P2` | Pode ser planejado depois, desde que seja explicitamente excluído do primeiro corte produtivo |

### 3.2 Regra de conclusão

Um item só muda para concluído quando existir:

- decisão registrada no documento ativo adequado;
- contrato ou código coerente com a decisão;
- teste automatizado aplicável;
- smoke físico aplicável;
- evidência ou comando de validação registrado;
- atualização dos documentos ativos afetados.

## 4. Decisões Já Fechadas — Não Reabrir Sem Nova Evidência

| Tema | Direção ativa |
|---|---|
| Vocabulário | `Propriedade` é a unidade operacional visível; `Produtor` é o perfil final; `Titular` é o vínculo cadastral principal; `Talhão` é subdivisão da Propriedade |
| Compatibilidade | `fazenda_id` permanece como contexto operacional técnico temporário; a limpeza total dos nomes legados não bloqueia o MVP |
| Perfis | Admin tem visão administrativa; Produtor consulta a própria realidade operacional; Colaborador respeita escopo territorial |
| Acesso futuro do Colaborador | Vínculo direto ativo com Propriedade é a única fonte de escopo; Município/UF não concedem acesso |
| Produtor | Não recebe edição estrutural de Propriedade, usuário, território ou material técnico |
| Sessão | Access token de 15 minutos, refresh absoluto de 30 dias, bloqueio local após 15 minutos e consulta offline por até 24 horas desde a última revalidação |
| Caderno | Ciclo local de rascunho, confirmação, complemento, correção auditada e preservação de autoria está definido; localização é opcional e explícita |
| Visitas | Máquina de estados, atraso derivado, conclusão, cancelamento, complemento, correção e anulação estão definidos no corte local |
| Materiais no MVP local | Fertilidade, Correção de solo e Prescrição são as três categorias operacionais do corte; a taxonomia agronômica final pode evoluir |
| Arquivos | Prescrição ZIP é tratada como pacote opaco no celular; processamento pesado pertence ao pipeline externo |
| GeoJSON | Talhões publicados formam uma trilha versionada própria e não devem ser confundidos com o catálogo comum de materiais |
| Mapas no celular | O app consulta e exibe; não desenha Talhões nem executa processamento geoespacial pesado |
| Área e perímetro | Área total informada e área mapeada são grandezas distintas; perímetro só pode ser exibido com fonte, método e unidade conhecidos |
| Fotos atuais | Visita aceita foto real local sem EXIF/geotag/upload; fotos de Caderno continuam demonstrativas; nenhuma delas representa mídia produtiva sincronizada |

## 5. Matriz Mestra de Pendências

| ID | Estado/prioridade | Natureza | Pendência | Bloqueia | Evidência de fechamento |
|---|---|---|---|---|---|
| `PRE-01` | `CONCLUIDO` | Governança | Fonte ativa reconciliada pelo resumo atual e pela baseline v1 | — | Baseline e decisões 36 a 38 prevalecem sobre o histórico |
| `PRE-02` | `CONCLUIDO` | Decisão | Organização única e regra de IDs aprovadas | — | `modelo-dados-mock-v2.md` e baseline v1 |
| `PRE-03` | `CONCLUIDO_CONTRATO_LOCAL` | Implementação | Vínculo direto já é a regra v2; aliases restantes são migração incremental | `MP-35` | Município/UF não autorizam; vínculo direto coberto no mock v2 |
| `PRE-04` | `CONCLUIDO_CONTRATO_LOCAL` | Implementação | Cadastro em duas etapas e mutações atômicas locais concluídos | Backend | Decisão 34 e testes do mock v2 |
| `PRE-05` | `CONCLUIDO` | Decisão | RBAC por ação, ciclo dos vínculos e respostas HTTP aprovados | `MP-35` | Baseline v1 e matriz RBAC |
| `PRE-06` | `CONCLUIDO` | Dados | Mock v1 será descartado; não haverá migração territorial registro a registro | — | Auditoria de aliases e bootstrap v2 |
| `PRE-07` | `INICIA_COM_BACKEND` | Contrato | Produzir OpenAPI e migrations | Primeira entrega real | Não é pré-condição; é resultado do scaffold |
| `PRE-08` | `INICIA_COM_BACKEND` | Implementação | Separar telas/casos de uso por repositórios | Integração do app | Deve avançar junto do primeiro adaptador HTTP |
| `PRE-09` | `MP-33` | Segurança | Implementar autenticação e storage seguro | Uso produtivo | Contrato já fechado; implementação é a própria fase |
| `PRE-10` | `CONCLUIDO` | Decisão | Matriz offline conservadora aprovada | — | Baseline v1 |
| `PRE-11` | `P1-V` | Produto/técnica | Fechar pipeline produtivo de materiais e arquivos | Backend de Materiais | Versionamento, storage, MIME, tamanho, auditoria, retenção e autorização aprovados |
| `PRE-12` | `P1-V` | Produto/técnica | Fechar parâmetros produtivos do GeoJSON | `MP-37` | Limiares, retenção, publicação, rollback, cache e conflitos aprovados |
| `PRE-13` | `CONCLUIDO` | Produto | Notificações in-app, sem push, retenção padrão de 90 dias | `MP-34` | Decisão 38 e baseline v1 |
| `PRE-14` | `CONCLUIDO_CONTRATO` | Técnica | Eventos, idempotência e concorrência definidos | `MP-36` e backend de Visitas | Implementação produtiva permanece na vertical |
| `PRE-15` | `P1-R` | Evidência | Fechar smokes físicos ainda relevantes | `MP-38`/release | Matriz canônica executada em aparelho e evidências anexadas |
| `PRE-16` | `NAO_BLOQUEIA_BACKEND` | Dados/negócio | Sela de Prata I não é fonte do dataset v2 | Demo pública/release | Uso externo ainda exige autorização própria |
| `PRE-17` | `P1-R` | Release | Fechar assinatura, segurança, plataformas e observabilidade | Release | Keystore oficial, segredos, política de logs, auditoria de dependências e plataforma-alvo aprovados |
| `PRE-18` | `P2` | Manutenção | Reduzir pontos críticos de acoplamento e documentação obsoleta | Evolução segura | Telas críticas modularizadas na área tocada, README atualizado e CI mínima ativa |

Fechamento de `PRE-06` em 2026-08-07: os identificadores legados foram
inventariados em `auditoria-compatibilidade-fazenda-id-2026-08.md`. Como o v1 é
exclusivamente demonstrativo, ele será descartado em vez de migrado. Não existe
mapeamento territorial a produzir: Região/Microregião não fazem parte do v2.
As bordas de leitura permanecem como dívida de implementação incremental.

## 6. Agenda de Decisões Humanas

As recomendações originais abaixo devem ser lidas com o fechamento de
2026-08-07. `DEC-01` a `DEC-07`, `DEC-10` e o recorte de plataforma de
`DEC-12` foram encerrados. `DEC-08` e `DEC-09` possuem portões próprios antes
das verticais de Materiais e GeoJSON. `DEC-11` não bloqueia o backend porque a
Sela de Prata I não é a fonte do dataset v2.

### `DEC-01` — Organização e isolamento de dados

Decidir:

- o sistema começa com uma única organização ou precisa operar múltiplas desde
  o primeiro backend;
- quais entidades carregam `organizacao_id`;
- quais unicidades são globais e quais são por organização;
- se Admin Global atravessa organizações ou é global apenas dentro de uma.

Decisão: usar uma única organização interna, Tchê Fertilidade, identificada por
`org_tche_fertilidade`. Multiempresa fica fora do primeiro contrato.

Saída obrigatória: decisão, diagrama de ownership e testes de isolamento.

### `DEC-02` — IDs canônicos e identidade

Status: `CONCLUIDA_PARA_FUNDACAO`. Todas as entidades novas usam ID técnico
opaco e relações por ID; Município/UF usam códigos oficiais. IDs específicos
das verticais seguem a mesma regra ao serem materializados.

Fechar IDs estáveis para:

- organização;
- usuário;
- perfil de Produtor, se permanecer entidade distinta;
- Propriedade;
- Titular e vínculo com Propriedade;
- Talhão;
- município/UF, preferencialmente com referência IBGE;
- Safra/Safrinha, Visita, Caderno, Material, arquivo e versão GeoJSON.

Recomendação: IDs técnicos imutáveis e nomes apenas como atributos. Nenhuma
autorização deve depender de comparação textual de região, município, pessoa ou
Propriedade.

### `DEC-03` — Modelo territorial definitivo

A divergência histórica foi resolvida. O contrato antigo usava Microregião e
houve uma proposta intermediária de Regional/Área Operacional. Nenhum dos dois
faz parte do v2; o código novo usa vínculo direto por Propriedade.

Decisão: não adotar Regional ou Área Operacional no primeiro contrato.
Município/UF representam localização; Colaborador acessa somente por vínculo
direto ativo com Propriedade. Campos territoriais legados permanecem apenas
durante a migração do código v1.

Saída obrigatória: um único modelo, endpoints revisados e tabela de migração dos
valores legados.

### `DEC-04` — Cadastro e ativação de usuários

Status: `CONCLUIDA` pela baseline v1. Usuário Produtor nasce pendente, primeira
Titularidade o ativa atomicamente, credenciais reais usam convite de uso único
e redução de status/escopo revoga refresh tokens.

Definição: estados canônicos são pendente, ativo e inativo. Senha não integra o
cadastro. Convite e recuperação usam token de uso único armazenado como hash;
troca de e-mail exige verificação; redução de status/escopo revoga refresh
tokens e invalida cache não autorizado.

### `DEC-05` — Cadastro de Propriedade e Titular

Status: `CONCLUIDA` pelas decisões 32 e 34. Vínculo usa ativo/inativo, origem e
auditoria; não expira automaticamente no primeiro backend. Troca de Titular
fica fora da edição comum e exige fluxo transacional futuro.

O código local suporta selecionar Titular existente e também criar um Titular
mínimo durante o cadastro. A regra de domínio foi fechada:

1. cadastrar o Usuário/Produtor primeiro e apenas selecioná-lo em Nova
   Propriedade; ou
2. permitir criação combinada de Produtor + Propriedade.

Decisão: cada Propriedade possui um Produtor Titular principal ativo; um
Produtor pode titularizar várias Propriedades; outros usuários acessam por
vínculo sem se tornarem Titulares. O fluxo administrativo padrão deve
selecionar Produtor existente. Eventual criação combinada futura precisa ser
transacional e idempotente.

Definição: vínculo não expira automaticamente no primeiro backend, registra
origem e auditoria e nunca é apagado fisicamente. Titular ativo não pode ser
inativado pela edição comum; transferência exige fluxo transacional próprio.

### `DEC-06` — Perfis administrativos e RBAC por ação

Status: `CONCLUIDA` pela decisão 37. O primeiro backend possui apenas Admin
global, Colaborador por vínculo direto e Produtor. A allowlist completa e a
estratégia de respostas estão em `baseline-backend-v1-2026-08.md`.

O primeiro backend não terá Admin Operacional ou Apoio. A matriz fixa de Admin,
Colaborador e Produtor está aprovada na baseline v1.

Regras mínimas já fixadas:

- autorização do backend é obrigatória; esconder botão não é segurança;
- Produtor permanece consultivo para estrutura e materiais;
- Colaborador só opera em Propriedade vinculada diretamente;
- vínculos inativos não concedem acesso.

Recursos por ID fora do escopo retornam `404`; ação negada sobre recurso
conhecido e autorizado retorna `403`. Envelope, paginação, idempotência,
concorrência, exclusão lógica e auditoria estão definidos na baseline v1.

### `DEC-07` — Capacidade offline por fluxo

Status: `CONCLUIDA` pela decisão 38. A tabela abaixo é substituída pela matriz
aprovada em `baseline-backend-v1-2026-08.md`.

Preencher e aprovar esta matriz antes de implementar cache produtivo:

| Fluxo | Leitura cacheada | Rascunho local | Mutação offline | Regra proposta |
|---|---:|---:|---:|---|
| Login/troca de usuário | Não | Não | Não | Sempre online |
| Sessão já revalidada | Sim | N/A | Não | Consulta por até 24 horas, respeitando lock e validade |
| Usuários e vínculos | Não | Não | Não | Administração online |
| Propriedades e Talhões | Sim | Não | Não | Cache por escopo; mudança estrutural online |
| Caderno | Sim | Sim | Não | Rascunho local; confirmar/complementar/corrigir com rede |
| Visitas | Sim | Não | Não | Agenda cacheada; transições com rede |
| Materiais publicados | Sim, se baixados | Não | Não | Arquivo cifrado e associado à versão publicada |
| Importação/publicação de arquivos | Não | N/A | Não | Sempre online no produto; importação local atual é demonstração |
| GeoJSON publicado | Sim, se baixado | Não | Não | Importar, reconciliar, publicar e reverter com rede |
| Notificações | Sim | Não | Não | Cache de leitura; estado remoto reconciliado online |
| Foto nova de Visita | Prévia local | Sim, no formulário | Não | Upload/envio com rede; sem fila em background |

Para cada linha aprovada, definir:

- TTL, quota e descarte;
- criptografia em repouso;
- separação por usuário/organização;
- comportamento após logout ou redução de escopo;
- conflito, idempotência e reconciliação;
- mensagem de UI quando a operação exigir rede.

### `DEC-08` — Materiais e arquivos produtivos

Antes da primeira tabela ou endpoint de materiais, decidir:

- estados de rascunho, revisão, publicação, substituição, arquivamento e
  rejeição;
- quem publica e quem revisa;
- versionamento, rollback e trilha de auditoria;
- tamanho máximo e MIME permitido por tipo;
- object storage, URL assinada e duração da URL;
- checksum, deduplicação, antivírus e retenção;
- metadados confirmados manualmente após ingestão;
- se PNG, PDF, ZIP e outras representações pertencem ao mesmo Material de
  negócio ou a registros independentes;
- política de download, remoção local e limpeza por quota;
- migração dos arquivos locais existentes.

A taxonomia agronômica completa não precisa bloquear o primeiro backend. As
três categorias do MVP podem ser mantidas como configuração inicial
versionável.

### `DEC-09` — GeoJSON e Talhões versionados

O contrato de versão existe, mas faltam parâmetros produtivos:

- limiar de similaridade, sobreposição e mudança de área;
- tolerância de geometria e sistema de referência aceito;
- retenção de rascunhos, rejeitados e versões substituídas;
- capacidade e expiração do cache no aparelho;
- política de rollback e efeito sobre referências históricas;
- UX mínima de comparação e aprovação;
- resposta a publicação concorrente e versão desatualizada.

Esses valores devem ser configuráveis e testados com fixtures reais, não
inferidos a partir de um único arquivo demonstrativo.

### `DEC-10` — Notificações

Status: `CONCLUIDA` para o primeiro corte. Notificações são in-app, sem push, e
entregas possuem retenção padrão de 90 dias.

O contrato funcional está fechado para o primeiro corte: retenção padrão de 90
dias, somente in-app e sem push. Estado lida/descartada pertence à entrega do
usuário e deve reconciliar entre aparelhos pelo servidor.

### `DEC-11` — Dados demonstrativos e evidência agronômica

Status: `NAO_BLOQUEIA_BACKEND`. O dataset v2 usa a carga autorizada descrita em
`dataset-demonstrativo-v2.md`; a Sela de Prata I permanece legado e só exige
nova validação se voltar a ser usada em demonstração externa ou produção.

Confirmar antes de demonstração de campo ou publicação:

- autorização para usar nome, localização, limites, anexos e medidas da Sela de
  Prata I;
- fonte e responsabilidade pelos arquivos usados;
- relação correta entre 6.200 ha informados e 1.888,6 ha mapeados;
- se perímetro fica fora do primeiro backend ou qual pipeline fornecerá fonte,
  método e unidade confiáveis;
- dados pessoais que podem permanecer em fixtures, logs e artefatos de QA.

Não corrigir números ou geometrias por inferência.

### `DEC-12` — Plataforma e release

Status de escopo: `CONCLUIDA`. Android é a primeira plataforma produtiva;
iOS fica fora do primeiro release. Keystore, privacidade, telemetria e destino
de distribuição continuam como portão de release, não de backend.

Android é o alvo inicial e iOS fica fora do primeiro release. Ainda precisam
ser executados, como preparação de release: matriz mínima Android, destino de
distribuição, telemetria/privacidade, revisão das dependências e atualização
coordenada do Expo/Gradle.

## 7. Implementações Que Faltam Antes ou Junto do Backend

### 7.1 Fronteira de dados — obrigatória antes da troca do mock

Hoje há 27 módulos de execução importando o mock diretamente, inclusive telas,
contexts, autenticação, ações de ciclo de vida e catálogo de materiais. Trocar
essas importações diretamente por chamadas HTTP criaria regras duplicadas e
dificultaria testes.

Implementar:

1. interfaces por capacidade, não uma API genérica única;
2. adaptadores locais que preservem o comportamento atual;
3. adaptadores HTTP futuros atrás das mesmas interfaces;
4. casos de uso para autorização, ciclo de Caderno, ciclo de Visita, materiais
   e GeoJSON;
5. mapeadores explícitos entre DTO canônico e aliases legados;
6. tratamento uniforme de loading, erro, retry, cancelamento e conflito.

Critério de aceite: uma tela prioritária não conhece `mock.ts`, URL, token ou
formato de storage. Ela consome um caso de uso ou repositório injetável e os
testes existentes continuam passando com o adaptador local.

### 7.2 Contrato API e banco

Criar, depois de `DEC-01` a `DEC-06`:

- modelo relacional e dicionário de dados;
- migrations versionadas e reversíveis;
- constraints, índices, chaves estrangeiras e exclusão lógica;
- contrato OpenAPI ou equivalente versionado;
- envelope de erro, paginação, filtros e ordenação;
- idempotency key para criações e comandos sensíveis;
- optimistic concurrency/versionamento onde houver edição concorrente;
- auditoria de ator, origem, data e correlação;
- seed mínimo separado dos dados demonstrativos;
- estratégia de backup, restauração e observabilidade.

Não criar tabelas produtivas usando nomes textuais de região como chave nem
promover `produtor_id`, `proprietario_id` ou `microregiao` legado sem um plano
de compatibilidade.

### 7.3 Autenticação e sessão reais

O `AuthContext` atual restaura `@tche:user` e não implementa tokens, expiração,
rotação, revalidação ou bloqueio por inatividade. A implementação de `MP-33`
precisa cobrir integralmente `politica-sessao.md`:

- login online;
- access e refresh token;
- storage seguro nativo;
- rotação e revogação;
- lock local e retomada segura;
- revalidação de status e escopo;
- logout online e offline;
- limpeza por troca de usuário;
- bloqueio da restauração de sessão antiga;
- remoção de logs de sessão e dados pessoais.

### 7.4 Território e autorização

Implementar autorização em duas camadas:

- backend aplica organização, perfil, território, vínculo direto, status e
  ação;
- aplicativo usa as mesmas capacidades apenas para experiência e navegação.

Todo endpoint por ID deve validar acesso ao recurso, inclusive rota direta.
Consultas devem filtrar no banco; não buscar globalmente para filtrar apenas no
cliente.

### 7.5 Eventos auditáveis de Caderno e Visitas

Para o backend, transformar o ciclo local já validado em comandos e eventos:

- evento append-only;
- ator e perfil no momento da ação;
- timestamp do servidor;
- estado/versão anterior;
- motivo obrigatório quando aplicável;
- idempotência;
- concorrência otimista;
- autorização por comando;
- leitura histórica sem reescrever o passado.

### 7.6 Arquivos, materiais e GeoJSON

Substituir o armazenamento exclusivamente local por:

- upload controlado e retomável quando necessário;
- object storage privado;
- metadados no banco;
- validação no servidor;
- publicação/versionamento;
- download autenticado;
- cache cifrado no aparelho;
- invalidação por usuário, escopo e versão;
- métricas de falha e integridade.

`MapaSincronizacaoService.ts` e `mapaSyncEndpoints.ts` são experimentais: ainda
contêm chamada simulada, identificação de dispositivo pendente e URL
`example.com`. Não devem ser tratados como base produtiva pronta.

### 7.7 Notificações

O `NotificacaoContext` atual reinicia a mesma lista em memória para os perfis.
O backend precisa criar entregas por destinatário e escopo, com cursor,
idempotência, marcação de leitura, destino autorizado e retenção definida.

### 7.8 Preparação de release

Antes do APK de campo formal:

- fornecer keystore oficial e as quatro credenciais `TCHE_RELEASE_*`;
- manter removidos o painel `Smoke Dev` e os logs de autenticação/perfil que
  imprimiam objetos de usuário;
- reexecutar verificação de pacotes Expo e auditoria de dependências;
- decidir atualização do SDK sem aplicar correções incompatíveis isoladas;
- criar CI mínima para typecheck, domínio, contrato e build de release;
- documentar versionCode/versionamento, rollback e distribuição.

## 8. Migração e Compatibilidade de Dados

### 8.1 Inventário obrigatório

Levantar todos os valores reais e fixtures existentes para:

- `fazenda_id`, `propriedade_id` e IDs de registros vinculados;
- `produtor_id`, `proprietario_id`, `titular_id` e usuário;
- `regiao`, `microregiao`, `sub_regioes` e `vinculos_microregioes`;
- `propriedades_atribuidas`;
- Talhões identificados por nome em registros antigos;
- autores/responsáveis armazenados apenas como texto;
- materiais e arquivos persistidos localmente;
- chaves de storage locais.

Chaves locais conhecidas na auditoria:

- `@tche:mock-mvp:v1`;
- `@tche:user`;
- `@tche:local-credentials:v1`;
- `@tche:geojson-imports:v1`;
- `@tche:png-map-imports:v1`;
- `@tche:prescription-zip-imports:v1`;
- `@tche:material-tecnico-imports:v1`;
- `@tche:periodos-produtivos:v1`.

### 8.2 Estratégia mínima

1. definir o modelo canônico;
2. gerar tabela explícita de correspondência de IDs e territórios;
3. importar para staging;
4. validar contagens, vínculos e acesso por perfil;
5. executar leitura dupla temporária somente onde necessário;
6. comparar respostas do adaptador legado e do canônico;
7. bloquear novos dados ambíguos;
8. remover aliases apenas em fase posterior, com telemetria provando ausência de
   uso.

Não mapear área operacional ou Titular apenas por semelhança de texto.

## 9. Plano de Testes e Evidências

### 9.1 Baseline automatizada desta auditoria

| Data | Comando | Resultado |
|---|---|---|
| 2026-08-05 | `npm run typecheck` | Passou |
| 2026-08-05 | `npm run test:domain-compat` | Passou integralmente |
| 2026-08-07 | `npm run typecheck` | Passou após o fechamento documental e remoção das superfícies de debug |
| 2026-08-07 | `npm run test:domain-compat` | Passou integralmente |
| 2026-08-07 | `npm run build:android:release` | Passou; APK de 96.242.378 bytes, SHA-256 `F6C0930716081398A89FC29C283553D53A98B9BA912C1B129FDD0A524316CE15` |

Essa baseline comprova compatibilidade local. Ela não comprova backend,
segurança, sincronização, autorização de servidor ou comportamento em todos os
aparelhos.

### 9.2 Validação automatizada mínima em toda mudança pré-backend

Executar:

```powershell
npm run typecheck
npm run test:domain-compat
git diff --check
```

Quando tocar configuração nativa ou release, acrescentar:

```powershell
npm run build:android:release
```

Também verificar compatibilidade de pacotes Expo e auditoria de dependências,
registrando o resultado sem aplicar upgrade destrutivo ou incompatível no mesmo
passo.

### 9.3 Smoke local canônico antes do backend

O `smoke.md` é um registro histórico extenso. Antes de repetir testes, criar um
recorte vivo que marque cada caso como `coberto`, `superseded`, `reexecutar` ou
`fora do corte`.

Mínimo a preservar no recorte:

1. Admin lista e abre todas as Propriedades.
2. Colaborador lista e abre Propriedade dentro do território e é bloqueado fora
   dele, inclusive por rota direta.
3. Produtor lista somente suas Propriedades e é bloqueado em outra, inclusive
   por rota direta.
4. Cadastro e edição respeitam a decisão final de Usuário/Titular/Propriedade.
5. Caderno preserva rascunho, confirmação, complemento, correção, autoria,
   Talhão e Safra/Safrinha.
6. Visita respeita transições, comandos terminais, correções e permissões.
7. Material válido abre; tipo inválido, arquivo excedente, arquivo ausente e
   rota sem autorização falham de modo controlado.
8. Materiais de dois anos/safras e variantes condicionais aparecem com
   metadados corretos.
9. GeoJSON válido, inválido, substituído e removido mantém referências e camada
   esperadas.
10. Force-stop, troca de perfil e logout não vazam dados entre usuários.

### 9.4 Android físico e campo

Ainda precisam de evidência consolidada:

- localização realmente dentro, fora e próxima do limite de Talhão;
- permissão negada, serviço de localização desligado e cancelamento;
- precisão baixa e recaptura;
- comportamento offline e retorno da rede;
- consumo e estabilidade durante uso de campo;
- colaborador dentro e fora de escopo em materiais;
- Produtor em rota direta de outra Propriedade;
- material inválido/excedente e viewer em release;
- dois anos/safras, variantes condicionais, nome de prescrição não reconhecido e
  rollback;
- acessibilidade, leitor de tela, teclado, rotação e matriz mínima de aparelhos.

`MP-26` já comprovou captura física aproximada e recaptura; isso não substitui
os cenários espaciais e offline de `MP-38`.

### 9.5 Testes obrigatórios do backend e banco

#### Autenticação

- login, refresh rotativo, reuse detection, expiração e revogação;
- usuário pendente/inativo/removido;
- redução de escopo com sessão aberta;
- logout online/offline e restauração após force-stop;
- separação de tokens e cache por usuário.

#### RBAC

- matriz completa por perfil, ação e recurso;
- organização diferente;
- vínculo direto ativo e ausência de autorização por Município/UF;
- vínculo inativo/expirado;
- rota direta por ID;
- ausência de vazamento entre `403` e `404` conforme decisão;
- filtros e paginação sem incluir itens fora do escopo.

#### Banco

- chaves estrangeiras, unicidade e constraints;
- criação combinada transacional, se aprovada;
- bloqueio de exclusão com dependências;
- concorrência otimista;
- migração e rollback em staging;
- comparação de contagens e vínculos antes/depois;
- isolamento por organização.

#### Caderno e Visitas

- eventos append-only;
- idempotência de comandos repetidos;
- comando concorrente sobre versão antiga;
- ator e timestamps do servidor;
- proibição de reescrita histórica;
- autorização por estado e ação.

#### Arquivos e GeoJSON

- MIME/tamanho/checksum;
- arquivo malformado e upload interrompido;
- autorização da URL assinada;
- publicação concorrente;
- versão, rollback e referências históricas;
- invalidação e quota de cache;
- tolerâncias geoespaciais aprovadas.

#### Notificações

- entrega apenas ao destinatário autorizado;
- contador e cursor;
- idempotência;
- lida/não lida em mais de um dispositivo;
- destino removido ou fora do escopo;
- retenção sem reaparecimento indevido.

## 10. Limpeza Documental Necessária

### `DOC-01` — `pendencias-de-definicao.md`

Status: `CONCLUIDO` com resumo ativo e histórico explicitamente subordinado.

Separar pendências realmente abertas de histórico. Caderno, Visitas,
localização e várias decisões funcionais possuem cortes locais já concluídos,
mas ainda aparecem misturados com perguntas antigas.

### `DOC-02` — Contratos territoriais

Status: `CONCLUIDO` para o v2 por vínculo direto.

Depois de `DEC-03`, atualizar conjuntamente:

- `modelo-territorial.md`;
- `matriz-rbac-backend.md`;
- `contrato-api-rbac.md`;
- `testes-contrato-api-rbac.md`;
- `regras-de-negocio.md`;
- `decisoes-consolidadas.md`.

### `DOC-03` — `smoke.md`

Status: `CONCLUIDO`; a matriz ativa foi criada no topo em 2026-08-07.

Preservar como evidência histórica, mas criar no topo uma matriz ativa curta
para evitar reexecutar casos já superseded ou deixar lacunas antigas parecerem
pendências atuais.

### `DOC-04` — `plano-reorganizacao.md`

Status: `CONCLUIDO` em 2026-08-07.

Atualizar a próxima ação. A antiga limpeza visual de nomenclatura não representa
mais a fila atual; a lacuna relevante é a camada de dados/repositórios.

### `DOC-05` — `README.md` da raiz

Status: `CONCLUIDO` em 2026-08-07.

Corrigir informações antigas, entre elas Expo 48, Node 16 e a observação de que
`Produtor` seria termo provisório até a Fase 2. O código atual usa Expo SDK 56 e
a documentação ativa já fixou os termos de produto.

### `DOC-06` — Registro de decisões

Status: `CONCLUIDO` pelas decisões 36 a 38.

Cada `DEC-*` aprovado deve ser resumido em `decisoes-consolidadas.md`, com link
para o contrato detalhado. Questões conscientemente adiadas permanecem em
`pendencias-de-definicao.md`, com impacto e fase de retorno.

## 11. Sequência Recomendada

### Onda 0 — Fonte de verdade e decisões

Status: `CONCLUIDA` em 2026-08-07.

1. fechar `DEC-01` a `DEC-06`;
2. reconciliar o modelo territorial e RBAC;
3. fechar o fluxo de cadastro e ativação;
4. registrar IDs, vínculos, estados e regras de exclusão;
5. limpar a documentação ativa afetada.

Saída: base suficiente para desenhar banco e API sem promover legado ambíguo.

### Onda 1 — Contrato e preparação arquitetural

Status: `PROXIMA`, incorporada à primeira entrega de `MP-33`.

1. inventariar dados/aliases;
2. desenhar modelo relacional e contrato API;
3. criar estratégia de migração;
4. introduzir interfaces de repositório e adaptadores locais;
5. criar CI mínima;
6. manter a baseline local verde.

Saída: frontend desacoplado do transporte e contrato produtivo revisável.

### Onda 2 — Entrada no plano mestre produtivo

| Fase | Pré-requisitos deste plano |
|---|---|
| `MP-33` Autenticação e sessão | Baseline v1; `PRE-07`, `PRE-08` e `PRE-09` são entregas da própria fase |
| `MP-34` Notificações | `MP-33`, `PRE-10`, `PRE-13` |
| `MP-35` Escopo por Propriedade e RBAC | `MP-33`, `PRE-03`, `PRE-05` |
| `MP-36` Caderno produtivo | `MP-33`, `MP-35`, `PRE-14` |
| `MP-37` GeoJSON produtivo | `MP-35`, `PRE-12` |
| Backend de Materiais | `MP-35`, `PRE-11` |

### Onda 3 — Campo e release

1. executar a matriz física consolidada;
2. fechar `MP-38` e os itens aplicáveis de `MP-40`;
3. validar dados demonstrativos e consentimentos;
4. fechar assinatura, logs, dependências, telemetria e plataforma;
5. gerar release reproduzível e registrar rollback.

## 12. Itens Que Não Precisam Bloquear o Primeiro Backend

Podem ficar para depois se a exclusão for explícita e não houver promessa de
produto:

- renomear todos os símbolos internos de Fazenda para Propriedade;
- fechar taxonomia agronômica além das três categorias do MVP;
- foto real/georreferenciada, se não entrar no primeiro release;
- perímetro, se o backend inicial declarar o campo indisponível sem inventar
  valor;
- push, se notificações começarem apenas in-app;
- iOS, se for formalmente excluído do MVP;
- refatorar integralmente todas as telas grandes.

Mesmo nesses casos, a área tocada pela integração deve ser desacoplada. Em
especial, `MapasScreen.tsx` concentra cerca de 184 KB e é um ponto de alto
risco; não é necessário reescrevê-la por completo, mas novas integrações de
materiais, cache e GeoJSON não devem aumentar o acoplamento existente.

## 13. Portão de Prontidão Para Iniciar o Backend

Status em 2026-08-07: `LIBERADO`.

- [x] organização/tenant e isolamento aprovados;
- [x] IDs canônicos aprovados;
- [x] Regional/Área Operacional removidos do primeiro contrato;
- [x] fluxo Usuário/Produtor/Titular/Propriedade aprovado;
- [x] perfis e RBAC por ação aprovados;
- [x] estados e ciclo dos vínculos aprovados;
- [x] estratégia `403`/`404`, erro, paginação e idempotência aprovada;
- [x] aliases legados inventariados e descarte do mock v1 aprovado;
- [x] modelo canônico de fundação revisado;
- [x] política de sessão mapeada;
- [x] matriz offline aprovada;
- [x] baseline automatizada verde;
- [x] documentação de fundação atualizada.

OpenAPI, migrations e a primeira fronteira de repositórios são resultados da
primeira entrega do backend, não pré-condições para iniciá-la.

## 14. Portão de Prontidão Para Campo ou Release

- [ ] smokes físicos canônicos concluídos;
- [ ] `MP-38` concluído ou limitação explicitamente aceita;
- [ ] acessibilidade e matriz de aparelhos executadas;
- [ ] dados da Sela de Prata I autorizados e semanticamente revisados;
- [ ] nenhuma capacidade demonstrativa apresentada como produtiva;
- [x] fonte do `Smoke Dev` e logs de sessão/perfil removidos;
- [ ] ausência dessas superfícies confirmada no próximo artefato de release;
- [ ] keystore e segredos oficiais configurados;
- [ ] auditoria de dependências revisada e risco aceito ou corrigido;
- [ ] CI e build de release reproduzível passando;
- [ ] política de privacidade, telemetria, backup e rollback definida;
- [ ] iOS incluído e testado, ou formalmente fora do corte.

## 15. Registro de Decisões Desta Rodada

Preencher durante a reunião de fechamento:

| Decisão | Responsável | Prazo | Estado | Documento de destino |
|---|---|---|---|---|
| `DEC-01` Organização | Projeto | 2026-08-05 | Concluída | `decisoes-consolidadas.md` + modelo v2 |
| `DEC-02` IDs | Projeto | 2026-08-07 | Concluída para fundação | modelo v2 + baseline v1 |
| `DEC-03` Território | Projeto | 2026-08-05 | Concluída | `modelo-territorial.md` + contratos RBAC |
| `DEC-04` Ativação | Projeto | 2026-08-07 | Concluída | política de sessão + baseline v1 |
| `DEC-05` Propriedade/Titular | Projeto | 2026-08-06 | Concluída | decisões 32 e 34 |
| `DEC-06` RBAC | Projeto | 2026-08-07 | Concluída | decisão 37 + baseline v1 |
| `DEC-07` Offline | Projeto | 2026-08-07 | Concluída | decisão 38 + baseline v1 |
| `DEC-08` Materiais | Vertical de Materiais | Antes da vertical | Portão próprio | `modelo-material-tecnico.md` |
| `DEC-09` GeoJSON | `MP-37` | Antes da implementação | Portão próprio | `versionamento-geojson-talhoes.md` |
| `DEC-10` Notificações | Projeto | 2026-08-07 | Concluída | decisão 38 + contrato de notificações |
| `DEC-11` Dados demonstrativos | Release | Antes de uso externo | Não bloqueia backend | dataset v2 + evidência de autorização |
| `DEC-12` Plataforma/release | Projeto | 2026-08-07 | Android definido | baseline v1; demais itens no portão de release |

## 16. Fontes Ativas Cruzadas

Esta auditoria usou como fonte principal:

- `estado-atual.md`;
- `contexto-consolidado.md`;
- `escopo-mvp.md`;
- `regras-de-negocio.md`;
- `decisoes-consolidadas.md`;
- `pendencias-de-definicao.md`;
- `plano-mestre-implementacao-qa-2026-07.md`;
- `matriz-cadastros-mvp.md`;
- `matriz-rbac-backend.md`;
- `politica-sessao.md`;
- `modelo-territorial.md`;
- `modelo-material-tecnico.md`;
- `contrato-notificacoes.md`;
- `ciclo-vida-caderno.md`;
- `estados-visita.md`;
- `versionamento-geojson-talhoes.md`;
- `contrato-api-rbac.md`;
- `testes-contrato-api-rbac.md`;
- `smoke.md`.

Documentos históricos e revisões foram usados apenas como evidência auxiliar e
não prevalecem sobre a trilha ativa ou o código.
