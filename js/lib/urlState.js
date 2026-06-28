/**
 * urlState.js — deep-linkable view state in location.hash
 * (filters/search/sort/density). Client-only; debounced writes via location.replace
 * so the stream can't spam browser history.
 */
let timer = null;

export function readHash() {
  try {
    const h = location.hash.replace(/^#/, '');
    if (!h) return null;
    return JSON.parse(decodeURIComponent(h));
  } catch { return null; }
}

export function writeHash(state) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { location.replace('#' + encodeURIComponent(JSON.stringify(state))); } catch { /* ignore */ }
  }, 200);
}
