// components/PrivacyConsentGate.js
// Shown once, full screen, until the user agrees to the privacy notice
// (and again whenever PRIVACY_VERSION changes). New and existing users
// both see it, so no change to Sign Up is needed.

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import Mascot from './Mascot';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { colors, fonts, tones } from '../Theme';
import PrivacyPolicyScreen, {
  PRIVACY_SUMMARY,
  PRIVACY_VERSION,
} from '../screens/main/PrivacyPolicyScreen';

// The gate sits above the navigator, where there is no safe-area info,
// so the Modal gets its own SafeAreaProvider.
export default function PrivacyConsentGate() {
  const { profile } = useAuth();
  const [doneVersion, setDoneVersion] = useState(null); // hide right away after agreeing

  const needsConsent =
    !!profile && profile.privacy_version !== PRIVACY_VERSION && doneVersion !== PRIVACY_VERSION;
  if (!needsConsent) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => {}}>
      <SafeAreaProvider>
        <ConsentContent onDone={() => setDoneVersion(PRIVACY_VERSION)} />
      </SafeAreaProvider>
    </Modal>
  );
}

function ConsentContent({ onDone }) {
  const insets = useSafeAreaInsets();
  const { refreshProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [checked, setChecked] = useState(false);

  const agree = async () => {
    setSaving(true);
    const { error } = await supabase.rpc('accept_privacy', { p_version: PRIVACY_VERSION });
    setSaving(false);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    onDone();
    refreshProfile?.();
  };

  const decline = () =>
    Alert.alert(
      'You need to agree to use PawGuard',
      'PawGuard needs this information to send heat alerts and show your pet’s location. You can sign out now.',
      [
        { text: 'Go back', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ]
    );

  return (
      <View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
        {showFull ? (
          <>
            <TouchableOpacity onPress={() => setShowFull(false)} hitSlop={12} style={styles.back}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
            <PrivacyPolicyScreen />
          </>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Mascot pose="stand" animation="breathe" size={150} style={styles.dog} />
            <Text style={styles.title}>Your privacy</Text>
            <Text style={styles.subtitle}>
              Before you start, here's how PawGuard uses your information.
            </Text>

            <View style={[styles.card, { backgroundColor: tones.green.bg }]}>
              {PRIVACY_SUMMARY.map((line) => (
                <Text key={line} style={[styles.line, { color: tones.green.text }]}>
                  •  {line}
                </Text>
              ))}
            </View>

            <TouchableOpacity onPress={() => setShowFull(true)} hitSlop={8}>
              <Text style={styles.link}>Read the full privacy notice</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setChecked((v) => !v)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={[styles.box, checked && styles.boxOn]}>
                {checked && <Text style={styles.tick}>✓</Text>}
              </View>
              <Text style={styles.checkText}>
                I have read the privacy notice and agree to PawGuard collecting and using my
                information as described.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primary, (!checked || saving) && styles.dimmed]}
              onPress={agree}
              disabled={!checked || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Text style={styles.primaryText}>I agree</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={decline} style={styles.secondary}>
              <Text style={styles.secondaryText}>Not now</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingBottom: 20 },
  back: { paddingHorizontal: 20, paddingBottom: 4 },
  backText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  dog: { alignSelf: 'center' },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink, textAlign: 'center', marginTop: 4 },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  card: { borderRadius: 22, padding: 18, marginTop: 20, gap: 8 },
  line: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    textDecorationLine: 'underline',
    textAlign: 'center',
    marginTop: 16,
  },
  checkRow: { flexDirection: 'row', gap: 12, marginTop: 22, alignItems: 'flex-start' },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 14 },
  checkText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.ink },
  primary: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  primaryText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  dimmed: { opacity: 0.5 },
  secondary: { height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  secondaryText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
});