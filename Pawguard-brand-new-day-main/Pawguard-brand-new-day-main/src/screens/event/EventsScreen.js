
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

export default function EventsScreen({ navigation }) {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState(null);

  const loadEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, organizer_id, name, description, venue, starts_at, ends_at, status'
        )
        .eq('status', 'open')
        .order('starts_at', { ascending: true });

      if (error) throw error;

      setEvents(data || []);
    } catch (error) {
      console.error('Load events error:', error);
      Alert.alert('Unable to load events', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

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

      // Load only dogs owned by the signed-in user.
      const { data: dogs, error: dogsError } = await supabase
        .from('dogs')
        .select('id, name')
        .eq('owner_id', user.id);

      if (dogsError) throw dogsError;

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
      Alert.alert('Error', error.message || 'Unable to select a dog.');
    } finally {
      setJoiningId(null);
    }
  };

  const submitRequest = async (event, dog) => {
    try {
      setJoiningId(event.id);

      // Prevent duplicate requests for the same dog and event.
      const { data: existing, error: existingError } = await supabase
        .from('event_members')
        .select('id, status')
        .eq('event_id', event.id)
        .eq('dog_id', dog.id)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        Alert.alert(
          'Already registered',
          `This dog's request is already ${existing.status}.`
        );
        return;
      }

      const { error } = await supabase
        .from('event_members')
        .insert({
          event_id: event.id,
          owner_id: user.id,
          dog_id: dog.id,
          status: 'pending',
        });

      if (error) throw error;

      Alert.alert(
        'Request submitted',
        `${dog.name}'s request to join ${event.name} is pending organizer approval.`
      );
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

  const renderEvent = ({ item }) => {
    const isPast = new Date(item.ends_at).getTime() < Date.now();
    const isJoining = joiningId === item.id;

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
        Find an event and register your dog.
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
