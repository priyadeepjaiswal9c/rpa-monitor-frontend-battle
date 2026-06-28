/**
 * format.js — financial & numeric value formatting.
 *
 * Constructing Intl formatters is expensive, so we create ONE instance per format at
 * module scope and call .format() in hot paths — zero per-cell allocation, no GC sawtooth.
 */

const EMPTY = '—';

const nfInt   = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nfCur   = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const nfCompact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

/** One shared collator for all string sorting (per-call localeCompare is a CPU/alloc hog). */
export const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Grouped integer, e.g. 1,274,060. Guards NaN/undefined → em dash (prevents raw "NaN" leakage). */
export function int(n) {
  return Number.isFinite(n) ? nfInt.format(n) : EMPTY;
}

/** Locale currency with commas, e.g. $9,557,239. */
export function currency(n) {
  return Number.isFinite(n) ? nfCur.format(n) : EMPTY;
}

/** Compact for KPI counters / chart labels, e.g. 22.38M. */
export function compact(n) {
  return Number.isFinite(n) ? nfCompact.format(n) : EMPTY;
}

/** roi_percent: clamp to a sane band and round to exactly 2 decimals. */
export function percent(n) {
  if (!Number.isFinite(n)) return EMPTY;
  const c = n < -9999.99 ? -9999.99 : n > 9999.99 ? 9999.99 : n;
  return c.toFixed(2) + '%';
}

/** Yes/No → readable badge text; anything else passes through or em-dash. */
export function bool(v) {
  if (v === 'Yes' || v === true) return 'Yes';
  if (v === 'No' || v === false) return 'No';
  return v || EMPTY;
}

/** completion_date is empty for Active projects → human label. */
export function dateOr(v, fallback = EMPTY) {
  return v && v.length ? v : fallback;
}

/** Safe number coercion (stream delivers numerics as strings). */
export function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export { EMPTY };
