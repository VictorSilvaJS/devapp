import React from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ApiResponseError } from '../backendApi';

import type {
  AccountAction,
  ParsedAccountActionLink,
} from '../contracts';
import {
  useAccountAction,
  type AccountActionContextValue,
} from '../AccountActionContext';
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

const INVITATION_ACTIONS: readonly AccountAction[] = [
  'accept-invitation',
  'accept-initial-admin-invitation',
];

function sameActionLink(
  left: ParsedAccountActionLink | null,
  right: ParsedAccountActionLink,
): boolean {
  return left?.action === right.action && left.token === right.token;
}

function usePendingActionCleanup(
  action: AccountActionContextValue,
  pending: ParsedAccountActionLink | null,
): void {
  const pendingRef = React.useRef(pending);
  const cleanupTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  pendingRef.current = pending;

  useFocusEffect(React.useCallback(() => {
    if (cleanupTimer.current !== null) {
      clearTimeout(cleanupTimer.current);
      cleanupTimer.current = null;
    }
    return () => {
      const abandoned = pendingRef.current;
      if (abandoned === null) return;
      cleanupTimer.current = setTimeout(() => {
        action.clearIf(abandoned);
        cleanupTimer.current = null;
      }, 0);
    };
  }, [action]));
}

function PasswordFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
}: {
  readonly password: string;
  readonly confirmation: string;
  readonly onPassword: (value: string) => void;
  readonly onConfirmation: (value: string) => void;
}) {
  return (
    <>
      <HttpField label="Nova senha" value={password} onChangeText={onPassword} secureTextEntry maxLength={128} />
      <HttpField label="Confirmar nova senha" value={confirmation} onChangeText={onConfirmation} secureTextEntry maxLength={128} />
    </>
  );
}

function validPassword(password: string, confirmation: string): boolean {
  const length = Array.from(password.normalize('NFC')).length;
  return length >= 8 && length <= 128 && password === confirmation;
}

function canRetryWithSameSecret(error: unknown): boolean {
  return error instanceof ApiResponseError &&
    (error.status === 422 || error.status === 429 || error.status === 503);
}

function InvalidAction() {
  return (
    <HttpFeedback message="Este link não está disponível neste aplicativo ou já foi utilizado." />
  );
}

export function HttpAcceptInvitationScreen() {
  const { runtime } = useHttpSession();
  const action = useAccountAction();
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const pending = action.peek(INVITATION_ACTIONS);
  const available = pending !== null;
  usePendingActionCleanup(action, pending);

  const submit = async () => {
    if (!validPassword(password, confirmation)) {
      setError('A senha deve ter de 8 a 128 caracteres e as confirmações devem coincidir.');
      return;
    }
    const submitted = action.peek(INVITATION_ACTIONS);
    if (!submitted) return;
    setBusy(true);
    setError(null);
    try {
      await runtime.api.acceptInvitation(submitted.token, password);
      action.clearIf(submitted);
      setSuccess(true);
      setPassword('');
      setConfirmation('');
    } catch (caught) {
      if (!canRetryWithSameSecret(caught)) {
        action.clearIf(submitted);
        setPassword('');
        setConfirmation('');
      }
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>Aceitar convite</HttpTitle>
      <HttpParagraph>Defina sua própria senha. O convite não inicia uma sessão automaticamente.</HttpParagraph>
      {!available && !success ? <InvalidAction /> : null}
      {available ? <PasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} /> : null}
      <HttpFeedback message={error} />
      <HttpFeedback message={success ? 'Convite aceito. Volte ao login para entrar.' : null} kind="success" />
      {available ? <HttpButton title={busy ? 'Confirmando...' : 'Aceitar convite'} disabled={busy} onPress={() => void submit()} /> : null}
    </HttpScreen>
  );
}

export function HttpRequestPasswordRecoveryScreen() {
  const { runtime } = useHttpSession();
  const [email, setEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.api.requestPasswordRecovery(email.trim());
      setSuccess(true);
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <HttpScreen>
      <HttpTitle>Recuperar senha</HttpTitle>
      <HttpParagraph>A resposta é uniforme. Se a conta estiver disponível, você receberá um link de uso único.</HttpParagraph>
      <HttpField label="E-mail principal" value={email} onChangeText={setEmail} keyboardType="email-address" maxLength={254} />
      <HttpFeedback message={error} />
      <HttpFeedback message={success ? 'Solicitação recebida. Verifique seu e-mail.' : null} kind="success" />
      <HttpButton title={busy ? 'Enviando...' : 'Solicitar recuperação'} disabled={busy || !email.trim()} onPress={() => void submit()} />
    </HttpScreen>
  );
}

export function HttpCompletePasswordRecoveryScreen() {
  const { runtime } = useHttpSession();
  const action = useAccountAction();
  const allowed: readonly AccountAction[] = ['complete-password-recovery'];
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const pending = action.peek(allowed);
  const available = pending !== null;
  usePendingActionCleanup(action, pending);

  const submit = async () => {
    if (!validPassword(password, confirmation)) {
      setError('A senha deve ter de 8 a 128 caracteres e as confirmações devem coincidir.');
      return;
    }
    const submitted = action.peek(allowed);
    if (!submitted) return;
    setBusy(true);
    setError(null);
    try {
      await runtime.session.completePasswordRecovery(submitted.token, password);
      action.clearIf(submitted);
      setPassword('');
      setConfirmation('');
      setSuccess(true);
    } catch (caught) {
      if (!canRetryWithSameSecret(caught)) {
        action.clearIf(submitted);
        setPassword('');
        setConfirmation('');
      }
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <HttpScreen>
      <HttpTitle>Definir nova senha</HttpTitle>
      {!available && !success ? <InvalidAction /> : null}
      {available ? <PasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} /> : null}
      <HttpFeedback message={error} />
      <HttpFeedback message={success ? 'Senha alterada. Entre novamente para continuar.' : null} kind="success" />
      {available ? <HttpButton title={busy ? 'Alterando...' : 'Alterar senha'} disabled={busy} onPress={() => void submit()} /> : null}
    </HttpScreen>
  );
}

type SimpleConfirmationKind =
  | 'current-primary'
  | 'new-primary'
  | 'secondary-email'
  | 'admin-secondary';

const SIMPLE_CONFIRMATIONS: Record<SimpleConfirmationKind, {
  readonly actions: readonly AccountAction[];
  readonly title: string;
}> = {
  'current-primary': { actions: ['confirm-current-primary-email'], title: 'Confirmar e-mail atual' },
  'new-primary': { actions: ['confirm-new-primary-email'], title: 'Confirmar novo e-mail principal' },
  'secondary-email': { actions: ['verify-secondary-email'], title: 'Confirmar segundo e-mail' },
  'admin-secondary': { actions: ['confirm-admin-secondary-recovery'], title: 'Autorizar recuperação Administradora' },
};

export function HttpSimpleConfirmationScreen({ kind }: { readonly kind: SimpleConfirmationKind }) {
  const { runtime } = useHttpSession();
  const action = useAccountAction();
  const definition = SIMPLE_CONFIRMATIONS[kind];
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const pending = action.peek(definition.actions);
  const available = pending !== null;
  usePendingActionCleanup(action, pending);

  const submit = async () => {
    const submitted = action.peek(definition.actions);
    if (!submitted) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'current-primary') {
        await runtime.api.confirmCurrentPrimaryEmail(submitted.token);
      } else if (kind === 'new-primary') {
        await runtime.session.confirmNewPrimaryEmail(submitted.token);
      } else if (kind === 'secondary-email') {
        await runtime.api.confirmSecondaryEmail(submitted.token);
      } else {
        await runtime.api.confirmAdminSecondaryRecovery(submitted.token);
      }
      action.clearIf(submitted);
      setSuccess(true);
    } catch (caught) {
      if (!canRetryWithSameSecret(caught)) action.clearIf(submitted);
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>{definition.title}</HttpTitle>
      <HttpParagraph>A ação só será enviada depois da sua confirmação explícita.</HttpParagraph>
      {!available && !success ? <InvalidAction /> : null}
      <HttpFeedback message={error} />
      <HttpFeedback message={success ? 'Confirmação concluída.' : null} kind="success" />
      {available ? <HttpButton title={busy ? 'Confirmando...' : 'Confirmar'} disabled={busy} onPress={() => void submit()} /> : null}
    </HttpScreen>
  );
}

export function HttpRequestAdminSecondaryRecoveryScreen() {
  const { runtime } = useHttpSession();
  const [secondaryEmail, setSecondaryEmail] = React.useState('');
  const [newPrimaryEmail, setNewPrimaryEmail] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await runtime.api.requestAdminSecondaryRecovery(secondaryEmail.trim(), newPrimaryEmail.trim());
      setSuccess(true);
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <HttpScreen>
      <HttpTitle>Recuperação Administradora</HttpTitle>
      <HttpParagraph>Disponível somente quando o segundo e-mail já foi verificado. Não existe fallback break-glass nesta fase.</HttpParagraph>
      <HttpField label="Segundo e-mail verificado" value={secondaryEmail} onChangeText={setSecondaryEmail} keyboardType="email-address" maxLength={254} />
      <HttpField label="Novo e-mail principal" value={newPrimaryEmail} onChangeText={setNewPrimaryEmail} keyboardType="email-address" maxLength={254} />
      <HttpFeedback message={error} />
      <HttpFeedback message={success ? 'Solicitação recebida. Siga as confirmações enviadas aos dois endereços.' : null} kind="success" />
      <HttpButton title={busy ? 'Solicitando...' : 'Solicitar recuperação'} disabled={busy || !secondaryEmail.trim() || !newPrimaryEmail.trim()} onPress={() => void submit()} />
    </HttpScreen>
  );
}

function RestrictedRecoveryScreen({ assisted }: { readonly assisted: boolean }) {
  const { runtime } = useHttpSession();
  const action = useAccountAction();
  const allowed: readonly AccountAction[] = [
    assisted ? 'confirm-assisted-recovery-email' : 'confirm-admin-recovery-new-primary',
  ];
  const [restrictedAuthorization, setRestrictedAuthorization] = React.useState<{
    readonly token: string;
    readonly expiresMonotonic: number;
    readonly source: ParsedAccountActionLink;
  } | null>(null);
  const restrictedRef = React.useRef(restrictedAuthorization);
  const focusedRef = React.useRef(false);
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const pending = action.peek(allowed);
  const available = pending !== null;
  usePendingActionCleanup(action, pending);
  restrictedRef.current = restrictedAuthorization;

  const clearRecoverySecrets = React.useCallback(() => {
    restrictedRef.current = null;
    setRestrictedAuthorization(null);
    setPassword('');
    setConfirmation('');
  }, []);

  const cancelRemotely = React.useCallback((token: string) => {
    const request = assisted
      ? runtime.api.cancelAssistedRecovery(token)
      : runtime.api.cancelAdminSecondaryRecovery(token);
    void request.catch(() => {
      // Local secret removal never depends on a best-effort cancellation.
    });
  }, [assisted, runtime]);

  useFocusEffect(React.useCallback(() => {
    focusedRef.current = true;
    return () => {
      focusedRef.current = false;
      const authorization = restrictedRef.current;
      clearRecoverySecrets();
      if (authorization !== null) cancelRemotely(authorization.token);
    };
  }, [cancelRemotely, clearRecoverySecrets]));

  React.useEffect(() => {
    if (restrictedAuthorization === null) return undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const authorization = restrictedAuthorization;
    const checkExpiration = () => {
      const remaining = authorization.expiresMonotonic - performance.now();
      if (remaining > 0) {
        timer = setTimeout(checkExpiration, Math.min(remaining, 60_000));
        return;
      }
      if (restrictedRef.current?.token !== authorization.token) return;
      clearRecoverySecrets();
      setError('Esta autorização expirou. Solicite um novo link.');
      cancelRemotely(authorization.token);
    };
    checkExpiration();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [cancelRemotely, clearRecoverySecrets, restrictedAuthorization]);

  React.useEffect(() => {
    const authorization = restrictedRef.current;
    if (
      authorization === null ||
      pending === null ||
      sameActionLink(pending, authorization.source)
    ) {
      return;
    }
    clearRecoverySecrets();
    cancelRemotely(authorization.token);
    setSuccess(false);
    setError('Foi recebido um link mais recente. Confirme o novo link.');
  }, [cancelRemotely, clearRecoverySecrets, pending]);

  const confirmAddress = async () => {
    const submitted = action.peek(allowed);
    if (!submitted) return;
    const predecessor = restrictedRef.current;
    if (predecessor !== null) {
      clearRecoverySecrets();
      cancelRemotely(predecessor.token);
    }
    setBusy(true);
    setError(null);
    setSuccess(false);
    try {
      const response = assisted
        ? await runtime.api.confirmAssistedRecoveryEmail(submitted.token)
        : await runtime.api.confirmAdminRecoveryNewPrimary(submitted.token);
      if (!sameActionLink(action.peek(allowed), submitted)) {
        cancelRemotely(response.token);
        clearRecoverySecrets();
        if (focusedRef.current) {
          setError('Foi recebido um link mais recente. Confirme o novo link.');
        }
        return;
      }
      action.clearIf(submitted);
      const remaining = Date.parse(response.expira_em) - Date.now();
      if (!focusedRef.current || !Number.isFinite(remaining) || remaining <= 0) {
        cancelRemotely(response.token);
        if (focusedRef.current) {
          setError('Esta autorização expirou. Solicite um novo link.');
        }
        return;
      }
      const next = {
        token: response.token,
        expiresMonotonic: performance.now() + remaining,
        source: submitted,
      };
      restrictedRef.current = next;
      setRestrictedAuthorization(next);
    } catch (caught) {
      if (!canRetryWithSameSecret(caught)) action.clearIf(submitted);
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!restrictedAuthorization || !validPassword(password, confirmation)) {
      setError('A senha deve ter de 8 a 128 caracteres e as confirmações devem coincidir.');
      return;
    }
    const oneTimeAuthorization = restrictedAuthorization.token;
    setBusy(true);
    setError(null);
    try {
      if (assisted) {
        await runtime.session.completeAssistedRecovery(
          oneTimeAuthorization,
          password,
        );
      } else {
        await runtime.session.completeAdminSecondaryRecovery(
          oneTimeAuthorization,
          password,
        );
      }
      clearRecoverySecrets();
      setSuccess(true);
    } catch (caught) {
      if (!canRetryWithSameSecret(caught)) clearRecoverySecrets();
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!restrictedAuthorization) return;
    const oneTimeAuthorization = restrictedAuthorization.token;
    clearRecoverySecrets();
    setBusy(true);
    try {
      if (assisted) await runtime.api.cancelAssistedRecovery(oneTimeAuthorization);
      else await runtime.api.cancelAdminSecondaryRecovery(oneTimeAuthorization);
      setSuccess(true);
    } catch (caught) {
      setError(controlledUiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <HttpScreen>
      <HttpTitle>{assisted ? 'Concluir recuperação assistida' : 'Confirmar novo e-mail do Admin'}</HttpTitle>
      {!available && !restrictedAuthorization && !success ? <InvalidAction /> : null}
      {available ? <HttpButton title={busy ? 'Confirmando...' : 'Confirmar endereço'} disabled={busy} onPress={() => void confirmAddress()} /> : null}
      {restrictedAuthorization ? (
        <>
          <PasswordFields password={password} confirmation={confirmation} onPassword={setPassword} onConfirmation={setConfirmation} />
          <HttpButton title={busy ? 'Concluindo...' : 'Definir senha e concluir'} disabled={busy} onPress={() => void complete()} />
          <HttpButton title="Cancelar recuperação" variant="secondary" disabled={busy} onPress={() => void cancel()} />
        </>
      ) : null}
      <HttpFeedback message={error} />
      <HttpFeedback message={success ? 'Fluxo concluído. Entre novamente para continuar.' : null} kind="success" />
    </HttpScreen>
  );
}

export function HttpAdminRecoveryNewPrimaryScreen() {
  return <RestrictedRecoveryScreen assisted={false} />;
}

export function HttpAssistedRecoveryScreen() {
  return <RestrictedRecoveryScreen assisted />;
}
