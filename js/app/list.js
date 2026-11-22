// Lost Radar – Liste und Punkte auf der Karte: filtern, sortieren, zeichnen

import * as C from '../core/index.js';
import { $, esc, title, store, S } from './state.js';
import { map, renderer, dots, rad } from './map.js';
import { sheet, body } from './sheet.js';
import { detailHTML, select } from './detail.js';
import { CHK_SHORT } from './check.js';
import { fdot } from './filters.js';

function drawDots() {
  dots.clearLayers();
  const arr = S.view.slice().sort((a, b) => a.score - b.score);
  for (const it of arr) {
    const top = it.score >= 70;
    const m = L.circleMarker([it.lat, it.lon], {
      renderer, radius: rad(it) + (top ? 1 : 0), color: top ? '#14130a' : '#ffffff', weight: top ? 2.5 : 1.5,
      fillColor: C.CATS[it.cat].col, fillOpacity: 0.95, bubblingMouseEvents: false
    });
    m.on('click', () => select(it.id, false));
    dots.addLayer(m);
  }
}

export function sortView() {
  const c = map.getCenter();
  for (const it of S.view) it.dist = C.dist(c.lat, c.lng, it.lat, it.lon);
  const by = {
    score: (a, b) => b.score - a.score || (b.area || 0) - (a.area || 0),
    size: (a, b) => (b.area || b.len || 0) - (a.area || a.len || 0),
    dist: (a, b) => a.dist - b.dist
  };
  S.view.sort(by[S.f.sort] || by.score);
}
export function apply(reset) {
  const f = S.f, min = f.known === 'secret' ? 70 : f.known === 'unknown' ? 45 : 0;
  S.view = S.items.filter(it => f.cats[it.cat] && it.score >= min && (it.area == null || it.area >= f.size));
  sortView(); drawDots(); render(reset); store.set('filters2',f); fdot();
}
export function counts() {
  if (S.busy) return 'sucht …';
  if (!S.done) return 'noch nicht gesucht';
  const top = S.items.filter(i => i.score >= 70).length;
  return S.items.length + ' Funde · ' + top + ' Geheimtipps' + (S.chkBusy ? ' · Gegencheck …' : '');
}
function sub(it) {
  const c = map.getCenter();
  const ai = it.ai && C.AI_STATUS[it.ai.s] && C.AI_STATUS[it.ai.s].s;
  return [it.name ? it.label : null, ai || (it.chk && CHK_SHORT[it.chk.v]) || it.state, C.fmtArea(it), C.fmtDist(C.dist(c.lat, c.lng, it.lat, it.lon))].filter(Boolean).join(' · ');
}
const row = it => '<button type="button" class="row" data-id="' + esc(it.id) + '"><i class="dot" style="background:' + C.CATS[it.cat].col + '"></i>' +
  '<span class="rt"><b>' + esc(title(it)) + '</b><span>' + esc(sub(it)) + '</span></span>' +
  '<em class="sc' + (it.score >= 70 ? ' top' : '') + '" title="Geheimtipp-Score">' + it.score + '</em></button>';
const legend = () => '<ul class="legend">' + C.ORDER.map(k => '<li><i class="dot" style="background:' + C.CATS[k].col + '"></i>' + C.CATS[k].name + '</li>').join('') + '</ul>';
function listHTML() {
  if (S.busy && !S.items.length) return '<div class="empty"><b>Suche läuft</b><p>Die App fragt gerade die öffentlichen OSM-Server ab. Das dauert meist 5 bis 30 Sekunden. Antwortet ein Server nicht, probiert sie automatisch den nächsten.</p></div>';
  if (S.err && !S.items.length) return '<div class="empty"><b>Hat nicht geklappt</b><p>' + esc(S.err) + '</p><button type="button" class="lnk main" data-act="retry">Nochmal versuchen</button></div>';
  if (!S.done) return '<div class="empty"><b>So geht’s</b><p>Karte auf eine Gegend schieben, etwa so groß wie ein Landkreis, und auf „Hier suchen“ tippen. Die App fragt OpenStreetMap live ab und zeigt alles, was dort als verlassen, stillgelegt oder Ruine eingetragen ist.</p>' + legend() + '<p class="small">Schwarzer Rand am Punkt = Geheimtipp (Score ab 70).</p></div>';
  if (!S.items.length) return '<div class="empty"><b>Nichts gefunden</b><p>In diesem Ausschnitt ist in OpenStreetMap nichts als verlassen oder stillgelegt markiert. Schieb die Karte weiter oder zoom etwas raus.</p></div>';
  if (!S.view.length) return '<div class="empty"><b>Alles weggefiltert</b><p>' + S.items.length + ' Funde sind da, aber deine Filter blenden alle aus.</p><button type="button" class="lnk" data-act="filters">Filter lockern</button></div>';
  const rest = S.view.length - S.limit;
  return '<p class="lh">' + S.view.length + ' von ' + S.items.length + ' angezeigt</p>' + S.view.slice(0, S.limit).map(row).join('') +
    (rest > 0 ? '<button type="button" class="more" data-act="more">' + rest + ' weitere anzeigen</button>' : '');
}
function favHTML() {
  const list = Object.values(S.favs).sort((a, b) => (b.t || 0) - (a.t || 0));
  if (!list.length) return '<div class="empty"><b>Noch nichts gemerkt</b><p>Tipp bei einem Ort auf den Stern. Die Merkliste bleibt in diesem Browser gespeichert und lässt sich als GPX exportieren, etwa für OsmAnd oder Komoot.</p></div>';
  return '<div class="favbar"><button type="button" class="lnk" data-act="gpx">Als GPX speichern</button><button type="button" class="lnk" data-act="copyall">Liste kopieren</button></div>' + list.map(row).join('');
}

export function render(reset) {
  $('#count').textContent = counts();
  const n = Object.keys(S.favs).length;
  $('#favn').textContent = n ? '(' + n + ')' : '';
  $('#t-list').setAttribute('aria-selected', String(S.tab === 'list'));
  $('#t-favs').setAttribute('aria-selected', String(S.tab === 'favs'));
  $('#sort').value = S.f.sort;
  sheet.classList.toggle('detail', !!S.sel);
  body.innerHTML = S.sel ? detailHTML(S.sel) : S.tab === 'favs' ? favHTML() : listHTML();
  if (reset) body.scrollTop = 0;
}
