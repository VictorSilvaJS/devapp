# Modelo Canonico de Material Tecnico

Este documento define o contrato funcional do `Material tecnico` para novos
anexos do MVP local. Ele substitui, como referencia principal, o modelo
especifico de anexos de fertilidade, preservando os registros e fluxos legados
por compatibilidade.

## 1. Objetivo

Organizar os arquivos tecnicos no mesmo raciocinio usado no acervo operacional,
sem transformar nomes de pastas ou nomes de arquivos em relacionamentos de
banco.

A navegacao principal deve espelhar:

```text
Propriedade
└── Ano
    ├── Fertilidade
    ├── Correcao de solo
    └── Prescricao
```

`Propriedade`, ano e categoria sao metadados do material. O caminho visual pode
ser reconstruido a partir deles; o caminho de uma pasta externa nao e a fonte
canonica do vinculo.

## 2. Unidade Do MVP Local

No corte atual, cada arquivo selecionado gera um registro de material tecnico.
PNG, PDF e ZIP sao formatos aceitos pelo fluxo unificado.

O arquivo fisico fica no storage interno do aplicativo. O `AsyncStorage` guarda
somente metadados pequenos. Nao devem ser persistidos ali base64, bytes,
conteudo de PDF, conteudo de ZIP, imagens brutas ou objetos de arquivo.

O agrupamento futuro de PNG, PDF e ZIP como representacoes de um unico material
de negocio pode ser feito no backend, mas nao e requisito deste MVP local.

## 3. Campos Comuns

Todo novo material deve possuir:

- `propriedade_id`, preservando tambem `fazenda_id` enquanto houver
  compatibilidade tecnica;
- `ano`, obrigatorio e independente de Safra/Safrinha;
- `categoria`: `fertilidade`, `correcao` ou `prescricao`;
- `arquivo_nome_original`, preservado exatamente para identificacao do acervo;
- `titulo`, gerado automaticamente a partir do nome original, sem exigir
  digitacao manual no fluxo principal;
- `formato_arquivo`: `png`, `pdf` ou `zip`;
- status local;
- `visivel_para_produtor`;
- autoria e datas de importacao quando disponiveis.

Safra/Safrinha e opcional. Quando informada, deve ser uma referencia a um
periodo produtivo ativo da mesma Propriedade, por `periodo_produtivo_id`, com o
label preservado apenas para apresentacao e compatibilidade. Ano do arquivo e
periodo produtivo nao devem ser tratados como o mesmo conceito.

O nome pode ajudar a gerar titulo ou uma classificacao informativa. Ele nao
deve alterar a Propriedade, o ano ou a categoria confirmados pelo usuario.

## 4. Campos Condicionais Por Categoria

| Categoria | Profundidade | Escopo | Talhao | Regra do formulario |
|---|---|---|---|---|
| Fertilidade | selecao obrigatoria, admitindo `Nao informada` | Propriedade | nao se aplica | selecionar arquivo, ano, periodo opcional e visibilidade |
| Correcao de solo | selecao obrigatoria, admitindo `Nao informada` | Propriedade ou Talhao | obrigatorio somente no escopo Talhao | selecionar arquivo, ano, profundidade, escopo, periodo opcional e visibilidade |
| Prescricao | nao se aplica | Propriedade no corte atual | nao se aplica | selecionar arquivo, ano, periodo opcional e visibilidade |

Ao trocar de categoria ou escopo, campos que deixaram de ser aplicaveis devem
ser limpos antes da persistencia. Prescricao nao deve herdar profundidade,
Talhao ou camada de uma selecao anterior. Correcao com escopo de Propriedade
nao deve guardar Talhao residual.

Em Prescricao, marcadores reconheciveis no nome, como calcario, fosforo ou
potassio, podem gerar uma classificacao inferida e informativa. Quando o nome
nao for reconhecido, o material continua valido como Prescricao, sem inventar
um elemento tecnico.

## 5. Contrato Local Recomendado

```ts
interface MaterialTecnicoImportMetadata {
  id: string;

  propriedade_id: string;
  fazenda_id: string;
  nome_propriedade?: string;

  titulo: string;
  categoria: 'fertilidade' | 'correcao' | 'prescricao';
  categoria_label: string;
  ano: number;

  periodo_produtivo_id?: string;
  periodo_produtivo_label?: string;
  safra?: string; // compatibilidade/apresentacao

  profundidade?: string;
  escopo: 'propriedade' | 'talhao';
  talhao_id?: string;
  talhao_nome?: string;

  prescricao_inferida?:
    | 'calcario'
    | 'fosforo'
    | 'potassio'
    | 'nao_identificada';
  prescricao_inferida_label?: string;

  arquivo_nome_original: string;
  arquivo_uri_local?: string;
  arquivo_tamanho_bytes?: number;
  arquivo_mime?: string;
  formato_arquivo: 'png' | 'pdf' | 'zip';

  status: 'rascunho' | 'ativo' | 'substituido' | 'removido' | 'erro';
  visivel_para_produtor: boolean;
  origem: 'arquivo_local';
  importado_em: string;
  atualizado_em: string;
  versao: number;
}
```

O indice unificado dos novos materiais usa
`@tche:material-tecnico-imports:v1`. Essa chave nao recebe o arquivo fisico.

## 6. Compatibilidade Legada

Continuam validos e legiveis:

- registros mockados da entidade `Mapa` e PNGs embutidos da Sela de Prata I;
- metadados PNG em `@tche:png-map-imports:v1`;
- metadados de Prescricao ZIP em
  `@tche:prescription-zip-imports:v1`;
- `fazenda_id`, rotas e helpers tecnicos ainda necessarios.

O catalogo da tela pode combinar itens novos e legados em memoria. Um item
legado nao deve ser recopiado ou duplicado automaticamente no indice novo.
Substituicao ou remocao deve atuar apenas no registro e arquivo local que o
fluxo gerencia, sem alterar assets, seed, GeoJSON ou material de outra
Propriedade.

## 7. Consulta, Abertura E Offline

- A rota de abertura deve transportar `material_id`, versao e contexto de
  Propriedade. A consulta revalida o item na fonte unica e no escopo do perfil.
- PNG local pode abrir em modal de tela cheia quando a URI interna for segura
  e o arquivo existir. O zoom aceita pinca, toque duplo e botoes de 100% a
  400%; o arraste atua dentro do quadro somente quando ha ampliacao e nenhum
  gesto iniciado sobre a imagem rola a pagina externa.
- Camada georreferenciada so abre como mapa quando o material contem GeoJSON
  renderizavel; formato ou nome, isoladamente, nao autorizam inventar camada.
- PDF deve aparecer com metadados e nome original. A visualizacao embutida e
  usada somente onde a plataforma realmente suporta; nos demais casos, a
  abertura e delegada a visualizador compativel do sistema e a falha e
  explicita.
- ZIP deve aparecer com seus metadados e nome original; o MVP nao descompacta,
  interpreta nem exibe preview do pacote.
- A acao de arquivo exige permissao do perfil, disponibilidade declarada e
  referencia abrivel. Falha de abertura ou download nao produz sucesso falso.
- Voltar do visualizador preserva a instancia, filtros e posicao da lista.
- A presenca local nao equivale a download remoto ou sincronizacao.

Os materiais copiados para o storage interno podem ser consultados no mesmo
aparelho sem conexao, inclusive depois de fechar e reabrir o app. Isso e cache
local demonstrativo, nao offline total: nao existe servidor, fila de sync,
resolucao de conflitos, restauracao entre aparelhos ou garantia depois de
limpar os dados/desinstalar o aplicativo.

## 8. Acesso

- Admin pode gerenciar novos materiais locais.
- Colaborador pode gerenciar somente dentro do escopo efetivo da Propriedade.
- Produtor consulta apenas material ativo, visivel para ele e pertencente a
  uma Propriedade do seu vinculo.
- Produtor nao anexa, substitui nem remove material tecnico neste corte.

Essas verificacoes locais preservam o comportamento do MVP, mas nao substituem
autorizacao por backend/RBAC real.

## 9. Evolucao Produtiva Futura

Backend, banco e object storage deverao receber os arquivos e metadados,
validar permissao por Propriedade e servir acesso autorizado. Permanecem
futuros:

- upload e download remotos;
- URLs temporarias ou assinadas;
- publicacao, revisao, versao e auditoria;
- sincronizacao e cache offline controlado;
- agrupamento de varias representacoes em um material de negocio;
- visualizador PDF integrado universal/multiplataforma;
- processamento, unzip ou leitura agronomica de ZIP;
- importacao automatica do Drive.
