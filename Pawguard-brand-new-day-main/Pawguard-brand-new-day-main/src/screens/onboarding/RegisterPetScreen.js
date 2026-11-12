import React, { useState } from 'react';

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

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Labeled input styled like the dashboard's info tiles (same as Login / Sign up).
function Field({ label, focused, error, hint, ...inputProps }) {
  return (
    <View>
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error && styles.fieldError,
        ]}
      >
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.muted}
          {...inputProps}
        />
      </View>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export default function RegisterPetScreen({ navigation }) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null); // 'name' | 'age' | null

  const showError = (message, field = null) => {
    setError(message);
    setErrorField(field);
  };

  const clearError = () => {
    if (error) {
      setError('');
      setErrorField(null);
    }
  };

  async function pickImage() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

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
        setSelectedImage(result.assets[0]);
      }
    } catch (e) {
      console.error('Image picker error:', e);
      Alert.alert('Error', 'Unable to open your photo gallery.');
    }
  }

  async function registerPet() {
    if (!user?.id) {
      Alert.alert('Not logged in', 'Please log in again.');
      return;
    }

    if (!name.trim()) {
      showError("Please enter your pet's name.", 'name');
      return;
    }

    if (
      age.trim() &&
      (!Number.isInteger(Number(age)) || Number(age) < 0)
    ) {
      showError('Please enter a valid age in whole years.', 'age');
      return;
    }

    clearError();
    setLoading(true);

    let uploadedPath = null;

    try {
      let photoURL = null;

      // Upload selected photo
      if (selectedImage) {
        const extension = (
          selectedImage.fileName?.split('.').pop() ||
          selectedImage.uri.split('.').pop()?.split('?')[0] ||
          'jpg'
        ).toLowerCase();

        const fileName = `${Date.now()}.${extension}`;
        uploadedPath = `${user.id}/${fileName}`;

        const fileResponse = await fetch(selectedImage.uri);
        const fileBuffer = await fileResponse.arrayBuffer();

        const contentType =
          selectedImage.mimeType ||
          `image/${extension === 'jpg' ? 'jpeg' : extension}`;

        const { error: uploadError } = await supabase.storage
          .from('dog-photos')
          .upload(uploadedPath, fileBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicURLData } = supabase.storage
          .from('dog-photos')
          .getPublicUrl(uploadedPath);

        photoURL = publicURLData.publicUrl;
      }

      // Register dog
      const { data, error: insertError } = await supabase
        .from('dogs')
        .insert({
          owner_id: user.id,
          name: name.trim(),
          breed: breed.trim() || null,
          age: age.trim() ? Number(age) : null,
          photo_url: photoURL,
        })
        .select()
        .single();

      if (insertError) {
        // Remove uploaded photo if dog registration fails
        if (uploadedPath) {
          await supabase.storage.from('dog-photos').remove([uploadedPath]);
        }
        throw insertError;
      }

      Alert.alert(
        'Pet registered',
        `${data.name} has been added to PawGuard.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      console.error('REGISTER PET ERROR:', e);
      showError(e.message || 'Unable to register your pet.');
    } finally {
      setLoading(false);
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
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Register pet</Text>
        <Text style={styles.subtitle}>
          Add your dog to PawGuard to start monitoring.
        </Text>

        {/* Photo card */}
        <View style={[styles.photoCard, { backgroundColor: tones.brand.bg }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.photoBox}
            onPress={pickImage}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={selectedImage ? 'Change photo' : 'Add photo'}
          >
            {selectedImage ? (
              <Image
                source={{ uri: selectedImage.uri }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <Icon name="paw" size={36} color={tones.brand.text} />
            )}

            <View style={styles.photoBadge}>
              <Icon name="add" size={18} color={colors.onAccent} />
            </View>
          </TouchableOpacity>

          <View style={styles.photoText}>
            <Text style={[styles.photoTitle, { color: tones.brand.text }]}>
              {selectedImage ? 'Looking good!' : 'Add a photo'}
            </Text>
            <Text style={[styles.photoHint, { color: tones.brand.pillText }]}>
              {selectedImage
                ? 'Tap the photo to change it.'
                : 'Optional. Tap to choose from your gallery.'}
            </Text>

            {selectedImage && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => setSelectedImage(null)}
                disabled={loading}
              >
                <Text style={[styles.removeText, { color: tones.brand.text }]}>
                  Remove
                </Text>
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
            editable={!loading}
            focused={focused === 'name'}
            error={errorField === 'name'}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
          />

          <View style={styles.row}>
            <View style={styles.rowWide}>
              <Field
                label="Breed"
                placeholder="e.g. Aspin"
                value={breed}
                onChangeText={setBreed}
                autoCapitalize="words"
                returnKeyType="next"
                editable={!loading}
                focused={focused === 'breed'}
                onFocus={() => setFocused('breed')}
                onBlur={() => setFocused(null)}
              />
            </View>

            <View style={styles.rowNarrow}>
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
                returnKeyType="done"
                onSubmitEditing={registerPet}
                editable={!loading}
                focused={focused === 'age'}
                error={errorField === 'age'}
                onFocus={() => setFocused('age')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          <Text style={styles.hint}>Breed and age are optional.</Text>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.dimmed]}
          onPress={registerPet}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>Register pet</Text>
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
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
  },
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
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
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
  photoText: {
    flex: 1,
  },
  photoTitle: {
    fontFamily: fonts.medium,
    fontSize: 20,
  },
  photoHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  removeButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  removeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  // Form
  form: {
    marginTop: 24,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowWide: {
    flex: 2,
  },
  rowNarrow: {
    flex: 1,
  },
  field: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  fieldError: {
    borderColor: colors.danger,
  },
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
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    paddingHorizontal: 4,
  },
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
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },
  dimmed: {
    opacity: 0.5,
  },
  cancelButton: {
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  cancelText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },
});