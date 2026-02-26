import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager, RefreshControl, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Produtor, Visita, CadernoCampo } from '../api/mock';
import { colors, typography, spacing, border, shadows } from '../theme';
import StatCard from '../components/StatCard';
import { useAuthState } from '../auth/AuthContext';
import { useFiltros } from '../contexts/FiltroContext';
import FiltroRegional from '../components/FiltroRegional';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DashboardScreen() {
  const { user } = useAuthState();
  const { filtrarProdutores, getProdutorIdsFiltrados, getFiltroAtivo } = useFiltros();
  const [stats, setStats] = useState({ produtores: 0, visitas: 0, registros: 0, areaTotal: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [clima] = useState({ temperatura: '25°C', condicao: 'Ensolarado' });
  const [cidade, setCidade] = useState('Região Sul');

  useEffect(() => {
    console.log('[DashboardScreen] mounted');
    if (user) {
      loadData();
    }
    return () => console.log('[DashboardScreen] unmounted');
  }, [user]);

  // Recarregar dados quando filtros mudarem (apenas para admin)
  const { filtros } = useFiltros();
  useEffect(() => {
    if (user?.perfil === 'admin' && !isLoading) {
      loadData();
    }
  }, [filtros, user?.perfil]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      let produtores = [];
      let visitas = [];
      let registros = [];

      // ADMIN - Acesso total com filtros
      if (user?.perfil === 'admin') {
        const todosProdutores = await Produtor.list();
        const todasVisitas = await Visita.list();
        const todosRegistros = await CadernoCampo.list();
        
        // Aplicar filtros de região/fazenda
        produtores = filtrarProdutores(todosProdutores);
        
        // Obter IDs dos produtores filtrados
        const produtorIdsFiltrados = produtores.map(p => p.id);
        
        // Filtrar visitas e registros baseado nos produtores filtrados
        visitas = todasVisitas.filter(v => produtorIdsFiltrados.includes(v.produtor_id));
        registros = todosRegistros.filter(r => produtorIdsFiltrados.includes(r.produtor_id));
        
        // Atualizar texto de localização
        setCidade(getFiltroAtivo());
      } 
      // COLABORADOR - Acesso à sua região/sub-regiões
      else if (user?.perfil === 'colaborador') {
        if (user.regiao) {
          const todosProdutores = await Produtor.list();
          // Filtrar produtores por região principal OU microregião nas sub_regiões
          produtores = todosProdutores.filter(p => {
            if (p.regiao === user.regiao) return true;
            if (user.sub_regioes && p.microregiao) {
              return user.sub_regioes.includes(p.microregiao);
            }
            return false;
          });
          const idsRegiao = produtores.map(p => p.id);
          
          const todasVisitas = await Visita.list();
          visitas = todasVisitas.filter(v => idsRegiao.includes(v.produtor_id));
          
          const todosRegistros = await CadernoCampo.list();
          registros = todosRegistros.filter(r => idsRegiao.includes(r.produtor_id));
          
          setCidade(user.regiao || 'Região não definida');
        } else {
          setCidade('Região não definida');
        }
      } 
      // CLIENTE/PRODUTOR/PROPRIETÁRIO - Acesso apenas à sua propriedade
      else if (user?.perfil === 'produtor') {
        if (user.produtor_id) {
          try {
            // Buscar todas as fazendas do proprietário (relação 1:N)
            const todosProdutores = await Produtor.list();
            produtores = todosProdutores.filter(p => 
              p.proprietario_id === user.produtor_id || p.id === user.produtor_id
            );
            if (produtores.length > 0) {
              const primeiraProp = produtores[0];
              setCidade(`${primeiraProp.cidade || 'Cidade'}, ${primeiraProp.estado || 'Estado'}`);
            } else {
              setCidade('Propriedade não encontrada');
            }
            
            // IDs de todas as fazendas do proprietário
            const meusIds = produtores.map(p => p.id);
            
            // Filtrar visitas das fazendas do proprietário
            const todasVisitas = await Visita.list();
            visitas = todasVisitas.filter(v => meusIds.includes(v.produtor_id));
            
            // Filtrar registros que são visíveis para o proprietário
            const todosRegistros = await CadernoCampo.list();
            registros = todosRegistros.filter(r => 
              meusIds.includes(r.produtor_id) && r.visivel_para_produtor === true
            );
          } catch (error) {
            console.error('Erro ao carregar dados do produtor:', error);
            setCidade('Propriedade não encontrada');
          }
        } else {
          console.warn('Produtor sem produtor_id associado');
          setCidade('Aguardando vinculação');
        }
      }

      const areaTotal = produtores.reduce((sum, p) => sum + (p.area_total || 0), 0);
      
      // Formata área para exibição compacta
      const formatarArea = (area) => {
        if (area >= 1000) {
          return `${(area / 1000).toFixed(1)}k ha`;
        }
        return `${area.toFixed(1)} ha`;
      };
      
      try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (e) {}
      setStats({
        produtores: produtores.length,
        visitas: visitas.length,
        registros: registros.length,
        areaTotal: formatarArea(areaTotal),
      });
    } catch (error) {
      console.error('Erro ao carregar dados do Dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getCardsPrincipais = useMemo(() => {
    if (user?.perfil === 'admin') {
      return [
        {
          label: 'Total de Produtores',
          value: stats.produtores,
          icon: <Ionicons name="people-outline" size={24} color={colors.primary} />,
          accent: {
            color: colors.primary,
            bgColor: '#e8f5e8',
            gradient: ['#e8f5e8', '#FFFFFF']
          },
        },
        {
          label: 'Área Total',
          value: stats.areaTotal,
          icon: <Ionicons name="leaf-outline" size={24} color="#8B6244" />,
          accent: {
            color: '#8B6244',
            bgColor: '#f5f3f0',
            gradient: ['#f5f3f0', '#FFFFFF']
          },
        },
        {
          label: 'Visitas Realizadas',
          value: stats.visitas,
          icon: <Ionicons name="calendar-outline" size={24} color={colors.success} />,
          accent: {
            color: colors.success,
            bgColor: '#d1fae5',
            gradient: ['#d1fae5', '#FFFFFF']
          },
        },
        {
          label: 'Registros no Campo',
          value: stats.registros,
          icon: <Ionicons name="book-outline" size={24} color={colors.warning} />,
          accent: {
            color: colors.warning,
            bgColor: '#fef3c7',
            gradient: ['#fef3c7', '#FFFFFF']
          },
        },
      ];
    } else if (user?.perfil === 'colaborador') {
      return [
        {
          label: 'Meus Produtores',
          value: stats.produtores,
          icon: <Ionicons name="people-outline" size={24} color={colors.primary} />,
          accent: {
            color: colors.primary,
            bgColor: '#e8f5e8',
            gradient: ['#e8f5e8', '#FFFFFF']
          },
        },
        {
          label: 'Área Gerenciada',
          value: stats.areaTotal,
          icon: <Ionicons name="leaf-outline" size={24} color="#8B6244" />,
          accent: {
            color: '#8B6244',
            bgColor: '#f5f3f0',
            gradient: ['#f5f3f0', '#FFFFFF']
          },
        },
        {
          label: 'Minhas Visitas',
          value: stats.visitas,
          icon: <Ionicons name="calendar-outline" size={24} color={colors.success} />,
          accent: {
            color: colors.success,
            bgColor: '#d1fae5',
            gradient: ['#d1fae5', '#FFFFFF']
          },
        },
        {
          label: 'Meus Registros',
          value: stats.registros,
          icon: <Ionicons name="book-outline" size={24} color={colors.warning} />,
          accent: {
            color: colors.warning,
            bgColor: '#fef3c7',
            gradient: ['#fef3c7', '#FFFFFF']
          },
        },
      ];
    } else {
      // Produtor / Proprietário
      return [
        {
          label: 'Minhas Fazendas',
          value: stats.produtores,
          icon: <Ionicons name="business-outline" size={24} color={colors.primary} />,
          accent: {
            color: colors.primary,
            bgColor: '#e8f5e8',
            gradient: ['#e8f5e8', '#FFFFFF']
          },
        },
        {
          label: 'Minha Área Total',
          value: stats.areaTotal,
          icon: <Ionicons name="leaf-outline" size={24} color="#8B6244" />,
          accent: {
            color: '#8B6244',
            bgColor: '#f5f3f0',
            gradient: ['#f5f3f0', '#FFFFFF']
          },
        },
        {
          label: 'Visitas Técnicas',
          value: stats.visitas,
          icon: <Ionicons name="calendar-outline" size={24} color={colors.success} />,
          accent: {
            color: colors.success,
            bgColor: '#d1fae5',
            gradient: ['#d1fae5', '#FFFFFF']
          },
        },
        {
          label: 'Registros Disponíveis',
          value: stats.registros,
          icon: <Ionicons name="book-outline" size={24} color={colors.warning} />,
          accent: {
            color: colors.warning,
            bgColor: '#fef3c7',
            gradient: ['#fef3c7', '#FFFFFF']
          },
        },
      ];
    }
  }, [user?.perfil, stats]);

  // Determinar se é proprietário/produtor
  const isProdutorPerfil = user?.perfil === 'produtor';

  return (
    <View style={styles.container}>
      <Header title="Dashboard" />
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando dados...</Text>
        </View>
      ) : (
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
          {/* Cabeçalho */}
          <View style={styles.headerSection}>
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText} numberOfLines={1}>
                Olá, {user?.full_name?.split(' ')[0] || 'Usuário'}!
              </Text>
            </View>
            <Text style={styles.subtitle} numberOfLines={2}>
              {user?.perfil === 'admin' && 'Painel de Administração Geral'}
              {user?.perfil === 'colaborador' && 'Painel de Consultoria'}
              {user?.perfil === 'produtor' && 'Visão Geral das suas Propriedades'}
            </Text>

            {/* Filtros Regionais - apenas para Admin */}
            {user?.perfil === 'admin' && (
              <View style={styles.filtrosContainer}>
                <FiltroRegional />
              </View>
            )}

            {/* Cards de informação */}
            <View style={styles.infoCardsRow}>
              <View style={styles.infoCard}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <View style={styles.infoCardText}>
                  <Text style={styles.infoCardLabel}>Localização</Text>
                  <Text style={styles.infoCardValue} numberOfLines={2}>{cidade}</Text>
                </View>
              </View>

              <View style={styles.infoCard}>
                <Ionicons name="partly-sunny-outline" size={16} color={colors.secondary} />
                <View style={styles.infoCardText}>
                  <Text style={styles.infoCardLabel}>Clima</Text>
                  <Text style={styles.infoCardValue} numberOfLines={1}>
                    {clima.temperatura} - {clima.condicao}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Grade de cards dinâmica por perfil */}
          <View style={styles.statsGrid}>
            {getCardsPrincipais.map((card, index) => {
              // Para produtor/proprietário: layout especial
              const isProdutor = user?.perfil === 'produtor';
              const isLastCardForProdutor = isProdutor && index === getCardsPrincipais.length - 1 && getCardsPrincipais.length % 2 !== 0;
              
              return (
                <View 
                  key={card.label} 
                  style={[
                    styles.statCardWrapper,
                    isLastCardForProdutor ? styles.statCardFullWidth : styles.statCardTwoColumns
                  ]}
                >
                  <StatCard {...card} />
                </View>
              );
            })}
          </View>

          {/* Mensagem para produtores sem produtor vinculado */}
          {user?.perfil === 'produtor' && !user?.produtor_id && (
            <View style={styles.warningCard}>
              <Ionicons name="alert-circle-outline" size={48} color={colors.warning} />
              <Text style={styles.warningTitle}>Aguardando Vinculação</Text>
              <Text style={styles.warningText}>
                Sua conta está sendo configurada. Em breve você terá acesso aos dados da sua propriedade.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.screen,
  },
  loadingText: {
    marginTop: spacing.gap,
    fontSize: typography.fontBody,
    color: colors.textLight,
  },
  content: { 
    padding: spacing.screen,
    paddingBottom: spacing.screen + 80
  },
  headerSection: {
    marginBottom: spacing.gap * 2,
  },
  welcomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: typography.fontTitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  waveIcon: {
    marginLeft: 6,
    marginTop: 2,
  },
  subtitle: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    marginBottom: spacing.gap * 0.5,
  },
  filtrosContainer: {
    marginVertical: spacing.gap,
    marginHorizontal: -spacing.screen,
  },
  infoCardsRow: {
    flexDirection: 'row',
    gap: spacing.gap,
    marginTop: spacing.gap,
  },
  infoCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.card,
    borderRadius: border.radius,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  infoCardText: {
    marginLeft: 8,
    flex: 1,
  },
  infoCardLabel: {
    fontSize: typography.fontBody - 3,
    color: colors.textLight,
  },
  infoCardValue: {
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCardWrapper: {
    marginBottom: spacing.gap,
  },
  statCardTwoColumns: {
    width: '50%',
  },
  statCardFullWidth: {
    width: '100%',
    paddingHorizontal: '25%',
  },
  warningCard: {
    backgroundColor: colors.warningLight + '30',
    borderWidth: 2,
    borderColor: colors.warning,
    borderRadius: border.radius,
    padding: spacing.card * 1.5,
    alignItems: 'center',
    marginTop: spacing.gap,
    ...shadows.sm,
  },
  warningTitle: {
    fontSize: typography.fontSubtitle - 2,
    fontWeight: typography.weightBold,
    color: colors.warning,
    marginTop: spacing.gap,
    marginBottom: 4,
  },
  warningText: {
    fontSize: typography.fontBody,
    color: colors.text,
    textAlign: 'center',
  },
});
