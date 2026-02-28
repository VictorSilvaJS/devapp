# Auditoria Completa de UI — devapp

> **Auditoria somente-leitura** de padrões de Modal/Dialog, uso de ícones, cores hardcoded, botões e cards/containers em todo o projeto React Native.
> Gerado com base na leitura completa de `src/theme.js`, 16 telas e 11 componentes.

---

## Índice

1. [Resumo Executivo](#1-resumo-executivo)
2. [Referência: theme.js](#2-referência-themejs)
3. [Padrões de Modal/Dialog](#3-padrões-de-modaldialog)
4. [Uso de Ícones](#4-uso-de-ícones)
5. [Cores Hardcoded e Propriedades Inexistentes no Theme](#5-cores-hardcoded-e-propriedades-inexistentes-no-theme)
6. [Padrões de Botão](#6-padrões-de-botão)
7. [Padrões de Card/Container](#7-padrões-de-cardcontainer)
8. [Padrão de Import do Theme](#8-padrão-de-import-do-theme)
9. [Inventário por Arquivo](#9-inventário-por-arquivo)
10. [Recomendações Prioritárias](#10-recomendações-prioritárias)

---

## 1. Resumo Executivo

| Categoria | Achados Críticos |
|---|---|
| **Modals** | 6 implementações com 2 padrões distintos (bottom sheet vs dialog centralizado); inconsistências de estilo entre Modals similares |
| **Ícones** | Exclusivamente `Ionicons` (✅ consistente); porém **16 tamanhos diferentes** usados (12–80px) |
| **Cores hardcoded** | **50+ cores hardcoded** fora do theme; `colors.danger` e `colors.white` usados mas **NÃO EXISTEM** no theme |
| **Shadows incorretas** | `shadows.large`, `shadows.medium`, `shadows.small` referenciadas mas **NÃO EXISTEM** (theme usa `sm`/`md`/`lg`) |
| **Botões** | borderRadius varia entre 8, 10, 12, 14, 16; gradientes FAB duplicados com cores fora do theme |
| **Cards** | borderWidth varia entre 1, 1.5 e 2; padding varia entre `spacing.card`, `card+2`, `card+4` |
| **Import do theme** | Dois padrões concorrentes: `import { colors } from '../theme'` vs `import theme from '../theme'` |

---

## 2. Referência: theme.js

### Cores Definidas
| Chave | Valor | Nota |
|---|---|---|
| `colors.primary` | `#228B22` | |
| `colors.primaryDark` | `#1a6b1a` | |
| `colors.primaryLight` | `#2fa82f` | |
| `colors.secondary` | `#8B6244` | |
| `colors.secondaryLight` | `#a17757` | |
| `colors.accent` | `#d9ead3` | |
| `colors.accentDark` | `#b6d7a8` | |
| `colors.background` | `#F8FBF8` | |
| `colors.backgroundAlt` | `#f7f9f7` | |
| `colors.card` | `#FFFFFF` | |
| `colors.cardHover` | `#f0f7f0` | |
| `colors.text` | `#1C3D1C` | |
| `colors.textLight` | `#4a5c4a` | |
| `colors.textSecondary` | `#6B7280` | |
| `colors.muted` | `#6B7280` | |
| `colors.mutedLight` | `#9ca3af` | |
| `colors.success` | `#10B981` | |
| `colors.successLight` | `#34d399` | |
| `colors.warning` | `#F59E0B` | |
| `colors.warningLight` | `#fbbf24` | |
| `colors.error` | `#EF4444` | |
| `colors.errorLight` | `#f87171` | |
| `colors.border` | `#d9ead3` | |
| `colors.borderLight` | `#e8f5e8` | |
| `colors.shadow` | `rgba(34, 139, 34, 0.15)` | |
| `colors.shadowDark` | `rgba(0, 0, 0, 0.1)` | |
| ~~`colors.white`~~ | **NÃO EXISTE** | ❌ Usado em 6+ arquivos |
| ~~`colors.danger`~~ | **NÃO EXISTE** | ❌ Usado em 3+ arquivos |

### Shadows Definidas
| Chave | Existe? |
|---|---|
| `shadows.sm` | ✅ |
| `shadows.md` | ✅ |
| `shadows.lg` | ✅ |
| ~~`shadows.small`~~ | ❌ Referenciada em VisitaDetailScreen |
| ~~`shadows.medium`~~ | ❌ Referenciada em NovaVisitaScreen, EditarVisitaScreen, VisitaDetailScreen |
| ~~`shadows.large`~~ | ❌ Referenciada em ConfirmDialog, DatePicker, Toast |

### Spacing
| Chave | Valor |
|---|---|
| `spacing.xs` | 4 |
| `spacing.sm` | 8 |
| `spacing.md` | 12 |
| `spacing.lg` | 16 |
| `spacing.xl` | 24 |
| `spacing.screen` | 16 |
| `spacing.card` | 12 |
| `spacing.gap` | 12 |
| `spacing.radius` | 12 |
| `spacing.radiusLg` | 16 |
| `spacing.radiusSm` | 8 |

---

## 3. Padrões de Modal/Dialog

### 3.1 Inventário de Modals

| Arquivo | Tipo | animationType | Overlay | Posição | borderRadius |
|---|---|---|---|---|---|
| **ProdutoresScreen** | Bottom Sheet (filtros) | `slide` | `rgba(0,0,0,0.5)` | `flex-end` | `borderTopLeftRadius: 24, borderTopRightRadius: 24` |
| **VisitasScreen** | Bottom Sheet (filtros) | `slide` | `rgba(0,0,0,0.5)` | `flex-end` | `borderTopLeftRadius: 24, borderTopRightRadius: 24` |
| **PerfilScreen** | Dialog centralizado (logout) | `fade` | `rgba(0,0,0,0.5)` | `center` | `borderRadius: 16` |
| **ConfirmDialog** | Dialog centralizado (confirmar/cancelar) | `fade` | `rgba(0,0,0,0.5)` | `center` | `borderRadius: spacing.radiusLg (16)` |
| **DatePicker** | Dialog centralizado (seleção data) | `fade` | `rgba(0,0,0,0.5)` | `center` | `borderRadius: spacing.radius (12)` |
| **FiltroRegional** | Dialog centralizado (seleção região) | `fade` | `rgba(0,0,0,0.6)` ⚠️ | `center` | `borderRadius: 16` |

### 3.2 Inconsistências entre Bottom Sheets (ProdutoresScreen vs VisitasScreen)

Estas duas telas têm Modals quase idênticos para filtros, mas divergem em vários detalhes:

| Aspecto | ProdutoresScreen | VisitasScreen |
|---|---|---|
| Chip `borderColor` (ativo) | `colors.primary` | `colors.primaryDark` |
| Chip fontSize | `typography.fontCaption` (12) | `typography.fontBody - 1` (15) |
| "Limpar filtros" `borderRadius` | `16` | `12` |
| "Limpar filtros" `borderWidth` | `2` | `1` |
| "Limpar filtros" `borderStyle` | `'dashed'` | não definido |
| Botão aplicar `paddingVertical` | `spacing.md + 4` (16) | `spacing.lg` (16) |
| Drag handle | Presente (40×4) | Presente (40×4) ✅ |
| Sheet `maxHeight` | `85%` | `85%` ✅ |

### 3.3 Inconsistências entre Dialogs Centralizados

| Aspecto | ConfirmDialog | DatePicker | FiltroRegional | PerfilScreen |
|---|---|---|---|---|
| Overlay opacity | `0.5` | `0.5` | **`0.6`** ⚠️ | `0.5` |
| `maxWidth` | `400` | `400` | `400` | `340` ⚠️ |
| Background | `colors.card` | `colors.card` | **`#FFFFFF`** ⚠️ | `colors.card` |
| Shadow | **`shadows.large`** ❌ | **`shadows.large`** ❌ | `shadows.lg` ✅ | nenhuma |
| `maxHeight` | — | `80%` | `80%` | — |

### 3.4 Telas SEM Modal

LoginScreen, DashboardScreen, ProdutorScreen, NovaVisitaScreen, EditarVisitaScreen, CadernoCampoScreen, MapasScreen, NovoProdutorScreen, EditarProdutorScreen, NotificacoesScreen, ClienteDashboardScreen, EditProfileScreen.

---

## 4. Uso de Ícones

### 4.1 Biblioteca

✅ **Todas as telas e componentes usam exclusivamente `Ionicons` de `@expo/vector-icons`.** Nenhum uso de MaterialIcons, FontAwesome ou outra biblioteca detectado.

### 4.2 Distribuição de Tamanhos

| Tamanho | Onde é usado |
|---|---|
| **12** | ProdutorCard (badge de status) |
| **13** | ProdutorCard (meta icons), FiltroRegional (indicador) |
| **14** | ProdutorScreen (location), MapasScreen (chips), NotificationBadge, InputField, FiltroRegional, NotificacoesScreen |
| **16** | LoginScreen, DashboardScreen, ProdutoresScreen, ProdutorScreen, VisitasScreen, CadernoCampoScreen, FiltroRegional, NotificacoesScreen |
| **18** | LoginScreen (dev), ProdutoresScreen/VisitasScreen (chips modal), MapasScreen, FiltroRegional |
| **20** | LoginScreen (inputs), ProdutoresScreen/VisitasScreen (search, options), ProdutorScreen, NovaVisitaScreen, InputField, Toast, NotificacoesScreen, FiltroRegional (modal items) |
| **22** | NotificacoesScreen, FiltroRegional (limpar), NovaVisitaScreen/EditarVisitaScreen (close-circle fotos) |
| **24** | LoginScreen (botão), DashboardScreen (stats), ProdutoresScreen, ProdutorScreen, VisitaDetailScreen, Header, Toast, CadernoCampoScreen |
| **26** | ProdutoresScreen/VisitasScreen (FAB icon) |
| **28** | MapasScreen (ícone mapa, cabeçalho categoria) |
| **32** | ProdutoresScreen/VisitasScreen (close-circle no sheet), ClienteDashboardScreen, FiltroRegional (emptys) |
| **40** | ClienteDashboardScreen (home-outline) |
| **48** | ProdutorScreen, VisitaDetailScreen, ConfirmDialog, DashboardScreen (estados vazios/alertas) |
| **64** | VisitaDetailScreen, CadernoCampoScreen, NotificacoesScreen, ClienteDashboardScreen (estados vazios) |
| **80** | VisitasScreen, MapasScreen, NotificacoesScreen (estados vazios) |

**Observação:** Tamanhos para estados vazios variam entre 48, 64 e 80 sem padrão consistente.

### 4.3 Ícones frequentes

| Ícone | Uso |
|---|---|
| `chevron-back` | Header (voltar) |
| `close-circle` | Fechar modals, remover fotos, limpar filtros |
| `checkmark-circle` | Itens selecionados, confirmações |
| `add` / `add-circle` | FABs, adicionar itens |
| `search` | Barras de busca |
| `funnel` / `options` | Filtros |
| `leaf` / `leaf-outline` | Temática agrícola |
| `calendar(-outline)` | Datas |
| `location(-outline)` | Localização |
| `notifications(-outline)` | Notificações (Header) |

---

## 5. Cores Hardcoded e Propriedades Inexistentes no Theme

### 5.1 ❌ Propriedades do Theme que NÃO EXISTEM

| Propriedade referenciada | Arquivos que usam | Deveria ser |
|---|---|---|
| `colors.danger` | InputField, NotificacoesScreen, NotificationBadge | `colors.error` |
| `colors.white` | ProdutoresScreen, VisitasScreen, MapasScreen, NotificationBadge, FiltroRegional | `colors.card` ou `'#FFFFFF'` |
| `shadows.large` | ConfirmDialog, DatePicker, Toast | `shadows.lg` |
| `shadows.medium` | NovaVisitaScreen, EditarVisitaScreen, VisitaDetailScreen | `shadows.md` |
| `shadows.small` | VisitaDetailScreen | `shadows.sm` |

### 5.2 Cores Hardcoded — Brancos e fundos

| Cor hardcoded | Usado em | Valor do theme equivalente |
|---|---|---|
| `'#FFFFFF'` / `'#fff'` | LoginScreen, DashboardScreen, ProdutoresScreen, VisitasScreen, ProdutorScreen, NovaVisitaScreen, EditarVisitaScreen, MapasScreen, PerfilScreen, FiltroRegional, ConfirmDialog, Header e mais | `colors.card` ('#FFFFFF') |
| `'#F8FBF8'` | ProdutoresScreen, VisitasScreen (gradientes topo) | `colors.background` |
| `'#F8FAFB'` | ProdutoresScreen (gradiente sheet header) | Sem equivalente |
| `'#F9FAFB'` | ProdutoresScreen, VisitasScreen (gradientes search/filter) | Sem equivalente |
| `'#e8f5e8'` | DashboardScreen, ProdutoresScreen, ProdutorScreen, ClienteDashboardScreen, FiltroRegional | `colors.borderLight` ('#e8f5e8') ✅ o valor é o mesmo |
| `'#f5f3f0'` | DashboardScreen, ClienteDashboardScreen | Sem equivalente |
| `'#d1fae5'` | DashboardScreen, ClienteDashboardScreen | Sem equivalente |
| `'#fef3c7'` | DashboardScreen, ClienteDashboardScreen | Sem equivalente |
| `'#f0f7f0'` | EditProfileScreen (input border) | `colors.cardHover` ('#f0f7f0') ✅ valor coincide |
| `'#F5F7FA'` | ProdutoresScreen (remove filter bg) | Sem equivalente |
| `'#FFFFFFCC'` | NovaVisitaScreen, EditarVisitaScreen (botão remover foto) | Sem equivalente |

### 5.3 Cores Hardcoded — Verdes (fora do theme)

| Cor | Usado em | Nota |
|---|---|---|
| `'#4CAF50'` | ProdutoresScreen (FAB), VisitasScreen (FAB) | **Não é** `colors.primary` (#228B22) |
| `'#45a049'` | ProdutoresScreen (FAB), VisitasScreen (FAB) | Gradiente intermediário |
| `'#2d7a2d'` | ProdutoresScreen (FAB), VisitasScreen (FAB), ProdutorScreen (edit FAB) | Gradiente final e `shadowColor` |

### 5.4 Cores Hardcoded — Vermelhos

| Cor | Usado em | Nota |
|---|---|---|
| `'#E74C3C'` | LoginScreen (fallback error) | fallback: `colors.error \|\| '#E74C3C'` |
| `'#EF4444'` | ProdutorScreen (delete button gradient) | Coincide com `colors.error` mas hardcoded |
| `'#DC2626'` | ProdutorScreen (delete button gradient) | Sem equivalente no theme |
| `'#FF6B6B'` | ProdutoresScreen, VisitasScreen (filter chip icon) | Sem equivalente |
| `'#FFD6D6'`, `'#FFF5F5'`, `'#FFE5E5'` | ProdutoresScreen, VisitasScreen (clear filter chip gradients) | Sem equivalente |

### 5.5 Cores Hardcoded — Azuis, Roxos, Laranjas e Outros

| Cor | Usado em | Contexto |
|---|---|---|
| `'#3B82F6'` | VisitasScreen (agendada), CadernoCampoScreen (adubacao) | Status/tipo azul |
| `'#2563eb'` | ClienteDashboardScreen (atividade accent) | Azul escuro |
| `'#dbeafe'` | ClienteDashboardScreen, StatCard | Azul claro bg |
| `'#e0f2fe'` | ProdutorScreen (calendar stat bg) | Azul claro bg |
| `'#0284c7'` | ProdutorScreen (calendar stat icon) | Azul intenso |
| `'#A855F7'` | CadernoCampoScreen (aplicacao type) | Roxo |
| `'#F97316'` | CadernoCampoScreen (analise_solo type) | Laranja |
| `'#06B6D4'` | CadernoCampoScreen (vistoria type) | Cyan |
| `'#d97706'` | ProdutorScreen, ClienteDashboardScreen, MapasScreen | Amber/âmbar escuro |
| `'#8B6244'` | DashboardScreen, ProdutorScreen | É `colors.secondary` ⚠️ hardcoded |
| `'#4ECDC4'` | ProdutoresScreen, VisitasScreen (filter chip icon) | Teal |
| `'#E8EEF2'` | ProdutoresScreen, VisitasScreen (border top bar) | Cinza claro |
| `'#E5E7EB'` | LoginScreen (fallback border) | Cinza border |

---

## 6. Padrões de Botão

### 6.1 FAB (Floating Action Button)

| Propriedade | ProdutoresScreen | VisitasScreen | ProdutorScreen (editar) |
|---|---|---|---|
| Gradiente | `['#4CAF50','#45a049','#2d7a2d']` | `['#4CAF50','#45a049','#2d7a2d']` | `['#4CAF50','#45a049','#2d7a2d']` |
| `borderRadius` | `32` | `32` | `32` |
| `shadowColor` | `'#2d7a2d'` | `'#2d7a2d'` | `'#2d7a2d'` |
| Ícone | `add` size 26 | `add` size 26 | `create-outline` size 24 |

**Problema:** Código 100% duplicado nos 3 arquivos; gradiente é completamente fora do theme.

### 6.2 Botão Delete (ProdutorScreen)

| Propriedade | Valor |
|---|---|
| Gradiente | `['#EF4444', '#DC2626']` |
| `borderRadius` | `32` |
| Ícone | `trash-outline` size 24 |

### 6.3 Botões de Ação Principal — borderRadius

| Arquivo | borderRadius | Nota |
|---|---|---|
| LoginScreen | `14` | com `LinearGradient` |
| ProdutoresScreen (modal aplicar) | `16` | com `LinearGradient` |
| VisitasScreen (modal aplicar) | `16` | com `LinearGradient` |
| NovaVisitaScreen (footer salvar) | `spacing.radiusSm` (8) | |
| EditarVisitaScreen (footer salvar) | `spacing.radiusSm` (8) | |
| NovoProdutorScreen (salvar) | `12` | via `theme.spacing.radius` |
| EditarProdutorScreen (salvar) | `12` | via `theme.spacing.radius` |
| PerfilScreen | `12` | |
| EditProfileScreen | `10` | |
| ConfirmDialog (confirmar) | `spacing.radiusSm` (8) | |
| DatePicker (confirmar) | `spacing.radiusSm` (8) | |

### 6.4 Botões Footer (Salvar/Cancelar)

| Aspecto | NovaVisita / EditarVisita | NovoProdutorScreen / EditarProdutorScreen |
|---|---|---|
| `borderTopWidth` | `2` | `1` |
| `borderTopColor` | `colors.border` | `theme.colors.border` |
| `minHeight` botão | `48` | `48` ✅ |
| `borderRadius` | `spacing.radiusSm (8)` | `theme.spacing.radius (12)` |
| Cancelar bg | `colors.backgroundAlt` | `theme.colors.error` (botão "Excluir") |

### 6.5 Botões Limpar Filtro (Bottom Sheets)

| Aspecto | ProdutoresScreen | VisitasScreen |
|---|---|---|
| `borderRadius` | `16` | `12` |
| `borderWidth` | `2` | `1` |
| `borderStyle` | `'dashed'` | (padrão = solid) |
| Gradiente | `['#FFD6D6', '#FFF5F5']` | `['#FFE5E5', '#FFF5F5']` |

---

## 7. Padrões de Card/Container

### 7.1 borderWidth

| Valor | Arquivos |
|---|---|
| `1` | ProdutorCard, ClienteDashboardScreen (visitaCard, atividadeCard), DatePicker (input) |
| `1.5` | CadernoCampoScreen (registroCard), VisitasScreen (visitaCard) |
| `2` | DashboardScreen (infoCards), ProdutorScreen (profileCard, tabs), NotificacoesScreen, MapasScreen, ProdutoresScreen (search, chips), ClienteDashboardScreen (categoriaCard, stats), FiltroRegional (filtroButton), DatePicker (input) |

### 7.2 borderRadius de Cards

| Valor | Arquivos |
|---|---|
| `8` | FiltroRegional (filtroButton, modalItems), MapasScreen (chips) |
| `spacing.radius` (12) | NovaVisitaScreen, EditarVisitaScreen (sections) |
| `12` | DashboardScreen, ProdutoresScreen, ProdutorScreen, VisitasScreen, ClienteDashboardScreen, CadernoCampoScreen, MapasScreen, FiltroRegional (container) |
| `spacing.radiusLg` (16) | ConfirmDialog |
| `16` | PerfilScreen (cards), ProdutorScreen (profile), FiltroRegional (modal), DatePicker (modal) |
| `20` | ProdutoresScreen, VisitasScreen (chip buttons nos modals) |

### 7.3 Card padding

| Valor | Arquivos |
|---|---|
| `spacing.card` (12) | ProdutorCard, ClienteDashboardScreen (visitaCard, atividadeCard) |
| `spacing.card + 2` (14) | VisitasScreen (visitaCard) |
| `spacing.card + 4` (16) | ProdutoresScreen (produtorCard) |
| `spacing.md` (12) | DashboardScreen, MapasScreen, ClienteDashboardScreen (categoriaCard), FiltroRegional |
| `spacing.lg` (16) | ProdutorScreen (sections), PerfilScreen, ConfirmDialog (container padding via `spacing.xl`) |
| `spacing.xl` (24) | ConfirmDialog |

### 7.4 Shadows nos Cards

| Shadow | Arquivos | Nota |
|---|---|---|
| `...shadows.sm` | DashboardScreen, ProdutoresScreen, ProdutorScreen, VisitasScreen, ClienteDashboardScreen, CadernoCampoScreen, MapasScreen, FiltroRegional | ✅ Correto |
| `...shadows.md` | ClienteDashboardScreen (categoriaCard), ProdutorScreen (profileCard, tabCard) | ✅ Correto |
| `...shadows.lg` | FiltroRegional (modalContent) | ✅ Correto |
| `...shadows.small` | VisitaDetailScreen | ❌ Não existe |
| `...shadows.medium` | NovaVisitaScreen, EditarVisitaScreen, VisitaDetailScreen | ❌ Não existe |
| `...shadows.large` | ConfirmDialog, DatePicker, Toast | ❌ Não existe |

---

## 8. Padrão de Import do Theme

### Padrão A — Named exports (maioria)
```js
import { colors, typography, spacing, shadows } from '../theme';
```
**Usado em:** LoginScreen, DashboardScreen, ProdutoresScreen, ProdutorScreen, VisitasScreen, NovaVisitaScreen, EditarVisitaScreen, VisitaDetailScreen, CadernoCampoScreen, MapasScreen, PerfilScreen, NotificacoesScreen, ClienteDashboardScreen, EditProfileScreen, todos os componentes

### Padrão B — Default import
```js
import theme from '../theme';
// acessos via theme.colors.primary, theme.spacing.radius, etc.
```
**Usado em:** NovoProdutorScreen, EditarProdutorScreen

**Impacto:** Ambos funcionam (theme.js tem `export default` e named exports), mas a inconsistência dificulta refatoração e busca.

---

## 9. Inventário por Arquivo

### 9.1 Telas (Screens)

#### LoginScreen.js (340 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — `mail-outline`(20), `lock-closed-outline`(20), `eye-outline`/`eye-off-outline`(20), `alert-circle`(16), `log-in-outline`(24), `person`(18), `construct`(18)
- **Cores hardcoded:** `'#FFFFFF'`, `'#E74C3C'` (fallback), `'#E5E7EB'` (fallback), gradientes LinearGradient
- **Botão principal:** `borderRadius: 14`, com LinearGradient
- **Cards:** Nenhum card padrão

#### DashboardScreen.js (528 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — `warning`(48), `location-outline`(16), `cloudy-outline`(16), vários(24) nos StatCards
- **Cores hardcoded:** `'#e8f5e8'`, `'#f5f3f0'`, `'#d1fae5'`, `'#fef3c7'`, `'#FFFFFF'`, `'#8B6244'`(= secondary, hardcoded)
- **Cards:** borderWidth:2, borderRadius:12, `...shadows.sm`

#### ProdutoresScreen.js (1027 linhas)
- **Modal:** Bottom sheet (slide), overlay 0.5, borderTopRadius:24, maxHeight:85%
- **Ícones:** Ionicons — sizes 16,18,20,24,26,32
- **Cores hardcoded:** `'#FFFFFF'`, `'#4CAF50'`, `'#45a049'`, `'#2d7a2d'`, `'#F8FBF8'`, `'#F8FAFB'`, `'#F9FAFB'`, `'#E8EEF2'`, `'#FFD6D6'`, `'#FFF5F5'`, `'#FF6B6B'`, `'#4ECDC4'`, `'#F5F7FA'`, `'#e8f5e8'`, `colors.white` ❌
- **FAB:** Gradiente 3-cores fora do theme, borderRadius:32
- **Cards:** borderWidth:2, borderRadius:12, padding:`spacing.card+4`

#### ProdutorScreen.js (989 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — sizes 14,16,18,20,24,48
- **Cores hardcoded:** `'#FFFFFF'`, `'#8B6244'`(secondary), `'#e8f5e8'`, `'#e0f2fe'`, `'#0284c7'`, `'#d97706'`, `'#4CAF50'`, `'#45a049'`, `'#2d7a2d'`, `'#EF4444'`, `'#DC2626'`
- **FABs:** Editar (gradient verde) + Excluir (gradient vermelho), ambos borderRadius:32
- **Cards:** profileCard borderWidth:2/borderRadius:16/shadows.md; tabs borderRadius:12

#### VisitasScreen.js (1395 linhas)
- **Modal:** Bottom sheet (slide), overlay 0.5, borderTopRadius:24, maxHeight:85%
- **Ícones:** Ionicons — sizes 16,18,20,24,26,32,80
- **Cores hardcoded:** `'#FFFFFF'`, `'#4CAF50'`, `'#45a049'`, `'#2d7a2d'`, `'#F8FBF8'`, `'#F9FAFB'`, `'#E8EEF2'`, `'#FFE5E5'`, `'#FFF5F5'`, `'#FF6B6B'`, `'#4ECDC4'`, `'#F5F7FA'`, `'#3B82F6'`, `'#e8f5e8'`, `colors.white` ❌
- **FAB:** Idêntico a ProdutoresScreen (duplicado)
- **Cards:** visitaCard borderWidth:1.5, borderRadius:12, padding:`spacing.card+2`

#### NovaVisitaScreen.js (701 linhas)
- **Modal:** Nenhum (usa DatePicker com modal interno)
- **Ícones:** Ionicons — `close-circle`(22), `chevron-down`(20), `camera-outline`(20), `checkmark-circle`(20), `image-outline`(48)
- **Cores hardcoded:** `'#FFFFFFCC'`, `'#FFFFFF'`
- **Shadows:** Usa `shadows.medium` ❌ (não existe)
- **Botão footer:** borderRadius:`spacing.radiusSm`(8), borderTopWidth:2
- **Cards:** sections borderRadius:`spacing.radius`(12)

#### EditarVisitaScreen.js (788 linhas)
- **Modal:** Nenhum (usa DatePicker com modal interno)
- **Ícones:** Ionicons — `close-circle`(22), `chevron-down`(20), `camera-outline`(20), `checkmark-circle`(20), `image-outline`(48)
- **Cores hardcoded:** `'#FFFFFFCC'`, `'#FFFFFF'`
- **Shadows:** Usa `shadows.medium` ❌ (não existe)
- **Botão footer:** borderRadius:`spacing.radiusSm`(8), borderTopWidth:2

#### VisitaDetailScreen.js (584 linhas)
- **Modal:** Usa **ConfirmDialog** (componente)
- **Ícones:** Ionicons — sizes 20,24,48,64
- **Cores hardcoded:** `'#FFFFFF'`, `'#e8f5e8'`
- **Shadows:** Usa `shadows.small` ❌ e `shadows.medium` ❌ (não existem)

#### CadernoCampoScreen.js (506 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — `book`(24), `leaf`(16), `alert-circle-outline`(64)
- **Cores hardcoded:** `'#FFFFFF'`, `'#3B82F6'`, `'#A855F7'`, `'#F97316'`, `'#06B6D4'`, `'#e8f5e8'`
- **Cards:** registroCard borderWidth:1.5, borderRadius:12

#### MapasScreen.js (730 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — sizes 14,16,18,20,24,28,80
- **Cores hardcoded:** `'#FFFFFF'`, `'#d97706'`, `'#e8f5e8'`, `colors.white` ❌
- **Cards:** borderWidth:2, borderRadius:12

#### NovoProdutorScreen.js (~500 linhas)
- **Modal:** Nenhum
- **Import theme:** `import theme from '../theme'` ⚠️ (Padrão B)
- **Ícones:** Ionicons — `chevron-down`(20), `checkmark-circle`(20), `leaf-outline`(48), `person`(20), `home`(20)
- **Botão footer:** borderRadius:`theme.spacing.radius`(12), borderTopWidth:1

#### EditarProdutorScreen.js (~500 linhas)
- **Modal:** Nenhum
- **Import theme:** `import theme from '../theme'` ⚠️ (Padrão B)
- **Ícones:** Ionicons — semelhante a NovoProdutorScreen
- **Botão footer:** borderRadius:`theme.spacing.radius`(12), borderTopWidth:1

#### PerfilScreen.js (~280 linhas)
- **Modal:** Dialog centralizado (logout confirm), animationType="fade", maxWidth:340
- **Ícones:** Ionicons — `person-circle-outline`(80), `create-outline`(20), `log-out-outline`(20), `close`(20), `checkmark`(20)
- **Cores hardcoded:** `'#FFFFFF'`
- **Botões:** borderRadius:12

#### NotificacoesScreen.js (~250 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — sizes 14,16,20,22,64,80
- **Cores hardcoded:** `colors.danger` ❌ (não existe no theme)

#### ClienteDashboardScreen.js (632 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — sizes 16,20,24,32,40,64
- **Cores hardcoded:** `'#FFFFFF'`, `'#e8f5e8'`, `'#f5f3f0'`, `'#d1fae5'`, `'#fef3c7'`, `'#d97706'`, `'#2563eb'`, `'#dbeafe'`, `colors.primary`(hardcoded no `borderColor` do propriedadeCard)
- **Cards:** categoriaCard borderWidth:2, visitaCard/atividadeCard borderWidth:1

#### EditProfileScreen.js (~60 linhas)
- **Modal:** Nenhum
- **Ícones:** Nenhum
- **Cores hardcoded:** `'#228B22'`(= primary, hardcoded), `'#f0f7f0'`(= cardHover, hardcoded), `'#333'`, `'#666'`, `'#e0e0e0'`, `'#f5f5f5'`
- **Botão:** borderRadius:10, padding:12, backgroundColor hardcoded `'#228B22'`

### 9.2 Componentes

#### ConfirmDialog.js (202 linhas)
- **Modal:** `animationType="fade"`, overlay 0.5, centered, borderRadius:`spacing.radiusLg`(16), maxWidth:400
- **Shadow:** `shadows.large` ❌ (deveria ser `shadows.lg`)
- **Ícones:** Ionicons — `alert-circle`(48)
- **Botões:** borderRadius:`spacing.radiusSm`(8)

#### DatePicker.js (545 linhas)
- **Modal:** `animationType="fade"`, overlay 0.5, centered, borderRadius:`spacing.radius`(12), maxWidth:400, maxHeight:80%
- **Shadow:** `shadows.large` ❌ (deveria ser `shadows.lg`)
- **Ícones:** Ionicons — `calendar-outline`(20), `alert-circle`(14)
- **Cores hardcoded:** Nenhuma significativa (usa theme consistentemente)
- **Selected text color:** Usa `colors.card` como "branco" (workaround correto)

#### Header.js (~130 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — `chevron-back`(24), `notifications-outline`(24), ícone dinâmico(24)
- **Cores hardcoded:** `'#FFFFFF'`

#### InputField.js (223 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — dynamicIcon(20), `alert-circle`(14)
- **Cores hardcoded:** `colors.danger` ❌ (não existe)
- **Bordas:** borderWidth:1.5, borderRadius:`spacing.radius`(12)

#### LoadingScreen.js (~60 linhas)
- **Modal:** Nenhum
- **Cores hardcoded:** Nenhuma
- **Nota:** Usa `ActivityIndicator` com `color={colors.primary}` ✅

#### ProdutorCard.js (~200 linhas)
- **Modal:** Nenhum
- **Ícones:** Ionicons — sizes 12,13,16,20
- **Cores hardcoded:** `'#FFFFFF'` (avatar text, gradient endpoints)
- **Cards:** borderWidth:1, borderRadius:12, padding:`spacing.card`

#### StatCard.js (~130 linhas)
- **Modal:** Nenhum
- **Ícones:** Nenhum (recebe `icon` como prop renderizada externamente)
- **Cores hardcoded:** `'#dbeafe'`, `'#e8f5e8'`, `'#fef3c7'` (colorSchemes hardcoded)
- **Cards:** borderWidth:2, borderRadius:12

#### Toast.js (230 linhas)
- **Modal:** Nenhum (usa `Animated` para posicionamento)
- **Shadow:** `shadows.large` ❌ (deveria ser `shadows.lg`)
- **Ícones:** Ionicons — dynamicIcon(20), `close-outline`(24)
- **Cores hardcoded:** Nenhuma adicional

#### UserProfile.js (~120 linhas)
- **Modal:** Nenhum
- **Ícones:** Nenhum
- **Cores hardcoded:** `'#FFFFFF'` (avatar text), `'#4a7c4a'`(Técnico gradient), `'#2d5a2d'`, `'#8B6244'`(Admin/Gestor gradients), `'#6d4a30'`

#### NotificationBadge.js (~55 linhas)
- **Modal:** Nenhum
- **Cores hardcoded:** `colors.danger` ❌, `colors.white` ❌ (ambas não existem no theme)

#### FiltroRegional.js (791 linhas)
- **Modal:** Dialog centralizado, `animationType="fade"`, overlay **0.6** (⚠️ diferente dos demais), borderRadius:16, maxWidth:400, maxHeight:80%
- **Ícones:** Ionicons — sizes 13,14,16,18,20,22,24,32
- **Cores hardcoded:** `'#FFFFFF'` (modalContent bg, badge text), `'#e8f5e8'` (regiaoInfoContainer bg), `colors.white` ❌
- **Shadow:** `shadows.sm` ✅, `shadows.lg` ✅ (correto!)
- **Cards:** container borderWidth:1, borderRadius:12

---

## 10. Recomendações Prioritárias

### 🔴 Prioridade Alta — Bugs Potenciais

1. **Adicionar `colors.danger` e `colors.white` ao theme.js** — Ou substituir por `colors.error` e `colors.card`/`'#FFFFFF'`.
   - `colors.danger` → InputField, NotificacoesScreen, NotificationBadge
   - `colors.white` → ProdutoresScreen, VisitasScreen, MapasScreen, NotificationBadge, FiltroRegional

2. **Corrigir chaves de shadow** — Substituir:
   - `shadows.large` → `shadows.lg` (ConfirmDialog, DatePicker, Toast)
   - `shadows.medium` → `shadows.md` (NovaVisitaScreen, EditarVisitaScreen, VisitaDetailScreen)
   - `shadows.small` → `shadows.sm` (VisitaDetailScreen)

### 🟡 Prioridade Média — Consistência

3. **Unificar import do theme** — Escolher entre named exports ou default import. Recomendação: named exports (usado em 14 de 16 telas).

4. **Extrair componente FAB reutilizável** — O código do FAB (gradiente + shadow + ícone) está duplicado em ProdutoresScreen, VisitasScreen e ProdutorScreen.

5. **Padronizar bottom sheets** — ProdutoresScreen e VisitasScreen têm Modals de filtro quase idênticos com diferenças sutis (chip font, clear button border). Extrair para componente compartilhado.

6. **Padronizar borderRadius de botões** — Atualmente varia entre 8, 10, 12, 14, 16. Usar `spacing.radiusSm`(8) para botões menores e `spacing.radius`(12) para botões padrão.

7. **Padronizar borderWidth de cards** — Escolher 1 ou 2 e aplicar globalmente.

### 🟢 Prioridade Baixa — Limpeza

8. **Registrar cores de status/tipo no theme** — Cores como `#3B82F6`, `#A855F7`, `#F97316`, `#06B6D4`, `#d97706`, `#2563eb` usadas para categorias deveriam ser definidas no theme (ex.: `colors.info`, `colors.purple`, `colors.orange`, `colors.cyan`, `colors.amber`).

9. **Registrar cores de accent backgrounds no theme** — `#e8f5e8`, `#f5f3f0`, `#d1fae5`, `#fef3c7`, `#dbeafe`, `#e0f2fe` são usadas como fundos semânticos; criar no theme (ex.: `colors.successBg`, `colors.warningBg`, `colors.infoBg`).

10. **Padronizar tamanhos de ícones para estados vazios** — Atualmente variam entre 48, 64 e 80. Definir um padrão (ex.: 64 para todos).

11. **Eliminar `#FFFFFF` hardcoded** — Substituir por `colors.card` que já tem valor `'#FFFFFF'`.

12. **Refatorar EditProfileScreen** — Utiliza **zero** referências ao theme; tem 5+ cores completamente hardcoded.

---

> **Fim da auditoria.** Nenhum arquivo foi modificado.
