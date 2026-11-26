// screens/main/PrivacyPolicyScreen.js
// PawGuard privacy notice (Data Privacy Act of 2012, RA 10173).
// Change PRIVACY_VERSION when the notice changes: everyone is asked to
// agree again the next time they open the app.
//
// Fill in CONTACT_EMAIL with your team's email before the defense.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, tones } from '../../Theme';

export const PRIVACY_VERSION = '2026-11-20';
const CONTACT_EMAIL = 'pawguard.app@gmail.com';

export const PRIVACY_SUMMARY = [
  'We collect your account details, your pet’s details and the collar’s readings, including GPS location.',
  'We use them to warn you about heat risk, show where your pet is, and run dog events safely.',
  'Event organizers see your pet’s readings and location only during events you join.',
  'You can see, fix or delete your data anytime. "Delete my account" in Settings erases it.',
];

const SECTIONS = [
  {
    title: 'Who we are',
    body: [
      'PawGuard is a dog heat-safety collar and app made as a capstone project at the University of Science and Technology of Southern Philippines (USTP). The PawGuard team is responsible for the personal information described here.',
    ],
  },
  {
    title: 'What we collect',
    body: [
      'Account: your name, email, role (pet owner or event organizer) and profile photo.',
      'Your pets: name, breed, age, weight, photo, and your vet’s name and phone if you add them.',
      'From the collar: surface temperature, air temperature, humidity and GPS location, about every 15 seconds while it is on.',
      'Events: which events you join, approvals and check-ins.',
      'Your phone: a push notification token so we can send alerts.',
    ],
  },
  {
    title: 'Why we use it',
    body: [
      'To check your pet’s heat risk and alert you, even when the app is closed.',
      'To show your pet’s location on the map.',
      'To let event organizers keep dogs safe during events.',
      'For our study: only totals and summaries, never your name or your pet’s name.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'You.',
      'Event organizers, only for events you join and only while they run: your pet’s readings, location and check-in.',
      'System administrators, to fix problems and keep the service working.',
      'We do not sell your information or share it for advertising.',
    ],
  },
  {
    title: 'Where it is kept and for how long',
    body: [
      'Your data is stored with Supabase, a cloud database. Its servers may be outside the Philippines.',
      'We keep it while you have an account. When you delete your account, your pets, readings, alerts, notifications and login are erased right away. Collars are released so they can be used again.',
    ],
  },
  {
    title: 'How we protect it',
    body: [
      'Data is sent over encrypted connections (HTTPS).',
      'Database rules make sure people only see what they are allowed to see.',
      'Each collar has its own secret, so other devices cannot send fake readings.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'Under the Data Privacy Act you can: be informed, see your data, correct it, object to its use, have it erased, get a copy, and file a complaint with the National Privacy Commission (privacy.gov.ph).',
      'You can edit your details in the app, and delete everything with "Delete my account" in Settings.',
    ],
  },
  {
    title: 'Contact us',
    body: [`Questions or requests: ${CONTACT_EMAIL}`],
  },
];

export default function PrivacyPolicyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy notice</Text>
      <Text style={styles.meta}>Version {PRIVACY_VERSION}</Text>

      <View style={[styles.summary, { backgroundColor: tones.green.bg }]}>
        <Text style={[styles.summaryTitle, { color: tones.green.text }]}>In short</Text>
        {PRIVACY_SUMMARY.map((line) => (
          <Text key={line} style={[styles.summaryLine, { color: tones.green.text }]}>
            •  {line}
          </Text>
        ))}
      </View>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{s.title}</Text>
          {s.body.map((p) => (
            <Text key={p} style={styles.p}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 },
  title: { fontFamily: fonts.medium, fontSize: 26, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  summary: { borderRadius: 22, padding: 18, marginTop: 18, gap: 6 },
  summaryTitle: { fontFamily: fonts.semibold, fontSize: 16, marginBottom: 2 },
  summaryLine: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  section: { marginTop: 22 },
  sectionTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, marginBottom: 6 },
  p: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.ink, marginBottom: 6 },
});