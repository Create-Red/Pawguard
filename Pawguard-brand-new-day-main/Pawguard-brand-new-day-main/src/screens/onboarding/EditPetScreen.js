import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import BreedPicker from '../../components/BreedPicker';
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Labeled input styled like the dashboard tiles (same as Register pet)
function Field({ label, focused, error, ...inputProps }) {
  return (
    <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...inputProps}
      />
    </View>
  );
}

export default function EditPetScreen({ route, navigation }) {
  const { dogId } = route.params;
  const { user } = useAuth();

  const [original, setOriginal] = useState(null); // values as loaded
  const [name, setName] = useState('');
  const [breedId, setBreedId] = useState(null);
  const [breed, setBreed] = useState(''); // breed name (old free text until a breed is picked)
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);     // current saved photo
  const [newPhoto, setNewPhoto] = useState(null);     // picked, not yet uploaded

  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null);

  useEffect(() => {
    loadDog();
  }, []);

  async function loadDog() {
    try {
      const { data, error: loadError } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .single();

      if (loadError) throw loadError;

      const values = {
        name: data.name || '',
        breedId: data.breed_id || null,
        breed: data.breed || '',
        age: data.age !== null && data.age !== undefined ? String(data.age) : '',
        weight:
          data.weight_kg !== null && data.weight_kg !== undefined
            ? String(Number(data.weight_kg))
            : '',
      };

      setOriginal(values);
      setName(values.name);
      setBreedId(values.breedId);
      setBreed(values.breed);
      setAge(values.age);
      setWeight(values.weight);
      setPhotoUrl(data.photo_url || null);
    } catch (e) {
      console.log('LOAD DOG ERROR:', e);
      Alert.alert('Error', 'Unable to load pet information.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  const clearError = () => {
    if (error) {
      setError('');
      setErrorField(null);
    }
  };

  const dirty =
    !!original &&
    (name !== original.name ||
      breedId !== original.breedId ||
      age !== original.age ||
      weight !== original.weight ||
      !!newPhoto);

  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          'Please allow PawGuard to access your photo gallery.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setNewPhoto(result.assets[0]);
        clearError();
      }
    } catch (e) {
      console.error('Image picker error:', e);
      Alert.alert('Error', 'Unable to open your photo gallery.');
    }
  }

  // Same upload as Register pet. Returns the public URL.
  async function uploadPhoto(asset) {
    const extension = (
      asset.fileName?.split('.').pop() ||
      asset.uri.split('.').pop()?.split('?')[0] ||
      'jpg'
    ).toLowerCase();

    const path = `${user.id}/${Date.now()}.${extension}`;
    const contentType =
      asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

    const fileResponse = await fetch(asset.uri);
    const fileBuffer = await fileResponse.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('dog-photos')
      .upload(path, fileBuffer, { contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('dog-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function updateDog() {
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in again.');
      return;
    }

    if (!name.trim()) {
      setError("Please enter your pet's name.");
      setErrorField('name');
      return;
    }

    if (age.trim() && (!Number.isInteger(Number(age)) || Number(age) < 0)) {
      setError('Please enter a valid age in whole years.');
      setErrorField('age');
      return;
    }

    const weightNum = weight.trim() ? Number(weight.replace(',', '.')) : null;
    if (weightNum !== null && (!Number.isFinite(weightNum) || weightNum <= 0 || weightNum > 120)) {
      setError('Please enter a weight between 0.1 and 120 kg.');
      setErrorField('weight');
      return;
    }

    setSaving(true);
    clearError();

    try {
      const update = {
        name: name.trim(),
        breed: breed.trim() || null,
        breed_id: breedId,
        age: age.trim() ? Number(age) : null,
        weight_kg: weightNum,
      };

      if (newPhoto) {
        update.photo_url = await uploadPhoto(newPhoto);
      }

      const { error: updateError } = await supabase
        .from('dogs')
        .update(update)
        .eq('id', dogId);

      if (updateError) throw updateError;

      Alert.alert('Saved', `${update.name}'s details have been updated.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      console.log('UPDATE DOG ERROR:', e);
      setError(e.message || 'Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const tone = tones.brand;
  const shownPhoto = newPhoto?.uri || photoUrl;

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
        <Text style={styles.title}>Edit pet</Text>
        <Text style={styles.subtitle}>Update {original?.name || 'your pet'}'s details.</Text>

        {/* Photo card */}
        <View style={[styles.photoCard, { backgroundColor: tone.bg }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.photoBox}
            onPress={pickImage}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
          >
            {shownPhoto ? (
              <Image source={{ uri: shownPhoto }} style={styles.photo} resizeMode="cover" />
            ) : (
              <Icon name="paw" size={36} color={tone.text} />
            )}

            <View style={styles.photoBadge}>
              <Icon name="camera" size={15} color={colors.onAccent} />
            </View>
          </TouchableOpacity>

          <View style={styles.photoText}>
            <Text style={[styles.photoTitle, { color: tone.text }]} numberOfLines={1}>
              {name.trim() || 'Your pet'}
            </Text>
            <Text style={[styles.photoHint, { color: tone.pillText }]}>
              {newPhoto
                ? 'New photo will be saved.'
                : shownPhoto
                ? 'Tap the photo to change it.'
                : 'Tap to add a photo.'}
            </Text>

            {newPhoto && (
              <TouchableOpacity
                style={styles.undoChip}
                onPress={() => setNewPhoto(null)}
                disabled={saving}
              >
                <Text style={[styles.undoText, { color: tone.text }]}>Undo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Field
            label="Name"
            placeholder="e.g. Bantay"
            value={name}
            onChangeText={(t) => {
              setName(t);
              clearError();
            }}
            autoCapitalize="words"
            returnKeyType="next"
            editable={!saving}
            focused={focused === 'name'}
            error={errorField === 'name'}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
          />

          <View>
            <BreedPicker
              valueId={breedId}
              legacyName={breedId ? null : breed}
              onChange={(b) => {
                setBreedId(b.id);
                setBreed(b.name);
                clearError();
              }}
              disabled={saving}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowHalf}>
              <Field
                label="Age (yrs)"
                placeholder="0"
                value={age}
                onChangeText={(t) => {
                  setAge(t.replace(/[^0-9]/g, ''));
                  clearError();
                }}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                editable={!saving}
                focused={focused === 'age'}
                error={errorField === 'age'}
                onFocus={() => setFocused('age')}
                onBlur={() => setFocused(null)}
              />
            </View>

            <View style={styles.rowHalf}>
              <Field
                label="Weight (kg)"
                placeholder="0.0"
                value={weight}
                onChangeText={(t) => {
                  setWeight(t.replace(/[^0-9.,]/g, ''));
                  clearError();
                }}
                keyboardType="decimal-pad"
                maxLength={5}
                returnKeyType="done"
                onSubmitEditing={updateDog}
                editable={!saving}
                focused={focused === 'weight'}
                error={errorField === 'weight'}
                onFocus={() => setFocused('weight')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          <Text style={styles.hint}>
            Breed, age and weight are optional, but they help PawGuard warn you earlier
            for dogs that overheat more easily.
          </Text>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (!dirty || saving) && styles.dimmed]}
          onPress={updateDog}
          disabled={!dirty || saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {dirty ? 'Save changes' : 'No changes'}
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
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
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

  // Photo card
  photoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 30,
    padding: 18,
    marginTop: 24,
  },
  photoBox: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: { width: '100%', height: '100%', borderRadius: 24 },
  photoBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: { flex: 1 },
  photoTitle: { fontFamily: fonts.medium, fontSize: 22 },
  photoHint: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 4 },
  undoChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  undoText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },

  // Form
  form: { marginTop: 24, gap: 12 },
  row: { flexDirection: 'row', gap: 10 },
  rowHalf: { flex: 1 },
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
    fontSize: 16,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 0,
  },
  hint: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, paddingHorizontal: 4 },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    paddingHorizontal: 4,
  },

  // Buttons
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