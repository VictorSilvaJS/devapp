# AgroTchê — Atualização do Sistema de Mapas
### Reunião de Apresentação | 03 de Março de 2026

---

## O que foi atualizado?

Implementamos o **Sistema de Mapas & Limites** completo no aplicativo AgroTchê.

A tela de mapas foi **totalmente reformulada** e agora oferece duas visões distintas para o usuário:

---

## As duas abas do novo sistema

### Aba 1 — Mapas
> "Mapas pré-existentes da lavoura"

Os mapas gerados nas análises de campo ficam organizados aqui, separados por tipo:

| Categoria | O que representa |
|-----------|-----------------|
| **Fertilidade** | Mapa de nutrientes do solo |
| **Correção** | Mapa de calagem e gessagem |
| **Índice de Vegetação** | NDVI e saúde das plantas |
| **Panorama** | Visão geral da área |
| **Plantio** | Mapa de semeadura |

O usuário pode **filtrar por ano**, **buscar por nome** e **ordenar** por data, título ou tamanho.

---

### Aba 2 — Limite
> "Shapes e demarcações de talhões (formato LT)"

Aqui ficam os **limites geográficos** dos talhões da propriedade, identificados no formato **LT (Levantamento Topográfico)**.

O grande diferencial: os talhões são **desenhados visualmente** na tela, como um mapa simplificado, com cada área em uma cor diferente.

---

## O que o usuário consegue fazer?

### No campo de Limites (Aba Limite)

1. **Ver os talhões desenhados** — visualização dos polígonos da propriedade
2. **Filtrar por ano** — ex: "LT 2025", "LT 2024" — ideal para comparar como a propriedade evoluiu
3. **Tocar em um talhão** — abre os detalhes completos daquela área

### Nos detalhes do talhão, o usuário vê:
- Área em hectares e perímetro em km
- Textura e tipo do solo
- Cultura atual e safra
- **Análise de solo com 10 elementos** (pH, Fósforo, Potássio, Cálcio, Magnésio, Matéria Orgânica, CTC, Saturação por Bases, Alumínio, Enxofre)
- Cada elemento com um **badge colorido** indicando se está Baixo, Médio ou Adequado
- Se o dado está disponível **sem internet (offline)**

---

## Quem vê o quê? (Controle de acesso)

O sistema é inteligente e exibe informações de acordo com o perfil de quem está logado:

| Perfil | O que vê |
|--------|----------|
| **Administrador** | Todos os produtores, todas as propriedades |
| **Colaborador** | Apenas os produtores da sua regional |
| **Produtor / Cliente** | Apenas as suas próprias fazendas |

Além disso, **somente Admin e Colaborador** conseguem fazer upload de mapas e shapes.

---

## Como isso aparece no fluxo do app?

```
Tela de Produtores
    → Abre um Produtor
        → Seção "Mapas da Lavoura"
            → Botão "Ver Todos"
                → Tela Mapas & Limites
```

O cliente (perfil Produtor) também acessa pelo próprio **Dashboard**, onde vê os mapas da sua fazenda diretamente.

---

## O que foi construído tecnicamente?

> *(Para quem quiser mais detalhes)*

| Componente | Descrição |
|------------|-----------|
| **MapasScreen** | Tela principal reescrita — agora com ~1.500 linhas, suportando as 2 abas e todos os filtros |
| **ShapeRenderer** | Novo componente que desenha os polígonos dos talhões como gráfico vetorial (SVG) |
| **TalhaoDetailModal** | Novo componente — modal com detalhes completos do talhão e análise de solo |
| **LimiteArea API** | Novo módulo de dados com 13 propriedades cadastradas e 9 métodos de busca/filtro |
| **LimiteArea.json** | Schema da nova entidade definido e documentado |

---

## Dados disponíveis para demonstração

O sistema já conta com **13 áreas cadastradas** para demonstração:

| Produtor | Estado | Talhões | Anos disponíveis |
|----------|--------|---------|-----------------|
| João Silva | RS | Talhão A, B, C | 2022, 2023, 2024, 2025 |
| Pedro Costa | GO | Pivô Central | 2024, 2025 |
| Ana Martins | MT | Área Norte | 2024, 2025 |

---

## Resultado

O produtor agora tem uma **visão espacial da sua propriedade** dentro do próprio celular, podendo acompanhar a evolução dos talhões ao longo dos anos e consultar a fertilidade do solo de forma simples e visual.

O técnico (colaborador) consegue acessar os dados de seus produtores de forma organizada, filtrada e com controle de permissão.

---

*Documento gerado em 03/03/2026 — AgroTchê Mobile*
