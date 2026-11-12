import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
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
import { getMonitoringPhase } from './EventMonitoringScreen';

const EVENT_TONE = {
  open: 'green',
  ongoing: 'amber',
  completed: 'beige',
  ended: 'beige',
  cancelled: 'salmon',
};

const formatLongDate = (value) =>
  value
    ? new Date(value).toLocaleDateString([], {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Not specified';

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not specified';

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function EventDetailsScreen({ route, navigation }) {
  const eventId = route?.params?.eventId;
  const { user, profile } = useAuth();

  const [event, setEvent] = useState(null);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  // (Was declared above useState before, which crashes: "event" didn't exist yet.)
  const canManageEvent =
    (profile?.role === 'event_organizer' && event?.organizer_id === user?.id) ||
    profile?.role === 'system_admin';

  // Re-check every 30 s so the Monitor button unlocks by itself at start time
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const loadEvent = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);

      if (!eventId) {
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          setEvent(null);
          return;
        }

        const { data: members, error: memberError } = await supabase
          .from('event_members')
          .select('status')
          .eq('event_id', eventId);

        if (memberError) throw memberError;

        const active = (members || []).filter((m) => m.status !== 'withdrawn');

        setEvent(data);
        setCounts({
          pending: active.filter((m) => m.status === 'pending').length,
          approved: active.filter((m) => m.status === 'approved').length,
          rejected: active.filter((m) => m.status === 'rejected').length,
        });
        setNow(Date.now());
      } catch (error) {
        console.error('Event details error:', error);
        Alert.alert('Unable to load event', error.message);
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent])
  );

  function confirmCancel() {
    if (!canManageEvent) {
      Alert.alert('Access Denied', 'You cannot manage this event.');
      return;
    }

    Alert.alert(
      'Cancel event?',
      `"${event.name}" will be marked as cancelled.`,
      [
        { text: 'Keep event', style: 'cancel' },
        {
          text: 'Cancel event',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from('events')
                .update({
                  status: 'cancelled',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', event.id)
                .eq('organizer_id', user.id)
                .select('id');

              if (error) throw error;

              if (!data || data.length === 0) {
                throw new Error(
                  'The event was not updated. Check your permissions.'
                );
              }

              await loadEvent();
            } catch (error) {
              Alert.alert('Update Failed', error.message);
            }
          },
        },
      ]
    );
  }

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Event not found</Text>
      </View>
    );
  }

  const phase = getMonitoringPhase(event, now);
  const displayStatus =
    phase === 'ended' ? 'ended' : event.status || 'unknown';
  const tone = tones[EVENT_TONE[displayStatus]] || tones.brand;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.ink}
          colors={[colors.ink]}
          onRefresh={() => loadEvent({ pull: true })}
        />
      }
    >
      <View style={[styles.hero, { backgroundColor: tone.bg }]}>
        <View style={styles.heroTop}>
          <Text style={[styles.heroMeta, { color: tone.sub }]}>
            {formatLongDate(event.starts_at)}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>
              {displayStatus}
            </Text>
          </View>
        </View>

        <Text style={[styles.heroTitle, { color: tone.text }]}>{event.name}</Text>

        <View style={styles.heroVenue}>
          <Icon name="location-outline" size={15} color={tone.sub} />
          <Text style={[styles.heroVenueText, { color: tone.sub }]} numberOfLines={2}>
            {event.venue || 'Venue not specified'}
          </Text>
        </View>
      </View>

      {/* Live monitoring: only shown to the organizer */}
      {canManageEvent && phase === 'live' && (
        <TouchableOpacity
          style={[styles.liveCard, { backgroundColor: tones.green.bg }]}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('EventMonitoring', {
              eventId: event.id,
              eventName: event.name,
            })
          }
        >
          <View style={[styles.liveIcon]}>
            <Icon name="pulse" size={22} color={tones.green.text} />
          </View>
          <View style={styles.liveTextWrap}>
            <View style={styles.liveTitleRow}>
              <Text style={[styles.liveTitle, { color: tones.green.text }]}>
                Monitor dogs
              </Text>
              <View style={[styles.liveDot, { backgroundColor: tones.green.pillText }]} />
            </View>
            <Text style={[styles.liveSub, { color: tones.green.sub }]}>
              Live vitals and map of {counts.approved} approved dog
              {counts.approved === 1 ? '' : 's'}
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={tones.green.text} />
        </TouchableOpacity>
      )}

      {canManageEvent && phase === 'upcoming' && (
        <View style={styles.lockedRow}>
          <Icon name="time-outline" size={16} color={colors.muted} />
          <Text style={styles.lockedText}>
            Live monitoring opens 30 minutes before the event starts.
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Participants</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{counts.approved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statCol, styles.statDivider]}>
          <Text style={[styles.statNumber, counts.pending > 0 && styles.statHot]}>
            {counts.pending}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={[styles.statCol, styles.statDivider]}>
          <Text style={styles.statNumber}>{counts.rejected}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
      </View>

      {canManageEvent && (
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() =>
            navigation.navigate('EventMembers', {
              eventId: event.id,
              eventName: event.name,
            })
          }
        >
          <Text style={styles.primaryButtonText}>Manage participants</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>About</Text>
      <Text style={styles.description}>
        {event.description || 'No event description provided.'}
      </Text>

      <Text style={styles.sectionTitle}>Schedule</Text>
      <InfoRow label="Starts" value={formatDateTime(event.starts_at)} />
      <InfoRow label="Ends" value={formatDateTime(event.ends_at)} last />

      {canManageEvent && event.status === 'open' && phase !== 'ended' && (
        <TouchableOpacity style={styles.cancelButton} onPress={confirmCancel}>
          <Text style={styles.cancelText}>Cancel event</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },

  hero: {
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMeta: { fontFamily: fonts.regular, fontSize: 14 },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
  heroTitle: {
    fontFamily: fonts.medium,
    fontSize: 26,
    lineHeight: 34,
    marginTop: 18,
  },
  heroVenue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  heroVenueText: { flex: 1, fontFamily: fonts.regular, fontSize: 14 },

  // Live monitoring card
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 24,
    padding: 16,
    marginTop: 14,
  },
  liveIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveTextWrap: { flex: 1 },
  liveTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveTitle: { fontFamily: fonts.medium, fontSize: 17 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveSub: { fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },

  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  lockedText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 32,
    marginBottom: 12,
  },

  statsRow: { flexDirection: 'row' },
  statCol: { flex: 1 },
  statDivider: {
    paddingLeft: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
  },
  statNumber: { fontFamily: fonts.medium, fontSize: 30, color: colors.ink },
  statHot: { color: tones.amber.pillText },
  statLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },

  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },

  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
    opacity: 0.85,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  rowValue: {
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },

  cancelButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36,
  },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.danger },

  emptyTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.ink },
});