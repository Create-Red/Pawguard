import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
// One risk calculation for the whole app (same as the owner dashboard)
import { calculateHealthRisk } from '../../utils/healthRisk';
import { colors, fonts, tones } from '../../Theme';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

// Supabase "timestamp without time zone" values have no "Z" but are UTC.
// Without this fix, devices in UTC+ timezones look permanently offline.
const toMillis = (ts) => {
  if (!ts) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const ms = new Date(hasZone ? ts : `${ts}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// Coarse on purpose, same as the owner dashboard
const timeAgo = (ms) => {
  if (!ms) return 'No readings';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} d ago`;
};

function getDeviceStatus(device, sensor) {
  if (!device) return 'NO DEVICE';

  const last = toMillis(sensor?.timestamp_utc);
  if (last === null) return 'OFFLINE';

  const age = Date.now() - last;
  return age >= 0 && age <= ONLINE_WINDOW_MS ? 'ONLINE' : 'OFFLINE';
}

const formatNumber = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n)
    ? '--'
    : n.toFixed(1);
};

const hasGps = (sensor) => {
  const lat = Number(sensor?.latitude);
  const lng = Number(sensor?.longitude);
  return (
    sensor?.latitude != null &&
    sensor?.longitude != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
};

// Card colour + pill text follow the dog's state
function getCardStyle(deviceStatus, risk) {
  if (deviceStatus === 'NO DEVICE') return { tone: tones.beige, label: 'No device' };
  if (deviceStatus === 'OFFLINE') return { tone: tones.beige, label: 'Offline' };
  if (risk === 'HIGH') return { tone: tones.salmon, label: 'High risk' };
  if (risk === 'MODERATE') return { tone: tones.amber, label: 'Moderate risk' };
  if (risk === 'LOW') return { tone: tones.green, label: 'Low risk' };
  return { tone: tones.beige, label: 'Unknown' };
}

// Most urgent first
const severity = (item) => {
  if (item.deviceStatus !== 'ONLINE') return 4;
  return { HIGH: 0, MODERATE: 1, LOW: 2 }[item.healthRisk] ?? 3;
};

export default function EventMonitoringScreen({ route }) {
  const { user, profile } = useAuth();

  const eventId = route?.params?.eventId;
  const eventName = route?.params?.eventName || 'Event monitoring';

  const [dogs, setDogs] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMonitoringData = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);

      if (!user || !eventId) {
        setDogs([]);
        setInitialLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        // Verify event ownership before loading monitoring information.
        const { data: event, error: eventError } = await supabase
          .from('events')
          .select('id, organizer_id')
          .eq('id', eventId)
          .maybeSingle();

        if (eventError) throw eventError;

        const isAdmin = profile?.role === 'system_admin';

        if (!event || (!isAdmin && event.organizer_id !== user.id)) {
          setDogs([]);
          Alert.alert(
            'Access denied',
            'You cannot monitor participants in this event.'
          );
          return;
        }

        // Only approved registrations are monitored.
        const { data: members, error: membersError } = await supabase
          .from('event_members')
          .select('id, dog_id, owner_id, status')
          .eq('event_id', eventId)
          .eq('status', 'approved');

        if (membersError) throw membersError;

        if (!members?.length) {
          setDogs([]);
          return;
        }

        const dogIds = [...new Set(members.map((m) => m.dog_id))];
        const ownerIds = [...new Set(members.map((m) => m.owner_id))];

        const [dogsResult, ownersResult] = await Promise.all([
          supabase.from('dogs').select('id, name, breed, age').in('id', dogIds),
          supabase.from('profiles').select('id, name').in('id', ownerIds),
        ]);

        if (dogsResult.error) throw dogsResult.error;
        if (ownersResult.error) throw ownersResult.error;

        const dogMap = new Map((dogsResult.data || []).map((d) => [d.id, d]));
        const ownerMap = new Map((ownersResult.data || []).map((o) => [o.id, o]));

        const { data: devices, error: devicesError } = await supabase
          .from('devices')
          .select('id, dog_id, status, firmware_version, battery_pct')
          .in('dog_id', dogIds);

        if (devicesError) throw devicesError;

        const deviceMap = new Map((devices || []).map((d) => [d.dog_id, d]));
        const deviceIds = (devices || []).map((d) => d.id);
        let readings = [];

        if (deviceIds.length > 0) {
          const { data, error } = await supabase
            .from('sensor_data')
            .select(`
              id,
              device_id,
              surface_temp,
              ambient_temp,
              humidity,
              timestamp_utc,
              latitude,
              longitude
            `)
            .in('device_id', deviceIds)
            .order('timestamp_utc', { ascending: false });

          if (error) throw error;
          readings = data || [];
        }

        // The first reading for each device is its newest reading.
        const latestReadingMap = new Map();
        for (const reading of readings) {
          if (!latestReadingMap.has(reading.device_id)) {
            latestReadingMap.set(reading.device_id, reading);
          }
        }

        const result = members.map((member) => {
          const dog = dogMap.get(member.dog_id) || null;
          const owner = ownerMap.get(member.owner_id) || null;
          const device = deviceMap.get(member.dog_id) || null;
          const sensor = device ? latestReadingMap.get(device.id) || null : null;
          const deviceStatus = getDeviceStatus(device, sensor);

          return {
            id: member.id,
            dog,
            owner,
            device,
            sensor,
            deviceStatus,
            // Stale readings are never judged (same rule as the owner dashboard)
            healthRisk:
              deviceStatus === 'ONLINE' ? calculateHealthRisk(sensor) : 'UNKNOWN',
          };
        });

        result.sort(
          (a, b) =>
            severity(a) - severity(b) ||
            (a.dog?.name || '').localeCompare(b.dog?.name || '')
        );

        setDogs(result);
      } catch (error) {
        console.error('Event monitoring error:', error);
        Alert.alert(
          'Unable to load monitoring data',
          error.message || 'Check your database permissions and try again.'
        );
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, eventId, profile?.role]
  );

  useFocusEffect(
    useCallback(() => {
      loadMonitoringData();
    }, [loadMonitoringData])
  );

  const openLocation = async (sensor) => {
    if (!hasGps(sensor)) {
      Alert.alert(
        'Location unavailable',
        'No valid GPS coordinates are available for this dog.'
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${Number(
      sensor.latitude
    )},${Number(sensor.longitude)}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open the map.');
    }
  };

  const renderDog = ({ item }) => {
    const { dog, owner, device, sensor, deviceStatus, healthRisk } = item;
    const { tone, label } = getCardStyle(deviceStatus, healthRisk);
    const online = deviceStatus === 'ONLINE';

    const subtitle = [owner?.name, dog?.breed].filter(Boolean).join('  ·  ');

    return (
      <View style={[styles.card, { backgroundColor: tone.bg }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardMeta, { color: tone.sub }]}>
            {device ? `Last reading ${timeAgo(toMillis(sensor?.timestamp_utc))}` : 'No device paired'}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>{label}</Text>
          </View>
        </View>

        <Text style={[styles.dogName, { color: tone.text }]} numberOfLines={1}>
          {dog?.name || 'Dog unavailable'}
        </Text>
        <Text style={[styles.subtitle, { color: tone.sub }]} numberOfLines={1}>
          {subtitle || 'Owner unavailable'}
        </Text>

        <View style={[styles.tiles, !online && styles.dimmed]}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Surface</Text>
            <Text style={styles.tileValue}>
              {formatNumber(sensor?.surface_temp)}
              <Text style={styles.tileUnit}>°C</Text>
            </Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Ambient</Text>
            <Text style={styles.tileValue}>
              {formatNumber(sensor?.ambient_temp)}
              <Text style={styles.tileUnit}>°C</Text>
            </Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Humidity</Text>
            <Text style={styles.tileValue}>
              {formatNumber(sensor?.humidity)}
              <Text style={styles.tileUnit}>%</Text>
            </Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.battery}>
            <Icon name="battery" size={16} color={tone.sub} />
            <Text style={[styles.batteryText, { color: tone.sub }]}>
              {device?.battery_pct != null
                ? `${Number(device.battery_pct)}%`
                : '--'}
            </Text>
          </View>

          {hasGps(sensor) ? (
            <TouchableOpacity
              style={styles.locationButton}
              activeOpacity={0.8}
              onPress={() => openLocation(sensor)}
            >
              <Icon name="navigate-outline" size={15} color={tone.text} />
              <Text style={[styles.locationText, { color: tone.text }]}>
                Open location
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.noGps, { color: tone.sub }]}>No GPS</Text>
          )}
        </View>
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
        <Text style={styles.title} numberOfLines={1}>
          {eventName}
        </Text>
        <Text style={styles.headingSub}>
          Approved dogs, most urgent first.
        </Text>
      </View>

      <FlatList
        data={dogs}
        keyExtractor={(item) => item.id}
        renderItem={renderDog}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dogs.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => loadMonitoringData({ pull: true })}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No approved participants are available to monitor yet.
          </Text>
        }
        ListFooterComponent={
          dogs.length > 0 ? (
            <Text style={styles.footnote}>
              Risk levels are preliminary alerts based on configured thresholds,
              not a veterinary diagnosis.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  heading: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  headingSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },

  card: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cardMeta: { flex: 1, fontFamily: fonts.regular, fontSize: 13, marginRight: 10 },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
  dogName: {
    fontFamily: fonts.medium,
    fontSize: 24,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 2,
    paddingHorizontal: 2,
  },

  tiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dimmed: { opacity: 0.5 },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tileLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.tileLabel,
  },
  tileValue: {
    fontFamily: fonts.medium,
    fontSize: 19,
    color: colors.ink,
    marginTop: 2,
  },
  tileUnit: { fontFamily: fonts.regular, fontSize: 13, color: colors.tileLabel },

  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batteryText: { fontFamily: fonts.medium, fontSize: 13 },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  locationText: { fontFamily: fonts.medium, fontSize: 13 },
  noGps: { fontFamily: fonts.regular, fontSize: 13 },
});