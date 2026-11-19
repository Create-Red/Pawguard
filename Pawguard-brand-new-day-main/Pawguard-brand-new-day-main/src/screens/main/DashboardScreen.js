import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import CallVetButton from '../../components/CallVetButton';
import Icon from '../../components/Icon';
import WalkSafetyCard from '../../components/WalkSafetyCard';
import {
  calculateHealthRisk,
  formatRiskReasons,
  getDogTier,
  getRiskReasons,
  loadAlertThresholds,
} from '../../utils/healthRisk';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';
import { registerForPushNotifications } from '../../utils/registerForPush';
import { getSelectedDogId, setSelectedDogId } from '../../utils/selectedDog';

const OFFLINE_AFTER_MS = 2 * 60 * 1000;
const EVENTS_REFRESH_MS = 30 * 1000; // fallback in case realtime is off

const toMillis = (ts) => {
  if (!ts) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const ms = new Date(hasZone ? ts : `${ts}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
};

// Coarse on purpose: "12s ago, 17s ago, 22s ago..." made the card flicker.
const timeAgo = (ms, now) => {
  if (!ms) return 'No data yet';
  const sec = Math.max(0, Math.floor((now - ms) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} d ago`;
};

// Upcoming events this pet is approved for.
// Returns null on failure so callers can keep what is already on screen.
const fetchApprovedEvents = async (dogId) => {
  try {
    const { data: regs, error: regError } = await supabase
      .from('event_members')
      .select('event_id')
      .eq('dog_id', dogId)
      .eq('status', 'approved');

    if (regError) throw regError;
    if (!regs || regs.length === 0) return [];

    const ids = [...new Set(regs.map((r) => r.event_id))];

    const { data: evs, error: evError } = await supabase
      .from('events')
      .select('id, name, venue, starts_at, ends_at, status')
      .in('id', ids)
      .order('starts_at', { ascending: true });

    if (evError) throw evError;

    // Keep an event unless we know for sure it has ended.
    // (A missing ends_at used to count as "ended in 1970" and hide it.)
    return (evs || []).filter((e) => {
      if (e.status === 'cancelled') return false;
      const end = new Date(e.ends_at || e.starts_at).getTime();
      return Number.isNaN(end) || end >= Date.now();
    });
  } catch (e) {
    console.log('APPROVED EVENTS ERROR:', e.message);
    return null;
  }
};

// Small tile like "Time / Venue" in the reference.
// Always one decimal so the width doesn't jump (36.5 vs 36.48123).
function InfoTile({ label, value, unit }) {
  const num = Number(value);
  const empty =
    value === null ||
    value === undefined ||
    value === '' ||
    !Number.isFinite(num);

  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>
        {empty ? '--' : num.toFixed(1)}
        {!empty && <Text style={styles.tileUnit}>{unit}</Text>}
      </Text>
    </View>
  );
}

export default function DashboardScreen({ navigation }) {
  const { profile } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [selectedDog, setSelectedDog] = useState(null);
  const [sensor, setSensor] = useState(null);
  const [device, setDevice] = useState(null);
  const [gps, setGps] = useState(null); // last known location, for local weather
  const [approvedEvents, setApprovedEvents] = useState([]); // upcoming, approved for this pet

  // Three separate loading states instead of one:
  const [initialLoading, setInitialLoading] = useState(true); // first open only
  const [refreshing, setRefreshing] = useState(false);        // pull-to-refresh only
  const [dogLoading, setDogLoading] = useState(false);        // switching to another pet

  const [now, setNow] = useState(Date.now());

  const selectedDogRef = useRef(null); // id of the pet currently on screen
  const dogRequest = useRef(0);        // ignores slow, outdated responses

  // ---- Device status -------------------------------------------------
  const lastSeen = toMillis(sensor?.timestamp_utc);
  const isPaired = !!device;
  const isOnline =
    isPaired && lastSeen !== null && now - lastSeen <= OFFLINE_AFTER_MS;

  let status = 'Online';
  if (!isPaired) status = 'Not paired';
  else if (!isOnline) status = 'Offline';

  const riskLevel = isOnline ? calculateHealthRisk(sensor) : 'UNKNOWN';
  // e.g. "Too hot", "Too hot & humid"
  const reasonText = isOnline ? formatRiskReasons(getRiskReasons(sensor)) : '';

  // Card colour + pill text follow the pet's state
  let tone = tones.beige;
  let pillText = status;
  if (dogLoading) {
    pillText = 'Loading';
  } else if (isOnline) {
    if (riskLevel === 'HIGH') {
      tone = tones.salmon;
      pillText = reasonText ? `High · ${reasonText}` : 'High risk';
    } else if (riskLevel === 'MODERATE') {
      tone = tones.amber;
      pillText = reasonText ? `Moderate · ${reasonText}` : 'Moderate risk';
    } else {
      tone = tones.green;
      pillText = 'Low risk';
    }
  }

  useEffect(() => {
    if (profile?.id) registerForPushNotifications(profile.id);
  }, [profile?.id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // ---- Data loading --------------------------------------------------
  // clear = true only when switching to a DIFFERENT pet (its data must not
  // show the previous pet's values). A normal refresh keeps what is on screen
  // and swaps in the new values in one go.
  const loadDogData = async (dog, { clear = false } = {}) => {
    const key = ++dogRequest.current;
    const isStale = () => key !== dogRequest.current;

    if (clear) {
      setDevice(null);
      setSensor(null);
      setGps(null);
      setApprovedEvents([]);
      setDogLoading(true);
    }

    try {
      const { data: deviceData } = await supabase
        .from('devices')
        .select('*')
        .eq('dog_id', dog.id)
        .maybeSingle();

      if (isStale()) return;

      let sensorData = null;
      let gpsData = null;

      // Readings belong to the DOG (a device can move between dogs)
      if (deviceData) {
        const [latest, lastGps] = await Promise.all([
          supabase
            .from('sensor_data')
            .select('*')
            .eq('dog_id', dog.id)
            .order('timestamp_utc', { ascending: false })
            .limit(1)
            .maybeSingle(),
          // Last real GPS fix, for "Safe to walk?" weather when the collar is off
          supabase
            .from('sensor_data')
            .select('latitude, longitude')
            .eq('dog_id', dog.id)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .neq('latitude', 0)
            .order('timestamp_utc', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (isStale()) return;
        sensorData = latest.data;
        if (lastGps.data) {
          gpsData = {
            latitude: Number(lastGps.data.latitude),
            longitude: Number(lastGps.data.longitude),
          };
        }
      }

      // A failure here must never break the rest of the dashboard.
      const eventRows = await fetchApprovedEvents(dog.id);

      if (isStale()) return;

      // Set everything together so there is no half-updated frame
      // (device present but sensor still empty = brief "Offline" flash).
      setDevice(deviceData);
      setSensor(sensorData);
      setGps(gpsData);
      if (eventRows !== null) setApprovedEvents(eventRows);
    } finally {
      if (!isStale()) setDogLoading(false);
    }
  };

  // Reloads only the events list for the pet on screen (no spinner).
  const refreshApprovedEvents = async (dogId) => {
    if (!dogId) return;
    const rows = await fetchApprovedEvents(dogId);
    // The user may have switched pets while this was loading.
    if (rows === null || selectedDogRef.current !== dogId) return;
    setApprovedEvents(rows);
  };

  const loadDashboard = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    try {
      const { data: dogData, error: dogError } = await supabase
        .from('dogs')
        .select('*')
        .eq('owner_id', profile.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });

      if (dogError) {
        console.log(dogError.message);
        return;
      }

      if (!dogData || dogData.length === 0) {
        selectedDogRef.current = null;
        setDogs([]);
        setSelectedDog(null);
        setDevice(null);
        setSensor(null);
        setApprovedEvents([]);
        return;
      }

      setDogs(dogData);

      const currentDog = dogData.find((item) => item.id === getSelectedDogId());
      const dogToUse = currentDog || dogData[0];

      const samePet = dogToUse.id === selectedDogRef.current;
      selectedDogRef.current = dogToUse.id;

      setSelectedDogId(dogToUse.id);
      setSelectedDog(dogToUse);
      await loadDogData(dogToUse, { clear: !samePet });
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  };

  // ---- Realtime: sensor readings ------------------------------------
  // Listens by dog, so a reading from a device that was just moved to
  // another dog never shows up here.
  useEffect(() => {
    const dogId = selectedDog?.id;
    if (!dogId || !device?.id) return;

    const channel = supabase
      .channel(`sensor-data-${dogId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_data',
          filter: `dog_id=eq.${dogId}`,
        },
        (payload) => {
          if (selectedDogRef.current !== dogId) return;
          setSensor(payload.new);
          setNow(Date.now());
          const { latitude, longitude } = payload.new || {};
          if (latitude != null && longitude != null && Number(latitude) !== 0) {
            setGps({ latitude: Number(latitude), longitude: Number(longitude) });
          }
        }
      )
      .subscribe((s) => console.log('Realtime status:', s));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDog?.id, device?.id]);

  // ---- Realtime: event registrations --------------------------------
  // When an organizer approves (or rejects / removes) this pet's request,
  // the "Upcoming events" list updates straight away.
  useEffect(() => {
    const dogId = selectedDog?.id;
    if (!dogId) return;

    const channel = supabase
      .channel(`event-members-${dogId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE (pending -> approved), DELETE
          schema: 'public',
          table: 'event_members',
          filter: `dog_id=eq.${dogId}`,
        },
        () => refreshApprovedEvents(dogId)
      )
      .subscribe((s) => console.log('Events realtime status:', s));

    // Fallback: re-check every 30 s in case realtime is not enabled
    // for the table or the socket drops.
    const timer = setInterval(
      () => refreshApprovedEvents(dogId),
      EVENTS_REFRESH_MS
    );

    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [selectedDog?.id]);

  // ---- Health alerts -------------------------------------------------
  // Alerts are now created by Supabase itself for every reading
  // (supabase_server_risk_check.sql), even when this app is closed.
  // The app only shows the risk; alerts are in the Alerts tab.

  // ---- Device offline notification -----------------------------------
  // Also done by Supabase now (supabase_offline_check.sql): a check every
  // minute notifies the owner when a collar stops sending data.

  // Silent refresh whenever the tab is focused (no spinner, nothing cleared)
  useFocusEffect(
    useCallback(() => {
      if (profile?.id) {
        const refreshDashboard = async () => {
          await loadAlertThresholds(supabase);
          await loadDashboard();
        };

        refreshDashboard();
      }
    }, [profile?.id])
  );

  // ---- First load: one calm spinner instead of a half-empty screen -----
  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  // ---- Empty state ---------------------------------------------------
  if (dogs.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: tones.brand.bg }]}>
          <Icon name="paw" size={40} color={tones.brand.text} />
        </View>
        <Text style={styles.emptyTitle}>No pet registered</Text>
        <Text style={styles.emptyText}>
          Register your pet to start using PawGuard.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, styles.emptyButton]}
          onPress={() => navigation.navigate('RegisterPet')}
        >
          <Text style={styles.primaryButtonText}>Register pet</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Main UI -------------------------------------------------------
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
          onRefresh={() => loadDashboard({ pull: true })}
        />
      }
    >
      {/* Header: brand */}
      <View style={styles.topHeader}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>PawGuard</Text>
          <View style={styles.brandDot} />
        </View>
      </View>

      <Text style={styles.title}>My pets</Text>

      {/* Pet selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
      >
        {dogs.map((item) => {
          const active = selectedDog?.id === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                if (item.id === selectedDog?.id) return;
                selectedDogRef.current = item.id;
                setSelectedDogId(item.id);
                setSelectedDog(item);
                loadDogData(item, { clear: true });
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.addChip}
          onPress={() => navigation.navigate('RegisterPet')}
          accessibilityLabel="Add pet"
        >
          <Icon name="add" size={22} color={colors.ink} />
        </TouchableOpacity>
      </ScrollView>

      {/* Pastel pet card */}
      {selectedDog && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.petCard, { backgroundColor: tone.bg }]}
          onPress={() =>
            navigation.navigate('DogProfile', { dogId: selectedDog.id })
          }
          accessibilityRole="button"
          accessibilityLabel={`Open ${selectedDog.name}'s profile`}
        >
          <View style={styles.cardTop}>
            <Text style={[styles.cardMeta, { color: tone.sub }]}>
              {dogLoading
                ? 'Loading...'
                : isPaired
                ? `Last data ${timeAgo(lastSeen, now)}`
                : 'No device yet'}
            </Text>

            <View style={[styles.statusPill, { backgroundColor: tone.pill }]}>
              <Text style={[styles.statusPillText, { color: tone.pillText }]}>
                {pillText}
              </Text>
            </View>
          </View>

          <View style={styles.cardIdentity}>
            {selectedDog.photo_url ? (
              <Image
                source={{ uri: selectedDog.photo_url }}
                style={styles.petPhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.petPhotoFallback}>
                <Icon name="paw" size={32} color={tone.text} />
              </View>
            )}

            <View style={styles.petDetails}>
              <Text
                style={[styles.petName, { color: tone.text }]}
                numberOfLines={1}
              >
                {selectedDog.name}
              </Text>

              <Text
                style={[styles.petInfo, { color: tone.sub }]}
                numberOfLines={2}
              >
                {selectedDog.breed || 'Unknown breed'}
                {selectedDog.age ? `  •  ${selectedDog.age} yrs` : ''}
              </Text>
            </View>

            <View style={styles.goButton}>
              <Icon name="chevron-forward" size={18} color={tone.text} />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* At risk: one tap to the vet */}
      {selectedDog && !dogLoading && (riskLevel === 'HIGH' || riskLevel === 'MODERATE') && (
        <CallVetButton
          dog={selectedDog}
          navigation={navigation}
          tone={riskLevel === 'HIGH' ? tones.salmon : tones.amber}
          style={styles.vetButton}
        />
      )}

      {/* Readings (like "Event Details" + Time/Venue tiles) */}
      <Text style={styles.sectionTitle}>
        {dogLoading
          ? 'Readings'
          : isOnline
          ? 'Live readings'
          : 'Last known readings'}
      </Text>

      <View style={[styles.tiles, (!isOnline || dogLoading) && styles.dimmed]}>
        <InfoTile label="Surface" value={sensor?.surface_temp} unit="°C" />
        <InfoTile label="Ambient" value={sensor?.ambient_temp} unit="°C" />
        <InfoTile label="Humidity" value={sensor?.humidity} unit="%" />
      </View>

      {/* Safe to walk? (collar air reading, or local weather) */}
      {selectedDog && !dogLoading && isPaired && (
        <WalkSafetyCard
          dogName={selectedDog.name}
          tier={getDogTier(selectedDog.id)}
          sensor={sensor}
          collarOnline={isOnline}
          gps={gps}
        />
      )}

      {/* One primary action, like "Register" */}
      {selectedDog && (
        <TouchableOpacity
          style={[styles.primaryButton, dogLoading && styles.dimmed]}
          disabled={dogLoading}
          onPress={() =>
            isPaired
              ? navigation.navigate('Map', { dog: selectedDog })
              : navigation.navigate('PairDevice', {
                  dogId: selectedDog.id,
                  dogName: selectedDog.name,
                })
          }
        >
          <Text style={styles.primaryButtonText}>
            {dogLoading
              ? 'Loading...'
              : isPaired
              ? 'View location'
              : 'Pair device'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Upcoming events this pet is approved for */}
      <View style={styles.eventsHeader}>
        <Text style={styles.eventsTitle}>Upcoming events</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Events')}>
          <Text style={styles.seeAll}>
            {approvedEvents.length > 0 ? 'See all' : 'Browse'}
          </Text>
        </TouchableOpacity>
      </View>

      {approvedEvents.length === 0 ? (
        <Text style={styles.eventsEmpty}>
          {dogLoading
            ? 'Loading...'
            : `${selectedDog?.name || 'Your pet'} has no approved events yet.`}
        </Text>
      ) : (
        approvedEvents.slice(0, 3).map((event, index, list) => {
          const date = new Date(event.starts_at);
          const valid = !Number.isNaN(date.getTime());
          const endMs = new Date(event.ends_at).getTime();
          // Started and not yet ended (no end time = ongoing once started)
          const ongoing =
            valid &&
            now >= date.getTime() &&
            (Number.isNaN(endMs) || now <= endMs);

          return (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.eventRow,
                index === list.length - 1 && styles.eventRowLast,
              ]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Events')}
            >
              <View style={[styles.dateBadge, ongoing && { backgroundColor: tones.green.bg }]}>
                <Text style={[styles.dateDay, ongoing && { color: tones.green.text }]}>
                  {valid ? date.getDate() : '--'}
                </Text>
                <Text style={[styles.dateMonth, ongoing && { color: tones.green.pillText }]}>
                  {valid
                    ? date.toLocaleDateString([], { month: 'short' }).toUpperCase()
                    : ''}
                </Text>
              </View>

              <View style={styles.eventText}>
                <Text style={styles.eventName} numberOfLines={1}>
                  {event.name}
                </Text>
                <Text style={styles.eventVenue} numberOfLines={1}>
                  {event.venue}
                </Text>
              </View>

              {ongoing ? (
                <View style={styles.ongoingPill}>
                  <View style={styles.ongoingDot} />
                  <Text style={styles.ongoingText}>Ongoing</Text>
                </View>
              ) : (
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              )}
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ongoingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    backgroundColor: tones.green.pill,
  },
  ongoingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: tones.green.pillText },
  ongoingText: { fontFamily: fonts.medium, fontSize: 11, color: tones.green.pillText },
  vetButton: { marginTop: 12 },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 120,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  // Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40, // same height as before the bell was removed
    marginTop: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  brandText: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginLeft: 3,
    marginBottom: 7,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginTop: 36,
    marginBottom: 16,
  },

  // Chips
  chips: {
    flexGrow: 0,
    marginBottom: 20,
  },
  chip: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 21,
    marginRight: 10,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  addChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.pill,
  },
  chipText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  chipTextActive: {
    color: colors.onAccent,
  },

  // Pastel card
  petCard: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    minHeight: 170,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  statusPill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  statusPillText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  cardIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 14,
  },
  petPhoto: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  petPhotoFallback: {
    width: 82,
    height: 82,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  petDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  petName: {
    fontFamily: fonts.medium,
    fontSize: 26,
  },
  petInfo: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 4,
  },
  goButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Readings
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 28,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  dimmed: {
    opacity: 0.5,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  tileLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.tileLabel,
  },
  tileValue: {
    fontFamily: fonts.medium,
    fontSize: 19,
    color: colors.ink,
    marginTop: 4,
  },
  tileUnit: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.tileLabel,
  },

  // Button
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },

  // Upcoming events
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 36,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  eventsTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  seeAll: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  eventsEmpty: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  eventRowLast: {
    borderBottomWidth: 0,
  },
  dateBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: tones.brand.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateDay: {
    fontFamily: fonts.medium,
    fontSize: 18,
    lineHeight: 22,
    color: tones.brand.text,
  },
  dateMonth: {
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 0.8,
    color: tones.brand.pillText,
  },
  eventText: {
    flex: 1,
  },
  eventName: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },
  eventVenue: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 1,
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.white,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    fontSize: 24,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    marginTop: 8,
    color: colors.muted,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: 28,
  },
});