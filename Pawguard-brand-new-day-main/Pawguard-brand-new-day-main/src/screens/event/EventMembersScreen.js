
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

const FILTERS = ['all', 'pending', 'approved', 'rejected'];

export default function EventMembersScreen({ route, navigation }) {
  const { user, profile } = useAuth();

  const eventId = route?.params?.eventId;
  const eventName = route?.params?.eventName || 'Participants';

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadMembers = useCallback(async () => {
    if (!user || !eventId) {
      setMembers([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, organizer_id')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;

      const isSystemAdmin = profile?.role === 'system_admin';

      if (!event || (!isSystemAdmin && event.organizer_id !== user.id)) {
        setMembers([]);
        Alert.alert(
          'Access denied',
          'You do not have permission to manage this event.'
        );
        return;
      }

      const { data, error } = await supabase
        .from('event_members')
        .select(`
          id,
          event_id,
          owner_id,
          dog_id,
          status,
          joined_at,
          reviewed_at,
          dogs!event_members_dog_id_fkey (
            id,
            name,
            breed,
            age,
            photo_url,
            owner_id
          ),
          profiles!event_members_owner_id_fkey (
            id,
            name
          )
        `)
        .eq('event_id', eventId)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      setMembers(data || []);
    } catch (error) {
      console.error('Load event participants error:', error);
      Alert.alert('Unable to load participants', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, eventId, profile?.role]);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

  const counts = useMemo(() => ({
    all: members.filter((m) => m.status !== 'withdrawn').length,
    pending: members.filter((m) => m.status === 'pending').length,
    approved: members.filter((m) => m.status === 'approved').length,
    rejected: members.filter((m) => m.status === 'rejected').length,
  }), [members]);

  const visibleMembers = useMemo(() => {
    if (filter === 'all') {
      return members.filter((m) => m.status !== 'withdrawn');
    }

    return members.filter((m) => m.status === filter);
  }, [members, filter]);

  const updateStatus = (member, newStatus) => {
    const action = newStatus === 'approved' ? 'approve' : 'reject';

    Alert.alert(
      `${action === 'approve' ? 'Approve' : 'Reject'} request?`,
      `Do you want to ${action} this participation request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            if (!user || updatingId) return;

            try {
              setUpdatingId(member.id);

              const { data, error } = await supabase
                .from('event_members')
                .update({
                  status: newStatus,
                  reviewed_at: new Date().toISOString(),
                })
                .eq('id', member.id)
                .eq('event_id', eventId)
                .eq('status', 'pending')
                .select('id, status');

              if (error) throw error;

              if (!data || data.length === 0) {
                throw new Error(
                  'The request was not updated. It may already have been reviewed or your permissions may prevent this action.'
                );
              }

              await loadMembers();

              Alert.alert(
                'Success',
                `Participation request ${newStatus}.`
              );
            } catch (error) {
              console.error('Update participant error:', error);
              Alert.alert('Update failed', error.message);
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const statusStyle = (status) => {
    switch (status) {
      case 'approved': return styles.approvedBadge;
      case 'rejected': return styles.rejectedBadge;
      case 'pending': return styles.pendingBadge;
      default: return styles.otherBadge;
    }
  };

  const renderMember = ({ item }) => {
    const dog = item.dogs;
    const owner = item.profiles;
    const isPending = item.status === 'pending';
    const isUpdating = updatingId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() =>
          navigation.navigate('ParticipantProfile', {
            member: item,
            eventName,
          })
        }
      >
        <View style={styles.cardTop}>
          <View style={styles.dogIdentity}>
            {dog?.photo_url ? (
              <Image
                source={{ uri: dog.photo_url }}
                style={styles.dogImage}
              />
            ) : (
              <View style={styles.dogPlaceholder}>
                <Text style={styles.dogPlaceholderText}>🐕</Text>
              </View>
            )}

            <View style={styles.dogInfo}>
              <Text style={styles.dogName}>
                {dog?.name || 'Dog information unavailable'}
              </Text>
              <Text style={styles.ownerName}>
                Owner: {owner?.name || 'Unavailable'}
              </Text>
              {dog?.breed ? (
                <Text style={styles.breed}>{dog.breed}</Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.statusBadge, statusStyle(item.status)]}>
            <Text style={styles.statusText}>
              {item.status?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>

        <Text style={styles.dateText}>
          Requested: {item.joined_at
            ? new Date(item.joined_at).toLocaleString()
            : 'Unknown'}
        </Text>

        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              disabled={!!updatingId}
              onPress={() => updateStatus(item, 'approved')}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Approve</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              disabled={!!updatingId}
              onPress={() => updateStatus(item, 'rejected')}
            >
              <Text style={styles.actionText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.profileLink}>View participant details →</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#237A57" />
        <Text style={styles.muted}>Loading participants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Participants</Text>
        <Text style={styles.subtitle}>{eventName}</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryNumber}>{counts.all}</Text>
        <Text style={styles.summaryLabel}>Registered participants</Text>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => {
          const active = filter === item;

          return (
            <TouchableOpacity
              key={item}
              style={[styles.filterChip, active && styles.activeFilter]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, active && styles.activeFilterText]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </Text>
              <Text style={[styles.filterCount, active && styles.activeFilterText]}>
                {counts[item]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visibleMembers}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          visibleMembers.length === 0 ? styles.emptyContainer : styles.list
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMembers();
            }}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No {filter === 'all' ? '' : filter + ' '}participants found.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7F6' },
  heading: { padding: 20, paddingBottom: 12 },
  title: { fontSize: 27, fontWeight: '800', color: '#183D2B' },
  subtitle: { color: '#64748B', marginTop: 5 },
  summary: {
    backgroundColor: '#183D2B',
    marginHorizontal: 16,
    borderRadius: 15,
    padding: 16,
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
  },
  summaryLabel: { color: '#D8E9DF', fontSize: 12, marginTop: 3 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    padding: 16,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#DCE5DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 22,
  },
  activeFilter: { backgroundColor: '#237A57', borderColor: '#237A57' },
  filterText: { fontSize: 11, color: '#475569', fontWeight: '700' },
  filterCount: { fontSize: 11, color: '#64748B', fontWeight: '800' },
  activeFilterText: { color: '#FFFFFF' },
  list: { padding: 16, paddingTop: 7, paddingBottom: 35 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5EDE8',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  dogIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dogImage: { width: 62, height: 62, borderRadius: 31 },
  dogPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#DDF7E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dogPlaceholderText: { fontSize: 28 },
  dogInfo: { flex: 1, marginLeft: 12 },
  dogName: { fontSize: 17, fontWeight: '800', color: '#183D2B' },
  ownerName: { fontSize: 12, color: '#64748B', marginTop: 5 },
  breed: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6 },
  approvedBadge: { backgroundColor: '#D9F3E3' },
  rejectedBadge: { backgroundColor: '#FCE0E0' },
  pendingBadge: { backgroundColor: '#FFF0C2' },
  otherBadge: { backgroundColor: '#E8E8E8' },
  statusText: { fontSize: 9, fontWeight: '800', color: '#333333' },
  dateText: { fontSize: 11, color: '#94A3B8', marginTop: 13 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approveButton: { backgroundColor: '#237A57' },
  rejectButton: { backgroundColor: '#C43D3D' },
  actionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
  profileLink: {
    color: '#237A57',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 14,
  },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: {
    textAlign: 'center',
    color: '#64748B',
    padding: 25,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7F6',
  },
  muted: { color: '#64748B', marginTop: 10 },
});
