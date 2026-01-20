import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { AuthProvider } from './src/auth/AuthContext';
import { NotificacaoProvider } from './src/contexts/NotificacaoContext';
import { ToastProvider } from './src/components/Toast';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificacaoProvider>
          <ToastProvider>
            <NavigationContainer>
              <Navigation />
            </NavigationContainer>
          </ToastProvider>
        </NotificacaoProvider>
      </AuthProvider>
      <StatusBar style="dark" backgroundColor="#F8FBF8" />
    </SafeAreaProvider>
  );
}
