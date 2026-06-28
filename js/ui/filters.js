/**
 * filters.js — categorical multi-select dropdowns + infrastructure toggles.
 * Custom dropdowns (no library). Distinct values computed once from the seeded store.
 * Selecting narrows the view via pipeline.setFilter (instant; correct under streaming).
 */
import * as pipeline from '../core/pipeline.js';
import * as store from '../core/store.js';
import { FILTER_FIELDS, TOGGLE_FIELDS } from '../core/schema.js';
import { el, icon, on } from '../lib/dom.js';

let scheduleFrame = () => {}, onChange = () => {};
const controls = {}; // key -> control record

function distinct(key) {
  const s = store.slots(); const set = new Set();
  for (let i = 0; i < s.length; i++) { const r = s[i]; if (r) set.add(r[key]); }
  return Array.from(set).sort();
}

export function build(container, opts) {
  scheduleFrame = opts.scheduleFrame;
  onChange = opts.onChange || (() => {});
  for (const f of FILTER_FIELDS) container.appendChild(buildMulti(f));
  for (const t of TOGGLE_FIELDS) container.appendChild(buildToggle(t));
  // close any open panel on outside click / Esc
  on(document, 'click', closeAll);
  on(document, 'keydown', (e) => { if (e.key === 'Escape') closeAll(); });
}

function buildMulti(f) {
  const selected = new Set();
  const count = el('span', { class: 'fl-count' }, '');
  const btn = el('button', { class: 'fl-btn', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false' },
    icon('i-filter', 'fl-ic'), el('span', { class: 'fl-label' }, f.label), count, icon('i-chev', 'fl-caret'));
  const list = el('div', { class: 'fl-list', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': f.label });
  for (const v of distinct(f.key)) {
    const cb = el('input', { type: 'checkbox', value: v });
    const opt = el('label', { class: 'fl-opt', role: 'option' }, cb, el('span', { class: 'fl-opt-txt' }, v));
    on(cb, 'change', () => { cb.checked ? selected.add(v) : selected.delete(v); apply(); });
    list.appendChild(opt);
  }
  const clearBtn = el('button', { class: 'fl-clearbtn', type: 'button' }, 'Clear');
  const panel = el('div', { class: 'fl-panel', hidden: true },
    el('div', { class: 'fl-panel-head' }, el('span', {}, f.label), clearBtn), list);
  const wrap = el('div', { class: 'fl' }, btn, panel);
  on(clearBtn, 'click', () => { selected.clear(); list.querySelectorAll('input').forEach((c) => (c.checked = false)); apply(); });
  on(btn, 'click', (e) => { e.stopPropagation(); toggle(wrap, btn, panel); });
  on(panel, 'click', (e) => e.stopPropagation());

  function apply() {
    count.textContent = selected.size ? '· ' + selected.size : '';
    btn.classList.toggle('active', selected.size > 0);
    pipeline.setFilter(f.key, selected.size ? new Set(selected) : null);
    onChange(); scheduleFrame();
  }
  controls[f.key] = { type: 'multi', selected, btn, panel, wrap, count, list, apply };
  return wrap;
}

function buildToggle(t) {
  const valEl = el('span', { class: 'tg-val' }, 'All');
  const btn = el('button', { class: 'tg-btn', type: 'button', 'aria-label': t.label },
    el('span', { class: 'tg-label' }, t.label), valEl);
  let state = null; // null -> 'Yes' -> 'No' -> null
  function set(s) {
    state = s; valEl.textContent = s || 'All';
    btn.classList.toggle('active', s !== null);
    btn.dataset.state = s || '';
    btn.setAttribute('aria-label', t.label + ': ' + (s || 'All'));
    pipeline.setToggle(t.key, s); onChange(); scheduleFrame();
  }
  on(btn, 'click', () => set(state === null ? 'Yes' : state === 'Yes' ? 'No' : null));
  controls[t.key] = { type: 'toggle', btn, set, get state() { return state; } };
  return el('div', { class: 'tg' }, btn);
}

function toggle(wrap, btn, panel) {
  const willOpen = panel.hidden;
  closeAll();
  if (willOpen) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); wrap.classList.add('open'); }
}
function closeAll() {
  for (const k in controls) {
    const c = controls[k];
    if (c.panel) { c.panel.hidden = true; c.btn.setAttribute('aria-expanded', 'false'); c.wrap.classList.remove('open'); }
  }
}

export function clearAll() {
  for (const k in controls) {
    const c = controls[k];
    if (c.type === 'multi') { c.selected.clear(); c.list.querySelectorAll('input').forEach((x) => (x.checked = false)); c.apply(); }
    else c.set(null);
  }
}
