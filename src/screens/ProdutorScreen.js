import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutAnimation, Platform, UIManager, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Produtor, Visita, Mapa } from '../api/mock';
import { colors, typography, spacing, border, shadows } from '../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutorScreen({ route, navigation }) {
  const [produtor, setProdutor] = useState(null);
  const [visitas, setVisitas] = useState([]);
  const [mapas, setMapas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumo');

  const loadData = async (id) => {
    if (id) {
      try {
        setLoading(true);
        const [p, v, m] = await Promise.all([
          Produtor.get(id),
          Visita.filter({ produtor_id: id }),
          Mapa.filter({ produtor_id: id })
        ]);
        // animar mudanças locais
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setProdutor(p);
        setVisitas(v);
        setMapas(m);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar os dados do produtor');
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
    Alert.alert(
      'Excluir Produtor',
      `Tem certeza que deseja excluir ${produtor.nome}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await Produtor.delete(produtor.id);
              Alert.alert('Sucesso', 'Produtor excluído com sucesso');
              navigation.navigate('Produtores');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível excluir o produtor');
            }
          }
        }
      ]
    );
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
            <Text style={styles.profileLocation}>
              📍 {produtor.fazenda} - {produtor.cidade}, {produtor.estado}
            </Text>
          </View>
        </View>

        {/* Botões de Ação */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Text style={styles.editButtonText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Excluir</Text>
          </TouchableOpacity>
        </View>

        {/* Cards de Estatísticas - Grid 2x2 */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={['#d9f0d9', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, { borderColor: '#b6d7a8' }]}
              >
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {produtor.area_total} ha
                  </Text>
                  <Text style={styles.statLabel}>Área Total</Text>
                </View>
                <View style={[styles.statIconContainer, { backgroundColor: '#d9f0d9' }]}>
                  <Ionicons name="resize-outline" size={24} color={colors.primary} />
                </View>
              </LinearGradient>
            </View>

            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={['#dbeafe', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, { borderColor: '#bfdbfe' }]}
              >
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: '#2563eb' }]}>
                    {produtor.cultura_atual || 'N/A'}
                  </Text>
                  <Text style={styles.statLabel}>Cultura Atual</Text>
                </View>
                <View style={[styles.statIconContainer, { backgroundColor: '#dbeafe' }]}>
                  <Ionicons name="leaf-outline" size={24} color="#2563eb" />
                </View>
              </LinearGradient>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={['#ede9fe', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, { borderColor: '#ddd6fe' }]}
              >
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: '#7c3aed' }]}>
                    {visitas.length}
                  </Text>
                  <Text style={styles.statLabel}>Visitas</Text>
                </View>
                <View style={[styles.statIconContainer, { backgroundColor: '#ede9fe' }]}>
                  <Ionicons name="calendar-outline" size={24} color="#7c3aed" />
                </View>
              </LinearGradient>
            </View>

            <View style={styles.statCardWrapper}>
              <LinearGradient
                colors={['#fef3c7', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.statCard, { borderColor: '#fde68a' }]}
              >
                <View style={styles.statContent}>
                  <Text style={[styles.statValue, { color: '#d97706' }]}>
                    {mapas.length}
                  </Text>
                  <Text style={styles.statLabel}>Mapas</Text>
                </View>
                <View style={[styles.statIconContainer, { backgroundColor: '#fef3c7' }]}>
                  <Ionicons name="map-outline" size={24} color="#d97706" />
                </View>
              </LinearGradient>
            </View>
          </View>
        </View>

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
            <Text style={styles.sectionTitle}>Informações Gerais</Text>
            
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>👤 Nome Completo</Text>
                <Text style={styles.infoValue}>{produtor.nome}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🏡 Fazenda</Text>
                <Text style={styles.infoValue}>{produtor.fazenda}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📍 Localização</Text>
                <Text style={styles.infoValue}>{produtor.cidade}, {produtor.estado}</Text>
              </View>
              {produtor.telefone && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📞 Telefone</Text>
                  <Text style={styles.infoValue}>{produtor.telefone}</Text>
                </View>
              )}
              {produtor.email && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>✉️ Email</Text>
                  <Text style={styles.infoValue}>{produtor.email}</Text>
                </View>
              )}
            </View>

            {produtor.ultima_analise && (
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>📊 Última Análise</Text>
                  <Text style={styles.infoValue}>
                    {new Date(produtor.ultima_analise).toLocaleDateString('pt-BR')}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statusContainer}>
              <Text style={styles.statusLabel}>Status da Conta:</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {produtor.status === 'ativo' ? '🟢 Ativo' : '🟡 Pendente'}
                </Text>
              </View>
            </View>
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
                      <Ionicons name="download-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
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
    color: '#fff'
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4
  },
  profileLocation: {
    fontSize: typography.fontBody - 1,
    color: colors.muted,
    lineHeight: 20
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: spacing.radiusSm,
    alignItems: 'center'
  },
  editButtonText: {
    color: '#fff',
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody
  },
  deleteButton: {
    flex: 1,
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: spacing.radiusSm,
    alignItems: 'center'
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody
  },
  statsSection: {
    marginBottom: 20
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12
  },
  statCardWrapper: {
    flex: 1,
    ...shadows.md
  },
  statCard: {
    flex: 1,
    padding: spacing.card + 4,
    borderRadius: border.radiusLg,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 100
  },
  statContent: {
    flex: 1,
    marginRight: 8
  },
  statValue: {
    fontSize: typography.fontSubtitle + 4,
    fontWeight: typography.weightBold,
    marginBottom: 4,
    flexShrink: 1
  },
  statLabel: {
    fontSize: typography.fontBody - 1,
    color: colors.textLight,
    fontWeight: typography.weightSemibold,
    flexWrap: 'wrap'
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  statIcon: {
    fontSize: 24
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
    color: '#fff',
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
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight
  },
  infoLabel: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
    marginBottom: 4
  },
  infoValue: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightSemibold
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
    color: '#fff',
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
    color: '#fff',
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
  sectionHeader: {
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
