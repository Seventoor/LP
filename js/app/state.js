// Lost Radar – Gemeinsamer Zustand, Speicher (localStorage) und kleine Helfer

export const $ = s => document.querySelector(s);
export const $$ = s => Array.from(document.querySelectorAll(s));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Anzeigename: Name, sonst Typ mit früherem Namen (Fabrik „Kellogg's“), sonst nur der Typ
export const title = it => it.name || (it.old ? it.label + ' „' + it.old + '“' : it.label);
export const store = {
  get(k, d) { try { const v = localStorage.getItem('lostradar.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lostradar.' + k, JSON.stringify(v)); } catch (e) {} }
};
const DEF = { cats: { mil: true, ind: true, pub: true, bahn: true, bau: true, ruin: true, brach: true }, known: 'unknown', size: 0, sort: 'score', names: false, brown: false };
const saved = store.get('filters2', {}) || {};
export const S = {
  items: [], view: [], sel: null, box: null, done: false, busy: null, err: null, tab: 'list', limit: 150, geo: {}, geoP: {}, ai: {},
  f: Object.assign({}, DEF, saved, { cats: Object.assign({}, DEF.cats, saved.cats || {}) }),
  favs: store.get('favs', {}) || {}
};
export const root = document.documentElement;
export const wide = () => matchMedia('(min-width: 900px)').matches;
export const dark = root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

let tT = null;
export function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(tT); tT = setTimeout(() => { el.hidden = true; }, 4500); }
