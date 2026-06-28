/**
 * statusOverlay.js — F5 controls (Pause/Play + live status chip) and the F3 demo trigger.
 * The chip shows "LIVE" or "PAUSED · N buffered · M events" (queue sequence tracking).
 * The heartbeat dot pulses while live, holds amber while paused.
 */
import * as pauseBuffer from '../core/pauseBuffer.js';
import { el, icon, on } from '../lib/dom.js';

let btn, btnLabel, btnUse, chipText, demoBtn;

export function build(container, opts) {
  const onToggle = opts.onToggle, onDemo = opts.onDemo;

  const heartbeat = el('span', { class: 'heartbeat', 'aria-hidden': 'true' });
  chipText = document.createTextNode('LIVE');
  const chip = el('div', { class: 'live-chip', role: 'status', 'aria-live': 'polite' },
    heartbeat, (() => { const s = el('span', { class: 'live-text' }); s.appendChild(chipText); return s; })());

  btnLabel = el('span', { class: 'btn-label' }, 'Pause');
  const ico = icon('i-pause', 'btn-ic');
  btnUse = ico.querySelector('use');
  btn = el('button', { class: 'btn btn-primary btn-pause', type: 'button', 'aria-label': 'Pause stream' }, ico, btnLabel);
  on(btn, 'click', onToggle);

  demoBtn = el('button', {
    class: 'btn btn-ghost', type: 'button',
    title: 'QA / demo: trigger a Feature-3 alert flash on a visible row (the dataset has no Failed/negative-ROI rows)',
  }, icon('i-alert', 'btn-ic'), el('span', {}, 'Demo alert'));
  on(demoBtn, 'click', onDemo);

  container.append(chip, btn, demoBtn);
}

export function setPaused(paused) {
  btnLabel.textContent = paused ? 'Resume' : 'Pause';
  btnUse.setAttribute('href', paused ? '#i-play' : '#i-pause');
  btn.classList.toggle('is-paused', paused);
  btn.setAttribute('aria-label', paused ? 'Resume stream' : 'Pause stream');
  document.body.classList.toggle('is-paused', paused);
}

/** Called each frame: keep the status chip current (text-node only). */
export function update() {
  let txt = 'LIVE';
  if (pauseBuffer.isPaused()) {
    txt = 'PAUSED · ' + pauseBuffer.pendingRows().toLocaleString() + ' buffered · ' +
      pauseBuffer.eventCount().toLocaleString() + ' events';
  }
  if (chipText.nodeValue !== txt) chipText.nodeValue = txt;
}
