# Entidades do Sistema

Este diretório contém as definições das entidades do sistema em formato JSON Schema.

## Entidades Disponíveis

### User
Representa um usuário do sistema com diferentes perfis de acesso.

**Perfis:**
- `admin`: Administrador do sistema
- `colaborador`: Colaborador/técnico da empresa
- `cliente`: Produtor cliente

### Produtor
Representa um produtor rural e suas informações cadastrais.

**Status:**
- `ativo`: Produtor ativo no sistema
- `inativo`: Produtor inativo
- `pendente`: Cadastro em análise

### Mapa
Representa mapas técnicos de talhões e propriedades.

**Categorias:**
- `fertilidade`: Mapas de fertilidade do solo
- `correcao`: Mapas de correção do solo
- `indice_vegetacao`: Mapas de índice de vegetação
- `colheita`: Mapas de colheita
- `plantio`: Mapas de plantio

### Visita
Representa visitas técnicas realizadas aos produtores.

**Objetivos:**
- `consultoria`: Consultoria técnica
- `coleta_solo`: Coleta de amostras de solo
- `avaliacao_cultivo`: Avaliação de cultivo
- `entrega_material`: Entrega de material
- `outro`: Outros objetivos

### CadernoCampo
Representa registros de atividades de campo.

**Tipos de Atividade:**
- `plantio`: Atividade de plantio
- `adubacao`: Adubação
- `aplicacao`: Aplicação de defensivos
- `colheita`: Colheita
- `analise_solo`: Análise de solo
- `vistoria`: Vistoria técnica
- `outro`: Outras atividades

## Uso

Essas definições servem como documentação e podem ser utilizadas para:
- Validação de dados
- Geração de documentação de API
- Criação de formulários dinâmicos
- Testes automatizados
- Integração com banco de dados
