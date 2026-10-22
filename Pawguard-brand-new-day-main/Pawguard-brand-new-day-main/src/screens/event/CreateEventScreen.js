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

import DateTimePicker from '@react-native-community/datetimepicker';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Example: "Tue, Nov 10, 2026 at 9:00 AM"
function formatDateTime(date) {
  const hours24 = date.getHours();
  const hours12 = hours24 % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';

  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${hours12}:${minutes} ${ampm}`;
}

export default function CreateEventScreen({ navigation }) {
  const { user, profile } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [venue, setVenue] = useState('');
  const [startDate, setStartDate] = useState(null);
  // 'date' | 'time' | 'datetime' | null
  const [pickerMode, setPickerMode] = useState(null);
  const [saving, setSaving] = useState(false);

  function openPicker() {
    if (saving) return;
    if (!startDate) {
      // Default to tomorrow at 9:00 AM
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      setStartDate(d);
    }
    setPickerMode(Platform.OS === 'ios' ? 'datetime' : 'date');
  }

  function handlePickerChange(event, selected) {
    // Android: user cancelled
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      setPickerMode(null);
      return;
    }

    if (!selected) return;

    if (Platform.OS === 'ios') {
      setStartDate(selected);
      return;
    }

    // Android: pick the date first, then the time
    if (pickerMode === 'date') {
      const merged = new Date(startDate || selected);
      merged.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate()
      );
      setStartDate(merged);
      setPickerMode('time');
    } else {
      const merged = new Date(startDate || selected);
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setStartDate(merged);
      setPickerMode(null);
    }
  }

  async function handleCreateEvent() {
    if (!user?.id || !profile) {
      Alert.alert('Error', 'Please sign in again.');
      return;
    }

    if (
      profile.role !== 'event_organizer' &&
      profile.role !== 'system_admin'
    ) {
      Alert.alert(
        'Access Denied',
        'Only authorized event organizers can create events.'
      );
      return;
    }

    if (!name.trim() || !venue.trim() || !startDate) {
      Alert.alert(
        'Missing Information',
        'Please enter the event name, venue, and start date.'
      );
      return;
    }

    if (startDate <= new Date()) {
      Alert.alert(
        'Invalid Date',
        'The start date and time must be in the future.'
      );
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase
        .from('events')
        .insert({
          organizer_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          venue: venue.trim(),
          starts_at: startDate.toISOString(),
          status: 'open',
        })
        .select()
        .single();

      if (error) {
        console.error('CREATE EVENT ERROR:', error);
        Alert.alert('Could Not Create Event', error.message);
        return;
      }

      Alert.alert(
        'Event Created',
        'Your event has been saved successfully.',
        [
          {
            text: 'View My Events',
            onPress: () => navigation.navigate('ManageEvents'),
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('CREATE EVENT ERROR:', error);

      Alert.alert(
        'Error',
        'Something went wrong while creating the event.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Event</Text>

        <Text style={styles.subtitle}>
          Add the details of your PawGuard event.
        </Text>

        <Text style={styles.label}>Event Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. PawGuard Dog Fun Run"
          value={name}
          onChangeText={setName}
          editable={!saving}
          maxLength={150}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Describe your event and its activities"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!saving}
        />

        <Text style={styles.label}>Venue *</Text>
        <TextInput
          style={styles.input}
          placeholder="Event venue or address"
          value={venue}
          onChangeText={setVenue}
          editable={!saving}
        />

        <Text style={styles.label}>Start Date and Time *</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={openPicker}
          activeOpacity={0.7}
          disabled={saving}
        >
          <Text
            style={[
              styles.dateButtonText,
              !startDate && styles.datePlaceholder,
            ]}
          >
            {startDate ? formatDateTime(startDate) : 'Tap to choose date and time'}
          </Text>
        </TouchableOpacity>

        {pickerMode && (
          <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : null}>
            <DateTimePicker
              value={startDate || new Date()}
              mode={pickerMode}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={handlePickerChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.pickerDone}
                onPress={() => setPickerMode(null)}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, saving && styles.disabledButton]}
          onPress={handleCreateEvent}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Create Event</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F7F9',
  },

  content: {
    padding: 22,
    paddingBottom: 40,
  },

  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#17202A',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17202A',
    marginBottom: 7,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE1E7',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    marginBottom: 18,
    color: '#17202A',
  },

  multiline: {
    minHeight: 100,
  },

  dateButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE1E7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },

  dateButtonText: {
    fontSize: 14,
    color: '#17202A',
  },

  datePlaceholder: {
    color: '#9AA3AF',
  },

  iosPickerWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE1E7',
    borderRadius: 12,
    marginBottom: 18,
    paddingBottom: 8,
  },

  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  pickerDoneText: {
    color: '#222222',
    fontWeight: '800',
    fontSize: 15,
  },

  button: {
    backgroundColor: '#222222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 54,
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
});
