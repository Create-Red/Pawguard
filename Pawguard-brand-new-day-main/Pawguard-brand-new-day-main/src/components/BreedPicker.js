// components/BreedPicker.js
// Breed field + searchable list. Each breed shows its heat-risk level.
//
// Usage:
//   <BreedPicker
//     valueId={breedId}            // selected breed id (or null)
//     legacyName={breedText}       // old free-text breed, shown until a breed is picked
//     onChange={(breed) => { setBreedId(breed.id); setBreedName(breed.name); }}
//   />

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Icon from './Icon';
import { supabase } from '../config/supabase';
import { colors, fonts, tones } from '../Theme';

// Loaded once per app session
let breedCache = null;

export const RISK_STYLE = {
  normal: { tone: 'green', label: 'Normal' },
  elevated: { tone: 'amber', label: 'Elevated' },
  high: { tone: 'salmon', label: 'High' },
};

const SKULL_LABEL = {
  brachycephalic: 'Flat-faced',
  mesocephalic: 'Medium muzzle',
  dolichocephalic: 'Long muzzle',
};

const COAT_LABEL = {
  short: 'short coat',
  long: 'long coat',
  double: 'double coat',
  curly: 'curly coat',
  wire: 'wire coat',
};

export function RiskPill({ tier, small }) {
  const s = RISK_STYLE[tier] || RISK_STYLE.normal;
  const tone = tones[s.tone];
  return (
    <View
      style={[
        styles.pill,
        small && styles.pillSmall,
        { backgroundColor: tone.pill },
      ]}
    >
      <Text style={[styles.pillText, small && styles.pillTextSmall, { color: tone.pillText }]}>
        {s.label}
      </Text>
    </View>
  );
}

export async function loadBreeds() {
  if (breedCache) return breedCache;

  const { data, error } = await supabase
    .from('breeds')
    .select('id, name, skull_shape, coat_type, size, risk_tier, basis, note, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  breedCache = data || [];
  return breedCache;
}

export default function BreedPicker({ valueId, legacyName, onChange, disabled }) {
  const insets = useSafeAreaInsets();

  const [breeds, setBreeds] = useState(breedCache || []);
  const [loading, setLoading] = useState(!breedCache);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    loadBreeds()
      .then((list) => active && setBreeds(list))
      .catch((e) => active && setLoadError(e.message || 'Could not load breeds.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selected = breeds.find((b) => b.id === valueId) || null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return breeds;
    return breeds.filter((b) => b.name.toLowerCase().includes(q));
  }, [breeds, search]);

  const pick = (breed) => {
    onChange?.(breed);
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      {/* The field */}
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.field}
        onPress={() => setOpen(true)}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={`Breed: ${selected?.name || legacyName || 'not chosen'}. Tap to choose`}
      >
        <Text style={styles.fieldLabel}>Breed</Text>
        <View style={styles.fieldRow}>
          <Text
            style={[styles.fieldValue, !selected && !legacyName && styles.placeholder]}
            numberOfLines={1}
          >
            {loading ? 'Loading…' : selected?.name || legacyName || 'Choose breed'}
          </Text>
          {selected ? (
            <RiskPill tier={selected.risk_tier} small />
          ) : (
            <Icon name="chevron-down" size={18} color={colors.muted} />
          )}
        </View>
      </TouchableOpacity>

      {!selected && !!legacyName && !loading && (
        <Text style={styles.hint}>Pick from the list so PawGuard can set the heat-risk level.</Text>
      )}
      {!!loadError && <Text style={styles.errorText}>{loadError}</Text>}

      {/* The list */}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={[styles.sheet, { paddingTop: Platform.OS === 'android' ? insets.top + 12 : 16 }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choose breed</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={styles.sheetDone}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.search}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search breeds"
              placeholderTextColor={colors.muted}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={10}>
                <Icon name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.ink} style={styles.loader} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(b) => b.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
              renderItem={({ item, index }) => {
                const active = item.id === valueId;
                return (
                  <TouchableOpacity
                    style={[styles.row, index === filtered.length - 1 && styles.rowLast]}
                    onPress={() => pick(item)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowName}>{item.name}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {SKULL_LABEL[item.skull_shape]} · {COAT_LABEL[item.coat_type]} · {item.size}
                      </Text>
                    </View>
                    <RiskPill tier={item.risk_tier} small />
                    <View style={styles.check}>
                      {active && <Icon name="checkmark" size={18} color={colors.ink} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <TouchableOpacity
                  style={styles.emptyRow}
                  onPress={() => {
                    const other = breeds.find((b) => b.name === 'Other / not listed');
                    if (other) pick(other);
                  }}
                >
                  <Text style={styles.emptyText}>No match. Use "Other / not listed"</Text>
                </TouchableOpacity>
              }
              ListFooterComponent={
                <Text style={styles.footnote}>
                  Heat-risk level is based on Hall, Carter & O'Neill (2020), a study of
                  over 900,000 UK dogs. Flat-faced, heavy and some double-coated breeds
                  get earlier alerts. Breeds marked by our team are still to be verified.
                </Text>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Field (matches the tile inputs)
  field: {
    backgroundColor: colors.tile,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.tileLabel,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: Platform.OS === 'ios' ? 34 : 30,
  },
  fieldValue: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  placeholder: { color: colors.muted },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: tones.amber.pillText,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
    paddingHorizontal: 4,
  },

  // Risk pill
  pill: { paddingHorizontal: 12, height: 26, borderRadius: 13, justifyContent: 'center' },
  pillSmall: { paddingHorizontal: 10, height: 22, borderRadius: 11 },
  pillText: { fontFamily: fonts.medium, fontSize: 12, letterSpacing: 0.3 },
  pillTextSmall: { fontSize: 11 },

  // Sheet
  sheet: { flex: 1, backgroundColor: colors.white, paddingHorizontal: 20 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sheetTitle: { fontFamily: fonts.medium, fontSize: 24, color: colors.ink },
  sheetDone: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 16,
    backgroundColor: colors.tile,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 0,
  },
  loader: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1 },
  rowName: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  rowMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  check: { width: 20, alignItems: 'center' },
  emptyRow: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 8,
  },
});