
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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

export default function AdminPanelScreen({navigation}) {
  const { profile, signOut } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [stats, setStats] = useState({
    users: 0,
    dogs: 0,
    devices: 0,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        usersResult,
        dogsResult,
        devicesResult,
        dogListResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('dogs')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('devices')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('dogs')
          .select(`
            *,
            profiles!dogs_owner_id_fkey (
              name
            )
          `)
          .order('created_at', {
            ascending: false,
          })
          .limit(20),
      ]);

      const errors = [
        usersResult.error,
        dogsResult.error,
        devicesResult.error,
        dogListResult.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        console.error('Admin dashboard errors:', errors);

        Alert.alert(
          'Dashboard Error',
          errors[0].message
        );
      }

      setStats({
        users: usersResult.count ?? 0,
        dogs: dogsResult.count ?? 0,
        devices: devicesResult.count ?? 0,
      });

      if (!dogListResult.error) {
        setDogs(dogListResult.data || []);
      }
    } catch (error) {
      console.error('Dashboard loading error:', error);

      Alert.alert(
        'Error',
        'Unable to load dashboard information.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  const StatCard = ({ title, value, icon }) => (
    <View style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadDashboard(true)}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Admin Dashboard
          </Text>

          <Text style={styles.welcome}>
            Welcome, {profile?.name || 'Administrator'}
          </Text>
        </View>

        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>
            ADMIN
          </Text>
        </View>
      </View>

      {/* Statistics */}
      <Text style={styles.sectionTitle}>
        System Overview
      </Text>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#2563EB"
          style={styles.loader}
        />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            title="Registered Users"
            value={stats.users}
            icon="👥"
          />

          <StatCard
            title="Registered Dogs"
            value={stats.dogs}
            icon="🐕"
          />

          <StatCard
            title="Registered Devices"
            value={stats.devices}
            icon="📡"
          />
        </View>
      )}

      {/* Dog Management */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Registered Dogs
        </Text>

        <Text style={styles.recordCount}>
          Latest 20
        </Text>
      </View>

      {loading ? null : dogs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No registered dogs found.
          </Text>
        </View>
      ) : (
        dogs.map((dog) => (
          <View
            key={dog.id}
            style={styles.dogCard}
          >
            <View style={styles.dogHeader}>
              <Text style={styles.dogName}>
                🐕 {dog.name}
              </Text>
            </View>

            <Text style={styles.dogDetail}>
              Breed: {dog.breed || 'Unknown'}
            </Text>

            <Text style={styles.dogDetail}>
              Age: {dog.age ?? 'Unknown'}
            </Text>

            <Text style={styles.dogDetail}>
              Owner: {dog.profiles?.name || 'Unknown'}
            </Text>
          </View>
        ))
      )}

      {/* Future Admin Modules */}
      <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => navigation.navigate('UserManagement')}
      >
        <Text style={styles.moduleTitle}>
          👤 User Management
        </Text>

        <Text style={styles.moduleDescription}>
          View registered accounts and their assigned roles.
        </Text>

        <Text style={styles.comingSoon}>
          Open User Management →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => navigation.navigate('SystemLogs')}
      >
        <Text style={styles.moduleTitle}>
          📋 System Logs
        </Text>

        <Text style={styles.moduleDescription}>
          Review important activities performed in PawGuard.
        </Text>

        <Text style={styles.comingSoon}>
          Open System Logs →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => navigation.navigate('AlertConfiguration')}
      >
        <Text style={styles.moduleTitle}>
          ⚙️ Alert Configuration
        </Text>

        <Text style={styles.moduleDescription}>
          Configure surface-temperature and humidity thresholds.
        </Text>

        <Text style={styles.comingSoon}>
          Open Alert Configuration →
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.moduleCard}
        onPress={() => navigation.navigate('DeviceMonitoring')}
      >
        <Text style={styles.moduleTitle}>
          📡 Device Monitoring
        </Text>

        <Text style={styles.moduleDescription}>
          Monitor registered devices, battery levels, and connection status.
        </Text>

        <Text style={styles.comingSoon}>
          Open Device Monitoring →
        </Text>
      </TouchableOpacity>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.logout}
        onPress={handleSignOut}
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
    backgroundColor: '#F5F7FB',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#172033',
  },

  welcome: {
    color: '#687386',
    marginTop: 6,
    fontSize: 14,
  },

  adminBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },

  adminBadgeText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 11,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 12,
  },

  loader: {
    marginVertical: 30,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },

  statCard: {
    backgroundColor: '#FFFFFF',
    width: '48%',
    padding: 17,
    borderRadius: 15,
    marginBottom: 12,
    elevation: 2,
  },

  statIcon: {
    fontSize: 24,
    marginBottom: 10,
  },

  statValue: {
    fontSize: 27,
    fontWeight: '800',
    color: '#172033',
  },

  statTitle: {
    fontSize: 12,
    color: '#687386',
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },

  recordCount: {
    color: '#687386',
    fontSize: 12,
  },

  dogCard: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 14,
    marginBottom: 10,
    elevation: 1,
  },

  dogHeader: {
    marginBottom: 8,
  },

  dogName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#172033',
  },

  dogDetail: {
    fontSize: 13,
    color: '#687386',
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 14,
    marginBottom: 20,
  },

  emptyText: {
    color: '#687386',
    textAlign: 'center',
  },

  moduleCard: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 14,
    marginBottom: 10,
  },

  moduleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#172033',
  },

  moduleDescription: {
    color: '#687386',
    fontSize: 13,
    marginTop: 7,
    lineHeight: 19,
  },

  comingSoon: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 10,
  },

  logout: {
    backgroundColor: '#172033',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 25,
  },

  logoutText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
