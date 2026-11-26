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

const ERASED = 'Details removed (account deleted)';

// Friendly names for fields stored in log details
const FIELD_LABELS = {
  name: 'Name',
  breed: 'Breed',
  age: 'Age',
  weight_kg: 'Weight (kg)',
  venue: 'Venue',
  starts_at: 'Starts',
  ends_at: 'Ends',
  status: 'Status',
  device_uid: 'Collar ID',
  role: 'Role',
  risk_tier: 'Risk group',
  is_archived: 'Archived',
  checked_in_at: 'Checked in',
  photo_url: 'Photo',
  avatar_url: 'Profile photo',
  vet_phone: 'Vet number',
  dog_id: 'Paired pet',
  owner_id: 'Owner',
  organizer_id: 'Organizer',
  max_temp: 'Max temperature',
  max_heart_rate: 'Max heart rate',
  max_humidity: 'Max humidity',
  privacy_version: 'Privacy notice version',
  privacy_accepted_at: 'Privacy accepted',
};

const labelFor = (key) =>
  FIELD_LABELS[key] ||
  key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const isId = (key) => key === 'id' || key.endsWith('_id');
const isTime = (key) => key.endsWith('_at');

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === '') return 'none';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key.endsWith('_url')) return 'photo';
  if (isTime(key)) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).replace(/_/g, ' ');
};

// details -> [{ label, text }]
//   UPDATE:        { field: { from, to } }  -> "8 → 9.5"
//   INSERT/DELETE: { field: value }         -> "Bantay"
const detailLines = (log) => {
  const d = log.details;
  if (!d || typeof d !== 'object') return [];
  return Object.entries(d).map(([key, value]) => {
    const isChange = value && typeof value === 'object' && ('from' in value || 'to' in value);
    if (isChange) {
      if (isId(key)) {
        const text = value.to == null ? 'removed' : value.from == null ? 'set' : 'changed';
        return { key, label: labelFor(key), text };
      }
      return {
        key,
        label: labelFor(key),
        text: `${formatValue(key, value.from)}  →  ${formatValue(key, value.to)}`,
      };
    }
    return { key, label: labelFor(key), text: formatValue(key, value) };
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
      [
        log.summary,
        log.table_name,
        log.action,
        log.profiles?.name,
        log.details ? JSON.stringify(log.details) : null,
      ].some((v) => v?.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  });

  const renderLog = ({ item, index }) => {
    const a = ACTION_STYLE[item.action] || DEFAULT_ACTION;
    const tone = tones[a.tone];
    const open = expandedId === item.id;
    const erased = item.summary === ERASED;
    const lines = erased ? [] : detailLines(item);
    const actor = item.profiles?.name || (erased ? 'Deleted user' : 'System');

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
            {erased && (
              <View style={[styles.pill, { backgroundColor: tones.beige.pill }]}>
                <Text style={[styles.pillText, { color: tones.beige.pillText }]}>
                  Erased
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.summary, erased && styles.summaryErased]}
            numberOfLines={open ? undefined : 2}
          >
            {erased
              ? 'Details removed because the account was deleted'
              : item.summary || `${a.label} in ${prettyTable(item.table_name).toLowerCase()}`}
          </Text>

          <Text style={styles.meta} numberOfLines={1}>
            {actor}  ·  {timeAgo(item.created_at)}
          </Text>

          {open && (
            <View style={styles.details}>
              {erased ? (
                <Text style={styles.detailNote}>
                  This user deleted their account, so their name and details were removed
                  (Data Privacy Act). Only the action and time are kept.
                </Text>
              ) : lines.length > 0 ? (
                <>
                  <Text style={styles.detailHeading}>
                    {item.action === 'UPDATE' ? 'What changed' : 'Details'}
                  </Text>
                  {lines.map((l) => (
                    <View key={l.key} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{l.label}</Text>
                      <Text style={styles.detailValue}>{l.text}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.detailNote}>No extra details for this activity.</Text>
              )}

              <View style={styles.detailFooter}>
                <Text style={styles.detailText}>
                  {item.created_at
                    ? new Date(item.created_at).toLocaleString()
                    : 'Unknown date'}
                </Text>
                {!!item.record_id && (
                  <Text style={styles.detailText} numberOfLines={1}>
                    Record ID: {item.record_id}
                  </Text>
                )}
              </View>
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
  summaryErased: { fontStyle: 'italic', color: colors.muted, opacity: 1 },
  detailHeading: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, marginBottom: 4 },
  detailRow: { flexDirection: 'row', gap: 10, paddingVertical: 2 },
  detailLabel: { width: 110, fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  detailValue: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  detailNote: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.ink },
  detailFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: 2,
  },

  emptyText: {
    fontFamily: fonts.regular,
    color: colors.muted,
    textAlign: 'center',
    padding: 24,
  },
});