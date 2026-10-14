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

import SensorCard from '../../components/SensorCard';
import RiskBadge from '../../components/RiskBadge';

/**
 * If the newest reading is older than this, the device is "Offline".
 * Set it to roughly 3x how often your device sends data.
 * (e.g. device sends every 30s -> 90 seconds)
 */
const OFFLINE_AFTER_MS = 2 * 60 * 1000;

// Supabase "timestamp without time zone" columns come back without a "Z",
// which JS would read as LOCAL time and break the offline check.
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

export default function DashboardScreen({ navigation }) {
  const { profile } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [selectedDog, setSelectedDog] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const lastAlertRisk = useRef(null);

  // ---- Device status -------------------------------------------------
  const lastSeen = toMillis(sensor?.timestamp_utc);
  const isPaired = !!device;
  const isOnline =
    isPaired && lastSeen !== null && now - lastSeen <= OFFLINE_AFTER_MS;

  let status = 'Online';
  if (!isPaired) status = 'Not paired';
  else if (!isOnline) status = 'Offline';

  const statusColor =
    status === 'Online'
      ? '#22a45d'
      : status === 'Offline'
      ? '#e5484d'
      : '#9aa0a6';

  // Don't judge health from stale data
  const riskLevel = isOnline ? calculateHealthRisk(sensor) : 'UNKNOWN';

  // Re-check every 5s so the status flips to Offline even if no new data arrives
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

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

    const currentDog =
      selectedDog && dogData.find((item) => item.id === selectedDog.id);
    const dogToUse = currentDog || dogData[0];

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
    if (lastAlertRisk.current === level) return; // avoid duplicates

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
      lastAlertRisk.current = null; // allow retry
    }
  };

  useEffect(() => {
    if (!selectedDog || !sensor) return;

    if (riskLevel === 'LOW' || riskLevel === 'UNKNOWN') {
      lastAlertRisk.current = null;
      return;
    }

    createHealthAlert(selectedDog, sensor, riskLevel);
  }, [selectedDog?.id, sensor?.id, riskLevel]);

  // Reset alert dedupe when switching dogs
  useEffect(() => {
    lastAlertRisk.current = null;
  }, [selectedDog?.id]);

  useFocusEffect(
    useCallback(() => {
      if (profile?.id) loadDashboard();
    }, [profile?.id])
  );

  // ---- Empty state ---------------------------------------------------
  if (dogs.length === 0 && !loading) {
    return (
      <View style={styles.empty}>
        <Ionicons name="paw" size={56} color="#111827" style={styles.emptyIcon} />
        <Text style={styles.emptyTitle}>No pet registered</Text>
        <Text style={styles.emptyText}>
          Register your pet to start using PawGuard.
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
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
        <RefreshControl refreshing={loading} onRefresh={loadDashboard} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.name}</Text>
          <Text style={styles.title}>PawGuard</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('RegisterPet')}
        >
          <Text style={styles.addButtonText}>+ Add pet</Text>
        </TouchableOpacity>
      </View>

      {/* Pet selector */}
      {dogs.length > 1 && (
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
      )}

      {/* Pet card */}
      {selectedDog && (
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate('DogProfile', { dogId: selectedDog.id })
            }
          >
            <View style={styles.petNameRow}>
              <Ionicons name="paw" size={22} color="#111827" />
              <Text style={styles.petName}>{selectedDog.name}</Text>
            </View>
            <Text style={styles.petInfo}>
              {selectedDog.breed || 'Unknown breed'}
              {selectedDog.age ? ` • ${selectedDog.age} years old` : ''}
            </Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('Map', { dog: selectedDog })
              }
            >
              <Ionicons name="location-outline" size={16} color="#111827" />
              <Text style={styles.actionText}>Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('EditPet', { dogId: selectedDog.id })
              }
            >
              <Ionicons name="create-outline" size={16} color="#111827" />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() =>
                navigation.navigate('DogProfile', { dogId: selectedDog.id })
              }
            >
              <Ionicons name="person-outline" size={16} color="#111827" />
              <Text style={styles.actionText}>Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Device */}
      <Text style={styles.sectionTitle}>Device</Text>
      <View style={[styles.card, styles.deviceCard]}>
        <View>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.deviceStatus, { color: statusColor }]}>
              {status}
            </Text>
          </View>
          {isPaired && (
            <Text style={styles.lastSeen}>
              Last data: {timeAgo(lastSeen, now)}
            </Text>
          )}
        </View>

        {!isPaired && selectedDog && (
          <TouchableOpacity
            style={styles.primaryButtonSmall}
            onPress={() =>
              navigation.navigate('PairDevice', { dogId: selectedDog.id })
            }
          >
            <Text style={styles.primaryButtonText}>Pair device</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Readings */}
      <Text style={styles.sectionTitle}>
        {isOnline ? 'Current readings' : 'Last known readings'}
      </Text>

      <View style={!isOnline && styles.dimmed}>
        <View style={styles.row}>
          <SensorCard
            title="Surface Temp"
            value={sensor?.surface_temp ?? '--'}
            unit="°C"
            icon={<Ionicons name="thermometer-outline" size={22} color="#111827" />}
          />
          <SensorCard
            title="Ambient Temp"
            value={sensor?.ambient_temp ?? '--'}
            unit="°C"
            icon={<Ionicons name="partly-sunny-outline" size={22} color="#111827" />}
          />
        </View>

        <View style={styles.row}>
          <SensorCard
            title="Humidity"
            value={sensor?.humidity ?? '--'}
            unit="%"
            icon={<Ionicons name="water-outline" size={22} color="#111827" />}
          />
        </View>
      </View>

      <View style={styles.risk}>
        <RiskBadge level={riskLevel} />
      </View>

      {sensor?.timestamp_utc && (
        <Text style={styles.updated}>
          Last updated: {new Date(lastSeen).toLocaleString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 15,
    color: '#6b7280',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#111827',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Pet chips
  chips: {
    marginBottom: 14,
  },
  chip: {
    backgroundColor: '#fff',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  chipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chipText: {
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#fff',
  },

  // Cards
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eef0f3',
  },
  petNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  petName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  petInfo: {
    marginTop: 4,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },

  // Sections
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    marginBottom: 10,
  },

  // Device
  deviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  deviceStatus: {
    fontSize: 20,
    fontWeight: '700',
  },
  lastSeen: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13,
  },

  // Readings
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dimmed: {
    opacity: 0.5,
  },
  risk: {
    marginTop: 4,
  },
  updated: {
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
    fontSize: 12,
  },

  // Buttons
  primaryButton: {
    backgroundColor: '#111827',
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 20,
  },
  primaryButtonSmall: {
    backgroundColor: '#111827',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f6f7f9',
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 8,
    color: '#6b7280',
  },
});