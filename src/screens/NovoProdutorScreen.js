import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Header from '../components/Header';
import { Produtor } from '../api/mock';
import { colors, typography, spacing } from '../theme';

export default function NovoProdutorScreen({ navigation }) {
  const [form, setForm] = useState({ nome:'', fazenda:'', area_total:'' });

  const handleSave = async () => {
    if (!form.nome || !form.fazenda || !form.area_total) return Alert.alert('Preencha os campos');
    await Produtor.create({ ...form, area_total: parseFloat(form.area_total), status: 'ativo' });
    navigation.navigate('Produtores');
  };

  return (
    <View style={styles.container}>
      <Header title="Novo Produtor" />
      <View style={styles.content}>
        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} value={form.nome} onChangeText={(t)=>setForm(s=>({...s,nome:t}))} />
        <Text style={styles.label}>Fazenda</Text>
        <TextInput style={styles.input} value={form.fazenda} onChangeText={(t)=>setForm(s=>({...s,fazenda:t}))} />
        <Text style={styles.label}>Área (ha)</Text>
        <TextInput keyboardType='numeric' style={styles.input} value={form.area_total} onChangeText={(t)=>setForm(s=>({...s,area_total:t}))} />
        <TouchableOpacity style={styles.button} onPress={handleSave}><Text style={styles.buttonText}>Salvar Produtor</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background },
  content: { padding: spacing.screen },
  label: { color: colors.muted, marginTop: 8, fontSize: typography.fontBody },
  input: { backgroundColor: colors.card, padding:10, borderRadius:8, marginTop:6, borderWidth:1, borderColor:'#f0f7f0' },
  button: { backgroundColor: colors.primary, padding:12, borderRadius:10, marginTop:16, alignItems:'center' },
  buttonText: { color:'#fff', fontWeight: typography.weightBold }
});
