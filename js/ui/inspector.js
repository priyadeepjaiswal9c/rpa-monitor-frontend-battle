/**
 * inspector.js — pause-gated row inspector drawer.
 * When the stream is paused, clicking a grid row opens an isolated, focus-trapped
 * side drawer that displays every attribute of that project, plus derived insights and
 * relational context. Reads the store only (no stream coupling); a single reused element
 * (rebuilt on open — infrequent, off the hot path).
 */
import * as store from '../core/store.js';
import { currency, percent, int } from '../core/format.js';
import { el, icon, on } from '../lib/dom.js';

let root, panel, bodyEl, titleEl, idEl, statusEl, open = false, lastFocus = null;

function statusClass(st) {
  return st === 'Active' ? 'st-active' : st === 'Completed' ? 'st-completed'
    : st === 'Planned' ? 'st-planned' : 'st-alert';
}

export function build() {
  bodyEl = el('div', { class: 'insp-body' });
  titleEl = el('h2', { class: 'insp-title', id: 'insp-title' });
  idEl = el('span', { class: 'insp-id' });
  statusEl = el('span', { class: 'insp-status' });
  const closeBtn = el('button', { class: 'insp-close', type: 'button', 'aria-label': 'Close inspector' }, icon('i-x', 'ic'));
  panel = el('aside', { class: 'insp-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'insp-title', tabindex: '-1' },
    el('header', { class: 'insp-head' },
      el('div', { class: 'insp-head-main' }, titleEl, el('div', { class: 'insp-sub' }, idEl, statusEl)),
      closeBtn),
    bodyEl);
  const backdrop = el('div', { class: 'insp-backdrop' });
  root = el('div', { class: 'insp', hidden: true }, backdrop, panel);
  document.body.appendChild(root);

  on(closeBtn, 'click', close);
  on(backdrop, 'click', close);
  on(document, 'keydown', (e) => { if (open && e.key === 'Escape') { e.preventDefault(); close(); } });
  on(panel, 'keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

function focusables() {
  return Array.from(panel.querySelectorAll('button,[href],input,[tabindex]:not([tabindex="-1"])'))
    .filter((x) => !x.disabled && x.offsetParent !== null);
}

function field(label, value, cls) {
  return el('div', { class: 'insp-field' }, el('dt', { class: 'insp-dt' }, label), el('dd', { class: 'insp-dd' + (cls ? ' ' + cls : '') }, value == null || value === '' ? '—' : value));
}
function section(title, fields) {
  return el('section', { class: 'insp-section' }, el('h3', { class: 'insp-sec-title' }, title), el('dl', { class: 'insp-dl' }, fields));
}
function metric(label, value, cls) {
  return el('div', { class: 'insp-metric' + (cls ? ' ' + cls : '') }, el('span', { class: 'insp-metric-label' }, label), el('span', { class: 'insp-metric-val' }, value));
}

function durationOf(row) {
  if (!row.completion_date) return 'In progress';
  const a = Date.parse(row.start_date), b = Date.parse(row.completion_date);
  if (isNaN(a) || isNaN(b) || b < a) return '—';
  const days = Math.round((b - a) / 86400000);
  const y = Math.floor(days / 365), d = days % 365;
  return (y ? y + 'y ' : '') + d + 'd';
}

/** Relational context: count sibling projects (bounded scan on open while paused). */
function relCounts(row) {
  const s = store.slots(); let comp = 0, part = 0, dept = 0;
  const c = row.company_id, p = row.implementation_partner, d = row.department;
  for (let i = 0; i < s.length; i++) {
    const r = s[i]; if (!r) continue;
    if (r.company_id === c) comp++;
    if (r.implementation_partner === p) part++;
    if (r.department === d) dept++;
  }
  return { comp, part, dept };
}

export function openFor(uid) {
  const row = store.getUid(uid); if (!row) return;
  lastFocus = document.activeElement;
  const n = row.num;
  const st = row._demoAlert ? 'Failed' : row.project_status;

  titleEl.textContent = row.project_name;
  idEl.textContent = row.project_id;
  statusEl.textContent = st;
  statusEl.className = 'insp-status ' + statusClass(st);

  const ratio = n.budget_usd ? n.annual_savings_usd / n.budget_usd : 0;
  const payback = n.annual_savings_usd ? n.budget_usd / n.annual_savings_usd : 0;
  const roiBand = n.roi_percent >= 150 ? 'High' : n.roi_percent >= 50 ? 'Medium' : 'Low';
  const rc = relCounts(row);

  while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
  bodyEl.append(
    el('div', { class: 'insp-metrics' },
      metric('Budget', currency(n.budget_usd)),
      metric('Annual Savings', currency(n.annual_savings_usd), 'good'),
      metric('ROI', percent(n.roi_percent), roiBand === 'High' ? 'good' : roiBand === 'Low' ? 'warn' : ''),
    ),
    section('Insights', [
      field('Savings / Budget', ratio ? ratio.toFixed(2) + '×' : '—'),
      field('Est. payback', payback ? payback.toFixed(2) + ' yrs' : '—'),
      field('ROI band', roiBand),
      field('Duration', durationOf(row)),
      field('Hours saved', int(n.employee_hours_saved)),
      field('Robots deployed', int(n.robots_deployed)),
    ]),
    section('Identity', [
      field('Company', row.company_id),
      field('Department', row.department),
      field('Industry', row.industry),
      field('Implementation partner', row.implementation_partner),
      field('Country', row.country),
    ]),
    section('Timeline & class', [
      field('Start date', row.start_date),
      field('Completion', row.completion_date || 'In progress'),
      field('Status', st, statusClass(st)),
      field('Automation type', row.automation_type),
    ]),
    section('Deployment', [
      field('AI enabled', row.ai_enabled, row.ai_enabled === 'Yes' ? 'good' : ''),
      field('Cloud deployment', row.cloud_deployment, row.cloud_deployment === 'Yes' ? 'good' : ''),
    ]),
    section('Relational context', [
      field('Same company', rc.comp.toLocaleString() + ' projects'),
      field('Same partner', rc.part.toLocaleString() + ' projects'),
      field('Same department', rc.dept.toLocaleString() + ' projects'),
    ]),
  );

  root.hidden = false; open = true;
  requestAnimationFrame(() => root.classList.add('open'));
  panel.focus();
}

export function close() {
  if (!open) return;
  open = false;
  root.classList.remove('open');
  setTimeout(() => { root.hidden = true; }, 240);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

export const isOpen = () => open;
