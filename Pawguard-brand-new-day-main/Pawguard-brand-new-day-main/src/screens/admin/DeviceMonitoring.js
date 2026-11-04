
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

import { supabase } from '../../config/supabase';

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export default function DeviceMonitoringScreen() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDevices = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('devices')
        .select(`
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

      const formattedDevices = (data || []).map((device) => {
        const readings = device.sensor_data || [];

        const latestReading = readings.reduce(
          (latest, reading) => {
            if (!reading.timestamp_utc) return latest;

            if (
              !latest ||
              new Date(reading.timestamp_utc) >
                new Date(latest.timestamp_utc)
            ) {
              return reading;
            }

            return latest;
          },
          null
        );

        const lastSeen = latestReading?.timestamp_utc
          ? new Date(latestReading.timestamp_utc)
          : null;

        let deviceStatus = 'NO DATA';

        if (!device.dog_id) {
          deviceStatus = 'UNPAIRED';
        } else if (lastSeen) {
          deviceStatus =
            now - lastSeen.getTime() <= ONLINE_WINDOW_MS
              ? 'ONLINE'
              : 'OFFLINE';
        }

        return {
          ...device,
          lastSeen,
          deviceStatus,
        };
      });

      setDevices(formattedDevices);
    } catch (error) {
      console.error('Device monitoring error:', error);

      Alert.alert(
        'Error',
        error.message || 'Unable to load device information.'
      );
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

  const counts = {
    total: devices.length,
    online: devices.filter(d => d.deviceStatus === 'ONLINE').length,
    offline: devices.filter(d => d.deviceStatus === 'OFFLINE').length,
    noData: devices.filter(d => d.deviceStatus === 'NO DATA').length,
    unpaired: devices.filter(d => d.deviceStatus === 'UNPAIRED').length,
  };

  const formatLastSeen = (date) => {
    if (!date) return 'No readings received';

    return date.toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ONLINE':
        return '#16A34A';
      case 'OFFLINE':
        return '#DC2626';
      case 'UNPAIRED':
        return '#D97706';
      default:
        return '#64748B';
    }
  };

  const StatCard = ({ label, value, color }) => (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const DeviceCard = ({ device }) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceUid}>
            {device.device_uid || 'Unknown Device'}
          </Text>

          <Text style={styles.firmware}>
            Firmware: {device.firmware_version || 'Unknown'}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(device.deviceStatus) },
          ]}
        >
          <Text style={styles.statusText}>
            {device.deviceStatus}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Assigned dog</Text>
        <Text style={styles.infoValue}>
          {device.dogs?.name || 'Not assigned'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Owner</Text>
        <Text style={styles.infoValue}>
          {device.dogs?.profiles?.name || 'Not available'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Battery</Text>
        <Text style={styles.infoValue}>
          {device.battery_pct != null
            ? `${Number(device.battery_pct)}%`
            : 'No battery data'}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Last communication</Text>
        <Text style={styles.infoValue}>
          {formatLastSeen(device.lastSeen)}
        </Text>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDevices(true)}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Device Monitoring</Text>
        <Text style={styles.subtitle}>
          Monitor all registered PawGuard devices.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#2563EB"
          style={{ marginTop: 40 }}
        />
      ) : (
        <>
          <Text style={styles.sectionTitle}>Device Overview</Text>

          <View style={styles.statsGrid}>
            <StatCard
              label="Total Devices"
              value={counts.total}
              color="#172033"
            />
            <StatCard
              label="Online"
              value={counts.online}
              color="#16A34A"
            />
            <StatCard
              label="Offline"
              value={counts.offline}
              color="#DC2626"
            />
            <StatCard
              label="No Data Yet"
              value={counts.noData}
              color="#64748B"
            />
            <StatCard
              label="Unpaired"
              value={counts.unpaired}
              color="#D97706"
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Registered Devices
            </Text>
            <Text style={styles.deviceCount}>
              {devices.length} devices
            </Text>
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No registered devices found.
              </Text>
            </View>
          ) : (
            devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
              />
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 25,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#172033',
  },
  subtitle: {
    fontSize: 13,
    color: '#687386',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 1,
  },
  statValue: {
    fontSize: 25,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    color: '#687386',
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCount: {
    fontSize: 12,
    color: '#687386',
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 15,
    marginBottom: 12,
    elevation: 1,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceUid: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172033',
  },
  firmware: {
    fontSize: 12,
    color: '#687386',
    marginTop: 5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#687386',
    flex: 1,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#172033',
    flex: 1,
    textAlign: 'right',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 25,
    borderRadius: 14,
  },
  emptyText: {
    color: '#687386',
    textAlign: 'center',
  },
});
