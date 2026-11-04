import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Icon from '../../components/Icon';

import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

// One plain label / value line with a hairline under it
function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function DogProfileScreen({ route, navigation }) {
  const { dogId } = route.params;

  const [dog, setDog] = useState(null);
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    loadDog();
  }, [dogId]);

  async function loadDog() {
    try {
      const { data, error } = await supabase
        .from('dogs')
        .select('*')
        .eq('id', dogId)
        .eq('is_archived', false)
        .single();

      if (error) throw error;

      setDog(data);

      const { data: deviceData, error: deviceError } =
        await supabase
          .from('devices')
          .select('id, device_uid, status, firmware_version, battery_pct')
          .eq('dog_id', dogId)
          .maybeSingle();

      if (deviceError) throw deviceError;

      setDevice(deviceData);
    } catch (error) {
      console.log('DOG PROFILE ERROR:', error.message);

      Alert.alert('Error', 'Unable to load pet information.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }

  function confirmArchive() {
    Alert.alert(
      'Archive Dog',
      `Are you sure you want to remove ${dog.name} from your active pets? Its event records and sensor history will be preserved. Any paired device will be unpaired.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: archiveDog,
        },
      ]
    );
  }

  async function archiveDog() {
    setArchiving(true);

    const { error } = await supabase.rpc('archive_dog', {
      p_dog_id: dogId,
    });

    setArchiving(false);

    if (error) {
      Alert.alert('Archive Failed', error.message);
      return;
    }

    Alert.alert(
      'Dog Archived',
      `${dog.name} has been removed from your active pets.`,
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
        <Text style={styles.loadingText}>Loading pet information...</Text>
      </View>
    );
  }

  if (!dog) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Pet not found.</Text>
      </View>
    );
  }

  const tone = device ? tones.brand : tones.beige;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* The one boxed element: who this pet is */}
      <View style={[styles.hero, { backgroundColor: tone.bg }]}>
        <View style={styles.heroTop}>
          <Text style={[styles.heroMeta, { color: tone.sub }]}>Pet profile</Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>
              {device ? 'Device paired' : 'No device'}
            </Text>
          </View>
        </View>

        <View style={styles.identity}>
          {dog.photo_url ? (
  <Image
    source={{ uri: dog.photo_url }}
    style={styles.avatar}
    resizeMode="cover"
  />
) : (
  <View style={styles.avatar}>
    <Icon name="paw" size={28} color={tone.text} />
  </View>
)}
          <Text style={[styles.name, { color: tone.text }]} numberOfLines={2}>
            {dog.name}
          </Text>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroRow}>
          <View style={styles.heroCol}>
            <Text style={[styles.heroColLabel, { color: tone.sub }]}>Breed</Text>
            <Text
              style={[styles.heroColValue, { color: tone.text }]}
              numberOfLines={1}
            >
              {dog.breed || 'Not specified'}
            </Text>
          </View>

          <View style={styles.heroCol}>
            <Text style={[styles.heroColLabel, { color: tone.sub }]}>Age</Text>
            <Text style={[styles.heroColValue, { color: tone.text }]}>
              {dog.age != null && dog.age !== ''
                ? `${dog.age} ${Number(dog.age) === 1 ? 'year' : 'years'}`
                : 'Not specified'}
            </Text>
          </View>
        </View>
      </View>

      {/* Device: plain rows, no box */}
      <Text style={styles.sectionTitle}>PawGuard device</Text>

      {device ? (
        <>
          <InfoRow label="Device ID" value={device.device_uid} />
          <InfoRow label="Status" value={device.status || 'Unknown'} />
          <InfoRow
            label="Battery"
            value={
              device.battery_pct != null ? `${device.battery_pct}%` : '--'
            }
            last={!device.firmware_version}
          />
          {!!device.firmware_version && (
            <InfoRow label="Firmware" value={device.firmware_version} last />
          )}

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('TransferDevice', {
                dogId: dog.id,
                dogName: dog.name,
                deviceId: device.id,
                deviceUid: device.device_uid,
              })
            }
          >
            <Icon name="swap-horizontal" size={18} color={colors.ink} />
            <Text style={styles.secondaryButtonText}>
              Transfer to another dog
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.emptyText}>
            No device is paired with {dog.name} yet.
          </Text>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('PairDevice', {
                dogId: dog.id,
                dogName: dog.name,
              })
            }
          >
            <Icon name="link-outline" size={18} color={colors.ink} />
            <Text style={styles.secondaryButtonText}>Pair device</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Actions */}
      <TouchableOpacity
        style={styles.primaryButton}
        activeOpacity={0.85}
        onPress={() =>
          navigation.navigate('EditPet', {
            dogId: dog.id,
          })
        }
      >
        <Text style={styles.primaryButtonText}>Edit pet</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.dangerButton, archiving && styles.disabled]}
        activeOpacity={0.8}
        onPress={confirmArchive}
        disabled={archiving}
      >
        <Text style={styles.dangerButtonText}>
          {archiving ? 'Archiving...' : 'Remove dog'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  loadingText: {
    marginTop: 12,
    fontFamily: fonts.regular,
    color: colors.muted,
  },

  // Hero
  hero: {
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 22,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMeta: {
    fontFamily: fonts.regular,
    fontSize: 13,
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
    marginTop: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 30,
    lineHeight: 38,
  },
  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 20,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
  },
  heroCol: {
    flex: 1,
    paddingRight: 8,
  },
  heroColLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginBottom: 2,
  },
  heroColValue: {
    fontFamily: fonts.medium,
    fontSize: 18,
  },

  // Device section
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 32,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  rowValue: {
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 4,
  },

  // Buttons
  secondaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.pill,
    marginTop: 14,
  },
  secondaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 36,
  },
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },
  dangerButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  dangerButtonText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
});