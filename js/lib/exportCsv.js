/**
 * exportCsv.js — Snapshot Export: serialize the current view (filters + keyword search +
 * multi-column sort) to a downloadable CSV, entirely client-side.
 *
 * Built in time-sliced chunks that yield to the event loop between batches, so the live
 * stream and the render loop keep running — the export never freezes ongoing operations,
 * even when serializing the full 50,000-row view.
 */
import { COLUMNS } from '../core/schema.js';
import * as store from '../core/store.js';
import * as pipeline from '../core/pipeline.js';

const CHUNK = 4000;

function esc(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Serialize + download the current view. Returns the row count.
 * Yields every CHUNK rows so no single task blocks the main thread.
 */
export async function exportCurrentView(onProgress) {
  const cols = COLUMNS;
  const n = pipeline.length();
  const lines = new Array(n + 1);
  lines[0] = cols.map((c) => c.key).join(',');

  for (let i = 0; i < n; i += CHUNK) {
    const end = Math.min(n, i + CHUNK);
    for (let j = i; j < end; j++) {
      const row = store.getSlot(pipeline.slotAt(j)); // pipeline order = filters + search + sort
      const cells = new Array(cols.length);
      for (let k = 0; k < cols.length; k++) cells[k] = esc(row[cols[k].key]);
      lines[j + 1] = cells.join(',');
    }
    if (onProgress) onProgress(end, n);
    if (end < n) await new Promise((r) => setTimeout(r)); // yield — keep stream + rAF alive
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.href = url;
  a.download = 'rpa-snapshot-' + n + '-rows-' + stamp + '.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return n;
}
