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
import {
  avaliarAcessoVisita,
  filtrarProdutoresPorAcesso,
  findFazendaById,
  podeEditarVisita,
} from '../utils/acessoControle';
import {
  buildVisitaFazendaOptions,
  buildVisitaPayload,
  getVisitaFluxoUi,
  getVisitaFormFazendaId,
  getVisitaFormFazendaLabel,
  resolveVisitaEdicaoFazendaId,
} from '../utils/visitaFormCompat';

export default function EditarVisitaScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
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
  const [status, setStatus] = useState('agendada');
  const [fotos, setFotos] = useState([]);
  const [removePhotoDialog, setRemovePhotoDialog] = useState({ visible: false, fotoId: null });

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fazendas, setFazendas] = useState([]);
  const [visitaOriginal, setVisitaOriginal] = useState(null);
  const [fazendaOriginal, setFazendaOriginal] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const fazendaOptions = useMemo(() => buildVisitaFazendaOptions(fazendas), [fazendas]);
  const fluxoInfo = getVisitaFluxoUi(status);

  useEffect(() => {
    loadData();
  }, [visitaRouteId, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      setAccessDenied(false);

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
        setStatus(visitaData.status || 'agendada');
        
        if (visitaData.proximaVisita) {
          setProximaVisita(new Date(visitaData.proximaVisita));
        }

        // Carregar fotos existentes
        if (visitaData.fotos && visitaData.fotos.length > 0) {
          setFotos(visitaData.fotos.map((f, i) => ({
            id: f.id || `foto_existente_${i}`,
            uri: f.uri || f,
            tipo: f.tipo || 'existente',
            dataCaptura: f.dataCaptura || visitaData.data_visita,
          })));
        }
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

    setErrors(newErrors);
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
      const visitaAtualizada = buildVisitaPayload({
        fazendaId: fazendaContextoId,
        dataVisita,
        horaVisita,
        objetivo,
        observacoes,
        recomendacoes,
        clima,
        proximaVisita,
        status,
        fotos,
      });

      if (!visitaAtualizada) {
        throw new Error('Não foi possível montar o payload da visita');
      }

      await Visita.update(visitaRouteId, visitaAtualizada);

      toast.showSuccess('Visita atualizada com sucesso!');
      
      // Voltar para tela de detalhes
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error) {
      console.error('Erro ao salvar visita:', error);
      toast.showError('Erro ao atualizar visita');
    } finally {
      setSaving(false);
    }
  };

  const objetivos = [
    { value: 'consultoria', label: 'Consultoria Técnica' },
    { value: 'coleta_solo', label: 'Coleta de Solo' },
    { value: 'avaliacao_cultivo', label: 'Avaliação de Cultivo' },
    { value: 'entrega_material', label: 'Entrega de Material' },
    { value: 'outro', label: 'Outro' },
  ];

  const statusOptions = [
    { value: 'agendada', label: 'Agendada' },
    { value: 'realizada', label: 'Realizada' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  const adicionarFotoSimulada = (tipo) => {
    const timestamp = Date.now();
    const novaFoto = {
      id: `foto_${timestamp}`,
      uri: tipo === 'camera' 
        ? `https://picsum.photos/400/300?random=${timestamp}` 
        : `https://picsum.photos/400/300?random=${timestamp + 1}`,
      tipo: tipo,
      dataCaptura: new Date().toISOString(),
    };
    setFotos(prev => [...prev, novaFoto]);
    toast.showSuccess(`Foto ${tipo === 'camera' ? 'capturada' : 'selecionada'} com sucesso!`);
  };

  const removerFoto = (fotoId) => {
    setRemovePhotoDialog({ visible: true, fotoId });
  };

  const confirmRemoverFoto = () => {
    setFotos(prev => prev.filter(f => f.id !== removePhotoDialog.fotoId));
    setRemovePhotoDialog({ visible: false, fotoId: null });
    toast.showSuccess('Foto removida');
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
          <Text style={styles.loadingText}>Você não tem permissão para editar esta visita.</Text>
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
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="Contexto" subtitle="A propriedade vinculada é preservada nesta edição.">
          <View style={styles.field}>
            <Text style={styles.label}>Propriedade vinculada</Text>
            <View style={[styles.picker, styles.lockedPicker]}>
              <Text style={styles.pickerText}>
                {fazendaContextoLabel}
              </Text>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            </View>
            <Text style={styles.contextHint}>A propriedade da visita não é alterada nesta edição.</Text>
          </View>
        </SectionCard>

        <SectionCard title="Agenda" subtitle="Atualize status, data e horário da visita.">
          <View style={styles.field}>
            <Text style={styles.label}>
              Status <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={statusOptions.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              value={status}
              onChange={setStatus}
            />
          </View>

          <DatePicker
            label={fluxoInfo.dataLabel}
            value={dataVisita}
            onChange={(date) => {
              setDataVisita(date);
              setErrors(prev => ({ ...prev, dataVisita: null }));
            }}
            placeholder="Selecione a data"
            error={errors.dataVisita}
            mode="date"
          />

          <DatePicker
            label="Horário da Visita"
            value={horaVisita}
            onChange={(time) => {
              setHoraVisita(time);
              setErrors(prev => ({ ...prev, horaVisita: null }));
            }}
            placeholder="Selecione o horário"
            error={errors.horaVisita}
            mode="time"
          />
        </SectionCard>

        <SectionCard title="Registro técnico" subtitle="Atualize objetivo, diagnóstico e recomendações da visita.">
          <View style={styles.field}>
            <Text style={styles.label}>
              Objetivo <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={objetivos.map((obj) => ({
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

        <SectionCard title="Fotos" subtitle="Anexe imagens simuladas ao registro da visita.">
          <View style={styles.fotoBotoesContainer}>
            <TouchableOpacity
              style={styles.fotoBotao}
              onPress={() => adicionarFotoSimulada('camera')}
            >
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
              <Text style={styles.fotoBotaoText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fotoBotao}
              onPress={() => adicionarFotoSimulada('galeria')}
            >
              <Ionicons name="images-outline" size={24} color={colors.primary} />
              <Text style={styles.fotoBotaoText}>Galeria</Text>
            </TouchableOpacity>
          </View>
          {fotos.length > 0 && (
            <View style={styles.fotosGrid}>
              {fotos.map((foto) => (
                <View key={foto.id} style={styles.fotoContainer}>
                  <Image source={{ uri: foto.uri }} style={styles.fotoPreview} />
                  <TouchableOpacity
                    style={styles.fotoRemover}
                    onPress={() => removerFoto(foto.id)}
                  >
                    <Ionicons name="close-circle" size={22} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {fotos.length > 0 && (
            <Text style={styles.fotosCount}>{fotos.length} foto(s) anexada(s)</Text>
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
        title="Remover Foto"
        message="Deseja remover esta foto?"
        type="danger"
        confirmText="Remover"
        cancelText="Cancelar"
        onConfirm={confirmRemoverFoto}
        onCancel={() => setRemovePhotoDialog({ visible: false, fotoId: null })}
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
  fotoBotoesContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  fotoBotao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.accent,
  },
  fotoBotaoText: {
    fontSize: typography.fontBody,
    fontWeight: '600',
    color: colors.primary,
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
  buttonDisabled: {
    opacity: 0.6,
  },
});
