
import React, { useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../config/supabase';

export default function PairDeviceScreen({ route, navigation }) {
  const { dogId, dogName } = route.params;

  const [loading, setLoading] = useState(false);
  const [deviceUid, setDeviceUid] = useState('');

  async function pairDevice() {
    const uid = deviceUid.trim().toUpperCase();

    if (!uid) {
      Alert.alert('Missing Device ID', 'Please enter the device UID.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.rpc('pair_device', {
      p_device_uid: uid,
      p_dog_id: dogId,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Pairing Failed', error.message);
      return;
    }

    Alert.alert(
      'Device Paired',
      `${dogName || 'Your dog'}'s PawGuard device has been paired successfully.`,
      [
        {
          text: 'Continue',
          onPress: () => navigation.popToTop(),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair PawGuard Device</Text>

      <Text style={styles.pet}>
        Pet: {dogName || 'Selected dog'}
      </Text>

      <Text style={styles.description}>
        Enter the unique Device UID printed on your PawGuard device.
        The device must already be registered in the system and must
        not be paired with another dog.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Device UID"
        value={deviceUid}
        onChangeText={setDeviceUid}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={pairDevice}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Pairing...' : 'Pair Device'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={styles.skip}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 15,
    color: '#222',
  },
  pet: {
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    color: '#666',
    marginTop: 20,
    marginBottom: 20,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  skip: {
    textAlign: 'center',
    marginTop: 20,
    color: '#555',
  },
});
