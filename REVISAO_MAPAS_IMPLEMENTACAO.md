# Revisão de Implementação — Sistema de Mapas & Limites

> **Data**: Implementação realizada na sessão atual  
> **Escopo**: Reescrita completa da tela de Mapas com duas abas, renderização SVG de shapes e modal de detalhes de talhão  
> **Arquivos modificados/criados**: 6 arquivos (3 novos, 2 modificados, 1 novo schema)

---

## Índice

1. [Resumo Geral](#1-resumo-geral)
2. [Arquivos Criados e Modificados](#2-arquivos-criados-e-modificados)
3. [Detalhamento das Implementações](#3-detalhamento-das-implementações)
4. [Rotas e Navegação](#4-rotas-e-navegação)
5. [Testes de Verificação](#5-testes-de-verificação)
6. [Explicação da Lógica](#6-explicação-da-lógica)
7. [Dependências Instaladas](#7-dependências-instaladas)
8. [Checklist Final](#8-checklist-final)

---

## 1. Resumo Geral

A tela `MapasScreen` foi **completamente reescrita** para suportar duas abas:

| Aba | Nome | Descrição |
|-----|------|-----------|
| 1ª | **Mapas** | Mapas pré-existentes (fertilidade, correção, índice de vegetação, panorama, plantio) |
| 2ª | **Limite** | Shapes/Limites de área com rendering SVG dos polígonos de talhões |

Além da reescrita, foram criados **dois novos componentes** (`ShapeRenderer` e `TalhaoDetailModal`), adicionados **13 registros mock** de limites de área, e definido o **schema da entidade LimiteArea**.

---

## 2. Arquivos Criados e Modificados

### Arquivos NOVOS (criados do zero)

| # | Arquivo | Tipo | Linhas |
|---|---------|------|--------|
| 1 | `src/components/ShapeRenderer.js` | Componente React Native | ~208 |
| 2 | `src/components/TalhaoDetailModal.js` | Componente React Native | ~350 |
| 3 | `entities/LimiteArea.json` | Schema de entidade | ~80 |

### Arquivos MODIFICADOS

| # | Arquivo | O que mudou |
|---|---------|-------------|
| 4 | `src/screens/MapasScreen.js` | **Reescrita completa** — de 736 linhas para ~1547 linhas |
| 5 | `src/api/mock.js` | Adicionado array `limitesArea` (13 registros) + export `LimiteArea` API |
| 6 | `package.json` | Adicionada dependência `react-native-svg@13.4.0` |

### Arquivos NÃO modificados (relevantes)

| Arquivo | Motivo |
|---------|--------|
| `src/navigation/index.js` | A rota `"Mapas"` já existia — **nenhuma alteração necessária** |
| `src/screens/ProdutorScreen.js` | Já navegava para `"Mapas"` com `produtorId` — **sem alteração** |
| `src/screens/ClienteDashboardScreen.js` | Já navegava para `"Mapas"` — **sem alteração** |

---

## 3. Detalhamento das Implementações

### 3.1 — MapasScreen.js (Reescrita Completa)

**Antes**: Tela simples mostrando apenas lista flat de mapas.  
**Depois**: Sistema completo com abas, filtros por ano, busca textual, renderização de shapes SVG, modal de upload, e modal de detalhes.

#### Estados (variáveis de controle)

| Variável | Tipo | Aba | Para que serve |
|----------|------|-----|----------------|
| `abaAtiva` | `string` | Geral | Controla qual aba está ativa (`'mapas'` ou `'limite'`) |
| `loading` | `bool` | Geral | Indicador de carregamento inicial |
| `refreshing` | `bool` | Geral | Indicador de pull-to-refresh |
| `mapas` | `array` | Mapas | Lista de objetos Mapa carregados |
| `categoriaAtiva` | `string` | Mapas | Filtro de categoria selecionada |
| `busca` | `string` | Mapas | Texto digitado na busca |
| `ordenacao` | `string` | Mapas | Tipo de ordenação (`'recente'`, `'titulo'`, `'tamanho'`) |
| `anoFiltroMapas` | `number/null` | Mapas | Ano selecionado no filtro (null = todos) |
| `downloadDialog` | `object` | Mapas | Controle do dialog de download `{ visible, mapa }` |
| `uploadDialog` | `bool` | Ambas | Visibilidade do modal de upload |
| `uploadAno` | `string` | Ambas | Ano digitado no formulário de upload |
| `limites` | `array` | Limite | Lista de LimiteArea carregados |
| `anosDisponiveis` | `array` | Limite | Anos únicos extraídos dos limites |
| `anoFiltroLimite` | `number/null` | Limite | Ano selecionado no filtro LT |
| `selectedTalhao` | `object/null` | Limite | Talhão selecionado para detalhe |
| `talhaoDetailVisible` | `bool` | Limite | Visibilidade do modal de detalhe |
| `buscaLimite` | `string` | Limite | Texto de busca na aba Limite |

#### Funções principais

| Função | O que faz |
|--------|-----------|
| `loadDados()` | Carrega mapas e limites em **paralelo** usando `Promise.all` |
| `getProdutoresPermitidos()` | Retorna IDs de produtores que o usuário tem permissão de ver (baseado no perfil) |
| `loadMapas()` | Chama `Mapa.list()` e filtra por produtores permitidos |
| `loadLimites()` | Chama `LimiteArea.list()` e filtra por produtores permitidos + extrai anos |
| `mapasFiltrados` (memo) | Filtra e ordena mapas por categoria, busca e ano |
| `limitesFiltrados` (memo) | Filtra limites por ano e busca |
| `handleTalhaoPress()` | Seleciona talhão e abre modal de detalhe |
| `handleUploadSimulate()` | Simula upload com validação de ano |
| `formatarTamanho()` | Converte bytes para KB/MB legível |
| `formatarData()` | Formata data no padrão pt-BR |
| `getIconeFormato()` | Retorna ícone Ionicons por extensão de arquivo |

#### Renderização (seções visuais)

**Aba Mapas (`renderAbaMapas`)**:
1. Barra de busca com ícone
2. Filtro horizontal por ano (chips clicáveis)
3. Seletor de ordenação (Recente / Título / Tamanho)
4. Categorias em scroll horizontal (Todos, Fertilidade, Correção, etc.)
5. Estatísticas (Total, Disponíveis, Filtrados)
6. Botão "Upload de Mapa" (visível para admin/colaborador)
7. Lista de mapas agrupados por categoria ou flat

**Aba Limite (`renderAbaLimite`)**:
1. Barra de busca de talhões
2. Filtro por ano LT (formato "LT 2025")
3. Estatísticas (Talhões, Hectares Total, Disponíveis Offline)
4. **ShapeRenderer** — visualização SVG dos polígonos
5. Lista de cards de talhão com chips informativos
6. Botão "Upload Shape" (admin/colaborador)

---

### 3.2 — ShapeRenderer.js (Novo)

**Propósito**: Renderizar polígonos geográficos de talhões como SVG dentro do React Native.

#### Como funciona

1. Recebe array `talhoes` com coordenadas `poligono` (array de `{ lat, lng }`)
2. A função `geoToSvg()` converte coordenadas geográficas para coordenadas de tela:
   - Calcula os limites (min/max) de latitude e longitude
   - Normaliza as coordenadas para o espaço SVG (width × height)
   - Mantém proporção (aspect ratio)
3. Renderiza `<Polygon>` para cada talhão usando as cores definidas nos dados
4. Mostra labels (nome do talhão) posicionados no centróide de cada polígono
5. Talhão selecionado recebe destaque visual (borda mais grossa, opacidade diferente)

#### Props

| Prop | Tipo | Default | Descrição |
|------|------|---------|-----------|
| `talhoes` | `array` | obrigatório | Lista de talhões com campo `poligono` |
| `onTalhaoPress` | `function` | — | Callback ao tocar em um talhão |
| `selectedId` | `string` | — | ID do talhão selecionado |
| `height` | `number` | `280` | Altura do container SVG |
| `showLabels` | `bool` | `true` | Mostrar nomes nos polígonos |
| `showLegend` | `bool` | `true` | Mostrar legenda abaixo |

---

### 3.3 — TalhaoDetailModal.js (Novo)

**Propósito**: Modal estilo bottom-sheet que mostra detalhes completos de um talhão selecionado.

#### Seções do Modal

1. **Header**: Barra de cor + nome do talhão
2. **Info Cards Row**: Área (ha), Perímetro (km), Ano
3. **Características do Solo**: Textura, Tipo Solo, Cultura Atual, Safra, Data Upload
4. **Elementos do Solo**: Grid 2×5 com 10 elementos:
   - pH, Fósforo (P), Potássio (K), Cálcio (Ca), Magnésio (Mg)
   - Matéria Orgânica (MO), CTC, V% (Saturação por Bases), Alumínio (Al), Enxofre (S)
   - Cada um com badge de classificação colorido (Baixo/Médio/Alto/Adequado/Bom/etc.)
5. **Observações**: Texto livre (se houver)
6. **Status Offline**: Ícone indicando se está disponível offline

#### Função `classificarElemento(nome, valor)`

Classifica cada nutriente do solo em faixas:

| Elemento | Baixo | Médio | Alto/Adequado |
|----------|-------|-------|---------------|
| pH | < 5.5 | 5.5–6.5 | > 6.5 |
| Fósforo | < 6 | 6–12 | > 12 |
| Potássio | < 60 | 60–120 | > 120 |
| MO | < 2.5 | 2.5–5 | > 5 |
| V% (Sat. Bases) | < 50 | 50–70 | > 70 |
| Alumínio | < 0.5 (Bom) | 0.5–1.0 | > 1.0 (Tóxico) |

---

### 3.4 — mock.js (Modificado — Dados de LimiteArea)

#### Array `limitesArea` — 13 registros

| ID | Ano | Produtor | Talhão | Área (ha) | Cultura |
|----|-----|----------|--------|-----------|---------|
| lt1 | 2022 | p1 (João Silva - RS) | Talhão A | 45.5 | Soja |
| lt2 | 2022 | p1 | Talhão B | 32.8 | Milho |
| lt3 | 2023 | p1 | Talhão A | 46.2 | Soja |
| lt4 | 2023 | p1 | Talhão C | 28.0 | Trigo |
| lt5 | 2024 | p1 | Talhão A | 46.2 | Soja |
| lt6 | 2024 | p1 | Talhão B | 33.5 | Milho |
| lt7 | 2025 | p1 | Talhão A | 46.5 | Soja |
| lt8 | 2025 | p1 | Talhão B | 33.8 | Milho |
| lt9 | 2025 | p1 | Talhão C | 29.0 | Trigo |
| lt10 | 2024 | p4 (Pedro Costa - GO) | Pivô Central | 120.0 | Soja |
| lt11 | 2025 | p4 | Pivô Central | 120.5 | Soja |
| lt12 | 2024 | p5 (Ana Martins - MT) | Área Norte | 250.0 | Algodão |
| lt13 | 2025 | p5 | Área Norte | 252.0 | Algodão |

Cada registro contém: polígono (5 pontos lat/lng), 10 elementos de solo completos, textura, tipo_solo, safra, cor hex, data_upload, disponibilidade offline, observações.

#### API `LimiteArea` — 9 métodos

| Método | Parâmetro | Retorno |
|--------|-----------|---------|
| `list()` | — | Todos os registros (delay 200ms) |
| `get(id)` | ID do limite | Um registro ou `undefined` |
| `filter(query)` | Objeto de filtro | Registros filtrados |
| `getByAno(ano)` | Número do ano | Registros daquele ano |
| `getByProdutor(produtorId)` | ID do produtor | Registros do produtor |
| `create(data)` | Dados do novo limite | Novo registro com ID gerado |
| `update(id, data)` | ID + novos dados | Registro atualizado |
| `delete(id)` | ID do limite | `true` se removido |
| `getAnosDisponiveis()` | — | Array de anos únicos (desc) |

---

### 3.5 — entities/LimiteArea.json (Novo)

Schema JSON definindo a entidade `LimiteArea`:
- **Descrição**: "Limite de área / Shape de demarcação de talhão - Formato LT (Levantamento Topográfico)"
- **Campos obrigatórios**: `nome`, `ano`, `produtor_id`, `talhao`, `poligono`
- **Texturas disponíveis**: Argilosa, Arenosa, Franco-arenosa, Franco-argilosa, Siltosa, Orgânica
- **10 elementos de solo**: pH, fósforo, potássio, cálcio, magnésio, matéria orgânica, CTC, saturação por bases, alumínio, enxofre

---

## 4. Rotas e Navegação

### Rota principal

```
Stack.Screen name="Mapas" → MapasScreen
```

**Localização**: `src/navigation/index.js` (linha 126)  
**Status**: Pré-existente, **não precisou ser alterada**.

### Como a tela é acessada

| # | Origem | Código de navegação | Param enviado |
|---|--------|---------------------|---------------|
| 1 | `ProdutorScreen` — botão "Ver Todos" (mapas da lavoura) | `navigation.navigate('Mapas', { produtorId: produtor.id })` | `produtorId` do produtor |
| 2 | `ProdutorScreen` — link "Ver mais N mapas" | `navigation.navigate('Mapas', { produtorId: produtor.id })` | `produtorId` do produtor |
| 3 | `ClienteDashboardScreen` — botões de ação | `navigation.navigate('Mapas', { produtorId: primeiraFazenda.id })` | `produtorId` da fazenda |
| 4 | Navegação direta (sem params) | `navigation.navigate('Mapas')` | Nenhum (mostra tudo por perfil) |

### Parâmetro `produtorId`

- **Quando presente**: Filtra mapas e limites apenas do produtor informado
- **Quando ausente**: Aplica filtros baseados no perfil do usuário logado:
  - **Admin**: Vê todos os produtores
  - **Colaborador**: Vê produtores da sua regional/região
  - **Produtor/Cliente**: Vê apenas suas próprias fazendas

---

## 5. Testes de Verificação

### Teste 1 — Acesso à tela Mapas (aba Mapas)

**Pré-condição**: Estar logado como admin  
**Passos**:
1. Na tela de Produtores, toque em qualquer produtor para abrir `ProdutorScreen`
2. Na seção "Mapas da Lavoura", toque no botão **"Ver Todos"**
3. A tela **"Mapas & Limites"** deve abrir na **aba Mapas** (aba ativa padrão)

**Verificar**:
- [X ] Header mostra "Mapas & Limites" com botão voltar
- [X ] Duas abas visíveis: "Mapas" e "Limite"
- [ X] Aba "Mapas" está ativa (com destaque visual)
- [ X] Barra de busca visível
- [ X] Lista de mapas aparece (se o produtor tiver mapas)
- [ X] Cada card de mapa mostra: ícone do formato, título, categoria, data

---

### Teste 2 — Filtros da aba Mapas

**Passos**:
1. Na aba Mapas, role até os chips de categoria
2. Toque em categorias diferentes (Fertilidade, Correção, etc.)
3. Teste o filtro por ano (chips de ano acima das categorias)
4. Digite texto na barra de busca

**Verificar**:
- [X ] Seleção de categoria filtra os mapas corretamente
- [ X] Chip "Todos" mostra mapas de todas as categorias
- [ ] Filtro por ano reduz os mapas ao ano selecionado
- [ X] Busca textual filtra por título/talhão
- [ X] Estatísticas (Total, Disponíveis, Filtrados) atualizam ao filtrar
- [ X] Seletor de ordenação funciona (Recente, Título, Tamanho)

---

### Teste 3 — Aba Limite (shapes/talhões)

**Passos**:
1. Na tela "Mapas & Limites", toque na aba **"Limite"**
2. Observe a renderização dos polígonos SVG
3. Observe a lista de cards de talhão abaixo

**Verificar**:
- [ X] Aba "Limite" ativa com destaque visual
- [X ] Área SVG mostra polígonos coloridos dos talhões
- [X ] Legenda abaixo do SVG lista todos os talhões com suas cores
- [X ] Cards de talhão mostram: nome, área (ha), chips (textura, cultura, pH, offline)
- [ X] Estatísticas mostram: Talhões, ha Total, Disponíveis Offline

---

### Teste 4 — Filtro por ano na aba Limite

**Passos**:
1. Na aba Limite, observe os chips de ano (formato "LT 2025", "LT 2024", etc.)
2. Toque em diferentes anos
3. Toque em "Todos" para voltar ao padrão

**Verificar**:
- [ X] Chips de ano exibem formato "LT XXXX"
- [ X] Filtrar por ano atualiza os polígonos SVG (redesenha apenas talhões daquele ano)
- [X ] Filtrar por ano atualiza a lista de cards abaixo
- [X ] Estatísticas atualizam conforme o filtro
- [ X] Chip "Todos" remove o filtro e mostra todos os limites

---

### Teste 5 — Toque no talhão e modal de detalhes

**Passos**:
1. Na aba Limite, toque em um polígono no SVG **ou** toque no card de um talhão
2. O modal de detalhes deve abrir

**Verificar**:
- [ X] Modal abre em estilo bottom-sheet (sobe de baixo)
- [ X] Header mostra barra com a cor do talhão + nome
- [ ] Info row mostra: Área (ha), Perímetro (km), Ano
- [ X] Seção "Características do Solo" mostra: Textura, Tipo Solo, Cultura, Safra, Data Upload
- [ X] Seção "Elementos do Solo" mostra grid 2×5 com 10 elementos
- [ X] Cada elemento tem badge de classificação colorido (Baixo = vermelho, Médio = amarelo, Alto/Adequado = verde)
- [X ] Ícone de status offline presente
- [ X] Botão fechar (X) funciona

---

### Teste 6 — Upload modal

**Passos**:
1. Logado como admin ou colaborador
2. Em qualquer aba, toque no botão **"Upload de Mapa"** ou **"Upload Shape"**
3. O modal de upload deve abrir

**Verificar**:
- [ X] Modal abre com campo de seleção de arquivo
- [ X] Campo de ano está presente
- [ X] Validação do ano funciona (se digitar letras ou ano inválido, exibe erro) TA DE 2000 A 2030
- [ X] Botão "Upload de Mapa" **não aparece** para perfil produtor/cliente

---

### Teste 7 — Perfis de acesso

**Testar com 3 perfis diferentes**:

| Perfil | Login sugerido | Esperado |
|--------|---------------|----------|
| **Admin** | admin@agro.com / 123456 | Vê mapas/limites de **todos** os produtores |
| **Colaborador** | colaborador@agro.com / 123456 | Vê mapas/limites apenas de produtores da **sua regional** |
| **Produtor/Cliente** | produtor@agro.com / 123456 | Vê apenas mapas/limites das **suas fazendas** |

**Verificar para cada perfil**:
- [x ] Quantidade de mapas/limites está correta para o nível de acesso
- [ x] Botão de upload só aparece para admin e colaborador - VERIFICAR SE O PRODUTOR PRECISA
- [x ] Filtros regionais do contexto são respeitados

---

### Teste 8 — Navegação via ClienteDashboardScreen

**Passos**:
1. Faça login como perfil **produtor/cliente**
2. No Dashboard do cliente, toque no botão que navega para Mapas
3. A tela deve abrir com mapas apenas da fazenda do cliente

**Verificar**:
- [ x] Parâmetro `produtorId` está sendo passado corretamente
- [ x] Apenas dados do produtor logado são exibidos
- [ x] Ambas as abas (Mapas e Limite) filtram pelo mesmo produtor

---

### Teste 9 — Pull-to-refresh

**Passos**:
1. Em qualquer aba, puxe a tela para baixo (swipe down)
2. Indicador de refresh deve aparecer

**Verificar**:
- [ x] Loading spinner aparece durante refresh
- [x ] Dados são recarregados após pull
- [ x] Spinner some ao concluir

---

### Teste 10 — Busca na aba Limite

**Passos**:
1. Na aba Limite, digite "Talhão A" na barra de busca
2. Observe os resultados filtrados

**Verificar**:
- [ x] Lista filtra para mostrar apenas talhões com "Talhão A" no nome
- [x ] SVG redesenha mostrando apenas os polígonos filtrados
- [ x] Limpar busca restaura todos os talhões

---

## 6. Explicação da Lógica

### 6.1 — Fluxo de dados completo

```
[Usuário abre tela]
    ↓
[useEffect → loadDados()]
    ↓
[Promise.all(loadMapas(), loadLimites())]  ← paralelo
    ↓
[getProdutoresPermitidos()]
    ├── Admin → todos os produtores
    ├── Colaborador → produtores da regional (via FiltroContext)
    └── Produtor → apenas suas fazendas
    ↓
[Dados filtrados por permissão, salvos em state]
    ↓
[useMemo: mapasFiltrados / limitesFiltrados]
    ├── Aplica filtro de categoria
    ├── Aplica filtro de busca textual
    ├── Aplica filtro de ano
    └── Aplica ordenação
    ↓
[Renderiza aba ativa com dados filtrados]
```

### 6.2 — Como o ShapeRenderer converte coordenadas

O processo de renderização dos polígonos segue esta lógica:

1. **Coleta todas as coordenadas** de todos os talhões visíveis
2. **Calcula os limites geográficos** (min/max de latitude e longitude)
3. **Para cada coordenada**, aplica a fórmula de normalização:
   ```
   x_svg = ((lng - lng_min) / (lng_max - lng_min)) * largura_svg
   y_svg = ((lat_max - lat) / (lat_max - lat_min)) * altura_svg
   ```
   > Nota: o Y é invertido porque latitude cresce para cima, mas SVG crescer para baixo
4. **Mantém proporção (aspect ratio)** para não distorcer os polígonos
5. **Renderiza cada polígono** com a cor definida no registro

### 6.3 — Como funciona o filtro por perfil

A função `getProdutoresPermitidos()` controla o que cada perfil pode ver:

```
if (route.params.produtorId exists)
    → retorna apenas [produtorId]  // veio de ProdutorScreen

if (perfil === 'admin')
    → Produtor.list() → retorna todos os IDs

if (perfil === 'colaborador')
    → Produtor.list() filtrado pela regional/região do FiltroContext

if (perfil === 'produtor' ou 'cliente')
    → retorna apenas [user.produtor_id] ou fazendas vinculadas
```

### 6.4 — Como funciona o filtro por ano

**Aba Mapas**: O filtro por ano compara `mapa.data_upload` (extraindo o ano) com `anoFiltroMapas`.

**Aba Limite**: O filtro por ano compara `limite.ano` (campo direto) com `anoFiltroLimite`. Os chips exibem no formato **"LT XXXX"** (Levantamento Topográfico).

### 6.5 — Como funciona a classificação de elementos do solo

A função `classificarElemento(nome, valor)` no `TalhaoDetailModal` usa faixas agronômicas para classificar cada nutriente:

```
Para pH:
  < 5.5   → "Ácido"    (vermelho)
  5.5–6.5 → "Adequado" (verde)
  > 6.5   → "Alcalino" (azul)

Para Fósforo (P):
  < 6     → "Baixo"    (vermelho)
  6–12    → "Médio"    (amarelo)
  > 12    → "Alto"     (verde)

Para Alumínio (Al):
  < 0.5   → "Bom"      (verde)     // baixo alumínio é bom
  0.5–1.0 → "Atenção"  (amarelo)
  > 1.0   → "Tóxico"   (vermelho)  // alto alumínio é tóxico
```

Cada badge mostra o texto da classificação com cor de fundo correspondente.

### 6.6 — Nomenclatura LT

A nomenclatura **LT** (Levantamento Topográfico) foi aplicada na aba Limite:
- IDs dos shapes seguem o formato `lt1`, `lt2`, etc.
- Os chips de filtro por ano exibem **"LT 2025"**, **"LT 2024"**, etc.
- Isso diferencia os shapes dos mapas convencionais

### 6.7 — Disponibilidade Offline

Cada registro de limite tem um campo `disponivel_offline` (boolean):
- `true`: O shape está disponível para visualização sem internet
- `false`: Requer conexão para acessar

O ícone de status offline aparece tanto nos cards de talhão quanto no modal de detalhes.

---

## 7. Dependências Instaladas

| Pacote | Versão | Comando usado | Motivo |
|--------|--------|--------------|--------|
| `react-native-svg` | `13.4.0` | `npx expo install react-native-svg` | Renderização de polígonos SVG no ShapeRenderer |
| `react-native-screens` | `~3.20.0` | `npx expo install react-native-screens` | Suporte a Stack navigation (instalado pelo usuário) |

---

## 8. Checklist Final

### Funcionalidades implementadas

- [x] Duas abas (Mapas e Limite) com navegação entre elas
- [x] Badge de contagem em cada aba
- [x] Filtro por ano em ambas as abas
- [x] Busca textual em ambas as abas
- [x] Filtro por categoria na aba Mapas (6 categorias)
- [x] Ordenação na aba Mapas (Recente, Título, Tamanho)
- [x] Renderização SVG de polígonos na aba Limite
- [x] Legenda interativa dos talhões
- [x] Modal de detalhes do talhão com classificação de solo
- [x] 13 registros mock de limites de área
- [x] API mock completa com 9 métodos
- [x] Filtro por perfil de acesso (admin/colaborador/produtor)
- [x] Modal de upload (mapas e shapes)
- [x] Pull-to-refresh
- [x] Schema da entidade LimiteArea
- [x] Nomenclatura LT aplicada
- [x] Indicador offline nos talhões
- [x] Navegação preservada (rota "Mapas" não precisou ser alterada)
- [x] Sem erros de compilação

### Rotas para conferir

| # | Rota/Tela | Como acessar | O que verificar |
|---|-----------|-------------|-----------------|
| 1 | `Mapas` (aba Mapas) | ProdutorScreen → "Ver Todos" | Lista de mapas, filtros, categorias |
| 2 | `Mapas` (aba Limite) | Mesma tela, tocar na aba "Limite" | SVG dos polígonos, cards de talhão |
| 3 | `Mapas` via ClienteDashboard | Login como produtor → Dashboard → botão Mapas | Filtro automático por produtorId |
| 4 | Modal de Detalhes | Aba Limite → tocar em talhão | Dados de solo, classificação, info completa |
| 5 | Modal de Upload | Aba Mapas ou Limite → botão "Upload" | Formulário com validação de ano |

---

> **Nota**: Todos os dados são mock (simulados). A integração com API real exigirá substituir os métodos de `src/api/mock.js` por chamadas HTTP reais.
