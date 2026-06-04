# Fase 16B - Revisao De Cadastros E Mock Realista Para APK De Campo

Status em 2026-06-04: diagnostico documental concluido e Bloco 16B.1
implementado no seed/mock principal.

A 16B.1 altera somente seed/mock demonstrativo, testes e documentacao. Nao
altera telas, contratos, rotas, permissoes ou persistencia e preserva
`fazenda_id`/`fazendaId` e o comportamento validado na Fase 16A.

## Entrega Do Bloco 16B.1

Personas principais alinhadas entre `src/auth/authMock.ts` e `src/api/mock.ts`:

| Perfil | ID | Persona | E-mail demonstrativo | Contexto |
|---|---|---|---|---|
| Admin | `u1` | Admin Demonstracao | `admin.demonstracao@example.com` | Brasil |
| Colaborador | `u5` | Colaborador de Campo | `colaborador.campo@example.com` | Mato Grosso / `MT - Norte` |
| Produtor | `u_sela1` | Produtor Demonstracao | `produtor.demonstracao@example.com` | Titular `prop_sela1`, vinculado a `p_sela1` |

O pacote principal da Sela de Prata I agora possui:

- Propriedade `Fazenda Sela de Prata I`, separada da persona
  `Produtor Demonstracao`;
- uma visita realizada em `2026-05-28`, sem foto externa e sem recomendacao
  prescritiva;
- uma visita agendada em `2026-06-12`, com texto demonstrativo neutro;
- um caderno visivel ao Produtor em `2026-05-29`, vinculado ao talhao
  `T01 - 230`;
- os mapas, talhoes, cinco PNGs e `fazenda_id: p_sela1` existentes preservados.

Dados pessoais minimizados no cadastro mock:

- nomes de pessoas substituidos por personas demonstrativas;
- e-mails substituidos pelo dominio reservado `example.com`;
- telefones, enderecos e CEPs esvaziados;
- nenhuma foto externa adicionada ao fluxo principal de `p_sela1`.

Continuam fora deste bloco: telas, login/RBAC real, persistencia local,
upload/storage, simplificacao de MapasScreen e alteracao da area cadastrada.
Como a 16B.1 nao altera telas, os rotulos hardcoded do acesso rapido em
`LoginScreen` ainda exibem nomes legados; as credenciais e os usuarios
autenticados, porem, usam as personas novas.

## Entrega Do Bloco 16B.2

Status em 2026-06-04: persistencia local minima implementada para os cadastros
estruturados do APK demonstravel.

Estrategia aplicada:

- `AsyncStorage` ja existente no projeto;
- snapshot versionado na chave `@tche:mock-mvp:v1`;
- seed demonstrativo mantido separado do snapshot salvo;
- hidratacao local antes da primeira operacao da API mock;
- primeira abertura sem snapshot salva e utiliza o seed;
- cada `create`, `update` e `delete` persistido atualiza o snapshot;
- escritas locais sao enfileiradas para evitar gravacao fora de ordem;
- snapshot invalido ou de outra versao volta ao seed atual.

Entidades persistidas:

- `User`;
- vinculos `usuarioPropriedade` e `usuarioMicroregiao`;
- `Produtor`/Propriedade;
- `Visita`;
- `CadernoCampo`;
- metadados estruturados de `Mapa`.

Nao sao persistidos nesta fase:

- usuarios de login de `authMock` ou autenticacao real;
- arquivos, imagens, PNGs ou conteudo binario;
- limites/talhoes e GeoJSON, que continuam vindo do seed/assets;
- cache de mapas, tiles, sincronizacao ou dados remotos.

Restauracao controlada:

- `MockLocalData.restoreSeed()` restaura o seed demonstrativo no estado atual e
  no `AsyncStorage`;
- nao foi adicionado botao visivel nesta fase para evitar uma acao destrutiva
  sem confirmacao e sem fluxo administrativo definido.

A numeracao foi ajustada pela solicitacao de implementacao: a persistencia
local passa a ser o Bloco 16B.2 e a simplificacao de Mapas/Arquivos tecnicos
fica recomendada para o Bloco 16B.3.

## Objetivo

Preparar uma base demonstrativa coerente para o APK de campo, com:

- formularios de Propriedade e Usuario compreensiveis;
- pacote mock principal coerente entre Propriedade, perfis, mapas, visitas e
  caderno;
- dados pessoais ficticios ou autorizados;
- materiais tecnicos apresentados de forma simples;
- persistencia local minima dos cadastros estruturados, sem implementar
  backend, login real, RBAC real, upload remoto ou sincronizacao.

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

Principais achados da abertura, antes da implementacao da 16B.1:

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
| Usuario produtor | `Produtor Demonstracao` | Separado do nome da Propriedade na 16B.1 |
| Titular | `Produtor Demonstracao` | Persona demonstrativa vinculada a `prop_sela1` |
| Area | `6200 ha` no cadastro | Nao confirmada contra os `1888,6 ha` mapeados |
| Demarcacao | 15 talhoes e 37 poligonos | Coerente para amostra mock aprovada |
| Anexos | Cinco PNGs de fertilidade, profundidade `10-20 cm` | Bom conjunto de consulta demonstrativa |
| Visitas | Uma realizada e uma agendada em `p_sela1` | Datas fixas, textos neutros e sem fotos externas |
| Caderno | Uma vistoria visivel ao Produtor em `p_sela1` | Usa o talhao `T01 - 230` e texto neutro |
| Colaborador | Acesso por `MT - Norte` e vinculo visual com `p_sela1` | Escopo regional continua sendo a regra efetiva |
| Localizacao | Municipio/UF e coordenadas preservados; endereco e CEP vazios | Autorizacao da localizacao e dos limites continua pendente |

Decisao segura nesta abertura:

- nao alterar `6200 ha` para `1888,6 ha` sem confirmar se o primeiro valor e
  area total e o segundo e area mapeada;
- nao inserir nome de Titular real sem autorizacao;
- preservar a visita e o caderno demonstrativos adicionados na 16B.1.

### Usuarios Mockados

O mock possui cobertura funcional suficiente. Na 16B.1, os nomes e contatos
visiveis dos cadastros seed foram substituidos por personas e dados
demonstrativos; os registros secundarios legados ainda exigem revisao futura
de textos e fotos externas.

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

Riscos remanescentes de apresentacao:

- propriedade atribuida pode parecer permissao real;
- cadastro administrativo e login demonstrativo usam fontes separadas.

### Visitas E Caderno

Os exemplos existentes sao plausiveis como dados genericos, mas nao formam uma
historia coerente com a Propriedade principal de teste.

Problemas identificados antes da 16B.1:

- nenhuma visita ou caderno pertence a `p_sela1`;
- talhoes genericos dos registros nao correspondem aos codigos reais da Sela
  de Prata I;
- datas relativas mudam a cada execucao;
- fotos em `picsum.photos` dependem de internet e nao representam evidencia de
  campo autorizada;
- textos agronomicos podem ser interpretados como recomendacao real.

O fluxo principal de `p_sela1` foi corrigido na 16B.1. Os itens acima ainda se
aplicam aos registros secundarios legados e nao devem ser usados como historia
principal da demonstracao.

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

## Persistencia Local Minima

Estado atual:

- AuthContext persiste somente a sessao mockada em `AsyncStorage`;
- o cache de mapas possui trilha propria e parcial;
- CRUD de Usuario, Propriedade, Visita, Caderno e metadados de Mapa persiste
  snapshot local versionado em `AsyncStorage`;
- reinicio/reload controlado restaura os cadastros salvos;
- reinstalacao/limpeza do app perde todos os dados locais.

Implementacao aplicada, sem sincronizacao:

1. Separar seed demonstrativo dos registros criados/editados no
   dispositivo.
2. Usar uma interface local de leitura e escrita, mantendo as
   APIs publicas atuais (`User`, `Produtor`, `Visita`, `CadernoCampo`, `Mapa`).
3. Hidratar o estado local antes da primeira operacao e fazer escrita apos
   create/update/delete.
4. Versionar o snapshot local para permitir reset simples do mock.
5. Manter ids estaveis e metadados `data_cadastro`/`data_atualizacao`.
6. Expor acao controlada de `Restaurar dados demonstrativos`.
7. Preservar `fazenda_id` em todos os registros ligados a Propriedade.
8. Persistir apenas metadados de arquivos preparados; arquivo local real fica
   para bloco separado, sem upload remoto.

Limites atuais:

- fila de sincronizacao;
- resolucao de conflito;
- token de backend;
- status de envio;
- upload em segundo plano;
- migracao para `propriedade_id`.
- migracao automatica entre versoes do snapshot;
- criptografia ou protecao para dados pessoais reais;
- transacao entre criacao rapida de Propriedade, Usuario e vinculos.

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

Status em 2026-06-04: implementado no seed/mock, com cobertura automatizada.

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

### Bloco 16B.2 - Persistencia Local Minima

Status em 2026-06-04: implementado com `AsyncStorage`, snapshot versionado e
restauracao controlada do seed.

- persistir Usuario, vinculos, Propriedade, Visita, Caderno e metadados de
  Mapa;
- carregar snapshot local antes da primeira leitura;
- usar seed na primeira abertura ou quando nao houver snapshot valido;
- salvar depois de `create`, `update` e `delete`;
- preservar ids, aliases e `fazenda_id`;
- nao persistir arquivos, limites/talhoes, autenticacao ou sincronizacao.

Criterio de aceite:

- cadastros permanecem apos reinicio controlado;
- Sela de Prata I continua disponivel no seed;
- restauracao controlada volta ao pacote demonstrativo;
- contratos e testes atuais permanecem validos.

### Bloco 16B.3 - Simplificar Mapas/Arquivos Tecnicos

- ocultar a associacao de referencia tecnica no APK de campo;
- manter consulta dos materiais preparados;
- se houver formulario interno, reduzir superficie visivel a Titulo e
  Descricao;
- preservar metadados e contratos atuais internamente.

Criterio de aceite:

- nenhum botao central sugere upload/download real;
- materiais continuam abrindo;
- filtros e `fazenda_id` continuam preservados.

### Bloco 16B.4 - Ajustar Apresentacao Dos Cadastros

- manter Nova/Editar Propriedade com o conjunto atual de baixo risco;
- deixar Novo Titular e cadastro rapido fora do fluxo principal;
- reforcar que Usuario administrativo nao cria login;
- manter telefone/documento opcionais e vazios no seed principal.

Criterio de aceite:

- formulario de Propriedade continua salvando;
- Usuario continua validando perfis/vinculos mockados;
- demonstracao nao mistura pessoa e Propriedade.

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
- `mockCompat` cobre persistencia, recarga controlada e restauracao do seed.
- `git diff --check`: passou; no Windows, emitiu apenas avisos normais de
  conversao LF/CRLF.
- smoke em Android fisico: pendente.
