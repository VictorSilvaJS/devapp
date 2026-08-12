import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import ConfirmDialog from '../components/ConfirmDialog';
import DatePicker from '../components/DatePicker';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { Produtor, Visita } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import { avaliarAcessoVisita, podeEditarVisita } from '../utils/acessoControle';
import { getFazendaUiInfo } from '../utils/fazendaUiCompat';
import { getVisitaObjetivoLabel } from '../utils/visitaFormCompat';
import {
  buildVisitaIdempotencyKey,
  getVisitaEstado,
  type VisitaActor,
} from '../utils/visitaLifecycleCompat';
import { buildVisitaCorrectionChanges } from '../utils/visitaCommandFormCompat';
import { colors, semanticColors, spacing, typography } from '../theme';

const FORM_ERROR_ORDER = ['resumo', 'proximaVisita', 'motivo', 'alteracoes'] as const;

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as any);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: unknown): string => {
  const date = toValidDate(value);
  return date
    ? date.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : 'Não informado';
};

export default function CorrigirVisitaScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const formValidation = useFormValidationFocus(FORM_ERROR_ORDER);
  const visitaId = route.params?.visitaId || route.params?.id;

  const [visita, setVisita] = useState<any>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [resumo, setResumo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [clima, setClima] = useState('');
  const [proximaVisita, setProximaVisita] = useState<Date | null>(null);
  const [responsavel, setResponsavel] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [pendingChanges, setPendingChanges] = useState<Record<string, unknown> | null>(null);
  const wide = width >= 720;

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setBlockedReason('');
      try {
        if (!visitaId) throw new Error('Visita não informada');
        const [visitaData, propriedades] = await Promise.all([Visita.get(visitaId), Produtor.list()]);
        const acesso = avaliarAcessoVisita(user, visitaData, propriedades);
        if (acesso.status !== 'permitido' || !podeEditarVisita(user, visitaData, acesso.fazenda)) {
          if (active) setBlockedReason('Você não tem permissão para corrigir esta Visita.');
          return;
        }
        if (getVisitaEstado(visitaData) !== 'realizada') {
          if (active) setBlockedReason('Somente uma Visita realizada pode receber correção auditada.');
          return;
        }
        if (!active) return;
        setVisita(visitaData);
        setFazenda(acesso.fazenda);
        setResumo(String(visitaData?.resumo_conclusao || ''));
        setObservacoes(String(visitaData?.observacoes || ''));
        setRecomendacoes(String(visitaData?.recomendacoes || ''));
        setClima(String(visitaData?.clima || ''));
        setProximaVisita(toValidDate(visitaData?.proximaVisita));
        setResponsavel(String(visitaData?.responsavel_executante_nome || visitaData?.tecnico_responsavel || ''));
      } catch {
        if (active) setBlockedReason('Não foi possível carregar esta Visita.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user, visitaId]);

  const getChanges = () => buildVisitaCorrectionChanges(visita, {
    resumoConclusao: resumo,
    observacoes,
    recomendacoes,
    clima,
    proximaVisita,
    responsavelExecutanteNome: responsavel,
  });

  const validate = () => {
    const nextErrors: any = {};
    if (!resumo.trim()) nextErrors.resumo = 'O resumo operacional não pode ficar vazio.';
    if (proximaVisita && proximaVisita.getTime() < new Date().setHours(0, 0, 0, 0)) {
      nextErrors.proximaVisita = 'A próxima Visita não pode estar no passado.';
    }
    if (!motivo.trim()) nextErrors.motivo = 'Informe o motivo da correção.';
    const changes = getChanges();
    if (Object.keys(changes).length === 0) nextErrors.alteracoes = 'Altere ao menos um dos campos permitidos.';
    setErrors(nextErrors);
    formValidation.focusFirstError(nextErrors);
    return { valid: Object.keys(nextErrors).length === 0, changes };
  };

  const requestCorrection = () => {
    const result = validate();
    if (!result.valid) {
      toast.showError('Revise a correção informada.');
      return;
    }
    setPendingChanges(result.changes);
  };

  const executeCorrection = async () => {
    if (!visita || !fazenda || !pendingChanges || !podeEditarVisita(user, visita, fazenda)) {
      toast.showWarning('A correção não está mais disponível.');
      return;
    }
    setSaving(true);
    try {
      const propriedadeId = String(getFazendaUiInfo(fazenda).id || '').trim();
      const actor: VisitaActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name,
        perfil: user?.perfil || '',
        propriedadeIds: [propriedadeId],
      };
      await Visita.command(visita.id, {
        tipo: 'corrigir',
        versaoBase: Number(visita.versao_atual),
        chaveIdempotencia: buildVisitaIdempotencyKey(visita.id, 'corrigir'),
        motivo: motivo.trim(),
        alteracoes: pendingChanges,
      }, actor);
      setPendingChanges(null);
      toast.showSuccess('Correção registrada com os valores anteriores e novos.');
      navigation.goBack();
    } catch (error: any) {
      setPendingChanges(null);
      toast.showError(error?.message || 'Não foi possível corrigir a Visita.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.container}><Header title="Corrigir Visita" showBack /><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.centerText}>Carregando Visita...</Text></View></View>;
  }

  if (blockedReason || !visita || !fazenda) {
    return <View style={styles.container}><Header title="Corrigir Visita" showBack /><View style={styles.center}><Ionicons name="lock-closed-outline" size={48} color={colors.muted} /><Text style={styles.centerText}>{blockedReason || 'Visita indisponível.'}</Text></View></View>;
  }

  const fazendaInfo = getFazendaUiInfo(fazenda);
  const changeCount = Object.keys(pendingChanges || {}).length;

  return (
    <View style={styles.container}>
      <Header title="Corrigir Visita" showBack />
      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        persistentScrollbar
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formWidth}>
          <SectionCard title="Registro realizado" subtitle="A identidade, a Propriedade e a conclusão original permanecem protegidas." icon="shield-checkmark-outline">
            <Text style={styles.contextTitle}>{fazendaInfo.fazendaNome}</Text>
            <Text style={styles.contextText}>Realizada em {formatDateTime(visita.inicio_real_em || visita.data_visita)}</Text>
            <Text style={styles.contextText}>{getVisitaObjetivoLabel(visita.objetivo)} • versão {visita.versao_atual}</Text>
          </SectionCard>

          <InfoBox title="Correção auditada" message="Edite somente os dados incorretos. Ao confirmar, o histórico preservará os valores anteriores, os novos valores, o motivo, o autor e a versão." />

          <View ref={formValidation.registerField('alteracoes')} collapsable={false}>
            {errors.alteracoes ? <View style={styles.formWarning}><Ionicons name="alert-circle-outline" size={19} color={semanticColors.warning.text} /><Text style={styles.formWarningText}>{errors.alteracoes}</Text></View> : null}
          </View>

          <SectionCard title="Dados corrigíveis" subtitle="Os campos já aparecem com os valores atuais. Você pode corrigir mais de um de uma vez." icon="create-outline">
            <View ref={formValidation.registerField('resumo')} collapsable={false}>
              <FormField label="Resumo operacional" required value={resumo} onChangeText={(value) => { setResumo(value); setErrors((prev) => ({ ...prev, resumo: null, alteracoes: null })); }} textarea numberOfLines={5} error={errors.resumo} />
            </View>
            <View style={wide ? styles.fieldRow : undefined}>
              <View style={styles.flexField}><FormField label="Condições climáticas" value={clima} onChangeText={(value) => { setClima(value); setErrors((prev) => ({ ...prev, alteracoes: null })); }} /></View>
              <View style={styles.flexField}><FormField label="Responsável executante" value={responsavel} onChangeText={(value) => { setResponsavel(value); setErrors((prev) => ({ ...prev, alteracoes: null })); }} /></View>
            </View>
            <FormField label="Observações" value={observacoes} onChangeText={(value) => { setObservacoes(value); setErrors((prev) => ({ ...prev, alteracoes: null })); }} textarea numberOfLines={4} />
            <FormField label="Recomendações técnicas" value={recomendacoes} onChangeText={(value) => { setRecomendacoes(value); setErrors((prev) => ({ ...prev, alteracoes: null })); }} textarea numberOfLines={4} />
            <View ref={formValidation.registerField('proximaVisita')} collapsable={false}>
              <DatePicker label="Sugestão de próxima Visita" value={proximaVisita} onChange={(value) => { setProximaVisita(value); setErrors((prev) => ({ ...prev, proximaVisita: null, alteracoes: null })); }} minimumDate={new Date()} error={errors.proximaVisita} />
              {proximaVisita ? <TouchableOpacity style={styles.clearDateButton} onPress={() => { setProximaVisita(null); setErrors((prev) => ({ ...prev, proximaVisita: null, alteracoes: null })); }}><Ionicons name="close-circle-outline" size={18} color={colors.error} /><Text style={styles.clearDateText}>Remover próxima Visita informada</Text></TouchableOpacity> : null}
            </View>
          </SectionCard>

          <SectionCard title="Justificativa" subtitle="Explique por que o registro precisa ser corrigido." icon="chatbox-ellipses-outline">
            <View ref={formValidation.registerField('motivo')} collapsable={false}>
              <FormField label="Motivo da correção" required value={motivo} onChangeText={(value) => { setMotivo(value); setErrors((prev) => ({ ...prev, motivo: null })); }} textarea numberOfLines={4} error={errors.motivo} placeholder="Ex.: informação transcrita incorretamente durante o encerramento" />
            </View>
          </SectionCard>
        </View>
      </ScrollView>
      <FormFooter onCancel={() => navigation.goBack()} onSubmit={requestCorrection} submitLabel="Revisar correção" submitIcon="shield-checkmark-outline" loading={saving} />
      <ConfirmDialog visible={pendingChanges !== null} title="Registrar correção?" message={`${changeCount} ${changeCount === 1 ? 'campo será corrigido' : 'campos serão corrigidos'}. O conteúdo anterior permanecerá no histórico da Visita.`} confirmText="Registrar correção" cancelText="Continuar revisando" onConfirm={() => void executeCorrection()} onCancel={() => setPendingChanges(null)} />
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
  contextText: { color: colors.muted, fontSize: typography.fontSmall, lineHeight: 20, marginTop: 2 },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  flexField: { flex: 1, minWidth: 0 },
  formWarning: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, marginVertical: spacing.md, borderRadius: spacing.radiusSm, backgroundColor: semanticColors.warning.surface, borderWidth: 1, borderColor: semanticColors.warning.border },
  formWarningText: { flex: 1, color: semanticColors.warning.text, fontSize: typography.fontSmall, fontWeight: typography.weightSemibold },
  clearDateButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  clearDateText: { color: colors.error, fontSize: typography.fontSmall, fontWeight: typography.weightSemibold },
});
