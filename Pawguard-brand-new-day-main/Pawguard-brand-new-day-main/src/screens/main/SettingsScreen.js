import React from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';

export default function SettingsScreen() {
  const {
    profile,
    signOut,
  } = useAuth();

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Settings
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>
          Name
        </Text>

        <Text style={styles.value}>
          {profile?.name}
        </Text>

        <Text style={styles.label}>
          Role
        </Text>

        <Text style={styles.value}>
          {profile?.role}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.logout}
        onPress={handleSignOut}
      >
        <Text style={styles.logoutText}>
          Sign Out
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },

  label: {
    color: '#777',
    fontSize: 13,
    marginTop: 10,
  },

  value: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 4,
  },

  logout: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    alignItems: 'center',
  },

  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});