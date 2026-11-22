// Lost Radar – Start: verbindet die Module, Klicks im Bottom-Sheet, Kartenbewegung, erste Suche

import * as C from '../core/index.js';
import { $, title, store, S } from './state.js';
import { map, setBase, selMk, bboxOf } from './map.js';
import { body, setSheet } from './sheet.js';
import { updPill, scan } from './scan.js';
import { sortView, render } from './list.js';
import { focusOn, select, unselect } from './detail.js';
import { runCheck } from './check.js';
import { runAI } from './ai.js';
import { toggleFav, copy, gpx } from './favs.js';
import { fl, fdot, openFilters, closeFilters } from './filters.js';

body.addEventListener('click', e => {
  const r = e.target.closest('.row');
  if (r) { select(r.dataset.id, true); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const act = a.dataset.act, it = S.sel;
  if (act === 'back') unselect();
  else if (act === 'fav' && it) toggleFav(it);
  else if (act === 'recheck' && it) { runCheck([it], false); const keep = body.scrollTop; render(); body.scrollTop = keep; }
  else if (act === 'ai' && it) runAI(it);
  else if (act === 'aistop' && it && S.ai[it.id]) S.ai[it.id].ctl.abort();
  else if (act === 'aisetup') openFilters('ki');
  else if (act === 'copy' && it) copy(it.lat.toFixed(5) + ', ' + it.lon.toFixed(5), 'Koordinaten kopiert');
  else if (act === 'sat' && it) { setBase('sat'); focusOn(it, 18); }
  else if (act === 'more') { S.limit += 150; render(); }
  else if (act === 'retry') scan();
  else if (act === 'filters') openFilters();
  else if (act === 'gpx') gpx();
  else if (act === 'copyall') copy(Object.values(S.favs).map(f => title(f) + ' – ' + f.lat.toFixed(5) + ', ' + f.lon.toFixed(5) + ' – https://www.openstreetmap.org/' + f.type + '/' + f.osm).join('\n'), 'Merkliste kopiert');
});
$('#t-list').addEventListener('click', () => { S.tab = 'list'; S.sel = null; map.removeLayer(selMk); render(true); });
$('#t-favs').addEventListener('click', () => { S.tab = 'favs'; S.sel = null; map.removeLayer(selMk); render(true); });
$('#sort').addEventListener('change', e => { S.f.sort = e.target.value; sortView(); render(true); store.set('filters2',S.f); });

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!fl.hidden) closeFilters(); else if (S.sel) unselect();
});
map.on('moveend', () => {
  const c = map.getCenter();
  store.set('view', { c: [+c.lat.toFixed(5), +c.lng.toFixed(5)], z: map.getZoom() });
  updPill();
  if (!S.sel && S.done) {
    if (S.f.sort === 'dist') sortView();
    const keep = body.scrollTop; render(); body.scrollTop = keep;
  }
});

setSheet('half');
render(true);
fdot();
updPill();
if (C.areaKm2(bboxOf()) <= C.MAX_KM2) scan();
