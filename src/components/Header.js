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

export default function Header({ title, showUser = true, showNotifications = true }) {
  const { user } = useAuthState();
  const { contarNaoLidas } = useNotificacao();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const notificacoesNaoLidas = contarNaoLidas();
  
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
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    position: 'relative'
  },
  userContainer: {
    marginLeft: 8
  }
});
