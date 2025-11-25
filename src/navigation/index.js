import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import ProdutoresScreen from '../screens/ProdutoresScreen';
import ProdutorScreen from '../screens/ProdutorScreen';
import CadernoCampoScreen from '../screens/CadernoCampoScreen';
import NovoProdutorScreen from '../screens/NovoProdutorScreen';
import { Ionicons } from '@expo/vector-icons';
import ReactNative from 'react-native';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let name = 'home';
          if (route.name === 'Produtores') name = 'people';
          if (route.name === 'Caderno') name = 'book';
          if (route.name === 'Perfil') name = 'person';
          return <Ionicons name={name} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#6B7280',
        headerStyle: { backgroundColor: '#fff' }
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Produtores" component={ProdutoresScreen} />
      <Tab.Screen name="Caderno" component={CadernoCampoScreen} />
      <Tab.Screen name="Perfil" component={ProdutorScreen} />
    </Tab.Navigator>
  );
}

export default function Navigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="ProdutorDetail" component={ProdutorScreen} />
      <Stack.Screen name="NovoProdutor" component={NovoProdutorScreen} />
    </Stack.Navigator>
  );
}
