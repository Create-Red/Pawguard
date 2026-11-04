
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';

export default function EventDetailsScreen({ route, navigation }) {
  const eventId = route?.params?.eventId;

  const [event, setEvent] = useState(null);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadEvent = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setEvent(null);
        return;
      }

      setEvent(data);

      const { data: members, error: memberError } = await supabase
        .from('event_members')
        .select('status')
        .eq('event_id', eventId);

      if (memberError) throw memberError;

      const active = (members || []).filter(
        (member) => member.status !== 'withdrawn'
      );

      setCounts({
        total: active.length,
        pending: active.filter((m) => m.status === 'pending').length,
        approved: active.filter((m) => m.status === 'approved').length,
        rejected: active.filter((m) => m.status === 'rejected').length,
      });
    } catch (error) {
      console.error('Event details error:', error);
      Alert.alert('Unable to load event', error.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent])
  );

  const formatDate = (value) => {
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#237A57" />
        <Text style={styles.muted}>Loading event details...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Event not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.cover}>
        <Text style={styles.coverIcon}>🐾</Text>
        <Text style={styles.coverLabel}>PAWGUARD EVENT</Text>
        <Text style={styles.coverTitle}>{event.name}</Text>
        <View style={styles.coverStatus}>
          <Text style={styles.coverStatusText}>
            {event.status?.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About this event</Text>
        <Text style={styles.description}>
          {event.description || 'No event description provided.'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Event Information</Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📅</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Starts</Text>
            <Text style={styles.infoValue}>{formatDate(event.starts_at)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>🏁</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Ends</Text>
            <Text style={styles.infoValue}>{formatDate(event.ends_at)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>📍</Text>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Venue</Text>
            <Text style={styles.infoValue}>
              {event.venue || 'Not specified'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Participants</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{counts.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#D18A22' }]}>
              {counts.pending}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#237A57' }]}>
              {counts.approved}
            </Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#C43D3D' }]}>
              {counts.rejected}
            </Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            navigation.navigate('EventMembers', {
              eventId: event.id,
              eventName: event.name,
            })
          }
        >
          <Text style={styles.primaryButtonText}>
            Manage Participants →
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() =>
            navigation.navigate('EventMonitoring', {
              eventId: event.id,
              eventName: event.name,
            })
          }
        >
          <Text style={styles.secondaryButtonText}>Monitor Dogs</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7F6' },
  content: { padding: 17, paddingBottom: 40 },
  cover: {
    backgroundColor: '#183D2B',
    minHeight: 210,
    borderRadius: 22,
    padding: 22,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  coverIcon: { fontSize: 35, marginBottom: 12 },
  coverLabel: {
    color: '#A7F3C7',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  coverTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 7,
  },
  coverStatus: {
    backgroundColor: '#A7F3C7',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    marginTop: 15,
  },
  coverStatusText: {
    color: '#183D2B',
    fontSize: 10,
    fontWeight: '800',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#183D2B',
    marginBottom: 14,
  },
  description: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 17,
  },
  infoIcon: { fontSize: 22, marginRight: 13 },
  infoContent: { flex: 1 },
  infoLabel: { color: '#94A3B8', fontSize: 11 },
  infoValue: {
    color: '#183D2B',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  statCard: {
    width: '48%',
    backgroundColor: '#F5F8F6',
    borderRadius: 13,
    padding: 15,
  },
  statNumber: {
    fontSize: 25,
    fontWeight: '800',
    color: '#183D2B',
  },
  statLabel: { color: '#64748B', fontSize: 12, marginTop: 4 },
  primaryButton: {
    backgroundColor: '#237A57',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#237A57',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: { color: '#237A57', fontWeight: '800' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7F6',
  },
  muted: { color: '#64748B', marginTop: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#183D2B' },
});
