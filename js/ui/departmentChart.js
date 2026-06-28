/**
 * departmentChart.js — "Department Analytics" widget. Hand-rolled canvas horizontal
 * bar chart (no charting lib). Aggregates the CURRENT view by department (top N).
 * Drawn on demand; repaint throttled (≤4/s) since it only changes on filter/search.
 */
import * as store from '../core/store.js';
import * as pipeline from '../core/pipeline.js';
import { compact } from '../core/format.js';
import { el, icon } from '../lib/dom.js';

let canvas, ctx, subT, wrap, throttle = 0, W = 0, H = 0, dpr = 1, COL = null;
const TOP = 12;

export function build(container) {
  subT = document.createTextNode('');
  const sub = el('span', { class: 'panel-sub' }); sub.appendChild(subT);
  const head = el('div', { class: 'panel-head' },
    el('h2', { class: 'panel-title' }, icon('i-trend', 'panel-ic'), 'Department Analytics'), sub);
  canvas = el('canvas', { class: 'dept-canvas' });
  wrap = el('div', { class: 'dept-wrap' }, canvas);
  container.append(head, wrap);
  ctx = canvas.getContext('2d');
  COL = {
    accent: cssVar('--signal', '#46E0C8'),
    txt: cssVar('--text-secondary', '#9BA7B4'),
    txt2: cssVar('--text-primary', '#E6EBF2'),
  };
}

export function resize() {
  if (!canvas || !wrap) return;
  const r = wrap.getBoundingClientRect();
  if (!r.width) return;
  dpr = window.devicePixelRatio || 1;
  W = Math.max(220, r.width);
  H = Math.max(160, r.height);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

export function scheduleDraw() {
  if (throttle) return;
  throttle = setTimeout(() => { throttle = 0; draw(); }, 250);
}

function aggregate() {
  const map = new Map();
  const n = pipeline.length();
  for (let i = 0; i < n; i++) {
    const row = store.getSlot(pipeline.slotAt(i));
    if (!row) continue;
    const d = row.department;
    map.set(d, (map.get(d) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, TOP);
}

function cssVar(name, fb) { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
function rgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
function trunc(text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function draw() {
  if (!ctx || !W) return;
  ctx.clearRect(0, 0, W, H);
  const data = aggregate();
  const total = pipeline.length();
  subT.nodeValue = data.length ? 'top ' + data.length + ' · ' + total.toLocaleString() + ' rows' : 'no data';
  if (!data.length) return;

  const accent = COL.accent, txt = COL.txt, txt2 = COL.txt2;
  const max = data[0][1];
  const padY = 6;
  const rowH = Math.min(24, (H - padY * 2) / data.length);
  const labelW = Math.min(150, W * 0.36);
  const valW = 52;
  const barX = labelW + 8;
  const barMax = Math.max(10, W - barX - valW);

  ctx.textBaseline = 'middle';
  for (let i = 0; i < data.length; i++) {
    const [dept, count] = data[i];
    const cy = padY + i * rowH + rowH / 2;
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillStyle = txt; ctx.textAlign = 'right';
    ctx.fillText(trunc(dept, labelW - 6), labelW, cy);

    const bw = Math.max(2, (count / max) * barMax);
    const by = cy - rowH / 2 + 3, bh = rowH - 6;
    const g = ctx.createLinearGradient(barX, 0, barX + bw, 0);
    g.addColorStop(0, rgba(accent, 0.9)); g.addColorStop(1, rgba(accent, 0.34));
    ctx.fillStyle = g;
    const rad = Math.min(3, bh / 2);
    ctx.beginPath();
    ctx.moveTo(barX, by);
    ctx.arcTo(barX + bw, by, barX + bw, by + bh, rad);
    ctx.arcTo(barX + bw, by + bh, barX, by + bh, rad);
    ctx.lineTo(barX, by + bh);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = txt2; ctx.textAlign = 'left';
    ctx.fillText(compact(count), barX + bw + 6, cy);
  }
}

export { draw };
