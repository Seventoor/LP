// Lost Radar – Suche: Knopf „Hier suchen“, Overpass-Abfrage, Fehlermeldungen

import * as C from '../core/index.js';
import { $, store, S, wide, toast } from './state.js';
import { map, selMk, bboxOf } from './map.js';
import { sheetSt, setSheet } from './sheet.js';
import { apply, counts, render } from './list.js';
import { startCheck } from './check.js';
import { hideSugg } from './geocode.js';

const scanBtn = $('#scan'), scanLbl = $('#scanlbl');
export function updPill() {
  if (S.busy) {
    const sec = Math.round((Date.now() - S.t0) / 1000);
    scanBtn.dataset.s = 'busy';
    scanLbl.textContent = 'Sucht … ' + sec + ' s' + (S.try > 1 ? ' · Server ' + S.try : '') + ' · abbrechen';
    return;
  }
  if (C.areaKm2(bboxOf()) > C.MAX_KM2) { scanBtn.dataset.s = 'zoom'; scanLbl.textContent = 'Zum Suchen näher ranzoomen'; return; }
  if (S.box && S.box.contains(map.getBounds())) { scanBtn.dataset.s = 'hide'; return; }
  scanBtn.dataset.s = 'go'; scanLbl.textContent = S.done ? 'Hier neu suchen' : 'Hier suchen';
}
scanBtn.addEventListener('click', () => { if (scanBtn.dataset.s === 'zoom') map.zoomIn(); else scan(); });

function errText(e) {
  const s = e && e.status;
  if (e && (e.timeout || e.overload)) return 'Alle OSM-Server waren zu langsam oder überlastet. Zoom etwas näher ran und versuch es gleich nochmal.';
  if (s === 429) return 'Die OSM-Server bremsen gerade (zu viele Anfragen). Eine Minute warten, dann nochmal.';
  if (s === 504 || s === 503) return 'Die OSM-Server sind überlastet. Näher ranzoomen oder gleich nochmal versuchen.';
  if (s === 400) return 'Die Abfrage wurde abgelehnt (Fehler 400).';
  if (s) return 'OSM-Server-Fehler (' + s + ').';
  return 'Keine Verbindung zu den OSM-Servern. Internet an? Ein Werbe- oder DNS-Blocker kann die Abfrage auch blockieren.';
}
export async function scan() {
  if (S.busy) { S.busy.abort(); return; }
  if (S.chkBusy) S.chkBusy.abort();
  const bb = bboxOf();
  if (C.areaKm2(bb) > C.MAX_KM2) { toast('Ausschnitt zu groß. Bitte näher ranzoomen.'); updPill(); return; }
  hideSugg();
  const ctl = new AbortController();
  S.busy = ctl; S.t0 = Date.now(); S.try = 1; S.err = null;
  const tick = setInterval(updPill, 1000);
  updPill(); $('#count').textContent = 'sucht …';
  if (!S.sel && !S.items.length) render();
  try {
    const j = await C.overpass(C.buildQuery(bb, S.f), ctl.signal, n => { S.try = n; updPill(); });
    S.items = C.process(j.elements || []);
    const ki = store.get('ki', {}) || {};
    for (const it of S.items) if (ki[it.id]) C.applyAI(it, ki[it.id]);
    S.box = map.getBounds(); S.done = true; S.sel = null; S.tab = 'list'; S.limit = 150;
    map.removeLayer(selMk);
    if (j.remark && /timed out|runtime|memory/i.test(j.remark)) toast('Zeitlimit des Servers erreicht, Ergebnis evtl. unvollständig. Kleineren Ausschnitt probieren.');
    else if (!S.items.length) toast('Hier ist in OSM nichts als verlassen eingetragen.');
    apply(true);
    if (!wide() && sheetSt === 'peek') setSheet('half');
    startCheck();
  } catch (e) {
    if (e && e.name === 'AbortError') toast('Suche abgebrochen.');
    else { S.err = errText(e); if (S.items.length) toast(S.err); }
  } finally {
    clearInterval(tick);
    S.busy = null; updPill();
    if (!S.sel) render(); else $('#count').textContent = counts();
  }
}
