# Contrato de Administração da MP-35

> Status: `MP-35A/B/C integradas; MP-35C integrada em e6789bf, com CI pós-push
> aprovada e auditoria independente pós-correção ainda não registrada; MP-35D
> não iniciada`
>
> Definido em: 2026-08-25
>
> Revisão: 2026-09-01
>
> Integração da MP-35A: 2026-08-26, commit `a51389e`, CI pós-push aprovada
>
> Integração da MP-35B: 2026-08-27, commit `60144c2`, reauditoria independente
> e CI pós-push aprovadas
>
> Integração da MP-35C: 2026-09-01, commit `e6789bf`, CI pós-push aprovada;
> auditoria independente pós-correção ainda não registrada
>
> Escopo deste documento: contrato consolidado de Usuários, Propriedades,
> vínculos, concorrência e fundação persistente da MP-35.

## Fases e fronteiras

| Fase | Conteúdo | Estado |
|---|---|---|
| MP-35A | contratos, migrations append-only, constraints, versões, catálogos, snapshot IBGE e idempotência persistente | concluída e integrada diretamente em `a51389e`; CI pós-push aprovada |
| MP-35B | administração HTTP de Usuários e convites | concluída e integrada diretamente em `60144c2`; reauditoria independente e CI pós-push aprovadas |
| MP-35C | Propriedades, vínculos e Localidades no backend | concluída e integrada diretamente em `e6789bf`; CI pós-push aprovada; auditoria independente pós-correção ainda não registrada |
| MP-35D | integração das telas administrativas existentes e validação física | não iniciada |

A MP-35A não cria handlers, serviços ou grants de escrita do runtime para os
comandos das fases seguintes. MP-36 e as verticais posteriores permanecem fora.

## Decisões D1-D13

### D1 — criação de Usuários

Somente Administrador ativo cria Admin, Produtor ou Colaborador. A conta nasce
`pendente`, sem senha, e recebe convite. O convite habilita a conta depois da
definição válida de credencial. Administrador é global dentro da organização;
MFA continua portão produtivo.

### D2 — estado do Produtor e Titularidade

Aceitar convite novo ativa `usuarios` e, para perfil Produtor, também
`produtores`. O estado de Produtor representa habilitação cadastral e não a
quantidade de Propriedades acessíveis. Zero acesso efetivo é válido.

Toda Propriedade possui `titular_id` não nulo. Propriedade inativa pode apontar
para cadastro cujo Usuário esteja pendente/inativo e cujo Produtor esteja
inativo; Propriedade ativa exige Usuário e Produtor Titular ativos. Somente
Admin escolhe o Titular inicial. Transferência de
Titularidade não pertence à MP-35.

### D3 — acesso do Colaborador

Aceitar o convite ativa o Colaborador mesmo com zero vínculos. O acesso a uma
Propriedade resulta da combinação:

```text
Usuário ativo
+ perfil Colaborador
+ vínculo direto ativo
+ Propriedade ativa
= acesso efetivo
```

Município e UF nunca concedem acesso.

### D4 — credencial e ativação

Convite novo conclui credencial e ativação atomicamente. O modo persistido novo
é `ativar_usuario`. Os modos históricos `manter_status` e
`ativar_admin_bootstrap` permanecem consumíveis e não são reescritos;
`manter_status` preserva o Usuário pendente e não pode ser emitido por fluxo
novo. Ativação
administrativa posterior serve somente para reativação ou compatibilidade e
nunca pode deixar Usuário ativo sem credencial ativa.

### D5 — alteração de vínculos

Vínculos mudam por delta versionado (`adicionar[]` e `remover[]`), nunca pela
substituição cega da lista completa. Cada comando informa a versão esperada e
aceita no máximo 100 identificadores somando o delta.

### D6 — remoção do último acesso

É permitido remover o último acesso efetivo. O Usuário permanece ativo, pode
autenticar e recebe coleção vazia. Nenhuma remoção de vínculo inativa a conta
automaticamente.

### D7 — proteção administrativa

Auto-inativação de Admin é proibida. Depois de concluído o bootstrap, a
organização preserva transacionalmente ao menos um Administrador ativo, inclusive
sob concorrência. A validação ocorre também no preflight do upgrade, e escritas
de conclusão do bootstrap usam o mesmo lock singleton das mutações de Usuário.

### D8 — localização IBGE

O backend usa snapshot nacional, local e versionado da API de Localidades do
IBGE. A versão inicial contém 27 UFs e 5.571 Municípios, capturados em
2026-08-25. No contrato externo de escrita, o cliente envia somente
`municipio_id`; o backend valida o Município na versão ativa e deriva `uf_id`,
`municipio_nome` e `uf_sigla`. Esses campos derivados não são entradas
autoritativas. Internamente, `municipio_id` e `uf_id` permanecem persistidos e
referencialmente coerentes. Uma versão publicada e suas linhas são imutáveis;
somente seu estado pode avançar de `ativo` para `substituido`. Não há consulta
externa em runtime.

### D9 — limites

| Campo | Limite |
|---|---:|
| Nome de Usuário, Produtor ou Propriedade | 200 caracteres |
| E-mail | 254 caracteres |
| Telefone | 32 caracteres |
| Documento | 64 caracteres |
| Observações | 2.000 caracteres |
| Cultura principal | 120 caracteres |
| Detalhe de motivo | 300 caracteres |
| IDs por delta de vínculos | 100 |

Os limites textuais contam pontos de código Unicode depois de normalização NFC.
HTTP e domínio normalizam antes da persistência; PostgreSQL usa `char_length`
sobre o valor canônico, e o cursor conserva exatamente a chave calculada pelo
SQL. Unidades UTF-16 não são a métrica do contrato.

### D10 — motivos administrativos

O catálogo único é `fim_relacao`, `mudanca_responsabilidade`,
`cadastro_duplicado`, `correcao_administrativa`, `suspensao_operacional` e
`outro`. `outro` exige detalhe; nos demais códigos o detalhe é opcional. O texto
legado de inativação de vínculo é preservado e projetado para o catálogo, sem
perda do valor original.

### D11 — idempotência

Comandos administrativos mutáveis exigirão chave idempotente. A chave é
armazenada somente como SHA-256, no escopo de organização e ator, por 90 dias.
Mesma chave e mesmo corpo devolvem o mesmo recibo; mesma chave com hash de corpo
diferente retorna `409`. A purga usa papel separado e remove somente registros
expirados. Cada reserva registra `sessao_id`, `request_id` e `correlation_id`;
uma referência composta garante que a sessão pertence ao mesmo ator e à mesma
organização. O recibo aceita somente resultado, tipo/ID do recurso e a versão
obrigatória para recursos versionados; convite não aceita versão. Não entram
PII, senha, token ou payload arbitrário.

A unicidade persistente é exclusivamente organização + ator + hash da
`Idempotency-Key`. `actorSessionId` é obrigatório, deve estar ativo e vinculado
ao mesmo ator/organização e é auditado, mas não participa da unicidade. Assim,
outra sessão válida do mesmo ator recebe o replay exato sem novo efeito,
auditoria, versão ou revogação; outro ator possui escopo idempotente distinto.

### D12 — notificações

A MP-35 não cria eventos de notificação. Auditoria e revogação de sessão cobrem
as consequências necessárias.

### D13 — sessões

No MVP, qualquer alteração que mude autorização revoga as sessões dos Usuários
diretamente afetados, inclusive ampliações. É uma simplificação temporária:
evolução futura pode preservar sessão quando o acesso apenas aumentar. Mudanças
exclusivamente cadastrais, como nome, telefone, observações ou cultura, mantêm
a sessão.

## Contratos persistentes da MP-35A

- `usuarios`, `produtores`, `propriedades` e `usuario_propriedade` possuem
  versão positiva para concorrência otimista, incrementada exatamente uma vez
  em cada `UPDATE`; saltos, regressões e incrementos duplicados são rejeitados;
- a habilitação de `produtores.status` acompanha `usuarios.status`: Produtor só
  está ativo quando o Usuário correspondente está ativo;
- Propriedade ativa exige Titular habilitado;
- o último Admin ativo é protegido depois do bootstrap;
- ativar um Usuário por `UPDATE` exige credencial ativa no estado final da
  mesma transação, inclusive quando a escrita usa o papel runtime;
- o runtime ativa o cadastro de Produtor durante o aceite somente por função
  `SECURITY DEFINER` estreita, derivada do convite válido; o papel não recebe
  `UPDATE` em `produtores`;
- convite administrativo novo exige emissor Administrador ativo;
- `motivos_administrativos` persiste o catálogo D10;
- `comandos_administrativos_idempotencia` reserva e conclui recibos por 90 dias;
- a reserva usa referência composta para impedir que um ator associe comando à
  sessão de outro Usuário ou organização;
- `catalogo_localidades_ibge_versoes`, `ufs_ibge` e `municipios_ibge` persistem
  a fonte nacional versionada;
- `propriedades.localidades_versao_id`, `municipio_id` e `uf_id` formam a
  referência oficial, e nome/sigla são derivados;
- o modo `ativar_usuario` é acrescentado aos convites sem remover os modos
  históricos.

O backfill de motivos converte apenas os campos novos: `criado_em`,
`atualizado_em` e os demais metadados históricos permanecem inalterados.

Migrations antigas são imutáveis. Dados incompatíveis fazem a nova migration
falhar antes de qualquer correção silenciosa.

O `down` da fundação é validado em banco efêmero sem registros novos exclusivos
do modo `ativar_usuario`. Como o fluxo de convite já existente passa a emitir
esse modo, qualquer ambiente que o tenha consumido deve tratar o downgrade como
incompatível: o esquema anterior não representa fielmente o histórico e a
operação deve falhar com segurança em vez de reescrever ou apagar convites.

## Contratos HTTP implementados nas MP-35B e MP-35C

### Precisões de execução da MP-35B

- mutações de Usuário respondem com recibo seguro composto somente por
  `resultado`, `recurso_tipo`, `recurso_id` e, quando aplicável, `versao`;
  a repetição idempotente devolve exatamente o mesmo status e recibo, sem
  persistir PII ou reconstruir uma representação possivelmente mais nova;
- a projeção administrativa de Usuário expõe `produtor_id` somente quando o
  perfil for Produtor. Esse ID canônico permite que a MP-35C selecione o
  `titular_id` sem confundir Usuário e Produtor;
- a edição administrativa do e-mail principal é aceita somente para Usuário
  `pendente`. A mesma transação revoga convite, desafio e outbox anteriores e
  emite substituto para o novo endereço. Usuários ativos ou inativos usam os
  fluxos verificados de conta/recuperação da MP-33B;
- `PATCH /v1/usuarios/:id/status` opera somente `ativo <-> inativo`.
  `pendente` pertence exclusivamente à criação e ao aceite do convite e, como
  destino dessa rota, retorna `422 validation_error`, nunca conflito `409`;
- a emissão administrativa canônica passa a ser
  `POST /v1/usuarios/:id/convites`. A antiga emissão em
  `POST /v1/auth/invitations` é removida para não conservar uma escrita
  paralela sem a idempotência D11. O aceite público continua exclusivamente
  em `POST /v1/auth/invitations/accept` e preserva `204 No Content`;
- a resposta de leitura usa `snake_case`; lista e detalhe não incluem senha,
  credencial, token, hash, desafio, payload da outbox ou aliases do mock.
- o runtime não possui `INSERT`, `UPDATE` ou `DELETE` administrativo direto em
  `usuarios`, `produtores` ou na tabela de idempotência. As quatro mutações
  usam funções transacionais estreitas, owned por papel seguro `NOLOGIN`, com
  `EXECUTE` removido de `PUBLIC` e concedido somente ao papel operacional;
- criação de Admin fica fechada na composição de produção enquanto o portão de
  MFA não estiver implementado. Testes e ambientes não produtivos podem criar
  Admin pendente para validar D1, sem converter isso em autorização produtiva;
- lista usa cursor AES-256-GCM versionado, confidencial, autenticado, expirável
  e vinculado ao fingerprint canônico de `busca`, `perfil` e `status`. A chave
  de ordenação vem diretamente de `lower(nome)` no PostgreSQL. O keyring
  dedicado `ADMIN_USER_CURSOR_*` é obrigatório no startup, não possui fallback
  e não pode reutilizar material criptográfico da outbox;

| Método e rota | Fase | Ação | RBAC |
|---|---|---|---|
| `GET /v1/usuarios` | B | listar com cursor e filtros | somente Admin |
| `POST /v1/usuarios` | B | criar pendente e emitir convite | somente Admin |
| `GET /v1/usuarios/:id` | B | detalhar cadastro | somente Admin |
| `PATCH /v1/usuarios/:id` | B | alterar dados cadastrais versionados | somente Admin |
| `PATCH /v1/usuarios/:id/status` | B | ativar/inativar com motivo | somente Admin |
| `POST /v1/usuarios/:id/convites` | B | emitir/reemitir convite | somente Admin |
| `GET /v1/usuarios/:id/propriedades` | C | listar vínculos diretos | somente Admin |
| `PATCH /v1/usuarios/:id/propriedades` | C | aplicar delta versionado | somente Admin |
| `POST /v1/propriedades` | C | criar com Titular inicial | somente Admin |
| `PATCH /v1/propriedades/:id` | C | alterar cadastro, sem transferir Titular | somente Admin |
| `PATCH /v1/propriedades/:id/status` | C | ativar/inativar com motivo | somente Admin |
| `GET /v1/localidades/ufs` | C | listar UFs do snapshot ativo | Admin autenticado |
| `GET /v1/localidades/municipios` | C | listar Municípios por UF e cursor | Admin autenticado |

Produtor não administra estrutura geral. Colaborador não cria Usuário, não
altera vínculos e não define Titular. O acesso operacional já existente em
`GET /v1/propriedades` continua filtrado dentro da consulta.

## Concorrência, erros e privacidade

- mutações versionadas com versão divergente retornam
  `409 version_conflict`;
- chave idempotente reutilizada com outro corpo retorna
  `409 idempotency_conflict`;
- regra de negócio retorna `409 business_rule_conflict`;
- JSON malformado ou estrutura inválida retorna `400 invalid_request`; valor,
  enum ou limite D9 semanticamente inválido retorna `422 validation_error`;
- recurso administrativo inexistente retorna `404 not_found`; sessão ausente,
  revogada, expirada ou stale retorna `401 invalid_session`; perfil ativo sem
  permissão retorna `403 forbidden`;
- listas usam cursor confidencial e autenticado por nome/ID, nunca offset como
  contrato público; valor vazio, acima do limite formal, truncado, malformado,
  adulterado, expirado, com chave/versão desconhecida ou trocado entre filtros
  falha com `400 invalid_request`;
- todas as mutações administrativas usam `Idempotency-Key`; comandos
  versionados também exigem a versão-base;
- e-mail, telefone, documento, detalhe de motivo e conteúdo do comando não são
  copiados para logs nem para a chave idempotente;
- auditoria registra ator, sessão, recurso, resultado, motivo, correlação e
  Usuários afetados sem armazenar segredo ou token.
- cada item de delta registra exatamente um evento interno `criado`,
  `reativado` ou `inativado`, com estado anterior/posterior, tipo derivado,
  motivo D10/detalhe permitido e horário do PostgreSQL; rollback e replay não
  deixam eventos adicionais;
- lista de Usuários usa cursor opaco estável por nome normalizado e ID, com
  limite padrão 50 e máximo 100; `busca` compara literalmente nome, e-mail ou
  documento depois do escopo Admin e nunca concede autorização. A busca infixa
  com `ILIKE` exige benchmark no volume produtivo esperado antes da liberação;
- o corpo HTTP de alteração de status usa `motivo` como código D10 e
  `motivo_detalhe` opcional; `outro` exige detalhe;
- `POST /v1/usuarios/:id/convites` recebe somente
  `modo_ativacao=ativar_usuario`; modo histórico bem formado é erro semântico
  `422` e campo desconhecido é erro estrutural `400`;
- a reserva idempotente, o efeito, a auditoria e o recibo pertencem à mesma
  transação. Falha anterior ao commit não conserva linha `processando`;
- o worker obtém o horário corrente do PostgreSQL depois dos locks coordenados
  e revalida mensagem, lease, desafio e convite imediatamente antes do envio.
  O SMTP ocorre com transação e lock abertos; capacidade e latência sob carga
  representativa são portão produtivo explícito.

## Critérios de aceite por fase

MP-35A termina somente com migrations anteriores imutáveis, `up/down/redo`
válidos, snapshot com 27 UFs/5.571 Municípios, constraints e contratos
automatizados, preflight/concorrência/privilégios exercitados em PostgreSQL com
duas conexões e barreira explícita, documentação coerente e nenhuma rota
administrativa nova.

MP-35B termina somente com E2E das seis rotas usando bearer, autenticação e
login runtime real, incluindo matriz 6 x 5 para Admin, ausência de autenticação,
sessão stale, Produtor e Colaborador; DML adversarial negado; criação dos três
perfis; erros HTTP exatos; paginação acima de 100; as sete corridas da
reauditoria observadas em `pg_stat_activity`/`wait_event` com duas conexões;
outbox em voo linearizável, inclusive expiração enquanto espera pelo lock;
compatibilidade dos fluxos de conta; OpenAPI e documentação validados.
Isolamento entre organizações é não aplicável ao modelo singleton atual e não
justifica inventar uma segunda organização.

## Portões operacionais anteriores à produção

A fundação fornece a função one-shot, idempotente e em lotes:

```sql
SELECT public.tche_purgar_comandos_administrativos_mp35a(1000);
```

Ela aceita limite entre 1 e 5.000, usa 1.000 quando o argumento é omitido e
rejeita `NULL` explícito ou valor fora do intervalo com SQLSTATE `22023`, antes
de qualquer remoção. Remove somente reservas já expiradas e deve ser executada
por conta `LOGIN` exclusiva, membro apenas de
`tche_agro_administration_maintenance`. O papel não possui `SELECT` ou `DELETE`
direto na tabela. Continuam como portões produtivos:

- provisionar/rotacionar a credencial exclusiva e definir responsável,
  frequência, timeout, alertas, métricas, repetição e revisão de privacidade;
- ensaiar `000006` e `000007` em cópia representativa e anonimizada do volume
  produtivo, com `lock_timeout` compatível com a janela aprovada, monitorando
  duração, espera por lock, transações abortadas e espaço temporário;
- aceitar o ensaio somente se a migration for atômica, não exceder a janela de
  manutenção aprovada, não deixar lock após rollback e preservar contagens e
  timestamps amostrados antes/depois;
- executar no ambiente de ensaio `npm run migrations:verify` e
  `npm run migrate:up`, registrar tempos pelo orquestrador e consultar
  `pg_stat_activity`/`pg_locks` durante a execução. Testcontainers locais são
  evidência funcional, não representam o volume nem a contenção produtivos;
- provisionar e rotacionar o keyring dedicado de cursor sem compartilhar chave
  com a outbox, medir a busca infixa `ILIKE` no volume esperado e ensaiar a
  capacidade/latência do SMTP com a transação e o lock do worker abertos.

A MP-35C acrescenta a migration append-only `000009`, quatro operações
transacionais estreitas, as sete rotas Admin-only, cursores exclusivos,
Localidades versionadas, RBAC, auditoria, revogação de sessões, idempotência e
testes HTTP/PostgreSQL para Propriedades e vínculos. Ela foi concluída e
integrada diretamente em `e6789bf`, com CI pós-push aprovada; a auditoria
independente pós-correção ainda não está registrada. A MP-35D continua não
iniciada.

- as quatro operações estreitas validam o tipo JSON original, presença,
  nulabilidade e formato de cada entrada antes de contexto, reserva de
  idempotência, locks ou qualquer efeito; coerções por `->>` não constituem
  validação de fronteira;
- a classificação HTTP é específica por rota: `titular_id` é válido na criação,
  `status` é válido somente na rota de status e `tipo_vinculo` é derivado. Erro
  estrutural prevalece como `400`; campo semanticamente proibido, quando a
  estrutura é válida, retorna `422`;
- o `versao` recebido nas mutações versionadas é somente a precondição de
  concorrência otimista. No `PATCH` cadastral de Propriedade ele nunca é
  atribuído como dado; `titular_id`, `status`, timestamps e campos territoriais
  derivados são recusados como campos do patch;
- o cursor de vínculos é AES-256-GCM, confidencial, autenticado e vinculado ao
  `usuario_id` e aos filtros. O cursor de Municípios autentica a versão imutável
  escolhida na primeira página e é vinculado a `uf_id` e `busca`;
- `ADMIN_LINK_CURSOR_*` e `ADMIN_MUNICIPALITY_CURSOR_*` são keyrings exclusivos
  e materialmente distintos entre si, de `ADMIN_USER_CURSOR_*` e da outbox;
- todas as respostas das sete rotas usam `snake_case` e
  `Cache-Control: no-store`.
- UUID administrativo canônico é UUID v4 hifenizado, minúsculo e com variante
  RFC (`8`, `9`, `a` ou `b`). O inventário de migrations, fixtures, seeds e
  contratos ativos confirmou compatibilidade; forma malformada é estrutural
  `400`, enquanto versão ou variante inválida em forma UUID é semântica `422`;
- nas mutações, `area_total` é decimal exato em string de formato simples, sem
  expoente, sinal, whitespace ou zero à esquerda. Deve ser maior que zero, ter
  até dez dígitos inteiros, no máximo quatro casas e máximo
  `9999999999.9999`. A correspondência cobre o lexema inteiro com fim absoluto,
  sem depender de `$`: LF, CR, CRLF, U+2028, U+2029, tab, espaço ou qualquer
  caractere adicional são recusados antes da canonicalização. Não há `trim`
  nem limpeza de whitespace. Somente depois dessa validação o backend remove
  zeros fracionários finais e envia o valor ao PostgreSQL, sem `Number`,
  aproximação ou arredondamento. Número JSON e tipos estruturais incompatíveis
  retornam `400`; string decimal fora do domínio, inclusive com terminador
  escapado em JSON válido, retorna `422`; JSON com LF bruto dentro da string é
  malformado e retorna `400`; `null` existe somente como limpeza no PATCH;
- o executor transacional único das quatro mutações executa `BEGIN`, chama a
  função SQL, valida cardinalidade, linha, resultado, HTTP e recibo completo e
  coerente, e somente então executa `COMMIT`. Qualquer resposta inesperada
  produz `ROLLBACK`, `503 service_unavailable` e nenhum efeito persistido;
- Testcontainers expõe apenas a porta interna `5432` e usa a porta dinâmica
  atribuída pelo Docker após o `start`, com banco e role únicos por processo.
  Não há reserva manual de porta, mutex em arquivo nem recuperação
  `stat`/`unlink`;
- TypeScript, MP-35B e MP-35C compartilham a política sensível
  `senha`, `password`, `token`, `documento`, `cpf`, `cnpj`, `segredo`,
  `credential`, `authorization` e `cookie`; a igualdade exata das
  representações TS/SQL é teste de integração;
- somente `SQLSTATE 22023` identificado por
  `ck_mp35c_input_validation` é traduzido localmente para
  `422 validation_error`. Qualquer erro PostgreSQL não allowlisted permanece
  fail-closed como `503 service_unavailable`;
- a corrida Titular × ativação possui dois ordenamentos válidos e testados com
  dois PIDs reais. Se a ativação obtiver os locks primeiro, ela conclui e a
  inativação retorna `active_holder_conflict`; se a inativação obtiver primeiro,
  ela conclui e a ativação retorna `invalid_holder`. Cada caso exige um único
  efeito concluído, sem reserva `processando`, sem deadlock e com versões,
  auditoria e revogação coerentes.

## Fora de escopo

- transferência de Titularidade;
- administração estrutural por Produtor ou Colaborador;
- autorização por Município/UF;
- notificações novas;
- endpoints de MP-36 ou posteriores;
- deploy, release, tag, publicação, infraestrutura produtiva e ativação de
  serviços externos.
