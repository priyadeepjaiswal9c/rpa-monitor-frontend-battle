/**
 * exportCsv.js — differentiator: export the CURRENT filtered+sorted view as CSV
 * (client-only Blob download — exporting the *derived* view, not the raw file).
 */
import { COLUMNS } from '../core/schema.js';
import * as store from '../core/store.js';
import * as pipeline from '../core/pipeline.js';

function esc(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function exportCurrentView() {
  const cols = COLUMNS;
  const n = pipeline.length();
  const lines = new Array(n + 1);
  lines[0] = cols.map((c) => c.key).join(',');
  for (let i = 0; i < n; i++) {
    const row = store.getSlot(pipeline.slotAt(i));
    const cells = new Array(cols.length);
    for (let j = 0; j < cols.length; j++) cells[j] = esc(row[cols[j].key]);
    lines[i + 1] = cells.join(',');
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rpa-view-' + n + '-rows.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return n;
}
