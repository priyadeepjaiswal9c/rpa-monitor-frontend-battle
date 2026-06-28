/**
 * pauseBuffer.js — Pause/Play with lossless, memory-bounded buffering.
 *
 * An append-only queue would be lossless but unbounded — pausing for minutes at
 * 50 rows/200ms would accumulate millions of entries and bloat the heap. Instead we
 * coalesce by uid into a Map<uid, latestRow>: bounded by the dataset (≤ 50k) regardless
 * of pause duration, and lossless in the sense that matters (a snapshot grid shows the
 * latest value per row). KPIs still accrue for every captured event (via store.accrueKpis),
 * and scalar counters track sequence/volume for the overlay.
 */

import * as store from './store.js';

let paused = false;
let buffer = new Map();      // uid -> latest sanitized row (coalesced)
let eventsCaptured = 0;      // total rows seen while paused (volume, not distinct)
let batchesCaptured = 0;     // total ticks seen while paused

export const isPaused = () => paused;
export const pendingRows = () => buffer.size;
export const eventCount = () => eventsCaptured;
export const batchCount = () => batchesCaptured;

export function pause() { paused = true; }

/** Called by main loop while paused: KPIs accrue now; row state is coalesced for later. */
export function capture(batch) {
  store.accrueKpis(batch); // every received row still counts toward the KPI totals immediately
  for (let i = 0; i < batch.length; i++) buffer.set(batch[i].internal_uid, batch[i]);
  eventsCaptured += batch.length;
  batchesCaptured++;
}

/** Resume: flush coalesced state into the store (one repaint), no record dropped. */
export function resume() {
  paused = false;
  const distinct = buffer.size;
  if (distinct) {
    store.flushRows(Array.from(buffer.values()));
    buffer.clear(); // clear() reuses backing store (no GC churn vs reassignment)
  }
  const summary = { distinct, events: eventsCaptured, batches: batchesCaptured };
  eventsCaptured = 0;
  batchesCaptured = 0;
  return summary;
}
