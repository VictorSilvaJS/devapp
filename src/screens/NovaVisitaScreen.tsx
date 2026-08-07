import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  filtrarProdutoresPorAcesso,
  findFazendaById,
  podeCriarVisita,
  podeCriarVisitaEmFazenda,
} from '../utils/acessoControle';
import {
  VISITA_FLUXOS_OPERACIONAIS,
  VISITA_FOTOS_MVP_INFO,
  VISITA_OBJETIVO_OPTIONS,
  VISITA_STATUS_AGENDADA,
  VISITA_STATUS_REALIZADA,
  buildVisitaFazendaOptions,
  buildVisitaPayload,
  combineVisitaDateTime,
  findVisitaFazendaOption,
  getVisitaFluxoUi,
  getVisitaFormFazendaLabel,
} from '../utils/visitaFormCompat';
import { buildVisitaIdempotencyKey, type VisitaActor } from '../utils/visitaLifecycleCompat';
import {
  MAX_VISITA_PHOTOS,
  VisitaPhotoLocal,
  captureVisitaPhoto,
  deleteVisitaPhotoLocal,
  selectVisitaPhotos,
} from '../services/VisitaPhotoService';

const VISITA_FORM_ERROR_ORDER = ['fazendaId', 'dataVisita', 'horaVisita', 'objetivo', 'observacoes'] as const;

export default function NovaVisitaScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const routeFazendaId = route.params?.fazendaId || route.params?.produtorId;
  const visitaOrigemId = route.params?.visitaOrigemId;

  // Estados do formulário
  const [fazendaId, setFazendaId] = useState('');
  const [dataVisita, setDataVisita] = useState(null);
  const [horaVisita, setHoraVisita] = useState(null);
  const [objetivo, setObjetivo] = useState('consultoria');
  const [status, setStatus] = useState(VISITA_STATUS_AGENDADA);
  const [observacoes, setObservacoes] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [clima, setClima] = useState('');
  const [proximaVisita, setProximaVisita] = useState(null);
  const [fotos, setFotos] = useState<VisitaPhotoLocal[]>([]);
  const [photoAction, setPhotoAction] = useState<'camera' | 'galeria' | null>(null);
  // Estados de controle
  const [loading, setLoading] = useState(false);
  const [fazendas, setFazendas] = useState([]);
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [errors, setErrors] = useState<any>({});
  const [contextAccessDenied, setContextAccessDenied] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const photoUrisRef = useRef<string[]>([]);
  const photosCommittedRef = useRef(false);
  const formValidation = useFormValidationFocus(VISITA_FORM_ERROR_ORDER);

  // Dropdown de fazendas
  const [showFazendaPicker, setShowFazendaPicker] = useState(false);
  const fazendaOptions = useMemo(() => buildVisitaFazendaOptions(fazendas), [fazendas]);
  const fazendaSelecionada = useMemo(
    () => findVisitaFazendaOption(fazendaOptions, fazendaId),
    [fazendaOptions, fazendaId]
  );
  const canCreateVisit = podeCriarVisita(user);
  const fluxoInfo = getVisitaFluxoUi(status);
  const semFazendasAutorizadas = !loadingFazendas && fazendaOptions.length === 0;

  useEffect(() => {
    loadFazendas();
  }, [user, routeFazendaId]);

  useEffect(() => () => {
    if (!photosCommittedRef.current) {
      photoUrisRef.current.forEach((uri) => {
        void deleteVisitaPhotoLocal(uri).catch(() => undefined);
      });
    }
  }, []);

  const loadFazendas = async () => {
    setLoadingFazendas(true);
    setContextAccessDenied(false);
    try {
      if (!podeCriarVisita(user)) {
        setFazendaId('');
        setFazendas([]);
        return;
      }

      const fazendasDisponiveis = await Produtor.list();

      const fazendasFiltradas = user ? filtrarProdutoresPorAcesso(fazendasDisponiveis, user) : fazendasDisponiveis;

      if (routeFazendaId) {
        const fazendaRota = findFazendaById(fazendasFiltradas, routeFazendaId);

        if (!podeCriarVisitaEmFazenda(user, fazendaRota)) {
          setFazendaId('');
          setFazendas([]);
          setContextAccessDenied(true);
          setErrors((prev) => ({
            ...prev,
            fazendaId: 'A propriedade informada não está disponível no seu escopo.',
          }));
          toast.showWarning('Você não tem permissão para criar visita nesta propriedade.');
          return;
        }

        setFazendaId(routeFazendaId);
        setErrors((prev) => ({ ...prev, fazendaId: null }));
      }
      
      setFazendas(fazendasFiltradas);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
      toast.showError('Erro ao carregar propriedades');
    } finally {
      setLoadingFazendas(false);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!fazendaId) {
      newErrors.fazendaId = 'Selecione uma propriedade';
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

    if (status === VISITA_STATUS_REALIZADA && !observacoes.trim()) {
      newErrors.observacoes = 'Informe o resumo operacional da visita realizada';
    }

    const dataCompleta = combineVisitaDateTime(dataVisita, horaVisita);

    if (dataCompleta) {
      const agora = new Date();

      if (status === VISITA_STATUS_AGENDADA && dataCompleta.getTime() <= agora.getTime()) {
        newErrors.dataVisita = 'Visita agendada precisa ter data e hora futuras';
      }

      if (status === VISITA_STATUS_REALIZADA && dataCompleta.getTime() > agora.getTime()) {
        newErrors.dataVisita = 'Visita realizada não pode ter data e hora futuras';
      }
    }

    setErrors(newErrors);
    formValidation.focusFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!podeCriarVisita(user)) {
      toast.showWarning('Você não tem permissão para criar visitas.');
      return;
    }

    if (!validateForm()) {
      toast.showError('Preencha todos os campos obrigatórios');
      return;
    }

    const fazendaSelecionadaData = findFazendaById(fazendas, fazendaId);

    if (!podeCriarVisitaEmFazenda(user, fazendaSelecionadaData)) {
      toast.showWarning('Você não tem permissão para criar visita nesta propriedade.');
      return;
    }

    setShowConfirmDialog(true);
  };

  const appendPhotos = (items: VisitaPhotoLocal[]) => {
    if (items.length === 0) return;
    photoUrisRef.current = [...photoUrisRef.current, ...items.map((item) => item.uri)];
    setFotos((current) => [...current, ...items].slice(0, MAX_VISITA_PHOTOS));
  };

  const handleCapturePhoto = async () => {
    setPhotoAction('camera');
    try {
      appendPhotos(await captureVisitaPhoto(fotos.length));
    } catch (error: any) {
      toast.showError(error?.message || 'Não foi possível registrar a foto pela câmera.');
    } finally {
      setPhotoAction(null);
    }
  };

  const handleSelectPhotos = async () => {
    setPhotoAction('galeria');
    try {
      appendPhotos(await selectVisitaPhotos(fotos.length));
    } catch (error: any) {
      toast.showError(error?.message || 'Não foi possível selecionar as fotos.');
    } finally {
      setPhotoAction(null);
    }
  };

  const handleRemovePhoto = async (index: number) => {
    const photo = fotos[index];
    if (!photo) return;
    setFotos((current) => current.filter((_, itemIndex) => itemIndex !== index));
    photoUrisRef.current = photoUrisRef.current.filter((uri) => uri !== photo.uri);
    await deleteVisitaPhotoLocal(photo.uri).catch(() => undefined);
  };

  const confirmSave = async () => {
    const fazendaSelecionadaData = findFazendaById(fazendas, fazendaId);
    if (!podeCriarVisitaEmFazenda(user, fazendaSelecionadaData)) {
      setShowConfirmDialog(false);
      toast.showWarning('Você não tem permissão para criar visita nesta propriedade.');
      return;
    }

    setLoading(true);
    try {
      const novaVisita = buildVisitaPayload({
        propriedadeId: fazendaId,
        dataVisita,
        horaVisita,
        objetivo,
        observacoes,
        recomendacoes,
        clima,
        proximaVisita,
        status,
        fotos,
        tecnicoResponsavel: user?.nome || user?.full_name || 'Sistema',
        visitaOrigemId,
      });

      if (!novaVisita) {
        throw new Error('Não foi possível montar o payload da visita');
      }

      const actor: VisitaActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name,
        perfil: user?.perfil || '',
        propriedadeIds: [fazendaId],
      };
      const idempotencyKey = buildVisitaIdempotencyKey(visitaOrigemId || 'nova', status);

      if (visitaOrigemId) {
        await Visita.createFromCancelled(visitaOrigemId, novaVisita, actor, idempotencyKey);
      } else if (status === VISITA_STATUS_REALIZADA) {
        await Visita.registerCompleted(novaVisita, actor, idempotencyKey);
      } else {
        await Visita.createScheduled(novaVisita, actor, idempotencyKey);
      }

      photosCommittedRef.current = true;
      toast.showSuccess(fluxoInfo.successMessage);
      setShowConfirmDialog(false);
      
      // Voltar para tela de visitas
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error: any) {
      console.error('Erro ao salvar visita:', error);
      toast.showError(error?.message || fluxoInfo.errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!canCreateVisit) {
    return (
      <View style={styles.container}>
        <Header title="Nova Visita" showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedText}>Acesso restrito</Text>
          <Text style={styles.blockedSubtext}>Você não tem permissão para criar visitas técnicas.</Text>
        </View>
      </View>
    );
  }

  if (contextAccessDenied) {
    return (
      <View style={styles.container}>
        <Header title="Nova Visita" showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedText}>Acesso restrito</Text>
          <Text style={styles.blockedSubtext}>
            Você não tem permissão para criar visita nesta propriedade.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Nova Visita" showBack />

      <ScrollView 
        ref={formValidation.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <SectionCard title="Contexto" subtitle="Defina a propriedade vinculada à visita técnica.">
          <View ref={formValidation.registerField('fazendaId')} collapsable={false} style={styles.field}>
            <Text style={styles.label}>
              Propriedade <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.picker, errors.fazendaId && styles.inputError]}
              onPress={() => setShowFazendaPicker(!showFazendaPicker)}
              disabled={loadingFazendas || semFazendasAutorizadas || !!routeFazendaId}
            >
              <Text style={[styles.pickerText, !fazendaId && styles.placeholder]}>
                {loadingFazendas ? 'Carregando...' : getVisitaFormFazendaLabel(fazendaSelecionada)}
              </Text>
              <Ionicons
                name={routeFazendaId ? 'lock-closed-outline' : showFazendaPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
            {errors.fazendaId && (
              <Text style={styles.errorText}>{errors.fazendaId}</Text>
            )}
            {semFazendasAutorizadas && (
              <Text style={styles.errorText}>Nenhuma propriedade autorizada disponível para nova visita.</Text>
            )}
            {routeFazendaId && !contextAccessDenied && (
              <Text style={styles.contextHint}>Propriedade definida pelo contexto da propriedade.</Text>
            )}

            {showFazendaPicker && !routeFazendaId && (
              <View style={styles.dropdownContainer}>
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  {fazendaOptions.map((fazenda) => (
                    <TouchableOpacity
                      key={fazenda.id}
                      style={[
                        styles.dropdownItem,
                        fazendaId === fazenda.id && styles.dropdownItemSelected
                      ]}
                      onPress={() => {
                        setFazendaId(fazenda.id);
                        setShowFazendaPicker(false);
                        setErrors(prev => ({ ...prev, fazendaId: null }));
                      }}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        fazendaId === fazenda.id && styles.dropdownItemTextSelected
                      ]}>
                        {fazenda.fazendaNome}
                      </Text>
                      <Text style={styles.dropdownItemSubtext}>
                        {[fazenda.titularNome, [fazenda.cidade, fazenda.estado].filter(Boolean).join('/')].filter(Boolean).join(' • ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </SectionCard>

        <SectionCard title="Agenda" subtitle="Informe o fluxo operacional, data e horário da visita.">
          {!visitaOrigemId ? <View style={styles.field}>
            <Text style={styles.label}>
              Fluxo da Visita <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={VISITA_FLUXOS_OPERACIONAIS.map((opt) => ({
                value: opt.value,
                label: opt.label,
                description: opt.description,
              }))}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setErrors(prev => ({ ...prev, dataVisita: null }));
              }}
            />
          </View> : (
            <InfoBox
              title="Nova Visita vinculada"
              message="A Visita cancelada permanece no histórico. Este formulário criará um novo agendamento na mesma Propriedade."
            />
          )}

          <View ref={formValidation.registerField('dataVisita')} collapsable={false}>
            <DatePicker
              label={fluxoInfo.dataLabel}
              required
              value={dataVisita}
              onChange={(date) => {
                setDataVisita(date);
                setErrors(prev => ({ ...prev, dataVisita: null }));
              }}
              placeholder={fluxoInfo.dataPlaceholder}
              error={errors.dataVisita}
              minimumDate={status === VISITA_STATUS_AGENDADA ? new Date() : undefined}
              maximumDate={status === VISITA_STATUS_REALIZADA ? new Date() : undefined}
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
        </SectionCard>

        <SectionCard title="Registro técnico" subtitle="Descreva objetivo, diagnóstico e recomendações da visita.">
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

          <View ref={formValidation.registerField('observacoes')} collapsable={false}>
          <FormField
            label={status === VISITA_STATUS_REALIZADA ? 'Resumo operacional' : 'Observações'}
            required={status === VISITA_STATUS_REALIZADA}
            value={observacoes}
            onChangeText={(value) => {
              setObservacoes(value);
              setErrors(prev => ({ ...prev, observacoes: null }));
            }}
            placeholder={fluxoInfo.observacoesPlaceholder}
            textarea
            numberOfLines={4}
            error={errors.observacoes}
          />
          </View>

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
            minimumDate={dataVisita || new Date()}
            mode="date"
          />
        </SectionCard>

        <SectionCard title="Fotos" subtitle="Este registro pode ser salvo normalmente sem imagens.">
          <InfoBox
            title={VISITA_FOTOS_MVP_INFO.title}
            message={VISITA_FOTOS_MVP_INFO.message}
            style={styles.photoInfoBox}
          />
          <View style={styles.photoActions}>
            <TouchableOpacity
              style={[
                styles.photoActionButton,
                (Boolean(photoAction) || fotos.length >= MAX_VISITA_PHOTOS) && styles.photoActionDisabled,
              ]}
              onPress={handleCapturePhoto}
              disabled={Boolean(photoAction) || fotos.length >= MAX_VISITA_PHOTOS}
              accessibilityRole="button"
              accessibilityLabel="Tirar foto para a Visita"
            >
              {photoAction === 'camera'
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Ionicons name="camera-outline" size={20} color={colors.white} />}
              <Text style={styles.photoActionText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.photoActionButton,
                styles.photoActionSecondary,
                (Boolean(photoAction) || fotos.length >= MAX_VISITA_PHOTOS) && styles.photoActionDisabled,
              ]}
              onPress={handleSelectPhotos}
              disabled={Boolean(photoAction) || fotos.length >= MAX_VISITA_PHOTOS}
              accessibilityRole="button"
              accessibilityLabel="Selecionar fotos da galeria"
            >
              {photoAction === 'galeria'
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Ionicons name="images-outline" size={20} color={colors.primary} />}
              <Text style={[styles.photoActionText, styles.photoActionSecondaryText]}>Galeria</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.photoCounter}>
            {fotos.length} de {MAX_VISITA_PHOTOS} fotos · arquivos locais, sem geolocalização automática
          </Text>
          {fotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoPreviewList}>
              {fotos.map((foto, index) => (
                <View key={foto.uri} style={styles.photoPreviewItem}>
                  <Image source={{ uri: foto.uri }} style={styles.photoPreview} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.photoRemoveButton}
                    onPress={() => handleRemovePhoto(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover foto ${index + 1}`}
                  >
                    <Ionicons name="close" size={18} color={colors.white} />
                  </TouchableOpacity>
                  <Text style={styles.photoName} numberOfLines={1}>{foto.nome_original}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </SectionCard>

        <InfoBox message={fluxoInfo.infoText} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel={fluxoInfo.submitLabel}
        loading={loading}
        disabled={loadingFazendas || semFazendasAutorizadas}
      />

      <ConfirmDialog
        visible={showConfirmDialog}
        title={status === VISITA_STATUS_REALIZADA ? 'Registrar Visita realizada' : 'Agendar Visita'}
        message={status === VISITA_STATUS_REALIZADA
          ? `Confirme o registro realizado em ${getVisitaFormFazendaLabel(fazendaSelecionada)}. O histórico não poderá voltar para Agendada.`
          : `Confirme o agendamento em ${getVisitaFormFazendaLabel(fazendaSelecionada)}. A data poderá ser reagendada com motivo registrado.`}
        type={status === VISITA_STATUS_REALIZADA ? 'success' : 'info'}
        confirmText={status === VISITA_STATUS_REALIZADA ? 'Registrar' : 'Agendar'}
        onConfirm={confirmSave}
        onCancel={() => setShowConfirmDialog(false)}
        loading={loading}
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
  pickerText: {
    flex: 1,
    fontSize: typography.fontBody,
    color: colors.text,
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
  contextHint: {
    fontSize: typography.fontSmall,
    color: colors.textLight,
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
    marginBottom: spacing.md,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoActionButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.primary,
  },
  photoActionSecondary: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
  },
  photoActionDisabled: {
    opacity: 0.55,
  },
  photoActionText: {
    color: colors.white,
    fontSize: typography.fontCaption,
    fontWeight: '700',
  },
  photoActionSecondaryText: {
    color: colors.primary,
  },
  photoCounter: {
    marginTop: spacing.sm,
    color: colors.muted,
    fontSize: typography.fontSmall,
    lineHeight: 17,
  },
  photoPreviewList: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  photoPreviewItem: {
    width: 116,
  },
  photoPreview: {
    width: 116,
    height: 88,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.backgroundAlt,
  },
  photoRemoveButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  photoName: {
    marginTop: spacing.xs,
    color: colors.textLight,
    fontSize: typography.fontSmall,
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
