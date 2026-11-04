const DEFAULT_THRESHOLDS = {
  moderate_surface_temp: 39,
  high_surface_temp: 40,
  low_surface_temp_moderate: 36,
  low_surface_temp_high: 35,
  moderate_humidity: 70,
  high_humidity: 80,
  low_humidity_moderate: 45,
  low_humidity_high: 35,
};

// Current thresholds used by the application.
let activeThresholds = { ...DEFAULT_THRESHOLDS };

// Update the thresholds using Supabase data.
export function setAlertThresholds(data) {
  if (!data) return;

  const updated = {};

  for (const key of Object.keys(DEFAULT_THRESHOLDS)) {
    const value = Number(data[key]);

    updated[key] = Number.isFinite(value)
      ? value
      : DEFAULT_THRESHOLDS[key];
  }

  activeThresholds = updated;
}

// Retrieve the saved thresholds from Supabase.
export async function loadAlertThresholds(supabase) {
  const { data, error } = await supabase
    .from('alert_thresholds')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('Unable to load alert thresholds:', error.message);
    return false;
  }

  setAlertThresholds(data);
  return true;
}

// Calculate the dog's environmental risk level.
export function calculateHealthRisk(sensor) {
  if (!sensor) {
    return 'UNKNOWN';
  }

  const surfaceTemp = Number(sensor.surface_temp);
  const humidity = Number(sensor.humidity);

  if (
    !Number.isFinite(surfaceTemp) ||
    !Number.isFinite(humidity)
  ) {
    return 'UNKNOWN';
  }

  const t = activeThresholds;

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