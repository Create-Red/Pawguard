import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Icon from '../components/Icon';
import { colors, fonts } from '../Theme';

import EventOrganizerDashboardScreen from '../screens/event/EventOrganizerDashboardScreen';
import CreateEventScreen from '../screens/event/CreateEventScreen';
import ManageEventScreen from '../screens/event/ManageEvents';
import EventMembersScreen from '../screens/event/EventMembersScreen';
import EventMonitoringScreen from '../screens/event/EventMonitoringScreen';
import EventDetailsScreen from '../screens/event/EventDetailsScreen';
import ParticipantProfileScreen from '../screens/event/ParticipantProfileScreen';

// Same Settings screen the pet owners use.
// ⚠️ Change this path if your SettingsScreen.js is in a different folder
// (copy the import line from the pet owner's navigator).
import SettingsScreen from '../screens/main/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom tabs: Home (dashboard) + Settings
function OrganizerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: {
          fontFamily: fonts.medium,
          fontSize: 12,
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const name =
            route.name === 'Settings'
              ? focused ? 'settings' : 'settings-outline'
              : focused ? 'home' : 'home-outline';
          return <Icon name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="EventOrganizerDashboard"
        component={EventOrganizerDashboardScreen}
        options={{ title: 'Home' }}
      />

      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// The tabs sit at the bottom of the stack. Every other screen opens on top
// of them (full screen, with a back button), exactly like before.
export default function EventOrganizerNavigator() {
  return (
    <Stack.Navigator>
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