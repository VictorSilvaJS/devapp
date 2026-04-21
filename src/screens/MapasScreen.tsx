import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Modal,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import ShapeRenderer from '../components/ShapeRenderer';
import TalhaoDetailModal from '../components/TalhaoDetailModal';
import { useToast } from '../components/Toast';
import { Mapa, Produtor, LimiteArea } from '../api/mock';
import {
  buildFazendaMapaRouteParams,
  resolveRouteFazendaId,
} from '../navigation/mapaRouteCompat';
import { colors, typography, spacing, shadows } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import {
  filtrarLimitesPorFazendaIds,
  filtrarMapasPorFazendaIds,
  filtrarProdutoresPorAcesso,
} from '../utils/acessoControle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ──────────────────────────────────────────────
// CONSTANTES
// ──────────────────────────────────────────────
const ABAS = [
  { id: 'mapas', label: 'Mapas', icon: 'map-outline' },
  { id: 'limite', label: 'Limite', icon: 'git-network-outline' },
];

const CATEGORIAS = [
  { id: 'todos', nome: 'Todos', icon: 'grid-outline' },
  { id: 'fertilidade', nome: 'Fertilidade', icon: 'leaf-outline' },
  { id: 'correcao', nome: 'Correção', icon: 'construct-outline' },
  { id: 'indice_vegetacao', nome: 'Índice Vegetação', icon: 'analytics-outline' },
  { id: 'panorama', nome: 'Panorama', icon: 'image-outline' },
  { id: 'plantio', nome: 'Plantio', icon: 'git-network-outline' },
];

// ──────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────
export default function MapasScreen({ route, navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const { getFazendaIdsFiltrados, filtros } = useFiltros();
  const fazendaId = resolveRouteFazendaId(route?.params);

  // Estado geral
  const [abaAtiva, setAbaAtiva] = useState('mapas');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado aba MAPAS
  const [mapas, setMapas] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('recente');
  const [anoFiltroMapas, setAnoFiltroMapas] = useState(null); // null = todos
  const [downloadDialog, setDownloadDialog] = useState({ visible: false, mapa: null });
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadAno, setUploadAno] = useState(new Date().getFullYear().toString());

  // Estado aba LIMITE
  const [limites, setLimites] = useState([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);
  const [anoFiltroLimite, setAnoFiltroLimite] = useState(null);
  const [selectedTalhao, setSelectedTalhao] = useState(null);
  const [talhaoDetailVisible, setTalhaoDetailVisible] = useState(false);
  const [buscaLimite, setBuscaLimite] = useState('');

  // ──────────────────────────────────────────────
  // CARREGAMENTO DE DADOS
  // ──────────────────────────────────────────────
  useEffect(() => {
    loadDados();
  }, [fazendaId, filtros]);

  const loadDados = async () => {
    setLoading(true);
    try {
      await Promise.all([loadMapas(), loadLimites()]);
    } catch (error) {
      toast.showError('Não foi possível carregar os dados');
    } finally {
      setLoading(false);
    }
  };

  const getFazendaIdsPermitidos = async () => {
    const todosProdutores = await Produtor.list();
    
    if (fazendaId) {
      return [fazendaId];
    }

    const produtoresComAcesso = user
      ? filtrarProdutoresPorAcesso(todosProdutores, user)
      : todosProdutores;

    return getFazendaIdsFiltrados(produtoresComAcesso);
  };

  const loadMapas = async () => {
    const todosMapas = await Mapa.list();
    const idsPermitidos = await getFazendaIdsPermitidos();

    const mapasFiltrados = filtrarMapasPorFazendaIds(todosMapas, idsPermitidos, {
      somenteDisponiveisDownload: user?.perfil === 'produtor',
    });

    setMapas(mapasFiltrados);
  };

  const loadLimites = async () => {
    const todosLimites = await LimiteArea.list();
    const idsPermitidos = await getFazendaIdsPermitidos();
    const limitesFiltrados = filtrarLimitesPorFazendaIds(todosLimites, idsPermitidos);
    setLimites(limitesFiltrados);
    
    const anos = [...new Set(limitesFiltrados.map(l => l.ano))].sort((a: any, b: any) => Number(b) - Number(a));
    setAnosDisponiveis(anos);
    if (anos.length > 0 && !anoFiltroLimite) {
      setAnoFiltroLimite(anos[0]); // selecionar o ano mais recente
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDados();
    setRefreshing(false);
  };

  // ──────────────────────────────────────────────
  // ANOS DISPONÍVEIS PARA MAPAS
  // ──────────────────────────────────────────────
  const anosMapas = useMemo(() => {
    const anos = [...new Set(mapas.map(m => {
      const d = m.data_criacao ? new Date(m.data_criacao) : null;
      return d ? d.getFullYear() : null;
    }).filter(Boolean))].sort((a, b) => b - a);
    return anos;
  }, [mapas]);

  // ──────────────────────────────────────────────
  // FILTROS DA ABA MAPAS
  // ──────────────────────────────────────────────
  const mapasFiltrados = useMemo(() => {
    return mapas.filter(m => {
      const matchCategoria = categoriaAtiva === 'todos' || m.categoria === categoriaAtiva;
      const matchBusca = !busca || 
        m.titulo?.toLowerCase().includes(busca.toLowerCase()) ||
        m.subcategoria?.toLowerCase().includes(busca.toLowerCase()) ||
        m.talhao?.toLowerCase().includes(busca.toLowerCase()) ||
        m.observacoes?.toLowerCase().includes(busca.toLowerCase());
      const matchAno = !anoFiltroMapas || (
        m.data_criacao && new Date(m.data_criacao).getFullYear() === anoFiltroMapas
      );
      return matchCategoria && matchBusca && matchAno;
    }).sort((a, b) => {
      if (ordenacao === 'recente') {
        return new Date(b.data_criacao || 0).getTime() - new Date(a.data_criacao || 0).getTime();
      } else if (ordenacao === 'titulo') {
        return (a.titulo || '').localeCompare(b.titulo || '');
      } else if (ordenacao === 'tamanho') {
        return (b.tamanho_arquivo || 0) - (a.tamanho_arquivo || 0);
      }
      return 0;
    });
  }, [mapas, categoriaAtiva, busca, ordenacao, anoFiltroMapas]);

  const mapasPorCategoria = useMemo(() => {
    return CATEGORIAS
      .filter(cat => cat.id !== 'todos')
      .map(cat => ({
        ...cat,
        mapas: mapasFiltrados.filter(m => m.categoria === cat.id)
      }))
      .filter(cat => cat.mapas.length > 0);
  }, [mapasFiltrados]);

  // ──────────────────────────────────────────────
  // FILTROS DA ABA LIMITE
  // ──────────────────────────────────────────────
  const limitesFiltrados = useMemo(() => {
    return limites.filter(l => {
      const matchAno = !anoFiltroLimite || l.ano === anoFiltroLimite;
      const matchBusca = !buscaLimite ||
        l.talhao?.toLowerCase().includes(buscaLimite.toLowerCase()) ||
        l.nome?.toLowerCase().includes(buscaLimite.toLowerCase()) ||
        l.textura?.toLowerCase().includes(buscaLimite.toLowerCase()) ||
        l.cultura_atual?.toLowerCase().includes(buscaLimite.toLowerCase());
      return matchAno && matchBusca;
    });
  }, [limites, anoFiltroLimite, buscaLimite]);

  // ──────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────
  const handleDownload = (mapa) => {
    if (!mapa.disponivel_download) {
      toast.showInfo('Este mapa não está disponível para download no momento.');
      return;
    }
    setDownloadDialog({ visible: true, mapa });
  };

  const confirmDownload = () => {
    setDownloadDialog({ visible: false, mapa: null });
    toast.showSuccess('Download iniciado! O arquivo será salvo na pasta Downloads.');
  };

  const handleTalhaoPress = useCallback((talhao) => {
    setSelectedTalhao(talhao);
    setTalhaoDetailVisible(true);
  }, []);

  const handleUploadSimulate = () => {
    setUploadDialog(false);
    const anoNum = parseInt(uploadAno);
    if (anoNum >= 2000 && anoNum <= 2030) {
      toast.showSuccess(`Upload simulado para o ano ${anoNum}. Em produção, selecione o arquivo do drive.`);
    } else {
      toast.showError('Ano inválido. Use um ano entre 2000 e 2030.');
    }
  };

  // ──────────────────────────────────────────────
  // FORMATADORES
  // ──────────────────────────────────────────────
  const formatarTamanho = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatarData = (data) => {
    if (!data) return 'N/A';
    return new Date(data).toLocaleDateString('pt-BR');
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

  // ──────────────────────────────────────────────
  // RENDER: Card de Mapa
  // ──────────────────────────────────────────────
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
              <Ionicons name="calendar-outline" size={14} color={colors.secondary} /> {formatarData(mapa.data_criacao)}
            </Text>
            {mapa.talhao && (
              <Text style={styles.mapaDetalhe}>
                <Ionicons name="location-outline" size={14} color={colors.secondary} /> {mapa.talhao}
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

  // ──────────────────────────────────────────────
  // RENDER: Card de Talhão (Lista Limite)
  // ──────────────────────────────────────────────
  const renderTalhaoCard = (talhao) => (
    <TouchableOpacity
      key={talhao.id}
      style={[
        styles.talhaoCard,
        selectedTalhao?.id === talhao.id && styles.talhaoCardSelected
      ]}
      onPress={() => handleTalhaoPress(talhao)}
      activeOpacity={0.7}
    >
      <View style={styles.talhaoCardHeader}>
        <View style={[styles.talhaoColorBar, { backgroundColor: talhao.cor || colors.primary }]} />
        <View style={styles.talhaoCardInfo}>
          <Text style={styles.talhaoCardNome}>{talhao.talhao}</Text>
          <Text style={styles.talhaoCardSub}>{talhao.nome}</Text>
        </View>
        <View style={styles.talhaoCardRight}>
          <Text style={styles.talhaoCardArea}>{talhao.area_hectares} ha</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </View>

      <View style={styles.talhaoCardDetails}>
        <View style={styles.talhaoChip}>
          <Ionicons name="layers-outline" size={12} color={colors.secondary} />
          <Text style={styles.talhaoChipText}>{talhao.textura || '-'}</Text>
        </View>
        <View style={styles.talhaoChip}>
          <Ionicons name="leaf-outline" size={12} color={colors.success} />
          <Text style={styles.talhaoChipText}>{talhao.cultura_atual || '-'}</Text>
        </View>
        <View style={styles.talhaoChip}>
          <Ionicons name="flask-outline" size={12} color={colors.info} />
          <Text style={styles.talhaoChipText}>pH {talhao.elementos?.ph || '-'}</Text>
        </View>
        {talhao.disponivel_offline && (
          <View style={[styles.talhaoChip, styles.talhaoChipOffline]}>
            <Ionicons name="cloud-done-outline" size={12} color={colors.success} />
            <Text style={[styles.talhaoChipText, { color: colors.success }]}>Offline</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // ──────────────────────────────────────────────
  // RENDER: ABA MAPAS
  // ──────────────────────────────────────────────
  const renderAbaMapas = () => (
    <>
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

      {/* Filtro por Ano */}
      <View style={styles.anoFilterContainer}>
        <Text style={styles.anoFilterLabel}>
          <Ionicons name="calendar-outline" size={14} color={colors.text} /> Filtrar por ano:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anoFilterContent}>
          <TouchableOpacity
            style={[styles.anoChip, !anoFiltroMapas && styles.anoChipActive]}
            onPress={() => setAnoFiltroMapas(null)}
          >
            <Text style={[styles.anoChipText, !anoFiltroMapas && styles.anoChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {anosMapas.map(ano => (
            <TouchableOpacity
              key={ano}
              style={[styles.anoChip, anoFiltroMapas === ano && styles.anoChipActive]}
              onPress={() => setAnoFiltroMapas(ano)}
            >
              <Text style={[styles.anoChipText, anoFiltroMapas === ano && styles.anoChipTextActive]}>{ano}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Ordenação */}
      <View style={styles.ordenacaoContainer}>
        <Text style={styles.ordenacaoLabel}>
          <Ionicons name="swap-vertical-outline" size={14} color={colors.text} /> Ordenar:
        </Text>
        <View style={styles.ordenacaoButtons}>
          {[
            { key: 'recente', label: 'Recente', icon: 'time-outline' },
            { key: 'titulo', label: 'Título', icon: 'text-outline' },
            { key: 'tamanho', label: 'Tamanho', icon: 'document-outline' }
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.ordenacaoChip, ordenacao === item.key && styles.ordenacaoChipActive]}
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
        style={styles.scrollContent}
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
          {CATEGORIAS.map(cat => (
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
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumero}>{mapas.filter(m => m.disponivel_download).length}</Text>
            <Text style={styles.statLabel}>Disponíveis</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumero}>{mapasFiltrados.length}</Text>
            <Text style={styles.statLabel}>Filtrados</Text>
          </View>
        </View>

        {/* Botão Upload (admin/colab) */}
        {(user?.perfil === 'admin' || user?.perfil === 'colaborador') && (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => setUploadDialog(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
            <Text style={styles.uploadButtonText}>Importar Mapa do Drive</Text>
          </TouchableOpacity>
        )}

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
                ? 'Tente ajustar sua busca, categoria ou filtro de ano'
                : categoriaAtiva === 'todos' 
                  ? 'Ainda não há mapas cadastrados para esta fazenda.'
                  : 'Não há mapas nesta categoria no momento.'}
            </Text>
          </View>
        ) : (
          <View style={styles.mapasLista}>
            {categoriaAtiva === 'todos' ? (
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
              mapasFiltrados.map(mapa => renderMapaCard(mapa))
            )}
          </View>
        )}

        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>
    </>
  );

  // ──────────────────────────────────────────────
  // RENDER: ABA LIMITE (SHAPE)
  // ──────────────────────────────────────────────
  const renderAbaLimite = () => (
    <ScrollView
      style={styles.scrollContent}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {/* Busca */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={colors.muted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar talhão, textura, cultura..."
            placeholderTextColor={colors.muted}
            value={buscaLimite}
            onChangeText={setBuscaLimite}
          />
          {buscaLimite.length > 0 && (
            <TouchableOpacity onPress={() => setBuscaLimite('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtro por Ano */}
      <View style={styles.anoFilterContainer}>
        <Text style={styles.anoFilterLabel}>
          <Ionicons name="calendar-outline" size={14} color={colors.text} /> Ano do levantamento:
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.anoFilterContent}>
          <TouchableOpacity
            style={[styles.anoChip, !anoFiltroLimite && styles.anoChipActive]}
            onPress={() => setAnoFiltroLimite(null)}
          >
            <Text style={[styles.anoChipText, !anoFiltroLimite && styles.anoChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {anosDisponiveis.map(ano => (
            <TouchableOpacity
              key={ano}
              style={[styles.anoChip, anoFiltroLimite === ano && styles.anoChipActive]}
              onPress={() => setAnoFiltroLimite(ano)}
            >
              <Text style={[styles.anoChipText, anoFiltroLimite === ano && styles.anoChipTextActive]}>
                LT {ano}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Estatísticas Limite */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>{limitesFiltrados.length}</Text>
          <Text style={styles.statLabel}>Talhões</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>
            {limitesFiltrados.reduce((s, l) => s + (l.area_hectares || 0), 0).toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>ha Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumero}>
            {limitesFiltrados.filter(l => l.disponivel_offline).length}
          </Text>
          <Text style={styles.statLabel}>Offline</Text>
        </View>
      </View>

      {limitesFiltrados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-network-outline" size={80} color={colors.muted} />
          <Text style={styles.emptyText}>Nenhum limite de área encontrado</Text>
          <Text style={styles.emptySubtext}>
            {buscaLimite 
              ? 'Tente ajustar sua busca ou filtro de ano'
              : 'Não há shapes de demarcação disponíveis para o período selecionado.'}
          </Text>
        </View>
      ) : (
        <>
          {/* ── Botão Ver no Mapa Satélite ────────────────────── */}
          <TouchableOpacity
            style={styles.btnMapaSatelite}
            onPress={() =>
              navigation.navigate(
                'FazendaMapa',
                buildFazendaMapaRouteParams({
                  fazendaId,
                })
              )
            }
            activeOpacity={0.8}
          >
            <View style={styles.btnMapaSateliteIcone}>
              <Ionicons name="earth" size={22} color={colors.white} />
            </View>
            <View style={styles.btnMapaSateliteTextos}>
              <Text style={styles.btnMapaSateliteTitulo}>Ver no Mapa Satélite</Text>
              <Text style={styles.btnMapaSateliteSubtitulo}>
                Visualize os talhões sobre imagem aérea
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>

          {/* Visualização Shape */}
          <View style={styles.shapeSection}>
            <View style={styles.shapeSectionHeader}>
              <Ionicons name="git-network-outline" size={20} color={colors.primary} />
              <Text style={styles.shapeSectionTitle}>Demarcação dos Talhões</Text>
              {anoFiltroLimite && (
                <View style={styles.anoTag}>
                  <Text style={styles.anoTagText}>LT {anoFiltroLimite}</Text>
                </View>
              )}
            </View>
            <ShapeRenderer
              talhoes={limitesFiltrados}
              onTalhaoPress={handleTalhaoPress}
              selectedId={selectedTalhao?.id}
              height={280}
              showLabels
              showLegend
            />
          </View>

          {/* Lista de Talhões */}
          <View style={styles.talhaoListSection}>
            <Text style={styles.talhaoListTitle}>
              <Ionicons name="list-outline" size={18} color={colors.primary} /> Detalhes dos Talhões
            </Text>
            {limitesFiltrados.map(talhao => renderTalhaoCard(talhao))}
          </View>

          {/* Botão Upload Shape (admin/colab) */}
          {(user?.perfil === 'admin' || user?.perfil === 'colaborador') && (
            <TouchableOpacity
              style={[styles.uploadButton, { marginHorizontal: spacing.md }]}
              onPress={() => setUploadDialog(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="cloud-upload-outline" size={20} color={colors.white} />
              <Text style={styles.uploadButtonText}>Importar Shape do Drive</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={{ height: spacing.xl * 3 }} />
    </ScrollView>
  );

  // ──────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ──────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Mapas & Limites" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Mapas & Limites" showBack onBack={() => navigation.goBack()} />
      
      {/* Abas Principais */}
      <View style={styles.tabContainer}>
        {ABAS.map(aba => (
          <TouchableOpacity
            key={aba.id}
            style={[styles.tab, abaAtiva === aba.id && styles.tabActive]}
            onPress={() => setAbaAtiva(aba.id)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name={aba.icon} 
              size={20} 
              color={abaAtiva === aba.id ? colors.white : colors.primary} 
            />
            <Text style={[styles.tabText, abaAtiva === aba.id && styles.tabTextActive]}>
              {aba.label}
            </Text>
            {aba.id === 'mapas' && mapas.length > 0 && (
              <View style={[styles.tabBadge, abaAtiva === aba.id && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, abaAtiva === aba.id && styles.tabBadgeTextActive]}>
                  {mapas.length}
                </Text>
              </View>
            )}
            {aba.id === 'limite' && limites.length > 0 && (
              <View style={[styles.tabBadge, abaAtiva === aba.id && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, abaAtiva === aba.id && styles.tabBadgeTextActive]}>
                  {limites.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Conteúdo da aba ativa */}
      {abaAtiva === 'mapas' ? renderAbaMapas() : renderAbaLimite()}

      {/* Dialog de Download */}
      <ConfirmDialog
        visible={downloadDialog.visible}
        title="Download"
        message={downloadDialog.mapa 
          ? `Deseja baixar o mapa "${downloadDialog.mapa.titulo}"?\n\nFormato: ${downloadDialog.mapa.formato_arquivo?.toUpperCase() || 'PDF'}\nTamanho: ${formatarTamanho(downloadDialog.mapa.tamanho_arquivo)}` 
          : ''}
        type="info"
        confirmText="Baixar"
        cancelText="Cancelar"
        onConfirm={confirmDownload}
        onCancel={() => setDownloadDialog({ visible: false, mapa: null })}
      />

      {/* Modal de Upload com Data */}
      <Modal
        visible={uploadDialog}
        transparent
        animationType="fade"
        onRequestClose={() => setUploadDialog(false)}
      >
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadDialog}>
            <View style={styles.uploadHeader}>
              <View style={styles.uploadHeaderLeft}>
                <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
                <Text style={styles.uploadTitle}>
                  {abaAtiva === 'mapas' ? 'Importar Mapa' : 'Importar Shape'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setUploadDialog(false)} style={styles.uploadClose}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.uploadDescription}>
              {abaAtiva === 'mapas' 
                ? 'Selecione o arquivo do drive e informe o ano de referência para o mapa histórico.'
                : 'Selecione o arquivo shape (.shp) do drive e informe o ano do levantamento topográfico (ex: LT 2025).'}
            </Text>

            {/* Simulação de seleção de arquivo */}
            <TouchableOpacity style={styles.fileSelectButton} activeOpacity={0.7}>
              <Ionicons name="folder-open-outline" size={24} color={colors.primary} />
              <Text style={styles.fileSelectText}>Selecionar arquivo do Drive</Text>
            </TouchableOpacity>

            {/* Formatos suportados */}
            <View style={styles.formatosInfo}>
              <Ionicons name="information-circle-outline" size={16} color={colors.info} />
              <Text style={styles.formatosInfoText}>
                {abaAtiva === 'mapas' 
                  ? 'Formatos: PDF, JPG, PNG, GeoTIFF, DWG'
                  : 'Formatos: SHP, KML, GeoJSON'}
              </Text>
            </View>

            {/* Input de Ano */}
            <View style={styles.uploadAnoContainer}>
              <Text style={styles.uploadAnoLabel}>
                Ano de referência / data do upload:
              </Text>
              <TextInput
                style={styles.uploadAnoInput}
                value={uploadAno}
                onChangeText={setUploadAno}
                keyboardType="numeric"
                maxLength={4}
                placeholder="Ex: 2025"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View style={styles.uploadActions}>
              <TouchableOpacity 
                style={styles.uploadCancelBtn} 
                onPress={() => setUploadDialog(false)}
              >
                <Text style={styles.uploadCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.uploadConfirmBtn} 
                onPress={handleUploadSimulate}
              >
                <Ionicons name="cloud-upload" size={18} color={colors.white} />
                <Text style={styles.uploadConfirmText}>Importar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Detalhe do Talhão */}
      <TalhaoDetailModal
        visible={talhaoDetailVisible}
        talhao={selectedTalhao}
        onClose={() => {
          setTalhaoDetailVisible(false);
        }}
      />
    </View>
  );
}

// ──────────────────────────────────────────────
// ESTILOS
// ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  scrollContent: {
    flex: 1,
  },

  // ── ABAS ──
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: spacing.radius,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 22,
    alignItems: 'center',
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: typography.fontSmall,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  tabBadgeTextActive: {
    color: colors.white,
  },

  // ── BUSCA ──
  searchContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: spacing.radius,
    paddingHorizontal: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: typography.sizes.md,
    color: colors.text,
    paddingVertical: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
  },

  // ── FILTRO ANO ──
  anoFilterContainer: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  anoFilterLabel: {
    fontSize: typography.fontCaption,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.xs,
  },
  anoFilterContent: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  anoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginRight: spacing.xs,
  },
  anoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  anoChipText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  anoChipTextActive: {
    color: colors.white,
  },

  // ── ORDENAÇÃO ──
  ordenacaoContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ordenacaoLabel: {
    fontSize: typography.fontCaption,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.xs,
  },
  ordenacaoButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ordenacaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ordenacaoChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ordenacaoChipText: {
    fontSize: typography.fontCaption,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
  },
  ordenacaoChipTextActive: {
    color: colors.white,
    fontWeight: typography.weightBold,
  },

  // ── CATEGORIAS ──
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
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  categoriaTextoAtiva: {
    color: colors.white,
  },

  // ── STATS ──
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: spacing.radius,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statNumero: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
    marginTop: 2,
    textAlign: 'center',
  },

  // ── BOTÃO MAPA SATÉLITE ──
  btnMapaSatelite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.primary,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  btnMapaSateliteIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnMapaSateliteTextos: {
    flex: 1,
  },
  btnMapaSateliteTitulo: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  btnMapaSateliteSubtitulo: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 1,
  },

  // ── UPLOAD ──
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    ...shadows.md,
  },
  uploadButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  uploadOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  uploadDialog: {
    backgroundColor: colors.card,
    borderRadius: spacing.radiusLg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    ...shadows.lg,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  uploadHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  uploadTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  uploadClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadDescription: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  fileSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  fileSelectText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  formatosInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  formatosInfoText: {
    fontSize: typography.fontCaption,
    color: colors.info,
    fontWeight: typography.weightSemibold,
  },
  uploadAnoContainer: {
    marginBottom: spacing.lg,
  },
  uploadAnoLabel: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  uploadAnoInput: {
    backgroundColor: colors.background,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontBody,
    color: colors.text,
    textAlign: 'center',
  },
  uploadActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  uploadCancelBtn: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  uploadCancelText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  uploadConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: spacing.radius,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  uploadConfirmText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  // ── MAPAS LISTA ──
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
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  categoriaBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: spacing.radius,
    minWidth: 24,
    alignItems: 'center',
  },
  categoriaBadgeTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  // ── MAPA CARD ──
  mapaCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
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
    width: 52,
    height: 52,
    borderRadius: 26,
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
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 3,
  },
  mapaSubcategoria: {
    fontSize: typography.fontCaption + 1,
    color: colors.primary,
    fontWeight: typography.weightSemibold,
    marginBottom: 3,
  },
  mapaDetalhes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mapaDetalhe: {
    fontSize: typography.fontCaption,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
  },
  mapaObservacao: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
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
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
  },
  mapaFormatoTexto: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },
  mapaTamanho: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightSemibold,
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

  // ── SHAPE SECTION ──
  shapeSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  shapeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  shapeSectionTitle: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    flex: 1,
  },
  anoTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: spacing.radiusSm,
  },
  anoTagText: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.white,
  },

  // ── TALHÃO LIST ──
  talhaoListSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  talhaoListTitle: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  talhaoCard: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  talhaoCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent + '30',
  },
  talhaoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  talhaoColorBar: {
    width: 6,
    height: 40,
    borderRadius: 3,
    marginRight: spacing.sm,
  },
  talhaoCardInfo: {
    flex: 1,
  },
  talhaoCardNome: {
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  talhaoCardSub: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 1,
  },
  talhaoCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  talhaoCardArea: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.primary,
  },
  talhaoCardDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  talhaoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  talhaoChipOffline: {
    backgroundColor: colors.successBg,
    borderColor: colors.success + '40',
  },
  talhaoChipText: {
    fontSize: typography.fontSmall + 1,
    fontWeight: typography.weightSemibold,
    color: colors.textLight,
  },

  // ── EMPTY ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
    minHeight: 350,
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
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
