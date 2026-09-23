# Contrato De Convergência Da Interface Demo/HTTP

> Status: `ATIVO`
>
> Definido, implementado e integrado no primeiro corte: 2026-08-24
>
> Escopo: apresentação compartilhada e integração progressiva das telas já
> aprovadas com as verticais HTTP reais

## Objetivo

A interface consolidada no Demo é a referência visual do produto. A evolução
do backend não cria um segundo aplicativo visual definitivo: cada vertical
real deve conectar a apresentação já aprovada aos repositórios HTTP, mantendo
separadas a fonte demonstrativa e a fonte produtiva.

Esse contrato corrige uma lacuna do roteiro anterior. MP-40 e MP-41 são fases
de validação; elas não realizam automaticamente a migração das telas.

## Regra De Composição

Demo e HTTP continuam sendo composições de build distintas:

- o Demo injeta adaptadores locais e preserva seus dados demonstrativos;
- o aplicativo HTTP injeta somente sessão, repositórios e capacidades reais;
- a apresentação compartilhada recebe dados e ações por propriedades/portas e
  não importa implementação concreta de `src/api`, contexto demonstrativo,
  `AsyncStorage` ou repositório HTTP;
- produção não possui fallback para dados demonstrativos;
- uma tela compartilhada mostra no HTTP apenas seções e ações cujo backend e
  cuja autorização já existem;
- rota, botão ou conteúdo visual nunca substituem a autorização do servidor.

Componentes puramente visuais podem integrar os dois grafos. Dependências
nativas de apresentação também podem integrar a composição HTTP quando forem
necessárias e não concederem acesso a dados ou capacidades de campo. O primeiro
corte admite `expo-linear-gradient` para preservar o padrão visual. Storage
local comum, câmera, localização, mapas, WebView e demais módulos exclusivos de
fluxos ainda demonstrativos continuam fora do grafo HTTP.

## Primeiro Corte Implementado

O corte anterior à MP-35 converge as capacidades já reais:

1. login Demo e HTTP usam a mesma apresentação, com adaptadores e textos de
   contexto diferentes; acesso rápido existe somente no Demo;
2. cabeçalho, identidade visual, badge e barra inferior seguem o padrão já
   aprovado;
3. lista HTTP de Propriedades reutiliza busca, filtros, estado vazio e cartão
   visual da interface existente, mantendo filtros/paginação no servidor;
4. detalhe HTTP usa o padrão visual da Propriedade e mostra somente os campos
   realmente retornados por `GET /v1/propriedades/:id`;
5. Perfil reutiliza avatar, cartões e hierarquia de ações, mas executa apenas
   as ações self-service reais da conta;
6. Notificações preservam a implementação HTTP da MP-34 e passam a usar a
   apresentação aprovada de lista, filtros, prioridade e estados vazios.

Métricas de Propriedades permanecem ocultas porque a API ainda não possui
agregado autorizado. Talhões, mapas, Visitas, Caderno, Materiais e Dashboard
não aparecem como dados reais nem como botões ativos neste corte.

## MP-35D-4 — estado da etapa — 2026-09-23

MP-35D-4 concluída no escopo funcional validado, com limitações residuais
temporariamente aceitas para esta etapa de desenvolvimento. Código funcional
validado na revisão `fea8ec3`. Integração na `backend` e release não
autorizados por este fechamento. MP-35D permanece em andamento; o fechamento
não conclui todo o aplicativo, iOS ou o processo de publicação.

O aceite residual de 23/09 decorre da decisão do usuário na conversa de condução
do projeto, posterior ao percurso integrado no TCL API 35. Combina auditorias
dos cortes anteriores, revalidação integrada e aceite delimitado; não constitui
nova auditoria independente global. Bug 2/F-01 fechado em `f0fa1f6`, Bug 3 em
`ac42443` e melhoria parcial do Bug 1 em retrato consolidada em `fea8ec3`.
Paisagem e captura API 32 com IME continuam pendentes de tratamento posterior,
temporariamente aceitas apenas para fechar D-4. Ver [fechamento e alcance da D-4](smoke.md#mp-35d-4--fechamento-com-aceite-residual--2026-09-23).

As seções datadas anteriores abaixo preservam o estado e as evidências de cada
corte à época; suas pendências de validação/aceite da D-4 não são o estado atual.

## Status visual separado da MP-35D-4 — 2026-09-14

Sobre `e5db497`, o detalhe HTTP agora oferece modal local de ativar/inativar,
somente para Admin. Reutiliza SectionCard, SelectField, FormField, InfoBox e
botões textuais existentes, sem extrair ou alterar código Demo/PropertyForm.
O modal contém motivo/detalhe e confirmação; não edita campos cadastrais.
Dados vêm da boundary e comandos do serviço/lifecycle aprovados, sem storage,
fetch direto, nova dependência ou fallback. O detalhe conserva sua rota/key.
Aprovado independentemente para commit: 38/38 critérios e 33/33 probes, sem
achado obrigatório. F1/N1 e Demo preservados; fechamento Git autorizado.
Android físico pendente.

## Corte visual administrativo MP-35D-4 — 2026-09-14

Criação/edição de Propriedade e navegação mínima implementadas sobre `37a8790`,
com N1 corrigido e aprovado na reauditoria independente. `PropertyFormLayout` e
`PropertyCadastralFields` extraem o layout e campos aprovados do Demo;
`SelectField` recebe capacidades opcionais de consulta remota, paginação,
recuperação e seleção fora das opções carregadas. A apresentação permanece pura.
Demo injeta suas ações locais; o container HTTP compõe modelos, seletores,
lifecycle e boundary já fechados. Não houve alteração de bootstrap/storage Demo.
Safe area inferior do formulário HTTP e foco/rolagem/teclado seguem os componentes
existentes. Testes renderizados usam React Navigation real com primitivas nativas
substituídas; não constituem validação Android física deste corte.
A primeira auditoria encontrou somente N1: edição empilhava outro detalhe da
mesma Propriedade. A correção fica na navegação HTTP: origem por key/identidade,
retorno ao detalhe válido e destino canônico na entrada direta/origem inválida.
A apresentação compartilhada, SelectField e o Demo foram preservados por hash.
Reauditoria: 20/20 critérios, 14/14 probes; nenhum achado obrigatório remanescente.
Formulários HTTP e navegação mínima fechados em `e5db497`. O status visual
separado está descrito acima; integração final na `backend` posterior.

## Obrigação Das Próximas Verticais

Cada fase deve entregar backend e integração com a apresentação existente no
mesmo critério de pronto:

- MP-35 conecta as telas administrativas de Propriedades, Usuários e vínculos
  somente depois de implementar suas escritas e o RBAC por ação;
- MP-36 conecta Caderno, preservando rascunho próprio, comandos auditáveis,
  concorrência e autorização do servidor;
- MP-37 conecta Talhões/GeoJSON e as superfícies de mapa compatíveis com o
  contrato produtivo;
- MP-38 e MP-39 validam campo e regressão geoespacial, sem substituir a
  integração da interface;
- Visitas, Materiais e agregados do Dashboard precisam de cortes HTTP
  explícitos antes de serem tratados como disponíveis em produção;
- MP-40 e MP-41 só validam a interface produtiva já conectada.

Uma vertical não está concluída para o aplicativo se entregar apenas uma nova
tela HTTP paralela quando já existir apresentação aprovada equivalente.

## Critérios De Aceite

1. Demo continua funcional e usa somente seus adaptadores locais.
2. HTTP continua sem `src/api`, mock, `AsyncStorage` ou fallback demonstrativo.
3. Login e componentes visuais centrais são compartilhados por injeção de
   dados e ações.
4. HTTP mostra somente capacidades conectadas e mantém mensagens honestas para
   seções ainda indisponíveis.
5. Lista/detalhe de Propriedades preservam cursor, filtros e autorização do
   servidor, sem total derivado de página parcial.
6. Perfil e Notificações preservam sessão, idempotência, isolamento de
   destinatário e reautorização da MP-34.
7. Mudança de identidade continua limpando estado e respostas tardias.
8. Typecheck, testes de domínio, MP-33C, MP-34, arquitetura dos grafos e smoke
   físico proporcional passam antes do fechamento.

## Fora De Escopo Do Primeiro Corte

- implementar escrita da MP-35;
- habilitar tela, aba ou ação sem endpoint e guard reais;
- promover dados demonstrativos ao PostgreSQL;
- adicionar cache persistente ou offline produtivo;
- Visitas, Caderno, Materiais, GeoJSON produtivo ou agregados do Dashboard;
- iOS, assinatura, deploy, release ou publicação.

## Validação Executada

O corte passou no typecheck, na suíte completa `test:domain-compat`, nas suítes
MP-33C/MP-34, nos 7/7 testes focados de convergência, na inspeção dos grafos
nativos, nos bundles separados e no prebuild HTTP temporário.

Em 2026-08-24, o TCL 8483A com Android 15/API 35 confirmou login,
lista/busca/filtros/estado vazio/detalhe de Propriedades, Perfil, Notificações,
troca de identidade e indisponibilidade da API sem fallback. Depois da correção
por safe area, os alvos da barra ficaram acima da região de gestos e passaram em
3/3 abas HTTP e 6/6 abas Demo. A massa física não produziu segunda página de
Propriedades; o cursor permanece coberto pela automação. Essa validação não
substitui os portões produtivos das MP-33B, MP-33C e MP-34.

O corte foi integrado diretamente à branch `backend` no commit `e47bb02`, e os
três jobs da CI pós-push foram aprovados. Essa integração não criou tag, deploy,
release ou publicação e não altera os portões produtivos e de loja.
