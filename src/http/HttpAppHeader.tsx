import React from 'react';

import AppHeader from '../components/AppHeader';
import { useHttpNotifications } from './HttpNotificationContext';
import { useHttpSession } from './HttpSessionContext';

export function HttpTabHeader({
  title,
  navigation,
  showNotifications = true,
}: {
  readonly title: string;
  readonly navigation: any;
  readonly showNotifications?: boolean;
}) {
  const { snapshot } = useHttpSession();
  const { unreadCount } = useHttpNotifications();

  return (
    <AppHeader
      title={title}
      user={snapshot?.usuario}
      unreadCount={unreadCount}
      showNotifications={showNotifications}
      onNotificationsPress={() => navigation.navigate('Notifications')}
      accessLabel="Acesso conectado"
    />
  );
}

export function HttpDetailHeader({
  title,
  navigation,
}: {
  readonly title: string;
  readonly navigation: any;
}) {
  const { snapshot } = useHttpSession();

  return (
    <AppHeader
      title={title}
      user={snapshot?.usuario}
      showBack
      showNotifications={false}
      onBack={() => navigation.goBack()}
      accessLabel="Acesso conectado"
    />
  );
}
