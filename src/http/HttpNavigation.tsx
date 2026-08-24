import React from 'react';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAccountAction } from './AccountActionContext';
import { actionNavigationTarget } from './actionNavigation';
import { parseAccountActionLink } from './actionLinks';
import { useHttpSession } from './HttpSessionContext';
import {
  HttpNotificationProvider,
  useHttpNotifications,
} from './HttpNotificationContext';
import {
  HttpBootScreen,
  HttpLockedScreen,
  HttpLoginScreen,
  HttpUnavailableScreen,
} from './screens/HttpAuthScreens';
import {
  HttpAccountScreen,
  HttpChangePasswordScreen,
  HttpPrimaryEmailChangeScreen,
  HttpSecondaryEmailScreen,
  HttpSessionsScreen,
} from './screens/HttpAccountScreens';
import {
  HttpAcceptInvitationScreen,
  HttpAdminRecoveryNewPrimaryScreen,
  HttpAssistedRecoveryScreen,
  HttpCompletePasswordRecoveryScreen,
  HttpRequestAdminSecondaryRecoveryScreen,
  HttpRequestPasswordRecoveryScreen,
  HttpSimpleConfirmationScreen,
} from './screens/HttpActionScreens';
import {
  HttpPropertiesScreen,
  HttpPropertyDetailScreen,
} from './screens/HttpPropertyScreens';
import { HttpNotificationScreen } from './screens/HttpNotificationScreen';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef<any>();

function HttpTabsNavigator() {
  const { unreadCount } = useHttpNotifications();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 2,
          borderTopColor: colors.border,
          paddingBottom: 4,
          paddingTop: 8,
          height: 65,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={
              route.name === 'Properties'
                ? 'business-outline'
                : route.name === 'Notifications'
                  ? 'notifications-outline'
                  : 'person-outline'
            }
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen
        name="Properties"
        component={HttpPropertiesScreen}
        options={{ title: 'Propriedades' }}
      />
      <Tabs.Screen
        name="Notifications"
        component={HttpNotificationScreen}
        options={{
          title: 'Notificações',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tabs.Screen
        name="Account"
        component={HttpAccountScreen}
        options={{ title: 'Perfil' }}
      />
    </Tabs.Navigator>
  );
}

function HttpTabs() {
  return (
    <HttpNotificationProvider>
      <HttpTabsNavigator />
    </HttpNotificationProvider>
  );
}

function ConfirmCurrentPrimaryEmail() {
  return <HttpSimpleConfirmationScreen kind="current-primary" />;
}

function ConfirmNewPrimaryEmail() {
  return <HttpSimpleConfirmationScreen kind="new-primary" />;
}

function ConfirmSecondaryEmail() {
  return <HttpSimpleConfirmationScreen kind="secondary-email" />;
}

function ConfirmAdminSecondaryRecovery() {
  return <HttpSimpleConfirmationScreen kind="admin-secondary" />;
}

export function HttpNavigation() {
  const { status, snapshot, sessionEpoch, runtime } = useHttpSession();
  const accountAction = useAccountAction();
  const setPendingAction = accountAction.setPending;
  const queuedTarget = React.useRef<string | null>(null);
  const statusRef = React.useRef(status);
  const liveLinkGeneration = React.useRef(0);

  React.useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handleUrl = React.useCallback((rawUrl: string) => {
    const parsed = parseAccountActionLink(rawUrl, runtime.config.actionBaseUrl);
    if (parsed === null) return;
    const target = actionNavigationTarget(parsed);
    setPendingAction(parsed);
    if (
      navigationRef.isReady() &&
      (statusRef.current === 'anonymous' ||
        statusRef.current === 'authenticated')
    ) {
      navigationRef.navigate(target.name);
    } else {
      queuedTarget.current = target.name;
    }
  }, [runtime, setPendingAction]);

  React.useEffect(() => {
    let mounted = true;
    const initialGeneration = liveLinkGeneration.current;
    void Linking.getInitialURL().then((url) => {
      if (
        mounted &&
        liveLinkGeneration.current === initialGeneration &&
        url
      ) {
        handleUrl(url);
      }
    }).catch(() => {
      // A failure to read the initial URL cannot widen navigation.
    });
    const subscription = Linking.addEventListener('url', ({ url }) => {
      liveLinkGeneration.current += 1;
      handleUrl(url);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleUrl]);

  const identityKey = snapshot === null
    ? `none:${status}`
    : [
        snapshot.usuario.organizacao_id,
        snapshot.usuario.id,
        snapshot.usuario.perfil,
        snapshot.usuario.versao_autorizacao,
        snapshot.escopo.versao,
        sessionEpoch,
        status,
      ].join(':');

  React.useEffect(() => {
    if (
      queuedTarget.current !== null &&
      navigationRef.isReady() &&
      (status === 'anonymous' || status === 'authenticated')
    ) {
      const target = queuedTarget.current;
      queuedTarget.current = null;
      navigationRef.navigate(target);
    }
  }, [status]);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (
          queuedTarget.current &&
          (statusRef.current === 'anonymous' ||
            statusRef.current === 'authenticated')
        ) {
          const target = queuedTarget.current;
          queuedTarget.current = null;
          navigationRef.navigate(target);
        }
      }}
    >
      <Stack.Navigator>
        {status === 'booting' ? (
          <Stack.Screen name="Boot" component={HttpBootScreen} options={{ headerShown: false }} />
        ) : status === 'locked' ? (
          <Stack.Screen name="Locked" component={HttpLockedScreen} options={{ headerShown: false }} />
        ) : status === 'unavailable' ? (
          <Stack.Screen name="Unavailable" component={HttpUnavailableScreen} options={{ headerShown: false }} />
        ) : status === 'authenticated' && snapshot !== null ? (
          <Stack.Group navigationKey={identityKey}>
            <Stack.Screen name="Main" component={HttpTabs} options={{ headerShown: false }} />
            <Stack.Screen name="PropertyDetail" component={HttpPropertyDetailScreen} options={{ headerShown: false }} />
            <Stack.Screen name="ChangePassword" component={HttpChangePasswordScreen} options={{ title: 'Trocar senha' }} />
            <Stack.Screen name="RequestPrimaryEmailChange" component={HttpPrimaryEmailChangeScreen} options={{ title: 'Trocar e-mail' }} />
            <Stack.Screen name="RequestSecondaryEmail" component={HttpSecondaryEmailScreen} options={{ title: 'Segundo e-mail' }} />
            <Stack.Screen name="Sessions" component={HttpSessionsScreen} options={{ title: 'Sessões' }} />
          </Stack.Group>
        ) : (
          <>
            <Stack.Screen name="Login" component={HttpLoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="RequestPasswordRecovery" component={HttpRequestPasswordRecoveryScreen} options={{ title: 'Recuperar senha' }} />
            <Stack.Screen name="RequestAdminSecondaryRecovery" component={HttpRequestAdminSecondaryRecoveryScreen} options={{ title: 'Recuperação Admin' }} />
          </>
        )}

        <Stack.Screen name="AcceptInvitation" component={HttpAcceptInvitationScreen} options={{ title: 'Aceitar convite' }} />
        <Stack.Screen name="CompletePasswordRecovery" component={HttpCompletePasswordRecoveryScreen} options={{ title: 'Nova senha' }} />
        <Stack.Screen name="ConfirmCurrentPrimaryEmail" component={ConfirmCurrentPrimaryEmail} options={{ title: 'Confirmar e-mail' }} />
        <Stack.Screen name="ConfirmNewPrimaryEmail" component={ConfirmNewPrimaryEmail} options={{ title: 'Confirmar e-mail' }} />
        <Stack.Screen name="ConfirmSecondaryEmail" component={ConfirmSecondaryEmail} options={{ title: 'Segundo e-mail' }} />
        <Stack.Screen name="ConfirmAdminSecondaryRecovery" component={ConfirmAdminSecondaryRecovery} options={{ title: 'Recuperação Admin' }} />
        <Stack.Screen name="ConfirmAdminRecoveryNewPrimary" component={HttpAdminRecoveryNewPrimaryScreen} options={{ title: 'Recuperação Admin' }} />
        <Stack.Screen name="ConfirmAssistedRecovery" component={HttpAssistedRecoveryScreen} options={{ title: 'Recuperação assistida' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
