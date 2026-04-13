# Guia Completo de Organização de Mapas

## 🗺️ Sistema de Categorização de Mapas - AgroTchê

---

## 📋 Categorias de Mapas

### 1. Mapa de Fertilidade 🌿

**Objetivo:** Análise nutricional completa do solo

#### Subcategorias Implementadas:

##### 1.1 pH do Solo
- **O que é:** Medida de acidez/alcalinidade
- **Importância:** Define disponibilidade de nutrientes
- **Faixa ideal:** 5.5 - 6.5 (maioria das culturas)
- **Arquivo exemplo:** `fertilidade_ph_talhaoa_2024.pdf`

##### 1.2 Fósforo (P)
- **O que é:** Macronutriente essencial
- **Importância:** Desenvolvimento radicular, floração
- **Interpretação:** Baixo/Médio/Alto/Muito Alto
- **Arquivo exemplo:** `fertilidade_p_talhaoa_2024.pdf`

##### 1.3 Potássio (K)
- **O que é:** Macronutriente para vigor
- **Importância:** Resistência a doenças, qualidade
- **Interpretação:** Classes 1-5
- **Arquivo exemplo:** `fertilidade_k_talhaoa_2024.pdf`

##### 1.4 Cálcio (Ca)
- **O que é:** Nutriente estrutural
- **Importância:** Parede celular, crescimento
- **Faixa ideal:** > 4 cmolc/dm³

##### 1.5 Magnésio (Mg)
- **O que é:** Componente da clorofila
- **Importância:** Fotossíntese
- **Faixa ideal:** > 1 cmolc/dm³

##### 1.6 Matéria Orgânica (MO)
- **O que é:** Carbono orgânico do solo
- **Importância:** Estrutura, CTC, retenção de água
- **Faixa ideal:** > 2.5%
- **Arquivo exemplo:** `fertilidade_mo_area1_2024.pdf`

##### 1.7 CTC (Capacidade de Troca Catiônica)
- **O que é:** Capacidade de reter nutrientes
- **Importância:** Fertilidade potencial
- **Classes:** Baixa/Média/Alta

#### Formatos Recomendados:
- **PDF:** Relatórios técnicos com interpretação
- **JPG/PNG:** Mapas coloridos por zona
- **GeoTIFF:** Dados georreferenciados para GIS

#### Exemplo de Estrutura:
```
fertilidade/
├── geral/
│   └── analise_completa_2024.pdf
├── ph/
│   ├── talhaoa_ph_2024.pdf
│   └── talhaob_ph_2024.jpg
├── fosforo/
│   ├── talhaoa_p_2024.pdf
│   └── recomendacao_p.pdf
├── potassio/
│   └── talhaoa_k_2024.pdf
└── materia_organica/
    └── propriedade_mo_2024.pdf
```

---

### 2. Mapa de Correção ⚗️

**Objetivo:** Recomendações para correção do solo

#### Subcategorias:

##### 2.1 Calcário
- **O que é:** Correção de acidez e fornecimento de Ca/Mg
- **Tipos:** Calcítico, Dolomítico, Magnesiano
- **Aplicação:** Taxa variável por zona
- **Arquivo exemplo:** `correcao_calcario_talhaoc_2024.pdf`

##### 2.2 Gesso Agrícola
- **O que é:** Condicionador de solo
- **Objetivo:** Melhora subsuperfície, fornece Ca e S
- **Quando usar:** Solos com Al tóxico ou Ca baixo
- **Arquivo exemplo:** `correcao_gesso_2024.pdf`

##### 2.3 Aplicação de Nutrientes
- **Conteúdo:** Mapas de aplicação variável
- **Formatos:** Shapefile para importar em máquinas
- **Dados:** Dose por zona de manejo

##### 2.4 Zonas de Manejo
- **O que é:** Divisão da área por potencial produtivo
- **Critérios:** Fertilidade, topografia, histórico
- **Uso:** Base para aplicação variável

#### Formatos Recomendados:
- **PDF:** Recomendações técnicas
- **SHP:** Shapefile para máquinas agrícolas
- **DWG:** Para edição em CAD

#### Exemplo de Uso pelo Cliente:
1. Cliente baixa `recomendacao_calcario.pdf`
2. Vê quantidade por talhão
3. Baixa `zonas_aplicacao.shp`
4. Carrega na máquina distribuidora
5. Máquina aplica dose variável automaticamente

---

### 3. Índice de Vegetação 📊

**Objetivo:** Monitoramento do vigor vegetativo via satélite

#### Subcategorias:

##### 3.1 NDVI (Normalized Difference Vegetation Index)
- **O que é:** Índice mais usado, mede biomassa
- **Escala:** -1 a +1 (típico: 0.2 a 0.8 em culturas)
- **Cores:** 
  - Vermelho: baixo vigor
  - Amarelo: médio
  - Verde: alto vigor
- **Frequência:** Semanal/quinzenal
- **Arquivo exemplo:** `ndvi_propriedade_nov2024.jpg`

##### 3.2 NDRE (Normalized Difference Red Edge)
- **O que é:** Índice sensível à clorofila
- **Vantagem:** Não satura em alta biomassa
- **Uso:** Agricultura de precisão, VAR de N
- **Arquivo exemplo:** `ndre_talhaob_nov2024.jpg`

##### 3.3 EVI (Enhanced Vegetation Index)
- **O que é:** NDVI melhorado, corrige atmosfera
- **Quando usar:** Áreas com alta biomassa
- **Vantagem:** Menos saturação que NDVI

##### 3.4 SAVI (Soil Adjusted Vegetation Index)
- **O que é:** Corrige influência do solo
- **Quando usar:** Culturas em início de desenvolvimento
- **Fator L:** Ajuste conforme cobertura

#### Fontes de Dados:
- **Sentinel-2:** Gratuito, 10m resolução, 5 dias
- **Landsat 8:** Gratuito, 30m, 16 dias
- **Planet:** Comercial, 3m, diário
- **Drone:** Alta resolução, sob demanda

#### Formato e Interpretação:
```
Exemplo de imagem NDVI:

[Legenda]
🟥 0.0 - 0.2  → Solo exposto / estresse severo
🟧 0.2 - 0.4  → Baixo vigor / início de estresse
🟨 0.4 - 0.6  → Vigor médio / desenvolvimento normal
🟩 0.6 - 0.8  → Alto vigor / ótimo desenvolvimento
🟦 0.8 - 1.0  → Vegetação muito densa / água
```

#### Uso Prático:
1. **Monitoramento:** Acompanhar evolução da cultura
2. **Detecção de problemas:** Áreas com baixo NDVI
3. **Aplicação variável:** Nitrogênio por zona
4. **Estimativa de produtividade:** Correlação com NDVI

---

### 4. Panorama 🖼️

**Objetivo:** Visão geral da propriedade

#### Conteúdo:

##### 4.1 Ortomosaico
- **O que é:** Montagem de fotos aéreas corrigidas
- **Resolução:** 2-5 cm/pixel
- **Uso:** Planejamento, medições, fiscalização
- **Arquivo exemplo:** `panorama_geral_2024.jpg`

##### 4.2 Delimitação de Talhões
- **O que é:** Divisões da propriedade
- **Uso:** Organização, rastreabilidade
- **Formato:** Shapefile ou KML

##### 4.3 Mapa Geral
- **Conteúdo:** Toda a propriedade em uma imagem
- **Elementos:** Estradas, edificações, cursos d'água
- **Uso:** Apresentação, planejamento estratégico

#### Formatos:
- **JPG/PNG:** Alta resolução para impressão
- **PDF:** Documento com escala e legendas
- **KML:** Visualização no Google Earth

#### Exemplo de Uso:
```
Cliente acessa "Panorama" no app:
├── Vê visão aérea completa
├── Identifica talhões coloridos
├── Visualiza infraestrutura
├── Baixa imagem para apresentação
└── Compartilha com parceiros/bancos
```

---

### 5. Mapas de Plantio 🌾

**Objetivo:** Linhas de plantio e planejamento

#### Subcategorias:

##### 5.1 Linhas de Plantio
- **O que é:** Geometria das linhas para plantar
- **Espaçamento:** Definido por cultura
- **Formato:** DWG, DXF, SHP
- **Arquivo exemplo:** `linhas_plantio_talhaoa.dwg`

##### 5.2 Densidade de Semeadura
- **O que é:** Sementes por metro linear
- **Variação:** Por zona de manejo
- **Formato:** Shapefile com atributo de população

##### 5.3 Áreas de Aplicação
- **O que é:** Zonas para aplicação de insumos
- **Uso:** Carregar em pulverizador/distribuidor
- **Formato:** Shapefile ISOBUS-XML

#### Uso pelo Cliente:

**Cenário Real:**
1. Bruna envia mapa de plantio em DWG
2. Cliente baixa pelo app
3. Técnico da fazenda abre no AutoCAD/QGIS
4. Carrega na plantadeira (monitor)
5. Máquina segue linhas automaticamente (piloto automático)
6. Cliente confirma sucesso no app

#### Formatos Detalhados:

##### DWG (AutoCAD Drawing)
- **Uso:** Edição profissional em CAD
- **Compatibilidade:** AutoCAD, BricsCAD, QGIS
- **Elementos:** Linhas, pontos, polígonos, textos

##### DXF (Drawing Exchange Format)
- **Uso:** Intercâmbio entre softwares
- **Vantagem:** Formato aberto, amplamente suportado

##### SHP (Shapefile)
- **Uso:** GIS e agricultura de precisão
- **Componentes:** .shp, .shx, .dbf, .prj
- **Dados:** Geometria + atributos

##### KML (Keyhole Markup Language)
- **Uso:** Google Earth, apps mobile
- **Vantagem:** Fácil visualização

---

## 📏 Padrões de Nomenclatura

### Convenção de Nomes de Arquivos:

```
[categoria]_[subcategoria]_[identificador]_[talhao]_[data].[ext]

Exemplos:
✅ fertilidade_ph_propriedade_talhaoa_2024-11.pdf
✅ ndvi_sentinel_completo_2024-12-01.jpg
✅ correcao_calcario_talhaoc_2024.pdf
✅ panorama_drone_geral_2024-10.jpg
✅ plantio_linhas_talhaoa_2024-2025.dwg
```

### Estrutura de Pastas Recomendada:

```
propriedade_[nome]/
├── 2024/
│   ├── fertilidade/
│   │   ├── jan/
│   │   └── jul/
│   ├── correcao/
│   │   └── set/
│   ├── indice_vegetacao/
│   │   ├── out/
│   │   ├── nov/
│   │   └── dez/
│   ├── panorama/
│   │   └── ago/
│   └── plantio/
│       └── set/
└── 2025/
    └── ...
```

---

## 🎨 Padrão Visual

### Cores por Categoria:

```css
Fertilidade:    #10b981 (verde)
Correção:       #f59e0b (laranja)
Índ. Vegetação: #3b82f6 (azul)
Panorama:       #8b5cf6 (roxo)
Plantio:        #92400e (marrom)
```

### Ícones:

| Categoria | Ícone | Nome Ionicons |
|-----------|-------|---------------|
| Fertilidade | 🌿 | `leaf-outline` |
| Correção | 🔧 | `construct-outline` |
| Índ. Vegetação | 📊 | `analytics-outline` |
| Panorama | 🖼️ | `image-outline` |
| Plantio | 🌾 | `git-network-outline` |

---

## 📱 Interface no App

### Tela de Mapas - Estrutura:

```
┌─────────────────────────────────┐
│ ← Mapas                         │
├─────────────────────────────────┤
│ [Todos] [Fertilidade] [Correção]│ ← Filtros
│ [Índ.Veg] [Panorama] [Plantio] │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ 12 | 8  | 5                 │ │ ← Stats
│ │Total|Disp|Cats              │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 🌿 Fertilidade (5)              │ ← Categoria
│ ┌───────────────────────────┐   │
│ │ 📄 pH do Solo - Talhão A  │   │
│ │ 15/11/2024 • PDF • 2.5MB  │   │ ← Mapa
│ │ ✅ Disponível             │   │
│ └───────────────────────────┘   │
│ ┌───────────────────────────┐   │
│ │ 📄 Fósforo (P) - Talhão A│   │
│ │ 20/10/2024 • PDF • 1.8MB  │   │
│ │ ✅ Disponível             │   │
│ └───────────────────────────┘   │
├─────────────────────────────────┤
│ 📊 Índice Vegetação (3)         │
│ ...                             │
└─────────────────────────────────┘
```

---

## 🔄 Fluxo de Trabalho

### 1. Coleta de Dados (Colaborador)
```
Visita → Coleta amostras → Lab analisa → Gera mapa → Upload
```

### 2. Processamento (Admin)
```
Upload → Categoriza → Define subcategoria → Marca disponibilidade → Publica
```

### 3. Acesso pelo Cliente
```
Login → Minha Propriedade → Mapas → Filtra categoria → Visualiza → Download
```

---

## 💡 Casos de Uso Reais

### Caso 1: Aplicação Variável de Calcário

**Contexto:** Fazenda com variabilidade de pH

**Etapas:**
1. Colaborador coleta 30 amostras de solo
2. Lab analisa e gera mapa de pH
3. Sistema recomenda calcário por zona
4. Admin faz upload:
   - `fertilidade_ph_completo_2024.pdf` (análise)
   - `correcao_calcario_zonas_2024.shp` (aplicação)
5. Cliente visualiza no app:
   - Vê mapa de pH colorido
   - Lê recomendações em PDF
   - Baixa shapefile
6. Carrega shapefile na distribuidora
7. Aplica calcário com taxa variável
8. **Resultado:** Economia de 30% de calcário + melhor eficiência

---

### Caso 2: Monitoramento de Safra com NDVI

**Contexto:** Acompanhar desenvolvimento de soja

**Etapas:**
1. Sistema processa imagem Sentinel-2 automaticamente
2. Gera NDVI a cada 5 dias
3. Admin faz upload:
   - `ndvi_propriedade_2024-11-01.jpg`
   - `ndvi_propriedade_2024-11-06.jpg`
   - `ndvi_propriedade_2024-11-11.jpg`
4. Cliente acessa no app:
   - Vê evolução do vigor
   - Identifica mancha com baixo NDVI
   - Notifica colaborador
5. Colaborador visita área identificada
6. Detecta deficiência de nitrogênio
7. Faz aplicação corretiva
8. **Resultado:** Salvou 10 ha de perda de produtividade

---

### Caso 3: Linha de Plantio de Precisão

**Contexto:** Plantio de milho com piloto automático

**Etapas:**
1. Topógrafo faz levantamento da área
2. Técnico cria linhas em AutoCAD:
   - Espaçamento 0.5m entre linhas
   - Curvas de nível para conservação
3. Admin faz upload:
   - `plantio_linhas_milho_talhaoa_2024.dwg`
   - `plantio_linhas_milho_talhaoa_2024.shp`
4. Cliente baixa pelo app
5. Operador carrega no monitor da plantadeira
6. Sistema de piloto automático segue linhas
7. **Resultado:** Plantio perfeito + economia de combustível

---

## 🎓 Glossário

**NDVI:** Índice que mede vigor da vegetação usando luz vermelha e infravermelha

**Ortomosaico:** Imagem aérea corrigida geometricamente, sem distorções

**Shapefile:** Formato de arquivo GIS com geometrias e atributos

**CTC:** Capacidade do solo de reter nutrientes (íons positivos)

**Taxa Variável:** Aplicação de insumos com dose diferente por zona

**DWG:** Formato nativo do AutoCAD para desenhos técnicos

**GeoTIFF:** Imagem raster com coordenadas geográficas embutidas

**Piloto Automático:** Sistema que dirige máquinas agrícolas automaticamente

**ISOBUS:** Padrão de comunicação entre máquinas e implementos

**Zona de Manejo:** Subdivisão de talhão por potencial produtivo similar

---

## 📚 Recursos Adicionais

### Links Úteis:
- QGIS (software GIS gratuito)
- Copernicus (imagens Sentinel)
- USGS Earth Explorer (Landsat)
- Embrapa Agricultura de Precisão

### Treinamentos Recomendados:
1. Interpretação de análise de solo
2. Uso de NDVI em agricultura
3. Manipulação de shapefiles
4. Calibração de monitores de máquinas

---

**Documento criado em:** 09/12/2024  
**Versão:** 1.0  
**Próxima revisão:** Conforme feedback dos usuários
