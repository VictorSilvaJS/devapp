# Fase 17H - Marcacoes De Campo Vinculadas Ao Caderno

Status em 2026-07-14 (Fase 17H.0): analise tecnica concluida para orientar uma
implementacao futura de marcacoes de campo vinculadas ao Caderno. Nenhuma
marcacao foi implementada, nenhum storage novo foi criado, nenhuma chave
`@tche:` nova foi criada e nenhuma coordenada foi salva nesta fase.

A analise parte do estado validado ate a 17G.3: localizacao foreground minima
aprovada em emulador sobre Talhoes seed/mock e GeoJSON local ativo, acionada
por `Mostrar minha posicao`, com coordenada apenas em state React e runtime
Leaflet/WebView. A localizacao segue sem background, sem `TaskManager`, sem
watch continuo, sem geofencing, sem trilha, sem rota, sem historico, sem ultimo
ponto, sem geotag e sem coordenada no Caderno.

Android fisico segue pendente e nao aprovado. A divergencia conhecida
`expo@56.0.11` versus esperado `~56.0.15` segue aceita temporariamente e nao
deve ser corrigida nesta frente.

## Objetivo Da Analise

Definir como implementar futuramente marcacoes de campo com ponto geografico
explicito, vinculadas ao Caderno de Campo, sem criar persistencia nesta fase e
sem transformar a localizacao temporaria do mapa em salvamento automatico.

## Diagnostico Do Estado Atual

### Localizacao foreground

- `src/services/LocationForegroundService.ts` fornece leitura foreground sob
  demanda, com permissao solicitada explicitamente.
- `src/screens/FazendaMapaScreen.tsx` guarda `userLocation` apenas em state
  React e passa a coordenada para `MapaFazendaView`.
- `src/components/MapaFazendaView.tsx` desenha marcador/circulo somente no
  runtime Leaflet/WebView.
- O fallback SVG informa que a posicao esta disponivel apenas no mapa
  interativo e nao desenha marcador.
- `Mostrar minha posicao` nao salva coordenada.
- Apos `force-stop`, o GeoJSON local permanece quando anexado, mas a posicao do
  usuario nao e restaurada.

### Caderno de Campo

- `NovoCadernoScreen` e `EditarCadernoScreen` montam payload por
  `buildCadernoPayload`.
- O payload atual preserva `fazenda_id` e `fazendaId`, `talhao`, `talhao_id`,
  visibilidade, autoria local e vinculo opcional de Safra/Safrinha.
- `CadernoCampo.create` e `CadernoCampo.update` gravam o registro dentro do
  snapshot local existente `@tche:mock-mvp:v1`.
- `CadernoDetailScreen` nao exibe latitude, longitude, accuracy, `capturedAt`,
  geotag ou campo de localizacao do registro.
- Os tipos atuais ja cobrem o corte pratico para campo: `observacao`,
  `aplicacao`, `correcao_solo`, `ocorrencia` e `outro`, alem de valores
  tecnicos/legados preservados.

### Talhao e materiais tecnicos

- `TalhaoDetailModal` ja oferece a acao `Registrar no Caderno`, passando
  contexto de Propriedade/Talhao para o formulario.
- `FazendaMapaScreen` seleciona Talhoes no mapa, mas ainda nao possui acao de
  `Registrar ponto`.
- PNG local e ZIP de Prescricao continuam materiais tecnicos/anexos, sem
  georreferenciamento, sem marcador de localizacao, sem preview de ZIP e sem
  processamento.

## O Que E Uma Marcacao De Campo No MVP

No MVP demonstravel, uma marcacao de campo deve ser entendida como:

- um registro de Caderno de Campo;
- vinculado obrigatoriamente a uma Propriedade pelo contexto atual de
  `fazenda_id`/`fazendaId`;
- opcionalmente vinculado a um Talhao;
- opcionalmente acompanhado de um ponto geografico capturado por acao explicita
  do usuario;
- sem trilha, sem historico de posicoes e sem calculo automatico de dentro ou
  fora do Talhao.

### Corte minimo por tipo

- Observacao de campo: registro textual simples sobre uma condicao vista em
  campo. Pode ter ponto opcional se o usuario escolher registrar aquela posicao.
- Fertilizacao: no corte atual, deve usar `aplicacao` quando representar uma
  operacao de produto/dosagem/area aplicada. Nao exige novo tipo na 17H.0.
- Correcao de solo: usa `correcao_solo` quando o registro estiver ligado a
  calagem/gessagem/correcao operacional, sempre separado de PNG/ZIP de material
  tecnico.
- Ocorrencia: usa `ocorrencia` para problema, anomalia, falha, praga, erosao,
  mancha ou situacao que precise ser localizada em campo.
- Outro: usa `outro` para casos pontuais ainda sem taxonomia fechada.

Se a fase 17H.1 decidir criar um tipo visivel `fertilizacao`, isso deve ser
aditivo e testado em `CADERNO_TIPOS_ATIVIDADE`, `validateCadernoCampo`,
listagem, detalhe e compatibilidade legada. Para o MVP inicial, `aplicacao` e
suficiente.

## Separacao Conceitual Obrigatoria

### Registro de Caderno comum

Registro atual, sem coordenada. Deve continuar permitido para todos os perfis
que ja podem criar Caderno em uma Propriedade autorizada.

### Registro de Caderno com ponto geografico explicito

Registro de Caderno com metadados opcionais de localizacao, salvos somente se o
usuario pedir explicitamente para usar a posicao e depois salvar o formulario.
Registros antigos continuam validos sem esses campos.

### Material tecnico PNG/ZIP

PNG e ZIP continuam anexos de consulta. Eles nao recebem marcador, coordenada,
geotag, overlay ou processamento geoespacial nesta frente.

### Localizacao temporaria no mapa

`Mostrar minha posicao` continua sendo apenas visualizacao temporaria em
foreground no mapa de Talhoes. Essa acao nunca salva coordenada por si so.

## Quando Coordenada Pode Ser Salva

Regra recomendada para 17H.1:

- coordenada so pode ser salva quando o usuario tocar explicitamente em uma
  acao como `Registrar ponto`, `Usar minha posicao neste registro` ou texto
  equivalente;
- depois da acao explicita, a coordenada ainda so deve persistir se o usuario
  salvar o registro do Caderno;
- cancelar o formulario nunca salva coordenada;
- remover a localizacao antes de salvar gera Caderno sem coordenada;
- negar permissao, desligar localizacao ou falhar leitura deve permitir seguir
  com Caderno sem coordenada;
- abrir mapa nunca salva coordenada;
- tocar em `Mostrar minha posicao` nunca salva coordenada;
- abrir Talhao nunca salva coordenada;
- abrir Caderno nunca salva coordenada;
- criar Caderno sem coordenada continua permitido.

## Onde A Marcacao Deve Morar

### Opcao A - Caderno com metadados opcionais de localizacao

Recomendacao para o MVP demonstravel.

Vantagens:

- aproveita o fluxo ja validado de Caderno por Propriedade/Talhao;
- evita chave `@tche:` nova;
- preserva historico operacional em um unico lugar;
- reaproveita regras de acesso e visibilidade ja existentes;
- reduz duplicidade entre observacao textual e ponto geografico.

Riscos:

- pode poluir o Caderno se a UI fizer a coordenada parecer obrigatoria;
- precisa preservar compatibilidade de registros antigos;
- exige testes fortes para garantir que coordenada so entra quando houver acao
  explicita e salvamento do formulario;
- no mock atual, coordenada futura ficaria dentro do snapshot existente
  `@tche:mock-mvp:v1`, porque Caderno ja e persistido ali.

### Opcao B - Storage auxiliar futuro

Exemplo futuro: `@tche:field-markers:v1`.

Vantagens:

- separa pontos geograficos de registros textuais;
- pode evoluir para camadas independentes no mapa;
- facilita filtros especificos de marcadores.

Riscos:

- cria mais um contrato local e uma nova chave;
- aumenta a complexidade de sincronizacao futura;
- duplica a relacao com Propriedade/Talhao/Caderno;
- exige resolver consistencia entre marcador e registro de Caderno;
- esta fora do corte minimo pedido para 17H.0.

Decisao recomendada: para 17H.1, usar a Opcao A. O storage auxiliar deve ficar
reservado para uma fase posterior, caso o produto evolua para camadas
geograficas independentes do Caderno.

## Modelo De Dados Futuro

Recomendacao: persistir campos opcionais planos no registro de Caderno, por
compatibilidade com o padrao atual de payloads e validadores, e derivar um
objeto `localizacao` apenas na UI/helper se isso ajudar a leitura.

Campos sugeridos para 17H.1:

```ts
localizacao_latitude?: number;
localizacao_longitude?: number;
localizacao_accuracy?: number | null;
localizacao_captured_at?: string;
localizacao_captured_by?: string;
localizacao_origem?: 'foreground_explicit';
```

Leitura de UI opcional:

```ts
localizacao?: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt: string;
  capturedBy?: string;
  origem: 'foreground_explicit';
};
```

Regras do modelo:

- todos os campos sao opcionais;
- latitude deve ficar entre `-90` e `90`;
- longitude deve ficar entre `-180` e `180`;
- accuracy deve ser numero maior ou igual a zero, ou `null`;
- `capturedAt` deve ser ISO string;
- `capturedBy` deve usar o id do usuario quando disponivel;
- `origem` deve registrar apenas `foreground_explicit` no corte inicial;
- campos so existem quando o usuario escolheu registrar ponto;
- nao salvar trilha;
- nao salvar historico de posicoes;
- nao salvar ultimo ponto separado;
- nao salvar no Material tecnico;
- nao salvar em PNG/ZIP.

## Permissoes Por Perfil

### Produtor

- pode criar Caderno com ponto na propria Propriedade/Talhao, se a fase futura
  liberar a acao explicita;
- pode ver os proprios registros com ponto;
- pode ver registros liberados pela equipe com ponto;
- nao edita nem remove nesta fase, seguindo a regra atual do Caderno;
- nao cria Visita;
- nao executa acao administrativa de Material tecnico, PNG, ZIP ou GeoJSON.

### Colaborador

- pode criar Caderno com ponto dentro do escopo regional atual;
- pode editar conforme regra atual do Caderno;
- nao acessa Propriedade fora do escopo;
- se editar localizacao futura, deve passar pela mesma regra de edicao do
  Caderno e por acao explicita de trocar/remover ponto.

### Admin

- pode criar e editar conforme regra atual do Caderno;
- pode ver registros dentro do corte global do MVP mockado;
- deve continuar sem backend/RBAC real nesta fase.

## UX Futura Recomendada

### No mapa de Talhoes

Fluxo recomendado:

1. Usuario toca `Mostrar minha posicao`.
2. App mostra marcador temporario e precisao no mapa de Talhoes.
3. Se houver posicao valida e contexto de Propriedade, aparece acao secundaria
   `Registrar ponto no Caderno`.
4. Ao tocar nessa acao, o app abre `NovoCadernoScreen` com Propriedade e Talhao
   preservados quando houver selecao.
5. O formulario mostra a posicao recebida como opcional e pede confirmacao:
   `Usar esta posicao no registro`.
6. O usuario pode remover a localizacao antes de salvar.

Observacoes:

- a coordenada pode trafegar em memoria/rota ate o formulario, mas nao deve ser
  enviada para AsyncStorage antes do salvamento do Caderno;
- se o usuario mudar de Talhao, a UI nao deve inferir automaticamente que o
  ponto pertence ao Talhao;
- sem helper point-in-polygon testado, nao afirmar dentro/fora do Talhao.

### No Novo Caderno

Fluxo recomendado:

1. Formulario continua permitindo salvar sem coordenada.
2. Campo/acao opcional: `Usar posicao atual neste registro`.
3. Ao tocar, solicitar/usar localizacao foreground.
4. Mostrar precisao, horario e texto claro de consentimento.
5. Salvar coordenada apenas junto com `CadernoCampo.create`.
6. Se o usuario cancelar, nao salvar coordenada.
7. Se o usuario remover localizacao, salvar Caderno sem coordenada.

### Na Edicao do Caderno

Para 17H.1, manter simples:

- Produtor continua sem editar/remover registro;
- Admin/Colaborador seguem a regra atual de edicao;
- editar/remover localizacao deve ser acao explicita;
- nunca atualizar coordenada automaticamente ao abrir a edicao.

## Visualizacao Futura No Mapa

Sem implementar na 17H.0, a visualizacao futura pode seguir estas regras:

- pontos do Caderno aparecem somente no mapa de Talhoes/GeoJSON;
- Produtor ve seus proprios registros e registros liberados pela equipe;
- Admin/Colaborador veem conforme regra atual de acesso/escopo;
- tocar no ponto abre detalhe do Caderno;
- nao usar cluster no primeiro corte;
- nao usar heatmap;
- nao desenhar linha, rota ou trilha;
- nao sobrepor ponto em PNG;
- nao sobrepor ponto em ZIP;
- nao fazer calculo agronomico automatico;
- nao afirmar dentro/fora de Talhao sem helper testado.

## Seguranca E Privacidade

- Coordenada e dado operacional sensivel.
- A UI deve avisar claramente quando a posicao sera salva no registro.
- Nao capturar em background.
- Nao capturar continuamente.
- Nao salvar sem acao explicita.
- Nao salvar apenas por abrir mapa, Talhao ou Caderno.
- Nao enviar para backend.
- Nao sincronizar.
- Nao usar para auditoria automatica.
- Nao usar para rastrear colaborador ou produtor.
- Nao registrar coordenada em logs.
- Android fisico e obrigatorio antes de declarar uso de campo aprovado.

## Fora De Escopo Na 17H.0

- implementar marcacoes;
- alterar codigo de tela, servico, tipo, validator ou storage;
- criar `@tche:field-markers:v1`;
- salvar latitude, longitude, accuracy, timestamp, coords, geotag, trilha,
  rota, historico ou ultimo ponto;
- adicionar background location;
- usar `TaskManager`;
- usar `startLocationUpdatesAsync`;
- usar `watchPosition` ou `watchPositionAsync`;
- implementar geofencing;
- calcular dentro/fora do Talhao;
- georreferenciar PNG;
- mostrar marcador sobre PNG;
- mostrar marcador sobre ZIP;
- processar ZIP;
- abrir backend, JWT/RBAC real, sync, upload/download real ou storage remoto;
- fazer upgrade amplo de SDK/dependencias;
- rodar `npm audit fix`;
- declarar Android fisico aprovado.

## Riscos

- Usuario confundir `Mostrar minha posicao` com salvamento de coordenada.
- Coordenada entrar no Caderno por padrao sem consentimento explicito.
- Registro antigo quebrar se o modelo tornar localizacao obrigatoria.
- Produtor esperar editar/remover ponto apesar da regra atual bloquear edicao.
- Colaborador salvar ponto fora do escopo se a validacao de Propriedade for
  ignorada.
- PNG/ZIP parecerem georreferenciados se a UI misturar acoes de mapa e
  material tecnico.
- Snapshot `@tche:mock-mvp:v1` passar a conter dado sensivel sem testes de
  consentimento em uma fase futura.
- Precisao de emulador nao representar precisao real em campo.
- Android fisico ainda nao validado.

## Criterios Para Abrir A 17H.1

Antes de implementar, a proxima fase deve fechar:

- aceitar explicitamente Android fisico como pendente ou validar 17G em
  aparelho autorizado antes de seguir;
- confirmar que o armazenamento principal sera o Caderno, sem chave nova, ou
  aprovar formalmente storage auxiliar;
- definir campos opcionais finais;
- definir se o tipo visivel continua `aplicacao` ou se entra `fertilizacao`;
- confirmar regra de permissao por perfil;
- definir mensagem de consentimento;
- definir exibicao de precisao e horario;
- testar que cancelar formulario nao persiste coordenada;
- testar que remover localizacao salva Caderno sem coordenada;
- testar que `Mostrar minha posicao` nunca salva coordenada sozinho;
- testar que coordenada so persiste ao salvar Caderno;
- confirmar que PNG/ZIP nao recebem marcador;
- confirmar que nao havera background, tracking, watch continuo, geofencing,
  trilha, rota ou historico;
- manter `fazenda_id` e `fazendaId` no payload do Caderno.

## Checklist Futuro Para 17H.1

| ID | Area | Criterio |
|---|---|---|
| 17H1-01 | Modelo | Campos de localizacao opcionais e ausentes em registros antigos |
| 17H1-02 | Caderno | Criar registro sem coordenada continua funcionando |
| 17H1-03 | Consentimento | Coordenada so aparece apos acao explicita |
| 17H1-04 | Cancelamento | Cancelar formulario nao salva coordenada |
| 17H1-05 | Remocao | Remover localizacao salva Caderno sem coordenada |
| 17H1-06 | Mapa | `Mostrar minha posicao` nao persiste nada sozinho |
| 17H1-07 | Permissao | Produtor cria ponto apenas na propria Propriedade |
| 17H1-08 | Permissao | Colaborador cria/edita apenas dentro do escopo |
| 17H1-09 | Material tecnico | PNG/ZIP seguem sem marcador/georreferenciamento |
| 17H1-10 | Auditoria | Sem background, TaskManager, watch, geofence, trilha ou rota |
| 17H1-11 | Storage | Sem chave nova se a decisao for Caderno no MVP |
| 17H1-12 | Android fisico | Smoke de permissao, precisao e salvamento explicito em aparelho autorizado |

## Fechamento Da 17H.0

A recomendacao tecnica para a proxima fase e implementar marcacao de campo como
metadado opcional do Caderno, acionado apenas por escolha explicita do usuario
e persistido somente junto com o salvamento do registro. A 17H.0 nao altera o
app, nao cria storage, nao cria chave nova e nao salva coordenadas.
