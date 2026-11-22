// Lost Radar – Score aus Grundwert, Gegencheck und KI-Check zusammensetzen
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

import { AI_KNOWN, AI_STATUS } from './ai.js';
import { NEAR_M } from './check.js';

// Score immer neu aus Grundwert (score0/why0), Gegencheck (it.chk) und KI-Check (it.ai) zusammensetzen
function rescore(it) {
  if (it.score0 == null) { it.score0 = it.score; it.why0 = (it.why || []).slice(); } // alte Merklisten-Einträge
  var why = it.why0.slice(), s = it.score0, c = it.chk, ai = it.ai, pt = it.type === 'node';
  function add(n, txt) { s += n; why.push([n, txt]); }
  // Eine sichere KI-Recherche ist aktueller als OSM, dann zählt der Gegencheck nicht
  var aiSure = !!(ai && AI_STATUS[ai.s] && ai.s !== 'unklar' && ai.c !== 'niedrig');
  if (c && aiSure && (c.n || c.b)) add(0, 'Gegencheck nicht gewertet, die KI-Recherche ist aktueller');
  else if (c) {
    var e = c.n === 1 ? '1 Eintrag' : c.n + ' Einträge';
    if (c.v === 'reuse') add(-45, 'auf dem Gelände ist laut OSM wieder Betrieb (' + e + ')');
    else if (c.v === 'part') add(-15, 'teilweise wieder genutzt (' + e + ' auf dem Gelände)');
    else if (c.v === 'busy') add(-30, 'belebte Lage (' + e + ' im Umkreis von ' + NEAR_M + ' m), eher Leerstand');
    else if (c.v === 'near') add(-10, 'direkt nebenan ist Betrieb');
    if (c.b) add(pt ? -10 : -25, pt ? 'Baustelle direkt nebenan' : 'Baustelle auf dem Gelände');
  }
  if (ai) {
    var st = AI_STATUS[ai.s], k = AI_KNOWN[ai.b];
    if (st && st.p) add(Math.round(st.p * (ai.c === 'niedrig' ? 0.5 : 1)), 'KI: ' + st.why);
    if (k) add(k[0], 'KI: ' + k[1]);
  }
  it.why = why; it.score = Math.max(0, Math.min(100, Math.round(s)));
  return it;
}
export function applyCheck(it, c) { it.chk = c; return rescore(it); }
export function applyAI(it, a) { it.ai = a; return rescore(it); }

export function tier(s) { return s >= 70 ? 'Geheimtipp' : s >= 45 ? 'Wenig bekannt' : s >= 25 ? 'Bekannt' : 'Touri-Spot'; }
