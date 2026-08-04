import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import RadioCardGroup from '../components/RadioCardGroup';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import { Visita, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import {
  avaliarAcessoVisita,
  filtrarProdutoresPorAcesso,
  findFazendaById,
  podeEditarVisita,
} from '../utils/acessoControle';
import {
  VISITA_FOTOS_MVP_INFO,
  VISITA_OBJETIVO_OPTIONS,
  VISITA_STATUS_AGENDADA,
  buildVisitaFazendaOptions,
  buildVisitaAgendaUpdatePayload,
  combineVisitaDateTime,
  getVisitaFotoUri,
  getVisitaFluxoUi,
  getVisitaFormFazendaId,
  getVisitaFormFazendaLabel,
  removeVisitaFotoAtIndex,
  resolveVisitaEdicaoFazendaId,
} from '../utils/visitaFormCompat';
import {
  buildVisitaIdempotencyKey,
  getVisitaEstado,
  type VisitaActor,
} from '../utils/visitaLifecycleCompat';

const VISITA_FORM_ERROR_ORDER = ['fazendaId', 'dataVisita', 'horaVisita', 'objetivo', 'motivoReagendamento'] as const;

export default function EditarVisitaScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const formValidation = useFormValidationFocus(VISITA_FORM_ERROR_ORDER);
  const toast = useToast();
  const { user } = useAuth();

  const { visitaId, id } = route.params || {};
  const visitaRouteId = visitaId || id;

  // Estados do formulário
  const [fazendaId, setFazendaId] = useState('');
  const [dataVisita, setDataVisita] = useState(null);
  const [horaVisita, setHoraVisita] = useState(null);
  const [objetivo, setObjetivo] = useState('consultoria');
  const [observacoes, setObservacoes] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [clima, setClima] = useState('');
  const [proximaVisita, setProximaVisita] = useState(null);
  const [motivoReagendamento, setMotivoReagendamento] = useState('');
  const [fotos, setFotos] = useState<any[]>([]);
  const [removePhotoDialog, setRemovePhotoDialog] = useState<{
    visible: boolean;
    fotoIndex: number | null;
  }>({ visible: false, fotoIndex: null });

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fazendas, setFazendas] = useState([]);
  const [visitaOriginal, setVisitaOriginal] = useState(null);
  const [fazendaOriginal, setFazendaOriginal] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [notEditableReason, setNotEditableReason] = useState('');
  const [errors, setErrors] = useState<any>({});

  const fazendaOptions = useMemo(() => buildVisitaFazendaOptions(fazendas), [fazendas]);
  const fluxoInfo = getVisitaFluxoUi(VISITA_STATUS_AGENDADA);

  useEffect(() => {
    loadData();
  }, [visitaRouteId, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      setAccessDenied(false);
      setNotEditableReason('');

      if (!visitaRouteId) {
        throw new Error('Visita não informada');
      }

      const [visitaData, fazendasDisponiveis] = await Promise.all([
        Visita.get(visitaRouteId),
        Produtor.list(),
      ]);

      const acesso = avaliarAcessoVisita(user, visitaData, fazendasDisponiveis);

      if (acesso.status !== 'permitido' || !podeEditarVisita(user, visitaData, acesso.fazenda)) {
        setVisitaOriginal(null);
        setFazendaOriginal(null);
        setAccessDenied(true);
        toast.showWarning('Você não tem permissão para editar esta visita.');
        navigation.goBack();
        return;
      }

      if (getVisitaEstado(visitaData) !== 'agendada') {
        setVisitaOriginal(visitaData);
        setFazendaOriginal(acesso.fazenda);
        setAccessDenied(true);
        setNotEditableReason('Somente uma Visita agendada pode ter o agendamento editado.');
        return;
      }

      // Preencher formulário com dados da visita
      if (visitaData) {
        setVisitaOriginal(visitaData);
        setFazendaOriginal(acesso.fazenda);
        setAccessDenied(false);
        setFazendaId(getVisitaFormFazendaId(visitaData));
        
        const dataVisitaObj = new Date(visitaData.data_visita);
        setDataVisita(dataVisitaObj);
        setHoraVisita(dataVisitaObj);
        
        setObjetivo(visitaData.objetivo || 'consultoria');
        setObservacoes(visitaData.observacoes || '');
        setRecomendacoes(visitaData.recomendacoes || '');
        setClima(visitaData.clima || '');
        
        if (visitaData.proximaVisita) {
          setProximaVisita(new Date(visitaData.proximaVisita));
        }

        // Preservar o array legado exatamente como foi carregado.
        setFotos(Array.isArray(visitaData.fotos) ? visitaData.fotos : []);
      }

      const fazendasFiltradas = user ? filtrarProdutoresPorAcesso(fazendasDisponiveis, user) : fazendasDisponiveis;

      setFazendas(fazendasFiltradas);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.showError('Erro ao carregar visita');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!resolveVisitaEdicaoFazendaId(visitaOriginal, fazendaId)) {
      newErrors.fazendaId = 'Visita sem contexto de propriedade';
    }

    if (!dataVisita) {
      newErrors.dataVisita = 'Selecione a data da visita';
    }

    if (!horaVisita) {
      newErrors.horaVisita = 'Selecione o horário da visita';
    }

    if (!objetivo) {
      newErrors.objetivo = 'Selecione o objetivo da visita';
    }

    const nextDate = combineVisitaDateTime(dataVisita, horaVisita);
    const originalDate = visitaOriginal ? new Date(visitaOriginal.data_visita) : null;
    if (nextDate && nextDate.getTime() <= Date.now()) {
      newErrors.dataVisita = 'O reagendamento precisa ter data e hora futuras';
    }
    if (
      nextDate
      && originalDate
      && !Number.isNaN(originalDate.getTime())
      && nextDate.getTime() !== originalDate.getTime()
      && !motivoReagendamento.trim()
    ) {
      newErrors.motivoReagendamento = 'Informe o motivo do reagendamento';
    }

    setErrors(newErrors);
    formValidation.focusFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!podeEditarVisita(user, visitaOriginal, fazendaOriginal)) {
      toast.showWarning('Você não tem permissão para editar esta visita.');
      return;
    }

    if (!validateForm()) {
      toast.showError('Preencha todos os campos obrigatórios');
      return;
    }

    const fazendaContextoId = resolveVisitaEdicaoFazendaId(visitaOriginal, fazendaId);
    const fazendaSelecionadaData = findFazendaById(fazendas, fazendaContextoId) || fazendaOriginal;

    if (!fazendaSelecionadaData) {
      toast.showWarning('Propriedade selecionada não está disponível para edição.');
      return;
    }

    if (!podeEditarVisita(user, { ...visitaOriginal, fazenda_id: fazendaContextoId }, fazendaSelecionadaData)) {
      toast.showWarning('Você não tem permissão para editar visita nesta propriedade.');
      return;
    }

    setSaving(true);
    try {
      const visitaAtualizada = buildVisitaAgendaUpdatePayload({
        fazendaId: fazendaContextoId,
        dataVisita,
        horaVisita,
        objetivo,
        observacoes,
        recomendacoes,
        clima,
        proximaVisita,
        fotos,
      });

      if (!visitaAtualizada) {
        throw new Error('Não foi possível montar o payload da visita');
      }

      const actor: VisitaActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name,
        perfil: user?.perfil || '',
        propriedadeIds: [fazendaContextoId],
      };
      await Visita.updateAgenda(
        visitaRouteId,
        visitaAtualizada,
        actor,
        motivoReagendamento.trim() || undefined,
        buildVisitaIdempotencyKey(visitaRouteId, 'alterar_agendamento')
      );

      toast.showSuccess('Visita atualizada com sucesso!');
      
      // Voltar para tela de detalhes
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error: any) {
      console.error('Erro ao salvar visita:', error);
      toast.showError(error?.message || 'Erro ao atualizar visita');
    } finally {
      setSaving(false);
    }
  };

  const removerFoto = (fotoIndex: number) => {
    setRemovePhotoDialog({ visible: true, fotoIndex });
  };

  const confirmRemoverFoto = () => {
    const fotoIndex = removePhotoDialog.fotoIndex;

    if (fotoIndex == null) {
      setRemovePhotoDialog({ visible: false, fotoIndex: null });
      return;
    }

    setFotos(prev => removeVisitaFotoAtIndex(prev, fotoIndex));
    setRemovePhotoDialog({ visible: false, fotoIndex: null });
    toast.showSuccess('Imagem demonstrativa removida');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Visita" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied || !visitaOriginal) {
    return (
      <View style={styles.container}>
        <Header title="Editar Visita" showBack />
        <View style={styles.loadingContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.loadingText}>
            {notEditableReason || 'Você não tem permissão para editar esta visita.'}
          </Text>
        </View>
      </View>
    );
  }

  const fazendaContextoId = resolveVisitaEdicaoFazendaId(visitaOriginal, fazendaId);
  const fazendaContextoOption = fazendaOptions.find((option) => option.id === fazendaContextoId);
  const fazendaContextoLabel = getVisitaFormFazendaLabel(fazendaContextoOption, 'Propriedade vinculada não encontrada');

  return (
    <View style={styles.container}>
      <Header title="Editar Visita" showBack />

      <ScrollView 
        ref={formValidation.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <SectionCard title="Contexto" subtitle="A propriedade vinculada é preservada nesta edição.">
          <View ref={formValidation.registerField('fazendaId')} collapsable={false} style={styles.field}>
            <Text style={styles.label}>Propriedade vinculada</Text>
            <View style={[styles.picker, styles.lockedPicker, errors.fazendaId && styles.inputError]}>
              <Text style={styles.pickerText}>
                {fazendaContextoLabel}
              </Text>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            </View>
            <Text style={styles.contextHint}>A propriedade da visita não é alterada nesta edição.</Text>
            {errors.fazendaId ? <Text style={styles.errorText}>{errors.fazendaId}</Text> : null}
          </View>
        </SectionCard>

        <SectionCard title="Agenda" subtitle="A Visita permanece agendada; conclusão e cancelamento usam ações próprias no detalhe.">
          <InfoBox
            title="Estado protegido"
            message="Editar este formulário não muda o estado da Visita. Mudanças de data ou horário ficam registradas como reagendamento."
          />

          <View ref={formValidation.registerField('dataVisita')} collapsable={false}>
            <DatePicker
              label={fluxoInfo.dataLabel}
              required
              value={dataVisita}
              onChange={(date) => {
                setDataVisita(date);
                setErrors(prev => ({ ...prev, dataVisita: null }));
              }}
              placeholder="Selecione a data"
              error={errors.dataVisita}
              mode="date"
            />
          </View>

          <View ref={formValidation.registerField('horaVisita')} collapsable={false}>
            <DatePicker
              label="Horário da Visita"
              required
              value={horaVisita}
              onChange={(time) => {
                setHoraVisita(time);
                setErrors(prev => ({ ...prev, horaVisita: null }));
              }}
              placeholder="Selecione o horário"
              error={errors.horaVisita}
              mode="time"
            />
          </View>

          <View ref={formValidation.registerField('motivoReagendamento')} collapsable={false}>
            <FormField
              label="Motivo do reagendamento"
              value={motivoReagendamento}
              onChangeText={(value) => {
                setMotivoReagendamento(value);
                setErrors(prev => ({ ...prev, motivoReagendamento: null }));
              }}
              placeholder="Obrigatório ao alterar data ou horário"
              textarea
              numberOfLines={3}
              error={errors.motivoReagendamento}
            />
          </View>
        </SectionCard>

        <SectionCard title="Registro técnico" subtitle="Atualize objetivo, diagnóstico e recomendações da visita.">
          <View ref={formValidation.registerField('objetivo')} collapsable={false} style={styles.field}>
            <Text style={styles.label}>
              Objetivo <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={VISITA_OBJETIVO_OPTIONS.map((obj) => ({
                value: obj.value,
                label: obj.label,
              }))}
              value={objetivo}
              onChange={(value) => {
                setObjetivo(value);
                setErrors(prev => ({ ...prev, objetivo: null }));
              }}
              error={errors.objetivo}
            />
          </View>

          <FormField
            label="Observações"
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Descreva detalhes da visita..."
            textarea
            numberOfLines={4}
          />

          <FormField
            label="Recomendações Técnicas"
            value={recomendacoes}
            onChangeText={setRecomendacoes}
            placeholder="Recomendações técnicas para a propriedade..."
            textarea
            numberOfLines={4}
          />

          <FormField
            label={fluxoInfo.climaLabel}
            value={clima}
            onChangeText={setClima}
            placeholder="Ex: Ensolarado, parcialmente nublado..."
          />

          <DatePicker
            label="Sugestão de Próxima Visita"
            value={proximaVisita}
            onChange={setProximaVisita}
            placeholder="Selecione uma data (opcional)"
            minimumDate={new Date()}
            mode="date"
          />
        </SectionCard>

        <SectionCard title="Fotos" subtitle="As imagens demonstrativas existentes podem ser consultadas ou removidas explicitamente.">
          <InfoBox
            title={VISITA_FOTOS_MVP_INFO.title}
            message={VISITA_FOTOS_MVP_INFO.message}
            style={styles.photoInfoBox}
          />
          {fotos.length > 0 && (
            <View style={styles.fotosGrid}>
              {fotos.map((foto, index) => {
                const fotoUri = getVisitaFotoUri(foto);

                return (
                  <View key={`${fotoUri || 'imagem'}_${index}`} style={styles.fotoContainer}>
                    {fotoUri ? (
                      <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
                    ) : (
                      <View style={[styles.fotoPreview, styles.fotoIndisponivel]}>
                        <Ionicons name="image-outline" size={24} color={colors.muted} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.fotoRemover}
                      onPress={() => removerFoto(index)}
                      accessibilityLabel={`Remover imagem demonstrativa ${index + 1}`}
                    >
                      <Ionicons name="close-circle" size={22} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
          {fotos.length > 0 && (
            <Text style={styles.fotosCount}>
              {fotos.length} {fotos.length === 1 ? 'imagem demonstrativa' : 'imagens demonstrativas'} no registro
            </Text>
          )}
        </SectionCard>

        <InfoBox message={fluxoInfo.infoText} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar Alterações"
        loading={saving}
      />

      <ConfirmDialog
        visible={removePhotoDialog.visible}
        title="Remover imagem"
        message="Deseja remover esta imagem demonstrativa do registro?"
        type="danger"
        confirmText="Remover"
        cancelText="Cancelar"
        onConfirm={confirmRemoverFoto}
        onCancel={() => setRemovePhotoDialog({ visible: false, fotoIndex: null })}
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
  },
  placeholder: {
    color: colors.muted,
  },
  dropdownContainer: {
    marginTop: spacing.sm,
    maxHeight: 250,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.card,
    ...shadows.md,
  },
  dropdown: {
    maxHeight: 250,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.accent,
  },
  dropdownItemText: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dropdownItemTextSelected: {
    color: colors.primary,
  },
  dropdownItemSubtext: {
    fontSize: typography.fontSmall,
    color: colors.muted,
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
  radio: {
    width: 20,
    height: 20,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
  },
  radioLabelSelected: {
    fontWeight: '600',
    color: colors.primary,
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
  photoInfoBox: {
    marginBottom: spacing.sm,
  },
  fotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.sm,
  },
  fotoContainer: {
    position: 'relative',
    width: 90,
    height: 90,
    borderRadius: spacing.radiusSm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fotoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: spacing.radiusSm,
  },
  fotoIndisponivel: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.borderLight,
  },
  fotoRemover: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.whiteTranslucent,
    borderRadius: spacing.radius,
  },
  fotosCount: {
    marginTop: spacing.xs,
    fontSize: typography.fontSmall,
    color: colors.textLight,
    fontWeight: '500',
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
});
