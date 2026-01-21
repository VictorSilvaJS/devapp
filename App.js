import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import Navigation from './src/navigation';
import { AuthProvider } from './src/auth/AuthContext';
import { NotificacaoProvider } from './src/contexts/NotificacaoContext';
import { FiltroProvider } from './src/contexts/FiltroContext';
import { ToastProvider } from './src/components/Toast';
import ErrorBoundary from './src/components/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';

// Habilita react-native-screens para melhor performance
enableScreens();

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <FiltroProvider>
            <NotificacaoProvider>
              <ToastProvider>
                <NavigationContainer>
                  <Navigation />
                </NavigationContainer>
              </ToastProvider>
            </NotificacaoProvider>
          </FiltroProvider>
        </AuthProvider>
        <StatusBar style="dark" backgroundColor="#F8FBF8" />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
