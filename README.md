# Lost Radar

Mobile Web-App, die verlassene und stillgelegte Orte („Lost Places“) in Deutschland live aus OpenStreetMap holt und unbekannte von touristischen trennt.

Live: https://seventoor.github.io/LP/

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `index.html` | Grundgerüst und Markup |
| `css/app.css` | Gestaltung |
| `js/core/` | Logik ohne Oberfläche: Overpass-Abfrage, Einordnung, Score, Gegencheck, KI-Check. Läuft auch in Node. |
| `js/app/` | Oberfläche: Karte, Liste, Detailansicht, Filter, Merkliste, Ortssuche |
| `vendor/leaflet/` | Leaflet 1.9.4, unverändert |
| `tests/` | Tests für `js/core` |
| `icons/`, `manifest.webmanifest` | App-Icon und Einstellungen für den Home-Bildschirm |

Es gibt keinen Build-Schritt: Der Browser lädt die Dateien direkt als ES-Module, GitHub Pages liefert sie so aus, wie sie im Repo liegen.

## Lokal starten

Im Projektordner einen kleinen Webserver starten, zum Beispiel

```
python3 -m http.server 8000
```

und http://localhost:8000 öffnen. Ein Doppelklick auf `index.html` reicht nicht, weil Browser ES-Module nicht direkt von der Festplatte (`file://`) laden.

## Tests

```
npm test
```

Braucht Node.js 20 oder neuer, sonst nichts.

## Daten

© OpenStreetMap-Mitwirkende (ODbL), abgefragt über die Overpass API. Ortssuche: Photon von komoot.
