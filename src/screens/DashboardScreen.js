import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Header from '../components/Header';
import { Produtor, Visita, CadernoCampo } from '../api/mock';
import { colors, typography, spacing } from '../theme';

export default function DashboardScreen() {
  const [stats, setStats] = useState({ produtores: 0, visitas: 0, registros: 0, areaTotal: 0 });

  useEffect(() => {
    const load = async () => {
      const produtores = await Produtor.list();
      const visitas = await Visita.list();
      const registros = await CadernoCampo.list();
      const area = produtores.reduce((s, p) => s + (p.area_total || 0), 0);
      setStats({ produtores: produtores.length, visitas: visitas.length, registros: registros.length, areaTotal: area });
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <Header title="Dashboard" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.cardRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.produtores}</Text><Text style={styles.statLabel}>Produtores</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.areaTotal}</Text><Text style={styles.statLabel}>Área (ha)</Text></View>
        </View>
        <View style={styles.cardRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.visitas}</Text><Text style={styles.statLabel}>Visitas</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{stats.registros}</Text><Text style={styles.statLabel}>Registros</Text></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screen },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.gap },
  statCard: { flex: 1, backgroundColor: colors.card, padding: spacing.card, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
  statValue: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.primary },
  statLabel: { fontSize: typography.fontBody, color: colors.muted, marginTop: 4 }
});
