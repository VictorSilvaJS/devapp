import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import Header from '../components/Header';
import ProdutorCard from '../components/ProdutorCard';
import { Produtor } from '../api/mock';
import { useNavigation } from '@react-navigation/native';
import { colors, typography, spacing } from '../theme';

export default function ProdutoresScreen() {
  const [produtores, setProdutores] = useState([]);
  const navigation = useNavigation();

  useEffect(() => { load(); }, []);
  const load = async () => {
    const data = await Produtor.list();
    setProdutores(data);
  };

  return (
    <View style={styles.container}>
      <Header title="Produtores" />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('NovoProdutor')}>
          <Text style={styles.buttonText}>+ Novo Produtor</Text>
        </TouchableOpacity>

        {produtores.map(p => (
          <ProdutorCard key={p.id} produtor={p} onPress={() => navigation.navigate('ProdutorDetail', { id: p.id })} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screen },
  button: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, marginBottom: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: typography.weightBold }
});
