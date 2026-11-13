import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

export default function PairDeviceScreen({ route, navigation }) {
  const { dogId, dogName } = route.params;

  const [deviceUid, setDeviceUid] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const tone = tones.brand;
  const uid = deviceUid.trim().toUpperCase();

  async function pairDevice() {
    if (!uid) {
      setError('Please enter the Device ID.');
      return;
    }

    setError('');
    setLoading(true);

    const { error: pairError } = await supabase.rpc('pair_device', {
      p_device_uid: uid,
      p_dog_id: dogId,
    });

    setLoading(false);

    if (pairError) {
      setError(pairError.message);
      return;
    }

    Alert.alert(
      'Device paired',
      `${dogName || 'Your dog'}'s PawGuard device is ready.`,
      [{ text: 'Continue', onPress: () => navigation.popToTop() }]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Pair a device</Text>
        <Text style={styles.subtitle}>
          Connect a PawGuard collar to start live readings and location.
        </Text>

        {/* Who it's being paired with */}
        <View style={[styles.hero, { backgroundColor: tone.bg }]}>
          <View style={styles.heroIcon}>
            <Icon name="paw" size={26} color={tone.text} />
          </View>
          <View style={styles.heroText}>
            <Text style={[styles.heroMeta, { color: tone.sub }]}>Pairing with</Text>
            <Text style={[styles.heroName, { color: tone.text }]} numberOfLines={1}>
              {dogName || 'Selected dog'}
            </Text>
          </View>
          <View style={styles.heroLink}>
            <Icon name="link" size={18} color={tone.text} />
          </View>
        </View>

        {/* Device ID */}
        <View
          style={[
            styles.field,
            focused && styles.fieldFocused,
            !!error && styles.fieldError,
          ]}
        >
          <Text style={styles.fieldLabel}>Device ID</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. PG-0001"
            placeholderTextColor={colors.muted}
            value={deviceUid}
            onChangeText={(t) => {
              setDeviceUid(t.toUpperCase());
              if (error) setError('');
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={pairDevice}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!loading}
          />
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {/* Where to find it */}
        <View style={styles.tips}>
          <View style={styles.tipRow}>
            <Icon name="pricetag-outline" size={16} color={colors.muted} />
            <Text style={styles.tipText}>
              The Device ID is printed on the collar's label.
            </Text>
          </View>
          <View style={styles.tipRow}>
            <Icon name="swap-horizontal" size={16} color={colors.muted} />
            <Text style={styles.tipText}>
              Borrowed device? Its previous owner must remove it from their pet
              first.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (!uid || loading) && styles.dimmed]}
          onPress={pairDevice}
          disabled={!uid || loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>Pair device</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 6,
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 30,
    padding: 18,
    marginTop: 24,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroText: { flex: 1 },
  heroMeta: { fontFamily: fonts.regular, fontSize: 13 },
  heroName: { fontFamily: fonts.medium, fontSize: 24, marginTop: 2 },
  heroLink: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  field: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    marginTop: 24,
  },
  fieldFocused: { borderColor: colors.accent },
  fieldError: { borderColor: colors.danger },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.tileLabel,
  },
  input: {
    fontFamily: fonts.medium,
    fontSize: 20,
    letterSpacing: 1.5,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 0,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  tips: { marginTop: 18, gap: 10, paddingHorizontal: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },

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
  cancelButton: { height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 6 },
  cancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
});