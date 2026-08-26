# Contrato de Administração da MP-35

> Status: `MP-35A corrigida localmente, não integrada, em validação final`
>
> Definido em: 2026-08-25
>
> Escopo deste documento: contrato consolidado de Usuários, Propriedades,
> vínculos, concorrência e fundação persistente da MP-35.

## Fases e fronteiras

| Fase | Conteúdo | Estado |
|---|---|---|
| MP-35A | contratos, migrations append-only, constraints, versões, catálogos, snapshot IBGE e idempotência persistente | corrigida localmente, não integrada, em validação final |
| MP-35B | administração HTTP de Usuários e convites | não iniciada |
| MP-35C | escritas HTTP de Propriedades e deltas de vínculos | não iniciada |
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

## Contratos HTTP reservados para MP-35B e MP-35C

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

- mutações versionadas com versão divergente retornam `409`;
- chave idempotente reutilizada com outro corpo retorna `409`;
- payload ou estado semântico inválido retorna `422`; sintaxe inválida retorna
  `400`;
- recurso administrativo inexistente retorna `404`; autenticação e perfil
  inválidos retornam `401` e `403` conforme o contrato vigente;
- listas usam cursor estável por nome e ID, nunca offset como contrato público;
- todas as mutações administrativas usam `Idempotency-Key`; comandos
  versionados também exigem a versão-base;
- e-mail, telefone, documento, detalhe de motivo e conteúdo do comando não são
  copiados para logs nem para a chave idempotente;
- auditoria registra ator, sessão, recurso, resultado, motivo, correlação e
  Usuários afetados sem armazenar segredo ou token.

## Critérios de aceite por fase

MP-35A termina somente com migrations anteriores imutáveis, `up/down/redo`
válidos, snapshot com 27 UFs/5.571 Municípios, constraints e contratos
automatizados, preflight/concorrência/privilégios exercitados em PostgreSQL com
duas conexões e barreira explícita, documentação coerente e nenhuma rota
administrativa nova.

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
  evidência funcional, não representam o volume nem a contenção produtivos.

MP-35B/C deverão acrescentar domínio, repositórios, transações, RBAC, auditoria,
revogação de sessões, idempotência e testes HTTP/integrados. MP-35D conectará as
telas existentes sem redesenho não necessário e exigirá teste Android físico.

## Fora de escopo

- transferência de Titularidade;
- administração estrutural por Produtor ou Colaborador;
- autorização por Município/UF;
- notificações novas;
- endpoints de MP-36 ou posteriores;
- deploy, release, tag, publicação, infraestrutura produtiva e ativação de
  serviços externos.
