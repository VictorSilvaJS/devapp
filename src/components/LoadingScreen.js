import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing } from '../theme';

const LOGO = require('../assets/images/logo.png');

export default function LoadingScreen({ message = 'Carregando...' }) {
  return (
    <LinearGradient
      colors={[colors.gradientStart, colors.gradientMid, colors.gradientEnd]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.content}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.subtitle}>Tchê Agro</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.screen * 2
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: spacing.gap * 2
  },
  spinner: {
    marginTop: spacing.gap,
    marginBottom: spacing.gap
  },
  message: {
    fontSize: typography.fontBody,
    color: colors.text,
    fontWeight: typography.weightSemibold,
    marginTop: spacing.gap
  },
  subtitle: {
    fontSize: typography.fontCaption,
    color: colors.muted,
    marginTop: 4,
    fontWeight: typography.weightRegular
  }
});
