
import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../config/supabase';

export default function SystemLogsScreen() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

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

    if (error) {
      console.error('System logs error:', error.message);
    } else {
      setLogs(data || []);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  const filters = ['ALL', 'INSERT', 'UPDATE', 'DELETE'];

  const filteredLogs = logs.filter((log) => {
    const matchesFilter =
      filter === 'ALL' || log.action === filter;

    const query = search.toLowerCase().trim();

    const matchesSearch = [
      log.summary,
      log.table_name,
      log.action,
      log.profiles?.name,
    ].some((value) =>
      value?.toLowerCase().includes(query)
    );

    return matchesFilter && matchesSearch;
  });

  const getActionColor = (action) => {
    switch (action) {
      case 'INSERT':
        return '#059669';
      case 'UPDATE':
        return '#2563EB';
      case 'DELETE':
        return '#DC2626';
      default:
        return '#64748B';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => loadLogs(true)}
        />
      }
    >
      <Text style={styles.title}>System Logs</Text>

      <Text style={styles.subtitle}>
        Review important activities recorded in PawGuard.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>
          Retrieved Activities
        </Text>
        <Text style={styles.summaryValue}>
          {logs.length}
        </Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search activity, table, or user..."
        placeholderTextColor="#94A3B8"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
      />

      <View style={styles.filters}>
        {filters.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.filterButton,
              filter === item && styles.activeFilter,
            ]}
            onPress={() => setFilter(item)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.activeFilterText,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#2563EB"
          style={{ marginTop: 30 }}
        />
      ) : filteredLogs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No activities found.
          </Text>
        </View>
      ) : (
        filteredLogs.map((log) => (
          <View key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.tableName}>
                {log.table_name}
              </Text>

              <View
                style={[
                  styles.actionBadge,
                  {
                    backgroundColor: getActionColor(log.action),
                  },
                ]}
              >
                <Text style={styles.actionText}>
                  {log.action}
                </Text>
              </View>
            </View>

            <Text style={styles.description}>
              {log.summary}
            </Text>

            <Text style={styles.detail}>
              User: {log.profiles?.name || 'System / Unknown'}
            </Text>

            <Text style={styles.detail}>
              Record ID: {log.record_id || 'N/A'}
            </Text>

            <Text style={styles.date}>
              {log.created_at
                ? new Date(log.created_at).toLocaleString()
                : 'Unknown date'}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#172033',
  },
  subtitle: {
    color: '#687386',
    marginTop: 6,
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 15,
    marginTop: 20,
    marginBottom: 18,
  },
  summaryLabel: {
    color: '#687386',
    fontSize: 13,
  },
  summaryValue: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 5,
    color: '#172033',
  },
  search: {
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    color: '#172033',
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  activeFilter: {
    backgroundColor: '#2563EB',
  },
  filterText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    padding: 17,
    borderRadius: 14,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172033',
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
    color: '#475569',
    marginTop: 12,
  },
  detail: {
    fontSize: 12,
    color: '#687386',
    marginTop: 7,
  },
  date: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 12,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#687386',
  },
});
