import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import Ionicons from '@expo/vector-icons/Ionicons';

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
    if (!profile?.id) {
      setLoading(false);
      return;
    }

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
    // Update the UI immediately, then save to Supabase
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    await supabase
      .from('notifications')
      .update({
        is_read: true,
      })
      .eq('id', id);
  }

  async function deleteNotification(id) {
    // Remove from the screen immediately
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) {
      Alert.alert('Could not delete', error.message);
      loadNotifications(); // restore the real list
    }
  }

  function confirmClearAll() {
    Alert.alert(
      'Clear all notifications?',
      'This will permanently remove all of your notifications.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all',
          style: 'destructive',
          onPress: clearAll,
        },
      ]
    );
  }

  async function clearAll() {
    setNotifications([]);

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', profile.id);

    if (error) {
      Alert.alert('Could not clear', error.message);
      loadNotifications();
    }
  }

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [profile?.id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>
          Notifications
        </Text>

        {notifications.length > 0 && (
          <TouchableOpacity onPress={confirmClearAll}>
            <Text style={styles.clearAll}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <Text style={styles.empty}>
          No notifications yet.
        </Text>
      ) : (
        notifications.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            style={[
              styles.card,
              !item.is_read &&
                styles.unread,
            ]}
            onPress={() =>
              markAsRead(item.id)
            }
          >
            <View style={styles.cardBody}>
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
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => deleteNotification(item.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Delete notification"
            >
              <Ionicons name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
  },

  clearAll: {
    color: '#ef4444',
    fontWeight: '700',
    fontSize: 14,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },

  cardBody: {
    flex: 1,
    paddingRight: 8,
  },

  closeButton: {
    padding: 2,
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