import React from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

export default function SettingsScreen() {
  const { profile, signOut } = useAuth();

  const tone = tones.green;
  const initial = (profile?.name || '?').trim().charAt(0).toUpperCase();

  function handleSignOut() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
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
                {profile.role}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={[styles.avatarText, { color: tone.text }]}>{initial}</Text>
          </View>

          <Text style={[styles.name, { color: tone.text }]} numberOfLines={1}>
            {profile?.name || 'Unknown user'}
          </Text>
        </View>
      </View>

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
    gap: 14,
    marginTop: 22,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: fonts.medium,
    fontSize: 24,
  },
  name: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 24,
  },

  logout: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  logoutText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.white,
  },
});