// components/Avatar.js
// Round profile picture. Falls back to the person's initials.

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts, tones } from '../Theme';

const initialsOf = (name) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

export default function Avatar({
  uri,
  name,
  size = 40,
  bg = tones.brand.bg,
  color = tones.brand.text,
  style,
}) {
  const [failed, setFailed] = useState(false);
  const radius = size / 2;

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={[
          { width: size, height: size, borderRadius: radius, backgroundColor: bg },
          style,
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: radius, backgroundColor: bg },
        style,
      ]}
    >
      <Text style={[styles.initials, { color, fontSize: size * 0.38 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: fonts.medium,
  },
});