# Atualizações - 27 de Fevereiro de 2026

Documento de revisão detalhando todas as alterações realizadas nesta rodada de melhorias.

---

## Arquivos Alterados

| Arquivo | Tipo de Alteração |
|---------|-------------------|
| `src/components/FiltroRegional.js` | Reescrita significativa (lógica + layout) |
| `src/screens/VisitaDetailScreen.js` | Adição de imports e hook de auto-refresh |

---

## Issue 1 — Fazendas de outros colaboradores aparecendo no filtro

### Problema
Quando Carlos (sub_regiões: Goiás 1, Rio Verde, Jataí) abria o filtro de fazendas, apareciam também as fazendas de Patrícia (sub_regiões: Goiás 2, Goiânia, Anápolis), porque ambos pertencem à região "Goiás" e o filtro carregava TODAS as fazendas da região sem considerar as sub-regiões específicas de cada colaborador.

### Causa raiz
O `FiltroContext.loadFazendas()` filtra por `filtros.regiao` (ex: "Goiás"), retornando todas as fazendas da região. O componente `FiltroRegional` usava essa lista completa sem filtrar pelas `microregiaoOptions` (sub_regioes do user).

### Correção
**Arquivo:** `src/components/FiltroRegional.js` — **Linhas 33-36**

```javascript
// ANTES: usava `fazendas` direto do contexto (todas da região)

// DEPOIS: filtra pelas sub_regioes do colaborador
const fazendasDisponiveis = microregiaoOptions
  ? fazendas.filter(f => microregiaoOptions.includes(f.microregiao))
  : fazendas;
```

**Comportamento novo:**
- Carlos agora só vê fazendas pertencentes a Goiás 1, Rio Verde e Jataí
- Patrícia agora só vê fazendas pertencentes a Goiás 2, Goiânia e Anápolis
- Admin continua vendo todas as fazendas normalmente

---

## Issue 2 — Remover cadeado e redesign do filtro para colaborador

### Problema
Para o perfil colaborador, a região aparecia como um botão com ícone de cadeado 🔒, dando impressão de que era um filtro bloqueado. O usuário queria que a região fosse apenas uma informação visual, e que o colaborador tivesse apenas os filtros de micro-região e fazenda.

### Causa raiz
O layout era único para admin e colaborador, com o botão de região sendo desabilitado (`disabled`) e estilizado com `opacity: 0.85` + ícone de cadeado.

### Correção
**Arquivo:** `src/components/FiltroRegional.js` — **Linhas 115-210 (renderização JSX)**

A renderização agora é dividida em dois blocos separados com `{fixedRegiao ? (...) : (...)}`:

#### Modo Colaborador (`fixedRegiao` definido):

```
┌──────────────────────────────────┐
│ 📍 Região: Goiás                │  ← Faixa informativa (não clicável)
├──────────────────────────────────┤
│ [Micro-região ▼] [Fazenda ▼] ✕  │  ← Apenas 2 filtros + limpar
├──────────────────────────────────┤
│ 🔽 Filtrado: Rio Verde • Faz... │  ← Indicador (só quando filtrado)
└──────────────────────────────────┘
```

**Elementos adicionados:**
- `regiaoInfoContainer` — View com fundo verde claro (`#e8f5e8`), ícone de localização e texto "Região: {fixedRegiao}". Puramente informativo, sem `onPress`.
- `temFiltroAtivoColaborador()` — Função auxiliar (linha 101-103) que verifica filtros ativos ignorando a região fixa (verifica apenas `microregiao` e `fazenda`).
- O indicador de filtro ativo agora mostra os campos filtrados concatenados (ex: "Rio Verde • Fazenda Planalto").

#### Modo Admin (sem `fixedRegiao`):
Permanece igual ao anterior — 2 linhas de filtros (Região + Micro-região / Fazenda + Limpar) com indicador "Visualizando: ...".

**Elementos removidos:**
- Ícone `lock-closed` (cadeado) — removido completamente
- Estilo `filtroButtonFixo` com `opacity: 0.85` — removido do StyleSheet
- O botão de região como `TouchableOpacity disabled` para colaborador — substituído pela faixa informativa

**Novos estilos (StyleSheet):**
```javascript
regiaoInfoContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 10,
  backgroundColor: '#e8f5e8',
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 8,
},
regiaoInfoText: {
  fontSize: 14,
  color: colors.primary,
  fontWeight: '700',
  flex: 1,
},
```

---

## Issue 3 — Agrupar fazendas por proprietário no modal

### Problema
No modal de seleção de fazenda, todas as fazendas apareciam em lista plana, sem indicar que um mesmo produtor pode possuir múltiplas propriedades. Isso dava a impressão de que cada fazenda era de um produtor diferente.

### Causa raiz
O modal iterava `fazendas.map(...)` de forma linear, listando cada fazenda individualmente.

### Correção
**Arquivo:** `src/components/FiltroRegional.js`

#### 1. Agrupamento por proprietário (Linhas 39-47)
```javascript
const fazendasAgrupadas = (() => {
  const grupos = {};
  fazendasDisponiveis.forEach(f => {
    const key = f.produtor; // nome do proprietário
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(f);
  });
  return grupos;
})();
```

#### 2. Renderização agrupada no modal de fazenda (Linhas ~490-540)
Antes: `fazendas.map((fazenda) => ...)` — lista plana
Depois: `Object.entries(fazendasAgrupadas).map(...)` — com cabeçalho por proprietário

```
┌──────────────────────────────────────┐
│ 📋 Selecionar Fazenda / Propriedade │  ← Título atualizado
├──────────────────────────────────────┤
│ [✓] Todas as Fazendas               │
├──────────────────────────────────────┤
│ 👤 Roberto Oliveira — 2 propriedades│  ← Cabeçalho do proprietário
│   🏠 Fazenda Planalto               │
│      Rio Verde • Jataí              │  ← Subtexto com micro-região + cidade
│   🏠 Fazenda Cerrado Alto           │
│      Jataí • Jataí                  │
├──────────────────────────────────────┤
│ 👤 Antônio Ferreira — 2 propriedades│
│   🏠 Fazenda Ouro Branco            │
│      Goiânia • Goiânia              │
│   🏠 Fazenda Santa Helena           │
│      Anápolis • Anápolis            │
└──────────────────────────────────────┘
```

**Novos estilos:**
```javascript
proprietarioHeader: {    // Cabeçalho do grupo
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  paddingHorizontal: spacing.sm,
  paddingTop: spacing.md,
  paddingBottom: 6,
},
proprietarioText: {      // Nome do proprietário
  fontSize: 13,
  fontWeight: '700',
  color: colors.text,
  flex: 1,
},
proprietarioCount: {     // Contagem de propriedades
  fontSize: 11,
  color: colors.textLight,
  fontWeight: '500',
},
fazendaItem: {           // Indentação das fazendas
  marginLeft: 8,
},
```

**Mudança no subtexto da fazenda:**
- Antes: mostrava `{fazenda.produtor} • {fazenda.cidade}` (redundante, pois o produtor já está no cabeçalho)
- Depois: mostra `{fazenda.microregiao} • {fazenda.cidade}` (informação mais útil)

---

## Issue 4 — VisitaDetailScreen não atualiza após edição

### Problema
Ao editar uma visita (adicionar fotos, alterar informações) e voltar para a tela de detalhes, os dados antigos continuavam exibidos. Era necessário voltar à lista e reentrar na visita para ver as alterações.

### Causa raiz
O `useEffect` do `VisitaDetailScreen` tinha dependência `[visitaId]`. Quando o `EditarVisitaScreen` chamava `navigation.goBack()`, a tela de detalhes apenas voltava ao foco — o `visitaId` não mudava, então `loadVisita()` nunca era re-executado.

### Correção
**Arquivo:** `src/screens/VisitaDetailScreen.js` — **Linhas 1-47**

#### 1. Novos imports (Linha 1 e 13)
```javascript
// ANTES
import React, { useState, useEffect } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';

// DEPOIS
import React, { useState, useEffect, useCallback } from 'react';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
```

#### 2. Substituição do useEffect por useFocusEffect (Linhas 42-47)
```javascript
// ANTES
useEffect(() => {
  loadVisita();
}, [visitaId]);

// DEPOIS
useFocusEffect(
  useCallback(() => {
    if (visitaId) loadVisita();
  }, [visitaId])
);
```

**Comportamento novo:**
- `useFocusEffect` é chamado toda vez que a tela ganha foco (incluindo ao voltar via `goBack()`)
- `useCallback` com `[visitaId]` evita re-criação desnecessária do callback
- A verificação `if (visitaId)` previne chamadas com ID undefined
- Agora, ao voltar de `EditarVisitaScreen`, os dados são automaticamente recarregados

---

## Checklist de Revisão

| # | Correção | Testar com | O que validar |
|---|----------|------------|---------------|
| 1 | Filtro fazendas por sub_regiões | Login Carlos → Filtro Fazenda | Só aparecem fazendas de Goiás 1, Rio Verde, Jataí |
| 1 | Filtro fazendas por sub_regiões | Login Patrícia → Filtro Fazenda | Só aparecem fazendas de Goiás 2, Goiânia, Anápolis |
| 1 | Filtro fazendas por sub_regiões | Login Admin → Filtro Fazenda | Aparecem todas as fazendas (sem filtro de escopo) |
| 2 | Layout colaborador sem cadeado | Login Carlos → Dashboard | Região aparece como faixa informativa, sem cadeado, sem botão |
| 2 | Layout colaborador sem cadeado | Login Carlos → Dashboard | Apenas pickers de Micro-região e Fazenda |
| 2 | Layout admin inalterado | Login Admin → Dashboard | Layout com 2 linhas (Região+Micro / Fazenda+Limpar) |
| 3 | Agrupamento por proprietário | Qualquer login → Modal Fazenda | Fazendas agrupadas sob nome do proprietário com contagem |
| 4 | Auto-refresh detalhes visita | Abrir visita → Editar → Salvar → Voltar | Dados atualizados automaticamente sem precisar sair e voltar |
