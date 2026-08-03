import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import CadernoLocalizacaoSection from '../components/CadernoLocalizacaoSection';
import Header from '../components/Header';
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
  filtrarProdutoresPorAcesso,
  filtrarLimitesPorFazendaIds,
  findFazendaById,
  getFazendaId,
  podeIncluirCaderno,
  podeIncluirCadernoEmFazenda,
} from '../utils/acessoControle';
import {
  CADERNO_TIPOS_ATIVIDADE,
  CADERNO_TALHAO_LEGADO_VALUE,
  buildCadernoFazendaOptions,
  buildCadernoPeriodoProdutivoOptions,
  buildCadernoPayload,
  buildCadernoTalhaoOptions,
  findCadernoFazendaOption,
  findCadernoPeriodoProdutivoOption,
  findCadernoTalhaoByRoute,
  getCadernoFormFazendaLabel,
  getCadernoFormPeriodoProdutivoLabel,
  parseCadernoAreaAplicada,
} from '../utils/cadernoFormCompat';
import type { CadernoLocalizacaoExplicita } from '../utils/cadernoLocalizacaoCompat';
import {
  CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE,
  appendCadernoLocalizacaoDraft,
  shouldDiscardCadernoLocalizacaoDraftForPropertyChange,
} from '../utils/cadernoLocalizacaoUiCompat';

const CADERNO_FORM_ERROR_ORDER = ['fazendaId', 'dataAtividade', 'tipoAtividade', 'responsavel', 'areaAplicada'] as const;

export default function NovoCadernoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuth();
  const formValidation = useFormValidationFocus(CADERNO_FORM_ERROR_ORDER);

  const routeFazendaId =
    route.params?.fazendaId
    || route.params?.produtorId
    || route.params?.propriedadeId
    || route.params?.fazenda_id;
  const routeTalhaoId = route.params?.talhaoId || route.params?.talhao_id || '';
  const routeTalhao = route.params?.talhaoNome || route.params?.talhao || '';
  const isProdutorView = user?.perfil === 'produtor';
  const responsavelInicial = user?.nome || user?.full_name || '';

  const [fazendaId, setFazendaId] = useState('');
  const [dataAtividade, setDataAtividade] = useState(new Date());
  const [tipoAtividade, setTipoAtividade] = useState('observacao');
  const [responsavel, setResponsavel] = useState(responsavelInicial);
  const [talhaoId, setTalhaoId] = useState(routeTalhaoId);
  const [talhao, setTalhao] = useState(routeTalhao);
  const [produtosText, setProdutosText] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [areaAplicada, setAreaAplicada] = useState('');
  const [condicoesClima, setCondicoesClima] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [visivelParaProdutor, setVisivelParaProdutor] = useState(true);
  const [periodoProdutivoId, setPeriodoProdutivoId] = useState('');

  const [fazendas, setFazendas] = useState([]);
  const [talhoesDisponiveis, setTalhoesDisponiveis] = useState<any[]>([]);
  const [periodosProdutivos, setPeriodosProdutivos] = useState([]);
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [loadingPeriodos, setLoadingPeriodos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showFazendaPicker, setShowFazendaPicker] = useState(false);
  const [showPeriodoPicker, setShowPeriodoPicker] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [localizacaoDraft, setLocalizacaoDraft] = useState<CadernoLocalizacaoExplicita | null>(null);
  const [localizacaoFazendaId, setLocalizacaoFazendaId] = useState<string | null>(null);
  const [localizacaoNotice, setLocalizacaoNotice] = useState('');
  const savingRef = useRef(false);
  const fazendaIdRef = useRef(fazendaId);
  fazendaIdRef.current = fazendaId;

  const handleLocationCaptured = useCallback((
    draft: CadernoLocalizacaoExplicita,
    capturedForFazendaId?: string
  ) => {
    const currentFazendaId = String(fazendaIdRef.current || '').trim();
    const capturedContextId = String(capturedForFazendaId || '').trim();

    if (!currentFazendaId || capturedContextId !== currentFazendaId) {
      setLocalizacaoDraft(null);
      setLocalizacaoFazendaId(null);
      setLocalizacaoNotice(CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE);
      return;
    }

    setLocalizacaoDraft(draft);
    setLocalizacaoFazendaId(capturedContextId);
    setLocalizacaoNotice('');
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

  const discardLocalizacao = useCallback(() => {
    cancelPendingLocalizacao();
    clearCaptureError();
    setLocalizacaoDraft(null);
    setLocalizacaoFazendaId(null);
    setLocalizacaoNotice('');
  }, [cancelPendingLocalizacao, clearCaptureError]);

  const handleCancel = useCallback(() => {
    discardLocalizacao();
    navigation.goBack();
  }, [discardLocalizacao, navigation]);

  useFocusEffect(
    useCallback(() => () => {
      discardLocalizacao();
    }, [discardLocalizacao])
  );

  useEffect(() => {
    cancelPendingLocalizacao();
    clearCaptureError();

    if (
      localizacaoDraft
      && shouldDiscardCadernoLocalizacaoDraftForPropertyChange(localizacaoFazendaId, fazendaId)
    ) {
      setLocalizacaoDraft(null);
      setLocalizacaoFazendaId(null);
      setLocalizacaoNotice(CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE);
    }
  }, [fazendaId]);

  const fazendaOptions = useMemo(() => buildCadernoFazendaOptions(fazendas), [fazendas]);
  const periodoOptions = useMemo(
    () => buildCadernoPeriodoProdutivoOptions(periodosProdutivos),
    [periodosProdutivos]
  );
  const fazendaSelecionada = useMemo(
    () => findCadernoFazendaOption(fazendaOptions, fazendaId),
    [fazendaOptions, fazendaId]
  );
  const periodoSelecionado = useMemo(
    () => findCadernoPeriodoProdutivoOption(periodoOptions, periodoProdutivoId),
    [periodoOptions, periodoProdutivoId]
  );
  const talhoesDaFazenda = useMemo(
    () => filtrarLimitesPorFazendaIds(talhoesDisponiveis, fazendaId ? [fazendaId] : []),
    [fazendaId, talhoesDisponiveis]
  );
  const talhaoSelection = useMemo(
    () => buildCadernoTalhaoOptions(talhoesDaFazenda, { id: talhaoId, nome: talhao }),
    [talhao, talhaoId, talhoesDaFazenda]
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

  useEffect(() => {
    if (isProdutorView) {
      setVisivelParaProdutor(true);
    }
  }, [isProdutorView]);

  useEffect(() => {
    void loadPeriodosProdutivos(fazendaId);
  }, [fazendaId]);

  useEffect(() => {
    if (!routeTalhaoId) return;

    const routeTalhaoSelecionado = findCadernoTalhaoByRoute(talhoesDaFazenda, routeTalhaoId);
    setTalhaoId(routeTalhaoSelecionado?.id || '');
    setTalhao(routeTalhaoSelecionado?.nome || '');
  }, [routeTalhaoId, talhoesDaFazenda]);

  const loadPeriodosProdutivos = async (contextoFazendaId) => {
    const normalizedFazendaId = String(contextoFazendaId || '').trim();
    setShowPeriodoPicker(false);

    if (!normalizedFazendaId) {
      setPeriodosProdutivos([]);
      setPeriodoProdutivoId('');
      return;
    }

    setLoadingPeriodos(true);
    try {
      const periodos = await PeriodoProdutivoService.listActivePeriodosProdutivosByPropriedade(normalizedFazendaId);
      setPeriodosProdutivos(periodos);
      setPeriodoProdutivoId((current) => (
        periodos.some((periodo) => periodo.id === current) ? current : ''
      ));
    } catch (error) {
      console.error('Erro ao carregar periodos produtivos para caderno:', error);
      setPeriodosProdutivos([]);
      setPeriodoProdutivoId('');
    } finally {
      setLoadingPeriodos(false);
    }
  };

  const loadFazendas = async () => {
    setLoadingFazendas(true);
    setAccessDenied(false);

    try {
      if (!podeIncluirCaderno(user)) {
        setFazendaId('');
        setFazendas([]);
        setTalhoesDisponiveis([]);
        setAccessDenied(true);
        return;
      }

      const [fazendasDisponiveis, limitesDisponiveis] = await Promise.all([
        Produtor.list(),
        LimiteArea.list(),
      ]);
      const fazendasPermitidas = filtrarProdutoresPorAcesso(fazendasDisponiveis, user);

      if (routeFazendaId) {
        const fazendaRota = findFazendaById(fazendasPermitidas, routeFazendaId);

        if (!podeIncluirCadernoEmFazenda(user, fazendaRota)) {
          setFazendaId('');
          setFazendas([]);
          setTalhoesDisponiveis([]);
          setAccessDenied(true);
          toast.showWarning('Você não tem permissão para criar registro nesta propriedade.');
          return;
        }

        setFazendaId(routeFazendaId);
      } else if (fazendasPermitidas.length === 1) {
        setFazendaId(getFazendaId(fazendasPermitidas[0]));
      }

      setFazendas(fazendasPermitidas);
      setTalhoesDisponiveis(limitesDisponiveis);
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

    if (!String(user?.id || '').trim() || !responsavel.trim()) {
      newErrors.responsavel = 'Sessão sem referência estável de usuário';
    }

    if (parseCadernoAreaAplicada(areaAplicada) === null) {
      newErrors.areaAplicada = 'Informe uma área maior que zero';
    }

    setErrors(newErrors);
    formValidation.focusFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (savingRef.current || loadingLocalizacao || isCapturePending()) return;

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

    const draftPertenceAFazenda = !localizacaoDraft
      || (
        String(localizacaoFazendaId || '').trim().length > 0
        && String(localizacaoFazendaId || '').trim() === String(fazendaId || '').trim()
      );

    if (!draftPertenceAFazenda) {
      cancelPendingLocalizacao();
      clearCaptureError();
      setLocalizacaoDraft(null);
      setLocalizacaoFazendaId(null);
      setLocalizacaoNotice(CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE);
      toast.showWarning(CADERNO_LOCALIZACAO_PROPERTY_CHANGED_MESSAGE);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const visibilidadeEfetiva = isProdutorView ? true : visivelParaProdutor;
      const novoRegistro = buildCadernoPayload({
        fazendaId,
        dataAtividade,
        tipoAtividade,
        talhaoId,
        talhao,
        produtosText,
        dosagem,
        areaAplicadaText: areaAplicada,
        condicoesClima,
        observacoes,
        visivelParaProdutor: visibilidadeEfetiva,
        responsavelUsuarioId: user?.id,
        colaboradorResponsavel: responsavel,
        criadoPorUserId: user?.id,
        criadoPorNome: responsavel,
        origemRegistro: isProdutorView ? 'produtor' : 'equipe',
        periodoProdutivo: periodoSelecionado,
      });

      if (!novoRegistro) {
        throw new Error('Não foi possível montar o payload do caderno');
      }

      const payloadComLocalizacao = appendCadernoLocalizacaoDraft(novoRegistro, localizacaoDraft);
      const criado = await CadernoCampo.create(payloadComLocalizacao);
      setLocalizacaoDraft(null);
      setLocalizacaoFazendaId(null);
      setLocalizacaoNotice('');
      toast.showSuccess(isProdutorView ? 'Registro enviado ao Caderno!' : 'Registro de caderno criado com sucesso!');
      navigation.replace('CadernoDetail', { cadernoId: criado.id });
    } catch (error) {
      console.error('Erro ao salvar registro de caderno:', error);
      toast.showError('Erro ao criar registro de caderno');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loadingFazendas) {
    return (
      <View style={styles.container}>
        <Header title={isProdutorView ? 'Registrar no Caderno' : 'Novo Registro'} showBack onBack={handleCancel} />
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
        <Header title={isProdutorView ? 'Registrar no Caderno' : 'Novo Registro'} showBack onBack={handleCancel} />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedText}>Acesso restrito</Text>
          <Text style={styles.blockedSubtext}>Você não tem permissão para registrar Caderno nesta propriedade.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={isProdutorView ? 'Registrar no Caderno' : 'Novo Registro'} showBack onBack={handleCancel} />

      <ScrollView
        ref={formValidation.scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <SectionCard title="Contexto" subtitle="Defina a propriedade onde o registro será salvo.">
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
                        setTalhaoId('');
                        setTalhao('');
                        setPeriodoProdutivoId('');
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

          <View style={styles.field}>
            <Text style={styles.label}>Safra/Safrinha</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowPeriodoPicker(!showPeriodoPicker)}
              disabled={!fazendaId || loadingPeriodos}
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
            <Text style={styles.contextHint}>Opcional. O registro pode ficar sem Safra/Safrinha vinculada.</Text>

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
                    <Text style={styles.dropdownItemSubtext}>Registro independente de período.</Text>
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
        </SectionCard>

        <SectionCard title="Registro de campo" subtitle="Registre data, tipo, responsável e informações operacionais.">
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
              onChange={(value) => {
                setTipoAtividade(value);
                setErrors(prev => ({ ...prev, tipoAtividade: null }));
              }}
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
              helperText="Vinculado ao usuário autenticado; o nome será preservado como snapshot."
              error={errors.responsavel}
            />
          </View>

          <SelectField
            label="Talhão"
            value={talhaoSelection.selectedValue}
            options={talhaoSelection.options}
            onChange={(value) => {
              if (value === CADERNO_TALHAO_LEGADO_VALUE) return;
              const selected = talhaoSelection.options.find((option) => option.value === value);
              setTalhaoId(value);
              setTalhao(value ? selected?.label || '' : '');
            }}
            disabled={!fazendaId}
            helperText={talhaoSelection.options.length > 1
              ? 'Opcional. A seleção grava o ID e preserva o nome exibido.'
              : 'Nenhum Talhão com ID estável; o registro abrangerá toda a Propriedade.'}
            placeholder="Toda a Propriedade"
          />

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

        <CadernoLocalizacaoSection
          mode="create"
          currentLocation={localizacaoDraft}
          loading={loadingLocalizacao}
          errorMessage={localizacaoError}
          noticeMessage={localizacaoNotice}
          hasTalhaoContext={Boolean(talhaoId)}
          disabled={saving || !fazendaId}
          onCapture={() => {
            if (!savingRef.current) void captureLocalizacao(fazendaId);
          }}
          onRemove={() => {
            cancelPendingLocalizacao();
            clearCaptureError();
            setLocalizacaoDraft(null);
            setLocalizacaoFazendaId(null);
            setLocalizacaoNotice('');
          }}
        />

        {isProdutorView ? (
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

        <InfoBox message="O registro será salvo no caderno da propriedade selecionada." />
      </ScrollView>

      <FormFooter
        onCancel={handleCancel}
        onSubmit={handleSave}
        submitLabel={isProdutorView ? 'Registrar no Caderno' : 'Salvar Registro'}
        loading={saving}
        disabled={loadingFazendas || semFazendasAutorizadas || loadingLocalizacao}
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
