# Revisão completa de QA Android — 23 a 30 de julho de 2026

## 1. Objetivo e posição deste documento

Esta revisão registra a validação manual completa do aplicativo Android nos
perfis Admin, Colaborador e Produtor, cobrindo navegação, responsividade,
persistência local, filtros, formulários, permissões visuais, mapas, materiais
técnicos, visitas, Caderno de Campo, notificações e perfil.

O teste foi acompanhado por inspeção de tela, árvore de interface, logs do
Android e leitura direcionada do código. A operação do aparelho foi feita pelo
usuário, enquanto a coleta e a análise das evidências foram feitas pelo
assistente.

Este arquivo pertence a `docs/reviews/` e, portanto, é evidência de revisão.
Ele não substitui as regras e decisões ativas de `docs/project/`. Decisões
propostas ou acordadas nesta sessão devem ser promovidas aos documentos ativos
antes da implementação.

## 2. Ambiente, método e limites

### Ambiente

- aplicativo Android em build release;
- aparelho físico TCL, Android 15;
- resolução observada de 800 × 1280, densidade de 240 dpi;
- escala de fonte do sistema em 1,0;
- dados locais, fixtures e mocks do MVP;
- teste em retrato e paisagem nos pontos de maior risco;
- persistência verificada com fechamento forçado e reabertura do processo.

### Método

Para cada fluxo foram observados, quando aplicáveis:

1. entrada e retorno da tela;
2. integridade visual e rolagem;
3. comportamento do teclado;
4. botões, filtros e estados vazios;
5. mudança de orientação;
6. escopo por perfil e Propriedade;
7. persistência após reabertura;
8. mensagens de validação e erro;
9. coerência dos dados e da linguagem;
10. indícios técnicos em código e logs.

### Limites da aprovação

Esta rodada não representa aprovação integral para produção. Permaneceram fora
do alcance:

- autenticação, autorização e expiração reais em backend;
- isolamento real de tenant e de dados no servidor;
- sincronização e conflitos offline;
- upload, download e processamento remoto reais;
- ensaio de GPS dentro de uma Propriedade e de um Talhão mapeados;
- histórico real de GeoJSON de anos diferentes;
- acessibilidade com leitor de tela e escalas de fonte maiores;
- matriz ampla de aparelhos, resoluções e versões do Android;
- desempenho com volume produtivo de dados.

O ponto de localização distante da Sela de Prata I foi produzido
intencionalmente em teste remoto. Ele não deve ser classificado como defeito do
GPS ou corrupção de dados.

## 3. Legendas usadas

### Tipo do registro

- **Defeito confirmado:** comportamento incorreto reproduzido.
- **Melhoria de UX/UI:** fluxo funciona, mas causa ruído, ambiguidade ou
  desperdício de tela.
- **Decisão de produto:** regra discutida e aceita conceitualmente nesta
  sessão, ainda dependente de promoção à documentação ativa.
- **Limitação esperada do mock:** comportamento incompleto coerente com a
  implementação local atual, mas que não pode chegar à produção.
- **Validação pendente:** depende de ambiente, dados ou condição física ainda
  não disponíveis.

### Prioridade

- **P0 — bloqueia produção:** risco de isolamento, autorização, integridade ou
  rastreabilidade de dados.
- **P1 — alta:** quebra funcional importante ou fluxo central incorreto.
- **P2 — média:** responsividade, usabilidade, consistência e acessibilidade.
- **P3 — baixa:** dívida técnica, texto ou refinamento sem bloqueio imediato.

Os itens P0 descrevem riscos caso o comportamento mockado seja levado para uma
versão real. Eles não significam que houve incidente com dados produtivos
nesta rodada local.

## 4. Resumo executivo

Os fluxos principais foram percorridos sem crash. Listas, detalhes, retornos,
rolagem, buscas, estados vazios e a maior parte dos formulários permaneceram
funcionais. O escopo visual de Propriedades funcionou nos testes principais:
o Produtor viu apenas a Sela de Prata I e o Colaborador mudou corretamente
entre MT-Norte, Sorriso e Lucas do Rio Verde.

Ainda não é recomendável tratar o aplicativo como pronto para produção. Os
quatro grupos de maior risco são:

1. notificações globais e sem vínculo de destinatário, inclusive mostrando ao
   Produtor informação de outra Propriedade;
2. Colaborador podendo alterar livremente a própria Região no perfil;
3. Caderno de Campo já registrado podendo ser reescrito sem trilha de
   auditoria;
4. abertura de um material técnico específico levando ao mapa geral de
   Talhões, sem carregar o material selecionado.

Também precisam de correção antes de uma nova rodada completa: login em
paisagem/teclado, organização e interação do mapa, transições de estado das
Visitas, fonte única para contagem de materiais, padronização de filtros,
contraste e navegação de retorno.

## 5. O que foi validado com resultado positivo

### Autenticação e sessão local

- credencial inválida apresentou `E-mail ou senha inválidos` sem quebrar a
  tela;
- logout removeu a sessão e a reabertura permaneceu no Login;
- sessão do Produtor persistiu após fechamento forçado e reabertura;
- o perfil restaurado continuou sendo o Produtor, sem herdar o Colaborador
  usado anteriormente;
- o escopo restaurado continuou limitado à Sela de Prata I.

### Admin

- Dashboard abriu e respondeu aos filtros regionais;
- busca, ordenação e limpeza da lista de Propriedades funcionaram;
- detalhe da Propriedade, Talhões, Visitas e Caderno abriram e retornaram sem
  botões presos;
- formulários de nova Propriedade e novo Usuário bloquearam submissão vazia;
- listagem e detalhe de Usuários funcionaram;
- busca e filtros de Visitas funcionaram;
- detalhe e edição de Visita abriram sem sobreposição;
- busca do Caderno preservou a tela e mostrou estado vazio corretamente;
- modal de saída apresentou fundo, ações e contraste adequados.

### Colaborador

- Dashboard ficou preso a Mato Grosso, como esperado;
- o filtro territorial mostrou MT-Norte, Sorriso e Lucas do Rio Verde;
- Sorriso exibiu apenas a Propriedade esperada;
- a mudança para MT-Norte exibiu a Sela de Prata I;
- formulários e detalhes de Propriedade, Safra/Safrinha, Visita e Caderno
  abriram sem crash;
- cancelamentos retornaram ao contexto anterior correto;
- criação e edição visual de Visita permaneceram funcionais;
- captura opcional de localização do Caderno exibiu latitude, longitude,
  precisão, data da captura e responsável;
- logout retornou ao Login e persistiu após reinício.

### Produtor

- visualizou somente a Propriedade vinculada;
- não recebeu ações administrativas de criar, editar ou excluir Propriedade;
- materiais ocultaram ações de anexar, substituir ou excluir;
- Visitas ficaram em consulta, sem editar, cancelar ou concluir;
- detalhe do Caderno não apresentou ação de edição;
- formulário `Registrar no Caderno` manteve a Propriedade travada e a
  visibilidade efetiva para o próprio Produtor;
- Perfil permaneceu somente leitura;
- tela e rolagem mantiveram espaço inferior suficiente para o conteúdo final.

### Comportamentos gerais

- a maioria das buscas fechou o teclado ao limpar;
- os estados sem resultado não quebraram layout;
- retornos pelo Android preservaram, em geral, a aba e o contexto;
- não foram encontrados crashes durante a rodada;
- vários formulários mantiveram conteúdo legível com teclado;
- o bottom sheet de filtros de Coleta de Solo foi considerado uma boa base
  visual para padronização.

## 6. Achados prioritários

### QA-P0-01 — Notificações não possuem destinatário nem escopo

**Tipo:** defeito confirmado e limitação do mock  
**Prioridade:** P0 antes da produção

Admin, Colaborador e Produtor receberam a mesma lista geral. O Produtor
vinculado à Sela de Prata I recebeu a notificação `Visita Agendada` da
Propriedade Santa Maria. Isso comprova que a tela atual não isola informação
por usuário, perfil ou Propriedade.

A estrutura local de notificação não contém destinatário, organização,
`fazenda_id`/`propriedade_id`, Talhão, recurso, papel ou rota autorizada.
Ao tocar, o item apenas muda para lido; o registro relacionado não é aberto.
Leitura e remoção também não persistem. Após reiniciar ou trocar de perfil, a
lista mock e o contador são recriados.

**Critérios de aceite:**

- consultar notificações no servidor por destinatário e escopo autorizado;
- armazenar pelo menos: `id`, destinatário, organização, Propriedade, Talhão
  opcional, tipo do evento, recurso e id do recurso, prioridade, criação,
  leitura, descarte e chave de deduplicação;
- limpar e recarregar o estado ao trocar de usuário;
- persistir leitura e descarte;
- abrir o recurso correto por rota segura;
- revalidar a autorização ao abrir a rota, sem confiar apenas no payload;
- impedir que qualquer perfil receba referência a Propriedade fora do seu
  escopo.

### QA-P0-02 — Colaborador pode alterar livremente o próprio território

**Tipo:** defeito confirmado  
**Prioridade:** P0 antes da produção

No Perfil do Colaborador, a Região pode ser editada como texto livre e a
mudança é persistida na sessão local. Mesmo que parte do acesso atual também
dependa de `sub_regioes`, permitir que a identidade territorial seja alterada
pelo próprio usuário corrompe filtros, contexto operacional e futuras regras
de autorização.

Região, Área/Sub-regional e vínculos diretos com Propriedades devem ser
atribuições administrativas, com identificadores estáveis e controle no
backend.

**Critérios de aceite:**

- remover edição livre de Região e Micro/Área operacional pelo Colaborador;
- permitir apenas consulta desses vínculos no Perfil;
- oferecer solicitação de correção, se necessária;
- restringir alteração a usuário administrativo autorizado;
- registrar autor, data, valor anterior, valor novo e justificativa;
- recalcular e revalidar o escopo no servidor após mudança administrativa.

### QA-P0-03 — Caderno registrado pode ser reescrito sem auditoria

**Tipo:** defeito confirmado e decisão de produto  
**Prioridade:** P0 antes da produção

Um Colaborador com acesso à Propriedade consegue editar um registro originado
pelo Produtor, inclusive data, tipo, responsável, Talhão, área, produtos,
dose, clima, observações, localização e visibilidade. O código preserva a
origem `produtor`, mas não mantém histórico das alterações. Assim, o conteúdo
pode ser substituído e ainda continuar identificado como `Registrado pelo
produtor`.

**Regra acordada nesta sessão:**

- rascunho pode ser editado pelo criador;
- depois de registrado/enviado, corpo, data, responsável, Talhão e localização
  original devem ser imutáveis;
- equipe técnica pode adicionar complemento, sem sobrescrever o relato
  original;
- correção excepcional exige justificativa e histórico antes/depois;
- localização corrigida cria nova versão e preserva a original;
- arquivamento ou anulação preserva o registro e exige justificativa;
- mudança de visibilidade também é auditada.

**Critérios de aceite:**

- implementar estados explícitos, pelo menos rascunho e registrado;
- bloquear atualização destrutiva do registro consolidado;
- criar eventos de complemento, correção, visibilidade, arquivamento e
  anulação;
- preservar autoria e conteúdo original;
- exibir trilha de auditoria para Admin/Colaborador autorizado;
- manter ao Produtor somente os dados operacionais necessários;
- testar concorrência, sincronização e tentativa de alteração por rota direta.

### QA-P0-04 — Sessão local não possui expiração nem revalidação

**Tipo:** limitação confirmada do mock  
**Prioridade:** P0 antes da produção

A persistência local funcionou, mas atualmente restaura o usuário armazenado
sem timestamp de expiração, refresh token, revogação ou revalidação. Para o
MVP local isso explica o comportamento observado; para uso real, uma sessão
indefinida em aparelho de campo é risco de acesso indevido.

**Critérios de aceite:**

- usar token de acesso curto e refresh token protegido;
- revalidar perfil, status e escopo periodicamente e após reconexão;
- invalidar sessão revogada ou usuário inativo;
- definir política de inatividade e período de uso offline;
- limpar dados sensíveis no logout;
- avaliar PIN ou biometria para retomada no aparelho.

### QA-P1-01 — Material específico abre o mapa geral de Talhões

**Tipo:** defeito confirmado  
**Prioridade:** P1

Ao tocar em materiais de pH, argila ou outros mapas técnicos, o aplicativo
abre diretamente o mapa geral de Talhões. A tela não recebe o identificador ou
a versão do material selecionado e não apresenta camada temática, legenda,
valores, profundidade ou metadados daquele material.

O comportamento correto depende do tipo:

- material georreferenciado: mapa com a camada, legenda e metadados;
- imagem: visualizador de imagem, com ampliação;
- PDF: visualizador de documento;
- ZIP ou arquivo sem preview: detalhes e ação autorizada de download.

**Critérios de aceite:**

- a rota transportar `material_id` e versão;
- resolver o visualizador a partir do tipo real;
- mostrar título, categoria, ano/Safra, profundidade/camada e origem;
- manter o contexto de Propriedade/Talhão;
- impedir que a ausência de preview seja apresentada como mapa visualizado;
- voltar para a lista na mesma posição e com os mesmos filtros.

### QA-P1-02 — Interações e responsividade do mapa de Talhões

**Tipo:** defeito confirmado e melhoria de UX  
**Prioridade:** P1

No retrato foram observados:

- rótulos de Talhões sobrepostos;
- legenda lateral estática mostrando poucos itens e `+11` sem ação;
- controles, localização e conteúdo competindo pelo mesmo espaço;
- painel inferior grande, com área vazia;
- alça cinza sem gesto, criando uma ação fantasma;
- botão de expandir apenas recentralizando o mapa;
- seleção de Talhão podendo voltar para `Mostrar minha posição`;
- expansão de `Área mapeada` ocupando espaço sem acrescentar informação útil.

No paisagem o layout ficou severamente desorganizado: elementos sobrepostos,
lista e painel cortados, detalhe cobrindo a maior parte do mapa e grandes áreas
sem uso.

A inspeção técnica indica que a seleção pode reconstruir o HTML da WebView e
que a atualização da posição executa centralização novamente.

**Direção aprovada para redesign:**

- celular em retrato: mapa interativo e bottom sheet não modal, com snap
  points reais;
- paisagem/tablet: mapa com aproximadamente 65–70% da largura e painel lateral
  com 30–35%;
- Talhões em `Lista | Mapa`, iniciando em Lista no celular;
- preservar a última visualização quando isso não causar ambiguidade;
- manter o mapa manipulável enquanto o detalhe está aberto.

**Critérios de aceite:**

- nenhuma sobreposição em retrato e paisagem;
- alça mover o painel ou ser removida;
- `Expandir mapa` entrar em modo de mapa ampliado real;
- selecionar Talhão não recentralizar na posição do usuário;
- ação de localização só centralizar quando solicitada;
- lista completa pesquisável/rolável;
- detalhe não modal e mapa ainda manipulável;
- orientação recalcular dimensões sem remontagem incorreta.

### QA-P1-03 — Login quebra com teclado e mudança de orientação

**Tipo:** defeito confirmado  
**Prioridade:** P1

No Login, o teclado e uma área branca cobriram parte da marca e do conteúdo.
Ao fechar e reabrir o teclado, os campos de e-mail e senha puderam ficar
encobertos. Em paisagem, rotações sucessivas cortaram conteúdo superior e
inferior; o Acesso rápido para demonstração ficou abaixo da dobra e só pôde
ser alcançado com rolagem.

**Critérios de aceite:**

- campo focado permanecer visível acima do teclado;
- tela permitir rolagem estável sem encobrir marca, erro ou botão;
- retrato → paisagem → retrato não preservar medidas inválidas;
- Acesso rápido continuar alcançável em alturas reduzidas;
- testar teclado aberto/fechado em e-mail e senha;
- validar ao menos aparelho compacto, atual e tablet.

### QA-P1-04 — Visitas permitem transições incoerentes

**Tipo:** defeito confirmado e decisão de produto  
**Prioridade:** P1

Uma Visita realizada pôde ser aberta para edição com possibilidade visual de
voltar a Agendada ou mudar para Cancelada, sem histórico. A Visita agendada de
12 de junho ainda aparecia apenas como Agendada em 30 de julho. `Marcar como
realizada` é uma ação imediata, sem confirmação ou formulário mínimo de
conclusão. O cancelamento não solicita motivo nem mostra o contexto completo.

**Regra recomendada:**

- Agendada → Realizada ou Cancelada;
- Realizada não volta de estado; recebe correção auditada, complemento ou
  anulação;
- Cancelada fica somente leitura e pode originar nova Visita vinculada;
- Visita vencida sem conclusão aparece como `Agendada · Atrasada`, sem ser
  automaticamente marcada como realizada.

**Critérios de aceite:**

- validar transição no domínio e no backend, não apenas na interface;
- exigir confirmação/conclusão ao marcar como realizada;
- exigir motivo ao cancelar;
- preservar histórico de estado, autor e data;
- identificar Visitas atrasadas;
- impedir alteração por rota direta ou payload manipulado.

### QA-P1-05 — Contagem de materiais possui duas fontes

**Tipo:** defeito confirmado  
**Prioridade:** P1

O resumo do Produtor mostrou cinco materiais, enquanto a lista completa
mostrou oito. O resumo considera somente a lista base, mas a tela de Materiais
une essa lista a imports locais PNG, ZIP e materiais técnicos.

**Critérios de aceite:**

- criar uma consulta única de materiais publicados e visíveis;
- resumo e listagem usarem a mesma fonte e os mesmos filtros;
- contabilizar por Propriedade, perfil, status e disponibilidade;
- evitar duplicação entre fixture base e import local compatível;
- testar persistência após reinício e remoção de um import.

### QA-P1-06 — GeoJSON de Talhões não possui histórico coerente

**Tipo:** decisão de produto e risco técnico confirmado  
**Prioridade:** P1 estrutural

O modelo atual mantém um GeoJSON ativo por Propriedade. Uma nova importação
marca o metadado anterior como substituído e tenta remover o arquivo físico.
Versões antigas não são navegáveis. Identificadores derivados de índice ou
nome de feature também são instáveis quando há renome, reordenação, divisão ou
união de Talhões.

Foi acordada a seguinte direção:

- `talhao_id` lógico e estável;
- importações imutáveis e versionadas;
- versão da geometria separada da identidade do Talhão;
- fluxo rascunho → revisão → publicação → arquivamento;
- reconciliação mostrando adicionados, removidos, renomeados e alterados;
- renome mantém identidade;
- divisão e união preservam linhagem;
- Caderno, Visitas, Safra/Safrinha e Materiais referenciam `talhao_id`;
- quando necessário, o registro também preserva a versão geométrica usada.

O detalhamento está em
`../../dist/qa-session-2026-07-23/notas-modelo-geojson-talhoes.md`.

**Critérios de aceite:**

- nunca destruir automaticamente a versão publicada anterior;
- permitir consultar a geometria vigente na data do registro;
- detectar alteração de área e nome sem criar identidade arbitrária;
- exigir revisão antes da publicação;
- preservar linhagem em split/merge;
- executar migração compatível com registros legados de Talhão em texto.

### QA-P1-07 — Responsável e Talhão são textos livres em fluxos operacionais

**Tipo:** risco funcional confirmado  
**Prioridade:** P1

No Caderno, o responsável é preenchido com o usuário atual, mas continua
editável como texto. Talhão também é texto livre. A Safra/Safrinha repete o
problema do Talhão. Isso impede vínculo confiável com o GeoJSON e favorece
nomes divergentes para a mesma entidade.

**Critérios de aceite:**

- responsável referenciar `usuario_id` e aparecer bloqueado;
- separar `registrado por` de `executado por`, quando necessário;
- selecionar Talhão por id estável da Propriedade;
- oferecer `Toda a Propriedade` para registros gerais;
- preservar o nome exibido como snapshot, sem usá-lo como chave;
- manter compatibilidade explícita com registros antigos em texto.

### QA-P1-08 — Novo Caderno aceita Observação praticamente vazia

**Tipo:** defeito de validação  
**Prioridade:** P1

Data, tipo `Observação`, responsável e Propriedade já vêm preenchidos. Como
texto, Talhão e localização são opcionais, é possível salvar um registro
operacional quase sem conteúdo.

**Critérios de aceite por tipo:**

- Observação/Ocorrência: descrição obrigatória;
- Plantio: Talhão, período e operação;
- Aplicação: Talhão, produto, dose e área;
- Colheita: Talhão, período, área e produtividade;
- Outro: descrição obrigatória;
- exibir somente campos relevantes ao tipo escolhido;
- revisar e confirmar o envio do Produtor antes de tornar o registro imutável.

### QA-P1-09 — Fechar filtros pelo X aplica mudanças

**Tipo:** defeito confirmado  
**Prioridade:** P1

Nos filtros de Propriedades e Visitas/Coleta de Solo, alterações foram
aplicadas ao fechar pelo X, sem tocar em `Aplicar`. Isso contradiz a presença
dos botões Aplicar e Limpar e impede cancelar uma tentativa de filtro.

**Critérios de aceite:**

- X e gesto de fechar descartarem o rascunho;
- `Aplicar` confirmar e persistir a seleção;
- `Limpar` remover o rascunho de filtros;
- se o produto optar por aplicação imediata, remover o botão Aplicar e deixar
  essa regra consistente em todas as telas;
- manter chips ativos organizados na barra da lista.

## 7. Achados de UX, responsividade e consistência

### QA-P2-01 — Arquitetura de informação da Propriedade

**Tipo:** melhoria de UX e decisão de produto

A aba Talhões reúne Talhões, Safras/Safrinha e Materiais. Visitas e Caderno
ficam em abas separadas, enquanto `Atalhos da Propriedade` repete essas
entradas. Isso causa dúvida sobre onde cada informação deve ser encontrada.

**Navegação compacta recomendada e aceita:**

`Resumo | Talhões | Safras e Safrinha | Materiais | Visitas | Caderno`

Manter exatamente `Safras e Safrinha`, por ser a linguagem usada no campo.
Remover os atalhos duplicados e deixar apenas um botão de criação de
Safra/Safrinha.

### QA-P2-02 — Tela de Talhões começa pelo mapa e não pela lista

**Tipo:** melhoria de UX

A entrada direta no mapa não oferece primeiro uma visão organizada dos
Talhões. Recomenda-se uma tela `Talhões` com seletor `Lista | Mapa`, iniciando
em Lista no celular. Em paisagem/tablet, pode haver lista e mapa combinados.

O texto `Abra um Talhão` também é ambíguo quando a tela não mostra os Talhões
individualmente, apenas quantidade e `Abrir detalhes`.

### QA-P2-03 — Filtros de Materiais ocupam grande parte da tela

**Tipo:** melhoria de UX

Busca, Demarcação, Talhão, Ano e Safra/Safrinha aparecem simultaneamente. Os
chips de Talhão foram cortados horizontalmente. `LT 2025` veio selecionado e
`Limpar filtros` apareceu desde a entrada, embora o usuário não tivesse
escolhido um filtro.

Recomenda-se:

- estado inicial neutro, salvo quando houver contexto explícito;
- busca e resumo dos filtros ativos na barra principal;
- demais opções no bottom sheet padrão;
- chips em uma área rolável ou resumida;
- título plural `Materiais técnicos`.

### QA-P2-04 — Padronização de filtros

**Tipo:** melhoria de UX

O modal observado em Coleta de Solo foi considerado a melhor base: fundo
escurecido adequado, controles legíveis e boa separação das opções. Ele deve
virar um componente padrão para Propriedades, Usuários, Visitas, Caderno e
Materiais, variando somente o conteúdo.

Na lista de Produtores, o primeiro toque em uma opção após usar a busca apenas
fechou o teclado; foi necessário tocar novamente para aplicar. O gesto deve
fechar o teclado e executar a ação no mesmo toque.

### QA-P2-05 — Retorno inconsistente

**Tipo:** melhoria de navegação

Várias telas não oferecem seta superior de voltar e dependem do gesto/botão do
Android. Em outros pontos, o cabeçalho exibe a marca onde o retorno seria
esperado.

Todas as telas internas devem ter retorno previsível, preservar o contexto,
a aba, a busca e os filtros, e respeitar também o botão do sistema.

### QA-P2-06 — Indicadores e cartões em paisagem

**Tipo:** defeito de responsividade

No Dashboard/Propriedades do Colaborador, os indicadores de Propriedades,
Titulares, Área total, Ativas e Pendentes ficaram comprimidos ou fora do
espaço adequado. O botão flutuante de nova Propriedade também competiu com o
conteúdo.

No Dashboard do Produtor, a tela não quebrou em paisagem, porém conservou
alturas de retrato, cartão de Propriedade muito largo, indicadores em duas
colunas e rolagem vertical excessiva.

Recomenda-se:

- grade responsiva, sem largura fixa;
- no Produtor em paisagem, resumo da Propriedade à esquerda e indicadores à
  direita;
- cartões 2 × 2 em retrato quando quatro métricas forem exibidas;
- margem segura para FAB e navegação inferior.

### QA-P2-07 — Resumo da Propriedade repete conteúdo

**Tipo:** melhoria de UX

Há repetição entre cabeçalho, título do cartão, contexto, panorama e Atalhos da
Propriedade. No Produtor, `1 Propriedade` e `1 Ativa` também informam quase a
mesma coisa.

Indicadores mais úteis ao Produtor seriam próxima Visita, última atividade,
mapas atualizados e pendências visíveis. A linha de localização deve evitar
repetir cidade/UF, Mato Grosso e MT-Norte no mesmo nível.

### QA-P2-08 — Terminologia territorial

**Tipo:** decisão de produto

`Microrregião` mistura atualmente uma área operacional (`MT-Norte`) com
municípios (`Sorriso` e `Lucas do Rio Verde`).

Modelo recomendado:

- UF e Município como localização oficial, usando códigos estáveis do IBGE;
- Regional como agrupamento operacional;
- Área/Sub-regional como subdivisão operacional opcional;
- Propriedades fora da área urbana continuam vinculadas ao Município oficial
  do território;
- listas controladas, sem texto livre para vínculos mestres.

### QA-P2-09 — Contraste e opacidade

**Tipo:** acessibilidade e consistência visual

Textos como `Registrado pelo produtor` e `Ver mais 2 materiais` usam tons
próximos sobre superfícies verdes. O mesmo padrão reaparece em outros objetos
e reduz legibilidade.

Recomenda-se usar pares semânticos de superfície/texto e nunca aplicar
opacidade ao controle inteiro. Meta mínima:

- texto normal: contraste 4,5:1;
- texto grande, ícones e componentes essenciais: 3:1;
- estados desabilitados distinguíveis sem parecerem conteúdo ativo.

### QA-P2-10 — Caderno e Visitas precisam de um mesmo sistema de cartões

**Tipo:** melhoria de UX

Os cartões de Visitas foram considerados mais claros do que os do Caderno,
mas as duas listas não devem ser visualmente idênticas sem respeitar o
conteúdo.

Casca operacional comum:

- tipo e status;
- data/hora;
- Talhão e responsável;
- resumo em até duas linhas;
- chips de localização e visibilidade quando relevantes;
- chevron de detalhe.

No Caderno global do Produtor, remover o chip administrativo `Liberado ao
produtor`; ele já está vendo o próprio conteúdo.

### QA-P2-11 — Lista e detalhe de Visitas

**Tipo:** melhoria de UX

- cartões exibem enums crus como `consultoria` e `avaliacao_cultivo`;
- barra vertical com `#` ocupa espaço e expõe id sem utilidade;
- status não aparece com destaque suficiente;
- `Histórico` inclui Visitas ainda agendadas;
- ordenação observada colocou 28 de maio antes de 12 de junho.

Separar `Próximas/Pendentes` de `Histórico`, humanizar enums e ordenar por
regra explícita: próxima visita primeiro e histórico mais recente primeiro.

### QA-P2-12 — Perfil do Produtor cria falsa affordance

**Tipo:** melhoria de UX

`Minhas Propriedades` apresenta a Propriedade como se fosse tocável, mas o
componente não possui ação. Deve:

- abrir o detalhe e mostrar chevron; ou
- deixar de parecer botão e usar o rótulo `Propriedade vinculada`.

O texto `cadastro local` deve ser retirado da experiência final. Pode existir
uma ação `Solicitar atualização cadastral`, sem edição direta.

### QA-P2-13 — Fotos e materiais sem ações esperadas

**Tipo:** melhoria funcional

Foto de registro/Visita não tem ampliação nem download. Materiais usam ações
genéricas mesmo quando os formatos têm comportamentos diferentes.

Usar:

- `Ampliar` e download autorizado para imagem;
- `Visualizar mapa` para camada georreferenciada;
- `Abrir documento` para PDF;
- `Baixar arquivo` quando não houver preview.

### QA-P2-14 — Localização do Caderno é técnica demais para o Produtor

**Tipo:** melhoria de UX e decisão de produto

O detalhe mostra latitude, longitude, precisão, data e autor da captura. Essas
informações são úteis para auditoria, mas não são a melhor apresentação
principal.

Recomenda-se:

- mini mapa com marcador;
- limite da Propriedade/Talhão quando disponível;
- círculo de precisão;
- ação `Ver no mapa`;
- indicação `dentro`, `próximo` ou `fora` do Talhão, considerando precisão e
  tolerância;
- coordenadas brutas recolhidas em detalhe técnico para equipe autorizada;
- preservar a versão do GeoJSON usada na avaliação.

O alerta de baixa precisão deve continuar visível após salvar, não apenas
durante a captura.

### QA-P2-15 — Safra/Safrinha

**Tipo:** melhoria funcional

- existem dois pontos aparentes para criar Safra/Safrinha;
- Talhão é texto livre;
- ano é texto sem máscara ou validação;
- cultura deveria vir de lista controlada com `Outro`;
- datas opcionais precisam validar ordem;
- tipo e status vêm previamente selecionados.

Foi sugerido deixar status/fluxo sem seleção para exigir decisão consciente.
Se a preseleção for mantida, ela precisa ser uma regra explícita, e não apenas
o primeiro item do componente.

### QA-P2-16 — Formulários e indicação de obrigatoriedade

**Tipo:** melhoria de UX

O bloqueio de submissão vazia funcionou em várias telas, mas nem todos os
campos obrigatórios foram sinalizados visualmente. Exemplo: Nova Visita
impediu salvar, porém faltou indicar de forma clara todos os campos
responsáveis.

As mensagens devem ficar junto ao campo, aparecer no primeiro envio inválido
e levar o foco ao primeiro erro.

### QA-P2-17 — Nomenclatura Coleta de Solo

**Tipo:** consistência de produto

Usar `Coleta de Solo` de forma idêntica em títulos, filtros, cartões, detalhes
e rotas. Não deixar abreviações ou nomes antigos reaparecerem em telas
relacionadas.

### QA-P2-18 — Espaçamento inferior

**Tipo:** resultado positivo com ressalva

As listas e formulários geralmente terminaram com espaço suficiente para não
serem cobertos pela navegação. Esse padrão deve ser preservado.

No Caderno global, o FAB cobriu temporariamente parte de um cartão durante a
rolagem, embora o conteúdo final pudesse ser totalmente alcançado. Ajustar
posicionamento/elevação sem remover o padding seguro.

### QA-P3-01 — Formatação e rótulos técnicos

**Tipo:** refinamento

- padronizar área brasileira, por exemplo `6.200 ha`, evitando `6.2k ha`;
- esconder códigos de fixture como `17H113_PROD_SEM_PONTO`;
- transformar nomes de arquivo como `PH_10a20` em metadados legíveis:
  elemento, profundidade, data, Safra, escopo e versão;
- manter o nome original apenas no detalhe técnico.

### QA-P3-02 — Avisos técnicos de WebView/Android

**Tipo:** dívida técnica

Foram observados:

- falha SSL `net_error -202` para recursos de `tile.openstreetmap.org`;
- `WebView.destroy() called while WebView is still attached to window`;
- aviso de `OnBackInvokedCallback` não habilitado.

A falha SSL precisa ser reavaliada em rede controlada antes de ser atribuída
definitivamente ao aplicativo. Ainda assim, o produto precisa de fallback
offline e estado de mapa indisponível. O aviso de destruição da WebView pode
indicar ciclo de vida inadequado e deve ser testado com aberturas repetidas.

## 8. Matriz funcional recomendada por perfil

| Ação | Admin | Colaborador | Produtor |
|---|---|---|---|
| Ver Propriedades | escopo global autorizado | Região/Área ou vínculo direto | somente vínculos próprios |
| Editar cadastro mestre | conforme papel administrativo | somente permissão explícita ou solicitação | solicitar correção |
| Gerir Região/Área | sim, com auditoria | não | não |
| Consultar Talhões e Materiais | sim | dentro do escopo | materiais publicados do próprio vínculo |
| Anexar/publicar Material | sim/equipe autorizada | conforme permissão | não |
| Criar Visita | sim | dentro do escopo | não por padrão |
| Editar Visita agendada | sim | dentro do escopo | não |
| Interagir com Visita | gestão | gestão autorizada | confirmar, pedir reagendamento ou contato, se decidido |
| Registrar Caderno | sim | sim | sim, na própria Propriedade |
| Alterar Caderno registrado | correção auditada | complemento/correção auditada | não |
| Arquivar/anular Caderno | sim, com justificativa | conforme permissão | não |
| Ver auditoria | sim | somente do escopo | resumo operacional, sem excesso administrativo |
| Receber notificação | escopo autorizado | próprio escopo | somente seus vínculos e recursos liberados |

A matriz ainda precisa ser promovida e reconciliada com
`docs/project/regras-de-negocio.md` e
`docs/project/pendencias-de-definicao.md`.

## 9. Decisões de produto consolidadas durante a sessão

Estas decisões foram aceitas conceitualmente durante o teste:

1. navegação da Propriedade:
   `Resumo | Talhões | Safras e Safrinha | Materiais | Visitas | Caderno`;
2. remover `Atalhos da Propriedade` por redundância;
3. um único botão de criação de Safra/Safrinha;
4. filtros usando um bottom sheet visual padronizado;
5. Caderno registrado preservado, com complemento/correção auditada em vez
   de edição destrutiva;
6. Admin/Colaborador autorizado pode arquivar ou anular, preservando histórico;
7. Produtor recebe o mínimo de informação administrativa;
8. responsável ligado ao usuário autenticado por id;
9. Talhão ligado por id estável, com opção de registro geral da Propriedade;
10. GeoJSON versionado, imutável e com linhagem de Talhões;
11. mapa com detalhe não modal e interação preservada;
12. localização exibida prioritariamente de forma cartográfica;
13. Município/UF oficiais separados de Regional/Área operacional;
14. notificações personalizadas por destinatário, escopo e recurso;
15. fotos devem permitir ampliação e download autorizado;
16. `Coleta de Solo` deve ter nomenclatura consistente em todas as telas.

## 10. Validações pendentes

### Campo e localização

- repetir a captura ao ar livre;
- testar dentro e fora de um Talhão conhecido;
- comparar precisão, polígono, tolerância e resultado apresentado;
- testar localização desligada, permissão negada e sinal degradado;
- validar comportamento offline;
- confirmar que abrir mapa ou consultar posição não salva coordenada;
- confirmar que cancelar o Caderno descarta o ponto em rascunho.

### Materiais e arquivos reais

- PDF real com preview;
- imagem com zoom e download;
- ZIP sem falsa indicação de preview;
- material georreferenciado com camada, legenda e versão;
- arquivo removido ou indisponível;
- persistência após reinício;
- autorização de download por perfil.

### GeoJSON histórico

- duas ou mais importações da mesma Propriedade;
- renome de Talhão;
- alteração de geometria/área;
- divisão e união;
- reconciliação manual;
- consulta de registro antigo na geometria vigente na data;
- rollback de publicação sem perda da versão posterior.

### Backend e segurança

- expiração, revogação e refresh de sessão;
- isolamento de notificação;
- acesso por rota direta;
- troca de perfil e limpeza de cache;
- usuário desativado durante sessão;
- alteração administrativa de Região/Área;
- auditoria e concorrência de Caderno/Visita.

### Acessibilidade e matriz de dispositivos

- TalkBack;
- fonte 1,3× e 1,5×;
- contraste medido;
- foco e ordem de leitura;
- alvos de toque;
- aparelho compacto, tablet e diferentes versões do Android;
- retrato/paisagem com teclado em todas as telas de formulário.

## 11. Sequência recomendada de implementação

### Fase 0 — Proteção de dados e regras de autoridade

1. sessão real com expiração/revalidação;
2. notificações por destinatário e escopo;
3. Região/Área sob controle administrativo;
4. modelo imutável/auditável do Caderno;
5. transições auditáveis das Visitas.

### Fase 1 — Navegação, responsividade e linguagem

1. corrigir Login com teclado/orientação;
2. padronizar cabeçalhos e ação de voltar;
3. reorganizar módulos da Propriedade;
4. padronizar filtros e regra do X;
5. corrigir grids em paisagem;
6. corrigir contraste, rótulos e nomenclaturas.

### Fase 2 — Identidades operacionais

1. `usuario_id` para responsável;
2. `talhao_id` estável nos formulários;
3. obrigatoriedade por tipo de Caderno;
4. validação de ano, cultura e datas de Safra/Safrinha;
5. cartões unificados de Caderno e Visitas.

### Fase 3 — Materiais e mapa

1. consulta única de materiais;
2. rota por `material_id` e versão;
3. visualizadores por formato;
4. redesign do mapa e painel;
5. tratamento de rede, cache e fallback offline;
6. correção do ciclo de vida da WebView.

### Fase 4 — GeoJSON e validação de campo

1. importações e geometrias versionadas;
2. reconciliação e linhagem;
3. publicação controlada;
4. associação histórica com Caderno, Visitas e Materiais;
5. rodada real de GPS e uso offline em campo;
6. regressão completa nos três perfis.

## 12. Evidências locais principais

As capturas e árvores de interface desta sessão estão em
`../../dist/qa-session-2026-07-23/`. A pasta é local e ignorada pelo Git.

### Login e sessão

- `login-retrato-teclado-sobre-campos.png`
- `login-paisagem-apos-rotacoes-layout-quebrado.png`
- `logout-colaborador-retorno-login.png`
- `produtor-sessao-apos-reinicio.png`

### Escopo e Propriedades

- `colaborador-dashboard-sorriso.png`
- `colaborador-dashboard-mt-norte-sela-prata.png`
- `colaborador-propriedades-paisagem-indicadores.png`
- `produtor-dashboard-inicial.png`
- `produtor-dashboard-paisagem.png`
- `produtor-sela-prata-detalhe-inicial.png`

### Talhões, mapa e materiais

- `colaborador-sela-prata-talhoes-tres-secoes.png`
- `colaborador-sela-prata-panorama-talhoes-filtros.png`
- `colaborador-sela-prata-mapa-talhoes-inicial.png`
- `colaborador-mapa-conflito-localizacao-selecao.png`
- `colaborador-sela-prata-mapa-talhoes-paisagem.png`
- `produtor-material-ph-mapa.png`
- `produtor-materiais-tecnicos-lista.png`

### Visitas

- `colaborador-sela-prata-visitas.png`
- `colaborador-sela-prata-visita-realizada-editar.png`
- `colaborador-sela-prata-visita-agendada-12-junho.png`
- `colaborador-visita-agendada-modal-cancelar.png`
- `produtor-visita-12-junho-detalhe.png`

### Caderno e localização

- `colaborador-sela-prata-caderno-comparacao-visitas.png`
- `colaborador-caderno-com-ponto-detalhe-opacidade.png`
- `colaborador-editar-caderno-criado-produtor.png`
- `colaborador-editar-caderno-completo.png`
- `colaborador-novo-caderno-localizacao-visibilidade.png`
- `produtor-caderno-com-ponto-detalhe.png`
- `produtor-caderno-global.png`
- `produtor-novo-caderno-final.png`

### Perfil e notificações

- `colaborador-editar-perfil.png`
- `colaborador-modal-sair-conta.png`
- `produtor-perfil.png`
- `produtor-notificacoes-gerais.png`
- `notificacoes-mock-sem-escopo.png`
- `notificacoes-apos-reinicio-processo.png`

## 13. Referências técnicas inspecionadas

Os diagnósticos desta revisão foram apoiados principalmente por:

- `src/auth/AuthContext.tsx`;
- `src/contexts/NotificacaoContext.tsx`;
- `src/screens/NotificacoesScreen.tsx`;
- `src/screens/EditProfileScreen.tsx`;
- `src/utils/acessoControle.ts`;
- `src/screens/ProdutorScreen.tsx`;
- `src/screens/MapasScreen.tsx`;
- `src/screens/FazendaMapaScreen.tsx`;
- `src/navigation/mapaRouteCompat.ts`;
- `src/screens/NovoCadernoScreen.tsx`;
- `src/screens/EditarCadernoScreen.tsx`;
- `src/utils/cadernoFormCompat.ts`;
- `src/assets/geojson/selaDePrata1Talhoes.ts`.

## 14. Critério para a próxima rodada completa

Uma nova rodada de regressão completa deve começar somente depois de:

1. os itens P0 terem regra documentada e implementação verificável;
2. os itens P1 de Login, material, mapa, Visitas, contagem e filtros estarem
   corrigidos;
3. as decisões desta revisão serem promovidas aos documentos ativos;
4. existir uma build release identificável;
5. os dados de teste terem escopos explícitos por perfil;
6. haver roteiro com retrato, paisagem, teclado, reinício e rotas diretas;
7. o teste de localização em campo estar separado do teste remoto/simulado.

O resultado esperado da próxima rodada é confirmar não apenas que as telas
abrem, mas que cada informação pertence ao usuário, à Propriedade, ao Talhão,
à versão e ao momento corretos.
