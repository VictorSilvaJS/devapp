# API Mock - Documentação

Esta API mock simula um backend para o sistema de gestão agrícola, baseada nas entidades definidas em `/entities`.

## Entidades e Endpoints

### User (Usuário)

**Métodos disponíveis:**
- `User.list()` - Lista todos os usuários
- `User.get(id)` - Busca usuário por ID
- `User.getByEmail(email)` - Busca usuário por email
- `User.filter(query)` - Filtra usuários (ex: `{ perfil: 'admin' }`)
- `User.create(data)` - Cria novo usuário
- `User.update(id, data)` - Atualiza usuário
- `User.delete(id)` - Remove usuário

**Exemplo de uso:**
```javascript
import { User } from '../api/mock';

// Listar todos os usuários
const usuarios = await User.list();

// Buscar por email
const usuario = await User.getByEmail('admin@agro.com');

// Filtrar colaboradores
const colaboradores = await User.filter({ perfil: 'colaborador' });

// Criar novo usuário
const novoUsuario = await User.create({
  nome: 'Novo Colaborador',
  email: 'novo@agro.com',
  senha: 'hash',
  perfil: 'colaborador',
  regiao: 'RS - Norte'
});
```

---

### Produtor

**Métodos disponíveis:**
- `Produtor.list()` - Lista todos os produtores
- `Produtor.get(id)` - Busca produtor por ID
- `Produtor.filter(query)` - Filtra produtores
- `Produtor.create(data)` - Cria novo produtor
- `Produtor.update(id, data)` - Atualiza produtor
- `Produtor.delete(id)` - Remove produtor

**Exemplo de uso:**
```javascript
import { Produtor } from '../api/mock';

// Listar produtores ativos
const ativos = await Produtor.filter({ status: 'ativo' });

// Buscar por cidade
const produtoresCruzAlta = await Produtor.filter({ cidade: 'Cruz Alta' });

// Criar novo produtor
const novo = await Produtor.create({
  nome: 'José Santos',
  fazenda: 'Fazenda Nova',
  area_total: 300,
  cultura_atual: 'Soja',
  cidade: 'Ijuí',
  estado: 'RS'
});
```

---

### Visita

**Métodos disponíveis:**
- `Visita.list()` - Lista todas as visitas
- `Visita.get(id)` - Busca visita por ID
- `Visita.filter(query)` - Filtra visitas
- `Visita.create(data)` - Cria nova visita
- `Visita.update(id, data)` - Atualiza visita
- `Visita.delete(id)` - Remove visita

**Exemplo de uso:**
```javascript
import { Visita } from '../api/mock';

// Listar visitas de um produtor
const visitasProdutor = await Visita.filter({ produtor_id: 'p1' });

// Listar visitas realizadas
const realizadas = await Visita.filter({ status: 'realizada' });

// Agendar nova visita
const novaVisita = await Visita.create({
  produtor_id: 'p1',
  tecnico_responsavel: 'Carlos Silva',
  data_visita: new Date().toISOString(),
  objetivo: 'consultoria',
  status: 'agendada'
});
```

---

### CadernoCampo

**Métodos disponíveis:**
- `CadernoCampo.list()` - Lista todos os registros
- `CadernoCampo.get(id)` - Busca registro por ID
- `CadernoCampo.filter(query)` - Filtra registros
- `CadernoCampo.create(data)` - Cria novo registro
- `CadernoCampo.update(id, data)` - Atualiza registro
- `CadernoCampo.delete(id)` - Remove registro

**Exemplo de uso:**
```javascript
import { CadernoCampo } from '../api/mock';

// Listar atividades de um produtor
const atividadesProdutor = await CadernoCampo.filter({ produtor_id: 'p1' });

// Filtrar por tipo de atividade
const plantios = await CadernoCampo.filter({ tipo_atividade: 'plantio' });

// Filtrar registros visíveis para cliente
const visiveisCliente = await CadernoCampo.filter({ visivel_para_cliente: true });

// Criar novo registro
const novoRegistro = await CadernoCampo.create({
  produtor_id: 'p1',
  colaborador_responsavel: 'Carlos Silva',
  data_atividade: new Date().toISOString(),
  tipo_atividade: 'adubacao',
  talhao: 'Talhão A',
  area_aplicada: 50,
  observacoes: 'Aplicação realizada com sucesso',
  visivel_para_cliente: true
});
```

---

### Mapa

**Métodos disponíveis:**
- `Mapa.list()` - Lista todos os mapas
- `Mapa.get(id)` - Busca mapa por ID
- `Mapa.filter(query)` - Filtra mapas
- `Mapa.create(data)` - Cria novo mapa
- `Mapa.update(id, data)` - Atualiza mapa
- `Mapa.delete(id)` - Remove mapa

**Exemplo de uso:**
```javascript
import { Mapa } from '../api/mock';

// Listar mapas de um produtor
const mapasProdutor = await Mapa.filter({ produtor_id: 'p1' });

// Filtrar por categoria
const mapasFertilidade = await Mapa.filter({ categoria: 'fertilidade' });

// Filtrar mapas disponíveis para download
const disponiveis = await Mapa.filter({ disponivel_para_download: true });

// Criar novo mapa
const novoMapa = await Mapa.create({
  titulo: 'Mapa NDVI - Dezembro 2024',
  categoria: 'indice_vegetacao',
  produtor_id: 'p1',
  talhao: 'Talhão C',
  safra: '2024/2025',
  arquivo_url: 'mapas/ndvi_dez2024.pdf',
  coordenadas: {
    latitude: -28.6341,
    longitude: -53.6055
  }
});
```

---

## Estrutura de Respostas

Todos os métodos retornam **Promises** que simulam requisições assíncronas com delays:
- `list()`, `get()`, `filter()`: 200-300ms
- `create()`, `update()`, `delete()`: 200-300ms

## Tratamento de Erros

Os métodos `get()`, `update()` e `delete()` rejeitam a Promise com erro quando o registro não é encontrado:

```javascript
try {
  const produtor = await Produtor.get('id_invalido');
} catch (error) {
  console.error(error.message); // 'Produtor não encontrado'
}
```

## Filtros

O método `filter(query)` aceita um objeto com propriedades para filtrar:

```javascript
// Filtro simples
await Produtor.filter({ status: 'ativo' });

// Múltiplos filtros (AND)
await Produtor.filter({ 
  status: 'ativo', 
  cidade: 'Cruz Alta' 
});

// Busca parcial (substring)
await Produtor.filter({ nome: 'Silva' }); // Retorna 'João Silva', 'Maria Silva', etc.
```

## Dados Mock Iniciais

A API já vem populada com dados de exemplo:
- 4 usuários (1 admin, 2 colaboradores, 1 cliente)
- 3 produtores
- 4 visitas
- 5 registros de caderno de campo
- 3 mapas técnicos

## Migração para API Real

Quando migrar para uma API real, basta substituir as importações:

```javascript
// Antes (mock)
import { Produtor } from '../api/mock';

// Depois (API real)
import { Produtor } from '../api/client';
```

Mantendo a mesma interface de métodos.
