import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../components/Header';
import { Produtor, User } from '../api/mock';
import { useAuthState } from '../auth/AuthContext';
import { useToast } from '../components/Toast';
import { colors, shadows, spacing, typography } from '../theme';
import { getFazendaId } from '../utils/acessoControle';
import {
  NIVEIS_ADMIN_USUARIO,
  STATUS_USUARIO_ADMIN,
  TIPOS_VINCULO_PROPRIEDADE_USUARIO,
  buildUsuarioAdminPayload,
  buildUsuarioFormFromMock,
  getFazendaOptionLabel,
  getVinculoPropriedadeLabel,
  normalizeFormVinculosPropriedade,
  parseListaTexto,
} from '../utils/usuarioAdminCompat';

const PERFIS_FORM = [
  { key: 'produtor', label: 'Produtor', icon: 'leaf-outline' },
  { key: 'colaborador', label: 'Colaborador', icon: 'briefcase-outline' },
  { key: 'admin', label: 'Admin', icon: 'shield-checkmark-outline' },
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
      } else {
        setUsuarioAtual(null);
        setForm(emptyForm);
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
      return 'Colaborador ativo precisa ter micro-região/sub-região ou propriedade atribuída.';
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
              <View style={styles.miniChipWrap}>
                {TIPOS_VINCULO_PRODUTOR.map((tipo) => {
                  const selected = vinculo.tipo_vinculo === tipo.key;
                  return (
                    <TouchableOpacity
                      key={tipo.key}
                      style={[styles.miniChip, selected && styles.miniChipActive]}
                      onPress={() => updateTipoVinculoPropriedade(option.id, tipo.key)}
                      activeOpacity={0.78}
                    >
                      <Text style={[styles.miniChipText, selected && styles.miniChipTextActive]}>{tipo.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
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

    if (form.perfil === 'produtor' && form.status === 'ativo' && vinculosPropriedades.length === 0) {
      nextErrors.vinculosPropriedades = 'Produtor ativo precisa ter ao menos uma propriedade vinculada.';
    }

    if (form.perfil === 'colaborador') {
      const temMicroRegiao = microRegioesInformadas.length > 0;
      const temPropriedade = vinculosPropriedades.length > 0;

      if (temMicroRegiao && !form.regiao.trim()) {
        nextErrors.regiao = 'Informe a região para organizar as micro-regiões.';
      }

      if (form.status === 'ativo' && !temMicroRegiao && !temPropriedade) {
        nextErrors.escopoColaborador = 'Colaborador ativo precisa ter micro-região/sub-região ou propriedade atribuída.';
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
      const payload = buildUsuarioAdminPayload({
        form,
        propriedades,
        existing: usuarioAtual,
      });

      const saved = isEdit
        ? await User.update(userId, payload)
        : await User.create(payload);

      toast.showSuccess(isEdit ? 'Usuário atualizado no mock.' : 'Usuário criado no mock.');
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
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            Este cadastro é visual/mockado. Não cria senha real, convite, reset de acesso ou autenticação em backend.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados comuns</Text>

          <Field
            label="Nome"
            value={form.nome}
            onChangeText={(value) => updateField('nome', value)}
            placeholder="Nome completo"
            error={errors.nome}
          />

          <Field
            label="E-mail"
            value={form.email}
            onChangeText={(value) => updateField('email', value)}
            placeholder="usuario@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            error={errors.email}
          />

          <Field
            label="Telefone"
            value={form.telefone}
            onChangeText={(value) => updateField('telefone', value)}
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
          />

          <Field
            label="Documento"
            value={form.documento}
            onChangeText={(value) => updateField('documento', value)}
            placeholder="CPF ou CNPJ"
          />

          <Text style={styles.label}>Perfil</Text>
          <View style={styles.segmented}>
            {PERFIS_FORM.map((perfil) => {
              const active = form.perfil === perfil.key;
              return (
                <TouchableOpacity
                  key={perfil.key}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => updateField('perfil', perfil.key)}
                  activeOpacity={0.75}
                >
                  <Ionicons name={perfil.icon} size={16} color={active ? colors.white : colors.primary} />
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{perfil.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.perfil && <Text style={styles.errorText}>{errors.perfil}</Text>}

          <Text style={[styles.label, styles.labelSpacing]}>Status</Text>
          <View style={styles.segmented}>
            {STATUS_USUARIO_ADMIN.map((status) => {
              const active = form.status === status.key;
              return (
                <TouchableOpacity
                  key={status.key}
                  style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  onPress={() => updateField('status', status.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{status.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.status && <Text style={styles.errorText}>{errors.status}</Text>}

          <Field
            label="Observações"
            value={form.observacoes}
            onChangeText={(value) => updateField('observacoes', value)}
            placeholder="Observações internas do mock"
            multiline
            numberOfLines={3}
            style={styles.textarea}
          />
        </View>

        {form.perfil === 'produtor' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Vínculos do produtor</Text>
            <Text style={styles.sectionHint}>
              Selecione uma ou mais propriedades. O vínculo principal preserva a compatibilidade interna atual.
            </Text>

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
          </View>
        )}

        {form.perfil === 'colaborador' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Escopo do colaborador</Text>
            <Field
              label="Função/cargo"
              value={form.cargo}
              onChangeText={(value) => updateField('cargo', value)}
              placeholder="Ex: Consultor regional"
            />
            <Field
              label="Região"
              value={form.regiao}
              onChangeText={(value) => updateField('regiao', value)}
              placeholder="Ex: Goiás"
              error={errors.regiao}
            />
            <Field
              label="Micro-regiões/sub-regiões"
              value={form.subRegioesText}
              onChangeText={(value) => updateField('subRegioesText', value)}
              placeholder="Ex: Rio Verde, Jataí"
            />

            <Text style={styles.label}>Propriedades atribuídas no mock</Text>
            <Text style={styles.sectionHint}>
              Opcional. As permissões atuais continuam baseadas no escopo regional existente.
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
          </View>
        )}

        {form.perfil === 'admin' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Acesso administrativo</Text>
            <Text style={styles.label}>Nível administrativo</Text>
            <View style={styles.segmented}>
              {NIVEIS_ADMIN_USUARIO.map((nivel) => {
                const active = form.nivelAdministrativo === nivel.key;
                return (
                  <TouchableOpacity
                    key={nivel.key}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    onPress={() => updateField('nivelAdministrativo', nivel.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{nivel.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.adminBox}>
              <Ionicons name="earth-outline" size={22} color={colors.primary} />
              <View style={styles.adminBoxText}>
                <Text style={styles.adminBoxTitle}>Acesso global</Text>
                <Text style={styles.adminBoxSubtitle}>Visão ampla das regiões, usuários e propriedades no MVP mockado.</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: spacing.xl * 4 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()} disabled={saving}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color={colors.white} />
              <Text style={styles.saveText}>Salvar</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const Field = ({ label, error, style, ...props }: any) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      {...props}
      style={[styles.input, error && styles.inputError, style]}
      placeholderTextColor={colors.muted}
      textAlignVertical={props.multiline ? 'top' : 'center'}
    />
    {error && <Text style={styles.errorText}>{error}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.screen,
    paddingBottom: spacing.xl * 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: spacing.radius,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontBody - 1,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.fontBody + 1,
    fontWeight: typography.weightBold,
    marginBottom: spacing.md,
  },
  sectionHint: {
    color: colors.muted,
    fontSize: typography.fontCaption + 1,
    lineHeight: 19,
    marginBottom: spacing.md,
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
  input: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: spacing.radiusSm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    color: colors.text,
    fontSize: typography.fontBody,
  },
  textarea: {
    minHeight: 92,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: typography.fontCaption + 1,
    marginTop: spacing.xs,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.primary,
    fontSize: typography.fontCaption + 1,
    fontWeight: typography.weightBold,
  },
  segmentTextActive: {
    color: colors.white,
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
