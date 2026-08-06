# Plano de Fechamento das Pendências Pré-Backend

> Status: ATIVO
>
> Auditoria-base: 2026-08-05
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

O corte local demonstrativo está consistente e as fases `MP-00` a `MP-32`
estão registradas como concluídas. Nesta auditoria:

- `npm run typecheck` passou;
- `npm run test:domain-compat` passou integralmente;
- a aplicação continua sem backend, banco, migrações ou contrato OpenAPI reais;
- autenticação, notificações, materiais, GeoJSON, Safra/Safrinha, Visitas e
  Caderno ainda dependem total ou parcialmente de memória, mock, arquivos
  locais ou `AsyncStorage`;
- 27 módulos de execução importam `src/api/mock.ts` diretamente;
- `src/api/index.ts` ainda é uma fachada da API mock;
- a sincronização de mapas contém endpoint de exemplo e métodos simulados;
- não foi encontrado workflow de integração contínua em `.github/`;
- há divergência entre o contrato antigo baseado em `microregiao` e o modelo
  territorial ativo baseado em Regional e Área Operacional;
- os documentos `pendencias-de-definicao.md`, `plano-reorganizacao.md` e o
  `README.md` da raiz misturam ou exibem estados anteriores ao corte atual.

Conclusão: o projeto está pronto para uma fase curta de fechamento de decisões
e preparação arquitetural. Ainda não está pronto para modelar o banco ou
implementar endpoints produtivos sem risco de cristalizar contratos legados.

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
| Fotos atuais | São demonstrativas; foto real e georreferenciada não deve ser apresentada como capacidade pronta |

## 5. Matriz Mestra de Pendências

| ID | Prioridade | Natureza | Pendência | Bloqueia | Evidência de fechamento |
|---|---|---|---|---|---|
| `PRE-01` | `P0-A` | Governança | Reconciliar documentos ativos conflitantes ou desatualizados | Schema e API | Trilha ativa sem contratos territoriais concorrentes e sem pendências já encerradas marcadas como abertas |
| `PRE-02` | `P0-A` | Decisão/implementação | Organização única e IDs centrais definidos; completar IDs das demais verticais | Schema | `modelo-dados-mock-v2.md` implementado e contratos das verticais reconciliados |
| `PRE-03` | `P0-A` | Implementação | Migrar escopo territorial legado para vínculo direto por Propriedade | Schema, `MP-35` | Mock v2, API e testes sem autorização por texto territorial |
| `PRE-04` | `P0-A` | Implementação | Aplicar cadastro de Usuário, Produtor, Titular e Propriedade aprovado no v2 | Schema, `MP-33`, cadastros | Fluxo, integridade e transações implementados/testados |
| `PRE-05` | `P0-A` | Decisão | Fechar RBAC por ação e ciclo dos vínculos | API, `MP-35` | Matriz allowlist aprovada e casos 2xx/401/403/404/409 definidos |
| `PRE-06` | `P0-A` | Dados | Inventariar e mapear aliases e valores territoriais legados | Migrações | Planilha/fixture de migração revisada, sem inferência silenciosa |
| `PRE-07` | `P0-A` | Contrato | Produzir contrato API e modelo de dados v1 coerentes | Todas as verticais | OpenAPI ou contrato equivalente, diagrama, migrations e regras de integridade revisados |
| `PRE-08` | `P0-B` | Implementação | Separar telas/casos de uso do mock por interfaces de repositório | Troca para API | Fluxos prioritários usam interfaces; mock e HTTP são adaptadores substituíveis |
| `PRE-09` | `P0-B` | Segurança | Implementar fronteira de autenticação e armazenamento seguro | `MP-33` | Tokens fora de `AsyncStorage`, rotação, revogação, lock, logout e redução de escopo testados |
| `PRE-10` | `P0-B` | Decisão | Completar matriz offline por fluxo | `MP-33` e sincronização | Cada fluxo classificado como leitura cacheada, rascunho local ou mutação online |
| `PRE-11` | `P1-V` | Produto/técnica | Fechar pipeline produtivo de materiais e arquivos | Backend de Materiais | Versionamento, storage, MIME, tamanho, auditoria, retenção e autorização aprovados |
| `PRE-12` | `P1-V` | Produto/técnica | Fechar parâmetros produtivos do GeoJSON | `MP-37` | Limiares, retenção, publicação, rollback, cache e conflitos aprovados |
| `PRE-13` | `P1-V` | Produto | Fechar retenção de notificações e escopo de push | `MP-34` | Retenção aprovada; push incluído ou explicitamente adiado |
| `PRE-14` | `P1-V` | Técnica | Definir eventos auditáveis, idempotência e concorrência | `MP-36` e backend de Visitas | Schemas de evento, versionamento e testes concorrentes aprovados |
| `PRE-15` | `P1-R` | Evidência | Fechar smokes físicos ainda relevantes | `MP-38`/release | Matriz canônica executada em aparelho e evidências anexadas |
| `PRE-16` | `P1-R` | Dados/negócio | Validar autorização e consistência dos dados da Sela de Prata I | Demo de campo/release | Fonte, autorização, medidas e limitações registradas |
| `PRE-17` | `P1-R` | Release | Fechar assinatura, segurança, plataformas e observabilidade | Release | Keystore oficial, segredos, política de logs, auditoria de dependências e plataforma-alvo aprovados |
| `PRE-18` | `P2` | Manutenção | Reduzir pontos críticos de acoplamento e documentação obsoleta | Evolução segura | Telas críticas modularizadas na área tocada, README atualizado e CI mínima ativa |

Atualização parcial de `PRE-06` em 2026-08-06: os identificadores legados,
especialmente `fazenda_id`, foram inventariados e classificados em
`auditoria-compatibilidade-fazenda-id-2026-08.md`. Nenhuma remoção foi feita.
O item continua aberto porque ainda faltam o mapeamento dos valores
territoriais e a fixture/planilha de migração revisada. O contrato TypeScript
v2, encontrado vazio durante a auditoria, foi restaurado posteriormente em
2026-08-06; `npm run typecheck` e `npm run test:domain-compat` passaram.

## 6. Agenda de Decisões Humanas

As recomendações originais abaixo devem ser lidas com o fechamento de
2026-08-05. `DEC-01`, o núcleo de identidade de `DEC-02`, `DEC-03` e a regra
de Titular de `DEC-05` foram aprovados em `modelo-dados-mock-v2.md` e nas
decisões 31 a 33. Os demais pontos continuam exigindo decisão própria.

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

Fechar IDs estáveis para:

- organização;
- usuário;
- perfil de Produtor, se permanecer entidade distinta;
- Propriedade;
- Titular e vínculo com Propriedade;
- Talhão;
- Regional;
- Área Operacional;
- município/UF, preferencialmente com referência IBGE;
- Safra/Safrinha, Visita, Caderno, Material, arquivo e versão GeoJSON.

Recomendação: IDs técnicos imutáveis e nomes apenas como atributos. Nenhuma
autorização deve depender de comparação textual de região, município, pessoa ou
Propriedade.

### `DEC-03` — Modelo territorial definitivo

Há uma divergência real a resolver:

- `modelo-territorial.md` define Regional e Área Operacional opcional, com
  `usuario_regional` e `usuario_area_operacional`;
- `contrato-api-rbac.md` e `matriz-rbac-backend.md` ainda usam principalmente
  `microregiao` e `usuario_microregiao`;
- o código atual usa `sub_regioes`, com `vinculos_microregioes` como fallback;
- `propriedades_atribuidas` é apenas visual/preparatório no mock.

Decisão: não adotar Regional ou Área Operacional no primeiro contrato.
Município/UF representam localização; Colaborador acessa somente por vínculo
direto ativo com Propriedade. Campos territoriais legados permanecem apenas
durante a migração do código v1.

Saída obrigatória: um único modelo, endpoints revisados e tabela de migração dos
valores legados.

### `DEC-04` — Cadastro e ativação de usuários

Decidir:

- Admin cria usuário já ativo ou envia convite para ativação;
- estados canônicos: pendente, ativo, inativo, bloqueado e removido, ou outro
  conjunto explicitamente menor;
- fluxo de senha inicial, convite, expiração, recuperação e redefinição;
- se troca de e-mail exige nova verificação;
- o que ocorre com sessões e cache quando o status ou escopo diminui.

Recomendação: usuário nasce pendente, ativa por convite de uso único, e qualquer
redução de status/escopo revoga refresh tokens e invalida dados protegidos no
próximo contato com o servidor.

### `DEC-05` — Cadastro de Propriedade e Titular

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

Ainda decidir:

- validade temporal e origem do vínculo;
- procedimento de troca de titularidade;
- impacto da desativação do Titular sobre o acesso do Produtor.

### `DEC-06` — Perfis administrativos e RBAC por ação

Fechar capacidades exatas de Admin Global, Admin Operacional e Apoio, caso os
três continuem no produto. Para cada recurso, decidir quem pode listar, abrir,
criar, editar, desativar, publicar, corrigir e excluir.

Regras mínimas já fixadas:

- autorização do backend é obrigatória; esconder botão não é segurança;
- Produtor permanece consultivo para estrutura e materiais;
- Colaborador só opera dentro do território ou vínculo direto autorizado;
- vínculo direto de Propriedade é aditivo;
- vínculos inativos não concedem acesso.

Ainda precisa ser decidido:

- quando um recurso fora do escopo retorna `403` ou `404` para reduzir
  vazamento de existência;
- envelope canônico de erro;
- paginação, filtros e ordenação;
- política de exclusão lógica, bloqueio por dependência e restauração;
- validade, origem, criador e auditoria dos vínculos de acesso.

### `DEC-07` — Capacidade offline por fluxo

Preencher e aprovar esta matriz antes de implementar cache produtivo:

| Fluxo | Leitura cacheada | Rascunho local | Mutação offline | Regra proposta |
|---|---:|---:|---:|---|
| Login/troca de usuário | Não | Não | Não | Sempre online |
| Sessão já revalidada | Sim | N/A | Não | Consulta por até 24 horas, respeitando lock e validade |
| Usuários e vínculos | A decidir | Não | Não | Administração online |
| Propriedades e Talhões | Sim | A decidir | Não | Cache por escopo; mudança estrutural online |
| Caderno | Sim | Sim | Não | Rascunho local; confirmar/complementar/corrigir com rede |
| Visitas | Sim | A decidir | Não | Agenda cacheada; transições com rede |
| Materiais publicados | Sim, se baixados | Não | Não | Arquivo cifrado e associado à versão publicada |
| Importação/publicação de arquivos | Não | N/A | Não | Sempre online no produto; importação local atual é demonstração |
| GeoJSON publicado | Sim, se baixado | Não | Não | Importar, reconciliar, publicar e reverter com rede |
| Notificações | Sim | Não | Não | Cache de leitura; estado remoto reconciliado online |
| Fotos futuras | A decidir | A decidir | A decidir | Exige política de fila, consentimento, quota e conflito |

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

O contrato funcional está majoritariamente fechado. Restam:

- tempo exato de retenção;
- inclusão de push no primeiro corte ou adiamento explícito;
- política de preferência por usuário e dispositivo;
- reconciliação de lida/não lida em múltiplos aparelhos.

### `DEC-11` — Dados demonstrativos e evidência agronômica

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

Decidir:

- se iOS faz parte do MVP aceito ou fica explicitamente fora do primeiro
  release;
- matriz mínima de Android, tamanho de tela, orientação e versão do sistema;
- destino de distribuição e política de atualização;
- serviço de crash/telemetria e política de privacidade;
- tratamento dos 11 alertas moderados conhecidos da cadeia Expo/ngrok;
- janela para atualização coordenada do Expo SDK e avisos de Gradle.

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
- remover ou desabilitar de forma comprovável o painel `Smoke Dev` fora de
  desenvolvimento;
- remover logs de autenticação, perfil e dados sensíveis;
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
- Regional, Área Operacional e vínculo direto aditivo;
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

Separar pendências realmente abertas de histórico. Caderno, Visitas,
localização e várias decisões funcionais possuem cortes locais já concluídos,
mas ainda aparecem misturados com perguntas antigas.

### `DOC-02` — Contratos territoriais

Depois de `DEC-03`, atualizar conjuntamente:

- `modelo-territorial.md`;
- `matriz-rbac-backend.md`;
- `contrato-api-rbac.md`;
- `testes-contrato-api-rbac.md`;
- `regras-de-negocio.md`;
- `decisoes-consolidadas.md`.

### `DOC-03` — `smoke.md`

Preservar como evidência histórica, mas criar no topo uma matriz ativa curta
para evitar reexecutar casos já superseded ou deixar lacunas antigas parecerem
pendências atuais.

### `DOC-04` — `plano-reorganizacao.md`

Atualizar a próxima ação. A antiga limpeza visual de nomenclatura não representa
mais a fila atual; a lacuna relevante é a camada de dados/repositórios.

### `DOC-05` — `README.md` da raiz

Corrigir informações antigas, entre elas Expo 48, Node 16 e a observação de que
`Produtor` seria termo provisório até a Fase 2. O código atual usa Expo SDK 56 e
a documentação ativa já fixou os termos de produto.

### `DOC-06` — Registro de decisões

Cada `DEC-*` aprovado deve ser resumido em `decisoes-consolidadas.md`, com link
para o contrato detalhado. Questões conscientemente adiadas permanecem em
`pendencias-de-definicao.md`, com impacto e fase de retorno.

## 11. Sequência Recomendada

### Onda 0 — Fonte de verdade e decisões

1. fechar `DEC-01` a `DEC-06`;
2. reconciliar o modelo territorial e RBAC;
3. fechar o fluxo de cadastro e ativação;
4. registrar IDs, vínculos, estados e regras de exclusão;
5. limpar a documentação ativa afetada.

Saída: base suficiente para desenhar banco e API sem promover legado ambíguo.

### Onda 1 — Contrato e preparação arquitetural

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
| `MP-33` Autenticação e sessão | `PRE-02`, `PRE-04`, `PRE-07`, `PRE-08`, `PRE-09`, `PRE-10` |
| `MP-34` Notificações | `PRE-07`, `PRE-10`, `PRE-13` |
| `MP-35` Território e RBAC | `PRE-02`, `PRE-03`, `PRE-05`, `PRE-06`, `PRE-07` |
| `MP-36` Caderno produtivo | `PRE-07`, `PRE-10`, `PRE-14` |
| `MP-37` GeoJSON produtivo | `PRE-06`, `PRE-07`, `PRE-10`, `PRE-12` |
| Backend de Materiais | `PRE-07`, `PRE-10`, `PRE-11` |

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

Não iniciar migrations produtivas ou endpoints definitivos até marcar todos os
itens abaixo:

- [ ] organização/tenant e isolamento aprovados;
- [ ] IDs canônicos aprovados;
- [ ] modelo Regional/Área Operacional reconciliado com o legado;
- [ ] fluxo Usuário/Produtor/Titular/Propriedade aprovado;
- [ ] perfis e RBAC por ação aprovados;
- [ ] estados e validade dos vínculos aprovados;
- [ ] estratégia `403`/`404`, erro, paginação e idempotência aprovada;
- [ ] inventário de aliases e dados legados concluído;
- [ ] modelo de banco e contrato API revisados em conjunto;
- [ ] plano de migração e rollback documentado;
- [ ] primeira fronteira de repositórios implementada no frontend;
- [ ] matriz offline aprovada;
- [ ] política de sessão mapeada para implementação segura;
- [ ] baseline automatizada verde;
- [ ] documentos ativos afetados atualizados.

## 14. Portão de Prontidão Para Campo ou Release

- [ ] smokes físicos canônicos concluídos;
- [ ] `MP-38` concluído ou limitação explicitamente aceita;
- [ ] acessibilidade e matriz de aparelhos executadas;
- [ ] dados da Sela de Prata I autorizados e semanticamente revisados;
- [ ] nenhuma capacidade demonstrativa apresentada como produtiva;
- [ ] `Smoke Dev` e logs sensíveis ausentes do artefato;
- [ ] keystore e segredos oficiais configurados;
- [ ] auditoria de dependências revisada e risco aceito ou corrigido;
- [ ] CI e build de release reproduzível passando;
- [ ] política de privacidade, telemetria, backup e rollback definida;
- [ ] iOS incluído e testado, ou formalmente fora do corte.

## 15. Registro de Decisões Desta Rodada

Preencher durante a reunião de fechamento:

| Decisão | Responsável | Prazo | Estado | Documento de destino |
|---|---|---|---|---|
| `DEC-01` Organização | A definir | A definir | Aberta | `decisoes-consolidadas.md` + modelo de dados |
| `DEC-02` IDs | A definir | A definir | Aberta | modelo de dados |
| `DEC-03` Território | A definir | A definir | Aberta | `modelo-territorial.md` + contratos RBAC |
| `DEC-04` Ativação | A definir | A definir | Aberta | `politica-sessao.md` + contrato de usuários |
| `DEC-05` Propriedade/Titular | A definir | A definir | Aberta | regras de negócio + contrato de cadastro |
| `DEC-06` RBAC | A definir | A definir | Aberta | matriz e contrato RBAC |
| `DEC-07` Offline | A definir | A definir | Aberta | matriz offline por fluxo |
| `DEC-08` Materiais | A definir | A definir | Aberta | `modelo-material-tecnico.md` |
| `DEC-09` GeoJSON | A definir | A definir | Aberta | `versionamento-geojson-talhoes.md` |
| `DEC-10` Notificações | A definir | A definir | Aberta | `contrato-notificacoes.md` |
| `DEC-11` Dados demonstrativos | A definir | A definir | Aberta | estado atual/termo de evidência |
| `DEC-12` Plataforma/release | A definir | A definir | Aberta | guia de release/estado atual |

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
