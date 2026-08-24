# Contrato de Autenticação e Recuperação — MP-33B

> Revisão documental: 2026-08-24
>
> Estado: CONCLUÍDA TECNICAMENTE; NÃO LIBERADA PARA PRODUÇÃO

## Objetivo e fronteira

A MP-33B implementa no backend credenciais, login, sessões stateful, tokens
opacos, convites, ações de conta, envio transacional de e-mail, proteção contra
abuso e auditoria genérica. Ela não conecta o aplicativo à API, não altera o
mock, não lista Propriedades em `/v1/auth/me` e não antecipa o RBAC completo da
MP-35. A conexão posterior do cliente foi realizada na MP-33C sem alterar essa
fronteira do backend.

A branch-base protegida é `backend`. A migration `000001`, já integrada nessa
base, é imutável. Todo objeto da MP-33B nasce em novas migrations SQL com
`up/down` explícitos e checksum selado antes do pull request.

A integração implementada na MP-33C mantém este backend sem alterar suas regras:
access token somente em memória, refresh token em storage seguro nativo,
single-flight, nenhum token/sessão HTTP no `AsyncStorage` e nenhum fallback
para mock. Os fluxos de convite, senha e e-mail são concluídos pela própria
pessoa; o segundo e-mail verificado do Administrador permanece disponível.
Detalhes do cliente estão em `contrato-integracao-app-mp33c.md`.

## Estado da implementação

O corte presente na branch inclui migrations, repositórios PostgreSQL,
serviços, rotas OpenAPI, blocklist, Argon2id, tokens/sessões, ações de conta,
outbox/SMTP, worker, auditoria e bootstrap. Break-glass permanece apenas como
schema, rotas de continuação e parser fail-closed inalcançáveis, sem start. A
API, o migrador, o worker e o bootstrap de plataforma usam credenciais
distintas.

O corte passou por typecheck, suítes unitária/HTTP/integração, build e smokes.
A composição HTTP da MP-33C agora consome seus contratos de autenticação e
conta; o Demo continua independente. Não existe deploy ou autorização de
release implícita neste estado. Os portões de produção continuam descritos ao
fim do contrato e nas pendências ativas.

## Senhas

A política efetiva é centralizada, versionada e possui estes pisos:

- de 8 a 128 pontos de código Unicode depois de normalização NFC;
- nenhum `trim`; espaços e Unicode são preservados;
- regra deliberada de composição `1-de-3`: ao menos uma maiúscula Unicode
  `Lu`, um número decimal Unicode `Nd`, ou pontuação/símbolo Unicode `P`/`S`;
- espaço não satisfaz a regra `1-de-3`;
- comparação integral contra blocklist local versionada, nunca por substring;
- nenhuma troca periódica sem evidência de comprometimento.

O valor NFC completo é enviado ao Argon2id. A consulta à blocklist usa uma
chave separada NFC em minúsculas Unicode, preserva espaços e não muda o valor
hasheado. O manifesto da blocklist registra fonte, licença, versão, data,
quantidade de entradas e SHA-256. Ausência, lista vazia, contagem ou hash
divergente tornam a configuração inválida em `test` e `production`.

Argon2id usa dependência estável exata, PHC completo, no mínimo 19 MiB, duas
iterações e paralelismo 1. O semáforo limita operações ativas a
`ARGON2_MAX_CONCURRENCY` e admite no máximo a mesma quantidade aguardando; o
excesso falha rapidamente com `429` genérico e `Retry-After: 1`, sem contar
falha de credencial. Login válido faz rehash quando os parâmetros persistidos
ficarem obsoletos. Mudança de política de senha não é confundida com rehash: a
credencial guarda a versão da política aplicada.

O mínimo de oito caracteres e a regra `1-de-3` são aceitações explícitas de
risco para uma autenticação ainda sem MFA. MFA permanece portão obrigatório
antes de liberação pública de contas Administradoras.

## Login e proteção contra abuso

E-mail inexistente, senha incorreta, conta pendente, conta inativa e ausência
de credencial retornam o mesmo `401`, com envelope e trabalho criptográfico
equivalentes. Quando não existir PHC utilizável, o backend verifica um PHC
Argon2id fictício válido.

Antes do Argon2id o login consulta primeiro o bucket persistido por IP e depois
o bucket por HMAC do e-mail normalizado, criado da mesma maneira para identidade
conhecida ou desconhecida. Um precheck bloqueado responde `429` com
`Retry-After` e não executa Argon2. E-mail e IP usam chaves e finalidades
separadas; SHA-256 simples não pseudonimiza identificadores previsíveis.

Depois de cinco falhas em quinze minutos, a progressão inicial é 1, 2, 4, 8 e
15 minutos, com teto de 15 minutos. Tentativas durante o bloqueio não executam
Argon2id. Sucesso limpa o bucket do identificador, mas não o bucket compartilhado
de IP. O bloqueio de segurança nunca altera `usuarios.status`.

`trustProxy` permanece falso. Uma futura produção atrás de proxy aceitará
somente CIDRs explicitamente configurados. IP nunca concede autorização.

## Tokens e sessões

Access e refresh tokens são valores opacos aleatórios de 256 bits. Somente
SHA-256 é persistido. Não são usados JWT nem cookies nesta fase.

- access token: 15 minutos;
- validade absoluta da sessão: 30 dias;
- inatividade: 14 dias desde o último refresh bem-sucedido;
- refresh rotativo e estritamente atômico;
- replay revoga somente a sessão/família comprometida;
- não existe janela que aceite duas utilizações do mesmo refresh.

Em chamadas concorrentes, uma resposta pode retornar sucesso antes de outra
detectar replay e revogar a família; nesse caso, o token recém-emitido também
se torna inválido. A MP-33C implementa refresh single-flight e não repete
automaticamente um refresh antigo.

Logout da sessão atual é idempotente. Logout global, recuperação de senha,
inativação, alteração concluída de e-mail e mudanças estruturais aplicáveis
revogam as sessões afetadas. Troca autenticada de senha revoga as outras
sessões e gira os tokens da sessão atual.

Respostas com segredos usam `Cache-Control: no-store` e `Pragma: no-cache`.
Access e refresh nunca aparecem em URLs, logs, auditoria, erros ou exemplos
reais do OpenAPI.

## Desafios, convites e ações de conta

Convite vale 72 horas. Recuperação comum, confirmação de e-mail e autorizações
restritas valem inicialmente 30 minutos. Valores são configuráveis dentro de
tetos validados e a expiração efetiva é persistida na emissão.

Desafios são opacos, aleatórios, vinculados a finalidade e sujeito,
armazenados somente por hash, de uso único e consumidos atomicamente. Um novo
desafio incompatível revoga o anterior. Desafios de ação podem estar no
fragmento de um link HTTPS confiável e são enviados à API somente por `POST`.
O cliente da MP-33C aplica allowlist exata de origem, caminho e finalidade,
mantém o token somente em memória e bloqueia repetição automática. Token e URL
completa não entram em parâmetros de navegação, persistência ou logs. O domínio
oficial precisa estar associado e validado antes da aprovação produtiva.

Convite geral opera somente sobre um `usuario` pendente já existente. Ele não
cria Usuário, Produtor, Propriedade, Titularidade ou vínculo. O bootstrap do
primeiro Admin é a única exceção de identidade inicial e permanece CLI one-shot.

Recuperação comum responde `202` uniformemente, exista ou não a conta. Não
altera a conta antes do consumo válido, revoga todas as sessões na conclusão e
não autentica automaticamente.

Sem MFA, alteração normal de e-mail exige sessão válida, senha atual,
confirmação do endereço atual e confirmação separada do novo endereço. A troca
somente ocorre depois das duas confirmações e revoga todas as sessões.

## Contato secundário do Administrador

Uma conta Administradora pode manter um e-mail secundário previamente
verificado. Ele não é identificador de login, não substitui o e-mail principal
silenciosamente e só pode ser alterado por fluxo autenticado e confirmado.

Quando o único Admin perder o endereço principal, o contato secundário pode
iniciar uma autorização restrita: confirma-se primeiro o contato previamente
verificado, depois o novo endereço principal, e o próprio usuário define a
nova senha. A conclusão revoga todas as sessões/desafios, incrementa a versão
de autorização, notifica os endereços anteriores e não cria sessão normal.

Se os dois endereços forem perdidos, não existe recuperação operacional na
MP-33B. A CLI preservada em código é somente scaffold fail-closed. A porta e o
serviço de domínio não possuem implementação concreta do verificador/emissor,
configuração ou wiring operacional; também não há script npm, variável HMAC,
acesso ao banco ou permissão de start para `tche_agro_platform_ops`. O schema e
duas rotas públicas `POST`/`no-store` de continuação também são scaffold
inalcançável, pois esta fase não consegue emitir o caso, desafio ou autorização
que elas consumiriam.

Antes de implementar ou habilitar o start, é pré-requisito técnico adotar
assinatura Ed25519 com chave privada fora do backend ou serviço externo
equivalente que comprove dois aprovadores distintos, finalidade, expiração e
anti-replay. Isso exige implementação deliberada, testes ponta a ponta e nova
migration append-only quando houver impacto persistido. HMAC simétrico não é
uma opção aprovada para break-glass.

## Recuperação assistida por Administrador

A recuperação assistida é permitida somente para conta ativa de Produtor ou
Colaborador. Um único Admin ativo da mesma organização pode solicitar e
aprovar; esse risco foi aceito por ser o cenário operacional atual. Toda ação
exige motivo categorizado, referência operacional curta e auditoria. A
confirmação do novo e-mail prova apenas controle do endereço; a empresa ainda
deve aprovar uma política operacional versionada de validação de identidade.

Por isso, a estrutura pode ser executada em desenvolvimento/teste, mas fica
desabilitada por padrão em produção até a política operacional ser informada.
Recuperação assistida HTTP cujo alvo seja Admin é sempre proibida na MP-33B.

Estados válidos:

```text
solicitada -> em_validacao -> aguardando_confirmacao_email
           -> aguardando_nova_senha -> concluida
```

`rejeitada`, `cancelada` e `expirada` são terminais. Existe no máximo uma
recuperação ativa por usuário. A aprovação cria desafio, outbox e evento de
enfileiramento na mesma transação. A confirmação do novo e-mail consome o
desafio e entrega uma autorização opaca curta que só permite definir senha,
concluir ou cancelar.

A conclusão bloqueia e revalida o caso, confirma a unicidade do e-mail,
atualiza e-mail e PHC, consome a autorização, revoga sessões/tokens/desafios,
incrementa a versão de autorização, conclui o registro e grava auditoria em
uma única transação. Ela nunca ativa conta, muda perfil, organização,
Titularidade ou vínculo.

As referências entre recuperação, aprovações, desafio e autorização são
validadas nos dois sentidos no estado final da transação. Os testes cobrem
ordens diferentes de DML, alteração e exclusão de referências e preservação da
conclusão histórica sem reabrir autorização já consumida.

## Outbox e SMTP

Links usam exclusivamente `AUTH_ACTION_BASE_URL`; o cabeçalho `Host` nunca é
fonte. Produção exige HTTPS e SMTP com TLS verificado. Mailpit é exclusivo de
`development` e `test`.

O payload sensível temporário da outbox usa criptografia autenticada com chave
externa e versionada, nonce exclusivo e contexto que vincula organização,
finalidade e item. A outbox possui tentativas limitadas, backoff, timeout,
claim concorrente e revalida o desafio antes de enviar. Entrega é pelo menos
uma vez; mensagem repetida é inofensiva porque o desafio é de uso único.

Após envio, cancelamento ou expiração, ciphertext e material sensível são
removidos. `email_enfileirado` é gravado na transação de negócio;
`email_enviado` somente depois de o worker receber aceitação do SMTP.

## Auditoria e papéis do banco

A auditoria genérica é append-only e separada dos logs. Eventos críticos de
estado são inseridos na mesma transação da alteração. Metadados usam allowlist,
tipos e limite de tamanho. E-mail e IP são correlacionados somente por HMAC com
chaves/finalidades distintas. Tokens aleatórios continuam usando SHA-256.

O registro diferencia ator, sessão do ator e usuário afetado. As referências
são vinculadas à mesma organização; fluxos autenticados propagam a sessão, e
eventos de autenticação/outbox registram o usuário afetado quando conhecido.
Uma sessão informada sempre pertence ao ator. Continuações públicas sem sessão
usam ator `sistema` e preservam o usuário afetado em coluna separada.

Senha, token, endereço desconhecido em texto desnecessário, documento,
conversa, payload completo, headers, conexão ou chave nunca entram em logs ou
auditoria. Retenção de 365 dias permanece proposta; não existe eliminação
automática até revisão jurídica, de privacidade e operacional.

O proprietário/migrador, o runtime da API, o worker da outbox e a operação de
plataforma usam quatro credenciais distintas. As funções de concessão
`tche_agro_runtime`, `tche_agro_outbox_worker` e
`tche_agro_platform_ops` são `NOLOGIN`; contas `LOGIN` e associações são
provisionadas externamente. O runtime não pode atualizar, excluir ou truncar
auditoria. `tche_agro_platform_ops` é bootstrap-only: não recebe DML de
credenciais, sessões, access/refresh, autorizações, recuperações ou break-glass.
Seus DMLs colunares de Usuário, desafio, convite, outbox, bootstrap e auditoria
são limitados ao primeiro Admin pendente e protegidos por `SESSION_USER` e
constraints diferidas de estado final. Nenhuma migration destrutiva usa cascade
e o down da MP-33B remove somente seus próprios objetos.

Esse total descreve o corte histórico da MP-33B. A MP-34 acrescenta uma quinta
credencial operacional, membro exclusivo do papel `NOLOGIN`
`tche_agro_notifications_maintenance`, para a purga one-shot de notificações.
Ela não pode combinar o papel de runtime e ainda não foi provisionada em
produção. A implementação foi integrada diretamente à branch `backend` no
commit `e787707`, sem pull request e com os três jobs da CI pós-push aprovados;
não houve tag, deploy, release ou publicação.

## Autorização mínima e liberação

Os endpoints self-service atuam somente sobre o próprio usuário. Convite e
recuperação assistida exigem Admin ativo da mesma organização. `/v1/auth/me`
retorna identidade, sessão, modo de escopo e versão de autorização, sem listar
Propriedades. Sessão inválida/revogada retorna `401`; dependência indisponível
do PostgreSQL retorna `503`.

O corte implementado e validado da MP-33B cobre autenticação completa de fator
único no backend. Isso não representa liberação produtiva completa: MFA de
Admin, política operacional de identidade, segredos, SMTP,
backup/restauração e observabilidade continuam portões próprios. Break-glass
não faz parte das capacidades operacionais deste corte; Ed25519 ou serviço
externo com dois aprovadores é requisito anterior à sua futura implementação.
