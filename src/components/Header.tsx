import React from 'react';
import { View, Text, Image, StyleSheet, Platform, StatusBar, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, border, shadows } from '../theme';
import { useAuthState } from '../auth/AuthContext';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import UserProfile from './UserProfile';
import NotificationBadge from './NotificationBadge';

const LOGO = require('../assets/images/logo.png');

type HeaderProps = {
  title: string;
  showUser?: boolean;
  showNotifications?: boolean;
  showBack?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onActionPress?: () => void;
  actionIcon?: string;
  actionLabel?: string;
};

export default function Header({ title, showUser = true, showNotifications = true, showBack = false, showBackButton = false, onBack, onActionPress, actionIcon, actionLabel }: HeaderProps) {
  const { user } = useAuthState();
  const { contarNaoLidas } = useNotificacao();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const notificacoesNaoLidas = contarNaoLidas();
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.white, colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          {(showBack || showBackButton) ? (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => onBack ? onBack() : navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          )}
        </View>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        {onActionPress && (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={onActionPress}
          >
            <Ionicons name={actionIcon || "add"} size={24} color={colors.primary} />
            {actionLabel && <Text style={styles.actionLabel}>{actionLabel}</Text>}
          </TouchableOpacity>
        )}
        {showNotifications && (
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => navigation.navigate('Notificacoes')}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            {notificacoesNaoLidas > 0 && (
              <NotificationBadge count={notificacoesNaoLidas} size="small" />
            )}
          </TouchableOpacity>
        )}
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
    backgroundColor: colors.white,
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
  backButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  title: {
    fontSize: typography.fontTitle - 4,
    fontWeight: typography.weightBold,
    color: colors.text
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    position: 'relative'
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: spacing.radiusSm,
    marginRight: spacing.sm,
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: typography.fontSmall,
    fontWeight: '600',
    color: colors.primary,
  },
  userContainer: {
    marginLeft: 8
  }
});
