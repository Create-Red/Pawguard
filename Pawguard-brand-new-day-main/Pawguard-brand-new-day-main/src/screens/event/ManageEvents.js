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
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Event status -> card colour
const EVENT_TONE = {
  open: 'green',
  ongoing: 'amber',
  completed: 'beige',
  cancelled: 'salmon',
};

const formatLongDate = (value) =>
  value
    ? new Date(value).toLocaleDateString([], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Date not set';

export default function ManageEventsScreen({ navigation }) {
  const { user } = useAuth();

  const [events, setEvents] = useState([]);
  const [participantCounts, setParticipantCounts] = useState({});
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);

      if (!user?.id) {
        setEvents([]);
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, venue, starts_at, ends_at, status')
          .eq('organizer_id', user.id)
          .order('starts_at', { ascending: true });

        if (error) throw error;

        const eventList = data || [];

        if (eventList.length === 0) {
          setEvents([]);
          setParticipantCounts({});
          return;
        }

        const eventIds = eventList.map((event) => event.id);

        const { data: members, error: memberError } = await supabase
          .from('event_members')
          .select('event_id, status')
          .in('event_id', eventIds);

        if (memberError) throw memberError;

        const counts = {};
        eventList.forEach((event) => {
          counts[event.id] = { total: 0, pending: 0, approved: 0 };
        });

        (members || []).forEach((member) => {
          const count = counts[member.event_id];
          if (!count || member.status === 'withdrawn') return;

          count.total += 1;
          if (member.status === 'pending') count.pending += 1;
          if (member.status === 'approved') count.approved += 1;
        });

        // Set together so the list never shows events without their counts
        setEvents(eventList);
        setParticipantCounts(counts);
      } catch (error) {
        console.error('LOAD EVENTS ERROR:', error);
        Alert.alert('Could Not Load Events', error.message);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );


const renderEvent = ({ item }) => {
  const tone = tones[EVENT_TONE[item.status]] || tones.brand;
  const counts = participantCounts[item.id] || {
    total: 0,
    pending: 0,
    approved: 0,
  };

  return (
    <View style={[styles.card, { backgroundColor: tone.bg }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate('EventDetails', {
            eventId: item.id,
          })
        }
      >
        <View style={styles.cardTop}>
          <Text style={[styles.cardDate, { color: tone.sub }]}>
            {formatLongDate(item.starts_at)}
          </Text>

          <View style={[styles.statusPill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.statusPillText, { color: tone.pillText }]}>
              {item.status || 'unknown'}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.eventName, { color: tone.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>

        <View style={styles.venueRow}>
          <Icon name="location-outline" size={15} color={tone.sub} />
          <Text style={[styles.venue, { color: tone.sub }]} numberOfLines={1}>
            {item.venue || 'Venue not specified'}
          </Text>
        </View>

        <Text style={[styles.counts, { color: tone.text }]}>
          {counts.approved} approved
          {'  ·  '}
          {counts.pending} pending
        </Text>
      </TouchableOpacity>

      {/* Participant management button */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.manageParticipantsButton}
        onPress={() =>
          navigation.navigate('EventMembers', {
            eventId: item.id,
            eventName: item.name,
          })
        }
      >
        <Icon name="people-outline" size={18} color={colors.onAccent} />

        <Text style={styles.manageParticipantsText}>
          Manage Participants
        </Text>

        {counts.pending > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>
              {counts.pending}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};


  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={styles.title}>My events</Text>
          <Text style={styles.subtitle}>Tap an event to manage it.</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreateEvent')}
          accessibilityLabel="Create event"
        >
          <Icon name="add" size={22} color={colors.onAccent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={events}
        keyExtractor={(item) => item.id}
        renderItem={renderEvent}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={events.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => loadEvents({ pull: true })}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="paw" size={40} color={tones.brand.text} />
            </View>
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Create your first event to start accepting dog registrations.
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateEvent')}
            >
              <Text style={styles.createButtonText}>Create event</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },

  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headingText: { flex: 1 },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyList: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  // Pastel event card
  card: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardDate: { fontFamily: fonts.regular, fontSize: 14 },
  statusPill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  statusPillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
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
    marginTop: 8,
  },
  venue: { flex: 1, fontFamily: fonts.regular, fontSize: 14 },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  counts: { flex: 1, fontFamily: fonts.medium, fontSize: 14, marginRight: 12 },
  goButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  empty: { alignItems: 'center' },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: tones.brand.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 22, color: colors.ink },
  emptyText: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    color: colors.muted,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  createButton: {
    height: 52,
    paddingHorizontal: 32,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  createButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },

  manageParticipantsButton: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 9,
  height: 48,
  borderRadius: 24,
  backgroundColor: colors.accent,
  marginTop: 18,
},

manageParticipantsText: {
  fontFamily: fonts.medium,
  fontSize: 14,
  color: colors.onAccent,
},

pendingBadge: {
  minWidth: 23,
  height: 23,
  borderRadius: 12,
  backgroundColor: colors.white,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 5,
},

pendingBadgeText: {
  fontFamily: fonts.medium,
  fontSize: 12,
  color: colors.danger,
},
});