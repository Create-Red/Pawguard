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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    try {
      const [usersResult, dogsResult, devicesResult, dogListResult] =
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
        ]);

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