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

// ----------------------------------------------------------------- icons ----
// Static 24x24 stroke paths (constants, never user input), set via innerHTML on an svg element.
const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  server: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M18 14.4c2 .7 3.5 2.6 3.5 5.6"/>',
  inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  megaphone: '<path d="M4 10v4h3l8 4V6L7 10z"/><path d="M18 9a4 4 0 010 6"/>',
  plug: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0zM12 17v4"/>',
  bell: '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M9 4H5v16h4M15 8l4 4-4 4M19 12H9"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>',
  rack: '<rect x="5" y="2.5" width="14" height="19" rx="1.5"/><path d="M5 8h14M5 13h14M8.5 5.2h.01M8.5 10.5h.01M8.5 16h.01"/>',
  wifi: '<path d="M2 9a15 15 0 0120 0M5 12.5a10.5 10.5 0 0114 0M8.5 16a5.5 5.5 0 017 0"/><circle cx="12" cy="19" r="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

export function icon(name, cls = 'ic') {
  const el = svg('svg', { viewBox: '0 0 24 24', class: cls, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' });
  el.innerHTML = ICON_PATHS[name] || '';
  return el;
}

export function initials(name) {
  const parts = String(name).replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[1][0] : '')).toLocaleUpperCase('tr-TR');
}

export function avatar(name, cls = '') {
  return h('span', { class: `avatar ${cls}`.trim(), 'aria-hidden': 'true' }, initials(name));
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
  return h('span', { class: `pstatus tone-${TONES[value] || 'muted'}` }, h('i', { 'aria-hidden': 'true' }), label || value);
}

export function sampleTag(text = 'Örnek veri') {
  return h('span', { class: 'sample-tag' }, text);
}

export function emptyState(text) { return h('p', { class: 'empty' }, text); }

export function card(title, ...body) {
  return h('section', { class: 'pcard' }, title ? h('div', { class: 'pcard-head' }, h('h3', { class: 'pcard-h' }, title)) : null, ...body);
}

/** Card with a muted subtitle and an optional header action. */
export function cardX(title, subtitle, action, ...body) {
  return h('section', { class: 'pcard' }, h('div', { class: 'pcard-head' }, h('div', null, h('h3', { class: 'pcard-h' }, title), subtitle ? h('p', { class: 'pcard-sub' }, subtitle) : null), action || null), ...body);
}

/** Tiny sparkline (no axes). values: numbers. */
export function sparkline(values, color = '#19e0ff') {
  const W = 96, Hh = 28;
  const lo = Math.min(...values), hi = Math.max(...values);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * W).toFixed(1)},${(Hh - 3 - ((v - lo) / (hi - lo || 1)) * (Hh - 6)).toFixed(1)}`).join(' ');
  return svg('svg', { viewBox: `0 0 ${W} ${Hh}`, class: 'spark', 'aria-hidden': 'true', focusable: 'false' }, svg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': '1.5', 'stroke-linejoin': 'round' }));
}

/** KPI tile. delta: { text, tone: 'up'|'down'|'flat' }. The returned element has .update({ value, spark }). */
export function kpiTile({ label, value, delta, spark, href, sub }) {
  const valueEl = h('div', { class: 'kpi-val' }, value);
  const sparkBox = h('div', { class: 'kpi-spark' }, spark ? sparkline(spark) : null);
  const body = [h('p', { class: 'kpi-label' }, label), h('div', { class: 'kpi-row' }, valueEl, sparkBox),
    delta ? h('p', { class: `kpi-delta ${delta.tone || 'flat'}` }, delta.text) : null, sub ? h('p', { class: 'kpi-sub' }, sub) : null];
  const el = href ? h('a', { class: 'kpi kpi-link', href }, body) : h('div', { class: 'kpi' }, body);
  el.update = ({ value: v, spark: sp }) => {
    if (v !== undefined) valueEl.textContent = v;
    if (sp) sparkBox.replaceChildren(sparkline(sp));
  };
  return el;
}

export function meter(pct, label) {
  const p = Math.max(0, Math.min(100, pct));
  const bar = h('span', { class: `meter${p >= 80 ? ' hot' : ''}`, role: 'img', 'aria-label': `${label}: yüzde ${Math.round(p)}` }, h('i'));
  bar.firstChild.style.width = `${p}%`;
  return h('div', { class: 'meter-row' }, h('span', { class: 'meter-label' }, label), bar, h('span', { class: 'meter-val' }, `%${Math.round(p)}`));
}

export function dl(pairs) {
  return h('dl', { class: 'kv' }, pairs.map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

/** Dense table. A header starting with ">" is right aligned (numeric column). */
export function table(headers, rows, caption) {
  const cols = headers.map((t) => (t.startsWith('>') ? { t: t.slice(1), right: true } : { t, right: false }));
  const cls = (i) => (cols[i].right ? 'num' : null);
  return h('div', { class: 'tbl' },
    h('div', { class: 'tscroll' },
      h('table', { class: 'ptable' },
        caption ? h('caption', { class: 'sr-only' }, caption) : null,
        h('thead', null, h('tr', null, cols.map((c, i) => h('th', { scope: 'col', class: cls(i) }, c.t)))),
        h('tbody', null, rows.map((cells) => h('tr', null, cells.map((c, i) => h('td', { 'data-label': cols[i].t, class: cls(i) }, c))))))),
    h('div', { class: 'table-foot' }, `${rows.length} kayıt`));
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
const COLORS = ['#19e0ff', '#8fa0b0', '#3cffb0', '#ffb340'];

// Charts are drawn at the real pixel width of their box (ResizeObserver), so text stays
// at a constant 11px instead of scaling with the card.
function responsive(draw, height) {
  const box = h('div', { class: 'chart-box' });
  let w = 0;
  const paint = (width) => {
    const W = Math.max(220, Math.round(width));
    if (W === w) return;
    w = W;
    box.replaceChildren(draw(W, height));
  };
  let last = 560;
  paint(last);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver((entries) => { const cw = entries[0].contentRect.width; if (cw > 0) { last = cw; paint(cw); } }).observe(box);
  }
  box.repaint = () => { w = 0; paint(last); };
  return box;
}

// Rounds a maximum up to 1, 2, 2.5, 5 or 10 times a power of ten so tick labels stay readable.
function niceMax(v) {
  const pow = 10 ** Math.floor(Math.log10(v));
  const f = v / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pow;
}

function frame(W, H, L, R, T, B, lo, hi, unit, decimals) {
  const root = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'chart-svg', focusable: 'false' });
  const y = (v) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  for (let g = 0; g <= 4; g++) {
    const v = lo + ((hi - lo) * g) / 4;
    root.appendChild(svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }));
    root.appendChild(svg('text', { x: L - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, num(v, decimals)));
  }
  if (unit) root.appendChild(svg('text', { x: 0, y: 9, class: 'axis unit' }, unit));
  return { root, y };
}

/** Line chart with optional legend. series: [{ name, values }]. labels: [first, last] x labels. */
export function lineChart(initial, { unit = '', labels = ['', ''], min = 0, max, desc = '', height = 190 } = {}) {
  let series = initial;
  const box = responsive((W, H) => {
    const all = series.flatMap((s) => s.values);
    const hi = max !== undefined ? max : niceMax(Math.max(1, ...all) * 1.05);
    const dec = hi % 4 === 0 || hi >= 10 ? 0 : 1;
    const L = 44, R = 12, T = 22, B = 26;
    const { root, y } = frame(W, H, L, R, T, B, min, hi, unit, dec);
    const x = (i, n) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
    series.forEach((sr, si) => {
      const pts = sr.values.map((v, i) => `${x(i, sr.values.length).toFixed(1)},${y(v).toFixed(1)}`);
      if (!pts.length) return;
      const color = COLORS[si % COLORS.length];
      if (si === 0) root.appendChild(svg('polygon', { points: `${L},${y(min)} ${pts.join(' ')} ${x(sr.values.length - 1, sr.values.length)},${y(min)}`, fill: color, opacity: '0.1' }));
      root.appendChild(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: color, 'stroke-width': '1.5', 'stroke-linejoin': 'round' }));
    });
    root.appendChild(svg('text', { x: L, y: H - 6, class: 'axis' }, labels[0]));
    root.appendChild(svg('text', { x: W - R, y: H - 6, 'text-anchor': 'end', class: 'axis' }, labels[1]));
    return root;
  }, height);
  const legend = series.length > 1 ? h('div', { class: 'legend' }, series.map((sr, i) => h('span', null, h('i', { style: `background:${COLORS[i % COLORS.length]}` }), sr.name))) : null;
  const wrap = h('div', { class: 'chart', role: 'img', 'aria-label': desc || series.map((sr) => sr.name).join(', ') }, legend, box);
  /** Replaces the data and redraws in place (no flicker). */
  wrap.update = (next) => { series = next; box.repaint(); };
  return wrap;
}

/** Bar chart. values: numbers, labels: same-length x labels (empty string hides a label). */
export function barChart(values, labels, { unit = '', desc = '', color = COLORS[0], height = 190 } = {}) {
  const hi = niceMax(Math.max(1, ...values) * 1.05);
  const box = responsive((W, H) => {
    const L = 44, R = 12, T = 22, B = 26;
    const { root, y } = frame(W, H, L, R, T, B, 0, hi, unit, 0);
    const bw = (W - L - R) / values.length;
    values.forEach((v, i) => {
      root.appendChild(svg('rect', { x: L + i * bw + bw * 0.2, y: y(v), width: bw * 0.6, height: Math.max(0, y(0) - y(v)), fill: color, opacity: '0.85', rx: '2' }));
      if (labels[i]) root.appendChild(svg('text', { x: L + i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, labels[i]));
    });
    return root;
  }, height);
  return h('div', { class: 'chart', role: 'img', 'aria-label': desc || 'Çubuk grafik' }, box);
}

export function chartCard(title, chart, note, subtitle) {
  return cardX(title, subtitle, null, chart, h('div', { class: 'chart-note' }, sampleTag(), note ? h('span', null, note) : null));
}

// ----------------------------------------------------------------- shell ----
function popover(btn, panel) {
  const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = panel.hidden;
    document.dispatchEvent(new CustomEvent('popover-close'));
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('popover-close', close);
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { close(); btn.focus(); } });
  return close;
}

/**
 * Builds the app shell (sidebar, top bar, main) into #app and returns the elements.
 * shell: { label, groups: [{ cap, items: [{ route, label, icon }] }], user: { name, email }, notify }
 */
function buildShell(shell) {
  const root = document.getElementById('app');
  const side = h('aside', { class: 'side', id: 'side', 'aria-label': 'Panel menüsü' },
    h('a', { class: 'brand', href: 'index.html', 'aria-label': 'CORENETWORK ana sayfa' }, h('img', { src: 'assets/logo.svg', alt: 'CORENETWORK', width: 150, height: 19 })),
    h('nav', { class: 'side-nav', 'aria-label': 'Panel bölümleri' }, shell.groups.map((g) => h('div', { class: 'nav-group' },
      h('p', { class: 'nav-cap' }, g.cap),
      h('ul', null, g.items.map((it) => h('li', null, h('a', { href: `#/${it.route}`, 'data-route': it.route }, icon(it.icon), h('span', null, it.label)))))))),
    h('div', { class: 'side-foot' }, avatar(shell.user.name), h('div', { class: 'acct' }, h('strong', null, shell.user.name), h('small', null, shell.user.email))));

  const toggle = h('button', { class: 'icon-btn menu-btn', id: 'side-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'side', 'aria-label': 'Menüyü aç veya kapat' }, icon('menu'));
  const crumbs = h('nav', { class: 'crumbs', 'aria-label': 'Konum' });
  const bell = h('button', { class: 'icon-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': 'Bildirimler' }, icon('bell'), h('i', { class: 'bell-dot', hidden: true }));
  const bellPanel = h('div', { class: 'popover', hidden: true, role: 'region', 'aria-label': 'Bildirimler' });
  const userBtn = h('button', { class: 'user-btn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': 'Hesap menüsü' }, avatar(shell.user.name), h('span', { class: 'who' }, shell.user.name), icon('chevron', 'ic ic-sm'));
  const userPanel = h('div', { class: 'popover menu', hidden: true },
    h('p', { class: 'menu-head' }, h('strong', null, shell.user.name), h('small', null, shell.user.email)),
    h('button', { class: 'menu-item', type: 'button', 'data-action': 'reset' }, 'Demo verilerini sıfırla'),
    h('a', { class: 'menu-item', href: 'index.html' }, 'Siteye dön'),
    h('button', { class: 'menu-item', type: 'button', 'data-action': 'logout' }, icon('logout', 'ic ic-sm'), 'Çıkış'));
  const topbar = h('header', { class: 'topbar' }, toggle, crumbs,
    h('div', { class: 'topbar-right' }, h('span', { class: 'env-chip' }, 'Demo'),
      h('div', { class: 'pop-wrap' }, bell, bellPanel), h('div', { class: 'pop-wrap' }, userBtn, userPanel)));
  const main = h('main', { id: 'main', tabindex: '-1' });
  root.replaceChildren(side, h('div', { class: 'side-scrim', id: 'side-scrim' }), h('div', { class: 'app-main' }, topbar, main));
  popover(bell, bellPanel);
  popover(userBtn, userPanel);
  return { main, crumbs, bell, bellPanel, toggle };
}

/**
 * Boots a panel: role guard, shell, mobile sidebar, hash router.
 * routes: { name: async (args, ctx) => cleanupFn | void }  (view renders into ctx.main)
 * Returns the app handle or null when the guard redirected.
 */
export function createApp({ role, routes, defaultRoute, shell }) {
  if (!requireRole(role)) return null;
  const { main, crumbs, bell, bellPanel, toggle } = buildShell(shell);
  const labels = {};
  shell.groups.forEach((g) => g.items.forEach((it) => { labels[it.route] = it.label; }));
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

  const paintCrumbs = (name, args) => {
    const parts = [h('a', { href: `#/${defaultRoute}` }, 'Panel'), h('span', { class: 'sep', 'aria-hidden': 'true' }, '/')];
    if (args.length) parts.push(h('a', { href: `#/${name}` }, labels[name]), h('span', { class: 'sep', 'aria-hidden': 'true' }, '/'), h('span', { 'aria-current': 'page' }, args[0] === 'yeni' ? 'Yeni' : 'Ayrıntı'));
    else parts.push(h('span', { 'aria-current': 'page' }, labels[name]));
    crumbs.replaceChildren(...parts);
  };

  const paintNotices = async () => {
    let items = [];
    try { items = shell.notify ? await shell.notify() : []; } catch (e) { items = []; }
    bell.querySelector('.bell-dot').hidden = !items.length;
    bellPanel.replaceChildren(h('p', { class: 'menu-head' }, h('strong', null, 'Bildirimler')),
      items.length ? h('ul', null, items.map((it) => h('li', null, h('a', { class: 'menu-item', href: it.href }, it.text)))) : h('p', { class: 'menu-empty' }, 'Yeni bildirim yok.'));
  };

  async function render({ focus = false } = {}) {
    const { name, args } = parse();
    const my = ++token;
    if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } cleanup = null; }
    navLinks.forEach((a) => {
      if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    paintCrumbs(name, args);
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
    paintNotices();
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
  toggle.addEventListener('click', () => {
    const open = document.body.classList.toggle('side-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  const scrim = document.getElementById('side-scrim');
  scrim.addEventListener('click', () => { document.body.classList.remove('side-open'); toggle.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('side-open')) {
      document.body.classList.remove('side-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });

  render({ focus: false });
  return app;
}

/**
 * Page header: title, optional one-line description (a plain string argument) and actions
 * (elements) on the right.
 */
export function pageHead(title, ...rest) {
  const desc = rest.find((r) => typeof r === 'string');
  const actions = rest.filter((r) => r && typeof r !== 'string');
  return h('div', { class: 'view-head' }, h('div', null, h('h1', { class: 'view-title' }, title), desc ? h('p', { class: 'view-desc' }, desc) : null),
    actions.length ? h('div', { class: 'view-actions' }, actions) : null);
}

/** Ticket message list with avatar initials. names: { customer, admin } display names. */
export function threadView(messages, names) {
  return h('div', { class: 'thread' }, messages.map((m) => {
    const who = names[m.from] || m.from;
    return h('div', { class: 'msg-row' }, avatar(who, `lg ${m.from === 'admin' ? 'admin' : ''}`),
      h('div', { class: 'msg-body' }, h('div', { class: 'msg-meta' }, h('strong', null, who), h('time', { datetime: m.at }, fmtDateTime(m.at))),
        h('p', { class: `msg from-${m.from}` }, m.text)));
  }));
}

export function backLink(href, text) { return h('a', { class: 'back-link', href }, `← ${text}`); }
