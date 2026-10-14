import React from 'react';

import { Ionicons } from '@expo/vector-icons';
import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';
import {
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';

import DashboardScreen from '../screens/main/DashboardScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import RegisterPetScreen from '../screens/onboarding/RegisterPetScreen';
import EditPetScreen from '../screens/onboarding/EditPetScreen';
import DogProfileScreen from '../screens/main/DogProfileScreen';
import PairDeviceScreen from '../screens/onboarding/PairDeviceScreen';
import MapScreen from '../screens/main/MapScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,

        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#94A3B8',

        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8EDF4',
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 8,
          elevation: 8,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },

        tabBarIcon: ({ color, size, focused }) => {
          let iconName;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;

            case 'History':
              iconName = focused ? 'analytics' : 'analytics-outline';
              break;

            case 'Notifications':
              iconName = focused
                ? 'notifications'
                : 'notifications-outline';
              break;

            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;

            case 'Map':
              iconName = focused ? 'map' : 'map-outline';
              break;

            default:
              iconName = 'ellipse-outline';
          }

          return (
            <Ionicons
              name={iconName}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home' }}
      />

      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'History' }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Alerts' }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />

      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Map' }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="RegisterPet"
        component={RegisterPetScreen}
        options={{
          title: 'Register Pet',
        }}
      />

      <Stack.Screen
        name="EditPet"
        component={EditPetScreen}
        options={{
          title: 'Edit Pet',
        }}
      />

      <Stack.Screen
        name="DogProfile"
        component={DogProfileScreen}
        options={{
          title: 'Pet Profile',
        }}
      />

      <Stack.Screen
        name="PairDevice"
        component={PairDeviceScreen}
        options={{
          title: 'Pair Device',
        }}
      />
    </Stack.Navigator>
  );
}
