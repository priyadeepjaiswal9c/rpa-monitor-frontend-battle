/**
 * searchBar.js — multi-token fuzzy search input.
 * Input is rAF-coalesced (not debounced) — the in-memory scan is fast, so debounce would
 * only add artificial latency. Bursts within a frame collapse to one recompute.
 */
import * as pipeline from '../core/pipeline.js';
import { el, icon, on } from '../lib/dom.js';

let input, scheduleFrame = () => {}, onChange = () => {}, raf = 0;

export function build(container, opts) {
  scheduleFrame = opts.scheduleFrame;
  onChange = opts.onChange || (() => {});
  input = el('input', {
    type: 'search', class: 'search-input', autocomplete: 'off', spellcheck: 'false',
    'aria-label': 'Fuzzy search projects', placeholder: 'Search  ·  e.g. "tata fin completed cloud"',
  });
  const clear = el('button', { class: 'search-clear', 'aria-label': 'Clear search', type: 'button' },
    icon('i-x', 'ic-sm'));
  on(clear, 'click', () => { input.value = ''; apply(); input.focus(); });
  on(input, 'input', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; apply(); }); });
  const wrap = el('div', { class: 'search' }, icon('i-search', 'search-ic'), input, clear);
  container.appendChild(wrap);
  return input;
}

function apply() {
  pipeline.setQuery(input.value);
  onChange();
  scheduleFrame();
}

export const setValue = (v) => { if (input) input.value = v || ''; };
export const getValue = () => (input ? input.value : '');
export const focusInput = () => input && input.focus();
