/**
 * sparkline.js — tiny inline trend path for the KPI strip (hand-rolled, no lib).
 * Returns an SVG path `d` string scaled to (w × h). Bounded input (ring buffer).
 */
export function sparklinePath(values, w, h) {
  const n = values ? values.length : 0;
  if (n < 2) return '';
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) { const v = values[i]; if (v < min) min = v; if (v > max) max = v; }
  const range = max - min || 1;
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const y = h - ((values[i] - min) / range) * h;
    d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
  }
  return d.trim();
}
