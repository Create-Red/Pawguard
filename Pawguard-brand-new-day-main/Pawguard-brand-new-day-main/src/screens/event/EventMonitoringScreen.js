import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from '../../components/Icon';
import Glass from '../../components/Glass';
import { supabase } from '../../config/supabase';
// One risk calculation for the whole app (same as the owner dashboard)
import { calculateHealthRisk, loadAlertThresholds } from '../../utils/healthRisk';
import { colors, fonts, tones } from '../../Theme';

const ONLINE_WINDOW_MS = 5 * 60 * 1000;   // reading newer than this = online
const POLL_MS = 10 * 1000;                // refresh while the screen is open
const OPENS_EARLY_MS = 30 * 60 * 1000;    // must match the SQL function

// ---- Helpers -------------------------------------------------------------

const toMillis = (ts) => {
  if (!ts) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(ts);
  const ms = new Date(hasZone ? ts : `${ts}Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
};

const timeAgo = (ms) => {
  if (!ms) return 'No readings';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  return `${Math.floor(hr / 24)} d ago`;
};

const formatNumber = (value) => {
  const n = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(n)
    ? '--'
    : n.toFixed(1);
};

const formatDateTime = (value) =>
  new Date(value).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// upcoming | live | ended | cancelled
export const getMonitoringPhase = (event, now = Date.now()) => {
  if (!event) return 'unknown';
  if (event.status === 'cancelled') return 'cancelled';

  const start = toMillis(event.starts_at);
  const end = toMillis(event.ends_at);

  if (end !== null && now > end) return 'ended';
  if (start !== null && now < start - OPENS_EARLY_MS) return 'upcoming';
  return 'live';
};

// Card colour + pill text follow the dog's state
function getCardStyle(deviceStatus, risk) {
  if (deviceStatus === 'NO DEVICE') return { tone: tones.beige, label: 'No device' };
  if (deviceStatus === 'OFFLINE') return { tone: tones.beige, label: 'Offline' };
  if (risk === 'HIGH') return { tone: tones.salmon, label: 'High risk' };
  if (risk === 'MODERATE') return { tone: tones.amber, label: 'Moderate risk' };
  if (risk === 'LOW') return { tone: tones.green, label: 'Low risk' };
  return { tone: tones.beige, label: 'Unknown' };
}

// Pin colour on the map
const pinColorFor = (item) => {
  if (item.deviceStatus !== 'ONLINE') return colors.muted;
  if (item.healthRisk === 'HIGH') return colors.danger;
  if (item.healthRisk === 'MODERATE') return tones.amber.pillText;
  return tones.green.pillText;
};

// Most urgent first
const severity = (item) => {
  if (item.deviceStatus !== 'ONLINE') return 4;
  return { HIGH: 0, MODERATE: 1, LOW: 2 }[item.healthRisk] ?? 3;
};

// One row from get_event_monitoring -> what the screen needs
const toItem = (row) => {
  const lastMs = toMillis(row.reading_at);
  const sensor = row.reading_at
    ? {
        surface_temp: row.surface_temp,
        ambient_temp: row.ambient_temp,
        humidity: row.humidity,
        timestamp_utc: row.reading_at,
      }
    : null;

  let deviceStatus = 'NO DEVICE';
  if (row.device_id) {
    const age = lastMs === null ? null : Date.now() - lastMs;
    deviceStatus =
      age !== null && age >= -60 * 1000 && age <= ONLINE_WINDOW_MS
        ? 'ONLINE'
        : 'OFFLINE';
  }

  const lat = Number(row.gps_lat);
  const lng = Number(row.gps_lng);
  const hasGps =
    row.gps_lat != null && row.gps_lng != null &&
    Number.isFinite(lat) && Number.isFinite(lng);

  return {
    id: row.member_id,
    dogId: row.dog_id,
    name: row.dog_name || 'Dog',
    breed: row.breed,
    ownerName: row.owner_name,
    battery: row.battery_pct,
    sensor,
    lastMs,
    deviceStatus,
    // Stale readings are never judged (same rule as the owner dashboard)
    healthRisk: deviceStatus === 'ONLINE' ? calculateHealthRisk(sensor) : 'UNKNOWN',
    gps: hasGps ? { latitude: lat, longitude: lng } : null,
    gpsMs: toMillis(row.gps_at),
  };
};

// ---- Small pieces --------------------------------------------------------

function Tiles({ sensor, dim }) {
  return (
    <View style={[styles.tiles, dim && styles.dimmed]}>
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>Surface</Text>
        <Text style={styles.tileValue}>
          {formatNumber(sensor?.surface_temp)}
          <Text style={styles.tileUnit}>°C</Text>
        </Text>
      </View>
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>Ambient</Text>
        <Text style={styles.tileValue}>
          {formatNumber(sensor?.ambient_temp)}
          <Text style={styles.tileUnit}>°C</Text>
        </Text>
      </View>
      <View style={styles.tile}>
        <Text style={styles.tileLabel}>Humidity</Text>
        <Text style={styles.tileValue}>
          {formatNumber(sensor?.humidity)}
          <Text style={styles.tileUnit}>%</Text>
        </Text>
      </View>
    </View>
  );
}

function PhaseNotice({ phase, event }) {
  const content = {
    upcoming: {
      tone: tones.brand,
      icon: 'time-outline',
      title: 'Not started yet',
      text: event?.starts_at
        ? `Monitoring opens 30 minutes before the event starts (${formatDateTime(
            event.starts_at
          )}).`
        : 'Monitoring opens shortly before the event starts.',
    },
    ended: {
      tone: tones.beige,
      icon: 'checkmark-done',
      title: 'Event has ended',
      text: 'Live monitoring closed when the event ended.',
    },
    cancelled: {
      tone: tones.salmon,
      icon: 'close',
      title: 'Event cancelled',
      text: 'Monitoring is not available for cancelled events.',
    },
  }[phase] || {
    tone: tones.beige,
    icon: 'alert-circle',
    title: 'Monitoring unavailable',
    text: 'This event could not be loaded.',
  };

  return (
    <View style={styles.noticeWrap}>
      <View style={[styles.noticeIcon, { backgroundColor: content.tone.bg }]}>
        <Icon name={content.icon} size={36} color={content.tone.text} />
      </View>
      <Text style={styles.noticeTitle}>{content.title}</Text>
      <Text style={styles.noticeText}>{content.text}</Text>
    </View>
  );
}

// ---- Screen --------------------------------------------------------------

export default function EventMonitoringScreen({ route }) {
  const insets = useSafeAreaInsets();
  const eventId = route?.params?.eventId;
  const eventNameParam = route?.params?.eventName;

  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState('unknown');
  const [dogs, setDogs] = useState([]);
  const [view, setView] = useState('list'); // 'list' | 'map'
  const [selectedId, setSelectedId] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);

  const mapRef = useRef(null);
  const fittedOnce = useRef(false);

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (!eventId) {
        setInitialLoading(false);
        return;
      }
      if (pull) setRefreshing(true);

      try {
        const { data: ev, error: evError } = await supabase
          .from('events')
          .select('id, name, status, starts_at, ends_at, organizer_id')
          .eq('id', eventId)
          .maybeSingle();

        if (evError) throw evError;
        setEvent(ev);

        const currentPhase = getMonitoringPhase(ev);
        setPhase(currentPhase);

        if (currentPhase !== 'live') {
          setDogs([]);
          setErrorText('');
          return;
        }

        const { data, error } = await supabase.rpc('get_event_monitoring', {
          p_event_id: eventId,
        });

        if (error) {
          if (error.message?.includes('MONITORING_CLOSED')) {
            // Server clock says closed: before the window or after the end
            const start = toMillis(ev?.starts_at);
            setPhase(start !== null && Date.now() < start ? 'upcoming' : 'ended');
            setDogs([]);
            return;
          }
          throw error;
        }

        const items = (data || []).map(toItem);
        items.sort(
          (a, b) => severity(a) - severity(b) || a.name.localeCompare(b.name)
        );

        setDogs(items);
        setErrorText('');
        setUpdatedAt(Date.now());
      } catch (e) {
        console.log('EVENT MONITORING ERROR:', e.message);
        setErrorText(e.message || 'Unable to load monitoring data.');
      } finally {
        setInitialLoading(false);
        setRefreshing(false);
      }
    },
    [eventId]
  );

  // Load on focus, then keep refreshing every 10 s while the screen is open.
  useFocusEffect(
    useCallback(() => {
      let timer;
      let active = true;

      (async () => {
        await loadAlertThresholds(supabase);
        if (!active) return;
        await load();
        if (active) timer = setInterval(() => load(), POLL_MS);
      })();

      return () => {
        active = false;
        if (timer) clearInterval(timer);
      };
    }, [load])
  );

  // ---- Map helpers ------------------------------------------------------
  const withGps = dogs.filter((d) => d.gps);
  const selected = dogs.find((d) => d.id === selectedId) || null;

  const fitAll = useCallback(() => {
    const coords = withGps.map((d) => d.gps);
    if (!mapRef.current || coords.length === 0) return;

    if (coords.length === 1) {
      mapRef.current.animateToRegion(
        { ...coords[0], latitudeDelta: 0.01, longitudeDelta: 0.01 },
        400
      );
    } else {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 60, bottom: 280, left: 60 },
        animated: true,
      });
    }
  }, [withGps]);

  // Fit the map to all dogs the first time it has something to show
  useEffect(() => {
    if (view === 'map' && !fittedOnce.current && withGps.length > 0) {
      fittedOnce.current = true;
      setTimeout(fitAll, 300);
    }
  }, [view, withGps.length, fitAll]);

  const showOnMap = (item) => {
    setSelectedId(item.id);
    setView('map');
    setTimeout(() => {
      mapRef.current?.animateToRegion(
        { ...item.gps, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        400
      );
    }, 350);
  };

  // ---- Summary ----------------------------------------------------------
  const online = dogs.filter((d) => d.deviceStatus === 'ONLINE').length;
  const high = dogs.filter((d) => d.healthRisk === 'HIGH').length;
  const moderate = dogs.filter((d) => d.healthRisk === 'MODERATE').length;

  // ---- Renderers --------------------------------------------------------
  const renderDog = ({ item }) => {
    const { tone, label } = getCardStyle(item.deviceStatus, item.healthRisk);
    const isOnline = item.deviceStatus === 'ONLINE';
    const subtitle = [item.ownerName, item.breed].filter(Boolean).join('  ·  ');

    return (
      <View style={[styles.card, { backgroundColor: tone.bg }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardMeta, { color: tone.sub }]} numberOfLines={1}>
            {item.deviceStatus === 'NO DEVICE'
              ? 'No device paired'
              : `Last reading ${timeAgo(item.lastMs)}`}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>{label}</Text>
          </View>
        </View>

        <Text style={[styles.dogName, { color: tone.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.subtitle, { color: tone.sub }]} numberOfLines={1}>
          {subtitle || 'Owner unavailable'}
        </Text>

        <Tiles sensor={item.sensor} dim={!isOnline} />

        <View style={styles.cardBottom}>
          <View style={styles.battery}>
            <Icon name="battery-half" size={16} color={tone.sub} />
            <Text style={[styles.batteryText, { color: tone.sub }]}>
              {item.battery != null ? `${Number(item.battery)}%` : '--'}
            </Text>
          </View>

          {item.gps ? (
            <TouchableOpacity
              style={styles.locationButton}
              activeOpacity={0.8}
              onPress={() => showOnMap(item)}
            >
              <Icon name="map-outline" size={15} color={tone.text} />
              <Text style={[styles.locationText, { color: tone.text }]}>
                Show on map
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.noGps, { color: tone.sub }]}>No GPS yet</Text>
          )}
        </View>
      </View>
    );
  };

  // ---- States -----------------------------------------------------------
  if (initialLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const title = event?.name || eventNameParam || 'Event monitoring';

  if (phase !== 'live') {
    return (
      <View style={styles.container}>
        <View style={styles.heading}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
        <PhaseNotice phase={phase} event={event} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header: title, live summary, list/map toggle */}
      <View style={styles.heading}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, styles.titleFlex]} numberOfLines={1}>
            {title}
          </Text>
          <View style={[styles.livePill, { backgroundColor: tones.green.pill }]}>
            <View style={[styles.liveDot, { backgroundColor: tones.green.pillText }]} />
            <Text style={[styles.livePillText, { color: tones.green.pillText }]}>
              Live
            </Text>
          </View>
        </View>

        <Text style={styles.headingSub}>
          {dogs.length} dog{dogs.length === 1 ? '' : 's'}  ·  {online} online
          {high > 0 ? `  ·  ${high} high risk` : ''}
          {moderate > 0 ? `  ·  ${moderate} moderate` : ''}
        </Text>

        <View style={styles.segment}>
          {[
            { key: 'list', label: 'List', icon: 'list' },
            { key: 'map', label: 'Map', icon: 'map' },
          ].map((opt) => {
            const active = view === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segmentItem, active && styles.segmentActive]}
                onPress={() => setView(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Icon
                  name={opt.icon}
                  size={16}
                  color={active ? colors.onAccent : colors.ink}
                />
                <Text
                  style={[styles.segmentText, active && styles.segmentTextActive]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}
      </View>

      {view === 'list' ? (
        <FlatList
          data={dogs}
          keyExtractor={(item) => item.id}
          renderItem={renderDog}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            dogs.length === 0 ? styles.emptyContainer : styles.list
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.ink}
              colors={[colors.ink]}
              onRefresh={() => load({ pull: true })}
            />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No approved participants to monitor yet.
            </Text>
          }
          ListFooterComponent={
            dogs.length > 0 ? (
              <Text style={styles.footnote}>
                Updates every 10 seconds
                {updatedAt ? ` · last ${timeAgo(updatedAt).toLowerCase()}` : ''}.
                {'\n'}Risk levels are preliminary alerts based on configured
                thresholds, not a veterinary diagnosis.
              </Text>
            ) : null
          }
        />
      ) : (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            onPress={() => setSelectedId(null)}
            initialRegion={
              withGps[0]
                ? { ...withGps[0].gps, latitudeDelta: 0.02, longitudeDelta: 0.02 }
                : undefined
            }
          >
            {withGps.map((item) => (
              <Marker
                key={item.id}
                coordinate={item.gps}
                pinColor={pinColorFor(item)}
                onPress={(e) => {
                  e.stopPropagation?.();
                  setSelectedId(item.id);
                }}
              />
            ))}
          </MapView>

          {/* Fit all dogs */}
          {withGps.length > 0 && (
            <TouchableOpacity
              style={[styles.fitButton, { top: 12 }]}
              onPress={fitAll}
              accessibilityLabel="Show all dogs"
            >
              <Icon name="scan" size={18} color={colors.ink} />
            </TouchableOpacity>
          )}

          {/* Bottom panel: selected dog, or a summary */}
          <Glass
            radius={30}
            intensity={60}
            style={[styles.mapPanel, { bottom: Math.max(insets.bottom, 16) }]}
          >
            {selected ? (
              (() => {
                const { tone, label } = getCardStyle(
                  selected.deviceStatus,
                  selected.healthRisk
                );
                return (
                  <>
                    <View style={styles.cardTop}>
                      <Text
                        style={[styles.cardMeta, { color: colors.muted }]}
                        numberOfLines={1}
                      >
                        GPS {timeAgo(selected.gpsMs).toLowerCase()}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: tone.pill }]}>
                        <Text style={[styles.pillText, { color: tone.pillText }]}>
                          {label}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.panelName} numberOfLines={1}>
                      {selected.name}
                    </Text>
                    <Text style={styles.panelSub} numberOfLines={1}>
                      {[selected.ownerName, selected.breed]
                        .filter(Boolean)
                        .join('  ·  ') || 'Owner unavailable'}
                    </Text>
                    <Tiles
                      sensor={selected.sensor}
                      dim={selected.deviceStatus !== 'ONLINE'}
                    />
                  </>
                );
              })()
            ) : (
              <>
                <Text style={styles.panelName}>
                  {withGps.length} of {dogs.length} on the map
                </Text>
                <Text style={styles.panelSub}>
                  {withGps.length === 0
                    ? 'Waiting for collars to send GPS.'
                    : 'Tap a pin to see that dog’s vitals.'}
                </Text>
                <View style={styles.legend}>
                  {[
                    { color: tones.green.pillText, text: 'Low' },
                    { color: tones.amber.pillText, text: 'Moderate' },
                    { color: colors.danger, text: 'High' },
                    { color: colors.muted, text: 'Offline' },
                  ].map((l) => (
                    <View key={l.text} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                      <Text style={styles.legendText}>{l.text}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </Glass>
        </View>
      )}
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

  // Header
  heading: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  titleFlex: { flex: 1 },
  headingSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  livePillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.pill,
    borderRadius: 22,
    padding: 4,
    marginTop: 14,
  },
  segmentItem: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  segmentTextActive: { color: colors.onAccent },

  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    marginTop: 10,
  },

  // Phase notice (not live)
  noticeWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60,
  },
  noticeIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  noticeTitle: { fontFamily: fonts.medium, fontSize: 22, color: colors.ink },
  noticeText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },

  // List
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
  },

  card: {
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    marginBottom: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  cardMeta: { flex: 1, fontFamily: fonts.regular, fontSize: 13, marginRight: 10 },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },
  dogName: {
    fontFamily: fonts.medium,
    fontSize: 24,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 2,
    paddingHorizontal: 2,
  },

  tiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dimmed: { opacity: 0.5 },
  tile: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tileLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.tileLabel,
  },
  tileValue: {
    fontFamily: fonts.medium,
    fontSize: 19,
    color: colors.ink,
    marginTop: 2,
  },
  tileUnit: { fontFamily: fonts.regular, fontSize: 13, color: colors.tileLabel },

  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 2,
  },
  battery: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batteryText: { fontFamily: fonts.medium, fontSize: 13 },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  locationText: { fontFamily: fonts.medium, fontSize: 13 },
  noGps: { fontFamily: fonts.regular, fontSize: 13 },

  // Map
  mapWrap: { flex: 1 },
  fitButton: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  panelName: {
    fontFamily: fonts.medium,
    fontSize: 22,
    color: colors.ink,
    marginTop: 10,
  },
  panelSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.ink },
});