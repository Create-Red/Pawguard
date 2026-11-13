import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import Avatar from '../../components/Avatar';
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

// Role -> pastel tone
const ROLE_TONE = {
  system_admin: 'salmon',
  event_organizer: 'brand',
  shelter_admin: 'amber',
  shelter_staff: 'amber',
  owner: 'green',
};

const ROLE_FILTERS = [
  { key: 'all', label: 'all' },
  { key: 'owner', label: 'owners' },
  { key: 'event_organizer', label: 'organizers' },
  { key: 'system_admin', label: 'admins' },
];

// 'event_organizer' -> 'Event organizer'
const formatRole = (role) => {
  const text = (role || 'unknown').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function UserManagementScreen() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    const { data, error } = await supabase.rpc('admin_list_users');

    if (error) {
      console.error('User management error:', error);
      Alert.alert('Unable to load users', error.message);
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

  const query = search.toLowerCase().trim();
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesSearch =
      !query ||
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query);
    return matchesRole && matchesSearch;
  });

  const countRole = (role) => users.filter((u) => u.role === role).length;

  const renderUser = ({ item, index }) => {
    const tone = tones[ROLE_TONE[item.role]] || tones.beige;

    return (
      <View style={[styles.row, index === filteredUsers.length - 1 && styles.rowLast]}>
        <Avatar
          uri={item.avatar_url}
          name={item.name}
          size={46}
          bg={tone.bg}
          color={tone.text}
        />

        <View style={styles.rowBody}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || 'Unnamed user'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {item.email || 'No email available'}
          </Text>
          <Text style={styles.date}>
            Joined{' '}
            {item.created_at
              ? new Date(item.created_at).toLocaleDateString([], {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'unknown'}
          </Text>
        </View>

        <View style={[styles.pill, { backgroundColor: tone.pill }]}>
          <Text style={[styles.pillText, { color: tone.pillText }]} numberOfLines={1}>
            {formatRole(item.role)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.subtitle}>Registered accounts and their roles.</Text>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{users.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCol, styles.statDivider]}>
            <Text style={styles.statNumber}>{countRole('owner')}</Text>
            <Text style={styles.statLabel}>Owners</Text>
          </View>
          <View style={[styles.statCol, styles.statDivider]}>
            <Text style={styles.statNumber}>{countRole('event_organizer')}</Text>
            <Text style={styles.statLabel}>Organizers</Text>
          </View>
          <View style={[styles.statCol, styles.statDivider]}>
            <Text style={styles.statNumber}>{countRole('system_admin')}</Text>
            <Text style={styles.statLabel}>Admins</Text>
          </View>
        </View>

        <View style={[styles.search, searchFocused && styles.searchFocused]}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search name, email or role"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.chips}>
          {ROLE_FILTERS.map((f) => {
            const active = roleFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRoleFilter(f.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => loadUsers({ pull: true })}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>No matching accounts found.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  header: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 4 },

  statsRow: { flexDirection: 'row', marginTop: 22 },
  statCol: { flex: 1 },
  statDivider: {
    paddingLeft: 12,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
  },
  statNumber: { fontFamily: fonts.medium, fontSize: 26, color: colors.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 16,
    backgroundColor: colors.tile,
    borderWidth: 2,
    borderColor: 'transparent',
    marginTop: 22,
  },
  searchFocused: { borderColor: colors.accent },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
  },

  chips: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 8 },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.onAccent },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowBody: { flex: 1 },
  name: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  email: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 1 },
  date: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 3 },
  pill: {
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    maxWidth: 120,
  },
  pillText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.3 },

  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },
});