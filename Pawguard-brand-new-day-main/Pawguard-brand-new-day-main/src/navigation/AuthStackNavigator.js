import React from 'react';

import {
  createNativeStackNavigator,
} from '@react-navigation/native-stack';

import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

const Stack =
  createNativeStackNavigator();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="SignUp"
        component={SignUpScreen}
        options={{
          title: 'Create Account',
        }}
      />
    </Stack.Navigator>
  );
}