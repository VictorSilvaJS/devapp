import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import StatCard from '../components/StatCard';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso, podeCriarProdutor, getRegioesDisponiveis } from '../utils/acessoControle';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutoresScreen() {
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [regiaoSelecionada, setRegiaoSelecionada] = useState('todas');
  const navigation = useNavigation();
  const { user } = useAuth();

  useEffect(() => { load(); }, [user]);
  
  const load = async () => {
    const data = await Produtor.list();
    // Filtrar por acesso do usuário
    const produtoresFiltrados = filtrarProdutoresPorAcesso(data, user);
    // animação local ao atualizar lista
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
    setProdutores(produtoresFiltrados);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Obter regiões disponíveis para o usuário
  const regioes = getRegioesDisponiveis(user, produtores);
  const mostrarFiltroRegiao = user?.perfil === 'admin' && regioes.length > 0;

  // Filtrar produtores por busca, status e região
  const produtoresFiltrados = produtores.filter(produtor => {
    const matchBusca = !busca || 
      produtor.nome.toLowerCase().includes(busca.toLowerCase()) ||
      produtor.fazenda.toLowerCase().includes(busca.toLowerCase()) ||
      produtor.cidade?.toLowerCase().includes(busca.toLowerCase());
    
    const matchStatus = filtroStatus === 'todos' || produtor.status === filtroStatus;
    
    const matchRegiao = !mostrarFiltroRegiao || 
      regiaoSelecionada === 'todas' || 
      produtor.regiao === regiaoSelecionada;
    
    return matchBusca && matchStatus && matchRegiao;
  });

  // Calcular estatísticas
  const totalProdutores = produtores.length;
  const produtoresAtivos = produtores.filter(p => p.status === 'ativo').length;
  const areaTotal = produtores.reduce((sum, p) => sum + (p.area_total || 0), 0);
  const produtoresPendentes = produtores.filter(p => p.status === 'pendente').length;

  // Formata área para exibição compacta
  const formatarArea = (area) => {
    if (area >= 1000) {
      return `${(area / 1000).toFixed(1)}k ha`;
    }
    return `${area.toFixed(1)} ha`;
  };

  return (
    <View style={styles.container}>
      <Header title="Produtores" />
      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Botão Novo Produtor (apenas para admin e colaborador) */}
        {podeCriarProdutor(user) && (
          <TouchableOpacity 
            style={styles.button} 
            onPress={() => navigation.navigate('NovoProdutor')}
            activeOpacity={0.8}
          >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.buttonText}>+ Novo Produtor</Text>
          </LinearGradient>
        </TouchableOpacity>
        )}

        {/* Barra de Busca */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, fazenda ou cidade..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearButton}>
              <Ionicons name="close-circle-outline" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro de Região (apenas para admin) */}
        {mostrarFiltroRegiao && (
          <View style={styles.regiaoContainer}>
            <Text style={styles.regiaoLabel}>
              <Ionicons name="location-outline" size={16} color={colors.text} /> Região:
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regiaoScroll}>
              <TouchableOpacity
                style={[
                  styles.regiaoChip,
                  regiaoSelecionada === 'todas' && styles.regiaoChipActive
                ]}
                onPress={() => {
                  try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
                  setRegiaoSelecionada('todas');
                }}
              >
                <Text style={[
                  styles.regiaoChipText,
                  regiaoSelecionada === 'todas' && styles.regiaoChipTextActive
                ]}>
                  Todas
                </Text>
              </TouchableOpacity>
              {regioes.map((regiao) => (
                <TouchableOpacity
                  key={regiao}
                  style={[
                    styles.regiaoChip,
                    regiaoSelecionada === regiao && styles.regiaoChipActive
                  ]}
                  onPress={() => {
                    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
                    setRegiaoSelecionada(regiao);
                  }}
                >
                  <Text style={[
                    styles.regiaoChipText,
                    regiaoSelecionada === regiao && styles.regiaoChipTextActive
                  ]}>
                    {regiao}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Filtros de Status */}
        <View style={styles.filtrosContainer}>
          {['todos', 'ativo', 'inativo', 'pendente'].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filtroButton,
                filtroStatus === status && styles.filtroButtonActive
              ]}
              onPress={() => {
                try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
                setFiltroStatus(status);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.filtroText,
                filtroStatus === status && styles.filtroTextActive
              ]}>
                {status === 'todos' ? 'Todos' : status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Estatísticas */}
        {produtores.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <StatCard 
                  label="Total"
                  value={totalProdutores}
                  accent={{
                    color: colors.primary,
                    bgColor: '#e8f5e8',
                    gradient: ['#e8f5e8', '#FFFFFF']
                  }}
                  icon={<Ionicons name="people-outline" size={24} color={colors.primary} />}
                />
              </View>
              <View style={styles.statItem}>
                <StatCard 
                  label="Ativos"
                  value={produtoresAtivos}
                  accent={{
                    color: colors.success,
                    bgColor: '#d1fae5',
                    gradient: ['#d1fae5', '#FFFFFF']
                  }}
                  icon={<Ionicons name="checkmark-circle-outline" size={24} color={colors.success} />}
                />
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <StatCard 
                  label="Área Total"
                  value={formatarArea(areaTotal)}
                  accent={{
                    color: '#8B6244',
                    bgColor: '#f5f3f0',
                    gradient: ['#f5f3f0', '#FFFFFF']
                  }}
                  icon={<Ionicons name="leaf-outline" size={24} color="#8B6244" />}
                />
              </View>
              <View style={styles.statItem}>
                <StatCard 
                  label="Pendentes"
                  value={produtoresPendentes}
                  accent={{
                    color: colors.warning,
                    bgColor: '#fef3c7',
                    gradient: ['#fef3c7', '#FFFFFF']
                  }}
                  icon={<Ionicons name="time-outline" size={24} color={colors.warning} />}
                />
              </View>
            </View>
          </View>
        )}

        {/* Lista de Produtores */}
        {produtoresFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={busca ? 'search-outline' : 'person-add-outline'} 
              size={64} 
              color={colors.muted} 
              style={styles.emptyIcon} 
            />
            <Text style={styles.emptyText}>
              {busca ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}
            </Text>
            <Text style={styles.emptySubtext}>
              {busca ? 'Tente ajustar os filtros de busca' : 'Começe adicionando seu primeiro produtor'}
            </Text>
          </View>
        ) : (
          produtoresFiltrados.map(p => (
            <ProdutorCard key={p.id} produtor={p} onPress={() => navigation.navigate('ProdutorDetail', { id: p.id })} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  content: { 
    padding: spacing.screen,
    paddingBottom: spacing.screen + 80
  },
  button: { 
    borderRadius: 14, 
    marginBottom: spacing.gap + 4,
    overflow: 'hidden',
    ...shadows.md
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center'
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody + 1
  },
  
  // Busca
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: spacing.card,
    marginBottom: spacing.gap,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    ...shadows.sm
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.card,
    fontSize: typography.fontBody,
    color: colors.text
  },
  clearButton: {
    padding: 6
  },
  clearIcon: {
    fontSize: 18,
    color: colors.muted,
    fontWeight: typography.weightBold
  },

  // Região (admin)
  regiaoContainer: {
    backgroundColor: colors.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    ...shadows.sm,
  },
  regiaoLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  regiaoScroll: {
    flexGrow: 0,
  },
  regiaoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 20,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  regiaoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  regiaoChipText: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '500',
  },
  regiaoChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },

  // Filtros
  filtrosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.screen,
    marginHorizontal: -4
  },
  filtroButton: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 10,
    paddingHorizontal: spacing.card,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: colors.primaryLight,
    alignItems: 'center',
    marginHorizontal: 4,
    marginBottom: 4,
    ...shadows.sm
  },
  filtroButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  filtroText: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemiBold,
    color: colors.primary
  },
  filtroTextActive: {
    color: '#FFFFFF'
  },

  // Estatísticas
  statsContainer: {
    marginBottom: spacing.screen
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.gap,
    marginHorizontal: -4
  },
  statItem: {
    flex: 1,
    paddingHorizontal: 4
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 2,
    paddingHorizontal: spacing.screen
  },
  emptyIcon: {
    marginBottom: spacing.gap
  },
  emptyText: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptySubtext: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center'
  }
});
