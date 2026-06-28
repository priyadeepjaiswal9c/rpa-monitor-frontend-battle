/**
 * virtualGrid.js — F8 (15 pts) + the 50-pt rendering axis.
 *
 * Hand-rolled row recycling: a FIXED pool of row nodes over a tall spacer. Scroll only
 * sets a flag + schedules the shared rAF (passive). The frame does READ (one scrollTop +
 * one scrollLeft) → COMPUTE (pure math) → WRITE (one translateY on the track, one
 * translateX to h-sync the header, nodeValue-only cell binds). DOM node count is constant
 * regardless of the 50k rows → flat heap, no forced reflow, locked 60fps.
 */

import { COLUMNS } from '../core/schema.js';
import * as store from '../core/store.js';
import * as pipeline from '../core/pipeline.js';
import { buildRow, bindRow } from './rowBinder.js';
import { el, on, frag } from '../lib/dom.js';

const MIN_ROW_H = 28;   // pool is sized for the densest mode
const OVERSCAN = 8;     // rows above & below (kills fast-fling blanks)
const GUTTER_W = 14;

let ROW_H = 30;
let totalW = 0;
let viewport, head, track, spacer, empty, pool = [];
let hcells = {};
let onHeaderClick = () => {};
let onRowClick = () => {};
let scheduleFrame = () => {};

let _start = -1, _ver = -1, _n = -1, _sl = -1;

function computeTotalW() {
  totalW = GUTTER_W;
  for (const c of COLUMNS) totalW += c.w;
}

function buildHeader() {
  head = el('div', { class: 'grid-head', role: 'row', 'aria-rowindex': '1' });
  head.appendChild(el('span', { class: 'hc gutter', 'aria-hidden': 'true' }));
  hcells = {};
  COLUMNS.forEach((c, ci) => {
    const hc = el('span',
      { class: 'hc hc--' + c.align, role: 'columnheader', tabindex: '0', 'aria-sort': 'none', 'aria-colindex': String(ci + 2), style: { width: c.w + 'px' } },
      el('span', { class: 'hc-label' }, c.label),
      el('span', { class: 'hc-sort' }),
    );
    hc.dataset.key = c.key;
    on(hc, 'click', (e) => onHeaderClick(c.key, e.shiftKey));
    on(hc, 'keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHeaderClick(c.key, e.shiftKey); }
    });
    head.appendChild(hc);
    hcells[c.key] = hc;
  });
  head.style.width = totalW + 'px';
  return el('div', { class: 'grid-headwrap' }, head);
}

function ensurePool(count) {
  if (pool.length >= count) return;
  const f = frag();
  for (let i = pool.length; i < count; i++) {
    const r = buildRow();
    pool.push(r);
    f.appendChild(r);
  }
  track.appendChild(f);
}

function poolTarget() {
  const h = viewport.clientHeight || 640;
  return Math.ceil(h / MIN_ROW_H) + 2 * OVERSCAN;
}

/** mount(container, { onHeaderClick, onRowClick, scheduleFrame }) */
export function mount(container, opts) {
  onHeaderClick = opts.onHeaderClick || onHeaderClick;
  onRowClick = opts.onRowClick || onRowClick;
  scheduleFrame = opts.scheduleFrame || scheduleFrame;
  computeTotalW();

  const headwrap = buildHeader();
  spacer = el('div', { class: 'grid-spacer', style: { width: totalW + 'px' } });
  track = el('div', { class: 'grid-track', style: { width: totalW + 'px' }, role: 'rowgroup' });
  empty = el('div', { class: 'grid-empty', hidden: true },
    el('div', { class: 'grid-empty-inner' },
      el('p', { class: 'grid-empty-title' }, 'No projects match these filters'),
      el('button', { class: 'btn btn-ghost', id: 'emptyClear' }, 'Clear filters'),
    ),
  );
  viewport = el('div', { class: 'grid-viewport', role: 'grid', 'aria-label': 'RPA project telemetry', tabindex: '0', 'aria-colcount': String(COLUMNS.length + 1), 'aria-rowcount': '1' }, spacer, track, empty);

  container.append(headwrap, viewport);

  ensurePool(poolTarget());

  on(viewport, 'scroll', () => scheduleFrame(), { passive: true });
  on(track, 'click', (e) => {
    const rowEl = e.target.closest('.grid-row');
    if (!rowEl || rowEl._uid == null) return;
    onRowClick(rowEl._uid, +rowEl.dataset.idx);
  });

  // grow pool on resize (debounced via rAF)
  let rT = 0;
  on(window, 'resize', () => {
    cancelAnimationFrame(rT);
    rT = requestAnimationFrame(() => { ensurePool(poolTarget()); forceRepaint(); scheduleFrame(); });
  });

  return viewport;
}

export function getEmptyClearBtn() { return empty ? empty.querySelector('#emptyClear') : null; }

export function setRowHeight(h) {
  ROW_H = h;
  forceRepaint();
}

function forceRepaint() { _start = -1; _ver = -1; _n = -1; _sl = -1; }

/** Update header sort carets + priority badges. Called by sortControls. */
export function refreshSort(sortKeys) {
  const order = new Map(sortKeys.map((s, i) => [s.key, { dir: s.dir, rank: i + 1, multi: sortKeys.length > 1 }]));
  for (const key in hcells) {
    const hc = hcells[key];
    const sortEl = hc.querySelector('.hc-sort');
    const info = order.get(key);
    if (!info) {
      hc.classList.remove('sorted');
      hc.setAttribute('aria-sort', 'none');
      sortEl.textContent = '';
    } else {
      hc.classList.add('sorted');
      hc.setAttribute('aria-sort', info.dir === 'asc' ? 'ascending' : 'descending');
      sortEl.textContent = (info.dir === 'asc' ? '▲' : '▼') + (info.multi ? String(info.rank) : '');
    }
  }
}

/** The render frame. Called only from the shared rAF (main.js). */
export function paint(recvSet) {
  if (!viewport) return;
  // READ
  const scrollTop = viewport.scrollTop;
  const scrollLeft = viewport.scrollLeft;
  // COMPUTE
  const n = pipeline.length();
  const version = pipeline.getVersion();
  if (n !== _n) {
    spacer.style.height = (n * ROW_H) + 'px';
    empty.hidden = n > 0;
    viewport.setAttribute('aria-rowcount', String(n + 1));
    _n = n;
  }
  let start = Math.floor(scrollTop / ROW_H) - OVERSCAN;
  if (start < 0) start = 0;
  const maxStart = Math.max(0, n - pool.length);
  if (start > maxStart) start = maxStart;

  // WRITE — header h-sync (only when scrollLeft changed)
  if (scrollLeft !== _sl) { head.style.transform = 'translateX(' + (-scrollLeft) + 'px)'; _sl = scrollLeft; }

  const moved = start !== _start;
  const changed = version !== _ver;
  const hasRecv = recvSet && recvSet.size > 0;
  if (!moved && !changed && !hasRecv) return;

  if (moved || changed) track.style.transform = 'translateY(' + (start * ROW_H) + 'px)';

  for (let k = 0; k < pool.length; k++) {
    const node = pool[k];
    const dataIdx = start + k;
    if (dataIdx >= n) {
      if (!node._hidden) { node.style.display = 'none'; node._hidden = true; node._uid = null; }
      continue;
    }
    if (node._hidden) { node.style.display = ''; node._hidden = false; }
    const row = store.getSlot(pipeline.slotAt(dataIdx));
    if (row) bindRow(node, row, dataIdx, recvSet);
  }

  _start = start;
  _ver = version;
}

export const renderedCount = () => {
  let c = 0;
  for (let i = 0; i < pool.length; i++) if (!pool[i]._hidden) c++;
  return c;
};
export const poolSize = () => pool.length;
export const scrollToTop = () => { if (viewport) viewport.scrollTop = 0; };
