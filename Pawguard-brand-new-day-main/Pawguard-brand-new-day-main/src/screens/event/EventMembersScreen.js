
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

export default function EventMembersScreen({ route }) {
  const { user, profile } = useAuth();

  const eventId = route?.params?.eventId;
  const eventName = route?.params?.eventName || 'Event Participants';

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadMembers = useCallback(async () => {
    if (!user || !eventId) {
      setMembers([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);

      // Confirm that the current organizer owns this event.
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
      Alert.alert(
        'Unable to load participants',
        error.message || 'Please check your database policies and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, eventId, profile?.role]);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

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

              // Only pending requests can be reviewed.
              let query = supabase
                .from('event_members')
                .update({
                  status: newStatus,
                  reviewed_at: new Date().toISOString(),
                })
                .eq('id', member.id)
                .eq('event_id', eventId)
                .eq('status', 'pending');

              const { data, error } = await query
                .select('id, status');

              if (error) throw error;

              if (!data || data.length === 0) {
                throw new Error(
                  'The request was not updated. It may have already been reviewed, or your database permissions may prevent this action.'
                );
              }

              Alert.alert(
                'Success',
                `Participation request ${newStatus}.`
              );

              await loadMembers();
            } catch (error) {
              console.error('Update participant error:', error);
              Alert.alert(
                'Update failed',
                error.message || 'Please try again.'
              );
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const renderMember = ({ item }) => {
    const dog = item.dogs;
    const owner = item.profiles;
    const isPending = item.status === 'pending';
    const isUpdating = updatingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.dogInfo}>
            <Text style={styles.dogName}>
              {dog?.name || 'Dog information unavailable'}
            </Text>
            <Text style={styles.ownerName}>
              Owner: {owner?.name || 'Owner information unavailable'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              item.status === 'approved' && styles.approvedBadge,
              item.status === 'rejected' && styles.rejectedBadge,
              item.status === 'withdrawn' && styles.withdrawnBadge,
            ]}
          >
            <Text style={styles.statusText}>
              {item.status?.toUpperCase() || 'UNKNOWN'}
            </Text>
          </View>
        </View>

        <Text style={styles.dateText}>
          Requested: {new Date(item.joined_at).toLocaleString()}
        </Text>

        {item.reviewed_at ? (
          <Text style={styles.dateText}>
            Reviewed: {new Date(item.reviewed_at).toLocaleString()}
          </Text>
        ) : null}

        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.approveButton]}
              disabled={!!updatingId}
              onPress={() => updateStatus(item, 'approved')}
            >
              {isUpdating ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Approve</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.rejectButton]}
              disabled={!!updatingId}
              onPress={() => updateStatus(item, 'rejected')}
            >
              <Text style={styles.buttonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#237A57" />
        <Text style={styles.loadingText}>Loading participants...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{eventName}</Text>
      <Text style={styles.subtitle}>
        Review and manage participation requests.
      </Text>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={
          members.length === 0 ? styles.emptyContainer : styles.list
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
            No participants found for this event yet.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7F6',
  },
  loadingText: {
    marginTop: 10,
    color: '#555555',
  },
  title: {
    fontSize: 23,
    fontWeight: 'bold',
    color: '#183D2B',
    marginBottom: 5,
  },
  subtitle: {
    color: '#666666',
    marginBottom: 18,
  },
  list: {
    paddingBottom: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666666',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8E4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  dogInfo: {
    flex: 1,
  },
  dogName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#183D2B',
  },
  ownerName: {
    color: '#555555',
    marginTop: 5,
  },
  statusBadge: {
    backgroundColor: '#FFF0C2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  approvedBadge: {
    backgroundColor: '#D9F3E3',
  },
  rejectedBadge: {
    backgroundColor: '#FCE0E0',
  },
  withdrawnBadge: {
    backgroundColor: '#E8E8E8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333333',
  },
  dateText: {
    color: '#777777',
    fontSize: 12,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#237A57',
  },
  rejectButton: {
    backgroundColor: '#C43D3D',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
