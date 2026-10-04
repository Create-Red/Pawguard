import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function RiskBadge({
  level = 'LOW',
}) {
  const normalized =
    level.toUpperCase();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        RISK LEVEL
      </Text>

      <Text style={styles.value}>
        {normalized}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginTop: 15,
  },

  label: {
    fontSize: 13,
    color: '#666',
  },

  value: {
    fontSize: 25,
    fontWeight: '800',
    marginTop: 5,
  },
});