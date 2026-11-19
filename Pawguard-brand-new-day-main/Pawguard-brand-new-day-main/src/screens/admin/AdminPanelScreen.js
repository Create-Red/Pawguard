import React, { useCallback, useState } from 'react';

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

import Avatar from '../../components/Avatar';
import { RiskPill } from '../../components/BreedPicker';
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Admin tools, each with its own pastel tone
const MODULES = [
  {
    route: 'UserManagement',
    icon: 'people',
    tone: 'brand',
    title: 'User management',
    text: 'Accounts and their roles',
  },
  {
    route: 'DeviceMonitoring',
    icon: 'hardware-chip',
    tone: 'green',
    title: 'Device monitoring',
    text: 'Battery, status and last contact',
  },
  {
    route: 'RegisterDevices',
    icon: 'add-circle',
    tone: 'brand',
    title: 'Register devices',
    text: 'New collars and claim codes',
  },
  {
    route: 'AlertConfiguration',
    icon: 'options',
    tone: 'amber',
    title: 'Alert configuration',
    text: 'Temperature and humidity thresholds',
  },
  {
    route: 'SystemLogs',
    icon: 'document-text',
    tone: 'beige',
    title: 'System logs',
    text: 'Recent activity across PawGuard',
  },
];

const REASON_WORD = {
  'too hot': 'Too hot',
  'too humid': 'Too humid',
  'too cold': 'Too cold',
  'too dry': 'Too dry',
};

// Alerts per day: small stacked bars (red = High on top of amber = Moderate)
function AlertBars({ days }) {
  const max = Math.max(1, ...days.map((d) => Number(d.high) + Number(d.moderate)));
  return (
    <View>
      <View style={styles.dayBars}>
        {days.map((d) => {
          const hi = Number(d.high) || 0;
          const mo = Number(d.moderate) || 0;
          const total = hi + mo;
          return (
            <View key={d.day} style={styles.dayCol}>
              <Text style={styles.dayCount}>{total || ''}</Text>
              <View style={styles.dayTrack}>
                {total === 0 ? (
                  <View style={styles.dayZero} />
                ) : (
                  <>
                    <View style={{ height: (hi / max) * 90, backgroundColor: colors.danger, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
                    <View
                      style={{
                        height: (mo / max) * 90,
                        backgroundColor: tones.amber.pillText,
                        borderTopLeftRadius: hi ? 0 : 5,
                        borderTopRightRadius: hi ? 0 : 5,
                      }}
                    />
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.dayLabels}>
        {days.map((d) => (
          <Text key={d.day} style={styles.dayLabel}>
            {new Date(`${d.day}T12:00:00`).toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StatTile({ label, value, loading }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{loading ? '--' : value}</Text>
    </View>
  );
}

export default function AdminPanelScreen({ navigation }) {
  const { profile, signOut } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [stats, setStats] = useState({ users: 0, dogs: 0, devices: 0 });
  const [overview, setOverview] = useState(null); // admin_overview()
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    try {
      const [usersResult, dogsResult, devicesResult, dogListResult, overviewResult] =
        await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('dogs').select('*', { count: 'exact', head: true }),
          supabase.from('devices').select('*', { count: 'exact', head: true }),
          supabase
            .from('dogs')
            .select(`
              *,
              profiles!dogs_owner_id_fkey (
                name
              )
            `)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase.rpc('admin_overview'),
        ]);

      if (overviewResult.error) {
        console.log('ADMIN OVERVIEW ERROR:', overviewResult.error.message);
      } else {
        setOverview(overviewResult.data);
      }

      const errors = [
        usersResult.error,
        dogsResult.error,
        devicesResult.error,
        dogListResult.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.error('Admin dashboard errors:', errors);
        Alert.alert('Dashboard error', errors[0].message);
      }

      setStats({
        users: usersResult.count ?? 0,
        dogs: dogsResult.count ?? 0,
        devices: devicesResult.count ?? 0,
      });

      if (!dogListResult.error) setDogs(dogListResult.data || []);
    } catch (error) {
      console.error('Dashboard loading error:', error);
      Alert.alert('Error', 'Unable to load dashboard information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

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
          onRefresh={() => loadDashboard({ pull: true })}
        />
      }
    >
      {/* Header: brand left, admin pill right */}
      <View style={styles.topHeader}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>PawGuard</Text>
          <View style={styles.brandDot} />
        </View>

        <View style={[styles.pill, { backgroundColor: tones.salmon.pill }]}>
          <Icon name="shield-checkmark" size={13} color={tones.salmon.pillText} />
          <Text style={[styles.pillText, { color: tones.salmon.pillText }]}>
            Admin
          </Text>
        </View>
      </View>

      <Text style={styles.title}>
        Hi, {profile?.name?.split(' ')[0] || 'Administrator'}
      </Text>
      <Text style={styles.subtitle}>Here's how PawGuard is doing.</Text>

      {/* System overview */}
      <Text style={styles.sectionTitle}>System overview</Text>
      <View style={styles.tiles}>
        <StatTile label="Users" value={stats.users} loading={loading} />
        <StatTile label="Pets" value={stats.dogs} loading={loading} />
        <StatTile label="Devices" value={stats.devices} loading={loading} />
      </View>

      {overview && (() => {
        const c = overview.counts || {};
        const a = overview.alerts || {};
        const ev = overview.events || {};
        const days = overview.by_day || [];
        const breeds = overview.top_breeds || [];
        const reasons = Object.entries(overview.reasons || {}).sort((x, y) => y[1] - x[1]);
        const diff = Number(a.week || 0) - Number(a.last_week || 0);
        const topBreed = Math.max(1, ...breeds.map((b) => Number(b.alerts)));
        return (
          <>
            {/* This week */}
            <Text style={styles.sectionTitle}>This week</Text>
            <View style={styles.tiles}>
              <View style={[styles.bigTile, { backgroundColor: Number(a.high) > 0 ? tones.salmon.bg : tones.green.bg }]}>
                <Text style={styles.bigLabel}>Alerts</Text>
                <Text style={styles.bigValue}>{a.week ?? 0}</Text>
                <Text style={styles.bigSub}>
                  {a.high ?? 0} high · {a.moderate ?? 0} moderate
                </Text>
                <Text style={styles.bigSub}>
                  {diff === 0 ? 'Same as last week' : `${diff > 0 ? '▲' : '▼'} ${Math.abs(diff)} vs last week`}
                </Text>
              </View>
              <View style={[styles.bigTile, { backgroundColor: tones.brand.bg }]}>
                <Text style={styles.bigLabel}>Active collars</Text>
                <Text style={styles.bigValue}>{c.active_week ?? 0}</Text>
                <Text style={styles.bigSub}>{c.sending_now ?? 0} sending now</Text>
                <Text style={styles.bigSub}>{c.paired ?? 0} of {c.collars ?? 0} paired</Text>
              </View>
            </View>

            <View style={styles.eventLine}>
              <Text style={styles.eventText}>
                <Text style={styles.eventStrong}>{ev.live ?? 0}</Text> live now  ·{' '}
                <Text style={styles.eventStrong}>{ev.upcoming ?? 0}</Text> upcoming  ·{' '}
                <Text style={styles.eventStrong}>{ev.ended_week ?? 0}</Text> ended this week
              </Text>
            </View>

            {/* Alerts per day */}
            {days.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Alerts per day</Text>
                <AlertBars days={days} />
              </>
            )}

            {/* Breeds */}
            <Text style={styles.sectionTitle}>Breeds with the most alerts</Text>
            <Text style={styles.sectionHint}>Last 30 days</Text>
            {breeds.length === 0 ? (
              <Text style={styles.emptyText}>No alerts in the last 30 days.</Text>
            ) : (
              breeds.map((b) => (
                <View key={b.breed} style={styles.breedRow}>
                  <View style={styles.breedTop}>
                    <Text style={styles.breedName} numberOfLines={1}>{b.breed}</Text>
                    <RiskPill tier={b.risk_tier} small />
                    <Text style={styles.breedCount}>{b.alerts}</Text>
                  </View>
                  <View style={styles.breedTrack}>
                    <View
                      style={[
                        styles.breedBar,
                        {
                          width: `${(Number(b.alerts) / topBreed) * 100}%`,
                          backgroundColor: Number(b.high) > 0 ? colors.danger : tones.amber.pillText,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.breedSub}>
                    {b.dogs} dog{Number(b.dogs) === 1 ? '' : 's'} · {b.high} high
                  </Text>
                </View>
              ))
            )}

            {/* Reasons */}
            {reasons.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Why alerts happened</Text>
                <View style={styles.reasonRow}>
                  {reasons.map(([r, n]) => (
                    <View key={r} style={styles.reasonChip}>
                      <Text style={styles.reasonText}>
                        {REASON_WORD[r] || r} <Text style={styles.reasonStrong}>{n}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        );
      })()}

      {/* Admin tools */}
      <Text style={styles.sectionTitle}>Tools</Text>
      <View style={styles.modules}>
        {MODULES.map((m) => {
          const tone = tones[m.tone];
          return (
            <TouchableOpacity
              key={m.route}
              style={[styles.moduleCard, { backgroundColor: tone.bg }]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate(m.route)}
              accessibilityRole="button"
              accessibilityLabel={m.title}
            >
              <View style={styles.moduleIcon}>
                <Icon name={m.icon} size={20} color={tone.text} />
              </View>
              <Text style={[styles.moduleTitle, { color: tone.text }]}>
                {m.title}
              </Text>
              <Text style={[styles.moduleText, { color: tone.sub }]} numberOfLines={2}>
                {m.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Recent pets */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Recently registered</Text>
        <Text style={styles.listMeta}>Latest 20</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.ink} style={styles.loader} />
      ) : dogs.length === 0 ? (
        <Text style={styles.emptyText}>No registered pets yet.</Text>
      ) : (
        dogs.map((dog, index) => (
          <View
            key={dog.id}
            style={[styles.dogRow, index === dogs.length - 1 && styles.dogRowLast]}
          >
            <Avatar
              uri={dog.photo_url}
              name={dog.name}
              size={46}
              bg={tones.brand.bg}
              color={tones.brand.text}
            />

            <View style={styles.dogText}>
              <View style={styles.dogNameRow}>
                <Text style={styles.dogName} numberOfLines={1}>
                  {dog.name}
                </Text>
                {dog.is_archived && (
                  <View style={[styles.smallPill, { backgroundColor: tones.beige.pill }]}>
                    <Text style={[styles.smallPillText, { color: tones.beige.pillText }]}>
                      archived
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.dogMeta} numberOfLines={1}>
                {[
                  dog.breed || 'Unknown breed',
                  dog.age != null ? `${dog.age} yrs` : null,
                  dog.profiles?.name ? `Owner: ${dog.profiles.name}` : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.logout} onPress={handleSignOut}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },

  // Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },

  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginTop: 32,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  // Overview
  sectionHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: -8, marginBottom: 10, paddingHorizontal: 2 },
  bigTile: { flex: 1, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16 },
  bigLabel: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 0.4, color: colors.ink, opacity: 0.7 },
  bigValue: { fontFamily: fonts.medium, fontSize: 30, color: colors.ink, marginTop: 2 },
  bigSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink, opacity: 0.7, marginTop: 2 },
  eventLine: { marginTop: 12, paddingHorizontal: 2 },
  eventText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  eventStrong: { fontFamily: fonts.semibold, color: colors.ink },

  dayBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 112 },
  dayCol: { flex: 1, alignItems: 'stretch' },
  dayCount: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 4 },
  dayTrack: { justifyContent: 'flex-end' },
  dayZero: { height: 3, borderRadius: 2, backgroundColor: colors.line },
  dayLabels: { flexDirection: 'row', gap: 8, marginTop: 6 },
  dayLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 11, color: colors.muted, textAlign: 'center' },

  breedRow: { marginBottom: 14 },
  breedTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breedName: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  breedCount: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, minWidth: 24, textAlign: 'right' },
  breedTrack: { height: 8, borderRadius: 4, backgroundColor: colors.tile, marginTop: 6, overflow: 'hidden' },
  breedBar: { height: 8, borderRadius: 4 },
  breedSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 4 },

  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: colors.pill },
  reasonText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  reasonStrong: { fontFamily: fonts.semibold },

  // Stat tiles (same as dashboard readings)
  tiles: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingVertical: 14,
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
    fontSize: 24,
    color: colors.ink,
    marginTop: 4,
  },

  // Module grid
  modules: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moduleCard: {
    width: '48.5%',
    flexGrow: 1,
    borderRadius: 24,
    padding: 16,
    minHeight: 132,
  },
  moduleIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleTitle: { fontFamily: fonts.medium, fontSize: 15, marginTop: 14 },
  moduleText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },

  // Recent pets
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 32,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  listTitle: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  listMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  loader: { marginVertical: 24 },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  dogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  dogRowLast: { borderBottomWidth: 0 },
  dogText: { flex: 1 },
  dogNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dogName: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  dogMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  smallPill: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  smallPillText: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.3 },

  logout: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  logoutText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
});