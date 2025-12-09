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
  Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Mapa } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';

export default function MapasScreen({ route, navigation }) {
  const [mapas, setMapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const { user } = useAuth();
  const produtorId = route?.params?.produtorId;

  useEffect(() => {
    loadMapas();
  }, [produtorId]);

  const loadMapas = async () => {
    setLoading(true);
    try {
      const todosMapas = await Mapa.list();
      const mapasFiltrados = todosMapas.filter(m => m.produtor_id === produtorId);
      setMapas(mapasFiltrados);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os mapas');
    } finally {
      setLoading(false);
    }
  };

  const categorias = [
    { id: 'todos', nome: 'Todos', icon: 'grid-outline' },
    { id: 'fertilidade', nome: 'Fertilidade', icon: 'leaf-outline' },
    { id: 'correcao', nome: 'Correção', icon: 'construct-outline' },
    { id: 'indice_vegetacao', nome: 'Índice Vegetação', icon: 'analytics-outline' },
    { id: 'panorama', nome: 'Panorama', icon: 'image-outline' },
    { id: 'plantio', nome: 'Plantio', icon: 'git-network-outline' },
  ];

  const mapasFiltrados = categoriaAtiva === 'todos' 
    ? mapas 
    : mapas.filter(m => m.categoria === categoriaAtiva);

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
            size={24} 
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
              <Ionicons name="calendar-outline" size={12} color={colors.muted} /> {formatarData(mapa.data_criacao)}
            </Text>
            {mapa.talhao && (
              <Text style={styles.mapaDetalhe}>
                <Ionicons name="location-outline" size={12} color={colors.muted} /> {mapa.talhao}
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
      
      <ScrollView style={styles.content}>
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
            <Ionicons name="map-outline" size={64} color={colors.muted} />
            <Text style={styles.emptyText}>Nenhum mapa encontrado</Text>
            <Text style={styles.emptySubtext}>
              {categoriaAtiva === 'todos' 
                ? 'Ainda não há mapas cadastrados para este produtor.'
                : 'Não há mapas nesta categoria.'}
            </Text>
          </View>
        ) : (
          <View style={styles.mapasLista}>
            {categoriaAtiva === 'todos' ? (
              // Mostrar agrupado por categoria
              mapasPorCategoria.map(cat => (
                <View key={cat.id} style={styles.categoriaSecao}>
                  <View style={styles.categoriaHeader}>
                    <Ionicons name={cat.icon} size={20} color={colors.primary} />
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
    borderWidth: 1,
    borderColor: colors.primary,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  categoriaChipAtiva: {
    backgroundColor: colors.primary,
  },
  categoriaTexto: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
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
    ...shadows.sm,
  },
  statNumero: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
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
  categoriaTitulo: {
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
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
    fontSize: typography.sizes.xs,
    fontWeight: 'bold',
    color: colors.white,
  },
  mapaCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  mapaHeader: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  mapaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  mapaInfo: {
    flex: 1,
  },
  mapaTitulo: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  mapaSubcategoria: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  mapaDetalhes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  mapaDetalhe: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
  },
  mapaObservacao: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
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
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mapaFormatoTexto: {
    fontSize: typography.sizes.xs,
    fontWeight: 'bold',
    color: colors.primary,
  },
  mapaTamanho: {
    fontSize: typography.sizes.xs,
    color: colors.muted,
  },
  downloadIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  downloadTexto: {
    fontSize: typography.sizes.xs,
    color: colors.success,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
  },
  emptyText: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: typography.sizes.sm,
    color: colors.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
