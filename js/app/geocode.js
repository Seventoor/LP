// Lost Radar – Ortssuche, Standort und Reverse-Geocoding (Photon)

import * as C from '../core/index.js';
import { $, esc, S, wide, toast } from './state.js';
import { map, selMk, bboxOf } from './map.js';
import { sheetSt, shPx } from './sheet.js';
import { scan } from './scan.js';
import { knownUrl } from './detail.js';

// Ein Abruf pro Ort; der KI-Check wartet darauf, um die Adresse mitzuschicken
export const revgeo = it => S.geoP[it.id] || (S.geoP[it.id] = geoLookup(it));
async function geoLookup(it) {
  if (S.geo[it.id]) return;
  S.geo[it.id] = { txt: 'wird ermittelt …', city: '' };
  try {
    const r = await fetch('https://photon.komoot.io/reverse?lat=' + it.lat + '&lon=' + it.lon + '&lang=de&limit=1');
    const j = await r.json();
    const p = ((j.features || [])[0] || {}).properties || {};
    const place = p.city || p.town || p.village || p.locality || p.district || '';
    const txt = [p.street ? p.street + (p.housenumber ? ' ' + p.housenumber : '') : null,
      [p.postcode, place].filter(Boolean).join(' ') || null,
      p.county && p.county !== place ? p.county : null].filter(Boolean).join(', ');
    S.geo[it.id] = { txt: txt || 'unbekannt', city: place, cc: (p.countrycode || '').toUpperCase(), ok: !!txt };
  } catch (e) {
    S.geo[it.id] = { txt: 'nicht ermittelbar', city: '' };
  }
  if (S.sel && S.sel.id === it.id) {
    const w = $('#where'), k = $('#known');
    if (w) w.textContent = S.geo[it.id].txt;
    if (k) k.href = knownUrl(it);
  }
}

let gT = null, gCtl = null, sugg = [];
const qEl = $('#q'), sgEl = $('#sugg');
export function hideSugg() { sgEl.hidden = true; }
function showSugg() {
  sgEl.innerHTML = sugg.length ? sugg.map((s, i) => '<button type="button" data-i="' + i + '">' + esc(s.name) + '<small>' + esc(s.sub) + '</small></button>').join('') : '<p>Kein Ort gefunden.</p>';
  sgEl.hidden = false;
}
async function geocode(v, pickFirst) {
  if (gCtl) gCtl.abort();
  gCtl = new AbortController();
  try {
    const r = await fetch('https://photon.komoot.io/api/?lang=de&limit=6&bbox=5.8,47.2,15.1,55.1&q=' + encodeURIComponent(v), { signal: gCtl.signal });
    const j = await r.json();
    sugg = (j.features || []).map(f => {
      const p = f.properties || {};
      return { name: p.name || v, sub: [p.postcode, p.city && p.city !== p.name ? p.city : null, p.county, p.state].filter(Boolean).join(', '),
        lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], ext: p.extent };
    });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    sugg = []; toast('Die Ortssuche ist gerade nicht erreichbar.'); return;
  }
  if (pickFirst && sugg[0]) pick(0); else showSugg();
}
function pick(i) {
  const s = sugg[i];
  if (!s) return;
  hideSugg(); qEl.blur(); S.sel = null; map.removeLayer(selMk);
  const pad = { paddingTopLeft: [0, wide() ? 60 : 110], paddingBottomRight: [0, wide() ? 0 : shPx(sheetSt)], maxZoom: 13, animate: false };
  if (s.ext) map.fitBounds([[s.ext[3], s.ext[0]], [s.ext[1], s.ext[2]]], pad);
  else map.setView([s.lat, s.lon], 12, { animate: false });
  if (C.areaKm2(bboxOf()) > C.MAX_KM2) { map.setView([s.lat, s.lon], wide() ? 10 : 9, { animate: false }); }
  scan();
}
qEl.addEventListener('input', () => {
  clearTimeout(gT);
  const v = qEl.value.trim();
  if (v.length < 3) { hideSugg(); return; }
  gT = setTimeout(() => geocode(v, false), 350);
});
qEl.addEventListener('keydown', e => { if (e.key === 'Escape') hideSugg(); });
$('#bar').addEventListener('submit', e => {
  e.preventDefault();
  const v = qEl.value.trim();
  if (!v) return;
  clearTimeout(gT);
  if (!sgEl.hidden && sugg[0]) pick(0); else geocode(v, true);
});
sgEl.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) pick(+b.dataset.i); });
map.on('click', hideSugg);
$('#loc').addEventListener('click', () => {
  if (!navigator.geolocation) { toast('Dieser Browser kann keinen Standort liefern.'); return; }
  toast('Suche deinen Standort …');
  navigator.geolocation.getCurrentPosition(p => {
    S.sel = null; map.removeLayer(selMk);
    map.setView([p.coords.latitude, p.coords.longitude], 12, { animate: false });
    scan();
  }, () => toast('Kein Standort: Freigabe verweigert oder nicht verfügbar.'), { timeout: 12000, maximumAge: 300000 });
});
