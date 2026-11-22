# Lost Radar (Repo „LP“)

Mobile Web-App, die verlassene und stillgelegte Orte („Lost Places“) in Deutschland live aus OpenStreetMap holt und unbekannte von touristischen trennt.
Live: https://seventoor.github.io/LP/ (GitHub Pages aus `main`, Root). Texte in der App: Deutsch, locker, keine Emojis.

## Aufbau
Kein Build-Schritt: ES-Module, die der Browser direkt lädt. GitHub Pages liefert das Repo so aus, wie es ist (`.nojekyll` schaltet Jekyll ab).

- `index.html`: Markup (Suchleiste `#bar`, Suchknopf `#scan`, Ebenen `#layers`, Bottom-Sheet `#sheet` mit Liste/Detail in `#body`, Filter-Dialog `#filters`, `#toast`), lädt Leaflet als klassisches Script, dann `js/app/main.js` als Modul. Die `modulepreload`-Liste im `<head>` hält die Ladezeit kurz; neue Module dort mit eintragen.
- `css/app.css`: App-CSS, beginnt mit dem Kommentar `/* VOICE …`
- `vendor/leaflet/`: offizielle Dateien von Leaflet 1.9.4 (`leaflet.js`, `leaflet.css`, `images/`, `LICENSE`): nicht anfassen. Die App nutzt das globale `L`.
- `js/core/`: Kernlogik ohne DOM, läuft auch in Node. `index.js` sammelt alles, die App greift mit `import * as C from '../core/index.js'` darauf zu.
  - `tags.js`: OSM-Wissen (Kategorien `CATS`, Lifecycle-Präfixe, `DROPV`/`KEEPV`, aktive Nutzungen `ACT`, Bezeichnungen `LAB`, Notiz-Muster)
  - `overpass.js`: `buildQuery()`, `overpass()` mit Server-Fallback, `MAX_KM2`
  - `classify.js`: `what()`, `valid()`, `catOf()`, `stateOf()`, `scoreOf()`, `classify()`, `process()`, `actOf()`
  - `check.js`: Gegencheck (`checkQuery()`, `checkRead()`, Punkt-in-Fläche)
  - `ai.js`: KI-Check (`aiRequest()`, `aiRead()`, `aiCost()`, Prompt und Werkzeug-Schema)
  - `score.js`: `rescore()`, `applyCheck()`, `applyAI()`, `tier()`
  - `format.js`: Flächen, Entfernungen, Datum
- `js/app/`: Oberfläche
  - `state.js`: `S` (Zustand), `store` (localStorage), `$`, `esc`, `title`, `toast`
  - `map.js`: Leaflet-Karte, Kartenansichten, Punkte-Ebene, Auswahl-Markierung, `bboxOf()`
  - `sheet.js`: Bottom-Sheet (`setSheet()`, `body` = `#body`)
  - `scan.js`: „Hier suchen“, `scan()`
  - `list.js`: `apply()` (filtern, sortieren), `drawDots()`, `render()`
  - `detail.js`: `detailHTML()`, `select()`, `focusOn()`
  - `check.js`, `ai.js`: Gegencheck und KI-Check in der Oberfläche
  - `geocode.js`: Ortssuche, Standort, Reverse-Geocoding (`revgeo()`)
  - `favs.js`: Merkliste, Kopieren, GPX
  - `filters.js`: Filter-Dialog mit KI-Einstellungen
  - `main.js`: verbindet alles (Klicks im Bottom-Sheet, Tabs, Escape, Kartenbewegung) und startet die App
- `tests/core.test.js`: Tests für `js/core` mit `node --test` (`npm test`), ohne Abhängigkeiten
- `package.json`: nur `"type": "module"` und Skripte, keine Pakete

Regel gegen Probleme mit zyklischen Imports: Code auf oberster Ebene eines App-Moduls (also beim Laden) darf nur `js/core`, `state.js`, `sheet.js` und `map.js` benutzen. Die Feature-Module (`list`, `detail`, `check`, `ai`, …) importieren sich gegenseitig und rufen sich nur innerhalb von Funktionen auf.

`lost-radar.html` leitet nur auf `./` weiter (alter Link).

Home-Bildschirm (iPhone/Android): `manifest.webmanifest`, Icons in `icons/` (Quelle `icons/icon.svg`, PNGs daraus gerendert: `apple-touch-icon.png` 180 px, 192, 512, maskable 512). Als Web-App läuft sie im Standalone-Modus mit transparenter Statusleiste (`black-translucent`); `#statusscrim` legt dann oben einen dunklen Verlauf unter Uhrzeit/Akku, und das Bottom-Sheet rechnet den oberen Safe-Area-Abstand ein (`safeTop()`).
Lokal braucht es einen kleinen Webserver (`npm start` bzw. `python3 -m http.server`), weil Browser ES-Module nicht von `file://` laden. Alle externen Dienste müssen CORS-fähig sein, weil die App sie direkt aus dem Browser aufruft.

## Datenfluss
1. „Hier suchen“ → `buildQuery(bbox, filter)` erzeugt Overpass QL mit `out meta bb qt` (meta für das Datum der letzten Bearbeitung). Der Kartenausschnitt darf höchstens `MAX_KM2` = 4000 km² groß sein.
2. `overpass()` probiert nacheinander overpass-api.de, overpass.private.coffee, maps.mail.ru und overpass.kumi.systems. Jeder Server hat 32 s Zeit (Server-Timeout 25 s). Der zuletzt erfolgreiche Server kommt zuerst dran.
3. `process()` ruft für jedes Element `classify()` auf:
   - `what()`: frühere Nutzung, Lifecycle-Präfixe `abandoned:`/`disused:`/`ruins:` zuerst
   - `valid()`: wirft Kleinkram raus (Bänke, Garagen, Gleise, kleine Läden, Räume mit `indoor=*` wie leere Läden im Einkaufszentrum …)
   - `catOf()`: sortiert in die Kategorien mil, ind, pub, bahn, bau, ruin, brach
   - `stateOf()`: Zustand. `disused:` an Läden, Büros, Werkstätten und kleinen Lokalen (Bank, Apotheke, Café …) heißt „Leerstand“
   - `scoreOf()`: Score samt Begründung

   Punkte, die in einem gefundenen Gebäude liegen, werden mit diesem zusammengelegt. Die Fläche ist eine grobe Schätzung: Bounding-Box × 0,75.
4. **Gegencheck** direkt danach im Hintergrund (`startCheck()` → `checkQuery()` → `checkRead()` → `applyCheck()`): Für die bis zu 400 besten Funde ab Score 45 fragt eine zweite Overpass-Abfrage ab, was OSM heute auf dem Gelände verzeichnet (Läden, Firmen, Handwerk, Praxen, Vereine, Gastro, Schulen, Hotels, Sportstätten, Baustellen, Wohngebiete). Flächen bis 1 km² über `map_to_area` plus Punkt-in-Fläche-Test im Browser (Umrisse per `out skel geom`), Punkte im Umkreis von 30 m. Ergebnis pro Fund in `it.chk.v`:
   - `reuse`: Betrieb auf dem Gelände (unter 1 ha reicht 1 Eintrag, sonst mind. 2 bzw. 1 pro 5 ha) −45
   - `part`: vereinzelt Betrieb auf großem Gelände −15
   - `bau`: nur Baustelle −25 (zusätzlich zu `reuse`/`part` ebenfalls −25)
   - `busy`: Laden oder Lokal als Punkt mit mind. 3 Betrieben im Umkreis, also eher Leerstand in der Einkaufsstraße −30
   - `near`: sonstiger Punkt mit Betrieb im Umkreis (bei Bauwerken wie Bunkern auch ab 3) −10
   - `none`: nichts gefunden, `na`: nicht prüfbar (keine geschlossene Fläche)

   `score0`/`why0` halten den Grundwert. `rescore()` setzt den Score immer neu aus Grundwert, Gegencheck (`it.chk`) und KI-Check (`it.ai`) zusammen; `applyCheck()` und `applyAI()` rufen es auf. Funde, die die Sammelprüfung nicht abdeckt, werden beim Öffnen der Detailansicht einzeln geprüft.
5. **KI-Check** auf Knopfdruck in der Detailansicht (`runAI()`): Claude recherchiert per Websuche, was heute dort ist. Läuft direkt aus dem Browser mit dem eigenen API-Schlüssel der Nutzerin oder des Nutzers (Filter-Dialog, Abschnitt KI-Check).
   - SDK `@anthropic-ai/sdk` 1.6.0 wird erst beim ersten KI-Check per `import()` von jsDelivr geladen (`SDK_URL` in `js/app/ai.js`), mit `dangerouslyAllowBrowser: true`.
   - Anfrage aus `aiRequest()`: `client.beta.messages.stream()`, Modell `claude-opus-5-5` (Standard) oder `claude-sonnet-5-5`, `output_config.effort: medium`, Refusal-Fallback (`betas: server-side-fallback-2026-07-01`, `fallbacks: 'default'`), Tools `web_search_20260318` (max. 5 Suchen, `user_location` aus Photon) und `ergebnis_melden` (`strict: true`). Ein festes JSON-Ausgabeformat (`output_config.format`) geht nicht, weil die Websuche immer Quellenangaben erzeugt und beides zusammen einen 400er gibt; deshalb meldet Claude das Ergebnis über dieses Werkzeug. Erzwingen lässt sich der Aufruf auf diesen Modellen nicht (`tool_choice` any/tool gibt 400), deshalb hakt die App einmal nach, wenn Claude ohne Werkzeug antwortet. `pause_turn` wird bis zu dreimal fortgesetzt.
   - `aiRead()` holt das Ergebnis aus dem Werkzeugaufruf und lässt nur Quellen-URLs durch, die wirklich in den Suchergebnissen oder Zitaten vorkamen (nur http/https). `aiCost()` schätzt die Kosten aus `usage` (Preise im Code bei `AI_MODELS`, Websuche 1 Cent pro Suche).
   - Ergebnis `it.ai`: `s` Status (verlassen, teilweise_genutzt, umgenutzt, umbau, abgerissen, unklar), `c` Sicherheit, `b` Bekanntheit, `d` Stand, `z` Zusammenfassung, `q` Quellen, `t` Zeitpunkt, `m` Modell, `cost`. Wird pro Fund in `lostradar.ki` gespeichert und bei jeder Suche wieder angewendet.

## Geheimtipp-Score (0–100, Start 50)
- **Plus:** kein Name +15 (nur alter Name wie `old_name`, `abandoned:name`, `disused:name`, `was:name` +5), als verlassen/stillgelegt/Ruine/baufällig markiert +8, ab 400 m² +6 bzw. ab 2.000 m² +12, Tunnel ab 150 m +10
- **Minus:** Wikipedia/Wikidata −30, Sehenswürdigkeit (`tourism=attraction|museum|…`) −35, Website/Telefon −12, Öffnungszeiten −15, Eintritt −10, Baudenkmal −5, Burg/Schloss −10, Foto verlinkt −5, nur „ehemalig“ im Namen −10, Brachfläche −10, Leerstand −10
- **Kein Lost Place mehr (aus den eigenen Tags):** Notiz (`note`, `description`, `fixme`) sagt „abgerissen“ −50 bzw. Umbau/Sanierung/Abriss geplant −25 (Verneinungen wie „unsaniert“ zählen nicht), selbst als Baustelle eingetragen −25, neben dem Lifecycle-Tag schon eine neue Nutzung (z. B. `disused:railway=station` + `amenity=kindergarten`) −45
- **Gegencheck:** siehe Datenfluss Schritt 4
- **KI-Check:** verlassen +5, teilweise genutzt −15, umgenutzt −45, Umbau −25, abgerissen −60 (bei Sicherheit „niedrig“ jeweils halb); Bekanntheit kaum +5, bekannt −10, sehr bekannt −20. Ist die KI sicher (Status nicht „unklar“, Sicherheit nicht „niedrig“), zählt der Gegencheck nicht mehr, weil die Websuche aktueller ist als OSM.
- **Stufen:** ab 70 Geheimtipp, ab 45 wenig bekannt, ab 25 bekannt, darunter Touri-Spot. Der Standardfilter zeigt alles ab 45.

## Externe Dienste
- **Daten:** Overpass API
- **KI-Check:** Claude-API (api.anthropic.com, direkt aus dem Browser, CORS über den Header `anthropic-dangerous-direct-browser-access`, den das SDK setzt), SDK von cdn.jsdelivr.net
- **Ortssuche und Reverse-Geocoding:** Photon (komoot)
- **Kacheln:** CARTO für die Karte (hell oder dunkel je nach System), Esri World Imagery mit Labels fürs Luftbild, OpenTopoMap für Topo
- **Schrift:** Barlow / Barlow Condensed von Google Fonts

## localStorage (Präfix `lostradar.`)
- `view`: Kartenposition
- `layer`: Kartenansicht
- `filters2`: Filter (Default: `names=false`, `brown=false`, `known=unknown`)
- `favs`: Merkliste inkl. OSM-Tags und Gegencheck-Ergebnis
- `ep`: zuletzt funktionierender Overpass-Server
- `aikey`: API-Schlüssel von Anthropic für den KI-Check (bleibt im Browser, geht nur an api.anthropic.com)
- `aimodel`: Modell für den KI-Check
- `ki`: KI-Ergebnisse pro Fund (höchstens 300, die ältesten fliegen raus)

## Design
Mobile first.
- **Telefon:** Karte vollflächig, schwebende Suchleiste, ziehbares Bottom-Sheet (peek/half/full)
- **Ab 900 px:** 400-px-Sidebar links
- **Farben:** Moos `#1d5236`, Warnschild-Gelb `#ffd400`, Beton `#e6e4dd`. Dark Mode über `prefers-color-scheme`.

## Stand und offene Punkte
- **Live-Test (November 2026):** Haupt- und Gegencheck-Abfrage laufen auf echten Overpass-Servern (0.7.62) fehlerfrei durch.
  - maps.mail.ru, Bremen und Umgebung (ca. 820 km²): Hauptabfrage 24 s, rund 1.100 Elemente; Gegencheck-Entwurf für 400 Funde 28 s. Die 24 s liegen knapp unter dem Server-Timeout von 25 s, bei 4.000 km² in dichten Gegenden kann es eng werden.
  - overpass.osm.ch (nur Schweiz), Zürich (ca. 315 km²): kompletter Durchlauf in der App per Playwright, Hauptabfrage 10–11 s, Gegencheck für 182 Funde 20–22 s.
  - overpass-api.de war aus der Cloud-Umgebung nicht erreichbar (Verbindung zurückgesetzt), private.coffee und kumi.systems antworteten nicht, maps.mail.ru war zeitweise überlastet (504). Wie schnell es auf overpass-api.de läuft, ist also weiter offen.
- `map_to_area` gibt auf Overpass 0.7.62 geschlossene Wege direkt als Fläche zurück. Ältere Server liefern Flächen nur, wenn der Area-Creator sie angelegt hat; Funde ohne Fläche landen dann als `na` („nicht prüfbar“) statt falsch als „nichts gefunden“.
- **KI-Check noch nicht mit echtem Schlüssel getestet.** Geprüft wurden: CORS-Vorabanfrage und 401-Antwort der echten API, Laden des SDK vom CDN im Browser, der ganze Ablauf in der App mit simulierten Stream-Antworten (Ergebnis, `pause_turn`, Nachhaken, Abbrechen, 401). Offen: echte Antwortqualität, Dauer und Kosten pro Ort. Die Kostenangabe in der App („ein paar Cent bis etwa einen halben Euro“) ist geschätzt.
- **Kartenkacheln von CARTO:** Im November 2026 lieferte basemaps.cartocdn.com aus der Cloud-Umgebung nur Kacheln mit „API KEY REQUIRED“, auch mit dem Referer der Live-Seite. Ob das auf echten Geräten auch so ist, ist ungeprüft; falls ja, braucht die Kartenansicht „Karte“ einen anderen Anbieter.
- Kategorien und Score sind Heuristiken und sollten an echten Treffern nachjustiert werden.
- Ideen für später: Trefferliste exportieren, besuchte Orte abhaken, eigene Notizen pro Ort.
- Der Hinweis im Filter-Dialog bleibt drin: Hausfriedensbruch (§ 123 StGB), Einsturz/Asbest, Kampfmittel, Fledermaus-Winterquartiere (§ 44 BNatSchG).
