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
import { useFormValidationFocus } from '../hooks/useFormValidationFocus';
import { LocalCredentialService } from '../auth/localCredentials';
import { useToast } from '../components/Toast';
import { colors, spacing, typography } from '../theme';
import { getFazendaId } from '../utils/acessoControle';
import {
  STATUS_USUARIO_ADMIN,
  buildUsuarioAdminPayload,
  buildUsuarioFormFromMock,
  getFazendaOptionLabel,
  getUsuarioPerfilLabel,
  normalizeFormVinculosPropriedade,
} from '../utils/usuarioAdminCompat';
import {
  createUsuarioAdminWithLocalCredential,
  updateUsuarioAdminAndSyncLocalCredential,
  validateSenhaLocalAdmin,
} from '../utils/usuarioLocalAccessAdmin';

const USUARIO_FORM_ERROR_ORDER = [
  'nome',
  'email',
  'senhaInicial',
  'novaSenha',
  'confirmarSenhaInicial',
  'confirmarNovaSenha',
  'perfil',
  'status',
  'vinculosPropriedades',
  'escopoColaborador',
] as const;

const PERFIS_FORM = [
  { key: 'produtor', label: getUsuarioPerfilLabel('produtor'), icon: 'leaf-outline' },
  { key: 'colaborador', label: getUsuarioPerfilLabel('colaborador'), icon: 'briefcase-outline' },
  { key: 'admin', label: getUsuarioPerfilLabel('admin'), icon: 'shield-checkmark-outline' },
];

const emptyForm = {
  nome: '',
  email: '',
  telefone: '',
  documento: '',
  perfil: 'produtor',
  status: 'pendente',
  observacoes: '',
  vinculosPropriedades: [] as any[],
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
  const formValidation = useFormValidationFocus(USUARIO_FORM_ERROR_ORDER);
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

  const toggleVinculoPropriedade = (id: string) => {
    setForm((prev) => {
      const current = normalizeFormVinculosPropriedade(prev.vinculosPropriedades);
      const existente = current.find((vinculo) => vinculo.propriedade_id === id);
      const next = existente
        ? current.map((vinculo) => (
            vinculo.propriedade_id === id
              ? { ...vinculo, status: vinculo.status === 'inativo' ? 'ativo' : 'inativo' }
              : vinculo
          ))
        : [
            ...current,
            {
              propriedade_id: id,
              tipo_vinculo: 'colaborador',
              status: 'ativo',
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

  const propriedadesSelecionadas = useMemo(() => {
    const ids = new Set(
      vinculosPropriedades
        .filter((vinculo) => vinculo.status !== 'inativo')
        .map((vinculo) => vinculo.propriedade_id)
    );
    return propriedadesOrdenadas.filter((propriedade) => ids.has(getFazendaId(propriedade)));
  }, [propriedadesOrdenadas, vinculosPropriedades]);

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
      return 'Colaborador ativo precisa ter ao menos uma Propriedade vinculada diretamente.';
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

  const renderPropriedadeOption = (propriedade: any) => {
    const option = getFazendaOptionLabel(propriedade);
    const vinculo = getVinculoPropriedade(option.id);
    const active = Boolean(vinculo && vinculo.status !== 'inativo');

    return (
      <View key={option.id} style={[styles.optionGroup, active && styles.optionRowActive]}>
        <TouchableOpacity
          style={styles.optionRow}
          onPress={() => toggleVinculoPropriedade(option.id)}
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
      && !vinculosPropriedades.some((vinculo) => vinculo.status !== 'inativo')
    ) {
      nextErrors.vinculosPropriedades = 'Cadastre o Produtor como Pendente. A primeira Propriedade ativará o usuário e criará o vínculo de Titular na mesma operação.';
    }

    if (
      form.perfil === 'produtor'
      && form.status !== 'ativo'
      && vinculosPropriedades.some((vinculo) => (
        vinculo.status !== 'inativo' && vinculo.tipo_vinculo === 'titular'
      ))
    ) {
      nextErrors.status = 'Um Produtor que já é Titular precisa permanecer Ativo. A transferência de titularidade exige fluxo próprio.';
    }

    if (form.perfil === 'colaborador') {
      if (
        form.status === 'ativo'
        && !vinculosPropriedades.some((vinculo) => vinculo.status !== 'inativo')
      ) {
        nextErrors.escopoColaborador = 'Colaborador ativo precisa ter ao menos uma Propriedade vinculada diretamente.';
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
    formValidation.focusFirstError(nextErrors);
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

      <ScrollView
        ref={formValidation.scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={formValidation.onScroll}
        scrollEventThrottle={16}
      >
        <InfoBox
          title="Cadastro administrativo local v2"
          message="O usuário, sua credencial e os vínculos diretos ficam somente neste aparelho. Este fluxo permite acesso local demonstrativo, mas não cria conta, convite, sincronização ou autorização em backend."
        />

        <SectionCard
          title="Dados do usuário demonstrativo"
          subtitle="Nome e e-mail identificam o registro local. Use somente dados fictícios ou autorizados."
        >
          <View ref={formValidation.registerField('nome')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('nome')}
              label="Nome"
              required
              value={form.nome}
              onChangeText={(value) => updateField('nome', value)}
              placeholder="Nome completo"
              error={errors.nome}
            />
          </View>

          <View ref={formValidation.registerField('email')} collapsable={false}>
            <FormField
              ref={formValidation.registerFocusable('email')}
              label="E-mail"
              required
              value={form.email}
              onChangeText={(value) => updateField('email', value)}
              placeholder="nome.demonstracao@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email}
              helperText="Identifica o cadastro e a credencial de acesso local neste aparelho."
            />
          </View>

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
          <View ref={formValidation.registerField(isEdit ? 'novaSenha' : 'senhaInicial')} collapsable={false}>
          <FormField
            ref={formValidation.registerFocusable(isEdit ? 'novaSenha' : 'senhaInicial')}
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
          </View>

          <View ref={formValidation.registerField(isEdit ? 'confirmarNovaSenha' : 'confirmarSenhaInicial')} collapsable={false}>
          <FormField
            ref={formValidation.registerFocusable(isEdit ? 'confirmarNovaSenha' : 'confirmarSenhaInicial')}
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
          </View>
        </SectionCard>

        <SectionCard
          title="Perfil demonstrativo"
          subtitle="O perfil define as capacidades locais; vínculos diretos definem as Propriedades acessíveis. Não representa RBAC de produção."
        >
          <View ref={formValidation.registerField('perfil')} collapsable={false}>
          <Text style={styles.label}>
            Perfil <Text style={styles.required}>*</Text>
          </Text>
          <SegmentedChips
            options={PERFIS_FORM.map((perfil) => ({
              value: perfil.key,
              label: perfil.label,
              icon: perfil.icon as any,
              disabled: isEdit && perfil.key !== form.perfil,
            }))}
            value={form.perfil}
            onChange={(value) => {
              setForm((prev) => ({
                ...prev,
                perfil: value,
                vinculosPropriedades: value === prev.perfil ? prev.vinculosPropriedades : [],
              }));
              setErrors((prev) => ({
                ...prev,
                perfil: null,
                vinculosPropriedades: null,
                escopoColaborador: null,
              }));
            }}
            style={styles.segmentedField}
          />
          {errors.perfil && <Text style={styles.errorText}>{errors.perfil}</Text>}
          {isEdit ? (
            <Text style={styles.helperText}>
              O perfil é estrutural e não pode ser trocado nesta edição comum.
            </Text>
          ) : null}
          </View>

          <View ref={formValidation.registerField('status')} collapsable={false}>
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
          </View>
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

        <View ref={formValidation.registerField('vinculosPropriedades')} collapsable={false}>
        {form.perfil === 'produtor' && (
          <SectionCard
            title="Propriedades do Produtor"
            subtitle="A titularidade é definida no cadastro da Propriedade e não pode ser alterada por esta tela."
          >
            {errors.vinculosPropriedades && <Text style={styles.errorText}>{errors.vinculosPropriedades}</Text>}
            {propriedadesSelecionadas.length > 0 ? (
              <View style={styles.linkedBox}>
                <Text style={styles.linkedTitle}>Vínculos preservados</Text>
                <Text style={styles.linkedText}>
                  {propriedadesSelecionadas.length} Propriedade{propriedadesSelecionadas.length === 1 ? '' : 's'} vinculada{propriedadesSelecionadas.length === 1 ? '' : 's'}.
                </Text>
                {propriedadesSelecionadas.map((propriedade) => {
                  const option = getFazendaOptionLabel(propriedade);
                  return <Text key={option.id} style={styles.linkedItemText}>{option.title}</Text>;
                })}
              </View>
            ) : (
              <InfoBox
                message="Cadastre este Produtor como Pendente. Depois crie a primeira Propriedade e selecione-o como Titular; usuário, Produtor e vínculo serão ativados juntos."
              />
            )}
          </SectionCard>
        )}
        </View>

        {form.perfil === 'colaborador' && (
          <SectionCard
            title="Escopo do Colaborador"
            subtitle="Selecione diretamente as Propriedades que este Colaborador poderá acessar no mock local. Município e UF servem apenas para localizar e filtrar."
          >
            <Text style={styles.label}>Propriedades vinculadas</Text>
            <View style={styles.optionList}>
              {propriedadesOrdenadas.map((propriedade) =>
                renderPropriedadeOption(propriedade)
              )}
            </View>

            {propriedadesSelecionadas.length > 0 && (
              <View style={styles.linkedBox}>
                <Text style={styles.linkedTitle}>Acesso direto</Text>
                <Text style={styles.linkedText}>
                  {propriedadesSelecionadas.length} propriedade{propriedadesSelecionadas.length === 1 ? '' : 's'} vinculada{propriedadesSelecionadas.length === 1 ? '' : 's'} diretamente.
                </Text>
                {propriedadesSelecionadas.map((propriedade) => {
                  const option = getFazendaOptionLabel(propriedade);
                  return (
                    <Text key={option.id} style={styles.linkedItemText}>
                      {option.title}
                    </Text>
                  );
                })}
              </View>
            )}

            <View ref={formValidation.registerField('escopoColaborador')} collapsable={false}>
              {errors.escopoColaborador && <Text style={styles.errorText}>{errors.escopoColaborador}</Text>}
            </View>
          </SectionCard>
        )}

        {form.perfil === 'admin' && (
          <SectionCard
            title="Dados administrativos"
            subtitle="Admin possui visão global dentro da organização local e não precisa de vínculo com Propriedade."
          >
            <View style={styles.adminBox}>
              <Ionicons name="earth-outline" size={22} color={colors.primary} />
              <View style={styles.adminBoxText}>
                <Text style={styles.adminBoxTitle}>Administrador</Text>
                <Text style={styles.adminBoxSubtitle}>Visão global na Tchê Fertilidade deste aparelho, sem vínculo operacional individual.</Text>
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
  helperText: {
    color: colors.textLight,
    fontSize: typography.fontCaption + 1,
    lineHeight: 18,
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
