
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

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

export default function AlertConfigurationScreen() {
  const { profile } = useAuth();

  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('alert_thresholds')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Threshold loading error:', error);
      Alert.alert('Error', error.message);
    } else {
      const values = {};

      Object.keys(DEFAULTS).forEach((key) => {
        values[key] = String(data[key]);
      });

      setSettings(values);
    }

    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  const updateSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const saveSettings = async () => {
    const numericValues = {};

    for (const key of Object.keys(DEFAULTS)) {
      const value = settings[key].trim();

      if (value === '' || !Number.isFinite(Number(value))) {
        Alert.alert(
          'Invalid Value',
          'Please enter a valid number for every threshold.'
        );
        return;
      }

      numericValues[key] = Number(value);
    }

    const {
      moderate_surface_temp: moderateTemp,
      high_surface_temp: highTemp,
      low_surface_temp_moderate: lowModerateTemp,
      low_surface_temp_high: lowHighTemp,
      moderate_humidity: moderateHumidity,
      high_humidity: highHumidity,
      low_humidity_moderate: lowModerateHumidity,
      low_humidity_high: lowHighHumidity,
    } = numericValues;

    if (
      highTemp <= moderateTemp ||
      lowModerateTemp <= lowHighTemp ||
      highHumidity <= moderateHumidity ||
      lowModerateHumidity <= lowHighHumidity
    ) {
      Alert.alert(
        'Invalid Thresholds',
        'High thresholds must be greater than moderate thresholds. For low readings, the high-risk cutoff must be lower than the moderate-risk cutoff.'
      );
      return;
    }

    if (
      moderateTemp < 0 || highTemp > 100 ||
      lowHighTemp < 0 || lowModerateTemp > 100 ||
      moderateHumidity < 0 || highHumidity > 100 ||
      lowHighHumidity < 0 || lowModerateHumidity > 100
    ) {
      Alert.alert(
        'Out of Range',
        'Temperature values must be between 0 and 100°C, and humidity values must be between 0 and 100%.'
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('alert_thresholds')
      .update({
        ...numericValues,
        updated_by: profile?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    setSaving(false);

    if (error) {
      console.error('Threshold save error:', error);

      Alert.alert(
        'Save Failed',
        error.message
      );
      return;
    }

    Alert.alert(
      'Settings Saved',
      'Alert thresholds have been updated successfully.'
    );

    loadSettings();
  };

  const renderField = (label, key, unit, description) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <Text style={styles.description}>
        {description}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={settings[key]}
          onChangeText={(value) => updateSetting(key, value)}
          keyboardType="decimal-pad"
          placeholder="Enter value"
        />

        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>
          Loading alert settings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        Alert Configuration
      </Text>

      <Text style={styles.subtitle}>
        Configure the environmental thresholds used by PawGuard's preliminary risk assessment.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.noticeText}>
          These values are system alert settings, not veterinary diagnostic limits.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>
        Surface Temperature
      </Text>

      <View style={styles.card}>
        {renderField(
          'Moderate-risk threshold',
          'moderate_surface_temp',
          '°C',
          'Triggers a moderate warning at or above this value.'
        )}

        {renderField(
          'High-risk threshold',
          'high_surface_temp',
          '°C',
          'Triggers a high warning at or above this value.'
        )}

        {renderField(
          'Low temperature – moderate',
          'low_surface_temp_moderate',
          '°C',
          'Triggers a moderate warning at or below this value.'
        )}

        {renderField(
          'Low temperature – high',
          'low_surface_temp_high',
          '°C',
          'Triggers a high warning at or below this value.'
        )}
      </View>

      <Text style={styles.sectionTitle}>
        Humidity
      </Text>

      <View style={styles.card}>
        {renderField(
          'Moderate-risk threshold',
          'moderate_humidity',
          '%',
          'Triggers a moderate warning at or above this value.'
        )}

        {renderField(
          'High-risk threshold',
          'high_humidity',
          '%',
          'Triggers a high warning at or above this value.'
        )}

        {renderField(
          'Low humidity – moderate',
          'low_humidity_moderate',
          '%',
          'Triggers a moderate warning at or below this value.'
        )}

        {renderField(
          'Low humidity – high',
          'low_humidity_high',
          '%',
          'Triggers a high warning at or below this value.'
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.saveButton,
          saving && styles.disabledButton,
        ]}
        onPress={saveSettings}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>
            Save Alert Settings
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
  },

  loadingText: {
    marginTop: 12,
    color: '#687386',
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#172033',
  },

  subtitle: {
    color: '#687386',
    marginTop: 7,
    lineHeight: 20,
  },

  notice: {
    backgroundColor: '#FEF3C7',
    padding: 13,
    borderRadius: 12,
    marginTop: 18,
    marginBottom: 22,
  },

  noticeText: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 12,
  },

  card: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 15,
    marginBottom: 22,
  },

  field: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#172033',
  },

  description: {
    color: '#687386',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 17,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
    borderRadius: 10,
    marginTop: 10,
    paddingHorizontal: 12,
  },

  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#172033',
    fontSize: 16,
  },

  unit: {
    color: '#687386',
    fontWeight: '700',
  },

  saveButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
  },

  disabledButton: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
