/**
 * pipeline.js — F4/F7/F9/F10: the derived-view engine.
 *
 * Owns the current filter/search/sort inputs and derives `index` (a Uint32Array of
 * slots) in view order. CRITICAL for the 50-pt axis: recompute runs ONLY on user
 * input — never on a 200ms stream tick. The real columns don't drift, so the index
 * stays valid across the firehose; a live value repaints a cell IN PLACE and the row
 * never moves (satisfies "sorted order persists as the stream injects" with zero
 * per-tick sorting). Prefix-narrowing scans the previous result set when the query
 * strictly extends.
 */

import { makeComparator } from '../lib/multiSort.js';
import { tokenize, matches } from '../lib/fuzzy.js';
import { FILTER_FIELDS, TOGGLE_FIELDS } from './schema.js';
import * as store from './store.js';

let filters = Object.create(null); // key -> Set(allowed) | null
let toggles = Object.create(null); // key -> 'Yes'|'No'|null
let query = '';
let tokens = [];
let sortKeys = []; // [{key, dir:'asc'|'desc'}]

let index = new Uint32Array(0);
let version = 0;

// prefix-narrowing cache
let lastQuery = '';
let lastIndex = null;

function invalidatePrefix() { lastQuery = ''; lastIndex = null; }

function passesFacets(row) {
  for (let i = 0; i < FILTER_FIELDS.length; i++) {
    const set = filters[FILTER_FIELDS[i].key];
    if (set && !set.has(row[FILTER_FIELDS[i].key])) return false;
  }
  for (let i = 0; i < TOGGLE_FIELDS.length; i++) {
    const v = toggles[TOGGLE_FIELDS[i].key];
    if (v && row[TOGGLE_FIELDS[i].key] !== v) return false;
  }
  return true;
}

export function recompute() {
  const slotArr = store.slots();
  const n = store.size();
  const out = [];

  // Prefix-narrowing: if the query strictly extends the previous one (facets
  // unchanged), survivors are a subset → scan only the previous result set.
  const extending = lastIndex && query.length > lastQuery.length && query.startsWith(lastQuery);
  if (extending) {
    for (let i = 0; i < lastIndex.length; i++) {
      const s = lastIndex[i];
      const row = slotArr[s];
      if (matches(tokens, row._hay)) out.push(s); // facets already satisfied in lastIndex
    }
  } else {
    const hasTokens = tokens.length > 0;
    for (let s = 0; s < n; s++) {
      const row = slotArr[s];
      if (!row) continue;
      if (!passesFacets(row)) continue;
      if (hasTokens && !matches(tokens, row._hay)) continue;
      out.push(s);
    }
  }

  let arr = Uint32Array.from(out);
  if (sortKeys.length) arr.sort(makeComparator(sortKeys, slotArr));
  index = arr;
  lastQuery = query;
  lastIndex = index;
  version++;
  return index;
}

// ---- input setters (each triggers exactly one recompute) ----
export function setQuery(q) { query = q; tokens = tokenize(q); recompute(); }
export function setFilter(key, set) { filters[key] = set && set.size ? set : null; invalidatePrefix(); recompute(); }
export function setToggle(key, val) { toggles[key] = val || null; invalidatePrefix(); recompute(); }
export function setSort(keys) { sortKeys = keys; invalidatePrefix(); recompute(); }
export function clearAll() {
  filters = Object.create(null); toggles = Object.create(null);
  query = ''; tokens = []; sortKeys = []; invalidatePrefix(); recompute();
}

// ---- read API for the grid/controls ----
export const length = () => index.length;
export const slotAt = (i) => index[i];
export const getVersion = () => version;
export const getSort = () => sortKeys;
export const getFilters = () => filters;
export const getToggles = () => toggles;
export const getQuery = () => query;
export const isFiltered = () =>
  tokens.length > 0 ||
  FILTER_FIELDS.some((f) => filters[f.key]) ||
  TOGGLE_FIELDS.some((t) => toggles[t.key]);
