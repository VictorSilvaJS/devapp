import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { CadernoCampo } from '../api/mock';
import { colors, semanticColors, shadows, spacing, typography } from '../theme';
import FormField from './FormField';
import RadioCardGroup from './RadioCardGroup';
import { useToast } from './Toast';
import {
  getCadernoEstado,
  type CadernoActor,
  type CadernoCommand,
} from '../utils/cadernoLifecycleCompat';

type ActionMode = 'complemento' | 'visibilidade' | 'arquivar' | 'reativar' | 'anular';

const ACTION_LABELS: Record<ActionMode, string> = {
  complemento: 'Complementar',
  visibilidade: 'Alterar visibilidade',
  arquivar: 'Arquivar',
  reativar: 'Reativar',
  anular: 'Anular',
};

export default function CadernoAuditActions({
  registro,
  user,
  fazendaId,
  onUpdated,
}: {
  registro: any;
  user: any;
  fazendaId: string;
  onUpdated: (registro: any) => void;
}) {
  const navigation = useNavigation<any>();
  const toast = useToast();
  const [mode, setMode] = useState<ActionMode | null>(null);
  const [texto, setTexto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [visibleToProducer, setVisibleToProducer] = useState(true);
  const [saving, setSaving] = useState(false);
  const estado = getCadernoEstado(registro);

  const resetAndClose = () => {
    if (saving) return;
    setMode(null);
    setTexto('');
    setMotivo('');
    setVisibleToProducer(true);
  };

  const open = (nextMode: ActionMode) => {
    setMode(nextMode);
    setVisibleToProducer(
      nextMode === 'visibilidade' ? registro?.visivel_para_produtor !== false : true
    );
  };

  const buildCommand = (): CadernoCommand => {
    const versaoBase = Number(registro?.versao_atual);
    if (mode === 'complemento') {
      return {
        tipo: 'adicionar_complemento',
        versaoBase,
        texto,
        visivelParaProdutor: visibleToProducer,
      };
    }
    if (mode === 'visibilidade') {
      return {
        tipo: 'alterar_visibilidade',
        versaoBase,
        visivelParaProdutor: visibleToProducer,
        motivo,
      };
    }
    if (mode === 'arquivar' || mode === 'reativar' || mode === 'anular') {
      return { tipo: mode, versaoBase, motivo };
    }
    throw new Error('Selecione uma ação auditável.');
  };

  const execute = async () => {
    try {
      const command = buildCommand();
      if (mode === 'complemento' && !texto.trim()) throw new Error('Informe o complemento técnico.');
      if (['arquivar', 'reativar', 'anular'].includes(String(mode)) && !motivo.trim()) {
        throw new Error('Informe o motivo da ação.');
      }
      const actor: CadernoActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name,
        perfil: user?.perfil || '',
        propriedadeIds: [fazendaId],
      };
      setSaving(true);
      const updated = await CadernoCampo.command(registro.id, command, actor);
      onUpdated(updated);
      toast.showSuccess(`${ACTION_LABELS[mode!]} registrado no histórico.`);
      setSaving(false);
      resetAndClose();
    } catch (error: any) {
      setSaving(false);
      toast.showError(error?.message || 'Não foi possível executar a ação.');
    }
  };

  return (
    <>
      <View style={styles.actions}>
        {estado === 'registrado' ? (
          <>
            <ActionButton icon="add-circle-outline" label="Complementar" onPress={() => open('complemento')} />
            <ActionButton icon="create-outline" label="Corrigir" onPress={() => navigation.navigate('CorrigirCaderno', { cadernoId: registro.id })} />
            <ActionButton icon="eye-outline" label="Visibilidade" onPress={() => open('visibilidade')} />
            <ActionButton icon="archive-outline" label="Arquivar" onPress={() => open('arquivar')} />
            <ActionButton icon="close-circle-outline" label="Anular" danger onPress={() => open('anular')} />
          </>
        ) : null}
        {estado === 'arquivado' ? (
          <ActionButton icon="refresh-outline" label="Reativar" onPress={() => open('reativar')} />
        ) : null}
      </View>

      <Modal visible={Boolean(mode)} transparent animationType="fade" onRequestClose={resetAndClose}>
        <Pressable style={styles.overlay} onPress={resetAndClose}>
          <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.title}>{mode ? ACTION_LABELS[mode] : ''}</Text>
              <Text style={styles.subtitle}>
                A ação registra autor, data, versão e justificativa no histórico do Caderno.
              </Text>

              {mode === 'complemento' ? (
                <>
                  <FormField label="Complemento técnico" required value={texto} onChangeText={setTexto} textarea numberOfLines={4} />
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

              {mode === 'visibilidade' ? (
                <>
                  <Text style={styles.label}>Nova visibilidade</Text>
                  <RadioCardGroup
                    options={[
                      { value: 'visivel', label: 'Liberado ao produtor' },
                      { value: 'interno', label: 'Somente equipe' },
                    ]}
                    value={visibleToProducer ? 'visivel' : 'interno'}
                    onChange={(value) => setVisibleToProducer(value === 'visivel')}
                  />
                  <FormField label="Motivo (opcional)" value={motivo} onChangeText={setMotivo} textarea numberOfLines={3} />
                </>
              ) : null}

              {mode === 'arquivar' || mode === 'reativar' || mode === 'anular' ? (
                <FormField label="Motivo" required value={motivo} onChangeText={setMotivo} textarea numberOfLines={4} />
              ) : null}
            </ScrollView>

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.cancelButton} disabled={saving} onPress={resetAndClose}>
                <Text style={styles.cancelText}>Cancelar</Text>
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
  dangerButton: { borderColor: colors.error, backgroundColor: colors.error + '12' },
  actionText: { fontSize: typography.fontSmall, fontWeight: '700', color: colors.primary },
  dangerText: { color: colors.error },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg },
  dialog: { maxHeight: '88%', backgroundColor: colors.card, borderRadius: spacing.radius, padding: spacing.lg, ...shadows.lg },
  title: { fontSize: typography.fontTitle, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: typography.fontSmall, color: colors.muted, lineHeight: 19, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { fontSize: typography.fontBody, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  dialogActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cancelButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: spacing.radiusSm },
  confirmButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, borderRadius: spacing.radiusSm },
  cancelText: { fontWeight: '700', color: colors.text },
  confirmText: { fontWeight: '700', color: colors.white },
});
