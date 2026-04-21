import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { useToast } from '../components/Toast';
import { Produtor } from '../api/mock';
import { buildFazendaUpdatePayload } from '../api/produtorCompat';
import { useAuth } from '../auth/AuthContext';
import theme from '../theme';
import { 
  validarArea, 
  validarUF, 
  validarObrigatorio
} from '../utils/validacoes';
import { podeEditarProdutor } from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';

export default function EditarProdutorScreen({ route, navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtorAtual, setProdutorAtual] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState({
    fazenda_nome: '',
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
    const newErrors: any = {};

    if (!validarObrigatorio(form.fazenda_nome)) {
      newErrors.fazenda_nome = 'Fazenda é obrigatória';
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
        toast.showError('ID da fazenda não fornecido');
        navigation.goBack();
        return;
      }

      try {
        setLoading(true);
        setAccessDenied(false);
        const produtor = await Produtor.get(id);

        if (!podeEditarProdutor(user, produtor)) {
          setProdutorAtual(null);
          setAccessDenied(true);
          toast.showWarning('Você não tem permissão para editar esta fazenda.');
          return;
        }

        setProdutorAtual(produtor);
        const fazendaInfo = getFazendaUiInfo(produtor);
        setForm({
          fazenda_nome: fazendaInfo.fazendaNome || '',
          area_total: String(produtor.area_total || ''),
          cultura_atual: produtor.cultura_atual || '',
          cidade: produtor.cidade || '',
          estado: produtor.estado || ''
        });
      } catch (error) {
        toast.showError('Não foi possível carregar os dados da fazenda');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadProdutor();
  }, [route?.params?.id, user]);

  const handleSave = async () => {
    if (!podeEditarProdutor(user, produtorAtual)) {
      toast.showWarning('Você não tem permissão para editar esta fazenda.');
      return;
    }

    if (!validateForm()) {
      toast.showWarning('Preencha todos os campos obrigatórios corretamente');
      return;
    }

    try {
      setSaving(true);
      const payload = buildFazendaUpdatePayload(produtorAtual, form);
      await Produtor.update(route.params.id, payload);
      
      toast.showSuccess('Fazenda atualizada com sucesso!');
      navigation.goBack();
    } catch (error) {
      toast.showError('Não foi possível salvar as alterações. Tente novamente.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Fazenda" showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.container}>
        <Header title="Editar Fazenda" showBackButton />
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={42} color={theme.colors.muted} />
          <Text style={styles.loadingText}>Você não tem permissão para editar esta fazenda.</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = getFazendaUiInfo(produtorAtual);
  const titularNome = fazendaInfo.titularNome || 'Titular não informado';
  const titularId = produtorAtual?.produtor_id || produtorAtual?.proprietario_id || 'Vínculo não informado';
  const escopo = [produtorAtual?.regiao, produtorAtual?.microregiao].filter(Boolean).join(' • ');

  return (
    <View style={styles.container}>
      <Header title="Editar Fazenda" showBackButton />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={theme.colors.primary} />
          <Text style={styles.infoText}>
            Atualize os dados da fazenda mantendo o titular vinculado.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Titular Vinculado</Text>
        <View style={styles.linkedBox}>
          <View style={styles.linkedRow}>
            <View style={styles.linkedIcon}>
              <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.linkedInfo}>
              <Text style={styles.linkedLabel}>Titular atual</Text>
              <Text style={styles.linkedValue}>{titularNome}</Text>
            </View>
          </View>
          <View style={styles.linkedRow}>
            <View style={styles.linkedIcon}>
              <Ionicons name="link-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.linkedInfo}>
              <Text style={styles.linkedLabel}>Vínculo</Text>
              <Text style={styles.linkedValue}>{titularId}</Text>
            </View>
          </View>
          {!!escopo && (
            <View style={styles.linkedRow}>
              <View style={styles.linkedIcon}>
                <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.linkedInfo}>
                <Text style={styles.linkedLabel}>Escopo</Text>
                <Text style={styles.linkedValue}>{escopo}</Text>
              </View>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Dados da Fazenda</Text>

        {/* Fazenda */}
        <View style={styles.field}>
          <Text style={styles.label}>Nome da Fazenda *</Text>
          <TextInput
            style={[styles.input, errors.fazenda_nome && styles.inputError]}
            value={form.fazenda_nome}
            onChangeText={(text) => handleChange('fazenda_nome', text)}
            placeholder="Nome da fazenda"
            placeholderTextColor={theme.colors.textSecondary}
          />
          {errors.fazenda_nome && (
            <Text style={styles.errorText}>{errors.fazenda_nome}</Text>
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
          <Text style={styles.label}>Cultura Atual</Text>
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
  sectionTitle: {
    fontSize: theme.typography.fontBody + 1,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  linkedBox: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.spacing.radius,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  linkedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary + '15',
  },
  linkedInfo: {
    flex: 1,
    minWidth: 0,
  },
  linkedLabel: {
    fontSize: theme.typography.fontCaption,
    fontWeight: theme.typography.weightBold,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  linkedValue: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    color: theme.colors.text,
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
