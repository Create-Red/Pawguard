// components/HistoryChart.js
// Detailed line chart (History > More details), drawn with react-native-svg.
// Kept calm on purpose:
//   * one smooth line with a soft fade underneath
//   * two thin dashed lines: where Moderate and High start
//   * alerts as small dots on the line
//   * tap / drag to read a value
//   * a gap where the collar sent nothing

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { colors, fonts, tones } from '../Theme';

const HEIGHT = 190;
const PAD = { top: 12, right: 12, bottom: 22, left: 30 };

const toMs = (t) => {
  if (!t) return NaN;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(t);
  return new Date(hasZone ? t : `${t}Z`).getTime();
};

// Where Moderate and High start (upper side only: heat / humidity)
function limitsFor(metric, t) {
  if (!t) return [];
  if (metric === 'surface') {
    return [
      { v: t.moderate_surface_temp, label: 'Moderate', color: tones.amber.pillText },
      { v: t.high_surface_temp, label: 'High', color: colors.danger },
    ];
  }
  if (metric === 'humidity') {
    // At this line panting stops cooling the dog ("too humid")
    return [{ v: t.moderate_humidity, label: 'Too humid', color: tones.amber.pillText }];
  }
  return [];
}

// Smooth curve through the points (Catmull-Rom -> Bezier)
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function timeLabel(ms, kind) {
  const d = new Date(ms);
  if (kind === 'week') return d.toLocaleDateString([], { weekday: 'short' });
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}

export default function HistoryChart({
  width,
  points,
  alerts = [],
  from,
  to,
  metric, // 'surface' | 'ambient' | 'humidity'
  unit,
  color,
  thresholds,
  kind, // 'day' | 'week' | 'event'
}) {
  const [selected, setSelected] = useState(null);

  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const fromMs = from.getTime();
  const span = Math.max(1, to.getTime() - fromMs);

  const data = useMemo(
    () =>
      (points || [])
        .map((p) => ({ t: toMs(p.t), v: Number(p[metric]) }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v)),
    [points, metric]
  );

  if (data.length === 0) {
    return <Text style={styles.empty}>No readings for this.</Text>;
  }

  const limits = limitsFor(metric, thresholds);
  const dataMin = Math.min(...data.map((d) => d.v));
  const dataMax = Math.max(...data.map((d) => d.v));

  // Y range: the data, stretched to include the Moderate line when close
  let yMin = dataMin;
  let yMax = dataMax;
  limits.forEach((l) => {
    if (Number.isFinite(l.v) && l.v - dataMax < (metric === 'humidity' ? 15 : 3)) yMax = Math.max(yMax, l.v);
  });
  const pad = Math.max(0.5, (yMax - yMin) * 0.15);
  yMin = Math.floor(yMin - pad);
  yMax = Math.ceil(yMax + pad);

  const x = (ms) => PAD.left + ((ms - fromMs) / span) * innerW;
  const y = (v) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  // Split into runs where the collar was sending (gap = no line)
  const avgGap = data.length > 1 ? (data[data.length - 1].t - data[0].t) / (data.length - 1) : span;
  const gapLimit = Math.max(avgGap * 3, span / 60);
  const runs = [];
  data.forEach((p, i) => {
    if (i === 0 || p.t - data[i - 1].t > gapLimit) runs.push([]);
    runs[runs.length - 1].push([x(p.t), y(p.v)]);
  });
  const baseY = PAD.top + innerH;

  // 3 light grid lines
  const grid = [0, 0.5, 1].map((f) => yMin + (yMax - yMin) * f);

  // X labels
  const xTicks =
    kind === 'week'
      ? Array.from({ length: 7 }, (_, i) => {
          const d = new Date(fromMs);
          d.setHours(12, 0, 0, 0);
          d.setDate(d.getDate() + i);
          return d.getTime();
        }).filter((ms) => ms <= fromMs + span)
      : [0, 1, 2, 3].map((i) => fromMs + (span * i) / 3);

  // Alert dots sit on the line, at the nearest reading
  const nearest = (ms) =>
    data.reduce((best, p) => (Math.abs(p.t - ms) < Math.abs(best.t - ms) ? p : best), data[0]);

  const pick = (evt) => {
    const ms = fromMs + ((evt.nativeEvent.locationX - PAD.left) / innerW) * span;
    setSelected(nearest(ms));
  };

  const sel = selected && data.some((d) => d.t === selected.t) ? selected : null;
  const shown = sel || data.reduce((a, b) => (b.v > a.v ? b : a), data[0]);
  const shownTime = new Date(shown.t).toLocaleString([], {
    ...(kind === 'week' ? { weekday: 'short' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  });
  const gradId = `fade-${metric}`;

  return (
    <View>
      {/* Big value: tapped point, or the highest */}
      <View style={styles.readout}>
        <Text style={styles.readoutValue}>
          {shown.v.toFixed(metric === 'humidity' ? 0 : 1)}
          <Text style={styles.readoutUnit}> {unit}</Text>
        </Text>
        <Text style={styles.readoutSub}>
          {sel ? shownTime : `Highest · ${shownTime}`}
        </Text>
      </View>

      <View
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderTerminationRequest={() => true}
      >
        <Svg width={width} height={HEIGHT}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.22} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Light grid */}
          {grid.map((v, i) => (
            <G key={`g${i}`}>
              <Line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(v)}
                y2={y(v)}
                stroke={colors.line}
                strokeWidth={0.7}
              />
              <SvgText x={PAD.left - 6} y={y(v) + 3.5} fontSize={10} fill={colors.muted} textAnchor="end">
                {Math.round(v)}
              </SvgText>
            </G>
          ))}

          {/* Where Moderate / High start */}
          {limits.map((l) =>
            Number.isFinite(l.v) && l.v >= yMin && l.v <= yMax ? (
              <G key={l.label}>
                <Line
                  x1={PAD.left}
                  x2={PAD.left + innerW}
                  y1={y(l.v)}
                  y2={y(l.v)}
                  stroke={l.color}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                  opacity={0.7}
                />
                <SvgText
                  x={PAD.left + innerW}
                  y={y(l.v) - 4}
                  fontSize={10}
                  fill={l.color}
                  textAnchor="end"
                >
                  {l.label}
                </SvgText>
              </G>
            ) : null
          )}

          {/* Soft fade + smooth line */}
          {runs.map((run, i) =>
            run.length === 1 ? (
              <Circle key={`r${i}`} cx={run[0][0]} cy={run[0][1]} r={3} fill={color} />
            ) : (
              <G key={`r${i}`}>
                <Path
                  d={`${smoothPath(run)} L${run[run.length - 1][0]},${baseY} L${run[0][0]},${baseY} Z`}
                  fill={`url(#${gradId})`}
                />
                <Path
                  d={smoothPath(run)}
                  stroke={color}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            )
          )}

          {/* Alerts: dots on the line */}
          {alerts.map((a, i) => {
            const ms = toMs(a.t);
            if (!Number.isFinite(ms) || ms < fromMs || ms > fromMs + span) return null;
            const p = nearest(ms);
            const high = String(a.type).includes('HIGH');
            return (
              <Circle
                key={`a${i}`}
                cx={x(p.t)}
                cy={y(p.v)}
                r={4.5}
                fill={high ? colors.danger : tones.amber.pillText}
                stroke={colors.white}
                strokeWidth={2}
              />
            );
          })}

          {/* X labels */}
          {xTicks.map((ms, i) => (
            <SvgText
              key={`x${i}`}
              x={Math.min(Math.max(x(ms), PAD.left + 14), PAD.left + innerW - 14)}
              y={HEIGHT - 5}
              fontSize={10}
              fill={colors.muted}
              textAnchor="middle"
            >
              {timeLabel(ms, kind)}
            </SvgText>
          ))}

          {/* Selected point */}
          {sel && (
            <G>
              <Line
                x1={x(sel.t)}
                x2={x(sel.t)}
                y1={PAD.top}
                y2={baseY}
                stroke={colors.ink}
                strokeWidth={1}
                opacity={0.2}
              />
              <Circle cx={x(sel.t)} cy={y(sel.v)} r={6} fill={colors.white} stroke={color} strokeWidth={2.5} />
            </G>
          )}
        </Svg>
      </View>

      {alerts.length > 0 && (
        <View style={styles.legend}>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
          <Text style={styles.legendText}>Alert</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { marginBottom: 8 },
  readoutValue: { fontFamily: fonts.medium, fontSize: 26, color: colors.ink },
  readoutUnit: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  readoutSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingLeft: PAD.left },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, paddingVertical: 20 },
});