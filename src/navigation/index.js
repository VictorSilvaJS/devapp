import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ProdutoresScreen from '../screens/ProdutoresScreen';
import ProdutorScreen from '../screens/ProdutorScreen';
import MapasScreen from '../screens/MapasScreen';
import CadernoCampoScreen from '../screens/CadernoCampoScreen';
import VisitasScreen from '../screens/VisitasScreen';
import NovoProdutorScreen from '../screens/NovoProdutorScreen';
import EditarProdutorScreen from '../screens/EditarProdutorScreen';
import LoginScreen from '../screens/LoginScreen';
import PerfilScreen from '../screens/PerfilScreen';
import LoadingScreen from '../components/LoadingScreen';
import { Ionicons } from '@expo/vector-icons';
import { useAuthState } from '../auth/AuthContext';
import { colors } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// opções de tab estáveis para evitar recriação em cada render
function tabScreenOptions({ route }) {
  return {
    headerShown: false,
    tabBarIcon: ({ color, size }) => {
      let name = 'home-outline';
      if (route.name === 'Produtores' || route.name === 'Meus Produtores') name = 'people-outline';
      if (route.name === 'Visitas' || route.name === 'Histórico' || route.name === 'Minhas Visitas') name = 'calendar-outline';
      if (route.name === 'Caderno') name = 'book-outline';
      if (route.name === 'Perfil') name = 'person-outline';
      return <Ionicons name={name} size={size} color={color} />;
    },
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
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 8
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
      marginBottom: 4
    }
  };
}
const AdminTabs = React.memo(function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Produtores" component={ProdutoresScreen} options={{ title: 'Produtores' }} />
      <Tab.Screen name="Visitas" component={VisitasScreen} options={{ title: 'Visitas' }} />
      <Tab.Screen name="Caderno" component={CadernoCampoScreen} options={{ title: 'Caderno' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
});

const ColaboradorTabs = React.memo(function ColaboradorTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Meus Produtores" component={ProdutoresScreen} options={{ title: 'Produtores' }} />
      <Tab.Screen name="Minhas Visitas" component={VisitasScreen} options={{ title: 'Visitas' }} />
      <Tab.Screen name="Caderno" component={CadernoCampoScreen} options={{ title: 'Caderno' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
});

const ClienteTabs = React.memo(function ClienteTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Minha Propriedade" component={require('../screens/ClienteDashboardScreen').default} options={{ title: 'Propriedade' }} />
      <Tab.Screen name="Histórico" component={CadernoCampoScreen} options={{ title: 'Histórico' }} />
      <Tab.Screen name="Perfil" component={PerfilScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
});

function MainTabsComponent() {
  const { user } = useAuthState();
  const perfil = user?.perfil;
  console.log('[Navigation] MainTabsComponent render perfil=', perfil);
  if (perfil === 'admin') return <AdminTabs />;
  if (perfil === 'colaborador') return <ColaboradorTabs />;
  return <ClienteTabs />;
}

const MemoMainTabs = React.memo(MainTabsComponent);

export default function Navigation() {
  const { user, isReady } = useAuthState();

  if (!isReady) {
    // ainda carregando usuário salvo — renderiza splash/loading simples para evitar remounts
    return <LoadingScreen message="Inicializando..." />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      {!user ? (
        // rota pública: Login
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // after login, show tabs according to perfil
        <>
          <Stack.Screen name="Main" component={MemoMainTabs} />
          <Stack.Screen name="ProdutorDetail" component={ProdutorScreen} />
          <Stack.Screen name="Mapas" component={MapasScreen} />
          <Stack.Screen name="NovoProdutor" component={NovoProdutorScreen} />
          <Stack.Screen name="EditarProdutor" component={EditarProdutorScreen} />
          <Stack.Screen name="EditProfile" component={require('../screens/EditProfileScreen').default} />
        </>
      )}
    </Stack.Navigator>
  );
}
