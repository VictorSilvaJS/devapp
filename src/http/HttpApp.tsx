import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { AccountActionProvider } from './AccountActionContext';
import {
  InvalidHttpRuntimeConfigError,
  loadHttpRuntimeConfig,
} from './config';
import { HttpSessionProvider } from './HttpSessionContext';
import { HttpNavigation } from './HttpNavigation';
import { createHttpRuntime, type HttpRuntime } from './runtime';
import { colors, spacing, typography } from '../theme';

function createProductionRuntime(): HttpRuntime | Error {
  try {
    return createHttpRuntime(loadHttpRuntimeConfig());
  } catch (error) {
    return error instanceof Error
      ? error
      : new InvalidHttpRuntimeConfigError('Configuração HTTP inválida.');
  }
}

const runtime = createProductionRuntime();

export default function HttpApp() {
  if (runtime instanceof Error) {
    return (
      <SafeAreaProvider>
        <View style={styles.configurationError}>
          <Text style={styles.title}>Configuração indisponível</Text>
          <Text style={styles.message}>
            O aplicativo HTTP não pode iniciar sem URLs HTTPS válidas da API e
            das ações de conta.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <HttpSessionProvider runtime={runtime}>
          <AccountActionProvider>
            <HttpNavigation />
          </AccountActionProvider>
        </HttpSessionProvider>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  configurationError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  title: { color: colors.error, fontSize: typography.fontSubtitle, fontWeight: '700' },
  message: { color: colors.text, fontSize: typography.fontBody, textAlign: 'center', lineHeight: 22 },
});
