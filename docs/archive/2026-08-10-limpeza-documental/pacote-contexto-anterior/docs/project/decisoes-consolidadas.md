# Decisões Consolidadas

## 1. Estrutura de perfis

### Decisão
O sistema trabalhará com três visões principais:
- administração geral;
- colaborador regional;
- cliente/produtor.

### Impacto
Afeta autenticação, autorização, navegação, consultas e modelagem do frontend/backend.

---

## 2. Produtor = cliente = proprietário

### Decisão
No domínio atual, esses papéis são tratados como a mesma entidade de negócio.

### Impacto
Evita duplicidade conceitual na modelagem e simplifica linguagem do produto.

---

## 3. Um produtor pode ter várias fazendas

### Decisão
A estrutura do sistema deve permitir múltiplas fazendas vinculadas ao mesmo produtor.

### Impacto
Afeta modelagem de dados, navegação e permissões.

---

## 4. Mapas devem estar no contexto do produtor/fazenda

### Decisão
A consulta de mapas não deve existir de forma solta ou desconectada do contexto da propriedade.

### Impacto
Afeta menu, filtros, estrutura de telas e organização dos arquivos.

---

## 5. Offline é requisito de operação

### Decisão
O projeto deve considerar internet instável como premissa real de uso.

### Impacto
Afeta arquitetura, sincronização, UX e priorização do MVP.

---

## 6. Cliente/produtor consulta e baixa; equipe autorizada gerencia

### Decisão
O cliente/produtor não é o responsável principal por gerenciar a estrutura do sistema.

### Impacto
Afeta permissões, interface e fluxo de upload/edição.

---

## 7. Caderno de campo deve ser enxuto e útil

### Decisão
O caderno de campo não deve começar excessivamente amplo. Deve focar no que é realmente útil ao contexto operacional.

### Impacto
Afeta escopo, formulários e critérios de adoção.
