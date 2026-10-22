

import React from 'react';

import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';

export default function EventOrganizerDashboardScreen({ navigation }) {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>PAWGUARD</Text>

        <Text style={styles.title}>
          Organizer Dashboard
        </Text>

        <Text style={styles.subtitle}>
          Welcome, {profile?.name || 'Event Organizer'}!
        </Text>

        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            Manage your dog events
          </Text>

          <Text style={styles.description}>
            Create events, review participating dogs, and monitor
            registered participants from one place.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>
          Event Management
        </Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('CreateEvent')}
        >
          <Text style={styles.actionTitle}>＋ Create Event</Text>
          <Text style={styles.actionDescription}>
            Set up a new event with its schedule and venue.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('ManageEvent')}
        >
          <Text style={styles.actionTitle}>My Events</Text>
          <Text style={styles.actionDescription}>
            View and manage events you organize.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('EventMembers')}
        >
          <Text style={styles.actionTitle}>Participating Dogs</Text>
          <Text style={styles.actionDescription}>
            Review participation requests and approved dogs.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  content: {
    padding: 22,
    paddingBottom: 40,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#64748B',
    marginBottom: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#17202A',
  },

  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 8,
    marginBottom: 22,
  },

  welcomeCard: {
    backgroundColor: '#222222',
    borderRadius: 18,
    padding: 22,
    marginBottom: 28,
  },

  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 10,
  },

  description: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 22,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#17202A',
    marginBottom: 14,
  },

  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  actionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17202A',
    marginBottom: 7,
  },

  actionDescription: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },

  signOutButton: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 18,
  },

  signOutText: {
    color: '#991B1B',
    fontWeight: '800',
  },
});
