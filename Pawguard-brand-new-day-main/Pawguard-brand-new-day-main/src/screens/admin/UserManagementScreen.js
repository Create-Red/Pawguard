
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
  TextInput,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';

export default function UserManagementScreen() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error } = await supabase.rpc(
      'admin_list_users'
    );

    if (error) {
      console.error('User management error:', error);

      Alert.alert(
        'Unable to Load Users',
        error.message
      );
    } else {
      setUsers(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
    }, [])
  );

  const filteredUsers = users.filter((user) => {
    const query = search.toLowerCase().trim();

    return (
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query)
    );
  });

  const getRoleColor = (role) => {
    switch (role) {
      case 'system_admin':
        return '#DC2626';

      case 'event_organizer':
        return '#2563EB';

      case 'shelter_admin':
      case 'shelter_staff':
        return '#7C3AED';

      default:
        return '#059669';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadUsers(true)}
        />
      }
    >
      <Text style={styles.title}>
        User Management
      </Text>

      <Text style={styles.subtitle}>
        View registered PawGuard accounts and their assigned roles.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          Total Registered Users
        </Text>

        <Text style={styles.summaryValue}>
          {users.length}
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search name, email, or role..."
        placeholderTextColor="#94A3B8"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#2563EB"
          style={styles.loader}
        />
      ) : filteredUsers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No matching accounts found.
          </Text>
        </View>
      ) : (
        filteredUsers.map((user) => (
          <View
            key={user.id}
            style={styles.userCard}
          >
            <View style={styles.userHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {user.name}
                </Text>

                <Text style={styles.userEmail}>
                  {user.email || 'No email available'}
                </Text>
              </View>
            </View>

            <View style={styles.roleContainer}>
              <Text style={styles.detailLabel}>
                Assigned Role
              </Text>

              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: getRoleColor(user.role),
                  },
                ]}
              >
                <Text style={styles.roleText}>
                  {user.role?.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.dateText}>
              Registered: {
                user.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : 'Unknown'
              }
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
    backgroundColor: '#F5F7FB',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#172033',
  },

  subtitle: {
    color: '#687386',
    marginTop: 6,
    lineHeight: 20,
  },

  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 15,
    marginTop: 22,
    marginBottom: 18,
  },

  summaryLabel: {
    color: '#687386',
    fontSize: 13,
  },

  summaryValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#172033',
    marginTop: 5,
  },

  searchInput: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 18,
    fontSize: 14,
    color: '#172033',
  },

  loader: {
    marginTop: 30,
  },

  userCard: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 15,
    marginBottom: 12,
  },

  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1D4ED8',
  },

  userInfo: {
    flex: 1,
    marginLeft: 12,
  },

  userName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#172033',
  },

  userEmail: {
    fontSize: 12,
    color: '#687386',
    marginTop: 4,
  },

  roleContainer: {
    marginTop: 17,
  },

  detailLabel: {
    color: '#687386',
    fontSize: 12,
    marginBottom: 7,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
  },

  roleText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
    textTransform: 'capitalize',
  },

  dateText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 14,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 14,
  },

  emptyText: {
    textAlign: 'center',
    color: '#687386',
  },
});
