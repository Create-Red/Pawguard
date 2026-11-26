import React, { useCallback, useState } from 'react';

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
import {
  DEFAULT_THRESHOLDS,
  RISK_TIERS,
  setAlertThresholds,
} from '../../utils/healthRisk';

const KEYS = Object.keys(DEFAULT_THRESHOLDS.normal);

const TIER_INFO = {
  normal: {
    label: 'Normal',
    tone: 'green',
    examples: 'Aspin, mixed breeds, Labrador',
  },
  elevated: {
    label: 'Elevated',
    tone: 'amber',
    examples: 'Golden Retriever, Great Dane, Husky',
  },
  high: {
    label: 'High',
    tone: 'salmon',
    examples: 'Pug, Shih Tzu, Bulldog, Chow Chow',
  },
};

// Each section: a heading, and Moderate / High fields
const SECTIONS = [
  {
    title: 'Collar surface',
    unit: '°C',
    groups: [
      {
        heading: 'Too hot',
        hint: 'Warns at or above',
        fields: [
          { key: 'moderate_surface_temp', level: 'Moderate' },
          { key: 'high_surface_temp', level: 'High' },
        ],
      },
    ],
  },
  {
    title: 'Humidity',
    unit: '%',
    groups: [
      {
        heading: 'Too humid',
        hint: 'Moderate; High if the surface is also "too hot"',
        fields: [{ key: 'moderate_humidity', level: 'From' }],
      },
    ],
  },
  {
    title: 'Air temperature',
    unit: '°C',
    groups: [
      {
        heading: 'Too cold',
        hint: 'Air, not collar surface, at or below',
        fields: [
          { key: 'low_ambient_temp_moderate', level: 'Moderate' },
          { key: 'low_ambient_temp_high', level: 'High' },
        ],
      },
    ],
  },
];

// { normal: { key: '39', ... }, elevated: {...}, high: {...} } as strings
const toStrings = (source) => {
  const out = {};
  for (const tier of RISK_TIERS) {
    out[tier] = {};
    for (const key of KEYS) out[tier][key] = String(source[tier][key]);
  }
  return out;
};

const tierChanged = (a, b, tier) => KEYS.some((k) => a[tier][k] !== b[tier][k]);

// Returns an error message, or '' if this level's values are fine
const checkTier = (n) => {
  if (
    n.high_surface_temp <= n.moderate_surface_temp ||
    n.low_ambient_temp_moderate <= n.low_ambient_temp_high
  ) {
    return 'High must be stricter than moderate: higher for "too hot", lower for "too cold".';
  }
  if (n.moderate_humidity < 50 || n.moderate_humidity > 89) {
    return '"Too humid" must be between 50 and 89 %.';
  }
  const coldKeys = ['low_ambient_temp_moderate', 'low_ambient_temp_high'];
  if (coldKeys.some((k) => n[k] < -30 || n[k] > 30)) {
    return 'The "too cold" air values must be between -30 and 30 °C.';
  }
  if (n.moderate_surface_temp < 25 || n.high_surface_temp > 45) {
    return 'Collar surface values must be between 25 and 45 °C.';
  }
  return '';
};

export default function AlertConfigurationScreen() {
  const { profile } = useAuth();

  const [tier, setTier] = useState('normal');
  const [settings, setSettings] = useState(() => toStrings(DEFAULT_THRESHOLDS));
  const [saved, setSaved] = useState(() => toStrings(DEFAULT_THRESHOLDS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState('');

  const changedTiers = RISK_TIERS.filter((t) => tierChanged(settings, saved, t));
  const dirty = changedTiers.length > 0;

  const loadSettings = async () => {
    const { data, error: loadError } = await supabase
      .from('alert_thresholds')
      .select('*');

    if (loadError) {
      console.error('Threshold loading error:', loadError);
      setError(loadError.message);
    } else {
      const source = { ...DEFAULT_THRESHOLDS };
      for (const t of RISK_TIERS) {
        const row = (data || []).find((r) => (r.risk_tier || 'normal') === t);
        if (row) source[t] = row;
      }
      const values = toStrings(source);
      setSettings(values);
      setSaved(values);
      setAlertThresholds(data); // this device uses the new limits right away
      setError('');
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [tier]: { ...prev[tier], [key]: value } }));
    if (error) setError('');
  };

  const saveSettings = async () => {
    // 1) Every value is a number, and each level makes sense by itself
    const numbers = {};
    for (const t of RISK_TIERS) {
      numbers[t] = {};
      for (const key of KEYS) {
        const value = settings[t][key].trim();
        if (value === '' || !Number.isFinite(Number(value))) {
          setTier(t);
          setError(`${TIER_INFO[t].label}: please enter a valid number for every threshold.`);
          return;
        }
        numbers[t][key] = Number(value);
      }
      const msg = checkTier(numbers[t]);
      if (msg) {
        setTier(t);
        setError(`${TIER_INFO[t].label}: ${msg}`);
        return;
      }
    }

    // 2) A riskier breed must never be warned LATER than a safer one
    const order = ['normal', 'elevated', 'high'];
    for (let i = 1; i < order.length; i++) {
      const safer = numbers[order[i - 1]];
      const riskier = numbers[order[i]];
      if (
        riskier.moderate_surface_temp > safer.moderate_surface_temp ||
        riskier.high_surface_temp > safer.high_surface_temp ||
        riskier.moderate_humidity > safer.moderate_humidity
      ) {
        setTier(order[i]);
        setError(
          `${TIER_INFO[order[i]].label} dogs must be warned at the same or a lower "too hot / humid" value than ${TIER_INFO[order[i - 1]].label} dogs.`
        );
        return;
      }
    }

    // 3) Save only the levels that changed
    setSaving(true);
    setError('');

    for (const t of changedTiers) {
      const { error: saveError } = await supabase
        .from('alert_thresholds')
        .update({
          ...numbers[t],
          updated_by: profile?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('risk_tier', t);

      if (saveError) {
        setSaving(false);
        console.error('Threshold save error:', saveError);
        setTier(t);
        setError(saveError.message);
        loadSettings();
        return;
      }
    }

    setSaving(false);
    Alert.alert('Settings saved', 'Alert thresholds have been updated.');
    loadSettings();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const info = TIER_INFO[tier];
  const infoTone = tones[info.tone];

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
        <Text style={styles.title}>Alert thresholds</Text>
        <Text style={styles.subtitle}>
          Each breed has a heat-risk level. Dogs use the limits of their level to
          decide Low, Moderate and High risk.
        </Text>

        {/* Level switch */}
        <View style={styles.segment}>
          {RISK_TIERS.map((t) => {
            const active = t === tier;
            const changed = changedTiers.includes(t);
            return (
              <TouchableOpacity
                key={t}
                style={[styles.segmentItem, active && styles.segmentActive]}
                onPress={() => {
                  setTier(t);
                  setFocused(null);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {TIER_INFO[t].label}
                </Text>
                {changed && <View style={styles.changedDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.notice, { backgroundColor: infoTone.bg }]}>
          <Icon name="paw" size={18} color={infoTone.text} />
          <Text style={[styles.noticeText, { color: infoTone.text }]}>
            <Text style={styles.noticeStrong}>{info.label} risk breeds</Text>
            {`, e.g. ${info.examples}. Dogs with no breed picked use Normal.`}
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.title}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            {section.groups.map((group) => (
              <View key={group.heading} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.heading}</Text>
                  <Text style={styles.groupHint}>{group.hint}</Text>
                </View>

                <View style={styles.row}>
                  {group.fields.map((f) => {
                    const tone =
                      f.level === 'High'
                        ? tones.salmon
                        : f.level === 'Moderate'
                        ? tones.amber
                        : tones.beige;
                    const isFocused = focused === f.key;
                    return (
                      <View
                        key={f.key}
                        style={[styles.field, isFocused && styles.fieldFocused]}
                      >
                        <View style={styles.fieldTop}>
                          <View style={[styles.levelPill, { backgroundColor: tone.pill }]}>
                            <Text style={[styles.levelText, { color: tone.pillText }]}>
                              {f.level}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.inputRow}>
                          <TextInput
                            style={styles.input}
                            value={settings[tier][f.key]}
                            onChangeText={(v) => updateSetting(f.key, v)}
                            keyboardType="decimal-pad"
                            placeholder="--"
                            placeholderTextColor={colors.muted}
                            onFocus={() => setFocused(f.key)}
                            onBlur={() => setFocused(null)}
                            editable={!saving}
                            maxLength={5}
                          />
                          <Text style={styles.unit}>{f.unit || section.unit}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ))}

        <View style={[styles.notice, styles.noticeBottom, { backgroundColor: tones.beige.bg }]}>
          <Icon name="information-circle" size={18} color={tones.beige.text} />
          <Text style={[styles.noticeText, { color: tones.beige.text }]}>
            System alert settings, not veterinary limits. Too hot: the collar surface
            nearing normal core temperature (37.5–39.2 °C). Too humid: above 80 %,
            panting stops cooling dogs (Bruchim et al., 2017). Higher-risk breeds:
            Hall, Carter & O'Neill (2020). Only High risk that lasts a few minutes
            sends a notification (at most once an hour per dog).
          </Text>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, (!dirty || saving) && styles.dimmed]}
          onPress={saveSettings}
          disabled={!dirty || saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {dirty
                ? `Save changes (${changedTiers.map((t) => TIER_INFO[t].label).join(', ')})`
                : 'No changes'}
            </Text>
          )}
        </TouchableOpacity>

        {dirty && !saving && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setSettings(saved);
              setError('');
            }}
          >
            <Text style={styles.resetText}>Discard changes</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 6,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: colors.tile,
    borderRadius: 25,
    padding: 4,
    marginTop: 20,
  },
  segmentItem: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  segmentActive: { backgroundColor: colors.ink },
  segmentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  segmentTextActive: { color: colors.white },
  changedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tones.amber.pillText,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20,
    padding: 14,
    marginTop: 14,
  },
  noticeBottom: { marginTop: 28 },
  noticeText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  noticeStrong: { fontFamily: fonts.semibold },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 28,
    marginBottom: 4,
    paddingHorizontal: 2,
  },

  group: { marginTop: 12 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  groupHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },

  row: { flexDirection: 'row', gap: 10 },
  field: {
    flex: 1,
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fieldFocused: { borderColor: colors.accent },
  fieldTop: { flexDirection: 'row' },
  levelPill: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  levelText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.3 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 22,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 0,
  },
  unit: { fontFamily: fonts.regular, fontSize: 14, color: colors.tileLabel },

  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    marginTop: 18,
    paddingHorizontal: 4,
  },

  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    paddingHorizontal: 16,
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  dimmed: { opacity: 0.5 },
  resetButton: { height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  resetText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
});