# Lost Radar (Repo „LP“)

Mobile Web-App, die verlassene und stillgelegte Orte („Lost Places“) in Deutschland live aus OpenStreetMap holt und unbekannte von touristischen trennt.
Live: https://seventoor.github.io/LP/ (GitHub Pages aus `main`, Root). Texte in der App: Deutsch, locker, keine Emojis.

## Aufbau
Kein Build-Schritt. `index.html` ist die komplette App in einer Datei, Reihenfolge darin:
1. Leaflet 1.9.4 CSS, inline: nicht anfassen
2. App-CSS, beginnt mit dem Kommentar `/* VOICE …`
3. Markup: Suchleiste `#bar`, Suchknopf `#scan`, Ebenen `#layers`, Bottom-Sheet `#sheet` (Liste/Detail in `#body`), Filter-Dialog `#filters`, `#toast`
4. Leaflet 1.9.4 JS, inline und minifiziert: nicht anfassen
5. `var LR = (function(){…})()`: Kernlogik ohne DOM (Abfrage, Server-Fallback, Einordnung, Score, Formatierung)
6. App-Block `{ … }`: Karte, Suche, Liste, Detailansicht, Filter, Merkliste (GPX-Export), Ortssuche

`lost-radar.html` leitet nur auf `./` weiter (alter Link).
Die Datei läuft auch lokal per `file://`. Alle externen Dienste müssen deshalb CORS-fähig sein und ohne Referer funktionieren.

## Datenfluss
1. „Hier suchen“ → `LR.buildQuery(bbox, filter)` erzeugt Overpass QL mit `out body bb qt`. Der Kartenausschnitt darf höchstens `LR.MAX_KM2` = 4000 km² groß sein.
2. `LR.overpass()` probiert nacheinander overpass-api.de, overpass.private.coffee, maps.mail.ru und overpass.kumi.systems. Jeder Server hat 32 s Zeit (Server-Timeout 25 s). Der zuletzt erfolgreiche Server kommt zuerst dran.
3. `LR.process()` ruft für jedes Element `classify()` auf:
   - `what()`: frühere Nutzung, Lifecycle-Präfixe `abandoned:`/`disused:`/`ruins:` zuerst
   - `valid()`: wirft Kleinkram raus (Bänke, Garagen, Gleise, kleine Läden …)
   - `catOf()`: sortiert in die Kategorien mil, ind, pub, bahn, bau, ruin, brach
   - `stateOf()`: Zustand
   - `scoreOf()`: Score samt Begründung

   Punkte, die in einem gefundenen Gebäude liegen, werden mit diesem zusammengelegt. Die Fläche ist eine grobe Schätzung: Bounding-Box × 0,75.

## Geheimtipp-Score (0–100, Start 50)
- **Plus:** kein Name +15 (nur `old_name` +5), als verlassen/stillgelegt/Ruine/baufällig markiert +8, ab 400 m² +6 bzw. ab 2.000 m² +12, Tunnel ab 150 m +10
- **Minus:** Wikipedia/Wikidata −30, Sehenswürdigkeit (`tourism=attraction|museum|…`) −35, Website/Telefon −12, Öffnungszeiten −15, Eintritt −10, Baudenkmal −5, Burg/Schloss −10, Foto verlinkt −5, nur „ehemalig“ im Namen −10, Brachfläche −10
- **Stufen:** ab 70 Geheimtipp, ab 45 wenig bekannt, ab 25 bekannt, darunter Touri-Spot. Der Standardfilter zeigt alles ab 45.

## Externe Dienste
- **Daten:** Overpass API
- **Ortssuche und Reverse-Geocoding:** Photon (komoot)
- **Kacheln:** CARTO für die Karte (hell oder dunkel je nach System), Esri World Imagery mit Labels fürs Luftbild, OpenTopoMap für Topo
- **Schrift:** Barlow / Barlow Condensed von Google Fonts

## localStorage (Präfix `lostradar.`)
- `view`: Kartenposition
- `layer`: Kartenansicht
- `filters2`: Filter (Default: `names=false`, `brown=false`, `known=unknown`)
- `favs`: Merkliste inkl. OSM-Tags
- `ep`: zuletzt funktionierender Overpass-Server

## Design
Mobile first.
- **Telefon:** Karte vollflächig, schwebende Suchleiste, ziehbares Bottom-Sheet (peek/half/full)
- **Ab 900 px:** 400-px-Sidebar links
- **Farben:** Moos `#1d5236`, Warnschild-Gelb `#ffd400`, Beton `#e6e4dd`. Dark Mode über `prefers-color-scheme`.

## Stand und offene Punkte
- **Wichtigster offener Punkt:** Die Abfrage wurde noch nie gegen die echten Overpass-Server getestet. Beim Bau war overpass-api.de nicht erreichbar, getestet wurde nur mit Mock-Daten über Playwright. Erste Aufgabe ist daher, live zu prüfen, ob die Abfrage (Key-Regex-Statements, `out body bb qt`) sauber durchläuft und wie lange sie dauert.
- Kategorien und Score sind Heuristiken und sollten an echten Treffern nachjustiert werden.
- Ideen für später: Trefferliste exportieren, besuchte Orte abhaken, eigene Notizen pro Ort.
- Der Hinweis im Filter-Dialog bleibt drin: Hausfriedensbruch (§ 123 StGB), Einsturz/Asbest, Kampfmittel, Fledermaus-Winterquartiere (§ 44 BNatSchG).
