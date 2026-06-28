/**
 * kpiStrip.js — top-row live KPI cards.
 *   Streamed Rows · Robots Deployed Σ · Cumulative Savings · Avg ROI
 * Each card: label + trend badge, big value, sublabel + area sparkline, accent edge.
 * Updates via textContent on cached leaf nodes only; eased count-up on the shared rAF,
 * with a document.hidden / reduced-motion fallback that writes the final value directly.
 */
import * as store from '../core/store.js';
import { int, currency, compact } from '../core/format.js';
import { sparklinePath, sparklineArea } from '../lib/sparkline.js';
import { el, icon } from '../lib/dom.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SPARK_W = 96, SPARK_H = 26;

const CARDS = [
  { key: 'streamed', label: 'Streamed Rows', glyph: 'i-activity', accent: 'mint',   sub: 'rows ingested',          fmt: int,                         delta: 'rate' },
  { key: 'robots',   label: 'Robots Deployed Σ', glyph: 'i-cube', accent: 'violet', sub: 'across 50,000 projects', fmt: int,                         delta: 'pct' },
  { key: 'savings',  label: 'Cumulative Savings', glyph: 'i-trend', accent: 'mint', sub: 'annualized USD',         fmt: (v) => '$' + compact(v), full: currency, delta: 'pct' },
  { key: 'avgRoi',   label: 'Avg ROI', glyph: 'i-gauge', accent: 'mint',           sub: 'weighted mean',          fmt: (v) => v.toFixed(1) + '%',   delta: 'pp' },
];

let entries = [];
let reduced = false;

function makeSpark() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'kpi-spark');
  svg.setAttribute('viewBox', `0 0 ${SPARK_W} ${SPARK_H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const area = document.createElementNS(SVG_NS, 'path'); area.setAttribute('class', 'kpi-spark-area');
  const line = document.createElementNS(SVG_NS, 'path'); line.setAttribute('class', 'kpi-spark-line');
  svg.append(area, line);
  return { svg, area, line };
}

export function build(container) {
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  entries = CARDS.map((c) => {
    const valueT = document.createTextNode('0');
    const valueEl = el('div', { class: 'kpi-value' }); valueEl.appendChild(valueT);
    const trendT = document.createTextNode('');
    const trend = el('span', { class: 'kpi-trend' }); trend.appendChild(trendT);
    const spark = makeSpark();
    const card = el('article', { class: 'kpi kpi--' + c.accent },
      el('div', { class: 'kpi-head' }, icon(c.glyph, 'kpi-glyph'), el('span', { class: 'kpi-label' }, c.label), trend),
      valueEl,
      el('div', { class: 'kpi-foot' }, el('span', { class: 'kpi-sub' }, c.sub), spark.svg),
    );
    container.appendChild(card);
    return { c, valueT, valueEl, trendT, area: spark.area, line: spark.line, displayed: 0 };
  });
}

/** Per-frame: ease displayed toward target, write value text only. */
export function tick() {
  const k = store.kpis();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const target = k[e.c.key] || 0;
    if (reduced || document.hidden) e.displayed = target;
    else { const diff = target - e.displayed; e.displayed += diff * 0.22; if (Math.abs(diff) < 0.5) e.displayed = target; }
    const txt = e.c.fmt(e.c.key === 'avgRoi' ? e.displayed : Math.round(e.displayed));
    if (e.valueT.nodeValue !== txt) e.valueT.nodeValue = txt;
    if (e.c.full) { const f = e.c.full(target); if (e.valueEl.title !== f) e.valueEl.title = f; }
  }
}

/** ~1/sec: redraw sparklines + trend badges from the bounded ring. */
export function updateSparks() {
  const k = store.kpis();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const data = store.ringFor(e.c.key);
    const line = sparklinePath(data, SPARK_W, SPARK_H);
    if (e.line.getAttribute('d') !== line) e.line.setAttribute('d', line);
    const area = sparklineArea(data, SPARK_W, SPARK_H);
    if (e.area.getAttribute('d') !== area) e.area.setAttribute('d', area);
    const t = trendText(e.c, data, k);
    if (e.trendT.nodeValue !== t) e.trendT.nodeValue = t;
  }
}

function trendText(c, data, k) {
  const n = data.length;
  if (c.delta === 'rate') {
    const r = n >= 2 ? Math.max(0, data[n - 1] - data[n - 2]) : k.lastTickRows * 5;
    return '▲ ' + r.toLocaleString() + '/s';
  }
  if (n < 2) return '';
  const prev = data[n - 2], cur = data[n - 1];
  if (c.delta === 'pp') { const d = cur - prev; return (d >= 0 ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + 'pp'; }
  const pct = prev ? ((cur - prev) / prev) * 100 : 0;
  return (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(1) + '%';
}
