import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, RefreshControl, TextInput } from 'react-native';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import StatCard from '../components/StatCard';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutoresScreen() {
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const navigation = useNavigation();

  useEffect(() => { load(); }, []);
  
  const load = async () => {
    const data = await Produtor.list();
    // animação local ao atualizar lista
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
    setProdutores(data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Filtrar produtores por busca e status
  const produtoresFiltrados = produtores.filter(produtor => {
    const matchBusca = !busca || 
      produtor.nome.toLowerCase().includes(busca.toLowerCase()) ||
      produtor.fazenda.toLowerCase().includes(busca.toLowerCase()) ||
      produtor.cidade?.toLowerCase().includes(busca.toLowerCase());
    
    const matchStatus = filtroStatus === 'todos' || produtor.status === filtroStatus;
    
    return matchBusca && matchStatus;
  });

  // Calcular estatísticas
  const totalProdutores = produtores.length;
  const produtoresAtivos = produtores.filter(p => p.status === 'ativo').length;
  const areaTotal = produtores.reduce((sum, p) => sum + (p.area_total || 0), 0);
  const produtoresPendentes = produtores.filter(p => p.status === 'pendente').length;

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
        {/* Botão Novo Produtor */}
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

        {/* Barra de Busca */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, fazenda ou cidade..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearButton}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

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
                  icon={<Text style={styles.statEmoji}>👥</Text>}
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
                  icon={<Text style={styles.statEmoji}>✅</Text>}
                />
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <StatCard 
                  label="Área Total"
                  value={`${areaTotal.toLocaleString('pt-BR')} ha`}
                  accent={{
                    color: '#8B6244',
                    bgColor: '#f5f3f0',
                    gradient: ['#f5f3f0', '#FFFFFF']
                  }}
                  icon={<Text style={styles.statEmoji}>🌾</Text>}
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
                  icon={<Text style={styles.statEmoji}>⏳</Text>}
                />
              </View>
            </View>
          </View>
        )}

        {/* Lista de Produtores */}
        {produtoresFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>{busca ? '🔍' : '👤'}</Text>
            <Text style={styles.emptyText}>
              {busca ? 'Nenhum produtor encontrado' : 'Nenhum produtor cadastrado'}
            </Text>
            <Text style={styles.emptySubtext}>
              {busca ? 'Tente ajustar os filtros de busca' : 'Comece adicionando seu primeiro produtor'}
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
  statEmoji: {
    fontSize: 20
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 2,
    paddingHorizontal: spacing.screen
  },
  emptyIcon: {
    fontSize: 64,
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
