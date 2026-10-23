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
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Registration status -> card colour. Priority decides which one the card shows.
const STATUS_ORDER = ['approved', 'pending', 'rejected', 'withdrawn'];
const STATUS_TONE = {
  approved: 'green',
  pending: 'amber',
  rejected: 'salmon',
  withdrawn: 'beige',
};

const FILTERS = [
  { key: 'all', label: 'all' },
  { key: 'pending', label: 'pending' },
  { key: 'approved', label: 'approved' },
];

const formatLongDate = (value) =>
  new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const formatShortDateTime = (value) =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function EventsScreen() {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [filter, setFilter] = useState('all');

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
      Alert.alert('Error', error.message || 'Unable to select a dog.');
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
      Alert.alert('Registration failed', error.message || 'Please try again.');
    } finally {
      setJoiningId(null);
    }
  };

  const getEventRegistrations = (eventId) =>
    registrations.filter((registration) => registration.event_id === eventId);

  const getOverallStatus = (eventRegistrations) =>
    STATUS_ORDER.find((status) =>
      eventRegistrations.some((r) => (r.status || 'pending') === status)
    ) || null;

  const visibleEvents = events.filter((event) => {
    if (filter === 'all') return true;
    return getEventRegistrations(event.id).some(
      (r) => (r.status || 'pending') === filter
    );
  });

  const renderEvent = ({ item }) => {
    const isPast = new Date(item.ends_at).getTime() < Date.now();
    const isJoining = joiningId === item.id;
    const eventRegistrations = getEventRegistrations(item.id);

    const overall = getOverallStatus(eventRegistrations);
    const tone = tones[STATUS_TONE[overall]] || tones.beige;

    return (
      <View style={[styles.card, { backgroundColor: tone.bg }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardDate, { color: tone.sub }]}>
            {formatLongDate(item.starts_at)}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.statusPillText, { color: tone.pillText }]}>
              {overall || (isPast ? 'ended' : 'open')}
            </Text>
          </View>
        </View>

        <Text style={[styles.eventName, { color: tone.text }]}>
          {item.name}
        </Text>

        <View style={styles.venueRow}>
          <Ionicons name="location-outline" size={15} color={tone.sub} />
          <Text style={[styles.venue, { color: tone.sub }]} numberOfLines={1}>
            {item.venue}
          </Text>
        </View>

        {item.description ? (
          <Text
            style={[styles.description, { color: tone.text }]}
            numberOfLines={3}
          >
            {item.description}
          </Text>
        ) : null}

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Starts</Text>
            <Text style={styles.tileValue}>
              {formatShortDateTime(item.starts_at)}
            </Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Ends</Text>
            <Text style={styles.tileValue}>
              {formatShortDateTime(item.ends_at)}
            </Text>
          </View>
        </View>

        {eventRegistrations.length > 0 && (
          <View style={styles.registrationSection}>
            <Text style={[styles.registrationHeading, { color: tone.text }]}>
              Your registrations
            </Text>

            {eventRegistrations.map((registration) => {
              const status = registration.status || 'pending';
              const regTone = tones[STATUS_TONE[status]] || tones.beige;

              return (
                <View key={registration.id} style={styles.registrationRow}>
                  <Text
                    style={[styles.dogName, { color: tone.text }]}
                    numberOfLines={1}
                  >
                    {registration.dogs?.name || 'Registered dog'}
                  </Text>

                  <View style={styles.regPill}>
                    <Text style={[styles.regPillText, { color: regTone.pillText }]}>
                      {status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {isPast ? (
          <Text style={[styles.closedText, { color: tone.sub }]}>
            This event has ended.
          </Text>
        ) : (
          <TouchableOpacity
            style={styles.joinButton}
            disabled={!!joiningId}
            onPress={() => joinEvent(item)}
          >
            {isJoining ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.joinButtonText}>Register a dog</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore events</Text>

      <View style={styles.chips}>
        {FILTERS.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visibleEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          visibleEvents.length === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => {
              setRefreshing(true);
              loadEvents();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'No open events are available right now. Check again later.'
              : `You have no ${filter} registrations.`}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 10,
    fontFamily: fonts.regular,
    color: colors.muted,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginBottom: 16,
  },

  // Filter chips
  chips: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  chip: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.white,
  },

  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },

  // Pastel event card
  card: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  statusPill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  statusPillText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  eventName: {
    fontFamily: fonts.medium,
    fontSize: 24,
    lineHeight: 32,
    marginTop: 18,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  venue: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
    marginTop: 12,
  },

  // Starts / Ends tiles
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  tileLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.tileLabel,
  },
  tileValue: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 2,
  },

  // Registrations
  registrationSection: {
    marginTop: 16,
  },
  registrationHeading: {
    fontFamily: fonts.medium,
    fontSize: 14,
    marginBottom: 8,
  },
  registrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  dogName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  regPill: {
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  regPillText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.4,
  },

  joinButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  joinButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.white,
  },
  closedText: {
    fontFamily: fonts.regular,
    marginTop: 16,
  },
});