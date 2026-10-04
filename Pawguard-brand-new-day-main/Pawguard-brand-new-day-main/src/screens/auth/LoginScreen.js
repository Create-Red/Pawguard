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

export default function LoginScreen({
  navigation,
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password.'
      );

      return;
    }

    setLoading(true);

    const { error } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    setLoading(false);

    if (error) {
      Alert.alert(
        'Login Failed',
        error.message
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>
        PAWGUARD
      </Text>

      <Text style={styles.subtitle}>
        Smart Pet Health Monitoring
      </Text>

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
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          navigation.navigate('SignUp')
        }
      >
        <Text style={styles.signup}>
          Don't have an account? Sign Up
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

  logo: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },

  subtitle: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 35,
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

  signup: {
    textAlign: 'center',
    marginTop: 20,
  },
});