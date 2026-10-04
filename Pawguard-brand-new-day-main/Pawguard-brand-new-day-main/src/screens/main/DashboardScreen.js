import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import {
  calculateHealthRisk,
} from '../../utils/healthRisk';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

import SensorCard from '../../components/SensorCard';
import RiskBadge from '../../components/RiskBadge';

export default function DashboardScreen({
  navigation,
}) {
  const { profile } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [selectedDog, setSelectedDog] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastAlertRisk, setLastAlertRisk] = useState(null);
  const riskLevel = calculateHealthRisk(sensor);



  const loadDogData = async (dog) => {
  setDevice(null);
  setSensor(null);

  const { data: deviceData } = await supabase
    .from('devices')
    .select('*')
    .eq('dog_id', dog.id)
    .maybeSingle();

  setDevice(deviceData);

  if (!deviceData) {
    return;
  }
  

  const { data: sensorData } = await supabase
    .from('sensor_data')
    .select('*')
    .eq('device_id', deviceData.id)
    .order('timestamp_utc', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  setSensor(sensorData);
};

useEffect(() => {
  if (!device?.id) {
    return;
  }

  console.log(
    '🔴 Starting Realtime for device:',
    device.id
  );

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
        console.log(
          '📡 New sensor reading:',
          payload.new
        );

        setSensor(payload.new);
      }
    )
    .subscribe((status) => {
      console.log(
        'Realtime status:',
        status
      );
    });

  return () => {
    console.log(
      '🔴 Removing Realtime subscription'
    );

    supabase.removeChannel(channel);
  };
}, [device?.id]);

  const loadDashboard = async () => {
    setLoading(true);

    const {
      data: dogData,
      error: dogError,
    } = await supabase
      .from('dogs')
      .select('*')
      .order('created_at', {
        ascending: true,
      })

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
    selectedDog &&
    dogData.find(
        item => item.id === selectedDog.id
    );

    const dogToUse =
    currentDog || dogData[0];

    setSelectedDog(dogToUse);

    const {
      data: deviceData,
    } = await supabase
      .from('devices')
      .select('*')
      .eq('dog_id', dogToUse.id)
      .maybeSingle();

    setDevice(deviceData);

    if (deviceData) {
      const {
        data: sensorData,
      } = await supabase
        .from('sensor_data')
        .select('*')
        .eq('device_id', deviceData.id)
        .order('timestamp_utc', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      setSensor(sensorData);
    }

    setLoading(false);
  };

  const createHealthAlert = async (dog, sensor, riskLevel) => {

  if (!dog || !sensor) {
    return;
  }

  if (
    riskLevel !== 'HIGH' &&
    riskLevel !== 'MODERATE'
  ) {
    return;
  }
  
  if (lastAlertRisk === riskLevel) {
    console.log(
      '⛔ Duplicate alert prevented:',
      riskLevel
    );
    return;
  }

  console.log(
    '🚨 Creating new health alert:',
    riskLevel
  );

  const { error } = await supabase
    .from('health_alerts')
    .insert({
      dog_id: dog.id,
      type:
        riskLevel === 'HIGH'
          ? 'HIGH_RISK'
          : 'MODERATE_RISK',
      reading_value: {
        surface_temp: sensor.surface_temp,
        ambient_temp: sensor.ambient_temp,
        humidity: sensor.humidity,
      },
    });

  if (error) {
    console.log(
      'HEALTH ALERT ERROR:',
      error.message
    );

    return;
  }

  console.log(
    '🚨 Health alert created:',
    riskLevel
  );
};

useEffect(() => {
  if (!selectedDog || !sensor) {
    return;
  }


  if (
    riskLevel === 'LOW' ||
    riskLevel === 'UNKNOWN'
  ) {
    setLastAlertRisk(null);
    return;
  }

  createHealthAlert(
    selectedDog,
    sensor,
    riskLevel
  );
}, [
  selectedDog?.id,
  sensor?.id,
  riskLevel,
]);

useFocusEffect(
  useCallback(() => {
    if (profile?.id) {
      loadDashboard();
    }
  }, [profile?.id])
);

  if (dogs.length === 0 && !loading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>
          No Pet Registered
        </Text>

        <Text style={styles.emptyText}>
          Register your pet to start using
          PawGuard.
        </Text>

        <Text
          style={styles.link}
          onPress={() =>
            navigation.navigate(
              'RegisterPet'
            )
          }
        >
          Register Pet
        </Text>
      </View>
    );
  }

  return (

    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadDashboard}
        />
      }
    
    >
      <Text style={styles.greeting}>
        Hello, {profile?.name}
      </Text>

      <Text style={styles.title}>
        PawGuard
      </Text>
{dogs.length > 0 && (
  <View style={styles.selector}>

    <Text style={styles.selectorLabel}>
      My Pets
    </Text>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {dogs.map(item => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.dogOption,
            selectedDog?.id === item.id &&
              styles.selectedDogOption,
          ]}
          onPress={() => {
            setSelectedDog(item);
            loadDogData(item);
          }}
        >
          <Text
            style={[
              styles.dogOptionText,
              selectedDog?.id === item.id &&
                styles.selectedDogOptionText,
            ]}
          >
            🐕 {item.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
    <TouchableOpacity
  onPress={() =>
    navigation.navigate('Map', {
      dog: selectedDog,
    })
  }
>
  <Text>
    📍 View Location
  </Text>
</TouchableOpacity>
    <TouchableOpacity
        style={styles.addDogButton}
        onPress={() => navigation.navigate('RegisterPet')}
    >
        <Text style={styles.addDogButtonText}>
            + Add New Dog
        </Text>
    </TouchableOpacity>

  </View>
)}

{selectedDog && (
  <View style={styles.petCard}>

    <TouchableOpacity
      onPress={() =>
        navigation.navigate('DogProfile', {
          dogId: selectedDog.id,
        })
      }
    >
      <Text style={styles.petName}>
        🐕 {selectedDog.name}
      </Text>

      <Text style={styles.petInfo}>
        {selectedDog.breed || 'Unknown breed'}
        {selectedDog.age
          ? ` • ${selectedDog.age} years old`
          : ''}
      </Text>

      <Text style={styles.viewProfile}>
        View Profile →
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={() =>
        navigation.navigate('EditPet', {
          dogId: selectedDog.id,
        })
      }
    >
      <Text>Edit Pet</Text>
    </TouchableOpacity>

    <TouchableOpacity
    style={styles.pairButton}
    onPress={() =>
    navigation.navigate('PairDevice', {
      dogId: selectedDog.id,
    })
  }
>
  <Text style={styles.pairButtonText}>
    + Pair Device
  </Text>
</TouchableOpacity>

  </View>
)}

      <Text style={styles.sectionTitle}>
        Device
      </Text>

      <View style={styles.deviceCard}>
        <Text>
          Status
        </Text>

        <Text style={styles.deviceStatus}>
          {device?.status || 'Not paired'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Current Readings
      </Text>

      <View style={styles.row}>
        <SensorCard
          title="Surface Temp"
          value={
            sensor?.surface_temp ?? '--'
          }
          unit="°C"
          icon="🌡️"
        />

        <SensorCard
          title="Ambient Temp"
          value={
            sensor?.ambient_temp ?? '--'
          }
          unit="°C"
          icon="🌤️"
        />
      </View>

      <View style={styles.row}>
        <SensorCard
          title="Humidity"
          value={
            sensor?.humidity ?? '--'
          }
          unit="%"
          icon="💧"
        />
      </View>

      <RiskBadge level={riskLevel} />

      {sensor?.timestamp_utc && (
        <Text style={styles.updated}>
          Last updated:{' '}
          {new Date(
            sensor.timestamp_utc
          ).toLocaleString()}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },

  greeting: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 5,
    marginBottom: 20,
  },

  petCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
  },

  petName: {
    fontSize: 24,
    fontWeight: '800',
  },

  petInfo: {
    marginTop: 5,
    color: '#666',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 10,
  },

  deviceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
  },

  deviceStatus: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 5,
  },

  row: {
    flexDirection: 'row',
    gap: 12,
  },

  updated: {
    color: '#777',
    marginTop: 15,
    textAlign: 'center',
  },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },

  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
  },

  emptyText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
  },

  link: {
    marginTop: 20,
    fontWeight: '700',
  },
  selector: {
  marginBottom: 15,
},

selectorLabel: {
  fontSize: 16,
  fontWeight: '700',
  marginBottom: 10,
},

dogOption: {
  backgroundColor: '#fff',
  paddingVertical: 10,
  paddingHorizontal: 15,
  borderRadius: 20,
  marginRight: 8,
},

selectedDogOption: {
  backgroundColor: '#222',
},

dogOptionText: {
  fontWeight: '600',
},

selectedDogOptionText: {
  color: '#fff',
},

viewProfile: {
  marginTop: 12,
  fontWeight: '700',
},
addDogButton: {
  backgroundColor: '#fff',
  borderWidth: 1,
  borderColor: '#222',
  borderRadius: 12,
  paddingVertical: 12,
  alignItems: 'center',
  marginTop: 12,
},

addDogButtonText: {
  fontSize: 15,
  fontWeight: '700',
},
  
});