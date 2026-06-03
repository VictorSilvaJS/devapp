# Fase 16A - APK Demonstravel Para Testes Em Campo

Status em 2026-06-03: iniciada como fase de congelamento operacional e
preparacao de APK demonstravel. Esta fase nao continua refatoracao de
rotas/payloads, nao implementa backend, nao implementa RBAC real, nao remove
compatibilidade legada e nao altera contratos `fazenda_id`/`fazendaId`.

## Objetivo

Preparar o aplicativo para uma geracao de APK de teste em campo, priorizando
estabilidade, clareza de demonstracao e separacao explicita entre fluxos
demonstraveis, dados mockados e capacidades ainda preparatorias.

## Criterios De Corte

- O app permanece React Native + Expo com dados em mock local.
- A autenticacao continua mockada.
- Cadastros administrativos continuam visuais/mockados.
- `Propriedade` permanece como termo de produto.
- `fazenda_id` e `fazendaId` permanecem como contrato operacional interno.
- Dados reais so podem entrar no mock quando forem autorizados, minimizados e
  seguros para demonstracao.

## Diagnostico Geral Do APK Demonstravel

O app esta tecnicamente apto para uma rodada de APK demonstravel, desde que a
entrega seja comunicada como MVP visual/mockado para validacao em campo. Os
fluxos principais de consulta, navegacao por perfil, propriedade, mapas,
visitas e caderno possuem cobertura documental e validacao automatizada de
compatibilidade.

O principal cuidado antes de entregar o APK e evitar que testers interpretem
mock como produto final. Em especial:

- login rapido de desenvolvimento aparece na tela de login;
- `Smoke Dev` existe no Perfil quando o app roda em modo `__DEV__`;
- fotos de visita e caderno sao simuladas ou URLs externas de mock;
- associacao de material tecnico em mapas e uma referencia mockada, nao upload
  real;
- usuarios criados no Admin nao criam login real;
- permissoes continuam de frontend/mock, sem backend/RBAC real.

## Fluxos Prontos Para Demonstrar

### Login Por Perfil

Liberado para demonstracao controlada:

- Admin: login mock com visao global.
- Colaborador: login mock com escopo regional/sub-regional.
- Produtor: login mock de consulta da propria realidade operacional.

Observacao: o login deve ser apresentado como acesso demonstrativo. Usuarios
criados no modulo Admin nao passam a autenticar no app.

### Propriedades

Liberado para demonstracao:

- listagem de Propriedades por perfil;
- busca e filtros;
- cards com Propriedade, Titular, localizacao, status e area;
- navegacao para detalhe;
- botao de Nova Propriedade para perfis permitidos.

### Detalhe Da Propriedade

Liberado para demonstracao:

- resumo da Propriedade;
- Titular preservado;
- dados produtivos e territoriais;
- abas de lavoura/mapas, visitas e caderno;
- acoes de editar/excluir apenas quando permitidas;
- bloqueio de acesso fora do escopo.

### Mapas E Anexos

Liberado para demonstracao como consulta visual/mockada:

- panorama da Propriedade;
- demarcacao e talhoes quando existirem;
- mapa base da Sela de Prata I;
- anexos de fertilidade PNG da Sela de Prata I;
- filtros por categoria, safra, talhao e busca;
- preview de imagem interna para anexos preparados.

Tratar como mock/preparatorio:

- upload;
- associacao de referencia de material;
- download real;
- storage;
- Drive;
- pipeline de importacao;
- publicacao/liberacao real de anexos.

### Visitas

Liberado para demonstracao:

- listagem de visitas por perfil e escopo;
- detalhe de visita;
- criacao de visita por Admin/Colaborador;
- criacao contextual a partir da Propriedade;
- bloqueio do Produtor para criar/editar visita;
- preservacao de `fazenda_id`.

Tratar como mock/preparatorio:

- fotos anexadas por URL simulada;
- persistencia em memoria/mock;
- ausencia de sincronizacao real.

### Caderno

Liberado para demonstracao:

- listagem de registros por perfil e escopo;
- detalhe de registro;
- criacao de registro no contexto da Propriedade;
- visibilidade para Produtor;
- bloqueios de rota direta fora do escopo;
- preservacao de `fazenda_id`.

Tratar como mock/preparatorio:

- persistencia local em memoria/mock;
- ausencia de sincronizacao real;
- ausencia de anexo real de foto/documento.

### Admin Usuarios

Liberado para demonstracao interna/assistida:

- listagem de usuarios;
- detalhe de usuario;
- cadastro/edicao visual de Usuario;
- perfis Produtor, Colaborador e Administrador;
- status `ativo`, `inativo` e `pendente`;
- vinculos visuais de Produtor com Propriedade;
- escopo visual de Colaborador por Regiao/Microregiao;
- propriedades atribuidas como vinculo preparatorio.

Tratar como mock/preparatorio:

- criacao de login;
- senha real;
- convite;
- reset;
- autenticacao de backend;
- RBAC por propriedade atribuida.

### Nova Propriedade E Edicao De Propriedade

Liberado para demonstracao:

- Nova Propriedade com Titular existente ou novo titular minimo mockado;
- Regiao e Microregiao derivadas do mock quando disponiveis;
- sugestao visual de colaboradores por microregiao;
- edicao de nome, area, cultura, cidade e UF;
- preservacao do Titular, Regiao e Microregiao na edicao.

Tratar como mock/preparatorio:

- novo titular minimo nao cria login real;
- integridade referencial real depende de backend;
- fluxo nao e transacional.

## Cadastros Usaveis Em Campo

Podem ser usados para teste de UX e coleta de feedback:

- Nova Propriedade;
- Editar Propriedade;
- Novo Usuario;
- Editar Usuario;
- Nova Visita;
- Novo Registro de Caderno.

Nao devem ser usados como fonte oficial de dados operacionais:

- Usuarios criados no Admin;
- Vinculos de usuario/propriedade;
- Propriedades atribuidas ao colaborador;
- Fotos simuladas;
- Referencias de materiais tecnicos;
- Qualquer dado que precise persistir depois da reinstalacao ou limpeza do app.

## Campos Corretos Para Coleta Real

Campos com boa aderencia para feedback de campo, ainda que persistam no mock:

- Propriedade: nome, area total, cultura principal/atual, cidade, UF, Regiao,
  Microregiao, status e Titular.
- Usuario: nome, e-mail, telefone, documento, perfil, status e observacoes.
- Colaborador: Regiao, Microregiao e propriedades atribuidas como desenho
  futuro.
- Visita: Propriedade, fluxo/status, data, horario, objetivo, observacoes,
  recomendacoes, clima e proxima visita.
- Caderno: Propriedade, data da atividade, tipo de atividade, Talhao, area
  aplicada, produtos utilizados, dosagem, condicoes climaticas, observacoes e
  visibilidade para Produtor.
- Anexos de fertilidade: Propriedade, Talhao, Safra, elemento, profundidade,
  nome original, tipo de material, status e visibilidade.

## Campos Apenas Mock Ou Preparatorios

- senha;
- convite/reset/autenticacao;
- `ativo` como booleano legado;
- `propriedades_atribuidas` como permissao efetiva;
- colaboradores sugeridos;
- fotos de visita/caderno;
- referencias `asset://`, `https://picsum.photos` e caminhos relativos de
  arquivo;
- download real;
- upload/storage/Drive;
- `AnexoFertilidade` como contrato isolado ainda nao integrado;
- ids futuros `propriedade_id` e `titular_id` como aliases aditivos, sem
  substituir contratos atuais.

## Dados Reais Que Podem Entrar No Mock Com Seguranca

Somente com autorizacao explicita e minimizacao:

- nome publico ou autorizado da Propriedade;
- municipio, UF, regiao e microregiao;
- area total aproximada quando nao sensivel;
- cultura principal generica;
- talhoes/limites ja autorizados para demonstracao;
- anexos tecnicos anonimizados ou liberados para uso demonstrativo;
- metadados tecnicos sem pessoa identificavel;
- safra/ano e elemento agronomico quando nao exponham estrategia sensivel.

Para campo, preferir dados semi-reais: nomes controlados, contatos ficticios e
valores tecnicos representativos.

## Dados Que Nao Devem Entrar Por LGPD/Privacidade

Nao incluir no APK mockado sem base legal/autorizacao e controle de acesso real:

- CPF, RG, documentos pessoais reais;
- telefone pessoal real;
- e-mail pessoal real;
- endereco residencial ou coordenadas sensiveis sem autorizacao;
- senhas reais;
- dados financeiros, contratos, notas ou precos;
- conversas, fotos pessoais ou imagens com pessoas/placas;
- dados agronomicos estrategicos sem liberacao;
- relatorios completos de terceiros;
- nomes de produtores reais quando nao houver autorizacao para demonstracao;
- localizacao precisa de propriedade real quando isso for sensivel.

## Riscos Do APK Mockado Em Campo

- Testers podem acreditar que dados serao persistidos oficialmente.
- Login rapido e credenciais mockadas podem vazar se o APK circular fora do
  grupo combinado.
- Dados mockados podem ser confundidos com dados reais.
- Sem backend/RBAC, permissoes nao representam seguranca real.
- Sem storage/sync, cadastros podem ser perdidos.
- Fotos e anexos simulados podem criar expectativa de coleta real.
- Mapas base usam recurso online quando houver tiles externos; em campo pode
  haver degradacao por conectividade.
- APK sem configuracao formal de build pode variar conforme o modo usado para
  gerar.

## Ajustes Minimos Recomendados Antes Do APK

Obrigatorios para entrega externa:

- gerar APK em modo que nao exponha `__DEV__`, evitando o painel `Smoke Dev`;
- decidir se `Acesso rapido (dev)` permanece visivel ou se sera ocultado para
  APK de campo;
- revisar credenciais mockadas que serao compartilhadas;
- confirmar autorizacao dos dados da Sela de Prata I e dos PNGs de fertilidade;
- remover ou trocar dados pessoais ficticios que parecam reais demais;
- alinhar verbalmente que Admin Usuarios nao cria login real.

Recomendados antes da primeira instalacao em celular:

- testar em Android fisico com internet ruim;
- testar abertura dos PNGs internos da Sela de Prata I;
- testar mapa de talhoes sem depender exclusivamente de tile online;
- testar fonte/tamanho em tela pequena;
- registrar versao do APK e data da rodada.

## Checklist Para Gerar APK

1. Confirmar que a branch esta no corte de congelamento da Fase 16A.
2. Rodar `npm run typecheck`.
3. Rodar `npm run test:domain-compat`.
4. Rodar `git diff --check`.
5. Conferir `app.json` e metadados de nome/versao.
6. Definir estrategia de build: EAS/Expo ou build Android local.
7. Criar `eas.json` apenas se a equipe decidir usar EAS nesta fase.
8. Garantir build sem `__DEV__` para entrega de campo.
9. Instalar APK em aparelho Android real.
10. Registrar credenciais mockadas liberadas para a rodada.
11. Registrar dados reais/semi-reais incluidos e autorizacao de uso.
12. Salvar hash/nome do arquivo APK entregue.

## Checklist De Smoke Manual No Celular

### Login

- Entrar como Admin.
- Entrar como Colaborador.
- Entrar como Produtor.
- Sair e entrar novamente para validar sessao mockada.

### Produtor

- Abrir Minhas Propriedades.
- Abrir Propriedade Sela de Prata I.
- Abrir mapa dos talhoes.
- Tocar em talhao e conferir detalhe.
- Abrir Mapas/Anexos de fertilidade.
- Abrir os cinco PNGs de fertilidade.
- Abrir Visitas.
- Abrir Caderno.
- Confirmar que Produtor nao cria visita.

### Colaborador

- Abrir Home.
- Abrir Propriedades do escopo.
- Abrir detalhe de Propriedade.
- Criar Nova Visita global.
- Criar Nova Visita pelo contexto da Propriedade.
- Criar Novo Registro de Caderno.
- Confirmar bloqueio fora do escopo quando houver caso disponivel.

### Admin

- Abrir Dashboard.
- Abrir Propriedades.
- Criar Nova Propriedade.
- Editar Propriedade existente.
- Abrir Admin -> Usuarios.
- Criar Usuario Produtor ativo com Propriedade vinculada.
- Criar Usuario Produtor pendente sem Propriedade.
- Criar Usuario Colaborador com Microregiao.
- Criar Usuario Administrador.
- Conferir que usuario criado no Admin nao vira login real.

### Mapas E Anexos

- Abrir Panorama geral.
- Filtrar por Fertilidade.
- Filtrar por Safra.
- Filtrar por Talhao.
- Abrir anexo PNG interno.
- Conferir mensagem de material pendente/mock quando aplicavel.

### Regressao De Contratos

- Criar visita e conferir retorno para listagem/detalhe.
- Criar caderno e conferir detalhe.
- Editar visita/caderno, quando permitido, sem trocar Propriedade.
- Confirmar que `fazenda_id` permanece preservado pelos fluxos validados.

## Validacoes Automaticas Executadas

Executadas em 2026-06-03:

- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou.
- `git diff --check`: passou.

## Decisao Operacional

A Fase 16A deve seguir como estabilizacao para APK demonstravel. O proximo
trabalho deve ser smoke manual em aparelho Android e, se necessario, apenas
ajustes pequenos de apresentacao/risco antes da geracao do APK. Refatoracoes,
backend, RBAC real, migracao de contratos e remocao de legado ficam fora desta
fase.
