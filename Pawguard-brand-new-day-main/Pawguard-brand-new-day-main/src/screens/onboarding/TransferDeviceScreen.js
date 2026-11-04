
import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from 'react-native';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

export default function TransferDeviceScreen({ route, navigation }) {
  const {
    dogId,
    dogName,
    deviceId,
    deviceUid,
  } = route.params;

  const { profile } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [selectedDog, setSelectedDog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadAvailableDogs();
  }, [profile?.id]);

  async function loadAvailableDogs() {
    if (!profile?.id) return;

    try {
      const { data: dogData, error: dogError } = await supabase
        .from('dogs')
        .select('id, name, breed')
        .eq('owner_id', profile.id)
        .eq('is_archived', false)
        .neq('id', dogId)
        .order('created_at', { ascending: true });

      if (dogError) throw dogError;

      if (!dogData || dogData.length === 0) {
        setDogs([]);
        return;
      }

      const dogIds = dogData.map((dog) => dog.id);

      const { data: pairedDevices, error: deviceError } = await supabase
        .from('devices')
        .select('dog_id')
        .in('dog_id', dogIds);

      if (deviceError) throw deviceError;

      const dogsWithDevices = new Set(
        (pairedDevices || []).map((item) => item.dog_id)
      );

      const availableDogs = dogData.filter(
        (dog) => !dogsWithDevices.has(dog.id)
      );

      setDogs(availableDogs);
    } catch (error) {
      console.log('AVAILABLE DOGS ERROR:', error.message);
      Alert.alert('Error', 'Unable to load available dogs.');
    } finally {
      setLoading(false);
    }
  }

  function confirmTransfer() {
    if (!selectedDog) {
      Alert.alert('Select a Dog', 'Please select the dog receiving the device.');
      return;
    }

    Alert.alert(
      'Confirm Device Transfer',
      `Transfer device ${deviceUid} from ${dogName} to ${selectedDog.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: transferDevice,
        },
      ]
    );
  }

  async function transferDevice() {
    setTransferring(true);

    const { error } = await supabase.rpc('transfer_device', {
      p_device_id: deviceId,
      p_target_dog_id: selectedDog.id,
    });

    setTransferring(false);

    if (error) {
      Alert.alert('Transfer Failed', error.message);
      return;
    }

    Alert.alert(
      'Device Transferred',
      `${deviceUid} is now assigned to ${selectedDog.name}.`,
      [
        {
          text: 'OK',
          onPress: () => navigation.popToTop(),
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.message}>Loading your dogs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transfer PawGuard Device</Text>

      <Text style={styles.subtitle}>
        Current dog: {dogName}
      </Text>

      <Text style={styles.device}>
        Device UID: {deviceUid}
      </Text>

      <Text style={styles.instruction}>
        Select another dog you own. Dogs that already have a device are
        not available.
      </Text>

      {dogs.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No available dogs</Text>
          <Text style={styles.message}>
            You need another active dog without a paired device before
            transferring this device.
          </Text>
        </View>
      ) : (
        <FlatList
          data={dogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const active = selectedDog?.id === item.id;

            return (
              <TouchableOpacity
                style={[
                  styles.dogItem,
                  active && styles.dogItemActive,
                ]}
                onPress={() => setSelectedDog(item)}
              >
                <View>
                  <Text style={styles.dogName}>{item.name}</Text>
                  <Text style={styles.breed}>
                    {item.breed || 'Breed not specified'}
                  </Text>
                </View>

                <Text style={styles.selectText}>
                  {active ? 'Selected ✓' : 'Select'}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <TouchableOpacity
        style={[
          styles.button,
          (!selectedDog || transferring) && styles.buttonDisabled,
        ]}
        onPress={confirmTransfer}
        disabled={!selectedDog || transferring}
      >
        <Text style={styles.buttonText}>
          {transferring ? 'Transferring...' : 'Confirm Transfer'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 22,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: '#222',
    marginTop: 15,
  },
  subtitle: {
    fontSize: 16,
    marginTop: 15,
    color: '#555',
  },
  device: {
    fontSize: 14,
    marginTop: 6,
    fontWeight: '700',
  },
  instruction: {
    fontSize: 14,
    color: '#666',
    lineHeight: 21,
    marginTop: 20,
    marginBottom: 15,
  },
  list: {
    paddingBottom: 15,
  },
  dogItem: {
    padding: 17,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dogItemActive: {
    borderColor: '#222',
    backgroundColor: '#f2f2f2',
  },
  dogName: {
    fontSize: 16,
    fontWeight: '700',
  },
  breed: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },
  selectText: {
    fontWeight: '700',
    color: '#333',
  },
  empty: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#222',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
