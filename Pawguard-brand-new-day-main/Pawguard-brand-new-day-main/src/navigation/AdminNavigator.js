
import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import AdminPanelScreen from '../screens/admin/AdminPanelScreen';
import UserManagementScreen from '../screens/admin/UserManagementScreen';
import SystemLogsScreen from '../screens/admin/SystemLogsScreen';
import AlertConfigurationScreen from '../screens/admin/AlertConfigurationScreen';
import DeviceMonitoringScreen from '../screens/admin/DeviceMonitoring';

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

      <Stack.Screen
        name="SystemLogs"
        component={SystemLogsScreen}
        options={{
          title: 'System Logs',
        }}
      />

      <Stack.Screen
        name="AlertConfiguration"
        component={AlertConfigurationScreen}
        options={{
          title: 'Alert Configuration',
        }}
      />

      <Stack.Screen
        name="DeviceMonitoring"
        component={DeviceMonitoringScreen}
        options={{
          title: 'Device Monitoring',
        }}
      />
    </Stack.Navigator>
  );
}
