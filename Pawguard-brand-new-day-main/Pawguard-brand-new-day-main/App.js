
import React from 'react';

import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider, useAuth } from './src/context/AuthContext';

import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import AdminNavigator from './src/navigation/AdminNavigator';
import EventOrganizerNavigator from './src/navigation/EventOrganizerNavigator';

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

  // System administrator
  if (profile.role === 'system_admin') {
    return <AdminNavigator />;
  }

  // Event organizer
  if (profile.role === 'event_organizer') {
    return <EventOrganizerNavigator />;
  }

  // Pet owners and other supported non-admin roles
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
