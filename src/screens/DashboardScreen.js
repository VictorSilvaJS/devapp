import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Header from '../components/Header';
import { Produtor, Visita, CadernoCampo } from '../api/mock';
import { colors, typography, spacing } from '../theme';
import StatCard from '../components/StatCard';

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
          <StatCard label="Total de Produtores" value={stats.produtores} />
          <StatCard label="Área Total (ha)" value={stats.areaTotal} />
        </View>
        <View style={styles.cardRow}>
          <StatCard label="Visitas Realizadas" value={stats.visitas} />
          <StatCard label="Registros no Campo" value={stats.registros} />
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
