# Politica De Sessao

> Status: `ATIVO`
>
> Definida em: 2026-07-30
>
> Revisão documental: 2026-08-25
>
> Origem: `MP-01` / `QA-P0-04`

## Objetivo

Este documento define o contrato minimo de sessao para o primeiro corte HTTP
do aplicativo. Ele separa:

- o comportamento local demonstrativo preservado no Demo;
- a politica implementada no backend e na composição HTTP;
- o que permanece bloqueado até a liberação produtiva.

O documento não substitui a implementação ou seus testes. Biometria, PIN,
cache produtivo e sincronização permanecem fora da MP-33C.

## Estado Atual Do Mock

O aplicativo atual:

- autentica por credencial local ou usuario demonstrativo;
- sanitiza o usuario antes de salvar;
- persiste o usuario em `@tche:user`;
- restaura esse usuario depois de fechar e reabrir o processo;
- bloqueia novos logins de usuario pendente ou inativo;
- remove `@tche:user` no logout.

O aplicativo atual nao possui:

- access token;
- refresh token;
- expiracao;
- rotacao;
- revogacao no servidor;
- revalidacao de perfil, status ou escopo ao restaurar;
- janela de uso offline;
- bloqueio por inatividade;
- retomada protegida por PIN ou biometria;
- segregacao produtiva de cache por usuario e organizacao.

Esse comportamento continua sendo apenas local/demonstrativo. A restauracao de
`@tche:user` nao comprova identidade ou autorizacao e nao pode ser promovida a
sessao produtiva.

## Política efetiva do primeiro corte HTTP

### Tempos Padrao

| Controle | Valor inicial |
|---|---:|
| validade do access token | 15 minutos |
| revalidacao online maxima | a cada renovacao do access token |
| proteção visual ao entrar em background | imediata |
| novo login após permanência em background | 15 minutos |
| bloqueio local por inatividade no foreground | 15 minutos, sem logout automático |
| consulta offline na MP-33C | não disponível; composição HTTP online-only |
| teto de uma futura janela offline segura | 24 horas desde a última revalidação bem-sucedida |
| validade absoluta do refresh token | 30 dias desde o login interativo |
| inatividade da sessao no servidor | 14 dias desde o ultimo refresh bem-sucedido |

Esses valores sao limites iniciais. Uma organizacao pode adotar limites
menores. Aumentar qualquer limite exige nova decisao de seguranca registrada
nos documentos ativos.

### Token E Identidade

- O access token deve ser curto e usado apenas para chamadas ao backend.
- O refresh token opaco deve ser rotacionado atomicamente a cada uso, protegido
  pelo storage seguro nativo (`SecureStore` no aplicativo Expo) e revogado
  quando houver reutilizacao indevida.
- O backend persiste somente SHA-256 de access e refresh tokens. Reutilizacao
  de refresh revoga apenas a sessao/familia comprometida e nao possui janela
  de tolerancia.
- Access token, refresh token e sessão HTTP nao podem ser persistidos em
  `AsyncStorage`.
- O access token deve permanecer somente em memoria quando a plataforma
  permitir.
- Senha, token, segredo, PIN e material criptografico nao podem aparecer em
  logs, mensagens, analytics ou snapshots comuns.
- A sessao produtiva deve possuir ao menos `session_id`, `usuario_id`,
  organizacao/tenant, instante de emissao, expiracoes e instante da ultima
  revalidacao.
- Reservas idempotentes administrativas persistem ator e sessão com referência
  composta: a sessão deve pertencer ao mesmo Usuário e à mesma organização.
  Informar `actorUserId` com sessão alheia é rejeitado pelo banco.
- Perfil e escopo recebidos no login sao fotografia de apresentacao. A
  autorizacao efetiva continua sendo validada no servidor por acao e
  Propriedade.
- A composição HTTP não possui fallback para mock. Indisponibilidade e resposta
  inválida falham de forma explícita e não mudam a fonte de dados.

### Revalidacao

A sessao deve revalidar perfil, status, organizacao e escopo:

1. no inicio do aplicativo, antes de liberar uma sessao restaurada, quando
   houver rede;
2. na renovacao de cada access token;
3. imediatamente depois de recuperar conectividade;
4. ao voltar ao foreground depois do bloqueio local;
5. quando o servidor informar revogacao, usuario inativo, mudanca de escopo ou
   versao de autorizacao desatualizada.

Revalidacao bem-sucedida deve atualizar a fotografia local de perfil e escopo.
Se o escopo diminuir, dados fora do escopo devem ficar imediatamente
inacessiveis e ser removidos ou reclassificados conforme a politica de cache.

Usuario pendente, inativo, removido, sessao revogada ou refresh token expirado
nao recebe periodo de graca depois que essa condicao for conhecida. A sessao
deve terminar de forma controlada.

Na MP-33C, chamadas concorrentes que encontram access expirado compartilham uma
única promessa de refresh. Cada chamada pode ser repetida no máximo uma vez
depois da rotação bem-sucedida. `invalid_credentials` não dispara refresh;
`401` na rotação encerra a sessão; somente um `503` explícito durante
refresh/restauração preserva o refresh e mostra indisponibilidade. Uma falha de
transporte ambígua durante a rotação não permite reutilizar o refresh anterior
e exige novo login.

No cold start, a composição não possui access token e tenta rotacionar o
refresh protegido antes de criar uma sessão em memória. Sucesso restaura a
sessão sob lock e exige a senha completa. Um `503` explícito mantém o estado
indisponível sem liberar dados; falha de transporte ambígua limpa a sessão.

Depois de a sessão estar carregada, falha de transporte, `429` ou `5xx` em
`GET /v1/auth/me` não consome refresh nem encerra a identidade local. A tela
fica indisponível e coberta até nova revalidação. Resposta controlada que
comprove sessão ou identidade inválida termina a sessão.

### Inatividade E Retomada Segura

- Ao entrar em background, o aplicativo deve cobrir imediatamente todos os
  dados operacionais com proteção visual, independentemente do tempo decorrido.
- Ao voltar antes de 15 minutos, pode continuar somente se a sessão ainda for
  válida e depois da revalidação aplicável.
- Permanência de 15 minutos ou mais em background exige novo login.
- Depois de 15 minutos sem interação no foreground, o aplicativo aplica lock
  local. Esse lock oculta dados, mas não encerra nem revoga automaticamente a
  sessão apenas por ausência de toque.
- Fechar, forcar parada ou reiniciar o processo nao deve ignorar o bloqueio.
- Na MP-33C, a restauração bem-sucedida e o desbloqueio usam a senha completa.
- PIN ou biometria podem destravar somente uma sessao ainda valida, vinculada
  ao mesmo aparelho e protegida pelo storage seguro da plataforma.
- PIN ou biometria nao renovam token expirado, nao ampliam a janela offline,
  nao substituem revalidacao do servidor e devem possuir fallback para
  credencial completa.
- Falha ou cancelamento da retomada mantem o aplicativo bloqueado sem revelar
  dados da sessao anterior.

PIN/biometria não integram a MP-33C. A senha completa é o mecanismo efetivo de
desbloqueio e restauração nesse corte.

Bloqueio local e logout são conceitos distintos. Logout apaga segredos e estado
locais e tenta revogar a sessão remota; lock apenas impede a visualização até a
retomada permitida. A MP-33C não introduz PIN ou biometria.

### Uso Offline

- Nao existe login novo, troca de usuario ou troca de perfil offline.
- A composição HTTP da MP-33C é online-only e não persiste resposta de negócio
  para consulta offline.
- Na inicialização, um `503` explícito preserva o refresh sem liberar sessão,
  lista ou detalhe; falha de transporte durante a rotação é ambígua, limpa a
  sessão e exige novo login.
- Estado efêmero ainda visível no processo não é promessa de disponibilidade
  offline e permanece coberto pelas regras de background e lock.
- Rota direta, notificação ou payload local não liberam dado sem autorização
  online e nunca ativam o Demo como fallback.
- Ao recuperar a rede, a revalidacao ocorre antes de sincronizacao, upload,
  download ou envio de operacao pendente.
- Alterar o relogio do aparelho nao pode ampliar validade de token, janela
  offline ou inatividade. Tempos de servidor e relogio monotono devem ser
  usados quando aplicavel.

Uma evolução futura pode adotar uma janela máxima de 24 horas desde a última
revalidação, somente para cache cifrado, segregado por organização/usuário e
explicitamente autorizado por fluxo. Essa janela é teto de projeto, não
capacidade da MP-33C. O comportamento local/offline atual permanece exclusivo
do Demo.

### Logout

O logout deve:

1. bloquear a interface imediatamente;
2. capturar transitoriamente apenas o access token atual para a tentativa de
   revogação e remover refresh token, identidade e estado acessível do aparelho;
3. invalidar a identidade local e descartar respostas de requisições em curso,
   além de limpar filtros, rotas e estado em memória associados ao usuário;
4. impedir que outro usuario veja dados da sessao anterior;
5. tentar revogar a sessao remota em melhor esforço com o access capturado,
   sem refresh ou nova autenticação, e descartá-lo ao terminar;
6. manter caches operacionais somente quando estiverem segregados, cifrados e
   inacessiveis sem nova autorizacao.

Se o logout ocorrer sem rede, a limpeza local e o bloqueio devem concluir
imediatamente. A MP-33C não persiste token ou fila para reconciliar a revogação
depois. O backend limita o risco residual pelos tokens curtos, rotação e
validade absoluta.

Invalidar a sessão no cliente não desfaz uma mutação que o servidor já tenha
aceitado. A resposta tardia é descartada e não pode recriar a identidade local;
a consistência remota continua sendo responsabilidade do endpoint e de sua
transação.

Na MP-35B/C, qualquer mudança de autorização revoga todas as sessões dos
Usuários diretamente afetados, inclusive quando amplia acesso. Alterações
exclusivamente cadastrais preservam a sessão. Preservar sessão em ampliações é
evolução futura e não integra o contrato atual D13.

Excluir arquivos operacionais no logout nao e regra automatica deste contrato.
O requisito e que eles fiquem inacessiveis a outro usuario. Exclusao,
retencao, criptografia e sincronizacao do cache devem ser definidas por fluxo.

## Respostas Esperadas

| Situacao | Resposta |
|---|---|
| access token expirado, refresh valido e rede disponivel | rotacionar refresh, revalidar e continuar |
| refresh expirado ou revogado | encerrar sessao e exigir login |
| usuario inativo, pendente ou removido | encerrar sessao e informar motivo controlado |
| escopo reduzido | atualizar sessao e ocultar/bloquear dados fora do escopo |
| entrada em background | cobrir os dados imediatamente |
| retorno antes de 15 minutos | continuar somente se os demais limites estiverem válidos |
| retorno depois de 15 minutos | exigir novo login |
| 15 minutos sem interação no foreground | aplicar lock local sem logout automático |
| offline na MP-33C | não liberar cache; `503` explícito preserva refresh e transporte ambíguo durante rotação exige login |
| cold start com refresh e rotação aceita | restaurar sob lock e exigir senha completa |
| transporte ambíguo durante refresh/restauração | limpar sessão e exigir novo login |
| `503` explícito durante refresh/restauração | preservar refresh, bloquear dados e mostrar indisponibilidade |
| transporte, `429` ou `5xx` em `/v1/auth/me` com sessão carregada | preservar sessão, bloquear dados e mostrar indisponibilidade |
| logout offline | limpar e bloquear localmente; não persistir fila/token para revogação posterior |
| rota direta ou notificacao | validar autorizacao no servidor antes de abrir o recurso |

## Critérios de aceite da implementação

1. Nenhum token ou senha fica em `AsyncStorage`, logs ou payload de UI.
2. Access token expira em 15 minutos e refresh token rotaciona a cada uso.
3. Refresh expirado, revogado ou reutilizado encerra a sessao/familia; a
   MP-33C usa single-flight e nunca repete automaticamente token antigo.
4. Usuario inativo e sessao revogada perdem acesso na proxima comunicacao com
   o servidor.
5. Reconexao revalida antes de qualquer operacao remota.
6. Background cobre a interface imediatamente; 15 minutos em background
   exigem novo login; inatividade no foreground aplica lock sem logout.
7. A composição HTTP da MP-33C não libera consulta offline nem fallback para
   mock.
8. Logout online e offline impedem restauracao do usuario anterior.
9. Login de outro usuario nao recebe filtros, notificacoes, rotas ou cache
   acessivel da sessao anterior.
10. Rota direta e notificacao nao contornam autorizacao por Propriedade.
11. Alteracao do relogio do aparelho nao estende a sessao.
12. Testes automatizados do cliente cobrem restauração, background,
    inatividade, revogação, single-flight, rotações concorrentes, troca de
    identidade e logout; autorização por Admin, Colaborador e Produtor é
    coberta no backend da vertical de Propriedades.

## Dependencias E Bloqueios

Status em 2026-08-21: emissão, rotação, revogação e sessões stateful do backend
estão concluídas tecnicamente na MP-33B. A composição HTTP da MP-33C consome
esse contrato com access em memória e refresh no `SecureStore`; o Demo mantém
sua sessão local independente.

O fechamento produtivo ainda depende de:

- domínio oficial e associação validada dos links de ação;
- autorização no servidor para os recursos de negócio posteriores a
  Propriedades;
- validação do ciclo de vida, conectividade e retomada em dispositivo real;
- assinatura e processo de release;
- MFA de Administrador e demais portões operacionais da MP-33B.

Cache segregado/cifrado permanece dependência da futura fase offline, não da
MP-33C online-only.

O fechamento do backend pertence à MP-33B; integração, single-flight e
autorização mínima de leitura de Propriedades foram implementados na MP-33C.
Escritas e o restante do RBAC de negócio pertencem à MP-35. `QA-P0-04` possui
agora implementação e testes automatizados no recorte HTTP, sem alegação de
liberação produtiva enquanto os portões acima continuarem abertos.
