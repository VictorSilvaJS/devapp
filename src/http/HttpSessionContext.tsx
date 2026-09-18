import React from 'react';
import {
  AppState,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  type AppStateStatus,
} from 'react-native';

import { ApiResponseError } from './backendApi';
import { ApiTransportError } from './httpTransport';
import type { SessionSnapshot } from './contracts';
import type { HttpRuntime } from './runtime';
import {
  SessionRequiredError,
  SessionStorageError,
} from './sessionCoordinator';
import { safeClientErrorMessage } from './errorMessages';
import { colors, spacing, typography } from '../theme';
import { VisualPrivacyBoundary, VisualPrivacyContext } from '../components/VisualPrivacyBoundary';

const LOCK_AFTER_MS = 15 * 60 * 1_000;

type SessionUiStatus =
  | 'booting'
  | 'anonymous'
  | 'authenticated'
  | 'locked'
  | 'unavailable';

interface HttpSessionContextValue {
  readonly runtime: HttpRuntime;
  readonly snapshot: SessionSnapshot | null;
  readonly sessionEpoch: number;
  readonly status: SessionUiStatus;
  readonly busy: boolean;
  readonly message: string | null;
  login(email: string, password: string): Promise<void>;
  unlock(password: string): Promise<void>;
  logout(): Promise<void>;
  retry(): Promise<void>;
  clearAfterAccountChange(): Promise<void>;
}

const HttpSessionContext = React.createContext<HttpSessionContextValue | null>(
  null,
);

function controlledMessage(error: unknown): string {
  return safeClientErrorMessage(error);
}

function preservesUnavailableSession(
  error: unknown,
  snapshot: SessionSnapshot | null,
): boolean {
  return snapshot !== null && (
    error instanceof ApiTransportError ||
    (error instanceof ApiResponseError &&
      (error.status === 429 || error.status >= 500))
  );
}

function monotonicNow(): number {
  return performance.now();
}

export function HttpSessionProvider({
  runtime,
  children,
}: React.PropsWithChildren<{ readonly runtime: HttpRuntime }>) {
  const [snapshot, setSnapshot] = React.useState(runtime.session.snapshot);
  const [sessionEpoch, setSessionEpoch] = React.useState(runtime.session.epoch);
  const [status, setStatus] = React.useState<SessionUiStatus>('booting');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [privacyShield, setPrivacyShield] = React.useState(true);
  const [lockedPassword, setLockedPassword] = React.useState('');
  const backgroundAt = React.useRef<number | null>(null);
  const lastActivityAt = React.useRef(monotonicNow());
  const statusRef = React.useRef(status);
  const appStateGeneration = React.useRef(0);
  const lifecycle = React.useRef<object | null>(null);
  const returnFlight = React.useRef<{ generation: number; promise: Promise<void> } | null>(null);

  React.useEffect(() => {
    lifecycle.current = {};
    return () => {
      lifecycle.current = null;
      appStateGeneration.current += 1;
      returnFlight.current = null;
    };
  }, [runtime]);

  React.useEffect(() => {
    statusRef.current = status;
    if (status !== 'locked') setLockedPassword('');
  }, [status]);

  React.useEffect(() => {
    return runtime.session.subscribe((next) => {
      setSnapshot(next);
      setSessionEpoch(runtime.session.epoch);
      if (next === null && statusRef.current !== 'booting') {
        setStatus('anonymous');
      }
    });
  }, [runtime]);

  const initialize = React.useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const restored = await runtime.session.restore();
      setSnapshot(restored);
      setStatus(restored === null ? 'anonymous' : 'locked');
      lastActivityAt.current = monotonicNow();
    } catch (error) {
      if (
        preservesUnavailableSession(error, runtime.session.snapshot) ||
        (error instanceof ApiResponseError && error.status === 503)
      ) {
        setStatus('unavailable');
        setMessage(controlledMessage(error));
      } else {
        setStatus('anonymous');
        setMessage(controlledMessage(error));
      }
    } finally {
      setBusy(false);
      if (AppState.currentState === 'active') setPrivacyShield(false);
    }
  }, [runtime]);

  React.useEffect(() => {
    void initialize();
  }, [initialize]);

  const login = React.useCallback(async (email: string, password: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await runtime.session.login(email, password);
      setSnapshot(next);
      setStatus('authenticated');
      lastActivityAt.current = monotonicNow();
    } catch (error) {
      setMessage(controlledMessage(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }, [runtime]);

  const unlock = React.useCallback(async (password: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await runtime.session.reauthenticate(password);
      setSnapshot(next);
      setStatus('authenticated');
      lastActivityAt.current = monotonicNow();
    } catch (error) {
      setMessage(controlledMessage(error));
      throw error;
    } finally {
      setBusy(false);
    }
  }, [runtime]);

  const logout = React.useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await runtime.session.logout();
    } catch (error) {
      setMessage(controlledMessage(error));
    } finally {
      setSnapshot(null);
      setStatus('anonymous');
      setBusy(false);
    }
  }, [runtime]);

  const retry = React.useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      const restoringFromStorage = runtime.session.snapshot === null;
      const next = restoringFromStorage
        ? await runtime.session.restore()
        : await runtime.session.revalidate();
      setSnapshot(next);
      setStatus(
        next === null
          ? 'anonymous'
          : restoringFromStorage
            ? 'locked'
            : 'authenticated',
      );
    } catch (error) {
      if (
        preservesUnavailableSession(error, runtime.session.snapshot) ||
        (error instanceof ApiResponseError && error.status === 503)
      ) {
        setStatus('unavailable');
      } else {
        setStatus('anonymous');
      }
      setMessage(controlledMessage(error));
    } finally {
      setBusy(false);
    }
  }, [runtime]);

  const clearAfterAccountChange = React.useCallback(async () => {
    setBusy(true);
    try {
      await runtime.session.clearAfterAccountChange();
    } finally {
      setSnapshot(null);
      setStatus('anonymous');
      setBusy(false);
    }
  }, [runtime]);

  // UI return coordination only. SessionCoordinator retains authority and /me ordering.
  // Native focus and AppState resume share the same return; neither releases an old cycle.
  const validateReturn = React.useCallback((): Promise<void> => {
    const generation = appStateGeneration.current;
    if (returnFlight.current?.generation === generation) return returnFlight.current.promise;
    const instance = lifecycle.current;
    const epoch = runtime.session.epoch;
    const current = () => instance !== null && lifecycle.current === instance &&
      generation === appStateGeneration.current && AppState.currentState === 'active';
    setPrivacyShield(true);
    const promise = (async () => {
      const startedAt = backgroundAt.current;
      // Keep the original timestamp until the return is accepted, including concurrent focus.
      if (startedAt !== null && runtime.session.snapshot !== null &&
          monotonicNow() - startedAt >= LOCK_AFTER_MS) {
        await logout();
        if (current()) setMessage('Entre novamente após 15 minutos em segundo plano.');
      } else if (runtime.session.snapshot !== null &&
          statusRef.current !== 'locked' && statusRef.current !== 'booting') {
        try {
          const next = await runtime.session.revalidate();
          if (!current() || runtime.session.epoch !== epoch) return;
          setSnapshot(next);
          setStatus('authenticated');
          setMessage(null);
        } catch (error) {
          if (!current()) return;
          if (runtime.session.epoch !== epoch && runtime.session.snapshot !== null) return;
          setStatus(preservesUnavailableSession(error, runtime.session.snapshot) ||
            (error instanceof ApiResponseError && error.status === 503) ? 'unavailable' : 'anonymous');
          setMessage(controlledMessage(error));
        }
      }
      if (current()) {
        backgroundAt.current = null;
        lastActivityAt.current = monotonicNow();
        if (statusRef.current !== 'booting') setPrivacyShield(false);
      }
    })();
    const flight = { generation, promise };
    returnFlight.current = flight;
    void promise.finally(() => {
      if (returnFlight.current === flight) returnFlight.current = null;
    }).catch(() => { /* Caller keeps the visual protection on unexpected failure. */ });
    return promise;
  }, [logout, runtime]);

  React.useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        appStateGeneration.current += 1;
        returnFlight.current = null;
        setPrivacyShield(true);
        if (backgroundAt.current === null) {
          backgroundAt.current = monotonicNow();
        }
        return;
      }

      void validateReturn().catch(() => { /* Stay covered until a valid return. */ });
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    return () => {
      subscription.remove();
      appStateGeneration.current += 1;
      returnFlight.current = null;
    };
  }, [validateReturn]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      if (
        statusRef.current === 'authenticated' &&
        monotonicNow() - lastActivityAt.current >= LOCK_AFTER_MS
      ) {
        setStatus('locked');
      }
    }, 5_000);
    return () => clearInterval(interval);
  }, []);

  const markActivity = React.useCallback(() => {
    if (statusRef.current === 'authenticated') {
      lastActivityAt.current = monotonicNow();
    }
  }, []);

  const value = React.useMemo<HttpSessionContextValue>(() => ({
    runtime,
    snapshot,
    sessionEpoch,
    status,
    busy,
    message,
    login,
    unlock,
    logout,
    retry,
    clearAfterAccountChange,
  }), [
    runtime,
    snapshot,
    sessionEpoch,
    status,
    busy,
    message,
    login,
    unlock,
    logout,
    retry,
    clearAfterAccountChange,
  ]);

  return (
    <HttpSessionContext.Provider value={value}>
      <VisualPrivacyContext.Provider value={{ covered: privacyShield, validateReturn }}>
      <VisualPrivacyBoundary style={styles.root} onTouchStart={markActivity}>
        {children}
        {status === 'locked' && !privacyShield ? (
          <View
            style={styles.lockOverlay}
            accessibilityViewIsModal
            pointerEvents="auto"
          >
            <Text style={styles.lockTitle}>Aplicativo bloqueado</Text>
            <Text style={styles.lockMessage}>
              Digite sua senha completa para voltar a exibir os dados.
            </Text>
            <TextInput
              style={styles.lockInput}
              value={lockedPassword}
              onChangeText={setLockedPassword}
              placeholder="Senha"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
            />
            {message ? <Text style={styles.lockError}>{message}</Text> : null}
            <Pressable
              style={({ pressed }) => [
                styles.lockButton,
                pressed ? styles.lockButtonPressed : null,
              ]}
              disabled={busy || lockedPassword.length === 0}
              onPress={() => {
                const password = lockedPassword;
                setLockedPassword('');
                void unlock(password).catch(() => {
                  // The provider exposes only a controlled local message.
                });
              }}
            >
              <Text style={styles.lockButtonText}>
                {busy ? 'Verificando...' : 'Desbloquear'}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.lockLogoutButton,
                pressed ? styles.lockButtonPressed : null,
              ]}
              disabled={busy}
              onPress={() => {
                setLockedPassword('');
                void logout();
              }}
            >
              <Text style={styles.lockLogoutButtonText}>
                Sair desta conta
              </Text>
            </Pressable>
          </View>
        ) : null}
        {privacyShield ? (
          <View style={styles.privacyShield} accessibilityViewIsModal>
            <Text style={styles.privacyTitle}>Tchê Agro</Text>
            <Text style={styles.privacyMessage}>Conteúdo protegido</Text>
          </View>
        ) : null}
      </VisualPrivacyBoundary>
      </VisualPrivacyContext.Provider>
    </HttpSessionContext.Provider>
  );
}

export function useHttpSession(): HttpSessionContextValue {
  const value = React.useContext(HttpSessionContext);
  if (value === null) {
    throw new Error('useHttpSession deve ser usado dentro de HttpSessionProvider.');
  }
  return value;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  privacyShield: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10_000,
    elevation: 10_000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryDark,
    padding: spacing.xl,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9_000,
    elevation: 9_000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  lockTitle: {
    color: colors.text,
    fontSize: typography.fontTitle,
    fontWeight: '700',
  },
  lockMessage: {
    color: colors.muted,
    fontSize: typography.fontBody,
    textAlign: 'center',
  },
  lockInput: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  lockError: {
    color: colors.error,
    fontSize: typography.fontBody,
    textAlign: 'center',
  },
  lockButton: {
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  lockButtonPressed: { opacity: 0.85 },
  lockButtonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: '700',
  },
  lockLogoutButton: {
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  lockLogoutButtonText: {
    color: colors.error,
    fontSize: typography.fontBody,
    fontWeight: '700',
  },
  privacyTitle: {
    color: colors.white,
    fontSize: typography.fontTitle,
    fontWeight: '700',
  },
  privacyMessage: {
    color: colors.white,
    fontSize: typography.fontBody,
    marginTop: spacing.sm,
  },
});
