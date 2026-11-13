import React, { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';

import Icon from '../../components/Icon';
import { supabase } from '../../config/supabase';
import { colors, fonts, tones } from '../../Theme';

// Action -> pastel tone + icon
const ACTION_STYLE = {
  INSERT: { tone: 'green', icon: 'add-circle', label: 'Created' },
  UPDATE: { tone: 'brand', icon: 'create', label: 'Updated' },
  DELETE: { tone: 'salmon', icon: 'trash', label: 'Deleted' },
};
const DEFAULT_ACTION = { tone: 'beige', icon: 'ellipse', label: 'Activity' };

const FILTERS = [
  { key: 'ALL', label: 'all' },
  { key: 'INSERT', label: 'created' },
  { key: 'UPDATE', label: 'updated' },
  { key: 'DELETE', label: 'deleted' },
];

const timeAgo = (value) => {
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return 'Unknown date';
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

// "event_members" -> "Event members"
const prettyTable = (name) => {
  const text = (name || 'unknown').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default function SystemLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);

    const { data, error } = await supabase
      .from('system_logs')
      .select(`
        *,
        profiles!system_logs_actor_id_fkey (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) console.error('System logs error:', error.message);
    else setLogs(data || []);

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  const query = search.toLowerCase().trim();
  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filter === 'ALL' || log.action === filter;
    const matchesSearch =
      !query ||
      [log.summary, log.table_name, log.action, log.profiles?.name].some((v) =>
        v?.toLowerCase().includes(query)
      );
    return matchesFilter && matchesSearch;
  });

  const renderLog = ({ item, index }) => {
    const a = ACTION_STYLE[item.action] || DEFAULT_ACTION;
    const tone = tones[a.tone];
    const open = expandedId === item.id;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpandedId(open ? null : item.id)}
        style={[
          styles.row,
          index === filteredLogs.length - 1 && styles.rowLast,
        ]}
      >
        <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
          <Icon name={a.icon} size={18} color={tone.text} />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.table} numberOfLines={1}>
              {prettyTable(item.table_name)}
            </Text>
            <View style={[styles.pill, { backgroundColor: tone.pill }]}>
              <Text style={[styles.pillText, { color: tone.pillText }]}>
                {a.label}
              </Text>
            </View>
          </View>

          <Text style={styles.summary} numberOfLines={open ? undefined : 2}>
            {item.summary || 'No description'}
          </Text>

          <Text style={styles.meta} numberOfLines={1}>
            {item.profiles?.name || 'System'}  ·  {timeAgo(item.created_at)}
          </Text>

          {open && (
            <View style={styles.details}>
              <Text style={styles.detailText}>
                Record ID: {item.record_id || 'N/A'}
              </Text>
              <Text style={styles.detailText}>
                {item.created_at
                  ? new Date(item.created_at).toLocaleString()
                  : 'Unknown date'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>System logs</Text>
        <Text style={styles.subtitle}>
          Latest {logs.length} activities. Tap one for details.
        </Text>

        <View style={[styles.search, searchFocused && styles.searchFocused]}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search activity, table or user"
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <FlatList
        data={filteredLogs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderLog}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.ink}
            colors={[colors.ink]}
            onRefresh={() => loadLogs({ pull: true })}
          />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No activities found.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },

  header: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontFamily: fonts.medium, fontSize: 28, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 4 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 16,
    backgroundColor: colors.tile,
    borderWidth: 2,
    borderColor: 'transparent',
    marginTop: 18,
  },
  searchFocused: { borderColor: colors.accent },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
  },

  chips: { flexDirection: 'row', gap: 8, marginTop: 14, marginBottom: 8 },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.onAccent },

  list: { paddingHorizontal: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  table: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  pill: { paddingHorizontal: 10, height: 24, borderRadius: 12, justifyContent: 'center' },
  pillText: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.3 },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    opacity: 0.85,
    marginTop: 4,
  },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 6 },
  details: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.tile,
    gap: 4,
  },
  detailText: { fontFamily: fonts.regular, fontSize: 12, color: colors.tileLabel },

  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },
});