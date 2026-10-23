import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import MapView, { Marker } from 'react-native-maps';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

export default function MapScreen({ route }) {
  const dog = route?.params?.dog;

  const [sensor, setSensor] = useState(null);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------
  // Load latest GPS location
  // ---------------------------------------------------------

  const loadLatestLocation = async () => {
    if (!dog?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get device for this dog
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('*')
        .eq('dog_id', dog.id)
        .maybeSingle();

      if (deviceError) {
        console.log('DEVICE ERROR:', deviceError.message);
        return;
      }

      if (!device) {
        console.log('No device found for dog.');
        return;
      }

      // Get latest sensor/GPS reading
      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .eq('device_id', device.id)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('timestamp_utc', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log('GPS DATA ERROR:', error.message);
        return;
      }

      setSensor(data);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------

  useEffect(() => {
    loadLatestLocation();
  }, [dog?.id]);

  // ---------------------------------------------------------
  // Realtime GPS updates
  // ---------------------------------------------------------

  useEffect(() => {
    if (!dog?.id) return;

    let channel;

    const setupRealtime = async () => {
      const { data: device } = await supabase
        .from('devices')
        .select('id')
        .eq('dog_id', dog.id)
        .maybeSingle();

      if (!device) return;

      channel = supabase
        .channel(`gps-${device.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'sensor_data',
            filter: `device_id=eq.${device.id}`,
          },
          (payload) => {
            const newData = payload.new;

            // Only update map if GPS exists
            if (newData.latitude != null && newData.longitude != null) {
              console.log('📍 New GPS:', newData.latitude, newData.longitude);
              setSensor(newData);
            }
          }
        )
        .subscribe((status) => {
          console.log('GPS Realtime:', status);
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [dog?.id]);

  // ---------------------------------------------------------
  // Loading
  // ---------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Loading location...</Text>
      </View>
    );
  }

  // ---------------------------------------------------------
  // No GPS
  // ---------------------------------------------------------

  if (!sensor || sensor.latitude == null || sensor.longitude == null) {
    return (
      <View style={styles.center}>
        <View style={[styles.emptyIcon, { backgroundColor: tones.beige.bg }]}>
          <Ionicons name="location-outline" size={40} color={tones.beige.pillText} />
        </View>
        <Text style={styles.emptyTitle}>Location unavailable</Text>
        <Text style={styles.emptyText}>
          Waiting for the device to send GPS data.
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------
  // Map
  // ---------------------------------------------------------

  const latitude = Number(sensor.latitude);
  const longitude = Number(sensor.longitude);

  const tone = tones.green;

  const extras = [];
  if (sensor.satellites != null) extras.push(`${sensor.satellites} satellites`);
  if (sensor.altitude != null) {
    extras.push(`${Number(sensor.altitude).toFixed(1)} m altitude`);
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={{ latitude, longitude }}
          title={dog?.name || 'Your Dog'}
          description="PawGuard GPS location"
          pinColor={colors.ink}
        />
      </MapView>

      {/* Bottom pastel panel */}
      <View style={[styles.infoPanel, { backgroundColor: tone.bg }]}>
        <View style={styles.panelTop}>
          <Text style={[styles.updated, { color: tone.sub }]} numberOfLines={1}>
            {sensor.timestamp_utc
              ? new Date(sensor.timestamp_utc).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Unknown time'}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>Live</Text>
          </View>
        </View>

        <Text style={[styles.dogName, { color: tone.text }]} numberOfLines={1}>
          {dog?.name || 'Your Dog'}
        </Text>

        {extras.length > 0 && (
          <Text style={[styles.extras, { color: tone.sub }]}>
            {extras.join('  •  ')}
          </Text>
        )}

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Latitude</Text>
            <Text style={styles.tileValue}>{latitude.toFixed(6)}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileLabel}>Longitude</Text>
            <Text style={styles.tileValue}>{longitude.toFixed(6)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  map: {
    width: '100%',
    height: '100%',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.regular,
    color: colors.muted,
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
    fontSize: 22,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginTop: 8,
    color: colors.muted,
  },

  infoPanel: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  panelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updated: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginRight: 10,
  },
  pill: {
    paddingHorizontal: 14,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  dogName: {
    fontFamily: fonts.medium,
    fontSize: 26,
    marginTop: 14,
  },
  extras: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
    paddingVertical: 12,
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
    fontSize: 16,
    color: colors.ink,
    marginTop: 2,
  },
});