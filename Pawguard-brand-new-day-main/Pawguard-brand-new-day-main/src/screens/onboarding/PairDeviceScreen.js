import React, { useCallback, useRef, useState } from 'react';

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

import { useFocusEffect } from '@react-navigation/native';

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Labeled tile input (same as Login / Register pet)
function Field({ label, focused, error, ...inputProps }) {
  return (
    <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        autoCapitalize="characters"
        autoCorrect={false}
        {...inputProps}
      />
    </View>
  );
}

export default function PairDeviceScreen({ route, navigation }) {
  const { dogId, dogName } = route.params;
  const { profile } = useAuth();

  // Devices this owner already has but that aren't on a pet
  const [spare, setSpare] = useState([]);
  const [loadingSpare, setLoadingSpare] = useState(true);
  const [selectedSpare, setSelectedSpare] = useState(null);

  // New device form
  const [mode, setMode] = useState('new'); // 'new' | 'mine'
  const modeChosen = useRef(false);
  const [deviceUid, setDeviceUid] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [focused, setFocused] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tone = tones.brand;

  const loadSpare = useCallback(async () => {
    if (!profile?.id) return;

    const { data, error: loadError } = await supabase
      .from('devices')
      .select('id, device_uid, battery_pct')
      .eq('owner_id', profile.id)
      .is('dog_id', null)
      .order('claimed_at', { ascending: false });

    if (!loadError) {
      setSpare(data || []);
      // First load only: open "My devices" when there are any
      if (!modeChosen.current && (data || []).length > 0) setMode('mine');
      modeChosen.current = true;
    }
    setLoadingSpare(false);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSpare();
    }, [loadSpare])
  );

  const done = (uid) =>
    Alert.alert(
      'Device paired',
      `${uid} is now on ${dogName || 'your pet'}.`,
      [{ text: 'Continue', onPress: () => navigation.popToTop() }]
    );

  // ---- Pair a device the owner already has ----------------------------
  async function pairSpare() {
    if (!selectedSpare) return;
    setSaving(true);
    setError('');

    const { error: pairError } = await supabase.rpc('pair_device', {
      p_device_uid: selectedSpare.device_uid,
      p_dog_id: dogId,
    });

    setSaving(false);
    if (pairError) return setError(pairError.message);
    done(selectedSpare.device_uid);
  }

  // ---- Claim a new device and pair it ---------------------------------
  async function claimNew() {
    const uid = deviceUid.trim().toUpperCase();
    const code = claimCode.trim();

    if (!uid || !code) {
      setError('Enter both the Device ID and the claim code.');
      return;
    }

    setSaving(true);
    setError('');

    const { error: claimError } = await supabase.rpc('claim_device', {
      p_device_uid: uid,
      p_claim_code: code,
      p_dog_id: dogId,
    });

    setSaving(false);
    if (claimError) return setError(claimError.message);
    done(uid);
  }

  const canSubmit =
    mode === 'mine'
      ? !!selectedSpare
      : deviceUid.trim().length > 0 && claimCode.trim().length > 0;

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

        {/* New device | My devices */}
        <View style={styles.segment}>
          {[
            { key: 'new', label: 'New device' },
            { key: 'mine', label: `My devices${spare.length ? ` (${spare.length})` : ''}` },
          ].map((opt) => {
            const active = mode === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.segmentItem, active && styles.segmentActive]}
                onPress={() => {
                  setMode(opt.key);
                  setError('');
                }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {mode === 'new' ? (
          <>
            <View style={styles.form}>
              <Field
                label="Device ID"
                placeholder="PG-XXXXXX"
                value={deviceUid}
                onChangeText={(t) => {
                  setDeviceUid(t.toUpperCase());
                  if (error) setError('');
                }}
                returnKeyType="next"
                focused={focused === 'uid'}
                error={!!error}
                onFocus={() => setFocused('uid')}
                onBlur={() => setFocused(null)}
                editable={!saving}
              />
              <Field
                label="Claim code"
                placeholder="XXXX-XXXX"
                value={claimCode}
                onChangeText={(t) => {
                  setClaimCode(t.toUpperCase());
                  if (error) setError('');
                }}
                returnKeyType="done"
                onSubmitEditing={claimNew}
                focused={focused === 'code'}
                error={!!error}
                onFocus={() => setFocused('code')}
                onBlur={() => setFocused(null)}
                editable={!saving}
              />
            </View>

            <View style={styles.tips}>
              <View style={styles.tipRow}>
                <Icon name="cube-outline" size={16} color={colors.muted} />
                <Text style={styles.tipText}>
                  Both are on the card inside the PawGuard box. Keep the card:
                  you'll need it if you ever sell or lend the collar.
                </Text>
              </View>
              <View style={styles.tipRow}>
                <Icon name="swap-horizontal" size={16} color={colors.muted} />
                <Text style={styles.tipText}>
                  Borrowed or second-hand? The previous owner must release it
                  from their account first.
                </Text>
              </View>
            </View>
          </>
        ) : loadingSpare ? (
          <ActivityIndicator color={colors.ink} style={styles.loader} />
        ) : spare.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No spare devices</Text>
            <Text style={styles.emptyText}>
              All your devices are on a pet. Add a new one with its claim code,
              or remove one from another pet first.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {spare.map((d, index) => {
              const active = selectedSpare?.id === d.id;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.row, index === spare.length - 1 && styles.rowLast]}
                  onPress={() => {
                    setSelectedSpare(d);
                    if (error) setError('');
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.deviceIcon, active && { backgroundColor: tones.brand.bg }]}>
                    <Icon name="hardware-chip" size={20} color={tones.brand.text} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{d.device_uid}</Text>
                    <Text style={styles.rowMeta}>
                      {d.battery_pct != null ? `Battery ${Number(d.battery_pct)}%` : 'Not on a pet'}
                    </Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, (!canSubmit || saving) && styles.dimmed]}
          onPress={mode === 'mine' ? pairSpare : claimNew}
          disabled={!canSubmit || saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {mode === 'mine' ? 'Pair device' : 'Add & pair device'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={saving}
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

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.pill,
    borderRadius: 22,
    padding: 4,
    marginTop: 22,
  },
  segmentItem: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  segmentTextActive: { color: colors.onAccent },

  form: { marginTop: 18, gap: 12 },
  field: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
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

  tips: { marginTop: 16, gap: 10, paddingHorizontal: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },

  loader: { marginTop: 30 },
  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.tile,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.medium, fontSize: 16, letterSpacing: 0.8, color: colors.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },

  emptyBox: { marginTop: 22, paddingHorizontal: 4 },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 4,
  },

  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    marginTop: 14,
    paddingHorizontal: 4,
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