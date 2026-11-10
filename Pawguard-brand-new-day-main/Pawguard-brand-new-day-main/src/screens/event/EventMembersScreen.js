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
import { colors, fonts, tones } from '../../Theme';

const FILTERS = ['all', 'pending', 'approved', 'rejected'];

const STATUS_TONE = {
  approved: 'green',
  pending: 'amber',
  rejected: 'salmon',
};

// Photo if the dog has one, otherwise a soft circle with the initial
function Avatar({ dog, size = 52 }) {
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (dog?.photo_url) {
    return <Image source={{ uri: dog.photo_url }} style={style} />;
  }

  const initial = (dog?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <View style={[styles.avatar, style]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

export default function EventMembersScreen({ route, navigation }) {
  const { user, profile } = useAuth();

  const eventId = route?.params?.eventId;
  const eventName = route?.params?.eventName || 'Participants';

  const [members, setMembers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('all');

  const loadMembers = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);

      if (!user || !eventId) {
        setMembers([]);
        setInitialLoading(false);
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
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, eventId, profile?.role]
  );

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [loadMembers])
  );

  const counts = useMemo(
    () => ({
      all: members.filter((m) => m.status !== 'withdrawn').length,
      pending: members.filter((m) => m.status === 'pending').length,
      approved: members.filter((m) => m.status === 'approved').length,
      rejected: members.filter((m) => m.status === 'rejected').length,
    }),
    [members]
  );

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

  const renderMember = ({ item, index }) => {
    const dog = item.dogs;
    const owner = item.profiles;
    const isPending = item.status === 'pending';
    const isUpdating = updatingId === item.id;
    const statusTone = tones[STATUS_TONE[item.status]] || tones.beige;
    const isLast = index === visibleMembers.length - 1;

    const subtitle = [owner?.name, dog?.breed].filter(Boolean).join('  ·  ');

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.row, isLast && styles.rowLast]}
        onPress={() =>
          navigation.navigate('ParticipantProfile', { member: item, eventName })
        }
      >
        <View style={styles.rowMain}>
          <Avatar dog={dog} />

          <View style={styles.rowText}>
            <Text style={styles.dogName} numberOfLines={1}>
              {dog?.name || 'Dog unavailable'}
            </Text>
            <Text style={styles.subtitleText} numberOfLines={1}>
              {subtitle || 'Owner unavailable'}
            </Text>
          </View>

          {/* The filter already says the status, so only show it on "All" */}
          {filter === 'all' && (
            <View style={[styles.pill, { backgroundColor: statusTone.pill }]}>
              <Text style={[styles.pillText, { color: statusTone.pillText }]}>
                {item.status || 'unknown'}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              disabled={!!updatingId}
              onPress={() => updateStatus(item, 'rejected')}
            >
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              disabled={!!updatingId}
              onPress={() => updateStatus(item, 'approved')}
            >
              {isUpdating ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.approveText}>Approve</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>Participants</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {eventName}
        </Text>
      </View>

      <View style={styles.chips}>
        {FILTERS.map((item) => {
          const active = filter === item;

          return (
            <TouchableOpacity
              key={item}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.charAt(0).toUpperCase() + item.slice(1)}
                {'  '}
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
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => loadMembers({ pull: true })}
          />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No {filter === 'all' ? '' : `${filter} `}participants found.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },

  heading: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
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
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    color: colors.muted,
    padding: 25,
  },

  // Plain rows, no boxes
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rowText: { flex: 1 },
  dogName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  subtitleText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },

  avatar: {
    backgroundColor: tones.brand.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: fonts.medium, color: tones.brand.text },

  pill: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.4 },

  // Pending requests get their actions right under the dog
  actions: { flexDirection: 'row', gap: 10, marginTop: 14, marginLeft: 66 },
  actionButton: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: { backgroundColor: colors.accent },
  approveText: { fontFamily: fonts.medium, fontSize: 14, color: colors.onAccent },
  rejectButton: { borderWidth: 1.5, borderColor: colors.danger },
  rejectText: { fontFamily: fonts.medium, fontSize: 14, color: colors.danger },
});