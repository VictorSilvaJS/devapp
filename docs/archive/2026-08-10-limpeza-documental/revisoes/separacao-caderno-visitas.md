# Separação de Responsabilidades: Caderno de Campo e Visitas

## Resumo da Mudança

Foi realizada a separação entre **Caderno de Campo** e **Visitas Técnicas**, que anteriormente estavam juntos na mesma tela. Agora cada módulo possui sua própria responsabilidade e interface dedicada.

---

## Caderno de Campo (`CadernoCampoScreen.js`)

### Responsabilidade
Registrar **atividades agrícolas** realizadas na propriedade, como plantio, adubação, aplicações, colheitas, análises de solo e vistorias.

### Campos Principais
- **Tipo de Atividade**: plantio, adubação, aplicação, colheita, análise_solo, vistoria, outro
- **Talhão**: onde a atividade foi realizada
- **Produtos Utilizados**: lista de produtos aplicados
- **Dosagem**: quantidade/dosagem dos produtos
- **Área Aplicada**: hectares trabalhados
- **Condições Climáticas**: clima durante a atividade
- **Observações**: detalhes sobre a execução
- **Colaborador Responsável**: quem realizou a atividade
- **Visibilidade**: se o cliente pode ver o registro

### Características Visuais
- Ícone: `book-outline`
- Cor dinâmica baseada no tipo de atividade
- Exibe produtos utilizados e dosagem em destaque
- Mostra condições climáticas
- Área aplicada em hectares

---

## Visitas Técnicas (`VisitasScreen.js`)

### Responsabilidade
Registrar **visitas de técnicos** à propriedade, incluindo consultorias, coletas de solo, avaliações de cultivo e entregas de material.

### Campos Principais
- **Objetivo**: consultoria, coleta_solo, avaliacao_cultivo, entrega_material, outro
- **Data da Visita**: quando ocorreu
- **Técnico Responsável**: quem realizou a visita
- **Status**: agendada, realizada, cancelada
- **Observações**: notas da visita
- **Recomendações**: orientações técnicas dadas
- **Clima**: condições climáticas durante a visita
- **Próxima Visita**: data sugerida para retorno

### Características Visuais
- Ícone dinâmico baseado no objetivo (people, flask, leaf, cube)
- Badge de status (agendada/realizada/cancelada)
- Destaque para o objetivo da visita
- Exibe data da próxima visita quando disponível
- Recomendações técnicas em destaque

---

## Diferenças Principais

| Aspecto | Caderno de Campo | Visitas Técnicas |
|---------|------------------|------------------|
| **Foco** | Atividades operacionais | Visitas e consultorias |
| **Quem registra** | Colaborador responsável | Técnico responsável |
| **Produtos** | ✅ Sim (com dosagem) | ❌ Não |
| **Recomendações** | ❌ Não | ✅ Sim |
| **Status** | ❌ Não | ✅ Sim (agendada/realizada) |
| **Próxima ação** | ❌ Não | ✅ Data próxima visita |
| **Talhão** | ✅ Sim | ❌ Não (visita geral) |
| **Área aplicada** | ✅ Sim | ❌ Não |

---

## Navegação Atualizada

### Admin
- **Home**: Dashboard
- **Produtores**: Lista de produtores
- **Visitas**: `VisitasScreen` (nova tela separada)
- **Caderno**: `CadernoCampoScreen`
- **Perfil**: Perfil do usuário

### Colaborador
- **Home**: Dashboard
- **Meus Produtores**: Lista de produtores da região
- **Minhas Visitas**: `VisitasScreen` (nova tela separada)
- **Caderno**: `CadernoCampoScreen`
- **Perfil**: Perfil do usuário

### Cliente
- **Minha Propriedade**: Dashboard do cliente
- **Histórico**: `CadernoCampoScreen` (apenas registros visíveis)
- **Perfil**: Perfil do usuário

---

## Arquivos Modificados

### Criados
- `src/screens/VisitasScreen.js` - Nova tela para visitas técnicas

### Modificados
- `src/screens/CadernoCampoScreen.js` - Removido campos de visita, adicionado exibição de produtos e dosagem
- `src/navigation/index.js` - Atualizado para usar `VisitasScreen` nas tabs de visitas
- `src/api/mock.js` - Dados de cadernos atualizados com produtos, dosagem e clima
- `entities/CadernoCampo.json` - Removido campo `recomendacoes`

---

## Benefícios da Separação

1. **Clareza de Responsabilidade**: Cada módulo tem seu propósito bem definido
2. **Melhor UX**: Interface específica para cada tipo de registro
3. **Facilidade de Manutenção**: Código mais organizado e fácil de entender
4. **Escalabilidade**: Mais fácil adicionar funcionalidades específicas de cada módulo
5. **Dados Estruturados**: Campos apropriados para cada contexto

---

## Próximos Passos Sugeridos

1. Adicionar funcionalidade de criar novos registros de caderno
2. Adicionar funcionalidade de criar/editar visitas
3. Filtros avançados por período e tipo
4. Relatórios separados para cada módulo
5. Exportação de dados em PDF
6. Notificações para visitas agendadas
