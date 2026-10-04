import React, { useEffect, useState } from 'react';
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

export default function EditPetScreen({ route, navigation }) {
  const { dogId } = route.params;
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDog();
  }, []);

  async function loadDog() {
    try {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .single();

      if (error) {
        console.log('LOAD DOG ERROR:', error);
        Alert.alert('Error', error.message);
        navigation.goBack();
        return;
      }

      setName(data.name || '');
      setBreed(data.breed || '');
      setAge(
        data.age !== null && data.age !== undefined
          ? String(data.age)
          : ''
      );
    } catch (error) {
      console.log('LOAD DOG EXCEPTION:', error);
      Alert.alert('Error', 'Unable to load pet information.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  async function updateDog() {
    if (!user?.id) {
      Alert.alert('Error', 'You are not logged in.');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter your dog\'s name.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('dogs')
        .update({
          name: name.trim(),
          breed: breed.trim() || null,
          age: age.trim() ? Number(age) : null,
        })
        .eq('id', dogId);

      if (error) {
        console.log('UPDATE DOG ERROR:', error);

        Alert.alert(
          'Update Failed',
          error.message
        );

        return;
      }

      Alert.alert(
        'Success',
        'Pet information has been updated.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.log('UPDATE DOG EXCEPTION:', error);

      Alert.alert(
        'Error',
        'Something went wrong while updating the pet.'
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading pet information...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Edit Pet
      </Text>

      <Text style={styles.subtitle}>
        Update your dog's information.
      </Text>

      <Text style={styles.label}>
        Dog Name
      </Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Dog Name"
      />

      <Text style={styles.label}>
        Breed
      </Text>

      <TextInput
        style={styles.input}
        value={breed}
        onChangeText={setBreed}
        placeholder="Breed"
      />

      <Text style={styles.label}>
        Age
      </Text>

      <TextInput
        style={styles.input}
        value={age}
        onChangeText={setAge}
        placeholder="Age"
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={updateDog}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 20,
  },

  subtitle: {
    color: '#666',
    marginTop: 8,
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 7,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 18,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});