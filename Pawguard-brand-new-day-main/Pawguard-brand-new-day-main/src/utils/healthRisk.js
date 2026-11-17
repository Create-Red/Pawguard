// utils/healthRisk.js
// Decides LOW / MODERATE / HIGH risk from a reading.
// Each dog uses the limits of its breed's heat-risk level:
//   normal   -> e.g. Aspin, Labrador
//   elevated -> e.g. Golden Retriever, Great Dane
//   high     -> e.g. Pug, Shih Tzu, Bulldog
// Dogs with no breed picked use "normal".

const KEYS = [
  'moderate_surface_temp',
  'high_surface_temp',
  'low_surface_temp_moderate',
  'low_surface_temp_high',
  'moderate_humidity',
  'high_humidity',
  'low_humidity_moderate',
  'low_humidity_high',
];

export const RISK_TIERS = ['normal', 'elevated', 'high'];

// Used only if Supabase cannot be reached. Same as the SQL starting values.
export const DEFAULT_THRESHOLDS = {
  normal: {
    moderate_surface_temp: 39,
    high_surface_temp: 40,
    low_surface_temp_moderate: 36,
    low_surface_temp_high: 35,
    moderate_humidity: 70,
    high_humidity: 80,
    low_humidity_moderate: 45,
    low_humidity_high: 35,
  },
  elevated: {
    moderate_surface_temp: 38.5,
    high_surface_temp: 39.5,
    low_surface_temp_moderate: 36,
    low_surface_temp_high: 35,
    moderate_humidity: 65,
    high_humidity: 75,
    low_humidity_moderate: 45,
    low_humidity_high: 35,
  },
  high: {
    moderate_surface_temp: 38,
    high_surface_temp: 39,
    low_surface_temp_moderate: 36,
    low_surface_temp_high: 35,
    moderate_humidity: 60,
    high_humidity: 70,
    low_humidity_moderate: 45,
    low_humidity_high: 35,
  },
};

// Limits currently in use, per level
let activeThresholds = {
  normal: { ...DEFAULT_THRESHOLDS.normal },
  elevated: { ...DEFAULT_THRESHOLDS.elevated },
  high: { ...DEFAULT_THRESHOLDS.high },
};

// dog id -> 'normal' | 'elevated' | 'high'
const dogTiers = new Map();

const cleanTier = (tier) => (RISK_TIERS.includes(tier) ? tier : 'normal');

const cleanRow = (row, fallback) => {
  const out = {};
  for (const key of KEYS) {
    const value = Number(row?.[key]);
    out[key] = Number.isFinite(value) ? value : fallback[key];
  }
  return out;
};

// Accepts one row (old style) or a list of rows from alert_thresholds
export function setAlertThresholds(data) {
  if (!data) return;
  const rows = Array.isArray(data) ? data : [data];

  const next = {};
  for (const tier of RISK_TIERS) {
    const row = rows.find((r) => (r.risk_tier || 'normal') === tier);
    next[tier] = row
      ? cleanRow(row, DEFAULT_THRESHOLDS[tier])
      : { ...activeThresholds[tier] };
  }
  activeThresholds = next;
}

export function getAlertThresholds(tier = 'normal') {
  return activeThresholds[cleanTier(tier)];
}

// Remember a dog's level (e.g. right after it is loaded or edited)
export function rememberDogTier(dogId, tier) {
  if (dogId) dogTiers.set(dogId, cleanTier(tier));
}

export function getDogTier(dogId) {
  return dogTiers.get(dogId) || 'normal';
}

// Loads the limits for all levels, and the levels of the dogs this user can see.
export async function loadAlertThresholds(supabase) {
  const [limits, dogs] = await Promise.all([
    supabase.from('alert_thresholds').select('*'),
    supabase.from('dogs').select('id, breeds(risk_tier)'),
  ]);

  if (dogs.error) {
    console.error('Unable to load dog risk levels:', dogs.error.message);
  } else {
    (dogs.data || []).forEach((d) => rememberDogTier(d.id, d.breeds?.risk_tier));
  }

  if (limits.error) {
    console.error('Unable to load alert thresholds:', limits.error.message);
    return false;
  }

  setAlertThresholds(limits.data);
  return true;
}

// Calculate the dog's environmental risk level.
// tier is optional. If left out, it is taken from:
//   sensor.risk_tier -> the remembered level of sensor.dog_id -> 'normal'
export function calculateHealthRisk(sensor, tier) {
  if (!sensor) {
    return 'UNKNOWN';
  }

  const surfaceTemp = Number(sensor.surface_temp);
  const humidity = Number(sensor.humidity);

  if (
    sensor.surface_temp == null ||
    sensor.humidity == null ||
    !Number.isFinite(surfaceTemp) ||
    !Number.isFinite(humidity)
  ) {
    return 'UNKNOWN';
  }

  const level = cleanTier(
    tier || sensor.risk_tier || (sensor.dog_id ? getDogTier(sensor.dog_id) : 'normal')
  );
  const t = activeThresholds[level];

  // HIGH RISK
  if (
    surfaceTemp >= t.high_surface_temp ||
    surfaceTemp <= t.low_surface_temp_high ||
    humidity >= t.high_humidity ||
    humidity <= t.low_humidity_high
  ) {
    return 'HIGH';
  }

  // MODERATE RISK
  if (
    surfaceTemp >= t.moderate_surface_temp ||
    surfaceTemp <= t.low_surface_temp_moderate ||
    humidity >= t.moderate_humidity ||
    humidity <= t.low_humidity_moderate
  ) {
    return 'MODERATE';
  }

  // NORMAL
  return 'LOW';
}