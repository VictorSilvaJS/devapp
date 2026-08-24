import React from 'react';
import { useAuthState } from '../auth/AuthContext';
import { useNotificacao } from '../contexts/NotificacaoContext';
import { useNavigation } from '@react-navigation/native';
import AppHeader, { type AppHeaderProps } from './AppHeader';

type HeaderProps = Omit<
  AppHeaderProps,
  'user' | 'unreadCount' | 'onNotificationsPress' | 'accessLabel'
>;

export default function Header({ title, showUser = true, showNotifications = true, showBack = false, onBack, onActionPress, actionIcon, actionLabel }: HeaderProps) {
  const { user } = useAuthState();
  const { contarNaoLidas } = useNotificacao();
  const navigation = useNavigation();

  return (
    <AppHeader
      title={title}
      user={user}
      unreadCount={contarNaoLidas()}
      showUser={showUser}
      showNotifications={showNotifications}
      showBack={showBack}
      onBack={() => onBack ? onBack() : navigation.goBack()}
      onNotificationsPress={() => navigation.navigate('Notificacoes')}
      onActionPress={onActionPress}
      actionIcon={actionIcon}
      actionLabel={actionLabel}
      accessLabel="Acesso demonstrativo"
    />
  );
}
