# Contrato de Integração do Aplicativo — MP-33C

> Revisão documental: 2026-08-21
>
> Estado: INTEGRADA E VALIDADA TECNICAMENTE; NÃO LIBERADA PARA PRODUÇÃO

## Objetivo

A MP-33C conecta a composição HTTP do aplicativo ao backend preparado nas
MP-33A e MP-33B, sem misturar dados demonstrativos com dados HTTP. O primeiro
corte HTTP inclui autenticação e ações de conta da própria pessoa, além da
leitura de lista e detalhe de Propriedades autorizadas pelo servidor.

O corte foi integrado à branch `backend` pelo PR #2 no commit `cc78a9f` e
passou pelas validações técnicas registradas neste documento e em
`estado-atual.md`. A CI pós-merge também foi aprovada. Isso não publica o
aplicativo, não implanta backend ou banco e não fecha os portões de domínio,
assinatura, dispositivo e operação necessários para produção.

## Composição dos aplicativos

Existem duas composições de aplicativo, escolhidas no build e não em uma troca
de fonte de dados feita pelo usuário:

- **Demo interno**: preserva integralmente o mock atual, seus dados locais e
  seus testes; usa `com.tcheagro.mobile.demo` e seu sandbox/namespace próprio;
- **Produção HTTP**: preserva o identificador definitivo
  `com.tcheagro.mobile`, contém somente adaptadores HTTP e é a única composição
  preparada para as lojas.

Regras obrigatórias:

- o mock permanece no repositório para Demo e testes;
- módulos, seeds, credenciais e bootstrap do mock não integram o grafo estático
  de dependências, o bundle JavaScript nem o grafo nativo Android da composição
  HTTP;
- a seleção ocorre em uma raiz de composição separada; telas não importam a
  implementação concreta do mock ou do HTTP;
- produção não possui fallback para mock em erro, indisponibilidade, resposta
  inválida ou configuração ausente;
- namespaces locais não são compartilhados entre Demo e produção;
- somente a composição HTTP pode gerar um futuro artefato candidato às lojas.

Os identificadores acima são parte do contrato de build e não podem ser
invertidos por variável de runtime.

## Portas e capacidades

A raiz de composição fornece portas explícitas para:

- autenticação e ações de conta;
- coordenação da sessão;
- leitura de Propriedades;
- configuração e capacidades do cliente.

O modo deve ser um valor discriminado de build, sem seleção dinâmica por dado
persistido. A composição HTTP expõe somente capacidades realmente conectadas.
Uma tela ou rota existente apenas no Demo não pode aparecer na navegação HTTP
nem ser aberta por URL, notificação ou deep link.

Configuração remota futura pode ocultar uma capacidade ou interromper um
rollout, mas nunca conceder autorização, habilitar o mock ou ampliar o escopo
retornado pelo backend.

## Contrato HTTP da primeira vertical

A MP-33C implementa somente:

- `GET /v1/propriedades`;
- `GET /v1/propriedades/:id`.

Não existe endpoint duplicado `/v1/me/propriedades`. Ambos os endpoints exigem
sessão válida e aplicam a autorização dentro da consulta do backend:

- Administrador ativo: escopo global da organização;
- Produtor ativo: Titularidade derivada ou vínculo adicional ativo
  `usuario_autorizado`;
- Colaborador ativo: vínculo direto ativo `colaborador`;
- Município e UF: apenas filtros depois da aplicação do escopo.

Recurso inexistente e recurso fora do escopo retornam o mesmo `404`. Estado da
navegação ou identificador enviado pelo cliente nunca concede acesso.

### Lista

A lista usa cursor opaco e estável, limite padrão 50 e máximo 100, ordenação
determinística por nome e ID, e filtros em allowlist no servidor. O primeiro
contrato aceita:

- `cursor`;
- `limite`;
- `busca`;
- `status`;
- `uf`;
- `municipio`.

O backend filtra, ordena e pagina somente depois de restringir o conjunto ao
escopo autorizado. Cursor malformado e parâmetro fora do schema falham de forma
controlada e não retornam página aproximada. O cursor representa somente a
posição canônica por nome e ID; ele não alega vínculo criptográfico com os
filtros, e o cliente reinicia a paginação quando eles mudam.

`busca` faz correspondência literal por substring no nome da Propriedade, no
nome do Titular e no nome do Município. `uf` compara `uf_id` ou `uf_sigla` sem
distinguir maiúsculas de minúsculas; `municipio` compara `municipio_id` ou
`municipio_nome` da mesma forma. Nenhum filtro concede ou amplia escopo.

### Representação

O JSON HTTP usa exclusivamente `snake_case`, IDs canônicos e não expõe aliases
legados como `fazenda_id`, `produtor_id`, `proprietario_id` ou `tipoAcesso`.
Uma Propriedade possui, no mínimo:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "organizacao_id": "org_tche_fertilidade",
  "titular_id": "00000000-0000-4000-8000-000000000002",
  "titular": {
    "id": "00000000-0000-4000-8000-000000000002",
    "nome": "Produtor"
  },
  "nome": "Propriedade Exemplo",
  "municipio_id": "4306106",
  "municipio_nome": "Caçapava do Sul",
  "uf_id": "43",
  "uf_sigla": "RS",
  "area_total": 120.5,
  "cultura_principal": "Soja",
  "status": "ativa",
  "tipo_acesso": "titular"
}
```

`tipo_acesso` é uma projeção calculada e aceita `admin`, `titular`,
`usuario_autorizado` ou `colaborador`. O valor `titular` nunca cria uma linha
em `usuario_propriedade`. Para Produtor que também possua vínculo adicional na
mesma Propriedade, `titular` tem precedência. Administrador sempre recebe
`admin`.

A resposta da coleção usa:

```json
{
  "itens": [],
  "paginacao": {
    "proximo_cursor": null
  }
}
```

Contadores e métricas que hoje dependem do dataset completo ficam ocultos na
composição HTTP. Eles só voltam quando existir endpoint agregado autorizado;
uma página parcial nunca é apresentada como total.

### Estado e escrita

Na MP-33C, Administrador ativo pode consultar Propriedades ativas ou inativas
pelo filtro permitido. Produtor e Colaborador recebem somente Propriedades
ativas. A identidade precisa estar ativa; o cadastro de Produtor do ator também
precisa estar ativo para acesso como Produtor, e vínculos adicionais precisam
estar ativos. A Titularidade cadastral permanece válida quando a conta ou o
cadastro do Titular é inativado, mas essa pessoa não obtém acesso por ela.

Criação, edição, inativação, transferência de Titularidade, gestão de Usuários
e gestão de vínculos não pertencem à MP-33C. Essas operações e seu RBAC por
ação permanecem na MP-35.

## Sessão no cliente HTTP

- access token existe somente em memória;
- refresh token fica exclusivamente no storage seguro nativo (`SecureStore`),
  na chave versionada `tche_agro.http.refresh_token.v1`;
- senha, tokens e sessão HTTP não são gravados em `AsyncStorage`;
- chamadas concorrentes compartilham uma única tentativa de refresh
  (**single-flight**);
- cada requisição de negócio pode ser repetida no máximo uma vez depois de um
  refresh bem-sucedido;
- `invalid_credentials` não dispara refresh;
- refresh rejeitado com `401` encerra a sessão local;
- `503` explícito durante refresh/restauração preserva o refresh e mostra
  indisponibilidade, sem liberar dados;
- resposta `2xx` incompatível com o contrato falha fechada;
- falha de transporte ambígua durante rotação de refresh não reutiliza o token
  antigo e exige novo login.

Na inicialização, a composição HTTP não possui access token. Se existir
refresh no storage seguro, ela tenta uma única rotação antes de liberar dados.
Sucesso restaura a sessão sob lock e exige a senha completa para exibir dados.
Um `503` explícito preserva o refresh e mostra indisponibilidade; falha de
transporte ambígua durante a rotação limpa a sessão e exige novo login, pois o
cliente não pode saber se o token já foi consumido.

Depois de uma sessão já estar carregada, falha de transporte, `429` ou `5xx` em
`GET /v1/auth/me` não gira tokens nem encerra a sessão. A interface permanece
coberta e mostra indisponibilidade até uma revalidação posterior. Outras
respostas controladas que comprovem sessão/identidade inválida falham fechadas.

Mudança conhecida de perfil, status, organização, escopo ou versão de
autorização invalida o estado de Propriedades anterior. Logout primeiro cobre
a interface, apaga segredo e estado locais e invalida o epoch da sessão. As
respostas em curso são descartadas quando retornam e não ressuscitam a
identidade anterior; uma mutação já aceita pelo servidor ainda pode concluir.
Depois, o cliente tenta a revogação remota em melhor esforço, sem usar
`AsyncStorage` como fila.

## Proteção visual e inatividade

- entrar em background cobre imediatamente os dados com uma proteção visual;
- retorno antes de 15 minutos pode continuar somente com sessão válida e
  revalidação aplicável;
- permanência de 15 minutos ou mais em background exige novo login;
- 15 minutos sem interação no foreground ativam bloqueio local;
- bloqueio local oculta dados, mas não encerra nem revoga automaticamente a
  sessão apenas por ausência de toque;
- logout é uma ação separada que limpa e revoga a sessão conforme possível.

A MP-33C não introduz PIN ou biometria. Uma evolução pode adotá-los para
destravar sessão ainda válida, sem substituir autenticação e autorização do
servidor.

## Limite offline da MP-33C

A composição HTTP é **online-only** neste corte piloto:

- não persiste resposta de negócio para uso offline;
- não abre lista, detalhe ou sessão produtiva a partir de cache após reinício;
- não possui fila de mutações ou sincronização;
- pode manter estado efêmero de tela enquanto o processo estiver vivo, sem
  prometer disponibilidade offline;
- falha de rede mostra indisponibilidade e oferece nova tentativa explícita.

O Demo conserva seu comportamento local. Cache cifrado e offline seguro
continuam uma fase posterior e não podem ser obtidos copiando o
`AsyncStorage` do mock para a produção.

## Conta e links de ação

A composição HTTP integra os fluxos da MP-33B como ações da própria pessoa:

- aceitar convite e definir a própria senha;
- recuperação comum;
- trocar a própria senha e gerenciar as próprias sessões;
- trocar e confirmar o próprio e-mail principal;
- Administrador cadastrar, confirmar e usar seu segundo e-mail verificado.

Convite continua limitado a Usuário pendente já existente. A recuperação
assistida de Produtor/Colaborador segue a MP-33B e permanece condicionada à
política operacional. Conta Administradora não usa recuperação assistida;
operações administrativas de negócio ficam na MP-35. O scaffold break-glass
continua inacessível.

Links de ação usam HTTPS, allowlist exata de origem, caminho e finalidade e nunca
persistem o token ou a URL completa. O token fica somente em memória e é
consumido uma vez por ação explícita. A MP-33C configura Android App Links e o
contrato equivalente de iOS Universal Links. O domínio oficial da empresa,
seus arquivos de associação e a validação ponta a ponta são obrigatórios antes
de aprovação produtiva. Android permanece a primeira plataforma de release.

## Dados e QA

- nenhum registro demonstrativo é promovido ao PostgreSQL;
- testes automatizados de integração criam dados sintéticos exclusivamente no
  banco fornecido por Testcontainers;
- fixtures manuais são comando explícito, nunca migration ou startup;
- o carregador manual exige simultaneamente ambiente `development`, `test` ou
  `qa`, `ALLOW_QA_FIXTURES=true`, `QA_FIXTURES_DATABASE_URL` explícita e
  dedicada a um banco terminado em `_test` ou `_qa`, além de
  `QA_FIXTURES_PASSWORD` explícita e compatível com a política vigente;
- produção recusa o carregador independentemente das demais variáveis;
- não existe seed automático ou produtivo.

Os testes provam separação de build, ausência do mock nos grafos JavaScript e
nativo Android da composição HTTP, preservação do Demo, single-flight,
ordenação das rotações, limpeza de sessão, bloqueio, deep links, contrato HTTP,
filtros e autorização por perfil. A integração do backend executou 36 cenários
reais com Testcontainers/PostGIS. Quando Docker estiver indisponível em outra
execução, a suíte correspondente continua devendo ser registrada como
bloqueada, nunca aprovada por simulação.

## Critérios de aceite

1. Demo continua funcional e isolado, sem regressão do mock.
2. Bundle e grafos HTTP não contêm módulos, seeds ou credenciais demonstrativas.
3. Produção nunca seleciona nem recua para mock.
4. Tokens/sessão HTTP não aparecem no `AsyncStorage`, logs ou navegação.
5. Refresh concorrente executa uma única rotação e cada chamada repete no
   máximo uma vez.
6. Navegação HTTP expõe somente fluxos conectados e bloqueia rotas Demo por
   deep link.
7. Lista e detalhe usam somente `/v1/propriedades`, contrato `snake_case`,
   cursor estável, filtros no servidor e autorização aplicada no backend.
8. Recurso fora do escopo e inexistente são indistinguíveis por `404`.
9. `tipo_acesso=titular` é calculado, não persistido.
10. Métricas incompletas ficam ocultas.
11. Background cobre dados imediatamente; 15 minutos em background exigem
    novo login; inatividade local bloqueia sem logout automático.
12. A composição HTTP é honestamente online-only.
13. Fixtures são sintéticas, explícitas e protegidas; produção continua sem
    seed.
14. Nenhum commit, tag, deploy ou publicação é consequência automática da
    implementação.

## Estado técnico e portões restantes

O Demo preservado e a composição HTTP foram exportados separadamente para
inspeção. A composição HTTP usa somente a permissão Android de internet e
mantém fora de seu grafo nativo as dependências exclusivas do Demo. A CI separa
o aplicativo em Node.js 22 do backend em Node.js 24 e executa os contratos do
corte.

Continuam obrigatórios antes de qualquer aprovação produtiva:

- definir o domínio oficial e publicar/validar `assetlinks.json` e AASA;
- configurar a assinatura oficial e o processo de release;
- validar App Links, retomada, background, lock, conta e Propriedades em
  aparelho e ambiente reais;
- fechar MFA de Administrador e os demais portões operacionais da MP-33B.

O merge produziu o commit `cc78a9f`. Não houve tag, deploy, release, publicação
em loja nem promoção de fixtures para produção.

## Fora de escopo

- escrita ou administração de Propriedades, Usuários e vínculos;
- transferência e histórico de Titularidade;
- Talhões, Visitas, Caderno, Materiais, mapas e notificações via HTTP;
- cache persistente e offline produtivo;
- MFA, break-glass operacional e liberação pública de Admin;
- publicação em loja, rollout, commit, tag ou deploy;
- iOS como primeira plataforma produtiva.
