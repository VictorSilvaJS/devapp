# Offline e Sincronização

## Premissa

O projeto deve considerar desde o início que o uso em campo pode acontecer com internet limitada ou inexistente.

## Diretriz consolidada

A primeira prioridade do offline é permitir consulta/visualização do que for necessário em campo.

## Prioridades de arquitetura

### 1. Consulta antes de edição complexa
O MVP deve priorizar leitura, navegação e consulta offline antes de prometer fluxos complexos de edição completa sem internet.

### 2. Sincronização posterior
Sempre que possível, a sincronização deve acontecer quando a conexão for restabelecida.

### 3. Escopo claro do offline
Nem tudo precisa funcionar offline no mesmo nível. O projeto deve declarar explicitamente:
- o que pode ser consultado offline;
- o que pode ser registrado offline;
- o que exige conexão.

## Regra de produto

Nunca prometer experiência offline total sem definição técnica clara. O offline deve ser descrito por capacidade real, não por marketing.
