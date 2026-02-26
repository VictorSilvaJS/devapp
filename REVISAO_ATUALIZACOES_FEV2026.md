# Revisão de Atualizações — Fevereiro 2026

> Documento de revisão detalhado com todas as implementações e alterações realizadas.  
> Gerado em: 26/02/2026

---

## Índice

1. [Resumo Geral](#1-resumo-geral)
2. [Login de Produtores (Pedro Santos e Maria Pereira)](#2-login-de-produtores-pedro-santos-e-maria-pereira)
3. [Correção do Filtro de Colaborador (5 telas)](#3-correção-do-filtro-de-colaborador-5-telas)
4. [Dados Mock para Regiões Goiás e Mato Grosso](#4-dados-mock-para-regiões-goiás-e-mato-grosso)
5. [Padronização do Campo `disponivel_download`](#5-padronização-do-campo-disponivel_download)
6. [Filtro de Sub-Região para Colaboradores](#6-filtro-de-sub-região-para-colaboradores)
7. [Filtro por Fazenda no Dashboard do Produtor](#7-filtro-por-fazenda-no-dashboard-do-produtor)
8. [Campo de Fotos nas Visitas](#8-campo-de-fotos-nas-visitas)
9. [Arquivos Alterados — Resumo](#9-arquivos-alterados--resumo)

---

## 1. Resumo Geral

Foram implementadas **6 frentes de correção/melhoria** que resolvem os problemas identificados na revisão anterior:

| # | Problema Identificado | Solução Aplicada | Telas Afetadas |
|---|----------------------|------------------|----------------|
| 1 | Pedro Santos e Maria Pereira sem login | Criados usuários u11 e u12 em ambos os mocks | `authMock.js`, `mock.js` |
| 2 | Colaborador não encontrava produtores/visitas | Filtro trocado de nome → região/sub-regiões | 5 telas |
| 3 | Regiões Goiás e MT sem dados mock | Adicionados visitas, cadernos e mapas | `mock.js` |
| 4 | Campo `disponivel_para_download` inconsistente | Padronizado para `disponivel_download` | `mock.js` |
| 5 | Colaborador sem opção de filtro por microregião | Chips de sub-região horizontais | `VisitasScreen`, `CadernoCampoScreen` |
| 6 | Produtor sem filtro por fazenda individual | Chips de fazenda com visão "Geral" | `ClienteDashboardScreen` |
| 7 | Visitas sem campo de fotos | Botões câmera/galeria + grid de preview | `NovaVisitaScreen`, `EditarVisitaScreen` |

---

## 2. Login de Produtores (Pedro Santos e Maria Pereira)

### Problema
Os produtores Pedro Santos e Maria Pereira não possuíam credenciais de login, impossibilitando acesso ao perfil `produtor`.

### Alterações

**Arquivo: `src/auth/authMock.js`** (linhas 88-107)
- Adicionado **u11 — Pedro Santos**: email `pedro.santos@email.com`, senha `prod123`, `produtor_id: 'prop_pedro'`
- Adicionado **u12 — Maria Pereira**: email `maria.pereira@email.com`, senha `prod123`, `produtor_id: 'prop_maria'`

**Arquivo: `src/api/mock.js`** (linhas 129-149)
- Adicionados os mesmos usuários na base local com campo `nome` (alinhado ao padrão do mock)

### Como testar
```
Login: pedro.santos@email.com / prod123
Login: maria.pereira@email.com / prod123
```
Ambos devem acessar o `ClienteDashboardScreen` com suas fazendas vinculadas.

---

## 3. Correção do Filtro de Colaborador (5 telas)

### Problema
O colaborador não via seus produtores/visitas porque o filtro buscava por **nome** (`tecnico_responsavel === user.full_name`) em vez de filtrar por **região**. Isso causava 0 resultados quando o nome no mock diferia.

### Solução — Novo padrão de filtragem

Em **todas** as 5 telas, o filtro de colaborador agora segue esta lógica:

```javascript
// Filtrar produtores por região principal OU microregião nas sub_regiões
produtoresData = todosProdutores.filter(p => {
  if (p.regiao === user.regiao) return true;
  if (user.sub_regioes && p.microregiao) {
    return user.sub_regioes.includes(p.microregiao);
  }
  return false;
});
const idsRegiao = produtoresData.map(p => p.id);
// Depois filtra visitas/registros pelo ID dos produtores da região
```

### Telas corrigidas

| Tela | Filtro Antigo | Filtro Novo |
|------|--------------|-------------|
| `VisitasScreen.js` (L79-92) | `tecnico_responsavel === user.full_name` | Região + sub_regiões |
| `CadernoCampoScreen.js` (L66-76) | `colaborador_responsavel === user.full_name` | Região + sub_regiões |
| `DashboardScreen.js` (L69-88) | Carregava TUDO sem filtro | Região + sub_regiões |
| `NovaVisitaScreen.js` (L52-80) | `p.microregiao === user.regiao` (errado) | Região + sub_regiões |
| `EditarVisitaScreen.js` (L90-104) | `p.microregiao === user.regiao` (errado) | Região + sub_regiões |

### Como verificar
Logar como colaborador (ex: `carlos@agro.com`) e verificar que:
- **VisitasScreen**: mostra visitas dos produtores da região Centro-Oeste (Goiás)
- **CadernoCampoScreen**: mostra registros dos produtores da mesma região
- **DashboardScreen**: stats refletem apenas dados da sua região
- **NovaVisitaScreen**: dropdown de produtores mostra apenas os da região
- **EditarVisitaScreen**: dropdown de produtores mostra apenas os da região

---

## 4. Dados Mock para Regiões Goiás e Mato Grosso

### Problema
Os colaboradores Carlos (Centro-Oeste/Goiás) e Marcos (Centro-Oeste/MT) não tinham visitas, cadernos nem mapas associados aos seus produtores regionais.

### Dados adicionados em `src/api/mock.js`

**Visitas (v5-v9)** — linhas 369-432:

| ID | Produtor | Técnico | Objetivo | Status | Data |
|----|----------|---------|----------|--------|------|
| `v5` | p4 (Faz. Planalto) | Carlos Silva | consultoria | realizada | 02/12/2024 |
| `v6` | p4b (Cerrado Alto) | Carlos Silva | coleta_solo | agendada | 20/01/2025 |
| `v7` | p4 (Faz. Planalto) | Carlos Silva | avaliação_cultivo | realizada | 15/11/2024 |
| `v8` | p5 (Cerrado Verde) | Marcos Ferreira | consultoria | realizada | 01/12/2024 |
| `v9` | p5b (Ouro Verde) | Marcos Ferreira | coleta_solo | agendada | 18/01/2025 |

**Cadernos de Campo (c7-c10)** — linhas 523-585:

| ID | Produtor | Colaborador | Tipo | Talhão |
|----|----------|-------------|------|--------|
| `c7` | p4 | Carlos Silva | adubação | Pivô Central |
| `c8` | p4b | Carlos Silva | aplicação | Área 2 |
| `c9` | p5 | Marcos Ferreira | vistoria | Talhão B3 |
| `c10` | p5b | Marcos Ferreira | plantio | Área Norte |

**Mapas (m13-m16)** — linhas 786-848:

| ID | Título | Categoria | Produtor |
|----|--------|-----------|----------|
| `m13` | NDVI - Fazenda Planalto | indice_vegetacao | p4 |
| `m14` | Mapa de Fertilidade - Cerrado Alto | fertilidade | p4b |
| `m15` | Panorama - Agrícola Cerrado Verde | panorama | p5 |
| `m16` | Mapa de Correção - Fazenda Ouro Verde | correção | p5b |

---

## 5. Padronização do Campo `disponivel_download`

### Problema
Os 3 primeiros mapas (m1, m2, m3) usavam `disponivel_para_download`, enquanto os demais usavam `disponivel_download`. A função `Mapa.create` também era inconsistente.

### Correção
- **m1** (L607): `disponivel_para_download` → `disponivel_download: true`
- **m2** (L623): `disponivel_para_download` → `disponivel_download: true`
- **m3** (L639): `disponivel_para_download` → `disponivel_download: false`
- **Mapa.create** (L1123): Agora usa `disponivel_download`
- **Verificação**: grep por `disponivel_para_download` retorna **0 resultados** — campo completamente removido.

---

## 6. Filtro de Sub-Região para Colaboradores

### Problema
O colaborador não tinha opção de filtrar visitas/registros por microregião específica dentro da sua região de atuação.

### Implementação

Adicionada barra horizontal de chips ("pills") que aparece **apenas para colaboradores** com `sub_regioes` definidas.

**Telas implementadas:**

#### VisitasScreen.js
- **Estado**: `filtroSubRegiao` (L43) — valores: `'todas'` ou nome da microregião
- **useEffect**: depende de `[filtros, filtroSubRegiao]` (L47)
- **Lógica de filtro**: Após filtrar por região, aplica sub-filtro (L87-89)
- **UI chips**: Entre o header e o ScrollView, barra horizontal com opção "Todas (região)" e uma opção por sub_regiao (L340-364)
- **Estilos**: `subRegiaoContainer`, `subRegiaoChip`, `subRegiaoChipAtivo`, `subRegiaoChipText`, `subRegiaoChipTextAtivo` (L774-805)

#### CadernoCampoScreen.js
- **Estado**: `filtroSubRegiao` (L33)
- **useEffect**: depende de `[filtros, filtroSubRegiao]` (L37)
- **Lógica de filtro**: Mesma lógica, filtra produtoresData por microregião (L66-76)
- **UI chips**: Mesma estrutura (L175-199)
- **Estilos**: Idênticos ao VisitasScreen (L336-367)

### Comportamento
1. Chip "Todas (Goiás)" — mostra tudo da região
2. Chip "Alto Araguaia" — filtra somente por essa microregião
3. Chip "Cristalina" — filtra somente por essa microregião
4. A seleção é persistida durante a navegação na tela

### Como testar
1. Logar como Carlos (`carlos@agro.com / colab123`)
2. Ir em Visitas ou Caderno de Campo
3. Verificar que a barra de chips aparece abaixo do header
4. Clicar em cada chip e verificar que a lista filtra corretamente

---

## 7. Filtro por Fazenda no Dashboard do Produtor

### Problema
O `ClienteDashboardScreen` mostrava todas as fazendas do proprietário ao mesmo tempo, sem opção de ver dados de uma fazenda específica.

### Implementação — `src/screens/ClienteDashboardScreen.js`

**Estado**: `filtroFazenda` (L32) — valores: `'geral'` ou o `id` de uma fazenda

**Dados filtrados computados** (L137-148):
```javascript
const propriedadesExibidas = filtroFazenda === 'geral'
  ? propriedades
  : propriedades.filter(p => p.id === filtroFazenda);
const idsFiltrados = propriedadesExibidas.map(p => p.id);
const mapasFiltrados = mapas.filter(m => idsFiltrados.includes(m.produtor_id));
const visitasFiltradas = visitas.filter(v => idsFiltrados.includes(v.produtor_id));
const historicoFiltrado = historico.filter(h => idsFiltrados.includes(h.produtor_id));
```

**UI** (L154-180): Barra de chips horizontais com:
- Chip "Geral (N fazendas)" com ícone `globe-outline`
- Um chip por fazenda com ícone `home-outline` e nome da fazenda

**Comportamento**: O filtro só aparece quando o proprietário tem **mais de 1 fazenda**. Quando selecionada uma fazenda, todos os dados são filtrados: cards de propriedade, stats (fazendas, área, culturas, mapas, visitas, atividades), seção de mapas, últimas visitas e atividades recentes.

**Alterações adicionais**:
- `agruparMapasPorCategoria()` agora recebe `listaMapas` como parâmetro para suportar filtragem
- Visitas e atividades exibem até 5 itens (antes: 3)
- Todos os `StatCard` e listas usam os dados filtrados

### Como testar
1. Logar como `maria.pereira@email.com / prod123` (tem Sítio Esperança)
2. Verificar que a barra de chips aparece se houver mais de 1 fazenda
3. Selecionar uma fazenda e verificar que stats, mapas, visitas e atividades filtram
4. Selecionar "Geral" e verificar que volta a mostrar tudo agregado

---

## 8. Campo de Fotos nas Visitas

### Problema
As telas de criação e edição de visitas não possuíam campo para anexar fotos, embora o modelo de dados (`fotos: []`) já existisse.

### Implementação

Adicionado em **NovaVisitaScreen.js** e **EditarVisitaScreen.js**:

#### Funcionalidades
1. **Botão Câmera**: Simula captura de foto (gera URL aleatória via picsum.photos)
2. **Botão Galeria**: Simula seleção da galeria (gera URL aleatória)
3. **Grid de preview**: Miniaturas 90x90px das fotos adicionadas
4. **Botão remover**: Ícone `close-circle` sobre cada foto, com confirmação via `Alert`
5. **Contador**: "N foto(s) anexada(s)" exibido abaixo do grid
6. **Persistência**: Fotos são incluídas no objeto ao salvar (`fotos: fotos`)

#### NovaVisitaScreen.js
- **Imports adicionados**: `Alert`, `Image` (L1-12)
- **Estado**: `fotos` (L37)
- **Funções**: `adicionarFotoSimulada` (L165-177), `removerFoto` (L179-188)
- **UI**: Seção "Fotos da Visita" antes do infoBox (L372-408)
- **Estilos**: 9 novos estilos (L607-661)
- **Dados salvos**: `fotos: fotos` em vez de `fotos: []` (L130)

#### EditarVisitaScreen.js
- **Imports adicionados**: `Alert`, `Image` (L1-11)
- **Estado**: `fotos` (L40)
- **Carregamento**: Fotos existentes são carregadas da visita (L81-87)
- **Funções**: `adicionarFotoSimulada` (L202-213), `removerFoto` (L216-226)
- **UI**: Mesma estrutura do NovaVisitaScreen (L449-484)
- **Estilos**: 9 novos estilos idênticos (L694-744)
- **Dados salvos**: `fotos: fotos` incluído no update (L153)

#### Nota sobre simulação
Como `expo-image-picker` não está instalado no projeto, as fotos usam URLs aleatórias do serviço [picsum.photos](https://picsum.photos) para simular thumbnails. Para integração real:
1. Instalar: `npx expo install expo-image-picker`
2. Substituir `adicionarFotoSimulada` por `ImagePicker.launchCameraAsync()` / `ImagePicker.launchImageLibraryAsync()`

---

## 9. Arquivos Alterados — Resumo

| Arquivo | Tipo de Alteração |
|---------|------------------|
| `src/auth/authMock.js` | +2 usuários produtores (u11, u12) |
| `src/api/mock.js` | +2 usuários, +5 visitas, +4 cadernos, +4 mapas, padronização `disponivel_download` |
| `src/screens/VisitasScreen.js` | Filtro região, sub-region chips UI + estilos |
| `src/screens/CadernoCampoScreen.js` | Filtro região, sub-region chips UI + estilos |
| `src/screens/DashboardScreen.js` | Filtro região (produtores, visitas, registros) |
| `src/screens/NovaVisitaScreen.js` | Filtro região, campo de fotos completo |
| `src/screens/EditarVisitaScreen.js` | Filtro região, campo de fotos completo (com carregamento) |
| `src/screens/ClienteDashboardScreen.js` | Filtro por fazenda com chips + dados filtrados |

**Total: 8 arquivos alterados**

---

## Checklist de Verificação

- [ x] Pedro Santos/Maria Pereira conseguem logar
- [ ] Colaborador (Carlos) vê visitas da região Centro-Oeste/Goiás
- [ ] Colaborador (Marcos) vê visitas da região Centro-Oeste/MT
- [ ] Chips de sub-região aparecem para colaboradores em Visitas
- [ ] Chips de sub-região aparecem para colaboradores em Caderno de Campo
- [ ] Dashboard do colaborador mostra stats filtrados por região
- [ ] NovaVisita/EditarVisita mostram produtores da região do colaborador
- [ ] Produtor com múltiplas fazendas vê filtro por fazenda
- [ ] Filtro "Geral" mostra dados agregados de todas as fazendas
- [ ] Filtro por fazenda filtra visitas, mapas e atividades
- [ ] Botões de foto aparecem em Nova Visita
- [ ] Botões de foto aparecem em Editar Visita
- [ ] Fotos podem ser adicionadas e removidas
- [ ] Campo `disponivel_download` está padronizado (sem `disponivel_para_download`)
