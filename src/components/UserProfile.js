import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, shadows } from '../theme';

export default function UserProfile({ user, size = 'medium', showDetails = true }) {
  const sizeStyles = {
    small: { width: 36, height: 36, fontSize: 16 },
    medium: { width: 48, height: 48, fontSize: 20 },
    large: { width: 64, height: 64, fontSize: 28 }
  };

  const avatarSize = sizeStyles[size] || sizeStyles.medium;

  const getInitials = () => {
    if (!user?.full_name) return 'U';
    const names = user.full_name.split(' ');
    if (names.length >= 2) {
      return `${names[0].charAt(0)}${names[names.length - 1].charAt(0)}`.toUpperCase();
    }
    return user.full_name.charAt(0).toUpperCase();
  };

  const getPerfilColor = () => {
    const perfil = user?.perfil || 'cliente';
    switch (perfil) {
      case 'admin':
        return [colors.primary, colors.primaryDark];
      case 'colaborador':
        return [colors.secondary, colors.secondaryLight];
      default:
        return [colors.success, colors.successLight];
    }
  };

  return (
    <View style={[styles.container, !showDetails && styles.containerCompact]}>
      <LinearGradient
        colors={getPerfilColor()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.avatar,
          {
            width: avatarSize.width,
            height: avatarSize.height,
            borderRadius: avatarSize.width / 2
          }
        ]}
      >
        <Text style={[styles.initials, { fontSize: avatarSize.fontSize }]}>
          {getInitials()}
        </Text>
      </LinearGradient>

      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.full_name || 'Usuário'}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.perfil}>
              {user?.perfil ? user.perfil.charAt(0).toUpperCase() + user.perfil.slice(1) : 'Cliente'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  containerCompact: {
    flexDirection: 'row',
    gap: 0
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: typography.weightBold
  },
  details: {
    flex: 1,
    minWidth: 0
  },
  name: {
    fontSize: typography.fontBody,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: 2
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  perfil: {
    fontSize: typography.fontSmall,
    fontWeight: typography.weightSemibold,
    color: colors.primary,
    textTransform: 'capitalize'
  }
});
