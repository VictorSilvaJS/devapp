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
import { getFazendaId, getTitularIdFazenda } from '../utils/acessoControle';
import {
  STATUS_USUARIO_ADMIN,
  buildUsuarioAdminPayload,
  buildUsuarioFormFromMock,
  getFazendaOptionLabel,
} from '../utils/usuarioAdminCompat';

const PERFIS_FORM = [
  { key: 'produtor', label: 'Produtor', icon: 'leaf-outline' },
  { key: 'colaborador', label: 'Colaborador', icon: 'briefcase-outline' },
  { key: 'admin', label: 'Admin', icon: 'shield-checkmark-outline' },
];

const TIPOS_VINCULO_PRODUTOR = [
  { key: 'titular', label: 'Titular' },
  { key: 'responsavel', label: 'Responsável' },
];

const emptyForm = {
  nome: '',
  email: '',
  telefone: '',
  perfil: 'produtor',
  status: 'ativo',
  observacoes: '',
  propriedadePrincipalId: '',
  produtor_id: '',
  tipoVinculoProdutor: 'titular',
  regiao: '',
  cargo: '',
  subRegioesText: '',
  propriedadesAtribuidas: [] as string[],
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

      const propriedadesData = await Produtor.list();
      setPropriedades(propriedadesData as any[]);

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

  const propriedadesDoTitularSelecionado = useMemo(() => {
    const selecionada = propriedades.find((propriedade) => getFazendaId(propriedade) === form.propriedadePrincipalId);
    const titularId = getTitularIdFazenda(selecionada) || form.produtor_id;
    if (!titularId) return [];

    return propriedades.filter((propriedade) => getTitularIdFazenda(propriedade) === titularId);
  }, [form.propriedadePrincipalId, form.produtor_id, propriedades]);

  const togglePropriedadeAtribuida = (id: string) => {
    setForm((prev) => {
      const current = new Set(prev.propriedadesAtribuidas || []);
      if (current.has(id)) {
        current.delete(id);
      } else {
        current.add(id);
      }

      return {
        ...prev,
        propriedadesAtribuidas: [...current],
      };
    });
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
    }

    if (!form.perfil) {
      nextErrors.perfil = 'Selecione o perfil.';
    }

    if (form.perfil === 'produtor' && !form.propriedadePrincipalId && !form.produtor_id) {
      nextErrors.propriedadePrincipalId = 'Selecione uma propriedade para vincular o produtor.';
    }

    if (form.perfil === 'colaborador' && !form.regiao.trim()) {
      nextErrors.regiao = 'Informe a região do colaborador.';
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
      toast.showError('Não foi possível salvar o usuário no mock.');
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
            <Text style={styles.sectionTitle}>Vínculo do produtor</Text>
            <Text style={styles.sectionHint}>
              Selecione uma propriedade. O mock usa o titular da propriedade para agrupar todos os vínculos deste produtor.
            </Text>

            <Text style={styles.label}>Tipo de vínculo</Text>
            <View style={styles.segmented}>
              {TIPOS_VINCULO_PRODUTOR.map((tipo) => {
                const active = form.tipoVinculoProdutor === tipo.key;
                return (
                  <TouchableOpacity
                    key={tipo.key}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                    onPress={() => updateField('tipoVinculoProdutor', tipo.key)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{tipo.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, styles.labelSpacing]}>Propriedade de referência</Text>
            {errors.propriedadePrincipalId && <Text style={styles.errorText}>{errors.propriedadePrincipalId}</Text>}
            <View style={styles.optionList}>
              {propriedadesOrdenadas.map((propriedade) => {
                const option = getFazendaOptionLabel(propriedade);
                const active = form.propriedadePrincipalId === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => {
                      updateField('propriedadePrincipalId', option.id);
                      updateField('produtor_id', getTitularIdFazenda(propriedade));
                    }}
                    activeOpacity={0.78}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'home-outline'}
                      size={20}
                      color={active ? colors.primary : colors.muted}
                    />
                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionTitle} numberOfLines={1}>{option.title}</Text>
                      <Text style={styles.optionSubtitle} numberOfLines={1}>{option.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {propriedadesDoTitularSelecionado.length > 0 && (
              <View style={styles.linkedBox}>
                <Text style={styles.linkedTitle}>Vínculo visual resultante</Text>
                <Text style={styles.linkedText}>
                  {propriedadesDoTitularSelecionado.length} propriedade{propriedadesDoTitularSelecionado.length === 1 ? '' : 's'} vinculada{propriedadesDoTitularSelecionado.length === 1 ? '' : 's'} ao mesmo titular.
                </Text>
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
            <View style={styles.optionList}>
              {propriedadesOrdenadas.map((propriedade) => {
                const option = getFazendaOptionLabel(propriedade);
                const active = (form.propriedadesAtribuidas || []).includes(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => togglePropriedadeAtribuida(option.id)}
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
                );
              })}
            </View>
          </View>
        )}

        {form.perfil === 'admin' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Acesso administrativo</Text>
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
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
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
  adminBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.backgroundAlt,
    borderRadius: spacing.radiusSm,
    padding: spacing.md,
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
