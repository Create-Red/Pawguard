// utils/eventReportPdf.js
// Builds the printable HTML for the after-event report, and saves/shares
// it as a PDF.
// Needs: npx expo install expo-print expo-sharing

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const toDate = (v) => {
  if (!v) return null;
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(v);
  const d = new Date(hasZone ? v : `${v}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDateTime = (v) => {
  const d = toDate(v);
  return d
    ? d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '--';
};

export const fmtTime = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--';
};

const num = (v, d = 1) => {
  const n = Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? '--' : n.toFixed(d);
};

// Numbers the screen and the PDF both show
export function summarize(report) {
  const dogs = report?.dogs || [];
  const alerts = report?.alerts || [];
  const hottest = dogs.reduce(
    (best, d) =>
      d.max_surface != null && (!best || Number(d.max_surface) > Number(best.max_surface)) ? d : best,
    null
  );
  return {
    joined: dogs.length,
    checkedIn: dogs.filter((d) => d.checked_in_at).length,
    alerts: alerts.length,
    highAlerts: alerts.filter((a) => String(a.type).includes('HIGH')).length,
    hottest,
    wentOffline: dogs.filter((d) => Number(d.offline_times) > 0).length,
    noData: dogs.filter((d) => !Number(d.readings)).length,
  };
}

const ALERT_WORD = { HIGH_RISK: 'High risk', MODERATE_RISK: 'Moderate risk' };

export function buildReportHtml(report) {
  const e = report.event || {};
  const s = summarize(report);
  const dogs = report.dogs || [];
  const alerts = report.alerts || [];

  const dogRows = dogs
    .map((d) => {
      const risk = Number(d.high) > 0 ? 'high' : Number(d.moderate) > 0 ? 'mod' : 'low';
      return `<tr>
        <td><b>${esc(d.dog_name)}</b><br><span class="muted">${esc(d.breed || 'Breed not set')} · ${esc(d.owner_name || '')}</span></td>
        <td>${d.checked_in_at ? 'Yes, ' + esc(fmtTime(d.checked_in_at)) : '<span class="muted">No</span>'}</td>
        <td class="num ${risk}">${d.max_surface != null ? num(d.max_surface) + ' °C' : '--'}<br><span class="muted">${d.max_at ? esc(fmtTime(d.max_at)) : ''}</span></td>
        <td class="num">${Number(d.alerts) || 0}</td>
        <td class="num">${Number(d.offline_times) ? `${d.offline_times}× (${d.offline_minutes} min)` : (Number(d.readings) ? 'No' : 'No data')}</td>
      </tr>`;
    })
    .join('');

  const alertRows = alerts.length
    ? alerts
        .map(
          (a) => `<tr>
        <td>${esc(fmtTime(a.t))}</td>
        <td>${esc(a.dog_name)}</td>
        <td class="${String(a.type).includes('HIGH') ? 'high' : 'mod'}">${esc(ALERT_WORD[a.type] || 'Alert')}${a.reason ? ' · ' + esc(a.reason) : ''}</td>
        <td class="num">${a.surface != null ? num(a.surface) + ' °C' : '--'}</td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="4" class="muted">No alerts during the event.</td></tr>';

  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2f2d29; font-size: 11pt; }
  h1 { font-size: 20pt; margin: 0 0 4px; }
  h2 { font-size: 13pt; margin: 22px 0 8px; border-bottom: 1px solid #e3ded5; padding-bottom: 4px; }
  .muted { color: #8a857c; font-size: 9.5pt; }
  .meta { color: #6b665e; margin-bottom: 14px; }
  .tiles { display: flex; gap: 10px; }
  .tile { flex: 1; background: #f4f1ec; border-radius: 10px; padding: 10px 12px; }
  .tile .k { font-size: 9pt; color: #8a857c; }
  .tile .v { font-size: 17pt; font-weight: 600; margin-top: 2px; }
  .tile .s { font-size: 9pt; color: #6b665e; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9pt; color: #8a857c; font-weight: 500; padding: 6px 6px; border-bottom: 1px solid #e3ded5; }
  td { padding: 7px 6px; border-bottom: 1px solid #f0ece5; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .high { color: #c4513b; font-weight: 600; }
  .mod { color: #b07d1e; font-weight: 600; }
  .low { color: #2f2d29; }
  .foot { margin-top: 24px; font-size: 8.5pt; color: #8a857c; }
</style></head>
<body>
  <h1>${esc(e.name)} — Event report</h1>
  <div class="meta">${esc(fmtDateTime(e.starts_at))} to ${esc(fmtTime(e.ends_at))}${e.venue ? ' · ' + esc(e.venue) : ''}</div>

  <div class="tiles">
    <div class="tile"><div class="k">Dogs joined</div><div class="v">${s.joined}</div><div class="s">approved</div></div>
    <div class="tile"><div class="k">Checked in</div><div class="v">${s.checkedIn}/${s.joined}</div><div class="s">arrived at venue</div></div>
    <div class="tile"><div class="k">Alerts</div><div class="v">${s.alerts}</div><div class="s">${s.highAlerts} high risk</div></div>
    <div class="tile"><div class="k">Hottest</div><div class="v">${s.hottest ? num(s.hottest.max_surface) + ' °C' : '--'}</div><div class="s">${s.hottest ? esc(s.hottest.dog_name) + ', ' + esc(fmtTime(s.hottest.max_at)) : ''}</div></div>
  </div>

  <h2>Dogs</h2>
  <table>
    <tr><th>Dog</th><th>Checked in</th><th class="num">Hottest</th><th class="num">Alerts</th><th class="num">Went offline</th></tr>
    ${dogRows || '<tr><td colspan="5" class="muted">No approved dogs.</td></tr>'}
  </table>

  <h2>Alerts during the event</h2>
  <table>
    <tr><th>Time</th><th>Dog</th><th>Alert</th><th class="num">Surface</th></tr>
    ${alertRows}
  </table>

  <div class="foot">
    Generated by PawGuard on ${esc(fmtDateTime(report.generated_at))}.
    Temperatures are collar surface readings. "Went offline" counts gaps of 3 minutes or more
    with no data from the collar. Risk levels use each breed's alert limits.
  </div>
</body></html>`;
}

// Creates the PDF and opens the share sheet (Save to Files, email, Messenger...)
export async function shareReportPdf(report) {
  const html = buildReportHtml(report);
  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `${report.event?.name || 'Event'} report`,
    });
  }
  return uri;
}