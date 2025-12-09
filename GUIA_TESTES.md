# Guia de Testes - Sistema AgroTchê

## 🧪 Como Testar as Novas Funcionalidades

---

## 🚀 Iniciar o Aplicativo

### 1. Iniciar o servidor de desenvolvimento:

```powershell
npm start
```

### 2. Escolher plataforma:
- Pressione `a` para Android
- Pressione `i` para iOS
- Escanear QR code com Expo Go

---

## 👥 Perfis de Teste Disponíveis

### Tela de Login - Perfis:

#### 1️⃣ Administrador
**Usuário:** `admin`
- **Nome:** Bruna Administradora
- **Perfil:** Administrador Geral
- **Acesso:** Todas as regiões
- **Email:** bruna@agrotche.com

#### 2️⃣ Administrador 2
**Usuário:** `admin2`
- **Nome:** César Administrador
- **Perfil:** Administrador Geral
- **Acesso:** Todas as regiões
- **Email:** cesar@agrotche.com

#### 3️⃣ Colaborador Goiás
**Usuário:** `colaborador`
- **Nome:** Carlos Silva
- **Perfil:** Colaborador
- **Região:** Goiás
- **Email:** carlos@agrotche.com

#### 4️⃣ Colaborador Sul
**Usuário:** `colaborador2`
- **Nome:** Ana Santos
- **Perfil:** Colaborador
- **Região:** Sul
- **Email:** ana@agrotche.com

#### 5️⃣ Cliente
**Usuário:** `cliente`
- **Nome:** João Silva
- **Perfil:** Cliente (Produtor)
- **Propriedade:** Fazenda Boa Vista
- **Email:** joao.silva@email.com

---

## 🧪 Roteiro de Testes

### Teste 1: Login e Navegação por Perfil

#### Teste 1.1 - Login Administrador
1. Abrir app
2. Clicar botão **"Admin"**
3. ✅ **Verificar:**
   - Login bem-sucedido
   - Bottom tabs: Dashboard, Produtores, Visitas, Caderno, Perfil
   - Mensagem de boas-vindas com nome

#### Teste 1.2 - Login Colaborador
1. Fazer logout (se necessário)
2. Clicar botão **"Colaborador"**
3. ✅ **Verificar:**
   - Login bem-sucedido
   - Bottom tabs: Dashboard, Meus Produtores, Minhas Visitas, Caderno, Perfil
   - Títulos personalizados

#### Teste 1.3 - Login Cliente
1. Fazer logout
2. Clicar botão **"Cliente"**
3. ✅ **Verificar:**
   - Login bem-sucedido
   - Bottom tabs: Minha Propriedade, Histórico, Perfil
   - Tela específica do cliente

---

### Teste 2: Filtro de Região (Administrador)

#### Pré-requisito: Login como Admin

1. Ir para **"Produtores"**
2. ✅ **Verificar:**
   - Aparecem todos os produtores (5 total)
   - Existe seção "Região" no topo
3. Clicar em **"Região: Todas"**
4. ✅ **Verificar:**
   - Chips: Todas, Sul, Goiás, Mato Grosso
5. Selecionar **"Sul"**
6. ✅ **Verificar:**
   - Apenas 3 produtores aparecem (João, Maria, Pedro)
   - Todos do RS
7. Selecionar **"Goiás"**
8. ✅ **Verificar:**
   - Apenas 1 produtor aparece (Roberto)
   - Rio Verde, GO
9. Selecionar **"Mato Grosso"**
10. ✅ **Verificar:**
    - Apenas 1 produtor aparece (Fernanda)
    - Sorriso, MT

---

### Teste 3: Controle de Acesso por Região (Colaborador)

#### Teste 3.1 - Colaborador Goiás

1. Login como **"Colaborador"** (Carlos - Goiás)
2. Ir para **"Meus Produtores"**
3. ✅ **Verificar:**
   - Apenas 1 produtor aparece (Roberto Oliveira)
   - Rio Verde, GO
   - **NÃO** aparecem produtores de RS ou MT
4. ✅ **Verificar:**
   - **NÃO** existe filtro de região (apenas admin tem)
5. Tentar criar novo produtor
6. ✅ **Verificar:**
   - Botão "Novo Produtor" está visível
   - Colaborador pode criar (futuro: região será Goiás)

#### Teste 3.2 - Colaborador Sul

1. Logout e login como **"Colaborador 2"** (Ana - Sul)
2. Ir para **"Meus Produtores"**
3. ✅ **Verificar:**
   - Aparecem 3 produtores (João, Maria, Pedro)
   - Todos do RS
   - **NÃO** aparece Roberto (GO) nem Fernanda (MT)

---

### Teste 4: Acesso aos Mapas

#### Teste 4.1 - Navegação para Mapas

1. Login como **Admin**
2. Ir para **"Produtores"**
3. Clicar no produtor **"João Silva"**
4. Na aba **"Lavoura"**, ✅ **Verificar:**
   - Aparecem primeiros 3 mapas
   - Botão **"Ver Todos"** no canto superior direito
   - Se mais de 3 mapas, botão **"Ver mais X mapas"** no final
5. Clicar em **"Ver Todos"**
6. ✅ **Verificar:**
   - Abre tela **"Mapas"**
   - Título: "Mapas"
   - Botão voltar funciona

---

### Teste 4.2 - Filtros de Categoria

1. Na tela **"Mapas"**, ✅ **Verificar:**
   - Filtros horizontais: Todos, Fertilidade, Correção, Índ. Vegetação, Panorama, Plantio
   - Estatísticas: Total, Disponíveis, Categorias
2. Clicar em **"Fertilidade"**
3. ✅ **Verificar:**
   - Apenas mapas de fertilidade aparecem
   - Mapas com subcategorias (pH, Fósforo, Potássio, Matéria Orgânica)
4. Clicar em **"Índice Vegetação"**
5. ✅ **Verificar:**
   - Apenas mapas NDVI e NDRE aparecem
6. Clicar em **"Todos"**
7. ✅ **Verificar:**
   - Mapas agrupados por categoria
   - Headers: 🌿 Fertilidade (X), 📊 Índice Vegetação (Y)

---

### Teste 4.3 - Detalhes do Mapa

1. Clicar em qualquer mapa
2. ✅ **Verificar:**
   - Alert mostra: Título, Formato, Tamanho
   - Opções: Cancelar, Baixar
3. Clicar **"Baixar"**
4. ✅ **Verificar:**
   - Mensagem: "Download iniciado!"
   - (Futuro: arquivo realmente baixado)

---

### Teste 5: Dashboard do Cliente

#### Teste 5.1 - Tela Inicial Cliente

1. Login como **"Cliente"** (João Silva)
2. ✅ **Verificar tela inicial:**
   - Título: "Minha Propriedade"
   - Card grande com:
     - Ícone de casa
     - Nome: "Fazenda Boa Vista"
     - Localização: "Cruz Alta, RS"
     - Estatísticas: 850 ha, Soja
3. ✅ **Verificar resumo:**
   - 3 cards pequenos:
     - X Mapas Disponíveis
     - Y Visitas Registradas
     - Z Atividades

#### Teste 5.2 - Mapas do Cliente

1. Rolar para baixo até **"Mapas da Propriedade"**
2. ✅ **Verificar:**
   - Scroll horizontal de categorias
   - Cada card mostra: Ícone, Nome, Quantidade
3. Clicar em uma categoria
4. ✅ **Verificar:**
   - Abre tela de mapas
   - Filtrado automaticamente pela categoria
   - **Apenas mapas com `disponivel_download: true`**

#### Teste 5.3 - Últimas Visitas

1. Seção **"Últimas Visitas"**
2. ✅ **Verificar:**
   - Até 3 visitas mais recentes
   - Data, Técnico, Observações

#### Teste 5.4 - Atividades Recentes

1. Seção **"Atividades Recentes"**
2. ✅ **Verificar:**
   - Até 3 atividades mais recentes
   - Tipo, Data, Observações
   - **Apenas atividades com `visivel_para_cliente: true`**

---

### Teste 6: Controle de Visibilidade

#### Teste 6.1 - Cliente vê apenas mapas disponíveis

1. Login como **Cliente**
2. Ir para **Mapas**
3. ✅ **Verificar:**
   - Aparecem apenas mapas com `disponivel_download: true`
   - Total menor que admin vê

#### Teste 6.2 - Admin vê todos os mapas

1. Login como **Admin**
2. Acessar mesmo produtor (João Silva)
3. Ir para **Mapas**
4. ✅ **Verificar:**
   - Aparecem mais mapas que cliente vê
   - Incluindo mapas com `disponivel_download: false`

---

### Teste 7: Caderno de Campo

#### Teste 7.1 - Cliente vê apenas registros visíveis

1. Login como **Cliente**
2. Ir para **"Histórico"**
3. ✅ **Verificar:**
   - Aparecem apenas registros com `visivel_para_cliente: true`
   - Registros da sua propriedade

#### Teste 7.2 - Colaborador vê registros da região

1. Login como **Colaborador** (Carlos - Goiás)
2. Ir para **"Caderno de Campo"**
3. ✅ **Verificar:**
   - Aparecem registros de produtores de Goiás
   - **NÃO** aparecem de outras regiões

#### Teste 7.3 - Admin vê tudo

1. Login como **Admin**
2. Ir para **"Caderno"**
3. ✅ **Verificar:**
   - Aparecem todos os registros
   - De todas as regiões

---

### Teste 8: Botões Condicionais

#### Teste 8.1 - Cliente não pode criar produtor

1. Login como **Cliente**
2. ✅ **Verificar:**
   - **NÃO** tem acesso à tela "Produtores"
   - Bottom tabs não incluem "Produtores"

#### Teste 8.2 - Colaborador pode criar

1. Login como **Colaborador**
2. Ir para **"Meus Produtores"**
3. ✅ **Verificar:**
   - Botão **"+ Novo Produtor"** está visível
   - Pode criar novo produtor

#### Teste 8.3 - Admin pode tudo

1. Login como **Admin**
2. Ir para **"Produtores"**
3. ✅ **Verificar:**
   - Botão **"+ Novo Produtor"** está visível
   - Pode criar em qualquer região
   - Pode editar qualquer produtor

---

### Teste 9: Performance e UX

#### Teste 9.1 - Animações

1. Em qualquer tela com listas
2. Mudar filtros
3. ✅ **Verificar:**
   - Transições suaves
   - LayoutAnimation funciona
   - Sem travamentos

#### Teste 9.2 - Pull to Refresh

1. Em telas com lista
2. Puxar para baixo
3. ✅ **Verificar:**
   - Indicador de loading aparece
   - Dados recarregam
   - Indicador desaparece

#### Teste 9.3 - Busca

1. Tela **"Produtores"**
2. Digitar nome no campo de busca
3. ✅ **Verificar:**
   - Lista filtra em tempo real
   - Resultados precisos
   - Botão "X" limpa busca

---

### Teste 10: Dados Mock

#### Verificar estrutura de dados:

1. ✅ **Produtores:**
   - 5 total
   - 3 no Sul (p1, p2, p3)
   - 1 em Goiás (p4)
   - 1 em MT (p5)

2. ✅ **Mapas:**
   - 12 total para João Silva (p1)
   - Categorias: Fertilidade (4), Correção (1), Índice Vegetação (2), Panorama (1), Plantio (1)
   - Subcategorias diversas

3. ✅ **Usuários:**
   - 5 perfis de teste
   - Cada um com região/acesso diferente

---

## 🐛 Bugs Conhecidos (Para Corrigir)

### Ainda não implementado:
- [ ] Upload real de mapas
- [ ] Download real de arquivos
- [ ] Visualizador de PDF integrado
- [ ] Notificações push
- [ ] Sincronização offline completa

---

## ✅ Checklist de Testes

### Funcional:
- [ ] Login funciona para todos os perfis
- [ ] Filtro de região (admin) funciona
- [ ] Controle de acesso por perfil funciona
- [ ] Tela de mapas filtra categorias
- [ ] Dashboard cliente mostra dados corretos
- [ ] Botões condicionais aparecem/escondem

### Visual:
- [ ] Cores por categoria corretas
- [ ] Ícones apropriados
- [ ] Layouts responsivos
- [ ] Textos legíveis
- [ ] Sombras e bordas adequadas

### Performance:
- [ ] App inicia rápido
- [ ] Navegação fluida
- [ ] Sem travamentos
- [ ] Animações suaves
- [ ] Memória controlada

### UX:
- [ ] Navegação intuitiva
- [ ] Feedback visual claro
- [ ] Mensagens de erro úteis
- [ ] Loading states apropriados
- [ ] Pull-to-refresh funciona

---

## 📝 Relatório de Testes

### Template para reportar resultados:

```
## Teste: [Nome do Teste]
**Data:** [DD/MM/YYYY]
**Testador:** [Seu Nome]
**Dispositivo:** [iPhone 12 / Android Pixel 5 / Emulador]

### Resultado:
✅ Passou | ❌ Falhou | ⚠️ Parcial

### Observações:
- [Observação 1]
- [Observação 2]

### Bugs Encontrados:
1. [Descrição do bug]
2. [Descrição do bug]

### Melhorias Sugeridas:
1. [Sugestão 1]
2. [Sugestão 2]
```

---

## 🎯 Cenários de Uso Real

### Cenário 1: Admin gerencia mapas
```
1. Admin faz login
2. Acessa produtor João Silva
3. Vê que tem novos mapas pendentes
4. Entra nos mapas
5. Marca alguns como "disponível para download"
6. Cliente agora pode ver e baixar
```

### Cenário 2: Cliente baixa mapa
```
1. Cliente faz login
2. Vê notificação: "3 novos mapas disponíveis"
3. Acessa "Mapas"
4. Filtra por "Fertilidade"
5. Vê "Mapa de pH - Talhão A"
6. Clica para baixar
7. Arquivo salvo no dispositivo
8. Abre PDF e visualiza
```

### Cenário 3: Colaborador registra atividade
```
1. Colaborador faz login
2. Vai em "Meus Produtores"
3. Acessa João Silva
4. Vai em "Caderno"
5. Adiciona nova atividade: "Adubação - Talhão B"
6. Marca: "Visível para cliente"
7. João pode ver no histórico
```

---

## 📞 Suporte para Testes

### Se encontrar problemas:

1. **Verificar logs:**
   ```powershell
   # No terminal onde rodou npm start
   # Procurar por erros em vermelho
   ```

2. **Limpar cache:**
   ```powershell
   npm start -- --clear
   ```

3. **Reinstalar dependências:**
   ```powershell
   rm -rf node_modules
   npm install
   ```

4. **Verificar versões:**
   - Node.js: v16+
   - npm: v8+
   - Expo: verificar em app.json

---

## 🎓 Glossário de Testes

**Mock:** Dados falsos para desenvolvimento/teste

**Pull-to-refresh:** Puxar tela para baixo para atualizar

**Bottom tabs:** Barra inferior de navegação

**Stack screen:** Telas que empilham (podem voltar)

**LayoutAnimation:** Animação automática de mudanças

**AsyncStorage:** Armazenamento local no dispositivo

---

**Documento criado:** 09/12/2024  
**Versão:** 1.0  
**Status:** ✅ Pronto para testes
