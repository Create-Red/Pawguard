
import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

export default function RegisterPetScreen({ navigation }) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission Required',
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
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Unable to open your photo gallery.');
    }
  }

  async function registerPet() {
    if (!user?.id) {
      Alert.alert('Not Logged In', 'Please log in again.');
      return;
    }

    if (!name.trim()) {
      Alert.alert(
        'Missing Information',
        "Please enter your dog's name."
      );
      return;
    }

    if (age.trim() && (
      !Number.isInteger(Number(age)) ||
      Number(age) < 0
    )) {
      Alert.alert(
        'Invalid Age',
        'Please enter a valid age.'
      );
      return;
    }

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

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicURLData } = supabase.storage
          .from('dog-photos')
          .getPublicUrl(uploadedPath);

        photoURL = publicURLData.publicUrl;
      }

      // Register dog
      const { data, error } = await supabase
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

      if (error) {
        // Remove uploaded photo if dog registration fails
        if (uploadedPath) {
          await supabase.storage
            .from('dog-photos')
            .remove([uploadedPath]);
        }

        throw error;
      }

      console.log('DOG CREATED:', data);

      Alert.alert(
        'Pet Registered',
        `${data.name} has been added to PawGuard.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('REGISTER PET ERROR:', error);

      Alert.alert(
        'Registration Failed',
        error.message || 'Unable to register your pet.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Register Your Pet
      </Text>

      <Text style={styles.subtitle}>
        Add your dog to PawGuard.
      </Text>

      {/* Dog Photo */}
      <TouchableOpacity
        style={styles.photoContainer}
        onPress={pickImage}
        disabled={loading}
      >
        {selectedImage ? (
          <Image
            source={{ uri: selectedImage.uri }}
            style={styles.photo}
          />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoIcon}>📷</Text>
            <Text style={styles.photoText}>
              Add Dog Photo
            </Text>
            <Text style={styles.photoHint}>
              Tap to choose from gallery
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {selectedImage && (
        <TouchableOpacity
          onPress={() => setSelectedImage(null)}
          disabled={loading}
        >
          <Text style={styles.removePhoto}>
            Remove Photo
          </Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.input}
        placeholder="Dog Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Breed"
        value={breed}
        onChangeText={setBreed}
      />

      <TextInput
        style={styles.input}
        placeholder="Age"
        value={age}
        onChangeText={setAge}
        keyboardType="numeric"
      />

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabledButton,
        ]}
        onPress={registerPet}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Register Pet
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={styles.cancelText}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },

  subtitle: {
    color: '#666',
    marginBottom: 20,
  },

  photoContainer: {
    alignSelf: 'center',
    width: 150,
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#F1F3F5',
  },

  photo: {
    width: '100%',
    height: '100%',
  },

  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  photoIcon: {
    fontSize: 32,
    marginBottom: 6,
  },

  photoText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#222',
  },

  photoHint: {
    fontSize: 10,
    color: '#777',
    marginTop: 4,
  },

  removePhoto: {
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 14,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 5,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },

  cancelText: {
    fontWeight: '600',
  },
});
