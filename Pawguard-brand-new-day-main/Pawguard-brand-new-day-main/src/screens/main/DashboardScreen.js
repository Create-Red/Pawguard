import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

// Bare React Native: import Ionicons from 'react-native-vector-icons/Ionicons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { calculateHealthRisk } from '../../utils/healthRisk';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';
import { registerForPushNotifications } from '../../utils/registerForPush';
import { getSelectedDogId, setSelectedDogId } from '../../utils/selectedDog';

const OFFLINE_AFTER_MS = 2 * 60 * 1000;
const UNREAD_REFRESH_MS = 15 * 1000;
const OFFLINE_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

const toMillis = (ts) => {
  if (!ts) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const ms = new Date(hasZone ? ts : `${ts}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const timeAgo = (ms, now) => {
  if (!ms) return 'No data yet';
  const sec = Math.max(0, Math.floor((now - ms) / 1000));
  if (sec < 10) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} d ago`;
};

// Small tile like "Time / Venue" in the reference
function InfoTile({ label, value, unit }) {
  const empty = value === null || value === undefined || value === '--';
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>
        {empty ? '--' : value}
        {!empty && <Text style={styles.tileUnit}>{unit}</Text>}
      </Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { profile } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [selectedDog, setSelectedDog] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [unreadCount, setUnreadCount] = useState(0);

  const lastAlertRisk = useRef(null);
  const offlineNotified = useRef(false);

  // ---- Device status -------------------------------------------------
  const lastSeen = toMillis(sensor?.timestamp_utc);
  const isPaired = !!device;
  const isOnline =
    isPaired && lastSeen !== null && now - lastSeen <= OFFLINE_AFTER_MS;

  let status = 'Online';
  if (!isPaired) status = 'Not paired';
  else if (!isOnline) status = 'Offline';

  const riskLevel = isOnline ? calculateHealthRisk(sensor) : 'UNKNOWN';

  // Card colour + pill text follow the pet's state
  let tone = tones.beige;
  let pillText = status;
  if (isOnline) {
    if (riskLevel === 'HIGH') {
      tone = tones.salmon;
      pillText = 'High risk';
    } else if (riskLevel === 'MODERATE') {
      tone = tones.amber;
      pillText = 'Moderate risk';
    } else {
      tone = tones.green;
      pillText = 'Low risk';
    }
  }

  useEffect(() => {
    if (profile?.id) registerForPushNotifications(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // ---- Unread notification count (bell badge) -------------------------
  const fetchUnreadCount = async () => {
    if (!profile?.id) return;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    if (!error) setUnreadCount(count || 0);
  };

  useEffect(() => {
    if (!profile?.id) return;
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, UNREAD_REFRESH_MS);
    return () => clearInterval(timer);
  }, [profile?.id]);

  // ---- Data loading --------------------------------------------------
  const loadDogData = async (dog) => {
    setDevice(null);
    setSensor(null);

    const { data: deviceData } = await supabase
      .from('devices')
      .select('*')
      .eq('dog_id', dog.id)
      .maybeSingle();

    setDevice(deviceData);

    if (!deviceData) return;

    const { data: sensorData } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('device_id', deviceData.id)
      .order('timestamp_utc', { ascending: false })
      .limit(1)
      .maybeSingle();

    setSensor(sensorData);
  };

  const loadDashboard = async () => {
    setLoading(true);

    const { data: dogData, error: dogError } = await supabase
      .from('dogs')
      .select('*')
      .order('created_at', { ascending: true });

    if (dogError) {
      console.log(dogError.message);
      setLoading(false);
      return;
    }

    if (!dogData || dogData.length === 0) {
      setDogs([]);
      setSelectedDog(null);
      setLoading(false);
      return;
    }

    setDogs(dogData);

    const currentDog = dogData.find((item) => item.id === getSelectedDogId());
    const dogToUse = currentDog || dogData[0];

    setSelectedDogId(dogToUse.id);
    setSelectedDog(dogToUse);
    await loadDogData(dogToUse);

    setLoading(false);
  };

  // ---- Realtime ------------------------------------------------------
  useEffect(() => {
    if (!device?.id) return;

    const channel = supabase
      .channel(`sensor-data-${device.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_data',
          filter: `device_id=eq.${device.id}`,
        },
        (payload) => {
          setSensor(payload.new);
          setNow(Date.now());
        }
      )
      .subscribe((s) => console.log('Realtime status:', s));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [device?.id]);

  // ---- Health alerts -------------------------------------------------
  const createHealthAlert = async (dog, reading, level) => {
    if (!dog || !reading) return;
    if (level !== 'HIGH' && level !== 'MODERATE') return;
    if (lastAlertRisk.current === level) return;

    lastAlertRisk.current = level;

    const { error } = await supabase.from('health_alerts').insert({
      dog_id: dog.id,
      type: level === 'HIGH' ? 'HIGH_RISK' : 'MODERATE_RISK',
      reading_value: {
        surface_temp: reading.surface_temp,
        ambient_temp: reading.ambient_temp,
        humidity: reading.humidity,
      },
    });

    if (error) {
      console.log('HEALTH ALERT ERROR:', error.message);
      lastAlertRisk.current = null;
      return;
    }

    setTimeout(fetchUnreadCount, 800);
  };

  useEffect(() => {
    if (!selectedDog || !sensor) return;

    if (riskLevel === 'LOW' || riskLevel === 'UNKNOWN') {
      lastAlertRisk.current = null;
      return;
    }

    createHealthAlert(selectedDog, sensor, riskLevel);
  }, [selectedDog?.id, sensor?.id, riskLevel]);

  useEffect(() => {
    lastAlertRisk.current = null;
    offlineNotified.current = false;
  }, [selectedDog?.id]);

  // ---- Device offline notification -----------------------------------
  const createOfflineNotification = async (dog) => {
    if (!profile?.id) return;

    const since = new Date(
      Date.now() - OFFLINE_NOTIFY_COOLDOWN_MS
    ).toISOString();

    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', profile.id)
      .eq('dog_id', dog.id)
      .eq('type', 'DEVICE_OFFLINE')
      .gte('created_at', since)
      .limit(1);

    if (existing && existing.length > 0) return;

    const { error } = await supabase.from('notifications').insert({
      user_id: profile.id,
      dog_id: dog.id,
      type: 'DEVICE_OFFLINE',
      message: `${dog.name}'s device has stopped sending data. Check that it is on and charged.`,
      is_read: false,
    });

    if (error) {
      console.log('OFFLINE NOTIFICATION ERROR:', error.message);
      offlineNotified.current = false;
      return;
    }

    fetchUnreadCount();
  };

  useEffect(() => {
    if (status === 'Online') {
      offlineNotified.current = false;
      return;
    }

    if (status !== 'Offline' || lastSeen === null) return;
    if (!selectedDog || offlineNotified.current) return;

    offlineNotified.current = true;
    createOfflineNotification(selectedDog);
  }, [status, lastSeen, selectedDog?.id]);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        loadDashboard();
        fetchUnreadCount();
      }
    }, [profile?.id])
  );

  // ---- Empty state ---------------------------------------------------
  if (dogs.length === 0 && !loading) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: tones.green.bg }]}>
          <Ionicons name="paw" size={40} color={tones.green.text} />
        </View>
        <Text style={styles.emptyTitle}>No pet registered</Text>
        <Text style={styles.emptyText}>
          Register your pet to start using PawGuard.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, styles.emptyButton]}
          onPress={() => navigation.navigate('RegisterPet')}
        >
          <Text style={styles.primaryButtonText}>Register pet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Main UI -------------------------------------------------------
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          tintColor={colors.ink}
          colors={[colors.ink]}
          onRefresh={() => {
            loadDashboard();
            fetchUnreadCount();
          }}
        />
      }
    >
      {/* Header: brand left, icon pill right */}
      <View style={styles.topHeader}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>PawGuard</Text>
          <View style={styles.brandDot} />
        </View>

        <View style={styles.iconPill}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('RegisterPet')}
            accessibilityLabel="Add pet"
          >
            <Ionicons name="add" size={20} color={colors.ink} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications')}
            accessibilityLabel={
              unreadCount > 0
                ? `Open notifications, ${unreadCount} unread`
                : 'Open notifications'
            }
          >
            <Ionicons name="notifications" size={18} color={colors.ink} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.title}>My pets</Text>

      {/* Pet selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
      >
        {dogs.map((item) => {
          const active = selectedDog?.id === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setSelectedDogId(item.id);
                setSelectedDog(item);
                loadDogData(item);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Pastel pet card: pet + device status + risk in one place */}
      {selectedDog && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.petCard, { backgroundColor: tone.bg }]}
          onPress={() =>
            navigation.navigate('DogProfile', { dogId: selectedDog.id })
          }
        >
          <View style={styles.cardTop}>
            <Text style={[styles.cardMeta, { color: tone.sub }]}>
              {isPaired ? `Last data ${timeAgo(lastSeen, now)}` : 'No device yet'}
            </Text>
            <View style={[styles.statusPill, { backgroundColor: tone.pill }]}>
              <Text style={[styles.statusPillText, { color: tone.pillText }]}>
                {pillText}
              </Text>
            </View>
          </View>

          <Text style={[styles.petName, { color: tone.text }]} numberOfLines={1}>
            {selectedDog.name}
          </Text>

          <View style={styles.cardBottom}>
            <Text style={[styles.petInfo, { color: tone.sub }]} numberOfLines={1}>
              {selectedDog.breed || 'Unknown breed'}
              {selectedDog.age ? `  •  ${selectedDog.age} yrs` : ''}
            </Text>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() =>
                navigation.navigate('EditPet', { dogId: selectedDog.id })
              }
              accessibilityLabel="Edit pet"
            >
              <Ionicons name="create-outline" size={18} color={tone.text} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}

      {/* Readings (like "Event Details" + Time/Venue tiles) */}
      <Text style={styles.sectionTitle}>
        {isOnline ? 'Live readings' : 'Last known readings'}
      </Text>

      <View style={[styles.tiles, !isOnline && styles.dimmed]}>
        <InfoTile label="Surface" value={sensor?.surface_temp} unit="°C" />
        <InfoTile label="Ambient" value={sensor?.ambient_temp} unit="°C" />
        <InfoTile label="Humidity" value={sensor?.humidity} unit="%" />
      </View>

      {/* One primary action, like "Register" */}
      {selectedDog && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            isPaired
              ? navigation.navigate('Map', { dog: selectedDog })
              : navigation.navigate('PairDevice', { dogId: selectedDog.id })
          }
        >
          <Text style={styles.primaryButtonText}>
            {isPaired ? 'View location' : 'Pair device'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  brandText: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#8fd14f',
    marginLeft: 3,
    marginBottom: 7,
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 20,
    backgroundColor: colors.pill,
  },
  iconButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontFamily: fonts.bold,
  },

  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginTop: 36,
    marginBottom: 16,
  },

  // Chips
  chips: {
    flexGrow: 0,
    marginBottom: 20,
  },
  chip: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    marginRight: 10,
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

  // Pastel card
  petCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    minHeight: 170,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
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
  petName: {
    fontFamily: fonts.medium,
    fontSize: 26,
    marginTop: 22,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  petInfo: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    marginRight: 12,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Readings
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  dimmed: {
    opacity: 0.5,
  },
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
    fontSize: 19,
    color: colors.ink,
    marginTop: 4,
  },
  tileUnit: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.tileLabel,
  },

  // Button
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.white,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.white,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    fontSize: 24,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginTop: 8,
    color: colors.muted,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: 28,
  },
});