import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

// Admin tool: create new collars and print their codes.
// Codes are shown ONCE. The database only keeps them hashed.

function CodeRow({ label, value, secret }) {
  const [shown, setShown] = useState(!secret);
  if (!value) return null;

  return (
    <View style={styles.codeRow}>
      <Text style={styles.codeLabel}>{label}</Text>
      <Text style={[styles.codeValue, secret && styles.codeSecret]} numberOfLines={1} selectable>
        {shown ? value : '••••••••••••'}
      </Text>
      {secret && (
        <TouchableOpacity onPress={() => setShown((s) => !s)} hitSlop={10}>
          <Icon name={shown ? 'eye-off' : 'eye'} size={16} color={colors.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const toCsv = (rows) =>
  [
    'device_uid,claim_code,device_secret',
    ...rows.map((r) => `${r.device_uid},${r.claim_code || ''},${r.device_secret || ''}`),
  ].join('\n');

export default function RegisterDevicesScreen() {
  const [count, setCount] = useState(1);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState([]);

  const [resetUid, setResetUid] = useState('');
  const [newClaim, setNewClaim] = useState(true);
  const [newSecret, setNewSecret] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');

  const changeCount = (delta) =>
    setCount((c) => Math.min(50, Math.max(1, c + delta)));

  async function createDevices() {
    setCreating(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('admin_register_devices', {
      p_count: count,
    });

    setCreating(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setCreated(data || []);
  }

  function confirmReset() {
    const uid = resetUid.trim().toUpperCase();
    if (!uid) return;
    if (!newClaim && !newSecret) {
      setError('Pick at least one code to reset.');
      return;
    }

    Alert.alert(
      'Reset codes?',
      [
        newClaim && 'The old claim code will stop working.',
        newSecret &&
          'The old device secret will stop working. The collar must be re-flashed with the new one, or its readings will be rejected.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetCodes(uid) },
      ]
    );
  }

  async function resetCodes(uid) {
    setResetting(true);
    setError('');

    const { data, error: rpcError } = await supabase.rpc('admin_reset_device_codes', {
      p_device_uid: uid,
      p_new_claim_code: newClaim,
      p_new_secret: newSecret,
    });

    setResetting(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setResetResult(data?.[0] || null);
  }

  const shareRows = (rows) =>
    Share.share({ title: 'PawGuard device codes', message: toCsv(rows) });

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
        <Text style={styles.title}>Register devices</Text>
        <Text style={styles.subtitle}>
          Create new collars before they're boxed and sold.
        </Text>

        <View style={[styles.notice, { backgroundColor: tones.amber.bg }]}>
          <Icon name="key" size={18} color={tones.amber.text} />
          <Text style={[styles.noticeText, { color: tones.amber.text }]}>
            Codes are shown only once. Save or share them before leaving this
            screen.
          </Text>
        </View>

        {/* ---- New devices ---------------------------------------------- */}
        <Text style={styles.sectionTitle}>New devices</Text>

        <View style={styles.stepperRow}>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => changeCount(-1)}
              disabled={creating || count <= 1}
            >
              <Icon name="remove" size={20} color={colors.ink} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{count}</Text>
            <TouchableOpacity
              style={styles.stepButton}
              onPress={() => changeCount(1)}
              disabled={creating || count >= 50}
            >
              <Icon name="add" size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <Text style={styles.stepHint}>
            device{count === 1 ? '' : 's'} (max 50)
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, creating && styles.dimmed]}
          onPress={createDevices}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>
              Create {count} device{count === 1 ? '' : 's'}
            </Text>
          )}
        </TouchableOpacity>

        {created.length > 0 && (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>{created.length} created</Text>
              <TouchableOpacity style={styles.shareChip} onPress={() => shareRows(created)}>
                <Icon name="share-outline" size={16} color={colors.ink} />
                <Text style={styles.shareText}>Share CSV</Text>
              </TouchableOpacity>
            </View>

            {created.map((d) => (
              <View key={d.device_uid} style={[styles.card, { backgroundColor: tones.green.bg }]}>
                <Text style={[styles.cardUid, { color: tones.green.text }]} selectable>
                  {d.device_uid}
                </Text>
                <CodeRow label="Claim code (box card)" value={d.claim_code} />
                <CodeRow label="Device secret (firmware)" value={d.device_secret} secret />
              </View>
            ))}
          </>
        )}

        {/* ---- Reset existing ------------------------------------------ */}
        <Text style={styles.sectionTitle}>Reset codes</Text>
        <Text style={styles.sectionHint}>
          For devices made before claim codes, or a lost box card.
        </Text>

        <View style={[styles.field, focused && styles.fieldFocused]}>
          <Text style={styles.fieldLabel}>Device ID</Text>
          <TextInput
            style={styles.input}
            placeholder="PG-XXXXXX"
            placeholderTextColor={colors.muted}
            value={resetUid}
            onChangeText={(t) => {
              setResetUid(t.toUpperCase());
              setResetResult(null);
              if (error) setError('');
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>New claim code</Text>
            <Text style={styles.switchHint}>For the owner's box card</Text>
          </View>
          <Switch value={newClaim} onValueChange={setNewClaim} />
        </View>
        <View style={[styles.switchRow, styles.switchRowLast]}>
          <View style={styles.switchText}>
            <Text style={styles.switchTitle}>New device secret</Text>
            <Text style={styles.switchHint}>Collar must be re-flashed after this</Text>
          </View>
          <Switch value={newSecret} onValueChange={setNewSecret} />
        </View>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            (!resetUid.trim() || resetting) && styles.dimmed,
          ]}
          onPress={confirmReset}
          disabled={!resetUid.trim() || resetting}
        >
          {resetting ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={styles.secondaryButtonText}>Reset codes</Text>
          )}
        </TouchableOpacity>

        {resetResult && (
          <View style={[styles.card, { backgroundColor: tones.brand.bg, marginTop: 14 }]}>
            <View style={styles.cardTop}>
              <Text style={[styles.cardUid, { color: tones.brand.text }]} selectable>
                {resetResult.device_uid}
              </Text>
              <TouchableOpacity onPress={() => shareRows([resetResult])} hitSlop={10}>
                <Icon name="share-outline" size={18} color={tones.brand.text} />
              </TouchableOpacity>
            </View>
            <CodeRow label="Claim code (box card)" value={resetResult.claim_code} />
            <CodeRow label="Device secret (firmware)" value={resetResult.device_secret} secret />
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
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

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    padding: 14,
    marginTop: 18,
  },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 30,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 2,
  },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.tile,
    borderRadius: 24,
    padding: 4,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepValue: {
    minWidth: 48,
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.ink,
  },
  stepHint: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },

  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  resultsTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  shareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.pill,
  },
  shareText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },

  card: { borderRadius: 24, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardUid: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: 1 },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeLabel: { width: 110, fontFamily: fonts.regular, fontSize: 11, color: colors.tileLabel },
  codeValue: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.ink,
  },
  codeSecret: { fontSize: 12, letterSpacing: 0.3 },

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

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    marginTop: 4,
  },
  switchRowLast: { borderBottomWidth: 0 },
  switchText: { flex: 1 },
  switchTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  switchHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },

  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  secondaryButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  dimmed: { opacity: 0.5 },

  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    marginTop: 14,
    paddingHorizontal: 4,
  },
});