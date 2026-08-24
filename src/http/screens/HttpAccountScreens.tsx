import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import ConfirmDialog from '../../components/ConfirmDialog';
import SectionCard from '../../components/SectionCard';
import UserProfile from '../../components/UserProfile';
import { colors, shadows, spacing, typography } from '../../theme';
import type { RemoteSessionProjection } from '../contracts';
import { HttpTabHeader } from '../HttpAppHeader';
import { useHttpSession } from '../HttpSessionContext';
import {
  HttpButton,
  HttpFeedback,
  HttpField,
  HttpParagraph,
  HttpScreen,
  HttpTitle,
  controlledUiError,
} from '../ui';

function passwordIsLocallyPlausible(value: string): boolean {
  const length = Array.from(value.normalize('NFC')).length;
  return length >= 8 && length <= 128;
}

export function HttpAccountScreen({ navigation }: any) {
  const { snapshot, logout, busy } = useHttpSession();
  const user = snapshot?.usuario;
  const [logoutVisible, setLogoutVisible] = React.useState(false);

  return (
    <View style={accountStyles.container}>
      <HttpTabHeader title="Perfil" navigation={navigation} />
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
        style={accountStyles.gradient}
      >
        <ScrollView contentContainerStyle={accountStyles.content}>
          <View style={accountStyles.profileCard}>
            <UserProfile
              user={user}
              size="large"
              accessLabel="Acesso conectado"
            />
            <View style={accountStyles.profileDetails}>
              <AccountInfoRow label="E-mail" value={user?.email ?? ''} />
              <AccountInfoRow label="Perfil" value={profileLabel(user?.perfil)} />
              <AccountInfoRow label="Status" value={user?.status === 'ativo' ? 'Ativo' : user?.status ?? ''} last />
            </View>
          </View>

          <SectionCard
            title="Segurança da conta"
            icon="shield-checkmark-outline"
            subtitle="Ações confirmadas e persistidas pelo serviço conectado."
            contentStyle={accountStyles.actions}
          >
            <AccountActionRow
              icon="key-outline"
              label="Trocar senha"
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <AccountActionRow
              icon="mail-outline"
              label="Trocar e-mail principal"
              onPress={() => navigation.navigate('RequestPrimaryEmailChange')}
            />
            {user?.perfil === 'admin' ? (
              <AccountActionRow
                icon="mail-unread-outline"
                label="Segundo e-mail do Administrador"
                onPress={() => navigation.navigate('RequestSecondaryEmail')}
              />
            ) : null}
            <AccountActionRow
              icon="phone-portrait-outline"
              label="Gerenciar sessões"
              onPress={() => navigation.navigate('Sessions')}
            />
          </SectionCard>

          <SectionCard title="Ações" icon="settings-outline">
            <TouchableOpacity
              style={accountStyles.logoutButton}
              onPress={() => setLogoutVisible(true)}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={19} color={colors.white} />
              <Text style={accountStyles.logoutText}>{busy ? 'Saindo...' : 'Sair da conta'}</Text>
            </TouchableOpacity>
          </SectionCard>
        </ScrollView>
      </LinearGradient>

      <ConfirmDialog
        visible={logoutVisible}
        title="Sair da conta"
        message="Deseja realmente encerrar esta sessão no aparelho?"
        type="danger"
        confirmText="Sair"
        cancelText="Cancelar"
        onConfirm={() => {
          setLogoutVisible(false);
          void logout();
        }}
        onCancel={() => setLogoutVisible(false)}
      />
    </View>
  );
}

function profileLabel(profile?: string): string {
  if (profile === 'admin') return 'Administrador';
  if (profile === 'colaborador') return 'Colaborador';
  if (profile === 'produtor') return 'Produtor';
  return '';
}

function AccountInfoRow({
  label,
  value,
  last = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly last?: boolean;
}) {
  return (
    <View style={[accountStyles.infoRow, last && accountStyles.infoRowLast]}>
      <Text style={accountStyles.infoLabel}>{label}</Text>
      <Text style={accountStyles.infoValue}>{value}</Text>
    </View>
  );
}

function AccountActionRow({
  icon,
  label,
  onPress,
}: {
  readonly icon: React.ComponentProps<typeof Ionicons>['name'];
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <TouchableOpacity style={accountStyles.actionRow} onPress={onPress} activeOpacity={0.75}>
      <View style={accountStyles.actionIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={accountStyles.actionLabel}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  );
}

export function HttpChangePasswordScreen() {
  const { runtime } = useHttpSession();
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!passwordIsLocallyPlausible(newPassword) || newPassword !== confirmation) {
      setError('A nova senha deve ter de 8 a 128 caracteres e as confirmações devem coincidir.');
      return;
    }
    setBusy(true);
    try {
      await runtime.session.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setSuccess('Senha alterada. As demais sessões foram encerradas.');
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Trocar senha</HttpTitle>
      <HttpParagraph>
        Use de 8 a 128 caracteres. A validação definitiva é feita pelo servidor.
      </HttpParagraph>
      <HttpField label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry maxLength={128} />
      <HttpField label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry maxLength={128} />
      <HttpField label="Confirmar nova senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={128} />
      <HttpFeedback message={error} />
      <HttpFeedback message={success} kind="success" />
      <HttpButton title={busy ? 'Alterando...' : 'Alterar senha'} onPress={() => void submit()} disabled={busy || !currentPassword || !newPassword || !confirmation} />
    </HttpScreen>
  );
}

export function HttpPrimaryEmailChangeScreen() {
  const { runtime } = useHttpSession();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await runtime.session.requestPrimaryEmailChange(email.trim(), password);
      setSuccess('Solicitação aceita. Confirme separadamente o endereço atual e o novo endereço pelos links recebidos.');
      setPassword('');
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Trocar e-mail principal</HttpTitle>
      <HttpField label="Novo e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" maxLength={254} />
      <HttpField label="Senha atual" value={password} onChangeText={setPassword} secureTextEntry maxLength={128} />
      <HttpFeedback message={error} />
      <HttpFeedback message={success} kind="success" />
      <HttpButton title={busy ? 'Solicitando...' : 'Solicitar troca'} onPress={() => void submit()} disabled={busy || !email.trim() || !password} />
    </HttpScreen>
  );
}

export function HttpSecondaryEmailScreen() {
  const { runtime, snapshot } = useHttpSession();
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  if (snapshot?.usuario.perfil !== 'admin') {
    return (
      <HttpScreen>
        <HttpTitle>Acesso indisponível</HttpTitle>
        <HttpFeedback message="Esta ação é exclusiva de conta Administradora." />
      </HttpScreen>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await runtime.session.requestSecondaryEmail(email.trim());
      setSuccess('Solicitação aceita. Confirme o segundo e-mail pelo link recebido.');
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Segundo e-mail do Admin</HttpTitle>
      <HttpParagraph>Esse endereço não será usado para login.</HttpParagraph>
      <HttpField label="Segundo e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" maxLength={254} />
      <HttpFeedback message={error} />
      <HttpFeedback message={success} kind="success" />
      <HttpButton title={busy ? 'Solicitando...' : 'Enviar verificação'} onPress={() => void submit()} disabled={busy || !email.trim()} />
    </HttpScreen>
  );
}

export function HttpSessionsScreen() {
  const { runtime } = useHttpSession();
  const [sessions, setSessions] = React.useState<readonly RemoteSessionProjection[]>([]);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setSessions(await runtime.session.listSessions());
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  }, [runtime]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await runtime.session.revokeSession(id);
      await load();
    } catch (caught) {
      setError(controlledUiError(caught));
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Sessões</HttpTitle>
      <HttpFeedback message={error} />
      {sessions.map((session) => (
        <React.Fragment key={session.id}>
          <HttpParagraph>
            {session.atual ? 'Sessão atual' : 'Outra sessão'} · criada em {new Date(session.criada_em).toLocaleString()}
          </HttpParagraph>
          {!session.atual ? (
            <HttpButton title="Revogar esta sessão" variant="secondary" disabled={busy} onPress={() => void revoke(session.id)} />
          ) : null}
        </React.Fragment>
      ))}
      <HttpButton title={busy ? 'Aguarde...' : 'Atualizar lista'} variant="secondary" disabled={busy} onPress={() => void load()} />
      <HttpButton title="Encerrar todas as sessões" variant="danger" disabled={busy} onPress={() => void runtime.session.logoutAll().catch((caught) => setError(controlledUiError(caught)))} />
    </HttpScreen>
  );
}

const accountStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  gradient: { flex: 1 },
  content: { padding: spacing.screen, paddingBottom: spacing.xl * 2 },
  profileCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: spacing.radiusLg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.md,
  },
  profileDetails: { marginTop: spacing.lg },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: colors.muted, fontSize: typography.fontBody - 1, fontWeight: typography.weightSemibold },
  infoValue: { flex: 1, color: colors.text, fontSize: typography.fontBody - 1, fontWeight: typography.weightBold, textAlign: 'right' },
  actions: { gap: spacing.sm },
  actionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.radius,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  actionLabel: { flex: 1, color: colors.text, fontSize: typography.fontBody, fontWeight: typography.weightSemibold },
  logoutButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: spacing.radius,
    backgroundColor: colors.error,
    ...shadows.sm,
  },
  logoutText: { color: colors.white, fontSize: typography.fontBody, fontWeight: typography.weightBold },
});
