import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import { useToast } from '../components/Toast';
import { colors, typography, spacing, shadows } from '../theme';
import { Visita, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';

export default function EditarVisitaScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const toast = useToast();
  const { user } = useAuth();

  const { visitaId } = route.params || {};

  // Estados do formulário
  const [produtorId, setProdutorId] = useState('');
  const [dataVisita, setDataVisita] = useState(null);
  const [horaVisita, setHoraVisita] = useState(null);
  const [objetivo, setObjetivo] = useState('consultoria');
  const [observacoes, setObservacoes] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [clima, setClima] = useState('');
  const [proximaVisita, setProximaVisita] = useState(null);
  const [status, setStatus] = useState('agendada');
  const [fotos, setFotos] = useState([]);

  // Estados de controle
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtores, setProdutores] = useState([]);
  const [errors, setErrors] = useState({});

  // Dropdown
  const [showProdutorPicker, setShowProdutorPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, [visitaId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [visitaData, produtoresData] = await Promise.all([
        Visita.get(visitaId),
        Produtor.list(),
      ]);

      // Preencher formulário com dados da visita
      if (visitaData) {
        setProdutorId(visitaData.produtor_id || '');
        
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

      // Filtrar produtores por perfil
      let filtrados = produtoresData;
      if (user?.perfil === 'colaborador') {
        // Colaborador: produtores das suas sub-regiões
        filtrados = produtoresData.filter(p => {
          if (user.sub_regioes && p.microregiao) {
            return user.sub_regioes.includes(p.microregiao);
          }
          return false;
        });
      } else if (user?.perfil === 'produtor') {
        filtrados = produtoresData.filter(p => 
          p.proprietario_id === user.produtor_id || p.id === user.produtor_id
        );
      }

      setProdutores(filtrados);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.showError('Erro ao carregar visita');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!produtorId) {
      newErrors.produtorId = 'Selecione um produtor';
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

    setSaving(true);
    try {
      // Combinar data e hora
      const dataCompleta = new Date(dataVisita);
      dataCompleta.setHours(horaVisita.getHours());
      dataCompleta.setMinutes(horaVisita.getMinutes());

      const visitaAtualizada = {
        produtor_id: produtorId,
        data_visita: dataCompleta.toISOString(),
        objetivo,
        observacoes,
        recomendacoes,
        clima,
        proximaVisita: proximaVisita?.toISOString().split('T')[0],
        status,
        fotos: fotos,
      };

      await Visita.update(visitaId, visitaAtualizada);

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

  const getProdutorNome = (id) => {
    const prod = produtores.find(p => p.id === id);
    return prod ? `${prod.nome} - ${prod.fazenda}` : 'Selecione um produtor';
  };

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
    Alert.alert(
      'Remover Foto',
      'Deseja remover esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => {
          setFotos(prev => prev.filter(f => f.id !== fotoId));
          toast.showSuccess('Foto removida');
        }}
      ]
    );
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

  return (
    <View style={styles.container}>
      <Header title="Editar Visita" showBack />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Produtor */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Produtor <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={[styles.picker, errors.produtorId && styles.inputError]}
            onPress={() => setShowProdutorPicker(!showProdutorPicker)}
            disabled={user?.perfil === 'produtor'}
          >
            <Text style={[styles.pickerText, !produtorId && styles.placeholder]}>
              {getProdutorNome(produtorId)}
            </Text>
            <Ionicons 
              name={showProdutorPicker ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={colors.muted} 
            />
          </TouchableOpacity>
          {errors.produtorId && (
            <Text style={styles.errorText}>{errors.produtorId}</Text>
          )}

          {/* Dropdown de produtores */}
          {showProdutorPicker && (
            <View style={styles.dropdownContainer}>
              <ScrollView style={styles.dropdown} nestedScrollEnabled>
                {produtores.map(prod => (
                  <TouchableOpacity
                    key={prod.id}
                    style={[
                      styles.dropdownItem,
                      produtorId === prod.id && styles.dropdownItemSelected
                    ]}
                    onPress={() => {
                      setProdutorId(prod.id);
                      setShowProdutorPicker(false);
                      setErrors(prev => ({ ...prev, produtorId: null }));
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      produtorId === prod.id && styles.dropdownItemTextSelected
                    ]}>
                      {prod.nome}
                    </Text>
                    <Text style={styles.dropdownItemSubtext}>
                      {prod.fazenda} - {prod.cidade}/{prod.estado}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Status */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Status <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.radioGroup}>
            {statusOptions.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.radioButton,
                  status === opt.value && styles.radioButtonSelected
                ]}
                onPress={() => setStatus(opt.value)}
              >
                <View style={styles.radio}>
                  {status === opt.value && <View style={styles.radioInner} />}
                </View>
                <Text style={[
                  styles.radioLabel,
                  status === opt.value && styles.radioLabelSelected
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
            placeholder="Recomendações para o produtor..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Clima */}
        <View style={styles.field}>
          <Text style={styles.label}>Condições Climáticas</Text>
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
          minimumDate={new Date()}
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
            Ao editar a visita, as alterações serão salvas imediatamente. 
            Você pode adicionar fotos acessando a visualização de detalhes.
          </Text>
        </View>
      </ScrollView>

      {/* Botões de Ação */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
          disabled={saving}
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.card} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.card} />
              <Text style={styles.saveButtonText}>Salvar Alterações</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
