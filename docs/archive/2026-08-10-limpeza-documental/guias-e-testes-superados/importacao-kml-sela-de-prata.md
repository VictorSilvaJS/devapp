# Importação do KML — Fazenda Sela de Prata I

**Data:** 12 de março de 2026  
**Objetivo:** Importar o arquivo `Fazenda Sela de Prata I.kml` no aplicativo e renderizá-lo sobre imagem de satélite.

> Guia especifico de caso. Este documento registra uma estrategia aplicada a esta importacao e a uma trilha baseada em WebView/Leaflet, mas nao define sozinho a trilha arquitetural oficial atual do projeto.

> Atualizacao de 2026-05-20: para a validacao atual de mapas/limites no mock, a fonte principal passou a ser o shapefile real da Fazenda Sela de Prata I convertido previamente para GeoJSON/JSON. O KML permanece como registro historico e prova de conceito, mas nao deve ser tratado como pipeline oficial.

---

## Visão Geral

O usuário forneceu um arquivo KML real de uma fazenda com 16 talhões mapeados por GPS. O trabalho consistiu em:

1. Criar uma trilha especifica de visualizacao de mapas por satelite (WebView + Leaflet)
2. Ler, converter e importar os dados do KML para dentro do app
3. Integrar a fazenda como um produtor real no banco de dados mock
4. Conectar o fluxo de navegação para que o usuário acesse o mapa com 2-3 toques

---

## Arquivos Criados

### 1. `src/components/MapaFazendaView.tsx`

**O que é:** Componente React Native que renderiza um mapa Leaflet dentro de uma WebView.

**Por que WebView?** Na epoca desta implementacao, WebView + Leaflet foi adotado como estrategia especifica para este caso. Isso nao deve ser lido como definicao arquitetural oficial permanente do projeto.

**O que ele faz:**
- Gera dinamicamente um HTML completo com Leaflet.js 1.9.4 embutido
- Usa tiles de satélite gratuitos da **ESRI World Imagery** (sem autenticação)
- Recebe um array de talhões (`TalhaoMapa[]`) e renderiza cada um como um polígono colorido sobre o satélite
- Comunica em **duas direções** com o React Native:
  - WebView → RN: quando o usuário toca em um talhão (envia o `id` via `postMessage`)
  - RN → WebView: quando o app quer destacar/selecionar um talhão programaticamente (via `injectJavaScript`)
- Expõe uma `ref` com dois métodos: `selecionarTalhao(id)` e `ajustarLimites()`

**Interfaces exportadas:**
```typescript
// Um ponto geográfico
export interface PontoPoligono {
  lat: number;
  lng: number;
}

// Um talhão com seus dados e contorno GPS
export interface TalhaoMapa {
  id: string;
  talhao: string;          // nome do talhão (ex: "T02-Sede Nova")
  area_hectares: number;
  cor?: string;            // cor do polígono no mapa
  poligono: PontoPoligono[];
  cultura_atual?: string;
  textura?: string;
  tipo_solo?: string;
  safra?: string;
  nome?: string;
}

// Métodos da ref do componente
export interface MapaFazendaViewRef {
  selecionarTalhao: (id: string | null) => void;
  ajustarLimites: () => void;
}
```

---

### 2. `src/screens/FazendaMapaScreen.tsx`

**O que é:** Tela completa de visualização de mapa de fazenda, somente leitura.

**Layout:**
```
┌──────────────────────────────────────────┐
│  ← Header flutuante (nome da fazenda)    │
│  [Chips de ano: Todos | LT 2024 | LT 2025] │
├──────────────────────────────────────────┤
│                                          │
│   MAPA SATÉLITE LEAFLET  (56% da tela)   │
│   [polígonos coloridos dos talhões]      │
│                                          │
├──────────────────────────────────────────┤
│ Painel inferior: lista de talhões (44%)  │
│                                          │
│ [card] T01-230         437.2 ha  ▶       │
│ [card] T02-Sede Nova   210.5 ha  ▶       │
│ ...                                      │
└──────────────────────────────────────────┘
         ↓ ao tocar em um talhão
┌──────────────────────────────────────────┐
│  DRAWER ANIMADO com detalhes:            │
│  • Área (ha) e Perímetro (km)            │
│  • Textura e Tipo de Solo                │
│  • Safra e Cultura atual                 │
│  • pH com classificação por cor          │
│  • Grid 2x5 de 10 elementos do solo:     │
│    P, K, Ca, Mg, MO, CTC, V%, Al, S     │
└──────────────────────────────────────────┘
```

**Lógica de filtragem por perfil:**
- `admin` → vê todos os produtores
- `colaborador` → vê apenas sua região
- `produtor` → vê apenas suas próprias fazendas

**Parâmetros de rota aceitos:**
```typescript
{
  produtorId?: string;    // filtra para um produtor específico
  produtorNome?: string;  // título no header
  fazendaNome?: string;   // subtítulo no header
  talhaoId?: string;      // abre o drawer direto em um talhão específico
}
```

---

### 3. `scripts/convertKML.ps1`

**O que é:** Script PowerShell 5.1 que lê o arquivo KML e gera automaticamente um arquivo TypeScript com os dados convertidos.

**Por que um script separado?** O KML tem ~10.000 pontos GPS no total. Fazer essa conversão dentro do app (em tempo de execução) seria lento e imperformático. O script roda uma vez na máquina do desenvolvedor e produz um arquivo `.ts` estático que é compilado junto com o app.

**O que o script faz, passo a passo:**

1. **Lê e parseia o XML** do arquivo KML
2. **Agrupa os Placemarks por nome** — alguns talhões têm múltiplos segmentos de trilha (`LineString`) que precisam ser unidos em um único polígono
3. **Amostragem uniforme** — limita cada talhão a no máximo **220 pontos** (de até 1.766 originais), mantendo sempre o primeiro e o último ponto. Isso garante performance na renderização sem perder a forma do polígono
4. **Calcula a área aproximada** de cada talhão pelo bounding box (em hectares)
5. **Atribui uma cor distinta** a cada talhão (paleta de 16 cores)
6. **Gera o arquivo TypeScript** com a tipagem correta

**Detalhe técnico — conversão de coordenadas:**
```
KML original:           longitude,latitude,altitude
                        -55.339524,-10.315271,0

Formato do app:         { lat: -10.315271, lng: -55.339524 }
```
O KML usa `longitude` primeiro; o Leaflet e o app usam `latitude` primeiro. O script inverte na hora de gerar o arquivo.

**Resultado da execução:**
```
Placemarks encontrados: 24
Grupos: 16
  T01 - 230 : 220 pts
  T02 - Sede Nova : 220 pts
  T03 - Sede Velha 90 : 220 pts
  ...
Gerado: src/assets/kml/selaDeprata1.ts
  Linhas: 3040 | Tamanho: 134.6 KB | Talhoes: 16
```

---

### 4. `src/assets/kml/selaDeprata1.ts`

**O que é:** Arquivo TypeScript gerado automaticamente pelo script, contendo os dados reais do KML.

**Conteúdo:**
```typescript
// Exportações principais:
export const SELA_DEPRATA_1_NOME = 'Fazenda Sela de Prata I';
export const SELA_DEPRATA_1_PRODUTOR_ID = 'p_sela1';
export const talhoesSelaDeprata1: TalhaoMapa[] = [ /* 16 talhões */ ];
export default talhoesSelaDeprata1;
```

**Os 16 talhões incluídos:**

| ID gerado   | Nome do talhão       | Área (ha) | Pontos |
|-------------|----------------------|-----------|--------|
| sela1_t1    | T01 - 230            | 437.2     | 220    |
| sela1_t2    | T02 - Sede Nova      | 210.5     | 220    |
| sela1_t3    | T03 - Sede Velha 90  | varia     | 220    |
| sela1_t4    | T04 - Sede Velha 60  | varia     | 220    |
| sela1_t5    | T05 - Sede Velha 16  | varia     | 220    |
| sela1_t6    | T06 - Talhão 6       | varia     | 220    |
| sela1_t7    | T07 - Sede Nova 16   | varia     | 220    |
| sela1_t8    | T08 - Areia          | varia     | 220    |
| sela1_t9    | T09 - Mambassa       | varia     | 220    |
| sela1_t10   | T10 - Fogo           | varia     | 220    |
| sela1_t11   | T11 - Mandiocal      | varia     | 220    |
| sela1_t12   | T12 - Casali         | varia     | 220    |
| sela1_t13   | T13 - Arroz          | varia     | 220    |
| sela1_t14   | T27 - Dos Nene       | varia     | 220    |
| sela1_t15   | T28 - Dos Nene       | varia     | 220    |
| sela1_t16   | T31 - Talhão 31      | varia     | 220    |

> **Nota:** 24 Placemarks no KML agrupados em 16 talhões (alguns talhões tinham múltiplos segmentos de rastreio GPS).

---

## Arquivos Modificados

### 5. `src/api/mock.ts`

Três alterações foram feitas neste arquivo:

#### 5.1 — Importação do arquivo KML convertido (linha 4)
```typescript
import { talhoesSelaDeprata1, SELA_DEPRATA_1_PRODUTOR_ID } from '../assets/kml/selaDeprata1';
```

#### 5.2 — Novo produtor: Fazenda Sela de Prata I
Adicionado no final do array `produtores`, após o último produtor existente (`p6b`):
```typescript
{
  id: SELA_DEPRATA_1_PRODUTOR_ID,          // 'p_sela1'
  proprietario_id: 'prop_sela1',
  nome: 'Fazenda Sela de Prata I',
  fazenda: 'Fazenda Sela de Prata I',
  area_total: 6200,                         // hectares
  cultura_atual: 'Soja',
  telefone: '(66) 99000-0001',
  email: 'seladeprataI@agrotche.com',
  endereco: 'Zona Rural, s/n',
  cidade: 'Alta Floresta',
  estado: 'MT',
  regiao: 'Mato Grosso',
  microregiao: 'MT - Norte',
  cep: '78580-000',
  ultima_analise: new Date('2025-06-01').toISOString(),
  status: 'ativo',
  data_cadastro: new Date('2025-01-10').toISOString()
}
```

#### 5.3 — 16 entradas `LimiteArea` via spread
Adicionado no final do array `limitesArea`, após o último talhão existente, usando um `map()` sobre o array importado do KML:
```typescript
...talhoesSelaDeprata1.map((t, i) => ({
  id: t.id,
  nome: `LT 2025 - ${t.talhao}`,
  ano: 2025,
  produtor_id: SELA_DEPRATA_1_PRODUTOR_ID,
  talhao: t.talhao,
  area_hectares: t.area_hectares,
  perimetro_km: parseFloat((Math.sqrt(t.area_hectares) * 0.4).toFixed(2)),
  textura: 'Argilosa',
  tipo_solo: 'Latossolo Vermelho-Amarelo',
  elementos: {
    ph: 5.5 + (i % 5) * 0.2,    // varia entre 5.5 e 6.3 por talhão
    fosforo: 8 + i,
    potassio: 0.25 + i * 0.02,
    calcio: 3.5,
    magnesio: 1.2,
    materia_organica: 2.2,
    ctc: 10.5,
    saturacao_bases: 55,
    aluminio: 0.4,
    enxofre: 6.0,
  },
  cultura_atual: t.cultura_atual || 'Soja',
  poligono: t.poligono,           // ← coordenadas GPS reais do KML
  cor: t.cor,
  data_upload: new Date('2025-05-01').toISOString(),
  safra: t.safra || '2025/2026',
  disponivel_offline: true,
  observacoes: `Contorno GPS importado de KML — ${t.talhao}`,
})),
```

> **Observação sobre `elementos`:** Os dados de análise de solo são fictícios (o KML não contém análise química). Eles foram gerados com variação por índice de talhão (`i`) para que fique visualmente diferente em cada um no drawer de detalhes.

---

### 6. `src/navigation/index.tsx`

Adicionadas duas linhas:

```typescript
// Import da nova tela:
import FazendaMapaScreen from '../screens/FazendaMapaScreen';

// Rota no Stack Navigator:
<Stack.Screen name="FazendaMapa" component={FazendaMapaScreen} />
```

---

### 7. `src/types/navigation.d.ts`

Adicionada a definição de tipagem da nova rota:
```typescript
FazendaMapa: {
  produtorId?: string;
  produtorNome?: string;
  fazendaNome?: string;
  talhaoId?: string;
} | undefined;
```

---

### 8. `src/screens/MapasScreen.tsx`

Historicamente, o botão **"Ver no Mapa Satélite"** foi adicionado na aba "Limite".
No estado atual do MVP, `LimiteArea` e a demarcacao aparecem dentro da experiencia unica de **Panorama da Fazenda**, e o botao visivel ao usuario e **"Ver no Mapa"**:

```tsx
<TouchableOpacity
  style={styles.btnMapaSatelite}
  onPress={() =>
    navigation.navigate('FazendaMapa', {
      produtorId: produtorId || undefined,
    })
  }
>
  <Ionicons name="earth" size={22} color={colors.white} />
  <Text>Ver no Mapa</Text>
  <Text>Abrir panorama da fazenda</Text>
  <Ionicons name="chevron-forward" size={20} />
</TouchableOpacity>
```

---

## Fluxo de Navegação

```
Tela Produtores
      │
      ▼
  [card] Fazenda Sela de Prata I   ← aparece automaticamente por ser cadastrada no mock
      │
      ▼
  ProdutorScreen (detail)
      │
      ├─ aba "Mapas da Lavoura" → MapasScreen (produtorId: 'p_sela1')
      │         │
      │         ▼ Panorama da Fazenda
      │    [Ver no Mapa] ───────────────────────────────────────┐
      │                                                         │
      └─────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                             FazendaMapaScreen
                          ┌──────────────────────┐
                          │ Mapa Leaflet/OSM      │
                          │ + 16 polígonos GPS    │
                          │ + painel de talhões   │
                          │ + drawer de detalhes  │
                          └──────────────────────┘
```

---

## Dependência Instalada

```bash
npx expo install react-native-webview
```

A versão instalada é compatível com **Expo SDK 48** (React Native 0.71.14). A biblioteca é necessária para renderizar o HTML do Leaflet dentro do app nativo.

---

## Tecnologias Utilizadas no Mapa

| Tecnologia | Função | Custo |
|---|---|---|
| `react-native-webview` | Container nativo para HTML/JS | Gratuito |
| **Leaflet.js 1.9.4** | Motor de mapa vetorial | Gratuito (CDN) |
| **ESRI World Imagery** | Tiles de satélite de alta resolução | Gratuito (sem chave de API) |
| **GeoJSON** | Formato de dados para os polígonos | Padrão aberto |

---

## Detalhes Técnicos Importantes

### Formato KML vs formato do app

O KML armazena coordenadas no formato **longitude, latitude, altitude**:
```xml
<coordinates>
  -55.339524,-10.315271,0
  -55.340121,-10.316002,0
  ...
</coordinates>
```

O app (e o Leaflet) usa **{ lat, lng }**:
```typescript
{ lat: -10.315271, lng: -55.339524 }
```

O script `convertKML.ps1` realiza essa inversão automaticamente.

### Downsampling de pontos GPS

O talhão `T02-Sede Nova` tinha **1.766 pontos GPS** originais. Renderizar 1.766 vértices como polígono num WebView Mobile causaria travamentos. O script aplica amostragem uniforme:

```
Passo = ceil(1766 / 219) = 9
→ Mantém 1 de cada 9 pontos + o último ponto
→ Resultado: 220 pontos
→ A forma visual do polígono é preservada
```

### Comunicação WebView ↔ React Native

```
┌─────────────────────┐        ┌──────────────────────┐
│   React Native      │        │   WebView (Leaflet)   │
│                     │        │                       │
│  injectJavaScript() │──────▶ │  selecionarTalhao(id) │
│                     │        │                       │
│  onMessage()        │◀────── │  window.ReactNativeWebView │
│  (talhaoPress)      │        │  .postMessage(json)   │
└─────────────────────┘        └──────────────────────┘
```

---

## Resultado Documentado

Após todas as alterações:

- ✅ **Zero erros TypeScript** em todos os arquivos
- ✅ **16 talhões reais** da Fazenda Sela de Prata I com coordenadas GPS precisas
- ✅ **Produtor cadastrado** no sistema (`p_sela1`) com dados da fazenda em Mato Grosso
- ✅ **Mapa satélite funcional** com polígonos coloridos, labels, zoom automático
- ✅ **Drawer de detalhes** com dados de solo ao tocar em qualquer talhão
- ✅ **Fluxo de navegação** documentado para este caso: Produtores → Detalhe → Mapas → Satélite
- ✅ **Reutilizável:** o botão "Ver no Mapa Satélite" funciona para qualquer produtor — não só a Sela de Prata I
