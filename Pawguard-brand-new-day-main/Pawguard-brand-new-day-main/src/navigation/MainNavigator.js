import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import CustomTabBar from '../components/CustomTabBar';
import PrivacyConsentGate from '../components/PrivacyConsentGate';
import PrivacyPolicyScreen from '../screens/main/PrivacyPolicyScreen';
import { stackScreenOptions, tabScreenOptions } from './navOptions';
import { useAuth } from '../context/AuthContext';
import useUnreadCount from '../utils/useUnreadCount';

import DashboardScreen from '../screens/main/DashboardScreen';
import HistoryScreen from '../screens/main/HistoryScreen';
import NotificationsScreen from '../screens/main/NotificationsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import RegisterPetScreen from '../screens/onboarding/RegisterPetScreen';
import EditPetScreen from '../screens/onboarding/EditPetScreen';
import DogProfileScreen from '../screens/main/DogProfileScreen';
import PairDeviceScreen from '../screens/onboarding/PairDeviceScreen';
import MapScreen from '../screens/main/MapScreen';
import EventsScreen from '../screens/event/EventsScreen';
import TransferDeviceScreen from '../screens/onboarding/TransferDeviceScreen';
import PublicEventDetailsScreen from '../screens/event/PublicEventDetailsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const { profile } = useAuth();
  const unread = useUnreadCount(profile?.id);

  return (
    <Tab.Navigator
      // Floating glass tab bar (shared with the organizer side)
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={tabScreenOptions}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Home', tabBarIconName: 'home' }}
      />

      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ title: 'History', tabBarIconName: 'analytics' }}
      />

      <Tab.Screen
        name="Events"
        component={EventsScreen}
        options={{ title: 'Events', tabBarIconName: 'calendar' }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          tabBarIconName: 'notifications',
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIconName: 'settings' }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <>
    {/* Asks for privacy consent once (and again if the notice changes) */}
    <PrivacyConsentGate />
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="RegisterPet"
        component={RegisterPetScreen}
        options={{ title: 'Register Pet' }}
      />

      <Stack.Screen
        name="EditPet"
        component={EditPetScreen}
        options={{ title: 'Edit Pet' }}
      />

      <Stack.Screen
        name="DogProfile"
        component={DogProfileScreen}
        options={{ title: 'Pet Profile' }}
      />

      {/* Opened from Home ("View location") and the pet profile */}
      <Stack.Screen
        name="Map"
        component={MapScreen}
        options={{ title: 'Location' }}
      />

      <Stack.Screen
        name="PairDevice"
        component={PairDeviceScreen}
        options={{ title: 'Pair Device' }}
      />

      <Stack.Screen
        name="TransferDevice"
        component={TransferDeviceScreen}
        options={{ title: 'Transfer Device' }}
      />

      <Stack.Screen
        name="PublicEventDetails"
        component={PublicEventDetailsScreen}
        options={{ title: 'Event Details' }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: 'Privacy' }}
      />
    </Stack.Navigator>
    </>
  );
}