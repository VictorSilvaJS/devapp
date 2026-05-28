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

## 12. Mapas e limites formam uma experiencia unica de panorama no MVP

### Decisao

No MVP, o usuario nao deve navegar por duas experiencias concorrentes de `Mapas` e `Limite` quando o objetivo pratico for visualizar o panorama da propriedade. A interface deve apresentar uma experiencia unica de panorama/mapa da propriedade.

### Alcance

Afeta a UX de mapas, a leitura da entidade `LimiteArea` e a estrategia de ingestao de arquivos geoespaciais.

### Impacto

- `LimiteArea` permanece como camada tecnica de demarcacao dos talhoes, vinculada a `fazenda_id` enquanto essa for a chave interna do contexto de propriedade.
- A tela de mapas deve tratar a demarcacao como base do panorama, e nao como uma aba funcional separada.
- Materiais tecnicos, PDFs, imagens e arquivos associados continuam existindo como biblioteca de materiais no contexto da propriedade.
- Para a primeira versao de testes, materiais tecnicos devem ser organizados por `fazenda_id`, campo/talhao, recorte temporal e elemento/camada quando aplicavel.
- O foco inicial dos materiais liberaveis deve ser mapas de diagnostico, especialmente fertilidade por elemento/camada, como argila, fosforo, pH, potassio e materia organica.
- No MVP atual, o mapa interativo e apenas a base de talhoes/limites. Mapas de elementos, como PNGs de fertilidade, devem ser tratados como anexos visuais da biblioteca de materiais.
- PNGs de elementos nao devem ser sobrepostos ao mapa interativo nesta etapa. A experiencia esperada e abrir o PNG como imagem/anexo para consulta.
- Arquivos tecnicos operacionais disponiveis no acervo, como sementes ou linhas de plantio, podem ser anexados e liberados quando fizerem sentido para a propriedade, mas nao devem virar uma experiencia separada da biblioteca de materiais da propriedade.
- O app deve consumir um arquivo final normalizado, preferencialmente GeoJSON ou JSON equivalente, em vez de carregar no celular o pacote bruto de arquivos `.shp`, `.shx`, `.dbf`, `.prj`, `.kml`, `.kmz` ou metadados auxiliares.
- Para acelerar o MVP, a validacao local pode usar um conversor de desenvolvimento que gera o arquivo final a partir dos originais, mas a conversao produtiva futura deve acontecer fora do app, em backend ou processo operacional controlado.
- Para SHP, nomes de talhoes devem ser obtidos dos campos do `.dbf`; para KML/KMZ, dos elementos `<name>`; para GeoJSON pronto, das `properties`.
- Cada importacao real deve registrar manifesto com campos encontrados, campo de nome usado, quantidade de talhoes, quantidade de poligonos/partes e status de revisao.
- O fluxo real deve ter pre-visualizacao e aprovacao por equipe autorizada antes de publicar o GeoJSON/JSON final no app ou backend.
