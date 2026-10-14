
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40;

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
  propsForDots: {
    r: '3',
    strokeWidth: '1',
    stroke: '#2563EB',
  },
  propsForBackgroundLines: {
    stroke: '#E9EEF5',
    strokeDasharray: '',
  },
  fillShadowGradient: '#2563EB',
  fillShadowGradientOpacity: 0.08,
};

function formatReading(value, unit, decimals = 1) {
  const number = Number(value);

  if (value == null || value === '' || !Number.isFinite(number)) {
    return '--';
  }

  return `${number.toFixed(decimals)}${unit}`;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SummaryCard({ label, value, unit, accent }) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.accent, { backgroundColor: accent }]} />

      <Text style={styles.summaryLabel}>{label}</Text>

      <Text style={styles.summaryValue}>
        {value}
        <Text style={styles.summaryUnit}>{unit}</Text>
      </Text>
    </View>
  );
}

function SensorChart({
  title,
  description,
  records,
  field,
  unit,
  color,
  decimals = 1,
}) {
  const points = records
    .slice(0, 10)
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

  const labels = points.map((point, index) => {
    // Keep the horizontal axis uncluttered.
    if (
      index === 0 ||
      index === points.length - 1 ||
      index === Math.floor(points.length / 2)
    ) {
      const date = new Date(point.timestamp);

      return Number.isNaN(date.getTime())
        ? ''
        : date.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
    }

    return '';
  });

  const values = points.map((point) => point.value);

  const config = {
    ...chartConfig,
    color: (opacity = 1) =>
      color === '#2563EB'
        ? `rgba(37, 99, 235, ${opacity})`
        : color === '#0D9488'
          ? `rgba(13, 148, 136, ${opacity})`
          : `rgba(217, 119, 6, ${opacity})`,
    propsForDots: {
      r: '3',
      strokeWidth: '1',
      stroke: color,
    },
    fillShadowGradient: color,
  };

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeading}>
        <View>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.chartDescription}>{description}</Text>
        </View>

        <View style={[styles.legendDot, { backgroundColor: color }]} />
      </View>

      {points.length < 2 ? (
        <View style={styles.chartEmpty}>
          <Text style={styles.chartEmptyText}>
            At least two valid readings are needed to draw this graph.
          </Text>
        </View>
      ) : (
        <>
          <LineChart
            data={{
              labels,
              datasets: [{ data: values }],
            }}
            width={CHART_WIDTH}
            height={210}
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
            verticalLabelRotation={-25}
            style={styles.chart}
            yAxisSuffix={unit}
            yAxisInterval={1}
          />

          <Text style={styles.chartFootnote}>
            Showing up to the 10 most recent valid readings, in time order.
          </Text>
        </>
      )}
    </View>
  );
}

export default function HistoryScreen() {
  const { profile } = useAuth();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadHistory = useCallback(async () => {
    if (!profile?.id) {
      setRecords([]);
      setErrorMessage('Your profile could not be loaded. Please sign in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data: dogs, error: dogError } = await supabase
        .from('dogs')
        .select('id')
        .eq('owner_id', profile.id)
        .limit(1);

      if (dogError) throw dogError;

      const dogId = dogs?.[0]?.id;

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

      if (!device) {
        setRecords([]);
        return;
      }

      const { data, error: historyError } = await supabase
        .from('sensor_data')
        .select(
          'id, surface_temp, ambient_temp, humidity, timestamp_utc'
        )
        .eq('device_id', device.id)
        .order('timestamp_utc', { ascending: false })
        .limit(30);

      if (historyError) throw historyError;

      setRecords(data || []);
    } catch (error) {
      console.error('Failed to load sensor history:', error);
      setErrorMessage(
        error?.message || 'Could not load sensor history. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const latest = records[0];

  if (loading && records.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading sensor history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadHistory}
          tintColor="#2563EB"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PAWGUARD MONITORING</Text>
        <Text style={styles.title}>Sensor History</Text>
        <Text style={styles.subtitle}>
          Review your dog's recorded temperature and humidity readings.
        </Text>
      </View>

      {!!errorMessage && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Unable to load history</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Latest readings</Text>

      <View style={styles.summaryGrid}>
        <SummaryCard
          label="Surface temp."
          value={formatReading(latest?.surface_temp, '', 1)}
          unit="°C"
          accent="#DC2626"
        />

        <SummaryCard
          label="Ambient temp."
          value={formatReading(latest?.ambient_temp, '', 1)}
          unit="°C"
          accent="#D97706"
        />

        <SummaryCard
          label="Humidity"
          value={formatReading(latest?.humidity, '', 1)}
          unit="%"
          accent="#0D9488"
        />

        <SummaryCard
          label="Records"
          value={String(records.length)}
          unit=""
          accent="#2563EB"
        />
      </View>

      <Text style={styles.sectionTitle}>Trends over time</Text>

      {records.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No readings yet</Text>
          <Text style={styles.emptyText}>
            Once your registered PawGuard device uploads sensor readings,
            your graphs and history will appear here.
          </Text>
        </View>
      ) : (
        <>
          <SensorChart
            title="Surface temperature"
            description="Temperature measured at the sensor's contact surface"
            records={records}
            field="surface_temp"
            unit="°C"
            color="#DC2626"
          />

          <SensorChart
            title="Ambient temperature"
            description="Temperature of the surrounding environment"
            records={records}
            field="ambient_temp"
            unit="°C"
            color="#D97706"
          />

          <SensorChart
            title="Humidity"
            description="Relative humidity in the surrounding environment"
            records={records}
            field="humidity"
            unit="%"
            color="#0D9488"
          />

          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Recent records</Text>
            <Text style={styles.recordCount}>
              {records.length} records
            </Text>
          </View>

          {records.map((item) => (
            <View key={item.id} style={styles.recordCard}>
              <View style={styles.recordTop}>
                <Text style={styles.recordDate}>
                  {formatDate(item.timestamp_utc)}
                </Text>
                <View style={styles.recordIndicator} />
              </View>

              <View style={styles.recordMetrics}>
                <View style={styles.recordMetric}>
                  <Text style={styles.metricLabel}>Surface</Text>
                  <Text style={styles.metricValue}>
                    {formatReading(item.surface_temp, ' °C')}
                  </Text>
                </View>

                <View style={styles.recordMetric}>
                  <Text style={styles.metricLabel}>Ambient</Text>
                  <Text style={styles.metricValue}>
                    {formatReading(item.ambient_temp, ' °C')}
                  </Text>
                </View>

                <View style={styles.recordMetric}>
                  <Text style={styles.metricLabel}>Humidity</Text>
                  <Text style={styles.metricValue}>
                    {formatReading(item.humidity, '%')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </>
      )}

      <Text style={styles.footer}>
        PawGuard · Sensor readings are for monitoring and are not a veterinary diagnosis.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  content: {
    padding: 20,
    paddingBottom: 36,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
  },

  loadingText: {
    marginTop: 12,
    color: '#64748B',
  },

  header: {
    marginBottom: 26,
  },

  eyebrow: {
    color: '#2563EB',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  title: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  subtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  sectionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 28,
    gap: 12,
  },

  summaryCard: {
    width: '48%',
    minHeight: 108,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E9EEF5',
  },

  accent: {
    width: 26,
    height: 4,
    borderRadius: 4,
    marginBottom: 12,
  },

  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },

  summaryValue: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '800',
    marginTop: 6,
  },

  summaryUnit: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },

  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EEF5',
    paddingVertical: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },

  chartHeading: {
    paddingHorizontal: 18,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  chartTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
  },

  chartDescription: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
    paddingRight: 12,
  },

  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },

  chart: {
    marginLeft: -8,
    borderRadius: 12,
  },

  chartFootnote: {
    color: '#94A3B8',
    fontSize: 11,
    paddingHorizontal: 18,
    marginTop: 4,
  },

  chartEmpty: {
    height: 130,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  chartEmptyText: {
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E9EEF5',
    padding: 24,
    marginBottom: 20,
  },

  emptyTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
  },

  emptyText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
  },

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },

  recordCount: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 14,
  },

  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9EEF5',
    padding: 16,
    marginBottom: 12,
  },

  recordTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  recordDate: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  recordIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#0D9488',
    marginLeft: 10,
  },

  recordMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  recordMetric: {
    flex: 1,
  },

  metricLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 5,
  },

  metricValue: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },

  errorCard: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 20,
  },

  errorTitle: {
    color: '#991B1B',
    fontWeight: '800',
    marginBottom: 6,
  },

  errorText: {
    color: '#B91C1C',
    lineHeight: 20,
    fontSize: 13,
  },

  footer: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 18,
  },
});
