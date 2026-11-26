// components/SuccessCelebration.js
// A happy "you did it!" pop-up with the cheering dog and a little confetti.
//
//   <SuccessCelebration
//     visible={showCheer}
//     title="Bantay is registered!"
//     message="Pair a collar so PawGuard can watch for heat."
//     primaryLabel="Pair collar now"
//     onPrimary={() => ...}
//     secondaryLabel="Later"
//     onSecondary={() => ...}
//   />

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Mascot from './Mascot';
import { colors, fonts } from '../Theme';

const CONFETTI_COLORS = ['#7BC67E', '#F6C453', '#F28B82', '#8AB4F8', '#C58AF9'];
const PIECES = Array.from({ length: 18 }, (_, i) => ({
  x: (i / 18) * 300 - 150 + ((i * 37) % 23) - 11, // spread across the card
  delay: (i * 53) % 400,
  size: 6 + ((i * 7) % 5),
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  turn: i % 2 ? '220deg' : '-220deg',
  round: i % 3 === 0,
}));
const EASE_OUT = Easing.out(Easing.cubic);

function ConfettiPiece({ piece, run }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!run) return;
    t.setValue(0);
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 1600,
      delay: piece.delay,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [run]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          width: piece.size,
          height: piece.round ? piece.size : piece.size * 1.8,
          borderRadius: piece.round ? piece.size / 2 : 2,
          backgroundColor: piece.color,
          opacity: t.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: piece.x },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-20, 360] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.turn] }) },
          ],
        },
      ]}
    />
  );
}

export default function SuccessCelebration({
  visible,
  title,
  message,
  primaryLabel = 'Great!',
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    pop.setValue(0.85);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 220, easing: EASE_OUT, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Modal visible={!!visible} transparent animationType="none" onRequestClose={onPrimary}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: pop }] }]}>
          <View style={styles.confetti} pointerEvents="none">
            {PIECES.map((p, i) => (
              <ConfettiPiece key={i} piece={p} run={!!visible} />
            ))}
          </View>

          <Mascot pose="cheer" animation="cheer" size={170} style={styles.dog} />

          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.message}>{message}</Text>}

          <TouchableOpacity style={styles.primary} onPress={onPrimary} activeOpacity={0.85}>
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </TouchableOpacity>

          {!!secondaryLabel && (
            <TouchableOpacity style={styles.secondary} onPress={onSecondary} hitSlop={8}>
              <Text style={styles.secondaryText}>{secondaryLabel}</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: colors.white,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  confetti: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  piece: { position: 'absolute', top: 0 },
  dog: { alignSelf: 'center' },
  title: {
    fontFamily: fonts.medium,
    fontSize: 22,
    color: colors.ink,
    textAlign: 'center',
    marginTop: 4,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  primary: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  primaryText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  secondary: { height: 44, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  secondaryText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});