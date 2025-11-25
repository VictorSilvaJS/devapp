import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Navigation from './src/navigation';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
