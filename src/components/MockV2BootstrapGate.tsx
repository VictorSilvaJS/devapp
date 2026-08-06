import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ensureMockV2DemoBootstrap } from '../api/mockV2DemoBootstrap';
import { colors, spacing, typography } from '../theme';
import LoadingScreen from './LoadingScreen';

type BootstrapState = 'loading' | 'ready' | 'error';

export default function MockV2BootstrapGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BootstrapState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('loading');

    ensureMockV2DemoBootstrap()
      .then((result) => {
        if (!active) return;
        if (result.warnings.length > 0) {
          console.warn('[MockV2Bootstrap] Limpeza parcial:', result.warnings);
        }
        setState('ready');
      })
      .catch((error) => {
        console.error('[MockV2Bootstrap] Falha controlada:', String(error?.message || error));
        if (active) setState('error');
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  if (state === 'loading') {
    return <LoadingScreen message="Preparando dados demonstrativos..." />;
  }

  if (state === 'error') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Não foi possível preparar os dados locais</Text>
        <Text style={styles.message}>
          Seus dados v2 existentes não foram substituídos. Tente novamente para concluir a inicialização.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAttempt((value) => value + 1)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screen,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: typography.fontTitle,
    fontWeight: typography.weightBold,
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: typography.fontBody,
    lineHeight: 22,
    marginTop: spacing.gap,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    marginTop: spacing.gap * 2,
    paddingHorizontal: spacing.screen,
    paddingVertical: 12,
  },
  buttonText: {
    color: colors.white,
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
  },
});
