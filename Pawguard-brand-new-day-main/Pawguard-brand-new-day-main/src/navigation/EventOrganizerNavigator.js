import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import CustomTabBar from '../components/CustomTabBar';
import { stackScreenOptions, tabScreenOptions } from './navOptions';

import EventOrganizerDashboardScreen from '../screens/event/EventOrganizerDashboardScreen';
import CreateEventScreen from '../screens/event/CreateEventScreen';
import ManageEventScreen from '../screens/event/ManageEvents';
import EventMembersScreen from '../screens/event/EventMembersScreen';
import EventMonitoringScreen from '../screens/event/EventMonitoringScreen';
import EventDetailsScreen from '../screens/event/EventDetailsScreen';
import ParticipantProfileScreen from '../screens/event/ParticipantProfileScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Same floating tab bar as the pet owner side
function OrganizerTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={tabScreenOptions}
    >
      <Tab.Screen
        name="EventOrganizerDashboard"
        component={EventOrganizerDashboardScreen}
        options={{ title: 'Home', tabBarIconName: 'home' }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', tabBarIconName: 'settings' }}
      />
    </Tab.Navigator>
  );
}

// Tabs at the bottom of the stack; every other screen opens on top of them
// with the same flat white header as the pet owner side.
export default function EventOrganizerNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="OrganizerTabs"
        component={OrganizerTabs}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{ title: 'Create Event' }}
      />

      <Stack.Screen
        name="ManageEvent"
        component={ManageEventScreen}
        options={{ title: 'My Events' }}
      />

      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ title: 'Event Details' }}
      />

      <Stack.Screen
        name="EventMembers"
        component={EventMembersScreen}
        options={{ title: 'Participants' }}
      />

      <Stack.Screen
        name="ParticipantProfile"
        component={ParticipantProfileScreen}
        options={{ title: 'Participant Profile' }}
      />

      <Stack.Screen
        name="EventMonitoring"
        component={EventMonitoringScreen}
        options={{ title: 'Event Monitoring' }}
      />
    </Stack.Navigator>
  );
}