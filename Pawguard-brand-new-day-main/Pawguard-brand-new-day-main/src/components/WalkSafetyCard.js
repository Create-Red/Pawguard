// components/WalkSafetyCard.js
// Home card: "Safe to walk?"
// Uses the local weather at the dog's last GPS location (Open-Meteo).
// If the weather can't be loaded, it falls back to the collar's air reading.
// Stricter for breeds that overheat more easily (see utils/walkSafety.js).

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Icon from './Icon';
import { fonts, tones } from '../Theme';
import {
  fetchWeather,
  formatHour,
  heatIndexC,
  nextBetterHour,
  walkAdvice,
} from '../utils/walkSafety';

const LEVEL_TONE = { SAFE: 'green', CAUTION: 'amber', AVOID: 'salmon' };
const LEVEL_ICON = { SAFE: 'walk', CAUTION: 'sunny', AVOID: 'thermometer' };

const isNum = (v) => v != null && v !== '' && Number.isFinite(Number(v));

export default function WalkSafetyCard({ tier = 'normal', sensor, collarOnline, gps }) {
  const [weather, setWeather] = useState(null);

  const lat = gps?.latitude;
  const lng = gps?.longitude;

  useEffect(() => {
    let active = true;
    if (lat == null || lng == null) {
      setWeather(null);
      return undefined;
    }
    fetchWeather(lat, lng)
      .then((w) => active && setWeather(w))
      .catch((e) => {
        console.log('WEATHER ERROR:', e.message);
        if (active) setWeather(null);
      });
    return () => {
      active = false;
    };
  }, [lat, lng]);

  // Local weather first; collar air reading only as a backup
  let temp = null;
  let humidity = null;
  if (weather?.now) {
    temp = weather.now.temp;
    humidity = weather.now.humidity;
  } else if (collarOnline && isNum(sensor?.ambient_temp) && isNum(sensor?.humidity)) {
    temp = Number(sensor.ambient_temp);
    humidity = Number(sensor.humidity);
  }

  const hi = temp !== null ? heatIndexC(temp, humidity) : null;
  const advice = walkAdvice(hi, tier);

  if (!advice) {
    return (
      <View style={[styles.card, { backgroundColor: tones.beige.bg }]}>
        <Text style={[styles.meta, { color: tones.beige.sub }]}>Safe to walk?</Text>
        <Text style={[styles.title, { color: tones.beige.text }]}>No weather yet</Text>
      </View>
    );
  }

  const tone = tones[LEVEL_TONE[advice.level]];
  const better = nextBetterHour(weather, tier, advice.level);
  const line = better
    ? `Feels like ${Math.round(hi)} °C · Cooler at ${formatHour(better.time, weather.now?.time)}`
    : `Feels like ${Math.round(hi)} °C · ${advice.tip}`;

  return (
    <View
      style={[styles.card, { backgroundColor: tone.bg }]}
      accessible
      accessibilityLabel={`Safe to walk? ${advice.title}. ${line}`}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={[styles.meta, { color: tone.sub }]}>Safe to walk?</Text>
          <Text style={[styles.title, { color: tone.text }]}>{advice.title}</Text>
          <Text style={[styles.line, { color: tone.sub }]} numberOfLines={1}>
            {line}
          </Text>
        </View>
        <View style={styles.iconWrap}>
          <Icon name={LEVEL_ICON[advice.level]} size={26} color={tone.text} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1 },
  meta: { fontFamily: fonts.regular, fontSize: 13 },
  title: { fontFamily: fonts.medium, fontSize: 22, marginTop: 2 },
  line: { fontFamily: fonts.regular, fontSize: 13, marginTop: 4 },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});