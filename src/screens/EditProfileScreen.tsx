import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { colors, typography, spacing } from '../theme';
import { normalizeNome } from '../domain';

export default function EditProfileScreen({ navigation }) {
  const { user } = useAuthState();
  const { updateProfile } = useAuthActions();
  const toast = useToast();
  const perfil = user?.perfil;
  const [form, setForm] = useState({
    nome: normalizeNome(user || {}),
    regiao: user?.regiao || '',
    produtor_id: user?.produtor_id || '',
  });

  const handleSave = async () => {
    try {
      await updateProfile(form);
      toast.showSuccess('Perfil atualizado');
      navigation.goBack();
    } catch (err) {
      toast.showError('Não foi possível atualizar o perfil');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Editar Perfil" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={form.nome} onChangeText={(t)=>setForm(s=>({...s,nome:t}))} />

        {perfil === 'colaborador' && (
          <>
            <Text style={styles.label}>Região</Text>
            <TextInput style={styles.input} value={form.regiao} onChangeText={(t)=>setForm(s=>({...s,regiao:t}))} />
          </>
        )}

        {perfil === 'produtor' && (
          <>
            <Text style={styles.label}>Vínculo técnico do produtor</Text>
            <TextInput style={styles.input} value={form.produtor_id} onChangeText={(t)=>setForm(s=>({...s,produtor_id:t}))} />
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={handleSave}>
          <Text style={styles.buttonText}>Salvar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background },
  content: { padding: spacing.screen },
  label: { color: colors.muted, marginTop: 8 },
  input: { backgroundColor: colors.card, padding: 10, borderRadius: spacing.radiusSm, marginTop: 6, borderWidth:1, borderColor: colors.borderLight },
  button: { backgroundColor: colors.primary, padding:12, borderRadius: spacing.radius, marginTop: 20, alignItems:'center' },
  buttonText: { color: colors.white, fontWeight: typography.weightSemibold }
});
