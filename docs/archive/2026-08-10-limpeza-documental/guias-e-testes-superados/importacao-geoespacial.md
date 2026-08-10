# Importacao geoespacial

Este guia formaliza o fluxo minimo para importar mapas reais sem transformar
arquivos brutos em dependencia do app.

## Base Ativa

Estado atual:

- o app consome GeoJSON/JSON final normalizado;
- mapas e limites pertencem ao contexto de `fazenda_id`;
- a Fazenda Sela de Prata I e a amostra controlada atual;
- o shapefile real da amostra gera `data/processados/p_sela1/2025/limites_talhoes.geojson`;
- o KML antigo permanece como historico/prova de conceito, nao como fonte
  principal atual.

Pendente:

- o pipeline produtivo de conversao, revisao, armazenamento, permissao e
  publicacao ainda nao esta fechado.

## Padrao De Pastas

Originais recebidos:

```text
data/originais/{fazenda_id}/{ano}/{importacao_id}/
```

Processados finais:

```text
data/processados/{fazenda_id}/{ano}/
```

Para demarcacao de talhoes, a saida esperada no MVP e:

```text
data/processados/{fazenda_id}/{ano}/limites_talhoes.geojson
data/processados/{fazenda_id}/{ano}/manifesto.json
```

Quando o mock precisar consumir diretamente o dado, um asset TypeScript pode ser
gerado em `src/assets/geojson/`, mas esse asset e uma conveniencia do mock, nao
o formato de entrada do produto.

## Regra De Nomes

- SHP: nomes dos talhoes vem dos campos do `.dbf`.
- KML/KMZ: nomes vem dos elementos `<name>`.
- GeoJSON pronto: nomes vem das `properties`.

Quando houver mais de um campo candidato, o manifesto deve registrar o campo
usado e o fallback considerado.

## Manifesto

Cada importacao processada deve ter um `manifesto.json` no diretorio final. O
manifesto registra pelo menos:

- `fazenda.fazenda_id`;
- `recorte.ano` e, quando houver, `recorte.safra`;
- padrao de pasta de originais e processados;
- formato e arquivos de origem;
- campos encontrados;
- campo de nome usado;
- quantidade de registros de origem;
- quantidade de talhoes;
- quantidade de poligonos/partes;
- arquivos finais gerados;
- status de revisao;
- indicacao se foi publicado apenas no mock ou aprovado para producao.

## Fluxo Real

O fluxo real nao deve publicar automaticamente o resultado da conversao.

Etapas minimas:

1. Receber originais em `data/originais/{fazenda_id}/{ano}/{importacao_id}/`.
2. Converter fora do app para GeoJSON/JSON final.
3. Gerar `manifesto.json` com campos, contagens e status inicial.
4. Pre-visualizar o mapa antes de publicar.
5. Conferir nomes de talhoes, geometria, ano/safra e contexto de fazenda.
6. Registrar aprovacao por equipe autorizada.
7. Publicar o arquivo final para o app ou backend.

## Amostra Sela De Prata I

A amostra controlada atual usa:

- `fazenda_id`: `p_sela1`;
- ano: `2025`;
- importacao: `p_sela1-2025-limites-talhoes-shp`;
- origem atual local: `Sela-de-Prata-I/`;
- fonte: `Fazenda_Sela_de_Prata_I_poly.shp` com atributos no `.dbf`;
- campo de nome usado: `Campo`;
- fallback de nome: `Nome_Perim`;
- campos encontrados no DBF: `Campo`, `Obj__Id`, `Nome_Perim`, `lav`;
- registros SHP/DBF: `37`;
- talhoes finais: `15`;
- poligonos/partes finais: `37`;
- manifesto: `data/processados/p_sela1/2025/manifesto.json`;
- saida GeoJSON: `data/processados/p_sela1/2025/limites_talhoes.geojson`;
- asset mock: `src/assets/geojson/selaDePrata1Talhoes.ts`;
- status: `aprovado_para_amostra_mock`, sem aprovacao de pipeline produtivo.

