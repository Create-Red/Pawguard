import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, tones } from '../../Theme';

const STATUS_TONE = {
  approved: 'green',
  pending: 'amber',
  rejected: 'salmon',
};

function InfoRow({ label, value, last }) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value || 'Not available'}
      </Text>
    </View>
  );
}

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

export default function ParticipantProfileScreen({ route }) {
  const member = route?.params?.member;
  const eventName = route?.params?.eventName || 'Event';

  const dog = member?.dogs;
  const owner = member?.profiles;

  if (!member) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Participant information unavailable</Text>
      </View>
    );
  }

  const tone = tones[STATUS_TONE[member.status]] || tones.beige;
  const initial = (dog?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* The one boxed element: who this is and where they stand */}
      <View style={[styles.hero, { backgroundColor: tone.bg }]}>
        <View style={styles.heroTop}>
          <Text style={[styles.heroMeta, { color: tone.sub }]} numberOfLines={1}>
            {eventName}
          </Text>
          <View style={[styles.pill, { backgroundColor: tone.pill }]}>
            <Text style={[styles.pillText, { color: tone.pillText }]}>
              {member.status || 'unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.identity}>
          {dog?.photo_url ? (
            <Image source={{ uri: dog.photo_url }} style={styles.photo} />
          ) : (
            <View style={styles.avatar}>
              <Text style={[styles.avatarText, { color: tone.text }]}>{initial}</Text>
            </View>
          )}
          <Text style={[styles.name, { color: tone.text }]} numberOfLines={2}>
            {dog?.name || 'Unknown dog'}
          </Text>
        </View>

        <View style={styles.heroDivider} />

        <View style={styles.heroRow}>
          <View style={styles.heroCol}>
            <Text style={[styles.heroColLabel, { color: tone.sub }]}>Breed</Text>
            <Text style={[styles.heroColValue, { color: tone.text }]} numberOfLines={1}>
              {dog?.breed || 'Not specified'}
            </Text>
          </View>
          <View style={styles.heroCol}>
            <Text style={[styles.heroColLabel, { color: tone.sub }]}>Age</Text>
            <Text style={[styles.heroColValue, { color: tone.text }]}>
              {dog?.age != null
                ? `${dog.age} ${Number(dog.age) === 1 ? 'year' : 'years'}`
                : 'Not specified'}
            </Text>
          </View>
        </View>
      </View>

      {/* Owner + registration as plain rows (IDs removed: not useful here) */}
      <Text style={styles.sectionTitle}>Owner and registration</Text>

      <InfoRow label="Owner" value={owner?.name} />
      <InfoRow label="Requested" value={formatDateTime(member.joined_at)} />
      <InfoRow
        label="Reviewed"
        value={formatDateTime(member.reviewed_at) || 'Not reviewed yet'}
        last
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  emptyTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },

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
    gap: 12,
  },
  heroMeta: { flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  pill: {
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.4 },

  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  photo: { width: 72, height: 72, borderRadius: 36 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontFamily: fonts.medium, fontSize: 30 },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 28, lineHeight: 36 },

  heroDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginTop: 20,
    marginBottom: 16,
  },
  heroRow: { flexDirection: 'row' },
  heroCol: { flex: 1, paddingRight: 8 },
  heroColLabel: { fontFamily: fonts.regular, fontSize: 12, marginBottom: 2 },
  heroColValue: { fontFamily: fonts.medium, fontSize: 18 },

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
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  rowValue: {
    flex: 1,
    marginLeft: 16,
    textAlign: 'right',
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.ink,
  },
});