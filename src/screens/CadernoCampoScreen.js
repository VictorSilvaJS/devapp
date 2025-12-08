import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager, RefreshControl } from 'react-native';
import Header from '../components/Header';
import { CadernoCampo, Produtor } from '../api/mock';
import { colors, typography, spacing, shadows } from '../theme';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CadernoCampoScreen() {
  const [registros, setRegistros] = useState([]);
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);
  
  const load = async () => {
    const r = await CadernoCampo.list();
    const p = await Produtor.list();
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
    setRegistros(r);
    setProdutores(p);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const getProd = (id) => produtores.find(x => x.id === id) || {};

  return (
    <View style={styles.container}>
      <Header title="Caderno de Campo" />
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
        {registros.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📋 Nenhum registro ainda</Text>
            <Text style={styles.emptySubtext}>Os registros de campo aparecerão aqui</Text>
          </View>
        ) : (
          registros.map(reg => (
            <View key={reg.id} style={styles.card}>
              <Text style={styles.cardTitle}>{getProd(reg.produtor_id).nome || 'Produtor'}</Text>
              <Text style={styles.meta}>{reg.tipo_atividade} • {reg.talhao}</Text>
              <Text style={styles.body}>{new Date(reg.data_atividade).toLocaleDateString()}</Text>
            </View>
          ))
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
    padding: spacing.screen 
  },
  card: { 
    backgroundColor: colors.card, 
    padding: spacing.card + 4, 
    borderRadius: 14, 
    marginBottom: spacing.gap,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sm
  },
  cardTitle: { 
    fontSize: typography.fontBody + 2, 
    fontWeight: typography.weightBold, 
    color: colors.text 
  },
  meta: { 
    color: colors.textLight, 
    marginTop: 6,
    fontSize: typography.fontBody - 1
  },
  body: { 
    color: colors.muted, 
    marginTop: 4,
    fontSize: typography.fontCaption + 1
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.screen * 3
  },
  emptyText: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 8
  },
  emptySubtext: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center'
  }
});
