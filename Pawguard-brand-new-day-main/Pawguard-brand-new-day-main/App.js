import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import {
  useFonts,
  Urbanist_400Regular,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
} from '@expo-google-fonts/urbanist';

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
  // Hooks must live inside the component, not at the bottom of the file
  const [fontsLoaded] = useFonts({
    Urbanist_400Regular,
    Urbanist_500Medium,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
  });

  // Wait for the font so text doesn't flash in the wrong typeface
  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </AuthProvider>
  );
}