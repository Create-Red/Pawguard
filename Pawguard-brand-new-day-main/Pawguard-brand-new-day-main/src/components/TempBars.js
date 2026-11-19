// components/TempBars.js
// Simple bar chart for owners:
//   Today / a day : one bar per hour
//   This week     : one bar per day
//   Event         : about 12 bars across the event
// Bar height = hottest surface temperature in that time.
// Bar color  = worst risk in that time (green / amber / red).
// Tap a bar to see its value.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fonts, tones } from '../Theme';

const CHART_H = 150;
const RANK = { LOW: 1, MODERATE: 2, HIGH: 3 };
const COLOR = {
  LOW: tones.green.pillText,
  MODERATE: tones.amber.pillText,
  HIGH: colors.danger,
};
const WORD = { LOW: 'Low risk', MODERATE: 'Moderate risk', HIGH: 'High risk' };

const toMs = (t) => {
  if (!t) return NaN;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(t);
  return new Date(hasZone ? t : `${t}Z`).getTime();
};

const hourLabel = (ms) => {
  const h = new Date(ms).getHours();
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;
};

export default function TempBars({ points, from, to, kind }) {
  const [selected, setSelected] = useState(null);

  const bars = useMemo(() => {
    const fromMs = from.getTime();
    const toMsEnd = to.getTime();

    // Slot edges
    let edges = [];
    if (kind === 'week') {
      const d = new Date(fromMs);
      d.setHours(0, 0, 0, 0);
      while (d.getTime() < toMsEnd) {
        edges.push(d.getTime());
        d.setDate(d.getDate() + 1);
      }
    } else if (kind === 'event') {
      const step = Math.max(15 * 60000, (toMsEnd - fromMs) / 12);
      for (let t = fromMs; t < toMsEnd; t += step) edges.push(t);
    } else {
      for (let t = fromMs; t < toMsEnd; t += 3600000) edges.push(t);
    }
    if (edges.length === 0) edges = [fromMs];

    const out = edges.map((start, i) => ({
      start,
      end: edges[i + 1] ?? toMsEnd,
      max: null,
      risk: null,
    }));

    (points || []).forEach((p) => {
      const ms = toMs(p.t);
      const v = Number(p.surface_max ?? p.surface);
      if (!Number.isFinite(ms) || !Number.isFinite(v)) return;
      const b = out.find((x) => ms >= x.start && ms < x.end) || out[out.length - 1];
      if (b.max === null || v > b.max) b.max = v;
      const r = p.risk || 'LOW';
      if (!b.risk || (RANK[r] || 0) > (RANK[b.risk] || 0)) b.risk = r;
    });

    return out;
  }, [points, from, to, kind]);

  const values = bars.map((b) => b.max).filter((v) => v !== null);
  if (values.length === 0) return null;

  // Scale: start a little below the lowest bar so differences are visible
  const top = Math.ceil(Math.max(...values) + 0.5);
  const bottom = Math.floor(Math.min(...values) - 2);
  const height = (v) => Math.max(6, ((v - bottom) / (top - bottom)) * CHART_H);

  // Label every Nth bar so they don't overlap
  const every = kind === 'week' ? 1 : bars.length > 16 ? 4 : bars.length > 8 ? 2 : 1;
  const label = (b) =>
    kind === 'week'
      ? new Date(b.start).toLocaleDateString([], { weekday: 'short' })
      : hourLabel(b.start);

  const sel = selected !== null ? bars[selected] : null;
  const hottestIndex = bars.reduce(
    (best, b, i) => (b.max !== null && (best === -1 || b.max > bars[best].max) ? i : best),
    -1
  );
  const shown = sel || bars[hottestIndex];
  const shownTime =
    kind === 'week'
      ? new Date(shown.start).toLocaleDateString([], { weekday: 'long' })
      : `${new Date(shown.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <View>
      {/* Value of the tapped bar (or the hottest one) */}
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>
          {shown.max.toFixed(1)}
          <Text style={styles.readoutUnit}> °C</Text>
        </Text>
        <Text style={styles.readoutSub}>
          {sel ? '' : 'Hottest · '}
          {shownTime}
          {'  ·  '}
          <Text style={{ color: COLOR[shown.risk] || colors.muted, fontFamily: fonts.medium }}>
            {WORD[shown.risk] || ''}
          </Text>
        </Text>
      </View>

      {/* Bars */}
      <View style={styles.chart}>
        {bars.map((b, i) => (
          <TouchableOpacity
            key={i}
            style={styles.barSlot}
            activeOpacity={0.7}
            onPress={() => setSelected(selected === i ? null : i)}
            disabled={b.max === null}
            accessibilityLabel={
              b.max === null
                ? `${label(b)}: no data`
                : `${label(b)}: ${b.max.toFixed(1)} degrees, ${WORD[b.risk]}`
            }
          >
            {b.max === null ? (
              <View style={styles.noData} />
            ) : (
              <View
                style={[
                  styles.bar,
                  {
                    height: height(b.max),
                    backgroundColor: COLOR[b.risk] || COLOR.LOW,
                    opacity: selected === null || selected === i ? 1 : 0.35,
                  },
                ]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Time labels */}
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <Text key={i} style={styles.label} numberOfLines={1}>
            {i % every === 0 ? label(b) : ''}
          </Text>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {['LOW', 'MODERATE', 'HIGH'].map((k) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: COLOR[k] }]} />
            <Text style={styles.legendText}>{WORD[k].replace(' risk', '')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { marginBottom: 12 },
  readoutValue: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  readoutUnit: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  readoutSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },

  chart: {
    height: CHART_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  noData: { height: 3, borderRadius: 2, backgroundColor: colors.line },

  labels: { flexDirection: 'row', gap: 3, marginTop: 6 },
  label: { flex: 1, fontFamily: fonts.regular, fontSize: 10, color: colors.muted, textAlign: 'center' },

  legend: { flexDirection: 'row', gap: 16, marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
});