import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

export default function HistoryScreen() {
  const { profile } = useAuth();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadHistory() {
    setLoading(true);

    const {
      data: dogs,
    } = await supabase
      .from('dogs')
      .select('id')
      .eq('owner_id', profile.id)
      .limit(1);

    const dogId = dogs?.[0]?.id;

    if (!dogId) {
      setLoading(false);
      return;
    }

    const {
      data: device,
    } = await supabase
      .from('devices')
      .select('id')
      .eq('dog_id', dogId)
      .maybeSingle();

    if (!device) {
      setLoading(false);
      return;
    }

    const {
      data,
      error,
    } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('device_id', device.id)
      .order('timestamp_utc', {
        ascending: false,
      })
      .limit(30);

    if (!error) {
      setRecords(data || []);
    }

    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [profile.id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        Sensor History
      </Text>

      {records.length === 0 ? (
        <Text style={styles.empty}>
          No sensor data available yet.
        </Text>
      ) : (
        records.map((item) => (
          <View
            key={item.id}
            style={styles.card}
          >
            <Text style={styles.date}>
              {new Date(
                item.timestamp_utc
              ).toLocaleString()}
            </Text>

            <Text>
              Surface: {
                item.surface_temp ?? '--'
              } °C
            </Text>

            <Text>
              Ambient: {
                item.ambient_temp ?? '--'
              } °C
            </Text>

            <Text>
              Humidity: {
                item.humidity ?? '--'
              } %
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },

  date: {
    fontWeight: '700',
    marginBottom: 8,
  },

  empty: {
    color: '#666',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});