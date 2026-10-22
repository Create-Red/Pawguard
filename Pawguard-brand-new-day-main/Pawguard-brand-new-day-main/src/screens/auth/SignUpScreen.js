
import React, { useState } from 'react';

import {
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../config/supabase';

export default function SignUpScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('owner');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert(
        'Missing Information',
        'Please complete all fields.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Weak Password',
        'Your password must contain at least 6 characters.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            name: name.trim(),
            role: role,
          },
        },
      });

      if (error) {
        Alert.alert('Sign Up Failed', error.message);
        return;
      }

      if (!data.user) {
        Alert.alert(
          'Sign Up Failed',
          'Your account could not be created. Please try again.'
        );
        return;
      }

      if (data.session) {
        // Supabase has signed the user in.
        // AuthContext should handle navigation automatically.
        Alert.alert(
          'Account Created',
          'Your account was created successfully!'
        );
      } else {
        // Email verification may be required.
        Alert.alert(
          'Account Created',
          'Please check your email to verify your account before logging in.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Sign Up Failed',
        error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      <Text style={styles.subtitle}>
        Choose how you want to use PawGuard.
      </Text>

      <Text style={styles.label}>Account Type</Text>

      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[
            styles.roleButton,
            role === 'owner' && styles.selectedRole,
          ]}
          onPress={() => setRole('owner')}
          disabled={loading}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === 'owner' }}
        >
          <Text style={styles.roleEmoji}>🐶</Text>
          <Text
            style={[
              styles.roleTitle,
              role === 'owner' && styles.selectedRoleText,
            ]}
          >
            Pet Owner
          </Text>
          <Text
            style={[
              styles.roleDescription,
              role === 'owner' && styles.selectedRoleText,
            ]}
          >
            Monitor your dogs and join events.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.roleButton,
            role === 'event_organizer' && styles.selectedRole,
          ]}
          onPress={() => setRole('event_organizer')}
          disabled={loading}
          accessibilityRole="radio"
          accessibilityState={{
            selected: role === 'event_organizer',
          }}
        >
          <Text style={styles.roleEmoji}>📅</Text>
          <Text
            style={[
              styles.roleTitle,
              role === 'event_organizer' && styles.selectedRoleText,
            ]}
          >
            Event Organizer
          </Text>
          <Text
            style={[
              styles.roleDescription,
              role === 'event_organizer' && styles.selectedRoleText,
            ]}
          >
            Create events and manage participants.
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Password (at least 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        editable={!loading}
      />

      <TouchableOpacity
        style={[
          styles.button,
          loading && styles.disabledButton,
        ]}
        onPress={handleSignUp}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            Create {role === 'owner' ? 'Pet Owner' : 'Organizer'} Account
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.loginLink}
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={styles.loginText}>
          Already have an account? Log in
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    color: '#222',
  },

  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },

  label: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    color: '#222',
  },

  roleContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  roleButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 14,
    padding: 12,
    minHeight: 145,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  selectedRole: {
    borderColor: '#222',
    backgroundColor: '#222',
  },

  roleEmoji: {
    fontSize: 27,
    marginBottom: 8,
  },

  roleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#222',
    textAlign: 'center',
    marginBottom: 6,
  },

  roleDescription: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },

  selectedRoleText: {
    color: '#fff',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    color: '#222',
  },

  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },

  loginLink: {
    alignItems: 'center',
    marginTop: 20,
  },

  loginText: {
    color: '#444',
    fontWeight: '600',
  },
});
