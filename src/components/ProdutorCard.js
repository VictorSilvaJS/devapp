import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, border } from '../theme';

export default function ProdutorCard({ produtor, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.avatar}><Text style={styles.letter}>{produtor.nome.charAt(0).toUpperCase()}</Text></View>
      <View style={styles.info}>
        <Text style={styles.nome} numberOfLines={1}>{produtor.nome}</Text>
        <Text style={styles.fazenda} numberOfLines={1}>{produtor.fazenda}</Text>
        <Text style={styles.meta} numberOfLines={1}>{produtor.cidade}, {produtor.estado} • {produtor.area_total} ha</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    padding: spacing.card,
    borderRadius: border.radius,
    alignItems: 'center',
    marginBottom: spacing.gap,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  letter: { color: '#fff', fontWeight: typography.weightBold, fontSize: 20 },
  info: { flex: 1 },
  nome: { fontSize: typography.fontBody + 2, fontWeight: typography.weightBold, color: colors.text },
  fazenda: { color: colors.muted },
  meta: { color: colors.muted, marginTop: 4 }
});
