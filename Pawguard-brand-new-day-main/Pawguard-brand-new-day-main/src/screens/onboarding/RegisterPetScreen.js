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
import { useAuth } from '../../context/AuthContext';

export default function RegisterPetScreen({ navigation }) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);

  async function registerPet() {
    if (!user?.id) {
      Alert.alert(
        'Not Logged In',
        'Please log in again.'
      );
      return;
    }

    if (!name.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter your dog\'s name.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('dogs')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          breed: breed.trim() || null,
          age: age ? Number(age) : null,
        })
        .select()
        .single();

      if (error) {
        console.log(
          'REGISTER PET ERROR:',
          error
        );

        Alert.alert(
          'Registration Failed',
          error.message
        );

        return;
      }

      console.log(
        'DOG CREATED:',
        data
      );

      Alert.alert(
        'Pet Registered',
        `${data.name} has been added to PawGuard.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.log(
        'REGISTER PET EXCEPTION:',
        error
      );

      Alert.alert(
        'Error',
        'Something went wrong while registering your pet.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Register Your Pet
      </Text>

      <Text style={styles.subtitle}>
        Add your dog to PawGuard.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Dog Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Breed"
        value={breed}
        onChangeText={setBreed}
      />

      <TextInput
        style={styles.input}
        placeholder="Age"
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={registerPet}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? 'Registering...'
            : 'Register Pet'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.cancelText}>
          Cancel
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
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },

  subtitle: {
    color: '#666',
    marginBottom: 25,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },

  cancelText: {
    fontWeight: '600',
  },
});