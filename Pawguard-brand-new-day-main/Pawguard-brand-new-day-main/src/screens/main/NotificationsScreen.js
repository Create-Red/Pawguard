import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

export default function NotificationsScreen() {
  const { profile } = useAuth();

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [loading, setLoading] = useState(true);

  async function loadNotifications() {
    setLoading(true);

    const {
      data,
      error,
    } = await supabase
      .from('notifications')
      .select(`
        *,
        dogs (
          name
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', {
        ascending: false,
      });

    if (!error) {
      setNotifications(data || []);
    }

    setLoading(false);
  }

  async function markAsRead(id) {
    await supabase
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq('id', id);

    loadNotifications();
  }

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [profile.id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        Notifications
      </Text>

      {notifications.length === 0 ? (
        <Text style={styles.empty}>
          No notifications yet.
        </Text>
      ) : (
        notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.card,
              !item.is_read &&
                styles.unread,
            ]}
            onPress={() =>
              markAsRead(item.id)
            }
          >
            <Text style={styles.message}>
              {item.message ||
                'PawGuard notification'}
            </Text>

            {item.dogs?.name && (
              <Text style={styles.dog}>
                Pet: {item.dogs.name}
              </Text>
            )}

            <Text style={styles.date}>
              {new Date(
                item.created_at
              ).toLocaleString()}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },

  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },

  unread: {
    borderWidth: 1,
  },

  message: {
    fontSize: 16,
    fontWeight: '600',
  },

  dog: {
    marginTop: 6,
    color: '#555',
  },

  date: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
  },

  empty: {
    color: '#666',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});