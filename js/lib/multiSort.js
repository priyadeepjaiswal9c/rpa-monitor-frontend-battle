/**
 * multiSort.js — stable single + compound (shift-click) sort comparator.
 *
 * Returns a STABLE compound comparator over slot indices. Stability is guaranteed by
 * an explicit `a - b` (original load order) tiebreak, so equal keys never reshuffle
 * frame-to-frame and the order is deterministic regardless of engine sort stability.
 * Numeric columns compare row.num[key]; string columns use the shared Intl.Collator.
 */

import { collator } from '../core/format.js';
import { COL_BY_KEY } from '../core/schema.js';

export function makeComparator(sortKeys, slotArr) {
  const specs = sortKeys.map((s) => ({
    key: s.key,
    asc: s.dir !== 'desc',
    numeric: (COL_BY_KEY[s.key] && COL_BY_KEY[s.key].sortType === 'num'),
  }));
  const n = specs.length;
  return function (a, b) {
    const ra = slotArr[a], rb = slotArr[b];
    for (let i = 0; i < n; i++) {
      const sp = specs[i];
      let r;
      if (sp.numeric) r = ra.num[sp.key] - rb.num[sp.key];
      else r = collator.compare(ra[sp.key] || '', rb[sp.key] || '');
      if (r) return sp.asc ? r : -r;
    }
    return a - b; // stable, deterministic tiebreak
  };
}
