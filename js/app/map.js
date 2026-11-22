// Lost Radar – Karte: Leaflet, Kartenansichten, Ebene für die Punkte, Auswahl-Markierung

import { $, $$, store, wide, dark } from './state.js';

const v0 = store.get('view', null) || { c: [53.08, 8.81], z: wide() ? 11 : 10 };
export const map = L.map('map', { zoomControl: false, preferCanvas: true, minZoom: 5 }).setView(v0.c, v0.z);
map.attributionControl.setPrefix(false);
L.control.zoom({ position: 'bottomright', zoomInTitle: 'Reinzoomen', zoomOutTitle: 'Rauszoomen' }).addTo(map);
const OSM = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';
const BASE = {
  karte: L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (dark ? 'dark_all' : 'light_all') + '/{z}/{x}/{y}{r}.png',
    { subdomains: 'abcd', maxZoom: 20, attribution: OSM + ' © <a href="https://carto.com/attributions">CARTO</a>' }),
  sat: L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 20, attribution: 'Luftbild © Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 20 })
  ]),
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { subdomains: 'abc', maxNativeZoom: 17, maxZoom: 20, attribution: OSM + ', SRTM | © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' })
};
let base = store.get('layer', 'karte');
if (!BASE[base]) base = 'karte';
BASE[base].addTo(map);
function syncLayers() { $$('#layers button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === base))); }
export function setBase(k) {
  if (!BASE[k] || k === base) return;
  map.removeLayer(BASE[base]); base = k; BASE[k].addTo(map); store.set('layer', k); syncLayers();
}
syncLayers();
$('#layers').addEventListener('click', e => { const b = e.target.closest('button[data-l]'); if (b) setBase(b.dataset.l); });

export const renderer = L.canvas({ padding: 0.4 });
export const dots = L.layerGroup().addTo(map);
export const selMk = L.marker([0, 0], { icon: L.divIcon({ className: 'selmk', iconSize: [30, 30], iconAnchor: [15, 15] }), interactive: false, keyboard: false, zIndexOffset: 1000 });
export const rad = it => it.len ? 7 : it.area == null ? 6 : it.area < 300 ? 6 : it.area < 2000 ? 8 : it.area < 10000 ? 10 : 12;
export const bboxOf = () => { const b = map.getBounds(); return { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }; };
