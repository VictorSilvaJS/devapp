import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutAnimation, Platform, UIManager } from 'react-native';
import Header from '../components/Header';
import { Produtor, Visita } from '../api/mock';
import { colors, typography, spacing } from '../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutorScreen({ route, navigation }) {
  const [produtor, setProdutor] = useState(null);
  const [visitas, setVisitas] = useState([]);

  useEffect(() => {
    const id = route?.params?.id;
    const load = async () => {
      if (id) {
            const p = await Produtor.get(id);
            const v = await Visita.filter({ produtor_id: id });
            // animar mudanças locais
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setProdutor(p);
            setVisitas(v);
      }
    };
    load();
  }, [route?.params?.id]);

  if (!produtor) return (
    <View style={{flex:1}}><Header title="Produtor" /><Text style={{padding:16}}>Selecione um produtor</Text></View>
  );

  return (
    <View style={styles.container}>
      <Header title={produtor.nome} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{produtor.fazenda}</Text>
          <Text style={styles.meta}>{produtor.cidade}, {produtor.estado}</Text>
          <Text style={styles.body}>Área: {produtor.area_total} ha</Text>
        </View>

        <View style={{marginTop:12}}>
          <Text style={styles.sectionTitle}>Histórico de Visitas</Text>
          {visitas.length === 0 && <Text style={styles.body}>Nenhuma visita registrada.</Text>}
          {visitas.map(v => (
            <View key={v.id} style={styles.cardSmall}>
              <Text style={styles.cardTitle}>{v.objetivo}</Text>
              <Text style={styles.meta}>{new Date(v.data_visita).toLocaleDateString()}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background },
  content: { padding: spacing.screen },
  card: { backgroundColor: colors.card, padding: spacing.card, borderRadius: 12 },
  title: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.text },
  body: { fontSize: typography.fontBody, color: colors.text, marginTop: 8 },
  meta: { color: colors.muted },
  sectionTitle: { fontSize: typography.fontBody + 2, fontWeight: typography.weightSemibold, marginBottom: 8, color: colors.text },
  cardSmall: { backgroundColor: colors.card, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#f0f7f0' },
  cardTitle: { fontSize: typography.fontBody + 1, fontWeight: typography.weightBold, color: colors.text }
});
