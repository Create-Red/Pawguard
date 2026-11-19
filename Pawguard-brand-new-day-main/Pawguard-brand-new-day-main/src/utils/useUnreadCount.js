// utils/useUnreadCount.js
// Number of unread notifications for the badge on the Alerts tab.
// Updates:
//   * right away when a notification arrives or is read (Realtime)
//   * right away when the Alerts screen marks/deletes (refreshUnreadCount)
//   * when the app comes back to the foreground
//   * every 30 s as a fallback in case Realtime drops

import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from '../config/supabase';

const REFRESH_MS = 30 * 1000;

// Screens can ask every badge to reload (e.g. after "Mark all as read")
const listeners = new Set();
export function refreshUnreadCount() {
  listeners.forEach((fn) => fn());
}

export default function useUnreadCount(userId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return undefined;
    }

    let active = true;

    const load = async () => {
      const { count: c, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (active && !error) setCount(c || 0);
    };

    load();
    listeners.add(load);

    // Unique name each time: Supabase reuses a channel with the same name, and
    // the old one may still be closing (e.g. after a quick re-render), which
    // throws "cannot add postgres_changes callbacks ... after subscribe()".
    const channel = supabase
      .channel(`unread-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        load
      )
      .subscribe();

    const timer = setInterval(load, REFRESH_MS);

    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });

    return () => {
      active = false;
      listeners.delete(load);
      clearInterval(timer);
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return count;
}