import React, { useCallback, useMemo, useState } from 'react';
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
import SelectField from '../components/SelectField';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { LimiteArea, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import {
  findFazendaById,
  filtrarLimitesPorFazendaIds,
  getFazendaId,
  podeGerenciarPeriodoProdutivoEmFazenda,
} from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { getTalhaoConsultaId, getTalhaoConsultaNome } from '../utils/talhaoConsultaCompat';
import {
  buildPeriodoProdutivoTalhaoOptions,
  maskPeriodoProdutivoAnoAgricola,
  PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE,
  PERIODO_PRODUTIVO_CULTURA_OPTIONS,
  PERIODO_PRODUTIVO_CULTURA_OUTRO,
  PeriodoProdutivoCulturaOption,
  resolvePeriodoProdutivoCulturaSelection,
  resolvePeriodoProdutivoCulturaValue,
  validatePeriodoProdutivoFormValues,
} from '../utils/periodoProdutivoFormCompat';
import { PeriodoProdutivoService } from '../services/PeriodoProdutivoService';
import type { PeriodoProdutivoStatus, PeriodoProdutivoTipo } from '../types/periodoProdutivo';
import { colors, shadows, spacing, typography } from '../theme';

const PERIODO_FORM_ERROR_ORDER = [
  'fazenda',
  'tipoPeriodo',
  'cultura',
  'culturaOutro',
  'anoAgricola',
  'talhao',
  'dataFim',
  'status',
] as const;

const TIPO_OPTIONS = [
  {
    value: 'safra',
    label: 'Safra',
    description: 'Período principal da cultura na Propriedade.',
    icon: 'leaf-outline' as const,
  },
  {
    value: 'safrinha',
    label: 'Safrinha',
    description: 'Segundo período ou cultura subsequente.',
    icon: 'repeat-outline' as const,
  },
];

const STATUS_OPTIONS = [
  {
    value: 'planejada',
    label: 'Planejada',
    description: 'Ainda em organização ou previsão.',
    icon: 'time-outline' as const,
  },
  {
    value: 'em_andamento',
    label: 'Em andamento',
    description: 'Período ativo no campo.',
    icon: 'play-circle-outline' as const,
  },
  {
    value: 'encerrada',
    label: 'Encerrada',
    description: 'Ciclo concluído para consulta histórica.',
    icon: 'checkmark-circle-outline' as const,
  },
];

const parseDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDate = (value?: Date | null): string | undefined =>
  value instanceof Date && !Number.isNaN(value.getTime()) ? value.toISOString() : undefined;

export default function PeriodoProdutivoFormScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const formValidation = useFormValidationFocus(PERIODO_FORM_ERROR_ORDER);

  const periodoId = route.params?.periodoId || route.params?.id;
  const routeFazendaId =
    route.params?.fazendaId
    || route.params?.produtorId
    || route.params?.propriedadeId
    || route.params?.fazenda_id;
  const routeTalhaoId = route.params?.talhaoId || route.params?.talhao_id || '';
  const routeTalhao = route.params?.talhaoNome || route.params?.talhao || '';
  const isEditing = Boolean(periodoId);

  const [fazenda, setFazenda] = useState<any>(null);
  const [periodoOriginal, setPeriodoOriginal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [talhoesDisponiveis, setTalhoesDisponiveis] = useState<any[]>([]);

  const [tipoPeriodo, setTipoPeriodo] = useState<PeriodoProdutivoTipo | ''>('');
  const [culturaOption, setCulturaOption] = useState<PeriodoProdutivoCulturaOption>('');
  const [culturaOutro, setCulturaOutro] = useState('');
  const [anoAgricola, setAnoAgricola] = useState('');
  const [dataInicio, setDataInicio] = useState<Date | null>(null);
  const [dataFim, setDataFim] = useState<Date | null>(null);
  const [status, setStatus] = useState<PeriodoProdutivoStatus | ''>('');
  const [talhaoId, setTalhaoId] = useState('');
  const [talhao, setTalhao] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const talhaoOptions = useMemo(() => buildPeriodoProdutivoTalhaoOptions(
    talhoesDisponiveis,
    { id: talhaoId, nome: talhao }
  ), [talhao, talhaoId, talhoesDisponiveis]);

  useFocusEffect(
    useCallback(() => {
      void loadContext();
    }, [periodoId, routeFazendaId, routeTalhaoId, routeTalhao, user])
  );

  const loadContext = async () => {
    setLoading(true);
    setAccessDenied(false);

    try {
      const [fazendas, todosLimites] = await Promise.all([
        Produtor.list(),
        LimiteArea.list(),
      ]);
      let fazendaContexto = null;
      let periodo = null;

      if (periodoId) {
        periodo = await PeriodoProdutivoService.getPeriodoProdutivoById(periodoId);
        if (!periodo) {
          throw new Error('Periodo produtivo nao encontrado');
        }

        fazendaContexto = findFazendaById(fazendas, periodo.propriedade_id);
      } else if (routeFazendaId) {
        fazendaContexto = findFazendaById(fazendas, routeFazendaId);
      }

      if (!fazendaContexto || !podeGerenciarPeriodoProdutivoEmFazenda(user, fazendaContexto)) {
        setAccessDenied(true);
        setFazenda(null);
        setPeriodoOriginal(null);
        return;
      }

      setFazenda(fazendaContexto);
      setPeriodoOriginal(periodo);
      const fazendaContextoId = getFazendaId(fazendaContexto);
      const limitesDaFazenda = filtrarLimitesPorFazendaIds(todosLimites, [fazendaContextoId]);
      setTalhoesDisponiveis(limitesDaFazenda);

      if (periodo) {
        setTipoPeriodo(periodo.tipo_periodo === 'safrinha' ? 'safrinha' : 'safra');
        const culturaSelection = resolvePeriodoProdutivoCulturaSelection(periodo.cultura);
        setCulturaOption(culturaSelection.option);
        setCulturaOutro(culturaSelection.outro);
        setAnoAgricola(periodo.ano_agricola || '');
        setDataInicio(parseDate(periodo.data_inicio));
        setDataFim(parseDate(periodo.data_fim));
        setStatus(
          periodo.status === 'em_andamento' || periodo.status === 'encerrada'
            ? periodo.status
            : 'planejada'
        );
        setTalhaoId(periodo.talhao_id || '');
        setTalhao(periodo.talhao_nome || '');
        setObservacoes(periodo.observacoes || '');
      } else {
        setTipoPeriodo('');
        setCulturaOption('');
        setCulturaOutro('');
        setAnoAgricola('');
        setDataInicio(null);
        setDataFim(null);
        setStatus('');
        setObservacoes('');

        const routeTalhaoMatch = limitesDaFazenda.find((item) => (
          getTalhaoConsultaId(item) === routeTalhaoId
          || getTalhaoConsultaNome(item) === routeTalhao
        ));
        setTalhaoId(routeTalhaoMatch ? getTalhaoConsultaId(routeTalhaoMatch) : '');
        setTalhao(routeTalhaoMatch ? getTalhaoConsultaNome(routeTalhaoMatch) : '');
      }
    } catch (error) {
      console.error('Erro ao carregar periodo produtivo:', error);
      toast.showError('Erro ao carregar Safra/Safrinha');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!fazenda) {
      newErrors.fazenda = 'Propriedade não encontrada';
    }

    Object.assign(newErrors, validatePeriodoProdutivoFormValues({
      tipoPeriodo,
      culturaOption,
      culturaOutro,
      anoAgricola,
      dataInicio,
      dataFim,
      status,
    }));

    setErrors(newErrors);
    formValidation.focusFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!fazenda || !podeGerenciarPeriodoProdutivoEmFazenda(user, fazenda)) {
      toast.showWarning('Você não tem permissão para gerenciar Safra/Safrinha nesta propriedade.');
      return;
    }

    if (!validateForm()) {
      toast.showError('Preencha os campos obrigatórios');
      return;
    }

    const fazendaId = getFazendaId(fazenda);
    const fazendaInfo = getFazendaUiInfo(fazenda);
    const cultura = resolvePeriodoProdutivoCulturaValue(culturaOption, culturaOutro);
    const payload = {
      propriedade_id: fazendaId,
      nome_propriedade: fazendaInfo.fazendaNome,
      tipo_periodo: tipoPeriodo as PeriodoProdutivoTipo,
      cultura,
      ano_agricola: anoAgricola.trim(),
      data_inicio: toIsoDate(dataInicio),
      data_fim: toIsoDate(dataFim),
      status: status as PeriodoProdutivoStatus,
      talhao_id: talhao.trim() ? talhaoId || undefined : undefined,
      talhao_nome: talhao.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      criado_por_user_id: periodoOriginal?.criado_por_user_id || user?.id,
      criado_por_nome: periodoOriginal?.criado_por_nome || user?.nome || user?.full_name,
      registro_status: 'ativo' as const,
      origem: 'local' as const,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await PeriodoProdutivoService.updatePeriodoProdutivoMetadata(periodoId, payload);
        toast.showSuccess('Safra/Safrinha atualizada.');
      } else {
        await PeriodoProdutivoService.createPeriodoProdutivoMetadata(payload);
        toast.showSuccess('Safra/Safrinha criada.');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Erro ao salvar periodo produtivo:', error);
      toast.showError('Erro ao salvar Safra/Safrinha');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={isEditing ? 'Editar Safra/Safrinha' : 'Nova Safra/Safrinha'} showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Carregando contexto...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied || !fazenda) {
    return (
      <View style={styles.container}>
        <Header title={isEditing ? 'Editar Safra/Safrinha' : 'Nova Safra/Safrinha'} showBack />
        <View style={styles.centered}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedTitle}>Acesso restrito</Text>
          <Text style={styles.centeredText}>Você não tem permissão para gerenciar Safra/Safrinha nesta Propriedade.</Text>
        </View>
      </View>
    );
  }

  const fazendaInfo = getFazendaUiInfo(fazenda);

  return (
    <View style={styles.container}>
      <Header title={isEditing ? 'Editar Safra/Safrinha' : 'Nova Safra/Safrinha'} showBack />

      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <View ref={formValidation.registerField('fazenda')} collapsable={false}>
        <SectionCard title="Contexto" subtitle="O período será salvo localmente para esta Propriedade." icon="home-outline">
          <View style={styles.lockedBox}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.lockedContent}>
              <Text style={styles.lockedTitle}>{fazendaInfo.fazendaNome || 'Propriedade'}</Text>
              <Text style={styles.lockedText}>
                {[fazendaInfo.titularNome, fazendaInfo.localizacao].filter(Boolean).join(' • ')}
              </Text>
            </View>
          </View>
          {errors.fazenda ? <Text style={styles.errorText}>{errors.fazenda}</Text> : null}
        </SectionCard>
        </View>

        <SectionCard title="Período produtivo" subtitle="Organize a Safra/Safrinha de forma opcional para Caderno e consulta." icon="calendar-outline">
          <View ref={formValidation.registerField('tipoPeriodo')} collapsable={false}>
          <Text style={styles.label}>
            Tipo <Text style={styles.required}>*</Text>
          </Text>
          <RadioCardGroup
            options={TIPO_OPTIONS}
            value={tipoPeriodo}
            onChange={(value) => {
              setTipoPeriodo(value as PeriodoProdutivoTipo);
              setErrors((prev) => ({ ...prev, tipoPeriodo: null }));
            }}
            error={errors.tipoPeriodo}
          />
          </View>

          <View ref={formValidation.registerField('cultura')} collapsable={false}>
            <SelectField
              label="Cultura"
              required
              value={culturaOption}
              options={[...PERIODO_PRODUTIVO_CULTURA_OPTIONS]}
              onChange={(value) => {
                setCulturaOption(value as PeriodoProdutivoCulturaOption);
                if (value !== PERIODO_PRODUTIVO_CULTURA_OUTRO) setCulturaOutro('');
                setErrors((prev) => ({ ...prev, cultura: null, culturaOutro: null }));
              }}
              placeholder="Selecione a cultura"
              error={errors.cultura}
            />
          </View>

          {culturaOption === PERIODO_PRODUTIVO_CULTURA_OUTRO ? (
            <View ref={formValidation.registerField('culturaOutro')} collapsable={false}>
              <FormField
                ref={formValidation.registerFocusable('culturaOutro')}
                label="Qual cultura?"
                required
                value={culturaOutro}
                onChangeText={(value) => {
                  setCulturaOutro(value);
                  setErrors((prev) => ({ ...prev, culturaOutro: null }));
                }}
                placeholder="Informe a cultura"
                error={errors.culturaOutro}
              />
            </View>
          ) : null}

          <View ref={formValidation.registerField('anoAgricola')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('anoAgricola')}
              label="Ano agrícola"
              required
              value={anoAgricola}
              onChangeText={(value) => {
                setAnoAgricola(maskPeriodoProdutivoAnoAgricola(value));
                setErrors((prev) => ({ ...prev, anoAgricola: null }));
              }}
              placeholder="AAAA/AAAA"
              keyboardType="number-pad"
              maxLength={9}
              error={errors.anoAgricola}
            />
          </View>

          <View ref={formValidation.registerField('talhao')} collapsable={false}>
            <SelectField
              label="Talhão"
              value={talhaoOptions.selectedValue}
              options={talhaoOptions.options}
              onChange={(value) => {
                const selected = talhaoOptions.options.find((option) => option.value === value);
                if (value === PERIODO_PRODUTIVO_TALHAO_LEGADO_VALUE) {
                  setTalhaoId('');
                  return;
                }
                setTalhaoId(value);
                setTalhao(value ? selected?.label || '' : '');
              }}
              helperText={talhaoOptions.options.length > 1
                ? 'Opcional. Selecione somente um Talhão com ID estável desta Propriedade.'
                : 'Nenhum Talhão com ID estável; o período abrangerá toda a Propriedade.'}
            />
          </View>

          <DatePicker
            label="Data de início"
            value={dataInicio}
            onChange={(date) => {
              setDataInicio(date);
              setErrors((prev) => ({ ...prev, dataFim: null }));
            }}
            placeholder="Opcional"
            mode="date"
          />
          {dataInicio ? (
            <TouchableOpacity style={styles.clearDateButton} onPress={() => setDataInicio(null)} activeOpacity={0.75}>
              <Ionicons name="close-circle-outline" size={16} color={colors.muted} />
              <Text style={styles.clearDateText}>Limpar início</Text>
            </TouchableOpacity>
          ) : null}

          <View ref={formValidation.registerField('dataFim')} collapsable={false}>
            <DatePicker
              label="Data final"
              value={dataFim}
              onChange={(date) => {
                setDataFim(date);
                setErrors((prev) => ({ ...prev, dataFim: null }));
              }}
              placeholder="Opcional"
              minimumDate={dataInicio || undefined}
              mode="date"
              error={errors.dataFim}
            />
          </View>
          {dataFim ? (
            <TouchableOpacity style={styles.clearDateButton} onPress={() => setDataFim(null)} activeOpacity={0.75}>
              <Ionicons name="close-circle-outline" size={16} color={colors.muted} />
              <Text style={styles.clearDateText}>Limpar final</Text>
            </TouchableOpacity>
          ) : null}

          <View ref={formValidation.registerField('status')} collapsable={false}>
            <Text style={styles.label}>
              Status <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={STATUS_OPTIONS}
              value={status}
              onChange={(value) => {
                setStatus(value as PeriodoProdutivoStatus);
                setErrors((prev) => ({ ...prev, status: null }));
              }}
              error={errors.status}
            />
          </View>

          <FormField
            label="Observações"
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Opcional"
            textarea
            numberOfLines={4}
          />
        </SectionCard>

        <InfoBox message="A Safra/Safrinha é um vínculo local e opcional. Ela não altera mapas, GeoJSON, PNG, ZIP ou registros mockados existentes." />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel={isEditing ? 'Salvar Período' : 'Criar Período'}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centeredText: {
    fontSize: typography.fontBody,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  blockedTitle: {
    fontSize: typography.fontBody + 2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  label: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: spacing.radiusSm,
    padding: spacing.md,
  },
  lockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },
  lockedContent: {
    flex: 1,
    minWidth: 0,
  },
  lockedTitle: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  lockedText: {
    marginTop: 2,
    fontSize: typography.fontCaption + 1,
    color: colors.muted,
    lineHeight: 18,
  },
  clearDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  clearDateText: {
    fontSize: typography.fontCaption + 1,
    color: colors.muted,
    fontWeight: typography.weightSemibold,
  },
  errorText: {
    fontSize: typography.fontSmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    ...shadows.md,
  },
});
