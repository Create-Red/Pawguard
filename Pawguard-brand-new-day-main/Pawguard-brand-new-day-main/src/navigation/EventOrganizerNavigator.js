
import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EventOrganizerDashboardScreen from '../screens/event/EventOrganizerDashboardScreen';
import CreateEventScreen from '../screens/event/CreateEventScreen';

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
    </Stack.Navigator>
  );
}
