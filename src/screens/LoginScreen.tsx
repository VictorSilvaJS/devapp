import React from 'react';

import { useAuthActions } from '../auth/AuthContext';
import { AUTH_LOCAL_USER_NOT_FOUND_MESSAGE } from '../auth/authLocal';
import {
  AUTH_INACTIVE_ACCESS_MESSAGE,
  AUTH_PENDING_ACCESS_MESSAGE,
  AUTH_UNKNOWN_STATUS_MESSAGE,
} from '../auth/authStatus';
import LoginPresentation from '../components/LoginPresentation';
import { colors } from '../theme';

const CONTROLLED_LOGIN_MESSAGES = [
  AUTH_LOCAL_USER_NOT_FOUND_MESSAGE,
  AUTH_PENDING_ACCESS_MESSAGE,
  AUTH_INACTIVE_ACCESS_MESSAGE,
  AUTH_UNKNOWN_STATUS_MESSAGE,
];

export default function LoginScreen() {
  const { login, loginRapido, loading } = useAuthActions();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');

  const submit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Informe o e-mail');
      return;
    }
    if (!password) {
      setError('Informe a senha');
      return;
    }
    try {
      await login(email.trim(), password);
    } catch (caught: any) {
      const message = String(caught?.message ?? '');
      setError(CONTROLLED_LOGIN_MESSAGES.includes(message)
        ? message
        : 'E-mail ou senha inválidos');
    }
  };

  const quickLogin = async (profile: 'admin' | 'colaborador' | 'produtor') => {
    setError('');
    try {
      await loginRapido(profile);
    } catch (caught: any) {
      const message = String(caught?.message ?? '');
      setError(CONTROLLED_LOGIN_MESSAGES.includes(message)
        ? message
        : 'Não foi possível iniciar o acesso demonstrativo');
    }
  };

  return (
    <LoginPresentation
      email={email}
      password={password}
      onEmailChange={(value) => { setEmail(value); setError(''); }}
      onPasswordChange={(value) => { setPassword(value); setError(''); }}
      onSubmit={() => void submit()}
      busy={loading}
      error={error}
      subtitle="Acesso demonstrativo local"
      note="Use credenciais locais cadastradas no Admin ou os acessos demonstrativos. Este acesso não representa autenticação de produção."
      submitLabel="Entrar na demonstração"
      quickActionsLabel="Acesso rápido para demonstração"
      quickActions={[
        {
          label: 'Admin Demonstração',
          icon: 'shield-checkmark-outline',
          color: colors.primary,
          onPress: () => void quickLogin('admin'),
        },
        {
          label: 'Colaborador de Campo',
          icon: 'people-outline',
          color: colors.secondary,
          onPress: () => void quickLogin('colaborador'),
        },
        {
          label: 'Produtor Demonstração',
          icon: 'leaf-outline',
          color: colors.success,
          onPress: () => void quickLogin('produtor'),
        },
      ]}
    />
  );
}
