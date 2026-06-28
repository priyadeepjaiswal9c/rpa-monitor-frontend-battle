/**
 * persist.js — F6: namespaced localStorage with safe JSON + try/catch guards
 * (private mode / quota errors never break the app).
 */
const NS = 'rpa-monitor:';

export function get(key, fallback) {
  try {
    const v = localStorage.getItem(NS + key);
    return v == null ? fallback : JSON.parse(v);
  } catch { return fallback; }
}

export function set(key, val) {
  try { localStorage.setItem(NS + key, JSON.stringify(val)); } catch { /* ignore */ }
}

export function remove(key) {
  try { localStorage.removeItem(NS + key); } catch { /* ignore */ }
}
