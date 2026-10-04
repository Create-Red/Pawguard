import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import MapView, { Marker } from 'react-native-maps';

import { useAuth } from '../../context/AuthContext';

import { supabase } from '../../config/supabase';

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

      const { data: device, error: deviceError } =
        await supabase
          .from('devices')
          .select('*')
          .eq('dog_id', dog.id)
          .maybeSingle();

      if (deviceError) {
        console.log(
          'DEVICE ERROR:',
          deviceError.message
        );

        return;
      }

      if (!device) {
        console.log('No device found for dog.');
        return;
      }

      // Get latest sensor/GPS reading

      const { data, error } =
        await supabase
          .from('sensor_data')
          .select('*')
          .eq('device_id', device.id)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('timestamp_utc', {
            ascending: false,
          })
          .limit(1)
          .maybeSingle();

      if (error) {

        console.log(
          'GPS DATA ERROR:',
          error.message
        );

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

      const { data: device } =
        await supabase
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

            if (
              newData.latitude != null &&
              newData.longitude != null
            ) {

              console.log(
                '📍 New GPS:',
                newData.latitude,
                newData.longitude
              );

              setSensor(newData);
            }
          }
        )
        .subscribe((status) => {

          console.log(
            'GPS Realtime:',
            status
          );

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
        <ActivityIndicator size="large" />

        <Text>
          Loading dog's location...
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------
  // No GPS
  // ---------------------------------------------------------

  if (
    !sensor ||
    sensor.latitude == null ||
    sensor.longitude == null
  ) {

    return (
      <View style={styles.center}>

        <Text style={styles.noGps}>
          📍 GPS location unavailable
        </Text>

        <Text>
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
          coordinate={{
            latitude,
            longitude,
          }}
          title={dog?.name || 'Your Dog'}
          description="PawGuard GPS location"
        />

      </MapView>

      {/* Bottom information panel */}

      <View style={styles.infoPanel}>

        <Text style={styles.dogName}>
          🐾 {dog?.name || 'Your Dog'}
        </Text>

        <Text>
          📍 {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>

        {sensor.satellites != null && (
          <Text>
            🛰 Satellites: {sensor.satellites}
          </Text>
        )}

        {sensor.altitude != null && (
          <Text>
            ⛰ Altitude: {Number(sensor.altitude).toFixed(1)} m
          </Text>
        )}

        <Text style={styles.updated}>
          Last update:{' '}
          {sensor.timestamp_utc
            ? new Date(
                sensor.timestamp_utc
              ).toLocaleString()
            : 'Unknown'}
        </Text>

      </View>

    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
  },

  map: {
    width: '100%',
    height: '100%',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  noGps: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },

  infoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,

    backgroundColor: 'white',

    borderRadius: 16,

    padding: 16,

    elevation: 5,

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  dogName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  updated: {
    marginTop: 8,
    fontSize: 12,
    color: '#777',
  },

});