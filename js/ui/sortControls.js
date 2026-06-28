/**
 * sortControls.js — F4 (single) + F9 (compound, shift-click).
 *   click        → sort by this column; toggles asc → desc → off
 *   shift-click  → add/cycle this column as an additional sort key (priority badges)
 * Delegates the math to pipeline (stable compound comparator) and refreshes header carets.
 */
import * as pipeline from '../core/pipeline.js';
import * as grid from './virtualGrid.js';

let sortKeys = [];
let scheduleFrame = () => {}, onChange = () => {};

export function init(opts) {
  scheduleFrame = opts.scheduleFrame;
  onChange = opts.onChange || (() => {});
}

export function handle(key, shift) {
  const i = sortKeys.findIndex((s) => s.key === key);
  if (shift) {
    if (i === -1) sortKeys.push({ key, dir: 'asc' });
    else if (sortKeys[i].dir === 'asc') sortKeys[i].dir = 'desc';
    else sortKeys.splice(i, 1); // third shift-click removes this key
  } else {
    if (i === -1 || sortKeys.length > 1) sortKeys = [{ key, dir: 'asc' }];
    else if (sortKeys[i].dir === 'asc') sortKeys = [{ key, dir: 'desc' }];
    else sortKeys = []; // third click clears
  }
  apply();
}

export function set(keys) { sortKeys = Array.isArray(keys) ? keys : []; apply(); }
export const get = () => sortKeys;

function apply() {
  pipeline.setSort(sortKeys);
  grid.refreshSort(sortKeys);
  onChange();
  scheduleFrame();
}
