# Fase 17A - Analise De Desenvolvimento Do MVP Pos-SDK 56

## 1. Resumo Executivo

Status em 2026-06-12: a Fase 17A analisou o app como MVP demonstravel em
emulador Android SDK 56, sem implementar feature e sem alterar comportamento
funcional.

O estado atual e bom para seguir desenvolvimento em emulador. O app ja sustenta
login demonstrativo dos tres perfis, consulta contextual por Propriedade,
panorama de talhoes, visitas, caderno, biblioteca de mapas/anexos, GeoJSON
local e PNG local com persistencia separada. A Sela de Prata I continua como
amostra operacional principal.

A principal recomendacao e executar a Fase 17B como uma revisao pequena de UX e
linguagem do fluxo do Produtor em emulador, sem backend, sem RBAC real e sem
mudanca estrutural. Essa fase deve reduzir excesso de informacao tecnica para o
produtor, explicitar a fronteira entre consulta e acoes da equipe e preservar
os fluxos ja aprovados em emulador.

Android fisico continua pendente para validacao final de campo. A aprovacao em
emulador da 16F/GeoJSON e da 16G/PNG nao deve ser descrita como fechamento
operacional em aparelho fisico.

## 2. Estado Atual Confirmado

Base documental ativa revisada:

- `docs/project/estado-atual.md`
- `docs/project/contexto-consolidado.md`
- `docs/project/escopo-mvp.md`
- `docs/project/regras-de-negocio.md`
- `docs/project/decisoes-consolidadas.md`
- `docs/project/pendencias-de-definicao.md`
- `docs/project/smoke.md`
- `docs/project/fase-16h-smoke-android-integrado.md`

Codigo revisado para diagnostico:

- navegacao e perfis em `src/navigation/index.tsx`;
- auth demonstrativo em `src/auth/authMock.ts`;
- permissoes e escopo em `src/utils/acessoControle.ts`;
- compatibilidade de Propriedade/Titular em `src/utils/propriedadeCompat.ts` e `src/api/produtorCompat.ts`;
- mock e persistencia local em `src/api/mock.ts` e `src/api/mockLocalPersistence.ts`;
- telas principais de Propriedades, Produtor, Mapas, Visitas, Caderno e Usuarios;
- servicos GeoJSON/PNG locais e servicos preparatorios de mapa/cache/sync;
- testes em `tests/`.

Confirmacoes principais:

- Expo SDK 56 esta na base atual.
- 16H.4 passou como smoke operacional em emulador SDK 56 para instalacao,
  login dos tres perfis, Sela de Prata I, mapas/talhoes, visitas, caderno e
  restauracao de sessao.
- 16H.5 aprovou PNG local em emulador para DocumentPicker, metadados,
  salvamento e persistencia.
- 16H.6 corrigiu GeoJSON local pos-DocumentPicker com
  `expo-file-system/legacy` em `GeoJsonFilePickerService.ts`.
- GeoJSON local passou em emulador para `.geojson`, `.json`, substituicao e
  persistencia apos `force-stop`/reabertura.
- `Mapa.list`, `LimiteArea.list`, assets da Sela e mocks permanecem como base
  preservada desta analise.
- `@tche:mock-mvp:v1`, `@tche:geojson-imports:v1` e
  `@tche:png-map-imports:v1` continuam separados por finalidade.

## 3. O Que Esta Bom Para Seguir Testando Em Emulador

- A navegacao por perfil esta coerente para MVP demonstravel: Admin tem Home,
  Propriedades, Usuarios, Visitas, Caderno e Perfil; Colaborador nao possui
  Usuarios; Produtor entra em `Minhas Propriedades` e Caderno.
- O fluxo da Sela de Prata I esta forte para demonstracao: detalhe da
  Propriedade, mapa de talhoes, anexos de fertilidade, visitas e caderno.
- A camada de acesso mockada esta centralizada o bastante para continuar
  evoluindo pequenas frentes sem mexer em backend.
- Visitas e caderno preservam contexto de Propriedade por `fazenda_id`.
- GeoJSON e PNG locais agora possuem fluxos de emulador suficientes para
  continuar desenvolvimento sem bloquear em aparelho fisico.
- Os testes de compatibilidade cobrem dominio, acesso, rotas, GeoJSON, PNG,
  storage local e formularios.
- A persistencia local separa snapshot mock, metadados GeoJSON, metadados PNG e
  arquivos fisicos no FileSystem.

## 4. O Que Ainda Depende De Android Fisico

- Validar DocumentPicker real em aparelho fisico para GeoJSON e PNG.
- Confirmar comportamento de `file://` e `content://` em fabricantes reais,
  inclusive permissao de leitura e persistencia apos reabertura.
- Validar abertura de PNG local por `Image` com arquivo copiado para storage
  interno.
- Validar force-stop/reabertura, performance e memoria em hardware real.
- Validar operacao em campo com conectividade instavel, especialmente tiles
  online e degradacao visual do mapa-base.
- Confirmar instalacao, login, Sela de Prata I, visitas, caderno e mapas em
  aparelho fisico antes de declarar fechamento operacional de campo.

## 5. Analise Por Modulo

### Produtor

O produtor navega por `Minhas Propriedades` e abre a Propriedade para consultar
resumo, talhoes, anexos/mapas, visitas e caderno. A regra de acesso usa o
vinculo titular/produtor compativel, preservando campos legados.

Pontos bons:

- fluxo principal validado em emulador e documentado em smoke;
- produtor nao acessa Admin/Usuarios;
- produtor consulta visitas e materiais no contexto da propria Propriedade;
- caderno respeita `visivel_para_produtor` na listagem.

Riscos ou excesso:

- a rota tecnica `Minhas Fazendas` ainda aparece internamente na navegacao, com
  titulo visual `Minhas Propriedades`;
- o detalhe da Propriedade ainda pode expor muitas informacoes tecnicas para o
  produtor, principalmente quando misturam mock, assets, limites e materiais;
- a fronteira entre consulta do produtor e manutencao da equipe ainda precisa
  ficar mais clara por UX, nao por regra nova.

### Propriedades

`PropriedadesScreen.tsx` lista Propriedades com busca, status, metricas e
criacao conforme permissao. `ProdutorScreen.tsx` concentra detalhe, abas e
atalhos contextuais.

Pontos bons:

- linguagem visual usa `Propriedade`;
- Admin e Colaborador usam filtros e escopo;
- exclusao verifica integridade com mapas, visitas, caderno e limites;
- detalhe preserva vinculos visuais com Usuario/Titular e colaboradores.

Riscos ou limites:

- ainda existem nomes tecnicos `produtor`/`fazenda` em codigo e rotas por
  compatibilidade;
- cadastro rapido e criacao combinada continuam demonstrativos e nao
  transacionais;
- a diferenca entre area total cadastrada e area mapeada da Sela segue
  pendente de confirmacao.

### Visitas

`VisitasScreen.tsx` lista por perfil e filtros; `NovaVisitaScreen.tsx` permite
criacao por Admin/Colaborador e trava contexto quando recebe `fazendaId`;
`EditarVisitaScreen.tsx` preserva o contexto da visita original.

Pontos bons:

- produtor nao cria nem edita visita;
- colaborador depende de escopo;
- rota contextual a partir da Propriedade pre-seleciona e trava a Propriedade;
- edicao preserva `fazenda_id`.

Riscos ou limites:

- existem campos de foto e fluxo visual ainda sem camera/upload real;
- a tela pode ser pesada para uso rapido em campo se a proxima fase mexer em
  ergonomia;
- a permissao por acao ainda e mockada e nao deve ser comunicada como RBAC real.

### Caderno

O caderno e enxuto em intencao, mas ainda possui muitos campos operacionais.
`NovoCadernoScreen.tsx` exige Propriedade, data, tipo de atividade e permite
visibilidade para produtor; produtor pode criar registro proprio e a UI trava
visibilidade como visivel.

Pontos bons:

- registros sao vinculados a Propriedade/Talhao;
- produtor ve apenas o que esta liberado;
- Admin/Colaborador podem manter registros conforme escopo;
- criacao contextual por Propriedade esta documentada no smoke.

Riscos ou limites:

- campos minimos e opcionais finais ainda sao pendencia ativa;
- existe risco de o caderno parecer modulo agronomico amplo demais se novas
  categorias forem adicionadas sem decisao;
- linguagem deve evitar promessa de sync ou backend.

### Mapas/Arquivos Tecnicos

`MapasScreen.tsx` e a maior superficie funcional. Ela combina panorama,
limites/talhoes, mapas mockados, anexos PNG locais, GeoJSON local, filtros,
modal de imagem e mensagens de escopo.

Pontos bons:

- `Mapa.list` e `LimiteArea.list` continuam preservados;
- materiais tecnicos estao no contexto da Propriedade;
- PNG de fertilidade e PNG local aparecem como itens compativeis em runtime;
- produtor recebe somente mapas liberados para download/consulta;
- mensagens atuais evitam upload remoto, backend e storage produtivo.

Riscos ou limites:

- tela grande e com muitas responsabilidades;
- taxonomia final de materiais ainda esta aberta;
- filtros por categoria, safra, talhao e busca funcionam para MVP, mas podem
  ficar densos para produtor;
- `download` deve continuar tratado com cautela, pois nao ha download real
  produtivo.

### GeoJSON Local

O fluxo local usa DocumentPicker, validacao, storage em FileSystem e metadados
em `@tche:geojson-imports:v1`. A camada efetiva de talhoes usa GeoJSON local
ativo quando valido e volta ao seed/mock quando nao houver camada local.

Pontos bons:

- aprovado em emulador SDK 56 apos 16H.6;
- aceita `.geojson` e `.json`;
- preserva `fazenda_id` e `propriedade_id`;
- nao altera `LimiteArea.list`;
- testes garantem que o workflow nao escreve em `@tche:mock-mvp:v1`.

Riscos ou limites:

- Android fisico ainda precisa validar DocumentPicker e URIs reais;
- pipeline produtivo de conversao/publicacao continua fora de escopo;
- GeoJSON bruto nao deve ser salvo em AsyncStorage.

### PNG Local

O fluxo local usa DocumentPicker, copia arquivo para storage interno e salva
somente metadados pequenos em `@tche:png-map-imports:v1`. A listagem deriva
itens compativeis com `Mapa` sem alterar `Mapa.list`.

Pontos bons:

- aprovado em emulador SDK 56 para selecao, metadados, salvamento e
  persistencia;
- seguranca de URI local e validacao de PNG local estao cobertas por testes;
- substituicao/remocao local preservam assets demonstrativos da Sela.

Riscos ou limites:

- Android fisico ainda precisa validar `Image` com arquivo real local;
- fluxo administrativo real de publicacao e liberacao continua fora de escopo;
- PNG/base64/binario nao deve ir para AsyncStorage.

### Usuarios/Admin

O Admin possui modulo de Usuarios separado de Propriedades. O cadastro usa
perfil, status, vinculos com Propriedades, microregioes e nivel administrativo.

Pontos bons:

- `UsuariosScreen.tsx`, `NovoUsuarioScreen.tsx` e `UsuarioDetailScreen.tsx`
  bloqueiam acesso nao-admin;
- textos deixam claro que o cadastro e administrativo demonstrativo;
- produtor ativo exige Propriedade vinculada no mock;
- colaborador ativo exige escopo visual minimo;
- usuario criado no Admin nao vira login real.

Riscos ou limites:

- cadastro rapido de Propriedade dentro de Usuario e poderoso para demo, mas
  deve ficar fora do fluxo principal de campo;
- vinculos administrativos podem sugerir permissao real se a UI nao for
  cuidadosa;
- integridade transacional depende de backend futuro.

### Colaborador/Permissoes

A regra efetiva atual e: Admin ve tudo; Produtor ve Propriedades por vinculo;
Colaborador ve por `sub_regioes`, com fallback para `vinculos_microregioes`.
`propriedades_atribuidas` permanece visual/preparatorio.

Pontos bons:

- regra central fica em `src/utils/acessoControle.ts`;
- Colaborador nao ve Admin/Usuarios;
- criacao/edicao de visita e caderno respeitam escopo;
- Admin visual ja avisa que vinculos nao sao RBAC real.

Riscos ou limites:

- comentarios antigos ainda usam `cliente`, `proprietario` e `fazenda`, o que
  pode confundir leitura tecnica;
- backend/RBAC real continua fora do escopo;
- permissao por acao ainda precisa contrato real antes de producao.

### Persistencia Local

Persistencia atual:

- `@tche:mock-mvp:v1`: snapshot local de users, produtores, vinculos, visitas,
  cadernos e metadados mock de mapas;
- `@tche:geojson-imports:v1`: metadados de GeoJSON local;
- `@tche:png-map-imports:v1`: metadados de PNG local;
- FileSystem: arquivos GeoJSON/PNG copiados para storage interno.

Pontos bons:

- separacao correta entre metadados e arquivos;
- testes protegem contra escrita dos workflows GeoJSON/PNG no snapshot mock;
- restauracao de seed existe como ferramenta controlada.

Riscos ou limites:

- politica de migracao do snapshot entre versoes ainda nao esta fechada;
- cota, criptografia e dados reais dependem de definicao futura;
- servicos `MapaSincronizacaoService.ts` e `MapaCacheService.ts` ainda parecem
  mais ambiciosos que o MVP e devem ser tratados como preparatorios/incompletos.

## 6. Matriz De Riscos

| Prioridade | Risco | Impacto | Encaminhamento |
|---|---|---|---|
| P0 bloqueador | Android fisico nao validado | Nao permite fechar campo operacional | Manter pendente e reexecutar 16H fisico quando houver aparelho |
| P0 bloqueador | Prometer backend/RBAC/sync/upload/download real | Pode gerar expectativa falsa de produto | Revisar linguagem em UX/documentos antes de demo externa |
| P0 bloqueador | Quebrar `fazenda_id` em visitas/caderno/mapas | Perda de contexto e permissao | Preservar compatibilidade e testar dominio |
| P1 importante | Produtor exposto a excesso tecnico | Reduz clareza da demo e uso em campo | Fase 17B deve simplificar UX do produtor |
| P1 importante | MapasScreen concentrando muitas responsabilidades | Aumenta risco em mudancas futuras | Planejar melhorias pequenas e testaveis, sem refatoracao ampla |
| P1 importante | Caderno sem campos finais fechados | Pode virar modulo amplo demais | Manter enxuto e decidir minimos antes de expandir |
| P1 importante | `propriedades_atribuidas` entendido como permissao real | Divergencia com regra efetiva do MVP | Continuar comunicando como vinculo visual/preparatorio |
| P2 melhoria | Comentarios e rotas tecnicas ainda falam fazenda/cliente | Ruido para manutencao | Limpeza nominal futura, pequena e separada |
| P2 melhoria | Filtros de mapas densos para produtor | UX menos direta | Ajustar exposicao por perfil na 17B/17C |
| Fora do escopo | Backend, JWT, RBAC real, sync, storage remoto | Nao pertence ao MVP atual | Manter como contrato futuro/documentacao, nao implementar agora |

## 7. Matriz De Proximas Fases Recomendadas

| Fase | Objetivo | Escopo | Arquivos provaveis | Validacao em emulador | Risco | Depende de Android fisico |
|---|---|---|---|---|---|---|
| 17B | Simplificar UX do Produtor | Ajustes pequenos de linguagem, densidade e fronteira consulta/equipe no fluxo do produtor | `ProdutorScreen.tsx`, `MapasScreen.tsx`, `CadernoCampoScreen.tsx`, `VisitasScreen.tsx`, `docs/project/smoke.md` | Login produtor, Sela, talhoes, anexos, visitas, caderno, sem acoes de equipe | Medio | Nao para desenvolver; sim para fechamento de campo |
| 17C | Revisar Caderno enxuto | Confirmar campos minimos/opcionais e reduzir ruido visual sem alterar regra | `CadernoCampoScreen.tsx`, `NovoCadernoScreen.tsx`, `EditarCadernoScreen.tsx`, `docs/project/pendencias-de-definicao.md` se houver decisao | Criar/editar/listar por perfil e visibilidade | Medio | Nao |
| 17D | Organizar Mapas/Arquivos tecnicos por perfil | Melhorar taxonomia visual e filtros sem mexer em `Mapa.list`/`LimiteArea.list` | `MapasScreen.tsx`, helpers de PNG/GeoJSON, smoke | Sela, filtros, PNG asset, PNG local, GeoJSON local | Alto | Nao para desenvolver; fisico para picker final |
| 17E | Revisar Cadastros demonstrativos | Tirar fluxo principal de campo do cadastro rapido e reforcar limites mockados | `NovoUsuarioScreen.tsx`, `UsuarioDetailScreen.tsx`, `PropriedadesScreen.tsx` | Admin Usuarios, Novo Usuario, Propriedade existente, colaborador visual | Medio | Nao |
| 17F | Auditoria tecnica de servicos preparatorios | Classificar `MapaCacheService` e `MapaSincronizacaoService` como incompletos/preparatorios e reduzir risco de promessa | `MapaCacheService.ts`, `MapaSincronizacaoService.ts`, docs | Testes de dominio e leitura de telas | Medio | Nao |
| 16H fisico | Fechar validacao operacional de campo | Instalar APK e repetir GeoJSON/PNG/login/Sela em aparelho real | Docs e smoke; sem codigo se passar | Checklist fisico completo | Alto | Sim |

## 8. Recomendacao Da Proxima Fase De Implementacao

Recomendacao unica: **Fase 17B - Simplificacao do fluxo do Produtor em
emulador**.

Motivo:

- e a menor frente com impacto direto na demonstracao;
- nao depende de backend, RBAC real, sync, upload remoto ou Android fisico para
  desenvolvimento;
- reduz risco de o produtor enxergar informacao tecnica ou acoes de equipe como
  parte da sua responsabilidade;
- preserva 16F/16G em emulador e nao reabre `Mapa.list`, `LimiteArea.list` nem
  mocks da Sela.

Escopo sugerido para 17B:

- revisar detalhe da Propriedade do produtor;
- revisar entrada em Mapas/Arquivos tecnicos para produtor;
- revisar como visitas e caderno aparecem para produtor;
- manter todos os bloqueios e `fazenda_id`;
- nao criar campos, servicos, backend ou persistencia nova.

## 9. Itens Que Devem Continuar Fora Do Escopo

- backend real, API real, banco real e migrations;
- JWT, autenticacao real, convite, reset de senha e sessao produtiva;
- RBAC real e permissao granular de backend;
- sync, fila offline produtiva e storage remoto;
- upload remoto, download/compartilhamento real e Drive;
- pipeline produtivo de conversao/publicacao de mapas;
- zoom avancado e cache produtivo de tiles;
- remocao de `fazenda_id` ou migracao tecnica ampla para `propriedade_id`;
- alteracao de `Mapa.list`, `LimiteArea.list`, assets ou registros mockados da
  Sela de Prata I;
- salvar GeoJSON bruto, PNG, base64 ou binario em AsyncStorage;
- declarar Android fisico como aprovado sem smoke em aparelho.

## 10. Checklist De Validacao Em Emulador Para A Proxima Fase

Checklist recomendado para 17B:

| ID | Criticidade | Perfil | Area | Acao | Resultado esperado |
|---|---|---|---|---|---|
| 17B-01 | P0 | Produtor | Login | Entrar como `produtor.demonstracao@example.com` | Abre em `Minhas Propriedades` sem crash |
| 17B-02 | P0 | Produtor | Propriedade | Abrir Sela de Prata I | Detalhe usa linguagem de consulta e preserva resumo principal |
| 17B-03 | P0 | Produtor | Talhoes | Abrir panorama e selecionar talhao | Talhoes renderizam e detalhe continua legivel |
| 17B-04 | P0 | Produtor | Mapas | Abrir Mapas/Arquivos tecnicos | Materiais aparecem sem sugerir upload/backend/sync |
| 17B-05 | P1 | Produtor | PNG asset | Abrir anexo de fertilidade demonstrativo | Imagem abre e metadados nao confundem com acao administrativa |
| 17B-06 | P1 | Produtor | Visitas | Abrir visitas da Propriedade | Historico aparece para consulta, sem criacao/edicao |
| 17B-07 | P1 | Produtor | Caderno | Abrir caderno da Propriedade | Registros visiveis aparecem; restritos continuam ocultos |
| 17B-08 | P0 | Produtor | Rotas diretas | Tentar `NovaVisita` e `EditarVisita` por rota interna de smoke | Produtor permanece bloqueado |
| 17B-09 | P0 | Colaborador | Regressao | Abrir Propriedade do escopo e criar visita contextual | `fazenda_id` preservado e contexto travado |
| 17B-10 | P0 | Admin | Regressao | Abrir Sela em Mapas/Arquivos tecnicos | GeoJSON/PNG locais continuam acessiveis conforme estado do emulador |

## Conclusao

O MVP esta apto a continuar evoluindo em emulador como produto demonstravel. O
proximo ganho nao deve ser uma feature nova, mas sim uma lapidacao de UX do
fluxo do Produtor para reforcar consulta simples, contexto de Propriedade e
limites do mock. Em paralelo, Android fisico continua sendo a pendencia final
para campo.
