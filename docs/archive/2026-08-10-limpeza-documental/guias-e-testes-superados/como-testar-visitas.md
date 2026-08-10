# 🧪 Como Testar o Sistema de Visitas

## 📱 **Pré-requisitos**

1. **Servidor Expo rodando**
   ```bash
   npx expo start
   ```

2. **App aberto no emulador/dispositivo**
   - Use a câmera para escanear o QR code, ou
   - Pressione `a` no terminal para abrir no Android

3. **Login como usuario admin ou colaborador**
   - Opcao recomendada: usar o modo **Acesso rapido (dev)** da tela de login
   - Admin: `Admin (Bruna)`
   - Colaborador: `Colab. (Carlos)`
   - Se preferir login por email:
     - `bruna@agrotche.com`
     - `carlos@agrotche.com`

---

## ✅ **Checklist de Testes**

### **1. Acessar Tela de Visitas**

**Onde:** Tab "Visitas" na navegação inferior

**O que verificar:**
- ✅ Header mostra "Visitas Técnicas"
- ✅ Botão **verde com ícone "+"** aparece no header (apenas admin/colaborador)
- ✅ Botão FAB (Floating Action Button) **redondo no canto inferior direito**
- ✅ Lista de visitas aparece (se houver dados mock)
- ✅ Cards são clicáveis

---

### **2. Criar Nova Visita**

**Como acessar:**
- **Opção 1:** Clique no botão **verde com +** no header
- **Opção 2:** Clique no botão **FAB redondo** no canto inferior direito

**O que deve acontecer:**
1. Navega para tela "Nova Visita"
2. Formulário aparece com campos:
   - ✅ Produtor (dropdown com lista)
   - ✅ Data da Visita (abre DatePicker)
   - ✅ Horário da Visita (abre TimePicker)
   - ✅ Objetivo (5 opções de rádio)
   - ✅ Observações (textarea)
   - ✅ Recomendações (textarea)
   - ✅ Clima (text input)
   - ✅ Próxima Visita (DatePicker opcional)

**Teste de validação:**
1. Tente salvar sem preencher nada
   - ✅ Toast de erro aparece: "Preencha todos os campos obrigatórios"
   - ✅ Campos obrigatórios ficam com borda vermelha

2. Preencha todos os campos obrigatórios e clique em "Agendar Visita"
   - ✅ Toast de sucesso aparece: "Visita agendada com sucesso!"
   - ✅ Volta para tela de Visitas
   - ✅ Nova visita aparece na lista

---

### **3. Visualizar Detalhes da Visita**

**Como acessar:**
- Clique em qualquer **card de visita** na lista

**O que deve aparecer:**
1. Header "Detalhes da Visita" com botão voltar
2. Badge de status (AGENDADA / REALIZADA / CANCELADA)
3. Card com informações do produtor (clicável)
4. Card com informações da visita:
   - Data e hora
   - Técnico responsável
   - Objetivo
   - Clima (se houver)
5. Cards de observações e recomendações (se houver)
6. Próxima visita sugerida (se houver)
7. Fotos (se houver)

**Botões de ação (rodapé):**
- ✅ **"Marcar Realizada"** (verde) - se status = agendada
- ✅ **"Editar"** (azul) - se admin ou dono da visita
- ✅ **"Cancelar"** (amarelo) - se status = agendada
- ✅ **"Excluir"** (vermelho) - apenas admin

---

### **4. Editar Visita**

**Como acessar:**
- Na tela de detalhes, clique em **"Editar"**

**O que deve acontecer:**
1. Formulário pré-preenchido com dados da visita
2. Pode alterar qualquer campo
3. Clique em "Salvar Alterações"
   - ✅ Toast de sucesso: "Visita atualizada com sucesso!"
   - ✅ Volta para tela de detalhes
   - ✅ Dados atualizados aparecem

---

### **5. Ações na Visita**

#### **Marcar como Realizada**
1. Clique em **"Marcar Realizada"**
2. ✅ Toast de sucesso: "Visita marcada como realizada!"
3. ✅ Badge muda para "REALIZADA" (verde)
4. ✅ Botão "Marcar Realizada" desaparece

#### **Cancelar Visita**
1. Clique em **"Cancelar"**
2. ✅ Modal de confirmação aparece:
   - Título: "Cancelar Visita"
   - Ícone amarelo de alerta
   - Botões: "Cancelar" e "Sim, Cancelar"
3. Clique em **"Sim, Cancelar"**
   - ✅ Toast: "Visita cancelada"
   - ✅ Badge muda para "CANCELADA" (vermelho)

#### **Excluir Visita** (apenas admin)
1. Clique em **"Excluir"**
2. ✅ Modal de confirmação aparece:
   - Título: "Excluir Visita"
   - Ícone vermelho de alerta
   - Mensagem: "Tem certeza que deseja excluir esta visita permanentemente?"
3. Clique em **"Sim, Excluir"**
   - ✅ Toast: "Visita excluída"
   - ✅ Volta para lista de visitas
   - ✅ Visita não aparece mais na lista

---

### **6. Filtros e Busca**

**Na tela de Visitas:**
1. **Barra de busca** (topo)
   - Digite nome de produtor
   - ✅ Lista filtra em tempo real

2. **Ordenação** (chips abaixo da busca)
   - ✅ Data (padrão)
   - ✅ Produtor
   - ✅ Status

---

## 🐛 **Problemas Conhecidos e Soluções**

### **Problema: Botão "+" não aparece**

**Causas possíveis:**
1. ❌ Usuário não é admin nem colaborador
   - **Solução:** Faça login como admin ou colaborador

2. ❌ Cache do app desatualizado
   - **Solução:** 
     - Pressione `r` no terminal Expo (reload)
     - Ou feche e abra o app novamente

3. ❌ Erro de sintaxe
   - **Solução:** Verifique o terminal por erros vermelhos

---

### **Problema: Tela não navega ao clicar no botão**

**Debug:**
1. Abra o **React Native Debugger** (pressione `j` no terminal Expo)
2. Vá na aba **Console**
3. Clique no botão novamente
4. Verifique se há erros no console

**Soluções comuns:**
- Se erro de `undefined is not an object (evaluating 'navigation.navigate')`:
  - Verifique se a rota `NovaVisita` existe em `src/navigation/index.tsx`

---

### **Problema: Toast não aparece**

**Causas:**
1. ❌ ToastProvider não está no `App.tsx`
   - **Solução:** Verifique se `<ToastProvider>` envolve `<NavigationContainer>` em `App.tsx`

2. ❌ useToast chamado fora do Provider
   - **Solução:** Apenas use `useToast()` dentro de componentes que estão dentro do ToastProvider

---

### **Problema: DatePicker não abre**

**Causas:**
1. ❌ Modal está sendo bloqueado
   - **Solução:** Verifique permissões do app

2. ❌ Clique não está registrando
   - **Solução:** Verifique se o TouchableOpacity não está com `disabled={true}`

---

## 📋 **Dados Mock para Testar**

O sistema já vem com dados mock em `src/api/mock.ts`:

**Visitas existentes:**
- Visita 1: João Silva - Consultoria (Agendada)
- Visita 2: Maria Pereira - Coleta de Solo (Realizada)
- Visita 3: Pedro Santos - Avaliação Cultivo (Agendada)

**Produtores disponíveis:**
- João Silva - Fazenda Boa Vista
- Maria Pereira - Sítio Esperança
- Pedro Santos - Estância Santa Clara
- (e mais...)

---

## 🎯 **Fluxo Completo de Teste (5 minutos)**

1. **Login** como admin (`Admin (Bruna)` no acesso rapido)
2. **Navegar** para tab "Visitas"
3. **Clicar** no botão verde "+" no header
4. **Preencher** formulário:
   - Produtor: João Silva
   - Data: Amanhã
   - Hora: 14:00
   - Objetivo: Consultoria Técnica
   - Observações: "Avaliar plantio de soja"
5. **Salvar** visita
6. **Verificar** toast de sucesso
7. **Clicar** na visita recém-criada
8. **Visualizar** detalhes
9. **Clicar** em "Editar"
10. **Mudar** objetivo para "Avaliação de Cultivo"
11. **Salvar** alterações
12. **Voltar** para detalhes
13. **Marcar** como realizada
14. **Verificar** mudança de status

✅ **Teste completo!**

---

## 📱 **Atalhos do Terminal Expo**

Enquanto o servidor está rodando:

- `r` - Reload app
- `j` - Abrir debugger
- `a` - Abrir no Android
- `i` - Abrir no iOS
- `c` - Limpar cache
- `?` - Ver todos os comandos

---

## 🆘 **Suporte**

Se algo não funcionar:

1. **Parar o servidor** (Ctrl+C)
2. **Limpar cache:**
   ```bash
   npx expo start -c
   ```
3. **Reinstalar dependências** (se necessário):
   ```bash
   npm install
   ```
4. **Verificar erros** no terminal e no console do app

---

## 🎉 **Status da Implementação**

✅ **Componentes Base**
- DatePicker
- Toast
- ConfirmDialog

✅ **Telas de Visitas**
- NovaVisitaScreen
- VisitaDetailScreen
- EditarVisitaScreen

✅ **Navegação**
- Rotas configuradas
- Navegação funcionando

✅ **Integrações**
- ToastProvider no `App.tsx`
- Botões de ação no Header
- FAB na tela de visitas

✅ **Validações**
- Campos obrigatórios
- Feedback de erro
- Loading states

---

**Tudo pronto para testar! 🚀**
