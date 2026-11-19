// screens/event/EventOrganizerDashboardScreen.js
// Organizer Home: what needs attention right now.
//   1. Live now     - events running now, with a quick dog health summary
//   2. At a glance  - upcoming events, pending requests, approved dogs
//   3. Needs review - events with join requests waiting
//   4. Coming up    - next events
// The full list of events lives in the "Events" tab.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Icon from '../../components/Icon';
import Mascot, { MascotLoader } from '../../components/Mascot';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';
import { calculateHealthRisk, loadAlertThresholds } from '../../utils/healthRisk';

const OPENS_EARLY_MS = 30 * 60 * 1000; // monitoring opens 30 min before start
const ONLINE_WINDOW_MS = 2 * 60 * 1000; // same rule as the owner dashboard
const LIVE_REFRESH_MS = 30 * 1000;

const toMillis = (ts) => {
  if (!ts) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const ms = new Date(hasZone ? ts : `${ts}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// Same rule as EventMonitoringScreen
const phaseOf = (event, now) => {
  if (event.status === 'cancelled') return 'cancelled';
  const start = toMillis(event.starts_at);
  const end = toMillis(event.ends_at);
  if (end !== null && now > end) return 'ended';
  if (start !== null && now < start - OPENS_EARLY_MS) return 'upcoming';
  return 'live';
};

const formatWhen = (value) => {
  const ms = toMillis(value);
  if (ms === null) return 'Date not set';
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

const startsIn = (value, now) => {
  const ms = toMillis(value);
  if (ms === null) return '';
  const min = Math.round((ms - now) / 60000);
  if (min <= 0) return 'Starting now';
  if (min < 60) return `Starts in ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `Starts in ${hr} hr`;
  const d = Math.round(hr / 24);
  return `In ${d} day${d === 1 ? '' : 's'}`;
};

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

// Heat-safety tips the dog shares when there's nothing more urgent
const TIPS = [
  'Set up shaded rest spots and water bowls before the dogs arrive.',
  'Morning and late afternoon are the coolest times for dog events.',
  'Hot pavement burns paws. Try the 5-second hand test on the ground.',
  'Flat-faced breeds like Pugs overheat faster. Watch them closely.',
  'Plan short breaks every 15 to 20 minutes on hot days.',
];

// What the dog says, most urgent first
function dogLine({ live, liveSummaries, pending, nextEvent, now }) {
  const high = liveSummaries.reduce((n, s) => n + (s?.high || 0), 0);
  const offline = liveSummaries.reduce((n, s) => n + (s?.offline || 0), 0);
  if (live.length && high > 0) {
    return `${high} dog${high === 1 ? ' is' : 's are'} getting too hot. Tap "Monitor dogs" and check on ${high === 1 ? 'it' : 'them'} now!`;
  }
  if (live.length && offline > 0) {
    return `${offline} collar${offline === 1 ? ' is' : 's are'} offline. Ask the owner${offline === 1 ? '' : 's'} to check the collar.`;
  }
  if (live.length) return 'All dogs look good! Keep the water bowls full.';
  if (pending > 0) {
    return `${pending} owner${pending === 1 ? ' is' : 's are'} waiting for your approval. Tap "Needs your review".`;
  }
  if (nextEvent) {
    const hours = (toMillis(nextEvent.starts_at) - now) / 3600000;
    if (hours > 0 && hours < 24) {
      return `${nextEvent.name} starts soon! Remind owners to bring water and charge their collars.`;
    }
  }
  if (!nextEvent) return "No events yet. Let's plan one together!";
  return TIPS[Math.floor(now / 86400000) % TIPS.length]; // a new tip each day
}

// Dog health summary for one live event
async function loadLiveSummary(eventId) {
  const { data, error } = await supabase.rpc('get_event_monitoring', {
    p_event_id: eventId,
  });
  if (error) return null;

  const now = Date.now();
  const summary = { dogs: 0, high: 0, moderate: 0, offline: 0 };

  (data || []).forEach((row) => {
    summary.dogs += 1;
    const last = toMillis(row.reading_at);
    const online = row.device_id && last !== null && now - last <= ONLINE_WINDOW_MS;
    if (!online) {
      summary.offline += 1;
      return;
    }
    const risk = calculateHealthRisk(
      { surface_temp: row.surface_temp, humidity: row.humidity, dog_id: row.dog_id },
      row.risk_tier
    );
    if (risk === 'HIGH') summary.high += 1;
    else if (risk === 'MODERATE') summary.moderate += 1;
  });

  return summary;
}

function StatTile({ label, value, tone }) {
  return (
    <View style={[styles.stat, tone && { backgroundColor: tone.bg }]}>
      <Text style={[styles.statLabel, tone && { color: tone.sub }]}>{label}</Text>
      <Text style={[styles.statValue, tone && { color: tone.text }]}>{value}</Text>
    </View>
  );
}

export default function EventOrganizerDashboardScreen({ navigation }) {
  const { user, profile } = useAuth();

  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({}); // eventId -> { pending, approved }
  const [live, setLive] = useState({}); // eventId -> summary
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (!user?.id) return;
      if (pull) setRefreshing(true);

      try {
        await loadAlertThresholds(supabase);

        const { data: evs, error } = await supabase
          .from('events')
          .select('id, name, venue, starts_at, ends_at, status')
          .eq('organizer_id', user.id)
          .order('starts_at', { ascending: true });

        if (error) throw error;

        const t = Date.now();
        const active = (evs || []).filter((e) => {
          const p = phaseOf(e, t);
          return p === 'live' || p === 'upcoming';
        });

        const nextCounts = {};
        active.forEach((e) => {
          nextCounts[e.id] = { pending: 0, approved: 0 };
        });

        if (active.length > 0) {
          const { data: members } = await supabase
            .from('event_members')
            .select('event_id, status')
            .in('event_id', active.map((e) => e.id));

          (members || []).forEach((m) => {
            const c = nextCounts[m.event_id];
            if (!c) return;
            if (m.status === 'pending') c.pending += 1;
            if (m.status === 'approved') c.approved += 1;
          });
        }

        const liveEvents = active.filter((e) => phaseOf(e, t) === 'live');
        const summaries = await Promise.all(liveEvents.map((e) => loadLiveSummary(e.id)));
        const nextLive = {};
        liveEvents.forEach((e, i) => {
          nextLive[e.id] = summaries[i];
        });

        setEvents(active);
        setCounts(nextCounts);
        setLive(nextLive);
        setNow(t);
      } catch (e) {
        console.log('ORGANIZER HOME ERROR:', e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Keep live summaries fresh while an event is running
  const liveEvents = events.filter((e) => phaseOf(e, now) === 'live');
  const upcoming = events.filter((e) => phaseOf(e, now) === 'upcoming');
  const hasLive = liveEvents.length > 0;

  useEffect(() => {
    if (!hasLive) return undefined;
    const timer = setInterval(() => load(), LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasLive, load]);

  if (loading) {
    return (
      <MascotLoader text="Loading your events" />
    );
  }

  const totalPending = Object.values(counts).reduce((s, c) => s + c.pending, 0);
  const totalApproved = Object.values(counts).reduce((s, c) => s + c.approved, 0);
  const needsReview = events.filter((e) => counts[e.id]?.pending > 0);
  const firstName = (profile?.name || '').split(' ')[0];

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
          onRefresh={() => load({ pull: true })}
        />
      }
    >
      {/* Header */}
      <View style={styles.topHeader}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>PawGuard</Text>
          <View style={styles.brandDot} />
        </View>
      </View>

      {/* Greeting with the PawGuard dog standing by */}
      <View style={styles.greetRow}>
        <View style={styles.greetText}>
          <Text style={styles.greeting}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
          <Text style={styles.title}>
            {hasLive ? 'Your event is live' : 'Here’s your day'}
          </Text>
        </View>
      </View>

      {/* 1. Live now */}
      {hasLive ? (
        liveEvents.map((e) => {
          const s = live[e.id];
          const alert = s && s.high > 0;
          const tone = alert ? tones.salmon : tones.green;
          return (
            <View key={e.id} style={[styles.liveCard, { backgroundColor: tone.bg }]}>
              <View style={styles.cardTop}>
                <View style={[styles.pill, { backgroundColor: tone.pill }]}>
                  <View style={[styles.liveDot, { backgroundColor: tone.pillText }]} />
                  <Text style={[styles.pillText, { color: tone.pillText }]}>Live now</Text>
                </View>
                <Text style={[styles.cardMeta, { color: tone.sub }]}>
                  {counts[e.id]?.approved ?? 0} dogs
                </Text>
              </View>

              <Text style={[styles.liveName, { color: tone.text }]} numberOfLines={2}>
                {e.name}
              </Text>
              {!!e.venue && (
                <View style={styles.venueRow}>
                  <Icon name="location-outline" size={15} color={tone.sub} />
                  <Text style={[styles.venue, { color: tone.sub }]} numberOfLines={1}>
                    {e.venue}
                  </Text>
                </View>
              )}

              {s ? (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: tone.text }]}>{s.high}</Text>
                    <Text style={[styles.summaryLabel, { color: tone.sub }]}>High risk</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: tone.text }]}>{s.moderate}</Text>
                    <Text style={[styles.summaryLabel, { color: tone.sub }]}>Moderate</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={[styles.summaryValue, { color: tone.text }]}>{s.offline}</Text>
                    <Text style={[styles.summaryLabel, { color: tone.sub }]}>Offline</Text>
                  </View>
                </View>
              ) : (
                <Text style={[styles.cardMeta, { color: tone.sub, marginTop: 14 }]}>
                  Open monitoring to see each dog.
                </Text>
              )}

              <TouchableOpacity
                style={styles.monitorButton}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate('EventMonitoring', { eventId: e.id, eventName: e.name })
                }
              >
                <Icon name="pulse" size={18} color={colors.onAccent} />
                <Text style={styles.monitorText}>Monitor dogs</Text>
              </TouchableOpacity>
            </View>
          );
        })
      ) : (
        <View style={[styles.liveCard, { backgroundColor: tones.beige.bg }]}>
          <View style={styles.cardTop}>
            <View style={[styles.pill, { backgroundColor: tones.beige.pill }]}>
              <Text style={[styles.pillText, { color: tones.beige.pillText }]}>
                No live event
              </Text>
            </View>
          </View>
          {upcoming[0] ? (
            <>
              <Text style={[styles.cardMeta, { color: tones.beige.sub, marginTop: 18 }]}>
                Next up · {startsIn(upcoming[0].starts_at, now)}
              </Text>
              <Text style={[styles.liveName, { color: tones.beige.text }]} numberOfLines={2}>
                {upcoming[0].name}
              </Text>
              <Text style={[styles.venue, { color: tones.beige.sub, marginTop: 4 }]}>
                Monitoring opens 30 minutes before it starts.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.liveName, { color: tones.beige.text, marginTop: 18 }]}>
                Nothing scheduled
              </Text>
              <Text style={[styles.venue, { color: tones.beige.sub, marginTop: 4 }]}>
                Create an event to start accepting dogs.
              </Text>
            </>
          )}
        </View>
      )}

      {/* 2. At a glance */}
      <Text style={styles.sectionTitle}>At a glance</Text>
      <View style={styles.stats}>
        <StatTile label="Upcoming" value={upcoming.length} />
        <StatTile
          label="Requests"
          value={totalPending}
          tone={totalPending > 0 ? tones.amber : null}
        />
        <StatTile label="Dogs in" value={totalApproved} />
      </View>

      {/* 3. Needs review */}
      {needsReview.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Needs your review</Text>
          {needsReview.map((e, i) => (
            <TouchableOpacity
              key={e.id}
              style={[styles.row, i === needsReview.length - 1 && styles.rowLast]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('EventMembers', { eventId: e.id, eventName: e.name })
              }
            >
              <View style={[styles.rowIcon, { backgroundColor: tones.amber.bg }]}>
                <Icon name="people" size={20} color={tones.amber.text} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{e.name}</Text>
                <Text style={styles.rowSub}>
                  {counts[e.id].pending} request{counts[e.id].pending === 1 ? '' : 's'} waiting
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* 4. Coming up */}
      {upcoming.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleInline}>Coming up</Text>
            <TouchableOpacity onPress={() => navigation.navigate('ManageEvent')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          {upcoming.slice(0, 3).map((e, i, list) => {
            const d = new Date(toMillis(e.starts_at) ?? NaN);
            const valid = !Number.isNaN(d.getTime());
            return (
              <TouchableOpacity
                key={e.id}
                style={[styles.row, i === list.length - 1 && styles.rowLast]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('EventDetails', { eventId: e.id })}
              >
                <View style={styles.dateBadge}>
                  <Text style={styles.dateDay}>{valid ? d.getDate() : '--'}</Text>
                  <Text style={styles.dateMonth}>
                    {valid ? d.toLocaleDateString([], { month: 'short' }).toUpperCase() : ''}
                  </Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {formatWhen(e.starts_at)} · {counts[e.id]?.approved ?? 0} dogs
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* Main action */}
      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CreateEvent')}
      >
        <Icon name="add" size={20} color={colors.onAccent} />
        <Text style={styles.primaryButtonText}>Create event</Text>
      </TouchableOpacity>

      {/* The PawGuard dog with a tip or a heads-up */}
      <View style={styles.dogRow}>
        <Mascot pose="stand" animation="breathe" size={110} />
        <View style={styles.bubbleWrap}>
          <View style={styles.bubbleTail} />
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>
              {dogLine({
                live: liveEvents,
                liveSummaries: liveEvents.map((e) => live[e.id]),
                pending: totalPending,
                nextEvent: upcoming[0],
                now,
              })}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
  greetText: { flex: 1, paddingBottom: 4 },
  dogRow: { flexDirection: 'row', alignItems: 'center', marginTop: 22 },
  bubbleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: -16 }, // the dog picture has empty space around it
  bubbleTail: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.tile,
  },
  bubble: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bubbleText: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink },
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 120 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  // Header (same as owner Home)
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40, // same height as when the profile picture was here
    marginTop: 8,
  },
  brand: { flexDirection: 'row', alignItems: 'flex-end' },
  brandText: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginLeft: 3,
    marginBottom: 7,
  },

  greeting: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
    marginTop: 30,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginTop: 2,
    marginBottom: 16,
  },

  // Live card
  liveCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
  cardMeta: { fontFamily: fonts.regular, fontSize: 14 },
  liveName: { fontFamily: fonts.medium, fontSize: 26, marginTop: 14 },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  venue: { fontFamily: fonts.regular, fontSize: 14, flexShrink: 1 },
  summaryRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  summaryItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryValue: { fontFamily: fonts.medium, fontSize: 22 },
  summaryLabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  monitorButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  monitorText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onAccent },

  // Sections
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 26,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 26,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  sectionTitleInline: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  seeAll: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },

  // Stat tiles
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.tileLabel,
  },
  statValue: { fontFamily: fonts.medium, fontSize: 22, color: colors.ink, marginTop: 4 },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  dateBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: tones.brand.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 22,
    color: tones.brand.text,
  },
  dateMonth: {
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 0.8,
    color: tones.brand.pillText,
  },

  // Button
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 28,
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
});