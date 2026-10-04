import React from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider, useAuth } from './src/context/AuthContext';

import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';

import LoadingScreen from './src/components/LoadingScreen';

function AppContent() {
  const {
    user,
    profile,
    loading,
  } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthStackNavigator />;
  }

  if (!profile) {
    return <LoadingScreen />;
  }

  if (profile.role === 'system_admin') {
    return <AdminNavigator />;
  }

  return <MainNavigator />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </AuthProvider>
  );
}