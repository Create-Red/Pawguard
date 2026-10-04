import React from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function SensorCard({
  title,
  value,
  unit,
  icon,
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>
        {icon}
      </Text>

      <Text style={styles.title}>
        {title}
      </Text>

      <View style={styles.valueRow}>
        <Text style={styles.value}>
          {value}
        </Text>

        <Text style={styles.unit}>
          {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flex: 1,
  },

  icon: {
    fontSize: 24,
    marginBottom: 8,
  },

  title: {
    fontSize: 13,
    color: '#666',
  },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },

  value: {
    fontSize: 25,
    fontWeight: '800',
  },

  unit: {
    marginLeft: 4,
    color: '#666',
  },
});