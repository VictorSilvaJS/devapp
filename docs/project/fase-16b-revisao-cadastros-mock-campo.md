# Fase 16B - Revisao De Cadastros E Mock Realista Para APK De Campo

Status em 2026-06-04: fase iniciada com diagnostico documental dos formularios,
dos dados demonstrativos e da preparacao minima para persistencia local.

Esta abertura nao altera telas, mocks, contratos, rotas, permissoes ou
persistencia. A implementacao deve ocorrer em blocos pequenos, preservando
`fazenda_id`/`fazendaId` e o comportamento validado na Fase 16A.

## Objetivo

Preparar uma base demonstrativa coerente para o APK de campo, com:

- formularios de Propriedade e Usuario compreensiveis;
- pacote mock principal coerente entre Propriedade, perfis, mapas, visitas e
  caderno;
- dados pessoais ficticios ou autorizados;
- materiais tecnicos apresentados de forma simples;
- caminho preparado para persistencia local futura, sem implementar backend,
  login real, RBAC real, upload remoto ou sincronizacao.

## Documentos E Codigo Considerados

Base ativa principal:

- `docs/project/estado-atual.md`
- `docs/project/escopo-mvp.md`
- `docs/project/regras-de-negocio.md`
- `docs/project/decisoes-consolidadas.md`
- `docs/project/pendencias-de-definicao.md`
- `docs/project/matriz-cadastros-mvp.md`
- `docs/project/fase-16a-apk-demonstravel.md`
- `docs/project/escopo-teste-campo-2026-06-05.md`
- `docs/project/smoke.md`

Codigo analisado:

- `src/api/mock.ts`
- `src/auth/authMock.ts`
- `src/api/validators.ts`
- `src/api/mockCompat.ts`
- `src/api/produtorCompat.ts`
- `src/utils/fazendaCadastroCompat.ts`
- `src/utils/usuarioAdminCompat.ts`
- `src/screens/NovaPropriedadeScreen.tsx`
- `src/screens/EditarPropriedadeScreen.tsx`
- `src/screens/NovoUsuarioScreen.tsx`
- `src/screens/UsuarioDetailScreen.tsx`
- `src/screens/MapasScreen.tsx`
- `src/screens/FazendaMapaScreen.tsx`

## Limites Da Fase

Ficam fora da Fase 16B:

- retomar refatoracao tecnica da Fase 15;
- remover ou substituir `fazenda_id`/`fazendaId`;
- migrar contratos para `propriedade_id`;
- implementar backend, banco, API ou migrations;
- implementar login, convite, reset ou sessao real;
- implementar RBAC real;
- implementar upload remoto, storage remoto ou Drive;
- implementar sincronizacao;
- tratar o cadastro administrativo como fonte oficial de dados.

## Diagnostico Executivo

O nucleo dos formularios e utilizavel, mas o pacote demonstrativo ainda nao
esta coerente o suficiente para ser apresentado como uma historia unica de
campo.

Principais achados:

1. Nova Propriedade possui um conjunto de campos adequado ao contexto rural,
   mas ainda permite criar um novo Titular minimo dentro do cadastro. Isso
   mistura Propriedade e pessoa e nao cria Usuario/login real.
2. Editar Propriedade preserva Titular, Regiao e Microregiao corretamente, mas
   nao permite revisar status nem deixa explicito se a area e total ou apenas
   mapeada.
3. Novo Usuario esta completo para preparacao administrativa, mas e complexo
   demais para ser fluxo principal em campo. Ele combina pessoa, perfil,
   vinculos, escopo territorial e cadastro rapido de Propriedade.
4. Usuario Detail explica bem os vinculos mockados, mas ainda exibe dados
   pessoais que devem ser ficticios ou autorizados.
5. MapasScreen prioriza consulta, mas ainda expoe uma acao interna de
   associacao de referencia com URL, formato, tamanho e origem. Esse fluxo e
   tecnico demais para o APK de campo.
6. FazendaMapaScreen esta adequada ao teste de campo como consulta de talhoes e
   preserva acesso por Propriedade. Nao deve receber ampliacao funcional nesta
   fase.
7. A Sela de Prata I possui mapa de talhoes e cinco anexos de fertilidade, mas
   nao possui visitas nem caderno vinculados a `p_sela1`.
8. A Sela de Prata I usa o nome da propria Propriedade como nome do Usuario
   produtor e como Titular. Isso evita expor uma pessoa real, mas confunde os
   conceitos na demonstracao.
9. A Propriedade informa `6200 ha`, enquanto o manifesto da demarcacao informa
   `1888,6 ha` somados nos 15 talhoes. Os valores podem representar area total
   e area mapeada, mas essa diferenca nao esta explicada nem confirmada.
10. Usuarios, visitas e caderno usam nomes, contatos, enderecos e fotos
    externas com aparencia real. Mesmo quando ficticios, eles elevam risco de
    confusao e LGPD.
11. Visitas e caderno usam datas relativas a `Date.now()`. O cenario muda a
    cada abertura e pode perder coerencia entre rodada, evidencia e conversa
    com o tester.
12. CRUD de Usuario, Propriedade, Visita, Caderno e Mapa altera apenas arrays
    em memoria. A sessao de autenticacao e o cache de mapas possuem trilhas
    locais separadas, mas os cadastros demonstrativos ainda se perdem ao
    reiniciar/recarregar o app.

## Diagnostico Dos Formularios

### Nova Propriedade

Estado atual correto:

- separa visualmente dados da Propriedade, Titular, dados produtivos e
  localizacao;
- exige nome da Propriedade e area valida;
- exige Titular existente ou novo Titular minimo;
- exige Regiao e Microregiao;
- permite cidade, UF e cultura principal;
- preserva escopo territorial do Colaborador;
- salva por `Produtor.create` mantendo contratos legados.

Riscos:

- `Novo Titular` cria apenas identificador e nome mockados, sem Usuario/login;
- `status` e obrigatorio no registro, mas fica implicitamente como `ativo`;
- area nao diferencia `area_total` de area mapeada;
- Cidade/UF sao mais reconheciveis em campo do que Regiao/Microregiao, mas
  permanecem opcionais;
- o formulario pode parecer cadastro oficial apesar de ser apenas mock.

Recomendacao para o APK:

- manter o fluxo principal com Titular existente;
- deixar `Novo Titular` fora do fluxo principal da demonstracao;
- manter nome, Titular, area, Regiao e Microregiao como dados minimos do
  registro;
- manter status obrigatorio no registro, com valor padrao `ativo`, sem exigir
  interacao no campo;
- manter cidade, UF e cultura principal como opcionais recomendados;
- comunicar quando a area exibida for area total, area mapeada ou valor de
  demonstracao.

### Editar Propriedade

Estado atual correto:

- permite editar nome, area, cultura, cidade e UF;
- preserva Titular, Regiao e Microregiao;
- impede troca acidental de contexto e mantem contratos legados;
- valida permissao antes de editar.

Riscos:

- area pode ser alterada sem explicar sua semantica;
- status nao pode ser revisado na tela;
- Regiao/Microregiao sao apenas preservadas, sem caminho de correcao no mock;
- o formulario nao persiste apos reinicio do app.

Recomendacao para o APK:

- manter o conjunto atual de campos editaveis;
- nao liberar troca de Titular ou territorio nesta fase;
- explicar area como `Area total informada` ate existir distincao formal;
- tratar alteracoes como teste de UX, nao como cadastro oficial.

### Novo E Editar Usuario

Estado atual correto:

- separa dados do Usuario e perfil de acesso;
- exige nome, e-mail, perfil e status;
- permite telefone, documento e observacoes;
- diferencia Produtor, Colaborador e Administrador;
- aplica regras mockadas de vinculo para perfis ativos;
- deixa claro que nao cria autenticacao real;
- permite vinculos visuais com Propriedade e Microregiao.

Riscos:

- o fluxo e longo e nao deve ser atividade principal do teste de campo;
- Documento e telefone aumentam risco de uso de dado pessoal sem necessidade;
- e-mail e obrigatorio mesmo sem criacao de login real;
- o cadastro rapido de Propriedade mistura duas entidades e nao e transacional;
- `propriedades_atribuidas` pode ser confundido com permissao real;
- `senha: mock123` e adicionada internamente ao Usuario administrativo, apesar
  de esse Usuario nao autenticar em `authMock`;
- `src/api/mock.ts` e `src/auth/authMock.ts` mantem listas separadas de
  usuarios, permitindo divergencia entre cadastro visual e login demonstrativo.

Recomendacao para o APK:

- manter Novo Usuario apenas para demonstracao assistida do Admin;
- manter nome, e-mail, perfil e status conforme a matriz ativa;
- usar somente e-mails ficticios e claramente demonstrativos;
- deixar telefone, documento e observacoes opcionais;
- preferir telefone e documento vazios no seed de demonstracao;
- manter vinculos por perfil, mas explicar que sao mockados;
- nao usar cadastro rapido de Propriedade durante o fluxo principal de campo.

### Usuario Detail

Estado atual correto:

- mostra perfil, status e vinculos com linguagem compreensivel;
- explica que Propriedades atribuidas ao Colaborador nao sao RBAC final;
- diferencia vinculos de Produtor, escopo do Colaborador e dados do
  Administrador.

Riscos:

- pode expor telefone, documento e e-mail com aparencia real;
- o bloco de Propriedades atribuidas continua sujeito a interpretacao como
  permissao efetiva;
- o Usuario produtor da Sela de Prata I aparece com nome de Propriedade.

Recomendacao para o APK:

- usar dados pessoais ficticios ou vazios;
- manter explicacao de mock/RBAC;
- corrigir o seed para separar nome do Usuario/Titular e nome da Propriedade.

## Proposta De Campos Finais Para O APK

As classificacoes abaixo distinguem obrigatoriedade do registro de
obrigatoriedade de digitacao. Campos internos de compatibilidade continuam
preservados.

### Propriedade

| Campo visivel | Classificacao no APK | Observacao |
|---|---|---|
| Nome da Propriedade | Obrigatorio | Identificacao principal de campo |
| Titular | Obrigatorio no registro | Preferir selecao de Titular existente |
| Area total informada | Obrigatorio | Confirmar se representa total ou area mapeada |
| Regiao | Obrigatorio no registro | Necessario ao escopo territorial atual |
| Microregiao | Obrigatorio no registro | Necessario ao escopo territorial atual |
| Status | Obrigatorio no registro, padrao `ativo` | Pode ficar implicito no fluxo de campo |
| Municipio | Opcional recomendado | Facilita reconhecimento em campo |
| UF | Opcional recomendado | Validar duas letras quando informado |
| Cultura principal/atual | Opcional | Dado temporal, nao identidade fixa |
| Observacoes | Opcional futuro/local | Nao existe no formulario principal atual |
| `fazenda_id`/`fazendaId` | Interno obrigatorio | Preservar sem migracao |
| `propriedade_id` | Alias mock/preparatorio | Nao substituir contrato atual |

### Usuario

| Campo visivel | Classificacao no APK | Observacao |
|---|---|---|
| Nome | Obrigatorio | Usar persona ficticia ou autorizada |
| E-mail | Obrigatorio conforme matriz ativa | Usar endereco demonstrativo; nao cria login real |
| Perfil | Obrigatorio | Produtor, Colaborador ou Administrador |
| Status | Obrigatorio | Ativo, inativo ou pendente |
| Telefone | Opcional | Preferir vazio no seed demonstrativo |
| Documento | Opcional e desaconselhado no APK | Nao usar CPF/CNPJ real sem necessidade/autorizacao |
| Observacoes | Opcional | Somente texto sem dado sensivel |
| Senha | Apenas mock interno | Nao exibir nem tratar como credencial real |
| Nivel administrativo | Apenas mock/preparatorio | Sem efeito de RBAC real |

### Vinculos Por Perfil

| Perfil | Obrigatorio no APK mockado | Opcional/mock |
|---|---|---|
| Produtor ativo | Ao menos uma Propriedade vinculada | Tipo de vinculo e principal |
| Produtor pendente | Pode ficar sem Propriedade | Preparacao para vinculo futuro |
| Colaborador ativo | Microregiao/sub-regiao ou Propriedade atribuida | Propriedade atribuida nao altera acesso efetivo |
| Administrador | Nenhum vinculo territorial obrigatorio | Nivel administrativo simples |

### Mapas E Arquivos Tecnicos

Superficie recomendada para o APK:

| Campo visivel | Classificacao no APK | Observacao |
|---|---|---|
| Titulo | Obrigatorio | Nome livre e compreensivel |
| Descricao | Opcional | Texto livre curto |
| Propriedade | Obrigatorio no registro | Travada pelo contexto atual |
| Talhao | Opcional | Informar somente quando confirmado |
| Safra/ano | Opcional recomendado | Informar quando conhecido |
| Tipo/categoria | Mock interno com padrao | Nao exigir taxonomia complexa no campo |
| URL, formato, tamanho, origem | Interno/mock | Nao expor no fluxo principal |
| Arquivo local/asset | Preparado previamente | Sem upload remoto nesta fase |

Simplificacao recomendada:

- usar o nome visual `Mapas/Arquivos tecnicos`;
- priorizar consulta dos materiais preparados;
- ocultar do APK de campo a acao `Mock interno: associar referencia`;
- caso a acao interna seja mantida para Admin, mostrar apenas `Titulo` e
  `Descricao`, preservando os demais metadados internamente;
- nao prometer upload, download, storage ou publicacao.

## Diagnostico Do Mock Demonstrativo

### Sela De Prata I

| Item | Estado atual | Diagnostico |
|---|---|---|
| Identificador | `p_sela1` em mapa, limites e anexos | Coerente; preservar `fazenda_id` |
| Nome da Propriedade | `Fazenda Sela de Prata I` | Coerente se o uso estiver autorizado |
| Usuario produtor | Nome igual ao da Propriedade | Inadequado para explicar Usuario/Produtor |
| Titular | Nome igual ao da Propriedade | Ambiguo; precisa de persona ficticia ou dado autorizado |
| Area | `6200 ha` no cadastro | Nao confirmada contra os `1888,6 ha` mapeados |
| Demarcacao | 15 talhoes e 37 poligonos | Coerente para amostra mock aprovada |
| Anexos | Cinco PNGs de fertilidade, profundidade `10-20 cm` | Bom conjunto de consulta demonstrativa |
| Visitas | Nenhuma vinculada a `p_sela1` | Nao atende a historia principal do teste |
| Caderno | Nenhum vinculado a `p_sela1` | Nao atende a historia principal do teste |
| Colaborador | Acesso por `MT - Norte` via usuario mock | Tecnicamente coerente, mas deve ser explicado como escopo regional |
| Localizacao | Municipio, UF, endereco e coordenadas reais/parciais | Exige autorizacao e minimizacao |

Decisao segura nesta abertura:

- nao alterar `6200 ha` para `1888,6 ha` sem confirmar se o primeiro valor e
  area total e o segundo e area mapeada;
- nao inserir nome de Titular real sem autorizacao;
- registrar a falta de visitas/caderno como prioridade de mock demonstrativo.

### Usuarios Mockados

O mock possui cobertura funcional suficiente, mas excesso de personas e dados
com aparencia real para uma demonstracao de campo.

Pacote minimo recomendado:

1. `Admin Demonstracao`: visao global, sem telefone/documento.
2. `Colaborador de Campo`: escopo `Mato Grosso` / `MT - Norte`, permitindo
   operar a Sela de Prata I.
3. `Produtor Demonstracao`: vinculado a `p_sela1`, com nome diferente da
   Propriedade.

Recomendacoes:

- manter somente essas tres personas como credenciais principais divulgadas;
- usar e-mails demonstrativos em dominio reservado/controlado;
- manter contatos pessoais vazios;
- alinhar manualmente `src/api/mock.ts` e `src/auth/authMock.ts` no primeiro
  bloco de implementacao;
- nao fazer o Usuario criado no Admin autenticar nesta fase.

### Vinculos Produtor, Colaborador E Admin

Os vinculos estao tecnicamente claros no codigo:

- Admin ve todas as Propriedades;
- Produtor da Sela de Prata I possui vinculo direto com `p_sela1`;
- Colaborador de Mato Grosso acessa `p_sela1` pelo escopo `MT - Norte`;
- `propriedades_atribuidas` continua visual/preparatorio.

O risco esta na apresentacao:

- Usuario produtor e Titular usam nome de Propriedade;
- propriedade atribuida pode parecer permissao real;
- cadastro administrativo e login demonstrativo usam fontes separadas.

### Visitas E Caderno

Os exemplos existentes sao plausiveis como dados genericos, mas nao formam uma
historia coerente com a Propriedade principal de teste.

Problemas:

- nenhuma visita ou caderno pertence a `p_sela1`;
- talhoes genericos dos registros nao correspondem aos codigos reais da Sela
  de Prata I;
- datas relativas mudam a cada execucao;
- fotos em `picsum.photos` dependem de internet e nao representam evidencia de
  campo autorizada;
- textos agronomicos podem ser interpretados como recomendacao real.

Pacote recomendado para `p_sela1`, sempre identificado como demonstrativo:

- uma visita realizada, com objetivo de vistoria/consultoria, texto neutro e
  sem foto externa;
- uma visita agendada, com texto curto e sem recomendacao agronomica
  prescritiva;
- um registro de caderno visivel ao Produtor, usando um codigo real de talhao
  da amostra, atividade simples e observacao neutra;
- datas fixas e coerentes com a rodada do APK;
- nenhum dado pessoal, foto real ou recomendacao tecnica nao autorizada.

## Riscos De LGPD E Dados Reais

Riscos atuais:

- nomes comuns, e-mails, telefones, enderecos e CEPs parecem dados reais;
- a Sela de Prata I usa nome, localizacao precisa, limites e anexos
  reais/parciais;
- o mock usa credenciais simples e compartilhadas;
- fotos externas podem exibir conteudo imprevisivel;
- documento pessoal pode ser digitado no Admin sem necessidade para o teste;
- dados agronomicos podem ser sensiveis mesmo sem identificar diretamente uma
  pessoa.

Controles minimos para o APK:

- confirmar autorizacao do nome, limites, localizacao e anexos da Sela de
  Prata I;
- substituir nomes de pessoas por personas demonstrativas;
- remover ou deixar vazios telefone, documento, endereco e CEP nao necessarios;
- usar e-mails demonstrativos;
- nao incluir CPF, CNPJ, telefone pessoal, senha real ou foto real;
- remover dependencia de `picsum.photos` do pacote principal;
- comunicar visualmente e verbalmente que o conteudo e mock/demonstrativo.

## Preparacao Para Persistencia Local

Estado atual:

- AuthContext persiste somente a sessao mockada em `AsyncStorage`;
- o cache de mapas possui trilha propria e parcial;
- CRUD de Usuario, Propriedade, Visita, Caderno e Mapa altera arrays em memoria;
- reinicio/reload perde os cadastros criados;
- reinstalacao/limpeza do app perde todos os dados locais.

Preparacao minima recomendada, sem implementar sincronizacao:

1. Separar seed demonstrativo imutavel dos registros criados/editados no
   dispositivo.
2. Criar uma interface local de leitura e escrita por entidade, mantendo as
   APIs publicas atuais (`User`, `Produtor`, `Visita`, `CadernoCampo`, `Mapa`).
3. Hidratar o estado local na abertura e fazer escrita apos create/update/delete.
4. Versionar o schema local para permitir reset/migracao simples do mock.
5. Manter ids estaveis e metadados `data_cadastro`/`data_atualizacao`.
6. Criar acao controlada de `Restaurar dados demonstrativos`.
7. Preservar `fazenda_id` em todos os registros ligados a Propriedade.
8. Persistir apenas metadados de arquivos preparados; arquivo local real fica
   para bloco separado, sem upload remoto.

Nao preparar agora:

- fila de sincronizacao;
- resolucao de conflito;
- token de backend;
- status de envio;
- upload em segundo plano;
- migracao para `propriedade_id`.

## Itens Para Backend Futuro

Devem permanecer fora do APK mockado:

- autenticacao, senha, convite, reset e sessao real;
- RBAC e validacao de permissao no servidor;
- integridade referencial entre Usuario, Titular, Propriedade e vinculos;
- criacao transacional de Usuario + Propriedade + vinculo;
- unicidade e verificacao real de e-mail/documento;
- auditoria de alteracoes;
- storage, upload, download assinado e publicacao de arquivos;
- persistencia de anexos e metadados em banco;
- sincronizacao, conflito e historico entre dispositivos;
- consentimento, base legal, retencao e exclusao de dados pessoais;
- migracao controlada de ids e contratos.

## Ordem Segura De Implementacao

### Bloco 16B.1 - Alinhar O Pacote Demonstrativo Principal

- confirmar autorizacao e semantica da Sela de Prata I;
- definir persona Produtor/Titular demonstrativa separada da Propriedade;
- alinhar as tres credenciais principais entre `authMock` e `api/mock`;
- remover contatos pessoais desnecessarios dessas personas;
- adicionar visita e caderno demonstrativos vinculados a `p_sela1`;
- usar datas fixas e sem fotos externas no fluxo principal.

Criterio de aceite:

- Produtor, Colaborador e Admin contam a mesma historia da Sela de Prata I;
- mapa, anexos, visita e caderno existem no mesmo contexto de `fazenda_id`;
- nenhum dado pessoal real nao autorizado aparece.

### Bloco 16B.2 - Simplificar Mapas/Arquivos Tecnicos

- ocultar a associacao de referencia tecnica no APK de campo;
- manter consulta dos materiais preparados;
- se houver formulario interno, reduzir superficie visivel a Titulo e
  Descricao;
- preservar metadados e contratos atuais internamente.

Criterio de aceite:

- nenhum botao central sugere upload/download real;
- materiais continuam abrindo;
- filtros e `fazenda_id` continuam preservados.

### Bloco 16B.3 - Ajustar Apresentacao Dos Cadastros

- manter Nova/Editar Propriedade com o conjunto atual de baixo risco;
- deixar Novo Titular e cadastro rapido fora do fluxo principal;
- reforcar que Usuario administrativo nao cria login;
- manter telefone/documento opcionais e vazios no seed principal.

Criterio de aceite:

- formulario de Propriedade continua salvando;
- Usuario continua validando perfis/vinculos mockados;
- demonstracao nao mistura pessoa e Propriedade.

### Bloco 16B.4 - Preparar Persistencia Local

- introduzir borda local sem mudar contratos publicos;
- persistir metadados e cadastros demonstrativos;
- incluir restauracao do seed;
- nao implementar sincronizacao ou backend.

Criterio de aceite:

- registro criado permanece apos reinicio controlado do app;
- restauracao retorna ao pacote demonstrativo;
- `fazenda_id` permanece preservado.

### Bloco 16B.5 - Smoke Em Android Fisico

- executar a rodada 16B de `docs/project/smoke.md`;
- testar sem internet;
- conferir que assets internos abrem;
- conferir linguagem, dados e limites do mock.

## Criterios De Pronto Da Fase 16B

- campos finais do APK estao aplicados sem ampliar escopo;
- Sela de Prata I tem historia demonstrativa coerente ou pendencia explicita;
- Usuario/Titular nao e confundido com nome da Propriedade;
- tres perfis principais possuem personas demonstrativas claras;
- visitas e caderno do fluxo principal sao realistas, neutros e vinculados a
  `p_sela1`;
- Mapas/Arquivos tecnicos priorizam consulta e nao prometem upload;
- riscos LGPD foram minimizados;
- preparacao local nao implementa sincronizacao/backend;
- validacoes automaticas e smoke aplicaveis passam.

## Validacoes Desta Abertura

Executadas em 2026-06-04:

- `npm run typecheck`: passou.
- `npm run test:domain-compat`: passou.
- `git diff --check`: passou; no Windows, emitiu apenas avisos normais de
  conversao LF/CRLF.
