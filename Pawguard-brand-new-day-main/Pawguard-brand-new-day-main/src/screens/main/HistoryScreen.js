import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
// npx expo install @react-native-community/datetimepicker
import DateTimePicker from '@react-native-community/datetimepicker';

import HistoryChart from '../../components/HistoryChart';
import Icon from '../../components/Icon';
import Mascot, { MascotLoader } from '../../components/Mascot';
import TempBars from '../../components/TempBars';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { getAlertThresholds, getDogTier, loadAlertThresholds } from '../../utils/healthRisk';
import { useSelectedDogId } from '../../utils/selectedDog';
import { colors, fonts, tones } from '../../Theme';

const CHART_WIDTH = Dimensions.get('window').width - 40;
const COLLAPSED_ROWS = 5;
const RECORD_LIMIT = 50;

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'event', label: 'Event' },
];

const METRICS = [
  { key: 'surface', label: 'Surface', title: 'Surface temperature', unit: '°C', color: '#b5523b' },
  { key: 'ambient', label: 'Ambient', title: 'Air temperature', unit: '°C', color: '#8a6a1f' },
  { key: 'humidity', label: 'Humidity', title: 'Humidity', unit: '%', color: '#3f6f8f' },
];

// ---- Helpers --------------------------------------------------------------

const toDate = (value) => {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const d = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDay = (date) =>
  date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (date, withDay) =>
  date
    ? date.toLocaleString([], {
        ...(withDay ? { month: 'short', day: 'numeric' } : {}),
        hour: 'numeric',
        minute: '2-digit',
      })
    : '--';

const num = (v, d = 1) => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? '--' : n.toFixed(d);
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Which time window to show, and how many chart points to ask for
function getWindow(range, selectedDate, event) {
  const now = new Date();

  if (range === 'week') {
    const from = startOfDay(new Date(now.getTime() - 6 * 86400000));
    return { from, to: now, buckets: 168, kind: 'week' };
  }

  if (range === 'event' && event) {
    const from = toDate(event.starts_at);
    const end = toDate(event.ends_at);
    const to = end && end < now ? end : now;
    if (from && to > from) {
      const minutes = (to - from) / 60000;
      return { from, to, buckets: clamp(Math.round(minutes / 2), 24, 180), kind: 'event' };
    }
  }

  // Today, or a picked day
  const from = startOfDay(range === 'day' && selectedDate ? selectedDate : now);
  const dayEnd = new Date(from.getTime() + 86400000);
  let to = dayEnd < now ? dayEnd : now;
  if (to - from < 3600000) to = new Date(from.getTime() + 3600000); // at least 1 h
  const minutes = (to - from) / 60000;
  return { from, to, buckets: clamp(Math.round(minutes / 5), 24, 144), kind: 'day' };
}

const ALERT_LABEL = {
  HIGH_RISK: { text: 'High risk', tone: 'salmon' },
  MODERATE_RISK: { text: 'Moderate risk', tone: 'amber' },
};

// ---- Screen ---------------------------------------------------------------

export default function HistoryScreen() {
  const { profile } = useAuth();
  const selectedDogId = useSelectedDogId();

  const [dog, setDog] = useState(null);
  const [range, setRange] = useState('today');
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [metricKey, setMetricKey] = useState('surface');

  const [history, setHistory] = useState(null); // { points, alerts, summary, events }
  const [events, setEvents] = useState([]);
  const [records, setRecords] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [showDetails, setShowDetails] = useState(false); // tiles, %, other readings, records

  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const requestId = useRef(0);
  const eventsRef = useRef([]); // latest events list, without reloading on change

  const event = events.find((e) => e.id === eventId) || null;
  const win = useMemo(
    () => getWindow(range, selectedDate, event),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [range, selectedDate, event?.id, history] // history: refresh "now" after each load
  );

  const loadHistory = useCallback(async () => {
    if (!profile?.id) return;

    const key = ++requestId.current;
    const stale = () => key !== requestId.current;

    setLoading(true);
    setErrorMessage('');

    try {
      await loadAlertThresholds(supabase); // limits for the shaded bands

      const { data: dogs, error: dogError } = await supabase
        .from('dogs')
        .select('id, name')
        .eq('owner_id', profile.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: true });
      if (dogError) throw dogError;

      const current = dogs?.find((d) => d.id === selectedDogId) || dogs?.[0] || null;
      if (stale()) return;
      setDog(current);

      if (!current) {
        setHistory(null);
        setRecords([]);
        return;
      }

      const chosenEvent = eventsRef.current.find((e) => e.id === eventId) || null;
      const w = getWindow(range, selectedDate, chosenEvent);

      const [hist, rows] = await Promise.all([
        supabase.rpc('get_dog_history', {
          p_dog_id: current.id,
          p_from: w.from.toISOString(),
          p_to: w.to.toISOString(),
          p_buckets: w.buckets,
        }),
        supabase
          .from('sensor_data')
          .select('id, surface_temp, ambient_temp, humidity, risk_level, timestamp_utc')
          .eq('dog_id', current.id)
          .gte('timestamp_utc', w.from.toISOString())
          .lt('timestamp_utc', w.to.toISOString())
          .order('timestamp_utc', { ascending: false })
          .limit(RECORD_LIMIT),
      ]);

      if (hist.error) throw hist.error;
      if (rows.error) throw rows.error;
      if (stale()) return;

      setHistory(hist.data);
      eventsRef.current = hist.data?.events || [];
      setEvents(eventsRef.current);
      setRecords(rows.data || []);
    } catch (e) {
      if (stale()) return;
      console.error('History error:', e);
      setErrorMessage(e?.message || 'Could not load history. Please try again.');
    } finally {
      if (!stale()) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, selectedDogId, range, selectedDate, eventId]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // New pet: start fresh
  useEffect(() => {
    setHistory(null);
    setRecords([]);
    setEvents([]);
    eventsRef.current = [];
    setEventId(null);
    setExpanded(false);
    if (range === 'event') setRange('today');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDogId]);

  // "Event" picked: default to the most recent event
  useEffect(() => {
    if (range === 'event' && !eventId && events.length > 0) setEventId(events[0].id);
  }, [range, eventId, events]);

  // ---- Date picker -------------------------------------------------------
  const openPicker = () => {
    setTempDate(selectedDate || new Date());
    setShowPicker(true);
  };
  const applyDate = (date) => {
    setSelectedDate(startOfDay(date));
    setRange('day');
    setExpanded(false);
  };
  const onAndroidChange = (e, date) => {
    setShowPicker(false);
    if (e.type === 'set' && date) applyDate(date);
  };

  // ---- Derived -----------------------------------------------------------
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];
  const summary = history?.summary || {};
  const points = history?.points || [];
  const alerts = history?.alerts || [];
  const readings = Number(summary.readings) || 0;
  const tier = dog ? getDogTier(dog.id) : 'normal';
  const thresholds = getAlertThresholds(tier);

  const high = Number(summary.high) || 0;
  const moderate = Number(summary.moderate) || 0;
  const low = Number(summary.low) || 0;
  const judged = high + moderate + low;
  const pct = (n) => (judged ? Math.round((n / judged) * 100) : 0);

  // ---- One-line summary for owners ----
  const worst = high > 0 ? 'HIGH' : moderate > 0 ? 'MODERATE' : 'LOW';
  const rangeWord =
    range === 'week'
      ? 'this week'
      : range === 'event'
      ? `at ${event?.name || 'the event'}`
      : range === 'day' && selectedDate
      ? `on ${selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}`
      : 'today';
  const headline =
    worst === 'HIGH'
      ? `Some risky moments ${rangeWord}`
      : worst === 'MODERATE'
      ? `Mostly safe ${rangeWord}`
      : `All safe ${rangeWord}`;
  const hottest = points.reduce(
    (best, p) =>
      Number.isFinite(Number(p.surface_max)) && (!best || Number(p.surface_max) > Number(best.surface_max))
        ? p
        : best,
    null
  );
  const headlineTone = tones[worst === 'HIGH' ? 'salmon' : worst === 'MODERATE' ? 'amber' : 'green'];
  const chartMetric = showDetails ? metric : METRICS[0]; // owners see Surface only

  if (!hasLoaded) {
    return (
      <MascotLoader text="Loading history" />
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && hasLoaded}
            onRefresh={loadHistory}
            tintColor={colors.ink}
            colors={[colors.ink]}
          />
        }
      >
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {dog ? (
            <>
              Readings for <Text style={styles.subtitleName}>{dog.name}</Text>
            </>
          ) : (
            'Register a pet to see its history.'
          )}
        </Text>

        {/* Range filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {RANGES.map((r) => {
            const active = range === r.key;
            const disabled = r.key === 'event' && events.length === 0;
            return (
              <TouchableOpacity
                key={r.key}
                style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
                onPress={() => {
                  if (disabled) return;
                  setRange(r.key);
                  setExpanded(false);
                }}
                activeOpacity={0.8}
                accessibilityState={{ selected: active, disabled }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.chip, range === 'day' && styles.chipActive]}
            onPress={openPicker}
            activeOpacity={0.8}
            accessibilityLabel="Pick a day"
          >
            <Text style={[styles.chipText, range === 'day' && styles.chipTextActive]}>
              {range === 'day' && selectedDate
                ? selectedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
                : 'Pick a day'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Which event */}
        {range === 'event' && events.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventScroll}>
            {events.map((e) => {
              const active = e.id === eventId;
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.eventChip, active && styles.eventChipActive]}
                  onPress={() => setEventId(e.id)}
                >
                  <Text style={[styles.eventChipText, active && styles.eventChipTextActive]} numberOfLines={1}>
                    {e.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {!!errorMessage && (
          <View style={styles.errorCard}>
            <Mascot pose="sad" size={96} animation="droop" style={styles.errorMascot} />
            <View style={styles.errorBody}>
              <Text style={styles.errorTitle}>Unable to load history</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          </View>
        )}

        {readings === 0 ? (
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <Mascot pose="sleep" size={150} animation="breathe" />
                <Text style={styles.emptyTitle}>No readings</Text>
                <Text style={styles.emptyText}>
                  The collar didn't send anything in this time. Try another range.
                </Text>
              </>
            )}
          </View>
        ) : (
          <>
            {/* The answer, in one line */}
            <View style={[styles.headline, { backgroundColor: headlineTone.bg }]}>
              <Text style={[styles.headlineTitle, { color: headlineTone.text }]}>{headline}</Text>
              <Text style={[styles.headlineSub, { color: headlineTone.sub }]}>
                {alerts.length === 0 ? 'No alerts' : `${alerts.length} alert${alerts.length === 1 ? '' : 's'}`}
                {hottest
                  ? `  ·  Hottest ${num(hottest.surface_max)} °C at ${formatTime(toDate(hottest.t), win.kind !== 'day')}`
                  : ''}
              </Text>
            </View>

            {/* Bar chart: hottest temperature per hour / day, colored by risk */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Temperature</Text>
              {loading && <ActivityIndicator size="small" color={colors.muted} />}
            </View>
            <TempBars points={points} from={win.from} to={win.to} kind={win.kind} />

            {/* Alerts in this range */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alerts</Text>
              <Text style={styles.count}>{alerts.length}</Text>
            </View>
            {alerts.length === 0 ? (
              <Text style={styles.muted}>No alerts in this time.</Text>
            ) : (
              alerts
                .slice()
                .reverse()
                .slice(0, 5)
                .map((a, i, list) => {
                  const style = ALERT_LABEL[a.type] || { text: 'Alert', tone: 'beige' };
                  const t = tones[style.tone];
                  return (
                    <View key={`${a.t}-${i}`} style={[styles.alertRow, i === list.length - 1 && styles.rowLast]}>
                      <View style={[styles.alertDot, { backgroundColor: t.pillText }]} />
                      <View style={styles.alertText}>
                        <Text style={styles.alertTitle}>
                          {style.text}
                          {a.reason ? ` · ${a.reason}` : ''}
                        </Text>
                        <Text style={styles.alertTime}>
                          {formatTime(toDate(a.t), win.kind !== 'day')}
                          {a.surface != null ? `  ·  ${num(a.surface)} °C` : ''}
                        </Text>
                      </View>
                    </View>
                  );
                })
            )}

            {/* Everything else, one tap away */}
            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => {
                setShowDetails((v) => !v);
                if (showDetails) setMetricKey('surface');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.detailsText}>{showDetails ? 'Hide details' : 'More details'}</Text>
              <Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink} />
            </TouchableOpacity>

            {showDetails && (
            <>
            {/* Detailed chart (for the curious, and for the panel) */}
            <Text style={styles.sectionTitle}>{chartMetric.title}</Text>
            <View style={styles.metricRow}>
              {METRICS.map((m) => {
                const active = m.key === metricKey;
                return (
                  <TouchableOpacity
                    key={m.key}
                    style={[styles.metricChip, active && styles.metricChipActive]}
                    onPress={() => setMetricKey(m.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.metricChipText, active && styles.metricChipTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <HistoryChart
              width={CHART_WIDTH}
              points={points}
              alerts={alerts}
              from={win.from}
              to={win.to}
              metric={chartMetric.key}
              unit={chartMetric.unit}
              color={chartMetric.color}
              thresholds={thresholds}
              kind={win.kind}
            />

            {/* Highest / average / lowest */}
            <View style={styles.tiles}>
              {[
                ['Highest', summary[`${chartMetric.key}_max`]],
                ['Average', summary[`${chartMetric.key}_avg`]],
                ['Lowest', summary[`${chartMetric.key}_min`]],
              ].map(([label, value]) => (
                <View key={label} style={styles.tile}>
                  <Text style={styles.tileLabel}>{label}</Text>
                  <Text style={styles.tileValue}>
                    {num(value, chartMetric.key === 'humidity' ? 0 : 1)}
                    <Text style={styles.tileUnit}>{chartMetric.unit}</Text>
                  </Text>
                </View>
              ))}
            </View>

            {/* Time at each risk level */}
            {judged > 0 && (
              <>
                <Text style={styles.sectionTitle}>Time at each risk level</Text>
                <View style={styles.riskBar}>
                  {[
                    [low, tones.green.pillText],
                    [moderate, tones.amber.pillText],
                    [high, colors.danger],
                  ].map(([n, c], i) =>
                    n > 0 ? <View key={i} style={{ flex: n, backgroundColor: c }} /> : null
                  )}
                </View>
                <View style={styles.riskLegend}>
                  <Text style={styles.riskText}>
                    <Text style={[styles.riskStrong, { color: tones.green.pillText }]}>{pct(low)}%</Text> Low
                  </Text>
                  <Text style={styles.riskText}>
                    <Text style={[styles.riskStrong, { color: tones.amber.pillText }]}>{pct(moderate)}%</Text> Moderate
                  </Text>
                  <Text style={styles.riskText}>
                    <Text style={[styles.riskStrong, { color: colors.danger }]}>{pct(high)}%</Text> High
                  </Text>
                </View>
              </>
            )}

            {/* Raw records */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Records</Text>
              <Text style={styles.count}>
                {readings > RECORD_LIMIT ? `latest ${RECORD_LIMIT} of ${readings}` : readings}
              </Text>
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.dateCol]}>Time</Text>
              <Text style={[styles.th, styles.numCol]}>Surface</Text>
              <Text style={[styles.th, styles.numCol]}>Air</Text>
              <Text style={[styles.th, styles.numCol]}>Humid.</Text>
            </View>

            {records.slice(0, expanded ? RECORD_LIMIT : COLLAPSED_ROWS).map((r) => {
              const d = toDate(r.timestamp_utc);
              const riskColor =
                r.risk_level === 'HIGH'
                  ? colors.danger
                  : r.risk_level === 'MODERATE'
                  ? tones.amber.pillText
                  : colors.ink;
              return (
                <View key={r.id} style={styles.tr}>
                  <Text style={[styles.td, styles.dateCol]}>{formatTime(d, win.kind !== 'day')}</Text>
                  <Text style={[styles.td, styles.numCol, { color: riskColor }]}>{num(r.surface_temp)}</Text>
                  <Text style={[styles.td, styles.numCol]}>{num(r.ambient_temp)}</Text>
                  <Text style={[styles.td, styles.numCol]}>{num(r.humidity, 0)}</Text>
                </View>
              );
            })}

            {records.length > COLLAPSED_ROWS && (
              <TouchableOpacity style={styles.expandButton} onPress={() => setExpanded((v) => !v)}>
                <Text style={styles.expandText}>{expanded ? 'Show less' : `Show ${records.length} records`}</Text>
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.ink} />
              </TouchableOpacity>
            )}
            </>
            )}
          </>
        )}

        <Text style={styles.footer}>
          Shaded bands use your pet's alert limits. Readings are for monitoring, not a
          veterinary diagnosis.
        </Text>
      </ScrollView>

      {/* Android: native dialog */}
      {showPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={onAndroidChange}
        />
      )}

      {/* iOS: bottom sheet */}
      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.backdrop}>
            <TouchableOpacity style={styles.backdropDismiss} activeOpacity={1} onPress={() => setShowPicker(false)} />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.sheetCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Pick a day</Text>
                <TouchableOpacity
                  onPress={() => {
                    applyDate(tempDate);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.sheetDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                themeVariant="light"
                accentColor={colors.accent}
                onChange={(e, date) => date && setTempDate(date)}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 120 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },

  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 16 },
  subtitleName: { fontFamily: fonts.medium, color: colors.ink },

  // Range chips
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    justifyContent: 'center',
    backgroundColor: colors.pill,
  },
  chipActive: { backgroundColor: colors.accent },
  chipDisabled: { opacity: 0.4 },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipTextActive: { color: colors.onAccent },

  eventScroll: { flexGrow: 0, marginTop: 4, marginBottom: 4 },
  eventChip: {
    height: 34,
    maxWidth: 200,
    paddingHorizontal: 14,
    borderRadius: 17,
    marginRight: 8,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  eventChipActive: { borderColor: colors.ink },
  eventChipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  eventChipTextActive: { fontFamily: fonts.medium, color: colors.ink },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 24,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  count: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 14 },

  // One-line answer
  headline: { borderRadius: 24, paddingHorizontal: 20, paddingVertical: 16, marginTop: 14 },
  headlineTitle: { fontFamily: fonts.medium, fontSize: 20 },
  headlineSub: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },

  detailsToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 48,
    marginTop: 16,
    borderRadius: 24,
    backgroundColor: colors.pill,
  },
  detailsText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingHorizontal: 2 },

  // Metric switch
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricChip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  metricChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  metricChipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  metricChipTextActive: { color: colors.onAccent },

  // Tiles
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { flex: 1, backgroundColor: colors.tile, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 14 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 0.6, color: colors.tileLabel },
  tileValue: { fontFamily: fonts.medium, fontSize: 19, color: colors.ink, marginTop: 4 },
  tileUnit: { fontFamily: fonts.regular, fontSize: 13, color: colors.tileLabel },

  // Risk bar
  riskBar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.tile,
  },
  riskLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 2 },
  riskText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  riskStrong: { fontFamily: fonts.semibold },

  // Alerts
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  alertDot: { width: 10, height: 10, borderRadius: 5 },
  alertText: { flex: 1 },
  alertTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  alertTime: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },

  // Table
  tableHead: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  th: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  tr: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  td: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  dateCol: { flex: 1.6 },
  numCol: { flex: 1, textAlign: 'right' },
  expandButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    height: 44,
    marginTop: 4,
  },
  expandText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },

  // States
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: tones.salmon.bg,
    borderRadius: 20,
    padding: 12,
    marginTop: 12,
  },
  errorMascot: { marginVertical: -6 },
  errorBody: { flex: 1 },
  errorTitle: { fontFamily: fonts.semibold, fontSize: 15, color: tones.salmon.text },
  errorText: { fontFamily: fonts.regular, fontSize: 13, color: tones.salmon.text, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 18, color: colors.ink },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6 },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 28,
  },

  // iOS date sheet
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  backdropDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  sheetCancel: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  sheetTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  sheetDone: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});