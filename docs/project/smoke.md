# Smoke Funcional Ativo

> Atualizado em: 2026-08-17
>
> Última execução física registrada: 2026-08-17

Este arquivo contém somente o roteiro ainda útil. Evidências detalhadas e
rodadas anteriores foram movidas para docs/archive.

## Matriz atual

| ID | Portão | Cenário | Estado |
|---|---|---|---|
| ATUAL-01 | Release | Perfil e logs sem painel Smoke Dev ou dado pessoal | PASSOU |
| ATUAL-02 | Mídia | Câmera, galeria, cancelamento, persistência e limites | PASSOU |
| ATUAL-03 | Exportação | Pasta, cancelamento e nome físico real | PASSOU |
| ATUAL-04 | Mapa e Caderno | Ponto salvo, reabertura centralizada e três estados do painel | PASSOU |
| ATUAL-05 | Acesso v2 | Três perfis, vínculos e rotas diretas | PASSOU |
| ATUAL-06 | MP-38 | Dentro, fora e próximo de Talhão em campo | PENDENTE DE CAMPO |
| ATUAL-07 | Release | Orientação, teclado, TalkBack e matriz Android | PENDENTE DE RELEASE |
| ATUAL-08 | Visitas | Conclusão e correção em telas dedicadas | PASSOU |
| ATUAL-09 | Desempenho | Listas virtualizadas e abas suspensas fora de foco | PASSOU |
| ATUAL-10 | Usuários | Exclusão administrativa remove usuário, credencial e vínculos | PASSOU |
| ATUAL-11 | Acesso v2 | Produtor autorizado abre Propriedade e somente Materiais liberados | PASSOU |
| ATUAL-12 | Usuários e acesso | Admin vincula, desvincula e revincula Produtor autorizado | PASSOU |
| ATUAL-13 | Rotas e formulários | Contexto de Propriedade, rascunho, edição auditada, data/hora e teclado | PASSOU |

Em 2026-08-17, uma nova evidência física confirmou que o ponto do Caderno era
persistido com latitude, longitude, precisão e horário corretos, mas a primeira
centralização podia se perder enquanto a WebView do mapa terminava de iniciar.
O comando agora é repetido depois da estabilização do mapa, com cancelamento do
temporizador ao remontar a camada. O APK corrigido foi instalado preservando
sessão e dados, e o caminho `Caderno > registro com ponto > Ver no mapa` passou
na repetição manual no Android.

Na mesma verificação, o ponto persistido reapareceu sem rede e partes já
visitadas do mapa-base continuaram visíveis em alguns níveis de zoom. Isso é
somente evidência parcial: o Caderno do mock usa armazenamento local, enquanto
o mapa-base depende de cache oportunista da WebView e não constitui pacote
offline completo. A repetição offline integral continua pendente.

Na verificação física de 2026-08-17, a fonte ampliada não apresentou corte ou
inacessibilidade bloqueante nos fluxos percorridos. Variações específicas de
aparelho, conteúdo real e escalas extremas permanecem como risco residual para
feedback de uso. Texto secundário encurtado pode ser refinado depois; botão,
campo, estado ou dado essencial inacessível continua sendo falha de release.
Na mesma rodada, o percurso orientado com TalkBack passou no dispositivo
conectado; a ampliação para outros modelos continua pertencendo à matriz de
release.

## Rodada final do mock v2

Status: EXECUTADA PARCIALMENTE, SEM BUG ABERTO.

| Grupo | Resultado |
|---|---|
| Atualização sem limpar armazenamento | Passou |
| Usuários ativos, pendentes e inativos | Passou |
| Propriedade sem Talhões, inativa e vínculo inativo | Passou |
| Estados de Visita e comandos terminais | Passou |
| Tipos, estados e visibilidade do Caderno | Passou após correção |
| Períodos, Plantio e Colheita | Passou |
| PNG, PDF ou ZIP ausente e Material restrito | Passou após correção |
| Talhão lógico sem geometria | Passou após correção |
| Regressão principal ATUAL-01 a ATUAL-05 | Passou; mídia e exportação integrais não foram repetidas |
| Retrato, paisagem, teclado, reinício, TalkBack e offline | Parcial; TalkBack e offline continuam pendentes |

## Cenários que devem ser repetidos antes do release

1. atualizar o APK sem desinstalar e confirmar preservação do snapshot;
2. testar login e bloqueio dos três perfis e estados de usuário;
3. repetir câmera, galeria, limites, persistência e exportação;
4. abrir Propriedade, Visita, Caderno e Material por lista e rota direta;
5. testar recurso autorizado, fora de escopo, inativo e ausente;
6. testar estado vazio de Propriedade e Talhão sem geometria;
7. reiniciar sem rede e observar quais dados abrem e quais dependências são
   informadas;
8. testar retrato, paisagem, teclado aberto, fonte ampliada e TalkBack;
9. inspecionar logs para fatal, ANR, token, sessão ou dado pessoal;
10. registrar cada falha como BUG, LIMITAÇÃO DO MOCK ou EVIDÊNCIA PENDENTE.

Na revalidação de Visitas, concluir uma agendada pela tela completa, voltar ao
detalhe e conferir os dados; depois corrigir mais de um campo de uma realizada
com um único motivo e confirmar o antes/depois no histórico. Complementar,
cancelar e anular devem continuar como ações curtas.

Na revalidação de desempenho, percorrer do início ao fim Propriedades, Visitas
e Caderno; usar busca, filtros e atualização por gesto; abrir um item no meio
da lista e voltar; alternar entre as três abas e confirmar que filtros e
posição permanecem. Observar cartões em branco, saltos de rolagem, duplicidade
e demora perceptível na troca de abas.

Na execução física de 2026-08-12, esse roteiro passou. Após o percurso completo,
o processo manteve 1.629 views contra 4.386 na medição anterior à otimização.
Não houve fatal, ANR, falta de memória nem bloqueio longo novo da thread
JavaScript. A passagem pelo mapa manteve uma WebView e elevou temporariamente o
PSS a cerca de 408 MB; após reinício controlado, sem limpar sessão ou dados, o
app restaurou o Dashboard com 171 views, nenhuma WebView e cerca de 178 MB.

Na revalidação da exclusão administrativa, usar um Usuário temporário diferente
da sessão atual; cancelar a primeira confirmação e conferir que nada mudou;
confirmar na segunda tentativa; verificar a remoção da lista e a recusa do login
com a credencial anterior. Propriedades e registros operacionais devem
permanecer. No próprio Usuário administrador conectado, a exclusão deve estar
bloqueada.

Na execução física de 2026-08-12, o cenário passou: a confirmação pôde ser
cancelada sem alteração; a exclusão removeu o Usuário temporário, sua credencial
local e o vínculo direto; o login anterior foi recusado e as Propriedades foram
preservadas.

Na revalidação do Produtor autorizado, entrar como Altair, abrir `[QA]
Propriedade Cenários Operacionais` e confirmar Talhão, Safra/Safrinha, Caderno
visível e Materiais publicados. O ZIP restrito à equipe e o material em
rascunho não podem aparecer. O PDF indisponível pode aparecer, mas deve informar
honestamente que o arquivo não está disponível. A Fazenda_Backes deve continuar
acessível e nenhuma ação estrutural deve ser exibida.

Na revalidação administrativa dos vínculos, entrar como Admin, editar `[QA]
Propriedade Cenários Operacionais` e abrir `Produtores autorizados`. Confirmar
que o Titular não aparece, buscar Altair por nome ou e-mail, desmarcá-lo e
salvar. No detalhe administrativo do Altair e no detalhe da Propriedade QA, ele
não deve mais ser contado ou apresentado como vinculado. Na sessão do Altair,
a Propriedade QA deve desaparecer também de `Perfil > Minhas Propriedades`, e
Fazenda_Backes deve permanecer. Reiniciar o app sem limpar os dados e repetir a
consulta com a sessão restaurada. Voltar como Admin, marcar Altair novamente e
salvar; uma nova sessão do Altair deve recuperar a Propriedade QA sem criar
vínculo duplicado.

Na execução física de 2026-08-12, o cenário passou após a correção das
projeções de vínculo atual: o vínculo inativo deixou de aparecer no Perfil do
Altair e nas telas administrativas, a Propriedade própria permaneceu acessível
e a reativação recuperou a Propriedade autorizada sem duplicidade.

Na revalidação `ATUAL-13`, executar na ordem:

1. como Colaborador, abrir uma Propriedade e tocar em `Nova Visita`; confirmar
   que a mesma Propriedade já vem selecionada, bloqueada e que o registro volta
   para o contexto correto. Pela aba global de Visitas, confirmar que a seleção
   continua livre somente entre Propriedades autorizadas;
2. dentro da mesma Propriedade, abrir `Novo Caderno` e `Nova Safra/Safrinha` e
   confirmar o mesmo contexto canônico bloqueado. Repetir um acesso por Mapa ao
   novo Caderno para cobrir a leitura compatível da rota;
3. salvar um Caderno como rascunho, voltar ao detalhe da Propriedade e confirmar
   que ele reaparece apenas para o autor. No detalhe do rascunho, continuar a
   edição, salvar novamente e depois testar o descarte com cancelamento e com
   confirmação em um segundo rascunho;
4. enviar um registro, abrir `Ações auditáveis > Editar dados`, trocar o tipo e
   preencher os campos dependentes apresentados (Safra/Safrinha, Talhão ou
   dados operacionais), além de alterar outro campo com um único motivo.
   Confirmar antes/depois no histórico; o registro original deve permanecer
   preservado e não pode oferecer exclusão nem sobrescrita direta;
5. em Nova/Editar Visita e Caderno, abrir data, trocar por meses com quatro,
   cinco e seis semanas visuais, tocar no ano e confirmar a faixa uniforme de
   2000 a 2100. A altura do modal deve permanecer estável, sem espaços vazios;
   dias adjacentes aparecem em tom secundário e a regra mínimo/máximo continua
   protegida na escolha do dia. Abrir horário e confirmar que a hora e o minuto
   atuais/selecionados aparecem visíveis sem rolagem inicial;
6. focar os últimos campos de texto de Visita, Caderno, Propriedade, Usuário e
   Safra/Safrinha. Com o teclado aberto, o campo e o texto digitado devem ficar
   visíveis; arrastar a tela deve dispensar o teclado sem bloquear botões.

Na execução física de 2026-08-17, o cenário passou após os ajustes finais do
calendário e da edição auditada do Caderno. A faixa de 2000 a 2100, a grade
mensal estável, os campos dependentes do tipo, a remoção da ação de complemento
e os demais itens de `ATUAL-13` foram confirmados no Android sem limpar os
dados.

## Cenários de campo de MP-38

- posição dentro de Talhão;
- posição fora de Talhão;
- posição próxima do limite;
- precisão boa e ruim;
- permissão negada;
- localização desligada;
- timeout e cancelamento;
- operação sem rede;
- confirmação de que não existe rastreamento em background.

## Regras de resultado

- PASSOU exige execução observável e resultado esperado.
- NÃO EXECUTADO nunca pode ser marcado como passou por inferência.
- LIMITAÇÃO DO MOCK descreve uma fronteira conhecida, não um bug corrigido.
- BUG exige reprodução, menor correção responsável e repetição do cenário.
- Mudança de backend exige testes de API e banco; este smoke local não comprova
  segurança produtiva.

## Baseline automatizada

Antes e depois de mudança de código:

- npm run typecheck
- npm run test:domain-compat

Acrescente testes focados da vertical. Para mudança somente documental, valide
links locais e execute git diff --check.
