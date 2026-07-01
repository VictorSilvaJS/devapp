# Fase 17B - UX Do Produtor Em Emulador

Status em 2026-07-01: implementacao de UX/textos aplicada no fluxo do
Produtor, com validacao automatizada executada e smoke visual parcial aprovado
em emulador Android.

## 1. Objetivo

Simplificar a experiencia visual e textual do Produtor no MVP demonstravel,
reforcando que o perfil Produtor acompanha e consulta a situacao da
Propriedade.

A fase nao altera regras efetivas de acesso, mocks, persistencia, contratos,
rotas internas amplas, `Mapa.list`, `LimiteArea.list`, assets da Sela de Prata
I, stores locais ou chaves de compatibilidade como `fazenda_id`.

## 2. Escopo Aplicado

- Detalhe da Propriedade passou a ter texto de acompanhamento para Produtor.
- Resumo da Propriedade ganhou atalhos para Panorama/Talhoes, Materiais
  tecnicos, Historico de visitas e Caderno de campo.
- Labels de contagem e secoes foram ajustados para `Materiais`, `Talhoes`,
  `Mapas e arquivos tecnicos`, `Historico de visitas` e `Caderno de campo`.
- Estados vazios do Produtor passaram a falar em material, visita ou registro
  liberado para consulta.
- Mapas e panorama escondem linguagem de manutencao local para Produtor em
  indicadores de PNG/GeoJSON local, mantendo essas informacoes para perfis de
  equipe.
- Acoes administrativas de GeoJSON/PNG continuam condicionadas pelas permissoes
  existentes de Admin/Colaborador.

## 3. Arquivos Alterados

- `src/screens/ProdutorScreen.tsx`
- `src/screens/PropriedadesScreen.tsx`
- `src/screens/MapasScreen.tsx`
- `src/screens/FazendaMapaScreen.tsx`
- `src/screens/VisitasScreen.tsx`
- `src/screens/CadernoCampoScreen.tsx`
- `docs/project/fase-17b-ux-produtor.md`
- `docs/project/estado-atual.md`
- `docs/project/smoke.md`
- `docs/project/pendencias-de-definicao.md`

## 4. Mudancas Visuais E Textuais

- `PropriedadesScreen` mostra `Minhas Propriedades` para Produtor.
- `ProdutorScreen` exibe modo acompanhamento, subtitulo consultivo e atalhos
  de consulta.
- A aba `Lavoura` foi renomeada visualmente para `Talhoes`.
- Materiais no detalhe usam `Abrir material`, sem icone ou promessa de
  download.
- `VisitasScreen` mostra `Historico de visitas` para Produtor.
- `CadernoCampoScreen` usa estados vazios de registros liberados para Produtor.
- `MapasScreen` descreve materiais do Produtor como liberados para consulta e
  nao mostra `PNG local` como tipo do anexo para esse perfil.
- `FazendaMapaScreen` troca indicadores de `GeoJSON local` por `Talhoes
  disponiveis para consulta` quando o usuario e Produtor.

## 5. O Que Foi Preservado

- `src/api/mock.ts` nao foi alterado.
- `Mapa.list` nao foi alterado.
- `LimiteArea.list` nao foi alterado.
- Assets, seed e registros mockados da Sela de Prata I nao foram alterados.
- Stores locais `@tche:mock-mvp:v1`, `@tche:geojson-imports:v1` e
  `@tche:png-map-imports:v1` nao foram alterados.
- Compatibilidade `fazenda_id`/`fazendaId` foi preservada.
- Regras efetivas de acesso em `src/utils/acessoControle.ts` nao foram
  alteradas.
- Backend, JWT, RBAC real, upload remoto, sync, download real, storage remoto e
  pipeline produtivo continuam fora do escopo.

## 6. Validacoes Automatizadas

- `npm run typecheck`: passou.
- `.\node_modules\.bin\tsc -p tsconfig.domain-compat.json`: passou.
- `npm run test:domain-compat`: passou.
- `npx expo install --check`: executou com divergencia de dependencia
  (`expo@56.0.11`, esperado `~56.0.13`). Dependencias nao foram atualizadas
  porque a fase proibe upgrade.
- `git diff --check`: passou, com avisos normais de LF/CRLF no Windows.

## 7. Resultado Do Smoke Em Emulador

Smoke visual parcial da 17B foi executado em emulador Android.

Evidencia:

- `adb` nao estava no PATH inicialmente; foi usado
  `C:\Users\e_vsjesus\AppData\Local\Android\Sdk\platform-tools\adb.exe`.
- Device conectado: `emulator-5554`.
- AVDs encontrados: `Teste_Tche` e `tche_test`.
- `npm run android` gerou, instalou e abriu a build debug no emulador.
- Login do Produtor foi feito pelo acesso rapido `Produtor Demonstracao`.
- Evidencias de tela foram salvas em `tmp/smoke-17b-*.png` e dumps em
  `tmp/window-*.xml`.

Casos aprovados na rodada:

- login do Produtor abrindo em `Minhas Propriedades`;
- abertura da Sela de Prata I com linguagem de consulta, `Titular`, `Talhoes`,
  `Materiais`, modo acompanhamento e atalhos;
- tela de materiais tecnicos com `Consulta da Propriedade`, talhoes
  disponiveis para consulta e mapa de talhoes renderizado;
- historico de visitas da Propriedade sem acao de criacao/edicao;
- caderno da Propriedade e caderno global sem `Novo Registro` para Produtor.

Permanecem para reexecucao especifica:

- selecao detalhada de talhao dentro do panorama;
- abertura do anexo PNG de fertilidade demonstrativo;
- rotas diretas de bloqueio (`NovaVisita`, `EditarVisita` etc.);
- regressao visual/funcional de Colaborador e Admin.

## 8. Riscos Residuais

- Revalidar anexo PNG de fertilidade no fluxo do Produtor.
- Revalidar Admin/Colaborador em Mapas/Arquivos tecnicos para confirmar que
  gestao local de GeoJSON/PNG segue disponivel somente para perfis autorizados.
- Resolver ou aceitar explicitamente a divergencia `expo@56.0.11` versus
  `~56.0.13` antes de declarar a fase totalmente aprovada.

## 9. Android Fisico

Android fisico continua pendente para validacao final de campo. A Fase 17B nao
altera esse status.
