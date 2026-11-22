// Lost Radar – KI-Check: Anfrage an die Claude-API bauen und die Antwort auswerten
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

import { fmtArea, fmtMonth } from './format.js';

// Preise in Dollar pro 1 Mio. Tokens (Stand November 2026), Websuche 10 $ pro 1.000 Suchen
export const AI_MODELS = {
  'claude-opus-5-5': { name: 'Claude Opus 5.5', inp: 4, out: 20 },
  'claude-sonnet-5-5': { name: 'Claude Sonnet 5.5', inp: 2, out: 10 }
};
export const AI_DEFAULT = 'claude-opus-5-5';
// l: Überschrift, s: Kurzform für die Liste, p/why: Score
export const AI_STATUS = {
  verlassen: { l: 'Steht noch leer', s: 'KI: steht leer', p: 5, why: 'laut Websuche weiter verlassen' },
  teilweise_genutzt: { l: 'Teilweise wieder genutzt', s: 'KI: teils genutzt', p: -15, why: 'laut Websuche teilweise wieder genutzt' },
  umgenutzt: { l: 'Umgenutzt', s: 'KI: umgenutzt', p: -45, why: 'laut Websuche umgenutzt, saniert oder neu bebaut' },
  umbau: { l: 'Wird gerade umgebaut', s: 'KI: Umbau', p: -25, why: 'laut Websuche läuft Umbau oder Abriss' },
  abgerissen: { l: 'Abgerissen', s: 'KI: abgerissen', p: -60, why: 'laut Websuche abgerissen' },
  unklar: { l: 'Nichts Eindeutiges gefunden', s: null, p: 0, why: '' }
};
export const AI_KNOWN = {
  kaum: [5, 'kaum Berichte online'],
  bekannt: [-10, 'als Lost Place bekannt, es gibt Berichte online'],
  sehr_bekannt: [-20, 'als Lost Place sehr bekannt, viele Berichte und Videos']
};
const AI_SYSTEM = [
  'Du arbeitest für die App „Lost Radar“. Sie findet in OpenStreetMap (OSM) Orte, die dort als verlassen, stillgelegt oder Ruine eingetragen sind. ' +
  'OSM ist oft Jahre alt: Viele dieser Orte sind längst umgebaut, abgerissen, saniert oder wieder genutzt, etwa als Gewerbegebiet, Wohnungen oder Eventlocation. ' +
  'Deine Aufgabe ist herauszufinden, was dort heute ist, damit niemand umsonst hinfährt.',
  '',
  'So gehst du vor:',
  '- Suche im Web nach dem aktuellen Stand: Lokalnachrichten, Seiten der Gemeinde, Bebauungspläne, Immobilienangebote, Firmen und Gastronomie an der Adresse, Berichte von Lost-Place-Fans mit Datum.',
  '- Achte auf das Datum der Quellen. Neuere Informationen zählen mehr als ältere.',
  '- Verwechsle den Ort nicht mit gleichnamigen Orten anderswo. Gleiche Adresse, Gemeinde und Art des Gebäudes ab.',
  '- Schätze auch ein, wie bekannt der Ort in der Lost-Place-Szene ist.',
  '- Findest du nichts Belastbares, melde status „unklar“ und rate nicht.',
  '',
  'Melde das Ergebnis am Ende genau einmal mit dem Werkzeug ergebnis_melden. Schreib davor keinen langen Bericht.'
].join('\n');
const AI_TOOL = {
  name: 'ergebnis_melden',
  description: 'Meldet das Ergebnis der Recherche an die App. Genau einmal aufrufen, am Ende, nach der Websuche.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: Object.keys(AI_STATUS),
        description: 'Zustand heute. verlassen: steht weiter leer oder verfällt. teilweise_genutzt: Teile sind wieder in Betrieb. ' +
          'umgenutzt: wieder genutzt, saniert oder neu bebaut. umbau: Umbau, Sanierung oder Abriss läuft gerade. ' +
          'abgerissen: nicht mehr vorhanden. unklar: nichts Belastbares gefunden.' },
      sicherheit: { type: 'string', enum: ['hoch', 'mittel', 'niedrig'], description: 'Wie sicher das Ergebnis ist.' },
      bekanntheit: { type: 'string', enum: Object.keys(AI_KNOWN),
        description: 'Wie bekannt der Ort als Lost Place online ist: Urbex-Berichte, Fotos, Videos, Lost-Place-Listen.' },
      stand: { type: 'string', description: 'Datum der jüngsten verlässlichen Information, etwa „2024“ oder „März 2025“. Leer, wenn unbekannt.' },
      zusammenfassung: { type: 'string', description: 'Zwei bis drei kurze Sätze auf Deutsch, locker, ohne Emojis: Was ist dort heute, und woher weißt du das?' },
      quellen: { type: 'array', description: 'Bis zu vier Seiten aus der Websuche, auf die sich das Ergebnis stützt.',
        items: { type: 'object', properties: { url: { type: 'string' }, titel: { type: 'string' } }, required: ['url', 'titel'], additionalProperties: false } }
    },
    required: ['status', 'sicherheit', 'bekanntheit', 'stand', 'zusammenfassung', 'quellen'],
    additionalProperties: false
  }
};
// Tags, die für die Recherche nichts bringen
const AI_SKIPTAG = /^(source|building:(levels|material|colour|part)|roof|height|min_height|wheelchair|ref:|lacounty|tiger|gnis|import|fixme:|survey)/;

function aiPrompt(it, ctx) {
  var t = it.tags || {}, L = [], a = fmtArea(it);
  L.push('Ort: ' + (it.name || (it.old ? it.label + ' „' + it.old + '“' : it.label)));
  L.push('Art laut OSM: ' + it.label + (it.state ? ', ' + it.state : ''));
  if (it.name && it.old) L.push('Früherer Name: ' + it.old);
  if (ctx.addr) L.push('Adresse: ' + ctx.addr);
  L.push('Koordinaten: ' + it.lat.toFixed(5) + ', ' + it.lon.toFixed(5));
  if (a) L.push('Größe: ' + a);
  if (it.ts) L.push('OSM-Eintrag zuletzt geändert: ' + fmtMonth(it.ts));
  var tags = Object.keys(t).sort().filter(function (k) { return !AI_SKIPTAG.test(k); }).map(function (k) { return k + '=' + t[k]; }).join('; ');
  L.push('OSM-Tags: ' + (tags.length > 1500 ? tags.slice(0, 1500) + ' …' : tags));
  if (ctx.chk) L.push('Was OSM heute auf dem Gelände oder direkt daneben verzeichnet: ' + ctx.chk);
  L.push('', 'Was ist dort heute?');
  return L.join('\n');
}

// Anfrage für client.beta.messages.stream(). Refusal-Fallback ist eingeschaltet (fallbacks: 'default')
export function aiRequest(it, ctx, model) {
  var loc = { type: 'approximate', country: /^[A-Z]{2}$/.test(ctx.cc || '') ? ctx.cc : 'DE', timezone: 'Europe/Berlin' };
  if (ctx.city) loc.city = ctx.city;
  return {
    model: AI_MODELS[model] ? model : AI_DEFAULT,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: AI_SYSTEM,
    tools: [{ type: 'web_search_20260318', name: 'web_search', max_uses: 5, user_location: loc }, AI_TOOL],
    messages: [{ role: 'user', content: aiPrompt(it, ctx) }]
  };
}

// Antwort auswerten. msgs: alle Nachrichten des Gesprächs (für Quellen aus früheren Teilantworten)
export function aiRead(msg, msgs) {
  var input = null, seen = {}, cites = [];
  function norm(u) { return String(u || '').replace(/#.*$/, '').replace(/\/$/, ''); }
  function scan(blocks) {
    (blocks || []).forEach(function (b) {
      if (!b || typeof b !== 'object') return;
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content))
        b.content.forEach(function (r) { if (r && r.url) seen[norm(r.url)] = r.title || r.url; });
      if (b.type === 'text' && b.citations) b.citations.forEach(function (c) {
        if (c && c.url && !cites.some(function (x) { return x.u === norm(c.url); })) cites.push({ u: norm(c.url), t: c.title || c.url });
        if (c && c.url) seen[norm(c.url)] = c.title || c.url;
      });
    });
  }
  (msgs || []).forEach(function (m) { if (m.role === 'assistant' && Array.isArray(m.content)) scan(m.content); });
  scan(msg.content);
  (msg.content || []).forEach(function (b) { if (b.type === 'tool_use' && b.name === AI_TOOL.name) input = b.input; });
  if (!input || !AI_STATUS[input.status]) return null;
  // Nur Quellen, die wirklich aus der Websuche stammen, und nur http(s)
  var q = (input.quellen || []).filter(function (x) { return x && /^https?:\/\//i.test(x.url || '') && seen[norm(x.url)]; })
    .map(function (x) { return { u: x.url, t: x.titel || seen[norm(x.url)] }; });
  if (!q.length) q = cites.filter(function (x) { return /^https?:\/\//i.test(x.u); });
  return {
    s: input.status, c: /^(hoch|mittel|niedrig)$/.test(input.sicherheit) ? input.sicherheit : 'niedrig',
    b: AI_KNOWN[input.bekanntheit] ? input.bekanntheit : null, d: String(input.stand || '').slice(0, 40),
    z: String(input.zusammenfassung || '').slice(0, 800), q: q.slice(0, 4), t: Date.now()
  };
}

// Grobe Kosten einer Antwort in Dollar
export function aiCost(u, model) {
  var p = AI_MODELS[model] || AI_MODELS[AI_DEFAULT];
  if (!u) return 0;
  var inp = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
  var n = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
  return (inp * p.inp + (u.output_tokens || 0) * p.out) / 1e6 + n * 0.01;
}
