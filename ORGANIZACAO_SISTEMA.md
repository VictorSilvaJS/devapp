# Organização Completa do Sistema AgroTchê

## Data: 09/12/2024

---

## 📋 Índice

1. [Estrutura de Acessos](#estrutura-de-acessos)
2. [Organização dos Mapas](#organização-dos-mapas)
3. [Navegação por Perfil](#navegação-por-perfil)
4. [Estrutura de Regiões](#estrutura-de-regiões)
5. [Caderno de Campo](#caderno-de-campo)
6. [Funcionalidades por Perfil](#funcionalidades-por-perfil)
7. [Fluxo de Uso](#fluxo-de-uso)
8. [Próximas Implementações](#próximas-implementações)

---

## 🔐 Estrutura de Acessos

### 1. Administrador Geral
**Usuários:** Bruna e César

**Permissões:**
- ✅ Acesso a **todas as regiões**
- ✅ Visualização de **todos os produtores**
- ✅ Acesso a **todos os mapas** (mesmo os não disponíveis para download)
- ✅ Visualização de **todas as visitas**
- ✅ Acesso a **todos os registros do caderno de campo**
- ✅ Pode **criar, editar e excluir** produtores
- ✅ Filtro de regiões no dashboard

**Regiões Disponíveis:**
- Sul
- Centro-Oeste
- Norte
- Mato Grosso
- São Paulo
- Recife
- Goiás

---

### 2. Colaborador
**Exemplo:** Carlos Silva (Goiás), Ana Santos (Sul)

**Permissões:**
- ✅ Acesso **apenas à sua região**
- ✅ Visualização de produtores da sua região
- ✅ Acesso a mapas de produtores da sua região
- ✅ Visualização de visitas da sua região
- ✅ Pode adicionar registros no caderno de campo
- ✅ Pode **criar e editar** produtores da sua região
- ❌ Não vê dados de outras regiões

**Menus Visíveis:**
- Dashboard
- Meus Produtores
- Minhas Visitas
- Caderno de Campo
- Perfil

---

### 3. Cliente (Produtor)
**Exemplo:** João Silva (Fazenda Boa Vista)

**Permissões:**
- ✅ Acesso **apenas à sua propriedade**
- ✅ Visualização de mapas **disponíveis para download**
- ✅ Download de arquivos (PDFs, DWG, etc.)
- ✅ Visualização de visitas realizadas na propriedade
- ✅ Acesso ao histórico de atividades (caderno de campo visível)
- ❌ Não pode editar dados
- ❌ Não vê registros internos do caderno

**Menus Visíveis:**
- Minha Propriedade
- Histórico
- Perfil

---

## 🗺️ Organização dos Mapas

### Categorias Principais

#### 1. **Mapa de Fertilidade** 🌿
Análises de nutrientes do solo

**Subcategorias:**
- pH do Solo
- Fósforo (P)
- Potássio (K)
- Cálcio (Ca)
- Magnésio (Mg)
- Matéria Orgânica
- CTC (Capacidade de Troca Catiônica)

**Formatos:**
- PDF (relatórios)
- JPG/PNG (mapas visuais)
- GeoTIFF (dados georreferenciados)

---

#### 2. **Mapa de Correção** ⚗️
Recomendações para correção do solo

**Subcategorias:**
- Calcário
- Gesso Agrícola
- Aplicação de Nutrientes
- Zonas de Manejo

**Formatos:**
- PDF (recomendações)
- SHP (shapefile para máquinas)

---

#### 3. **Índice de Vegetação** 📊
Análises de vigor vegetativo via satélite

**Subcategorias:**
- NDVI (Normalized Difference Vegetation Index)
- NDRE (Normalized Difference Red Edge)
- EVI (Enhanced Vegetation Index)
- SAVI (Soil Adjusted Vegetation Index)

**Formatos:**
- JPG/PNG (imagens de satélite processadas)
- GeoTIFF (dados brutos)
- KML (para Google Earth)

---

#### 4. **Panorama** 🖼️
Visão geral da propriedade

**Conteúdo:**
- Ortomosaico da propriedade
- Vista aérea completa
- Delimitação de talhões
- Mapa geral da área

**Formatos:**
- JPG/PNG (alta resolução)
- PDF (impressão)

---

#### 5. **Mapas de Plantio** 🌾
Linhas de plantio e planejamento

**Conteúdo:**
- Linhas de plantio
- Espaçamento
- Densidade de semeadura
- Áreas para aplicação

**Formatos:**
- DWG (AutoCAD)
- DXF
- SHP (shapefile)

---

### Estrutura de Arquivos

```
propriedade/
├── fertilidade/
│   ├── ph_talhaoa_2024.pdf
│   ├── fosforo_talhaoa_2024.pdf
│   └── potassio_talhaoa_2024.pdf
├── correcao/
│   ├── calcario_talhaoc_2024.pdf
│   └── recomendacao_geral.pdf
├── indice_vegetacao/
│   ├── ndvi_propriedade_nov2024.jpg
│   └── ndre_talhaob_nov2024.jpg
├── panorama/
│   └── panorama_geral_2024.jpg
└── plantio/
    └── linhas_plantio_talhaoa.dwg
```

---

## 🧭 Navegação por Perfil

### Navegação Administrador

```
Bottom Tabs:
├── Dashboard (visão geral de todas as regiões)
├── Produtores (todos os produtores com filtro de região)
├── Visitas (todas as visitas)
├── Caderno (todos os registros)
└── Perfil

Stack Screens:
├── ProdutorDetail (detalhes do produtor)
├── Mapas (tela completa de mapas com categorias)
├── NovoProdutor
├── EditarProdutor
└── EditProfile
```

---

### Navegação Colaborador

```
Bottom Tabs:
├── Dashboard (visão da sua região)
├── Meus Produtores (apenas da sua região)
├── Minhas Visitas (apenas da sua região)
├── Caderno (registros da sua região)
└── Perfil

Stack Screens:
├── ProdutorDetail
├── Mapas
├── NovoProdutor (apenas para sua região)
└── EditarProdutor (apenas da sua região)
```

---

### Navegação Cliente

```
Bottom Tabs:
├── Minha Propriedade (dashboard específico)
├── Histórico (atividades e visitas)
└── Perfil

Stack Screens:
├── Mapas (apenas mapas disponíveis para download)
└── EditProfile
```

---

## 🌍 Estrutura de Regiões

### Regiões Implementadas

1. **Sul**
   - Microrregiões: RS - Norte, RS - Centro, RS - Sul
   - Estados: Rio Grande do Sul, Santa Catarina, Paraná

2. **Centro-Oeste**
   - Microrregiões: GO - Sul, GO - Centro, GO - Norte
   - Estados: Goiás, Mato Grosso do Sul, Distrito Federal

3. **Goiás** (região específica)
   - Microrregiões: Sul, Centro, Norte
   - Principais cidades: Rio Verde, Jataí, Goiânia

4. **Mato Grosso**
   - Microrregiões: MT - Norte, MT - Centro, MT - Sul
   - Principais cidades: Sorriso, Lucas do Rio Verde, Sinop

5. **São Paulo**
   - Microrregiões: SP - Oeste, SP - Centro, SP - Vale
   - Foco em agricultura tecnificada

6. **Recife (Nordeste)**
   - Microrregiões: PE - Litoral, PE - Agreste, PE - Sertão
   - Pernambuco e regiões próximas

7. **Norte**
   - Estados: Pará, Tocantins, Rondônia
   - Expansão agrícola

---

## 📓 Caderno de Campo

### Tipos de Atividades

1. **Plantio**
   - Data e área plantada
   - Variedade de sementes
   - Espaçamento
   - Condições climáticas

2. **Adubação**
   - Produtos utilizados
   - Dosagem por hectare
   - Área aplicada
   - Método de aplicação

3. **Aplicação (Defensivos)**
   - Produto aplicado
   - Dosagem
   - Alvo (pragas, doenças, plantas daninhas)
   - Condições climáticas

4. **Colheita**
   - Data
   - Área colhida
   - Produtividade estimada
   - Qualidade do produto

5. **Análise de Solo**
   - Pontos coletados
   - Laboratório
   - Resultados principais

6. **Vistoria**
   - Observações gerais
   - Problemas identificados
   - Recomendações

7. **Outro**
   - Atividades diversas

### Campos do Registro

```javascript
{
  id: "c1",
  produtor_id: "p1",
  colaborador_responsavel: "Carlos Silva",
  data_atividade: "2024-12-09",
  tipo_atividade: "adubacao",
  talhao: "Talhão A",
  produtos_utilizados: ["NPK 10-20-20"],
  dosagem: "250 kg/ha",
  area_aplicada: 50,
  condicoes_clima: "Ensolarado, 25°C",
  observacoes: "Aplicação uniforme...",
  recomendacoes: "Monitorar crescimento...",
  visivel_para_cliente: true,  // Cliente pode ver?
  fotos: ["foto1.jpg", "foto2.jpg"]
}
```

### Visibilidade

- **Administrador:** Vê todos os registros
- **Colaborador:** Vê registros da sua região
- **Cliente:** Vê apenas registros com `visivel_para_cliente: true`

---

## ⚙️ Funcionalidades por Perfil

### Matriz de Permissões

| Funcionalidade | Admin | Colaborador | Cliente |
|----------------|-------|-------------|---------|
| Ver todos os produtores | ✅ | ❌ (só sua região) | ❌ (só o seu) |
| Criar produtor | ✅ | ✅ (sua região) | ❌ |
| Editar produtor | ✅ | ✅ (sua região) | ❌ |
| Excluir produtor | ✅ | ❌ | ❌ |
| Ver todos os mapas | ✅ | ✅ (sua região) | ❌ (só disponíveis) |
| Download de mapas | ✅ | ✅ | ✅ (disponíveis) |
| Ver todas as visitas | ✅ | ❌ (só sua região) | ❌ (só as suas) |
| Registrar visita | ✅ | ✅ | ❌ |
| Ver caderno completo | ✅ | ✅ (sua região) | ❌ (só visíveis) |
| Adicionar no caderno | ✅ | ✅ | ❌ |
| Filtrar por região | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |

---

## 🔄 Fluxo de Uso

### Fluxo do Administrador

1. **Login** → Escolhe perfil "admin"
2. **Dashboard** → Visão geral de todas as regiões
3. **Seleciona Região** → Ex: "Goiás"
4. **Vê Produtores** → Filtrados por região
5. **Acessa Produtor** → Vê detalhes, mapas, visitas
6. **Gerencia Mapas** → Upload, categorização, disponibilização
7. **Controla Acessos** → Define quais mapas clientes podem baixar

---

### Fluxo do Colaborador

1. **Login** → Perfil "colaborador" (região: Goiás)
2. **Dashboard** → Vê apenas dados de Goiás
3. **Meus Produtores** → Lista filtrada automaticamente
4. **Visita Produtor** → Registra visita no sistema
5. **Adiciona no Caderno** → Registra atividade realizada
6. **Upload de Mapas** → Adiciona mapas dos produtores
7. **Marca Visibilidade** → Define se cliente pode ver

---

### Fluxo do Cliente

1. **Login** → Acesso automaticamente vinculado à propriedade
2. **Minha Propriedade** → Dashboard com:
   - Área total
   - Cultura atual
   - Mapas disponíveis (agrupados por categoria)
   - Últimas visitas
   - Atividades recentes
3. **Mapas** → Vê categorias:
   - Fertilidade (pH, P, K, etc.)
   - Correção (Calcário, Gesso)
   - Índice Vegetação (NDVI, NDRE)
   - Panorama
   - Plantio (DWG para baixar)
4. **Download** → Clica e baixa arquivo
5. **Histórico** → Vê visitas e atividades realizadas

---

## 📱 Telas Implementadas

### 1. **ProdutoresScreen**
- Lista de produtores
- Filtros: busca, status, região (admin)
- Cards com informações resumidas
- Botão "Novo Produtor" (admin/colaborador)

### 2. **ProdutorScreen (Detalhes)**
- Informações completas
- Tabs: Resumo, Lavoura, Visitas
- Botão "Ver Mapas Completos"
- Acesso rápido aos últimos 3 mapas

### 3. **MapasScreen**
- Filtro por categoria
- Estatísticas (total, disponíveis, categorias)
- Cards de mapas com:
  - Ícone do formato
  - Título e subcategoria
  - Data e talhão
  - Tamanho do arquivo
  - Indicador de disponibilidade
- Botão de download
- Agrupamento por categoria

### 4. **ClienteDashboardScreen**
- Card da propriedade
- Resumo (mapas, visitas, atividades)
- Mapas por categoria (scroll horizontal)
- Últimas visitas (3 mais recentes)
- Atividades recentes (3 mais recentes)
- Links para ver tudo

### 5. **CadernoCampoScreen**
- Lista de registros
- Filtros por tipo de atividade
- Filtros automáticos por perfil
- Cards com informações detalhadas
- Indicador de visibilidade

---

## 🎨 Organização Visual dos Mapas

### Ícones por Categoria

- **Fertilidade:** 🌿 `leaf-outline`
- **Correção:** 🔧 `construct-outline`
- **Índice Vegetação:** 📊 `analytics-outline`
- **Panorama:** 🖼️ `image-outline`
- **Plantio:** 🌾 `git-network-outline`

### Ícones por Formato

- **PDF:** 📄 `document-text`
- **DWG/DXF:** 🔨 `hammer`
- **JPG/PNG:** 🖼️ `image`
- **SHP/KML:** 🗺️ `map`
- **GeoTIFF:** 📚 `layers`

### Cores

- **Fertilidade:** Verde (`#10b981`)
- **Correção:** Laranja (`#f59e0b`)
- **Índice Vegetação:** Azul (`#3b82f6`)
- **Panorama:** Roxo (`#8b5cf6`)
- **Plantio:** Marrom (`#92400e`)

---

## 🔧 Utilitários de Controle de Acesso

### Arquivo: `src/utils/acessoControle.js`

**Funções Implementadas:**

1. `temAcessoProdutor(user, produtor)`
2. `filtrarProdutoresPorAcesso(produtores, user)`
3. `temAcessoMapa(user, mapa, produtor)`
4. `filtrarMapasPorAcesso(mapas, user, produtores)`
5. `temAcessoCaderno(user, registro, produtor)`
6. `filtrarCadernosPorAcesso(registros, user, produtores)`
7. `temAcessoVisita(user, visita, produtor)`
8. `filtrarVisitasPorAcesso(visitas, user, produtores)`
9. `getRegioesDisponiveis(user, produtores)`
10. `podeEditarProdutor(user, produtor)`
11. `podeCriarProdutor(user)`
12. `podeBaixarMapa(user, mapa)`
13. `getTituloTela(user, tela)`

---

## 📊 Estrutura de Dados

### Produtor (Entidade)

```javascript
{
  id: "p1",
  nome: "João Silva",
  fazenda: "Fazenda Boa Vista",
  area_total: 850,
  cultura_atual: "Soja",
  telefone: "(51) 96666-6666",
  email: "joao.silva@email.com",
  endereco: "Estrada Rural, Km 12",
  cidade: "Cruz Alta",
  estado: "RS",
  regiao: "Sul",              // ✨ NOVO
  microregiao: "RS - Norte",  // ✨ NOVO
  cep: "98100-000",
  ultima_analise: "2024-10-15",
  status: "ativo",
  data_cadastro: "2024-04-20"
}
```

### Usuário (Entidade)

```javascript
{
  id: "u1",
  nome: "Bruna Administradora",
  email: "bruna@agrotche.com",
  perfil: "admin",  // admin | colaborador | cliente
  regiao: null,  // Para colaborador
  regioes_acesso: ["Sul", "Goiás", "MT"],  // ✨ NOVO (admin)
  produtor_id: null,  // Para cliente
  telefone: "(51) 99999-9999",
  ativo: true,
  data_cadastro: "2024-01-01"
}
```

### Mapa (Entidade)

```javascript
{
  id: "m1",
  titulo: "Mapa de Fertilidade - pH do Solo",
  categoria: "fertilidade",
  subcategoria: "pH",  // ✨ NOVO
  produtor_id: "p1",
  talhao: "Talhão A",
  data_criacao: "2024-11-01",
  safra: "2024/2025",
  arquivo_url: "mapas/fertilidade_ph_p1_talhaoa.pdf",
  arquivo_panorama_url: "mapas/panorama_p1_talhaoa.jpg",
  formato_arquivo: "pdf",  // ✨ NOVO
  tamanho_arquivo: 2548000,  // ✨ NOVO (bytes)
  disponivel_download: true,  // ✨ NOVO
  coordenadas: {
    latitude: -28.6341,
    longitude: -53.6055
  },
  observacoes: "Análise detalhada do pH em 20 pontos."
}
```

---

## 🚀 Próximas Implementações

### Curto Prazo (1-2 semanas)

1. **Upload de Mapas**
   - Interface para upload
   - Validação de formatos
   - Compressão automática
   - Geração de thumbnails

2. **Relatórios**
   - Relatório de atividades por período
   - Relatório de visitas realizadas
   - Exportação em PDF

3. **Notificações**
   - Push quando novo mapa disponível
   - Lembrete de visitas agendadas
   - Alertas de atividades pendentes

4. **Busca Avançada**
   - Filtro por safra
   - Filtro por talhão
   - Filtro por data

### Médio Prazo (1 mês)

1. **Visualização de Mapas no App**
   - Viewer de PDF integrado
   - Visualização de imagens
   - Zoom e pan em mapas

2. **Sincronização Offline**
   - Download de mapas para uso offline
   - Cache de dados
   - Sincronização automática

3. **Gráficos e Análises**
   - Evolução de índices ao longo do tempo
   - Comparação entre talhões
   - Análise de produtividade

4. **Chat/Mensagens**
   - Comunicação entre colaborador e produtor
   - Anexar fotos e documentos
   - Histórico de conversas

### Longo Prazo (3+ meses)

1. **Integração com Máquinas**
   - Exportar mapas de aplicação
   - Importar dados de telemetria
   - Integração com ISO 11783 (ISOBUS)

2. **IA e Machine Learning**
   - Predição de produtividade
   - Detecção automática de problemas
   - Recomendações personalizadas

3. **Módulo Financeiro**
   - Controle de custos
   - Receitas por talhão
   - ROI de aplicações

4. **App Web Completo**
   - Versão desktop
   - Painéis administrativos
   - Relatórios avançados

---

## 📝 Notas de Implementação

### Tecnologias Utilizadas

- **Framework:** React Native (Expo)
- **Navegação:** React Navigation (Bottom Tabs + Stack)
- **Estado:** React Context API
- **Armazenamento:** AsyncStorage
- **Ícones:** Ionicons
- **Estilo:** StyleSheet + tema customizado

### Padrões de Código

- Componentes funcionais com hooks
- Context API para autenticação
- Utilitários separados para lógica de negócio
- Mock data para desenvolvimento
- Validação de dados com validators

### Estrutura de Pastas

```
src/
├── api/           # API e dados mock
├── assets/        # Imagens e recursos
├── auth/          # Contexto de autenticação
├── components/    # Componentes reutilizáveis
├── navigation/    # Configuração de navegação
├── screens/       # Telas do aplicativo
├── utils/         # Utilitários e helpers
└── theme.js       # Tema e estilos globais
```

---

## ✅ Checklist de Implementação

- [x] Estrutura de entidades atualizada
- [x] Sistema de regiões implementado
- [x] Controle de acesso por perfil
- [x] Tela de mapas com categorias
- [x] Filtros por categoria de mapa
- [x] Dashboard específico para cliente
- [x] Navegação diferenciada por perfil
- [x] Utilitários de controle de acesso
- [x] Filtro de região para admin
- [x] Botões condicionais (criar/editar)
- [ ] Upload de mapas
- [ ] Visualizador de PDF/imagens
- [ ] Notificações push
- [ ] Sincronização offline
- [ ] Relatórios em PDF
- [ ] Chat integrado

---

## 🎯 Próximos Passos Sugeridos

1. **Testar com usuários reais** de cada perfil
2. **Coletar feedback** sobre usabilidade
3. **Implementar upload** de arquivos
4. **Adicionar mais categorias** de mapas conforme necessário
5. **Criar tutorial** de primeiro acesso
6. **Documentar API** para integração futura
7. **Preparar para produção** (build, deployment)

---

## 📞 Contato e Suporte

Para dúvidas ou sugestões sobre a organização do sistema:
- **Desenvolvedores:** Equipe AgroTchê Dev
- **Documentação:** Este arquivo (ORGANIZACAO_SISTEMA.md)
- **Issues:** Use o sistema de controle de versão

---

**Última atualização:** 09/12/2024
**Versão do documento:** 1.0
**Status:** ✅ Implementado e Documentado
