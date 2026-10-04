import React, { useState } from 'react';

import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { supabase } from '../../config/supabase';

export default function SignUpScreen({
  navigation,
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    if (!name || !email || !password) {
      Alert.alert(
        'Missing Information',
        'Please complete all fields.'
      );

      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

    setLoading(false);

    if (error) {
      Alert.alert(
        'Sign Up Failed',
        error.message
      );

      return;
    }

    Alert.alert(
      'Account Created',
      'Your account has been created successfully.',
      [
        {
          text: 'OK',
          onPress: () =>
            navigation.navigate('Login'),
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Create Account
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignUp}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading
            ? 'Creating Account...'
            : 'Create Account'}
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
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 30,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },

  button: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});