// screens/auth/ForgotPasswordScreen.js
// Reset a forgotten password with a 6-digit code sent by email.
//   Step 1: enter email        -> Supabase emails a code
//   Step 2: enter code + new password
// A code (not a link) means it works in Expo Go without deep links.
// Needs the "Reset Password" email template to include {{ .Token }}.

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

const RESEND_SECONDS = 60;

function Field({ label, focused, error, right, ...inputProps }) {
  return (
    <View style={[styles.field, focused && styles.fieldFocused, error && styles.fieldError]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput style={styles.input} placeholderTextColor={colors.muted} {...inputProps} />
        {right}
      </View>
    </View>
  );
}

export default function ForgotPasswordScreen({ navigation, route }) {
  const [step, setStep] = useState('email'); // 'email' | 'reset'
  const [email, setEmail] = useState(route?.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const fail = (msg, field = null) => {
    setError(msg);
    setErrorField(field);
  };
  const clear = () => {
    if (error) {
      setError('');
      setErrorField(null);
    }
  };

  async function sendCode() {
    const addr = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(addr)) return fail('Please enter the email you signed up with.', 'email');

    setLoading(true);
    clear();
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(addr);
    setLoading(false);

    if (sendError) {
      // Too many requests is the common one on the free plan
      return fail(
        sendError.status === 429
          ? 'Too many requests. Please wait a few minutes and try again.'
          : sendError.message
      );
    }

    setEmail(addr);
    setStep('reset');
    setResendIn(RESEND_SECONDS);
  }

  async function resetPassword() {
    if (!/^\d{6}$/.test(code.trim())) return fail('Enter the 6-digit code from the email.', 'code');
    if (password.length < 8) return fail('Use at least 8 characters for your new password.', 'password');
    if (password !== confirm) return fail('The two passwords do not match.', 'confirm');

    setLoading(true);
    clear();

    // 1) The code proves it's your email; this signs you in for a moment
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) {
      setLoading(false);
      return fail('That code is wrong or has expired. Check the email or send a new code.', 'code');
    }

    // 2) Save the new password
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) return fail(updateError.message, 'password');

    // You're now signed in with the new password; the app opens on its own.
    Alert.alert('Password changed', 'Your new password is saved. Welcome back!');
  }

  const isEmail = step === 'email';

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹ Back to log in</Text>
        </TouchableOpacity>

        <View style={[styles.hero, { backgroundColor: tones.brand.bg }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: tones.brand.text }]}>
              {isEmail ? 'Forgot password?' : 'Check your email'}
            </Text>
            <Text style={[styles.heroText, { color: tones.brand.pillText }]}>
              {isEmail
                ? "No worries. We'll email you a 6-digit code to set a new one."
                : `We sent a 6-digit code to ${email}.`}
            </Text>
          </View>
        </View>

        <View style={styles.form}>
          {isEmail ? (
            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clear();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={sendCode}
              focused={focused === 'email'}
              error={errorField === 'email'}
              onFocus={() => setFocused('email')}
              onBlur={() => setFocused(null)}
            />
          ) : (
            <>
              <Field
                label="6-digit code"
                placeholder="123456"
                value={code}
                onChangeText={(t) => {
                  setCode(t.replace(/\D/g, '').slice(0, 6));
                  clear();
                }}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
                focused={focused === 'code'}
                error={errorField === 'code'}
                onFocus={() => setFocused('code')}
                onBlur={() => setFocused(null)}
              />
              <Field
                label="New password"
                placeholder="At least 8 characters"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  clear();
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                focused={focused === 'password'}
                error={errorField === 'password'}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                right={
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                    <Text style={styles.toggle}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                }
              />
              <Field
                label="Confirm new password"
                placeholder="Type it again"
                value={confirm}
                onChangeText={(t) => {
                  setConfirm(t);
                  clear();
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={resetPassword}
                focused={focused === 'confirm'}
                error={errorField === 'confirm'}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
              />
            </>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.dimmed]}
          onPress={isEmail ? sendCode : resetPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>{isEmail ? 'Send code' : 'Save new password'}</Text>
          )}
        </TouchableOpacity>

        {!isEmail && (
          <View style={styles.footer}>
            <TouchableOpacity onPress={sendCode} disabled={resendIn > 0 || loading} hitSlop={8}>
              <Text style={[styles.footerLink, resendIn > 0 && styles.footerMuted]}>
                {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setStep('email');
                setCode('');
                clear();
              }}
              hitSlop={8}
            >
              <Text style={styles.footerLink}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 56, paddingBottom: 40 },
  back: { alignSelf: 'flex-start' },
  backText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },

  hero: {
    borderRadius: 30,
    paddingHorizontal: 22,
    paddingVertical: 24,
    marginTop: 28,
  },
  heroCopy: {},
  heroTitle: { fontFamily: fonts.medium, fontSize: 26 },
  heroText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, marginTop: 6 },

  form: { marginTop: 28, gap: 12 },
  field: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fieldFocused: { borderColor: colors.accent },
  fieldError: { borderColor: colors.danger },
  fieldLabel: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 0.6, color: colors.tileLabel },
  fieldRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 0,
  },
  toggle: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginLeft: 10 },
  errorText: { fontFamily: fonts.regular, fontSize: 13, color: colors.danger, paddingHorizontal: 4 },

  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonText: { fontFamily: fonts.medium, fontSize: 16, color: colors.onAccent },
  dimmed: { opacity: 0.5 },

  footer: { alignItems: 'center', gap: 14, marginTop: 22 },
  footerLink: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
  footerMuted: { color: colors.muted, textDecorationLine: 'none' },
});