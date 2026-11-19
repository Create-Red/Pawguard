// components/CallVetButton.js
// "Call vet" for a pet. Opens the phone dialer with the vet number saved in
// Edit Pet. If no number is saved yet, it offers to add one.
//
// Usage: <CallVetButton dog={dog} navigation={navigation} />
//        <CallVetButton dog={dog} navigation={navigation} tone={tones.salmon} />

import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';

import Icon from './Icon';
import { colors, fonts } from '../Theme';

// "+63 917-123 4567" -> "+639171234567"
export const dialable = (phone) => (phone || '').replace(/[^\d+]/g, '');

export async function callVet(dog, navigation) {
  const number = dialable(dog?.vet_phone);

  if (!number) {
    Alert.alert(
      'No vet number yet',
      `Add ${dog?.name || 'your pet'}'s vet so you can call them in one tap.`,
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Add vet',
          onPress: () => navigation?.navigate('EditPet', { dogId: dog.id }),
        },
      ]
    );
    return;
  }

  try {
    await Linking.openURL(`tel:${number}`);
  } catch {
    Alert.alert('Cannot place call', `Please dial ${dog.vet_phone} yourself.`);
  }
}

export default function CallVetButton({ dog, navigation, tone, style }) {
  const hasVet = !!dialable(dog?.vet_phone);
  const fg = tone ? tone.text : colors.ink;

  return (
    <TouchableOpacity
      style={[styles.button, tone && { backgroundColor: tone.pill }, style]}
      activeOpacity={0.8}
      onPress={() => callVet(dog, navigation)}
      accessibilityRole="button"
      accessibilityLabel={
        hasVet ? `Call ${dog.vet_name || 'vet'} at ${dog.vet_phone}` : 'Add a vet number'
      }
    >
      <Icon name={hasVet ? 'call' : 'add-circle-outline'} size={18} color={fg} />
      <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
        {hasVet ? `Call ${dog.vet_name || 'vet'}` : 'Add vet number'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.pill,
  },
  text: { fontFamily: fonts.medium, fontSize: 15, flexShrink: 1 },
});