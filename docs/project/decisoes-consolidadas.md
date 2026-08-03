# Decisoes Consolidadas

Este documento registra decisoes ja assumidas pelo projeto e que devem orientar leitura do dominio, UX, modelagem e evolucao tecnica. Nao deve receber hipoteses, backlog ou temas ainda em aberto.

## Como Usar Este Documento

- Use este arquivo para identificar o que o projeto ja trata como direcao consolidada.
- Se um ponto ainda depender de validacao ou detalhamento, ele deve ir para `pendencias-de-definicao.md`.
- Quando houver conflito entre historico e este documento, priorize este documento e os demais arquivos ativos de `docs/project/`.

## 1. O projeto trabalha com tres perfis principais

### Decisao

O projeto considera tres perfis principais de uso:

- administracao geral
- colaborador regional
- produtor

### Alcance

Afeta leitura funcional do produto, navegacao, acesso aos dados e organizacao do dominio.

### Impacto

Qualquer proposta de interface, permissao ou modelagem deve partir dessa estrutura base, e nao de papeis extras herdados de historico ou de ideias antigas.

---

## 2. Nomenclatura oficial de produto

### Decisao

Na interface, na documentacao de produto e em textos visiveis para o usuario, o termo oficial para a unidade operacional do produtor e `Propriedade`.

Tambem ficam consolidados como termos de produto:

- `Produtor`: usuario/perfil final que consulta sua realidade operacional.
- `Titular`: responsavel cadastral ou vinculo principal da propriedade.
- `Talhao`: subdivisao interna da propriedade.

No codigo legado e em documentos tecnicos, permanecem temporariamente `fazenda`, `fazenda_id`, `getFazendaId`, nomes de rotas, arquivos, contratos e campos internos quando isso evitar refatoracao arriscada.

### Alcance

Afeta interface, textos visiveis, documentacao de produto, leitura funcional e interpretacao do dominio.

### Impacto

Novos textos de produto devem usar `Propriedade`, `Produtor`, `Titular` e `Talhao`. A limpeza tecnica interna de `fazenda` para `propriedade`, se acontecer, deve ser uma fase futura separada e planejada.

---

## 3. Um produtor pode estar ligado a uma ou mais propriedades

### Decisao

O dominio do projeto deve considerar a possibilidade de um mesmo produtor estar vinculado a mais de uma propriedade.

### Alcance

Afeta modelagem, navegacao, filtros, visibilidade e regras de acesso.

### Impacto

Fluxos de consulta, permissao e organizacao de dados nao devem assumir relacao simples de um produtor para uma unica propriedade.

---

## 4. A propriedade e a unidade central de contexto dos dados

### Decisao

Mapas, arquivos, visitas e registros devem ser lidos no contexto da propriedade a que pertencem.

### Alcance

Afeta UX, organizacao das telas, estrutura de dados e regras de visibilidade.

### Impacto

O sistema nao deve tratar mapas e materiais tecnicos como elementos soltos, desconectados do produtor e da propriedade. Na implementacao atual, `fazenda_id` continua sendo a chave operacional interna desse contexto.

---

## 5. O MVP prioriza consulta organizada e operacao principal

### Decisao

O MVP atual prioriza o nucleo operacional do produto:

- acesso por perfil
- consulta por produtor e propriedade
- mapas e arquivos
- visitas tecnicas
- caderno de campo enxuto
- uso em contexto de operacao rural

### Alcance

Afeta priorizacao funcional e criterio de corte de escopo.

### Impacto

Expansoes fora desse nucleo nao devem ser tratadas como compromisso automatico do produto nesta etapa.

---

## 6. O produtor consulta dados autorizados, mas nao gerencia a estrutura geral

### Decisao

O produtor deve ser tratado como perfil de consulta da propria realidade operacional, com acesso aos materiais e historicos autorizados, sem assumir responsabilidade principal por gerenciar a estrutura do sistema.

### Alcance

Afeta permissoes, experiencia do usuario e divisao de responsabilidade entre perfis.

### Impacto

Fluxos de manutencao estrutural, ingestao e administracao de dados devem continuar associados a perfis autorizados da equipe.

---

## 7. O colaborador opera dentro de escopo geografico restrito

### Decisao

O colaborador deve atuar dentro de um escopo regional ou sub-regional, sem acesso irrestrito ao conjunto total de dados.

### Alcance

Afeta filtros, regras de acesso, navegacao e visibilidade.

### Impacto

Qualquer proposta que amplie o alcance do colaborador fora do escopo geografico precisa ser tratada como excecao explicitamente definida, nao como comportamento padrao.

---

## 8. Internet instavel e premissa real de uso

### Decisao

O projeto deve considerar operacao em campo com conectividade limitada como premissa real do produto.

### Alcance

Afeta UX, desenho dos fluxos, comunicacao de capacidades e evolucao tecnica.

### Impacto

Capacidades offline devem ser descritas com cautela e em termos reais, priorizando consulta e visualizacao antes de prometer fluxos complexos.

---

## 9. Admin separa Usuarios de Propriedades

### Decisao

O fluxo administrativo deve separar conceitualmente `Usuarios` de `Propriedades`.

`Propriedade` representa a unidade operacional. `Usuario` representa a pessoa que acessa ou sera preparada para acessar o sistema. Produtor, colaborador e admin sao perfis/tipos de usuario.

No MVP atual, essa separacao existe em nivel visual/mockado no modulo `Admin -> Usuarios`. Ela nao cria autenticacao real, senha real, convite, reset de acesso ou sessao.

### Alcance

Afeta a organizacao visual do admin, os mocks de dados e a preparacao para backend/banco futuro.

### Impacto

- dados cadastrais de pessoa devem ficar no cadastro de usuario, nao duplicados dentro da propriedade
- propriedades continuam exibindo `Produtor titular` como vinculo visual/cadastral
- produtor pode estar vinculado a uma ou mais propriedades por relacao mock explicita `usuario_propriedade`
- colaborador pode ter microregioes/sub-regioes e propriedades atribuidas visualmente por relacoes mock
- admin possui visao global e nivel administrativo simples no mock
- campos internos legados como `produtor_id`, `fazenda_id` e nomes tecnicos permanecem quando necessarios para compatibilidade

---

## 10. Status explicito de usuario no mock administrativo

### Decisao

No modulo administrativo de usuarios, o status de usuario deve ser tratado explicitamente como:

- `ativo`
- `inativo`
- `pendente`

O booleano `ativo` permanece apenas como compatibilidade temporaria enquanto partes antigas do app ainda dependem desse shape.

### Alcance

Afeta o mock de usuarios, a listagem, o detalhe, o formulario e as validacoes administrativas.

### Impacto

Produtor pendente pode existir sem propriedade vinculada. Produtor ativo deve ter ao menos uma propriedade vinculada. Colaborador ativo deve ter microregiao/sub-regiao ou propriedade atribuida. Admin nao exige propriedade nem microregiao.

---

## 11. O caderno de campo deve nascer enxuto

### Decisao

O caderno de campo nao deve ser expandido de forma ampla e generica logo no inicio. Ele deve priorizar informacao realmente util ao contexto operacional.

### Alcance

Afeta formulários, escopo funcional e criterio de evolucao do modulo.

### Impacto

Novos campos e comportamentos do caderno devem ser avaliados pelo valor operacional real, e nao apenas por desejo de cobertura total do dominio.

---

## 12. Regiao -> Microregiao -> Propriedade e compatibilidade territorial legada do mock

### Decisao

No MVP visual/mockado existente, a sincronizacao territorial continua
preservando a leitura legada Regiao -> Microregiao -> Propriedade ate uma
migracao controlada.

Essa leitura e suportada pelo helper `territorioCompat`, que deriva regioes e microregioes a partir das propriedades mockadas e preserva compatibilidade com os campos textuais legados `regiao` e `microregiao`.

Essa estrutura nao define mais o modelo territorial canonico. A decisao 23 e
`modelo-territorial.md` separam Municipio/UF de Regional/Area operacional.

### Alcance

Afeta o cadastro administrativo de usuarios, o cadastro de propriedades e o detalhe administrativo da propriedade no MVP visual/mockado.

### Impacto

- Admin pode selecionar visualmente regioes e uma ou mais microregioes
  legadas ao cadastrar/editar Colaborador no mock
- a interface pode exibir previa das propriedades abrangidas pela microregiao
- colaborador pode ter propriedades atribuidas diretamente no mock visual
- produtor pode ter multiplas propriedades vinculadas e receber alerta quando a propriedade ja tiver outro produtor principal no mock
- cadastro de propriedade pode usar selecao de Regiao e Microregiao derivada do mock
- ao selecionar microregiao, a tela pode sugerir colaboradores compativeis
- detalhe da propriedade pode mostrar usuario produtor vinculado e colaboradores sugeridos/relacionados ao territorio
- vinculos visuais de colaborador nao alteram o motor efetivo de permissoes nesta fase
- Colaborador nao pode autoeditar esses campos no proprio Perfil
- `produtor_id`, `proprietario_id`, `sub_regioes`, `propriedades_atribuidas`, `regiao`, `microregiao`, `fazenda_id` e `acessoControle` permanecem preservados por compatibilidade

Ficam fora desta decisao nesta fase: backend, banco, migrations, API real, autenticacao real, senha, convite, reset, RBAC completo, upload/storage, Drive, CRUD real de regioes/microregioes e migracao do `acessoControle`.

---

## 13. Cadastro rapido de propriedade no cadastro de usuario produtor

### Decisao

No MVP visual/mockado, o fluxo `Admin -> Usuarios -> Novo Usuario -> Perfil Produtor` pode criar uma propriedade rapida quando a propriedade do produtor ainda nao existir.

O admin pode escolher entre:

- vincular o usuario produtor a uma propriedade existente
- cadastrar uma nova propriedade rapida no mesmo fluxo

### Alcance

Afeta o cadastro administrativo de usuario produtor, o mock de propriedades e a relacao visual `usuario_propriedade`.

### Impacto

- o cadastro rapido inclui nome da propriedade, municipio, UF/Estado, regiao, micro-regiao, area total, status, tipo de vinculo, vinculo principal e observacoes
- Regiao e Microregiao usam `territorioCompat` quando houver dados disponiveis, com fallback textual
- ao escolher micro-regiao, a interface pode sugerir colaboradores apenas visualmente
- ao salvar, o mock cria a propriedade via `Produtor.create`
- ao salvar, o mock vincula a propriedade criada ao usuario produtor via `usuario_propriedade`
- campos legados como `produtor_id`, `proprietario_id`, `regiao`, `microregiao` e `fazenda_id` permanecem preservados
- produtor ativo exige propriedade existente ou cadastro rapido valido
- produtor pendente sem propriedade continua permitido
- o fluxo prepara uma criacao combinada futura de `usuario` + `propriedade` + `usuario_propriedade`

Risco assumido no mock:

- como nao ha transacao no mock, pode haver inconsistencia se uma etapa do salvamento falhar depois da criacao da propriedade
- no backend futuro, esse fluxo deve ser transacional

Ficam fora desta decisao nesta fase: backend, banco real, API, migrations, autenticacao real, senha, convite, reset, RBAC completo, upload/storage, Drive, CRUD real de regioes/microregioes e migracao do `acessoControle`.

---

## 14. Mapas e limites formam uma experiencia unica de panorama no MVP

### Decisao

No MVP, o usuario nao deve navegar por duas experiencias concorrentes de `Mapas` e `Limite` quando o objetivo pratico for visualizar o panorama da propriedade. A interface deve apresentar uma experiencia unica de panorama/mapa da propriedade.

### Alcance

Afeta a UX de mapas, a leitura da entidade `LimiteArea` e a estrategia de ingestao de arquivos geoespaciais.

### Impacto

- `LimiteArea` permanece como camada tecnica de demarcacao dos talhoes, vinculada a `fazenda_id` enquanto essa for a chave interna do contexto de propriedade.
- A tela de mapas deve tratar a demarcacao como base do panorama, e nao como uma aba funcional separada.
- Materiais tecnicos, PDFs, imagens e arquivos associados continuam existindo como biblioteca de materiais no contexto da propriedade.
- Para novos anexos do MVP local, materiais tecnicos devem ser organizados por
  `Propriedade -> Ano -> Categoria`, preservando `fazenda_id` como alias
  tecnico enquanto houver compatibilidade.
- O foco inicial dos materiais liberaveis deve ser mapas de diagnostico, especialmente fertilidade por elemento/camada, como argila, fosforo, pH, potassio e materia organica.
- A taxonomia operacional da biblioteca de mapas possui tres categorias
  principais: Fertilidade, Correcao de solo e Prescricao. Os filtros principais
  de materiais tecnicos devem ficar restritos a essas tres categorias.
- O fluxo principal para novos anexos e unificado e aceita PNG, PDF ou ZIP. O
  nome original e preservado, o titulo e gerado automaticamente e o ano e
  obrigatorio. Safra/Safrinha e referencia opcional a periodo produtivo da
  mesma Propriedade.
- Fertilidade registra profundidade no escopo da Propriedade; Correcao registra
  profundidade e escolhe Propriedade inteira ou Talhao; Prescricao nao exige
  profundidade, camada ou Talhao no corte atual. `Nao informada` e uma opcao
  explicita quando a profundidade nao estiver comprovada.
- No MVP atual, o mapa interativo e apenas a base de talhoes/limites. Mapas de elementos, como PNGs de fertilidade, devem ser tratados como anexos visuais da biblioteca de materiais.
- PNGs de elementos nao devem ser sobrepostos ao mapa interativo nesta etapa. A experiencia esperada e abrir o PNG como imagem/anexo para consulta.
- PDF e ZIP devem ser catalogados por metadados e nome original. O MVP nao
  afirma visualizador PDF, preview de ZIP, unzip, leitura de bytes ou
  processamento desses formatos.
- O arquivo fisico local fica no storage interno do aplicativo e o
  `AsyncStorage` guarda somente o indice de metadados. Registros PNG/ZIP
  anteriores continuam legiveis, sem copia ou duplicacao automatica no indice
  unificado.
- A consulta local no mesmo aparelho pode funcionar sem conexao, mas nao
  representa sync, download remoto, restauracao entre aparelhos ou offline
  total.
- Arquivos tecnicos operacionais disponiveis no acervo, como sementes ou linhas de plantio, podem ser anexados e liberados quando fizerem sentido para a propriedade, mas nao devem virar uma experiencia separada da biblioteca de materiais da propriedade.
- O app deve consumir um arquivo final normalizado, preferencialmente GeoJSON ou JSON equivalente, em vez de carregar no celular o pacote bruto de arquivos `.shp`, `.shx`, `.dbf`, `.prj`, `.kml`, `.kmz` ou metadados auxiliares.
- Para acelerar o MVP, a validacao local pode usar um conversor de desenvolvimento que gera o arquivo final a partir dos originais, mas a conversao produtiva futura deve acontecer fora do app, em backend ou processo operacional controlado.
- Para SHP, nomes de talhoes devem ser obtidos dos campos do `.dbf`; para KML/KMZ, dos elementos `<name>`; para GeoJSON pronto, das `properties`.
- Cada importacao real deve registrar manifesto com campos encontrados, campo de nome usado, quantidade de talhoes, quantidade de poligonos/partes e status de revisao.
- O fluxo real deve ter pre-visualizacao e aprovacao por equipe autorizada antes de publicar o GeoJSON/JSON final no app ou backend.

---

## Marco Da Fase 17H.0.2

As decisoes 15 a 21 abaixo consolidam o fechamento funcional do baseline
anterior a novas evidencias e a qualquer implementacao de coordenadas,
marcacoes ou fotos reais.

- `DECISOES_CONSOLIDADAS_PARA_FECHAMENTO_DO_BASELINE`
- `DESENVOLVIMENTO_EM_EMULADOR_AUTORIZADO`
- `CAMPO_BLOQUEADO_ATE_ANDROID_FISICO`

Esses marcadores nao aprovam Android fisico nem uso de campo. Eles separam
explicitamente decisao, implementacao, validacao em emulador, validacao em
Android fisico e aptidao para campo.

---

## 15. Desenvolvimento pode continuar em emulador, mas campo exige Android fisico

### Decisao

Desenvolvimento, testes automatizados e smoke tecnico podem continuar em
emulador. A aprovacao para campo permanece bloqueada ate existir Android
fisico autorizado e o roteiro aplicavel ter sido executado com evidencia.

### Alcance

Afeta planejamento de fases, linguagem de status, criterio de pronto e
aprovacao de APK para uso operacional.

### Impacto

- `implementado` descreve existencia no codigo;
- `validado em emulador` descreve evidencia tecnica no ambiente virtual;
- `validado em Android fisico` exige aparelho autorizado e evidencia propria;
- `apto para campo` exige Android fisico e fechamento dos bloqueios funcionais
  aplicaveis;
- nenhuma evidencia de emulador pode ser promovida automaticamente a aprovacao
  de campo;
- Android fisico continua pendente e nao aprovado na Fase 17H.0.2.

---

## 16. O primeiro ponto persistido sera metadado opcional do Caderno

### Decisao

No primeiro corte futuro, o ponto geografico persistido deve fazer parte do
proprio registro do Caderno como metadado opcional. Nao sera criada a chave
`@tche:field-markers:v1` nesse corte.

A coordenada somente podera persistir depois de acao explicita do usuario e do
submit bem-sucedido do Caderno. `Mostrar minha posicao`, abrir mapa, Talhao ou
Caderno nunca salva coordenada. Cancelar o formulario nunca persiste. Remover
a localizacao antes de salvar produz Caderno sem localizacao.

### Alcance

Afeta a futura implementacao do Caderno, consentimento, compatibilidade de
registros e testes de persistencia. Nao altera o contrato atual nesta fase.

### Impacto

- registros antigos continuam validos sem localizacao;
- criar Caderno sem localizacao continua sendo o fluxo normal;
- os campos finais permanecem opcionais e devem ser especificados na fase de
  implementacao sem quebrar registros antigos;
- nao existe persistencia automatica ou implicita;
- nao havera background, tracking, trilha, rota, historico de posicoes,
  geofencing, watch continuo ou ultimo ponto separado;
- PNG e ZIP permanecem sem marcador e sem georreferenciamento;
- nenhuma coordenada foi salva e nenhuma chave foi criada na 17H.0.2.

---

## 17. A futura marcacao reutilizara as permissoes atuais do Caderno

### Decisao

A futura marcacao nao criara RBAC novo. Ela reutilizara a regra atual do
Caderno e o contexto operacional de Propriedade/Talhao.

### Alcance

Afeta criacao, consulta e edicao futura de Caderno com ponto no MVP
local/mockado.

### Impacto

- Produtor podera registrar ponto em Caderno da propria Propriedade/Talhao;
- Produtor continuara sem editar ou remover registro;
- Colaborador podera registrar e editar dentro do escopo atual;
- Admin seguira com acesso global local/mockado;
- nenhuma permissao desta decisao substitui validacao futura por acao,
  Propriedade e perfil;
- backend/RBAC real permanece fora do escopo desta fase.

---

## 18. Area total informada, area mapeada e perimetro sao conceitos distintos

### Decisao

`area_total` da Propriedade deve ser apresentada como `Area total informada`.
A soma das areas disponiveis dos Talhoes deve ser apresentada como
`Area mapeada`. Ausencia de area deve ser apresentada como `Nao informado`,
sem conversao para zero e sem chamar area mapeada de area total.

Perimetro somente pode aparecer quando houver valor e origem comprovados. Para
a Sela de Prata I, nao se deve afirmar `Perimetro processado` no estado atual.

### Alcance

Afeta linguagem de UI, helpers de apresentacao, testes e futura proveniencia
das medidas. Nao autoriza correcao funcional nesta fase.

### Impacto

- 6200 ha permanecem como area total informada da Propriedade;
- 1888,6 ha permanecem como soma mapeada da amostra processada;
- nenhum dos valores pode ser alterado ou equiparado por inferencia;
- a relacao de cobertura entre os valores continua pendente de comprovacao;
- a correcao da UI que hoje pode exibir `0 ha total` permanece em microfase
  propria.

---

## 19. Fotos simuladas nao representam captura real

### Decisao

As acoes atuais de Camera/Galeria que geram URLs `picsum.photos` sao
simulacoes e nao podem ser apresentadas como captura real. Em microfase
posterior, essas acoes ativas devem ser removidas ou desativadas, preservando a
leitura das fotos mockadas ja existentes.

### Alcance

Afeta linguagem de produto, preparacao do APK de campo e futura segregacao dos
placeholders. Nao implementa camera nem foto nesta fase.

### Impacto

- foto real e foto georreferenciada continuam fora do escopo ate fase propria;
- nenhuma permissao, dependencia, storage ou contrato de foto e criado agora;
- os registros demonstrativos existentes continuam consultaveis;
- a segregacao dos botoes simulados permanece trabalho funcional pendente.

---

## 20. O celular consome mapas preparados e nao executa processamento produtivo

### Decisao

O celular nao gera mapas. O MVP atual consome arquivos previamente preparados
ou importados localmente. Nao existe servidor produtivo, publicacao, sync ou
download real no produto atual.

### Alcance

Afeta comunicacao da capacidade atual, arquitetura futura e criterio de
prontidao dos servicos/stubs existentes.

### Impacto

- GeoJSON, PNG e ZIP locais permanecem no corte demonstrativo atual;
- stubs, endpoints simulados e helpers nao podem ser descritos como backend
  funcional;
- processamento externo, storage, revisao, publicacao, permissao, historico,
  sync e download reais permanecem na trilha futura de backend.

---

## 21. Alinhamento Expo deve ocorrer em fase tecnica isolada

### Decisao

`expo` e `expo-location` devem ser alinhados somente em fase tecnica isolada,
sem misturar atualizacao de dependencia com correcao funcional. Nao se deve
usar `npm audit fix` para realizar esse alinhamento.

### Alcance

Afeta planejamento tecnico, validacao de build e rastreabilidade de regressao.

### Impacto

- a divergencia atual permanece registrada como pendencia tecnica;
- nenhuma dependencia e alterada na Fase 17H.0.2;
- a fase de alinhamento deve executar sua propria matriz de typecheck, testes,
  build e smoke;
- correcoes de area, fotos simuladas, Caderno ou marcacoes devem permanecer em
  microfases separadas.

---

## 22. Sessao produtiva deve expirar, revalidar e bloquear retomada insegura

### Decisao

A politica canonica fica em `politica-sessao.md`.

O primeiro corte produtivo deve usar access token de 15 minutos, refresh token
rotativo com validade absoluta de 30 dias, bloqueio local depois de 15 minutos
de inatividade/background e janela maxima de consulta offline de 24 horas
desde a ultima revalidacao.

Perfil, status, organizacao e escopo devem ser revalidados na renovacao, na
reconexao e antes de liberar sessao restaurada quando houver rede. Logout deve
bloquear e limpar a sessao local imediatamente e revogar a sessao remota
quando possivel.

### Alcance

Afeta autenticacao futura, backend, storage seguro, ciclo de vida do app,
reconexao, cache por usuario, logout, troca de usuario, rotas diretas e testes
dos tres perfis.

### Impacto

- `@tche:user` continua sendo somente persistencia demonstrativa do mock;
- token e segredo nao podem ficar em `AsyncStorage`;
- consulta offline fica limitada ao ultimo escopo autorizado e, ate contrato
  proprio por fluxo, e somente leitura;
- PIN/biometria podem destravar sessao ainda valida, mas nao substituem
  credencial, token ou revalidacao;
- rota direta e notificacao continuam sujeitas a autorizacao no servidor;
- a decisao nao implementa seguranca produtiva e depende de `MP-33`.

---

## 23. Localizacao oficial e escopo operacional sao dimensoes distintas

### Decisao

O contrato canonico fica em `modelo-territorial.md`.

- UF e Municipio representam localizacao oficial, com codigos estaveis do
  IBGE.
- Regional e Area operacional representam o escopo de trabalho da
  organizacao, com IDs proprios.
- Municipio/UF nao concedem acesso.
- Vinculos operacionais sao atribuidos administrativamente e nao podem ser
  autoeditados pelo Colaborador.
- Alteracao futura exige autorizacao, justificativa, auditoria e revalidacao
  da sessao/escopo.

### Alcance

Afeta cadastro de Propriedade, administracao de usuarios, Perfil do
Colaborador, motor futuro de acesso, filtros, sessao, auditoria e migracao dos
campos territoriais legados.

### Impacto

- `regiao`, `microregiao`, `sub_regioes` e `vinculos_microregioes` continuam
  legados temporarios e nao provam classificacao canonica;
- `territorioCompat` continua apenas como compatibilidade visual do mock;
- a edicao livre de `regiao` deve sair do Perfil do Colaborador;
- payload de autoedicao territorial deve ser recusado localmente;
- o motor efetivo atual nao muda nesta tarefa;
- backend, vinculos reais, auditoria e migracao permanecem em `MP-35`.

---

## 24. Notificacao e entrega individual, escopada e reautorizada

### Decisao

O contrato canonico fica em `contrato-notificacoes.md`.

- evento de dominio e entrega ao destinatario sao registros distintos;
- cada entrega pertence a um usuario e organizacao;
- recurso operacional referencia tipo, ID e Propriedade;
- leitura, descarte e deduplicacao persistem por destinatario;
- o cliente deriva a rota por allowlist e nao confia em rota recebida;
- o servidor revalida sessao, destinatario, organizacao, escopo e recurso antes
  da abertura;
- troca de usuario limpa imediatamente o estado da identidade anterior.

### Alcance

Afeta backend futuro, contexto de notificacoes, contador, cache, logout, troca
de usuario, deep links, push, navegacao e guards dos recursos.

### Impacto

- a lista global de `NotificacaoContext` continua somente demonstrativa;
- marcar como lida nao autoriza nem abre um recurso;
- notificacao de outro destinatario ou fora do escopo nao pode ser consultada;
- o contrato nao cria persistencia ou seguranca no front-end;
- implementacao, isolamento real e testes negativos permanecem em `MP-34`.

---

## 25. Caderno enviado e registro imutavel com evolucao por eventos

### Decisao

O contrato canonico fica em `ciclo-vida-caderno.md`.

- rascunho e editavel somente pelo criador;
- envio consolida o snapshot original e nao permite retorno ao rascunho;
- complemento, correcao e visibilidade sao eventos append-only;
- correcao exige permissao, motivo, antes/depois e versao base;
- Propriedade, autoria, origem e datas do envio nunca sao reatribuidas;
- arquivamento e anulacao preservam registro e historico;
- concorrencia nao usa `last write wins`.

### Alcance

Afeta Novo Caderno, edicao, detalhe, listagens, autoria, localizacao,
visibilidade, offline, sincronizacao, backend e auditoria dos tres perfis.

### Impacto

- `CadernoCampo.update` aceita apenas rascunho proprio na borda compativel e
  recusa sobrescrita de registro consolidado;
- registro legado e lido como consolidado protegido, sem inventar historico;
- Produtor nao altera registro enviado;
- Admin/Colaborador usam comandos excepcionais, nao edicao destrutiva;
- campos obrigatorios por tipo e comandos locais foram implementados em
  `MP-25`;
- persistencia append-only, concorrencia, autorizacao e auditoria produtivas
  permanecem em `MP-36`.

---

## 26. Visita usa maquina de estados e comandos auditados

### Decisao

O contrato canonico fica em `estados-visita.md`.

- Visita pode nascer `agendada` ou ser registrada diretamente como
  `realizada` pelo fluxo de conclusao;
- `agendada` pode ser reagendada, concluida ou cancelada;
- `realizada` nao regride e somente recebe complemento, correcao ou anulacao;
- `cancelada` e terminal e pode originar nova Visita vinculada;
- atraso e indicador derivado, nao estado persistido;
- conclusao e cancelamento exigem formularios proprios;
- toda transicao valida estado, versao, permissao e escopo.

### Alcance

Afeta Nova Visita, edicao, detalhe, listagem, historico, offline, notificacoes,
backend e regras de acesso dos tres perfis.

### Impacto

- seletor livre de status e updates diretos atuais continuam limitacao do mock;
- Visita realizada/cancelada nao abre edicao geral;
- Admin nao exclui fisicamente Visita persistida;
- registros legados sao preservados sem historico inventado;
- implementacao permanece em `MP-27`;
- organizacao visual das listas permanece em `MP-22`.

---

## 27. GeoJSON usa versoes imutaveis e Talhao possui identidade logica

### Decisao

O contrato canonico fica em `versionamento-geojson-talhoes.md`.

- `talhao_id` e estavel e separado do nome, codigo e geometria;
- cada GeoJSON recebido cria importacao imutavel e auditavel;
- geometria possui versao e vigencia proprias;
- rascunho e revisao nao substituem a camada publicada;
- publicacao exige reconciliacao e permissao explicita;
- versao publicada anterior e arquivada, nunca apagada automaticamente;
- renome mantem identidade;
- divisao e fusao criam sucessores e preservam linhagem;
- modulos operacionais usam `talhao_id` e, quando necessario,
  `talhao_geometria_versao_id`;
- migracao textual preserva snapshots e nao inventa correspondencias.

### Alcance

Afeta Talhoes, mapas, importacao GeoJSON, Caderno, Visitas, Safra/Safrinha,
Materiais, localizacao, backend, storage, cache offline, auditoria e migracao.

### Impacto

- o fluxo local de um GeoJSON `ativo` continua demonstrativo e incompativel
  com o contrato produtivo;
- IDs derivados de indice/nome nao podem ser tratados como identidade;
- substituir/remover localmente ainda pode apagar arquivo ate `MP-37`;
- Colaborador prepara e reconcilia; publicacao fica com Admin ou papel tecnico
  explicito no primeiro contrato;
- implementacao produtiva permanece em `MP-37`;
- IDs selecionaveis dependem de `MP-24` e a regressao historica de `MP-39`.

---

## 28. Localizacao do Caderno usa apresentacao simples e avaliacao espacial versionada

### Decisao

Quando o Caderno possuir ponto valido e Talhao com geometria local resolvida,
o app avalia e preserva no proprio registro a relacao `dentro`, `proximo` ou
`fora`. Ponto interno ou sobre o limite e `dentro`; ponto externo e `proximo`
quando sua distancia ao limite nao supera a soma da precisao informada com a
tolerancia local de 15 m; os demais casos sao `fora`.

A avaliacao preserva `talhao_geometria_versao_id`, fonte, ano quando
disponivel, distancia calculada e tolerancia aplicada. Ela nao cria identidade
por nome: sem `talhao_id` compativel ou geometria valida, o registro permanece
sem avaliacao espacial e a interface informa essa ausencia.

### Alcance

Afeta criacao e envio de rascunho, detalhe do Caderno, mini mapa, rota `Ver no
mapa`, projecao do Produtor, compatibilidade local e snapshot original do
registro consolidado.

### Impacto

- o mini mapa prioriza marcador, limite do Talhao e circulo de precisao;
- baixa precisao continua visivel no detalhe depois do salvamento;
- Produtor ve o mapa, a precisao e a relacao operacional, mas nao recebe IDs,
  distancia/tolerancia nem coordenadas brutas como bloco principal;
- coordenadas, autoria da captura e metadados da geometria ficam recolhidos em
  `Detalhes tecnicos` para equipe autorizada;
- `Ver no mapa` reutiliza a rota protegida da Propriedade e nao amplia acesso;
- registros antigos sem avaliacao continuam validos e nao recebem relacao
  espacial inventada retroativamente;
- validacao do provider e dos cenarios reais dentro/fora em campo permanece em
  `MP-38`; versionamento produtivo da geometria permanece em `MP-37`.
