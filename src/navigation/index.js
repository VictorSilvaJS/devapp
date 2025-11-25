import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ProdutoresScreen from '../screens/ProdutoresScreen';
import ProdutorScreen from '../screens/ProdutorScreen';
import CadernoCampoScreen from '../screens/CadernoCampoScreen';
import NovoProdutorScreen from '../screens/NovoProdutorScreen';
import LoginScreen from '../screens/LoginScreen';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let name = 'home';
          if (route.name === 'Produtores') name = 'people';
          if (route.name === 'Visitas') name = 'calendar';
          if (route.name === 'Caderno') name = 'book';
          if (route.name === 'Perfil') name = 'person';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280'
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Produtores" component={ProdutoresScreen} />
      <Tab.Screen name="Visitas" component={CadernoCampoScreen} />
      <Tab.Screen name="Caderno" component={CadernoCampoScreen} />
      <Tab.Screen name="Perfil" component={ProdutorScreen} />
    </Tab.Navigator>
  );
}

function ColaboradorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let name = 'home';
          if (route.name === 'Meus Produtores') name = 'people';
          if (route.name === 'Minhas Visitas') name = 'calendar';
          if (route.name === 'Caderno') name = 'book';
          if (route.name === 'Perfil') name = 'person';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280'
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Meus Produtores" component={ProdutoresScreen} />
      <Tab.Screen name="Minhas Visitas" component={CadernoCampoScreen} />
      <Tab.Screen name="Caderno" component={CadernoCampoScreen} />
      <Tab.Screen name="Perfil" component={ProdutorScreen} />
    </Tab.Navigator>
  );
}

function ClienteTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let name = 'home';
          if (route.name === 'Histórico') name = 'calendar';
          if (route.name === 'Perfil') name = 'person';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280'
      })}
    >
      <Tab.Screen name="Minha Propriedade" component={DashboardScreen} />
      <Tab.Screen name="Histórico" component={CadernoCampoScreen} />
      <Tab.Screen name="Perfil" component={ProdutorScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  const { user } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        // rota pública: Login
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        // after login, show tabs according to perfil
        <>
          <Stack.Screen name="Main" component={
            user.perfil === 'admin' ? AdminTabs : (user.perfil === 'colaborador' ? ColaboradorTabs : ClienteTabs)
          } />
          <Stack.Screen name="ProdutorDetail" component={ProdutorScreen} />
          <Stack.Screen name="NovoProdutor" component={NovoProdutorScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
