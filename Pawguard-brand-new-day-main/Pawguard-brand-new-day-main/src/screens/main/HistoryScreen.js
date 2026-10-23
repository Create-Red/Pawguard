import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

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
import { LineChart } from 'react-native-chart-kit';
import Ionicons from '@expo/vector-icons/Ionicons';
// npx expo install @react-native-community/datetimepicker
import DateTimePicker from '@react-native-community/datetimepicker';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSelectedDogId } from '../../utils/selectedDog';
import { colors, fonts, tones } from '../../Theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 32;

const LATEST_LIMIT = 30;   // records loaded when no date is picked
const DAY_LIMIT = 500;     // max records loaded for one picked day
const COLLAPSED_ROWS = 5;  // rows shown before "Show all"
const EXPANDED_ROWS = 50;  // max rows shown after "Show all"
const DAY_CHART_POINTS = 12;

// One entry per button in the Trends switcher
const METRICS = [
  {
    key: 'surface',
    label: 'Surface',
    title: 'Surface temperature',
    description: "At the sensor's contact surface",
    field: 'surface_temp',
    unit: '°C',
    color: tones.salmon.sub,
  },
  {
    key: 'ambient',
    label: 'Ambient',
    title: 'Ambient temperature',
    description: 'Of the surroundings',
    field: 'ambient_temp',
    unit: '°C',
    color: tones.amber.sub,
  },
  {
    key: 'humidity',
    label: 'Humidity',
    title: 'Humidity',
    description: 'Relative humidity of the surroundings',
    field: 'humidity',
    unit: '%',
    color: tones.green.pillText,
  },
];

// "#c8dcbc" -> "200, 220, 188"
function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function formatReading(value, unit, decimals = 1) {
  const number = Number(value);

  if (value == null || value === '' || !Number.isFinite(number)) {
    return '--';
  }

  return `${number.toFixed(decimals)}${unit}`;
}

// Supabase "timestamp without time zone" values come back without a "Z".
// They are stored in UTC, so add it (same fix as the dashboard).
function parseDate(value) {
  if (!value) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "Oct 23, 10:00 PM"
function formatShort(value) {
  const date = parseDate(value);
  if (!date) return 'Date unavailable';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(date) {
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Pick n evenly spaced items so a full day still fits on the chart
function downsample(items, n) {
  if (items.length <= n) return items;
  const step = (items.length - 1) / (n - 1);
  return Array.from({ length: n }, (_, i) => items[Math.round(i * step)]);
}

function SensorChart({ metric, records, wholeDay }) {
  const { title, description, field, unit, color } = metric;
  const decimals = 1;

  // records are newest-first; the chart wants oldest-first
  const valid = [...records]
    .reverse()
    .map((item) => ({
      value: Number(item[field]),
      timestamp: item.timestamp_utc,
    }))
    .filter(
      (item) =>
        item.timestamp &&
        item[field] !== '' &&
        Number.isFinite(item.value)
    );

  const points = wholeDay
    ? downsample(valid, DAY_CHART_POINTS)
    : valid.slice(-10);

  // Keep the horizontal axis uncluttered: first, middle, last
  const labels = points.map((point, index) => {
    if (
      index === 0 ||
      index === points.length - 1 ||
      index === Math.floor(points.length / 2)
    ) {
      const date = parseDate(point.timestamp);
      return date
        ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : '';
    }
    return '';
  });

  const values = points.map((point) => point.value);
  const latestValue = values.length
    ? values[values.length - 1].toFixed(decimals)
    : null;

  const lineRgb = hexToRgb(color);
  const labelRgb = hexToRgb(colors.muted);

  const config = {
    backgroundColor: colors.white,
    backgroundGradientFrom: colors.white,
    backgroundGradientTo: colors.white,
    decimalPlaces: decimals,
    color: (opacity = 1) => `rgba(${lineRgb}, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(${labelRgb}, ${opacity})`,
    propsForDots: {
      r: '3',
      strokeWidth: '2',
      stroke: color,
    },
    propsForBackgroundLines: {
      stroke: 'rgba(0,0,0,0.06)',
      strokeDasharray: '',
    },
    fillShadowGradient: color,
    fillShadowGradientOpacity: 0.12,
  };

  return (
    <View style={styles.chartBlock}>
      <View style={styles.chartHeading}>
        <View style={styles.chartHeadingText}>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.chartDescription}>{description}</Text>
        </View>

        {latestValue && (
          <Text style={styles.chartValue}>
            {latestValue}
            <Text style={styles.chartUnit}>{unit}</Text>
          </Text>
        )}
      </View>

      {points.length < 2 ? (
        <Text style={styles.chartEmptyText}>
          At least two valid readings are needed to draw this graph.
        </Text>
      ) : (
        <LineChart
          // key forces a clean redraw when switching metric
          key={metric.key}
          data={{
            labels,
            datasets: [{ data: values }],
          }}
          width={CHART_WIDTH}
          height={190}
          chartConfig={config}
          bezier
          withDots
          withInnerLines
          withOuterLines={false}
          withVerticalLines={false}
          withHorizontalLabels
          withVerticalLabels
          fromZero={false}
          decimalPlaces={decimals}
          segments={4}
          style={styles.chart}
          yAxisSuffix={unit}
          yAxisInterval={1}
        />
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { profile } = useAuth();

  // The pet picked on the dashboard
  const selectedDogId = useSelectedDogId();
  const [dogName, setDogName] = useState('');
  const requestId = useRef(0);

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [metricKey, setMetricKey] = useState('surface');
  const [expanded, setExpanded] = useState(false);

  // null = latest readings, otherwise a Date at local midnight
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const loadHistory = useCallback(async () => {
    if (!profile?.id) {
      setRecords([]);
      setErrorMessage('Your profile could not be loaded. Please sign in again.');
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    // Ignore results from older requests (e.g. after switching pets)
    const requestKey = ++requestId.current;
    const isStale = () => requestKey !== requestId.current;

    setLoading(true);
    setErrorMessage('');

    try {
      // All of this owner's pets, oldest first (same order as the dashboard)
      const { data: dogs, error: dogError } = await supabase
        .from('dogs')
        .select('id, name')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: true });

      if (dogError) throw dogError;

      // Use the pet selected on the dashboard; fall back to the first one
      const dog = dogs?.find((d) => d.id === selectedDogId) || dogs?.[0];
      const dogId = dog?.id;

      if (isStale()) return;
      setDogName(dog?.name || '');

      if (!dogId) {
        setRecords([]);
        return;
      }

      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('id')
        .eq('dog_id', dogId)
        .maybeSingle();

      if (deviceError) throw deviceError;
      if (isStale()) return;

      if (!device) {
        setRecords([]);
        return;
      }

      let query = supabase
        .from('sensor_data')
        .select(
          'id, surface_temp, ambient_temp, humidity, timestamp_utc'
        )
        .eq('device_id', device.id)
        .order('timestamp_utc', { ascending: false });

      if (selectedDate) {
        // Local day -> UTC range (the column stores UTC)
        const start = startOfDay(selectedDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        query = query
          .gte('timestamp_utc', start.toISOString())
          .lt('timestamp_utc', end.toISOString())
          .limit(DAY_LIMIT);
      } else {
        query = query.limit(LATEST_LIMIT);
      }

      const { data, error: historyError } = await query;

      if (historyError) throw historyError;
      if (isStale()) return;

      setRecords(data || []);
    } catch (error) {
      if (isStale()) return;
      console.error('Failed to load sensor history:', error);
      setErrorMessage(
        error?.message || 'Could not load sensor history. Please try again.'
      );
    } finally {
      if (!isStale()) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  }, [profile?.id, selectedDate, selectedDogId]);

  // Runs on focus and again whenever the picked date changes
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  // Switching pets: drop the previous pet's data immediately
  useEffect(() => {
    setRecords([]);
    setDogName('');
    setExpanded(false);
  }, [selectedDogId]);

  // ---- Date picker ---------------------------------------------------
  const openPicker = () => {
    setTempDate(selectedDate || new Date());
    setShowPicker(true);
  };

  const applyDate = (date) => {
    setSelectedDate(startOfDay(date));
    setExpanded(false);
  };

  const clearDate = () => {
    setSelectedDate(null);
    setExpanded(false);
  };

  const onAndroidChange = (event, date) => {
    setShowPicker(false);
    if (event.type === 'set' && date) applyDate(date);
  };

  // ---- Derived values ------------------------------------------------
  const latest = records[0];
  const tone = tones.green;
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];

  const surface = formatReading(latest?.surface_temp, '', 1);
  const ambient = formatReading(latest?.ambient_temp, '', 1);
  const humidity = formatReading(latest?.humidity, '', 1);

  const visibleRecords = records.slice(
    0,
    expanded ? EXPANDED_ROWS : COLLAPSED_ROWS
  );
  const canExpand = records.length > COLLAPSED_ROWS;
  const totalLabel =
    records.length >= DAY_LIMIT && selectedDate
      ? `${DAY_LIMIT}+ total`
      : `${records.length} total`;

  if (!hasLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Loading sensor history...</Text>
      </View>
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
            refreshing={loading}
            onRefresh={loadHistory}
            tintColor={colors.ink}
            colors={[colors.ink]}
          />
        }
      >
        {/* Level 1: screen title */}
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>
          {dogName ? (
            <>
              Readings from{' '}
              <Text style={styles.subtitleName}>{dogName}</Text>
              {"'s device."}
            </>
          ) : (
            "Temperature and humidity readings from your dog's device."
          )}
        </Text>

        {/* Date filter */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateButton, selectedDate && styles.dateButtonActive]}
            onPress={openPicker}
            activeOpacity={0.8}
            accessibilityLabel="Pick a date"
          >
            <Ionicons
              name="calendar-outline"
              size={18}
              color={selectedDate ? colors.white : colors.ink}
            />
            <Text
              style={[
                styles.dateButtonText,
                selectedDate && styles.dateButtonTextActive,
              ]}
            >
              {selectedDate ? formatDay(selectedDate) : 'Pick a date'}
            </Text>
          </TouchableOpacity>

          {selectedDate && (
            <TouchableOpacity onPress={clearDate} style={styles.clearButton}>
              <Text style={styles.clearText}>Show latest</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!errorMessage && (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Unable to load history</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {records.length === 0 && loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : records.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {selectedDate
                ? `No readings on ${formatDay(selectedDate)}`
                : 'No readings yet'}
            </Text>
            <Text style={styles.emptyText}>
              {selectedDate
                ? 'Try another date, or go back to the latest readings.'
                : 'Once your registered PawGuard device uploads sensor readings, your graphs and history will appear here.'}
            </Text>
          </View>
        ) : (
          <>
            {/* The one boxed element: latest (or end-of-day) reading */}
            <View style={[styles.hero, { backgroundColor: tone.bg }]}>
              <View style={styles.heroTop}>
                <Text style={[styles.heroMeta, { color: tone.sub }]}>
                  {selectedDate ? 'Last reading that day' : 'Latest reading'}
                </Text>
                <Text style={[styles.heroMeta, { color: tone.sub }]}>
                  {formatShort(latest?.timestamp_utc)}
                </Text>
              </View>

              <Text style={[styles.heroValue, { color: tone.text }]}>
                {surface}
                {surface !== '--' && <Text style={styles.heroUnit}>°C</Text>}
              </Text>
              <Text style={[styles.heroLabel, { color: tone.sub }]}>
                Surface temperature
              </Text>

              <View style={styles.heroDivider} />

              <View style={styles.heroRow}>
                <View style={styles.heroCol}>
                  <Text style={[styles.heroColLabel, { color: tone.sub }]}>
                    Ambient
                  </Text>
                  <Text style={[styles.heroColValue, { color: tone.text }]}>
                    {ambient}
                    {ambient !== '--' && (
                      <Text style={styles.heroColUnit}> °C</Text>
                    )}
                  </Text>
                </View>

                <View style={styles.heroCol}>
                  <Text style={[styles.heroColLabel, { color: tone.sub }]}>
                    Humidity
                  </Text>
                  <Text style={[styles.heroColValue, { color: tone.text }]}>
                    {humidity}
                    {humidity !== '--' && (
                      <Text style={styles.heroColUnit}> %</Text>
                    )}
                  </Text>
                </View>
              </View>
            </View>

            {/* Level 2: Trends with a button switcher (one chart at a time) */}
            <Text style={styles.sectionTitle}>Trends</Text>
            <Text style={styles.sectionHint}>
              {selectedDate ? 'Across the day' : 'Last 10 readings'}
            </Text>

            <View style={styles.metricRow}>
              {METRICS.map((item) => {
                const active = item.key === metricKey;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.metricChip, active && styles.metricChipActive]}
                    onPress={() => setMetricKey(item.key)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.metricChipText,
                        active && styles.metricChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <SensorChart
              metric={metric}
              records={records}
              wholeDay={!!selectedDate}
            />

            {/* Records: 5 rows, then expand */}
            <View style={styles.recordsHeader}>
              <Text style={styles.sectionTitleFlat}>
                {selectedDate ? 'Records' : 'Recent records'}
              </Text>
              <Text style={styles.recordCount}>{totalLabel}</Text>
            </View>

            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.dateCol]}>Time</Text>
              <Text style={[styles.th, styles.numCol]}>Surface °C</Text>
              <Text style={[styles.th, styles.numCol]}>Ambient °C</Text>
              <Text style={[styles.th, styles.numCol]}>Humidity %</Text>
            </View>

            {visibleRecords.map((item) => {
              const date = parseDate(item.timestamp_utc);

              return (
                <View key={item.id} style={styles.tr}>
                  <View style={styles.dateCol}>
                    <Text style={styles.rowDate}>
                      {date
                        ? date.toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })
                        : '--'}
                    </Text>
                    <Text style={styles.rowTime}>
                      {date
                        ? date.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })
                        : ''}
                    </Text>
                  </View>

                  <Text style={[styles.td, styles.numCol]}>
                    {formatReading(item.surface_temp, '', 1)}
                  </Text>
                  <Text style={[styles.td, styles.numCol]}>
                    {formatReading(item.ambient_temp, '', 1)}
                  </Text>
                  <Text style={[styles.td, styles.numCol]}>
                    {formatReading(item.humidity, '', 1)}
                  </Text>
                </View>
              );
            })}

            {canExpand && (
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded((value) => !value)}
                activeOpacity={0.7}
              >
                <Text style={styles.expandText}>
                  {expanded
                    ? 'Show less'
                    : `Show all ${Math.min(records.length, EXPANDED_ROWS)} records`}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.ink}
                />
              </TouchableOpacity>
            )}

            {expanded && records.length > EXPANDED_ROWS && (
              <Text style={styles.cap}>
                Showing the latest {EXPANDED_ROWS}. Pick a shorter day to see
                fewer records.
              </Text>
            )}
          </>
        )}

        <Text style={styles.footer}>
          Sensor readings are for monitoring and are not a veterinary diagnosis.
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

      {/* iOS: bottom sheet with Cancel / Done */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.backdrop}>
            <TouchableOpacity
              style={styles.backdropDismiss}
              activeOpacity={1}
              onPress={() => setShowPicker(false)}
            />
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <Text style={styles.sheetCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.sheetTitle}>Select date</Text>
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
                accentColor={colors.ink}
                onChange={(event, date) => {
                  if (date) setTempDate(date);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.regular,
    color: colors.muted,
  },

  // Level 1
  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 20,
  },

  subtitleName: {
    fontFamily: fonts.medium,
    color: colors.ink,
  },

  // Date filter
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: colors.pill,
  },
  dateButtonActive: {
    backgroundColor: colors.ink,
  },
  dateButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  dateButtonTextActive: {
    color: colors.white,
  },
  clearButton: {
    paddingHorizontal: 14,
    height: 42,
    justifyContent: 'center',
  },
  clearText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.muted,
  },

  // Hero card (only boxed element besides errors)
  hero: {
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 22,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  heroValue: {
    fontFamily: fonts.medium,
    fontSize: 52,
    lineHeight: 62,
    marginTop: 16,
  },
  heroUnit: {
    fontFamily: fonts.regular,
    fontSize: 22,
  },
  heroLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: -2,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 18,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
  },
  heroCol: {
    flex: 1,
  },
  heroColLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginBottom: 2,
  },
  heroColValue: {
    fontFamily: fonts.medium,
    fontSize: 20,
  },
  heroColUnit: {
    fontFamily: fonts.regular,
    fontSize: 13,
  },

  // Level 2
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 36,
  },
  sectionTitleFlat: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 16,
  },

  // Metric buttons
  metricRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metricChip: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 19,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  metricChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  metricChipText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  metricChipTextActive: {
    color: colors.white,
  },

  // Chart (no box)
  chartBlock: {
    marginBottom: 36,
  },
  chartHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  chartHeadingText: {
    flex: 1,
    paddingRight: 12,
  },
  chartTitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  chartDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  chartValue: {
    fontFamily: fonts.medium,
    fontSize: 22,
    color: colors.ink,
  },
  chartUnit: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  chart: {
    marginLeft: -20,
  },
  chartEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    paddingVertical: 24,
  },

  // Table
  recordsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  recordCount: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  th: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  dateCol: {
    flex: 1.3,
  },
  numCol: {
    flex: 1,
    textAlign: 'right',
  },
  td: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },
  rowDate: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  rowTime: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    marginTop: 8,
    borderRadius: 24,
    backgroundColor: colors.pill,
  },
  expandText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  cap: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 10,
  },

  // Error (important, so it keeps a box)
  errorCard: {
    backgroundColor: tones.salmon.bg,
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
  },
  errorTitle: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: tones.salmon.text,
    marginBottom: 4,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: tones.salmon.pillText,
  },

  // Empty
  empty: {
    marginTop: 28,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
  },

  footer: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 28,
  },

  // iOS date sheet
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backdropDismiss: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  sheetTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  sheetCancel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.muted,
  },
  sheetDone: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
  },
});