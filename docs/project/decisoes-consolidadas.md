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

## 2. `produtor` e o termo provisório oficial da documentacao ativa

### Decisao

Enquanto a Fase 2 nao consolidar definitivamente a nomenclatura do dominio, a documentacao ativa usa `produtor` como termo provisório principal para o perfil final ligado as fazendas.

### Alcance

Afeta documentacao ativa, linguagem de produto e interpretacao do dominio.

### Impacto

Alias historicos como `cliente` e `proprietario` podem aparecer apenas para explicar inconsistencias antigas, mas nao devem conduzir a redacao principal dos documentos vivos.

---

## 3. Um produtor pode estar ligado a uma ou mais fazendas

### Decisao

O dominio do projeto deve considerar a possibilidade de um mesmo produtor estar vinculado a mais de uma fazenda.

### Alcance

Afeta modelagem, navegacao, filtros, visibilidade e regras de acesso.

### Impacto

Fluxos de consulta, permissao e organizacao de dados nao devem assumir relacao simples de um produtor para uma unica fazenda.

---

## 4. A fazenda e a unidade central de contexto dos dados

### Decisao

Mapas, arquivos, visitas e registros devem ser lidos no contexto da fazenda a que pertencem.

### Alcance

Afeta UX, organizacao das telas, estrutura de dados e regras de visibilidade.

### Impacto

O sistema nao deve tratar mapas e materiais tecnicos como elementos soltos, desconectados do produtor e da fazenda.

---

## 5. O MVP prioriza consulta organizada e operacao principal

### Decisao

O MVP atual prioriza o nucleo operacional do produto:

- acesso por perfil
- consulta por produtor e fazenda
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

## 9. O caderno de campo deve nascer enxuto

### Decisao

O caderno de campo nao deve ser expandido de forma ampla e generica logo no inicio. Ele deve priorizar informacao realmente util ao contexto operacional.

### Alcance

Afeta formulários, escopo funcional e criterio de evolucao do modulo.

### Impacto

Novos campos e comportamentos do caderno devem ser avaliados pelo valor operacional real, e nao apenas por desejo de cobertura total do dominio.

---

## 10. Mapas e limites formam uma experiencia unica de panorama no MVP

### Decisao

No MVP, o usuario nao deve navegar por duas experiencias concorrentes de `Mapas` e `Limite` quando o objetivo pratico for visualizar o panorama da fazenda. A interface deve apresentar uma experiencia unica de panorama/mapa da fazenda.

### Alcance

Afeta a UX de mapas, a leitura da entidade `LimiteArea` e a estrategia de ingestao de arquivos geoespaciais.

### Impacto

- `LimiteArea` permanece como camada tecnica de demarcacao dos talhoes, vinculada a `fazenda_id`.
- A tela de mapas deve tratar a demarcacao como base do panorama, e nao como uma aba funcional separada.
- Materiais tecnicos, PDFs, imagens e arquivos associados continuam existindo como biblioteca de materiais no contexto da fazenda.
- O app deve consumir um arquivo final normalizado, preferencialmente GeoJSON ou JSON equivalente, em vez de carregar no celular o pacote bruto de arquivos `.shp`, `.shx`, `.dbf`, `.prj`, `.kml`, `.kmz` ou metadados auxiliares.
- Para acelerar o MVP, a validacao local pode usar um conversor de desenvolvimento que gera o arquivo final a partir dos originais, mas a conversao produtiva futura deve acontecer fora do app, em backend ou processo operacional controlado.
