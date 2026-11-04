import React, { useCallback, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

export default function EventOrganizerDashboardScreen({ navigation }) {
  const { user, profile, signOut } = useAuth();

  const [stats, setStats] = useState({
    events: 0,
    participants: 0,
    pending: 0,
  });
  const [initialLoading, setInitialLoading] = useState(true); // first open only
  const [refreshing, setRefreshing] = useState(false);        // pull-to-refresh only

  const loadStats = useCallback(async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    if (!user?.id) {
      setInitialLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('id')
        .eq('organizer_id', user.id);

      if (error) throw error;

      const eventIds = (events || []).map((event) => event.id);

      if (eventIds.length === 0) {
        setStats({ events: 0, participants: 0, pending: 0 });
        return;
      }

      const { data: members, error: memberError } = await supabase
        .from('event_members')
        .select('id, status')
        .in('event_id', eventIds);

      if (memberError) throw memberError;

      const activeMembers = (members || []).filter(
        (member) => member.status !== 'withdrawn'
      );

      setStats({
        events: events.length,
        participants: activeMembers.length,
        pending: activeMembers.filter(
          (member) => member.status === 'pending'
        ).length,
      });
    } catch (error) {
      console.error('Organizer dashboard stats:', error);
      Alert.alert('Unable to load dashboard', error.message);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Silent refresh when the screen is focused (nothing flashes)
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  }

  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const firstName = (profile?.name || 'Organizer').trim().split(' ')[0];
  // The card turns amber when something needs reviewing
  const tone = stats.pending > 0 ? tones.amber : tones.brand;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => loadStats({ pull: true })}
          />
        }
      >
        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.brand}>
            <Text style={styles.brandText}>PawGuard</Text>
            <View style={styles.brandDot} />
          </View>

          <View style={styles.iconPill}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={handleSignOut}
              accessibilityLabel="Sign out"
            >
              <Icon name="log-out-outline" size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.title}>Hi, {firstName}</Text>
        <Text style={styles.subtitle}>Your events at a glance.</Text>

        {/* Overview: the one important card */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.statsCard, { backgroundColor: tone.bg }]}
          onPress={() => navigation.navigate('ManageEvent')}
        >
          <View style={styles.statsTop}>
            <Text style={[styles.statsMeta, { color: tone.sub }]}>Overview</Text>
            {stats.pending > 0 && (
              <View style={[styles.pill, { backgroundColor: tone.pill }]}>
                <Text style={[styles.pillText, { color: tone.pillText }]}>
                  {stats.pending} to review
                </Text>
              </View>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={[styles.statNumber, { color: tone.text }]}>
                {stats.events}
              </Text>
              <Text style={[styles.statLabel, { color: tone.sub }]}>Events</Text>
            </View>

            <View style={[styles.statCol, styles.statColDivider]}>
              <Text style={[styles.statNumber, { color: tone.text }]}>
                {stats.participants}
              </Text>
              <Text style={[styles.statLabel, { color: tone.sub }]}>
                Participants
              </Text>
            </View>

            <View style={[styles.statCol, styles.statColDivider]}>
              <Text style={[styles.statNumber, { color: tone.text }]}>
                {stats.pending}
              </Text>
              <Text style={[styles.statLabel, { color: tone.sub }]}>Pending</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* One primary action */}
        <TouchableOpacity
          style={styles.primaryButton}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreateEvent')}
        >
          <Icon name="add" size={20} color={colors.onAccent} />
          <Text style={styles.primaryButtonText}>Create event</Text>
        </TouchableOpacity>

        {/* One plain row instead of three menu cards */}
        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ManageEvent')}
        >
          <View style={styles.menuIcon}>
            <Icon name="calendar" size={20} color={colors.ink} />
          </View>
          <View style={styles.menuText}>
            <Text style={styles.menuTitle}>My events</Text>
            <Text style={styles.menuSub}>
              Manage events, review requests and monitor dogs
            </Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  brand: { flexDirection: 'row', alignItems: 'flex-end' },
  brandText: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginLeft: 3,
    marginBottom: 7,
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 20,
    backgroundColor: colors.pill,
  },
  iconButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginTop: 36,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 20,
  },

  statsCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
  },
  statsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 30,
  },
  statsMeta: { fontFamily: fonts.regular, fontSize: 14 },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
  statsRow: { flexDirection: 'row', marginTop: 14 },
  statCol: { flex: 1 },
  statColDivider: {
    paddingLeft: 16,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(0,0,0,0.15)',
  },
  statNumber: { fontFamily: fonts.medium, fontSize: 34, lineHeight: 42 },
  statLabel: { fontFamily: fonts.regular, fontSize: 13 },

  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    marginTop: 20,
  },
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: { flex: 1 },
  menuTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  menuSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 1,
  },
});