import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Visita } from '../api/mock';
import { colors, semanticColors, shadows, spacing, typography } from '../theme';
import DatePicker from './DatePicker';
import FormField from './FormField';
import RadioCardGroup from './RadioCardGroup';
import { useToast } from './Toast';
import { combineVisitaDateTime, getVisitaObjetivoLabel } from '../utils/visitaFormCompat';
import {
  VISITA_CANCELAMENTO_MOTIVOS,
  buildVisitaIdempotencyKey,
  getVisitaEstado,
  type VisitaActor,
  type VisitaCancelamentoMotivo,
  type VisitaCommand,
} from '../utils/visitaLifecycleCompat';

type ActionMode = 'concluir' | 'cancelar' | 'complemento' | 'correcao' | 'anular';

const CORRECTION_FIELDS = [
  { value: 'resumo_conclusao', label: 'Resumo da conclusão' },
  { value: 'observacoes', label: 'Observações' },
  { value: 'recomendacoes', label: 'Recomendações' },
  { value: 'clima', label: 'Condições climáticas' },
  { value: 'tecnico_responsavel', label: 'Responsável executante' },
] as const;

const ACTION_LABELS: Record<ActionMode, string> = {
  concluir: 'Concluir Visita',
  cancelar: 'Cancelar Visita',
  complemento: 'Adicionar complemento',
  correcao: 'Corrigir registro',
  anular: 'Anular Visita',
};

const formatContextDate = (value: unknown): string => {
  const timestamp = new Date(value as any).getTime();
  if (Number.isNaN(timestamp)) return 'Data não informada';
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function VisitaLifecycleActions({
  visita,
  user,
  fazendaId,
  fazendaLabel,
  onUpdated,
  onScheduleFromCancelled,
}: {
  visita: any;
  user: any;
  fazendaId: string;
  fazendaLabel: string;
  onUpdated: (visita: any) => void;
  onScheduleFromCancelled: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<ActionMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [inicioData, setInicioData] = useState<Date | null>(null);
  const [inicioHora, setInicioHora] = useState<Date | null>(null);
  const [resumo, setResumo] = useState('');
  const [motivoCodigo, setMotivoCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [complemento, setComplemento] = useState('');
  const [visibleToProducer, setVisibleToProducer] = useState(true);
  const [correctionField, setCorrectionField] = useState('resumo_conclusao');
  const [correctionValue, setCorrectionValue] = useState('');
  const estado = getVisitaEstado(visita);
  const correctionLabel = useMemo(
    () => CORRECTION_FIELDS.find((item) => item.value === correctionField)?.label || 'Campo',
    [correctionField]
  );

  const resetAndClose = () => {
    if (saving) return;
    setMode(null);
    setInicioData(null);
    setInicioHora(null);
    setResumo('');
    setMotivoCodigo('');
    setMotivo('');
    setComplemento('');
    setVisibleToProducer(true);
    setCorrectionField('resumo_conclusao');
    setCorrectionValue('');
  };

  const open = (nextMode: ActionMode) => {
    if (nextMode === 'concluir') {
      const now = new Date();
      setInicioData(now);
      setInicioHora(now);
    }
    setMode(nextMode);
  };

  const actor: VisitaActor = {
    usuarioId: String(user?.id || '').trim(),
    nome: user?.nome || user?.full_name,
    perfil: user?.perfil || '',
    propriedadeIds: [fazendaId],
  };

  const buildCommand = (): VisitaCommand => {
    const versaoBase = Number(visita?.versao_atual);
    const chaveIdempotencia = buildVisitaIdempotencyKey(visita?.id, String(mode));
    if (mode === 'concluir') {
      const inicioReal = combineVisitaDateTime(inicioData, inicioHora);
      if (!inicioReal) throw new Error('Informe a data e o horário de início real.');
      if (!resumo.trim()) throw new Error('Informe o resumo operacional da conclusão.');
      return {
        tipo: 'concluir',
        versaoBase,
        chaveIdempotencia,
        inicioRealEm: inicioReal.toISOString(),
        resumo: resumo.trim(),
        responsavelExecutanteNome: visita?.tecnico_responsavel,
      };
    }
    if (mode === 'cancelar') {
      if (!motivoCodigo) throw new Error('Selecione o motivo do cancelamento.');
      if (motivoCodigo === 'outro' && !motivo.trim()) {
        throw new Error('Descreva o outro motivo do cancelamento.');
      }
      return {
        tipo: 'cancelar',
        versaoBase,
        chaveIdempotencia,
        motivoCodigo: motivoCodigo as VisitaCancelamentoMotivo,
        motivoDescricao: motivo.trim() || undefined,
      };
    }
    if (mode === 'complemento') {
      if (!complemento.trim()) throw new Error('Informe o complemento técnico.');
      return {
        tipo: 'adicionar_complemento',
        versaoBase,
        chaveIdempotencia,
        texto: complemento.trim(),
        visivelParaProdutor: visibleToProducer,
      };
    }
    if (mode === 'correcao') {
      if (!correctionValue.trim()) throw new Error(`Informe o novo valor de ${correctionLabel}.`);
      if (!motivo.trim()) throw new Error('Informe o motivo da correção.');
      return {
        tipo: 'corrigir',
        versaoBase,
        chaveIdempotencia,
        motivo: motivo.trim(),
        alteracoes: { [correctionField]: correctionValue.trim() },
      };
    }
    if (mode === 'anular') {
      if (!motivo.trim()) throw new Error('Informe a justificativa da anulação.');
      return {
        tipo: 'anular',
        versaoBase,
        chaveIdempotencia,
        motivo: motivo.trim(),
      };
    }
    throw new Error('Selecione uma ação da Visita.');
  };

  const execute = async () => {
    try {
      const command = buildCommand();
      setSaving(true);
      const updated = await Visita.command(visita.id, command, actor);
      onUpdated(updated);
      toast.showSuccess(`${ACTION_LABELS[mode!]} registrada no histórico.`);
      setSaving(false);
      resetAndClose();
    } catch (error: any) {
      setSaving(false);
      toast.showError(error?.message || 'Não foi possível executar a ação.');
    }
  };

  const contextSummary = [
    fazendaLabel,
    formatContextDate(visita?.agendada_para || visita?.data_visita),
    getVisitaObjetivoLabel(visita?.objetivo),
    visita?.tecnico_responsavel,
  ].filter(Boolean).join(' • ');

  return (
    <>
      <View style={styles.actions}>
        {estado === 'agendada' ? (
          <>
            <ActionButton icon="checkmark-circle-outline" label="Concluir" onPress={() => open('concluir')} />
            <ActionButton icon="close-circle-outline" label="Cancelar" danger onPress={() => open('cancelar')} />
          </>
        ) : null}
        {estado === 'realizada' ? (
          <>
            <ActionButton icon="add-circle-outline" label="Complementar" onPress={() => open('complemento')} />
            <ActionButton icon="create-outline" label="Corrigir" onPress={() => open('correcao')} />
            <ActionButton icon="close-circle-outline" label="Anular" danger onPress={() => open('anular')} />
          </>
        ) : null}
        {estado === 'cancelada' ? (
          <ActionButton icon="calendar-outline" label="Agendar nova Visita" onPress={onScheduleFromCancelled} />
        ) : null}
      </View>

      <Modal visible={Boolean(mode)} transparent animationType="fade" onRequestClose={resetAndClose}>
        <Pressable style={styles.overlay} onPress={resetAndClose}>
          <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>{mode ? ACTION_LABELS[mode] : ''}</Text>
              <Text style={styles.subtitle}>
                Esta ação registra estado, autor, data e versão no histórico local da Visita.
              </Text>

              {(mode === 'concluir' || mode === 'cancelar') ? (
                <View style={styles.contextBox}>
                  <Text style={styles.contextTitle}>Revise o contexto</Text>
                  <Text style={styles.contextText}>{contextSummary}</Text>
                </View>
              ) : null}

              {mode === 'concluir' ? (
                <>
                  <DatePicker
                    label="Data de início real"
                    required
                    value={inicioData}
                    onChange={setInicioData}
                    maximumDate={new Date()}
                    mode="date"
                  />
                  <DatePicker
                    label="Horário de início real"
                    required
                    value={inicioHora}
                    onChange={setInicioHora}
                    mode="time"
                  />
                  <FormField
                    label="Resumo operacional"
                    required
                    value={resumo}
                    onChangeText={setResumo}
                    placeholder="Descreva o que foi realizado na Visita"
                    textarea
                    numberOfLines={4}
                  />
                </>
              ) : null}

              {mode === 'cancelar' ? (
                <>
                  <Text style={styles.label}>Motivo do cancelamento</Text>
                  <RadioCardGroup
                    options={VISITA_CANCELAMENTO_MOTIVOS.map((item) => ({
                      value: item.value,
                      label: item.label,
                    }))}
                    value={motivoCodigo}
                    onChange={setMotivoCodigo}
                  />
                  {motivoCodigo === 'outro' ? (
                    <FormField
                      label="Descrição do motivo"
                      required
                      value={motivo}
                      onChangeText={setMotivo}
                      textarea
                      numberOfLines={3}
                    />
                  ) : null}
                </>
              ) : null}

              {mode === 'complemento' ? (
                <>
                  <FormField
                    label="Complemento técnico"
                    required
                    value={complemento}
                    onChangeText={setComplemento}
                    textarea
                    numberOfLines={4}
                  />
                  <Text style={styles.label}>Visibilidade do complemento</Text>
                  <RadioCardGroup
                    options={[
                      { value: 'visivel', label: 'Liberado ao produtor' },
                      { value: 'interno', label: 'Somente equipe' },
                    ]}
                    value={visibleToProducer ? 'visivel' : 'interno'}
                    onChange={(value) => setVisibleToProducer(value === 'visivel')}
                  />
                </>
              ) : null}

              {mode === 'correcao' ? (
                <>
                  <Text style={styles.label}>Campo a corrigir</Text>
                  <RadioCardGroup
                    options={CORRECTION_FIELDS.map((item) => ({ value: item.value, label: item.label }))}
                    value={correctionField}
                    onChange={(value) => {
                      setCorrectionField(value);
                      setCorrectionValue('');
                    }}
                  />
                  <FormField label="Novo valor" required value={correctionValue} onChangeText={setCorrectionValue} textarea numberOfLines={3} />
                  <FormField label="Motivo da correção" required value={motivo} onChangeText={setMotivo} textarea numberOfLines={3} />
                </>
              ) : null}

              {mode === 'anular' ? (
                <FormField
                  label="Justificativa da anulação"
                  required
                  value={motivo}
                  onChangeText={setMotivo}
                  textarea
                  numberOfLines={4}
                />
              ) : null}
            </ScrollView>

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.cancelButton} disabled={saving} onPress={resetAndClose}>
                <Text style={styles.cancelText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} disabled={saving} onPress={() => void execute()}>
                {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.confirmText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ActionButton({ icon, label, onPress, danger = false }: any) {
  return (
    <TouchableOpacity style={[styles.actionButton, danger && styles.dangerButton]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.error : colors.primary} />
      <Text style={[styles.actionText, danger && styles.dangerText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1,
    borderColor: colors.primary, borderRadius: spacing.radiusSm, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, backgroundColor: semanticColors.primary.surface,
  },
  dangerButton: { borderColor: colors.error, backgroundColor: semanticColors.error.surface },
  actionText: { fontSize: typography.fontSmall, fontWeight: '700', color: colors.primary },
  dangerText: { color: colors.error },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  dialog: { maxHeight: '90%', backgroundColor: colors.card, borderRadius: spacing.radius, padding: spacing.lg, ...shadows.lg },
  title: { fontSize: typography.fontTitle, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: typography.fontSmall, color: colors.muted, lineHeight: 19, marginTop: spacing.xs, marginBottom: spacing.md },
  label: { fontSize: typography.fontBody, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  contextBox: { backgroundColor: semanticColors.info.surface, borderRadius: spacing.radiusSm, padding: spacing.md, marginBottom: spacing.lg },
  contextTitle: { fontSize: typography.fontSmall, fontWeight: '700', color: semanticColors.info.text, marginBottom: spacing.xs },
  contextText: { fontSize: typography.fontSmall, lineHeight: 19, color: colors.text },
  dialogActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cancelButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: spacing.radiusSm },
  confirmButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: spacing.radiusSm },
  cancelText: { fontWeight: '700', color: colors.text },
  confirmText: { fontWeight: '700', color: colors.white },
});
