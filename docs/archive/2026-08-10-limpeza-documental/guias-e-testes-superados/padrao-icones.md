# Padrão de Ícones do Aplicativo

Este documento descreve o padrão de ícones utilizado em todo o aplicativo para manter a harmonia visual.

> Guia visual de apoio. Em caso de conflito com o nucleo ativo de `docs/project/`, priorize a terminologia e o estado atual definidos ali.

## Biblioteca Utilizada

**Ionicons** do pacote `@expo/vector-icons`

## 📏 Tamanhos Padronizados

- **Navegação (Tabs)**: `24px`
- **Cards/Estatísticas**: `24px`
- **Categorias/Destaque**: `32px`
- **Títulos/Seções**: `20px`
- **Ícones Inline**: `16px`
- **Estado Vazio**: `48px` ou `64px`
- **Propriedade/Principal**: `40px`

## ✅ Princípio de Design

**SEMPRE usar ícones com sufixo `-outline`** para manter a consistência visual em todo o aplicativo.

Exceções:
- `checkmark-circle` (sem outline) para status concluído
- `calendar` (sem outline) apenas quando representar estado ativo

---

## Ícones por Contexto

### 🔐 Autenticação (LoginScreen)
- **Admin**: `briefcase-outline` (24px) - Representa gestão/administração
- **Colaborador**: `people-circle-outline` (24px) - Representa equipe de campo
- **Produtor**: `leaf-outline` (24px) - Representa agricultura/producao

### 📊 Dashboard
- **Saudação**: `hand-left-outline` - Aceno de boas-vindas
- **Produtores**: `people-outline` - Grupo de pessoas
- **Área/Cultivo**: `leaf-outline` - Folha/agricultura
- **Visitas**: `calendar-outline` - Calendário
- **Registros**: `book-outline` - Livro/documentação
- **Localização**: `location-outline` - Pin de localização
- **Clima**: `partly-sunny-outline` - Sol com nuvens

### 👥 Produtores (ProdutoresScreen)
- **Busca**: `search-outline` - Lupa de busca
- **Limpar busca**: `close-circle` - X em círculo
- **Total de produtores**: `people-outline` - Grupo
- **Produtores ativos**: `checkmark-circle-outline` - Check em círculo
- **Área total**: `leaf-outline` - Folha
- **Pendentes**: `time-outline` - Relógio
- **Adicionar produtor**: `person-add-outline` - Pessoa com +

### 📖 Caderno de Campo (CadernoCampoScreen)
- **Busca**: `search-outline` (20px) - Lupa
- **Limpar busca**: `close-circle-outline` (20px) - X em círculo
- **Registro**: `book-outline` (24px) - Livro
- **Data**: `calendar-outline` (16px) - Calendário
- **Colaborador**: `person-outline` (16px) - Pessoa
- **Área/Local**: `location-outline` (16px) - Pin
- **Fotos**: `images-outline` (16px) - Galeria de imagens
- **Empty state**: `alert-circle-outline` (48px) - Documento

### 🗺️ Mapas (MapasScreen)
- **Mapa Geral**: `map-outline` (64px) - Empty state
- **Categoria Fertilidade**: `leaf-outline` (32px) - Folha
- **Categoria Correção**: `flask-outline` (32px) - Frasco
- **Categoria Índice Vegetação**: `git-network-outline` (32px) - Rede
- **Categoria Panorama**: `image-outline` (32px) - Imagem
- **Categoria Plantio**: `grid-outline` (32px) - Grade
- **Download**: `download-outline` (16px) - Download
- **Data**: `calendar-outline` (16px) - Calendário
- **Talhão**: `location-outline` (16px) - Pin

### 🏠 Dashboard do Produtor (`ClienteDashboardScreen`)
- **Propriedade**: `home-outline` (40px) - Casa principal
- **Área/Tamanho**: `resize-outline` (24px) - Redimensionar
- **Culturas**: `leaf-outline` (24px) - Folha
- **Mapas**: `map-outline` (28px) - Mapa
- **Visitas**: `calendar-outline` (28px) - Calendário
- **Atividades**: `document-text-outline` (28px) - Documento
- **Status Concluído**: `checkmark-circle-outline` (20px) - Check

### 🧭 Navegação (TabBar)
- **Home**: `home-outline` (24px) - Casa
- **Produtores**: `people-outline` (24px) - Grupo
- **Visitas/Histórico**: `calendar-outline` (24px) - Calendário
- **Caderno**: `book-outline` (24px) - Livro
- **Perfil**: `person-outline` (24px) - Pessoa

---

## 🎨 Diretrizes de Uso

### Hierarquia de Tamanhos
```
64px → Estado vazio principal
48px → Estado vazio secundário
40px → Destaque (propriedade, hero)
32px → Categorias importantes
24px → Cards, estatísticas, navegação
20px → Ações, busca, títulos
16px → Informações inline
```

### Cores Semânticas
- **Primary** (`colors.primary`): Ações principais, links, destaques
- **Success** (`colors.success`): Confirmações, status ativo, positivo
- **Warning** (`colors.warning`): Alertas, pendências, atenção
- **Muted** (`colors.muted`): Secundários, desabilitados, placeholder
- **Text** (`colors.text`): Informações gerais, labels

### Boas Práticas

✅ **SEMPRE:**
- Use `-outline` para manter consistência
- Respeite os tamanhos padronizados
- Use cores do tema (nunca hardcode)
- Mantenha hierarquia visual clara

❌ **EVITE:**
- Misturar tamanhos inconsistentes (ex: 23px, 26px)
- Usar ícones preenchidos sem outline
- Cores hardcoded (#FFFFFF, #000000)
- Criar variações fora do padrão

### Exemplos de Código

```jsx
// ✅ Correto
<Ionicons name="map-outline" size={24} color={colors.primary} />
<Ionicons name="people-outline" size={24} color={colors.primary} />

// ❌ Evite
<Ionicons name="map" size={23} color="#2E7D32" />
<Ionicons name="people" size={26} color="green" />
```

---

## 📋 Status de Implementação

### ✅ Telas Padronizadas:
- [x] LoginScreen
- [x] DashboardScreen  
- [x] ClienteDashboardScreen
- [x] ProdutoresScreen
- [x] ProdutorScreen
- [x] MapasScreen
- [x] CadernoCampoScreen
- [x] Navigation (Bottom Tabs)

### 📄 ProdutorScreen (Detalhe do Produtor)
- **Área Total**: `resize-outline` (24px) - Tamanho/área
- **Cultura**: `leaf-outline` (24px) - Folha/planta
- **Visitas**: `calendar-outline` (24px) - Calendário
- **Mapas**: `map-outline` (24px) - Mapa
- **Tab Resumo**: `stats-chart-outline` (20px) - Gráfico/estatísticas
- **Tab Lavoura**: `map-outline` (20px) - Mapa
- **Tab Visitas**: `calendar-outline` (20px) - Calendário
- **Ver Todos**: `chevron-forward-outline` (16px) - Seta para frente
- **Categoria Fertilidade**: `leaf-outline` (24px) - Folha
- **Categoria Índice Vegetação**: `git-network-outline` (24px) - Rede
- **Categoria Correção**: `flask-outline` (24px) - Frasco
- **Data do Mapa**: `calendar-outline` (16px) - Calendário
- **Download**: `download-outline` (16px) - Download
- **Técnico**: `person-outline` (16px) - Pessoa
- **Objetivo**: `flag-outline` (16px) - Bandeira
- **Observações**: `document-text-outline` (16px) - Documento
- **Empty State**: `map-outline` / `calendar-outline` (48px) - Estados vazios

### 📦 Componentes:
- [x] Header
- [x] ProdutorCard
- [x] StatCard
- [x] UserProfile

**Última atualização:** 10/12/2025  
**Status:** padrao visual de referencia, sujeito a validacao contra o estado atual do repositorio

## Benefícios da Padronização

1. **Consistência Visual**: Todos os ícones seguem o mesmo estilo
2. **Performance**: Ícones vetoriais são leves e escaláveis
3. **Acessibilidade**: Melhor contraste e legibilidade
4. **Manutenibilidade**: Fácil atualização e modificação
5. **Profissionalismo**: Aparência moderna e polida

## Evitar

❌ Emojis Unicode (🌾, 👤, 📋, etc.) - exceto em logs de console
❌ Misturar diferentes bibliotecas de ícones
❌ Ícones muito pequenos (< 14px) ou muito grandes (> 80px)
❌ Cores arbitrárias que não estejam no tema

## Recursos

- [Ionicons Gallery](https://ionic.io/ionicons)
- [Expo Vector Icons](https://icons.expo.fyi/)
