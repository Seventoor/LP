// Lost Radar – Gegencheck: Was ist heute laut OSM auf dem Gelände? (Hintergrundprüfung nach jeder Suche)

import * as C from '../core/index.js';
import { $, esc, store, S, toast } from './state.js';
import { body } from './sheet.js';
import { apply, counts } from './list.js';

// Nach jeder Suche fragt die App im Hintergrund ab, was OSM heute auf den Flächen der Funde verzeichnet:
// Läden, Firmen, Schulen, Hotels, Baustellen. Ist dort wieder Betrieb, rutscht der Ort im Score nach unten.
export const CHK_SHORT = { reuse: 'wohl umgenutzt', part: 'teils genutzt', bau: 'Baustelle', busy: 'belebte Lage' };
const CHK_FLAG = { reuse: 1, bau: 1, busy: 1 };
export function chkHTML(it) {
  const c = it.chk, t = it.tags || {}, pt = it.type === 'node';
  const there = pt ? 'Im Umkreis von ' + C.NEAR_M + ' m' : 'Auf dem Gelände';
  const what = c && c.list && c.list.length ? esc(c.list.join(', ')) + (c.more ? ' und ' + c.more + ' weitere' : '') : '';
  let cls = '', head, txt = '';
  if (!c) {
    if (it.chkErr) { head = 'Gegencheck hat nicht geklappt'; txt = 'Die OSM-Server sind gerade ausgelastet. <button type="button" class="mini" data-act="recheck">Nochmal prüfen</button>'; }
    else if (!C.checkable(it)) { head = 'Kein Gegencheck möglich'; txt = it.len ? 'Bei Tunneln klappt das nicht.' : it.area > 1e6 ? 'Die Fläche ist dafür zu groß.' : 'Die Umrisse sind in OSM nicht als Fläche erfasst.'; }
    else { head = 'Gegencheck läuft …'; txt = 'Die App schaut nach, was OpenStreetMap heute ' + (pt ? 'direkt drumherum' : 'auf dem Gelände') + ' verzeichnet.'; }
  } else if (c.v === 'reuse') { cls = 'warn'; head = 'Wohl umgenutzt'; txt = there + ' verzeichnet OSM heute: ' + what + '.'; }
  else if (c.v === 'part') { cls = 'warn'; head = 'Teilweise wieder genutzt'; txt = there + ' verzeichnet OSM: ' + what + '. Der Rest kann noch leer stehen.'; }
  else if (c.v === 'bau') { cls = 'warn'; head = pt ? 'Baustelle nebenan' : 'Baustelle'; txt = there + ' ist eine Baustelle eingetragen. Wahrscheinlich wird gerade umgebaut oder abgerissen.'; }
  else if (c.v === 'busy') { cls = 'warn'; head = 'Belebte Lage'; txt = there + ' verzeichnet OSM: ' + what + '. Eher ein leerer Laden als ein Lost Place.'; }
  else if (c.v === 'near') { head = 'Betrieb nebenan'; txt = there + ' verzeichnet OSM: ' + what + '.'; }
  else if (c.v === 'none') { cls = 'ok'; head = 'Nichts Aktuelles eingetragen'; txt = there + ' kennt OSM keine Läden, Firmen oder Baustellen. Gutes Zeichen, aber kein Beweis, denn OSM hinkt oft hinterher.'; }
  else { head = 'Kein Gegencheck möglich'; txt = 'Die Umrisse sind in OSM nicht als geschlossene Fläche erfasst.'; }
  // Wie alt ist der Eintrag? check_date setzen Mapper, wenn sie vor Ort nachgesehen haben
  const cd = t.check_date || t['survey:date'] || null, cdm = cd && C.fmtMonth(cd), tsm = it.ts && C.fmtMonth(it.ts);
  const age = [tsm ? 'OSM-Eintrag zuletzt geändert: ' + tsm : null, cdm ? 'vor Ort bestätigt: ' + cdm : null].filter(Boolean);
  const last = Math.max(+String(it.ts || '').slice(0, 4) || 0, +String(cd || '').slice(0, 4) || 0);
  if (last && new Date().getFullYear() - last >= 6) age.push('seit Jahren unverändert, also lieber erst im Luftbild nachsehen');
  // Eine sichere KI-Recherche zählt statt des Gegenchecks
  const ai = it.ai;
  if (c && (c.n || c.b) && ai && ai.s !== 'unklar' && ai.c !== 'niedrig') txt += ' Die KI-Recherche unten ist aktueller und zählt stattdessen.';
  return '<div class="gcheck ' + cls + '"><b>' + head + '</b>' + (txt ? '<p>' + txt + '</p>' : '') +
    (age.length ? '<p class="age">' + esc(age.join(' · ')) + '</p>' : '') + '</div>';
}
// Sicheres KI-Ergebnis schlägt den Gegencheck
export function notLost(it) {
  const a = it.ai;
  if (a && a.s !== 'unklar' && a.c !== 'niedrig') return /^(umgenutzt|umbau|abgerissen)$/.test(a.s);
  return !!(it.chk && CHK_FLAG[it.chk.v]);
}

export function startCheck() {
  const list = S.items.filter(it => !it.chk && it.score >= 45 && C.checkable(it)).sort((a, b) => b.score - a.score).slice(0, 400);
  if (list.length) runCheck(list, true);
}
export async function runCheck(list, batch) {
  const ctl = new AbortController();
  if (batch) S.chkBusy = ctl;
  else { if (S.chkOne) S.chkOne.abort(); S.chkOne = ctl; }
  list.forEach(it => { it.chkRun = true; it.chkErr = false; });
  if (batch) $('#count').textContent = counts();
  let hit = 0;
  try {
    const j = await C.overpass(C.checkQuery(list), ctl.signal);
    // Abgebrochene Antwort nicht auswerten, sonst stünde bei manchen fälschlich „nichts gefunden“
    if (j.remark && /timed out|runtime|memory/i.test(j.remark)) throw new Error(j.remark);
    const skip = {};
    S.items.concat(list).forEach(i => { skip[i.id] = 1; });
    const res = C.checkRead(list, j.elements || [], skip);
    for (const it of list) {
      C.applyCheck(it, res[it.id]);
      if (CHK_FLAG[it.chk.v]) hit++;
      const f = S.favs[it.id];
      if (f && f !== it) Object.assign(f, { chk: it.chk, score: it.score, why: it.why });
    }
    if (list.some(it => S.favs[it.id])) store.set('favs', S.favs);
  } catch (e) {
    if (!(e && e.name === 'AbortError')) {
      list.forEach(it => { it.chkErr = true; });
      if (batch) toast('Der Gegencheck hat gerade nicht geklappt. Beim Antippen eines Ortes prüft die App einzeln nach.');
    }
  } finally {
    list.forEach(it => { it.chkRun = false; });
    if (S.chkBusy === ctl) S.chkBusy = null;
    if (S.chkOne === ctl) S.chkOne = null;
  }
  if (ctl.signal.aborted) return;
  const keep = body.scrollTop;
  apply();
  body.scrollTop = keep;
  if (batch && hit) toast('Gegencheck: ' + (hit === 1 ? '1 Ort ist' : hit + ' Orte sind') + ' laut OSM wieder in Betrieb, Baustelle oder nur Leerstand und ' + (hit === 1 ? 'rutscht' : 'rutschen') + ' nach unten.');
}
