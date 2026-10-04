export function calculateHealthRisk(sensor) {
  if (!sensor) {
    return 'UNKNOWN';
  }

  const surfaceTemp = Number(sensor.surface_temp);
  const ambientTemp = Number(sensor.ambient_temp);
  const humidity = Number(sensor.humidity);

  // HIGH RISK
  if (
    surfaceTemp >= 40 ||
    surfaceTemp <= 35 ||
    humidity >= 80 ||
    humidity <= 35
  ) {
    return 'HIGH';
  }

  // MODERATE RISK
  if (
    surfaceTemp >= 39 ||
    surfaceTemp <= 36 ||
    humidity >= 70 ||
    humidity <= 45
  ) {
    return 'MODERATE';
  }

  // NORMAL
  return 'LOW';
}