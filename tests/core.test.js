// Tests für die Kernlogik (js/core). Starten mit: npm test  (oder: node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/core/index.js';

// Ein Gebäude von ca. 110 × 100 m, Fläche geschätzt rund 8.400 m²
const B = { minlat: 53, minlon: 8, maxlat: 53.001, maxlon: 8.0015 };
const SQUARE = [{ lat: 53, lon: 8 }, { lat: 53, lon: 8.0015 }, { lat: 53.001, lon: 8.0015 }, { lat: 53.001, lon: 8 }, { lat: 53, lon: 8 }];
const way = (tags, extra = {}) => ({ type: 'way', id: 1, bounds: B, tags, ...extra });
const node = (tags, id = 2, lat = 53.0005, lon = 8.0007) => ({ type: 'node', id, lat, lon, tags });
const why = it => it.why.map(w => w[0] + ' ' + w[1]).join(' | ');

test('buildQuery: Ausschnitt, Lifecycle-Präfixe, Bearbeitungsdatum', () => {
  const bb = { s: 53, w: 8, n: 53.2, e: 8.3 };
  const q = C.buildQuery(bb, {});
  assert.match(q, /\[bbox:53\.00000,8\.00000,53\.20000,8\.30000\]/);
  assert.match(q, /\^\(abandoned\|disused\|ruins\):/);
  assert.match(q, /out meta bb qt;$/);
  assert.doesNotMatch(q, /brownfield/);
  assert.match(C.buildQuery(bb, { brown: true }), /brownfield/);
});

test('overpass: fällt auf den nächsten Server zurück, bei 400 nicht', async () => {
  const orig = globalThis.fetch;
  try {
    const calls = [];
    globalThis.fetch = async url => {
      calls.push(url);
      if (calls.length === 1) throw new TypeError('offline');
      return { ok: true, json: async () => ({ elements: [{ id: 1 }] }) };
    };
    const j = await C.overpass('[out:json];');
    assert.equal(calls.length, 2);
    assert.equal(j.elements.length, 1);

    globalThis.fetch = async () => ({ ok: false, status: 400 });
    await assert.rejects(C.overpass('kaputt'), e => e.status === 400);
  } finally {
    globalThis.fetch = orig;
  }
});

test('classify: großes verlassenes Gebäude ohne Namen ist ein Geheimtipp', () => {
  const it = C.classify(way({ 'abandoned:building': 'yes' }, { timestamp: '2014-03-02T10:00:00Z' }));
  assert.equal(it.label, 'Großes Gebäude');
  assert.equal(it.state, 'verlassen');
  assert.equal(it.score, 85); // 50 + 15 kein Name + 8 verlassen + 12 groß
  assert.equal(it.ts, '2014-03-02T10:00:00Z');
  assert.equal(C.tier(it.score), 'Geheimtipp');
});

test('classify: früherer Name (abandoned:name) gilt als googelbar', () => {
  const it = C.classify(way({ 'abandoned:man_made': 'works', 'abandoned:name': "Kellogg's", historic: 'factory' }));
  assert.equal(it.old, "Kellogg's");
  assert.equal(it.label, 'Fabrik');
  assert.match(why(it), /5 nur ein alter Name/);
  assert.doesNotMatch(why(it), /kein Name/);
});

test('classify: leere Läden im Einkaufszentrum fliegen raus, sonst heißt es Leerstand', () => {
  assert.equal(C.classify(way({ 'disused:shop': 'clothes', indoor: 'room' })), null);
  const it = C.classify(node({ 'disused:amenity': 'pharmacy', healthcare: 'pharmacy' }));
  assert.equal(it.state, 'Leerstand');
  assert.match(why(it), /-10 nur Leerstand/);
  assert.doesNotMatch(why(it), /neuer Nutzung/); // übrig gebliebenes healthcare=pharmacy ist keine neue Nutzung
  assert.equal(C.classify(node({ 'disused:amenity': 'hospital' })).state, 'stillgelegt');
});

test('scoreOf: Notizen zu Umbau und Abriss, Verneinungen zählen nicht', () => {
  const s = note => why(C.classify(way({ 'abandoned:building': 'yes', note })));
  assert.doesNotMatch(s('unsaniert, seit 2005 leer'), /Notiz/);
  assert.doesNotMatch(s('Gebäude ist nicht saniert'), /Notiz/);
  assert.match(s('Abriss geplant'), /-25 laut OSM-Notiz Umbau/);
  assert.match(s('2019 abgerissen'), /-50 laut OSM-Notiz abgerissen/);
});

test('scoreOf: neue Nutzung neben dem Lifecycle-Tag', () => {
  const it = C.classify(way({ 'disused:railway': 'station', amenity: 'kindergarten', building: 'train_station' }));
  assert.match(why(it), /-45 in OSM schon mit neuer Nutzung eingetragen: Kindergarten/);
});

test('process: Punkt im Gebäude wird mit dem Gebäude zusammengelegt', () => {
  const items = C.process([
    way({ building: 'yes', 'abandoned:building': 'yes' }, { timestamp: '2015-01-01T00:00:00Z' }),
    node({ 'abandoned:amenity': 'hospital', name: 'Alte Klinik' }, 9)
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'w1');
  assert.equal(items[0].name, 'Alte Klinik');
  assert.equal(items[0].label, 'Krankenhaus');
  assert.equal(items[0].ts, '2015-01-01T00:00:00Z');
});

test('checkRead: Betrieb im Gebäude heißt umgenutzt, nebenan zählt nicht', () => {
  const it = C.classify(way({ 'abandoned:building': 'yes' }));
  const els = [
    { type: 'way', id: 1, nodes: [1, 2, 3, 4, 1], geometry: SQUARE }, // Umriss
    { type: 'way', id: 1 }, // map_to_area auf Overpass 0.7.62
    { type: 'node', id: 10, lat: 53.0005, lon: 8.0007, tags: { shop: 'bakery', name: 'Bäckerei Krume' } },
    { type: 'node', id: 11, lat: 53.0020, lon: 8.0007, tags: { shop: 'kiosk' } },
    { type: 'way', id: 12, center: { lat: 53.0004, lon: 8.0004 }, tags: { building: 'construction' } }
  ];
  const r = C.checkRead([it], els, {}).w1;
  assert.equal(r.v, 'reuse');
  assert.equal(r.n, 1);
  assert.equal(r.b, 1);
  assert.deepEqual(r.list, ['Laden „Bäckerei Krume“', 'Baustelle']);
});

test('checkRead: ohne Fläche aus map_to_area nicht prüfbar', () => {
  const it = C.classify(way({ 'abandoned:building': 'yes' }));
  const r = C.checkRead([it], [{ type: 'way', id: 1, geometry: SQUARE }], {}).w1;
  assert.equal(r.v, 'na');
});

test('checkRead: Punkte – Laden in belebter Straße, Bunker bleibt Bunker', () => {
  const shops = [10, 11, 12].map(i => ({ type: 'node', id: i, lat: 53.0005 + i * 1e-6, lon: 8.0007, tags: { shop: 'clothes' } }));
  const home = { type: 'way', id: 20, center: { lat: 53.0005, lon: 8.0007 }, tags: { landuse: 'residential' } };
  const bank = C.classify(node({ 'disused:amenity': 'bank' }, 2));
  const bunker = C.classify(node({ military: 'bunker' }, 3));
  const r = C.checkRead([bank, bunker], shops.concat(home), {});
  assert.equal(r.n2.v, 'busy');
  assert.equal(r.n3.v, 'near');
  assert.equal(r.n2.n, 3); // Wohngebiet zählt bei Punkten nicht
});

test('rescore: sichere KI schlägt den Gegencheck, unsichere zählt halb', () => {
  const it = C.classify(way({ 'abandoned:building': 'yes' }));
  C.applyCheck(it, { v: 'reuse', n: 2, b: 1, list: [], more: 0 });
  assert.equal(it.score, 85 - 45 - 25);
  C.applyAI(it, { s: 'verlassen', c: 'hoch', b: 'kaum' });
  assert.equal(it.score, 85 + 5 + 5);
  assert.match(why(it), /Gegencheck nicht gewertet/);
  C.applyAI(it, { s: 'abgerissen', c: 'niedrig', b: null });
  assert.equal(it.score, 0); // 85 − 45 − 25 − 30, nicht unter 0
});

test('aiRequest: Modell, Websuche, Ergebnis-Werkzeug, Fallback', () => {
  const it = C.classify(way({ 'abandoned:building': 'hotel', name: 'Hotel Krone' }));
  const r = C.aiRequest(it, { addr: 'Hauptstraße 1, 12345 Musterstadt', city: 'Musterstadt', cc: 'DE', chk: '' }, 'gibt-es-nicht');
  assert.equal(r.model, C.AI_DEFAULT);
  assert.equal(r.fallbacks, 'default');
  assert.equal(r.tools[0].type, 'web_search_20260318');
  assert.equal(r.tools[0].user_location.city, 'Musterstadt');
  assert.equal(r.tools[1].name, 'ergebnis_melden');
  assert.equal(r.tools[1].strict, true);
  assert.match(r.messages[0].content, /^Ort: Hotel Krone/);
  assert.match(r.messages[0].content, /Adresse: Hauptstraße 1/);
});

test('aiRead: nur Quellen aus der Websuche, nichts Erfundenes, kein javascript:', () => {
  const msg = { content: [
    { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://example.org/a', title: 'A' }] },
    { type: 'tool_use', name: 'ergebnis_melden', input: {
      status: 'umgenutzt', sicherheit: 'hoch', bekanntheit: 'kaum', stand: '2025', zusammenfassung: 'Ist jetzt ein Hotel.',
      quellen: [{ url: 'https://example.org/a', titel: 'A' }, { url: 'https://erfunden.example/x', titel: 'X' }, { url: 'javascript:alert(1)', titel: 'böse' }] } }
  ] };
  const r = C.aiRead(msg, []);
  assert.equal(r.s, 'umgenutzt');
  assert.equal(r.c, 'hoch');
  assert.deepEqual(r.q, [{ u: 'https://example.org/a', t: 'A' }]);
  assert.equal(C.aiRead({ content: [{ type: 'text', text: 'ohne Werkzeug' }] }, []), null);
});

test('aiCost: Tokens und Suchen', () => {
  assert.equal(C.aiCost({ input_tokens: 1e6, output_tokens: 0 }, 'claude-sonnet-5-5'), 2);
  const c = C.aiCost({ input_tokens: 21000, output_tokens: 1800, server_tool_use: { web_search_requests: 1 } }, 'claude-sonnet-5-5');
  assert.ok(Math.abs(c - 0.07) < 1e-9);
});

test('Formatierung', () => {
  assert.equal(C.fmtMonth('2019-05-12T10:00:00Z'), 'Mai 2019');
  assert.equal(C.fmtMonth('2020'), '2020');
  assert.equal(C.fmtMonth('irgendwann'), null);
  assert.equal(C.fmtArea({ area: 27800 * 10 }), 'ca. 27,8 ha');
  assert.equal(C.fmtArea({ area: 3734 }), 'ca. 3.700 m²');
  assert.equal(C.fmtDist(1450), '1,5 km');
});
