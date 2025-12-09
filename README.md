# AgroTchê - Sistema de Gestão Agrícola Mobile

Sistema completo de gestão agrícola com controle de acesso por perfil, organização de mapas técnicos e gerenciamento de propriedades rurais.

## 🌾 Sobre o Projeto

AgroTchê é um aplicativo mobile desenvolvido em React Native (Expo) para facilitar a comunicação e o compartilhamento de informações entre empresas de consultoria agrícola, colaboradores técnicos e produtores rurais.

### ✨ Principais Funcionalidades

- 🔐 **Controle de Acesso por Perfil** (Admin, Colaborador, Cliente)
- 🗺️ **Organização de Mapas** por categorias (Fertilidade, Correção, NDVI, etc.)
- 🌍 **Gestão por Regiões** (Sul, Goiás, MT, etc.)
- 📱 **Dashboard Personalizado** para cada tipo de usuário
- 📊 **Caderno de Campo** com histórico de atividades
- 📅 **Gerenciamento de Visitas** técnicas
- 📥 **Download de Mapas** e arquivos técnicos

---

## 🚀 Como Rodar

### Pré-requisitos

- Node.js v16+
- npm v8+
- Expo CLI
- Expo Go (app no celular) ou emulador

### Instalação

```powershell
# Clonar o repositório
cd c:\Users\e_vsjesus\Desktop\devapp

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento
npm start
```

### Executar no Dispositivo

- **Android:** Pressione `a` ou execute `npm run android`
- **iOS:** Pressione `i` ou execute `npm run ios`
- **Web:** Pressione `w`
- **Expo Go:** Escaneie o QR code com o app Expo Go

---

## 👥 Perfis de Teste

O sistema possui 5 perfis para teste (definidos em `src/auth/authMock.js`):

### 👑 Administrador
- **User:** `admin` - Bruna Administradora
- **User:** `admin2` - César Administrador
- **Acesso:** Todas as regiões e funcionalidades

### 👷 Colaborador
- **User:** `colaborador` - Carlos Silva (Goiás)
- **User:** `colaborador2` - Ana Santos (Sul)
- **Acesso:** Apenas sua região

### 🌾 Cliente (Produtor)
- **User:** `cliente` - João Silva
- **Acesso:** Apenas sua propriedade

---

## 📁 Estrutura do Projeto

```
devapp/
├── src/
│   ├── api/              # API mock e validações
│   ├── auth/             # Contexto de autenticação
│   ├── components/       # Componentes reutilizáveis
│   ├── navigation/       # Configuração de navegação
│   ├── screens/          # Telas do aplicativo
│   ├── utils/            # Utilitários (controle de acesso)
│   └── theme.js          # Tema e estilos globais
├── entities/             # Definições de entidades
├── ORGANIZACAO_SISTEMA.md    # Documentação completa
├── GUIA_MAPAS.md            # Guia de mapas técnicos
├── RESUMO_EXECUTIVO.md      # Resumo para gestão
├── GUIA_TESTES.md           # Roteiro de testes
└── README.md
```

---

## 🗺️ Categorias de Mapas

O sistema organiza mapas em 5 categorias principais:

1. **🌿 Fertilidade** - Análises de pH, P, K, MO, CTC
2. **⚗️ Correção** - Recomendações de calcário, gesso
3. **📊 Índice de Vegetação** - NDVI, NDRE, EVI, SAVI
4. **🖼️ Panorama** - Vista aérea da propriedade
5. **🌾 Plantio** - Linhas de plantio (DWG, SHP)

Cada mapa possui:
- Categoria e subcategoria
- Formato (PDF, DWG, JPG, SHP)
- Tamanho do arquivo
- Disponibilidade para download
- Metadados (data, talhão, safra)

---

## 🔐 Sistema de Controle de Acesso

### Permissões por Perfil

| Funcionalidade | Admin | Colaborador | Cliente |
|----------------|-------|-------------|---------|
| Ver todos os produtores | ✅ | ❌ (só região) | ❌ (só o seu) |
| Criar produtor | ✅ | ✅ | ❌ |
| Editar produtor | ✅ | ✅ (região) | ❌ |
| Ver todos os mapas | ✅ | ✅ (região) | ❌ (disponíveis) |
| Download de mapas | ✅ | ✅ | ✅ |
| Ver visitas | ✅ | ✅ (região) | ✅ (suas) |
| Registrar atividades | ✅ | ✅ | ❌ |
| Filtrar por região | ✅ | ❌ | ❌ |

### Implementação

O controle de acesso é gerenciado pelo arquivo `src/utils/acessoControle.js` que contém:
- 13 funções de controle
- Filtros automáticos por perfil
- Validações de permissões

---

## 🌍 Regiões Implementadas

- **Sul** (RS - Norte, Centro, Sul)
- **Goiás** (GO - Sul, Centro, Norte)
- **Mato Grosso** (MT - Norte, Centro, Sul)
- **Centro-Oeste**
- **São Paulo**
- **Recife/Nordeste**
- **Norte** (PA, TO, RO)

Cada região possui microrregiões para melhor organização.

---

## 📱 Telas Principais

### Para Administradores:
- Dashboard geral com todas as regiões
- Lista de produtores com filtro de região
- Gerenciamento de mapas
- Visitas e caderno de campo completo

### Para Colaboradores:
- Dashboard da sua região
- Lista de produtores da região
- Upload e gerenciamento de mapas
- Registro de visitas e atividades

### Para Clientes:
- Dashboard personalizado da propriedade
- Mapas organizados por categoria
- Download de arquivos
- Histórico de visitas e atividades

---

## 📚 Documentação

### Documentos Disponíveis:

1. **[ORGANIZACAO_SISTEMA.md](ORGANIZACAO_SISTEMA.md)**
   - Documentação completa do sistema
   - Estrutura de dados
   - Fluxos de trabalho
   - Próximos passos

2. **[GUIA_MAPAS.md](GUIA_MAPAS.md)**
   - Categorias detalhadas
   - Subcategorias e formatos
   - Casos de uso reais
   - Padrões de nomenclatura

3. **[RESUMO_EXECUTIVO.md](RESUMO_EXECUTIVO.md)**
   - Resumo para gestão
   - Benefícios implementados
   - Exemplos de navegação
   - Próximas integrações

4. **[GUIA_TESTES.md](GUIA_TESTES.md)**
   - Roteiro completo de testes
   - Perfis de teste
   - Checklist de funcionalidades
   - Cenários de uso

---

## 🛠️ Tecnologias

- **Framework:** React Native (Expo)
- **Navegação:** React Navigation (Bottom Tabs + Stack)
- **Estado:** React Context API
- **Armazenamento:** AsyncStorage
- **Ícones:** Ionicons (Expo)
- **Estilo:** StyleSheet + tema customizado
- **API:** Mock data (desenvolvimento)

---

## 🧪 Testes

### Executar Testes

```powershell
npm test
```

### Perfis de Teste

Consulte o arquivo [GUIA_TESTES.md](GUIA_TESTES.md) para roteiro completo.

**Quick Test:**
1. Iniciar app (`npm start`)
2. Login como `admin`
3. Ir em Produtores > João Silva > Mapas
4. Verificar categorias e filtros

---

## 🚧 Em Desenvolvimento

### Próximas Funcionalidades:

#### Curto Prazo (1-2 semanas)
- [ ] Upload de mapas pelo app
- [ ] Notificações push
- [ ] Visualizador de PDF integrado
- [ ] Compartilhamento via WhatsApp

#### Médio Prazo (1 mês)
- [ ] Sincronização offline
- [ ] Gráficos de evolução
- [ ] Chat colaborador ↔ cliente
- [ ] Relatórios exportáveis

#### Longo Prazo (3+ meses)
- [ ] Integração com máquinas agrícolas
- [ ] IA para análise de imagens
- [ ] Predição de produtividade
- [ ] Módulo financeiro

---

## 🤝 Contribuindo

### Git Workflow

```bash
# Criar nova branch
git checkout -b feature/nova-funcionalidade

# Fazer commit
git add .
git commit -m "feat: adiciona nova funcionalidade"

# Push
git push origin feature/nova-funcionalidade
```

### Padrões de Commit

- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes

---

## 📞 Suporte

### Para dúvidas técnicas:
- Consultar documentação em `/docs`
- Verificar código em `src/`
- Logs: Terminal onde rodou `npm start`

### Para bugs:
1. Descrever o problema
2. Informar passos para reproduzir
3. Anexar screenshots se possível
4. Informar dispositivo/sistema

---

## 📄 Licença

Este projeto é proprietário da AgroTchê.

---

## 👥 Equipe

- **Desenvolvimento:** Equipe AgroTchê Dev
- **Gestão:** Bruna e César
- **Colaboradores:** Carlos (GO), Ana (RS)

---

## 📈 Status do Projeto

```
✅ Controle de acesso implementado
✅ Organização de mapas completa
✅ Navegação por perfil funcionando
✅ Telas responsivas e otimizadas
✅ Documentação completa
⏳ Upload de arquivos (próximo)
⏳ Notificações push (próximo)
⏳ Sincronização offline (futuro)
```

---

**Última atualização:** 09/12/2024  
**Versão:** 2.0  
**Status:** ✅ Em produção (fase de testes)

---

## 🎯 Quick Start

```powershell
# Clone e instale
git clone <repo>
cd devapp
npm install

# Inicie
npm start

# Teste
Login: admin
Navegue: Produtores > João Silva > Mapas
```

**Pronto para usar! 🚀**
