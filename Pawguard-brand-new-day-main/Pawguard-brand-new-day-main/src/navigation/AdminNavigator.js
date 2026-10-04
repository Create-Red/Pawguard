import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import AdminPanelScreen from '../screens/admin/AdminPanelScreen';

const Stack =
  createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AdminPanel"
        component={AdminPanelScreen}
        options={{
          title: 'PawGuard Admin',
        }}
      />
    </Stack.Navigator>
  );
}