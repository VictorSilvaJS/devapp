# 🧪 Guia de Testes — Padronização de Diálogos

> **Data:** 28/02/2026  
> **Objetivo:** Verificar que todos os 22 `Alert.alert` nativos foram substituídos por `ConfirmDialog` (ações com confirmação) ou `Toast` (notificações simples).

---

## 📋 Checklist Rápido

| # | Tela | Rota | Tipo | Resultado |
|---|------|------|------|-----------|
| 1 | EditProfileScreen | `EditProfile` | Toast | ⬜ |
| 2 | PerfilScreen | Tab `Perfil` | Toast | ⬜ |
| 3 | NovoProdutorScreen | `NovoProdutor` | Toast | ⬜ |
| 4 | EditarProdutorScreen | `EditarProdutor` | Toast | ⬜ |
| 5 | ProdutorScreen | `ProdutorDetail` | ConfirmDialog + Toast | ⬜ |
| 6 | MapasScreen | `Mapas` | ConfirmDialog + Toast | ⬜ |
| 7 | NovaVisitaScreen | `NovaVisita` | ConfirmDialog | ⬜ |
| 8 | EditarVisitaScreen | `EditarVisita` | ConfirmDialog | ⬜ |
| 9 | NotificacoesScreen | `Notificacoes` | ConfirmDialog | ⬜ |

---

## 🔍 Testes Detalhados por Tela

### TESTE 1 — EditProfileScreen
**Rota:** Tab `Perfil` → Botão editar perfil → Tela `EditProfile`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 1.1 | Altere qualquer campo e toque **Salvar** | Toast verde (sucesso): *"Perfil atualizado"* aparece no topo e some automaticamente (~3s) | ⬜ |
| 1.2 | Após o toast, a tela volta automaticamente (goBack) | Retorna para Perfil sem caixa de diálogo "OK" | ⬜ |
| 1.3 | Simule erro de rede / deixe campos inválidos | Toast vermelho (erro): *"Não foi possível atualizar o perfil"* | ⬜ |

**❌ NÃO deve aparecer:** Nenhum Alert.alert nativo (caixa cinza do sistema)

---

### TESTE 2 — PerfilScreen
**Rota:** Tab `Perfil`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 2.1 | Toque em **Sair / Logout** e confirme | Toast verde: *"Logout realizado"* aparece brevemente | ⬜ |
| 2.2 | App navega para tela de Login | Redirecionamento imediato, sem popup nativo | ⬜ |

**❌ NÃO deve aparecer:** ToastAndroid nativo (Android) ou Alert.alert (iOS)

---

### TESTE 3 — NovoProdutorScreen
**Rota:** Tab `Produtores` → Botão **+** ou **Novo Produtor** → Tela `NovoProdutor`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 3.1 | Toque **Salvar** sem preencher campos obrigatórios | Toast amarelo (warning): *"Preencha todos os campos obrigatórios corretamente"* | ⬜ | o toasting esta verde
| 3.2 | Preencha todos os campos e toque **Salvar** | Toast verde (sucesso): *"Produtor cadastrado com sucesso!"* + volta automática | ⬜ |
| 3.3 | Simule erro ao salvar | Toast vermelho (erro): *"Não foi possível cadastrar o produtor. Tente novamente."* | ⬜ |

**❌ NÃO deve aparecer:** Nenhuma caixa de diálogo nativa com botão "OK"

---

### TESTE 4 — EditarProdutorScreen
**Rota:** Tab `Produtores` → Selecione produtor → `ProdutorDetail` → Botão **Editar** → `EditarProdutor`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 4.1 | Se ID inválido/não fornecido | Toast vermelho: *"ID do produtor não fornecido"* + volta automática | ⬜ |
| 4.2 | Se erro ao carregar dados | Toast vermelho: *"Não foi possível carregar os dados do produtor"* + volta | ⬜ |
| 4.3 | Limpe campos obrigatórios e toque **Salvar** | Toast amarelo: *"Preencha todos os campos obrigatórios corretamente"* | ⬜ |
| 4.4 | Preencha corretamente e toque **Salvar** | Toast verde: *"Produtor atualizado com sucesso!"* + volta automática | ⬜ |
| 4.5 | Simule erro ao salvar | Toast vermelho: *"Não foi possível salvar as alterações. Tente novamente."* | ⬜ |

**❌ NÃO deve aparecer:** Alert.alert com botão "OK" que precisava ser tocado para navegar

---

### TESTE 5 — ProdutorScreen ⭐ (mais complexo)
**Rota:** Tab `Produtores` → Selecione um produtor → `ProdutorDetail`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 5.1 | Se erro ao carregar produtor | Toast vermelho: *"Não foi possível carregar os dados do produtor"* | ⬜ |
| 5.2 | Toque no botão **Excluir** | **ConfirmDialog** estilizado aparece com: ícone vermelho (alert-circle), título *"Excluir Produtor"*, mensagem com nome do produtor, botões *"Cancelar"* e *"Excluir"* | ⬜ |
| 5.3 | No dialog, toque **Cancelar** | Dialog fecha, nada acontece | ⬜ |
| 5.4 | No dialog, toque **Excluir** | Botão mostra loading (spinner), após exclusão: Toast verde *"Produtor excluído com sucesso"* + navega para lista | ⬜ |
| 5.5 | Se erro na exclusão | Toast vermelho: *"Não foi possível excluir o produtor"* | ⬜ |
| 5.6 | Toque fora do dialog (no overlay) | Dialog fecha (mesmo comportamento de Cancelar) | ⬜ |

**Verificar visual do ConfirmDialog:**
- ⬜ Overlay escuro semi-transparente
- ⬜ Card branco centralizado com bordas arredondadas
- ⬜ Ícone circular vermelho no topo
- ⬜ Botão "Excluir" vermelho, botão "Cancelar" neutro
- ⬜ Sombra no card

---

### TESTE 6 — MapasScreen
**Rota:** Tab `Produtores` → Selecione produtor → `ProdutorDetail` → Tab Mapas → ou direto se houver atalho

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 6.1 | Se erro ao carregar mapas | Toast vermelho: *"Não foi possível carregar os mapas"* | ⬜ |
| 6.2 | Toque download de mapa **indisponível** | Toast azul (info): *"Este mapa não está disponível para download no momento."* | ⬜ |
| 6.3 | Toque download de mapa **disponível** | **ConfirmDialog** estilizado: ícone azul (info), título *"Download"*, mensagem com nome/formato/tamanho, botões *"Cancelar"* e *"Baixar"* | ⬜ |
| 6.4 | No dialog, toque **Cancelar** | Dialog fecha | ⬜ |
| 6.5 | No dialog, toque **Baixar** | Dialog fecha + Toast verde: *"Download iniciado! O arquivo será salvo na pasta Downloads."* | ⬜ |

---

### TESTE 7 — NovaVisitaScreen
**Rota:** Tab `Visitas` → Botão **+** ou **Nova Visita** → `NovaVisita`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 7.1 | Adicione uma foto (câmera ou galeria) | Toast verde: *"Foto capturada/selecionada com sucesso!"* | ⬜ |
| 7.2 | Toque no **X** para remover a foto | **ConfirmDialog** estilizado: ícone vermelho, título *"Remover Foto"*, mensagem *"Deseja remover esta foto?"*, botões *"Cancelar"* e *"Remover"* | ⬜ |
| 7.3 | No dialog, toque **Cancelar** | Dialog fecha, foto permanece | ⬜ |
| 7.4 | No dialog, toque **Remover** | Dialog fecha, foto removida, Toast verde *"Foto removida"* | ⬜ |

---

### TESTE 8 — EditarVisitaScreen
**Rota:** Tab `Visitas` → Selecione visita → `VisitaDetail` → Botão **Editar** → `EditarVisita`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 8.1 | Adicione uma foto | Toast verde: *"Foto capturada/selecionada com sucesso!"* | ⬜ |
| 8.2 | Toque no **X** para remover a foto | **ConfirmDialog** idêntico ao Teste 7.2 | ⬜ |
| 8.3 | Toque **Cancelar** no dialog | Fecha, foto permanece | ⬜ |
| 8.4 | Toque **Remover** no dialog | Fecha, foto removida, Toast verde *"Foto removida"* | ⬜ |

---

### TESTE 9 — NotificacoesScreen
**Rota:** Ícone de sino (Header) → `Notificacoes`

| Passo | Ação | Esperado | ✅/❌ |
|-------|------|----------|-------|
| 9.1 | Toque no botão **Limpar todas** | **ConfirmDialog** estilizado: ícone vermelho, título *"Limpar Notificações"*, mensagem *"Deseja remover todas as notificações?"*, botões *"Cancelar"* e *"Limpar"* | ⬜ |
| 9.2 | Toque **Cancelar** | Dialog fecha, notificações permanecem | ⬜ |
| 9.3 | Toque **Limpar** | Dialog fecha, todas as notificações removidas | ⬜ |

---

## 🎯 Critérios de Aprovação

### O que DEVE acontecer:
- ✅ **Toast** aparece no topo/rodapé da tela com cor correspondente (verde=sucesso, vermelho=erro, amarelo=warning, azul=info)
- ✅ **Toast** some automaticamente após ~3 segundos
- ✅ **ConfirmDialog** aparece centralizado com overlay escuro
- ✅ **ConfirmDialog** tem ícone, título, mensagem, 2 botões estilizados
- ✅ **ConfirmDialog** fecha ao tocar fora (overlay) ou no botão Cancelar
- ✅ Ações destrutivas (excluir, remover, limpar) usam `type="danger"` (ícone e botão vermelhos)
- ✅ Ações informativas (download) usam `type="info"` (ícone e botão azuis)
- ✅ Navegação automática após sucesso (sem precisar tocar "OK")

### O que NÃO deve acontecer:
- ❌ Nenhum `Alert.alert` nativo do sistema (caixa de diálogo cinza padrão Android/iOS)
- ❌ Nenhum `ToastAndroid` nativo
- ❌ Nenhum popup que exija toque em "OK" para continuar (exceto ConfirmDialog de confirmação)
- ❌ Tela travada aguardando dismiss de alerta

---

## 🗺️ Mapa de Navegação — Todas as Rotas

```
Login
  └── Main (Tabs)
       ├── Home (Dashboard)
       ├── Produtores
       │    └── ProdutorDetail ← TESTE 5
       │         ├── EditarProdutor ← TESTE 4
       │         └── Mapas ← TESTE 6
       ├── Visitas
       │    ├── NovaVisita ← TESTE 7
       │    └── VisitaDetail
       │         └── EditarVisita ← TESTE 8
       ├── Caderno
       └── Perfil ← TESTE 2
            └── EditProfile ← TESTE 1
       
  Notificacoes ← TESTE 9 (acessível pelo ícone 🔔 no Header)
  NovoProdutor ← TESTE 3 (acessível pelo botão + em Produtores)
```

---

## 📱 Ordem Sugerida de Teste (caminho otimizado)

1. **Login** → Fazer login normal
2. **Tab Perfil** → Teste 2 (logout) — *faça por último se não quiser relogar*
3. **Tab Perfil** → **Editar Perfil** → Teste 1
4. **Tab Produtores** → **Novo Produtor** → Teste 3
5. **Tab Produtores** → Selecione produtor → Teste 5 (excluir)
6. Na tela do produtor → **Editar** → Teste 4
7. Na tela do produtor → **Mapas** → Teste 6
8. **Tab Visitas** → **Nova Visita** → Teste 7
9. **Tab Visitas** → Selecione visita → **Editar** → Teste 8
10. **Ícone 🔔** → Teste 9
11. **Tab Perfil** → Teste 2 (logout por último)

---

## 📊 Resumo Final

| Métrica | Valor |
|---------|-------|
| Total de `Alert.alert` removidos | **22** |
| Substituídos por `Toast` | **13** (notificações simples) |
| Substituídos por `ConfirmDialog` | **6** (ações com confirmação) |
| `ToastAndroid` removidos | **1** (PerfilScreen) |
| Alert.alert aninhados eliminados | **2** (ProdutorScreen + MapasScreen) |
| Telas modificadas | **9** |
| Erros de compilação | **0** |
