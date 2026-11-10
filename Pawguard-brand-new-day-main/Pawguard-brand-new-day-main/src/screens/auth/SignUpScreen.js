import React, { useState } from 'react';

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

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

const ROLES = [
  {
    id: 'owner',
    icon: 'paw',
    title: 'Pet owner',
    description: 'Monitor your pets and join events.',
    button: 'Pet Owner',
  },
  {
    id: 'event_organizer',
    icon: 'calendar',
    title: 'Event organizer',
    description: 'Create events and manage participants.',
    button: 'Organizer',
  },
];

// Labeled input styled like the dashboard's info tiles (same as LoginScreen).
function Field({ label, focused, error, right, hint, ...inputProps }) {
  return (
    <View>
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error && styles.fieldError,
        ]}
      >
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={styles.fieldRow}>
          <TextInput
            style={styles.input}
            placeholderTextColor={colors.muted}
            {...inputProps}
          />
          {right}
        </View>
      </View>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('owner');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorField, setErrorField] = useState(null); // 'all' | 'password' | null

  const selectedRole = ROLES.find((r) => r.id === role);

  const clearError = () => {
    if (error) {
      setError('');
      setErrorField(null);
    }
  };

  async function handleSignUp() {
    if (!name.trim() || !email.trim() || !password) {
      setError('Please complete all fields.');
      setErrorField('all');
      return;
    }

    if (password.length < 6) {
      setError('Your password must contain at least 6 characters.');
      setErrorField('password');
      return;
    }

    setError('');
    setErrorField(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            role,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setErrorField('all');
        return;
      }

      if (!data.user) {
        setError('Your account could not be created. Please try again.');
        setErrorField('all');
        return;
      }

      if (data.session) {
        // Signed in right away; AuthContext handles navigation.
        Alert.alert('Account created', 'Welcome to PawGuard!');
      } else {
        // Email verification required.
        Alert.alert(
          'Check your email',
          'We sent you a link to verify your account. Verify it, then log in.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      }
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
      setErrorField('all');
    } finally {
      setLoading(false);
    }
  }

  const fieldHasError = (field) =>
    errorField === 'all'
      ? field === 'password'
        ? !password
        : field === 'name'
        ? !name.trim()
        : !email.trim()
      : errorField === field;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header: back button + brand */}
        <View style={styles.topHeader}>
          <View style={styles.brand}>
            <Text style={styles.brandText}>PawGuard</Text>
            <View style={styles.brandDot} />
          </View>
        </View>

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Choose how you want to use PawGuard.</Text>

        {/* Role cards */}
        <View style={styles.roles} accessibilityRole="radiogroup">
          {ROLES.map((r) => {
            const active = role === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                activeOpacity={0.85}
                style={[
                  styles.roleCard,
                  active
                    ? { backgroundColor: tones.brand.bg, borderColor: tones.brand.text }
                    : null,
                ]}
                onPress={() => setRole(r.id)}
                disabled={loading}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${r.title}. ${r.description}`}
              >
                <View style={styles.roleTop}>
                  <View
                    style={[
                      styles.roleIcon,
                      active && styles.roleIconActive,
                    ]}
                  >
                    <Icon
                      name={r.icon}
                      size={22}
                      color={active ? tones.brand.text : colors.ink}
                    />
                  </View>
                  <View
                    style={[
                      styles.radio,
                      active && { borderColor: tones.brand.text },
                    ]}
                  >
                    {active && (
                      <View
                        style={[
                          styles.radioDot,
                          { backgroundColor: tones.brand.text },
                        ]}
                      />
                    )}
                  </View>
                </View>

                <Text
                  style={[
                    styles.roleTitle,
                    active && { color: tones.brand.text },
                  ]}
                >
                  {r.title}
                </Text>
                <Text
                  style={[
                    styles.roleDescription,
                    active && { color: tones.brand.pillText },
                  ]}
                >
                  {r.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Field
            label="Full name"
            placeholder="Juan Dela Cruz"
            value={name}
            onChangeText={(t) => {
              setName(t);
              clearError();
            }}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            editable={!loading}
            focused={focused === 'name'}
            error={fieldHasError('name')}
            onFocus={() => setFocused('name')}
            onBlur={() => setFocused(null)}
          />

          <Field
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearError();
            }}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            editable={!loading}
            focused={focused === 'email'}
            error={fieldHasError('email')}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
          />

          <Field
            label="Password"
            placeholder="Create a password"
            hint="At least 6 characters"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearError();
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
            editable={!loading}
            focused={focused === 'password'}
            error={fieldHasError('password')}
            onFocus={() => setFocused('password')}
            onBlur={() => setFocused(null)}
            right={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.toggle}>
                  {showPassword ? 'Hide' : 'Show'}
                </Text>
              </TouchableOpacity>
            }
          />

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.dimmed]}
          onPress={handleSignUp}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={styles.primaryButtonText}>
              Create {selectedRole.button} account
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          >
            <Text style={styles.footerLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 40,
  },

  // Header
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  brandText: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
  },
  brandDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginLeft: 3,
    marginBottom: 7,
  },

  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
    marginTop: 32,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 6,
  },

  // Role cards
  roles: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  roleCard: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
    minHeight: 150,
    backgroundColor: colors.tile,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIconActive: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.ink,
    marginTop: 14,
  },
  roleDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 4,
  },

  // Form
  form: {
    marginTop: 24,
    gap: 12,
  },
  field: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.tileLabel,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
    paddingHorizontal: 0,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  toggle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
    marginLeft: 10,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    paddingHorizontal: 4,
  },

  // Button
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.onAccent,
  },
  dimmed: {
    opacity: 0.5,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
  },
  footerLink: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
    textDecorationLine: 'underline',
  },
});