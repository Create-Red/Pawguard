import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import AvatarPicker from '../../components/AvatarPicker';
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

const MAX_NAME = 50;

// 'event_organizer' -> 'Event organizer'
const formatRole = (role) => {
  const text = (role || '').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function SettingsScreen({ navigation }) {
  const { profile, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  // Data Privacy Act: the right to erasure
  const deleteAccount = async () => {
    setDeleting(true);
    try {
      // 1) Photos in storage (each user has their own folder)
      for (const bucket of ['dog-photos', 'avatars']) {
        const { data: files } = await supabase.storage.from(bucket).list(profile.id, { limit: 1000 });
        if (files?.length) {
          await supabase.storage.from(bucket).remove(files.map((f) => `${profile.id}/${f.name}`));
        }
      }
      // 2) Everything else, and the login
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
      await signOut();
      Alert.alert('Account deleted', 'Your account and your data have been erased.');
    } catch (e) {
      Alert.alert('Could not delete account', e.message || 'Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteAccount = () =>
    Alert.alert(
      'Delete your account?',
      'This erases your profile, pets, readings, alerts and event sign-ups for good. Your collar is released so it can be used again. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'All your PawGuard data will be gone.', [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Yes, delete everything', style: 'destructive', onPress: deleteAccount },
            ]),
        },
      ]
    );

  const tone = tones.brand;

  // Shown on screen. Updated right after saving, even before AuthContext reloads.
  const [displayName, setDisplayName] = useState(profile?.name || '');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(profile?.name || '');
  }, [profile?.name]);

  function startEditing() {
    setDraft(displayName);
    setError('');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError('');
  }

  async function saveName() {
    const name = draft.trim().replace(/\s+/g, ' ');

    if (!name) {
      setError('Name cannot be empty.');
      return;
    }

    if (name === displayName) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setError('');

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ name })
      .eq('id', profile.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message || 'Could not save your name.');
      return;
    }

    setDisplayName(name);
    setEditing(false);
  }

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* Profile card */}
      <View style={[styles.card, { backgroundColor: tone.bg }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.cardMeta, { color: tone.sub }]}>Signed in as</Text>

          {!!profile?.role && (
            <View style={[styles.pill, { backgroundColor: tone.pill }]}>
              <Text style={[styles.pillText, { color: tone.pillText }]}>
                {formatRole(profile.role)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.identity}>
          {/* Tap to pick / change the profile photo */}
          <AvatarPicker
            userId={profile?.id}
            uri={profile?.avatar_url}
            name={displayName}
            size={72}
            bg="rgba(255,255,255,0.6)"
            color={tone.text}
          />

          <View style={styles.nameBlock}>
            {editing ? (
              <TextInput
                style={[styles.nameInput, { color: tone.text }]}
                value={draft}
                onChangeText={(t) => {
                  setDraft(t);
                  if (error) setError('');
                }}
                placeholder="Your name"
                placeholderTextColor={tone.sub}
                autoFocus
                autoCapitalize="words"
                maxLength={MAX_NAME}
                returnKeyType="done"
                onSubmitEditing={saveName}
                editable={!saving}
              />
            ) : (
              <TouchableOpacity
                style={styles.nameRow}
                onPress={startEditing}
                accessibilityRole="button"
                accessibilityLabel={`Name: ${displayName || 'not set'}. Tap to edit`}
              >
                <Text
                  style={[styles.name, { color: tone.text }]}
                  numberOfLines={1}
                >
                  {displayName || 'Add your name'}
                </Text>
                <View style={styles.editIcon}>
                  <Icon name="pencil" size={14} color={tone.text} />
                </View>
              </TouchableOpacity>
            )}

            {!editing && (
              <Text style={[styles.photoHint, { color: tone.sub }]}>
                {profile?.avatar_url
                  ? 'Tap your photo or name to change it'
                  : 'Tap the circle to add a photo'}
              </Text>
            )}
          </View>
        </View>

        {/* Save / cancel row while editing */}
        {editing && (
          <View style={styles.editActions}>
            {!!error && (
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            )}

            <View style={styles.editButtons}>
              <TouchableOpacity
                style={styles.cancelChip}
                onPress={cancelEditing}
                disabled={saving}
              >
                <Text style={[styles.chipText, { color: tone.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveChip, saving && styles.dimmed]}
                onPress={saveName}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.onAccent} />
                ) : (
                  <Text style={[styles.chipText, { color: colors.onAccent }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Privacy & data */}
      <Text style={styles.groupTitle}>Privacy & data</Text>
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('PrivacyPolicy')}
        accessibilityRole="button"
      >
        <Text style={styles.rowText}>Privacy notice</Text>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.row, styles.rowLast]}
        onPress={confirmDeleteAccount}
        disabled={deleting}
        accessibilityRole="button"
      >
        <Text style={[styles.rowText, { color: colors.danger }]}>
          {deleting ? 'Deleting your account…' : 'Delete my account'}
        </Text>
        {deleting ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.logout} onPress={handleSignOut}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: colors.white,
  },

  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginBottom: 20,
  },

  card: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 24,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 14,
  },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
  },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 22,
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: 24,
  },
  editIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nameInput: {
    fontFamily: fonts.medium,
    fontSize: 20,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  photoHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 4,
  },

  // Editing actions
  editActions: {
    marginTop: 16,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelChip: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  saveChip: {
    height: 40,
    minWidth: 80,
    paddingHorizontal: 18,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accent,
  },
  chipText: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    marginBottom: 10,
  },
  dimmed: {
    opacity: 0.5,
  },

  groupTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 28,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },

  logout: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },
});