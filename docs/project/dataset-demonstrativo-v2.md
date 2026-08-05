# Dataset Demonstrativo V2

## Estado

Gerado e validado em 2026-08-05. O dataset ainda não é instalado
automaticamente pelo aplicativo; essa ativação pertence à próxima etapa de
bootstrap e limpeza do v1.

Identificador: `demo_clientes_26_1_mt_2026_08`.

## Origem E Autorização

Fonte autorizada: `Clientes_26.1.kml`.

SHA-256 da fonte:
`9c2f52c85f3282e30a57d48c8fb165c42606991f9ac291742f3125acb25f9e09`.

Foi autorizado o uso demonstrativo dos nomes de Produtores, nomes de
Propriedades e limites existentes no KML. A autorização é restrita ao mock e
não transforma esses dados em cadastro produtivo.

Municípios foram determinados por interseção espacial com a malha municipal
oficial do IBGE para Mato Grosso. Município/UF são localização e filtro; nunca
concedem acesso.

## Conteúdo

| Entidade | Quantidade |
| --- | ---: |
| Organização | 1 |
| Admins | 2 |
| Colaboradores | 2 |
| Produtores | 36 |
| Propriedades | 70 |
| Vínculos usuário–Propriedade | 140 |
| Talhões lógicos | 470 |
| Geometrias de Talhão | 470 |
| Visitas demonstrativas | 70 |
| Cadernos demonstrativos | 70 |
| Materiais demonstrativos | 70 |

Cada Propriedade tem um Titular principal e um Colaborador vinculados
diretamente. Um Produtor pode titularizar várias Propriedades.

## Divisão Dos Colaboradores

- Victor: 18 Produtores e 35 Propriedades.
- Bruna Brito: 18 Produtores e 35 Propriedades.

Todas as Propriedades de um mesmo Produtor permanecem com o mesmo
Colaborador. A lista nominal de cada grupo está em
`docs/project/generated/mock-v2-colaboradores.json`.

## Localização E Geometria

Todos os 70 registros foram associados a municípios de MT por interseção, sem
fallback por proximidade. Quatro Propriedades cruzam limites municipais e
foram cadastradas no município que contém a maior parcela da geometria:

- Fazenda São Cristóvão: Lucas do Rio Verde, com 90,82% da área mapeada;
- Fazenda Pai e Filho: Nova Guarita, com 51,78%;
- Fazenda Platina: Nobres, com 62,67%;
- Bom Jesus: Terra Nova do Norte, com 98,34%.

Dezoito contornos geometricamente inválidos foram normalizados durante a
geração. Nomes de Talhão repetidos dentro da mesma Propriedade e com partes
separadas formam um único `MultiPolygon`.

`area_total` e `cultura_principal` permanecem ausentes porque o KML não fornece
esses valores cadastrais. `area_mapeada_ha` pertence apenas ao artefato de
geometria e não substitui área cadastrada.

## Contas Demonstrativas

As contas abaixo não são credenciais reais:

- César: `admin.cesar@example.com` / `admin123`;
- Bruna: `admin.bruna@example.com` / `admin123`;
- Victor: `colaborador.victor@example.com` / `colab123`;
- Bruna Brito: `colaborador.bruna.brito@example.com` / `colab123`;
- Produtores: e-mails técnicos `@example.com` e senha comum `prod123`.

A relação completa fica separada em
`src/auth/generated/mockV2DemoCredentials.json`. Senhas não pertencem ao
contrato `UsuarioV2`.

## Dados Sintéticos

O KML não contém Visitas, Cadernos ou Materiais. Para validar o comportamento
atual do app, foi criado um registro demonstrativo de cada tipo por
Propriedade. Esses registros são sintéticos, rotulados como demonstração e não
devem ser interpretados como fatos reais.

## Artefatos E Regeneração

- seed: `src/api/generated/mockV2DemoSeed.json`;
- geometria: `src/assets/geojson/generated/mockV2DemoTalhoes.geojson.json`;
- credenciais: `src/auth/generated/mockV2DemoCredentials.json`;
- divisão: `docs/project/generated/mock-v2-colaboradores.json`;
- gerador: `scripts/generateMockV2DemoData.py`.

O gerador exige Python com Shapely, a fonte KML e os dois arquivos oficiais do
IBGE usados como entrada. A geração é determinística para a mesma fonte e
mantém IDs independentes da ordem dos registros.

## Próxima Etapa

Implementar e testar a rotina única de bootstrap que:

1. identifica se o dataset v2 já foi instalado;
2. remove apenas o pacote demonstrativo v1 e seus artefatos locais;
3. instala snapshot e credenciais v2 de forma atômica;
4. invalida sessão vinculada a IDs antigos;
5. não reinstala o seed sobre dados v2 já existentes.

Somente depois disso deve ser gerado e instalado um novo APK para smoke dos
perfis Admin, Colaborador e Produtor.
