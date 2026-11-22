// Lost Radar – KI-Check: Claude recherchiert per Websuche, was heute dort ist (eigener API-Schlüssel)

import * as C from '../core/index.js';
import { esc, title, store, S, toast } from './state.js';
import { body } from './sheet.js';
import { apply } from './list.js';
import { revgeo } from './geocode.js';
import { openFilters } from './filters.js';

// Auf Knopfdruck recherchiert Claude per Websuche, was heute dort ist. Läuft direkt aus dem Browser
// mit dem eigenen API-Schlüssel; das SDK wird erst dann vom CDN geladen.
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.6.0/+esm';
const AI_WARN = { teilweise_genutzt: 1, umgenutzt: 1, umbau: 1, abgerissen: 1 };
const KNOWN_TXT = { kaum: 'kaum bekannt', bekannt: 'bekannt', sehr_bekannt: 'sehr bekannt' };
let sdkP = null;
function loadSDK() {
  if (!sdkP) sdkP = import(SDK_URL).then(m => m.default, () => { sdkP = null; throw Object.assign(new Error('SDK nicht geladen'), { sdk: true }); });
  return sdkP;
}
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const usd = x => x < 0.01 ? 'unter 1 Cent' : 'ca. ' + x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' $';
// Alle Kopien eines Orts: Fund, Merkliste, aktuelle Auswahl
const copies = (it) => [...new Set([it, S.items.find(x => x.id === it.id), S.favs[it.id], S.sel && S.sel.id === it.id ? S.sel : null].filter(Boolean))];
function chkText(it) {
  const c = it.chk;
  if (!c || c.v === 'na') return '';
  if (!c.list.length) return 'nichts, keine Läden, Firmen oder Baustellen';
  return c.list.join(', ') + (c.more ? ' und ' + c.more + ' weitere' : '');
}
export function aiHTML(it) {
  const run = S.ai[it.id], a = it.ai, key = store.get('aikey', '');
  let cls = '', head, body = '', act = '';
  if (run) {
    const sec = Math.round((Date.now() - run.t0) / 1000);
    head = 'KI recherchiert …';
    body = '<p>Sucht im Web nach dem aktuellen Stand, das dauert meist 20 Sekunden bis 2 Minuten (' + sec + ' s' +
      (run.n ? ', ' + run.n + (run.n === 1 ? ' Suche' : ' Suchen') : '') + ').' + (run.q ? ' Zuletzt: „' + esc(run.q) + '“' : '') + '</p>';
    act = '<span></span><button type="button" class="mini" data-act="aistop">Abbrechen</button>';
  } else if (a) {
    const st = C.AI_STATUS[a.s] || C.AI_STATUS.unklar;
    cls = AI_WARN[a.s] ? 'warn' : a.s === 'verlassen' ? 'ok' : '';
    head = 'KI-Check: ' + st.l;
    const meta = [a.d ? 'Stand: ' + a.d : null, 'Sicherheit: ' + a.c, a.b ? 'Bekanntheit: ' + KNOWN_TXT[a.b] : null].filter(Boolean).join(' · ');
    body = '<p>' + esc(a.z) + '</p><p class="age">' + esc(meta) + '</p>' + (a.q && a.q.length
      ? '<ul class="src">' + a.q.map(q => '<li><a href="' + esc(q.u) + '" target="_blank" rel="noopener">' + esc(q.t || host(q.u)) + '</a> <small>' + esc(host(q.u)) + '</small></li>').join('') + '</ul>'
      : '<p class="age">Ohne Quellenangabe.</p>');
    const m = C.AI_MODELS[a.m];
    act = '<small class="age">Geprüft am ' + new Date(a.t).toLocaleDateString('de-DE') + (m ? ' mit ' + m.name : '') + (a.cost ? ', ' + usd(a.cost) : '') + '</small>' +
      '<button type="button" class="mini" data-act="ai">Nochmal prüfen</button>';
  } else if (it.aiErr) {
    head = 'KI-Check hat nicht geklappt';
    body = '<p>' + esc(it.aiErr) + '</p>';
    act = '<span></span>' + (key ? '<button type="button" class="mini" data-act="ai">Nochmal versuchen</button>' : '<button type="button" class="mini" data-act="aisetup">Schlüssel eintragen</button>');
  } else {
    head = 'KI-Check';
    body = '<p>Eine KI sucht im Web, ob der Ort noch leer steht oder längst umgebaut ist, und nennt ihre Quellen. Kostet ein paar Cent bis etwa einen halben Euro über deinen eigenen Anthropic-Schlüssel.</p>';
    act = key ? '<button type="button" class="lnk main" data-act="ai">Mit KI prüfen</button>' : '<button type="button" class="lnk" data-act="aisetup">KI-Check einrichten</button>';
  }
  return '<div class="gcheck ' + cls + '" id="aibox"><b>' + head + '</b>' + body + '<div class="act">' + act + '</div></div>';
}
// Nur den KI-Kasten neu zeichnen (Fortschritt), damit die Detailansicht nicht springt
function aiBox(it) {
  if (!S.sel || S.sel.id !== it.id) return;
  const el = document.getElementById('aibox');
  if (el) el.outerHTML = aiHTML(S.sel);
}
function aiErrText(e, A) {
  const msg = x => (x && x.error && x.error.error && x.error.error.message) || (x && x.message) || '';
  if (e && e.sdk) return 'Das KI-Modul ließ sich nicht laden (cdn.jsdelivr.net). Internet an? Ein Werbe- oder DNS-Blocker kann es auch blockieren.';
  if (e && e.refusal) return 'Die KI wollte diesen Ort nicht prüfen.';
  if (e && e.empty) return 'Die KI hat kein Ergebnis geliefert. Nochmal versuchen?';
  if (A) {
    if (e instanceof A.AuthenticationError) return 'Der API-Schlüssel stimmt nicht. Prüf ihn unter Filter, KI-Check.';
    if (e instanceof A.PermissionDeniedError) return 'Der Schlüssel darf das nicht. Ist die Websuche in der Anthropic-Konsole freigeschaltet? (' + msg(e) + ')';
    if (e instanceof A.RateLimitError) return 'Zu viele Anfragen auf einmal. Kurz warten und nochmal versuchen.';
    if (e instanceof A.BadRequestError) return 'Anthropic lehnt die Anfrage ab: ' + msg(e);
    if (e instanceof A.InternalServerError) return 'Anthropic ist gerade überlastet. Gleich nochmal versuchen.';
    if (e instanceof A.APIConnectionError) return 'Keine Verbindung zu Anthropic. Internet an?';
    if (e instanceof A.APIError) return 'Fehler bei Anthropic (' + (e.status || '?') + '): ' + msg(e);
  }
  return 'Unbekannter Fehler: ' + String((e && e.message) || e);
}
function saveAI(it, res) {
  const ki = store.get('ki', {}) || {};
  ki[it.id] = res;
  const ids = Object.keys(ki);
  if (ids.length > 300) ids.sort((a, b) => ki[a].t - ki[b].t).slice(0, ids.length - 300).forEach(id => { delete ki[id]; });
  store.set('ki', ki);
  copies(it).forEach(x => { x.aiErr = null; C.applyAI(x, res); });
  if (S.favs[it.id]) store.set('favs', S.favs);
}
export async function runAI(it) {
  const key = store.get('aikey', '');
  if (!key) { openFilters('ki'); return; }
  if (S.ai[it.id]) return;
  const run = S.ai[it.id] = { ctl: new AbortController(), t0: Date.now(), n: 0, q: '' };
  copies(it).forEach(x => { x.aiErr = null; });
  aiBox(it);
  const tick = setInterval(() => aiBox(it), 1000);
  let A = null, res = null;
  try {
    A = await loadSDK();
    await Promise.race([revgeo(it), new Promise(r => setTimeout(r, 4000))]);
    const g = S.geo[it.id] || {}, model = store.get('aimodel', C.AI_DEFAULT);
    const client = new A({ apiKey: key, dangerouslyAllowBrowser: true });
    const params = C.aiRequest(it, { addr: g.ok ? g.txt : '', city: g.city, cc: g.cc, chk: chkText(it) }, model);
    let msg = null, cost = 0, nudged = false;
    // Gestreamt, damit lange Recherchen nicht in einen Timeout laufen; pause_turn wird fortgesetzt
    for (let i = 0; i < 4; i++) {
      const stream = client.beta.messages.stream(params, { signal: run.ctl.signal });
      stream.on('contentBlock', b => {
        if (b && b.type === 'server_tool_use' && b.name === 'web_search') { run.n++; if (b.input && b.input.query) run.q = b.input.query; aiBox(it); }
      });
      msg = await stream.finalMessage();
      cost += C.aiCost(msg.usage, model);
      if (msg.stop_reason === 'pause_turn') { params.messages = params.messages.concat({ role: 'assistant', content: msg.content }); continue; }
      if (msg.stop_reason === 'end_turn' && !nudged && !C.aiRead(msg, params.messages)) {
        nudged = true;
        params.messages = params.messages.concat({ role: 'assistant', content: msg.content }, { role: 'user', content: 'Bitte melde dein Ergebnis jetzt mit dem Werkzeug ergebnis_melden.' });
        continue;
      }
      break;
    }
    if (msg.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { refusal: true });
    res = C.aiRead(msg, params.messages);
    if (!res) throw Object.assign(new Error('leer'), { empty: true });
    res.m = model; res.cost = cost;
    saveAI(it, res);
  } catch (e) {
    if (!run.ctl.signal.aborted) { const t = aiErrText(e, A); copies(it).forEach(x => { x.aiErr = t; }); }
  } finally {
    clearInterval(tick);
    delete S.ai[it.id];
  }
  const keep = body.scrollTop;
  apply();
  body.scrollTop = keep;
  if (res && !(S.sel && S.sel.id === it.id)) toast('KI-Check fertig: ' + title(it) + ' – ' + C.AI_STATUS[res.s].l + '.');
}
