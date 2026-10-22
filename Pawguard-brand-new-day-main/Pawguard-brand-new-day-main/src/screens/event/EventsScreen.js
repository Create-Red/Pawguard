
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

export default function EventsScreen() {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const loadEvents = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setRegistrations([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [eventsResult, registrationsResult] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, organizer_id, name, description, venue, starts_at, ends_at, status'
          )
          .eq('status', 'open')
          .order('starts_at', { ascending: true }),

        supabase
          .from('event_members')
          .select(`
            id,
            event_id,
            dog_id,
            owner_id,
            status,
            joined_at,
            dogs!event_members_dog_id_fkey (
              id,
              name
            )
          `)
          .eq('owner_id', user.id)
          .order('joined_at', { ascending: false }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (registrationsResult.error) throw registrationsResult.error;

      setEvents(eventsResult.data || []);
      setRegistrations(registrationsResult.data || []);
    } catch (error) {
      console.error('Load events and registrations error:', error);
      Alert.alert(
        'Unable to load events',
        error.message || 'Please refresh and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const joinEvent = async (event) => {
    if (!user) {
      Alert.alert('Login required', 'Please log in to join an event.');
      return;
    }

    try {
      setJoiningId(event.id);

      const { data: dogs, error } = await supabase
        .from('dogs')
        .select('id, name')
        .eq('owner_id', user.id);

      if (error) throw error;

      if (!dogs || dogs.length === 0) {
        Alert.alert(
          'No registered dogs',
          'Register a dog in PawGuard before joining an event.'
        );
        return;
      }

      Alert.alert(
        'Select a dog',
        `Choose which dog to register for ${event.name}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          ...dogs.map((dog) => ({
            text: dog.name,
            onPress: () => submitRequest(event, dog),
          })),
        ]
      );
    } catch (error) {
      console.error('Prepare event registration error:', error);
      Alert.alert(
        'Error',
        error.message || 'Unable to select a dog.'
      );
    } finally {
      setJoiningId(null);
    }
  };

  const submitRequest = async (event, dog) => {
    try {
      setJoiningId(event.id);

      const existing = registrations.find(
        (registration) =>
          registration.event_id === event.id &&
          registration.dog_id === dog.id
      );

      if (existing) {
        Alert.alert(
          'Already registered',
          `${dog.name} already has a ${existing.status} registration for this event.`
        );
        return;
      }

      // Also check the database in case another screen created a request.
      const { data: existingRequest, error: checkError } = await supabase
        .from('event_members')
        .select('id, status')
        .eq('event_id', event.id)
        .eq('dog_id', dog.id)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRequest) {
        Alert.alert(
          'Already registered',
          `${dog.name}'s request is ${existingRequest.status}.`
        );
        await loadEvents();
        return;
      }

      const { error: insertError } = await supabase
        .from('event_members')
        .insert({
          event_id: event.id,
          owner_id: user.id,
          dog_id: dog.id,
          status: 'pending',
        });

      if (insertError) throw insertError;

      Alert.alert(
        'Request submitted',
        `${dog.name}'s request to join ${event.name} is pending organizer approval.`
      );

      await loadEvents();
    } catch (error) {
      console.error('Join event error:', error);
      Alert.alert(
        'Registration failed',
        error.message || 'Please try again.'
      );
    } finally {
      setJoiningId(null);
    }
  };

  const getEventRegistrations = (eventId) =>
    registrations.filter((registration) => registration.event_id === eventId);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'approved':
        return styles.approvedBadge;
      case 'rejected':
        return styles.rejectedBadge;
      case 'withdrawn':
        return styles.withdrawnBadge;
      default:
        return styles.pendingBadge;
    }
  };

  const renderEvent = ({ item }) => {
    const isPast = new Date(item.ends_at).getTime() < Date.now();
    const isJoining = joiningId === item.id;
    const eventRegistrations = getEventRegistrations(item.id);

    return (
      <View style={styles.card}>
        <Text style={styles.eventName}>{item.name}</Text>
        <Text style={styles.venue}>📍 {item.venue}</Text>

        <Text style={styles.date}>
          Starts: {new Date(item.starts_at).toLocaleString()}
        </Text>
        <Text style={styles.date}>
          Ends: {new Date(item.ends_at).toLocaleString()}
        </Text>

        {item.description ? (
          <Text style={styles.description}>{item.description}</Text>
        ) : null}

        {eventRegistrations.length > 0 && (
          <View style={styles.registrationSection}>
            <Text style={styles.registrationHeading}>
              Your registrations
            </Text>

            {eventRegistrations.map((registration) => (
              <View
                key={registration.id}
                style={styles.registrationRow}
              >
                <View style={styles.registrationInfo}>
                  <Text style={styles.dogName}>
                    {registration.dogs?.name || 'Registered dog'}
                  </Text>
                  <Text style={styles.statusLabel}>
                    Registration status
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    getStatusStyle(registration.status),
                  ]}
                >
                  <Text style={styles.statusText}>
                    {(registration.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {isPast ? (
          <Text style={styles.closedText}>This event has ended.</Text>
        ) : (
          <TouchableOpacity
            style={styles.joinButton}
            disabled={!!joiningId}
            onPress={() => joinEvent(item)}
          >
            {isJoining ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.joinButtonText}>Register a Dog</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#237A57" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upcoming Events</Text>
      <Text style={styles.subtitle}>
        Browse events and track your dog's registration status.
      </Text>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={
          events.length === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadEvents();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No open events are available right now. Check again later.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7F6',
  },
  loadingText: {
    marginTop: 10,
    color: '#555555',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#183D2B',
  },
  subtitle: {
    color: '#666666',
    marginTop: 5,
    marginBottom: 18,
  },
  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#666666',
    textAlign: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8E4',
  },
  eventName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#183D2B',
    marginBottom: 8,
  },
  venue: {
    color: '#333333',
    marginBottom: 8,
  },
  date: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  description: {
    color: '#444444',
    marginTop: 12,
    lineHeight: 20,
  },
  registrationSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8E4',
  },
  registrationHeading: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#183D2B',
    marginBottom: 10,
  },
  registrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F0',
  },
  registrationInfo: {
    flex: 1,
  },
  dogName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#263D31',
  },
  statusLabel: {
    color: '#777777',
    fontSize: 12,
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  pendingBadge: {
    backgroundColor: '#FFF0C2',
  },
  approvedBadge: {
    backgroundColor: '#D9F3E3',
  },
  rejectedBadge: {
    backgroundColor: '#FCE0E0',
  },
  withdrawnBadge: {
    backgroundColor: '#E8E8E8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
  },
  joinButton: {
    backgroundColor: '#237A57',
    padding: 13,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  closedText: {
    color: '#777777',
    marginTop: 14,
  },
});
