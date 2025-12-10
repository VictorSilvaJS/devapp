# 🎨 Padrão de Ícones - AgroTchê

## 📋 Padronização de Ícones Ionicons

### Tamanhos Padronizados:
- **Ícones de Navegação (Tabs)**: `24px`
- **Ícones de Cards/Estatísticas**: `24px`
- **Ícones de Categoria/Destaque**: `32px`
- **Ícones de Título/Seção**: `20px`
- **Ícones de Busca**: `20px`
- **Ícones Inline (texto)**: `16px`
- **Ícones de Estado Vazio**: `48px`
- **Ícones de Estado Grande**: `64px`

---

## 🗺️ Mapeamento de Ícones por Contexto

### 📱 **Navegação (Bottom Tabs)**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Dashboard/Home | `home-outline` | 24px |
| Produtores/Lista | `people-outline` | 24px |
| Visitas/Histórico | `calendar-outline` | 24px |
| Caderno de Campo | `book-outline` | 24px |
| Perfil | `person-outline` | 24px |

---

### 📊 **Dashboard/Estatísticas**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Total de Produtores | `people-outline` | 24px |
| Produtores Ativos | `checkmark-circle-outline` | 24px |
| Área Total | `leaf-outline` | 24px |
| Visitas/Atividades | `calendar-outline` | 24px |
| Caderno de Campo | `book-outline` | 24px |
| Pendentes | `time-outline` | 24px |

---

### 🗺️ **Mapas**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Mapa Geral | `map-outline` | 24px |
| Fertilidade | `leaf-outline` | 32px |
| Correção | `flask-outline` | 32px |
| Índice de Vegetação | `git-network-outline` | 32px |
| Panorama | `image-outline` | 32px |
| Plantio | `grid-outline` | 32px |
| Download | `download-outline` | 16px |
| Localização/Talhão | `location-outline` | 16px |
| Data | `calendar-outline` | 16px |

---

### 📋 **Caderno de Campo**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Registro/Livro | `book-outline` | 24px |
| Data | `calendar-outline` | 16px |
| Técnico/Pessoa | `person-outline` | 16px |
| Localização | `location-outline` | 16px |
| Fotos/Imagens | `images-outline` | 16px |
| Status Concluído | `checkmark-circle` | 20px |

---

### 🔍 **Busca e Filtros**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Busca | `search-outline` | 20px |
| Limpar busca | `close-circle-outline` | 20px |
| Filtro de região | `location-outline` | 16px |

---

### 🏠 **Cliente/Propriedade**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Casa/Propriedade | `home-outline` | 40px |
| Área/Tamanho | `resize-outline` | 24px |
| Culturas | `leaf-outline` | 24px |

---

### 🔐 **Login/Perfis**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Administrador | `briefcase-outline` | 24px |
| Colaborador | `people-circle-outline` | 24px |
| Cliente/Produtor | `leaf-outline` | 24px |

---

### ⚠️ **Estados e Alertas**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Vazio/Sem dados | `alert-circle-outline` | 48px |
| Vazio Grande | `alert-circle-outline` | 64px |
| Aviso | `alert-circle-outline` | 24px |
| Sucesso | `checkmark-circle` | 20px |
| Info | `information-circle-outline` | 20px |

---

### 🎯 **Navegação/Ações**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Ir para (seta) | `arrow-forward` | 16px |
| Próximo (chevron) | `chevron-forward` | 20px |
| Expandir | `chevron-down` | 20px |
| Adicionar | `add-circle-outline` | 24px |
| Editar | `create-outline` | 20px |
| Deletar | `trash-outline` | 20px |

---

### 🌤️ **Outros Contextos**
| Contexto | Ícone | Tamanho |
|----------|-------|---------|
| Clima | `partly-sunny-outline` | 18px |
| Saudação (mão) | `hand-left-outline` | 22px |
| Documento | `document-text-outline` | 28px |

---

## ✅ Checklist de Padronização

### Telas Padronizadas:
- [x] LoginScreen
- [x] DashboardScreen
- [x] ClienteDashboardScreen
- [x] ProdutoresScreen
- [x] ProdutorScreen
- [x] MapasScreen
- [x] CadernoCampoScreen
- [x] Navigation (Bottom Tabs)

---

## 🎨 Princípios de Design

### 1. **Consistência de Tamanho**
- Mesmos contextos = mesmo tamanho
- Cards de estatística sempre 24px
- Ícones inline sempre 16px
- Estados vazios sempre 48px ou 64px

### 2. **Estilo Único**
- **SEMPRE usar `-outline`** para manter consistência
- Exceção: ícones de status concluído (`checkmark-circle` sem outline)
- Exceção: ícones de calendário ativo (`calendar` sem outline)

### 3. **Cores Semânticas**
- Primária (`colors.primary`): ações principais, links
- Sucesso (`colors.success`): confirmações, ativos
- Aviso (`colors.warning`): pendentes, alertas
- Muted (`colors.muted`): secundários, desabilitados
- Text (`colors.text`): informações gerais

### 4. **Hierarquia Visual**
```
64px = Estado vazio principal
48px = Estado vazio secundário
40px = Destaque propriedade
32px = Categorias importantes
24px = Cards, estatísticas, navegação
20px = Ações, títulos de seção
16px = Informações inline
```

---

## 📝 Guia de Uso

### ❌ Evite:
```jsx
// Tamanhos inconsistentes
<Ionicons name="map" size={23} />
<Ionicons name="map-outline" size={26} />

// Misturar estilos
<Ionicons name="map" />        // sem outline
<Ionicons name="map-outline" /> // com outline
```

### ✅ Prefira:
```jsx
// Tamanho padronizado
<Ionicons name="map-outline" size={24} />

// Sempre com -outline
<Ionicons name="people-outline" size={24} />
<Ionicons name="calendar-outline" size={16} />
```

---

## 🔄 Atualizações Aplicadas

### LoginScreen:
- ✅ Administrador: `briefcase-outline` (24px)
- ✅ Colaborador: `people-circle-outline` (24px)  
- ✅ Cliente: `leaf-outline` (24px)

### DashboardScreen:
- ✅ Todos os cards com 24px
- ✅ Usando `-outline` consistentemente

### ClienteDashboardScreen:
- ✅ Propriedade: `home-outline` (40px)
- ✅ Categorias: 32px
- ✅ Info inline: 16-24px

### ProdutoresScreen:
- ✅ Busca: 20px
- ✅ Cards: 24px
- ✅ Região: 16px

### ProdutorScreen:
- ✅ Navegação: 16-20px

### MapasScreen:
- ✅ Categorias: 32px
- ✅ Info: 16px
- ✅ Download: 16px

### CadernoCampoScreen:
- ✅ Cards: 24px
- ✅ Info inline: 16px

### Navigation:
- ✅ Tabs: 24px
- ✅ Todos com `-outline`

---

**Padrão estabelecido em:** 10/12/2025  
**Status:** ✅ Aplicado em todas as telas
