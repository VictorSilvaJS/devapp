import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  TextInput,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Mapa, Produtor } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';

export default function MapasScreen({ route, navigation }) {
  const [mapas, setMapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('recente'); // recente, titulo, tamanho
  const { user } = useAuth();
  const { getProdutorIdsFiltrados, filtros } = useFiltros();
  const produtorId = route?.params?.produtorId;

  useEffect(() => {
    loadMapas();
  }, [produtorId, filtros]);

  const loadMapas = async () => {
    setLoading(true);
    try {
      const todosMapas = await Mapa.list();
      let mapasFiltrados;
      
      // Se vier de um produtor específico, usa esse ID
      if (produtorId) {
        mapasFiltrados = todosMapas.filter(m => m.produtor_id === produtorId);
      } 
      // Senão, para admin, aplica filtros regionais
      else if (user?.perfil === 'admin') {
        const todosProdutores = await Produtor.list();
        const produtorIdsFiltrados = getProdutorIdsFiltrados(todosProdutores);
        mapasFiltrados = todosMapas.filter(m => produtorIdsFiltrados.includes(m.produtor_id));
      }
      // Outros perfis veem apenas seus mapas
      else {
        mapasFiltrados = todosMapas.filter(m => m.produtor_id === produtorId);
      }
      
      setMapas(mapasFiltrados);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os mapas');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMapas();
    setRefreshing(false);
  };

  const categorias = [
    { id: 'todos', nome: 'Todos', icon: 'grid-outline' },
    { id: 'fertilidade', nome: 'Fertilidade', icon: 'leaf-outline' },
    { id: 'correcao', nome: 'Correção', icon: 'construct-outline' },
    { id: 'indice_vegetacao', nome: 'Índice Vegetação', icon: 'analytics-outline' },
    { id: 'panorama', nome: 'Panorama', icon: 'image-outline' },
    { id: 'plantio', nome: 'Plantio', icon: 'git-network-outline' },
  ];

  const mapasFiltrados = mapas.filter(m => {
    const matchCategoria = categoriaAtiva === 'todos' || m.categoria === categoriaAtiva;
    const matchBusca = !busca || 
      m.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
      m.subcategoria?.toLowerCase().includes(busca.toLowerCase()) ||
      m.talhao?.toLowerCase().includes(busca.toLowerCase()) ||
      m.observacoes?.toLowerCase().includes(busca.toLowerCase());
    return matchCategoria && matchBusca;
  }).sort((a, b) => {
    // Aplicar ordenação
    if (ordenacao === 'recente') {
      return new Date(b.data_geracao || 0) - new Date(a.data_geracao || 0);
    } else if (ordenacao === 'titulo') {
      return (a.titulo || '').localeCompare(b.titulo || '');
    } else if (ordenacao === 'tamanho') {
      return (b.tamanho_arquivo || 0) - (a.tamanho_arquivo || 0);
    }
    return 0;
  });

  const mapasPorCategoria = categorias
    .filter(cat => cat.id !== 'todos')
    .map(cat => ({
      ...cat,
      mapas: mapas.filter(m => m.categoria === cat.id)
    }))
    .filter(cat => cat.mapas.length > 0);

  const handleDownload = (mapa) => {
    if (!mapa.disponivel_download) {
      Alert.alert('Indisponível', 'Este mapa não está disponível para download no momento.');
      return;
    }

    Alert.alert(
      'Download',
      `Deseja baixar o mapa "${mapa.titulo}"?\n\nFormato: ${mapa.formato_arquivo?.toUpperCase() || 'PDF'}\nTamanho: ${formatarTamanho(mapa.tamanho_arquivo)}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Baixar',
          onPress: () => {
            // Simular download
            Alert.alert('Sucesso', 'Download iniciado! O arquivo será salvo na pasta Downloads.');
            // Em produção, usar expo-file-system ou similar
          }
        }
      ]
    );
  };

  const formatarTamanho = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    const d = new Date(data);
    return d.toLocaleDateString('pt-BR');
  };

  const getIconeFormato = (formato) => {
    switch (formato) {
      case 'pdf': return 'document-text';
      case 'dwg': return 'hammer';
      case 'jpg':
      case 'png': return 'image';
      case 'shp':
      case 'kml': return 'map';
      case 'geotiff': return 'layers';
      default: return 'document';
    }
  };

  const renderMapaCard = (mapa) => (
    <TouchableOpacity 
      key={mapa.id} 
      style={styles.mapaCard}
      onPress={() => handleDownload(mapa)}
      activeOpacity={0.7}
    >
      <View style={styles.mapaHeader}>
        <View style={styles.mapaIconContainer}>
          <Ionicons 
            name={getIconeFormato(mapa.formato_arquivo)} 
            size={28} 
            color={colors.primary} 
          />
        </View>
        <View style={styles.mapaInfo}>
          <Text style={styles.mapaTitulo} numberOfLines={2}>{mapa.titulo}</Text>
          {mapa.subcategoria && (
            <Text style={styles.mapaSubcategoria}>{mapa.subcategoria}</Text>
          )}
          <View style={styles.mapaDetalhes}>
            <Text style={styles.mapaDetalhe}>
              <Ionicons name="calendar-outline" size={16} color={colors.secondary} /> {formatarData(mapa.data_criacao)}
            </Text>
            {mapa.talhao && (
              <Text style={styles.mapaDetalhe}>
                <Ionicons name="location-outline" size={16} color={colors.secondary} /> {mapa.talhao}
              </Text>
            )}
          </View>
        </View>
      </View>
      
      {mapa.observacoes && (
        <Text style={styles.mapaObservacao} numberOfLines={2}>{mapa.observacoes}</Text>
      )}

      <View style={styles.mapaFooter}>
        <View style={styles.mapaFormatoTag}>
          <Text style={styles.mapaFormatoTexto}>{mapa.formato_arquivo?.toUpperCase() || 'PDF'}</Text>
        </View>
        {mapa.tamanho_arquivo && (
          <Text style={styles.mapaTamanho}>{formatarTamanho(mapa.tamanho_arquivo)}</Text>
        )}
        {mapa.disponivel_download && (
          <View style={styles.downloadIndicator}>
            <Ionicons name="download-outline" size={16} color={colors.success} />
            <Text style={styles.downloadTexto}>Disponível</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Mapas" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando mapas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Mapas" showBack onBack={() => navigation.goBack()} />
      
      {/* Barra de Busca */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar mapas..."
            placeholderTextColor={colors.muted}
            value={busca}
            onChangeText={setBusca}
          />
          {busca.length > 0 && (
            <TouchableOpacity onPress={() => setBusca('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Ordenação */}
      <View style={styles.ordenacaoContainer}>
        <Text style={styles.ordenacaoLabel}>
          <Ionicons name="swap-vertical-outline" size={16} color={colors.text} /> Ordenar:
        </Text>
        <View style={styles.ordenacaoButtons}>
          {[
            { key: 'recente', label: 'Recente', icon: 'time-outline' },
            { key: 'titulo', label: 'Título', icon: 'text-outline' },
            { key: 'tamanho', label: 'Tamanho', icon: 'document-outline' }
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.ordenacaoChip,
                ordenacao === item.key && styles.ordenacaoChipActive
              ]}
              onPress={() => setOrdenacao(item.key)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={item.icon} 
                size={14} 
                color={ordenacao === item.key ? colors.white : colors.primary} 
              />
              <Text style={[
                styles.ordenacaoChipText,
                ordenacao === item.key && styles.ordenacaoChipTextActive
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Filtros de Categoria */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoriasContainer}
          contentContainerStyle={styles.categoriasContent}
        >
          {categorias.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoriaChip,
                categoriaAtiva === cat.id && styles.categoriaChipAtiva
              ]}
              onPress={() => setCategoriaAtiva(cat.id)}
            >
              <Ionicons 
                name={cat.icon} 
                size={18} 
                color={categoriaAtiva === cat.id ? colors.white : colors.primary} 
              />
              <Text style={[
                styles.categoriaTexto,
                categoriaAtiva === cat.id && styles.categoriaTextoAtiva
              ]}>
                {cat.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Estatísticas */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumero}>{mapas.length}</Text>
            <Text style={styles.statLabel}>Total de Mapas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumero}>{mapas.filter(m => m.disponivel_download).length}</Text>
            <Text style={styles.statLabel}>Disponíveis</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumero}>{mapasPorCategoria.length}</Text>
            <Text style={styles.statLabel}>Categorias</Text>
          </View>
        </View>

        {/* Lista de Mapas */}
        {mapasFiltrados.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={busca ? 'search-outline' : 'map-outline'} 
              size={80} 
              color={colors.muted} 
            />
            <Text style={styles.emptyText}>
              {busca ? 'Nenhum mapa encontrado' : 'Nenhum mapa disponível'}
            </Text>
            <Text style={styles.emptySubtext}>
              {busca 
                ? 'Tente ajustar sua busca ou categoria'
                : categoriaAtiva === 'todos' 
                  ? 'Ainda não há mapas cadastrados para este produtor.'
                  : 'Não há mapas nesta categoria no momento.'}
            </Text>
            {!busca && (
              <View style={styles.emptyTipBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.emptyTipText}>
                  Os mapas técnicos serão adicionados pelo time de consultoria
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.mapasLista}>
            {categoriaAtiva === 'todos' ? (
              // Mostrar agrupado por categoria
              mapasPorCategoria.map(cat => (
                <View key={cat.id} style={styles.categoriaSecao}>
                  <View style={styles.categoriaHeader}>
                    <Ionicons name={cat.icon} size={28} color={colors.primary} />
                    <Text style={styles.categoriaTitulo}>{cat.nome}</Text>
                    <View style={styles.categoriaBadge}>
                      <Text style={styles.categoriaBadgeTexto}>{cat.mapas.length}</Text>
                    </View>
                  </View>
                  {cat.mapas.map(mapa => renderMapaCard(mapa))}
                </View>
              ))
            ) : (
              // Mostrar lista simples
              mapasFiltrados.map(mapa => renderMapaCard(mapa))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.muted,
  },
  categoriasContainer: {
    flexGrow: 0,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoriasContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  categoriaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    marginRight: spacing.sm,
    gap: spacing.xs,
    ...shadows.sm,
  },
  categoriaChipAtiva: {
    backgroundColor: colors.primary,
  },
  categoriaTexto: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  categoriaTextoAtiva: {
    color: colors.white,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statNumero: {
    fontSize: typography.fontSubtitle + 2,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'center',
  },
  mapasLista: {
    padding: spacing.md,
    gap: spacing.md,
  },
  categoriaSecao: {
    marginBottom: spacing.lg,
  },
  categoriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  
  // Ordenação
  ordenacaoContainer: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.screen,
  },
  ordenacaoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  ordenacaoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ordenacaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ordenacaoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ordenacaoChipText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '500',
  },
  ordenacaoChipTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  
  categoriaTitulo: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  categoriaBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  categoriaBadgeTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  mapaCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.md,
  },
  mapaHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  mapaIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    ...shadows.sm,
  },
  mapaInfo: {
    flex: 1,
  },
  mapaTitulo: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4,
  },
  mapaSubcategoria: {
    fontSize: typography.fontBody,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
    marginBottom: 4,
  },
  mapaDetalhes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  mapaDetalhe: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightMedium,
  },
  mapaObservacao: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    marginBottom: spacing.sm,
    lineHeight: 18,
    fontWeight: typography.weightMedium,
  },
  mapaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mapaFormatoTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapaFormatoTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  mapaTamanho: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightMedium,
    color: colors.textLight,
  },
  downloadIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadTexto: {
    fontSize: typography.fontCaption,
    color: colors.success,
    fontWeight: typography.weightSemibold,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
    minHeight: 400,
  },
  emptyText: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightMedium,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent + '20',
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.lg,
    gap: spacing.sm,
    maxWidth: 320,
  },
  emptyTipText: {
    flex: 1,
    fontSize: typography.fontCaption + 1,
    color: colors.primary,
    fontWeight: typography.weightMedium,
    lineHeight: 18,
  },
});
