
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

const formatDateTime = (value) => {
  if (!value) return 'Not specified';

  return new Date(value).toLocaleString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function PublicEventDetailsScreen({ route }) {
  const eventId = route?.params?.eventId;

  const [event, setEvent] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEventDetails = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);

    if (!eventId) {
      setEvent(null);
      setParticipants([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Fetch event information
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id, name, description, venue, starts_at, ends_at, status')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!eventData) {
        setEvent(null);
        setParticipants([]);
        return;
      }

      setEvent(eventData);

      // Fetch ONLY approved participants
      const { data: members, error: membersError } = await supabase
        .from('event_members')
        .select(`
          id,
          status,
          joined_at,
          dog_id,
          dogs!event_members_dog_id_fkey (
            id,
            name,
            breed,
            age,
            photo_url
          ),
          profiles!event_members_owner_id_fkey (
            id,
            name
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'approved')
        .order('joined_at', { ascending: true });

      if (membersError) throw membersError;

      setParticipants(members || []);
    } catch (error) {
      console.error('Public event details error:', error);

      Alert.alert(
        'Unable to load event',
        error.message || 'Please refresh and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      loadEventDetails();
    }, [loadEventDetails])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Icon name="calendar-outline" size={42} color={colors.muted} />
        <Text style={styles.emptyTitle}>Event not found</Text>
        <Text style={styles.emptyText}>
          This event may no longer be available.
        </Text>
      </View>
    );
  }

  const isCancelled = event.status === 'cancelled';
  const isCompleted = event.status === 'completed';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.ink}
          colors={[colors.ink]}
          onRefresh={() => loadEventDetails(true)}
        />
      }
    >
      {/* Event header */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon name="calendar-outline" size={30} color={colors.ink} />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.date}>
            {event.starts_at
              ? new Date(event.starts_at).toLocaleDateString([], {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Date not specified'}
          </Text>

          <View
            style={[
              styles.statusPill,
              isCancelled && styles.cancelledPill,
              isCompleted && styles.completedPill,
            ]}
          >
            <Text style={styles.statusText}>
              {event.status || 'Unknown'}
            </Text>
          </View>
        </View>

        <Text style={styles.eventName}>{event.name}</Text>

        <View style={styles.venueRow}>
          <Icon name="location-outline" size={17} color={colors.muted} />
          <Text style={styles.venue}>
            {event.venue || 'Venue not specified'}
          </Text>
        </View>
      </View>

      {/* Event schedule */}
      <Text style={styles.sectionTitle}>Event Schedule</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Icon name="calendar-outline" size={19} color={colors.ink} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Starts</Text>
            <Text style={styles.infoValue}>
              {formatDateTime(event.starts_at)}
            </Text>
          </View>
        </View>

        <View style={styles.infoDivider} />

        <View style={styles.infoRow}>
          <Icon name="clock-outline" size={19} color={colors.ink} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Ends</Text>
            <Text style={styles.infoValue}>
              {formatDateTime(event.ends_at)}
            </Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.sectionTitle}>About This Event</Text>

      <Text style={styles.description}>
        {event.description || 'No event description provided.'}
      </Text>

      {/* Approved participants */}
      <View style={styles.participantHeader}>
        <View>
          <Text style={styles.sectionTitle}>Approved Participants</Text>
          <Text style={styles.participantSubtitle}>
            Dogs confirmed to participate in this event.
          </Text>
        </View>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>{participants.length}</Text>
        </View>
      </View>

      {participants.length === 0 ? (
        <View style={styles.emptyParticipants}>
          <Icon name="paw-outline" size={32} color={colors.muted} />
          <Text style={styles.emptyParticipantTitle}>
            No approved participants yet
          </Text>
          <Text style={styles.emptyText}>
            Approved participants will appear here.
          </Text>
        </View>
      ) : (
        participants.map((member) => {
          const dog = member.dogs;
          const owner = member.profiles;

          return (
            <View key={member.id} style={styles.participantCard}>
              {dog?.photo_url ? (
                <Image
                  source={{ uri: dog.photo_url }}
                  style={styles.dogImage}
                />
              ) : (
                <View style={styles.dogPlaceholder}>
                  <Icon name="paw" size={25} color={colors.muted} />
                </View>
              )}

              <View style={styles.dogInfo}>
                <Text style={styles.dogName}>
                  {dog?.name || 'Unknown dog'}
                </Text>

                <Text style={styles.dogDetails}>
                  {[
                    dog?.breed,
                    dog?.age != null
                      ? `${dog.age} ${Number(dog.age) === 1 ? 'year' : 'years'} old`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' • ') || 'Dog details unavailable'}
                </Text>

                <Text style={styles.ownerName}>
                  Owner: {owner?.name || 'Unknown owner'}
                </Text>
              </View>

              <View style={styles.approvedBadge}>
                <Icon name="checkmark-circle" size={17} color="#278451" />
              </View>
            </View>
          );
        })
      )}

      {isCancelled && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            This event has been cancelled.
          </Text>
        </View>
      )}

      {isCompleted && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            This event has been completed.
          </Text>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.regular,
    color: colors.muted,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.ink,
    marginTop: 14,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  hero: {
    backgroundColor: tones.beige.bg,
    padding: 23,
    borderRadius: 28,
  },
  heroIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    flex: 1,
  },
  statusPill: {
    backgroundColor: tones.green.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  cancelledPill: {
    backgroundColor: tones.salmon.pill,
  },
  completedPill: {
    backgroundColor: tones.beige.pill,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.ink,
    textTransform: 'capitalize',
  },
  eventName: {
    fontFamily: fonts.semibold,
    fontSize: 27,
    lineHeight: 35,
    color: colors.ink,
    marginTop: 17,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 7,
  },
  venue: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 19,
    color: colors.ink,
    marginTop: 29,
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: colors.pill,
    borderRadius: 20,
    paddingHorizontal: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 17,
    gap: 14,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  infoValue: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    marginTop: 4,
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: -5,
  },
  countBadge: {
    minWidth: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  countText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 12,
    marginTop: 10,
  },
  dogImage: {
    width: 62,
    height: 62,
    borderRadius: 17,
    backgroundColor: colors.pill,
  },
  dogPlaceholder: {
    width: 62,
    height: 62,
    borderRadius: 17,
    backgroundColor: colors.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dogInfo: {
    flex: 1,
    marginLeft: 13,
  },
  dogName: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
  dogDetails: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 3,
  },
  ownerName: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.ink,
    marginTop: 5,
  },
  approvedBadge: {
    marginLeft: 8,
  },
  emptyParticipants: {
    alignItems: 'center',
    backgroundColor: colors.pill,
    padding: 25,
    borderRadius: 20,
    marginTop: 10,
  },
  emptyParticipantTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
    marginTop: 12,
  },
  notice: {
    marginTop: 22,
    padding: 15,
    borderRadius: 15,
    backgroundColor: tones.salmon.bg,
  },
  noticeText: {
    fontFamily: fonts.medium,
    color: colors.ink,
    textAlign: 'center',
  },
});
