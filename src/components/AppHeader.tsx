import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { border, colors, shadows, spacing, typography } from '../theme';
import NotificationBadge from './NotificationBadge';
import UserProfile from './UserProfile';

const LOGO = require('../assets/images/logo.png');

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type AppHeaderUser = {
  readonly nome?: string | null;
  readonly perfil?: string | null;
};

export type AppHeaderProps = {
  readonly title: string;
  readonly user?: AppHeaderUser | null;
  readonly unreadCount?: number;
  readonly showUser?: boolean;
  readonly showNotifications?: boolean;
  readonly showBack?: boolean;
  readonly onBack?: () => void;
  readonly onNotificationsPress?: () => void;
  readonly onActionPress?: () => void;
  readonly actionIcon?: IconName;
  readonly actionLabel?: string;
  readonly accessLabel?: string;
};

/**
 * Cabeçalho visual compartilhado. Ele recebe identidade e ações por props para
 * que Demo e HTTP usem a mesma apresentação sem compartilhar fontes de dados.
 */
export default function AppHeader({
  title,
  user,
  unreadCount = 0,
  showUser = true,
  showNotifications = true,
  showBack = false,
  onBack,
  onNotificationsPress,
  onActionPress,
  actionIcon,
  actionLabel,
  accessLabel,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[colors.white, colors.backgroundAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              disabled={!onBack}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              accessibilityHint="Retorna à tela anterior"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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

        {onActionPress ? (
          <TouchableOpacity style={styles.actionButton} onPress={onActionPress}>
            <Ionicons name={actionIcon ?? 'add'} size={24} color={colors.primary} />
            {actionLabel ? <Text style={styles.actionLabel}>{actionLabel}</Text> : null}
          </TouchableOpacity>
        ) : null}

        {showNotifications && onNotificationsPress ? (
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={onNotificationsPress}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0
              ? `Notificações, ${unreadCount} não lidas`
              : 'Notificações'}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            <NotificationBadge count={unreadCount} size="small" />
          </TouchableOpacity>
        ) : null}

        {showUser && user ? (
          <View style={styles.userContainer}>
            <UserProfile
              user={user}
              size="small"
              showDetails={false}
              accessLabel={accessLabel}
            />
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.card,
    paddingVertical: spacing.card + 4,
  },
  logoContainer: {
    width: 50,
    height: 50,
    backgroundColor: colors.white,
    borderRadius: border.radius,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.sm,
  },
  logo: { width: 42, height: 42 },
  titleContainer: { flex: 1, minWidth: 0 },
  backButton: { padding: spacing.sm },
  title: {
    fontSize: typography.fontTitle - 4,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    position: 'relative',
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
    fontWeight: typography.weightSemibold,
    color: colors.primary,
  },
  userContainer: { marginLeft: spacing.sm },
});
