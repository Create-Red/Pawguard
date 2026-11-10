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

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts } from '../../Theme';

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
  const [endDate, setEndDate] = useState(null);

  // Which field the picker is editing: 'start' | 'end' | null
  const [pickerTarget, setPickerTarget] = useState(null);
  // 'date' | 'time' | 'datetime'
  const [pickerMode, setPickerMode] = useState('date');
  const [saving, setSaving] = useState(false);

  function closePicker() {
    setPickerTarget(null);
  }

  function openPicker(target) {
    if (saving) return;

    // Tapping the active field again closes its picker
    if (pickerTarget === target) {
      closePicker();
      return;
    }

    if (target === 'start' && !startDate) {
      // Default: tomorrow at 9:00 AM
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      setStartDate(d);
    }

    if (target === 'end' && !endDate) {
      // Default: 2 hours after start (or tomorrow 11:00 AM if no start yet)
      let d;
      if (startDate) {
        d = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      } else {
        d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(11, 0, 0, 0);
      }
      setEndDate(d);
    }

    setPickerTarget(target);
    setPickerMode(Platform.OS === 'ios' ? 'datetime' : 'date');
  }

  function applyValue(target, value) {
    if (target === 'start') {
      setStartDate(value);
      // Keep the end date after the start date
      if (endDate && endDate <= value) {
        setEndDate(new Date(value.getTime() + 2 * 60 * 60 * 1000));
      }
    } else {
      setEndDate(value);
    }
  }

  function handlePickerChange(event, selected) {
    // Android: user cancelled
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      closePicker();
      return;
    }

    if (!selected) return;

    if (Platform.OS === 'ios') {
      applyValue(pickerTarget, selected);
      return;
    }

    // Android: pick the date first, then the time
    const current = (pickerTarget === 'start' ? startDate : endDate) || selected;
    const merged = new Date(current);

    if (pickerMode === 'date') {
      merged.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate()
      );
      applyValue(pickerTarget, merged);
      setPickerMode('time');
    } else {
      merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      applyValue(pickerTarget, merged);
      closePicker();
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

    if (!name.trim() || !venue.trim() || !startDate || !endDate) {
      Alert.alert(
        'Missing Information',
        'Please enter the event name, venue, start date, and end date.'
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

    if (endDate <= startDate) {
      Alert.alert(
        'Invalid Schedule',
        'The end date and time must be later than the start date and time.'
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
          ends_at: endDate.toISOString(),
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
            onPress: () => navigation.navigate('ManageEvent'),
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

  function renderPicker(target) {
    if (pickerTarget !== target) return null;

    const value = (target === 'start' ? startDate : endDate) || new Date();
    const minimumDate = target === 'end' && startDate ? startDate : new Date();

    return (
      <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : null}>
        <DateTimePicker
          value={value}
          mode={pickerMode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          themeVariant="light"
          onChange={handlePickerChange}
        />
        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.pickerDone} onPress={closePicker}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </TouchableOpacity>
        )}
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
        <Text style={styles.title}>Create event</Text>
        <Text style={styles.subtitle}>
          Add the details of your PawGuard event.
        </Text>

        <Text style={styles.label}>Event name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. PawGuard Dog Fun Run"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
          editable={!saving}
          maxLength={150}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Describe your event and its activities"
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!saving}
        />

        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          placeholder="Event venue or address"
          placeholderTextColor={colors.muted}
          value={venue}
          onChangeText={setVenue}
          editable={!saving}
        />

        <Text style={styles.label}>Starts</Text>
        <TouchableOpacity
          style={[styles.dateButton, pickerTarget === 'start' && styles.dateButtonOpen]}
          onPress={() => openPicker('start')}
          activeOpacity={0.7}
          disabled={saving}
        >
          <Icon name="calendar-outline" size={18} color={colors.muted} />
          <Text style={[styles.dateButtonText, !startDate && styles.datePlaceholder]}>
            {startDate ? formatDateTime(startDate) : 'Choose start date and time'}
          </Text>
        </TouchableOpacity>
        {renderPicker('start')}

        <Text style={styles.label}>Ends</Text>
        <TouchableOpacity
          style={[styles.dateButton, pickerTarget === 'end' && styles.dateButtonOpen]}
          onPress={() => openPicker('end')}
          activeOpacity={0.7}
          disabled={saving}
        >
          <Icon name="calendar-outline" size={18} color={colors.muted} />
          <Text style={[styles.dateButtonText, !endDate && styles.datePlaceholder]}>
            {endDate ? formatDateTime(endDate) : 'Choose end date and time'}
          </Text>
        </TouchableOpacity>
        {renderPicker('end')}

        <TouchableOpacity
          style={[styles.button, saving && styles.disabledButton]}
          onPress={handleCreateEvent}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Create event</Text>
          )}
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
    color: colors.muted,
    marginTop: 4,
    marginBottom: 28,
  },

  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 8,
    marginLeft: 4,
  },

  input: {
    backgroundColor: colors.tile,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 20,
  },
  multiline: { minHeight: 110 },

  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.tile,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 20,
  },
  dateButtonOpen: {
    borderWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateButtonText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
  },
  datePlaceholder: { color: colors.muted },

  iosPickerWrap: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    marginBottom: 20,
    paddingBottom: 8,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  pickerDoneText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.accentDeep,
  },

  button: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: { opacity: 0.6 },
  buttonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
});