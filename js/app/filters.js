// Lost Radar – Filter-Dialog mit den Einstellungen für den KI-Check

import * as C from '../core/index.js';
import { $, $$, store, S, toast } from './state.js';
import { body } from './sheet.js';
import { updPill } from './scan.js';
import { apply, render } from './list.js';

export const fl = $('#filters');
function segSync(id, v) { $$(id + ' button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); }
function renderFilters() {
  const cnt = {};
  S.items.forEach(i => { cnt[i.cat] = (cnt[i.cat] || 0) + 1; });
  $('#fcats').innerHTML = C.ORDER.map(k => '<button type="button" class="chip" data-cat="' + k + '" aria-pressed="' + !!S.f.cats[k] + '"><i style="background:' + C.CATS[k].col + '"></i>' + C.CATS[k].name + (S.done ? '<em>' + (cnt[k] || 0) + '</em>' : '') + '</button>').join('');
  segSync('#fknown', S.f.known); segSync('#fsize', String(S.f.size));
  $('#fnames').checked = !!S.f.names; $('#fbrown').checked = !!S.f.brown;
  $('#aikey').value = store.get('aikey', '');
  segSync('#faimodel', store.get('aimodel', C.AI_DEFAULT));
}
export function fdot() { $('#fbtn').dataset.on = String(S.f.known !== 'unknown' || S.f.size > 0 || C.ORDER.some(k => !S.f.cats[k])); }
export function openFilters(section) {
  renderFilters(); fl.hidden = false;
  if (section === 'ki') { $('#kih').scrollIntoView({ block: 'start' }); $('#aikey').focus({ preventScroll: true }); return; }
  fl.querySelector('.fpanel').scrollTop = 0;
  const first = fl.querySelector('.chip');
  if (first) first.focus({ preventScroll: true });
}
function saveKey() {
  const v = $('#aikey').value.trim();
  if (v === store.get('aikey', '')) return;
  store.set('aikey', v);
  if (S.sel) { const keep = body.scrollTop; render(); body.scrollTop = keep; }
}
export function closeFilters() { saveKey(); fl.hidden = true; $('#fbtn').focus(); }
$('#fbtn').addEventListener('click', () => openFilters());
$('#aikey').addEventListener('change', saveKey);
$('#aikeydel').addEventListener('click', () => { $('#aikey').value = ''; saveKey(); toast('API-Schlüssel gelöscht.'); });
$('#fdone').addEventListener('click', closeFilters);
fl.addEventListener('click', e => {
  if (e.target === fl) { closeFilters(); return; }
  const ch = e.target.closest('.chip');
  if (ch) { const k = ch.dataset.cat; S.f.cats[k] = !S.f.cats[k]; renderFilters(); apply(); return; }
  const sb = e.target.closest('.seg button');
  if (sb && sb.parentElement.id === 'faimodel') { store.set('aimodel', sb.dataset.v); renderFilters(); return; }
  if (sb) { if (sb.parentElement.id === 'fknown') S.f.known = sb.dataset.v; else S.f.size = +sb.dataset.v; renderFilters(); apply(); }
});
$('#fnames').addEventListener('change', e => { S.f.names = e.target.checked; S.box = null; store.set('filters2',S.f); updPill(); });
$('#fbrown').addEventListener('change', e => { S.f.brown = e.target.checked; if (S.f.brown) S.f.cats.brach = true; S.box = null; store.set('filters2',S.f); renderFilters(); updPill(); });
