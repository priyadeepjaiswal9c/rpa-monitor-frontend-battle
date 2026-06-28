/**
 * main.js — composition root.
 * Owns the SINGLE requestAnimationFrame loop (the only place the DOM is painted).
 * Stream ticks/scroll only mutate state; the loop coalesces them into one paint/frame.
 */
import * as store from './core/store.js';
import * as pipeline from './core/pipeline.js';
import * as pauseBuffer from './core/pauseBuffer.js';
import { loadBaseline, startStream } from './core/streamAdapter.js';

import * as grid from './ui/virtualGrid.js';
import * as kpiStrip from './ui/kpiStrip.js';
import * as searchBar from './ui/searchBar.js';
import * as filters from './ui/filters.js';
import * as sortControls from './ui/sortControls.js';
import * as statusOverlay from './ui/statusOverlay.js';
import * as inspector from './ui/inspector.js';
import * as perfHud from './ui/perfHud.js';
import * as layoutManager from './ui/layoutManager.js';
import * as chart from './ui/departmentChart.js';
import * as commandPalette from './ui/commandPalette.js';
import * as theme from './ui/theme.js';
import * as analytics from './ui/analytics.js';

import { exportCurrentView } from './lib/exportCsv.js';
import * as urlState from './lib/urlState.js';
import * as persist from './lib/persist.js';
import { el, on } from './lib/dom.js';

const CSV_URL = 'automation_projects.csv';
const $ = (id) => document.getElementById(id);

let density = 'compact';
let lastSec = 0;
const scheduleFrame = () => {}; // continuous rAF loop is always running

/* ---------- loader ---------- */
function setLoaderText(t) { const e = $('loaderText'); if (e) e.textContent = t; }
function hideLoader() { const l = $('loader'); if (!l) return; l.classList.add('hide'); setTimeout(() => l.remove(), 380); }

/* ---------- toast ---------- */
let toastTimer = 0;
function toast(msg) {
  let t = $('toast');
  if (!t) { t = el('div', { id: 'toast', class: 'toast', role: 'status' }); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- view-state plumbing ---------- */
function updateCount() {
  const n = pipeline.length(), total = store.size();
  const c = $('count');
  c.textContent = pipeline.isFiltered() ? n.toLocaleString() + ' of ' + total.toLocaleString() : total.toLocaleString() + ' projects';
  c.classList.toggle('filtered', pipeline.isFiltered());
}
function saveUrlState() { urlState.writeHash({ q: searchBar.getValue(), sort: sortControls.get(), density }); }
function onChange() { updateCount(); chart.scheduleDraw(); saveUrlState(); }

function applyDensity(d) {
  density = d === 'comfortable' ? 'comfortable' : 'compact';
  document.body.classList.toggle('comfortable', density === 'comfortable');
  grid.setRowHeight(density === 'comfortable' ? 36 : 28);
  persist.set('density', density);
}

/** Collapse the side column when both its panels are hidden, so the grid reclaims the space. */
function syncSide() {
  const sideEl = document.querySelector('.side');
  if (!sideEl) return;
  const any = layoutManager.isVisible('chart') || layoutManager.isVisible('hud');
  sideEl.hidden = !any;
  if (any && layoutManager.isVisible('chart')) chart.resize();
}

function clearAll() {
  filters.clearAll();
  searchBar.setValue(''); pipeline.setQuery('');
  sortControls.set([]);
  grid.refreshSort([]);
  onChange();
}

/* ---------- interactions ---------- */
function togglePause() {
  if (pauseBuffer.isPaused()) {
    analytics.close(); // the analytics overlay shows a frozen snapshot — close it on resume
    const s = pauseBuffer.resume();
    statusOverlay.setPaused(false);
    if (s.distinct) toast('Resumed · flushed ' + s.distinct.toLocaleString() + ' buffered rows (' + s.events.toLocaleString() + ' events)');
  } else {
    pauseBuffer.pause();
    statusOverlay.setPaused(true);
  }
}

function onRowClick(uid) {
  if (pauseBuffer.isPaused()) inspector.openFor(uid);
  else toast('⏸  Pause the stream to inspect a row');
}

function openAnalytics() {
  if (pauseBuffer.isPaused()) analytics.toggle();
  else toast('⏸  Pause the stream to open the analytics view');
}

function demoAlert() {
  const n = pipeline.length(); if (!n) return;
  grid.scrollToTop();
  const idx = Math.floor(Math.random() * Math.min(n, 28));
  const row = store.getSlot(pipeline.slotAt(idx));
  if (!row) return;
  store.flagDemoAlert(row.internal_uid);
  toast('Demo: alert injected on a visible row (the dataset has no Failed / negative-ROI rows)');
  setTimeout(() => store.clearDemoAlert(row.internal_uid), 4500);
}

function onBatch(batch) {
  if (pauseBuffer.isPaused()) pauseBuffer.capture(batch);
  else store.applyBatch(batch);
}

/* ---------- the single render loop ---------- */
function loop(now) {
  requestAnimationFrame(loop);
  const paused = pauseBuffer.isPaused();
  const recv = paused ? null : store.takeReceived();
  grid.paint(recv);                 // scroll still works while paused; recv null = no flash
  if (!paused) kpiStrip.tick();     // KPI display freezes while paused (engine still accrues)
  statusOverlay.update();
  perfHud.frame(now);
  if (now - lastSec >= 1000) {
    lastSec = now;
    if (!paused) { store.sampleRing(); kpiStrip.updateSparks(); }
    perfHud.second();
  }
}

/* ---------- global keys ---------- */
function wireGlobalKeys() {
  on(document, 'keydown', (e) => {
    if (e.target.matches && e.target.matches('input, textarea, [contenteditable]')) return;
    if (e.key === '/') { e.preventDefault(); searchBar.focusInput(); }
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); togglePause(); }
  });
}

/* ---------- command palette registry ---------- */
function buildCommands() {
  return [
    { label: 'Focus search', hint: '/', run: () => searchBar.focusInput() },
    { label: 'Pause / Resume stream', hint: 'space', run: togglePause },
    { label: 'Toggle light / dark theme', run: theme.toggle },
    { label: 'Inject demo alert', run: demoAlert },
    { label: 'Open analytics dashboard (while paused)', run: openAnalytics },
    { label: 'Density: Compact', run: () => applyDensity('compact') },
    { label: 'Density: Comfortable', run: () => applyDensity('comfortable') },
    { label: 'Export current view (CSV)', run: () => toast('Exported ' + exportCurrentView().toLocaleString() + ' rows') },
    { label: 'Clear all filters & search', run: clearAll },
    { label: 'Scroll to top', run: () => grid.scrollToTop() },
    { label: 'Toggle Department Analytics', run: () => layoutManager.toggle('chart') },
    { label: 'Toggle Performance HUD', run: () => layoutManager.toggle('hud') },
    { label: 'Toggle KPI strip', run: () => layoutManager.toggle('kpis') },
  ];
}

function restoreUrlState() {
  const s = urlState.readHash();
  if (!s) return;
  if (s.density) applyDensity(s.density);
  if (s.q) { searchBar.setValue(s.q); pipeline.setQuery(s.q); }
  if (s.sort && s.sort.length) sortControls.set(s.sort);
}

/* ---------- init ---------- */
async function init() {
  statusOverlay.build($('statusControls'), { onToggle: togglePause, onDemo: demoAlert });
  kpiStrip.build($('kpis'));
  searchBar.build($('search'), { scheduleFrame, onChange });
  sortControls.init({ scheduleFrame, onChange });
  perfHud.build($('hud'));
  chart.build($('deptChart'));
  inspector.build();
  analytics.build();
  theme.build($('themeToggle'), { onChange: () => chart.refreshTheme() });

  setLoaderText('Parsing 50,000 baseline rows…');
  let baseline;
  try {
    baseline = await loadBaseline(CSV_URL);
  } catch (err) {
    setLoaderText('Could not load dataset — ' + err.message);
    console.error('[init]', err);
    return;
  }
  store.seed(baseline);
  pipeline.recompute();

  grid.mount($('grid'), { onHeaderClick: (k, s) => sortControls.handle(k, s), onRowClick, scheduleFrame });
  const ecb = grid.getEmptyClearBtn(); if (ecb) on(ecb, 'click', clearAll);

  filters.build($('filters'), { scheduleFrame, onChange });

  layoutManager.register('kpis', 'KPI strip', $('kpis'), true);
  layoutManager.register('chart', 'Department Analytics', $('chartPanel'), true);
  layoutManager.register('hud', 'Performance HUD', $('hudPanel'), true);
  layoutManager.buildMenu($('viewMenu'), { onToggle: () => syncSide() });
  layoutManager.restore();
  syncSide();

  applyDensity(persist.get('density', 'compact'));
  restoreUrlState();

  commandPalette.build(buildCommands());

  on($('exportBtn'), 'click', () => toast('Exported ' + exportCurrentView().toLocaleString() + ' rows (current view)'));
  on($('densityBtn'), 'click', () => { applyDensity(density === 'compact' ? 'comfortable' : 'compact'); saveUrlState(); });
  on($('cmdBtn'), 'click', () => commandPalette.show());
  on($('analyticsBtn'), 'click', openAnalytics);

  grid.refreshSort(sortControls.get());
  updateCount();
  chart.resize();
  on(window, 'resize', () => chart.resize());

  grid.paint(null);  // initial window paint before revealing
  hideLoader();

  startStream(onBatch, CSV_URL);
  requestAnimationFrame(loop);
  wireGlobalKeys();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
