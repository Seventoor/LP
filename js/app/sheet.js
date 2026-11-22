// Lost Radar – Bottom-Sheet: ziehbare Ergebnisleiste (peek/half/full)

import { $, root, wide } from './state.js';

export const sheet = $('#sheet'), grab = $('#grab'), body = $('#body');
export let sheetSt = 'half';
// Oberer Sicherheitsabstand (Notch/Statusleiste), steckt in der top-Position der Suchleiste
const safeTop = () => Math.max(0, (parseFloat(getComputedStyle($('#bar')).top) || 10) - 10);
export const shPx = st => { const H = window.innerHeight; return st === 'peek' ? 96 : st === 'full' ? H - 80 - safeTop() : Math.round(H * 0.46); };
export function setSheet(st) {
  sheetSt = st;
  if (wide()) { sheet.style.height = ''; root.style.setProperty('--sh', '0px'); return; }
  const h = shPx(st); sheet.style.height = h + 'px'; root.style.setProperty('--sh', h + 'px');
}
let drag = null;
grab.addEventListener('pointerdown', e => {
  if (wide()) return;
  drag = { y: e.clientY, h: sheet.offsetHeight, moved: false };
  grab.setPointerCapture(e.pointerId); sheet.classList.add('drag');
});
grab.addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = e.clientY - drag.y;
  if (Math.abs(dy) > 5) drag.moved = true;
  sheet.style.height = Math.max(80, Math.min(window.innerHeight - 70 - safeTop(), drag.h - dy)) + 'px';
});
const endDrag = () => {
  if (!drag) return;
  sheet.classList.remove('drag');
  if (!drag.moved) setSheet({ peek: 'half', half: 'full', full: 'half' }[sheetSt]);
  else {
    const h = sheet.offsetHeight; let best = 'half', bd = 1e9;
    for (const o of ['peek', 'half', 'full']) { const d = Math.abs(shPx(o) - h); if (d < bd) { bd = d; best = o; } }
    setSheet(best);
  }
  drag = null;
};
grab.addEventListener('pointerup', endDrag);
grab.addEventListener('pointercancel', endDrag);
window.addEventListener('resize', () => setSheet(sheetSt));
