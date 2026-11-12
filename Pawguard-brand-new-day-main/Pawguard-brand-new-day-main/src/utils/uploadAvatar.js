// utils/uploadAvatar.js
// Lets the user pick a photo, uploads it to the "avatars" bucket,
// saves the URL on their profile and removes the old picture.
// Returns the new public URL, or null if the user cancelled.

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '../config/supabase';

const BUCKET = 'avatars';

// ".../storage/v1/object/public/avatars/<uid>/file.jpg" -> "<uid>/file.jpg"
const pathFromUrl = (url) => {
  if (!url) return null;
  const marker = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length).split('?')[0];
};

export async function pickAndUploadAvatar(userId, oldUrl) {
  if (!userId) throw new Error('Please log in again.');

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission required',
      'Please allow PawGuard to access your photo gallery.'
    );
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const extension = (
    asset.fileName?.split('.').pop() ||
    asset.uri.split('.').pop()?.split('?')[0] ||
    'jpg'
  ).toLowerCase();

  const path = `${userId}/avatar-${Date.now()}.${extension}`;
  const contentType =
    asset.mimeType || `image/${extension === 'jpg' ? 'jpeg' : extension}`;

  const fileResponse = await fetch(asset.uri);
  const fileBuffer = await fileResponse.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBuffer, { contentType, upsert: false });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);

  if (updateError) {
    // Don't leave an orphan file behind
    await supabase.storage.from(BUCKET).remove([path]);
    throw updateError;
  }

  // Clean up the previous picture (ignore failures)
  const oldPath = pathFromUrl(oldUrl);
  if (oldPath && oldPath !== path) {
    supabase.storage.from(BUCKET).remove([oldPath]).catch(() => {});
  }

  return publicUrl;
}