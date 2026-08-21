import React from 'react';

import type { RemoteSessionProjection } from '../contracts';
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
  return (
    <HttpScreen>
      <HttpTitle>Conta</HttpTitle>
      <HttpParagraph>{user?.nome ?? ''}</HttpParagraph>
      <HttpParagraph>{user?.email ?? ''}</HttpParagraph>
      <HttpParagraph>Perfil: {user?.perfil ?? ''}</HttpParagraph>
      <HttpButton
        title="Trocar senha"
        variant="secondary"
        onPress={() => navigation.navigate('ChangePassword')}
      />
      <HttpButton
        title="Trocar e-mail principal"
        variant="secondary"
        onPress={() => navigation.navigate('RequestPrimaryEmailChange')}
      />
      {user?.perfil === 'admin' ? (
        <HttpButton
          title="Cadastrar ou alterar segundo e-mail"
          variant="secondary"
          onPress={() => navigation.navigate('RequestSecondaryEmail')}
        />
      ) : null}
      <HttpButton
        title="Gerenciar sessões"
        variant="secondary"
        onPress={() => navigation.navigate('Sessions')}
      />
      <HttpButton
        title={busy ? 'Saindo...' : 'Sair'}
        variant="danger"
        disabled={busy}
        onPress={() => void logout()}
      />
    </HttpScreen>
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
