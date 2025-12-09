import React from 'react';
import { View, Text, Image, StyleSheet, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, border, shadows } from '../theme';
import { useAuthState } from '../auth/AuthContext';
import UserProfile from './UserProfile';

const LOGO = require('../assets/images/logo.png');

export default function Header({ title, showUser = true }) {
  const { user } = useAuthState();
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#FFFFFF', colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        {showUser && (
          <View style={styles.userContainer}>
            <UserProfile user={user} size="small" showDetails={false} />
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    ...shadows.sm
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.card,
    paddingVertical: spacing.card + 4
  },
  logoContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...shadows.sm
  },
  logo: {
    width: 42,
    height: 42
  },
  titleContainer: {
    flex: 1
  },
  title: {
    fontSize: typography.fontTitle - 4,
    fontWeight: typography.weightBold,
    color: colors.text
  },
  userContainer: {
    marginLeft: 8
  }
});
