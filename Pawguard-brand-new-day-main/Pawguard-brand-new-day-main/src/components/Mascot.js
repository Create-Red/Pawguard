// components/Mascot.js
// The PawGuard dog: full-body pose pictures with gentle motion.
//
//   <Mascot pose="sleep" size={180} animation="breathe" />
//   <Mascot animation="wave" size={190} />        // Login: waving dog rocks side to side
//   <MascotLoader text="Loading your pets" />     // running dog, hopping
//
// Pose pictures are in assets/mascot/ (see-through background, 600 x 600).

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../Theme';

const POSES = {
  cheer: require('../assets/mascot/pawguard-mascot-cheer.png'), // success
  wave: require('../assets/mascot/pawguard-mascot-wave.png'), // login, empty Home
  run: require('../assets/mascot/pawguard-mascot-run.png'), // loading
  sleep: require('../assets/mascot/pawguard-mascot-sleep.png'), // empty screens
  sad: require('../assets/mascot/pawguard-mascot-sad.png'), // errors, no internet
  stand: require('../assets/mascot/pawguard-mascot-stand.png'), // calm
  takeCare: require('../assets/mascot/pawguard-mascot-take-care.png'), // walk card: Take care
  notNow: require('../assets/mascot/pawguard-mascot-not-now.png'), // walk card: Not now
};

// One-colour running dog for loading screens (coloured with tintColor)
const SILHOUETTE = require('../assets/mascot/pawguard-silhouette-run.png');

// Respect the phone's "Reduce motion" setting
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduce(!!v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduce(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

// Made once, outside the component. A new easing on every render made the
// animation restart each time the screen redrew (e.g. on every key press).
const EASE_SMOOTH = Easing.inOut(Easing.sin);
const EASE_HOP = Easing.out(Easing.quad);

// 0 -> 1 -> 0 forever
function useLoop(duration, active, easing = EASE_SMOOTH) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: duration / 2, easing, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: duration / 2, easing, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duration, active, v, easing]);
  return v;
}

/**
 * animation:
 *   'wave'    - the waving dog rocks smoothly side to side from its feet,
 *               with a small bob (Login, Home)
 *   'bounce'  - hops with a squash and a shadow (loading)
 *   'cheer'   - bigger, happier jumps (success)
 *   'breathe' - slowly grows and shrinks (empty screens)
 *   'droop'   - sinks a little, slowly (errors)
 *   'none'
 */
function MascotInner({ pose = 'stand', size = 160, animation = 'breathe', style }) {
  const reduce = useReduceMotion();
  const moving = !reduce && animation !== 'none';

  const duration =
    { bounce: 650, cheer: 800, wave: 1600, breathe: 2400, droop: 3000 }[animation] || 2000;
  const t = useLoop(duration, moving, animation === 'bounce' || animation === 'cheer' ? EASE_HOP : EASE_SMOOTH);

  let transform = [];
  if (animation === 'bounce') {
    transform = [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.09] }) },
      { scaleY: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.96, 1.02, 1] }) },
    ];
  } else if (animation === 'cheer') {
    transform = [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] }) },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-3deg', '3deg'] }) },
    ];
  } else if (animation === 'wave') {
    // Rock around the feet (bottom centre), not the middle: shift down, turn, shift back
    const half = size / 2;
    transform = [
      { translateY: half },
      { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
      { translateY: -half },
      { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -size * 0.02, 0] }) },
    ];
  } else if (animation === 'breathe') {
    transform = [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }];
  } else if (animation === 'droop') {
    transform = [
      { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, size * 0.025] }) },
      { scaleY: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) },
    ];
  }

  const showShadow = moving && (animation === 'bounce' || animation === 'cheer');
  const img = { width: size, height: size };

  return (
    <View style={[{ width: size, height: size }, style]} accessible accessibilityLabel="PawGuard dog">
      {showShadow && (
        <Animated.View
          style={[
            styles.shadow,
            {
              width: size * 0.45,
              left: size * 0.275,
              bottom: size * 0.01,
              opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.06] }),
              transform: [{ scaleX: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }) }],
            },
          ]}
        />
      )}

      <Animated.View style={[img, { transform }]}>
        <Animated.Image
          source={animation === 'wave' ? POSES.wave : POSES[pose] || POSES.stand}
          style={img}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

// Skip redraws when nothing about the dog changed (typing on Login, etc.)
const Mascot = React.memo(MascotInner);
export default Mascot;

// Full-screen loading: a simple running-dog silhouette that trots in place
// (the full-colour running dog is used on the Home "Safe to walk" card)
export function MascotLoader({ text = 'Loading', size = 96, color = colors.muted, style }) {
  const reduce = useReduceMotion();
  const t = useLoop(520, !reduce, EASE_HOP);
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '' : `${d}.`)), 400);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={[styles.loader, style]} accessibilityRole="progressbar" accessibilityLabel={text}>
      <View style={{ width: size, height: size }}>
        {!reduce && (
          <Animated.View
            style={[
              styles.shadow,
              {
                width: size * 0.5,
                left: size * 0.25,
                bottom: 0,
                opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.05] }),
                transform: [{ scaleX: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }],
              },
            ]}
          />
        )}
        <Animated.Image
          source={SILHOUETTE}
          resizeMode="contain"
          style={{
            width: size,
            height: size,
            tintColor: color,
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.12] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['3deg', '-4deg'] }) },
            ],
          }}
        />
      </View>
      <Text style={styles.loaderText}>
        {text}
        <Text style={styles.dots}>{dots.padEnd(3, ' ')}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#000',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loaderText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.muted,
    marginTop: 14,
  },
  dots: { fontFamily: fonts.medium, color: colors.muted },
});