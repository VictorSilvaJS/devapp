# Dataset Demonstrativo V2

## Estado

Gerado, validado e conectado ao bootstrap do aplicativo em 2026-08-05. Em
2026-08-07, o mesmo dataset v2 recebeu uma complementação sintética e
explicitamente rotulada para a rodada final de QA. Não foi criado um segundo
modelo nem um segundo snapshot.

Na primeira abertura, o app instala o dataset v2, as credenciais
demonstrativas, os períodos sintéticos e remove o pacote local v1. Em uma
instalação anterior do mesmo dataset, o bootstrap acrescenta somente os IDs de
QA ausentes e preserva registros locais existentes.

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
| Colaboradores | 3, sendo 1 inativo de QA |
| Usuários Produtores | 39, sendo 3 de QA |
| Cadastros de Produtor | 39, sendo 3 de QA |
| Propriedades | 73, sendo 3 de QA |
| Vínculos usuário–Propriedade | 148 |
| Talhões lógicos | 472, sendo 2 de QA sem geometria |
| Geometrias de Talhão | 470 |
| Visitas demonstrativas | 75, sendo 5 cenários dirigidos de QA |
| Cadernos demonstrativos | 76, sendo 6 cenários dirigidos de QA |
| Períodos produtivos locais | 4 cenários dirigidos de QA |
| Materiais técnicos | 8 cenários dirigidos de QA |

As 70 Propriedades vindas da fonte autorizada mantêm um Titular principal e um
Colaborador vinculados diretamente. Um Produtor pode titularizar várias
Propriedades. As três Propriedades sintéticas exercitam vínculo autorizado,
vínculo inativo, Propriedade inativa, Propriedade sem Talhões e Talhão sem
geometria.

## Divisão Dos Colaboradores

- Base autorizada — Victor: 18 Produtores e 35 Propriedades.
- Base autorizada — Bruna Brito: 18 Produtores e 35 Propriedades.
- Com a cobertura de QA — Victor: 37 vínculos ativos de Propriedade.
- Com a cobertura de QA — Bruna Brito: 36 vínculos ativos de Propriedade.

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

Nas 70 Propriedades autorizadas, `area_total` e `cultura_principal` permanecem
ausentes porque o KML não fornece esses valores cadastrais.
`area_mapeada_ha` pertence apenas ao artefato de geometria e não substitui área
cadastrada. Duas Propriedades sintéticas possuem área e cultura preenchidas
somente para validar a apresentação dos campos opcionais.

## Contas Demonstrativas

As contas abaixo não são credenciais reais:

- César: `admin.cesar@example.com` / `admin123`;
- Bruna: `admin.bruna@example.com` / `admin123`;
- Victor: `colaborador.victor@example.com` / `colab123`;
- Bruna Brito: `colaborador.bruna.brito@example.com` / `colab123`;
- Produtores: e-mails técnicos `@example.com` e senha comum `prod123`.
- Produtor QA ativo: `qa.produtor.ativo@example.com` / `qaAtivo123`;
- Produtor QA pendente: `qa.produtor.pendente@example.com` / `qaPendente123`;
- Produtor QA inativo: `qa.produtor.inativo@example.com` / `qaInativo123`;
- Colaborador QA inativo: `qa.colaborador.inativo@example.com` /
  `qaColabInativo123`.

A relação base fica em `src/auth/generated/mockV2DemoCredentials.json`; as
quatro contas dirigidas ficam na complementação de QA. Senhas não pertencem ao
contrato `UsuarioV2` e só são transformadas em hash e salt na instalação.

## Dados Sintéticos

O KML não contém Visitas, Cadernos, Períodos Produtivos ou Materiais. Os 70
registros base de Visita e Caderno continuam sintéticos. A complementação
acrescenta uma matriz pequena e dirigida:

- Visitas agendadas futura e vencida, realizada com histórico, cancelada com
  motivo e anulada;
- os seis tipos atuais do Caderno: observação, plantio, aplicação, colheita,
  ocorrência e outro;
- rascunho, registrado, arquivado e anulado, conteúdo visível e restrito ao
  Produtor, complemento e localização explícita;
- Safra e Safrinha planejada, em andamento e encerrada, além de um registro
  removido;
- cinco mapas PNG que reutilizam assets demonstrativos já embarcados, um PDF e
  um ZIP propositalmente indisponíveis e um material em rascunho fora do
  catálogo publicado.

Tudo que foi acrescentado possui `[QA]` no conteúdo visual ou observação
equivalente e não deve ser interpretado como fato, recomendação agronômica ou
arquivo real de cliente. Os 470 limites autorizados continuam sendo as únicas
geometrias; os Talhões de QA sem geometria exercitam o estado de ausência.

## Artefatos E Regeneração

- seed: `src/api/generated/mockV2DemoSeed.json`;
- geometria: `src/assets/geojson/generated/mockV2DemoTalhoes.geojson.json`;
- credenciais: `src/auth/generated/mockV2DemoCredentials.json`;
- divisão: `docs/project/generated/mock-v2-colaboradores.json`;
- gerador: `scripts/generateMockV2DemoData.py`.
- complementação aditiva de QA: `src/api/mockV2DemoQaCoverage.ts`.

O gerador exige Python com Shapely, a fonte KML e os dois arquivos oficiais do
IBGE usados como entrada. A geração é determinística para a mesma fonte e
mantém IDs independentes da ordem dos registros.

## Bootstrap Implementado

A rotina `src/api/mockV2DemoBootstrap.ts`:

1. identifica se o dataset v2 já foi instalado;
2. remove apenas o pacote demonstrativo v1 e seus artefatos locais;
3. instala o snapshot, as credenciais e os períodos locais dirigidos;
4. invalida sessão vinculada a IDs antigos;
5. em snapshot do mesmo dataset, acrescenta somente IDs de QA ausentes;
6. preserva registros, períodos e credenciais adicionais criados localmente.

A preparação é executada antes da montagem dos providers e da restauração da
sessão. Snapshot v2 inválido bloqueia substituição automática e apresenta uma
tentativa controlada, preservando o conteúdo existente. Credenciais são
gravadas com hash e salt; as senhas demonstrativas em texto não entram no
AsyncStorage.

O progresso da limpeza de chaves e arquivos é registrado separadamente. Se a
remoção de algum diretório falhar, a abertura seguinte repete apenas a parcela
pendente e não apaga dados novos já criados no v2.

Cobertura automática: instalação nova, atualização do v1, migração da versão
anterior do mesmo dataset, repetição idempotente, preservação de registro,
período e credencial locais, preservação de outro v2, bloqueio de snapshot
corrompido, rollback de escrita, retomada de limpeza parcial e acesso rápido
dos três perfis.

## Próxima Etapa

A instalação aditiva e o recorte principal da matriz final passaram no Android
físico. Corrigir e retestar `BUG-QA-01` e `BUG-QA-02`, decidir os ajustes P2
`UX-QA-01`/`UX-QA-02` e concluir os recortes pendentes de `QA-FINAL-09`,
`QA-FINAL-10`, `ATUAL-06` e `ATUAL-07`. O PDF/ZIP ausente e o Talhão de QA sem geometria continuam sendo
casos intencionais; o defeito está na ausência de feedback e no acoplamento da
lista lógica à geometria, não na existência desses cenários.
