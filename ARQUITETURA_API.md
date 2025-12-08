# Arquitetura da API Integrada

```
┌─────────────────────────────────────────────────────────────┐
│                    APLICAÇÃO REACT NATIVE                    │
│                      (Telas e Componentes)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ import { Produtor, User, etc }
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   /src/api/index.js                          │
│              (Exportações Centralizadas)                     │
│  • User, Produtor, Visita, CadernoCampo, Mapa              │
│  • Validators                                                │
│  • Constantes (PERFIS_USUARIO, STATUS_PRODUTOR, etc)       │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ↓                          ↓
┌──────────────────────────┐  ┌──────────────────────────────┐
│   /src/api/mock.js       │  │  /src/api/validators.js      │
│   (API Mock com CRUD)    │  │  (Validação de Dados)        │
│                          │  │                              │
│  • Dados Mock            │◄─┤  • validateUser()            │
│  • User.create()         │  │  • validateProdutor()        │
│  • User.list()           │  │  • validateVisita()          │
│  • User.filter()         │  │  • validateCadernoCampo()    │
│  • User.update()         │  │  • validateMapa()            │
│  • User.delete()         │  │  • validate()                │
│  • ... (outras entidades)│  │                              │
└──────────────┬───────────┘  └──────────────┬───────────────┘
               │                              │
               │      ┌───────────────────────┘
               │      │
               ↓      ↓
┌─────────────────────────────────────────────────────────────┐
│                    /entities/ (JSON Schema)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  User.json  │  │Produtor.json│  │ Mapa.json   │         │
│  │             │  │             │  │             │         │
│  │ • perfil    │  │ • nome      │  │ • titulo    │         │
│  │ • regiao    │  │ • fazenda   │  │ • categoria │         │
│  │ • email     │  │ • area      │  │ • talhao    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  ┌─────────────┐  ┌──────────────────┐                      │
│  │Visita.json  │  │CadernoCampo.json │                      │
│  │             │  │                  │                      │
│  │ • objetivo  │  │ • tipo_atividade │                      │
│  │ • tecnico   │  │ • talhao         │                      │
│  │ • status    │  │ • observacoes    │                      │
│  └─────────────┘  └──────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Fluxo de Dados

### 1️⃣ Criação de Entidade (com validação)

```
Tela do App
    │
    │ await Produtor.create(data)
    ↓
/src/api/index.js
    │
    │ export Produtor from mock
    ↓
/src/api/mock.js
    │
    │ validateProdutor(data)
    ↓
/src/api/validators.js
    │
    │ Verifica contra /entities/Produtor.json
    │ • Campos obrigatórios
    │ • Tipos corretos
    │ • Valores enum válidos
    ↓
✅ Validação OK → Cria registro
❌ Validação falhou → Rejeita com erro descritivo
```

### 2️⃣ Leitura de Dados

```
Tela do App
    │
    │ await Produtor.list()
    │ await Produtor.filter({ status: 'ativo' })
    ↓
/src/api/index.js
    ↓
/src/api/mock.js
    │
    │ Busca nos dados mock
    │ Aplica filtros
    ↓
Retorna array de registros
```

### 3️⃣ Atualização

```
Tela do App
    │
    │ await Produtor.update(id, { area_total: 900 })
    ↓
/src/api/mock.js
    │
    │ Encontra registro por ID
    │ Mescla dados
    │ Salva alterações
    ↓
Retorna registro atualizado
```

## Estrutura de Pastas

```
devapp/
│
├── entities/                    # 📋 Definições JSON Schema
│   ├── User.json               # Schema do usuário
│   ├── Produtor.json           # Schema do produtor
│   ├── Mapa.json               # Schema dos mapas
│   ├── Visita.json             # Schema das visitas
│   ├── CadernoCampo.json       # Schema do caderno
│   └── README.md               # Documentação das entidades
│
├── src/
│   └── api/                     # 🔌 Camada de API
│       ├── mock.js             # Dados mock + CRUD completo
│       ├── validators.js       # Validadores baseados em entities
│       ├── index.js            # Exportações centralizadas
│       ├── examples.js         # Exemplos de uso
│       ├── tests.js            # Testes automatizados
│       └── README.md           # Documentação da API
│
├── INTEGRACAO_API.md           # 📖 Este documento
└── package.json
```

## Exemplo de Uso Completo

```javascript
// 1. Import centralizado
import { Produtor, validateProdutor } from './api';

// 2. Em um componente React Native
const NovoProdutorScreen = () => {
  const [nome, setNome] = useState('');
  const [fazenda, setFazenda] = useState('');
  const [area, setArea] = useState('');

  const salvarProdutor = async () => {
    try {
      // 3. Criar produtor (validação automática)
      const novoProdutor = await Produtor.create({
        nome,
        fazenda,
        area_total: parseFloat(area),
        cultura_atual: 'Soja',
        cidade: 'Cruz Alta',
        estado: 'RS'
      });

      // 4. Sucesso!
      Alert.alert('Sucesso', 'Produtor cadastrado!');
      navigation.goBack();

    } catch (error) {
      // 5. Erro de validação com mensagem clara
      Alert.alert('Erro', error.message);
      // Ex: "Produtor: Campos obrigatórios faltando: fazenda"
      // Ex: "Produtor.area_total: Deve ser um número maior que zero"
    }
  };

  return (
    <View>
      <TextInput value={nome} onChangeText={setNome} />
      <TextInput value={fazenda} onChangeText={setFazenda} />
      <TextInput value={area} onChangeText={setArea} />
      <Button title="Salvar" onPress={salvarProdutor} />
    </View>
  );
};
```

## Benefícios da Arquitetura

### ✅ Separação de Responsabilidades
- **Entities**: Define estrutura e regras
- **Validators**: Garante integridade
- **Mock**: Simula backend
- **Index**: Facilita imports

### ✅ Fácil Migração
```javascript
// Desenvolvimento (mock)
import { Produtor } from './api/mock';

// Produção (backend real)
import { Produtor } from './api/client';
```

### ✅ Validação Centralizada
- Uma validação para todas as operações
- Mensagens de erro consistentes
- Baseada nas entidades (fonte única da verdade)

### ✅ Testável
- Testes automatizados incluídos
- Fácil criar novos testes
- Validação de toda a API

### ✅ Documentação Viva
- Entities documentam estrutura
- README explica uso
- Examples mostram casos reais
- Tests garantem funcionamento

## Constantes Disponíveis

```javascript
import {
  PERFIS_USUARIO,      // ['admin', 'colaborador', 'cliente']
  STATUS_PRODUTOR,     // ['ativo', 'inativo', 'pendente']
  STATUS_VISITA,       // ['agendada', 'realizada', 'cancelada']
  OBJETIVOS_VISITA,    // ['consultoria', 'coleta_solo', ...]
  TIPOS_ATIVIDADE,     // ['plantio', 'adubacao', 'aplicacao', ...]
  CATEGORIAS_MAPA      // ['fertilidade', 'correcao', ...]
} from './api';

// Uso em dropdowns, validações, etc
<Picker>
  {PERFIS_USUARIO.map(perfil => (
    <Picker.Item key={perfil} label={perfil} value={perfil} />
  ))}
</Picker>
```

## Próximos Passos

1. ✅ Entidades definidas
2. ✅ API mock criada
3. ✅ Validação implementada
4. ✅ Testes escritos
5. 🔄 Integrar nas telas existentes
6. 🔄 Adicionar feedback visual de validação
7. 🔄 Implementar cache local
8. 🔄 Conectar com backend real
