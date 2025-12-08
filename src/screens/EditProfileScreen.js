import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { colors, typography, spacing } from '../theme';

export default function EditProfileScreen({ navigation }) {
  const { user } = useAuthState();
  const { updateProfile } = useAuthActions();
  const [form, setForm] = useState({ full_name: user?.full_name || '', regiao: user?.regiao || '', produtor_id: user?.produtor_id || '' });

  const handleSave = async () => {
    try {
      await updateProfile(form);
      Alert.alert('Sucesso', 'Perfil atualizado');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível atualizar o perfil');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Nome completo</Text>
      <TextInput style={styles.input} value={form.full_name} onChangeText={(t)=>setForm(s=>({...s,full_name:t}))} />

      <Text style={styles.label}>Região</Text>
      <TextInput style={styles.input} value={form.regiao} onChangeText={(t)=>setForm(s=>({...s,regiao:t}))} />

      <Text style={styles.label}>Produtor ID</Text>
      <TextInput style={styles.input} value={form.produtor_id} onChangeText={(t)=>setForm(s=>({...s,produtor_id:t}))} />

      <TouchableOpacity style={styles.button} onPress={handleSave}>
        <Text style={styles.buttonText}>Salvar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background, padding: spacing.screen },
  label: { color: colors.muted, marginTop: 8 },
  input: { backgroundColor: colors.card, padding: 10, borderRadius: 8, marginTop: 6, borderWidth:1, borderColor:'#f0f7f0' },
  button: { backgroundColor: colors.primary, padding:12, borderRadius: 10, marginTop: 20, alignItems:'center' },
  buttonText: { color:'#fff', fontWeight: typography.weightSemibold }
});
