// Lost Radar – OSM-Objekte einordnen: frühere Nutzung, Kategorie, Zustand, Geheimtipp-Score
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

import { fmtArea } from './format.js';
import { ACT, CHG, DROPV, EHEM, GEN, GONE, KEEPV, KEYS, LAB, LIFE, SKIP, SMALLA, SMALLB } from './tags.js';

function what(t) {
  var i, j, k, v;
  if (t.tunnel === 'yes' && (/^(abandoned|disused)$/.test(t.railway || '') || t['abandoned:railway'] || t['disused:railway']))
    return { k: 'railway', v: 'tunnel', p: 'abandoned' };
  for (i = 0; i < LIFE.length; i++) for (j = 0; j < KEYS.length; j++) {
    k = KEYS[j]; v = t[LIFE[i] + ':' + k];
    if (v && v !== 'no' && !(k === 'building' && v === 'yes')) return { k: k, v: v, p: LIFE[i] };
  }
  for (j = 0; j < KEYS.length; j++) {
    k = KEYS[j]; v = t[k];
    if (!v || v === 'no' || (SKIP[k] && SKIP[k][v])) continue;
    return { k: k, v: v, p: null };
  }
  for (i = 0; i < LIFE.length; i++) if (t[LIFE[i] + ':building']) return { k: 'building', v: 'yes', p: LIFE[i] };
  if (t.building && t.building !== 'no') return { k: 'building', v: t.building, p: null };
  return null;
}

function valid(w, area, t) {
  var k = w.k, v = w.v;
  if (t && t.indoor && t.indoor !== 'no') return false; // leerer Laden o. Ä. in einem Gebäude, das noch in Betrieb ist
  if (DROPV[k] && DROPV[k][v]) return false;
  if (KEEPV[k] && !KEEPV[k][v]) return false;
  if (k === 'shop' && !(area >= 600)) return false;
  if (k === 'office' && !(area >= 300)) return false;
  if (k === 'building' && SMALLB[v] && !(area >= 150)) return false;
  if (k === 'building' && area != null && area < 20) return false;
  return true;
}

function catOf(w, t) {
  var k = w.k, v = w.v, b = t.building || '', h = t.historic || '', nm = (t.name || '') + ' ' + (t.old_name || '');
  if (k === 'landuse' && v === 'brownfield') return 'brach';
  if (k === 'military' || t.bunker_type || /^(bunker|military|barracks)$/.test(b) || /^(bunker|fort)$/.test(h) ||
    (k === 'landuse' && v === 'military')) return 'mil';
  if (k === 'railway' || b === 'train_station' || h === 'railway_station' || (k === 'landuse' && v === 'railway')) return 'bahn';
  if (k === 'amenity' || k === 'tourism' || k === 'leisure' || k === 'shop' || k === 'office') return 'pub';
  if (k === 'man_made' || k === 'industrial' || k === 'power' || k === 'craft' || k === 'aeroway' ||
    (k === 'landuse' && /^(industrial|quarry|landfill|commercial|retail)$/.test(v)) ||
    (k === 'historic' && /^(mine|mine_shaft|mine_adit|factory|mill|watermill|windmill|technical_monument|kiln|lime_kiln|aircraft|locomotive|tank|ship|wreck)$/.test(v))) return 'ind';
  if (k === 'building') {
    if (/^(industrial|factory|warehouse|manufacture|silo|transformer_tower|storage_tank|hangar|digester|water_tower|service)$/.test(v)) return 'ind';
    if (/^(hospital|school|hotel|church|chapel|cathedral|religious|monastery|public|civic|government|kindergarten|university|college|sports_hall|stadium|retail|commercial|office|dormitory|supermarket|cinema|fire_station|prison)$/.test(v)) return 'pub';
  }
  if (k === 'historic' && /^(church|monastery|chapel)$/.test(v)) return 'pub';
  if (/kaserne|bunker|fliegerhorst|munition|flak|raketen|stellung|wehrmacht|sowjet|nato\b|militär/i.test(nm)) return 'mil';
  if (/bahnhof|stellwerk|lokschuppen|bahnbetriebswerk|güterschuppen/i.test(nm)) return 'bahn';
  if (/fabrik|werk\b|werke\b|mühle|brauerei|zeche|hütte\b|ziegelei|molkerei|spinnerei|weberei|sägewerk|kraftwerk|gaswerk|schlachthof|silo|kühlhaus|bergwerk|grube\b|wasserturm/i.test(nm)) return 'ind';
  if (/klinik|krankenhaus|sanatorium|heilstätte|hotel|pension|gasthof|gasthaus|gaststätte|kurhaus|schule|kino|bad\b|kirche|kapelle|kloster|ferienlager|jugendherberge|kaufhaus|disco|diskothek|tanzsaal|heim\b/i.test(nm)) return 'pub';
  if (h === 'ruins' || b === 'ruins' || (t.ruins && t.ruins !== 'no') || w.p === 'ruins') return 'ruin';
  return 'bau';
}

function stateOf(w, t) {
  var bc = t['building:condition'] || t.condition || '';
  if (w.p === 'ruins' || t.building === 'ruins' || (t.ruins && t.ruins !== 'no') || t.historic === 'ruins' ||
    t['ruins:building'] || /ruin|collapsed/.test(bc) || t.building === 'collapsed') return 'Ruine';
  if (w.p === 'abandoned' || t.abandoned === 'yes' || t.building === 'abandoned' || t['abandoned:building']) return 'verlassen';
  if ((w.p === 'disused' || (!w.p && t.disused === 'yes')) &&
    (w.k === 'shop' || w.k === 'office' || w.k === 'craft' || (w.k === 'amenity' && SMALLA[w.v]))) return 'Leerstand';
  if (w.p === 'disused' || t.disused === 'yes' || t['disused:building']) return 'stillgelegt';
  if (/derelict|deteriorat|poor|bad/.test(bc) || t.building === 'damaged') return 'baufällig';
  if (w.k === 'landuse' && w.v === 'brownfield') return 'Brache';
  if (EHEM.test(t.name || '')) return 'ehemalig';
  return null;
}

function labelOf(w, t, area) {
  var d = LAB[w.k], l = (d && d[w.v]) || GEN[w.k] || 'Objekt';
  if (w.k === 'historic' && w.v === 'ruins' && (t.castle_type || t.ruins === 'castle' || /(^|[\s-])(burg|schloss)/i.test(t.name || ''))) l = 'Burgruine';
  if (w.k === 'building' && (w.v === 'yes' || w.v === 'abandoned') && area >= 1500) l = 'Großes Gebäude';
  if (w.k === 'man_made' && w.v === 'tower' && t['tower:type'] === 'cooling') l = 'Kühlturm';
  if (w.k === 'man_made' && w.v === 'mineshaft' && t.headframe === 'yes') l = 'Förderturm';
  return l;
}

function hasPrefix(t, p) { for (var k in t) if (k.indexOf(p) === 0) return true; return false; }

// Früherer Name, auch wenn er nur mit Lifecycle-Präfix eingetragen ist (abandoned:name=Kellogg's)
function oldName(t) {
  var n = t.old_name || t['abandoned:name'] || t['disused:name'] || t['was:name'] || t['ruins:name'] || t['historic:name'];
  return n ? String(n).split(';').join(' / ') : null;
}
// Notizen ohne verneinte Stellen („nicht saniert“, „unsaniert“)
function noteOf(t) {
  return [t.note, t['note:de'], t.description, t['description:de'], t.fixme, t.FIXME].filter(Boolean).join(' ')
    .replace(/(nicht|kein\w*)\s+(\S+\s+)?(saniert|renoviert|abgerissen|umgebaut|umgenutzt)/gi, '')
    .replace(/un(saniert|renoviert)/gi, '');
}

// Ist dieses Objekt eine aktive Nutzung (Laden, Firma, Schule, Hotel …) oder eine Baustelle?
// own: das gefundene Objekt selbst prüfen, dann zählen Baustelle/Wohngebiet/Sehenswürdigkeit nicht
export function actOf(t, own) {
  if (!t || t.disused === 'yes' || t.abandoned === 'yes' || (t.ruins && t.ruins !== 'no') || t.historic === 'ruins' ||
    /^(ruins|abandoned|collapsed|damaged)$/.test(t.building || '')) return null;
  var nm = t.name || t.brand || null, v;
  if (!own && (t.building === 'construction' || t.landuse === 'construction')) return { bau: 1, l: 'Baustelle', n: t.name || null };
  if (!own && t.landuse === 'residential') return { wohn: 1, l: 'Wohngebiet', n: t.name || null };
  if ((v = t.shop) && !/^(vacant|no|disused|abandoned|closed|empty)$/.test(v)) return { l: LAB.shop[v] || 'Laden', n: nm, v: v };
  if ((v = t.amenity) && ACT.amenity[v]) return { l: LAB.amenity[v] || 'Einrichtung', n: nm, v: v };
  if ((v = t.tourism) && ACT.tourism[v] && !(own && v === 'attraction')) return { l: LAB.tourism[v] || 'Sehenswürdigkeit', n: nm, v: v };
  if ((v = t.leisure) && ACT.leisure[v]) return { l: LAB.leisure[v] || 'Freizeitanlage', n: nm, v: v };
  if ((v = t.office) && !/^(vacant|no|disused)$/.test(v)) return { l: v === 'company' ? 'Firma' : 'Büro', n: nm, v: v };
  if ((v = t.craft)) return { l: LAB.craft[v] || 'Handwerksbetrieb', n: nm, v: v };
  if ((v = t.healthcare)) return { l: LAB.amenity[v] || 'Praxis', n: nm, v: v };
  if ((v = t.club)) return { l: 'Verein', n: nm, v: v };
  return null;
}

function scoreOf(t, it) {
  var s = 50, why = [];
  function add(n, txt) { s += n; why.push([n, txt]); }
  if (!t.name && !it.old) add(15, 'kein Name, schwer zu googeln');
  else if (!t.name) add(5, 'nur ein alter Name bekannt');
  if (it.state && !/^(ehemalig|Brache|Leerstand)$/.test(it.state)) add(8, 'in OSM als ' + it.state + ' markiert');
  if (it.state === 'Leerstand') add(-10, 'nur Leerstand: Laden, Lokal oder Büro ist zu, meist kein Lost Place');
  if (it.state === 'ehemalig') add(-10, 'nur der Name deutet darauf hin, evtl. umgenutzt');
  if (it.state === 'Brache') add(-10, 'Brachfläche, oft nur noch Wiese');
  if (it.len >= 150) add(10, 'Tunnel, ' + fmtArea(it));
  else if (it.area >= 2000) add(12, 'groß, ' + fmtArea(it));
  else if (it.area >= 400) add(6, 'mittelgroß, ' + fmtArea(it));
  if (t.wikipedia || t.wikidata || hasPrefix(t, 'wikipedia:')) add(-30, 'Wikipedia- oder Wikidata-Eintrag');
  if (/^(attraction|museum|viewpoint|theme_park|zoo|gallery|aquarium)$/.test(t.tourism || '')) add(-35, 'als Sehenswürdigkeit markiert');
  if (t.website || t['contact:website'] || t.url || t.phone || t['contact:phone']) add(-12, 'Website oder Telefon hinterlegt');
  if (t.opening_hours) add(-15, 'Öffnungszeiten hinterlegt');
  if (t.fee && t.fee !== 'no') add(-10, 'kostet Eintritt');
  if (t.heritage || t['heritage:operator']) add(-5, 'Baudenkmal, also dokumentiert');
  if (t.castle_type || t.historic === 'castle' || /(^|[\s-])(burg|schloss|festung)/i.test(t.name || '')) add(-10, 'Burg oder Schloss, klassisches Ausflugsziel');
  if (t.image || t.wikimedia_commons) add(-5, 'Foto verlinkt');
  // Hinweise, dass es gar kein Lost Place mehr ist
  var nt = noteOf(t);
  if (GONE.test(nt)) add(-50, 'laut OSM-Notiz abgerissen');
  else if (CHG.test(nt)) add(-25, 'laut OSM-Notiz Umbau, Sanierung oder Abriss geplant');
  if (t.building === 'construction' || t.landuse === 'construction') add(-25, 'in OSM als Baustelle eingetragen');
  var now = it.p ? actOf(t, true) : null;
  if (now && now.v !== it.v) add(-45, 'in OSM schon mit neuer Nutzung eingetragen: ' + now.l);
  return { score: Math.max(0, Math.min(100, Math.round(s))), why: why };
}

function geo(b) {
  var lat = (b.minlat + b.maxlat) / 2, h = (b.maxlat - b.minlat) * 111320,
    w = (b.maxlon - b.minlon) * 111320 * Math.cos(lat * Math.PI / 180);
  return { lat: lat, lon: (b.minlon + b.maxlon) / 2, area: Math.abs(h * w) * 0.75, len: Math.sqrt(h * h + w * w) };
}

export function classify(el) {
  var t = el.tags, lat, lon, b = null, area = null, len = null;
  if (!t) return null;
  var w = what(t);
  if (!w) return null;
  if (el.type === 'node') { lat = el.lat; lon = el.lon; }
  else if (el.bounds) {
    b = el.bounds; var g = geo(b); lat = g.lat; lon = g.lon;
    if (w.k === 'railway' && w.v === 'tunnel') len = g.len; else area = g.area;
  } else if (el.center) { lat = el.center.lat; lon = el.center.lon; }
  if (lat == null || lon == null) return null;
  if (!valid(w, area, t)) return null;
  var it = { id: el.type.charAt(0) + el.id, type: el.type, osm: el.id, lat: lat, lon: lon, b: b, tags: t, k: w.k, v: w.v, p: w.p,
    area: area == null ? null : Math.round(area), len: len == null ? null : Math.round(len), name: t.name || null,
    old: oldName(t), ts: el.timestamp || null };
  it.label = labelOf(w, t, area);
  it.cat = catOf(w, t);
  it.state = stateOf(w, t);
  // score0/why0: Grundwert ohne Gegencheck, damit der Gegencheck mehrfach angewendet werden kann
  var sc = scoreOf(t, it); it.score = it.score0 = sc.score; it.why = it.why0 = sc.why;
  return it;
}

// Punkte, die in einem ebenfalls gefundenen Gebäude liegen, zu einem Fund zusammenlegen
export function process(els) {
  var items = [], byId = {}, grid = {}, G = 0.01, drop = {};
  els.forEach(function (el) { var it = classify(el); if (it && !byId[it.id]) { byId[it.id] = it; items.push(it); } });
  items.forEach(function (it) {
    if (it.b && it.tags.building && it.area != null && it.area < 30000) {
      var key = Math.floor(it.lat / G) + ':' + Math.floor(it.lon / G); (grid[key] = grid[key] || []).push(it);
    }
  });
  items.forEach(function (n) {
    if (n.type !== 'node') return;
    var gy = Math.floor(n.lat / G), gx = Math.floor(n.lon / G);
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var cell = grid[(gy + dy) + ':' + (gx + dx)];
      if (!cell) continue;
      for (var j = 0; j < cell.length; j++) {
        var w = cell[j], b = w.b;
        if (n.lat >= b.minlat && n.lat <= b.maxlat && n.lon >= b.minlon && n.lon <= b.maxlon) {
          var re = classify({ type: w.type, id: w.osm, bounds: b, tags: Object.assign({}, w.tags, n.tags),
            timestamp: [w.ts, n.ts].filter(Boolean).sort().pop() });
          if (re) Object.assign(w, re);
          drop[n.id] = 1;
          return;
        }
      }
    }
  });
  return items.filter(function (it) { return !drop[it.id]; });
}
