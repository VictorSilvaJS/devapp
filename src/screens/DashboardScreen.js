import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Produtor, Visita, CadernoCampo } from '../api/mock';
import { colors, typography, spacing } from '../theme';
import StatCard from '../components/StatCard';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function DashboardScreen() {
  const [stats, setStats] = useState({ produtores: 0, visitas: 0, registros: 0, areaTotal: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    console.log('[DashboardScreen] mounted');
    load();
    return () => console.log('[DashboardScreen] unmounted');
  }, []);

  const load = async () => {
    const produtores = await Produtor.list();
    const visitas = await Visita.list();
    const registros = await CadernoCampo.list();
    const area = produtores.reduce((s, p) => s + (p.area_total || 0), 0);
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (e) {}
    setStats({ produtores: produtores.length, visitas: visitas.length, registros: registros.length, areaTotal: area });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header title="Dashboard" />
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
        <Text style={styles.welcomeText}>Bem-vindo ao Tchê Agro 🌾</Text>
        <Text style={styles.subtitle}>Acompanhe suas estatísticas</Text>

        <View style={styles.cardRow}>
          <StatCard 
            label="Produtores" 
            value={stats.produtores}
            accent={{
              gradient: ['#FFFFFF', colors.accent],
              color: colors.primary,
              bgColor: colors.accentDark
            }}
            icon={<Ionicons name="people" size={24} color={colors.primary} />}
          />
          <StatCard 
            label="Área Total (ha)" 
            value={stats.areaTotal}
            accent={{
              gradient: ['#FFFFFF', colors.accent],
              color: colors.secondary,
              bgColor: colors.secondaryLight
            }}
            icon={<Ionicons name="map" size={24} color={colors.secondary} />}
          />
        </View>
        <View style={styles.cardRow}>
          <StatCard 
            label="Visitas" 
            value={stats.visitas}
            accent={{
              gradient: ['#FFFFFF', colors.accent],
              color: colors.success,
              bgColor: colors.successLight
            }}
            icon={<Ionicons name="calendar" size={24} color={colors.success} />}
          />
          <StatCard 
            label="Registros" 
            value={stats.registros}
            accent={{
              gradient: ['#FFFFFF', colors.accent],
              color: colors.warning,
              bgColor: colors.warningLight
            }}
            icon={<Ionicons name="book" size={24} color={colors.warning} />}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  welcomeText: {
    fontSize: typography.fontTitle - 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 4
  },
  subtitle: {
    fontSize: typography.fontBody,
    color: colors.textLight,
    marginBottom: spacing.gap * 2
  },
  content: { padding: spacing.screen },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.gap },
  statCard: { flex: 1, backgroundColor: colors.card, padding: spacing.card, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
  statValue: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.primary },
  statLabel: { fontSize: typography.fontBody, color: colors.muted, marginTop: 4 }
});
