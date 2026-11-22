// Lost Radar – Overpass-Abfrage bauen und mit Server-Fallback abschicken
// Kernlogik ohne DOM, läuft auch in Node (Tests unter tests/).

export const MAX_KM2 = 4000;
export function buildQuery(bb, opt) {
  opt = opt || {};
  var B = [bb.s, bb.w, bb.n, bb.e].map(function (v) { return v.toFixed(5); }).join(',');
  var L = [
    'nwr["abandoned"="yes"]', 'nwr["disused"="yes"]',
    'nwr[~"^(abandoned|disused|ruins):(building|amenity|tourism|leisure|man_made|industrial|military|aeroway|shop|office|craft|power|landuse|place)$"~"."]',
    'nwr["building"~"^(ruins|abandoned|collapsed|damaged|bunker)$"]', 'nwr["ruins"]["ruins"!="no"]',
    'nwr["historic"="ruins"]', 'nwr["military"="bunker"]',
    'wr["building:condition"~"ruin|derelict|deteriorat|collapsed"]',
    'way["railway"~"^(abandoned|disused)$"]["tunnel"="yes"]',
    'nwr[~"^(abandoned|disused):railway$"~"^(station|halt|roundhouse|signal_box|workshop|depot|turntable|engine_shed|tunnel)$"]'
  ];
  if (opt.names) L.push('wr["name"~"(^|[ (/-])(ehem[.]|ehemalig)",i]');
  if (opt.brown) L.push('wr["landuse"="brownfield"]');
  return '[out:json][timeout:25][maxsize:268435456][bbox:' + B + '];\n(\n  ' + L.join(';\n  ') + ';\n);\nout meta bb qt;';
}

// Öffentliche Overpass-Server: der zuletzt erfolgreiche kommt zuerst dran, jeder bekommt ein Zeitlimit
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const TIMEOUT_MS = (typeof window !== 'undefined' && window.LR_TIMEOUT_MS) || 32000;
function abortErr() { var e = new Error('abgebrochen'); e.name = 'AbortError'; return e; }
export function overpass(q, signal, onTry) {
  var order = ENDPOINTS.slice(), pref = null, i = 0, last = null;
  try { pref = localStorage.getItem('lostradar.ep'); } catch (e) {}
  if (pref && order.indexOf(pref) > 0) { order.splice(order.indexOf(pref), 1); order.unshift(pref); }
  function next() {
    if (signal && signal.aborted) return Promise.reject(abortErr());
    if (i >= order.length) return Promise.reject(last || new Error('kein Server erreichbar'));
    var url = order[i++], ctl = new AbortController(), timedOut = false;
    var timer = setTimeout(function () { timedOut = true; ctl.abort(); }, TIMEOUT_MS);
    var onAbort = function () { ctl.abort(); };
    if (signal) signal.addEventListener('abort', onAbort);
    function done() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', onAbort); }
    if (onTry) onTry(i, order.length);
    return fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: ctl.signal })
      .then(function (r) {
        if (!r.ok) { var err = new Error('HTTP ' + r.status); err.status = r.status; throw err; }
        return r.json();
      })
      .then(function (j) {
        done();
        if (j && j.remark && !(j.elements && j.elements.length) && /timed out|out of memory|runtime error/i.test(j.remark)) {
          last = new Error(j.remark); last.overload = true; return next();
        }
        try { localStorage.setItem('lostradar.ep', url); } catch (e) {}
        return j;
      }, function (e) {
        done();
        if (signal && signal.aborted) throw abortErr();
        if (e && e.status === 400) throw e;
        last = timedOut ? Object.assign(new Error('Zeitlimit'), { timeout: true }) : e;
        return next();
      });
  }
  return next();
}
