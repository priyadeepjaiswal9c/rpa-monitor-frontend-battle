/**
 * commandPalette.js — ⌘K / Ctrl-K command palette.
 * Roll-your-own listbox with roving keyboard nav (Up/Down/Enter/Esc), ARIA roles.
 * Commands are supplied by main as [{ label, hint, run }].
 */
import { el, on } from '../lib/dom.js';

let root, input, list, commands = [], filtered = [], active = 0, open = false, lastFocus = null;

export function build(cmds) {
  commands = cmds;
  input = el('input', { class: 'cmd-input', type: 'text', placeholder: 'Type a command…', 'aria-label': 'Command palette', autocomplete: 'off', spellcheck: 'false' });
  list = el('div', { class: 'cmd-list', role: 'listbox', 'aria-label': 'Commands' });
  const box = el('div', { class: 'cmd-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' },
    el('div', { class: 'cmd-inputwrap' }, input), list);
  const backdrop = el('div', { class: 'cmd-backdrop' });
  root = el('div', { class: 'cmd', hidden: true }, backdrop, box);
  document.body.appendChild(root);

  on(backdrop, 'click', close);
  on(input, 'input', render);
  on(input, 'keydown', onKey);
  on(document, 'keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); }
    else if (open && e.key === 'Escape') { e.preventDefault(); close(); }
  });
}

function toggle() { open ? close() : show(); }
export function show() {
  lastFocus = document.activeElement;
  root.hidden = false; open = true; input.value = ''; render();
  requestAnimationFrame(() => { root.classList.add('open'); input.focus(); });
}
export function close() {
  if (!open) return;
  open = false; root.classList.remove('open');
  setTimeout(() => { root.hidden = true; }, 160);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

function render() {
  const q = input.value.toLowerCase().trim();
  filtered = commands.filter((c) => !q || c.label.toLowerCase().includes(q) || (c.hint && c.hint.toLowerCase().includes(q)));
  active = 0;
  paint();
}
function paint() {
  while (list.firstChild) list.removeChild(list.firstChild);
  filtered.forEach((c, i) => {
    const item = el('div', { class: 'cmd-item' + (i === active ? ' active' : ''), role: 'option', 'aria-selected': i === active ? 'true' : 'false' },
      el('span', { class: 'cmd-label' }, c.label), c.hint ? el('span', { class: 'cmd-hint' }, c.hint) : null);
    on(item, 'click', () => run(c));
    on(item, 'mousemove', () => { if (active !== i) { active = i; updateActive(); } });
    list.appendChild(item);
  });
  if (!filtered.length) list.appendChild(el('div', { class: 'cmd-empty' }, 'No matching commands'));
}
function updateActive() {
  const kids = list.children;
  for (let i = 0; i < kids.length; i++) {
    const on_ = i === active;
    kids[i].classList.toggle('active', on_);
    kids[i].setAttribute && kids[i].setAttribute('aria-selected', on_ ? 'true' : 'false');
  }
  const a = kids[active]; if (a && a.scrollIntoView) a.scrollIntoView({ block: 'nearest' });
}
function onKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(filtered.length - 1, active + 1); updateActive(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); updateActive(); }
  else if (e.key === 'Enter') { e.preventDefault(); const c = filtered[active]; if (c) run(c); }
}
function run(c) { close(); setTimeout(() => c.run(), 60); }
