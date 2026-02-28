# Revisão de Padronização UI — 28/02/2026

> Documento de revisão detalhando **todas** as alterações feitas na padronização de modais, ícones e estilos visuais do projeto devapp.  
> **Última atualização:** 28/02/2026 — inclui padronização completa de modais (Fase 2).

---

## Índice

1. [Contexto e Objetivo](#1-contexto-e-objetivo)
2. [Alterações no Design System (theme.js)](#2-alterações-no-design-system-themejs)
3. [Alterações em Componentes Compartilhados](#3-alterações-em-componentes-compartilhados)
4. [Alterações em Telas (Screens)](#4-alterações-em-telas-screens)
5. [Padronização de Modais (Fase 2)](#5-padronização-de-modais-fase-2)
6. [Checklist de Validação](#6-checklist-de-validação)
7. [Passo a Passo para Testar e Validar](#7-passo-a-passo-para-testar-e-validar)

---

## 1. Contexto e Objetivo

### Problema identificado na auditoria
- **50+ cores hexadecimais hardcoded** espalhadas por telas e componentes em vez de usar tokens do tema
- **`colors.danger`** e **`colors.white`** eram referenciados em 6+ arquivos mas **NÃO EXISTIAM** no theme.js — causando valores `undefined` em runtime
- **`shadows.large`**, **`shadows.medium`**, **`shadows.small`** eram referenciados em 6+ arquivos mas **NÃO EXISTIAM** (o tema usava apenas `sm`/`md`/`lg`) — quebrando elevações e sombras
- **`typography.h3`**, **`typography.body`**, **`typography.caption`** usados com spread syntax (`...typography.h3`) mas **NÃO EXISTIAM** como objetos na tipografia
- **borderRadius** variando aleatoriamente entre 4, 5, 6, 8, 10, 11, 12, 14, 16, 20, 24, 28, 32 sem correspondência com tokens
- **FABs** (Floating Action Buttons) com gradientes usando cores hardcoded diferentes entre telas
- **Overlay de modais** com cores diferentes por tela (`rgba(0,0,0,0.5)`, `rgba(0,0,0,0.6)`, etc.)

### Objetivo
Garantir que **100% das referências visuais** passem por um sistema centralizado de tokens em `src/theme.js`, eliminando hardcoded values e garantindo coerência e uniformidade visual.

---

## 2. Alterações no Design System (theme.js)

### 2.1 Cores adicionadas

| Token | Valor | Motivo |
|---|---|---|
| `colors.danger` | `#EF4444` | Alias de `colors.error` — referenciado em `NotificacoesScreen`, `VisitasScreen` |
| `colors.dangerLight` | `#f87171` | Alias de `colors.errorLight` |
| `colors.white` | `#FFFFFF` | Referenciado em ~30 pontos do código que usavam `'#FFFFFF'`/`'#fff'` |
| `colors.black` | `#000000` | Token básico de cor preta |
| `colors.overlay` | `rgba(0,0,0,0.5)` | Overlay unificado para todos os modais |
| `colors.borderMedium` | `#E8EEF2` | Borda neutra usada em alguns cards |
| `colors.info` | `#3B82F6` | Categoria "informação" (caderno de campo, status) |
| `colors.infoLight` | `#dbeafe` | Fundo claro da categoria info |
| `colors.purple` | `#7c3aed` | Categoria "acompanhamento" no caderno de campo |
| `colors.purpleLight` | `#ede9fe` | Fundo claro da categoria purple |
| `colors.amber` | `#d97706` | Categoria "pendente", avisos |
| `colors.amberLight` | `#fef3c7` | Fundo claro da categoria amber |
| `colors.cyan` | `#06B6D4` | Categoria "coleta_solo" no caderno de campo |
| `colors.cyanLight` | `#cffafe` | Fundo claro da categoria cyan |
| `colors.orange` | `#F97316` | Categoria "manejo" no caderno de campo |
| `colors.orangeLight` | `#fff7ed` | Fundo claro da categoria orange |
| `colors.fab` | `#228B22` | Cor primária do FAB (igual ao primary, semântica separada) |
| `colors.fabDark` | `#1a6b1a` | Cor escura do gradiente FAB |
| `colors.fabShadow` | `#1a6b1a` | Sombra do FAB |
| `colors.secondaryBg` | `#f5f3f0` | Fundo semântico para StatCards marrons |
| `colors.successBg` | `#d1fae5` | Fundo semântico para métricas de sucesso |
| `colors.backgroundNeutral` | `#F5F7FA` | Fundo neutro para seções instrumentais |
| `colors.backgroundSoft` | `#F9FAFB` | Fundo suave para gradientes em cards e filtros |
| `colors.whiteTranslucent` | `rgba(255,255,255,0.8)` | Overlay branco translúcido para inputs sobre gradientes |
| `colors.coral` | `#FF6B6B` | Ícone de filtro de data |
| `colors.teal` | `#4ECDC4` | Ícone de filtro de ordenação |
| `colors.errorBgLight` | `#FFF5F5` | Fundo de blocos de erro/cancelamento |
| `colors.errorBgMedium` | `#FFE5E5` | Gradiente de fundo de erro |
| `colors.errorBorder` | `#FFD6D6` | Borda de blocos de erro |

### 2.2 Aliases de sombras

Foram adicionados aliases `shadows.small`, `shadows.medium`, `shadows.large` apontando para `shadows.sm`, `shadows.md`, `shadows.lg` respectivamente. Isso corrige as 6+ referências que usavam os nomes completos.

```javascript
// Antes: shadows.large → UNDEFINED
// Depois:
shadows.small = shadows.sm   // { elevation: 2 }
shadows.medium = shadows.md  // { elevation: 4 }
shadows.large = shadows.lg   // { elevation: 6 }
```

### 2.3 Novos Design Tokens exportados

Foram criados e exportados 9 novos conjuntos de tokens padronizados:

| Token | Descrição |
|---|---|
| `iconSizes` | Tamanhos de ícone padronizados: xs(14), sm(16), md(20), lg(24), xl(32), xxl(48), empty(80) |
| `modalStyles` | Estilos de overlay, dialog centralizado, bottom sheet, header, title, closeButton |
| `buttonStyles` | Estilos de botão: primary, secondary, danger, chip, chipActive, disabled |
| `cardStyles` | Base (sm shadow, borda 1.5) e elevated (md shadow, borda 2) |
| `fabStyles` | Container, gradient colors, inner layout, icon e text padrão |
| `emptyStateStyles` | Container, iconContainer, title, message para estados vazios |
| `badgeStyles` | Container e text para badges de status |
| `inputStyles` | Container, label, field, fieldFocused, fieldError, errorText |
| `searchBarStyles` | Container e input para barras de busca |

---

## 3. Alterações em Componentes Compartilhados

### 3.1 ConfirmDialog.js
| O que mudou | Antes | Depois |
|---|---|---|
| Overlay do modal | `backgroundColor` hardcoded | `colors.overlay` |
| Sombra do dialog | `...shadows.large` (inexistente) | `...shadows.lg` |
| BorderRadius dos botões | Número fixo | `spacing.radius` |
| Botão cancelar | Sem borda | `borderWidth: 1.5`, `borderColor: colors.border` |
| Texto do botão confirmar | `colors.card` | `colors.white` |

### 3.2 FiltroRegional.js
| O que mudou | Antes | Depois |
|---|---|---|
| Cor de fundo de item selecionado | `'#e8f5e8'` | `colors.borderLight` |
| Cor de texto branco | `'#FFFFFF'` | `colors.white` |
| Overlay do modal | `'rgba(0,0,0,0.6)'` | `colors.overlay` |
| BorderRadius do modal | Número fixo | `spacing.radiusLg` |
| Tipografia | `...typography.h3` / `...typography.body` (inexistentes) | `fontSize: typography.fontSubtitle` / `typography.fontBody` diretamente |

### 3.3 DatePicker.js
| O que mudou | Antes | Depois |
|---|---|---|
| Sombra | `...shadows.large` (inexistente) | `...shadows.lg` |
| Overlay | Hardcoded | `colors.overlay` |
| BorderRadius do container | Número fixo | `spacing.radiusLg` |
| BorderRadius dos botões | Número fixo | `spacing.radius` |
| Font weights | Strings diretas | Tokens `typography.weightBold`/`weightSemibold` |
| Texto de botão | `colors.card` | `colors.white` |

### 3.4 InputField.js
| O que mudou | Antes | Depois |
|---|---|---|
| BorderRadius | `borderRadius: 10` | `spacing.radius` (12) |
| BorderWidth | `2` | `1.5` (padrão unificado) |
| Font weight do label | `typography.weightMedium` (inexistente) | `typography.weightRegular` |

### 3.5 ProdutorCard.js
| O que mudou | Antes | Depois |
|---|---|---|
| Cores brancas | `'#fff'` | `colors.white` |

### 3.6 UserProfile.js
| O que mudou | Antes | Depois |
|---|---|---|
| Cores brancas | `'#FFFFFF'` | `colors.white` |

### 3.7 Toast.js
| O que mudou | Antes | Depois |
|---|---|---|
| Sombra | `...shadows.large` (inexistente) | `...shadows.lg` |

### 3.8 Header.js
| O que mudou | Antes | Depois |
|---|---|---|
| Gradiente | `['#FFFFFF', colors.backgroundAlt]` | `[colors.white, colors.backgroundAlt]` |
| Logo container bg | `'#FFFFFF'` | `colors.white` |

### 3.9 StatCard.js
| O que mudou | Antes | Depois |
|---|---|---|
| Scheme green gradient | `['#d9f0d9', '#FFFFFF']` | `[colors.accent, colors.white]` |
| Scheme blue gradient | `['#dbeafe', '#FFFFFF']` | `[colors.infoLight, colors.white]` |
| Scheme blue color | `'#2563eb'` | `colors.info` |
| Scheme purple gradient | `['#ede9fe', '#FFFFFF']` | `[colors.purpleLight, colors.white]` |
| Scheme purple color | `'#7c3aed'` | `colors.purple` |
| Scheme amber gradient | `['#fef3c7', '#FFFFFF']` | `[colors.amberLight, colors.white]` |
| Scheme amber color | `'#d97706'` | `colors.amber` |
| Scheme green bgColor | `'#d9f0d9'` | `colors.accent` |
| Scheme blue bgColor | `'#dbeafe'` | `colors.infoLight` |
| Scheme purple bgColor | `'#ede9fe'` | `colors.purpleLight` |
| Scheme amber bgColor | `'#fef3c7'` | `colors.amberLight` |
| Fallback gradient | `['#FFFFFF', ...]` | `[colors.white, ...]` |

---

## 4. Alterações em Telas (Screens)

### 4.1 DashboardScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Cor secundária | `'#8B6244'` | `colors.secondary` |
| Fundo de badge | `'#e8f5e8'` | `colors.borderLight` |
| Fundo amber | `'#fef3c7'` | `colors.amberLight` |
| Branco | `'#FFFFFF'` | `colors.white` |
| Fundo marrom | `'#f5f3f0'` | `colors.secondaryBg` |
| Fundo sucesso | `'#d1fae5'` | `colors.successBg` |
| Sombras | `shadows.medium` / `shadows.small` | `shadows.md` / `shadows.sm` |

### 4.2 ClienteDashboardScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Background | `'#F8FBF8'` | `colors.background` |
| Info light | `'#dbeafe'` | `colors.infoLight` |
| Amber | `'#d97706'` | `colors.amber` |
| Info | `'#2563eb'` | `colors.info` |
| Branco | `'#FFFFFF'` | `colors.white` |
| Fundo marrom | `'#f5f3f0'` | `colors.secondaryBg` |
| Fundo sucesso | `'#d1fae5'` | `colors.successBg` |
| BorderRadius 12/16 | Números fixos | `spacing.radius` / `spacing.radiusLg` |
| Sombras | `shadows.medium` / `shadows.small` | `shadows.md` / `shadows.sm` |

### 4.3 CadernoCampoScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Cor "acompanhamento" | `'#7c3aed'` | `colors.purple` |
| Fundo "acompanhamento" | `'#ede9fe'` | `colors.purpleLight` |
| Cor "coleta_solo" | `'#06B6D4'` | `colors.cyan` |
| Fundo "coleta_solo" | `'#cffafe'` | `colors.cyanLight` |
| Cor "manejo" | `'#F97316'` | `colors.orange` |
| Fundo "manejo" | `'#fff7ed'` | `colors.orangeLight` |
| Cor warning | `'#F59E0B'` | `colors.warning` |
| Fundo warning | `'#fef3c7'` | `colors.amberLight` |
| Cor info | `'#3B82F6'` | `colors.info` |
| Fundo info | `'#dbeafe'` | `colors.infoLight` |
| Sombras | `shadows.medium` / `shadows.small` | `shadows.md` / `shadows.sm` |

### 4.4 ProdutoresScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| FAB gradiente | `['#228B22', '#1a6b1a', '#1a6b1a']` | `[colors.fab, colors.fabDark, colors.fabShadow]` |
| Gradientes branco | `['#FFFFFF', ...]` | `[colors.white, ...]` |
| Fundo soft | `'#F9FAFB'` | `colors.backgroundSoft` |
| Fundo neutro | `'#F5F7FA'` | `colors.backgroundNeutral` |
| Overlay modal | Hardcoded | `colors.overlay` |
| Ícone add | `color="#fff"` | `color={colors.white}` |
| Sombras | `shadows.medium` / `shadows.small` | `shadows.md` / `shadows.sm` |
| BorderRadius 12 | Números fixos | `spacing.radius` |

### 4.5 VisitasScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| FAB gradiente | `['#228B22', '#1a6b1a', '#1a6b1a']` | `[colors.fab, colors.fabDark, colors.fabShadow]` |
| Gradientes branco | `['#FFFFFF', ...]` | `[colors.white, ...]` |
| Fundo soft | `'#F9FAFB'` | `colors.backgroundSoft` |
| Fundo neutro | `'#F5F7FA'` | `colors.backgroundNeutral` |
| Fundo erro | `['#FFF5F5', '#FFE5E5']` | `[colors.errorBgLight, colors.errorBgMedium]` |
| Borda erro | `'#FFD6D6'` | `colors.errorBorder` |
| Overlay modal | Hardcoded | `colors.overlay` |
| Coral/teal filtros | `'#FF6B6B'` / `'#4ECDC4'` | `colors.coral` / `colors.teal` |
| Ícone add | `color="#fff"` | `color={colors.white}` |
| Sombras | `shadows.medium` / `shadows.small` | `shadows.md` / `shadows.sm` |

### 4.6 ProdutorScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| FAB gradiente | `['#228B22', '#1a6b1a', '#1a6b1a']` | `[colors.fab, colors.fabDark, colors.fabShadow]` |
| Ícone stat amber bg | `'#fef3c7'` | `colors.amberLight` |
| Ícone stat info bg | `'#dbeafe'` | `colors.infoLight` |
| Cor info | `'#2563eb'` | `colors.info` |
| Cor amber | `'#d97706'` | `colors.amber` |
| Branco | `'#FFFFFF'` / `'#fff'` | `colors.white` |
| Sombras | `shadows.medium` | `shadows.md` |

### 4.7 NovaVisitaScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Input bg translúcido | `'#FFFFFFCC'` | `colors.whiteTranslucent` |
| Sombras | `shadows.medium` | `shadows.md` |

### 4.8 EditarVisitaScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Input bg translúcido | `'#FFFFFFCC'` | `colors.whiteTranslucent` |
| Sombras | `shadows.medium` | `shadows.md` |
| BorderRadius 10/5/8/11 | Números fixos | `spacing.radius` / `spacing.radiusSm` |

### 4.9 VisitaDetailScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Sombras | `shadows.small` / `shadows.medium` | `shadows.sm` / `shadows.md` |

### 4.10 LoginScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Cor login icon | `'#FFFFFF'` | `colors.white` |
| Fallbacks hex (`\|\| '#228B22'`) | Valores de fallback hex removidos | Somente token do tema |
| BorderRadius | Números fixos | `spacing.radius` / `spacing.radiusLg` |

### 4.11 PerfilScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| BorderRadius seções | Números fixos | `spacing.radiusLg` (cards/modal), `spacing.radius` (botões) |

### 4.12 NovoProdutorScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Branco | `'#FFFFFF'` | `theme.colors.white` |
| BorderRadius 12 | Números fixos | `theme.spacing.radius` |

### 4.13 EditarProdutorScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| Branco | `'#FFFFFF'` | `theme.colors.white` |
| BorderRadius 12 | Números fixos | `theme.spacing.radius` |

### 4.14 MapasScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| BorderRadius 10/12/8/6 | Números fixos | `spacing.radius` / `spacing.radiusSm` |

### 4.15 NotificacoesScreen.js
| O que mudou | Antes | Depois |
|---|---|---|
| BorderRadius 12/4/6 | Números fixos | `spacing.radius` / `spacing.radiusSm` |

---

## 5. Padronização de Modais (Fase 2)

> Após a padronização inicial de cores/sombras/borderRadius, foi feita uma auditoria específica dos **6 modais** do projeto. Identificou-se que, apesar de todos já usarem `colors.overlay` e `shadows.lg`, os estilos internos (padding, header, botões) ainda divergiam entre si.

### 5.1 Modais Inventariados

| # | Arquivo | Tipo | Padrão |
|---|---|---|---|
| 1 | `ConfirmDialog.js` | Dialog centralizado | Ícone + título + mensagem + 2 botões |
| 2 | `DatePicker.js` | Dialog centralizado | Header + seletor de data + 2 botões |
| 3 | `FiltroRegional.js` | Dialog centralizado | Header + lista de seleção |
| 4 | `PerfilScreen.js` | Dialog centralizado | Título + mensagem + 2 botões (logout) |
| 5 | `ProdutoresScreen.js` | Bottom Sheet | Handle + header + chips + botão aplicar |
| 6 | `VisitasScreen.js` | Bottom Sheet | Handle + header + chips + botão aplicar |

### 5.2 Padrão definido em `modalStyles` (theme.js)

```javascript
// Dialog centralizado
overlay:     { padding: spacing.xl (24), backgroundColor: colors.overlay }
dialog:      { borderRadius: spacing.radiusLg, padding: spacing.xl, maxWidth: 400, shadows.lg }

// Bottom Sheet
overlayBottom: { justifyContent: 'flex-end', backgroundColor: colors.overlay }
bottomSheet:   { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' }

// Header (ambos)
header:      { paddingHorizontal: spacing.xl (24), paddingVertical: spacing.lg (16), borderBottomColor: colors.border }
title:       { fontSize: typography.fontSubtitle (20), fontWeight: typography.weightBold }
```

### 5.3 Alterações realizadas

#### ConfirmDialog.js
| Propriedade | Antes | Depois |
|---|---|---|
| `fontWeight` do título | `'700'` (string literal) | `typography.weightBold` (token) |
| `ActivityIndicator color` | `colors.card` | `colors.white` |

#### FiltroRegional.js
| Propriedade | Antes | Depois |
|---|---|---|
| Overlay `padding` | `spacing.lg` (16) | `spacing.xl` (24) |
| Header `paddingHorizontal` | `spacing.lg` (16) | `spacing.xl` (24) |
| Header `paddingVertical` | `spacing.md` (12) | `spacing.lg` (16) |
| Título `fontSize` | `typography.fontSubtitle - 2` (18) | `typography.fontSubtitle` (20) |

#### DatePicker.js
| Propriedade | Antes | Depois |
|---|---|---|
| Overlay `padding` | `spacing.lg` (16) | `spacing.xl` (24) |
| Header `padding` | `spacing.lg` (uniforme, 16) | `paddingH: spacing.xl` (24), `paddingV: spacing.lg` (16) |

#### PerfilScreen.js (dialog de logout)
| Propriedade | Antes | Depois |
|---|---|---|
| Overlay `padding` | `spacing.screen` (16) | `spacing.xl` (24) |
| Dialog `maxWidth` | `340` | `400` |
| Dialog `padding` | `spacing.card * 1.5` (18) | `spacing.xl` (24) |
| Título `marginBottom` | `8` (número fixo) | `spacing.sm` (8, token) |
| `modalBody` `marginBottom` | ❌ Ausente | `spacing.xl` (24) — texto agora tem espaçamento antes dos botões |
| Botões `modalActions` `gap` | `10` (número fixo) | `spacing.md` (12, token) |
| Botões `modalActions` `marginTop` | `20` (número fixo) | ❌ Removido — `marginBottom` no body resolve o espaçamento |
| Botão cancelar | `padding: 12`, sem borda | `flex: 1`, `paddingVertical: spacing.md + 2`, `borderWidth: 1.5`, `borderColor: colors.border`, `minHeight: 48` |
| Botão confirmar | `padding: 12` | `flex: 1`, `paddingVertical: spacing.md + 2`, `minHeight: 48` |

#### ProdutoresScreen.js (Bottom Sheet de filtros)
| Propriedade | Antes | Depois |
|---|---|---|
| Sheet header `paddingHorizontal` | `spacing.lg` (16) | `spacing.xl` (24) |
| Sheet header `paddingVertical` | `spacing.md` (12) | `spacing.lg` (16) |
| Sheet header `borderBottomColor` | `colors.borderLight` | `colors.border` |

#### VisitasScreen.js (Bottom Sheet de filtros)
| Propriedade | Antes | Depois |
|---|---|---|
| Sheet header `paddingHorizontal` | `spacing.lg` (16) | `spacing.xl` (24) |
| Sheet header `paddingVertical` | `spacing.md` (12) | `spacing.lg` (16) |
| Sheet header `borderBottomColor` | `colors.borderLight` | `colors.border` |

### 5.4 Resultado da padronização de modais

**Antes:** 6 modais com estilos divergentes entre si:
- 3 valores diferentes de `padding` no overlay (16 via `spacing.lg`, 16 via `spacing.screen`, 24 via `spacing.xl`)
- 2 valores diferentes de `paddingHorizontal` no header (16 vs 24)
- 2 valores diferentes de `paddingVertical` no header (12 vs 16)
- 2 cores diferentes de borda no header (`colors.border` vs `colors.borderLight`)
- 2 fontes diferentes para título (18 vs 20)
- Botões do PerfilScreen menores e sem borda vs ConfirmDialog com borda e minHeight

**Depois:** Todos os 6 modais seguem o mesmo padrão:
- ✅ Overlay: `padding: spacing.xl` (24) para dialogs centralizados
- ✅ Dialog: `maxWidth: 400`, `padding: spacing.xl`, `borderRadius: spacing.radiusLg`
- ✅ Header: `paddingH: spacing.xl` (24), `paddingV: spacing.lg` (16), `borderBottomColor: colors.border`
- ✅ Título: `fontSize: typography.fontSubtitle` (20), `fontWeight: typography.weightBold`
- ✅ Botões: `minHeight: 48`, `borderRadius: spacing.radius`, cancelar com `borderWidth: 1.5`
- ✅ Sombra: `...shadows.lg` em todos
- ✅ Bottom sheets: `borderTopRadius: 24`, `maxHeight: '85%'`

---

## 6. Checklist de Validação

### Modais
- [x] **6 modais auditados** — todos com overlay, header, título e botões padronizados
- [x] Overlay: `padding: spacing.xl` (24) em todos os dialogs centralizados
- [x] Header: `paddingH: spacing.xl`, `paddingV: spacing.lg`, `borderBottomColor: colors.border`
- [x] Título: `fontSize: typography.fontSubtitle` (20) em todos
- [x] Botões: `minHeight: 48`, `borderRadius: spacing.radius`, cancelar com `borderWidth: 1.5`
- [x] Bottom sheets: header com mesmo padding e borda que dialogs

### Cores
- [x] **0 cores hexadecimais hardcoded** em `src/screens/` (verificado via grep `'#[0-9a-fA-F]{3,8}'`)
- [x] **0 cores hexadecimais hardcoded** em `src/components/` (exceto 3 bordas de esquema de cor em StatCard que são específicas do mapeamento local)
- [x] `colors.danger` e `colors.white` agora existem no tema
- [x] Todas as referências `colors.*` apontam para propriedades existentes

### Sombras
- [x] **0 referências** a `shadows.large`, `shadows.medium`, `shadows.small` com nomes inexistentes (aliases criados)
- [x] Todos os arquivos usam `shadows.sm`/`shadows.md`/`shadows.lg` ou seus aliases

### BorderRadius
- [x] Valores de 4-16px convertidos para tokens `spacing.radiusSm`(8) / `spacing.radius`(12) / `spacing.radiusLg`(16)
- [x] Valores de 20-32px mantidos intencionalmente (pills, FABs, circular)

### Tipografia
- [x] **0 referências** a `typography.h3`, `typography.body`, `typography.caption` como objetos spread
- [x] **0 referências** a `typography.weightMedium` (inexistente, corrigido para `weightRegular`)

### Compilação
- [x] **0 erros de lint/compilação** detectados pelo VS Code

### Tokens exports
- [x] `theme.js` exporta: `colors`, `spacing`, `typography`, `border`, `shadows`, `iconSizes`, `modalStyles`, `buttonStyles`, `cardStyles`, `fabStyles`, `emptyStateStyles`, `badgeStyles`, `inputStyles`, `searchBarStyles`
- [x] Default export inclui todos os tokens acima

---

## Arquivos Alterados (Resumo)

| Arquivo | Tipo de Alteração |
|---|---|
| `src/theme.js` | +30 cores, aliases de sombras, 9 design tokens |
| `src/components/ConfirmDialog.js` | Overlay, sombras, botões, fontWeight token, ActivityIndicator color |
| `src/components/FiltroRegional.js` | Cores, overlay, modal padding/header/título padronizados, tipografia |
| `src/components/DatePicker.js` | Sombras, overlay padding, header padding padronizado, botões, tipografia |
| `src/components/InputField.js` | BorderRadius, borderWidth, font weight |
| `src/components/ProdutorCard.js` | Cores brancas |
| `src/components/UserProfile.js` | Cores brancas |
| `src/components/Toast.js` | Sombras |
| `src/components/Header.js` | Gradiente, logo bg |
| `src/components/StatCard.js` | Color schemes completos |
| `src/screens/DashboardScreen.js` | Cores, sombras |
| `src/screens/ClienteDashboardScreen.js` | Cores, sombras, borderRadius |
| `src/screens/CadernoCampoScreen.js` | Cores de categorias, sombras |
| `src/screens/ProdutoresScreen.js` | FAB, gradientes, cores, sombras, modal header padronizado |
| `src/screens/VisitasScreen.js` | FAB, gradientes, cores, sombras, erros, modal header padronizado |
| `src/screens/ProdutorScreen.js` | FAB, ícones, cores, sombras |
| `src/screens/NovaVisitaScreen.js` | Input translúcido, sombras |
| `src/screens/EditarVisitaScreen.js` | Input translúcido, sombras, borderRadius |
| `src/screens/VisitaDetailScreen.js` | Sombras |
| `src/screens/LoginScreen.js` | Cores, fallbacks, borderRadius |
| `src/screens/PerfilScreen.js` | BorderRadius, modal dialog completamente refeito (overlay, padding, maxWidth, botões com flex/minHeight/borda) |
| `src/screens/NovoProdutorScreen.js` | Cores, borderRadius |
| `src/screens/EditarProdutorScreen.js` | Cores, borderRadius |
| `src/screens/MapasScreen.js` | BorderRadius |
| `src/screens/NotificacoesScreen.js` | BorderRadius |

**Total: 25 arquivos alterados**

---

## 7. Passo a Passo para Testar e Validar

### 7.1 Pré-requisito
Certifique-se de que o Expo está rodando:
```bash
npx expo start
```
Abra o app no emulador Android, iOS ou no Expo Go pelo celular.

---

### 7.2 Teste 1 — Login (LoginScreen)
1. Abra o app — a tela de login deve carregar
2. **Verificar:**
   - O botão "Entrar" tem gradiente verde e ícone branco (não cinza/transparente)
   - Os cantos do botão e dos campos de input estão arredondados uniformemente
   - Não há texto cortado ou elementos desalinhados

---

### 7.3 Teste 2 — Dashboard (DashboardScreen / ClienteDashboardScreen)
1. Faça login com um usuário **admin/técnico** → Dashboard principal
2. Faça login com um usuário **cliente** → ClienteDashboard
3. **Verificar:**
   - Os StatCards (cards de métricas) mostram cores corretas: verde, azul, roxo, âmbar
   - Os cards têm sombra visível (não achatados)
   - O Header no topo tem gradiente suave (branco → cinza claro), não cor sólida

---

### 7.4 Teste 3 — Produtores (ProdutoresScreen)
1. Navegue para a aba **Produtores**
2. **Verificar FAB:** O botão flutuante "Novo Produtor" (canto inferior direito) tem gradiente verde e texto/ícone brancos
3. **Verificar modal de filtros:**
   - Toque no botão de filtros (ícone funil)
   - O bottom sheet deve subir com overlay escuro
   - O header do bottom sheet deve ter padding confortável e borda inferior visível
   - Os chips de filtro (Todos, Ativo, Inativo, Pendente) devem ficar verdes quando selecionados com texto branco
   - Feche o modal tocando fora dele ou no "X"
4. **Verificar ProdutorCard:** Os cards de produtores têm cantos arredondados e sombra sutil

---

### 7.5 Teste 4 — Visitas (VisitasScreen)
1. Navegue para a aba **Visitas**
2. **Verificar FAB:** Botão "Nova Visita" com gradiente verde
3. **Verificar modal de filtros:**
   - Toque no botão de filtros
   - Mesmo comportamento do modal de ProdutoresScreen (padding, header, borda idênticos)
   - Chips de status, data e ordenação devem funcionar com cores corretas
4. **Verificar cards de visitas canceladas:** Devem ter fundo avermelhado claro (não branco) - nao foi

---

### 7.6 Teste 5 — Detalhe do Produtor (ProdutorScreen)
1. Toque em um produtor para abrir detalhes
2. **Verificar:**
   - Os ícones de estatísticas (área, visitas, mapas) têm fundos coloridos corretos (âmbar, azul)
   - O FAB de edição/exclusão tem gradiente verde
   - As sombras dos cards são visíveis

---

### 7.7 Teste 6 — Nova Visita / Editar Visita
1. Toque no FAB "Nova Visita" na tela de Visitas
2. **Verificar:**
   - Os campos de input têm fundo levemente translúcido (não totalmente branco opaco)
   - Os cantos dos inputs são arredondados uniformemente
   - O botão de salvar mostra ícone branco e texto branco
3. Se houver uma visita existente, entre na edição e verifique os mesmos pontos

---

### 7.8 Teste 7 — Novo Produtor / Editar Produtor
1. Toque no FAB "Novo Produtor" na tela de Produtores
2. **Verificar:**
   - O ActivityIndicator ao salvar é branco (não cinza)
   - O ícone de checkmark no botão salvar é branco
   - Os cantos dos campos são arredondados uniformemente
3. Se houver um produtor existente, entre na edição e verifique os mesmos pontos

---

### 7.9 Teste 8 — Caderno de Campo (CadernoCampoScreen)
1. Navegue para o Caderno de Campo
2. **Verificar:** As categorias de registros têm cores diferenciadas e consistentes:
   - Verde → visita/geral
   - Azul → informação
   - Roxo → acompanhamento
   - Âmbar/amarelo → pendente/aviso
   - Ciano → coleta de solo
   - Laranja → manejo

---

### 7.10 Teste 9 — Modais de confirmação
1. Na tela de detalhe de um produtor, tente **excluir** o produtor
2. **Verificar ConfirmDialog:**
   - O overlay escuro cobre toda a tela
   - O dialog está centralizado com padding confortável
   - Título em tamanho 20 (fonte maior, não pequena)
   - Botão "Cancelar" tem borda cinza e fundo claro
   - Botão "Excluir" tem fundo vermelho e texto branco
   - Ambos os botões têm a mesma altura (minHeight 48)
3. Toque em "Cancelar" — o modal deve fechar

---

### 7.11 Teste 10 — Filtro Regional (FiltroRegional)
1. Em qualquer tela que tenha o filtro regional (Produtores, Visitas, Dashboard)
2. Toque no filtro de região/micro-região/fazenda
3. **Verificar modal de seleção:**
   - Overlay escuro com padding consistente
   - Header com título em tamanho 20 (não 18)
   - Itens selecionados ficam com fundo verde e texto branco
   - Ícone de checkmark branco no item selecionado
   - Fechar com o "X" funciona

---

### 7.12 Teste 11 — DatePicker
1. Em "Nova Visita" ou "Editar Visita", toque no campo de data
2. **Verificar:**
   - Overlay escuro com padding consistente (igual aos outros modais)
   - Header com título centralizado
   - Botões "Cancelar" e "Confirmar" com mesma altura e estilo dos outros modais
   - Cancelar tem borda, Confirmar tem fundo verde

---

### 7.13 Teste 12 — Perfil e Logout (PerfilScreen)
1. Navegue para a aba **Perfil**
2. Toque em **"Sair"**
3. **Verificar modal de logout:**
   - Dialog centralizado com largura generosa (maxWidth 400)
   - Título "Confirmação" em tamanho 20
   - Botão "Cancelar" com borda e fundo claro, mesma altura do botão "Sair"
   - Botão "Sair" com fundo vermelho e texto branco
   - Ambos os botões ocupam metade da largura cada (`flex: 1`)
4. Toque em "Cancelar" — o modal deve fechar sem deslogar

---

### 7.14 Teste 13 — Notificações e Mapas
1. Navegue para **Notificações** — verifique que os cards têm cantos arredondados uniformes
2. Navegue para **Mapas** — verifique que os cards de mapa têm cantos arredondados uniformes

---

### 7.15 Teste 14 — Toast (mensagens de feedback)
1. Realize qualquer ação que mostre um Toast (salvar, excluir, etc.)
2. **Verificar:** O toast aparece com sombra visível (não achatado)

---

### 7.16 Resumo rápido do que observar em TODAS as telas

| O que verificar | Esperado |
|---|---|
| **Sombras** | Cards e botões elevados devem ter sombra visível, não achatados |
| **Cantos** | Uniformes — sem mistura de cantos muito arredondados com cantos retos |
| **Modais** | Overlay escuro, padding confortável, botões com mesma altura |
| **FABs** | Gradiente verde, texto e ícone brancos |
| **Chips/filtros** | Verde quando ativo, borda verde quando inativo |
| **Cores brancas** | Ícones e textos sobre fundo escuro/colorido devem ser brancos (não cinza/transparente) |
| **Categorias coloridas** | Caderno de campo mostra cores distintas por tipo |
| **Textos** | Nenhum texto invisível, cortado ou com tamanho inconsistente entre telas |

> **Dica:** Se qualquer elemento visual parecer "quebrado" (texto invisível, botão sem cor, sombra sumiu), provavelmente é um token que não está sendo resolvido corretamente. Nesse caso, me avise com o nome da tela e o elemento afetado.
