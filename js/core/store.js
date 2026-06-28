/**
 * store.js — the single source of truth.
 *
 * Memory discipline (the 50-pt axis):
 *  - rows: Map<uid,row> bounded by the fixed uid universe (≤ 50k); updated IN PLACE.
 *  - slotArr: dense Array for O(1) slot access (slot = uid number - 1).
 *  - KPI accumulators are scalars; the sparkline ring buffer is bounded (60 samples).
 *  - No append-only history anywhere.
 *
 * The store NEVER touches the DOM. Stream ticks mutate state + flag dirty/received;
 * a single rAF (owned by main.js) is the only thing that paints.
 */

const rows = new Map();
let slotArr = [];
let N = 0;

const kpi = { streamed: 0, robots: 0, savings: 0, lastTickRows: 0 };

// uids touched since last frame (rebind if visible) and received this tick (flash).
let dirty = new Set();
let received = new Set();

// Bounded ring buffer of {streamed, robots, savings} samples for KPI sparklines.
const RING = 64;
const ring = [];

export function uidToSlot(uid) {
  // uid format: "uid-row-<n>" (n is 1-based); "uid-row-" is 8 chars.
  return ((parseInt(uid.slice(8), 10) | 0) - 1);
}

/** Seed the full baseline (parsed CSV). Builds the Map + dense slot array. */
export function seed(arr) {
  rows.clear();
  N = arr.length;
  slotArr = new Array(N);
  for (const r of arr) {
    const slot = uidToSlot(r.internal_uid);
    rows.set(r.internal_uid, r);
    if (slot >= 0 && slot < N) slotArr[slot] = r;
  }
  return N;
}

export const size = () => N;
export const getSlot = (s) => slotArr[s];
export const getUid = (uid) => rows.get(uid);
export const slots = () => slotArr;

/** Update one row's mutable state in place + flag for repaint. No KPI change. */
function updateRow(r) {
  const uid = r.internal_uid;
  const ex = rows.get(uid);
  if (ex) {
    // Refresh the numeric shadow in place (preserves cached _hay identity).
    ex.num = r.num;
    // Defensive: refresh fields that could change (status, roi sign for F3).
    ex.project_status = r.project_status;
    ex.roi_percent = r.roi_percent;
    ex._fmt = null; // invalidate lazy format cache for this row-version
  } else {
    const slot = uidToSlot(uid);
    rows.set(uid, r);
    if (slot >= 0) { slotArr[slot] = r; if (slot + 1 > N) N = slot + 1; }
  }
  dirty.add(uid);
  received.add(uid);
}

/** F1: cumulative KPI accumulators over EVERY received row (even while paused). */
export function accrueKpis(batch) {
  for (let i = 0; i < batch.length; i++) {
    kpi.robots += batch[i].num.robots_deployed;
    kpi.savings += batch[i].num.annual_savings_usd;
  }
  kpi.streamed += batch.length;
  kpi.lastTickRows = batch.length;
}

/** Apply coalesced row state to the store + repaint flags. No KPI change (used on resume flush). */
export function flushRows(batch) {
  for (let i = 0; i < batch.length; i++) updateRow(batch[i]);
}

/** Live path: KPIs + row state + repaint flags in one pass. */
export function applyBatch(batch) {
  accrueKpis(batch);
  for (let i = 0; i < batch.length; i++) updateRow(batch[i]);
}

export const kpis = () => kpi;

/** Sample current KPIs into the bounded ring (called ~1/sec for sparklines). */
export function sampleRing() {
  ring.push({ streamed: kpi.streamed, robots: kpi.robots, savings: kpi.savings });
  if (ring.length > RING) ring.shift();
}
export const ringFor = (key) => ring.map((s) => s[key]);

/** Frame consumes the received set (for flash); a fresh set starts accumulating. */
export function takeReceived() { const r = received; received = new Set(); return r; }
export const peekReceived = () => received;
export function takeDirty() { const d = dirty; dirty = new Set(); return d; }

/** Demo/QA only (F3): flag a row as a synthetic alert in the VIEW copy. */
export function flagDemoAlert(uid) {
  const r = rows.get(uid);
  if (r) { r._demoAlert = true; r._fmt = null; dirty.add(uid); }
}
export function clearDemoAlert(uid) {
  const r = rows.get(uid);
  if (r) { r._demoAlert = false; r._fmt = null; dirty.add(uid); }
}
