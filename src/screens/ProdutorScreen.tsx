import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutAnimation, Platform, UIManager, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { Produtor, Visita, Mapa } from '../api/mock';
import { colors, typography, spacing, border, shadows } from '../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutorScreen({ route, navigation }) {
  const toast = useToast();
  const [produtor, setProdutor] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [mapas, setMapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumo');
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async (id) => {
    if (id) {
      try {
        setLoading(true);
        const [p, v, m] = await Promise.all([
          Produtor.get(id),
          Visita.filter({ fazenda_id: id }),
          Mapa.filter({ fazenda_id: id })
        ]);
        // animar mudanças locais
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setProdutor(p);
        setVisitas(v);
        setMapas(m);
      } catch (error) {
        toast.showError('Não foi possível carregar os dados do produtor');
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const id = route?.params?.id;
    loadData(id);
  }, [route?.params?.id]);

  // Recarregar dados quando voltar da tela de edição
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const id = route?.params?.id;
      if (id && produtor) {
        loadData(id);
      }
    });
    return unsubscribe;
  }, [navigation, route?.params?.id]);

  const handleEdit = () => {
    navigation.navigate('EditarProdutor', { id: produtor.id });
  };

  const handleDelete = () => {
    setDeleteDialogVisible(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await Produtor.delete(produtor.id);
      setDeleteDialogVisible(false);
      setDeleting(false);
      toast.showSuccess('Produtor excluído com sucesso');
      navigation.navigate('Produtores');
    } catch (error) {
      setDeleteDialogVisible(false);
      setDeleting(false);
      toast.showError('Não foi possível excluir o produtor');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Produtor" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
        </View>
      </View>
    );
  }

  if (!produtor) {
    return (
      <View style={styles.container}>
        <Header title="Produtor" />
        <View style={styles.loadingContainer}>
          <Text style={styles.body}>Produtor não encontrado.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={produtor.nome} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Cabeçalho com Avatar e Informações Básicas */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {produtor.nome.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{produtor.nome}</Text>
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={14} color={colors.muted} />
              <Text style={styles.profileLocation}>
                {produtor.fazenda} - {produtor.cidade}, {produtor.estado}
              </Text>
            </View>
          </View>
        </View>

        {/* Botões de Ação */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={handleEdit}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.editButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="create-outline" size={20} color={colors.white} />
              <Text style={styles.editButtonText}>Editar Produtor</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={handleDelete}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.error, colors.error]}
              style={styles.deleteButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="trash-outline" size={20} color={colors.white} />
              <Text style={styles.deleteButtonText}>Excluir</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Cards de Estatísticas Compactos */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.statsCarousel}
          contentContainerStyle={styles.statsContent}
        >
          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="resize-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.statValueCompact}>{produtor.area_total} ha</Text>
            <Text style={styles.statLabelCompact}>Área Total</Text>
          </View>
          
          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="leaf-outline" size={20} color={colors.secondary} />
            </View>
            <Text style={styles.statValueCompact}>{produtor.cultura_atual || 'N/A'}</Text>
            <Text style={styles.statLabelCompact}>Cultura</Text>
          </View>
          
          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.info} />
            </View>
            <Text style={styles.statValueCompact}>{visitas.length}</Text>
            <Text style={styles.statLabelCompact}>Visitas</Text>
          </View>
          
          <View style={styles.statCardCompact}>
            <View style={[styles.statIconCompact, { backgroundColor: colors.amberLight }]}>
              <Ionicons name="map-outline" size={20} color={colors.amber} />
            </View>
            <Text style={styles.statValueCompact}>{mapas.length}</Text>
            <Text style={styles.statLabelCompact}>Mapas</Text>
          </View>
        </ScrollView>

        {/* Tabs de Navegação */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'resumo' && styles.tabActive]}
            onPress={() => setActiveTab('resumo')}
          >
            <Ionicons 
              name="stats-chart-outline" 
              size={20} 
              color={activeTab === 'resumo' ? colors.primary : colors.muted} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'resumo' && styles.tabTextActive]}>
              Resumo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'lavoura' && styles.tabActive]}
            onPress={() => setActiveTab('lavoura')}
          >
            <Ionicons 
              name="map-outline" 
              size={20} 
              color={activeTab === 'lavoura' ? colors.primary : colors.muted} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'lavoura' && styles.tabTextActive]}>
              Lavoura
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'visitas' && styles.tabActive]}
            onPress={() => setActiveTab('visitas')}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={activeTab === 'visitas' ? colors.primary : colors.muted} 
              style={styles.tabIcon}
            />
            <Text style={[styles.tabText, activeTab === 'visitas' && styles.tabTextActive]}>
              Visitas
            </Text>
          </TouchableOpacity>
        </View>

        {/* Conteúdo das Tabs */}
        {activeTab === 'resumo' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>Informações do Produtor</Text>
            
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="person" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Nome Completo</Text>
                </View>
                <Text style={styles.infoValue}>{produtor.nome}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="home" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Fazenda</Text>
                </View>
                <Text style={styles.infoValue}>{produtor.fazenda}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="resize-outline" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Área Total</Text>
                </View>
                <Text style={styles.infoValue}>{produtor.area_total} hectares</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="leaf-outline" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Cultura Principal</Text>
                </View>
                <Text style={styles.infoValue}>{produtor.cultura_atual || 'Não informado'}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Localização</Text>
                </View>
                <Text style={styles.infoValue}>{produtor.cidade}, {produtor.estado}</Text>
              </View>
              {produtor.contato && (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="call" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Contato</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.contato}</Text>
                </View>
              )}
              {produtor.email && (
                <View style={styles.infoRow}>
                  <View style={styles.infoLabelContainer}>
                    <Ionicons name="mail" size={16} color={colors.primary} />
                    <Text style={styles.infoLabel}>Email</Text>
                  </View>
                  <Text style={styles.infoValue}>{produtor.email}</Text>
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>Estatísticas</Text>
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="calendar" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Total de Visitas</Text>
                </View>
                <Text style={styles.infoValue}>{visitas.length} visita{visitas.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="map" size={16} color={colors.primary} />
                  <Text style={styles.infoLabel}>Total de Mapas</Text>
                </View>
                <Text style={styles.infoValue}>{mapas.length} mapa{mapas.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoLabelContainer}>
                  <Ionicons name="checkmark-circle" size={16} color={produtor.status === 'ativo' ? colors.success : colors.warning} />
                  <Text style={styles.infoLabel}>Status</Text>
                </View>
                <View style={[styles.statusBadgeInline, { backgroundColor: produtor.status === 'ativo' ? colors.success + '20' : colors.warning + '20' }]}>
                  <Text style={[styles.statusTextInline, { color: produtor.status === 'ativo' ? colors.success : colors.warning }]}>
                    {produtor.status === 'ativo' ? 'Ativo' : 'Pendente'}
                  </Text>
                </View>
              </View>
            </View>

            {produtor.observacoes && (
              <>
                <Text style={styles.sectionTitle}>Observações</Text>
                <View style={styles.infoSection}>
                  <Text style={styles.observacoesText}>{produtor.observacoes}</Text>
                </View>
              </>
            )}
          </View>
        )}

        {activeTab === 'lavoura' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mapas da Lavoura</Text>
              <TouchableOpacity 
                style={styles.verTodosButton}
                onPress={() => navigation.navigate('Mapas', { produtorId: produtor.id })}
              >
                <Text style={styles.verTodosText}>Ver Todos</Text>
                <Ionicons name="chevron-forward-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {mapas.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="map-outline" size={48} color={colors.muted} />
                <Text style={styles.emptyText}>Nenhum mapa cadastrado</Text>
              </View>
            ) : (
              <>
                {mapas.slice(0, 3).map(mapa => (
                <View key={mapa.id} style={styles.mapaCard}>
                  <View style={styles.mapaHeader}>
                    <View style={styles.mapaIconContainer}>
                      <Ionicons 
                        name={
                          mapa.categoria === 'fertilidade' ? 'leaf-outline' : 
                          mapa.categoria === 'indice_vegetacao' ? 'git-network-outline' : 
                          mapa.categoria === 'correcao' ? 'flask-outline' : 'map-outline'
                        }
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.mapaInfo}>
                      <Text style={styles.mapaTitle}>{mapa.titulo}</Text>
                      <Text style={styles.mapaSubtitle}>
                        {mapa.talhao} • Safra {mapa.safra}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.mapaDetails}>
                    <View style={styles.mapaDetailRow}>
                      <Ionicons name="calendar-outline" size={16} color={colors.muted} style={{ marginRight: 6 }} />
                      <Text style={styles.mapaDetailItem}>
                        {new Date(mapa.data_criacao).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    {mapa.observacoes && (
                      <Text style={styles.mapaObservacoes} numberOfLines={2}>
                        {mapa.observacoes}
                      </Text>
                    )}
                  </View>
                  {mapa.disponivel_para_download && (
                    <TouchableOpacity style={styles.mapaButton}>
                      <Ionicons name="download-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                      <Text style={styles.mapaButtonText}>Visualizar Mapa</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {mapas.length > 3 && (
                <TouchableOpacity 
                  style={styles.verMaisButton}
                  onPress={() => navigation.navigate('Mapas', { produtorId: produtor.id })}
                >
                  <Text style={styles.verMaisText}>
                    Ver mais {mapas.length - 3} mapas
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
            </>
            )}
          </View>
        )}

        {activeTab === 'visitas' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Histórico de Visitas</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{visitas.length}</Text>
              </View>
            </View>

            {visitas.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={colors.muted} />
                <Text style={styles.emptyText}>Nenhuma visita registrada</Text>
                <Text style={styles.emptySubtext}>
                  As visitas técnicas aparecerão aqui
                </Text>
              </View>
            ) : (
              visitas.map((v, index) => (
                <View key={v.id} style={styles.visitCard}>
                  <View style={styles.visitNumber}>
                    <Text style={styles.visitNumberText}>#{visitas.length - index}</Text>
                  </View>
                  <View style={styles.visitContent}>
                    <View style={styles.visitHeader}>
                      <View style={styles.visitDateContainer}>
                        <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={styles.visitDate}>
                          {new Date(v.data_visita).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.visitTecnicoContainer}>
                      <Text style={styles.visitTecnicoLabel}>Técnico Responsável:</Text>
                      <View style={styles.visitTecnicoRow}>
                        <Ionicons name="person-outline" size={16} color={colors.textLight} style={{ marginRight: 6 }} />
                        <Text style={styles.visitTecnico}>{v.tecnico_responsavel}</Text>
                      </View>
                    </View>
                    <View style={styles.visitDetailRow}>
                      <View style={styles.visitLabelContainer}>
                        <Ionicons name="flag-outline" size={16} color={colors.textLight} style={{ marginRight: 6 }} />
                        <Text style={styles.visitLabel}>Objetivo:</Text>
                      </View>
                      <Text style={styles.visitObjetivo}>{v.objetivo}</Text>
                    </View>
                    {v.observacoes && (
                      <View style={styles.visitDetailRow}>
                        <View style={styles.visitLabelContainer}>
                          <Ionicons name="document-text-outline" size={16} color={colors.textLight} style={{ marginRight: 6 }} />
                          <Text style={styles.visitLabel}>Observações:</Text>
                        </View>
                        <Text style={styles.visitObservacoes}>{v.observacoes}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={deleteDialogVisible}
        title="Excluir Produtor"
        message={`Tem certeza que deseja excluir ${produtor?.nome}? Esta ação não pode ser desfeita.`}
        type="danger"
        confirmText="Excluir"
        cancelText="Cancelar"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteDialogVisible(false)}
        loading={deleting}
      />
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
    paddingBottom: 32
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: typography.fontBody
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: colors.card,
    padding: spacing.card,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarText: {
    fontSize: 28,
    fontWeight: typography.weightBold,
    color: colors.white
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 6
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileLocation: {
    flex: 1,
    fontSize: typography.fontBody - 1,
    color: colors.muted,
    lineHeight: 18
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg
  },
  editButton: {
    flex: 2,
    borderRadius: spacing.radius,
    overflow: 'hidden',
    ...shadows.md,
  },
  editButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
  },
  editButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody,
    letterSpacing: 0.3,
  },
  deleteButton: {
    flex: 1,
    borderRadius: spacing.radius,
    overflow: 'hidden',
    ...shadows.md,
  },
  deleteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
  },
  deleteButtonText: {
    color: colors.white,
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody,
    letterSpacing: 0.3,
  },
  statsCarousel: {
    marginBottom: 20,
  },
  statsContent: {
    paddingHorizontal: spacing.md,
    gap: 12,
  },
  statCardCompact: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 110,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIconCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValueCompact: {
    fontSize: 18,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4,
  },
  statLabelCompact: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.accentDark,
    borderRadius: spacing.radius,
    padding: 4,
    marginBottom: 16
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: spacing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabActive: {
    backgroundColor: colors.card
  },
  tabIcon: {
    marginRight: 6
  },
  tabText: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    color: colors.muted
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: typography.weightBold
  },
  tabContent: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    padding: spacing.card,
    borderWidth: 2,
    borderColor: colors.border
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 16
  },
  countBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center'
  },
  countBadgeText: {
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold
  },
  infoSection: {
    backgroundColor: colors.backgroundAlt,
    padding: 12,
    borderRadius: spacing.radiusSm,
    marginBottom: 16
  },
  infoRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  infoLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: typography.fontCaption + 1,
    color: colors.textLight,
    fontWeight: typography.weightBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    lineHeight: 22,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundAlt,
    padding: 12,
    borderRadius: spacing.radiusSm,
    marginTop: 8
  },
  statusLabel: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.accent
  },
  statusText: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
    color: colors.text
  },
  statusBadgeInline: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextInline: {
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  observacoesText: {
    fontSize: typography.fontBody,
    color: colors.text,
    lineHeight: 22,
  },
  mapaCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  mapaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  mapaIconContainer: {
    width: 48,
    height: 48,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  mapaIcon: {
    fontSize: 24
  },
  mapaInfo: {
    flex: 1
  },
  mapaTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 2
  },
  mapaSubtitle: {
    fontSize: typography.fontCaption,
    color: colors.muted
  },
  mapaDetails: {
    marginBottom: 12
  },
  mapaDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  mapaDetailItem: {
    fontSize: typography.fontCaption,
    color: colors.muted
  },
  mapaObservacoes: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    marginTop: 4
  },
  mapaButton: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: spacing.radiusSm,
    alignItems: 'center'
  },
  mapaButtonText: {
    color: colors.white,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold
  },
  visitCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radius,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row'
  },
  visitNumber: {
    width: 48,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center'
  },
  visitNumberText: {
    color: colors.white,
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold
  },
  visitContent: {
    flex: 1,
    padding: 12
  },
  visitHeader: {
    marginBottom: 8
  },
  visitDateContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  visitDate: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text
  },
  visitTecnicoContainer: {
    marginBottom: 8
  },
  visitTecnicoLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
    marginBottom: 4
  },
  visitTecnicoRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  visitTecnico: {
    fontSize: typography.fontBody - 1,
    color: colors.text,
    fontWeight: typography.weightSemibold
  },
  visitDetailRow: {
    marginBottom: 8
  },
  visitLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  visitLabel: {
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
    color: colors.muted
  },
  visitObjetivo: {
    fontSize: typography.fontBody - 1,
    color: colors.text,
    lineHeight: 20
  },
  visitObservacoes: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    lineHeight: 20,
    fontStyle: 'italic'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16
  },
  sectionHeaderSecondary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  verTodosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verTodosText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: '600',
  },
  verMaisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    gap: spacing.xs,
  },
  verMaisText: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyText: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: typography.weightSemibold,
    marginBottom: 4
  },
  emptySubtext: {
    fontSize: typography.fontCaption,
    color: colors.mutedLight,
    textAlign: 'center'
  },
  body: {
    fontSize: typography.fontBody,
    color: colors.text
  }
});
