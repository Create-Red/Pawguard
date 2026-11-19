// utils/walkSafety.js
// "Safe to walk?" from air temperature + humidity.
//
// 1. Heat index ("feels like") with the US National Weather Service formula
//    (Rothfusz regression + its standard adjustments).
// 2. Heat index -> Safe / Caution / Avoid, using PAGASA's heat index
//    categories (27-32 °C caution, 33-41 °C extreme caution, 42+ °C danger),
//    made stricter for breeds that overheat more easily.
//    PAGASA's categories are for people; the dog limits per breed level are a
//    team decision and should be checked with a vet.

export const WALK_LIMITS = {
  //          Caution from   Avoid from   (heat index, °C)
  normal: { caution: 33, avoid: 42 },
  elevated: { caution: 30, avoid: 39 },
  high: { caution: 27, avoid: 36 },
};

const toF = (c) => (c * 9) / 5 + 32;
const toC = (f) => ((f - 32) * 5) / 9;

// Air temperature (°C) + relative humidity (%) -> heat index (°C)
export function heatIndexC(tempC, humidity) {
  const T = toF(Number(tempC));
  const RH = Math.max(0, Math.min(100, Number(humidity)));
  if (!Number.isFinite(T) || !Number.isFinite(RH)) return null;

  // Simple formula first; NWS uses it when the result is below 80 °F
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + RH * 0.094);
  if ((simple + T) / 2 < 80) return toC(simple);

  let HI =
    -42.379 +
    2.04901523 * T +
    10.14333127 * RH -
    0.22475541 * T * RH -
    0.00683783 * T * T -
    0.05481717 * RH * RH +
    0.00122874 * T * T * RH +
    0.00085282 * T * RH * RH -
    0.00000199 * T * T * RH * RH;

  if (RH < 13 && T >= 80 && T <= 112) {
    HI -= ((13 - RH) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (RH > 85 && T >= 80 && T <= 87) {
    HI += ((RH - 85) / 10) * ((87 - T) / 5);
  }

  return toC(HI);
}

const TEXT = {
  SAFE: { title: 'Good to go', tip: 'Bring water' },
  CAUTION: { title: 'Take care', tip: 'Keep it short, stay in shade' },
  AVOID: { title: 'Not now', tip: 'Too hot, stay indoors' },
};

// Heat index + breed level -> { level, title, tip }
export function walkAdvice(heatIndex, tier = 'normal') {
  if (heatIndex === null || !Number.isFinite(heatIndex)) return null;
  const limits = WALK_LIMITS[tier] || WALK_LIMITS.normal;
  let level = 'SAFE';
  if (heatIndex >= limits.avoid) level = 'AVOID';
  else if (heatIndex >= limits.caution) level = 'CAUTION';
  return { level, ...TEXT[level] };
}

// ---- Weather (used when the collar is off) -------------------------------
// Open-Meteo: free, no API key. Cached for 10 minutes per place.
const cache = new Map();
const CACHE_MS = 10 * 60 * 1000;

export async function fetchWeather(latitude, longitude) {
  const key = `${Number(latitude).toFixed(2)},${Number(longitude).toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${latitude}&longitude=${longitude}` +
    '&current=temperature_2m,relative_humidity_2m' +
    '&hourly=temperature_2m,relative_humidity_2m' +
    '&forecast_days=2&timezone=auto';

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather error ${res.status}`);
  const json = await res.json();

  const hours = (json.hourly?.time || []).map((time, i) => ({
    time, // local time at that place, e.g. "2026-11-19T17:00"
    temp: json.hourly.temperature_2m[i],
    humidity: json.hourly.relative_humidity_2m[i],
  }));

  const data = {
    now: json.current
      ? {
          temp: json.current.temperature_2m,
          humidity: json.current.relative_humidity_2m,
          time: json.current.time,
        }
      : null,
    hours,
  };

  cache.set(key, { at: Date.now(), data });
  return data;
}

// Next hour (from now, within ~18 h) that is at least one level better.
// Returns { time: "2026-11-19T17:00", heatIndex } or null.
export function nextBetterHour(weather, tier, currentLevel) {
  if (!weather?.hours?.length || currentLevel === 'SAFE') return null;
  const rank = { SAFE: 0, CAUTION: 1, AVOID: 2 };
  const nowLocal = weather.now?.time || null; // same local clock as hours

  const upcoming = weather.hours
    .filter((h) => !nowLocal || h.time > nowLocal)
    .slice(0, 18);

  for (const h of upcoming) {
    const hi = heatIndexC(h.temp, h.humidity);
    const advice = walkAdvice(hi, tier);
    if (advice && rank[advice.level] < rank[currentLevel]) {
      return { time: h.time, heatIndex: hi, level: advice.level };
    }
  }
  return null;
}

// "2026-11-19T17:00" -> "5 PM" (today) or "Tomorrow 6 AM"
export function formatHour(localIso, todayIso) {
  if (!localIso) return '';
  const [date, time] = localIso.split('T');
  const hour = Number(time?.slice(0, 2));
  if (!Number.isFinite(hour)) return '';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const label = `${h12} ${hour < 12 ? 'AM' : 'PM'}`;
  const today = (todayIso || '').split('T')[0];
  return today && date !== today ? `Tomorrow ${label}` : label;
}