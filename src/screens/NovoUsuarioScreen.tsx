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
import { LocalCredentialService } from '../auth/localCredentials';
import { useToast } from '../components/Toast';
import { colors, spacing, typography } from '../theme';
import { getFazendaId } from '../utils/acessoControle';
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
  createUsuarioAdminWithLocalCredential,
  updateUsuarioAdminAndSyncLocalCredential,
  validateSenhaLocalAdmin,
} from '../utils/usuarioLocalAccessAdmin';
import {
  listarMicroregioesPorRegiao,
  listarPropriedadesPorMicroregioes,
  listarRegioes,
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

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const emptyPasswordForm = {
  senhaInicial: '',
  confirmarSenhaInicial: '',
  novaSenha: '',
  confirmarNovaSenha: '',
};

export default function NovoUsuarioScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const toast = useToast();
  const { user } = useAuthState();
  const userId = route.params?.userId || route.params?.id;
  const isEdit = Boolean(userId);

  const [form, setForm] = useState<any>(emptyForm);
  const [usuarioAtual, setUsuarioAtual] = useState<any>(null);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [propriedades, setPropriedades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [showPrimaryPassword, setShowPrimaryPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        setPasswordForm(emptyPasswordForm);
      } else {
        setUsuarioAtual(null);
        setForm(emptyForm);
        setPasswordForm(emptyPasswordForm);
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

  const updatePasswordField = (field: string, value: string) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
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

  const selecionarRegiaoColaborador = (regiao: string) => {
    setForm((prev) => ({
      ...prev,
      regiao,
      subRegioesText: prev.regiao === regiao ? prev.subRegioesText : '',
    }));
    setErrors((prev) => ({ ...prev, regiao: null, escopoColaborador: null }));
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
      return 'Produtor ativo é perfil de usuário e precisa ter ao menos uma Propriedade vinculada no mock.';
    }
    if (message.includes('Colaborador ativo')) {
      return 'Colaborador ativo precisa ter Região e Microrregião como escopo de trabalho no mock.';
    }
    if (message.includes('Status obrigatório')) {
      return 'Selecione um status para o usuário.';
    }
    if (message.includes('LocalCredential.email')) {
      return 'Este e-mail já possui uma credencial local neste aparelho.';
    }
    if (message.includes('LocalCredential')) {
      return isEdit
        ? 'Não foi possível atualizar a credencial local. Revise os dados e tente novamente.'
        : 'Não foi possível configurar a senha local. O cadastro foi desfeito; tente novamente.';
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

    if (
      form.perfil === 'produtor'
      && form.status === 'ativo'
      && vinculosPropriedades.length === 0
    ) {
      nextErrors.vinculosPropriedades = 'Produtor ativo é perfil de usuário e precisa ter ao menos uma Propriedade vinculada no mock.';
    }

    if (form.perfil === 'colaborador') {
      const temMicroRegiao = microRegioesInformadas.length > 0;

      if (temMicroRegiao && !form.regiao.trim()) {
        nextErrors.regiao = 'Informe a região para organizar as microregiões.';
      }

      if (form.status === 'ativo' && (!form.regiao.trim() || !temMicroRegiao)) {
        nextErrors.escopoColaborador = 'Colaborador ativo precisa ter Região e Microrregião como escopo de trabalho no mock.';
      }
    }

    const passwordValidation = validateSenhaLocalAdmin({
      senha: isEdit ? passwordForm.novaSenha : passwordForm.senhaInicial,
      confirmarSenha: isEdit ? passwordForm.confirmarNovaSenha : passwordForm.confirmarSenhaInicial,
      obrigatoria: !isEdit,
    });

    if (!passwordValidation.valid) {
      if (isEdit) {
        nextErrors.novaSenha = passwordValidation.errors.senha;
        nextErrors.confirmarNovaSenha = passwordValidation.errors.confirmarSenha;
      } else {
        nextErrors.senhaInicial = passwordValidation.errors.senha;
        nextErrors.confirmarSenhaInicial = passwordValidation.errors.confirmarSenha;
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
      const payload: any = buildUsuarioAdminPayload({
        form,
        propriedades,
        existing: usuarioAtual,
      });

      const shouldUpdatePassword =
        isEdit && (passwordForm.novaSenha.length > 0 || passwordForm.confirmarNovaSenha.length > 0);
      const saved = isEdit
        ? await updateUsuarioAdminAndSyncLocalCredential({
            userApi: User,
            credentialService: LocalCredentialService,
            usuarioId: userId,
            payload,
            email: payload.email,
            novaSenha: passwordForm.novaSenha,
            shouldUpdatePassword,
          })
        : await createUsuarioAdminWithLocalCredential({
            userApi: User,
            credentialService: LocalCredentialService,
            payload,
            email: payload.email,
            senha: passwordForm.senhaInicial,
          });

      toast.showSuccess(isEdit ? 'Usuário atualizado localmente.' : 'Usuário e acesso local salvos.');
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
        <InfoBox
          title="Cadastro administrativo demonstrativo"
          message="Este registro fica salvo somente neste aparelho. A senha local prepara acesso demonstrativo futuro, mas ainda não cria sessão, backend, convite ou sincronização."
        />

        <SectionCard
          title="Dados do usuário demonstrativo"
          subtitle="Nome e e-mail identificam o registro local. Use somente dados fictícios ou autorizados."
        >
          <FormField
            label="Nome"
            required
            value={form.nome}
            onChangeText={(value) => updateField('nome', value)}
            placeholder="Nome completo"
            error={errors.nome}
          />

          <FormField
            label="E-mail"
            required
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="nome.demonstracao@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
            helperText="Obrigatório para identificar o cadastro mockado; não funciona como credencial de login."
          />

          <FormField
            label="Telefone (opcional)"
            value={form.telefone}
            onChangeText={(value) => updateField('telefone', value)}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            helperText="Deixe em branco quando não for necessário para a demonstração."
          />

          <FormField
            label="Documento (opcional)"
            value={form.documento}
            onChangeText={(value) => updateField('documento', value)}
            placeholder="Não informar dado real sem autorização"
            helperText="Campo opcional e desaconselhado para o teste de campo."
          />
        </SectionCard>

        <SectionCard
          title={isEdit ? 'Redefinir senha local' : 'Acesso local'}
          subtitle={
            isEdit
              ? 'Deixe os campos vazios para manter a credencial local atual.'
              : 'Defina a senha inicial para o acesso local demonstrativo deste usuário.'
          }
        >
          <FormField
            label={isEdit ? 'Nova senha' : 'Senha inicial'}
            required={!isEdit}
            value={isEdit ? passwordForm.novaSenha : passwordForm.senhaInicial}
            onChangeText={(value) => updatePasswordField(isEdit ? 'novaSenha' : 'senhaInicial', value)}
            placeholder="Mínimo de 6 caracteres"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showPrimaryPassword}
            rightIcon={showPrimaryPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowPrimaryPassword((prev) => !prev)}
            error={isEdit ? errors.novaSenha : errors.senhaInicial}
            helperText="Esta senha será usada para acesso local neste aparelho. O usuário poderá alterá-la futuramente quando houver backend."
          />

          <FormField
            label={isEdit ? 'Confirmar nova senha' : 'Confirmar senha inicial'}
            required={!isEdit}
            value={isEdit ? passwordForm.confirmarNovaSenha : passwordForm.confirmarSenhaInicial}
            onChangeText={(value) =>
              updatePasswordField(isEdit ? 'confirmarNovaSenha' : 'confirmarSenhaInicial', value)
            }
            placeholder="Repita a senha"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showConfirmPassword}
            rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
            onRightIconPress={() => setShowConfirmPassword((prev) => !prev)}
            error={isEdit ? errors.confirmarNovaSenha : errors.confirmarSenhaInicial}
            helperText={isEdit ? 'Status ativo, pendente ou inativo não bloqueia a configuração nesta etapa.' : undefined}
          />
        </SectionCard>

        <SectionCard
          title="Perfil demonstrativo"
          subtitle="Produtor, Colaborador e Administrador organizam a demonstração local. Este cadastro não concede acesso ou RBAC real."
        >
          <Text style={styles.label}>
            Perfil <Text style={styles.required}>*</Text>
          </Text>
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

          <Text style={[styles.label, styles.labelSpacing]}>
            Status <Text style={styles.required}>*</Text>
          </Text>
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

        <SectionCard title="Observações opcionais" subtitle="Evite registrar dados pessoais ou sensíveis.">
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
            subtitle="Vínculos demonstrativos organizam o registro local. Produtor ativo deve ter ao menos uma Propriedade vinculada no mock."
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
          </SectionCard>
        )}

        {form.perfil === 'colaborador' && (
          <SectionCard
            title="Escopo do Colaborador"
            subtitle="Região e Microrregião atribuem automaticamente Propriedades locais para demonstração. Esses vínculos não implementam RBAC real."
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
                <Text style={styles.label}>Microrregião</Text>
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
                label="Microrregião"
                value={form.subRegioesText}
                onChangeText={(value) => updateField('subRegioesText', value)}
                placeholder="Ex: Rio Verde, Jataí"
              />
            )}

            {microRegioesInformadas.length > 0 && (
              <View style={styles.linkedBox}>
                <Text style={styles.linkedTitle}>Propriedades atribuídas por microrregião</Text>
                <Text style={styles.linkedText}>
                  {propriedadesAbrangidasMicroregioes.length} propriedade{propriedadesAbrangidasMicroregioes.length === 1 ? '' : 's'} será{propriedadesAbrangidasMicroregioes.length === 1 ? '' : 'o'} vinculada{propriedadesAbrangidasMicroregioes.length === 1 ? '' : 's'} automaticamente neste cadastro local.
                </Text>
                {propriedadesAbrangidasMicroregioes.map((propriedade) => {
                  const option = getFazendaOptionLabel(propriedade);
                  return (
                    <Text key={option.id} style={styles.linkedItemText}>
                      {option.title}
                    </Text>
                  );
                })}
              </View>
            )}

            {errors.escopoColaborador && <Text style={styles.errorText}>{errors.escopoColaborador}</Text>}
          </SectionCard>
        )}

        {form.perfil === 'admin' && (
          <SectionCard
            title="Dados administrativos"
            subtitle="Administrador é um perfil demonstrativo do MVP local; não concede acesso administrativo real."
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
                <Text style={styles.adminBoxSubtitle}>Perfil demonstrativo com visão ampla no MVP local, sem RBAC ou autenticação real.</Text>
              </View>
            </View>
          </SectionCard>
        )}

        <View style={{ height: spacing.xl * 4 }} />
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
  required: {
    color: colors.error,
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
