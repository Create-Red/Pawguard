// src/components/Glass.js
// Frosted-glass surface. Only looks like glass when something is BEHIND it
// (a map, a photo, content scrolling underneath), so use it for floating
// things: the tab bar, cards over the map.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

export default function Glass({
  children,
  style,
  radius = 28,
  intensity = 50,
  tint = 'light',
  veil = 'rgba(255,255,255,0.5)', // white wash on top of the blur
  ...rest
}) {
  return (
    <View style={[styles.base, { borderRadius: radius }, style]} {...rest}>
      <BlurView
        intensity={intensity}
        tint={tint}
        experimentalBlurMethod="dimezisBlurView" // Android blur (ignored on iOS)
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: veil }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.8)',
  },
});