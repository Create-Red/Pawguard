
import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';

const Stack = createNativeStackNavigator();

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

      <Stack.Screen
        name="UserManagement"
        component={UserManagementScreen}
        options={{
          title: 'User Management',
        }}
      />
    </Stack.Navigator>
  );
}
