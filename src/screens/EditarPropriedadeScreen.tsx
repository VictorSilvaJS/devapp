import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
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

export default function EditarPropriedadeScreen({ route, navigation }) {
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
      newErrors.fazenda_nome = 'Propriedade é obrigatória';
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
        toast.showError('ID da propriedade não fornecido');
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
          toast.showWarning('Você não tem permissão para editar esta propriedade.');
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
        toast.showError('Não foi possível carregar os dados da propriedade');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    loadProdutor();
  }, [route?.params?.id, user]);

  const handleSave = async () => {
    if (!podeEditarProdutor(user, produtorAtual)) {
      toast.showWarning('Você não tem permissão para editar esta propriedade.');
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
      
      toast.showSuccess('Alterações salvas localmente!');
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
        <Header title="Editar Propriedade" showBackButton />
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
        <Header title="Editar Propriedade" showBackButton />
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={42} color={theme.colors.muted} />
          <Text style={styles.loadingText}>Você não tem permissão para editar esta propriedade.</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = getFazendaUiInfo(produtorAtual);
  const titularNome = fazendaInfo.titularNome || 'Titular não informado';
  const escopo = [produtorAtual?.regiao, produtorAtual?.microregiao].filter(Boolean).join(' • ');

  return (
    <View style={styles.container}>
      <Header title="Editar Propriedade" showBackButton />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InfoBox
          title="Edição local demonstrativa"
          message="As alterações ficam salvas somente neste aparelho. Titular, Região e Microregião permanecem vinculados e não podem ser trocados nesta fase."
        />

        <SectionCard title="Titular preservado" subtitle="O Titular atual permanece vinculado à Propriedade; esta edição não troca o vínculo cadastral.">
          <View style={styles.linkedRows}>
            <View style={styles.linkedRow}>
              <View style={styles.linkedIcon}>
                <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.linkedInfo}>
                <Text style={styles.linkedLabel}>Titular</Text>
                <Text style={styles.linkedValue}>{titularNome}</Text>
              </View>
            </View>

            <View style={styles.linkedRow}>
              <View style={styles.linkedIcon}>
                <Ionicons name="link-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.linkedInfo}>
                <Text style={styles.linkedLabel}>Vínculo</Text>
                <Text style={styles.linkedValue}>Titular/produtor preservado no mock</Text>
              </View>
            </View>
          </View>
        </SectionCard>

        <SectionCard title="Dados da Propriedade" subtitle="Atualize a identificação e a Área total informada no cadastro local.">
          <FormField
            label="Nome da Propriedade"
            required
            value={form.fazenda_nome}
            onChangeText={(text) => handleChange('fazenda_nome', text)}
            placeholder="Nome da propriedade"
            error={errors.fazenda_nome}
          />

          <FormField
            label="Área total informada (ha)"
            required
            value={form.area_total}
            onChangeText={(text) => handleChange('area_total', text)}
            placeholder="Ex: 500"
            keyboardType="numeric"
            error={errors.area_total}
            helperText="Valor cadastral informado; não representa necessariamente a área coberta pelos talhões."
          />
        </SectionCard>

        <SectionCard title="Dados produtivos" subtitle="Campo opcional para facilitar a identificação durante o teste.">
          <FormField
            label="Cultura atual (opcional)"
            value={form.cultura_atual}
            onChangeText={(text) => handleChange('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
          />
        </SectionCard>

        <SectionCard title="Localização preservada" subtitle="Cidade e UF são opcionais. Região e Microregião vinculadas permanecem bloqueadas nesta fase.">
          <FormField
            label="Cidade (opcional)"
            value={form.cidade}
            onChangeText={(text) => handleChange('cidade', text)}
            placeholder="Nome da cidade"
          />

          <FormField
            label="UF (opcional)"
            value={form.estado}
            onChangeText={(text) => handleChange('estado', text.toUpperCase())}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            error={errors.estado}
          />

          {!!escopo && (
            <View style={styles.linkedRow}>
              <View style={styles.linkedIcon}>
                <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.linkedInfo}>
                <Text style={styles.linkedLabel}>Região/Microregião</Text>
                <Text style={styles.linkedValue}>{escopo}</Text>
              </View>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar localmente"
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
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
  linkedRows: {
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
});
