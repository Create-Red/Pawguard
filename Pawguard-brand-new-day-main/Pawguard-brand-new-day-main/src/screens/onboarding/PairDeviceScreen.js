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

export default function PairDeviceScreen({
  route,
  navigation,
}) {
  const {
    dogId,
    dogName,
  } = route.params;

  const [loading, setLoading] = useState(false);
  const [deviceUid, setDeviceUid] = useState('');

async function pairDevice() {
  if (!deviceUid.trim()) {
    Alert.alert(
      'Missing Device ID',
      'Please enter the device UID.'
    );
    return;
  }

  setLoading(true);

  // 1. Find the device using its UID
  const {
    data: existingDevice,
    error: checkError,
  } = await supabase
    .from('devices')
    .select('*')
    .eq('device_uid', deviceUid.trim())
    .maybeSingle();

  if (checkError) {
    setLoading(false);

    Alert.alert(
      'Error',
      checkError.message
    );

    return;
  }

  // 2. Device doesn't exist
  if (!existingDevice) {
    setLoading(false);

    Alert.alert(
      'Device Not Found',
      'No PawGuard device with this Device ID exists.'
    );

    return;
  }

  // 3. Device is already paired
  if (existingDevice.dog_id) {
    setLoading(false);

    Alert.alert(
      'Device Already Paired',
      'This PawGuard device is already paired with a dog.'
    );

    return;
  }

  // 4. Assign device to this dog
  const {
    error: updateError,
  } = await supabase
    .from('devices')
    .update({
      dog_id: dogId,
      status: 'offline',
    })
    .eq('id', existingDevice.id);

  setLoading(false);

  // 5. Handle update error
  if (updateError) {
    Alert.alert(
      'Pairing Failed',
      updateError.message
    );

    return;
  }

  // 6. Success
  Alert.alert(
    'Device Paired',
    `${dogName}'s PawGuard device has been registered.`,
    [
      {
        text: 'Continue',
        onPress: () =>
          navigation.replace('MainTabs'),
      },
    ]
  );
}

  return (

    <View style={styles.container}>
      <Text style={styles.title}>
        Pair PawGuard Device
      </Text>

      <Text style={styles.pet}>
        Pet: {dogName}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter Device UID"
        value={deviceUid}
        onChangeText={setDeviceUid}
        autoCapitalize="characters"
      />

    <Text style={styles.description}>
    This is a simulated PawGuard device.
    It will generate sensor readings for
    testing.
    </Text>

    <View style={styles.devicePreview}>
    <Text style={styles.deviceLabel}>
        Device ID
    </Text>

    <Text style={styles.deviceId}>
        {deviceUid}
    </Text>

    <Text style={styles.deviceInfo}>
        Firmware: SIM-1.0.0
    </Text>
    </View>

      <TouchableOpacity
        style={styles.button}
        onPress={pairDevice}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? 'Pairing...'
            : 'Pair Device'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          navigation.replace('MainTabs')
        }
      >
        <Text style={styles.skip}>
          Skip for now
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 15,
  },

  pet: {
    fontSize: 18,
    fontWeight: '600',
  },

  description: {
    color: '#666',
    marginVertical: 20,
    lineHeight: 22,
  },

  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },

  skip: {
    textAlign: 'center',
    marginTop: 20,
  },

  devicePreview: {
  backgroundColor: '#f5f5f5',
  padding: 18,
  borderRadius: 12,
  marginBottom: 20,
},

deviceLabel: {
  fontSize: 13,
  color: '#666',
},

deviceId: {
  fontSize: 20,
  fontWeight: '800',
  marginTop: 5,
},

deviceInfo: {
  marginTop: 5,
  color: '#666',
},

input: {
  backgroundColor: '#f5f5f5',
  borderWidth: 1,
  borderColor: '#ddd',
  borderRadius: 12,
  padding: 14,
  marginTop: 20,
  marginBottom: 20,
},
});