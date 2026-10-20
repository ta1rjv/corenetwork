// Animated SVG network map: upstream providers, core router, data center,
// fiber ring and radiolink towers, with packets flowing along the links.
// Layered left-to-right layout on a fixed grid; on narrow containers the same
// geometry is transposed to a top-to-bottom layout (no non-uniform scaling).
// The map is decorative; the page also contains a text description.

const NS = 'http://www.w3.org/2000/svg';

function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k]));
  if (parent) parent.appendChild(n);
  return n;
}

// Rounded orthogonal polyline path through points [[x, y], ...]
function roundedPath(pts, r) {
  let d = 'M' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const l1 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
    const l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const a = [p1[0] + ((p0[0] - p1[0]) / l1) * rr, p1[1] + ((p0[1] - p1[1]) / l1) * rr];
    const b = [p1[0] + ((p2[0] - p1[0]) / l2) * rr, p1[1] + ((p2[1] - p1[1]) / l2) * rr];
    d += ' L' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' Q' + p1[0] + ' ' + p1[1] + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
  }
  const last = pts[pts.length - 1];
  return d + ' L' + last[0] + ' ' + last[1];
}

// Glyphs drawn in a 40x40 box centered on the origin
const GLYPHS = {
  up: '<circle r="10"/><path d="M-10 0H10M0 -10C5 -5 5 5 0 10M0 -10C-5 -5 -5 5 0 10"/>',
  router: '<rect x="-12" y="-2" width="24" height="10" rx="2"/><path d="M-7 -2V-11M7 -2V-11M-6 3h.01M0 3h.01M6 3h.01"/>',
  dc: '<rect x="-11" y="-13" width="22" height="7" rx="1.5"/><rect x="-11" y="-3.5" width="22" height="7" rx="1.5"/><rect x="-11" y="6" width="22" height="7" rx="1.5"/><path d="M-7 -9.5h.01M-7 0h.01M-7 9.5h.01"/>',
  tower: '<path d="M0 -8L-8 13M0 -8L8 13M-5 3H5M-7 10H7"/><circle cy="-11" r="2"/><path d="M-6 -14a8 8 0 000 6M6 -14a8 8 0 010 6"/>',
};

function splitLabel(text) {
  if (text.length <= 13 || text.indexOf(' ') < 0) return [text];
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i;
  }
  return [text.slice(0, best), text.slice(best + 1)];
}

export function initNetwork(container, { animate = true, mini = false } = {}) {
  let pkts = [];
  let raf = 0;
  let last = 0;
  let visible = true;
  let vertical = null;

  // Switch to the vertical layout only on phone-width containers (measured on the container).
  const threshold = mini ? 460 : 720;

  function build() {
    const width = container.clientWidth;
    const V = width > 0 && width < threshold;
    vertical = V;
    container.textContent = '';
    pkts = [];

    // label font size in viewBox units; chosen so rendered labels are about 11-12 CSS px
    const fs = V ? (mini ? 18 : 16) : (mini ? 22 : 15);
    const S = Math.round(fs * (mini && !V ? 2.6 : 2.9)); // node box size
    const sw = mini ? 2 : 1.5;          // stroke width
    const R = Math.round(S * 0.3);      // corner radius for links
    const map = (p) => (V ? [p[1], p[0]] : [p[0], p[1]]);

    const svg = el('svg', {
      viewBox: V ? '0 0 440 1000' : '0 0 1000 440',
      preserveAspectRatio: 'xMidYMid meet',
      class: 'netmap-svg' + (mini ? ' is-mini' : '') + (V ? ' is-vertical' : ''),
      'aria-hidden': 'true',
      focusable: 'false',
    }, container);
    const gLinks = el('g', {}, svg);
    const gNodes = el('g', {}, svg);
    const gLabels = el('g', {}, svg);
    const gPkts = el('g', {}, svg);

    const flows = [];
    function link(points, cls, opts = {}) {
      const d = roundedPath(points.map(map), R);
      const p = el('path', { d, class: 'nm-link ' + cls, 'stroke-width': sw }, gLinks);
      flows.push({ path: p, speed: opts.speed || 70, n: opts.n === undefined ? 2 : opts.n, cls: opts.pcls || '', dir: opts.dir || 1 });
    }

    // Logical coordinates (horizontal layout, 1000 x 440)
    const A = [110, 120];
    const B = [110, 320];
    const ROUTER = [300, 220];
    const DC = [490, 220];
    const RC = [700, 220];
    const RR = 100;
    const half = S / 2;
    const ringAngles = [180, 240, 300, 0, 60, 120];
    const ringPts = ringAngles.map((a) => [RC[0] + RR * Math.cos((a * Math.PI) / 180), RC[1] + RR * Math.sin((a * Math.PI) / 180)]);
    const T1 = [900, ringPts[2][1]];
    const T2 = [900, ringPts[4][1]];

    // Links
    link([[A[0] + half, A[1]], [215, A[1]], [215, ROUTER[1]], [ROUTER[0] - half, ROUTER[1]]], 'nm-primary', { speed: 70 });
    link([[B[0] + half, B[1]], [215, B[1]], [215, ROUTER[1]], [ROUTER[0] - half, ROUTER[1]]], 'nm-backup', { speed: 60, n: 1 });
    link([[ROUTER[0] + half, ROUTER[1]], [DC[0] - half, DC[1]]], 'nm-primary', { speed: 80, n: 3 });
    link([[DC[0] + half, DC[1]], [RC[0] - RR, RC[1]]], 'nm-primary', { speed: 70 });
    link([[ringPts[2][0] + 8, ringPts[2][1]], [T1[0] - half, T1[1]]], 'nm-primary', { speed: 60, n: 1 });
    link([[ringPts[4][0] + 8, ringPts[4][1]], [T2[0] - half, T2[1]]], 'nm-primary', { speed: 60, n: 1 });

    // Ring (true circle; transposition keeps it a circle)
    const rc = map(RC);
    const ringD = 'M' + (rc[0] - RR) + ' ' + rc[1] + ' a' + RR + ' ' + RR + ' 0 1 1 ' + 2 * RR + ' 0 a' + RR + ' ' + RR + ' 0 1 1 ' + -2 * RR + ' 0';
    const ring = el('path', { d: ringD, class: 'nm-link nm-ring', 'stroke-width': sw }, gLinks);
    flows.push({ path: ring, speed: 55, n: 3, cls: '', dir: 1 });

    // Nodes
    const labels = [];
    function box(pos, kind, text) {
      const c = map(pos);
      const g = el('g', { transform: 'translate(' + c[0] + ' ' + c[1] + ')', class: 'nm-node' }, gNodes);
      el('rect', { x: -half, y: -half, width: S, height: S, rx: Math.round(S * 0.2), class: 'nm-box', 'stroke-width': sw }, g);
      const k = S / 40;
      const gl = el('g', { transform: 'scale(' + k + ')', class: 'nm-glyph', 'stroke-width': (sw / k).toFixed(2) }, g);
      gl.innerHTML = GLYPHS[kind];
      labels.push({ x: c[0], y: c[1] + half + fs * 1.1, text });
    }
    box(A, 'up', 'Üst Sağlayıcı A');
    box(B, 'up', 'Üst Sağlayıcı B');
    box(ROUTER, 'router', 'Çekirdek Yönlendirici');
    box(DC, 'dc', 'Veri Merkezi');
    box(T1, 'tower', 'Radyolink Kulesi');
    box(T2, 'tower', 'Radyolink Kulesi');

    // Ring access nodes
    ringPts.forEach((p) => {
      const c = map(p);
      el('circle', { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: Math.round(fs * 0.55), class: 'nm-dot' }, gNodes);
    });
    labels.push({ x: rc[0], y: rc[1] + RR + fs * 1.9, text: 'Fiber Halka' });

    // Radio waves next to the towers
    [T1, T2].forEach((t) => {
      const c = map(t);
      [0, 1].forEach((i) => el('circle', { cx: c[0], cy: c[1], r: half + 8 + i * 10, class: 'nm-wave nm-wave-' + i }, gNodes));
    });

    // Labels: centered below nodes, mono text on a small dark plate
    const items = labels.map((l) => {
      const g = el('g', { class: 'nm-label' }, gLabels);
      const rect = el('rect', { rx: 4, class: 'nm-lbg' }, g);
      const t = el('text', { x: l.x, 'text-anchor': 'middle', 'font-size': fs, class: 'nm-text' }, g);
      const lines = splitLabel(l.text);
      lines.forEach((ln, i) => {
        const ts = el('tspan', { x: l.x, y: l.y + i * fs * 1.25 }, t);
        ts.textContent = ln;
      });
      return { g, rect, t, l, lines, dy: 0 };
    });

    function fit() {
      const boxes = [];
      items.forEach((it) => {
        let w = 0;
        let h = 0;
        let x = 0;
        let y = 0;
        try {
          const b = it.t.getBBox();
          w = b.width; h = b.height; x = b.x; y = b.y;
        } catch (_) { /* not rendered yet */ }
        if (!w) {
          const longest = Math.max.apply(null, it.lines.map((s) => s.length));
          w = longest * fs * 0.62;
          h = it.lines.length * fs * 1.25;
          x = it.l.x - w / 2;
          y = it.l.y - fs;
        }
        const padX = 6;
        const padY = 3;
        let bb = { x: x - padX, y: y - padY + it.dy, w: w + padX * 2, h: h + padY * 2 };
        // nudge down if it overlaps an earlier label
        boxes.forEach((o) => {
          const hit = bb.x < o.x + o.w && bb.x + bb.w > o.x && bb.y < o.y + o.h && bb.y + bb.h > o.y;
          if (hit) {
            const shift = o.y + o.h + 4 - bb.y;
            it.dy += shift;
            bb.y += shift;
          }
        });
        it.g.setAttribute('transform', 'translate(0 ' + it.dy.toFixed(1) + ')');
        it.rect.setAttribute('x', (bb.x).toFixed(1));
        it.rect.setAttribute('y', (bb.y - it.dy).toFixed(1));
        it.rect.setAttribute('width', bb.w.toFixed(1));
        it.rect.setAttribute('height', bb.h.toFixed(1));
        boxes.push(bb);
      });
    }
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit).catch(() => {});

    // Packets
    flows.forEach((f) => {
      const len = f.path.getTotalLength();
      for (let i = 0; i < f.n; i++) {
        const c = el('circle', { r: mini ? 4 : 3.2, class: 'pkt ' + f.cls }, gPkts);
        pkts.push({ c, path: f.path, len, t: i / f.n, speed: f.speed, dir: f.dir });
      }
    });
    pkts.forEach(place);
  }

  function place(p) {
    const t = ((p.t % 1) + 1) % 1;
    const at = p.dir > 0 ? t * p.len : (1 - t) * p.len;
    const pt = p.path.getPointAtLength(at);
    p.c.setAttribute('cx', pt.x.toFixed(1));
    p.c.setAttribute('cy', pt.y.toFixed(1));
  }

  build();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      const w = container.clientWidth;
      const v = w > 0 && w < threshold;
      if (v !== vertical) build();
    }).observe(container);
  }
  if (!animate) return;

  function tick(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    pkts.forEach((p) => {
      p.t += (p.speed * dt) / p.len;
      place(p);
    });
    raf = requestAnimationFrame(tick);
  }
  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) start();
    }).observe(container);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  start();
}
