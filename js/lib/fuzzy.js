/**
 * fuzzy.js — multi-token, out-of-order partial search.
 *
 * Substring-AND of tokens against a precomputed lowercased haystack: every token must
 * appear somewhere (AND), in any order. Allocation-free and fast over the full dataset —
 * no library, no worker. e.g. "tata fin completed cloud" → each token tested
 * independently against row._hay.
 */

export function tokenize(query) {
  const out = [];
  const parts = query.toLowerCase().split(/\s+/);
  for (let i = 0; i < parts.length; i++) if (parts[i]) out.push(parts[i]);
  return out;
}

/** True iff EVERY token is a substring of the (already lowercased) haystack. */
export function matches(tokens, hay) {
  for (let i = 0; i < tokens.length; i++) {
    if (hay.indexOf(tokens[i]) === -1) return false;
  }
  return true;
}
