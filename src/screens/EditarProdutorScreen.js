import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import Header from '../components/Header';
import { Produtor } from '../api/mock';
import { colors, typography, spacing } from '../theme';

export default function EditarProdutorScreen({ route, navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome: '',
    fazenda: '',
    area_total: '',
    cultura_atual: '',
    cidade: '',
    estado: '',
    status: 'ativo'
  });

  useEffect(() => {
    const loadProdutor = async () => {
      const id = route?.params?.id;
      if (!id) {
        Alert.alert('Erro', 'ID do produtor não fornecido');
        navigation.goBack();
        return;
      }

      try {
        setLoading(true);
        const produtor = await Produtor.get(id);
        setForm({
          nome: produtor.nome || '',
          fazenda: produtor.fazenda || '',
          area_total: String(produtor.area_total || ''),
          cultura_atual: produtor.cultura_atual || '',
          cidade: produtor.cidade || '',
          estado: produtor.estado || '',
          status: produtor.status || 'ativo'
        });
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível carregar os dados do produtor');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadProdutor();
  }, [route?.params?.id]);

  const handleSave = async () => {
    // Validações básicas
    if (!form.nome.trim()) {
      Alert.alert('Atenção', 'O nome é obrigatório');
      return;
    }
    if (!form.fazenda.trim()) {
      Alert.alert('Atenção', 'O nome da fazenda é obrigatório');
      return;
    }
    if (!form.area_total || isNaN(parseFloat(form.area_total))) {
      Alert.alert('Atenção', 'Informe uma área válida');
      return;
    }

    try {
      setSaving(true);
      // Simular atualização (adicionar método update na API mock posteriormente)
      await Produtor.update(route.params.id, {
        ...form,
        area_total: parseFloat(form.area_total)
      });
      
      Alert.alert('Sucesso', 'Produtor atualizado com sucesso', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancelar Edição',
      'Deseja descartar as alterações?',
      [
        { text: 'Não', style: 'cancel' },
        { text: 'Sim', onPress: () => navigation.goBack() }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Produtor" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Editar Produtor" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados Básicos</Text>
          
          <Text style={styles.label}>Nome do Produtor *</Text>
          <TextInput
            style={styles.input}
            value={form.nome}
            onChangeText={(text) => setForm(s => ({ ...s, nome: text }))}
            placeholder="Nome completo"
            placeholderTextColor={colors.mutedLight}
          />

          <Text style={styles.label}>Fazenda *</Text>
          <TextInput
            style={styles.input}
            value={form.fazenda}
            onChangeText={(text) => setForm(s => ({ ...s, fazenda: text }))}
            placeholder="Nome da fazenda"
            placeholderTextColor={colors.mutedLight}
          />

          <Text style={styles.label}>Área Total (ha) *</Text>
          <TextInput
            style={styles.input}
            value={form.area_total}
            onChangeText={(text) => setForm(s => ({ ...s, area_total: text }))}
            placeholder="Ex: 850"
            keyboardType="numeric"
            placeholderTextColor={colors.mutedLight}
          />

          <Text style={styles.label}>Cultura Atual</Text>
          <TextInput
            style={styles.input}
            value={form.cultura_atual}
            onChangeText={(text) => setForm(s => ({ ...s, cultura_atual: text }))}
            placeholder="Ex: Soja"
            placeholderTextColor={colors.mutedLight}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localização</Text>
          
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            value={form.cidade}
            onChangeText={(text) => setForm(s => ({ ...s, cidade: text }))}
            placeholder="Nome da cidade"
            placeholderTextColor={colors.mutedLight}
          />

          <Text style={styles.label}>Estado</Text>
          <TextInput
            style={styles.input}
            value={form.estado}
            onChangeText={(text) => setForm(s => ({ ...s, estado: text.toUpperCase() }))}
            placeholder="UF (Ex: RS)"
            maxLength={2}
            autoCapitalize="characters"
            placeholderTextColor={colors.mutedLight}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status</Text>
          
          <View style={styles.statusContainer}>
            <TouchableOpacity
              style={[
                styles.statusButton,
                form.status === 'ativo' && styles.statusButtonActive
              ]}
              onPress={() => setForm(s => ({ ...s, status: 'ativo' }))}
            >
              <Text style={[
                styles.statusButtonText,
                form.status === 'ativo' && styles.statusButtonTextActive
              ]}>
                Ativo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statusButton,
                form.status === 'pendente' && styles.statusButtonActive
              ]}
              onPress={() => setForm(s => ({ ...s, status: 'pendente' }))}
            >
              <Text style={[
                styles.statusButtonText,
                form.status === 'pendente' && styles.statusButtonTextActive
              ]}>
                Pendente
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.buttonSecondaryText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>Salvar Alterações</Text>
            )}
          </TouchableOpacity>
        </View>
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
    padding: spacing.screen,
    paddingBottom: 32
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontSize: typography.fontBody
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: 16
  },
  label: {
    color: colors.muted,
    fontSize: typography.fontBody,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: typography.weightSemibold
  },
  input: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: spacing.radiusSm,
    fontSize: typography.fontBody,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderLight
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 12
  },
  statusButton: {
    flex: 1,
    padding: 12,
    borderRadius: spacing.radiusSm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center'
  },
  statusButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  statusButtonText: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.muted
  },
  statusButtonTextActive: {
    color: '#fff'
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24
  },
  button: {
    flex: 1,
    padding: 14,
    borderRadius: spacing.radius,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buttonPrimary: {
    backgroundColor: colors.primary
  },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold
  }
});
