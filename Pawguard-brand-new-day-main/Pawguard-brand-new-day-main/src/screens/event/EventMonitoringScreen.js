
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
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

function getHealthRisk(sensor) {
  if (!sensor) return 'UNKNOWN';

  const temp = Number(sensor.surface_temp);
  const humidity = Number(sensor.humidity);

  if (
    !Number.isFinite(temp) ||
    !Number.isFinite(humidity)
  ) {
    return 'UNKNOWN';
  }

  if (
    temp >= 40 ||
    temp <= 35 ||
    humidity >= 80 ||
    humidity <= 35
  ) {
    return 'HIGH';
  }

  if (
    temp >= 39 ||
    temp <= 36 ||
    humidity >= 70 ||
    humidity <= 45
  ) {
    return 'MODERATE';
  }

  return 'LOW';
}

function formatValue(value, unit) {
  if (value === null || value === undefined || value === '') {
    return 'Unavailable';
  }

  const number = Number(value);
  return Number.isFinite(number)
    ? `${number.toFixed(1)}${unit}`
    : 'Unavailable';
}

function getDeviceStatus(device, sensor) {
  if (!device) return 'NO DEVICE';
  if (!sensor?.timestamp_utc) return 'OFFLINE';

  const lastReading = new Date(sensor.timestamp_utc).getTime();

  if (!Number.isFinite(lastReading)) return 'OFFLINE';

  const age = Date.now() - lastReading;

  return age >= 0 && age <= ONLINE_WINDOW_MS
    ? 'ONLINE'
    : 'OFFLINE';
}

export default function EventMonitoringScreen({ route }) {
  const { user, profile } = useAuth();

  const eventId = route?.params?.eventId;
  const eventName = route?.params?.eventName || 'Event Monitoring';

  const [dogs, setDogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMonitoringData = useCallback(async () => {
    if (!user || !eventId) {
      setDogs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // Verify event ownership before loading monitoring information.
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, organizer_id')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;

      const isAdmin = profile?.role === 'system_admin';

      if (
        !event ||
        (!isAdmin && event.organizer_id !== user.id)
      ) {
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
        supabase
          .from('dogs')
          .select('id, name, breed, age')
          .in('id', dogIds),

        supabase
          .from('profiles')
          .select('id, name')
          .in('id', ownerIds),
      ]);

      if (dogsResult.error) throw dogsResult.error;
      if (ownersResult.error) throw ownersResult.error;

      const dogMap = new Map(
        (dogsResult.data || []).map((dog) => [dog.id, dog])
      );

      const ownerMap = new Map(
        (ownersResult.data || []).map((owner) => [owner.id, owner])
      );

      const { data: devices, error: devicesError } = await supabase
        .from('devices')
        .select('id, dog_id, status, firmware_version, battery_pct')
        .in('dog_id', dogIds);

      if (devicesError) throw devicesError;

      const deviceMap = new Map(
        (devices || []).map((device) => [device.dog_id, device])
      );

      const deviceIds = (devices || []).map((device) => device.id);
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
            longitude,
            altitude,
            satellites
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
        const sensor = device
          ? latestReadingMap.get(device.id) || null
          : null;

        return {
          id: member.id,
          dogId: member.dog_id,
          dog,
          owner,
          device,
          sensor,
          deviceStatus: getDeviceStatus(device, sensor),
          healthRisk: getHealthRisk(sensor),
        };
      });

      setDogs(result);
    } catch (error) {
      console.error('Event monitoring error:', error);
      Alert.alert(
        'Unable to load monitoring data',
        error.message || 'Check your database permissions and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, eventId, profile?.role]);

  useFocusEffect(
    useCallback(() => {
      loadMonitoringData();
    }, [loadMonitoringData])
  );

  const openLocation = async (sensor) => {
    const latitude = Number(sensor?.latitude);
    const longitude = Number(sensor?.longitude);

    if (
      !sensor ||
      sensor.latitude == null ||
      sensor.longitude == null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      (latitude === 0 && longitude === 0)
    ) {
      Alert.alert(
        'Location unavailable',
        'No valid GPS coordinates are available for this dog.'
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open the map.');
    }
  };

  const riskStyle = (risk) => {
    if (risk === 'HIGH') return styles.highBadge;
    if (risk === 'MODERATE') return styles.moderateBadge;
    if (risk === 'LOW') return styles.lowBadge;
    return styles.unknownBadge;
  };

  const renderDog = ({ item }) => {
    const { dog, owner, device, sensor, deviceStatus, healthRisk } = item;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.dogName}>
              {dog?.name || 'Dog information unavailable'}
            </Text>
            <Text style={styles.owner}>
              Owner: {owner?.name || 'Owner information unavailable'}
            </Text>
            {dog?.breed ? (
              <Text style={styles.detail}>Breed: {dog.breed}</Text>
            ) : null}
            {dog?.age != null ? (
              <Text style={styles.detail}>Age: {dog.age}</Text>
            ) : null}
          </View>

          <View
            style={[
              styles.statusBadge,
              deviceStatus === 'ONLINE'
                ? styles.onlineBadge
                : styles.offlineBadge,
            ]}
          >
            <Text style={styles.badgeText}>{deviceStatus}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Device</Text>
          <Text style={styles.detail}>
            Battery: {device?.battery_pct != null
              ? `${Number(device.battery_pct)}%`
              : 'Unavailable'}
          </Text>
          <Text style={styles.detail}>
            Firmware: {device?.firmware_version || 'Unavailable'}
          </Text>
          <Text style={styles.detail}>
            Device status field: {device?.status || 'No device'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Latest readings</Text>

          <Text style={styles.detail}>
            Surface temperature: {formatValue(sensor?.surface_temp, '°C')}
          </Text>
          <Text style={styles.detail}>
            Ambient temperature: {formatValue(sensor?.ambient_temp, '°C')}
          </Text>
          <Text style={styles.detail}>
            Humidity: {formatValue(sensor?.humidity, '%')}
          </Text>
          <Text style={styles.detail}>
            Last reading: {sensor?.timestamp_utc
              ? new Date(sensor.timestamp_utc).toLocaleString()
              : 'No readings available'}
          </Text>

          <View style={styles.riskRow}>
            <Text style={styles.sectionTitle}>Temperature / humidity risk</Text>
            <View style={[styles.statusBadge, riskStyle(healthRisk)]}>
              <Text style={styles.badgeText}>{healthRisk}</Text>
            </View>
          </View>

          {healthRisk === 'UNKNOWN' ? (
            <Text style={styles.note}>
              Risk cannot be assessed without valid sensor readings.
            </Text>
          ) : (
            <Text style={styles.note}>
              This is a preliminary alert based on configured thresholds,
              not a veterinary diagnosis.
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GPS location</Text>

          {sensor?.latitude != null && sensor?.longitude != null ? (
            <>
              <Text style={styles.detail}>
                Latitude: {sensor.latitude}
              </Text>
              <Text style={styles.detail}>
                Longitude: {sensor.longitude}
              </Text>
              {sensor.altitude != null ? (
                <Text style={styles.detail}>
                  Altitude: {sensor.altitude} m
                </Text>
              ) : null}
              {sensor.satellites != null ? (
                <Text style={styles.detail}>
                  Satellites: {sensor.satellites}
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => openLocation(sensor)}
              >
                <Text style={styles.buttonText}>Open GPS Location</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.note}>GPS location unavailable.</Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#237A57" />
        <Text style={styles.note}>Loading event monitoring...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{eventName}</Text>
      <Text style={styles.subtitle}>
        Approved participants and their latest available device data.
      </Text>

      <FlatList
        data={dogs}
        keyExtractor={(item) => item.id}
        renderItem={renderDog}
        contentContainerStyle={
          dogs.length === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMonitoringData();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No approved participants are available to monitor yet.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7F6',
  },
  title: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#183D2B',
  },
  subtitle: {
    color: '#666666',
    marginTop: 5,
    marginBottom: 16,
  },
  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#666666',
    textAlign: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8E4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  dogName: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#183D2B',
  },
  owner: {
    color: '#555555',
    marginTop: 5,
  },
  detail: {
    color: '#444444',
    marginTop: 5,
    fontSize: 13,
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#E8ECE9',
    marginTop: 14,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#183D2B',
    marginBottom: 5,
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#26352B',
  },
  onlineBadge: {
    backgroundColor: '#D9F3E3',
  },
  offlineBadge: {
    backgroundColor: '#E8E8E8',
  },
  highBadge: {
    backgroundColor: '#F8D7DA',
  },
  moderateBadge: {
    backgroundColor: '#FFF0C2',
  },
  lowBadge: {
    backgroundColor: '#D9F3E3',
  },
  unknownBadge: {
    backgroundColor: '#E8E8E8',
  },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  note: {
    color: '#777777',
    fontSize: 12,
    marginTop: 7,
    lineHeight: 17,
  },
  mapButton: {
    backgroundColor: '#237A57',
    padding: 11,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
