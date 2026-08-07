# Baseline Aprovada Para O Backend V1

> Status: `APROVADO_PARA_INICIO`
>
> Fechamento: 2026-08-07
>
> Escopo: fundação do backend e do banco; não representa backend já
> implementado nem autorização de release produtivo.

## 1. Veredito

As decisões de domínio necessárias para iniciar o backend estão fechadas.
`MP-33 — Autenticação e sessão reais` pode sair de `BLOQUEADO` e entrar em
`PRONTO`.

Não é necessário concluir Materiais produtivos, GeoJSON produtivo, smoke de
campo ou assinatura oficial do APK antes de criar a API e o banco. Esses itens
possuem portões próprios antes de suas respectivas verticais ou do release.

## 2. Arquitetura De Fundação

O primeiro backend seguirá estas decisões:

- backend modular único, sem microserviços no primeiro corte;
- runtime Node.js com TypeScript;
- API REST JSON versionada em `/v1` e documentada por OpenAPI;
- banco relacional PostgreSQL;
- extensão PostGIS para geometrias e operações espaciais;
- migrations SQL versionadas e executadas pelo pipeline de entrega;
- object storage privado e compatível com S3 para arquivos e geometrias de
  origem;
- URLs temporárias e autorizadas para upload/download;
- processamento assíncrono somente para arquivos, validações pesadas e tarefas
  geoespaciais;
- frontend acessando casos de uso/repositórios, sem trocar importações do mock
  diretamente por HTTP dentro das telas.

Framework HTTP, provedor de nuvem e ferramenta de migrations podem ser
selecionados no scaffold sem alterar este contrato. A escolha deve preservar
OpenAPI, PostgreSQL/PostGIS, transações, testes de integração e portabilidade.

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
- Produtor acessa Propriedades com vínculo ativo `titular` ou
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

`usuario_propriedade` no backend v1 possui:

- `id`;
- `organizacao_id`;
- `usuario_id`;
- `propriedade_id`;
- `tipo_vinculo`: `titular`, `usuario_autorizado` ou `colaborador`;
- `status`: `ativo` ou `inativo`;
- `origem`: inicialmente `admin_manual` ou `ativacao_titular`;
- `criado_por`, `criado_em`, `atualizado_por` e `atualizado_em`;
- motivo obrigatório para inativação.

Regras:

- não existe validade temporal automática no primeiro backend;
- vínculo não é apagado fisicamente;
- não pode existir vínculo ativo duplicado de mesmo usuário, Propriedade e
  tipo;
- Colaborador ativo precisa ter ao menos um vínculo ativo;
- vínculo `titular` corresponde ao `titular_id` da Propriedade;
- vínculo de Titular não pode ser inativado pela edição comum;
- transferência futura de Titular precisa ser transacional e auditada;
- redução de escopo revoga/revalida sessão e invalida cache não autorizado.

## 6. Usuário, Ativação E Sessão

Estados cadastrais do primeiro backend:

- `pendente`;
- `ativo`;
- `inativo`.

Bloqueio temporário de segurança e remoção lógica são atributos de segurança e
auditoria, não novos valores de `status` no primeiro contrato.

Fluxo aprovado:

1. Admin cria Usuário Produtor como `pendente`.
2. A primeira Propriedade cria Titularidade e ativa Usuário/Produtor em uma
   única transação.
3. Colaborador só pode ficar `ativo` com ao menos uma Propriedade vinculada.
4. Admin nasce ativo conforme ação administrativa autenticada.
5. Backend envia convite de uso único para definição de senha; senha inicial
   não integra o cadastro nem o seed.
6. Convite e recuperação usam token aleatório, armazenado somente como hash,
   com expiração configurável e uso único.
7. Alteração de e-mail exige nova verificação antes de substituir o endereço
   autenticável.
8. Inativação ou redução de escopo revoga refresh tokens ativos.

A política de sessão de `politica-sessao.md` permanece integralmente válida:
access token de 15 minutos, refresh rotativo com validade absoluta de 30 dias,
lock local após 15 minutos e consulta offline por até 24 horas desde a última
revalidação.

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
- `version`/versão-base obrigatória em comandos concorrentes;
- nenhuma exclusão física de entidade operacional pelo fluxo comum.

## 8. Política Offline Aprovada

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
| Notificações | Última lista cacheada | Leitura/descarte exigem rede |

Regras comuns:

- cache segregado por organização e usuário;
- logout e redução de escopo removem chaves e índices não autorizados;
- tokens ficam em storage seguro nativo, nunca em `AsyncStorage`;
- UI identifica dado cacheado e operação que exige conexão;
- não há promessa de sincronização geral ou fila de mutações no primeiro
  backend.

## 9. Notificações E Primeira Plataforma

- Notificações do primeiro corte são in-app.
- Push fica explicitamente fora de `MP-34` inicial.
- Entregas expiram 90 dias após criação, salvo prazo menor definido pelo
  evento; o evento de auditoria segue a retenção do domínio de origem.
- Estado lida/descartada nunca reaparece por expiração ou sincronização.
- A primeira entrega produtiva é Android.
- iOS permanece fora do primeiro release e não bloqueia backend, banco ou QA
  Android.

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

- scaffold, migrations e OpenAPI;
- interfaces de repositório no app;
- autenticação e sessão reais (`MP-33`);
- RBAC no servidor (`MP-35`);
- CI do backend;
- observabilidade, backup e restauração.

### Portões posteriores, sem bloquear `MP-33`

- parâmetros de retenção e limites de Materiais antes da vertical de arquivos;
- limiares geoespaciais e retenção de rascunhos antes de `MP-37`;
- smoke de localização em campo em `MP-38`;
- keystore, privacidade, telemetria e dados produtivos antes do release;
- patches gerais do Expo em tarefa de manutenção separada.

## 12. Primeira Entrega Recomendada

O primeiro corte real deve conter apenas:

1. scaffold do backend e banco;
2. migrations de organização, usuários, produtores, Propriedades e vínculos;
3. login, refresh, logout e `/auth/me`;
4. listagem autorizada de Propriedades;
5. criação administrativa de Usuário e Propriedade conforme o fluxo v2;
6. testes de isolamento, status e rota direta;
7. adaptador HTTP inicial no app, mantendo o adaptador mock para testes.

Materiais, GeoJSON produtivo, Caderno append-only e notificações entram depois
que essa fundação estiver implantada e observável.
