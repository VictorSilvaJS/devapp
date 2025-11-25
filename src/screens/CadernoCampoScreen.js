import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Header from '../components/Header';
import { CadernoCampo, Produtor } from '../api/mock';
import { colors, typography, spacing } from '../theme';

export default function CadernoCampoScreen() {
  const [registros, setRegistros] = useState([]);
  const [produtores, setProdutores] = useState([]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const r = await CadernoCampo.list();
    const p = await Produtor.list();
    setRegistros(r);
    setProdutores(p);
  };

  const getProd = (id) => produtores.find(x => x.id === id) || {};

  return (
    <View style={styles.container}>
      <Header title="Caderno de Campo" />
      <ScrollView contentContainerStyle={styles.content}>
        {registros.map(reg => (
          <View key={reg.id} style={styles.card}>
            <Text style={styles.cardTitle}>{getProd(reg.produtor_id).nome || 'Produtor'}</Text>
            <Text style={styles.meta}>{reg.tipo_atividade} • {reg.talhao}</Text>
            <Text style={styles.body}>{new Date(reg.data_atividade).toLocaleDateString()}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background },
  content: { padding: spacing.screen },
  card: { backgroundColor: colors.card, padding: spacing.card, borderRadius: 12, marginBottom: spacing.gap },
  cardTitle: { fontSize: typography.fontBody + 1, fontWeight: typography.weightBold, color: colors.text },
  meta: { color: colors.muted, marginTop: 4 },
  body: { color: colors.text, marginTop: 6 }
});
