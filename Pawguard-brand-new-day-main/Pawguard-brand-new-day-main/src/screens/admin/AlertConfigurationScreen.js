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

const DEFAULTS = {
  moderate_surface_temp: '39',
  high_surface_temp: '40',
  low_surface_temp_moderate: '36',
  low_surface_temp_high: '35',
  moderate_humidity: '70',
  high_humidity: '80',
  low_humidity_moderate: '45',
  low_humidity_high: '35',
};

// Each section: "too high" pair and "too low" pair
const SECTIONS = [
  {
    title: 'Surface temperature',
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
      {
        heading: 'Too cold',
        hint: 'Warns at or below',
        fields: [
          { key: 'low_surface_temp_moderate', level: 'Moderate' },
          { key: 'low_surface_temp_high', level: 'High' },
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
        hint: 'Warns at or above',
        fields: [
          { key: 'moderate_humidity', level: 'Moderate' },
          { key: 'high_humidity', level: 'High' },
        ],
      },
      {
        heading: 'Too dry',
        hint: 'Warns at or below',
        fields: [
          { key: 'low_humidity_moderate', level: 'Moderate' },
          { key: 'low_humidity_high', level: 'High' },
        ],
      },
    ],
  },
];

export default function AlertConfigurationScreen() {
  const { profile } = useAuth();

  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved] = useState(DEFAULTS); // last loaded values
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState(null);
  const [error, setError] = useState('');

  const dirty = Object.keys(DEFAULTS).some((k) => settings[k] !== saved[k]);

  const loadSettings = async () => {
    const { data, error: loadError } = await supabase
      .from('alert_thresholds')
      .select('*')
      .eq('id', 1)
      .single();

    if (loadError) {
      console.error('Threshold loading error:', loadError);
      setError(loadError.message);
    } else {
      const values = {};
      Object.keys(DEFAULTS).forEach((key) => {
        values[key] = String(data[key]);
      });
      setSettings(values);
      setSaved(values);
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
    setSettings((prev) => ({ ...prev, [key]: value }));
    if (error) setError('');
  };

  const saveSettings = async () => {
    const n = {};

    for (const key of Object.keys(DEFAULTS)) {
      const value = settings[key].trim();
      if (value === '' || !Number.isFinite(Number(value))) {
        setError('Please enter a valid number for every threshold.');
        return;
      }
      n[key] = Number(value);
    }

    if (
      n.high_surface_temp <= n.moderate_surface_temp ||
      n.low_surface_temp_moderate <= n.low_surface_temp_high ||
      n.high_humidity <= n.moderate_humidity ||
      n.low_humidity_moderate <= n.low_humidity_high
    ) {
      setError(
        'High must be stricter than moderate: higher for "too hot / humid", lower for "too cold / dry".'
      );
      return;
    }

    if (
      n.low_surface_temp_moderate >= n.moderate_surface_temp ||
      n.low_humidity_moderate >= n.moderate_humidity
    ) {
      setError('The "too low" values must be below the "too high" values.');
      return;
    }

    if (Object.values(n).some((v) => v < 0 || v > 100)) {
      setError('All values must be between 0 and 100.');
      return;
    }

    setSaving(true);
    setError('');

    const { error: saveError } = await supabase
      .from('alert_thresholds')
      .update({
        ...n,
        updated_by: profile?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    setSaving(false);

    if (saveError) {
      console.error('Threshold save error:', saveError);
      setError(saveError.message);
      return;
    }

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
          Used by every owner and organizer screen to decide Low, Moderate and
          High risk.
        </Text>

        <View style={[styles.notice, { backgroundColor: tones.amber.bg }]}>
          <Icon name="information-circle" size={18} color={tones.amber.text} />
          <Text style={[styles.noticeText, { color: tones.amber.text }]}>
            These are system alert settings, not veterinary diagnostic limits.
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
                    const tone = f.level === 'High' ? tones.salmon : tones.amber;
                    const isFocused = focused === f.key;
                    return (
                      <View
                        key={f.key}
                        style={[
                          styles.field,
                          isFocused && styles.fieldFocused,
                        ]}
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
                            value={settings[f.key]}
                            onChangeText={(v) => updateSetting(f.key, v)}
                            keyboardType="decimal-pad"
                            placeholder="--"
                            placeholderTextColor={colors.muted}
                            onFocus={() => setFocused(f.key)}
                            onBlur={() => setFocused(null)}
                            editable={!saving}
                            maxLength={5}
                          />
                          <Text style={styles.unit}>{section.unit}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ))}

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
              {dirty ? 'Save changes' : 'No changes'}
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
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  dimmed: { opacity: 0.5 },
  resetButton: { height: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  resetText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
});