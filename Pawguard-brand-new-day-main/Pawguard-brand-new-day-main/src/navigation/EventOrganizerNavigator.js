
import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EventOrganizerDashboardScreen from '../screens/event/EventOrganizerDashboardScreen';
import CreateEventScreen from '../screens/event/CreateEventScreen';
import ManageEventScreen from '../screens/event/ManageEventScreen';
import EventMembersScreen from '../screens/event/EventMembersScreen';
import EventMonitoringScreen from '../screens/event/EventMonitoringScreen';

const Stack = createNativeStackNavigator();

export default function EventOrganizerNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="EventOrganizerDashboard"
        component={EventOrganizerDashboardScreen}
        options={{
          title: 'PawGuard Organizer',
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="CreateEvent"
        component={CreateEventScreen}
        options={{
          title: 'Create Event',
        }}
      />

      <Stack.Screen
        name="ManageEvent"
        component={ManageEventScreen}
        options={{
          title: 'Manage Event',
        }}
      />
      <Stack.Screen
        name="EventMembers"
        component={EventMembersScreen}
        options={{
          title: 'Event Members',
        }}
      />
      <Stack.Screen
        name="EventMonitoring"
        component={EventMonitoringScreen}
        options={{
          title: 'Event Monitoring',
        }}
      />
    </Stack.Navigator>
  );
}
