import React from 'react';

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
    <Tab.Navigator>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
      />

      <Tab.Screen
        name="History"
        component={HistoryScreen}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
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