// utils/healthRisk.js
// Decides LOW / MODERATE / HIGH risk from a reading.
// Each dog uses the limits of its breed's heat-risk level:
//   normal   -> e.g. Aspin, Labrador
//   elevated -> e.g. Golden Retriever, Great Dane
//   high     -> e.g. Pug, Shih Tzu, Bulldog
// Dogs with no breed picked use "normal".
//
// Rules (same as the server, supabase_dog_heat_alerts.sql). The collar's
// own readings decide the risk:
//   Too hot   = collar surface at/above the limits
//               (skin close to core temperature = the dog can't shed heat)
//   Too humid = humidity >= moderate_humidity (80 %): panting stops cooling.
//               Moderate on its own, High if the collar surface is also warm.
//   Too cold  = air temperature at/below the limits
//   Humidity below the limit and dry air don't change the level.

const KEYS = [
  'moderate_surface_temp', // collar surface: "too hot"
  'high_surface_temp',
  'moderate_humidity', // "too humid" limit (panting stops working)
  'low_ambient_temp_moderate', // "too cold" uses the AIR temperature
  'low_ambient_temp_high',
];

export const RISK_TIERS = ['normal', 'elevated', 'high'];

// Used only if Supabase cannot be reached. Same as the SQL values.
export const DEFAULT_THRESHOLDS = {
  normal: {
    moderate_surface_temp: 37,
    high_surface_temp: 40,
    moderate_humidity: 80,
    low_ambient_temp_moderate: 7,
    low_ambient_temp_high: 0,
  },
  elevated: {
    moderate_surface_temp: 37,
    high_surface_temp: 39.5,
    moderate_humidity: 80,
    low_ambient_temp_moderate: 7,
    low_ambient_temp_high: 0,
  },
  high: {
    moderate_surface_temp: 37,
    high_surface_temp: 39,
    moderate_humidity: 80,
    low_ambient_temp_moderate: 7,
    low_ambient_temp_high: 0,
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

const num = (v) => (v == null || v === '' ? NaN : Number(v));

// Everything the rules need from one reading
function evaluate(sensor, tier) {
  const surface = num(sensor.surface_temp);
  const humidity = num(sensor.humidity);
  const air = num(sensor.ambient_temp);

  const level = cleanTier(
    tier || sensor.risk_tier || (sensor.dog_id ? getDogTier(sensor.dog_id) : 'normal')
  );
  const t = activeThresholds[level];
  const at = (v, limit) => Number.isFinite(v) && v >= limit; // missing value = false
  const below = (v, limit) => Number.isFinite(v) && v <= limit;

  return {
    known: Number.isFinite(surface) || Number.isFinite(humidity) || Number.isFinite(air),
    hotHigh: at(surface, t.high_surface_temp),
    warm: at(surface, t.moderate_surface_temp),
    humid: at(humidity, t.moderate_humidity),
    coldHigh: below(air, t.low_ambient_temp_high),
    coldModerate: below(air, t.low_ambient_temp_moderate),
  };
}

// Calculate the dog's environmental risk level.
// tier is optional. If left out, it is taken from:
//   sensor.risk_tier -> the remembered level of sensor.dog_id -> 'normal'
export function calculateHealthRisk(sensor, tier) {
  if (!sensor) return 'UNKNOWN';
  const e = evaluate(sensor, tier);
  if (!e.known) return 'UNKNOWN';

  let lvl = 0;
  if (e.hotHigh || e.coldHigh) lvl = 2;
  else if (e.warm || e.coldModerate) lvl = 1;

  // Very humid air: panting can't cool the dog (High if it is also warm)
  if (e.humid) lvl = Math.max(lvl, e.warm ? 2 : 1);

  return ['LOW', 'MODERATE', 'HIGH'][lvl];
}

// Why is the dog at risk? Returns e.g. ['too hot', 'too humid'], or [] if fine.
export function getRiskReasons(sensor, tier) {
  const level = calculateHealthRisk(sensor, tier);
  if (level !== 'HIGH' && level !== 'MODERATE') return [];
  const e = evaluate(sensor, tier);
  const reasons = [];
  if (e.warm) reasons.push('too hot');
  if (e.humid) reasons.push('too humid');
  if (e.coldModerate) reasons.push('too cold');
  return reasons;
}

// ['too hot', 'too humid'] -> "Too hot & humid" (short, for status pills)
export function formatRiskReasons(reasons) {
  if (!reasons || reasons.length === 0) return '';
  return reasons
    .map((r, i) => (i === 0 ? r : r.replace('too ', '')))
    .join(' & ')
    .replace(/^t/, 'T');
}