/**
 * rowBinder.js — F2 (sanitation) + F3 (status alerts).
 *
 * Builds a row's cell skeleton ONCE (cached text nodes) and binds a data row into it
 * with `nodeValue`-only writes, dirty-checked (skip identical cells). No innerHTML, no
 * node creation on the hot path. Status → colored chip (color + glyph + label). Alert
 * (Failed / negative ROI / demo) and receive-flash are class toggles (paint-only).
 */

import { COLUMNS } from '../core/schema.js';
import { currency, percent, int, bool } from '../core/format.js';

const ALERT_STATUS = 'Failed';
const STATUS_IDX = COLUMNS.findIndex((c) => c.cls === 'status');
const BOOL_IDXS = [];
COLUMNS.forEach((c, i) => { if (c.cls === 'bool') BOOL_IDXS.push(i); });

function formatCell(c, row) {
  switch (c.cls) {
    case 'cur':  return currency(row.num[c.key]);
    case 'pct':  return percent(row.num[c.key]);
    case 'int':  return int(row.num[c.key]);
    case 'bool': return bool(row[c.key]);
    case 'date': return row[c.key] && row[c.key].length ? row[c.key] : '—';
    case 'status': return row._demoAlert ? ALERT_STATUS : (row[c.key] || '');
    default:     return row[c.key] || '';
  }
}

/** Lazy per-row-version display cache (only built for rows that actually render). */
function fmtRow(row) {
  if (row._fmt) return row._fmt;
  const out = new Array(COLUMNS.length);
  for (let i = 0; i < COLUMNS.length; i++) out[i] = formatCell(COLUMNS[i], row);
  row._fmt = out;
  return out;
}

function statusClass(row) {
  if (row._demoAlert) return 'st-alert';
  switch (row.project_status) {
    case 'Active':    return 'st-active';
    case 'Completed': return 'st-completed';
    case 'Planned':   return 'st-planned';
    default:          return 'st-alert';
  }
}

/** Build one reusable row node. Created once at pool init; never recreated. */
export function buildRow() {
  const row = document.createElement('div');
  row.className = 'grid-row';
  row.setAttribute('role', 'row');

  const gutter = document.createElement('span');
  gutter.className = 'gc gutter';
  row.appendChild(gutter);

  const cells = new Array(COLUMNS.length);
  const tnodes = new Array(COLUMNS.length);
  for (let i = 0; i < COLUMNS.length; i++) {
    const c = COLUMNS[i];
    const cell = document.createElement('span');
    let cn = 'gc gc--' + c.align;
    if (c.cls === 'status') cn += ' gc--status';
    else if (c.cls === 'name') cn += ' gc--name';
    else if (c.cls === 'mono') cn += ' gc--mono';
    else if (c.cls === 'cur' || c.cls === 'pct' || c.cls === 'int') cn += ' gc--num';
    cell.className = cn;
    cell.style.width = c.w + 'px';
    cell.setAttribute('role', 'gridcell');
    const t = document.createTextNode('');
    cell.appendChild(t);
    row.appendChild(cell);
    cells[i] = cell;
    tnodes[i] = t;
  }
  row._cells = cells;
  row._t = tnodes;
  row._uid = null;
  row._statusCls = '';
  row._bc = new Array(BOOL_IDXS.length).fill('');
  row._zebra = -1;
  row._flags = '';
  row._hidden = false;
  return row;
}

/**
 * Bind a data row into a pooled node. Writes only what changed.
 * @param recvSet Set of uids received this tick (flash); may be null.
 */
export function bindRow(node, row, absIdx, recvSet) {
  const fmt = fmtRow(row);
  const t = node._t;
  for (let i = 0; i < t.length; i++) {
    if (t[i].nodeValue !== fmt[i]) t[i].nodeValue = fmt[i];
  }

  // status chip color (only on change)
  const sc = statusClass(row);
  if (node._statusCls !== sc) {
    const cell = node._cells[STATUS_IDX];
    cell.className = 'gc gc--l gc--status ' + sc;
    node._statusCls = sc;
  }

  // bool cell coloring (Yes=mint / No=muted)
  for (let bi = 0; bi < BOOL_IDXS.length; bi++) {
    const ci = BOOL_IDXS[bi];
    const want = row[COLUMNS[ci].key] === 'Yes' ? 'bl-yes' : 'bl-no';
    if (node._bc[bi] !== want) {
      const cl = node._cells[ci].classList;
      cl.remove('bl-yes', 'bl-no'); cl.add(want);
      node._bc[bi] = want;
    }
  }

  // zebra via ABSOLUTE index (no flicker on recycle)
  const odd = absIdx & 1;
  if (node._zebra !== odd) { node.classList.toggle('odd', !!odd); node._zebra = odd; }

  // F3 alert + receive flash (paint-only class toggles)
  const isAlert = row._demoAlert === true || row.project_status === ALERT_STATUS || row.num.roi_percent < 0;
  const isRecv = recvSet ? recvSet.has(row.internal_uid) : false;
  const flags = (isAlert ? 'a' : '') + (isRecv ? 'r' : '');
  if (node._flags !== flags) {
    node.classList.toggle('is-alert', isAlert);
    node.classList.toggle('is-recv', isRecv);
    node._flags = flags;
  }

  node._uid = row.internal_uid;
  node.dataset.idx = absIdx;
}
