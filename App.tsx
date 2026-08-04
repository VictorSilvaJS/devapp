import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { AuthProvider } from './src/auth/AuthContext';
import { NotificacaoProvider } from './src/contexts/NotificacaoContext';
import { FiltroProvider } from './src/contexts/FiltroContext';
import { ToastProvider } from './src/components/Toast';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
