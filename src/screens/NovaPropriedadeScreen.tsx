import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import SelectField from '../components/SelectField';
import SegmentedChips from '../components/SegmentedChips';
import { useToast } from '../components/Toast';
import { Produtor, User } from '../api/mock';
import { useAuth } from '../auth/AuthContext';
import theme from '../theme';
import {
  validarArea,
  validarUF,
  validarObrigatorio
} from '../utils/validacoes';
import { podeCriarProdutor } from '../utils/acessoControle';
import {
  buildCadastroFazendaPayload,
  buildCadastroTitularOptionsFromUsers,
  validateCadastroFazendaScope
} from '../utils/fazendaCadastroCompat';
import {
  listarMicroregioesPorRegiao,
  listarRegioes,
  sugerirColaboradoresParaMicroregiao,
} from '../utils/territorioCompat';
import { getUsuarioNome } from '../utils/usuarioAdminCompat';

const STATUS_PROPRIEDADE = [
  { value: 'ativo', label: 'Ativo', icon: 'checkmark-circle-outline' as const },
  { value: 'pendente', label: 'Pendente', icon: 'time-outline' as const },
  { value: 'inativo', label: 'Inativo', icon: 'pause-circle-outline' as const },
];

const getScopeErrorMessage = (reason?: string) => {
  switch (reason) {
    case 'perfil_sem_permissao':
      return 'Seu perfil não permite cadastrar propriedades.';
    case 'regiao_fora_escopo':
      return 'A região informada está fora do seu escopo.';
    case 'microregiao_fora_escopo':
      return 'Selecione uma microregião dentro do seu escopo.';
    default:
      return 'Não foi possível validar seu escopo de criação.';
  }
};

export default function NovaPropriedadeScreen({ navigation }) {
  const toast = useToast();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loadingTitulares, setLoadingTitulares] = useState(true);
  const [titulares, setTitulares] = useState<any[]>([]);
  const [fazendasTerritorio, setFazendasTerritorio] = useState<any[]>([]);
  const [usuariosMock, setUsuariosMock] = useState<any[]>([]);
  const [titularSelecionadoId, setTitularSelecionadoId] = useState('');
  const [colaboradorSelecionadoId, setColaboradorSelecionadoId] = useState('');
  const [errors, setErrors] = useState<any>({});
  const [form, setForm] = useState({
    fazenda: '',
    area_total: '',
    documento: '',
    cultura_atual: '',
    cidade: '',
    estado: '',
    regiao: '',
    microregiao: '',
    status: 'ativo'
  });

  const colaboradores = useMemo(
    () => usuariosMock
      .filter((usuario) => usuario?.perfil === 'colaborador')
      .sort((a, b) => getUsuarioNome(a).localeCompare(getUsuarioNome(b))),
    [usuariosMock]
  );

  const colaboradorSelecionado = useMemo(
    () => colaboradores.find((colaborador) => colaborador.id === colaboradorSelecionadoId),
    [colaboradorSelecionadoId, colaboradores]
  );

  const microregioesPermitidas = user?.perfil === 'colaborador' ? (user.sub_regioes || []) : [];
  const regiaoAtual = user?.perfil === 'colaborador' ? (user.regiao || '') : form.regiao;

  const regioesTerritorio = useMemo(
    () => listarRegioes(fazendasTerritorio),
    [fazendasTerritorio]
  );

  const microregioesTerritorio = useMemo(
    () => (regiaoAtual ? listarMicroregioesPorRegiao(fazendasTerritorio, regiaoAtual) : []),
    [fazendasTerritorio, regiaoAtual]
  );

  const microregioesDisponiveis = useMemo(() => {
    if (user?.perfil !== 'colaborador') return microregioesTerritorio;

    if (microregioesPermitidas.length === 0) return [];

    const permitidas = new Set(microregioesPermitidas);
    const filtradas = microregioesTerritorio.filter((microregiao) => permitidas.has(microregiao.nome));

    if (filtradas.length > 0) return filtradas;

    return microregioesPermitidas.map((microregiao) => ({
      id: `microregiao-legada-${microregiao}`,
      nome: microregiao,
      regiao: regiaoAtual,
      regiao_id: `regiao-legada-${regiaoAtual || 'sem-regiao'}`,
    }));
  }, [microregioesPermitidas, microregioesTerritorio, regiaoAtual, user?.perfil]);

  const colaboradoresSugeridos = useMemo(
    () =>
      form.microregiao
        ? sugerirColaboradoresParaMicroregiao(
            usuariosMock,
            form.microregiao,
            regiaoAtual,
            fazendasTerritorio
          )
        : [],
    [fazendasTerritorio, form.microregiao, regiaoAtual, usuariosMock]
  );

  useEffect(() => {
    loadTitulares();
  }, []);

  useEffect(() => {
    if (user?.perfil === 'colaborador') {
      setForm(prev => ({
        ...prev,
        regiao: user.regiao || '',
        microregiao: microregioesPermitidas.includes(prev.microregiao) ? prev.microregiao : ''
      }));
    }
  }, [user?.perfil, user?.regiao, user?.sub_regioes]);

  const loadTitulares = async () => {
    try {
      setLoadingTitulares(true);
      const [fazendas, usuarios] = await Promise.all([
        Produtor.list(),
        User.list(),
      ]);
      const options = buildCadastroTitularOptionsFromUsers(usuarios, fazendas);
      setTitulares(options);
      setFazendasTerritorio(fazendas as any[]);
      setUsuariosMock(usuarios as any[]);

      setTitularSelecionadoId(prev =>
        options.some((option) => option.id === prev) ? prev : ''
      );
    } catch (error) {
      toast.showError('Não foi possível carregar produtores titulares');
      console.error(error);
    } finally {
      setLoadingTitulares(false);
    }
  };

  const handleChange = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
    if (errors[campo]) {
      setErrors(prev => ({ ...prev, [campo]: null }));
    }
  };

  const handleRegiaoSelect = (regiao: string) => {
    setForm(prev => ({
      ...prev,
      regiao,
      microregiao: prev.regiao === regiao ? prev.microregiao : '',
    }));
    setErrors(prev => ({ ...prev, regiao: null, microregiao: null }));
  };

  const buildPayload = () =>
    buildCadastroFazendaPayload({
      mode: 'existente',
      titularId: titularSelecionadoId,
      fazendaNome: form.fazenda,
      areaTotal: form.area_total,
      documento: form.documento,
      culturaAtual: form.cultura_atual,
      cidade: form.cidade,
      estado: form.estado,
      regiao: user?.perfil === 'colaborador' ? user.regiao : form.regiao,
      microregiao: form.microregiao,
      status: form.status,
      colaboradorResponsavelId: colaboradorSelecionado?.id,
      colaboradorResponsavelNome: colaboradorSelecionado
        ? getUsuarioNome(colaboradorSelecionado)
        : '',
      titulares,
    });

  const validateForm = () => {
    const newErrors: any = {};

    if (!podeCriarProdutor(user)) {
      newErrors.escopo = 'Seu perfil não permite cadastrar propriedades.';
    }

    if (!titularSelecionadoId) {
      newErrors.titular = 'Selecione um produtor titular';
    }

    if (!validarObrigatorio(form.fazenda)) {
      newErrors.fazenda = 'Propriedade é obrigatória';
    }

    if (!validarArea(form.area_total)) {
      newErrors.area_total = 'Informe uma área válida';
    }

    if (form.estado && !validarUF(form.estado)) {
      newErrors.estado = 'UF inválida (Ex: RS, SP)';
    }

    const regiaoFinal = user?.perfil === 'colaborador' ? user.regiao : form.regiao;
    if (!validarObrigatorio(regiaoFinal)) {
      newErrors.regiao = 'Região é obrigatória';
    }

    if (!validarObrigatorio(form.microregiao)) {
      newErrors.microregiao = 'Microregião é obrigatória';
    }

    const payload = buildPayload();
    const scopeResult = validateCadastroFazendaScope(user, payload);
    if (!scopeResult.ok) {
      newErrors.escopo = getScopeErrorMessage(scopeResult.reason);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning('Preencha todos os campos obrigatórios corretamente');
      return;
    }

    try {
      setSaving(true);
      const dataToSave = buildPayload();
      await Produtor.create(dataToSave);

      toast.showSuccess('Propriedade cadastrada e salva localmente!');
      navigation.goBack();
    } catch (error) {
      toast.showError('Não foi possível cadastrar a propriedade. Tente novamente.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Nova Propriedade" showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <InfoBox
          title="Cadastro local demonstrativo"
          message="A Propriedade será salva somente neste aparelho. Não há backend ou sincronização nesta fase; prefira vincular um Titular existente."
        />

        {errors.escopo && (
          <InfoBox variant="error" message={errors.escopo} />
        )}

        <SectionCard title="Dados da Propriedade" subtitle="Nome e Área total informada são obrigatórios para o cadastro local.">
          <FormField
            label="Nome da Propriedade"
            required
            value={form.fazenda}
            onChangeText={(text) => handleChange('fazenda', text)}
            placeholder="Nome da propriedade"
            error={errors.fazenda}
          />

          <FormField
            label="Área em hectares"
            required
            value={form.area_total}
            onChangeText={(text) => handleChange('area_total', text)}
            placeholder="Ex: 500"
            keyboardType="numeric"
            error={errors.area_total}
            helperText="Valor cadastral informado para a demonstração; não representa necessariamente a área mapeada."
          />

          <FormField
            label="CNPJ ou inscrição"
            value={form.documento}
            onChangeText={(text) => handleChange('documento', text)}
            placeholder="CNPJ, inscrição estadual ou cadastro equivalente"
            helperText="Campo opcional para identificação cadastral da Propriedade."
          />
        </SectionCard>

        <SectionCard title="Responsáveis" subtitle="Selecione usuários já cadastrados. Este formulário não cria Produtor ou Colaborador.">
          {loadingTitulares ? (
            <View style={styles.loadingTitulares}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.helperText}>Carregando usuários cadastrados...</Text>
            </View>
          ) : (
            <SelectField
              label="Titular / Produtor"
              required
              value={titularSelecionadoId}
              options={titulares.map((titular) => ({
                value: titular.id,
                label: titular.status_label ? `${titular.nome} (${titular.status_label})` : titular.nome,
                description: titular.fazendas_nomes?.join(', ') || 'Produtor cadastrado sem Propriedade vinculada',
              }))}
              onChange={(value) => {
                setTitularSelecionadoId(value);
                setErrors(prev => ({ ...prev, titular: null }));
              }}
              placeholder="Selecione um usuário produtor"
              error={errors.titular}
              helperText={
                titulares.length === 0
                  ? 'Nenhum usuário produtor com vínculo compatível foi encontrado. Cadastre o Produtor em Usuários.'
                  : 'A interface mostra o nome; o vínculo compatível continua salvo pelo identificador do Produtor.'
              }
            />
          )}

          <SelectField
            label="Colaborador responsável"
            value={colaboradorSelecionadoId}
            options={[
              { value: '', label: 'Nenhum colaborador selecionado' },
              ...colaboradores.map((colaborador) => ({
                value: colaborador.id,
                label: getUsuarioNome(colaborador),
                description: [colaborador.regiao, colaborador.email].filter(Boolean).join(' • '),
              })),
            ]}
            onChange={setColaboradorSelecionadoId}
            placeholder="Selecione um usuário colaborador"
            helperText="Vínculo cadastral local; não altera permissões ou escopo regional."
          />
        </SectionCard>

        <SectionCard title="Dados produtivos" subtitle="Campo opcional para facilitar a identificação durante o teste.">
          <FormField
            label="Cultura principal"
            value={form.cultura_atual}
            onChangeText={(text) => handleChange('cultura_atual', text)}
            placeholder="Ex: Soja, Milho, Trigo"
          />
        </SectionCard>

        <SectionCard title="Status" subtitle="Define como a Propriedade aparece nas listagens locais.">
          <View style={styles.field}>
            <Text style={styles.label}>Status da propriedade <Text style={styles.required}>*</Text></Text>
            <SegmentedChips
              options={STATUS_PROPRIEDADE}
              value={form.status}
              onChange={(value) => handleChange('status', value)}
            />
          </View>
        </SectionCard>

        <SectionCard title="Localização e Região" subtitle="Cidade e UF são opcionais. Região e Microregião mantêm o escopo territorial atual do mock.">
          <FormField
            label="Cidade (opcional)"
            value={form.cidade}
            onChangeText={(text) => handleChange('cidade', text)}
            placeholder="Nome da cidade"
          />

          <FormField
            label="UF (opcional)"
            value={form.estado}
            onChangeText={(text) => handleChange('estado', text.toUpperCase())}
            placeholder="Ex: RS, SP, GO"
            maxLength={2}
            autoCapitalize="characters"
            error={errors.estado}
          />

          {user?.perfil === 'colaborador' ? (
            <FormField
              label="Região"
              required
              value={user.regiao || ''}
              disabled
              placeholder="Região do colaborador"
              error={errors.regiao}
            />
          ) : regioesTerritorio.length > 0 ? (
            <View style={styles.field}>
              <Text style={styles.label}>Região <Text style={styles.required}>*</Text></Text>
              <SegmentedChips
                options={regioesTerritorio.map((regiao) => ({
                  value: regiao.nome,
                  label: regiao.nome,
                  icon: 'map-outline',
                }))}
                value={form.regiao}
                onChange={handleRegiaoSelect}
              />
              {errors.regiao && <Text style={styles.errorText}>{errors.regiao}</Text>}
            </View>
          ) : (
            <FormField
              label="Região"
              required
              value={form.regiao}
              onChangeText={(text) => handleChange('regiao', text)}
              placeholder="Ex: Sul, Goiás, Mato Grosso"
              error={errors.regiao}
            />
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Microregião <Text style={styles.required}>*</Text></Text>
            {microregioesDisponiveis.length > 0 ? (
              <SegmentedChips
                options={microregioesDisponiveis.map((microregiao) => ({
                  value: microregiao.nome,
                  label: microregiao.nome,
                  icon: 'location-outline',
                }))}
                value={form.microregiao}
                onChange={(value) => handleChange('microregiao', value)}
              />
            ) : user?.perfil === 'colaborador' ? (
              <Text style={styles.helperText}>Nenhuma microregião vinculada ao seu usuário.</Text>
            ) : regiaoAtual ? (
              <FormField
                value={form.microregiao}
                onChangeText={(text) => handleChange('microregiao', text)}
                placeholder="Ex: RS - Norte, Rio Verde, Sorriso"
              />
            ) : (
              <Text style={styles.helperText}>Selecione uma região para carregar as microregiões do mock.</Text>
            )}
            {errors.microregiao && <Text style={styles.errorText}>{errors.microregiao}</Text>}
          </View>

          {form.microregiao && (
            <View style={styles.suggestionBox}>
              <View style={styles.suggestionHeader}>
                <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.suggestionTitle}>Colaboradores sugeridos para a microregião</Text>
              </View>
              {colaboradoresSugeridos.length === 0 ? (
                <Text style={styles.helperText}>Nenhum colaborador sugerido no mock para esta microregião.</Text>
              ) : (
                colaboradoresSugeridos.slice(0, 5).map((colaborador) => (
                  <Text key={colaborador.id} style={styles.suggestionItem}>
                    {getUsuarioNome(colaborador)}
                  </Text>
                ))
              )}
              <Text style={styles.suggestionNote}>
                Sugestão visual/mockada. O cadastro continua salvando região e microregião textuais para compatibilidade.
              </Text>
            </View>
          )}
        </SectionCard>

        <View style={{ height: 100 }} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
        submitLabel="Salvar localmente"
        loading={saving}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  loadingTitulares: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontCaption + 1,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.fontBody,
    fontWeight: theme.typography.weightSemibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  required: {
    color: theme.colors.error,
  },
  errorText: {
    fontSize: theme.typography.fontCaption,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
  },
  suggestionBox: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.spacing.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  suggestionTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.fontCaption + 1,
    fontWeight: theme.typography.weightBold,
  },
  suggestionItem: {
    color: theme.colors.text,
    fontSize: theme.typography.fontCaption + 1,
    marginBottom: theme.spacing.xs,
  },
  suggestionNote: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontCaption,
    lineHeight: 17,
    marginTop: theme.spacing.sm,
  },
});
