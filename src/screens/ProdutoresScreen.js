import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, RefreshControl } from 'react-native';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing, shadows } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

// enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ProdutoresScreen() {
  const [produtores, setProdutores] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();

  useEffect(() => { load(); }, []);
  
  const load = async () => {
    const data = await Produtor.list();
    // animação local ao atualizar lista
    try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch(e) {}
    setProdutores(data);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header title="Produtores" />
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
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('NovoProdutor')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.buttonText}>+ Novo Produtor</Text>
          </LinearGradient>
        </TouchableOpacity>

        {produtores.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Nenhum produtor cadastrado</Text>
            <Text style={styles.emptySubtext}>Clique no botão acima para adicionar</Text>
          </View>
        ) : (
          produtores.map(p => (
            <ProdutorCard key={p.id} produtor={p} onPress={() => navigation.navigate('ProdutorDetail', { id: p.id })} />
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
  button: { 
    borderRadius: 14, 
    marginBottom: spacing.gap + 4,
    overflow: 'hidden',
    ...shadows.md
  },
  buttonGradient: {
    padding: 16,
    alignItems: 'center'
  },
  buttonText: { 
    color: '#fff', 
    fontWeight: typography.weightBold,
    fontSize: typography.fontBody + 1
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
    color: colors.muted
  }
});
