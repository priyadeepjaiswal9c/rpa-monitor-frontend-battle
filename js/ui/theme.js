/**
 * theme.js — light/dark theme toggle.
 * Initial theme is set by an inline <head> script (no FOUC); this module owns the
 * toggle button, persistence, the color-scheme / theme-color meta updates, and a
 * change callback (used to repaint the canvas chart, which bakes colors).
 */
import * as persist from '../lib/persist.js';
import { el, icon, on } from '../lib/dom.js';

let btn, btnUse, onChange = () => {};

const current = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

function syncBtn(theme) {
  if (btnUse) btnUse.setAttribute('href', theme === 'light' ? '#i-moon' : '#i-sun');
  if (btn) btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  persist.set('theme', theme);
  const cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.content = theme;
  const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = theme === 'light' ? '#EEF1F4' : '#0B0F14';
  syncBtn(theme);
  onChange(theme);
}

export function toggle() { apply(current() === 'light' ? 'dark' : 'light'); }

export function build(container, opts) {
  onChange = (opts && opts.onChange) || (() => {});
  const ico = icon(current() === 'light' ? 'i-moon' : 'i-sun', 'btn-ic');
  btnUse = ico.querySelector('use');
  btn = el('button', { class: 'btn btn-ghost', type: 'button', title: 'Toggle light / dark theme' }, ico);
  on(btn, 'click', toggle);
  syncBtn(current());
  container.appendChild(btn);
}

export const get = current;
