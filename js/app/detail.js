// Lost Radar – Detailansicht eines Fundes und Auswahl

import * as C from '../core/index.js';
import { esc, title, S, wide } from './state.js';
import { map, selMk } from './map.js';
import { sheetSt, shPx, setSheet } from './sheet.js';
import { render } from './list.js';
import { chkHTML, notLost, runCheck } from './check.js';
import { aiHTML } from './ai.js';
import { revgeo } from './geocode.js';

const ACCESS = { private: 'privat', no: 'kein Zutritt', permissive: 'geduldet', yes: 'öffentlich', customers: 'nur Kunden', military: 'militärisch', forestry: 'nur Forstwirtschaft', agricultural: 'nur Landwirtschaft', destination: 'nur Anlieger', delivery: 'nur Lieferverkehr' };
export function knownUrl(it) {
  const g = S.geo[it.id], nm = it.name || (it.old || '').split(' / ')[0], city = (g && g.city) || '';
  const q = nm ? '"' + nm + '" ' + city + ' lost place' : 'lost place ' + it.label + ' ' + city;
  return 'https://www.google.com/search?q=' + encodeURIComponent(q.trim());
}
const STAR = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
const BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
export function detailHTML(it) {
  const t = it.tags || {}, c = C.CATS[it.cat], fav = !!S.favs[it.id], g = S.geo[it.id];
  const ll = it.lat.toFixed(5) + ', ' + it.lon.toFixed(5);
  const gm = 'https://www.google.com/maps/@?api=1&map_action=';
  const facts = [
    ['Größe', esc(C.fmtArea(it) || 'unbekannt, nur als Punkt erfasst')],
    ['Ort', '<span id="where">' + esc(g ? g.txt : 'wird ermittelt …') + '</span>'],
    ['Koordinaten', '<span class="nw">' + ll + '</span><button type="button" class="mini" data-act="copy">Kopieren</button>'],
    t.access ? ['Zugang', esc((ACCESS[t.access] || t.access) + ' (laut OSM)')] : null,
    t.start_date ? ['Gebaut', esc(t.start_date)] : null,
    t.end_date ? ['Aufgegeben', esc(t.end_date)] : null,
    it.name && it.old ? ['Früher', esc(it.old)] : null,
    t.operator ? ['Betreiber', esc(t.operator)] : null,
    (t.heritage || t['heritage:operator']) ? ['Denkmal', 'ja'] : null,
    (t.description || t.note) ? ['Notiz', esc(t.description || t.note)] : null
  ].filter(Boolean);
  const why = it.why && it.why.length ? it.why : [[0, 'keine Auffälligkeiten, Grundwert 50']];
  const keys = Object.keys(t).sort();
  return '<div class="det">' +
    '<button type="button" class="back" data-act="back">' + BACK + (S.tab === 'favs' ? 'Merkliste' : 'Alle Funde') + '</button>' +
    '<div class="kind"><i class="dot" style="background:' + c.col + '"></i>' + esc(c.name) + '</div>' +
    '<div class="ttl"><div><h2>' + esc(title(it)) + '</h2><p class="sub">' + esc([it.name ? it.label : null, it.state || 'Zustand unbekannt'].filter(Boolean).join(' · ')) + '</p></div>' +
    '<button type="button" class="star" data-act="fav" aria-pressed="' + fav + '" aria-label="' + (fav ? 'Aus Merkliste entfernen' : 'Merken') + '">' + STAR + '</button></div>' +
    '<div class="meter"><em class="sc' + (it.score >= 70 ? ' top' : '') + '">' + it.score + '</em><div><strong>' + (notLost(it) ? 'Eher kein Lost Place' : C.tier(it.score)) + '</strong><div class="bar"><i style="width:' + it.score + '%"></i></div></div></div>' +
    chkHTML(it) + aiHTML(it) +
    '<dl class="facts">' + facts.map(f => '<dt>' + f[0] + '</dt><dd>' + f[1] + '</dd>').join('') + '</dl>' +
    '<div class="links">' +
      '<button type="button" class="lnk main" data-act="sat">Luftbild hier</button>' +
      '<a class="lnk" href="' + gm + 'map&center=' + it.lat + ',' + it.lon + '&zoom=18&basemap=satellite" target="_blank" rel="noopener">Google Maps</a>' +
      '<a class="lnk" href="' + gm + 'pano&viewpoint=' + it.lat + ',' + it.lon + '" target="_blank" rel="noopener">Street View</a>' +
      '<a class="lnk" id="known" href="' + esc(knownUrl(it)) + '" target="_blank" rel="noopener">Schon bekannt?</a>' +
      '<a class="lnk" href="https://www.google.com/maps/dir/?api=1&destination=' + it.lat + ',' + it.lon + '" target="_blank" rel="noopener">Route</a>' +
      '<a class="lnk" href="https://www.openstreetmap.org/' + it.type + '/' + it.osm + '" target="_blank" rel="noopener">OSM-Eintrag</a>' +
    '</div>' +
    '<h4>So kommt der Score zustande</h4><ul class="why">' + why.map(w => '<li><span>' + esc(w[1]) + '</span><b class="' + (w[0] > 0 ? 'p' : w[0] < 0 ? 'm' : '') + '">' + (w[0] > 0 ? '+' + w[0] : w[0] < 0 ? '−' + Math.abs(w[0]) : '') + '</b></li>').join('') + '</ul>' +
    '<details class="tags"><summary>Alle OSM-Tags (' + keys.length + ')</summary><div class="scroll"><table>' + keys.map(k => '<tr><td>' + esc(k) + '</td><td>' + esc(t[k]) + '</td></tr>').join('') + '</table></div></details>' +
    '</div>';
}
export function focusOn(it, z) {
  const top = wide() ? 70 : 120, bottom = wide() ? 0 : shPx(sheetSt);
  if (!z) {
    const pt = map.latLngToContainerPoint([it.lat, it.lon]), H = map.getSize().y;
    if (pt.y > top && pt.y < H - bottom - 20) return;
    z = map.getZoom();
  }
  const p = map.project([it.lat, it.lon], z);
  p.y += (bottom - top) / 2;
  map.setView(map.unproject(p, z), z);
}
export function select(id, fromList) {
  const it = S.items.find(x => x.id === id) || S.favs[id];
  if (!it) return;
  S.sel = it; render(true);
  selMk.setLatLng([it.lat, it.lon]);
  if (!map.hasLayer(selMk)) selMk.addTo(map);
  if (!wide() && sheetSt === 'peek') setSheet('half');
  focusOn(it, fromList ? Math.max(map.getZoom(), 16) : null);
  revgeo(it);
  if (!it.chk && !it.chkRun && C.checkable(it)) runCheck([it], false);
}
export function unselect() { S.sel = null; map.removeLayer(selMk); render(true); }
