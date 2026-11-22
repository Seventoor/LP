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

Home-Bildschirm (iPhone/Android): `manifest.webmanifest`, Icons in `icons/` (Quelle `icons/icon.svg`, PNGs daraus gerendert: `apple-touch-icon.png` 180 px, 192, 512, maskable 512). Als Web-App läuft sie im Standalone-Modus mit transparenter Statusleiste (`black-translucent`); `#statusscrim` legt dann oben einen dunklen Verlauf unter Uhrzeit/Akku, und das Bottom-Sheet rechnet den oberen Safe-Area-Abstand ein (`safeTop()`).
Die Datei läuft auch lokal per `file://`. Alle externen Dienste müssen deshalb CORS-fähig sein und ohne Referer funktionieren.

## Datenfluss
1. „Hier suchen“ → `LR.buildQuery(bbox, filter)` erzeugt Overpass QL mit `out meta bb qt` (meta für das Datum der letzten Bearbeitung). Der Kartenausschnitt darf höchstens `LR.MAX_KM2` = 4000 km² groß sein.
2. `LR.overpass()` probiert nacheinander overpass-api.de, overpass.private.coffee, maps.mail.ru und overpass.kumi.systems. Jeder Server hat 32 s Zeit (Server-Timeout 25 s). Der zuletzt erfolgreiche Server kommt zuerst dran.
3. `LR.process()` ruft für jedes Element `classify()` auf:
   - `what()`: frühere Nutzung, Lifecycle-Präfixe `abandoned:`/`disused:`/`ruins:` zuerst
   - `valid()`: wirft Kleinkram raus (Bänke, Garagen, Gleise, kleine Läden, Räume mit `indoor=*` wie leere Läden im Einkaufszentrum …)
   - `catOf()`: sortiert in die Kategorien mil, ind, pub, bahn, bau, ruin, brach
   - `stateOf()`: Zustand. `disused:` an Läden, Büros, Werkstätten und kleinen Lokalen (Bank, Apotheke, Café …) heißt „Leerstand“
   - `scoreOf()`: Score samt Begründung

   Punkte, die in einem gefundenen Gebäude liegen, werden mit diesem zusammengelegt. Die Fläche ist eine grobe Schätzung: Bounding-Box × 0,75.
4. **Gegencheck** direkt danach im Hintergrund (`startCheck()` → `LR.checkQuery()` → `LR.checkRead()` → `LR.applyCheck()`): Für die bis zu 400 besten Funde ab Score 45 fragt eine zweite Overpass-Abfrage ab, was OSM heute auf dem Gelände verzeichnet (Läden, Firmen, Handwerk, Praxen, Vereine, Gastro, Schulen, Hotels, Sportstätten, Baustellen, Wohngebiete). Flächen bis 1 km² über `map_to_area` plus Punkt-in-Fläche-Test im Browser (Umrisse per `out skel geom`), Punkte im Umkreis von 30 m. Ergebnis pro Fund in `it.chk.v`:
   - `reuse`: Betrieb auf dem Gelände (unter 1 ha reicht 1 Eintrag, sonst mind. 2 bzw. 1 pro 5 ha) −45
   - `part`: vereinzelt Betrieb auf großem Gelände −15
   - `bau`: nur Baustelle −25 (zusätzlich zu `reuse`/`part` ebenfalls −25)
   - `busy`: Punkt mit mind. 3 Betrieben im Umkreis, also eher Leerstand in der Einkaufsstraße −30
   - `near`: Punkt mit 1–2 Betrieben im Umkreis −10
   - `none`: nichts gefunden, `na`: nicht prüfbar (keine geschlossene Fläche)

   `score0`/`why0` halten den Grundwert, `applyCheck()` rechnet immer von dort. Funde, die die Sammelprüfung nicht abdeckt, werden beim Öffnen der Detailansicht einzeln geprüft.

## Geheimtipp-Score (0–100, Start 50)
- **Plus:** kein Name +15 (nur alter Name wie `old_name`, `abandoned:name`, `disused:name`, `was:name` +5), als verlassen/stillgelegt/Ruine/baufällig markiert +8, ab 400 m² +6 bzw. ab 2.000 m² +12, Tunnel ab 150 m +10
- **Minus:** Wikipedia/Wikidata −30, Sehenswürdigkeit (`tourism=attraction|museum|…`) −35, Website/Telefon −12, Öffnungszeiten −15, Eintritt −10, Baudenkmal −5, Burg/Schloss −10, Foto verlinkt −5, nur „ehemalig“ im Namen −10, Brachfläche −10, Leerstand −10
- **Kein Lost Place mehr (aus den eigenen Tags):** Notiz (`note`, `description`, `fixme`) sagt „abgerissen“ −50 bzw. Umbau/Sanierung/Abriss geplant −25 (Verneinungen wie „unsaniert“ zählen nicht), selbst als Baustelle eingetragen −25, neben dem Lifecycle-Tag schon eine neue Nutzung (z. B. `disused:railway=station` + `amenity=kindergarten`) −45
- **Gegencheck:** siehe Datenfluss Schritt 4
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
- `favs`: Merkliste inkl. OSM-Tags und Gegencheck-Ergebnis
- `ep`: zuletzt funktionierender Overpass-Server

## Design
Mobile first.
- **Telefon:** Karte vollflächig, schwebende Suchleiste, ziehbares Bottom-Sheet (peek/half/full)
- **Ab 900 px:** 400-px-Sidebar links
- **Farben:** Moos `#1d5236`, Warnschild-Gelb `#ffd400`, Beton `#e6e4dd`. Dark Mode über `prefers-color-scheme`.

## Stand und offene Punkte
- **Live-Test:** Haupt- und Gegencheck-Abfrage laufen auf maps.mail.ru (Overpass 0.7.62) fehlerfrei durch. Bremen und Umgebung (ca. 820 km²): Hauptabfrage 24 s, rund 1.100 Elemente; Gegencheck für 400 Funde 28 s. Die 24 s liegen knapp unter dem Server-Timeout von 25 s, bei 4.000 km² in dichten Gegenden kann es eng werden. overpass-api.de war aus der Cloud-Umgebung nicht erreichbar, private.coffee und kumi.systems antworteten nicht; maps.mail.ru war zeitweise überlastet (504).
- `map_to_area` gibt auf Overpass 0.7.62 geschlossene Wege direkt als Fläche zurück. Ältere Server liefern Flächen nur, wenn der Area-Creator sie angelegt hat; Funde ohne Fläche landen dann als `na` („nicht prüfbar“) statt falsch als „nichts gefunden“.
- Kategorien und Score sind Heuristiken und sollten an echten Treffern nachjustiert werden.
- Ideen für später: Trefferliste exportieren, besuchte Orte abhaken, eigene Notizen pro Ort.
- Der Hinweis im Filter-Dialog bleibt drin: Hausfriedensbruch (§ 123 StGB), Einsturz/Asbest, Kampfmittel, Fledermaus-Winterquartiere (§ 44 BNatSchG).
