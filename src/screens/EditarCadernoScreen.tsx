import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import CadernoLocalizacaoSection from '../components/CadernoLocalizacaoSection';
import ConfirmDialog from '../components/ConfirmDialog';
import DatePicker from '../components/DatePicker';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import RadioCardGroup from '../components/RadioCardGroup';
import SelectField from '../components/SelectField';
import SectionCard from '../components/SectionCard';
import { useToast } from '../components/Toast';
import { CadernoCampo, LimiteArea, Produtor } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import { PeriodoProdutivoService } from '../services/PeriodoProdutivoService';
import { useCadernoLocalizacaoCapture } from '../hooks/useCadernoLocalizacaoCapture';
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import { colors, shadows, spacing, typography } from '../theme';
import {
  avaliarAcessoCaderno,
  filtrarLimitesPorFazendaIds,
  findFazendaById,
  podeEditarCadernoEmFazenda,
} from '../utils/acessoControle';
import {
  CADERNO_TIPOS_ATIVIDADE,
  CADERNO_TALHAO_LEGADO_VALUE,
  buildCadernoFazendaOptions,
  buildCadernoPeriodoProdutivoOptions,
  buildCadernoPayload,
  buildCadernoTalhaoOptions,
  findCadernoPeriodoProdutivoOption,
  getCadernoFormFazendaLabel,
  getCadernoFormPeriodoProdutivoLabel,
  getCadernoFormFieldVisibility,
  isCadernoTalhaoLegado,
  isCadernoVisivelParaProdutor,
  parseCadernoAreaAplicada,
  parseCadernoProdutividade,
  resolveCadernoEdicaoFazendaId,
} from '../utils/cadernoFormCompat';
import type { CadernoLocalizacaoExplicita } from '../utils/cadernoLocalizacaoCompat';
import {
  buildCadernoLocalizacaoEditPatch,
  getInitialCadernoLocalizacaoEditState,
  setCadernoLocalizacaoEditRemoval,
  setCadernoLocalizacaoEditReplacement,
  undoCadernoLocalizacaoEditRemoval,
} from '../utils/cadernoLocalizacaoUiCompat';
import {
  getCadernoTypeValidationErrors,
  type CadernoActor,
} from '../utils/cadernoLifecycleCompat';

const CADERNO_FORM_ERROR_ORDER = [
  'fazendaId', 'dataAtividade', 'tipoAtividade', 'responsavel', 'periodoProdutivoId',
  'talhaoId', 'operacao', 'produtos', 'dosagem', 'areaAplicada', 'produtividade', 'observacoes',
] as const;

export default function EditarCadernoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const formValidation = useFormValidationFocus(CADERNO_FORM_ERROR_ORDER);
  const { user } = useAuth();

  const { cadernoId, registroId, id } = route.params || {};
  const cadernoRouteId = cadernoId || registroId || id;

  const [registroOriginal, setRegistroOriginal] = useState<any>(null);
  const [fazenda, setFazenda] = useState<any>(null);
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [talhoesDisponiveis, setTalhoesDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const [fazendaId, setFazendaId] = useState('');
  const [dataAtividade, setDataAtividade] = useState<Date | null>(null);
  const [tipoAtividade, setTipoAtividade] = useState('observacao');
  const [responsavel, setResponsavel] = useState('');
  const [talhaoId, setTalhaoId] = useState('');
  const [talhao, setTalhao] = useState('');
  const [produtosText, setProdutosText] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [areaAplicada, setAreaAplicada] = useState('');
  const [condicoesClima, setCondicoesClima] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [operacao, setOperacao] = useState('');
  const [produtividade, setProdutividade] = useState('');
  const [visivelParaProdutor, setVisivelParaProdutor] = useState(true);
  const [periodoProdutivoId, setPeriodoProdutivoId] = useState('');
  const [periodosProdutivos, setPeriodosProdutivos] = useState<any[]>([]);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [showPeriodoPicker, setShowPeriodoPicker] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [localizacaoState, setLocalizacaoState] = useState(() =>
    getInitialCadernoLocalizacaoEditState(null)
  );
  const savingRef = useRef(false);
  const editLoadGenerationRef = useRef(0);

  const handleLocationCaptured = useCallback((
    draft: CadernoLocalizacaoExplicita,
    capturedForFazendaId?: string
  ) => {
    setLocalizacaoState((current) =>
      setCadernoLocalizacaoEditReplacement(current, draft, capturedForFazendaId)
    );
  }, []);

  const {
    loading: loadingLocalizacao,
    errorMessage: localizacaoError,
    capture: captureLocalizacao,
    isCapturePending,
    cancelPending: cancelPendingLocalizacao,
    clearCaptureError,
  } = useCadernoLocalizacaoCapture({
    capturedBy: typeof user?.id === 'string' ? user.id : null,
    onCaptured: handleLocationCaptured,
  });

  const discardPendingLocalizacao = useCallback(() => {
    cancelPendingLocalizacao();
    clearCaptureError();
    setLocalizacaoState((current) => undoCadernoLocalizacaoEditRemoval(current));
  }, [cancelPendingLocalizacao, clearCaptureError]);

  const handleCancel = useCallback(() => {
    discardPendingLocalizacao();
    navigation.goBack();
  }, [discardPendingLocalizacao, navigation]);

  const periodoOptions = useMemo(() => {
    const options = buildCadernoPeriodoProdutivoOptions(periodosProdutivos);
    const periodoAtualId = String(
      registroOriginal?.periodo_produtivo_id || registroOriginal?.periodoProdutivoId || ''
    ).trim();

    if (periodoAtualId && !options.some((option) => option.id === periodoAtualId)) {
      const label = String(registroOriginal?.periodo_produtivo_label || '').trim();
      options.push({
        id: periodoAtualId,
        label: label || 'Safra/Safrinha vinculada',
        tipoPeriodo: String(registroOriginal?.tipo_periodo || '').trim() || undefined,
        cultura: String(registroOriginal?.cultura_periodo || '').trim() || undefined,
        anoAgricola: String(registroOriginal?.ano_agricola || '').trim() || undefined,
      });
    }

    return options;
  }, [periodosProdutivos, registroOriginal]);
  const periodoSelecionado = useMemo(
    () => findCadernoPeriodoProdutivoOption(periodoOptions, periodoProdutivoId),
    [periodoOptions, periodoProdutivoId]
  );
  const talhaoSelection = useMemo(
    () => buildCadernoTalhaoOptions(talhoesDisponiveis, { id: talhaoId, nome: talhao }),
    [talhao, talhaoId, talhoesDisponiveis]
  );
  const fieldVisibility = useMemo(
    () => getCadernoFormFieldVisibility(tipoAtividade),
    [tipoAtividade]
  );
  const responsavelLegado = Boolean(
    registroOriginal
    && !registroOriginal.responsavel_usuario_id
    && !registroOriginal.colaborador_responsavel_id
  );

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
    setErrors({});
  };

  useFocusEffect(
    useCallback(() => {
      const loadGeneration = ++editLoadGenerationRef.current;
      void loadRegistro(loadGeneration);

      return () => {
        if (editLoadGenerationRef.current === loadGeneration) {
          editLoadGenerationRef.current += 1;
        }
        discardPendingLocalizacao();
      };
    }, [cadernoRouteId, user, discardPendingLocalizacao])
  );

  const loadPeriodosProdutivos = async (
    contextoFazendaId: unknown,
    periodoAtualId = '',
    loadGeneration: number
  ) => {
    if (editLoadGenerationRef.current !== loadGeneration) return;

    const normalizedFazendaId = String(contextoFazendaId || '').trim();
    setShowPeriodoPicker(false);

    if (!normalizedFazendaId) {
      setPeriodosProdutivos([]);
      setPeriodoProdutivoId(periodoAtualId || '');
      setLoadingPeriodos(false);
      return;
    }

    setLoadingPeriodos(true);
    try {
      const periodos = await PeriodoProdutivoService.listActivePeriodosProdutivosByPropriedade(normalizedFazendaId);
      if (editLoadGenerationRef.current !== loadGeneration) return;

      setPeriodosProdutivos(periodos);
      setPeriodoProdutivoId((current) => {
        const selected = current || periodoAtualId;
        return selected && (
          periodos.some((periodo) => periodo.id === selected) || selected === periodoAtualId
        )
          ? selected
          : '';
      });
    } catch (error) {
      if (editLoadGenerationRef.current !== loadGeneration) return;

      console.error('Erro ao carregar periodos produtivos para edição do caderno:', error);
      setPeriodosProdutivos([]);
      setPeriodoProdutivoId(periodoAtualId || '');
    } finally {
      if (editLoadGenerationRef.current === loadGeneration) {
        setLoadingPeriodos(false);
      }
    }
  };

  const loadRegistro = async (loadGeneration: number) => {
    if (editLoadGenerationRef.current !== loadGeneration) return;

    setLoading(true);
    setLoadingPeriodos(false);
    setAccessDenied(false);

    try {
      if (!cadernoRouteId) {
        throw new Error('Registro de caderno não informado');
      }

      const [registroData, fazendasData, limitesData] = await Promise.all([
        CadernoCampo.get(cadernoRouteId),
        Produtor.list(),
        LimiteArea.list(),
      ]);
      if (editLoadGenerationRef.current !== loadGeneration) return;

      const acesso = avaliarAcessoCaderno(user, registroData, fazendasData);

      if (acesso.status !== 'permitido' || !podeEditarCadernoEmFazenda(user, registroData, acesso.fazenda)) {
        setRegistroOriginal(null);
        setFazenda(null);
        setLocalizacaoState(getInitialCadernoLocalizacaoEditState(null));
        setAccessDenied(true);
        toast.showWarning('Você não tem permissão para editar este registro.');
        return;
      }

      const contextoFazendaId = resolveCadernoEdicaoFazendaId(registroData, acesso.fazendaId);
      setRegistroOriginal(registroData);
      setLocalizacaoState(getInitialCadernoLocalizacaoEditState(registroData));
      setFazenda(acesso.fazenda);
      setFazendas(fazendasData);
      setTalhoesDisponiveis(filtrarLimitesPorFazendaIds(limitesData, [contextoFazendaId]));
      setFazendaId(contextoFazendaId);
      setDataAtividade(registroData.data_atividade ? new Date(registroData.data_atividade) : null);
      setTipoAtividade(registroData.tipo_atividade || '');
      setResponsavel(registroData.colaborador_responsavel || 'Responsável legado não identificado');
      setTalhaoId(registroData.talhao_id || registroData.talhaoId || '');
      setTalhao(registroData.talhao_nome || registroData.talhao || '');
      setProdutosText(Array.isArray(registroData.produtos_utilizados) ? registroData.produtos_utilizados.join(', ') : '');
      setDosagem(registroData.dosagem || '');
      setOperacao(registroData.operacao || '');
      setAreaAplicada(
        registroData.area_aplicada !== undefined && registroData.area_aplicada !== null
          ? String(registroData.area_aplicada).replace('.', ',')
          : ''
      );
      setCondicoesClima(registroData.condicoes_clima || '');
      setProdutividade(
        registroData.produtividade !== undefined && registroData.produtividade !== null
          ? String(registroData.produtividade).replace('.', ',')
          : ''
      );
      setObservacoes(registroData.observacoes || '');
      setVisivelParaProdutor(isCadernoVisivelParaProdutor(registroData));
      const periodoAtualId = String(registroData.periodo_produtivo_id || registroData.periodoProdutivoId || '').trim();
      setPeriodoProdutivoId(periodoAtualId);
      await loadPeriodosProdutivos(contextoFazendaId, periodoAtualId, loadGeneration);
    } catch (error) {
      if (editLoadGenerationRef.current !== loadGeneration) return;

      console.error('Erro ao carregar registro para edição:', error);
      toast.showError('Erro ao carregar edição do caderno');
      navigation.goBack();
    } finally {
      if (editLoadGenerationRef.current === loadGeneration) {
        setLoading(false);
      }
    }
  };

  const contextoFazendaIdAtual = () => resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId);

  const buildFormPayload = () => buildCadernoPayload({
    fazendaId: contextoFazendaIdAtual(),
    dataAtividade,
    tipoAtividade,
    talhaoId,
    talhao,
    produtosText,
    dosagem,
    areaAplicadaText: areaAplicada,
    condicoesClima,
    observacoes,
    visivelParaProdutor: user?.perfil === 'produtor' ? true : visivelParaProdutor,
    responsavelUsuarioId: registroOriginal?.responsavel_usuario_id || registroOriginal?.colaborador_responsavel_id,
    colaboradorResponsavel: responsavel,
    criadoPorUserId: registroOriginal?.criado_por_user_id || registroOriginal?.criado_por,
    criadoPorNome: registroOriginal?.criado_por_nome,
    origemRegistro: registroOriginal?.origem_registro || (user?.perfil === 'produtor' ? 'produtor' : 'equipe'),
    periodoProdutivo: periodoSelecionado,
    operacao,
    produtividadeText: produtividade,
  });

  const validateForm = (forSubmit: boolean) => {
    const newErrors: any = {};

    if (!resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId)) {
      newErrors.fazendaId = 'Registro sem contexto de propriedade';
    }

    if (!dataAtividade) {
      newErrors.dataAtividade = 'Selecione a data da atividade';
    }

    if (forSubmit && !tipoAtividade) {
      newErrors.tipoAtividade = 'Selecione o tipo de atividade';
    }

    if (!responsavel.trim() || !String(user?.id || '').trim()) {
      newErrors.responsavel = 'Sessão sem referência estável de usuário';
    }

    if (parseCadernoAreaAplicada(areaAplicada) === null) {
      newErrors.areaAplicada = 'Informe uma área maior que zero';
    }
    if (parseCadernoProdutividade(produtividade) === null) {
      newErrors.produtividade = 'Informe uma produtividade maior que zero';
    }
    if (forSubmit) {
      Object.assign(newErrors, getCadernoTypeValidationErrors(buildFormPayload() || {}));
    }

    setErrors(newErrors);
    formValidation.focusFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePersist = async (submit: boolean) => {
    if (savingRef.current || loadingLocalizacao || isCapturePending()) return;

    if (!registroOriginal) {
      toast.showWarning('Registro não carregado para edição.');
      return;
    }

    if (!validateForm(submit)) {
      toast.showError('Preencha os campos obrigatórios');
      return;
    }

    const contextoFazendaId = resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId);
    const fazendaContexto = findFazendaById(fazendas, contextoFazendaId) || fazenda;
    const registroComContexto = { ...registroOriginal, fazenda_id: contextoFazendaId };

    if (!podeEditarCadernoEmFazenda(user, registroComContexto, fazendaContexto)) {
      toast.showWarning('Você não tem permissão para editar este registro.');
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const payload = buildFormPayload();

      if (!payload) {
        throw new Error('Não foi possível montar o payload do caderno');
      }

      if (!periodoSelecionado) {
        payload.periodo_produtivo_id = null;
        payload.periodoProdutivoId = null;
        payload.periodo_produtivo_label = null;
        payload.tipo_periodo = null;
        payload.cultura_periodo = null;
        payload.ano_agricola = null;
      }

      const localizacaoPatch = buildCadernoLocalizacaoEditPatch(
        localizacaoState.intent,
        localizacaoState.draftLocation
      );

      const actor: CadernoActor = {
        usuarioId: String(user?.id || '').trim(),
        nome: user?.nome || user?.full_name || responsavel,
        perfil: user?.perfil || '',
        propriedadeIds: [contextoFazendaId],
      };
      const data = {
        ...payload,
        ...localizacaoPatch,
      };
      if (submit) await CadernoCampo.saveAndSubmitDraft(cadernoRouteId, data, actor);
      else await CadernoCampo.updateDraft(cadernoRouteId, data, actor);
      toast.showSuccess(submit ? 'Registro confirmado e enviado ao Caderno!' : 'Rascunho atualizado.');

      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.replace('CadernoDetail', { cadernoId: cadernoRouteId });
      }
    } catch (error) {
      console.error('Erro ao atualizar registro de caderno:', error);
      toast.showError(submit ? 'Erro ao enviar registro de caderno' : 'Erro ao atualizar rascunho');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleReviewSubmit = () => {
    if (!validateForm(true)) {
      toast.showError('Revise os campos obrigatórios do tipo selecionado');
      return;
    }
    setShowSubmitConfirm(true);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Editar Registro" showBack onBack={handleCancel} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando registro...</Text>
        </View>
      </View>
    );
  }

  if (accessDenied || !registroOriginal) {
    return (
      <View style={styles.container}>
        <Header title="Editar Registro" showBack onBack={handleCancel} />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedText}>Acesso restrito</Text>
          <Text style={styles.blockedSubtext}>Você não tem permissão para editar este registro.</Text>
        </View>
      </View>
    );
  }

  const contextoFazendaId = resolveCadernoEdicaoFazendaId(registroOriginal, fazendaId);
  const fazendaOptions = buildCadernoFazendaOptions(fazenda ? [fazenda] : []);
  const fazendaLabel = getCadernoFormFazendaLabel(
    fazendaOptions.find((option) => option.id === contextoFazendaId),
    'Propriedade vinculada não encontrada'
  );

  return (
    <View style={styles.container}>
      <Header title="Editar Registro" showBack onBack={handleCancel} />

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
            <Text style={styles.label}>Propriedade vinculada <Text style={styles.required}>*</Text></Text>
            <View style={[styles.picker, styles.lockedPicker, errors.fazendaId && styles.inputError]}>
              <Text style={styles.pickerText}>{fazendaLabel}</Text>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted} />
            </View>
            <Text style={styles.contextHint}>A propriedade do registro não é alterada nesta edição.</Text>
            {errors.fazendaId && <Text style={styles.errorText}>{errors.fazendaId}</Text>}
          </View>

          {fieldVisibility.periodo && (
          <View ref={formValidation.registerField('periodoProdutivoId')} collapsable={false} style={styles.field}>
            <Text style={styles.label}>Safra/Safrinha <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowPeriodoPicker(!showPeriodoPicker)}
              disabled={loadingPeriodos}
            >
              <Text style={[styles.pickerText, !periodoProdutivoId && styles.placeholder]}>
                {loadingPeriodos
                  ? 'Carregando...'
                  : getCadernoFormPeriodoProdutivoLabel(periodoSelecionado)}
              </Text>
              <Ionicons
                name={showPeriodoPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.muted}
              />
            </TouchableOpacity>
            <Text style={styles.contextHint}>Obrigatória para Plantio e Colheita.</Text>
            {errors.periodoProdutivoId && <Text style={styles.errorText}>{errors.periodoProdutivoId}</Text>}

            {showPeriodoPicker && (
              <View style={styles.dropdownContainer}>
                <ScrollView style={styles.dropdown} nestedScrollEnabled>
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      !periodoProdutivoId && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setPeriodoProdutivoId('');
                      setShowPeriodoPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        !periodoProdutivoId && styles.dropdownItemTextSelected,
                      ]}
                    >
                      Sem Safra/Safrinha vinculada
                    </Text>
                    <Text style={styles.dropdownItemSubtext}>Manter o registro independente de período.</Text>
                  </TouchableOpacity>

                  {periodoOptions.length === 0 ? (
                    <View style={styles.dropdownItem}>
                      <Text style={styles.dropdownItemSubtext}>
                        Nenhuma Safra/Safrinha local cadastrada para esta Propriedade.
                      </Text>
                    </View>
                  ) : (
                    periodoOptions.map((periodo) => (
                      <TouchableOpacity
                        key={periodo.id}
                        style={[
                          styles.dropdownItem,
                          periodoProdutivoId === periodo.id && styles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setPeriodoProdutivoId(periodo.id);
                          setShowPeriodoPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownItemText,
                            periodoProdutivoId === periodo.id && styles.dropdownItemTextSelected,
                          ]}
                        >
                          {periodo.label}
                        </Text>
                        <Text style={styles.dropdownItemSubtext}>
                          {[periodo.status, periodo.talhao].filter(Boolean).join(' • ') || 'Período da Propriedade'}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            )}
          </View>
          )}
        </SectionCard>

        <SectionCard title="Registro de campo" subtitle="Atualize data, tipo, responsável e informações operacionais.">
          <View ref={formValidation.registerField('dataAtividade')} collapsable={false}>
            <DatePicker
              label="Data do registro"
              required
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
          </View>

          <View ref={formValidation.registerField('tipoAtividade')} collapsable={false} style={styles.field}>
            <Text style={styles.label}>
              Tipo de registro <Text style={styles.required}>*</Text>
            </Text>
            <RadioCardGroup
              options={CADERNO_TIPOS_ATIVIDADE.map((tipo) => ({
                value: tipo.value,
                label: tipo.label,
              }))}
              value={tipoAtividade}
              onChange={handleTipoAtividadeChange}
              error={errors.tipoAtividade}
            />
          </View>

          <View ref={formValidation.registerField('responsavel')} collapsable={false}>
            <FormField
              label="Responsável pelo registro"
              required
              value={responsavel}
              disabled
              leftIcon="person-outline"
              helperText={responsavelLegado
                ? 'Registro legado: o nome foi preservado sem atribuir um usuário por suposição.'
                : 'Referência de usuário preservada; este campo não altera autoria na edição.'}
              error={errors.responsavel}
            />
          </View>

          {fieldVisibility.talhao && (
          <View ref={formValidation.registerField('talhaoId')} collapsable={false}>
          <SelectField
            label="Talhão"
            required
            value={talhaoSelection.selectedValue}
            options={talhaoSelection.options}
            onChange={(value) => {
              if (value === CADERNO_TALHAO_LEGADO_VALUE) {
                setTalhaoId('');
                return;
              }
              const selected = talhaoSelection.options.find((option) => option.value === value);
              setTalhaoId(value);
              setTalhao(value ? selected?.label || '' : '');
              setErrors(prev => ({ ...prev, talhaoId: null }));
            }}
            helperText={isCadernoTalhaoLegado({ talhao_id: talhaoId, talhao })
              ? 'Referência legada em texto. Selecione um Talhão para reconciliar por ID ou mantenha como está.'
              : talhaoSelection.options.length > 1
                ? 'Opcional. A seleção grava o ID e preserva o nome exibido.'
                : 'Nenhum Talhão com ID estável; o registro abrangerá toda a Propriedade.'}
            placeholder="Toda a Propriedade"
            error={errors.talhaoId}
          />
          </View>
          )}

          {fieldVisibility.operacao && (
          <View ref={formValidation.registerField('operacao')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('operacao')}
              label="Operação de plantio"
              required
              value={operacao}
              onChangeText={(value) => {
                setOperacao(value);
                setErrors(prev => ({ ...prev, operacao: null }));
              }}
              placeholder="Ex: Semeadura direta"
              error={errors.operacao}
            />
          </View>
          )}

          {fieldVisibility.area && (
          <View ref={formValidation.registerField('areaAplicada')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('areaAplicada')}
              label="Área Aplicada (ha)"
              required
              value={areaAplicada}
              onChangeText={(value) => {
                setAreaAplicada(value);
                setErrors(prev => ({ ...prev, areaAplicada: null }));
              }}
              placeholder="Ex: 25,5"
              keyboardType="decimal-pad"
              error={errors.areaAplicada}
            />
          </View>
          )}

          {fieldVisibility.produtos && (
          <View ref={formValidation.registerField('produtos')} collapsable={false}>
          <FormField
            label="Produtos Utilizados"
            required
            value={produtosText}
            onChangeText={(value) => {
              setProdutosText(value);
              setErrors(prev => ({ ...prev, produtos: null }));
            }}
            placeholder="Separe produtos por vírgula"
            error={errors.produtos}
          />
          </View>
          )}

          {fieldVisibility.dosagem && (
          <View ref={formValidation.registerField('dosagem')} collapsable={false}>
          <FormField
            label="Dosagem"
            required
            value={dosagem}
            onChangeText={(value) => {
              setDosagem(value);
              setErrors(prev => ({ ...prev, dosagem: null }));
            }}
            placeholder="Ex: 300 kg/ha"
            error={errors.dosagem}
          />
          </View>
          )}

          {fieldVisibility.produtividade && (
          <View ref={formValidation.registerField('produtividade')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('produtividade')}
              label="Produtividade"
              required
              value={produtividade}
              onChangeText={(value) => {
                setProdutividade(value);
                setErrors(prev => ({ ...prev, produtividade: null }));
              }}
              placeholder="Ex: 62,5"
              keyboardType="decimal-pad"
              error={errors.produtividade}
            />
          </View>
          )}

          {fieldVisibility.clima && (
          <FormField
            label="Condições Climáticas"
            value={condicoesClima}
            onChangeText={setCondicoesClima}
            placeholder="Ex: Ensolarado, sem vento"
          />
          )}

          {fieldVisibility.observacoes && (
          <View ref={formValidation.registerField('observacoes')} collapsable={false}>
          <FormField
            label="Observações"
            required={['observacao', 'ocorrencia', 'outro'].includes(tipoAtividade)}
            value={observacoes}
            onChangeText={(value) => {
              setObservacoes(value);
              setErrors(prev => ({ ...prev, observacoes: null }));
            }}
            placeholder="Descreva o registro de campo..."
            textarea
            numberOfLines={4}
            error={errors.observacoes}
          />
          </View>
          )}
        </SectionCard>

        <CadernoLocalizacaoSection
          mode="edit"
          currentLocation={
            localizacaoState.intent === 'replace' ? localizacaoState.draftLocation : null
          }
          existingLocation={localizacaoState.existingLocation}
          loading={loadingLocalizacao}
          errorMessage={localizacaoError}
          removalPending={localizacaoState.intent === 'remove'}
          hasTalhaoContext={Boolean(talhaoId || talhao.trim())}
          disabled={saving}
          onCapture={() => {
            if (!savingRef.current) void captureLocalizacao(contextoFazendaId);
          }}
          onRemove={() => {
            cancelPendingLocalizacao();
            clearCaptureError();
            setLocalizacaoState((current) => setCadernoLocalizacaoEditRemoval(current));
          }}
          onUndoRemove={() => {
            clearCaptureError();
            setLocalizacaoState((current) => undoCadernoLocalizacaoEditRemoval(current));
          }}
        />

        {user?.perfil === 'produtor' ? (
          <InfoBox message="O registro ficará visível para você e para a equipe autorizada da Propriedade." />
        ) : (
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
        )}

        <InfoBox message="Este rascunho ainda aceita edição. Após revisar e confirmar, o conteúdo original será preservado e mudanças posteriores ficarão auditadas." />
      </ScrollView>

      <FormFooter
        onCancel={() => void handlePersist(false)}
        cancelLabel="Salvar rascunho"
        cancelIcon="save-outline"
        onSubmit={handleReviewSubmit}
        submitLabel="Revisar e enviar"
        submitIcon="send-outline"
        loading={saving}
        disabled={loadingLocalizacao}
      />

      <ConfirmDialog
        visible={showSubmitConfirm}
        title="Confirmar envio ao Caderno"
        message="Revise os dados. Depois da confirmação, o registro deixa de aceitar edição direta; correções e complementos ficam no histórico de auditoria."
        type="warning"
        confirmText="Confirmar e enviar"
        onCancel={() => setShowSubmitConfirm(false)}
        onConfirm={() => {
          setShowSubmitConfirm(false);
          void handlePersist(true);
        }}
        loading={saving}
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
  lockedPicker: {
    backgroundColor: colors.backgroundAlt,
    borderColor: colors.borderLight,
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
