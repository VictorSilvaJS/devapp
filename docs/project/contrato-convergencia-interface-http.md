# Contrato De Convergência Da Interface Demo/HTTP

> Status: `ATIVO`
>
> Definido e implementado no primeiro corte: 2026-08-24
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

## Validação Pendente

O corte passou no typecheck, na suíte completa `test:domain-compat`, nas suítes
MP-33C/MP-34, nos 6/6 testes focados de convergência, na inspeção dos grafos
nativos, nos bundles separados e no prebuild HTTP temporário. Ele ainda deve
ser complementado no Android físico com login, lista/filtros/detalhe de
Propriedades, Perfil, Notificações, troca de identidade e indisponibilidade da
API. Essa validação não substitui os portões produtivos das MP-33B, MP-33C e
MP-34.
