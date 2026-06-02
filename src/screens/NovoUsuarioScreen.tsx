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
import FormField from '../components/FormField';
import FormFooter from '../components/FormFooter';
import Header from '../components/Header';
import InfoBox from '../components/InfoBox';
import SectionCard from '../components/SectionCard';
import SegmentedChips from '../components/SegmentedChips';
import { Produtor, User } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { colors, spacing, typography } from '../theme';
import { getFazendaId, getTitularIdFazenda } from '../utils/acessoControle';
import {
  buildCadastroFazendaPayload,
  buildCadastroTitularOptions,
} from '../utils/fazendaCadastroCompat';
import {
  NIVEIS_ADMIN_USUARIO,
  STATUS_USUARIO_ADMIN,
  TIPOS_VINCULO_PROPRIEDADE_USUARIO,
  buildUsuarioAdminPayload,
  buildUsuarioFormFromMock,
  getFazendaOptionLabel,
  getUsuarioNome,
  getUsuarioPerfilLabel,
  getVinculoPropriedadeLabel,
  getVinculosPropriedadeUsuario,
  normalizeFormVinculosPropriedade,
  parseListaTexto,
} from '../utils/usuarioAdminCompat';
import {
  listarMicroregioesPorRegiao,
  listarPropriedadesPorMicroregioes,
  listarRegioes,
  sugerirColaboradoresParaMicroregiao,
} from '../utils/territorioCompat';

const PERFIS_FORM = [
  { key: 'produtor', label: getUsuarioPerfilLabel('produtor'), icon: 'leaf-outline' },
  { key: 'colaborador', label: getUsuarioPerfilLabel('colaborador'), icon: 'briefcase-outline' },
  { key: 'admin', label: getUsuarioPerfilLabel('admin'), icon: 'shield-checkmark-outline' },
];

const TIPOS_VINCULO_PRODUTOR = TIPOS_VINCULO_PROPRIEDADE_USUARIO.filter((tipo) =>
  ['titular', 'responsavel', 'outro'].includes(tipo.key)
);

const emptyForm = {
  nome: '',
  email: '',
  telefone: '',
  documento: '',
  perfil: 'produtor',
  status: 'ativo',
  observacoes: '',
  produtor_id: '',
  vinculosPropriedades: [] as any[],
  regiao: '',
  cargo: '',
  subRegioesText: '',
  nivelAdministrativo: 'global',
};

const emptyPropriedadeRapida = {
  ativa: false,
  nome: '',
  municipio: '',
  estado: '',
  regiao: '',
  microregiao: '',
  area_total: '',
  status: 'ativo',
  observacoes: '',
  tipo_vinculo: 'titular',
  principal: true,
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function NovoUsuarioScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuthState();
  const userId = route.params?.userId || route.params?.id;
  const isEdit = Boolean(userId);

  const [form, setForm] = useState<any>(emptyForm);
  const [propriedadeRapida, setPropriedadeRapida] = useState<any>(emptyPropriedadeRapida);
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    load();
  }, [userId, user?.perfil]);

  const load = async () => {
    setLoading(true);
    try {
      if (user?.perfil !== 'admin') {
        return;
      }

      const [propriedadesData, usuariosData] = await Promise.all([
        Produtor.list(),
        User.list(),
      ]);
      setPropriedades(propriedadesData as any[]);
      setUsuarios(usuariosData as any[]);

      if (isEdit) {
        const usuarioData = await User.get(userId);
        setUsuarioAtual(usuarioData);
        setForm(buildUsuarioFormFromMock(usuarioData, propriedadesData as any[]));
        setPropriedadeRapida(emptyPropriedadeRapida);
      } else {
        setUsuarioAtual(null);
        setForm(emptyForm);
        setPropriedadeRapida(emptyPropriedadeRapida);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const updatePropriedadeRapida = (field: string, value: any) => {
    setPropriedadeRapida((prev) => ({ ...prev, [field]: value }));
    const errorKey = `propriedadeRapida_${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({ ...prev, [errorKey]: null }));
    }
  };

  const togglePropriedadeRapida = () => {
    setPropriedadeRapida((prev) => (
      prev.ativa
        ? emptyPropriedadeRapida
        : { ...emptyPropriedadeRapida, ativa: true, principal: vinculosPropriedades.length === 0 }
    ));
    setErrors((prev) => ({
      ...prev,
      vinculosPropriedades: null,
      propriedadeRapida_nome: null,
      propriedadeRapida_regiao: null,
      propriedadeRapida_microregiao: null,
      propriedadeRapida_area_total: null,
      propriedadeRapida_status: null,
      propriedadeRapida_estado: null,
    }));
  };

  const propriedadesOrdenadas = useMemo(
    () =>
      [...propriedades].sort((a, b) =>
        getFazendaOptionLabel(a).title.localeCompare(getFazendaOptionLabel(b).title)
      ),
    [propriedades]
  );

  const vinculosPropriedades = useMemo(
    () => normalizeFormVinculosPropriedade(form.vinculosPropriedades),
    [form.vinculosPropriedades]
  );

  const getVinculoPropriedade = (id: string) =>
    vinculosPropriedades.find((vinculo) => vinculo.propriedade_id === id);

  const updateVinculosPropriedades = (vinculos: any[]) => {
    updateField('vinculosPropriedades', normalizeFormVinculosPropriedade(vinculos));
  };

  const toggleVinculoPropriedade = (id: string, tipoPadrao = 'titular') => {
    setForm((prev) => {
      const current = normalizeFormVinculosPropriedade(prev.vinculosPropriedades);
      const exists = current.some((vinculo) => vinculo.propriedade_id === id);
      const next = exists
        ? current.filter((vinculo) => vinculo.propriedade_id !== id)
        : [
            ...current,
            {
              propriedade_id: id,
              tipo_vinculo: tipoPadrao,
              principal: current.length === 0,
            },
          ];

      return {
        ...prev,
        vinculosPropriedades: normalizeFormVinculosPropriedade(next),
      };
    });

    if (errors.vinculosPropriedades || errors.escopoColaborador) {
      setErrors((prev) => ({ ...prev, vinculosPropriedades: null, escopoColaborador: null }));
    }
  };

  const updateTipoVinculoPropriedade = (id: string, tipo: string) => {
    updateVinculosPropriedades(
      vinculosPropriedades.map((vinculo) =>
        vinculo.propriedade_id === id ? { ...vinculo, tipo_vinculo: tipo } : vinculo
      )
    );
  };

  const setVinculoPrincipal = (id: string) => {
    updateVinculosPropriedades(
      vinculosPropriedades.map((vinculo) => ({
        ...vinculo,
        principal: vinculo.propriedade_id === id,
      }))
    );
  };

  const propriedadesSelecionadas = useMemo(() => {
    const ids = new Set(vinculosPropriedades.map((vinculo) => vinculo.propriedade_id));
    return propriedadesOrdenadas.filter((propriedade) => ids.has(getFazendaId(propriedade)));
  }, [propriedadesOrdenadas, vinculosPropriedades]);

  const microRegioesInformadas = useMemo(
    () => parseListaTexto(form.subRegioesText),
    [form.subRegioesText]
  );

  const regioesTerritorio = useMemo(() => listarRegioes(propriedades), [propriedades]);

  const microregioesTerritorio = useMemo(
    () => listarMicroregioesPorRegiao(propriedades, form.regiao),
    [propriedades, form.regiao]
  );

  const propriedadesAbrangidasMicroregioes = useMemo(
    () => listarPropriedadesPorMicroregioes(propriedadesOrdenadas, microRegioesInformadas, form.regiao),
    [propriedadesOrdenadas, microRegioesInformadas, form.regiao]
  );

  const microregioesPropriedadeRapida = useMemo(
    () => listarMicroregioesPorRegiao(propriedades, propriedadeRapida.regiao),
    [propriedades, propriedadeRapida.regiao]
  );

  const colaboradoresSugeridosPropriedadeRapida = useMemo(
    () =>
      propriedadeRapida.microregiao
        ? sugerirColaboradoresParaMicroregiao(
            usuarios,
            propriedadeRapida.microregiao,
            propriedadeRapida.regiao,
            propriedades
          )
        : [],
    [propriedadeRapida.microregiao, propriedadeRapida.regiao, propriedades, usuarios]
  );

  const areaPropriedadeRapida = useMemo(
    () => Number.parseFloat(String(propriedadeRapida.area_total || '').replace(',', '.')),
    [propriedadeRapida.area_total]
  );

  const selecionarRegiaoColaborador = (regiao: string) => {
    setForm((prev) => ({
      ...prev,
      regiao,
      subRegioesText: prev.regiao === regiao ? prev.subRegioesText : '',
    }));
    setErrors((prev) => ({ ...prev, regiao: null, escopoColaborador: null }));
  };

  const selecionarRegiaoPropriedadeRapida = (regiao: string) => {
    setPropriedadeRapida((prev) => ({
      ...prev,
      regiao,
      microregiao: prev.regiao === regiao ? prev.microregiao : '',
    }));
    setErrors((prev) => ({
      ...prev,
      propriedadeRapida_regiao: null,
      propriedadeRapida_microregiao: null,
    }));
  };

  const selecionarMicroregiaoPropriedadeRapida = (microregiao: string, regiao?: string) => {
    setPropriedadeRapida((prev) => ({
      ...prev,
      regiao: prev.regiao || regiao || '',
      microregiao,
    }));
    setErrors((prev) => ({
      ...prev,
      propriedadeRapida_regiao: null,
      propriedadeRapida_microregiao: null,
    }));
  };

  const toggleMicroRegiaoColaborador = (microregiao: string, regiao?: string) => {
    setForm((prev) => {
      const atuais = parseListaTexto(prev.subRegioesText);
      const selected = atuais.includes(microregiao);
      const next = selected
        ? atuais.filter((item) => item !== microregiao)
        : [...atuais, microregiao];

      return {
        ...prev,
        regiao: prev.regiao || regiao || '',
        subRegioesText: next.join(', '),
      };
    });
    setErrors((prev) => ({ ...prev, regiao: null, escopoColaborador: null }));
  };

  const emailEmUso = (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    return usuarios.some((usuario) =>
      usuario.id !== userId && String(usuario.email || '').trim().toLowerCase() === normalizedEmail
    );
  };

  const getApiErrorMessage = (error: any) => {
    const message = String(error?.message || '');
    if (message.includes('E-mail já cadastrado')) {
      return 'Este e-mail já está cadastrado no mock.';
    }
    if (message.includes('Produtor ativo')) {
      return 'Produtor ativo precisa ter ao menos uma propriedade vinculada.';
    }
    if (message.includes('Colaborador ativo')) {
      return 'Colaborador ativo precisa ter microregião ou propriedade atribuída.';
    }
    if (message.includes('Status obrigatório')) {
      return 'Selecione um status para o usuário.';
    }

    return 'Não foi possível salvar o usuário no mock.';
  };

  const renderPropriedadeOption = ({
    propriedade,
    tipoPadrao,
    showTipo = false,
    showPrincipal = false,
  }: {
    propriedade: any;
    tipoPadrao: string;
    showTipo?: boolean;
    showPrincipal?: boolean;
  }) => {
    const option = getFazendaOptionLabel(propriedade);
    const vinculo = getVinculoPropriedade(option.id);
    const active = Boolean(vinculo);
    const outroProdutorPrincipal = showPrincipal
      ? usuarios.find((usuario) => {
          if (usuario?.id === usuarioAtual?.id || usuario?.perfil !== 'produtor') return false;
          return getVinculosPropriedadeUsuario(usuario, propriedades).some(
            (item) => item.propriedade_id === option.id && item.principal
          );
        })
      : null;

    return (
      <View key={option.id} style={[styles.optionGroup, active && styles.optionRowActive]}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => toggleVinculoPropriedade(option.id, tipoPadrao)}
          activeOpacity={0.78}
        >
          <Ionicons
            name={active ? 'checkbox-outline' : 'square-outline'}
            size={20}
            color={active ? colors.primary : colors.muted}
          />
          <View style={styles.optionTextWrap}>
            <Text style={styles.optionTitle} numberOfLines={1}>{option.title}</Text>
            <Text style={styles.optionSubtitle} numberOfLines={1}>{option.subtitle}</Text>
          </View>
        </TouchableOpacity>

        {active && (showTipo || showPrincipal) && (
          <View style={styles.linkControls}>
            {showTipo && (
              <SegmentedChips
                options={TIPOS_VINCULO_PRODUTOR.map((tipo) => ({
                  value: tipo.key,
                  label: tipo.label,
                }))}
                value={vinculo.tipo_vinculo}
                onChange={(value) => updateTipoVinculoPropriedade(option.id, value)}
              />
            )}

            {showPrincipal && (
              <TouchableOpacity
                style={[styles.miniChip, vinculo.principal && styles.miniChipActive]}
                onPress={() => setVinculoPrincipal(option.id)}
                activeOpacity={0.78}
              >
                <Ionicons
                  name={vinculo.principal ? 'star' : 'star-outline'}
                  size={14}
                  color={vinculo.principal ? colors.white : colors.primary}
                />
                <Text style={[styles.miniChipText, vinculo.principal && styles.miniChipTextActive]}>
                  Principal
                </Text>
              </TouchableOpacity>
            )}

            {showPrincipal && outroProdutorPrincipal && (
              <View style={styles.inlineWarning}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
                <Text style={styles.inlineWarningText}>
                  Já existe produtor principal vinculado no mock: {getUsuarioNome(outroProdutorPrincipal)}. Este vínculo visual não altera automaticamente o titular cadastral.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const getProdutorIdCompatParaPropriedadeRapida = () => {
    if (form.produtor_id?.trim()) return form.produtor_id.trim();
    if (usuarioAtual?.produtor_id) return usuarioAtual.produtor_id;

    if (!propriedadeRapida.principal) {
      const vinculoPrincipal = vinculosPropriedades.find((vinculo) => vinculo.principal) || vinculosPropriedades[0];
      const propriedadePrincipal = propriedades.find(
        (propriedade) => getFazendaId(propriedade) === vinculoPrincipal?.propriedade_id
      );
      const titularId = getTitularIdFazenda(propriedadePrincipal);
      if (titularId) return titularId;
    }

    return '';
  };

  const buildPropriedadeRapidaPayload = () => {
    const titulares = buildCadastroTitularOptions(propriedades);
    const payload = buildCadastroFazendaPayload({
      mode: 'novo',
      produtorNome: form.nome,
      fazendaNome: propriedadeRapida.nome,
      areaTotal: propriedadeRapida.area_total,
      cidade: propriedadeRapida.municipio,
      estado: propriedadeRapida.estado,
      regiao: propriedadeRapida.regiao,
      microregiao: propriedadeRapida.microregiao,
      status: propriedadeRapida.status,
      titulares,
    });
    const produtorIdCompat = getProdutorIdCompatParaPropriedadeRapida();

    return {
      ...payload,
      produtor_id: produtorIdCompat || payload.produtor_id,
      proprietario_id: produtorIdCompat || payload.proprietario_id,
      observacoes: propriedadeRapida.observacoes?.trim() || '',
    };
  };

  const buildFormComPropriedadeCriada = (propriedadeCriada: any) => {
    const propriedadeId = getFazendaId(propriedadeCriada);
    const quickPrincipal = propriedadeRapida.principal || vinculosPropriedades.length === 0;
    const vinculosExistentes = quickPrincipal
      ? vinculosPropriedades.map((vinculo) => ({ ...vinculo, principal: false }))
      : vinculosPropriedades;
    const vinculoRapido = {
      propriedade_id: propriedadeId,
      tipo_vinculo: propriedadeRapida.tipo_vinculo || 'titular',
      principal: quickPrincipal,
    };

    return {
      ...form,
      produtor_id: getTitularIdFazenda(propriedadeCriada) || form.produtor_id,
      vinculosPropriedades: normalizeFormVinculosPropriedade([
        ...vinculosExistentes,
        vinculoRapido,
      ]),
    };
  };

  const validateForm = () => {
    const nextErrors: any = {};

    if (!form.nome.trim()) {
      nextErrors.nome = 'Informe o nome do usuário.';
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Informe o e-mail.';
    } else if (!isValidEmail(form.email.trim())) {
      nextErrors.email = 'Informe um e-mail válido.';
    } else if (emailEmUso(form.email)) {
      nextErrors.email = 'Este e-mail já está cadastrado no mock.';
    }

    if (!form.perfil) {
      nextErrors.perfil = 'Selecione o perfil.';
    }

    if (!form.status) {
      nextErrors.status = 'Selecione o status.';
    }

    const propriedadeRapidaAtiva = form.perfil === 'produtor' && propriedadeRapida.ativa;

    if (propriedadeRapidaAtiva) {
      if (!propriedadeRapida.nome.trim()) {
        nextErrors.propriedadeRapida_nome = 'Informe o nome da propriedade.';
      }

      if (!propriedadeRapida.regiao.trim()) {
        nextErrors.propriedadeRapida_regiao = 'Informe a região da propriedade.';
      }

      if (!propriedadeRapida.microregiao.trim()) {
        nextErrors.propriedadeRapida_microregiao = 'Informe a microregião da propriedade.';
      }

      if (!propriedadeRapida.status) {
        nextErrors.propriedadeRapida_status = 'Selecione o status da propriedade.';
      }

      if (!Number.isFinite(areaPropriedadeRapida) || areaPropriedadeRapida <= 0) {
        nextErrors.propriedadeRapida_area_total = 'Informe uma área total válida.';
      }

      const estado = propriedadeRapida.estado.trim();
      if (estado && !/^[A-Za-z]{2}$/.test(estado)) {
        nextErrors.propriedadeRapida_estado = 'Informe a UF com duas letras.';
      }
    }

    if (
      form.perfil === 'produtor'
      && form.status === 'ativo'
      && vinculosPropriedades.length === 0
      && !propriedadeRapidaAtiva
    ) {
      nextErrors.vinculosPropriedades = 'Produtor ativo precisa ter ao menos uma propriedade vinculada.';
    }

    if (form.perfil === 'colaborador') {
      const temMicroRegiao = microRegioesInformadas.length > 0;
      const temPropriedade = vinculosPropriedades.length > 0;

      if (temMicroRegiao && !form.regiao.trim()) {
        nextErrors.regiao = 'Informe a região para organizar as microregiões.';
      }

      if (form.status === 'ativo' && !temMicroRegiao && !temPropriedade) {
        nextErrors.escopoColaborador = 'Colaborador ativo precisa ter microregião ou propriedade atribuída.';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast.showWarning('Revise os campos obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      let propriedadesParaPayload = propriedades;
      let formParaPayload = form;

      if (form.perfil === 'produtor' && propriedadeRapida.ativa) {
        const propriedadeCriada = await Produtor.create(buildPropriedadeRapidaPayload());
        propriedadesParaPayload = [propriedadeCriada, ...propriedades];
        formParaPayload = buildFormComPropriedadeCriada(propriedadeCriada);
      }

      const payload = buildUsuarioAdminPayload({
        form: formParaPayload,
        propriedades: propriedadesParaPayload,
        existing: usuarioAtual,
      });

      const saved = isEdit
        ? await User.update(userId, payload)
        : await User.create(payload);

      toast.showSuccess(
        propriedadeRapida.ativa
          ? isEdit ? 'Usuário atualizado e propriedade criada no mock.' : 'Usuário e propriedade criados no mock.'
          : isEdit ? 'Usuário atualizado no mock.' : 'Usuário criado no mock.'
      );
      navigation.replace('UsuarioDetail', { userId: saved.id });
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      toast.showError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (user?.perfil !== 'admin') {
    return (
      <View style={styles.container}>
        <Header title={isEdit ? 'Editar Usuário' : 'Novo Usuário'} showBack />
        <View style={styles.blockedContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.muted} />
          <Text style={styles.blockedTitle}>Acesso restrito</Text>
          <Text style={styles.blockedText}>Somente administradores podem gerenciar usuários no mock.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title={isEdit ? 'Editar Usuário' : 'Novo Usuário'} showBack />
        <View style={styles.blockedContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.blockedText}>Carregando dados do usuário...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title={isEdit ? 'Editar Usuário' : 'Novo Usuário'} showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <InfoBox message="Este cadastro é visual/mockado. Não cria senha real, convite, reset de acesso ou autenticação em backend." />

        <SectionCard title="Dados do usuário">
          <FormField
            label="Nome"
            value={form.nome}
            onChangeText={(value) => updateField('nome', value)}
            placeholder="Nome completo"
            error={errors.nome}
          />

          <FormField
            label="E-mail"
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="usuario@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
          />

          <FormField
            label="Telefone"
            value={form.telefone}
            onChangeText={(value) => updateField('telefone', value)}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
          />

          <FormField
            label="Documento"
            value={form.documento}
            onChangeText={(value) => updateField('documento', value)}
            placeholder="CPF ou CNPJ"
          />
        </SectionCard>

        <SectionCard
          title="Perfil de acesso"
          subtitle="Defina se este usuário acessa como Produtor, Colaborador ou Administrador."
        >
          <Text style={styles.label}>Perfil de acesso</Text>
          <SegmentedChips
            options={PERFIS_FORM.map((perfil) => ({
              value: perfil.key,
              label: perfil.label,
              icon: perfil.icon as any,
            }))}
            value={form.perfil}
            onChange={(value) => updateField('perfil', value)}
            style={styles.segmentedField}
          />
          {errors.perfil && <Text style={styles.errorText}>{errors.perfil}</Text>}

          <Text style={[styles.label, styles.labelSpacing]}>Status</Text>
          <SegmentedChips
            options={STATUS_USUARIO_ADMIN.map((status) => ({
              value: status.key,
              label: status.label,
            }))}
            value={form.status}
            onChange={(value) => updateField('status', value)}
            style={styles.segmentedField}
          />
          {errors.status && <Text style={styles.errorText}>{errors.status}</Text>}
        </SectionCard>

        <SectionCard title="Observações">
          <FormField
            label="Observações"
            value={form.observacoes}
            onChangeText={(value) => updateField('observacoes', value)}
            placeholder="Observações internas do mock"
            multiline
            numberOfLines={3}
            textarea
          />
        </SectionCard>

        {form.perfil === 'produtor' && (
          <SectionCard
            title="Vínculos do Produtor"
            subtitle="Produtor é o perfil de usuário. Selecione aqui as Propriedades vinculadas a este usuário produtor."
          >
            <Text style={styles.label}>Propriedades vinculadas</Text>
            {errors.vinculosPropriedades && <Text style={styles.errorText}>{errors.vinculosPropriedades}</Text>}
            <View style={styles.optionList}>
              {propriedadesOrdenadas.map((propriedade) =>
                renderPropriedadeOption({
                  propriedade,
                  tipoPadrao: 'titular',
                  showTipo: true,
                  showPrincipal: true,
                })
              )}
            </View>

            {propriedadesSelecionadas.length > 0 && (
              <View style={styles.linkedBox}>
                <Text style={styles.linkedTitle}>Resumo dos vínculos</Text>
                <Text style={styles.linkedText}>
                  {propriedadesSelecionadas.length} propriedade{propriedadesSelecionadas.length === 1 ? '' : 's'} selecionada{propriedadesSelecionadas.length === 1 ? '' : 's'} para este usuário produtor.
                </Text>
                {vinculosPropriedades.map((vinculo) => (
                  <Text key={vinculo.propriedade_id} style={styles.linkedItemText}>
                    {vinculo.principal ? 'Principal' : 'Vínculo'} • {getVinculoPropriedadeLabel(vinculo.tipo_vinculo)}
                  </Text>
                ))}
              </View>
            )}

            <View style={styles.quickPropertyHeader}>
              <View style={styles.quickPropertyHeaderText}>
                <Text style={styles.linkedTitle}>Propriedade ainda não cadastrada?</Text>
                <Text style={styles.linkedText}>
                  Crie uma Propriedade mínima no mock e vincule automaticamente a este usuário produtor.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.quickPropertyButton, propriedadeRapida.ativa && styles.quickPropertyButtonActive]}
                onPress={togglePropriedadeRapida}
                activeOpacity={0.78}
              >
                <Ionicons
                  name={propriedadeRapida.ativa ? 'close-outline' : 'add-outline'}
                  size={18}
                  color={propriedadeRapida.ativa ? colors.primary : colors.white}
                />
                <Text style={[styles.quickPropertyButtonText, propriedadeRapida.ativa && styles.quickPropertyButtonTextActive]}>
                  {propriedadeRapida.ativa ? 'Cancelar' : 'Adicionar'}
                </Text>
              </TouchableOpacity>
            </View>

            {propriedadeRapida.ativa && (
              <View style={styles.quickPropertyBox}>
                <InfoBox
                  message="Cadastro rápido visual/mockado de Propriedade. O titular será inferido pelo usuário produtor deste cadastro."
                  style={styles.infoBoxInline}
                />

                <FormField
                  label="Nome da propriedade"
                  value={propriedadeRapida.nome}
                  onChangeText={(value) => updatePropriedadeRapida('nome', value)}
                  placeholder="Ex: Sítio Boa Vista"
                  error={errors.propriedadeRapida_nome}
                />

                <FormField
                  label="Município"
                  value={propriedadeRapida.municipio}
                  onChangeText={(value) => updatePropriedadeRapida('municipio', value)}
                  placeholder="Ex: Rio Verde"
                />

                <FormField
                  label="UF/Estado"
                  value={propriedadeRapida.estado}
                  onChangeText={(value) => updatePropriedadeRapida('estado', String(value).toUpperCase())}
                  placeholder="Ex: GO"
                  maxLength={2}
                  autoCapitalize="characters"
                  error={errors.propriedadeRapida_estado}
                />

                {regioesTerritorio.length > 0 ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Região</Text>
                    <View style={styles.miniChipWrap}>
                      {regioesTerritorio.map((regiao) => {
                        const selected = propriedadeRapida.regiao === regiao.nome;
                        return (
                          <TouchableOpacity
                            key={regiao.id}
                            style={[styles.miniChip, selected && styles.miniChipActive]}
                            onPress={() => selecionarRegiaoPropriedadeRapida(regiao.nome)}
                            activeOpacity={0.78}
                          >
                            <Text style={[styles.miniChipText, selected && styles.miniChipTextActive]}>
                              {regiao.nome}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {errors.propriedadeRapida_regiao && <Text style={styles.errorText}>{errors.propriedadeRapida_regiao}</Text>}
                  </View>
                ) : (
                  <FormField
                    label="Região"
                    value={propriedadeRapida.regiao}
                    onChangeText={(value) => updatePropriedadeRapida('regiao', value)}
                    placeholder="Ex: Goiás"
                    error={errors.propriedadeRapida_regiao}
                  />
                )}

                {microregioesPropriedadeRapida.length > 0 ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>Microregião</Text>
                    <View style={styles.miniChipWrap}>
                      {microregioesPropriedadeRapida.map((microregiao) => {
                        const selected = propriedadeRapida.microregiao === microregiao.nome;
                        return (
                          <TouchableOpacity
                            key={microregiao.id}
                            style={[styles.miniChip, selected && styles.miniChipActive]}
                            onPress={() => selecionarMicroregiaoPropriedadeRapida(microregiao.nome, microregiao.regiao)}
                            activeOpacity={0.78}
                          >
                            <Text style={[styles.miniChipText, selected && styles.miniChipTextActive]}>
                              {microregiao.nome}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {errors.propriedadeRapida_microregiao && <Text style={styles.errorText}>{errors.propriedadeRapida_microregiao}</Text>}
                  </View>
                ) : (
                  <FormField
                    label="Microregião"
                    value={propriedadeRapida.microregiao}
                    onChangeText={(value) => updatePropriedadeRapida('microregiao', value)}
                    placeholder="Ex: Rio Verde"
                    error={errors.propriedadeRapida_microregiao}
                  />
                )}

                {propriedadeRapida.microregiao && (
                  <View style={styles.linkedBox}>
                    <Text style={styles.linkedTitle}>Colaboradores sugeridos</Text>
                    {colaboradoresSugeridosPropriedadeRapida.length === 0 ? (
                      <Text style={styles.linkedText}>Nenhum colaborador sugerido para essa microregião no mock.</Text>
                    ) : (
                      colaboradoresSugeridosPropriedadeRapida.slice(0, 5).map((colaborador) => (
                        <Text key={colaborador.id} style={styles.linkedItemText}>
                          {getUsuarioNome(colaborador)}
                        </Text>
                      ))
                    )}
                  </View>
                )}

                <FormField
                  label="Área total"
                  value={propriedadeRapida.area_total}
                  onChangeText={(value) => updatePropriedadeRapida('area_total', value)}
                  placeholder="Ex: 500"
                  keyboardType="numeric"
                  error={errors.propriedadeRapida_area_total}
                />

                <Text style={styles.label}>Status da propriedade</Text>
                <SegmentedChips
                  options={STATUS_USUARIO_ADMIN.map((status) => ({
                    value: status.key,
                    label: status.label,
                  }))}
                  value={propriedadeRapida.status}
                  onChange={(value) => updatePropriedadeRapida('status', value)}
                  style={styles.segmentedField}
                />
                {errors.propriedadeRapida_status && <Text style={styles.errorText}>{errors.propriedadeRapida_status}</Text>}

                <Text style={[styles.label, styles.labelSpacing]}>Tipo de vínculo</Text>
                <SegmentedChips
                  options={TIPOS_VINCULO_PRODUTOR.map((tipo) => ({
                    value: tipo.key,
                    label: tipo.label,
                  }))}
                  value={propriedadeRapida.tipo_vinculo}
                  onChange={(value) => updatePropriedadeRapida('tipo_vinculo', value)}
                  style={styles.segmentedField}
                />

                <TouchableOpacity
                  style={[styles.miniChip, styles.quickPrincipalChip, propriedadeRapida.principal && styles.miniChipActive]}
                  onPress={() => updatePropriedadeRapida('principal', !propriedadeRapida.principal)}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name={propriedadeRapida.principal ? 'star' : 'star-outline'}
                    size={14}
                    color={propriedadeRapida.principal ? colors.white : colors.primary}
                  />
                  <Text style={[styles.miniChipText, propriedadeRapida.principal && styles.miniChipTextActive]}>
                    Marcar como principal
                  </Text>
                </TouchableOpacity>

                <FormField
                  label="Observações"
                  value={propriedadeRapida.observacoes}
                  onChangeText={(value) => updatePropriedadeRapida('observacoes', value)}
                  placeholder="Observações da propriedade no mock"
                  multiline
                  numberOfLines={3}
                  textarea
                />
              </View>
            )}
          </SectionCard>
        )}

        {form.perfil === 'colaborador' && (
          <SectionCard
            title="Escopo do Colaborador"
            subtitle="Defina o escopo visual por Região, Microregião ou Propriedades atribuídas. Esses vínculos ainda não alteram o motor efetivo de permissões."
          >
            <FormField
              label="Função/cargo"
              value={form.cargo}
              onChangeText={(value) => updateField('cargo', value)}
              placeholder="Ex: Consultor regional"
            />

            {regioesTerritorio.length > 0 ? (
              <>
                <Text style={styles.label}>Região</Text>
                <View style={styles.miniChipWrap}>
                  {regioesTerritorio.map((regiao) => {
                    const selected = form.regiao === regiao.nome;
                    return (
                      <TouchableOpacity
                        key={regiao.id}
                        style={[styles.miniChip, selected && styles.miniChipActive]}
                        onPress={() => selecionarRegiaoColaborador(regiao.nome)}
                        activeOpacity={0.78}
                      >
                        <Text style={[styles.miniChipText, selected && styles.miniChipTextActive]}>
                          {regiao.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.regiao && <Text style={styles.errorText}>{errors.regiao}</Text>}
              </>
            ) : (
              <FormField
                label="Região"
                value={form.regiao}
                onChangeText={(value) => updateField('regiao', value)}
                placeholder="Ex: Goiás"
                error={errors.regiao}
              />
            )}

            {microregioesTerritorio.length > 0 ? (
              <View style={styles.territoryBlock}>
                <Text style={styles.label}>Microregiões</Text>
                <View style={styles.miniChipWrap}>
                  {microregioesTerritorio.map((microregiao) => {
                    const selected = microRegioesInformadas.includes(microregiao.nome);
                    return (
                      <TouchableOpacity
                        key={microregiao.id}
                        style={[styles.miniChip, selected && styles.miniChipActive]}
                        onPress={() => toggleMicroRegiaoColaborador(microregiao.nome, microregiao.regiao)}
                        activeOpacity={0.78}
                      >
                        <Text style={[styles.miniChipText, selected && styles.miniChipTextActive]}>
                          {microregiao.nome}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              <FormField
                label="Microregiões"
                value={form.subRegioesText}
                onChangeText={(value) => updateField('subRegioesText', value)}
                placeholder="Ex: Rio Verde, Jataí"
              />
            )}

            {microRegioesInformadas.length > 0 && (
              <View style={styles.linkedBox}>
                <Text style={styles.linkedTitle}>Prévia por microregião</Text>
                <Text style={styles.linkedText}>
                  {propriedadesAbrangidasMicroregioes.length} propriedade{propriedadesAbrangidasMicroregioes.length === 1 ? '' : 's'} abrangida{propriedadesAbrangidasMicroregioes.length === 1 ? '' : 's'} visualmente por essas microregiões.
                </Text>
                {propriedadesAbrangidasMicroregioes.slice(0, 5).map((propriedade) => {
                  const option = getFazendaOptionLabel(propriedade);
                  return (
                    <Text key={option.id} style={styles.linkedItemText}>
                      {option.title}
                    </Text>
                  );
                })}
              </View>
            )}

            <Text style={styles.label}>Propriedades atribuídas no mock</Text>
            <Text style={styles.sectionHint}>
              Opcional. Use quando o colaborador atuar em Propriedades específicas; as permissões atuais continuam baseadas no escopo regional existente.
            </Text>
            {errors.escopoColaborador && <Text style={styles.errorText}>{errors.escopoColaborador}</Text>}
            <View style={styles.optionList}>
              {propriedadesOrdenadas.map((propriedade) =>
                renderPropriedadeOption({
                  propriedade,
                  tipoPadrao: 'colaborador_atribuido',
                })
              )}
            </View>
          </SectionCard>
        )}

        {form.perfil === 'admin' && (
          <SectionCard
            title="Dados administrativos"
            subtitle="O perfil Administrador mantém visão ampla da operação no MVP mockado."
          >
            <Text style={styles.label}>Nível administrativo</Text>
            <SegmentedChips
              options={NIVEIS_ADMIN_USUARIO.map((nivel) => ({
                value: nivel.key,
                label: nivel.label,
              }))}
              value={form.nivelAdministrativo}
              onChange={(value) => updateField('nivelAdministrativo', value)}
              style={styles.segmentedField}
            />
            <View style={styles.adminBox}>
              <Ionicons name="earth-outline" size={22} color={colors.primary} />
              <View style={styles.adminBoxText}>
                <Text style={styles.adminBoxTitle}>Administrador</Text>
                <Text style={styles.adminBoxSubtitle}>Visão ampla das regiões, usuários e propriedades no MVP mockado.</Text>
              </View>
            </View>
          </SectionCard>
        )}

        <View style={{ height: spacing.xl * 4 }} />
      </ScrollView>

      <FormFooter
        onCancel={() => navigation.goBack()}
        onSubmit={handleSave}
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
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl * 2,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    marginBottom: spacing.sm,
  },
  labelSpacing: {
    marginTop: spacing.md,
  },
  sectionHint: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    lineHeight: 19,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontCaption + 1,
    marginTop: spacing.xs,
  },
  segmentedField: {
    marginBottom: spacing.md,
  },
  optionList: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: spacing.radiusSm,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  optionGroup: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  optionRowActive: {
    backgroundColor: colors.accent,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
  },
  optionSubtitle: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    marginTop: 2,
  },
  territoryBlock: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  linkedBox: {
    marginTop: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  linkedTitle: {
    color: colors.text,
    fontSize: typography.fontBody - 1,
    fontWeight: typography.weightBold,
    marginBottom: 4,
  },
  linkedText: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
  },
  linkedItemText: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
    marginTop: 4,
  },
  linkControls: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  inlineWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.warningLight + '22',
    borderRadius: spacing.radiusSm,
    padding: spacing.sm,
  },
  inlineWarningText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
  },
  miniChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    backgroundColor: colors.background,
  },
  miniChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  miniChipText: {
    color: colors.primary,
    fontSize: typography.fontCaption,
    fontWeight: typography.weightBold,
  },
  miniChipTextActive: {
    color: colors.white,
  },
  quickPropertyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  quickPropertyHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  quickPropertyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickPropertyButtonActive: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  quickPropertyButtonText: {
    color: colors.white,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  quickPropertyButtonTextActive: {
    color: colors.primary,
  },
  quickPropertyBox: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: spacing.radiusSm,
    backgroundColor: colors.background,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  infoBoxInline: {
    borderRadius: spacing.radiusSm,
    marginBottom: spacing.md,
  },
  quickPrincipalChip: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  adminBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  adminBoxText: {
    flex: 1,
  },
  adminBoxTitle: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  adminBoxSubtitle: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.screen,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelText: {
    color: colors.text,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    borderRadius: spacing.radius,
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightBold,
  },
  blockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  blockedTitle: {
    color: colors.text,
    fontSize: typography.fontSubtitle,
    fontWeight: typography.weightBold,
  },
  blockedText: {
    color: colors.muted,
    fontSize: typography.fontBody,
    textAlign: 'center',
    lineHeight: 22,
  },
});
