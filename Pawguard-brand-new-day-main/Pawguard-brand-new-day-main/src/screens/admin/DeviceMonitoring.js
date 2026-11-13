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
import { colors, fonts, tones } from '../../Theme';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

// Status -> pastel tone + label
const STATUS_STYLE = {
  ONLINE: { tone: 'green', label: 'Online' },
  OFFLINE: { tone: 'salmon', label: 'Offline' },
  'NO DATA': { tone: 'beige', label: 'No data' },
  UNPAIRED: { tone: 'amber', label: 'Unpaired' },
};

const FILTERS = [
  { key: 'ALL', label: 'all' },
  { key: 'ONLINE', label: 'online' },
  { key: 'OFFLINE', label: 'offline' },
  { key: 'NO DATA', label: 'no data' },
  { key: 'UNPAIRED', label: 'unpaired' },
];

const timeAgo = (date) => {
  if (!date) return 'Never';
  const sec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} d ago`;
};

const batteryIcon = (pct) => {
  if (pct == null) return 'battery-dead';
  if (pct >= 70) return 'battery-full';
  if (pct >= 25) return 'battery-half';
  return 'battery-dead';
};

export default function DeviceMonitoringScreen() {
  const [devices, setDevices] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDevices = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    try {
      const { data, error } = await supabase.from('devices').select(`
          id,
          device_uid,
          dog_id,
          status,
          battery_pct,
          firmware_version,
          dogs (
            id,
            name,
            owner_id,
            profiles!dogs_owner_id_fkey (
              name
            )
          ),
          sensor_data (
            timestamp_utc
          )
        `);

      if (error) throw error;

      const now = Date.now();

      const formatted = (data || []).map((device) => {
        const readings = device.sensor_data || [];

        const latest = readings.reduce((acc, r) => {
          if (!r.timestamp_utc) return acc;
          return !acc || new Date(r.timestamp_utc) > new Date(acc.timestamp_utc)
            ? r
            : acc;
        }, null);

        const lastSeen = latest?.timestamp_utc ? new Date(latest.timestamp_utc) : null;

        let deviceStatus = 'NO DATA';
        if (!device.dog_id) deviceStatus = 'UNPAIRED';
        else if (lastSeen) {
          deviceStatus =
            now - lastSeen.getTime() <= ONLINE_WINDOW_MS ? 'ONLINE' : 'OFFLINE';
        }

        return { ...device, lastSeen, deviceStatus };
      });

      // Online first, then by name
      const order = { ONLINE: 0, OFFLINE: 1, 'NO DATA': 2, UNPAIRED: 3 };
      formatted.sort(
        (a, b) =>
          order[a.deviceStatus] - order[b.deviceStatus] ||
          (a.dogs?.name || '').localeCompare(b.dogs?.name || '')
      );

      setDevices(formatted);
    } catch (error) {
      console.error('Device monitoring error:', error);
      Alert.alert('Error', error.message || 'Unable to load device information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDevices();
    }, [])
  );

  const count = (status) => devices.filter((d) => d.deviceStatus === status).length;
  const visible =
    filter === 'ALL' ? devices : devices.filter((d) => d.deviceStatus === filter);

  const renderDevice = ({ item }) => {
    const s = STATUS_STYLE[item.deviceStatus] || STATUS_STYLE['NO DATA'];
    const tone = tones[s.tone];
    const battery = item.battery_pct != null ? Number(item.battery_pct) : null;

    return (
      <View style={[styles.card, { backgroundColor: tone.bg }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardMeta, { color: tone.sub }]} numberOfLines={1}>
            Last contact {timeAgo(item.lastSeen).toLowerCase()}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>{s.label}</Text>
          </View>
        </View>

        <Text style={[styles.deviceName, { color: tone.text }]} numberOfLines={1}>
          {item.dogs?.name || 'Not assigned'}
        </Text>
        <Text style={[styles.deviceSub, { color: tone.sub }]} numberOfLines={1}>
          {item.dogs?.profiles?.name
            ? `Owner: ${item.dogs.profiles.name}`
            : 'No owner'}
        </Text>

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Battery</Text>
            <View style={styles.tileValueRow}>
              <Icon
                name={batteryIcon(battery)}
                size={16}
                color={battery != null && battery < 25 ? colors.danger : colors.ink}
              />
              <Text style={styles.tileValue}>
                {battery != null ? `${battery}%` : '--'}
              </Text>
            </View>
          </View>
          <View style={[styles.tile, styles.tileWide]}>
            <Text style={styles.tileLabel}>Device ID</Text>
            <Text style={styles.tileValueSmall} numberOfLines={1}>
              {item.device_uid || 'Unknown'}
            </Text>
          </View>
        </View>

        <Text style={[styles.firmware, { color: tone.sub }]}>
          Firmware {item.firmware_version || 'unknown'}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const Header = (
    <View>
      <Text style={styles.title}>Devices</Text>
      <Text style={styles.subtitle}>Every PawGuard collar in the system.</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{devices.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statCol, styles.statDivider]}>
          <Text style={[styles.statNumber, { color: tones.green.pillText }]}>
            {count('ONLINE')}
          </Text>
          <Text style={styles.statLabel}>Online</Text>
        </View>
        <View style={[styles.statCol, styles.statDivider]}>
          <Text style={[styles.statNumber, count('OFFLINE') > 0 && { color: colors.danger }]}>
            {count('OFFLINE')}
          </Text>
          <Text style={styles.statLabel}>Offline</Text>
        </View>
        <View style={[styles.statCol, styles.statDivider]}>
          <Text style={styles.statNumber}>{count('UNPAIRED')}</Text>
          <Text style={styles.statLabel}>Unpaired</Text>
        </View>
      </View>

      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f.key}
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        renderItem={({ item: f }) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={visible}
      keyExtractor={(item) => item.id}
      renderItem={renderDevice}
      ListHeaderComponent={Header}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.ink}
          colors={[colors.ink]}
          onRefresh={() => loadDevices({ pull: true })}
        />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          {filter === 'ALL' ? 'No devices registered yet.' : 'No devices in this group.'}
        </Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 4 },

  statsRow: { flexDirection: 'row', marginTop: 22 },
  statCol: { flex: 1 },
  statDivider: {
    paddingLeft: 14,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
  },
  statNumber: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  chips: { flexGrow: 0, marginTop: 22, marginBottom: 16 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
  chipTextActive: { color: colors.onAccent },

  card: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: { flex: 1, fontFamily: fonts.regular, fontSize: 13, marginRight: 10 },
  pill: { paddingHorizontal: 14, height: 30, borderRadius: 15, justifyContent: 'center' },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
  deviceName: { fontFamily: fonts.medium, fontSize: 22, marginTop: 14 },
  deviceSub: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },

  tiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tileWide: { flex: 2 },
  tileLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.tileLabel,
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tileValue: { fontFamily: fonts.medium, fontSize: 18, color: colors.ink },
  tileValueSmall: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, marginTop: 4 },
  firmware: { fontFamily: fonts.regular, fontSize: 12, marginTop: 12 },

  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },
});