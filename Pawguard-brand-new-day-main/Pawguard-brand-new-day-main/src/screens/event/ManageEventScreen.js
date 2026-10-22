
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

export default function ManageEventsScreen({ navigation }) {
  const { user, profile } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!user?.id) {
      setEvents([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, name, description, venue, starts_at, ends_at, status, created_at'
        )
        .eq('organizer_id', user.id)
        .order('starts_at', { ascending: true });

      if (error) {
        console.error('LOAD EVENTS ERROR:', error);
        Alert.alert('Could Not Load Events', error.message);
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('LOAD EVENTS ERROR:', error);
      Alert.alert('Error', 'Unable to load your events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  function formatDate(value) {
    if (!value) return 'Not specified';

    return new Date(value).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function getStatusStyle(status) {
    switch (status) {
      case 'open':
        return styles.statusOpen;
      case 'ongoing':
        return styles.statusOngoing;
      case 'completed':
        return styles.statusCompleted;
      case 'cancelled':
        return styles.statusCancelled;
      default:
        return styles.statusDraft;
    }
  }

  async function changeStatus(event, newStatus) {
    if (profile?.role !== 'event_organizer' &&
        profile?.role !== 'system_admin') {
      Alert.alert('Access Denied', 'You cannot manage these events.');
      return;
    }

    Alert.alert(
      'Update Event Status',
      `Change "${event.name}" to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            const { data, error } = await supabase
              .from('events')
              .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
              })
              .eq('id', event.id)
              .eq('organizer_id', user.id)
              .select('id');

            if (error) {
              Alert.alert('Update Failed', error.message);
              return;
            }

            if (!data || data.length === 0) {
              Alert.alert(
                'Not Updated',
                'The event was not updated. Check your permissions.'
              );
              return;
            }

            await loadEvents();
          },
        },
      ]
    );
  }

  function renderEvent({ item }) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.venue}>{item.venue}</Text>
          </View>

          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>
              {item.status?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>

        {item.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>
        ) : null}

        <Text style={styles.dateLabel}>Starts</Text>
        <Text style={styles.dateValue}>
          {formatDate(item.starts_at)}
        </Text>

        <Text style={styles.dateLabel}>Ends</Text>
        <Text style={styles.dateValue}>
          {formatDate(item.ends_at)}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() =>
              navigation.navigate('EventMembers', {
                eventId: item.id,
                eventName: item.name,
              })
            }
          >
            <Text style={styles.primaryActionText}>
              Manage Participants
            </Text>
          </TouchableOpacity>

          {item.status === 'open' && (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={() => changeStatus(item, 'cancelled')}
            >
              <Text style={styles.secondaryActionText}>
                Cancel Event
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#222" />
        <Text style={styles.loadingText}>Loading your events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>My Events</Text>
        <Text style={styles.subtitle}>
          View and manage the events you organize.
        </Text>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        contentContainerStyle={
          events.length === 0 ? styles.emptyList : styles.list
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
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Create your first event to see it listed here.
            </Text>

            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => navigation.navigate('CreateEvent')}
            >
              <Text style={styles.primaryActionText}>
                Create Event
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  heading: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#17202A',
  },

  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
  },

  list: {
    padding: 16,
    paddingBottom: 32,
  },

  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },

  eventInfo: {
    flex: 1,
  },

  eventName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17202A',
  },

  venue: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 5,
  },

  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusOpen: {
    backgroundColor: '#DCFCE7',
  },

  statusOngoing: {
    backgroundColor: '#DBEAFE',
  },

  statusCompleted: {
    backgroundColor: '#E5E7EB',
  },

  statusCancelled: {
    backgroundColor: '#FEE2E2',
  },

  statusDraft: {
    backgroundColor: '#FEF3C7',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#222',
  },

  description: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
    marginBottom: 14,
  },

  dateLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },

  dateValue: {
    fontSize: 14,
    color: '#17202A',
    marginTop: 3,
  },

  actions: {
    marginTop: 18,
    gap: 10,
  },

  primaryAction: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },

  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
  },

  secondaryAction: {
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },

  secondaryActionText: {
    color: '#B91C1C',
    fontWeight: '700',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },

  loadingText: {
    marginTop: 12,
    color: '#64748B',
  },

  empty: {
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#17202A',
    marginBottom: 8,
  },

  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
});
