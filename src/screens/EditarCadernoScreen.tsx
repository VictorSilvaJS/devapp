import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import RadioCardGroup from '../components/RadioCardGroup';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { CadernoCampo, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { colors, shadows, spacing, typography } from '../theme';
import {
  avaliarAcessoCaderno,
  findFazendaById,
  podeEditarCadernoEmFazenda,
} from '../utils/acessoControle';
import {
  CADERNO_TIPOS_ATIVIDADE,
  buildCadernoFazendaOptions,
  buildCadernoPayload,
  getCadernoFormFazendaLabel,
  isCadernoVisivelParaProdutor,
  parseCadernoAreaAplicada,
  resolveCadernoEdicaoFazendaId,
} from '../utils/cadernoFormCompat';

export default function EditarCadernoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();

  const { cadernoId, registroId, id } = route.params || {};
  const cadernoRouteId = cadernoId || registroId || id;

  const [registroOriginal, setRegistroOriginal] = useState<any>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const [fazendaId, setFazendaId] = useState('');
  const [dataAtividade, setDataAtividade] = useState<Date | null>(null);
  const [tipoAtividade, setTipoAtividade] = useState('observacao');
  const [responsavel, setResponsavel] = useState('');
  const [talhao, setTalhao] = useState('');
  const [produtosText, setProdutosText] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [areaAplicada, setAreaAplicada] = useState('');
  const [condicoesClima, setCondicoesClima] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [visivelParaProdutor, setVisivelParaProdutor] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadRegistro();
    }, [cadernoRouteId, user])
  );

  const loadRegistro = async () => {
    setLoading(true);
    setAccessDenied(false);

    try {
      if (!cadernoRouteId) {
        throw new Error('Registro de caderno não informado');
      }

      const [registroData, fazendasData] = await Promise.all([
        CadernoCampo.get(cadernoRouteId),
        Produtor.list(),
      ]);

      const acesso = avaliarAcessoCaderno(user, registroData, fazendasData);

      if (acesso.status !== 'permitido' || !podeEditarCadernoEmFazenda(user, registroData, acesso.fazenda)) {
        setRegistroOriginal(null);
        setFazenda(null);
        setAccessDenied(true);
        toast.showWarning('Você não tem permissão para editar este registro.');
        return;
      }

      const contextoFazendaId = resolveCadernoEdicaoFazendaId(registroData, acesso.fazendaId);
      setRegistroOriginal(registroData);
      setFazenda(acesso.fazenda);
      setFazendas(fazendasData);
      setFazendaId(contextoFazendaId);
      setDataAtividade(registroData.data_atividade ? new Date(registroData.data_atividade) : null);
      setTipoAtividade(registroData.tipo_atividade || 'observacao');
      setResponsavel(registroData.colaborador_responsavel || user?.nome || user?.full_name || '');
      setTalhao(registroData.talhao || '');
      setProdutosText(Array.isArray(registroData.produtos_utilizados) ? registroData.produtos_utilizados.join(', ') : '');
      setDosagem(registroData.dosagem || '');
      setAreaAplicada(
        registroData.area_aplicada !== undefined && registroData.area_aplicada !== null
          ? String(registroData.area_aplicada).replace('.', ',')
          : ''
      );
      setCondicoesClima(registroData.condicoes_clima || '');
      setObservacoes(registroData.observacoes || '');
      setVisivelParaProdutor(isCadernoVisivelParaProdutor(registroData));
    } catch (error) {
      console.error('Erro ao carregar registro para edição:', error);
      toast.showError('Erro ao carregar edição do caderno');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId)) {
      newErrors.fazendaId = 'Registro sem contexto de propriedade';
    }

    if (!dataAtividade) {
      newErrors.dataAtividade = 'Selecione a data da atividade';
    }

    if (!tipoAtividade) {
      newErrors.tipoAtividade = 'Selecione o tipo de atividade';
    }

    if (!responsavel.trim()) {
      newErrors.responsavel = 'Informe o responsável pelo registro';
    }

    if (parseCadernoAreaAplicada(areaAplicada) === null) {
      newErrors.areaAplicada = 'Informe uma área maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!registroOriginal) {
      toast.showWarning('Registro não carregado para edição.');
      return;
    }

    if (!validateForm()) {
      toast.showError('Preencha os campos obrigatórios');
      return;
    }

    const contextoFazendaId = resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId);
    const fazendaContexto = findFazendaById(fazendas, contextoFazendaId) || fazenda;
    const registroComContexto = { ...registroOriginal, fazenda_id: contextoFazendaId };

    if (!podeEditarCadernoEmFazenda(user, registroComContexto, fazendaContexto)) {
      toast.showWarning('Você não tem permissão para editar este registro.');
      return;
    }

    setSaving(true);
    try {
      const payload = buildCadernoPayload({
        fazendaId: contextoFazendaId,
        dataAtividade,
        tipoAtividade,
        talhao,
        produtosText,
        dosagem,
        areaAplicadaText: areaAplicada,
        condicoesClima,
        observacoes,
        visivelParaProdutor,
        colaboradorResponsavel: responsavel,
        criadoPorUserId: registroOriginal.criado_por_user_id || registroOriginal.criado_por || user?.id,
      });

      if (!payload) {
        throw new Error('Não foi possível montar o payload do caderno');
      }

      await CadernoCampo.update(cadernoRouteId, payload);
      toast.showSuccess('Registro de caderno atualizado!');

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('CadernoDetail', { cadernoId: cadernoRouteId });
      }
    } catch (error) {
      console.error('Erro ao atualizar registro de caderno:', error);
      toast.showError('Erro ao atualizar registro de caderno');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Registro" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando registro...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied || !registroOriginal) {
    return (
      <View style={styles.container}>
        <Header title="Editar Registro" showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedText}>Acesso restrito</Text>
          <Text style={styles.blockedSubtext}>Você não tem permissão para editar este registro.</Text>
        </View>
      </View>
    );
  }

  const contextoFazendaId = resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId);
  const fazendaOptions = buildCadernoFazendaOptions(fazenda ? [fazenda] : []);
  const fazendaLabel = getCadernoFormFazendaLabel(
    fazendaOptions.find((option) => option.id === contextoFazendaId),
    'Propriedade vinculada não encontrada'
  );

  return (
    <View style={styles.container}>
      <Header title="Editar Registro" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="Contexto" subtitle="A propriedade vinculada é preservada nesta edição.">
          <View style={styles.field}>
            <Text style={styles.label}>Propriedade vinculada</Text>
            <View style={[styles.picker, styles.lockedPicker, errors.fazendaId && styles.inputError]}>
              <Text style={styles.pickerText}>{fazendaLabel}</Text>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            </View>
            <Text style={styles.contextHint}>A propriedade do registro não é alterada nesta edição.</Text>
            {errors.fazendaId && <Text style={styles.errorText}>{errors.fazendaId}</Text>}
          </View>
        </SectionCard>

        <SectionCard title="Registro de campo" subtitle="Atualize data, tipo, responsável e informações operacionais.">
          <DatePicker
            label="Data do registro"
            value={dataAtividade}
            onChange={(date) => {
              setDataAtividade(date);
              setErrors(prev => ({ ...prev, dataAtividade: null }));
            }}
            placeholder="Selecione a data"
            error={errors.dataAtividade}
            maximumDate={new Date()}
            mode="date"
          />

          <View style={styles.field}>
            <Text style={styles.label}>
              Tipo de registro <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={CADERNO_TIPOS_ATIVIDADE.map((tipo) => ({
                value: tipo.value,
                label: tipo.label,
              }))}
              value={tipoAtividade}
              onChange={(value) => {
                setTipoAtividade(value);
                setErrors(prev => ({ ...prev, tipoAtividade: null }));
              }}
              error={errors.tipoAtividade}
            />
          </View>

          <FormField
            label="Responsável"
            value={responsavel}
            onChangeText={(value) => {
              setResponsavel(value);
              setErrors(prev => ({ ...prev, responsavel: null }));
            }}
            placeholder="Nome do responsável"
            error={errors.responsavel}
          />

          <FormField
            label="Talhão"
            value={talhao}
            onChangeText={setTalhao}
            placeholder="Ex: Talhão A"
          />

          <FormField
            label="Área Aplicada (ha)"
            value={areaAplicada}
            onChangeText={(value) => {
              setAreaAplicada(value);
              setErrors(prev => ({ ...prev, areaAplicada: null }));
            }}
            placeholder="Ex: 25,5"
            keyboardType="decimal-pad"
            error={errors.areaAplicada}
          />

          <FormField
            label="Produtos Utilizados"
            value={produtosText}
            onChangeText={setProdutosText}
            placeholder="Separe produtos por vírgula"
          />

          <FormField
            label="Dosagem"
            value={dosagem}
            onChangeText={setDosagem}
            placeholder="Ex: 300 kg/ha"
          />

          <FormField
            label="Condições Climáticas"
            value={condicoesClima}
            onChangeText={setCondicoesClima}
            placeholder="Ex: Ensolarado, sem vento"
          />

          <FormField
            label="Observações"
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Descreva o registro de campo..."
            textarea
            numberOfLines={4}
          />
        </SectionCard>

        <SectionCard title="Visibilidade" subtitle="Controle se o registro aparece para o produtor.">
          <Text style={styles.label}>
            Visibilidade para Produtor <Text style={styles.required}>*</Text>
          </Text>
          <RadioCardGroup
            options={[
              {
                value: 'visivel',
                label: 'Liberado ao produtor',
                description: 'Aparece no histórico da propriedade.',
              },
              {
                value: 'restrito',
                label: 'Interno',
                description: 'Disponível apenas para admin e colaboradores.',
              },
            ]}
            value={visivelParaProdutor ? 'visivel' : 'restrito'}
            onChange={(value) => setVisivelParaProdutor(value === 'visivel')}
          />
        </SectionCard>

        <InfoBox message="As alterações serão salvas no registro desta propriedade." />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar Alterações"
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontBody,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  textarea: {
    minHeight: 100,
    paddingTop: spacing.md,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  lockedPicker: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.borderLight,
  },
  pickerText: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
  },
  contextHint: {
    marginTop: spacing.xs,
    fontSize: typography.fontSmall,
    color: colors.muted,
    lineHeight: 16,
  },
  radioGroup: {
    gap: spacing.sm,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  radioButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.accent,
  },
  radioButtonLocked: {
    opacity: 0.75,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
  },
  radioContent: {
    flex: 1,
  },
  radioLabelSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  radioDescription: {
    marginTop: 2,
    fontSize: typography.fontSmall,
    color: colors.muted,
  },
  errorText: {
    fontSize: typography.fontSmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.accent,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderRadius: spacing.radiusSm,
    padding: spacing.md,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSmall,
    color: colors.textLight,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    ...shadows.md,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: spacing.radiusSm,
    gap: spacing.sm,
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: colors.backgroundAlt,
  },
  cancelButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: typography.fontBody,
    fontWeight: '700',
    color: colors.card,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  loadingText: {
    fontSize: typography.fontBody,
    color: colors.muted,
  },
  blockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  blockedText: {
    fontSize: typography.fontBody + 2,
    fontWeight: '700',
    color: colors.text,
  },
  blockedSubtext: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
