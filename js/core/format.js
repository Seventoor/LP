// Lost Radar – Flächen, Entfernungen und Datumsangaben
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

export function areaKm2(bb) {
  var lat = (bb.s + bb.n) / 2;
  return Math.abs((bb.n - bb.s) * 111.32 * (bb.e - bb.w) * 111.32 * Math.cos(lat * Math.PI / 180));
}
export function dist(a, b, c, d) {
  var R = 6371000, r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
  var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function round2(n) { if (n < 100) return Math.max(5, Math.round(n / 5) * 5); var p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; }
export function fmtArea(it) {
  if (it.len) return 'ca. ' + round2(it.len).toLocaleString('de-DE') + ' m lang';
  if (it.area == null) return null;
  if (it.area >= 10000) return 'ca. ' + (it.area / 10000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' ha';
  return 'ca. ' + round2(it.area).toLocaleString('de-DE') + ' m²';
}
export function fmtDist(m) {
  if (m < 1000) return Math.round(m / 10) * 10 + ' m';
  if (m < 10000) return (m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km';
  return Math.round(m / 1000) + ' km';
}
const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
// „2019-05-12T10:00:00Z“ oder „2019-05“ → „Mai 2019“
export function fmtMonth(d) {
  var m = /^(\d{4})(?:-(\d{2}))?/.exec(d || '');
  return m ? (m[2] && +m[2] >= 1 && +m[2] <= 12 ? MON[+m[2] - 1] + ' ' : '') + m[1] : null;
}
