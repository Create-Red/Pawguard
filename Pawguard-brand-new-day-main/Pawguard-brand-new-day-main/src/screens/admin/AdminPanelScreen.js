import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';

import { useAuth } from '../../context/AuthContext';

export default function AdminPanelScreen() {
  const {
    profile,
    signOut,
  } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadDogs() {
    setLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from('dogs')
      .select(`
        *,
        profiles (
          name
        )
      `)
      .order('created_at', {
        ascending: false,
      });

    if (!error) {
      setDogs(data || []);
    }

    setLoading(false);
  }

  useFocusEffect(
    useCallback(() => {
      loadDogs();
    }, [])
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        Admin Panel
      </Text>

      <Text style={styles.welcome}>
        Welcome, {profile?.name}
      </Text>

      <View style={styles.stats}>
        <Text style={styles.statTitle}>
          Registered Dogs
        </Text>

        <Text style={styles.statValue}>
          {dogs.length}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Shelter Dogs
      </Text>

      {loading ? (
        <ActivityIndicator />
      ) : (
        dogs.map((dog) => (
          <View
            key={dog.id}
            style={styles.dogCard}
          >
            <Text style={styles.dogName}>
              🐕 {dog.name}
            </Text>

            <Text>
              Breed: {dog.breed || 'Unknown'}
            </Text>

            <Text>
              Age: {dog.age ?? 'Unknown'}
            </Text>

            <Text>
              Owner:{' '}
              {dog.profiles?.name ||
                'Unknown'}
            </Text>
          </View>
        ))
      )}

      <TouchableOpacity
        style={styles.logout}
        onPress={signOut}
      >
        <Text style={styles.logoutText}>
          Sign Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
  },

  welcome: {
    color: '#666',
    marginTop: 5,
  },

  stats: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
  },

  statTitle: {
    color: '#666',
  },

  statValue: {
    fontSize: 32,
    fontWeight: '800',
    marginTop: 5,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 25,
    marginBottom: 10,
  },

  dogCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 15,
    marginBottom: 10,
  },

  dogName: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },

  logout: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 25,
  },

  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});