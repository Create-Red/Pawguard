// screens/event/EventReportScreen.js
// After-event report for organizers:
//   summary tiles, every dog (hottest reading, alerts, offline, check-in),
//   all alerts, and "Save as PDF".

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
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';
import { fmtDateTime, fmtTime, shareReportPdf, summarize } from '../../utils/eventReportPdf';

const ALERT_WORD = { HIGH_RISK: 'High risk', MODERATE_RISK: 'Moderate risk' };

const num = (v, d = 1) => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? '--' : n.toFixed(d);
};

function Tile({ label, value, sub, tone }) {
  return (
    <View style={[styles.tile, tone && { backgroundColor: tone.bg }]}>
      <Text style={[styles.tileLabel, tone && { color: tone.sub }]}>{label}</Text>
      <Text style={[styles.tileValue, tone && { color: tone.text }]} numberOfLines={1}>
        {value}
      </Text>
      {!!sub && (
        <Text style={[styles.tileSub, tone && { color: tone.sub }]} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  );
}

export default function EventReportScreen({ route }) {
  const eventId = route?.params?.eventId;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const load = useCallback(
    async ({ pull = false } = {}) => {
      if (pull) setRefreshing(true);
      const { data, error: rpcError } = await supabase.rpc('get_event_report', {
        p_event_id: eventId,
      });
      if (rpcError) setError(rpcError.message);
      else {
        setReport(data);
        setError('');
      }
      setLoading(false);
      setRefreshing(false);
    },
    [eventId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const savePdf = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await shareReportPdf(report);
    } catch (e) {
      Alert.alert('Could not create PDF', e.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Report unavailable</Text>
        <Text style={styles.errorText}>{error || 'This event could not be loaded.'}</Text>
      </View>
    );
  }

  const e = report.event || {};
  const s = summarize(report);
  const dogs = report.dogs || [];
  const alerts = report.alerts || [];
  const shownAlerts = showAllAlerts ? alerts : alerts.slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load({ pull: true })}
          tintColor={colors.ink}
          colors={[colors.ink]}
        />
      }
    >
      {/* Event */}
      <Text style={styles.title} numberOfLines={2}>{e.name}</Text>
      <Text style={styles.meta}>
        {fmtDateTime(e.starts_at)} – {fmtTime(e.ends_at)}
        {e.venue ? `  ·  ${e.venue}` : ''}
      </Text>

      {/* Summary */}
      <View style={styles.tiles}>
        <Tile label="Dogs joined" value={s.joined} sub="approved" />
        <Tile label="Checked in" value={`${s.checkedIn}/${s.joined}`} sub="arrived" />
      </View>
      <View style={styles.tiles}>
        <Tile
          label="Alerts"
          value={s.alerts}
          sub={`${s.highAlerts} high risk`}
          tone={s.highAlerts > 0 ? tones.salmon : s.alerts > 0 ? tones.amber : tones.green}
        />
        <Tile
          label="Hottest"
          value={s.hottest ? `${num(s.hottest.max_surface)} °C` : '--'}
          sub={s.hottest ? `${s.hottest.dog_name}, ${fmtTime(s.hottest.max_at)}` : ''}
        />
      </View>

      {/* Dogs */}
      <Text style={styles.sectionTitle}>Dogs</Text>
      {dogs.length === 0 ? (
        <Text style={styles.muted}>No approved dogs.</Text>
      ) : (
        dogs.map((d, i) => {
          const risk = Number(d.high) > 0 ? 'HIGH' : Number(d.moderate) > 0 ? 'MODERATE' : 'LOW';
          const riskColor =
            risk === 'HIGH' ? colors.danger : risk === 'MODERATE' ? tones.amber.pillText : colors.ink;
          const notes = [
            Number(d.alerts) ? `${d.alerts} alert${Number(d.alerts) === 1 ? '' : 's'}` : null,
            Number(d.offline_times) ? `offline ${d.offline_times}× (${d.offline_minutes} min)` : null,
            !Number(d.readings) ? 'no collar data' : null,
            d.checked_in_at ? `checked in ${fmtTime(d.checked_in_at)}` : 'not checked in',
          ].filter(Boolean);

          return (
            <View key={d.dog_id} style={[styles.row, i === dogs.length - 1 && styles.rowLast]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{d.dog_name}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>{notes.join('  ·  ')}</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowValue, { color: riskColor }]}>
                  {d.max_surface != null ? `${num(d.max_surface)}°` : '--'}
                </Text>
                <Text style={styles.rowValueSub}>hottest</Text>
              </View>
            </View>
          );
        })
      )}

      {/* Alerts */}
      <Text style={styles.sectionTitle}>Alerts</Text>
      {alerts.length === 0 ? (
        <Text style={styles.muted}>No alerts during the event.</Text>
      ) : (
        <>
          {shownAlerts.map((a, i) => {
            const high = String(a.type).includes('HIGH');
            return (
              <View key={`${a.t}-${i}`} style={[styles.row, i === shownAlerts.length - 1 && styles.rowLast]}>
                <View style={[styles.dot, { backgroundColor: high ? colors.danger : tones.amber.pillText }]} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {a.dog_name} · {ALERT_WORD[a.type] || 'Alert'}
                  </Text>
                  <Text style={styles.rowSub}>
                    {fmtTime(a.t)}
                    {a.reason ? `  ·  ${a.reason}` : ''}
                    {a.surface != null ? `  ·  ${num(a.surface)} °C` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
          {alerts.length > 5 && (
            <TouchableOpacity style={styles.moreButton} onPress={() => setShowAllAlerts((v) => !v)}>
              <Text style={styles.moreText}>
                {showAllAlerts ? 'Show less' : `Show all ${alerts.length} alerts`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* PDF */}
      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.dimmed]}
        onPress={savePdf}
        disabled={saving}
        activeOpacity={0.85}
      >
        {saving ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.primaryButtonText}>Save as PDF</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>
        "Offline" counts gaps of 3 minutes or more with no data from the collar.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: colors.white,
  },
  errorTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.ink },
  errorText: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6 },

  title: { fontFamily: fonts.medium, fontSize: 26, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: 18 },

  tiles: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  tile: { flex: 1, backgroundColor: colors.tile, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16 },
  tileLabel: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 0.4, color: colors.tileLabel },
  tileValue: { fontFamily: fonts.medium, fontSize: 24, color: colors.ink, marginTop: 4 },
  tileSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 22,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingHorizontal: 2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: { fontFamily: fonts.medium, fontSize: 18 },
  rowValueSub: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  dot: { width: 10, height: 10, borderRadius: 5 },

  moreButton: { height: 44, justifyContent: 'center', alignItems: 'center' },
  moreText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },

  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  dimmed: { opacity: 0.5 },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 14,
  },
});