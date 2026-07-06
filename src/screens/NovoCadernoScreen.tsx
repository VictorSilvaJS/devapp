import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import DatePicker from '../components/DatePicker';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import RadioCardGroup from '../components/RadioCardGroup';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { CadernoCampo, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { colors, shadows, spacing, typography } from '../theme';
import {
  filtrarProdutoresPorAcesso,
  findFazendaById,
  getFazendaId,
  podeIncluirCaderno,
  podeIncluirCadernoEmFazenda,
} from '../utils/acessoControle';
import {
  CADERNO_TIPOS_ATIVIDADE,
  buildCadernoFazendaOptions,
  buildCadernoPayload,
  findCadernoFazendaOption,
  getCadernoFormFazendaLabel,
  parseCadernoAreaAplicada,
} from '../utils/cadernoFormCompat';

export default function NovoCadernoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();

  const routeFazendaId = route.params?.fazendaId || route.params?.produtorId;
  const responsavelInicial = user?.nome || user?.full_name || '';

  const [fazendaId, setFazendaId] = useState('');
  const [dataAtividade, setDataAtividade] = useState(new Date());
  const [tipoAtividade, setTipoAtividade] = useState('observacao');
  const [responsavel, setResponsavel] = useState(responsavelInicial);
  const [talhao, setTalhao] = useState('');
  const [produtosText, setProdutosText] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [areaAplicada, setAreaAplicada] = useState('');
  const [condicoesClima, setCondicoesClima] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [visivelParaProdutor, setVisivelParaProdutor] = useState(true);

  const [fazendas, setFazendas] = useState([]);
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showFazendaPicker, setShowFazendaPicker] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const fazendaOptions = useMemo(() => buildCadernoFazendaOptions(fazendas), [fazendas]);
  const fazendaSelecionada = useMemo(
    () => findCadernoFazendaOption(fazendaOptions, fazendaId),
    [fazendaOptions, fazendaId]
  );
  const semFazendasAutorizadas = !loadingFazendas && fazendaOptions.length === 0;

  useEffect(() => {
    loadFazendas();
  }, [user, routeFazendaId]);

  useEffect(() => {
    if (!responsavel && responsavelInicial) {
      setResponsavel(responsavelInicial);
    }
  }, [responsavel, responsavelInicial]);

  const loadFazendas = async () => {
    setLoadingFazendas(true);
    setAccessDenied(false);

    try {
      if (!podeIncluirCaderno(user)) {
        setFazendaId('');
        setFazendas([]);
        setAccessDenied(true);
        return;
      }

      const fazendasDisponiveis = await Produtor.list();
      const fazendasPermitidas = filtrarProdutoresPorAcesso(fazendasDisponiveis, user);

      if (routeFazendaId) {
        const fazendaRota = findFazendaById(fazendasPermitidas, routeFazendaId);

        if (!podeIncluirCadernoEmFazenda(user, fazendaRota)) {
          setFazendaId('');
          setFazendas([]);
          setAccessDenied(true);
          toast.showWarning('Você não tem permissão para criar registro nesta propriedade.');
          return;
        }

        setFazendaId(routeFazendaId);
      } else if (fazendasPermitidas.length === 1) {
        setFazendaId(getFazendaId(fazendasPermitidas[0]));
      }

      setFazendas(fazendasPermitidas);
    } catch (error) {
      console.error('Erro ao carregar fazendas para caderno:', error);
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

    if (!dataAtividade) {
      newErrors.dataAtividade = 'Selecione a data da atividade';
    }

    if (!tipoAtividade) {
      newErrors.tipoAtividade = 'Selecione o tipo de atividade';
    }

    if (!responsavel.trim()) {
      newErrors.responsavel = 'Informe o responsável pelo registro';
    }

    if (parseCadernoAreaAplicada(areaAplicada) === null) {
      newErrors.areaAplicada = 'Informe uma área maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!podeIncluirCaderno(user)) {
      toast.showWarning('Você não tem permissão para criar registro de caderno.');
      return;
    }

    if (!validateForm()) {
      toast.showError('Preencha os campos obrigatórios');
      return;
    }

    const fazendaSelecionadaData = findFazendaById(fazendas, fazendaId);

    if (!podeIncluirCadernoEmFazenda(user, fazendaSelecionadaData)) {
      toast.showWarning('Você não tem permissão para criar registro nesta propriedade.');
      return;
    }

    setSaving(true);
    try {
      const novoRegistro = buildCadernoPayload({
        fazendaId,
        dataAtividade,
        tipoAtividade,
        talhao,
        produtosText,
        dosagem,
        areaAplicadaText: areaAplicada,
        condicoesClima,
        observacoes,
        visivelParaProdutor,
        colaboradorResponsavel: responsavel,
        criadoPorUserId: user?.id,
      });

      if (!novoRegistro) {
        throw new Error('Não foi possível montar o payload do caderno');
      }

      const criado = await CadernoCampo.create(novoRegistro);
      toast.showSuccess('Registro de caderno criado com sucesso!');
      navigation.replace('CadernoDetail', { cadernoId: criado.id });
    } catch (error) {
      console.error('Erro ao salvar registro de caderno:', error);
      toast.showError('Erro ao criar registro de caderno');
    } finally {
      setSaving(false);
    }
  };

  if (loadingFazendas) {
    return (
      <View style={styles.container}>
        <Header title="Novo Registro" showBack />
        <View style={styles.blockedContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.blockedSubtext}>Carregando propriedades autorizadas...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied) {
    return (
      <View style={styles.container}>
        <Header title="Novo Registro" showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedText}>Acesso restrito</Text>
          <Text style={styles.blockedSubtext}>Produtor consulta somente registros liberados. A criação fica restrita à equipe.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Novo Registro" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SectionCard title="Contexto" subtitle="Defina a propriedade onde o registro será salvo.">
          <View style={styles.field}>
            <Text style={styles.label}>
              Propriedade <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={[styles.picker, errors.fazendaId && styles.inputError]}
              onPress={() => setShowFazendaPicker(!showFazendaPicker)}
              disabled={loadingFazendas || semFazendasAutorizadas || !!routeFazendaId}
            >
              <Text style={[styles.pickerText, !fazendaId && styles.placeholder]}>
                {loadingFazendas ? 'Carregando...' : getCadernoFormFazendaLabel(fazendaSelecionada)}
              </Text>
              <Ionicons
                name={routeFazendaId ? 'lock-closed-outline' : showFazendaPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
            {routeFazendaId && (
              <Text style={styles.contextHint}>Registro vinculado à propriedade informada na rota.</Text>
            )}
            {errors.fazendaId && <Text style={styles.errorText}>{errors.fazendaId}</Text>}
            {semFazendasAutorizadas && (
              <Text style={styles.errorText}>Nenhuma propriedade autorizada disponível para novo registro.</Text>
            )}

            {showFazendaPicker && !routeFazendaId && (
              <View style={styles.dropdownContainer}>
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  {fazendaOptions.map((fazenda) => (
                    <TouchableOpacity
                      key={fazenda.id}
                      style={[
                        styles.dropdownItem,
                        fazendaId === fazenda.id && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setFazendaId(fazenda.id);
                        setShowFazendaPicker(false);
                        setErrors(prev => ({ ...prev, fazendaId: null }));
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          fazendaId === fazenda.id && styles.dropdownItemTextSelected,
                        ]}
                      >
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

        <SectionCard title="Registro de campo" subtitle="Registre data, tipo, responsável e informações operacionais.">
          <DatePicker
            label="Data do registro"
            value={dataAtividade}
            onChange={(date) => {
              setDataAtividade(date);
              setErrors(prev => ({ ...prev, dataAtividade: null }));
            }}
            placeholder="Selecione a data"
            error={errors.dataAtividade}
            maximumDate={new Date()}
            mode="date"
          />

          <View style={styles.field}>
            <Text style={styles.label}>
              Tipo de registro <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={CADERNO_TIPOS_ATIVIDADE.map((tipo) => ({
                value: tipo.value,
                label: tipo.label,
              }))}
              value={tipoAtividade}
              onChange={(value) => {
                setTipoAtividade(value);
                setErrors(prev => ({ ...prev, tipoAtividade: null }));
              }}
              error={errors.tipoAtividade}
            />
          </View>

          <FormField
            label="Responsável"
            value={responsavel}
            onChangeText={(value) => {
              setResponsavel(value);
              setErrors(prev => ({ ...prev, responsavel: null }));
            }}
            placeholder="Nome do responsável"
            error={errors.responsavel}
          />

          <FormField
            label="Talhão"
            value={talhao}
            onChangeText={setTalhao}
            placeholder="Ex: Talhão A"
          />

          <FormField
            label="Área Aplicada (ha)"
            value={areaAplicada}
            onChangeText={(value) => {
              setAreaAplicada(value);
              setErrors(prev => ({ ...prev, areaAplicada: null }));
            }}
            placeholder="Ex: 25,5"
            keyboardType="decimal-pad"
            error={errors.areaAplicada}
          />

          <FormField
            label="Produtos Utilizados"
            value={produtosText}
            onChangeText={setProdutosText}
            placeholder="Separe produtos por vírgula"
          />

          <FormField
            label="Dosagem"
            value={dosagem}
            onChangeText={setDosagem}
            placeholder="Ex: 300 kg/ha"
          />

          <FormField
            label="Condições Climáticas"
            value={condicoesClima}
            onChangeText={setCondicoesClima}
            placeholder="Ex: Ensolarado, sem vento"
          />

          <FormField
            label="Observações"
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Descreva o registro de campo..."
            textarea
            numberOfLines={4}
          />
        </SectionCard>

        <SectionCard title="Visibilidade" subtitle="Controle se o registro aparece para o produtor.">
          <Text style={styles.label}>
            Visibilidade para Produtor <Text style={styles.required}>*</Text>
          </Text>
          <RadioCardGroup
            options={[
              {
                value: 'visivel',
                label: 'Liberado ao produtor',
                description: 'Aparece no histórico da propriedade.',
              },
              {
                value: 'restrito',
                label: 'Interno',
                description: 'Disponível apenas para admin e colaboradores.',
              },
            ]}
            value={visivelParaProdutor ? 'visivel' : 'restrito'}
            onChange={(value) => setVisivelParaProdutor(value === 'visivel')}
          />
        </SectionCard>

        <InfoBox message="O registro será salvo no caderno da propriedade selecionada." />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar Registro"
        loading={saving}
        disabled={loadingFazendas || semFazendasAutorizadas}
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
  contextHint: {
    marginTop: spacing.xs,
    fontSize: typography.fontSmall,
    color: colors.muted,
    lineHeight: 16,
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
  radioButtonLocked: {
    opacity: 0.75,
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
