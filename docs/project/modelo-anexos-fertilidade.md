# Modelo Conceitual de Anexos de Fertilidade

Este documento consolida o modelo conceitual para PNGs e outros arquivos tecnicos importados do acervo/Drive quando eles representam materiais ligados a fertilidade, talhoes, safras e propriedades.

Ele nao altera o comportamento atual do app. O projeto continua mockado, sem upload real, storage real, backend real ou mudanca na logica de download.

## 1. Definicao

`Anexo de Fertilidade` e um material tecnico vinculado ao contexto de uma propriedade, normalmente associado a um talhao, safra, camada/profundidade do solo e elemento de fertilidade.

Exemplos de elementos:

- pH
- argila
- materia organica
- fosforo
- potassio

No MVP atual, os anexos de fertilidade da propriedade Sela de Prata I aparecem como registros mockados da entidade `Mapa`, com PNGs internos para consulta visual. Esses PNGs nao sao camadas georreferenciadas sobrepostas ao mapa interativo; eles sao anexos visuais para consulta.

## 2. Arquivos Nao Sao Elementos Soltos

Arquivos como PNG, PDF, KML, KMZ e GeoJSON nao devem ser tratados apenas como arquivos soltos.

Eles devem carregar metadados que expliquem:

- a qual propriedade pertencem
- a qual talhao ou conjunto de talhoes se referem
- qual safra ou periodo agricola representam
- qual elemento tecnico exibem
- qual profundidade/camada do solo representam, quando aplicavel
- qual status de publicacao possuem
- se estao visiveis para o produtor

Essa regra evita que o app vire apenas uma lista de arquivos. O material precisa ter significado operacional dentro do contexto da propriedade.

## 3. Campos Recomendados

Campos recomendados para o modelo futuro de anexos tecnicos:

```ts
{
  id: string;

  propriedade_id: string;
  fazenda_id?: string; // legado/mock temporario enquanto a compatibilidade existir

  tipo_anexo: string;
  categoria: string;
  tipo_material: string;

  elemento?: string;
  elemento_label?: string;
  profundidade?: string;

  talhao_id?: string | null;
  talhao_nome?: string;

  safra?: string;

  arquivo_nome_original: string;
  arquivo_url: string;
  formato_arquivo: string;
  tamanho_arquivo?: number;

  origem?: string;
  status: string;
  visivel_para_produtor: boolean;

  observacoes?: string;
}
```

### Observacoes Sobre Compatibilidade

- No mock atual, `fazenda_id` pode continuar como chave operacional por compatibilidade.
- No modelo futuro, `propriedade_id` deve ser o nome preferencial para o vinculo com a unidade operacional.
- Campos legados nao devem ser removidos enquanto ainda sustentarem rotas, filtros, mocks ou validacoes existentes.

## 4. Categorias

`categoria` indica o grupo funcional amplo do material.

Categorias recomendadas:

- `fertilidade`: diagnosticos e anexos ligados a fertilidade do solo.
- `plantio`: linhas de plantio, sementes, populacao, arquivos operacionais de plantio.
- `correcao`: materiais de calagem, gessagem, corretivos e recomendacoes de correcao.
- `indice_vegetacao`: NDVI, NDRE e outros indices derivados de imagem.
- `limites`: demarcacoes, KML/KMZ, GeoJSON, shapes ou limites de talhoes/propriedade.
- `documento`: laudos, relatorios, documentos tecnicos e outros arquivos de apoio.

## 5. Tipos de Anexo

`tipo_anexo` descreve o papel especifico do arquivo dentro da categoria.

Tipos recomendados:

- `anexo_fertilidade`: imagem, PDF ou arquivo de diagnostico de fertilidade.
- `mapa_talhao`: mapa ligado a um talhao especifico.
- `mapa_limite`: arquivo de limite/demarcacao da propriedade ou de talhoes.
- `mapa_ndvi`: mapa ou imagem de indice NDVI.
- `laudo`: documento tecnico de analise, interpretacao ou recomendacao.
- `material_tecnico`: material tecnico generico ainda sem tipo mais especifico.
- `documento`: documento administrativo ou operacional relacionado ao contexto.

## 6. Elementos de Fertilidade

`elemento` identifica o atributo tecnico representado no anexo.

Valores recomendados:

- `ph`
- `argila`
- `materia_organica`
- `fosforo`
- `potassio`
- `calcio`
- `magnesio`
- `saturacao_bases`
- `ctc`
- `outro`

`elemento_label` deve guardar a forma legivel para interface quando necessario, como `pH`, `Argila`, `Materia organica`, `Fosforo` ou `Potassio`.

## 7. Exemplo: Sela de Prata I

Os PNGs importados para a amostra da propriedade Sela de Prata I seguem um padrao que pode ser interpretado como anexo de fertilidade:

- `PH_10a20.png`: pH, profundidade `10-20 cm`.
- `AR_10a20.png`: argila, profundidade `10-20 cm`.
- `MO_10a20.png`: materia organica, profundidade `10-20 cm`.
- `PP_10a20.png`: fosforo, profundidade `10-20 cm`.
- `KK_10a20.png`: potassio, profundidade `10-20 cm`.

Exemplo conceitual:

```ts
{
  id: 'm_sela1_ph_10a20_2025',
  propriedade_id: 'p_sela1',
  fazenda_id: 'p_sela1',

  tipo_anexo: 'anexo_fertilidade',
  categoria: 'fertilidade',
  tipo_material: 'diagnostico',

  elemento: 'ph',
  elemento_label: 'pH',
  profundidade: '10-20 cm',

  talhao_id: null,
  talhao_nome: 'Propriedade inteira',

  safra: '2025',

  arquivo_nome_original: 'PH_10a20.png',
  arquivo_url: 'asset://mapas/sela-prata-i/2025/fertilidade/ph_10a20.png',
  formato_arquivo: 'png',
  tamanho_arquivo: 206215,

  origem: 'drive_importado',
  status: 'liberado',
  visivel_para_produtor: true,

  observacoes: 'Anexo de fertilidade importado do acervo tecnico.'
}
```

## 8. Fluxo Futuro Real

Quando houver backend, storage e fluxo administrativo real, o caminho recomendado e:

1. Upload ou importacao do arquivo.
2. Inferencia opcional de metadados a partir do nome do arquivo, como elemento e profundidade.
3. Confirmacao manual dos metadados por usuario autorizado.
4. Vinculo com propriedade, talhao e safra.
5. Publicacao/liberacao para produtor quando aplicavel.
6. Exibicao no app como anexo tecnico dentro do contexto da propriedade.

A inferencia pelo nome deve ser apenas apoio. A confirmacao manual continua necessaria para evitar publicar arquivo no contexto errado.

## 9. Estado Atual Do Mock

No mock atual:

- anexos de fertilidade podem continuar representados dentro de `Mapa`
- `fazenda_id` pode continuar por compatibilidade
- `arquivo_url`, `formato_arquivo`, `tamanho_arquivo`, `elemento`, `profundidade`, `talhao`, `safra` e `observacoes` ja ajudam a indicar o contrato futuro
- nao existe upload real
- nao existe storage real
- nao existe backend real
- nao existe publicacao persistente real

No modelo futuro, o nome preferencial para o vinculo operacional deve ser `propriedade_id`.

