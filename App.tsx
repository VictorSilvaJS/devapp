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
import MockV2BootstrapGate from './src/components/MockV2BootstrapGate';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <MockV2BootstrapGate>
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
        </MockV2BootstrapGate>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
