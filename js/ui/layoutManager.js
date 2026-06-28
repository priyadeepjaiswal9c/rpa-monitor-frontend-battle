/**
 * layoutManager.js — operator workspace layout persistence.
 * Show/hide panels (KPIs, Department chart, Performance HUD) via a "View" menu;
 * persists visibility to localStorage and restores before paint (survives hard refresh).
 */
import * as persist from '../lib/persist.js';
import { el, icon, on } from '../lib/dom.js';

const KEY = 'layout.v1';
const panels = []; // {id, label, node, def}
let saved = {};
let menuBtn, menuPanel;
let onToggleCb = null;

export function register(id, label, node, def = true) { panels.push({ id, label, node, def }); }

function visible(p) { return saved[p.id] !== undefined ? saved[p.id] : p.def; }
function apply(p) { p.node.hidden = !visible(p); }

export function restore() {
  saved = persist.get(KEY, {});
  for (const p of panels) apply(p);
}

export function toggle(id) {
  const p = panels.find((x) => x.id === id); if (!p) return;
  saved[id] = !visible(p);
  persist.set(KEY, saved);
  apply(p);
  syncMenu();
  if (onToggleCb) onToggleCb(id, visible(p));
}
export const isVisible = (id) => { const p = panels.find((x) => x.id === id); return p ? visible(p) : true; };

export function buildMenu(container, opts) {
  onToggleCb = opts && opts.onToggle;
  menuBtn = el('button', { class: 'btn btn-ghost', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false' },
    icon('i-columns', 'btn-ic'), el('span', {}, 'View'));
  menuPanel = el('div', { class: 'menu-panel', hidden: true, role: 'menu' });
  for (const p of panels) {
    const cb = el('input', { type: 'checkbox', checked: visible(p) });
    const row = el('label', { class: 'menu-row', role: 'menuitemcheckbox' }, cb, el('span', {}, p.label));
    on(cb, 'change', () => toggle(p.id));
    menuPanel.appendChild(row);
    p._cb = cb;
  }
  on(menuBtn, 'click', (e) => { e.stopPropagation(); const open = menuPanel.hidden; closeMenu(); if (open) { menuPanel.hidden = false; menuBtn.setAttribute('aria-expanded', 'true'); } });
  on(menuPanel, 'click', (e) => e.stopPropagation());
  on(document, 'click', closeMenu);
  on(document, 'keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  container.append(menuBtn, menuPanel);
}
function closeMenu() { if (menuPanel) { menuPanel.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } }
function syncMenu() { for (const p of panels) if (p._cb) p._cb.checked = visible(p); }
