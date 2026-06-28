/**
 * analytics.js — overlay analytics dashboard, shown while the stream is frozen (paused).
 *
 * Clicking the "Analytics View" toggle while paused opens a full overlay that aggregates
 * the frozen snapshot (current filtered view) in a single pass and renders the panels with
 * Chart.js. Chart.js is the ONLY charting library and is LAZY-LOADED on first open — the
 * live streaming grid never loads or runs it, so the render path stays library-free.
 */
import * as store from '../core/store.js';
import * as pipeline from '../core/pipeline.js';
import { compact, int } from '../core/format.js';
import { el, icon, on } from '../lib/dom.js';

let root, panel, bodyEl, titleSub, opened = false, lastFocus = null;
let charts = [];
let chartLibPromise = null;

/** Inject the vendored Chart.js UMD once, on demand. */
function ensureChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartLibPromise) return chartLibPromise;
  chartLibPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'js/vendor/chart.umd.min.js';
    s.async = true;
    s.onload = () => resolve(window.Chart);
    s.onerror = () => reject(new Error('Chart.js failed to load'));
    document.head.appendChild(s);
  });
  return chartLibPromise;
}

const cssVar = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;

/** One pass over the frozen view → all aggregates. */
function aggregate() {
  const n = pipeline.length();
  const status = { Active: 0, Completed: 0, Planned: 0 };
  const deptSavings = new Map();
  const autoCount = new Map();
  let ai = 0, cloud = 0, budget = 0, savings = 0, robots = 0, roiSum = 0;
  for (let i = 0; i < n; i++) {
    const r = store.getSlot(pipeline.slotAt(i));
    if (!r) continue;
    status[r.project_status] = (status[r.project_status] || 0) + 1;
    deptSavings.set(r.department, (deptSavings.get(r.department) || 0) + r.num.annual_savings_usd);
    autoCount.set(r.automation_type, (autoCount.get(r.automation_type) || 0) + 1);
    if (r.ai_enabled === 'Yes') ai++;
    if (r.cloud_deployment === 'Yes') cloud++;
    budget += r.num.budget_usd; savings += r.num.annual_savings_usd; robots += r.num.robots_deployed;
    roiSum += r.num.roi_percent;
  }
  const topDept = [...deptSavings.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topAuto = [...autoCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  return { n, status, topDept, topAuto, ai, cloud, budget, savings, robots, avgRoi: n ? roiSum / n : 0 };
}

export function build() {
  const closeBtn = el('button', { class: 'an-close', type: 'button', 'aria-label': 'Close analytics' }, icon('i-x', 'ic'));
  titleSub = el('span', { class: 'an-sub' });
  const head = el('header', { class: 'an-head' },
    el('div', {}, el('h2', { class: 'an-title', id: 'an-title' }, 'Analytics — frozen snapshot'), titleSub),
    closeBtn);
  bodyEl = el('div', { class: 'an-body' });
  panel = el('section', { class: 'an-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'an-title', tabindex: '-1' }, head, bodyEl);
  const backdrop = el('div', { class: 'an-backdrop' });
  root = el('div', { class: 'an', hidden: true }, backdrop, panel);
  document.body.appendChild(root);

  on(closeBtn, 'click', close);
  on(backdrop, 'click', close);
  on(document, 'keydown', (e) => { if (opened && e.key === 'Escape') { e.preventDefault(); close(); } });
  on(panel, 'keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const a = f[0], b = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
    else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
  });
}
function focusables() {
  return Array.from(panel.querySelectorAll('button,[tabindex]:not([tabindex="-1"])')).filter((x) => !x.disabled && x.offsetParent !== null);
}

function kpi(label, val) {
  return el('div', { class: 'an-kpi' }, el('span', { class: 'an-kpi-label' }, label), el('span', { class: 'an-kpi-val' }, val));
}
function card(title, canvasId) {
  const c = document.createElement('canvas'); c.id = canvasId;
  return el('div', { class: 'an-card' }, el('h3', { class: 'an-card-title' }, title), el('div', { class: 'an-canvas-wrap' }, c));
}
function buildBody(a) {
  while (bodyEl.firstChild) bodyEl.removeChild(bodyEl.firstChild);
  bodyEl.append(
    el('div', { class: 'an-kpis' },
      kpi('Projects', int(a.n)),
      kpi('Total budget', '$' + compact(a.budget)),
      kpi('Total savings', '$' + compact(a.savings)),
      kpi('Avg ROI', a.avgRoi.toFixed(1) + '%'),
      kpi('Robots', int(a.robots)),
    ),
    el('div', { class: 'an-grid' },
      card('Projects by status', 'an-c-status'),
      card('Top departments by annual savings', 'an-c-dept'),
      card('Top automation types', 'an-c-auto'),
      card('AI & cloud adoption', 'an-c-adopt'),
    ),
  );
}

function destroyCharts() { charts.forEach((c) => { try { c.destroy(); } catch { /* noop */ } }); charts = []; }

function renderCharts(Chart, a) {
  destroyCharts();
  const text = cssVar('--text-secondary', '#9BA7B4');
  const gridLine = cssVar('--border-hairline', '#222C37');
  const accent = cssVar('--signal', '#46E0C8');
  const panelBg = cssVar('--bg-panel', '#11161D');
  const cAct = cssVar('--status-active', '#3DD68C'), cInf = cssVar('--status-info', '#4CCCE6'),
    cPen = cssVar('--status-pending', '#FFCA16'), cMut = cssVar('--text-muted', '#5E6B7A');

  Chart.defaults.color = text;
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 11;
  Chart.defaults.animation = false; // immediate draw (also avoids hidden-tab rAF stalls)
  const grid = { color: gridLine };
  const noGrid = { display: false };

  charts.push(new Chart(document.getElementById('an-c-status'), {
    type: 'doughnut',
    data: { labels: ['Active', 'Completed', 'Planned'], datasets: [{ data: [a.status.Active, a.status.Completed, a.status.Planned], backgroundColor: [cAct, cInf, cPen], borderColor: panelBg, borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'bottom' } } },
  }));
  charts.push(new Chart(document.getElementById('an-c-dept'), {
    type: 'bar',
    data: { labels: a.topDept.map((d) => d[0]), datasets: [{ label: 'Annual savings', data: a.topDept.map((d) => d[1]), backgroundColor: accent, borderRadius: 3 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => '$' + compact(c.parsed.x) } } }, scales: { x: { grid, ticks: { callback: (v) => '$' + compact(v) } }, y: { grid: noGrid } } },
  }));
  charts.push(new Chart(document.getElementById('an-c-auto'), {
    type: 'bar',
    data: { labels: a.topAuto.map((d) => d[0]), datasets: [{ label: 'Projects', data: a.topAuto.map((d) => d[1]), backgroundColor: cInf, borderRadius: 3 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid }, y: { grid: noGrid } } },
  }));
  charts.push(new Chart(document.getElementById('an-c-adopt'), {
    type: 'bar',
    data: {
      labels: ['AI enabled', 'Cloud deployed'],
      datasets: [
        { label: 'Yes', data: [a.ai, a.cloud], backgroundColor: cAct, borderRadius: 3 },
        { label: 'No', data: [a.n - a.ai, a.n - a.cloud], backgroundColor: cMut, borderRadius: 3 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true, grid: noGrid }, y: { stacked: true, grid } } },
  }));
}

export async function show() {
  if (opened) return;
  lastFocus = document.activeElement;
  const a = aggregate();
  titleSub.textContent = a.n.toLocaleString() + ' projects · stream frozen';
  buildBody(a);
  root.hidden = false; opened = true;
  requestAnimationFrame(() => root.classList.add('open'));
  panel.focus();
  let Chart;
  try { Chart = await ensureChartJs(); }
  catch (e) { console.error(e); bodyEl.appendChild(el('p', { class: 'an-err' }, 'Could not load Chart.js.')); return; }
  if (opened) renderCharts(Chart, a);
}

export function close() {
  if (!opened) return;
  opened = false;
  destroyCharts();
  root.classList.remove('open');
  setTimeout(() => { root.hidden = true; }, 200);
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

export function toggle() { opened ? close() : show(); }
export const isOpen = () => opened;
