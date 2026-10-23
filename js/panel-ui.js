// Shared UI helpers for the demo panels: safe DOM builder, formatters, hand-written
// SVG charts, toast messages, and the app shell (guard, router, mobile sidebar).
// All user-entered text is inserted with textContent / text nodes, never innerHTML.
import { requireRole, logout } from './demo-auth.js';
import { resetDemoData, onChange } from './demo-store.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ---------------------------------------------------------------- DOM -----
/** h('div', { class: 'x', onclick: fn, 'aria-label': 'y' }, child, 'text', ...) */
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  applyProps(el, props);
  appendKids(el, kids);
  return el;
}

export function svg(tag, props, ...kids) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  appendKids(el, kids);
  return el;
}

function applyProps(el, props) {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function appendKids(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k === null || k === undefined || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// ---------------------------------------------------------- formatting ----
const moneyFmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
export const money = (n) => moneyFmt.format(n);
export const num = (n, d = 0) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '-');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '-');

export const LABELS = {
  invoice: { paid: 'Ödendi', unpaid: 'Ödenmedi', overdue: 'Gecikmiş' },
  ticket: { open: 'Açık', answered: 'Yanıtlandı', closed: 'Kapalı' },
  priority: { low: 'Düşük', normal: 'Normal', high: 'Yüksek' },
  customer: { active: 'Aktif', suspended: 'Askıda' },
  service: { active: 'Aktif', suspended: 'Askıda' },
  order: { pending: 'Beklemede', approved: 'Onaylandı', rejected: 'Reddedildi' },
  serviceType: { colo: 'Co-location', vds: 'VDS', internet: 'İnternet' },
  link: { up: 'Çalışıyor', degraded: 'Yavaş', down: 'Kapalı' },
  severity: { critical: 'Kritik', warning: 'Uyarı', info: 'Bilgi' },
  power: { running: 'Çalışıyor', stopped: 'Durduruldu' },
};

const TONES = { paid: 'ok', active: 'ok', up: 'ok', running: 'ok', approved: 'ok', answered: 'info', info: 'info', unpaid: 'warn', open: 'warn', pending: 'warn', degraded: 'warn', warning: 'warn', low: 'muted', normal: 'info', closed: 'muted', stopped: 'muted', overdue: 'bad', suspended: 'bad', rejected: 'bad', down: 'bad', critical: 'bad', high: 'bad' };

export function badge(value, label) {
  return h('span', { class: `pbadge tone-${TONES[value] || 'muted'}` }, label || value);
}

export function sampleTag(text = 'Örnek veri') {
  return h('span', { class: 'sample-tag mono' }, text);
}

export function emptyState(text) { return h('p', { class: 'empty' }, text); }

export function card(title, ...body) {
  return h('section', { class: 'pcard' }, title ? h('h3', { class: 'pcard-h' }, title) : null, ...body);
}

export function meter(pct, label) {
  const p = Math.max(0, Math.min(100, pct));
  const bar = h('span', { class: `meter${p >= 80 ? ' hot' : ''}`, role: 'img', 'aria-label': `${label}: yüzde ${Math.round(p)}` }, h('i'));
  bar.firstChild.style.width = `${p}%`;
  return h('div', { class: 'meter-row' }, h('span', { class: 'meter-label' }, label), bar, h('span', { class: 'mono meter-val' }, `%${Math.round(p)}`));
}

export function dl(pairs) {
  return h('dl', { class: 'kv' }, pairs.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

export function table(headers, rows, caption) {
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'ptable' },
      caption ? h('caption', { class: 'sr-only' }, caption) : null,
      h('thead', null, h('tr', null, headers.map((t) => h('th', { scope: 'col' }, t)))),
      h('tbody', null, rows.map((cells) => h('tr', null, cells.map((c, i) => h('td', { 'data-label': headers[i] }, c)))))));
}

let fieldSeq = 0;
/** Label + control pair. control: element created by the caller; id is assigned here. */
export function field(label, control, hint) {
  const id = `f-${++fieldSeq}`;
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label, hint ? h('span', { class: 'hint' }, ` ${hint}`) : null), control);
}

export function option(value, text, selected) { return h('option', { value, selected: !!selected }, text); }

// --------------------------------------------------------------- toast ----
export function toast(text) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: 'toast' }, text);
  box.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// -------------------------------------------------------------- charts ----
const COLORS = ['#19e0ff', '#ffb340', '#3cffb0', '#8a5cff'];

/** Multi-series line chart. series: [{ name, values }]. labels: optional [first, last] x labels. */
export function lineChart(series, { unit = '', labels = ['', ''], min = 0, max, desc = '' } = {}) {
  const W = 320, H = 150, L = 38, R = 8, T = 10, B = 22;
  const all = series.flatMap((s) => s.values);
  const hi = max !== undefined ? max : Math.max(1, ...all) * 1.15;
  const lo = min;
  const x = (i, n) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': desc || series.map((s) => s.name).join(', ') });
  for (let g = 0; g <= 3; g++) {
    const v = lo + ((hi - lo) * g) / 3;
    root.appendChild(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
    root.appendChild(svg('text', { x: L - 5, y: y(v) + 3, 'text-anchor': 'end', class: 'axis' }, num(v, hi < 10 ? 1 : 0)));
  }
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${x(i, s.values.length).toFixed(1)},${y(v).toFixed(1)}`);
    if (!pts.length) return;
    const color = COLORS[si % COLORS.length];
    if (si === 0) root.appendChild(svg('polygon', { points: `${L},${y(lo)} ${pts.join(' ')} ${x(s.values.length - 1, s.values.length)},${y(lo)}`, fill: color, opacity: '0.12' }));
    root.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': '1.8', 'stroke-linejoin': 'round' }));
  });
  root.appendChild(svg('text', { x: L, y: H - 6, class: 'axis' }, labels[0]));
  root.appendChild(svg('text', { x: W - R, y: H - 6, 'text-anchor': 'end', class: 'axis' }, labels[1]));
  if (unit) root.appendChild(svg('text', { x: 2, y: 9, class: 'axis' }, unit));
  return root;
}

/** Bar chart. values: numbers, labels: same-length x labels (shown sparsely). */
export function barChart(values, labels, { unit = '', desc = '', color = COLORS[0] } = {}) {
  const W = 320, H = 150, L = 38, R = 8, T = 10, B = 22;
  const hi = Math.max(1, ...values) * 1.15;
  const bw = (W - L - R) / values.length;
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': desc || 'Çubuk grafik' });
  for (let g = 0; g <= 3; g++) {
    const v = (hi * g) / 3;
    const yy = T + (1 - v / hi) * (H - T - B);
    root.appendChild(svg('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'grid' }));
    root.appendChild(svg('text', { x: L - 5, y: yy + 3, 'text-anchor': 'end', class: 'axis' }, num(v, 0)));
  }
  values.forEach((v, i) => {
    const bh = (v / hi) * (H - T - B);
    root.appendChild(svg('rect', { x: L + i * bw + bw * 0.15, y: T + (H - T - B) - bh, width: bw * 0.7, height: Math.max(0, bh), fill: color, opacity: '0.85', rx: '1.5' }));
    if (labels[i]) root.appendChild(svg('text', { x: L + i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, labels[i]));
  });
  if (unit) root.appendChild(svg('text', { x: 2, y: 9, class: 'axis' }, unit));
  return root;
}

export function chartCard(title, chart, note) {
  return card(title, chart, h('div', { class: 'chart-note' }, sampleTag(), note ? h('span', null, note) : null));
}

// ----------------------------------------------------------------- shell ----
/**
 * Boots a panel: role guard, shared buttons, mobile sidebar, hash router.
 * routes: { name: async (args, ctx) => cleanupFn | void }  (view renders into ctx.main)
 * Returns the app handle or null when the guard redirected.
 */
export function createApp({ role, routes, defaultRoute }) {
  if (!requireRole(role)) return null;
  const main = document.getElementById('main');
  const navLinks = Array.from(document.querySelectorAll('[data-route]'));
  let cleanup = null;
  let token = 0;
  let pendingRemote = false;

  const safeDecode = (s) => { try { return decodeURIComponent(s); } catch (e) { return s; } };
  let current = { name: defaultRoute, args: [] };
  // Only "#/route/arg" hashes are routes. Other hashes (for example the skip link "#main")
  // keep the current view.
  const isRouteHash = (hash) => hash === '' || hash === '#' || hash.startsWith('#/');
  const parse = () => {
    const hash = window.location.hash;
    if (!isRouteHash(hash)) return current;
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(safeDecode);
    const name = parts.length && Object.hasOwn(routes, parts[0]) ? parts[0] : defaultRoute;
    current = { name, args: name === parts[0] ? parts.slice(1) : [] };
    return current;
  };

  // Focus restore: remember which control had focus (by tag + label/text) and refocus its
  // counterpart after a re-render.
  const focusKey = (el) => {
    if (!el || !main.contains(el) || el === main) return null;
    let text = '';
    if (el.id) { const l = main.querySelector(`label[for="${el.id}"]`); if (l) text = l.textContent; }
    if (!text) text = el.getAttribute('aria-label') || el.textContent || el.getAttribute('name') || '';
    return { tag: el.tagName, text: text.trim() };
  };
  const focusByKey = (key) => {
    if (!key) return;
    const cands = main.querySelectorAll('button, a[href], input, select, textarea');
    for (const el of cands) {
      const k = focusKey(el);
      if (k && k.tag === key.tag && k.text === key.text) { el.focus({ preventScroll: true }); return; }
    }
  };

  async function render({ focus = false } = {}) {
    const { name, args } = parse();
    const my = ++token;
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    navLinks.forEach((a) => {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const scroll = focus ? 0 : window.scrollY;
    const key = focus ? null : focusKey(document.activeElement);
    const frag = document.createElement('div');
    frag.className = 'view';
    let result;
    try {
      result = await routes[name](args, { main: frag, app, render });
    } catch (err) {
      frag.replaceChildren(h('p', { class: 'empty' }, `Bir hata oluştu: ${err && err.message ? err.message : err}`));
    }
    if (my !== token) { if (typeof result === 'function') result(); return; }
    cleanup = typeof result === 'function' ? result : null;
    main.replaceChildren(frag);
    document.body.classList.remove('side-open');
    if (focus) {
      const h1 = main.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    } else { window.scrollTo(0, scroll); focusByKey(key); }
  }

  const app = { render, role };

  window.addEventListener('hashchange', () => { if (isRouteHash(window.location.hash)) render({ focus: true }); });
  const isField = (a) => a && main.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  onChange((source) => {
    if (source === 'local') { pendingRemote = false; render(); return; }
    // Remote change: do not wipe a form the user is typing into; apply it later.
    if (isField(document.activeElement)) pendingRemote = true; else render();
  });
  // Deferred remote render runs after a click or submit has been handled (never in between,
  // so a click on a button is not swallowed), or when focus leaves the main area.
  const flushRemote = () => {
    setTimeout(() => { if (pendingRemote && !isField(document.activeElement)) { pendingRemote = false; render(); } }, 0);
  };
  document.addEventListener('click', flushRemote);
  main.addEventListener('submit', flushRemote);
  main.addEventListener('focusout', (e) => { if (e.relatedTarget && !main.contains(e.relatedTarget)) flushRemote(); });
  // Skip link: move focus to main without touching the hash.
  document.querySelectorAll('.skip').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); main.focus(); }));

  // Shell buttons
  document.querySelectorAll('[data-action="logout"]').forEach((b) => b.addEventListener('click', async () => {
    await logout();
    window.location.href = 'giris.html';
  }));
  document.querySelectorAll('[data-action="reset"]').forEach((b) => b.addEventListener('click', async () => {
    await resetDemoData();
    toast('Demo verileri sıfırlandı.');
  }));
  const toggle = document.getElementById('side-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('side-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }
  const scrim = document.getElementById('side-scrim');
  if (scrim) scrim.addEventListener('click', () => { document.body.classList.remove('side-open'); if (toggle) toggle.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('side-open')) {
      document.body.classList.remove('side-open');
      if (toggle) { toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
    }
  });

  render({ focus: false });
  return app;
}

/** Page title helper used by views. */
export function pageHead(title, ...actions) {
  return h('div', { class: 'view-head' }, h('h1', { class: 'view-title' }, title), actions.length ? h('div', { class: 'view-actions' }, actions) : null);
}

export function backLink(href, text) { return h('a', { class: 'back-link', href }, `← ${text}`); }
