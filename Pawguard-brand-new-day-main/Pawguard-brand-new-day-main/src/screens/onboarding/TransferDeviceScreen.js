import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Avatar from '../../components/Avatar';
import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

export default function TransferDeviceScreen({ route, navigation }) {
  const { dogId, dogName, deviceId, deviceUid } = route.params;

  const { profile } = useAuth();

  const [dogs, setDogs] = useState([]);
  const [selectedDog, setSelectedDog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAvailableDogs();
  }, [profile?.id]);

  async function loadAvailableDogs() {
    if (!profile?.id) return;

    try {
      const { data: dogData, error: dogError } = await supabase
        .from('dogs')
        .select('id, name, breed, photo_url')
        .eq('owner_id', profile.id)
        .eq('is_archived', false)
        .neq('id', dogId)
        .order('created_at', { ascending: true });

      if (dogError) throw dogError;

      if (!dogData || dogData.length === 0) {
        setDogs([]);
        return;
      }

      const dogIds = dogData.map((dog) => dog.id);

      const { data: pairedDevices, error: deviceError } = await supabase
        .from('devices')
        .select('dog_id')
        .in('dog_id', dogIds);

      if (deviceError) throw deviceError;

      const dogsWithDevices = new Set((pairedDevices || []).map((d) => d.dog_id));

      // Dogs that already have a device are shown, but can't be picked
      setDogs(
        dogData.map((dog) => ({ ...dog, hasDevice: dogsWithDevices.has(dog.id) }))
      );
    } catch (e) {
      console.log('AVAILABLE DOGS ERROR:', e.message);
      setError('Unable to load your pets.');
    } finally {
      setLoading(false);
    }
  }

  function confirmTransfer() {
    if (!selectedDog) return;

    Alert.alert(
      'Transfer device?',
      `${deviceUid} will move from ${dogName} to ${selectedDog.name}. ` +
        `${dogName}'s past readings stay with ${dogName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Transfer', onPress: transferDevice },
      ]
    );
  }

  async function transferDevice() {
    setTransferring(true);
    setError('');

    const { error: transferError } = await supabase.rpc('transfer_device', {
      p_device_id: deviceId,
      p_target_dog_id: selectedDog.id,
    });

    setTransferring(false);

    if (transferError) {
      setError(transferError.message);
      return;
    }

    Alert.alert(
      'Device transferred',
      `${deviceUid} is now with ${selectedDog.name}.`,
      [{ text: 'OK', onPress: () => navigation.popToTop() }]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  const available = dogs.filter((d) => !d.hasDevice);
  const tone = tones.brand;

  const Header = (
    <View>
      <Text style={styles.title}>Transfer device</Text>
      <Text style={styles.subtitle}>Move this collar to another of your pets.</Text>

      {/* From -> To */}
      <View style={[styles.hero, { backgroundColor: tone.bg }]}>
        <View style={styles.heroTop}>
          <Text style={[styles.heroMeta, { color: tone.sub }]}>Device</Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>{deviceUid}</Text>
          </View>
        </View>

        <View style={styles.flow}>
          <View style={styles.flowCol}>
            <Text style={[styles.flowLabel, { color: tone.sub }]}>From</Text>
            <Text style={[styles.flowName, { color: tone.text }]} numberOfLines={1}>
              {dogName}
            </Text>
          </View>

          <View style={styles.flowArrow}>
            <Icon name="arrow-forward" size={18} color={tone.text} />
          </View>

          <View style={[styles.flowCol, styles.flowRight]}>
            <Text style={[styles.flowLabel, { color: tone.sub }]}>To</Text>
            <Text
              style={[
                styles.flowName,
                { color: selectedDog ? tone.text : tone.sub },
              ]}
              numberOfLines={1}
            >
              {selectedDog?.name || 'Pick a pet'}
            </Text>
          </View>
        </View>
      </View>

      {dogs.length > 0 && <Text style={styles.sectionTitle}>Your pets</Text>}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={dogs}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={Header}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const active = selectedDog?.id === item.id;
          const disabled = item.hasDevice || transferring;

          return (
            <TouchableOpacity
              style={[
                styles.row,
                index === dogs.length - 1 && styles.rowLast,
                item.hasDevice && styles.dimmed,
              ]}
              activeOpacity={0.7}
              disabled={disabled}
              onPress={() => {
                setSelectedDog(item);
                if (error) setError('');
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: item.hasDevice }}
            >
              <Avatar
                uri={item.photo_url}
                name={item.name}
                size={46}
                bg={active ? tones.brand.bg : colors.tile}
                color={tones.brand.text}
              />

              <View style={styles.rowText}>
                <Text style={styles.dogName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.dogMeta} numberOfLines={1}>
                  {item.hasDevice
                    ? 'Already has a device'
                    : item.breed || 'Breed not specified'}
                </Text>
              </View>

              <View style={[styles.radio, active && styles.radioActive]}>
                {active && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: tones.beige.bg }]}>
              <Icon name="paw" size={34} color={tones.beige.text} />
            </View>
            <Text style={styles.emptyTitle}>No other pets</Text>
            <Text style={styles.emptyText}>
              Register another pet to move this device to it, or go back and use
              Remove if you're lending it to someone else.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('RegisterPet')}
            >
              <Icon name="add" size={18} color={colors.ink} />
              <Text style={styles.secondaryButtonText}>Register a pet</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          dogs.length > 0 && available.length === 0 ? (
            <Text style={styles.note}>
              All your other pets already have a device. Remove one first, or
              register a new pet.
            </Text>
          ) : null
        }
      />

      {/* Bottom action */}
      {dogs.length > 0 && (
        <View style={styles.footer}>
          {!!error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!selectedDog || transferring) && styles.dimmed,
            ]}
            onPress={confirmTransfer}
            disabled={!selectedDog || transferring}
          >
            {transferring ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {selectedDog ? `Transfer to ${selectedDog.name}` : 'Select a pet'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
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

  // Hero: from -> to
  hero: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    marginTop: 22,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMeta: { fontFamily: fonts.regular, fontSize: 13 },
  pill: { paddingHorizontal: 14, height: 30, borderRadius: 15, justifyContent: 'center' },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.8 },
  flow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  flowCol: { flex: 1 },
  flowRight: { alignItems: 'flex-end' },
  flowLabel: { fontFamily: fonts.regular, fontSize: 12 },
  flowName: { fontFamily: fonts.medium, fontSize: 20, marginTop: 2 },
  flowArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 28,
    marginBottom: 4,
    paddingHorizontal: 2,
  },

  // Pet rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1 },
  dogName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  dogMeta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginTop: 14,
    paddingHorizontal: 2,
  },

  // Empty
  empty: { alignItems: 'center', paddingTop: 36, paddingHorizontal: 12 },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 20, color: colors.ink },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    backgroundColor: colors.pill,
    marginTop: 20,
  },
  secondaryButtonText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    backgroundColor: colors.white,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.danger,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  dimmed: { opacity: 0.5 },
});