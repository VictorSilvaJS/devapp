import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import ConfirmDialog from '../components/ConfirmDialog';
import DatePicker from '../components/DatePicker';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import Header from '../components/Header';
import InfoBox from '../components/InfoBox';
import RadioCardGroup from '../components/RadioCardGroup';
import SelectField from '../components/SelectField';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { CadernoCampo, LimiteArea, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import { PeriodoProdutivoService } from '../services/PeriodoProdutivoService';
import {
  avaliarAcessoCaderno,
  filtrarLimitesPorFazendaIds,
  podeExecutarComandoCaderno,
} from '../utils/acessoControle';
import { buildCadernoCorrectionChanges } from '../utils/cadernoCommandFormCompat';
import {
  CADERNO_TALHAO_LEGADO_VALUE,
  CADERNO_TIPOS_ATIVIDADE,
  buildCadernoPeriodoProdutivoOptions,
  buildCadernoTalhaoOptions,
  findCadernoPeriodoProdutivoOption,
  getCadernoFormFieldVisibility,
  getCadernoTipoLabel,
  isCadernoTalhaoLegado,
} from '../utils/cadernoFormCompat';
import {
  getCadernoEstado,
  getCadernoTypeValidationErrors,
  type CadernoActor,
} from '../utils/cadernoLifecycleCompat';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { colors, semanticColors, spacing, typography } from '../theme';

const FORM_ERROR_ORDER = [
  'alteracoes', 'dataAtividade', 'tipoAtividade', 'periodoProdutivoId', 'talhaoId',
  'observacoes', 'operacao', 'produtos',
  'dosagem', 'areaAplicada', 'produtividade', 'motivo',
] as const;

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isInvalidPositiveNumber = (value: string): boolean => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return false;
  const parsed = Number(normalized);
  return !Number.isFinite(parsed) || parsed <= 0;
};

export default function CorrigirCadernoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const formValidation = useFormValidationFocus(FORM_ERROR_ORDER);
  const cadernoId = route.params?.cadernoId || route.params?.registroId || route.params?.id;
  const wide = width >= 720;

  const [registro, setRegistro] = useState<any>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [dataAtividade, setDataAtividade] = useState<Date | null>(null);
  const [tipoAtividade, setTipoAtividade] = useState('');
  const [talhaoId, setTalhaoId] = useState('');
  const [talhao, setTalhao] = useState('');
  const [talhoesDisponiveis, setTalhoesDisponiveis] = useState<any[]>([]);
  const [periodoProdutivoId, setPeriodoProdutivoId] = useState('');
  const [periodosProdutivos, setPeriodosProdutivos] = useState<any[]>([]);
  const [observacoes, setObservacoes] = useState('');
  const [operacao, setOperacao] = useState('');
  const [produtosText, setProdutosText] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [areaAplicada, setAreaAplicada] = useState('');
  const [produtividade, setProdutividade] = useState('');
  const [condicoesClima, setCondicoesClima] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown> | null>(null);

  const fieldVisibility = useMemo(
    () => getCadernoFormFieldVisibility(tipoAtividade),
    [tipoAtividade],
  );
  const tipoOptions = useMemo(() => {
    const options = CADERNO_TIPOS_ATIVIDADE.map((tipo) => ({ ...tipo }));
    if (tipoAtividade && !options.some((tipo) => tipo.value === tipoAtividade)) {
      options.push({ value: tipoAtividade, label: `${getCadernoTipoLabel(tipoAtividade)} (legado)` });
    }
    return options;
  }, [tipoAtividade]);
  const talhaoSelection = useMemo(
    () => buildCadernoTalhaoOptions(talhoesDisponiveis, { id: talhaoId, nome: talhao }),
    [talhao, talhaoId, talhoesDisponiveis],
  );
  const periodoOptions = useMemo(() => {
    const options = buildCadernoPeriodoProdutivoOptions(periodosProdutivos);
    const currentId = String(
      registro?.periodo_produtivo_id || registro?.periodoProdutivoId || '',
    ).trim();
    if (currentId && !options.some((option) => option.id === currentId)) {
      options.push({
        id: currentId,
        label: String(registro?.periodo_produtivo_label || '').trim() || 'Safra/Safrinha vinculada',
        tipoPeriodo: String(registro?.tipo_periodo || '').trim() || undefined,
        cultura: String(registro?.cultura_periodo || '').trim() || undefined,
        anoAgricola: String(registro?.ano_agricola || '').trim() || undefined,
      });
    }
    return options;
  }, [periodosProdutivos, registro]);
  const periodoSelecionado = useMemo(
    () => findCadernoPeriodoProdutivoOption(periodoOptions, periodoProdutivoId),
    [periodoOptions, periodoProdutivoId],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setBlockedReason('');
      try {
        if (!cadernoId) throw new Error('Registro não informado');
        const [registroData, propriedades, limites] = await Promise.all([
          CadernoCampo.get(cadernoId),
          Produtor.list(),
          LimiteArea.list(),
        ]);
        const acesso = avaliarAcessoCaderno(user, registroData, propriedades);
        if (acesso.status !== 'permitido' || !podeExecutarComandoCaderno(user, registroData, acesso.fazenda)) {
          if (active) setBlockedReason('Você não tem permissão para editar este registro.');
          return;
        }
        if (getCadernoEstado(registroData) !== 'registrado') {
          if (active) setBlockedReason('Somente um registro consolidado pode receber edição auditada.');
          return;
        }
        if (!active) return;
        const propriedadeId = String(getFazendaUiInfo(acesso.fazenda).id || '').trim();
        const periodos = propriedadeId
          ? await PeriodoProdutivoService.listActivePeriodosProdutivosByPropriedade(propriedadeId).catch(() => [])
          : [];
        if (!active) return;
        setRegistro(registroData);
        setFazenda(acesso.fazenda);
        setTalhoesDisponiveis(filtrarLimitesPorFazendaIds(limites, [propriedadeId]));
        setPeriodosProdutivos(periodos);
        setDataAtividade(toValidDate(registroData?.data_atividade));
        setTipoAtividade(String(registroData?.tipo_atividade || ''));
        setTalhaoId(String(registroData?.talhao_id || registroData?.talhaoId || ''));
        setTalhao(String(registroData?.talhao_nome || registroData?.talhao || ''));
        setPeriodoProdutivoId(String(
          registroData?.periodo_produtivo_id || registroData?.periodoProdutivoId || '',
        ));
        setObservacoes(String(registroData?.observacoes || ''));
        setOperacao(String(registroData?.operacao || ''));
        setProdutosText(Array.isArray(registroData?.produtos_utilizados) ? registroData.produtos_utilizados.join(', ') : '');
        setDosagem(String(registroData?.dosagem || ''));
        setAreaAplicada(registroData?.area_aplicada == null ? '' : String(registroData.area_aplicada));
        setProdutividade(registroData?.produtividade == null ? '' : String(registroData.produtividade));
        setCondicoesClima(String(registroData?.condicoes_clima || ''));
      } catch {
        if (active) setBlockedReason('Não foi possível carregar este registro.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [cadernoId, user]);

  const handleTipoAtividadeChange = (value: string) => {
    const nextVisibility = getCadernoFormFieldVisibility(value);
    setTipoAtividade(value);
    if (!nextVisibility.periodo) setPeriodoProdutivoId('');
    if (!nextVisibility.talhao) {
      setTalhaoId('');
      setTalhao('');
    }
    if (!nextVisibility.operacao) setOperacao('');
    if (!nextVisibility.produtos) setProdutosText('');
    if (!nextVisibility.dosagem) setDosagem('');
    if (!nextVisibility.area) setAreaAplicada('');
    if (!nextVisibility.produtividade) setProdutividade('');
    if (!nextVisibility.clima) setCondicoesClima('');
    clearChangeError('tipoAtividade');
  };

  const getChanges = () => buildCadernoCorrectionChanges(registro, {
    dataAtividade,
    tipoAtividade,
    talhaoId,
    talhao,
    periodoProdutivo: periodoSelecionado,
    observacoes,
    operacao,
    produtosText,
    dosagem,
    areaAplicada,
    produtividade,
    condicoesClima,
  });

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!dataAtividade) nextErrors.dataAtividade = 'Informe a data do registro.';
    else if (dataAtividade.getTime() > Date.now()) nextErrors.dataAtividade = 'A data do registro não pode estar no futuro.';
    if (!tipoAtividade.trim()) nextErrors.tipoAtividade = 'Selecione o tipo de registro.';
    if (isInvalidPositiveNumber(areaAplicada)) nextErrors.areaAplicada = 'Informe uma área maior que zero ou deixe em branco.';
    if (isInvalidPositiveNumber(produtividade)) nextErrors.produtividade = 'Informe uma produtividade maior que zero ou deixe em branco.';
    if (!motivo.trim()) nextErrors.motivo = 'Informe o motivo da correção.';
    const changes = getChanges();
    if (Object.keys(changes).length === 0) nextErrors.alteracoes = 'Altere ao menos um dos campos permitidos.';
    Object.assign(nextErrors, getCadernoTypeValidationErrors({ ...registro, ...changes }));
    setErrors(nextErrors);
    formValidation.focusFirstError(nextErrors);
    return { valid: Object.keys(nextErrors).length === 0, changes };
  };

  const requestCorrection = () => {
    const result = validate();
    if (!result.valid) {
      toast.showError('Revise os dados da edição.');
      return;
    }
    setPendingChanges(result.changes);
  };

  const executeCorrection = async () => {
    if (!registro || !fazenda || !pendingChanges || !podeExecutarComandoCaderno(user, registro, fazenda)) {
      toast.showWarning('A edição não está mais disponível.');
      return;
    }
    setSaving(true);
    try {
      const propriedadeId = String(getFazendaUiInfo(fazenda).id || '').trim();
      const actor: CadernoActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name,
        perfil: user?.perfil || '',
        propriedadeIds: [propriedadeId],
      };
      await CadernoCampo.command(registro.id, {
        tipo: 'corrigir',
        versaoBase: Number(registro.versao_atual),
        motivo: motivo.trim(),
        alteracoes: pendingChanges,
      }, actor);
      setPendingChanges(null);
      toast.showSuccess('Alterações salvas e registradas no histórico.');
      navigation.goBack();
    } catch (error: any) {
      setPendingChanges(null);
      toast.showError(error?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  const clearChangeError = (field?: string) => {
    setErrors((current) => ({ ...current, ...(field ? { [field]: null } : {}), alteracoes: null }));
  };

  if (loading) {
    return <View style={styles.container}><Header title="Editar dados do Caderno" showBack /><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.centerText}>Carregando registro...</Text></View></View>;
  }

  if (blockedReason || !registro || !fazenda) {
    return <View style={styles.container}><Header title="Editar dados do Caderno" showBack /><View style={styles.center}><Ionicons name="lock-closed-outline" size={48} color={colors.muted} /><Text style={styles.centerText}>{blockedReason || 'Registro indisponível.'}</Text></View></View>;
  }

  const fazendaInfo = getFazendaUiInfo(fazenda);
  return (
    <View style={styles.container}>
      <Header title="Editar dados do Caderno" showBack />
      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        persistentScrollbar
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.formWidth}>
          <SectionCard title="Registro consolidado" subtitle="A Propriedade, a autoria e o conteúdo original permanecem preservados." icon="shield-checkmark-outline">
            <Text style={styles.contextTitle}>{fazendaInfo.fazendaNome}</Text>
            <Text style={styles.contextText}>{getCadernoTipoLabel(registro.tipo_atividade)} • versão {registro.versao_atual}</Text>
          </SectionCard>

          <InfoBox title="Edição auditada" message="Edite os dados necessários e informe o motivo. Ao salvar, o registro original não é apagado: o histórico guarda os valores anteriores, os novos valores, o autor e a versão." />

          <View ref={formValidation.registerField('alteracoes')} collapsable={false}>
            {errors.alteracoes ? <View style={styles.formWarning}><Ionicons name="alert-circle-outline" size={19} color={semanticColors.warning.text} /><Text style={styles.formWarningText}>{errors.alteracoes}</Text></View> : null}
          </View>

          <SectionCard title="Dados do registro" subtitle="Os valores atuais já estão preenchidos. O formulário se adapta ao tipo selecionado." icon="create-outline">
            <View ref={formValidation.registerField('dataAtividade')} collapsable={false}>
              <DatePicker label="Data do registro" required value={dataAtividade} maximumDate={new Date()} error={errors.dataAtividade || undefined} onChange={(value) => { setDataAtividade(value); clearChangeError('dataAtividade'); }} />
            </View>

            <View ref={formValidation.registerField('tipoAtividade')} collapsable={false} style={styles.field}>
              <Text style={styles.label}>Tipo de registro <Text style={styles.required}>*</Text></Text>
              <RadioCardGroup
                options={tipoOptions}
                value={tipoAtividade}
                onChange={handleTipoAtividadeChange}
                error={errors.tipoAtividade || undefined}
              />
            </View>

            {fieldVisibility.periodo ? (
              <View ref={formValidation.registerField('periodoProdutivoId')} collapsable={false}>
                <SelectField
                  label="Safra/Safrinha"
                  required
                  value={periodoProdutivoId}
                  options={[
                    { value: '', label: 'Sem Safra/Safrinha vinculada' },
                    ...periodoOptions.map((periodo) => ({
                      value: periodo.id,
                      label: periodo.label,
                      description: [periodo.status, periodo.talhao].filter(Boolean).join(' • ') || undefined,
                    })),
                  ]}
                  onChange={(value) => {
                    setPeriodoProdutivoId(value);
                    clearChangeError('periodoProdutivoId');
                  }}
                  helperText="Obrigatória para Plantio e Colheita."
                  error={errors.periodoProdutivoId || undefined}
                />
              </View>
            ) : null}

            {fieldVisibility.talhao ? (
              <View ref={formValidation.registerField('talhaoId')} collapsable={false}>
                <SelectField
                  label="Talhão"
                  required
                  value={talhaoSelection.selectedValue}
                  options={talhaoSelection.options}
                  onChange={(value) => {
                    if (value === CADERNO_TALHAO_LEGADO_VALUE) {
                      setTalhaoId('');
                    } else {
                      const selected = talhaoSelection.options.find((option) => option.value === value);
                      setTalhaoId(value);
                      setTalhao(value ? selected?.label || '' : '');
                    }
                    clearChangeError('talhaoId');
                  }}
                  placeholder="Selecione o Talhão"
                  helperText={isCadernoTalhaoLegado({ talhao_id: talhaoId, talhao })
                    ? 'Referência legada preservada. Selecione um Talhão para vinculá-la por ID.'
                    : 'A seleção mantém o vínculo estável com o Talhão da Propriedade.'}
                  error={errors.talhaoId || undefined}
                />
              </View>
            ) : null}

            {fieldVisibility.operacao ? (
              <View ref={formValidation.registerField('operacao')} collapsable={false}>
                <FormField label="Operação de plantio" required value={operacao} error={errors.operacao || undefined} onChangeText={(value) => { setOperacao(value); clearChangeError('operacao'); }} placeholder="Ex.: Semeadura direta" />
              </View>
            ) : null}

            {fieldVisibility.produtos ? (
              <View ref={formValidation.registerField('produtos')} collapsable={false}>
                <FormField label="Produtos utilizados" required helperText="Separe os produtos por vírgula." value={produtosText} error={errors.produtos || undefined} onChangeText={(value) => { setProdutosText(value); clearChangeError('produtos'); }} textarea numberOfLines={3} />
              </View>
            ) : null}

            <View style={wide ? styles.fieldRow : undefined}>
              {fieldVisibility.dosagem ? (
                <View ref={formValidation.registerField('dosagem')} collapsable={false} style={styles.flexField}>
                  <FormField label="Dosagem" required value={dosagem} error={errors.dosagem || undefined} onChangeText={(value) => { setDosagem(value); clearChangeError('dosagem'); }} />
                </View>
              ) : null}
              {fieldVisibility.area ? (
                <View ref={formValidation.registerField('areaAplicada')} collapsable={false} style={styles.flexField}>
                  <FormField label={tipoAtividade === 'colheita' ? 'Área colhida (ha)' : 'Área aplicada (ha)'} required value={areaAplicada} keyboardType="decimal-pad" error={errors.areaAplicada || undefined} onChangeText={(value) => { setAreaAplicada(value); clearChangeError('areaAplicada'); }} />
                </View>
              ) : null}
              {fieldVisibility.produtividade ? (
                <View ref={formValidation.registerField('produtividade')} collapsable={false} style={styles.flexField}>
                  <FormField label="Produtividade" required value={produtividade} keyboardType="decimal-pad" error={errors.produtividade || undefined} onChangeText={(value) => { setProdutividade(value); clearChangeError('produtividade'); }} />
                </View>
              ) : null}
            </View>

            {fieldVisibility.clima ? (
              <FormField label="Condições climáticas" value={condicoesClima} onChangeText={(value) => { setCondicoesClima(value); clearChangeError(); }} />
            ) : null}

            {fieldVisibility.observacoes ? (
              <View ref={formValidation.registerField('observacoes')} collapsable={false}>
                <FormField
                  label="Observações"
                  required={['observacao', 'ocorrencia', 'outro'].includes(tipoAtividade)}
                  value={observacoes}
                  error={errors.observacoes || undefined}
                  onChangeText={(value) => { setObservacoes(value); clearChangeError('observacoes'); }}
                  textarea
                  numberOfLines={4}
                />
              </View>
            ) : null}
          </SectionCard>

          <SectionCard title="Justificativa" subtitle="Explique por que os dados precisam ser alterados." icon="chatbox-ellipses-outline">
            <View ref={formValidation.registerField('motivo')} collapsable={false}>
              <FormField label="Motivo da alteração" required value={motivo} error={errors.motivo || undefined} onChangeText={(value) => { setMotivo(value); setErrors((current) => ({ ...current, motivo: null })); }} textarea numberOfLines={4} placeholder="Ex.: tipo e valor informados incorretamente no registro original" />
            </View>
          </SectionCard>
        </View>
      </ScrollView>
      <FormFooter onCancel={() => navigation.goBack()} onSubmit={requestCorrection} submitLabel="Revisar alterações" submitIcon="shield-checkmark-outline" loading={saving} />
      <ConfirmDialog visible={pendingChanges !== null} title="Salvar alterações?" message="Os dados alterados serão registrados em uma nova versão. O conteúdo anterior permanecerá no histórico do Caderno." confirmText="Salvar alterações" cancelText="Continuar revisando" onConfirm={() => void executeCorrection()} onCancel={() => setPendingChanges(null)} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.screen, paddingBottom: spacing.xl * 2 },
  formWidth: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  centerText: { color: colors.muted, fontSize: typography.fontBody, textAlign: 'center' },
  contextTitle: { color: colors.text, fontSize: typography.fontSubtitle, fontWeight: typography.weightBold, marginBottom: spacing.xs },
  contextText: { color: colors.muted, fontSize: typography.fontSmall, lineHeight: 20 },
  field: { marginBottom: spacing.md },
  label: { color: colors.text, fontSize: typography.fontBody, fontWeight: typography.weightSemibold, marginBottom: spacing.sm },
  required: { color: colors.error },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  flexField: { flex: 1, minWidth: 0 },
  formWarning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginVertical: spacing.md, borderRadius: spacing.radiusSm, backgroundColor: semanticColors.warning.surface, borderWidth: 1, borderColor: semanticColors.warning.border },
  formWarningText: { flex: 1, color: semanticColors.warning.text, fontSize: typography.fontSmall, fontWeight: typography.weightSemibold },
});
