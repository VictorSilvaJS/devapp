import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import { Visita, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { filtrarProdutoresPorAcesso } from '../utils/acessoControle';
import {
  buildVisitaFazendaOptions,
  buildVisitaPayload,
  findVisitaFazendaOption,
  getVisitaFormFazendaLabel,
} from '../utils/visitaFormCompat';

export default function NovaVisitaScreen() {
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();

  // Estados do formulário
  const [fazendaId, setFazendaId] = useState('');
  const [dataVisita, setDataVisita] = useState(null);
  const [horaVisita, setHoraVisita] = useState(null);
  const [objetivo, setObjetivo] = useState('consultoria');
  const [observacoes, setObservacoes] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [clima, setClima] = useState('');
  const [proximaVisita, setProximaVisita] = useState(null);
  const [fotos, setFotos] = useState([]);
  const [removePhotoDialog, setRemovePhotoDialog] = useState({ visible: false, fotoId: null });

  // Estados de controle
  const [loading, setLoading] = useState(false);
  const [fazendas, setFazendas] = useState([]);
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [errors, setErrors] = useState<any>({});

  // Dropdown de fazendas
  const [showFazendaPicker, setShowFazendaPicker] = useState(false);
  const fazendaOptions = useMemo(() => buildVisitaFazendaOptions(fazendas), [fazendas]);
  const fazendaSelecionada = useMemo(
    () => findVisitaFazendaOption(fazendaOptions, fazendaId),
    [fazendaOptions, fazendaId]
  );

  useEffect(() => {
    loadFazendas();
  }, []);

  const loadFazendas = async () => {
    setLoadingFazendas(true);
    try {
      const fazendasDisponiveis = await Produtor.list();

      const fazendasFiltradas = user ? filtrarProdutoresPorAcesso(fazendasDisponiveis, user) : fazendasDisponiveis;

      if (user?.perfil === 'produtor' && fazendasFiltradas.length > 0) {
        setFazendaId(buildVisitaFazendaOptions(fazendasFiltradas)[0]?.id || '');
      }
      
      setFazendas(fazendasFiltradas);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
      toast.showError('Erro ao carregar fazendas');
    } finally {
      setLoadingFazendas(false);
    }
  };

  const validateForm = () => {
    const newErrors: any = {};

    if (!fazendaId) {
      newErrors.fazendaId = 'Selecione uma fazenda';
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
    if (!validateForm()) {
      toast.showError('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const novaVisita = buildVisitaPayload({
        fazendaId,
        dataVisita,
        horaVisita,
        objetivo,
        observacoes,
        recomendacoes,
        clima,
        proximaVisita,
        status: 'agendada',
        fotos,
        tecnicoResponsavel: user?.nome || user?.full_name || 'Sistema',
      });

      if (!novaVisita) {
        throw new Error('Não foi possível montar o payload da visita');
      }

      await Visita.create(novaVisita);

      toast.showSuccess('Visita agendada com sucesso!');
      
      // Voltar para tela de visitas
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    } catch (error) {
      console.error('Erro ao salvar visita:', error);
      toast.showError('Erro ao agendar visita');
    } finally {
      setLoading(false);
    }
  };

  const objetivos = [
    { value: 'consultoria', label: 'Consultoria Técnica' },
    { value: 'coleta_solo', label: 'Coleta de Solo' },
    { value: 'avaliacao_cultivo', label: 'Avaliação de Cultivo' },
    { value: 'entrega_material', label: 'Entrega de Material' },
    { value: 'outro', label: 'Outro' },
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

  return (
    <View style={styles.container}>
      <Header title="Nova Visita" showBack />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Fazenda */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Fazenda <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.picker, errors.fazendaId && styles.inputError]}
            onPress={() => setShowFazendaPicker(!showFazendaPicker)}
            disabled={user?.perfil === 'produtor'}
          >
            <Text style={[styles.pickerText, !fazendaId && styles.placeholder]}>
              {loadingFazendas ? 'Carregando...' : getVisitaFormFazendaLabel(fazendaSelecionada)}
            </Text>
            <Ionicons 
              name={showFazendaPicker ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.muted} 
            />
          </TouchableOpacity>
          {errors.fazendaId && (
            <Text style={styles.errorText}>{errors.fazendaId}</Text>
          )}

          {/* Dropdown de fazendas */}
          {showFazendaPicker && (
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

        {/* Data da Visita */}
        <DatePicker
          label="Data da Visita"
          value={dataVisita}
          onChange={(date) => {
            setDataVisita(date);
            setErrors(prev => ({ ...prev, dataVisita: null }));
          }}
          placeholder="Selecione a data"
          error={errors.dataVisita}
          minimumDate={new Date()}
          mode="date"
        />

        {/* Horário da Visita */}
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

        {/* Objetivo */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Objetivo <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.radioGroup}>
            {objetivos.map(obj => (
              <TouchableOpacity
                key={obj.value}
                style={[
                  styles.radioButton,
                  objetivo === obj.value && styles.radioButtonSelected
                ]}
                onPress={() => {
                  setObjetivo(obj.value);
                  setErrors(prev => ({ ...prev, objetivo: null }));
                }}
              >
                <View style={styles.radio}>
                  {objetivo === obj.value && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.radioLabel,
                  objetivo === obj.value && styles.radioLabelSelected
                ]}>
                  {obj.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.objetivo && (
            <Text style={styles.errorText}>{errors.objetivo}</Text>
          )}
        </View>

        {/* Observações */}
        <View style={styles.field}>
          <Text style={styles.label}>Observações</Text>
          <TextInput
            style={[styles.textarea, styles.input]}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Descreva detalhes da visita..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Recomendações */}
        <View style={styles.field}>
          <Text style={styles.label}>Recomendações Técnicas</Text>
          <TextInput
            style={[styles.textarea, styles.input]}
            value={recomendacoes}
            onChangeText={setRecomendacoes}
            placeholder="Recomendações técnicas para a fazenda..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Clima */}
        <View style={styles.field}>
          <Text style={styles.label}>Condições Climáticas Esperadas</Text>
          <TextInput
            style={styles.input}
            value={clima}
            onChangeText={setClima}
            placeholder="Ex: Ensolarado, parcialmente nublado..."
            placeholderTextColor={colors.muted}
          />
        </View>

        {/* Próxima Visita */}
        <DatePicker
          label="Sugestão de Próxima Visita"
          value={proximaVisita}
          onChange={setProximaVisita}
          placeholder="Selecione uma data (opcional)"
          minimumDate={dataVisita || new Date()}
          mode="date"
        />

        {/* Fotos */}
        <View style={styles.field}>
          <Text style={styles.label}>Fotos da Visita</Text>
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
        </View>

        {/* Informações */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            A visita será agendada com status "Agendada". Você poderá adicionar fotos e 
            atualizar o status após realizar a visita.
          </Text>
        </View>
      </ScrollView>

      {/* Botões de Ação */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.card} />
              <Text style={styles.saveButtonText}>Agendar Visita</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

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
    borderRadius: 10,
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
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fotoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  fotoRemover: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.whiteTranslucent,
    borderRadius: 11,
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
