import React, { useEffect, useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../config/supabase';

export default function DogProfileScreen({
  route,
  navigation,
}) {
  const { dogId } = route.params;

  const [dog, setDog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDog();
  }, []);

  async function loadDog() {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .single();

      if (error) {
        console.log('DOG PROFILE ERROR:', error);

        Alert.alert(
          'Error',
          error.message
        );

        navigation.goBack();
        return;
      }

      setDog(data);
    } catch (error) {
      console.log(
        'DOG PROFILE EXCEPTION:',
        error
      );

      Alert.alert(
        'Error',
        'Unable to load pet information.'
      );

      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!dog) {
    return (
      <View style={styles.center}>
        <Text>Pet not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          🐶
        </Text>
      </View>

      <Text style={styles.name}>
        {dog.name}
      </Text>

      <Text style={styles.info}>
        Breed: {dog.breed || 'Not specified'}
      </Text>

      <Text style={styles.info}>
        Age: {dog.age ?? 'Not specified'}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          navigation.navigate(
            'EditPet',
            {
              dogId: dog.id,
            }
          )
        }
      >
        <Text style={styles.buttonText}>
          Edit Pet
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
    backgroundColor: '#eee',
  },

  avatarText: {
    fontSize: 50,
  },

  name: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 15,
  },

  info: {
    fontSize: 17,
    marginBottom: 8,
  },

  button: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
    marginTop: 30,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});