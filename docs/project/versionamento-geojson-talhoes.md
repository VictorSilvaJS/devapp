# Versionamento De GeoJSON E Identidade De Talhoes

> Status: `ATIVO`
>
> Definido em: 2026-07-30
>
> Origem: `MP-06` / `QA-P1-06`

## Objetivo

Este documento define o contrato produtivo de identidade, importacao,
reconciliacao, publicacao, vigencia, historico e linhagem dos Talhoes
representados por GeoJSON.

Ele nao altera o importador local atual. Persistencia produtiva, storage,
publicacao, migracao e consulta historica pertencem a `MP-37`; a regressao de
multiplas versoes pertence a `MP-39`.

## Problema Confirmado

O comportamento local atual:

- mantem somente um GeoJSON `ativo` por Propriedade;
- marca o metadado anterior como `substituido` e tenta apagar seu arquivo
  fisico depois da ativacao do novo;
- carrega no mapa somente a importacao ativa, sem navegacao historica;
- usa `versao = 1` como versao do schema local, nao como versao de demarcacao;
- cria IDs de runtime a partir da Propriedade, da posicao da feature e do nome;
- perde estabilidade de identidade com renome ou reordenacao das features;
- nao persiste Talhao como entidade logica nem a versao de sua geometria;
- nao reconcilia renome, mudanca de area, ausencia, divisao ou fusao;
- mantem vinculos operacionais de Talhao principalmente como texto.

Esse comportamento continua demonstrativo e nao representa o contrato
produtivo aprovado.

## Principios

1. `talhao_id` identifica a unidade operacional e e imutavel.
2. Nome, codigo, indice da feature, ano, Safra/Safrinha e geometria nao sao
   identidade.
3. Cada arquivo recebido cria uma importacao imutavel e auditavel.
4. A geometria possui versao e vigencia separadas do Talhao logico.
5. Nenhuma versao publicada e destruida ou reescrita por nova importacao.
6. Publicacao exige validacao, reconciliacao e revisao explicita.
7. Renome preserva `talhao_id`; mudanca de contorno cria outra geometria.
8. Divisao e fusao preservam predecessores, sucessores e vigencias.
9. Ausencia em arquivo novo nao encerra Talhao automaticamente.
10. Backend e storage produtivos sao a fonte de verdade.
11. Autorizacao e escopo sao revalidados no servidor em cada comando.
12. Historico inexistente nao e inventado durante a migracao.

## Modelo Canonico

### `talhao`

Representa a identidade logica, independentemente do nome e da geometria.

Campos minimos:

- `talhao_id`, estavel e imutavel;
- `organizacao_id`;
- `propriedade_id`;
- `codigo_atual` opcional;
- `nome_atual`;
- `estado`: `ativo` ou `encerrado`;
- `criado_em`;
- `encerrado_em` opcional;
- aliases e historico de nomes/codigos;
- `versao_atual` para concorrencia.

Um Talhao nao muda de Propriedade. Correcao de Propriedade exige reconciliar
ou criar a identidade correta, sem transferir o historico para outro
contexto.

### `geojson_importacao`

Representa o arquivo e a proposta de demarcacao recebida.

Campos minimos:

- `geojson_import_id`;
- `organizacao_id`;
- `propriedade_id`;
- numero monotono da versao dentro da Propriedade;
- `schema_versao`, separado do numero da demarcacao;
- nome, MIME e tamanho do arquivo original;
- referencia imutavel ao arquivo original no storage;
- checksum criptografico dos bytes recebidos;
- ano de referencia e periodo produtivo opcional;
- `vigencia_inicio` obrigatoria antes da publicacao;
- `vigencia_fim` opcional, derivada da sucessao publicada;
- autor e horario de importacao;
- revisor, publicador e respectivos horarios quando aplicavel;
- observacao e origem;
- estado;
- versao base publicada usada na reconciliacao;
- `versao_atual` para concorrencia.

Checksum detecta repeticao exata do arquivo, mas nao prova identidade de
Talhao. Corrigir o conteudo exige nova importacao; o arquivo anterior nao e
sobrescrito.

### `talhao_geometria_versao`

Relaciona um Talhao logico a uma importacao e a uma vigencia.

Campos minimos:

- `talhao_geometria_versao_id`;
- `talhao_id`;
- `geojson_import_id`;
- geometria `Polygon` ou `MultiPolygon`;
- hash da geometria normalizada;
- area calculada, unidade, metodo e sistema de referencia;
- nome, codigo e identificador externo encontrados como snapshots;
- `vigencia_inicio`;
- `vigencia_fim` opcional;
- estado de publicacao herdado da importacao.

Geometria publicada nao e editada no lugar. Alteracao de contorno ou area cria
nova versao geometrica, mesmo quando o `talhao_id` permanece.

### `talhao_linhagem`

Registra relacoes estruturais entre identidades logicas.

Campos minimos:

- `talhao_linhagem_id`;
- `tipo`: `divisao` ou `fusao`;
- `talhao_predecessor_id`;
- `talhao_sucessor_id`;
- `geojson_import_id`;
- instante efetivo;
- autor da decisao;
- observacao e evidencia de reconciliacao;
- proporcao de area ou sobreposicao opcional, identificada como estimativa.

A linhagem e append-only. Uma divisao gera uma relacao por
predecessor/sucessor; uma fusao gera uma relacao por predecessor/resultado.

### `geojson_reconciliacao_item`

Registra como cada feature candidata foi associada ao dominio.

Campos minimos:

- `reconciliacao_item_id`;
- `geojson_import_id`;
- identificador da feature no arquivo;
- nome, codigo e identificador externo encontrados;
- `talhao_id` proposto ou vazio;
- tipo e confianca da correspondencia;
- diferencas de nome, codigo, geometria e area;
- decisao;
- autor e horario da confirmacao;
- justificativa quando a decisao for manual;
- versao base usada.

Decisoes canonicas:

- `manter`;
- `renomear`;
- `alterar_geometria`;
- `criar`;
- `manter_ausente`;
- `encerrar`;
- `dividir`;
- `fundir`;
- `bloquear_ambiguo`.

## Identidade Dentro Do GeoJSON

O formato preferencial de cada feature e:

```json
{
  "talhao_id": "TLH-0001",
  "codigo": "T01",
  "nome": "Norte"
}
```

Regras:

- `talhao_id` valido e pertencente a mesma Propriedade e o primeiro criterio;
- identificador externo cadastrado pode produzir correspondencia forte;
- codigo e aliases podem sugerir uma identidade;
- sobreposicao espacial pode sugerir, nunca confirmar sozinha;
- nome isolado ou posicao no array nunca confirmam identidade;
- feature sem correspondencia segura fica pendente de decisao humana;
- ID gerado por indice/nome no importador atual e somente compatibilidade de
  runtime e nao pode ser promovido automaticamente a `talhao_id`.

Limiares de sobreposicao e tolerancias geometricas serao parametrizados e
validados em `MP-37`; nao fazem parte da identidade.

## Estados Da Importacao

| Estado | Significado |
|---|---|
| `rascunho` | arquivo preservado e ainda em preparacao/reconciliacao |
| `em_revisao` | candidato imutavel submetido para revisao |
| `publicada` | demarcacao autorizada para sua vigencia |
| `arquivada` | versao publicada que deixou de ser a vigente |
| `rejeitada` | candidato recusado, preservado para auditoria |

Fluxo inicial:

```text
rascunho -> em_revisao -> publicada
                     \-> rejeitada
publicada -> arquivada
```

Voltar `em_revisao` para edicao nao altera o arquivo: a revisao e rejeitada e
uma nova importacao rascunho e criada. `publicada`, `arquivada` e `rejeitada`
nao retornam a `rascunho`.

## Fluxo De Importacao E Publicacao

1. Selecionar uma Propriedade autorizada.
2. Informar vigencia inicial, ano e periodo opcional.
3. Receber e validar tecnicamente o GeoJSON.
4. Preservar o arquivo original e calcular checksum.
5. Criar importacao `rascunho`, sem afetar a camada publicada.
6. Comparar com a demarcacao publicada de referencia.
7. Exibir mantidos, renomeados, alterados, novos, ausentes, divisoes,
   fusoes e ambiguidades.
8. Confirmar cada reconciliacao que nao for deterministica.
9. Submeter a versao imutavel para revisao.
10. Revisor autorizado aprova ou rejeita.
11. Publicacao atomica cria as vigencias geometricas, aplica a linhagem e
    arquiva a versao anterior quando sua vigencia terminar.
12. Aplicativos passam a consumir a versao publicada autorizada.

O termo de interface deve ser `Importar nova versao`, nao `Substituir
GeoJSON`. Salvar rascunho ou enviar para revisao nunca muda a demarcacao
visivel ao Produtor.

## Reconciliacao

A comparacao apresenta, no minimo:

- Talhoes mantidos;
- nomes/codigos alterados;
- geometrias e areas alteradas;
- Talhoes candidatos a criacao;
- Talhoes ausentes no arquivo;
- candidatos a divisao;
- candidatos a fusao;
- correspondencias ambiguas.

Ordem de apoio a correspondencia:

1. `talhao_id` valido;
2. identificador externo previamente cadastrado;
3. codigo e aliases historicos;
4. sobreposicao espacial e similaridade geometrica;
5. nome apenas como indicio complementar.

Correspondencia automatica precisa ser explicavel e reproduzivel. Casos
ambiguos bloqueiam a publicacao. A interface mostra a versao de referencia,
os criterios usados, as diferencas e a decisao humana.

## Regras Entre Versoes

### Renome

- mantem `talhao_id`;
- atualiza nome/codigo atual na publicacao;
- preserva o valor anterior como alias;
- mantem snapshots nos registros historicos.

### Mudanca De Contorno Ou Area

- mantem `talhao_id` quando a unidade operacional continua a mesma;
- encerra a vigencia da geometria anterior no instante efetivo;
- cria nova `talhao_geometria_versao`;
- registra area anterior/nova, metodo, autor e decisao.

### Divisao

- encerra o Talhao predecessor e sua geometria na data efetiva;
- cria dois ou mais Talhoes sucessores com novos `talhao_id`;
- registra a linhagem entre predecessor e cada sucessor;
- mantem registros anteriores ligados ao predecessor;
- novos registros selecionam um sucessor ou Propriedade inteira.

### Fusao

- encerra os Talhoes predecessores e suas geometrias na data efetiva;
- cria o Talhao resultante com novo `talhao_id`;
- registra a linhagem de cada predecessor para o resultado;
- nao reatribui registros historicos ao Talhao novo.

### Ausencia No Arquivo

- nao apaga nem encerra automaticamente;
- exige decisao `manter_ausente` ou `encerrar`;
- apresenta vinculos operacionais existentes antes da confirmacao;
- encerramento possui autor, motivo e instante efetivo.

## Vigencia E Consulta Historica

Para uma Propriedade e um instante efetivo, somente uma importacao pode ser a
demarcacao publicada aplicavel. Intervalos publicados sao tratados como
`[vigencia_inicio, vigencia_fim)`.

Publicacao com inicio retroativo exige permissao excepcional, justificativa e
validacao de conflito. Ela nao reescreve snapshots nem silenciosamente troca a
geometria registrada por modulos operacionais.

Resolucao da geometria:

1. usar `talhao_geometria_versao_id` preservado no registro, quando existir;
2. caso contrario, usar `talhao_id` e o instante operacional do registro;
3. se a migracao nao permitir resolver sem ambiguidade, mostrar o nome
   historico e marcar `geometria_nao_resolvida`.

Uma restauracao nao apaga a versao mais nova. Ela cria nova publicacao
auditada, com nova vigencia, baseada em conteudo historico preservado.

## Vinculos Com Outros Modulos

Caderno, Visitas, Safra/Safrinha e Materiais devem:

- referenciar `talhao_id` quando o registro pertencer a um Talhao;
- oferecer `Propriedade inteira` quando nao houver Talhao especifico;
- preservar nome/codigo como snapshot de exibicao;
- nunca usar o snapshot textual como chave;
- preservar `talhao_geometria_versao_id` quando a geometria for usada para
  avaliacao espacial, area, localizacao ou evidencia;
- manter o vinculo historico mesmo depois de renome, encerramento, divisao ou
  fusao.

A selecao produtiva por ID e a migracao dos textos livres dependem de `MP-24`.
Validacao espacial do ponto do Caderno e uso da versao geometrica pertencem a
`MP-26`.

## Autoridade Por Perfil

### Produtor

- consulta a demarcacao publicada das proprias Propriedades;
- consulta a geometria historica vinculada a registros que ja pode acessar;
- nao importa, reconcilia, revisa, publica, arquiva, restaura ou remove;
- nao recebe rascunhos, versoes rejeitadas nem auditoria administrativa.

### Colaborador

- dentro do escopo e com permissao, cria importacao rascunho e faz
  reconciliacao operacional;
- pode submeter para revisao;
- nao publica no primeiro contrato;
- nao ganha permissao apenas por conseguir abrir o arquivo ou a Propriedade.

### Admin Ou Papel Tecnico Autorizado

- revisa, rejeita, publica, arquiva e restaura dentro da organizacao e do
  escopo autorizado;
- precisa de acao explicita de publicacao;
- nao ignora reconciliacao, conflito, vigencia ou auditoria;
- nao exclui versao publicada pelo fluxo comum.

Separar quem prepara de quem publica e a regra do primeiro corte. Uma futura
permissao de publicacao ao Colaborador exige papel explicito e nao muda os
demais controles.

## Auditoria, Concorrencia E Idempotencia

Importacao, reconciliacao, submissao, revisao, rejeicao, publicacao,
arquivamento e restauracao geram eventos append-only com:

- organizacao, Propriedade e importacao;
- comando;
- autor e perfil em snapshot;
- horario do servidor;
- versao base e resultante;
- motivo quando exigido;
- idempotencia, origem e correlacao;
- resumo das diferencas e decisoes afetadas.

Publicar exige a mesma versao base usada na reconciliacao. Se outra versao for
publicada antes, o servidor recusa por conflito e exige nova comparacao. Nao
existe `last write wins`.

Repetir a mesma chave de idempotencia nao duplica importacao, publicacao,
linhagem ou eventos.

## Storage, Retencao E Exclusao

- arquivo original de toda importacao publicada e preservado;
- geometrias publicadas, checksums, reconciliacoes e eventos permanecem
  auditaveis;
- arquivar encerra vigencia, mas nao apaga arquivo ou metadados;
- rejeicao nao autoriza exclusao automatica;
- limpeza fisica futura depende de politica de retencao, base legal, auditoria
  e prova de que nao ha referencia;
- camada seed demonstrativa e importacao local nao sao misturadas
  silenciosamente com a fonte produtiva.

A politica temporal exata para rascunhos abandonados e rejeitados permanece
pendente. Ela nao pode reduzir a retencao das versoes publicadas exigida por
este contrato.

## Offline

Dentro da politica de sessao e do ultimo escopo autorizado:

- consulta a versoes publicadas previamente armazenadas pode funcionar
  offline;
- a fonte, o numero da versao e a vigencia da camada em cache devem ficar
  visiveis;
- geometria referenciada por registro local ainda nao sincronizado nao pode
  ser removida do cache;
- selecionar arquivo pode produzir apenas um preparo local explicitamente nao
  enviado, sem substituir a camada publicada;
- criar importacao produtiva, reconciliar, submeter, revisar, publicar,
  arquivar ou restaurar exigem conexao;
- nao existe publicacao otimista nem fila offline de transicao.

Retencao e limite de cache serao implementados em `MP-37`, preservando
referencias pendentes e a segregacao por usuario/organizacao.

## Compatibilidade E Migracao

### Importacoes Locais

- `ativo` atual e candidato legado a publicacao, nao publicacao comprovada;
- `substituido`, `removido` e `erro` permanecem evidencias locais;
- arquivo ja apagado nao e recriado nem tratado como historico disponivel;
- `GEOJSON_IMPORT_VERSION = 1` continua versao do schema local;
- seed demonstrativo recebe origem explicita e nao e promovido
  silenciosamente a demarcacao produtiva;
- importacao atual continua funcionando ate `MP-37`, sem ser descrita como
  versionamento.

### Talhoes E Registros Textuais

- IDs gerados por indice/nome nao viram `talhao_id` automaticamente;
- cada Talhao legado exige mapeamento para identidade logica por Propriedade;
- nome/codigo textual e preservado como snapshot;
- correspondencia unica confirmada cria o vinculo por ID;
- correspondencia ambigua fica `talhao_nao_resolvido` e nao e adivinhada;
- historico, vigencia ou geometria anteriores inexistentes nao sao
  sintetizados;
- `fazenda_id` pode permanecer alias temporario de `propriedade_id` durante a
  leitura dupla.

O plano de migracao executavel pertence a `MP-24` e `MP-37`.

## Criterios De Aceite Da MP-06

1. Talhao logico, importacao, geometria e linhagem possuem identidades
   separadas.
2. Nome, indice e ordem da feature nao definem `talhao_id`.
3. Cada importacao e imutavel e preserva arquivo, checksum e auditoria.
4. Rascunho e revisao nao alteram a camada publicada.
5. Publicacao exige reconciliacao concluida e usuario autorizado.
6. Versao publicada anterior nunca e apagada automaticamente.
7. Renome preserva identidade e alias historico.
8. Mudanca de contorno/area cria nova geometria sem trocar identidade quando a
   unidade operacional permanece.
9. Ausencia nao encerra Talhao automaticamente.
10. Divisao e fusao criam sucessores e preservam linhagem.
11. Geometria vigente pode ser resolvida pela versao salva ou pela data do
    registro.
12. Migracao textual preserva dados e marca ambiguidades sem inventar vinculo.
13. Concorrencia impede publicar sobre base desatualizada.
14. Offline nao publica nem substitui camada produtiva.

## Dependencias E Limites

Esta tarefa define contrato, nao implementacao. Permanecem:

- `MP-24`: IDs estaveis e selecao produtiva de responsavel/Talhao;
- `MP-26`: validacao espacial do ponto do Caderno e versao usada;
- `MP-37`: banco, storage, APIs, importacao, reconciliacao, publicacao,
  historico, cache e migracao;
- `MP-39`: regressao com renome, area, divisao, fusao, rollback e multiplas
  versoes.

Limiares de similaridade, politica de retencao de rascunhos/rejeitados,
capacidade do cache e UX detalhada de comparacao devem ser definidos na
implementacao sem enfraquecer os principios deste contrato.

Ate `MP-37`, `QA-P1-06` permanece resolvido somente em nivel de contrato.
