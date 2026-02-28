import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Produtor } from '../api/mock';
import theme from '../theme';
import { 
  validarNome, 
  validarArea, 
  validarUF, 
  validarObrigatorio
} from '../utils/validacoes';

export default function EditarProdutorScreen({ route, navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    nome: '',
    fazenda: '',
    area_total: '',
    cultura_atual: '',
    cidade: '',
    estado: ''
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    
    // Limpa erro do campo quando o usuário começa a digitar
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!validarNome(form.nome)) {
      newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    }
    if (!validarObrigatorio(form.fazenda)) {
      newErrors.fazenda = 'Fazenda é obrigatória';
    }
    if (!validarArea(form.area_total)) {
      newErrors.area_total = 'Informe uma área válida';
    }
    if (form.estado && !validarUF(form.estado)) {
      newErrors.estado = 'UF inválida (Ex: RS, SP)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

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
          estado: produtor.estado || ''
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
    if (!validateForm()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios corretamente');
      return;
    }

    try {
      setSaving(true);
      await Produtor.update(route.params.id, {
        ...form,
        area_total: parseFloat(form.area_total)
      });
      
      Alert.alert('Sucesso', 'Produtor atualizado com sucesso!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar as alterações. Tente novamente.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Produtor" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Editar Produtor" showBackButton />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Atualize os dados do produtor
          </Text>
        </View>

        {/* Nome */}
        <View style={styles.field}>
          <Text style={styles.label}>Nome do Produtor *</Text>
          <TextInput
            style={[styles.input, errors.nome && styles.inputError]}
            value={form.nome}
            onChangeText={(text) => handleChange('nome', text)}
            placeholder="Digite o nome completo"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.nome && (
            <Text style={styles.errorText}>{errors.nome}</Text>
          )}
        </View>

        {/* Fazenda */}
        <View style={styles.field}>
          <Text style={styles.label}>Fazenda *</Text>
          <TextInput
            style={[styles.input, errors.fazenda && styles.inputError]}
            value={form.fazenda}
            onChangeText={(text) => handleChange('fazenda', text)}
            placeholder="Nome da fazenda"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.fazenda && (
            <Text style={styles.errorText}>{errors.fazenda}</Text>
          )}
        </View>

        {/* Área Total */}
        <View style={styles.field}>
          <Text style={styles.label}>Área Total (ha) *</Text>
          <TextInput
            style={[styles.input, errors.area_total && styles.inputError]}
            value={form.area_total}
            onChangeText={(text) => handleChange('area_total', text)}
            placeholder="Ex: 500"
            keyboardType="numeric"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.area_total && (
            <Text style={styles.errorText}>{errors.area_total}</Text>
          )}
        </View>

        {/* Cultura Atual */}
        <View style={styles.field}>
          <Text style={styles.label}>Cultura Principal</Text>
          <TextInput
            style={styles.input}
            value={form.cultura_atual}
            onChangeText={(text) => handleChange('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        {/* Cidade */}
        <View style={styles.field}>
          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={styles.input}
            value={form.cidade}
            onChangeText={(text) => handleChange('cidade', text)}
            placeholder="Nome da cidade"
            placeholderTextColor={theme.colors.textSecondary}
          />
        </View>

        {/* Estado */}
        <View style={styles.field}>
          <Text style={styles.label}>Estado (UF)</Text>
          <TextInput
            style={[styles.input, errors.estado && styles.inputError]}
            value={form.estado}
            onChangeText={(text) => handleChange('estado', text.toUpperCase())}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.estado && (
            <Text style={styles.errorText}>{errors.estado}</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer com botões */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={theme.colors.white} />
              <Text style={styles.saveButtonText}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontBody,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary + '15',
    padding: theme.spacing.md,
    borderRadius: theme.spacing.radius,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  infoText: {
    flex: 1,
    fontSize: theme.typography.fontBody,
    color: theme.colors.text,
    lineHeight: 20,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radius,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontBody,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.error,
    borderWidth: 2,
  },
  errorText: {
    fontSize: theme.typography.fontCaption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    ...theme.shadows.sm,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.radius,
    backgroundColor: theme.colors.card,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    color: theme.colors.text,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.radius,
    backgroundColor: theme.colors.primary,
    ...theme.shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.white,
  },
});
