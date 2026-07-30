import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import { useAuthState, useAuthActions } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { colors, spacing } from '../theme';
import { normalizeNome } from '../domain';

export default function EditProfileScreen({ navigation }) {
  const { user } = useAuthState();
  const { updateProfile } = useAuthActions();
  const toast = useToast();
  const perfil = user?.perfil;
  const [form, setForm] = useState({
    nome: normalizeNome(user || {}),
  });

  const handleSave = async () => {
    try {
      await updateProfile(form);
      toast.showSuccess('Dados atualizados');
      navigation.goBack();
    } catch (err) {
      toast.showError('Não foi possível atualizar o perfil');
    }
  };

  if (perfil === 'produtor') {
    return (
      <View style={styles.container}>
        <Header title="Dados cadastrais" showBack />
        <ScrollView contentContainerStyle={styles.content}>
          <InfoBox
            variant="warning"
            message="Para alterar seus dados cadastrais, solicite atualização ao administrador ou colaborador responsável."
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Editar dados" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <SectionCard title="Dados cadastrais" icon="person-circle-outline">
          <FormField
            label="Nome completo"
            value={form.nome}
            onChangeText={(t) => setForm((s) => ({ ...s, nome: t }))}
            leftIcon="person-outline"
          />

          {perfil === 'colaborador' && (
            <InfoBox
              variant="warning"
              message="Regional, Área operacional e Propriedades atribuídas são vínculos administrativos. Consulte seu escopo no Perfil e solicite correção ao administrador responsável."
            />
          )}
        </SectionCard>
      </ScrollView>
      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        cancelLabel="Cancelar"
        submitLabel="Salvar"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: colors.background },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl,
  },
});
