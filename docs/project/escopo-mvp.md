# Escopo do MVP

Este documento define o que deve ser tratado como parte do MVP atual, o que fica fora por padrao e o que ainda depende de definicao adicional. Seu objetivo e reduzir ambiguidade de escopo antes da evolucao do codigo e da arquitetura.

## Objetivo do MVP

Entregar uma base funcional para a operacao principal do produto, priorizando consulta organizada, acesso correto por perfil e suporte ao trabalho tecnico em torno de produtor, propriedade, mapas, visitas e registros de campo.

O MVP nao deve assumir como obrigatorio tudo o que ja foi discutido historicamente para o projeto.

## Faz Parte do MVP Atual

### 1. Estrutura de acesso por perfil

O MVP deve sustentar tres visoes principais:

- administracao geral
- colaborador regional
- produtor

Isso inclui navegacao coerente com o perfil e restricao de acesso aos dados conforme o escopo de cada usuario.

### 2. Organizacao por produtor e propriedade

O MVP deve permitir organizar a consulta a partir de produtor e propriedade, incluindo o caso em que um mesmo produtor esteja ligado a mais de uma propriedade. Internamente, a implementacao atual ainda pode usar `fazenda_id` como chave operacional.

### 3. Biblioteca de mapas e arquivos no contexto da propriedade

O MVP deve contemplar:

- organizacao de mapas e arquivos por contexto de propriedade
- consulta dos materiais disponiveis
- controle de visibilidade por perfil
- materiais tecnicos liberaveis para consulta/download, organizados por propriedade, campo/talhao, safra/ano e elemento/camada quando aplicavel
- panorama visual unico da propriedade quando houver demarcacao de talhoes
- uso de limites/shapes como base tecnica de demarcacao, nao como experiencia separada para o usuario final

Nao implica, por si so, que todos os fluxos de upload, download ou processamento avancado ja estejam completos na implementacao atual.

Para a primeira versao de testes, o corte funcional da biblioteca de materiais deve priorizar mapas tecnicos que produtor e equipe possam acessar, principalmente diagnosticos como fertilidade por elemento/camada, por exemplo argila, fosforo, pH, potassio e materia organica. Outros arquivos tecnicos disponiveis no acervo, como sementes, linhas de plantio ou materiais operacionais, podem aparecer quando forem liberados, mas nao devem deslocar o foco inicial dos diagnosticos.

Na evolucao operacional da biblioteca de mapas, a interface deve organizar os
materiais no contexto `Propriedade -> Ano -> Categoria`, com as categorias
principais restritas a Fertilidade, Correcao de solo e Prescricao. Para novos
anexos do MVP local, um fluxo unificado aceita PNG, PDF ou ZIP, preserva o nome
original e gera o titulo automaticamente. Ano e obrigatorio; Safra/Safrinha e
um vinculo opcional com periodo produtivo da mesma Propriedade.

Os campos adicionais sao condicionais: Fertilidade registra profundidade e
fica no escopo da Propriedade; Correcao registra profundidade e escolhe entre
Propriedade inteira ou Talhao; Prescricao nao exige profundidade, camada ou
Talhao no corte atual. A opcao `Nao informada` evita inventar profundidade
quando o acervo nao a comprova. A visibilidade para o Produtor continua
explicita. O contrato canonico esta em `modelo-material-tecnico.md`.

O fluxo e local/demonstrativo: o arquivo fisico fica no storage interno e
apenas metadados pequenos ficam no indice local. Cada material abre por id,
versao e contexto autorizado da Propriedade. Imagens abrem em modal de tela
cheia e podem ser ampliadas por pinca, toque duplo ou botoes acessiveis, com
arraste limitado ao quadro quando ampliadas. Gestos iniciados dentro do quadro
nao rolam a pagina externa. Uma camada so e apresentada como
mapa quando carrega geometria GeoJSON
renderizavel, com legenda e metadados. PDF usa visualizacao real embutida onde
a plataforma suporta ou um visualizador compativel do sistema, sem simular
sucesso. ZIP permanece sem preview, unzip ou leitura/processamento de
conteudo. Acoes de arquivo dependem de autorizacao, disponibilidade e URI
abrivel. Isso nao representa backend, sincronizacao, URL assinada, publicacao
automatica ou download remoto produtivo. Registros PNG e ZIP anteriores
continuam legiveis por compatibilidade.

Para o MVP, a entrada ideal para visualizacao no app e um arquivo final normalizado, preferencialmente GeoJSON ou JSON equivalente, ja convertido a partir dos originais fora do celular.

No mock, esse corte pode ser validado com uma amostragem controlada de uma propriedade e um ano. A demarcacao real da propriedade Sela de Prata I foi convertida a partir de shapefile para um GeoJSON/JSON final, sem incluir analises de solo, NDVI, prescricoes ou dados agronomicos que nao estejam nesse arquivo vetorial.

### 4. Visitas tecnicas

O MVP deve incluir o registro e a consulta de visitas tecnicas ligadas ao contexto do produtor e da propriedade.

Fotos demonstrativas ja associadas a uma Visita podem ser abertas em modal de
tela cheia, ampliadas por pinca, toque duplo ou botoes e baixadas para o
storage interno somente quando a URI estiver disponivel e o perfil mantiver
acesso a Visita e a Propriedade. Isso nao inclui captura real, galeria,
georreferenciamento, backend ou sincronizacao de fotos.

### 5. Caderno de campo enxuto

O MVP deve incluir um caderno de campo orientado ao uso operacional, sem tentar cobrir desde o inicio um universo amplo e generico de funcionalidades agricolas.

Fotos demonstrativas ja existentes em um registro seguem a mesma experiencia
de ampliacao e a mesma revalidacao de download das fotos de Visita, respeitando
tambem a visibilidade do registro para o Produtor.

No corte demonstrativo atual, Safra/Safrinha pode existir como organizacao
local e opcional por Propriedade para ajudar a contextualizar registros do
Caderno. Isso nao transforma periodo produtivo em modelo final de backend nem
em requisito obrigatorio para salvar registros.

### 6. Consulta em contexto de internet limitada

O MVP deve considerar operacao em campo com conectividade ruim. A prioridade aqui e viabilizar consulta e visualizacao de forma segura e realista, sem prometer capacidades offline totais que ainda nao estejam definidas.

## Fora do MVP por Padrao

Os itens abaixo nao devem ser assumidos como parte obrigatoria do MVP sem decisao explicita posterior:

- modulo financeiro completo
- assinatura digital com validade formal
- analytics avancado
- integracoes externas complexas ainda nao estabilizadas
- expansao ampla de notificacoes alem do necessario ao fluxo principal
- recursos de IA ou automacoes dependentes de dados e infraestrutura ainda nao consolidados
- versao web completa como desdobramento imediato do app atual

## Depende de Definicao Adicional

Alguns temas fazem parte do contexto do produto, mas ainda nao devem ser tratados como escopo fechado do MVP sem definicao adicional:

- taxonomia final de categorias de mapas
- detalhamento final do caderno de campo
- nivel exato de capacidade offline por fluxo
- experiencia final do produtor ao navegar entre propriedades, historico e materiais
- fronteira entre consulta simples e operacoes de manutencao mais avancadas

Esses pontos devem ser aprofundados em `pendencias-de-definicao.md`, e nao promovidos automaticamente a requisito fechado.

## Criterio de Prioridade Dentro do MVP

Quando houver conflito de prioridade, favorecer o que melhora primeiro:

1. clareza de dominio
2. acesso correto por perfil
3. organizacao por produtor e propriedade
4. mapas e arquivos no contexto certo
5. operacao em campo
6. navegacao simples e compreensivel

## Como Interpretar Este Escopo

Este documento define o que pertence ao nucleo do produto nesta etapa. Ele nao afirma:

- que tudo aqui ja esteja implementado no repositório atual
- que todo item do MVP ja esteja fechado em detalhe
- que backlog futuro passe automaticamente a fazer parte da entrega principal

Para entender o que ja existe hoje, consulte `estado-atual.md`. Para evolucao futura, consulte `roadmap-futuro.md`.
