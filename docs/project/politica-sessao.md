# Politica De Sessao

> Status: `ATIVO`
>
> Definida em: 2026-07-30
>
> Origem: `MP-01` / `QA-P0-04`

## Objetivo

Este documento define o contrato minimo de sessao para o primeiro corte
produtivo do aplicativo. Ele separa:

- o comportamento local demonstrativo que existe hoje;
- a politica que deve orientar backend, aplicativo e testes futuros;
- o que permanece bloqueado ate a implementacao produtiva.

Esta politica nao implementa autenticacao, autorizacao, token, biometria,
criptografia, sincronizacao ou backend.

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

## Politica Do Primeiro Corte Produtivo

### Tempos Padrao

| Controle | Valor inicial |
|---|---:|
| validade do access token | 15 minutos |
| revalidacao online maxima | a cada renovacao do access token |
| bloqueio local por inatividade ou background | 15 minutos |
| janela maxima de consulta offline | 24 horas desde a ultima revalidacao bem-sucedida |
| validade absoluta do refresh token | 30 dias desde o login interativo |

Esses valores sao limites iniciais. Uma organizacao pode adotar limites
menores. Aumentar qualquer limite exige nova decisao de seguranca registrada
nos documentos ativos.

### Token E Identidade

- O access token deve ser curto e usado apenas para chamadas ao backend.
- O refresh token deve ser rotacionado a cada uso, protegido pelo storage
  seguro da plataforma e revogado quando houver reutilizacao indevida.
- Access token e refresh token nao podem ser persistidos em `AsyncStorage`.
- O access token deve permanecer somente em memoria quando a plataforma
  permitir.
- Senha, token, segredo, PIN e material criptografico nao podem aparecer em
  logs, mensagens, analytics ou snapshots comuns.
- A sessao produtiva deve possuir ao menos `session_id`, `usuario_id`,
  organizacao/tenant, instante de emissao, expiracoes e instante da ultima
  revalidacao.
- Perfil e escopo recebidos no login sao fotografia de apresentacao. A
  autorizacao efetiva continua sendo validada no servidor por acao e
  Propriedade.

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

### Inatividade E Retomada Segura

- Depois de 15 minutos sem interacao ou em background, o aplicativo deve
  bloquear a interface antes de mostrar dados operacionais.
- Fechar, forcar parada ou reiniciar o processo nao deve ignorar o bloqueio.
- A retomada usa credencial completa por padrao.
- PIN ou biometria podem destravar somente uma sessao ainda valida, vinculada
  ao mesmo aparelho e protegida pelo storage seguro da plataforma.
- PIN ou biometria nao renovam token expirado, nao ampliam a janela offline,
  nao substituem revalidacao do servidor e devem possuir fallback para
  credencial completa.
- Falha ou cancelamento da retomada mantem o aplicativo bloqueado sem revelar
  dados da sessao anterior.

PIN/biometria nao sao obrigatorios no primeiro corte produtivo. Enquanto a
retomada local segura nao estiver implementada, o fallback obrigatorio e a
credencial completa.

### Uso Offline

- Nao existe login novo, troca de usuario ou troca de perfil offline.
- Uma sessao previamente revalidada pode consultar dados ja autorizados e
  armazenados no aparelho por ate 24 horas desde a ultima revalidacao.
- A consulta offline exige que a sessao ainda esteja dentro da validade
  absoluta e que a retomada local tenha sido satisfeita.
- Ate cada fluxo possuir politica propria de conflito e sincronizacao, o modo
  offline produtivo e somente leitura. Rascunho local nao equivale a registro
  enviado ou aceito pelo servidor.
- Rota direta, notificacao ou payload local nao ampliam o ultimo escopo
  autorizado.
- Ao terminar a janela offline, o aplicativo bloqueia o acesso aos dados ate
  conseguir revalidar a sessao.
- Ao recuperar a rede, a revalidacao ocorre antes de sincronizacao, upload,
  download ou envio de operacao pendente.
- Alterar o relogio do aparelho nao pode ampliar validade de token, janela
  offline ou inatividade. Tempos de servidor e relogio monotono devem ser
  usados quando aplicavel.

Esta regra fecha apenas a fronteira de sessao offline. A capacidade offline de
cada fluxo continua pendente em `pendencias-de-definicao.md`.

### Logout

O logout deve:

1. bloquear a interface imediatamente;
2. revogar a sessao/refresh token no servidor quando houver conectividade;
3. limpar access token, refresh token, usuario, perfil, escopo e metadados da
   sessao no aparelho;
4. limpar notificacoes, filtros, rotas e estado em memoria associados ao
   usuario;
5. impedir que outro usuario veja dados da sessao anterior;
6. manter caches operacionais somente quando estiverem segregados, cifrados e
   inacessiveis sem nova autorizacao.

Se o logout ocorrer sem rede, a limpeza local e o bloqueio devem concluir
imediatamente. A revogacao remota fica pendente para reconciliacao segura, sem
preservar token reutilizavel em storage comum. O backend deve limitar o risco
residual pelos tokens curtos, rotacao e validade absoluta.

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
| retorno antes de 15 minutos | continuar se os demais limites estiverem validos |
| retorno depois de 15 minutos | exigir retomada segura |
| offline dentro de 24 horas | permitir somente consulta autorizada e ja local |
| offline depois de 24 horas | bloquear dados ate revalidar |
| logout offline | limpar e bloquear localmente; reconciliar revogacao depois |
| rota direta ou notificacao | validar autorizacao no servidor antes de abrir o recurso |

## Criterios De Aceite Para A Implementacao Futura

1. Nenhum token ou senha fica em `AsyncStorage`, logs ou payload de UI.
2. Access token expira em 15 minutos e refresh token rotaciona a cada uso.
3. Refresh expirado, revogado ou reutilizado encerra a sessao.
4. Usuario inativo e sessao revogada perdem acesso na proxima comunicacao com
   o servidor.
5. Reconexao revalida antes de qualquer operacao remota.
6. Background/inatividade por 15 minutos bloqueia a interface.
7. Consulta offline funciona somente dentro da janela de 24 horas e do ultimo
   escopo autorizado.
8. Logout online e offline impedem restauracao do usuario anterior.
9. Login de outro usuario nao recebe filtros, notificacoes, rotas ou cache
   acessivel da sessao anterior.
10. Rota direta e notificacao nao contornam autorizacao por Propriedade.
11. Alteracao do relogio do aparelho nao estende a sessao.
12. Testes cobrem Admin, Colaborador e Produtor, reinicio, background,
    reconexao, revogacao, reducao de escopo, troca de usuario e logout offline.

## Dependencias E Bloqueios

Status em 2026-08-07: as decisões de organização, RBAC e cache por fluxo foram
fechadas em `baseline-backend-v1-2026-08.md`. Os itens abaixo são entregas de
`MP-33`, não decisões anteriores que mantenham a fase bloqueada.

O fechamento produtivo depende de:

- backend de autenticacao e autorizacao;
- emissao, rotacao e revogacao de tokens;
- storage seguro da plataforma;
- identificacao de organizacao/tenant e versao de autorizacao;
- politica de cache segregado e cifrado;
- deteccao de conectividade e ciclo de vida do aplicativo;
- testes negativos de API, rota direta e troca de usuario.

Essas dependencias pertencem a `MP-33 — Autenticacao e sessao reais`. Ate
essa tarefa ser concluida, `QA-P0-04` permanece resolvida apenas em nivel de
contrato, sem alegacao de seguranca produtiva.
