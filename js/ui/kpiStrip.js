/**
 * kpiStrip.js — top-row live KPI counters.
 *   1. Total Streamed Rows Processed
 *   2. Active Robots Deployed Σ (running sum of robots_deployed received)
 *   3. Global Cumulative Savings (running sum of annual_savings_usd received)
 *
 * Updates via textContent on cached leaf nodes only (no re-render). Eased count-up on
 * the shared rAF, with a document.hidden / reduced-motion fallback that writes the final
 * value directly so it never freezes at 0 in a backgrounded tab.
 */

import * as store from '../core/store.js';
import { int, currency, compact } from '../core/format.js';
import { sparklinePath } from '../lib/sparkline.js';
import { el, icon } from '../lib/dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPARK_W = 88, SPARK_H = 22;

const CARDS = [
  { key: 'streamed', label: 'Streamed Rows',       glyph: 'i-activity', fmt: int },
  { key: 'robots',   label: 'Robots Deployed Σ',   glyph: 'i-cube',     fmt: int },
  { key: 'savings',  label: 'Cumulative Savings',  glyph: 'i-trend',    fmt: (v) => '$' + compact(v), full: currency },
];

let entries = [];
let reduced = false;

function makeSpark() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'kpi-spark');
  svg.setAttribute('viewBox', `0 0 ${SPARK_W} ${SPARK_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', 'kpi-spark-line');
  svg.appendChild(path);
  return { svg, path };
}

export function build(container) {
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  entries = CARDS.map((c) => {
    const valueT = document.createTextNode('0');
    const valueEl = el('div', { class: 'kpi-value' });
    valueEl.appendChild(valueT);
    const deltaT = document.createTextNode('');
    const spark = makeSpark();
    const card = el('article', { class: 'kpi' },
      el('div', { class: 'kpi-head' }, icon(c.glyph, 'kpi-glyph'), el('span', { class: 'kpi-label' }, c.label)),
      valueEl,
      el('div', { class: 'kpi-foot' }, spark.svg, (() => { const d = el('span', { class: 'kpi-delta' }); d.appendChild(deltaT); return d; })()),
    );
    container.appendChild(card);
    return { c, valueT, valueEl, deltaT, path: spark.path, displayed: 0 };
  });
}

/** Per-frame: ease displayed toward target, write text nodes only. */
export function tick() {
  const k = store.kpis();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const target = k[e.c.key];
    if (reduced || document.hidden) {
      e.displayed = target;
    } else {
      const diff = target - e.displayed;
      e.displayed += diff * 0.22;
      if (Math.abs(diff) < 1) e.displayed = target;
    }
    const txt = e.c.fmt(Math.round(e.displayed));
    if (e.valueT.nodeValue !== txt) e.valueT.nodeValue = txt;
    if (e.c.full) {
      const full = e.c.full(target);
      if (e.valueEl.title !== full) e.valueEl.title = full;
    }
  }
  const dtxt = '+' + k.lastTickRows + ' rows / tick';
  if (entries[0].deltaT.nodeValue !== dtxt) entries[0].deltaT.nodeValue = dtxt;
}

/** ~1/sec: redraw sparklines from the bounded ring buffer. */
export function updateSparks() {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const d = sparklinePath(store.ringFor(e.c.key), SPARK_W, SPARK_H);
    if (e.path.getAttribute('d') !== d) e.path.setAttribute('d', d);
  }
}
