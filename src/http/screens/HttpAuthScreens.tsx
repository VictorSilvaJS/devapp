import React from 'react';

import { useHttpSession } from '../HttpSessionContext';
import {
  HttpBusy,
  HttpButton,
  HttpFeedback,
  HttpField,
  HttpParagraph,
  HttpScreen,
  HttpTitle,
} from '../ui';

export function HttpLoginScreen({ navigation }: any) {
  const { login, busy, message } = useHttpSession();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const submit = async () => {
    if (!email.trim() || !password) return;
    try {
      await login(email.trim(), password);
    } catch {
      // Controlled feedback is owned by the session provider.
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Tchê Agro</HttpTitle>
      <HttpParagraph>
        Acesso conectado. Esta versão não usa dados demonstrativos nem fallback
        para o mock.
      </HttpParagraph>
      <HttpField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        maxLength={254}
      />
      <HttpField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        maxLength={128}
      />
      <HttpFeedback message={message} />
      <HttpButton
        title={busy ? 'Entrando...' : 'Entrar'}
        onPress={() => void submit()}
        disabled={busy || !email.trim() || !password}
      />
      <HttpButton
        title="Esqueci minha senha"
        variant="secondary"
        onPress={() => navigation.navigate('RequestPasswordRecovery')}
      />
      <HttpButton
        title="Recuperar Admin pelo segundo e-mail"
        variant="secondary"
        onPress={() => navigation.navigate('RequestAdminSecondaryRecovery')}
      />
    </HttpScreen>
  );
}

export function HttpLockedScreen() {
  const { unlock, logout, busy, message } = useHttpSession();
  const [password, setPassword] = React.useState('');

  const submit = async () => {
    if (!password) return;
    try {
      await unlock(password);
      setPassword('');
    } catch {
      // Controlled feedback is owned by the provider.
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Aplicativo bloqueado</HttpTitle>
      <HttpParagraph>
        Os dados foram ocultados após 15 minutos sem interação. Confirme sua
        senha para continuar. A sessão não foi encerrada automaticamente.
      </HttpParagraph>
      <HttpField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        maxLength={128}
      />
      <HttpFeedback message={message} />
      <HttpButton
        title={busy ? 'Confirmando...' : 'Desbloquear'}
        onPress={() => void submit()}
        disabled={busy || !password}
      />
      <HttpButton
        title="Sair desta conta"
        variant="secondary"
        onPress={() => void logout()}
        disabled={busy}
      />
    </HttpScreen>
  );
}

export function HttpUnavailableScreen() {
  const { retry, busy, message } = useHttpSession();
  return (
    <HttpScreen>
      <HttpTitle>Serviço indisponível</HttpTitle>
      <HttpParagraph>
        A sessão protegida foi mantida, mas nenhum dado é liberado sem
        revalidação online.
      </HttpParagraph>
      <HttpFeedback message={message} kind="info" />
      <HttpButton
        title={busy ? 'Verificando...' : 'Tentar novamente'}
        onPress={() => void retry()}
        disabled={busy}
      />
    </HttpScreen>
  );
}

export function HttpBootScreen() {
  return <HttpBusy label="Validando sessão protegida..." />;
}
