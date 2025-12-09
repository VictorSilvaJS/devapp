# Padrão de Ícones do Aplicativo

Este documento descreve o padrão de ícones utilizado em todo o aplicativo para manter a harmonia visual.

## Biblioteca Utilizada

**Ionicons** do pacote `@expo/vector-icons`

## Ícones por Contexto

### 🔐 Autenticação (LoginScreen)
- **Admin**: `briefcase-outline` - Representa gestão/administração
- **Colaborador**: `hammer-outline` - Representa trabalho em campo
- **Cliente**: `leaf-outline` - Representa agricultura/produção

### 📊 Dashboard
- **Saudação**: `hand-left-outline` - Aceno de boas-vindas
- **Produtores**: `people-outline` - Grupo de pessoas
- **Área/Cultivo**: `leaf-outline` - Folha/agricultura
- **Visitas**: `calendar-outline` - Calendário
- **Registros**: `book-outline` - Livro/documentação
- **Localização**: `location-outline` - Pin de localização
- **Clima**: `partly-sunny-outline` - Sol com nuvens

### 👥 Produtores (ProdutoresScreen)
- **Busca**: `search-outline` - Lupa de busca
- **Limpar busca**: `close-circle` - X em círculo
- **Total de produtores**: `people-outline` - Grupo
- **Produtores ativos**: `checkmark-circle-outline` - Check em círculo
- **Área total**: `leaf-outline` - Folha
- **Pendentes**: `time-outline` - Relógio
- **Adicionar produtor**: `person-add-outline` - Pessoa com +

### 📖 Caderno de Campo (CadernoCampoScreen)
- **Busca**: `search-outline` - Lupa
- **Limpar busca**: `close-circle` - X em círculo
- **Registro**: `book-outline` - Livro
- **Data**: `calendar-outline` - Calendário
- **Colaborador**: `person-outline` - Pessoa
- **Área/Local**: `location-outline` - Pin
- **Fotos**: `images-outline` - Galeria de imagens
- **Empty state**: `document-text-outline` - Documento

### 🧭 Navegação (TabBar)
- **Home**: `home-outline` - Casa
- **Produtores**: `people-outline` - Grupo
- **Visitas/Histórico**: `calendar-outline` - Calendário
- **Caderno**: `book-outline` - Livro
- **Perfil**: `person-outline` - Pessoa

## Diretrizes de Uso

### Tamanhos Padrão
- **TabBar**: 24-28px (size padrão do sistema)
- **Cards principais**: 24px
- **Ícones inline**: 16-18px
- **Empty states**: 64px
- **Botões**: 20-22px

### Cores
- Sempre usar cores do tema (`colors.primary`, `colors.secondary`, etc.)
- Ícones em texto: `colors.textLight` ou `colors.muted`
- Ícones de ação: usar cor do contexto (primary, success, warning, etc.)

### Variantes
- **Preferir sempre `-outline`**: Mantém design leve e moderno
- **Evitar ícones preenchidos**: Usar apenas em casos específicos de destaque

## Benefícios da Padronização

1. **Consistência Visual**: Todos os ícones seguem o mesmo estilo
2. **Performance**: Ícones vetoriais são leves e escaláveis
3. **Acessibilidade**: Melhor contraste e legibilidade
4. **Manutenibilidade**: Fácil atualização e modificação
5. **Profissionalismo**: Aparência moderna e polida

## Evitar

❌ Emojis Unicode (🌾, 👤, 📋, etc.) - exceto em logs de console
❌ Misturar diferentes bibliotecas de ícones
❌ Ícones muito pequenos (< 14px) ou muito grandes (> 80px)
❌ Cores arbitrárias que não estejam no tema

## Recursos

- [Ionicons Gallery](https://ionic.io/ionicons)
- [Expo Vector Icons](https://icons.expo.fyi/)
