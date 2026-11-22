// Lost Radar – Gegencheck: Was verzeichnet OSM heute auf dem Gelände eines Fundes?
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

import { actOf } from './classify.js';
import { dist } from './format.js';
import { ACT } from './tags.js';

export const CHECK_MAX_M2 = 1e6, NEAR_M = 30;

// Flächen bis 1 km² (keine Tunnel, keine riesigen Übungsplätze) und Punkte (dann im Umkreis von NEAR_M)
export function checkable(it) {
  if (it.len) return false;
  if (it.type === 'node') return true;
  if (it.area == null || it.area > CHECK_MAX_M2) return false;
  return it.type === 'way' || /^(multipolygon|boundary)$/.test((it.tags || {}).type || '');
}

function rx(o) { return '"^(' + Object.keys(o).join('|') + ')$"'; }
export function checkQuery(items) {
  var w = [], r = [], n = [], q = ['[out:json][timeout:25];'], parts = [];
  items.forEach(function (it) { (it.type === 'way' ? w : it.type === 'relation' ? r : n).push(it.osm); });
  function sel(s) {
    return ['shop', 'office', 'craft', 'healthcare', 'club'].map(function (k) { return 'nwr(' + s + ')[' + k + ']'; })
      .concat(['amenity', 'tourism', 'leisure'].map(function (k) { return 'nwr(' + s + ')[' + k + '~' + rx(ACT[k]) + ']'; }))
      .concat(['way(' + s + ')[building=construction]', 'rel(' + s + ')[building=construction]',
        'way(' + s + ')[landuse~"^(construction|residential)$"]', 'rel(' + s + ')[landuse~"^(construction|residential)$"]'])
      .join(';\n  ');
  }
  if (w.length) q.push('way(id:' + w.join(',') + ')->.w;');
  if (r.length) q.push('rel(id:' + r.join(',') + ')->.r;');
  if (w.length || r.length) {
    var c = (w.length ? '.w;' : '') + (r.length ? '.r;' : '');
    // Umrisse für die Punkt-in-Fläche-Prüfung, dann die Flächen selbst (geschlossene Wege, äußere Ringe)
    q.push('(' + c + ')->.c;', '.c out skel geom qt;', '(' + c + (r.length ? 'way(r.r:"outer");' : '') + ')->.o;',
      '.o map_to_area->.a;', '.a out ids;');
    parts.push(sel('area.a'));
  }
  if (n.length) { q.push('node(id:' + n.join(',') + ')->.p;'); parts.push(sel('around.p:' + NEAR_M)); }
  q.push('(\n  ' + parts.join(';\n  ') + ';\n)->.x;', 'node.x;out body qt;', '(way.x;rel.x;);out tags center qt;');
  return q.join('\n');
}

function ringsOf(g) {
  if (g.type === 'way') return g.geometry ? [g.geometry] : [];
  return (g.members || []).filter(function (m) { return m.type === 'way' && m.geometry; }).map(function (m) { return m.geometry; });
}
// Gerade-ungerade-Regel über alle Segmente; funktioniert auch für Ringe aus mehreren Wegen und Innenhöfe
function inside(lat, lon, rings) {
  var c = false;
  rings.forEach(function (g) {
    for (var i = 1; i < g.length; i++) {
      var a = g[i - 1], b = g[i];
      if (a && b && (a.lat > lat) !== (b.lat > lat) && lon < (b.lon - a.lon) * (lat - a.lat) / (b.lat - a.lat) + a.lon) c = !c;
    }
  });
  return c;
}

function judge(it, found) {
  var act = found.filter(function (a) { return !a.bau; }).length, bau = found.length - act, ha = (it.area || 0) / 10000, v;
  // „Belebte Lage“ nur bei Läden und Lokalen; ein Bunker an einer belebten Straße bleibt ein Bunker
  if (it.type === 'node') v = act >= 3 && /^(amenity|shop|office|craft|tourism|leisure)$/.test(it.k) ? 'busy' : act ? 'near' : bau ? 'bau' : 'none';
  else if (act && (ha < 1 || act >= Math.max(2, Math.ceil(ha / 5)))) v = 'reuse';
  else if (bau) v = 'bau';
  else v = act ? 'part' : 'none';
  // Kurzliste: Benanntes zuerst, Baustellen zuletzt, Gleiches zusammengefasst
  var cnt = {}, ord = [];
  found.forEach(function (a) {
    var x = a.n ? (a.n.toLowerCase().indexOf(a.l.toLowerCase()) >= 0 ? a.n : a.l + ' „' + a.n + '“') : a.l;
    if (!cnt[x]) { cnt[x] = 0; ord.push({ x: x, r: (a.bau ? 2 : 0) + (a.n ? 0 : 1) }); }
    cnt[x]++;
  });
  ord.sort(function (a, b) { return a.r - b.r; });
  var list = ord.map(function (o) { return (cnt[o.x] > 1 ? cnt[o.x] + '× ' : '') + o.x; });
  return { v: v, n: act, b: bau, list: list.slice(0, 8), more: Math.max(0, list.length - 8), t: Date.now() };
}

// Antwort auswerten: pro Fund ein Ergebnis. skip: IDs, die selbst Funde sind und nicht als Betrieb zählen
export function checkRead(items, els, skip) {
  var geom = {}, ok = {}, feats = [], seen = {}, res = {};
  (els || []).forEach(function (e) {
    var id = e.type.charAt(0) + e.id;
    if (e.type === 'area') { ok[e.id >= 3600000000 ? 'r' + (e.id - 3600000000) : 'w' + (e.id - 2400000000)] = 1; return; }
    if (e.geometry || e.members) { geom[id] = e; return; }
    if (!e.tags) { if (e.lat == null && !e.center) ok[id] = 1; return; }
    if (seen[id] || (skip && skip[id])) return;
    seen[id] = 1;
    var a = actOf(e.tags), pt = e.center || e;
    if (a && pt.lat != null) feats.push({ lat: pt.lat, lon: pt.lon, a: a });
  });
  items.forEach(function (it) {
    var found = [];
    if (it.type === 'node') {
      feats.forEach(function (f) { if (!f.a.wohn && dist(it.lat, it.lon, f.lat, f.lon) <= NEAR_M + 5) found.push(f.a); });
    } else {
      var g = geom[it.id], b = it.b, rings = g ? ringsOf(g) : [];
      var done = ok[it.id] || (g && g.members || []).some(function (m) { return m.type === 'way' && ok['w' + m.ref]; });
      if (!rings.length || !done) { res[it.id] = { v: 'na', n: 0, b: 0, list: [], more: 0, t: Date.now() }; return; }
      feats.forEach(function (f) {
        if (b && (f.lat < b.minlat || f.lat > b.maxlat || f.lon < b.minlon || f.lon > b.maxlon)) return;
        if (inside(f.lat, f.lon, rings)) found.push(f.a);
      });
    }
    res[it.id] = judge(it, found);
  });
  return res;
}
