// Lost Radar – Merkliste: merken, kopieren, als GPX speichern

import * as C from '../core/index.js';
import { title, store, S, toast } from './state.js';
import { body } from './sheet.js';
import { render } from './list.js';

export function toggleFav(it) {
  if (S.favs[it.id]) delete S.favs[it.id];
  else S.favs[it.id] = { id: it.id, type: it.type, osm: it.osm, lat: it.lat, lon: it.lon, b: it.b, k: it.k, v: it.v, p: it.p, label: it.label, name: it.name, old: it.old, cat: it.cat, state: it.state, area: it.area, len: it.len, score: it.score, why: it.why, score0: it.score0, why0: it.why0, chk: it.chk, ai: it.ai, ts: it.ts, tags: it.tags, t: Date.now() };
  store.set('favs', S.favs);
  const keep = body.scrollTop; render(); body.scrollTop = keep;
  toast(S.favs[it.id] ? 'Gemerkt' : 'Aus der Merkliste entfernt');
}
export async function copy(txt, ok) {
  try { await navigator.clipboard.writeText(txt); toast(ok); return; } catch (e) {}
  const ta = document.createElement('textarea');
  ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
  document.body.appendChild(ta); ta.select();
  let done = false;
  try { done = document.execCommand('copy'); } catch (e) {}
  ta.remove(); toast(done ? ok : txt);
}
const xml = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function gpx() {
  const w = Object.values(S.favs).map(f => '  <wpt lat="' + f.lat + '" lon="' + f.lon + '"><name>' + xml(title(f)) + '</name><desc>' +
    xml([f.label, f.state, C.fmtArea(f), 'https://www.openstreetmap.org/' + f.type + '/' + f.osm].filter(Boolean).join(' · ')) + '</desc></wpt>').join('\n');
  const s = '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Lost Radar" xmlns="http://www.topografix.com/GPX/1/1">\n' + w + '\n</gpx>\n';
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([s], { type: 'application/gpx+xml' }));
    a.download = 'lost-radar-merkliste.gpx';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  } catch (e) { copy(s, 'GPX in die Zwischenablage kopiert'); }
}
