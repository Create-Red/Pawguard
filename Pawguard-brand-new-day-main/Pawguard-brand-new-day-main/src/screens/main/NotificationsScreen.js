import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { colors, fonts, tones } from '../../Theme';

// Notification type -> pastel tone + icon. Unknown types fall back to brand.
const TYPE_STYLE = {
  HIGH_RISK: { tone: 'salmon', icon: 'warning', label: 'High risk' },
  MODERATE_RISK: { tone: 'amber', icon: 'alert-circle', label: 'Moderate risk' },
  DEVICE_OFFLINE: { tone: 'beige', icon: 'cloud-offline', label: 'Device offline' },
};
const DEFAULT_STYLE = { tone: 'brand', icon: 'notifications', label: 'PawGuard' };

const styleFor = (type) => {
  const s = TYPE_STYLE[type] || DEFAULT_STYLE;
  return { ...s, colors: tones[s.tone] || tones.brand };
};

// Same coarse wording as the dashboard ("Just now", "5 min ago"...).
const timeAgo = (value) => {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return '';
  const sec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(ms).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function NotificationsScreen() {
  const { profile } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function loadNotifications({ pull = false } = {}) {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    if (pull) setRefreshing(true);

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        dogs (
          name
        )
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error) setNotifications(data || []);

    setLoading(false);
    setRefreshing(false);
  }

  async function markAsRead(id) {
    // Update the UI immediately, then save to Supabase
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );

    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }

  async function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);

    if (error) {
      Alert.alert('Could not update', error.message);
      loadNotifications();
    }
  }

  async function deleteNotification(id) {
    // Remove from the screen immediately
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    const { error } = await supabase.from('notifications').delete().eq('id', id);

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
        { text: 'Clear all', style: 'destructive', onPress: clearAll },
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

  // Silent refresh on focus (spinner only on the very first load)
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [profile?.id])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        notifications.length === 0 && styles.contentEmpty,
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.ink}
          colors={[colors.ink]}
          onRefresh={() => loadNotifications({ pull: true })}
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            {unreadCount > 0
              ? `${unreadCount} unread`
              : notifications.length > 0
              ? 'All caught up'
              : ' '}
          </Text>
        </View>
      </View>

      {notifications.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionChip, unreadCount === 0 && styles.dimmed]}
            onPress={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <Ionicons name="checkmark-done" size={16} color={colors.ink} />
            <Text style={styles.actionText}>Mark all read</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionChip} onPress={confirmClearAll}>
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.actionText, { color: colors.danger }]}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: tones.brand.bg }]}>
            <Ionicons
              name="notifications-outline"
              size={38}
              color={tones.brand.text}
            />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyText}>
            Health alerts and device updates will show up here.
          </Text>
        </View>
      ) : (
        notifications.map((item) => {
          const s = styleFor(item.type);
          const unread = !item.is_read;

          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.85}
              style={[
                styles.card,
                { backgroundColor: unread ? s.colors.bg : colors.tile },
              ]}
              onPress={() => unread && markAsRead(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`${unread ? 'Unread. ' : ''}${
                item.message || 'PawGuard notification'
              }`}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: unread
                      ? 'rgba(255,255,255,0.6)'
                      : colors.white,
                  },
                ]}
              >
                <Ionicons
                  name={s.icon}
                  size={20}
                  color={unread ? s.colors.text : colors.muted}
                />
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text
                    style={[
                      styles.typeLabel,
                      { color: unread ? s.colors.sub : colors.muted },
                    ]}
                    numberOfLines={1}
                  >
                    {s.label}
                    {item.dogs?.name ? `  •  ${item.dogs.name}` : ''}
                  </Text>
                  {unread && (
                    <View
                      style={[styles.dot, { backgroundColor: s.colors.text }]}
                    />
                  )}
                </View>

                <Text
                  style={[
                    styles.message,
                    unread
                      ? { color: s.colors.text, fontFamily: fonts.medium }
                      : { color: colors.ink },
                  ]}
                >
                  {item.message || 'PawGuard notification'}
                </Text>

                <Text
                  style={[
                    styles.date,
                    { color: unread ? s.colors.sub : colors.muted },
                  ]}
                >
                  {timeAgo(item.created_at)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => deleteNotification(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Delete notification"
              >
                <Ionicons
                  name="close"
                  size={16}
                  color={unread ? s.colors.text : colors.muted}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 120,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 28,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    marginTop: 4,
  },

  // Action chips
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 18,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  actionText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.ink,
  },
  dimmed: {
    opacity: 0.5,
  },

  // Notification card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    borderRadius: 24,
    padding: 16,
    marginBottom: 10,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeLabel: {
    flexShrink: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 4,
  },
  date: {
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 8,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingBottom: 60,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontFamily: fonts.medium,
    fontSize: 22,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
    color: colors.muted,
  },
});