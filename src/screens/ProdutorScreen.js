import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutAnimation, Platform, UIManager, TouchableOpacity, Alert } from 'react-native';
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

  const loadData = async (id) => {
    if (id) {
      const p = await Produtor.get(id);
      const v = await Visita.filter({ produtor_id: id });
      // animar mudanças locais
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setProdutor(p);
      setVisitas(v);
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

  if (!produtor) return (
    <View style={{flex:1}}><Header title="Produtor" /><Text style={{padding:16}}>Selecione um produtor</Text></View>
  );

  return (
    <View style={styles.container}>
      <Header title={produtor.nome} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{produtor.fazenda}</Text>
              <Text style={styles.meta}>{produtor.cidade}, {produtor.estado}</Text>
              <Text style={styles.body}>Área: {produtor.area_total} ha</Text>
              {produtor.cultura_atual && (
                <Text style={styles.body}>Cultura: {produtor.cultura_atual}</Text>
              )}
            </View>
          </View>
          
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Text style={styles.editButtonText}>✏️ Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.deleteButtonText}>🗑️ Excluir</Text>
            </TouchableOpacity>
          </View>
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
  cardHeader: { flexDirection: 'row', marginBottom: 12 },
  title: { fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, color: colors.text },
  body: { fontSize: typography.fontBody, color: colors.text, marginTop: 8 },
  meta: { color: colors.muted, marginTop: 4 },
  sectionTitle: { fontSize: typography.fontBody + 2, fontWeight: typography.weightSemibold, marginBottom: 8, color: colors.text },
  cardSmall: { backgroundColor: colors.card, padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#f0f7f0' },
  cardTitle: { fontSize: typography.fontBody + 1, fontWeight: typography.weightBold, color: colors.text },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
  }
});
