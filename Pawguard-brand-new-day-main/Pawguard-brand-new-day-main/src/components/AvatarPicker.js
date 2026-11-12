// components/AvatarPicker.js
// Drop-in profile picture with a "+" badge. Tap to choose a new photo.
// Works for both pet owners and event organizers.
//
// Usage (in any profile screen):
//   <AvatarPicker
//     userId={profile.id}
//     uri={profile.avatar_url}
//     name={profile.name}
//     onChange={(url) => { /* e.g. refresh your profile in AuthContext */ }}
//   />

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import Avatar from './Avatar';
import Icon from './Icon';
import { colors } from '../Theme';
import { pickAndUploadAvatar } from '../utils/uploadAvatar';

export default function AvatarPicker({
  userId,
  uri,
  name,
  size = 96,
  bg,
  color,
  onChange,
}) {
  const [current, setCurrent] = useState(uri || null);
  const [uploading, setUploading] = useState(false);

  // Keep in sync if the profile is reloaded elsewhere
  useEffect(() => {
    setCurrent(uri || null);
  }, [uri]);

  const handlePress = async () => {
    try {
      setUploading(true);
      const url = await pickAndUploadAvatar(userId, current);
      if (url) {
        setCurrent(url);
        onChange?.(url);
      }
    } catch (e) {
      console.log('AVATAR UPLOAD ERROR:', e.message);
      Alert.alert('Upload failed', e.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      disabled={uploading}
      style={{ width: size, height: size }}
      accessibilityRole="button"
      accessibilityLabel={current ? 'Change profile photo' : 'Add profile photo'}
    >
      <Avatar uri={current} name={name} size={size} bg={bg} color={color} />

      {uploading && (
        <View style={[styles.overlay, { borderRadius: size / 2 }]}>
          <ActivityIndicator color={colors.white} />
        </View>
      )}

      <View style={styles.badge}>
        <Icon name="add" size={18} color={colors.onAccent} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
});