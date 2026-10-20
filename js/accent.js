// Lightweight 2D canvas accent: circuit-style routes with data packets flowing along them.
// Used in page heroes. Paused when off screen or when the tab is hidden.

const PALETTES = {
  cyan: ['25,200,230', '138,92,255'],
  amber: ['255,179,64', '25,200,230'],
  violet: ['138,92,255', '60,255,176'],
};

function mulberry32(a) {
  return function rnd() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function initAccent(canvas, { animate = true } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pal = PALETTES[canvas.dataset.accent] || PALETTES.cyan;
  const GRID = 28;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let paths = [];
  let packets = [];
  let raf = 0;
  let visible = true;
  let last = 0;

  function build() {
    const rnd = mulberry32(Math.round(w * 7 + h * 13));
    paths = [];
    packets = [];
    const count = Math.max(8, Math.round(w / 95));
    for (let i = 0; i < count; i++) {
      let x = Math.floor((rnd() * w) / GRID) * GRID;
      let y = Math.floor((rnd() * h) / GRID) * GRID;
      const pts = [[x, y]];
      let horiz = rnd() < 0.5;
      const segs = 3 + Math.floor(rnd() * 4);
      for (let s = 0; s < segs; s++) {
        const len = (2 + Math.floor(rnd() * 7)) * GRID;
        const dir = rnd() < 0.5 ? -1 : 1;
        if (horiz) x += len * dir; else y += len * dir;
        x = Math.max(0, Math.min(w, x));
        y = Math.max(0, Math.min(h, y));
        pts.push([x, y]);
        // 45 degree chamfer
        if (rnd() < 0.5) {
          const c = GRID;
          if (horiz) { x += c * dir; y += c * (rnd() < 0.5 ? 1 : -1); } else { y += c * dir; x += c * (rnd() < 0.5 ? 1 : -1); }
          x = Math.max(0, Math.min(w, x));
          y = Math.max(0, Math.min(h, y));
          pts.push([x, y]);
        }
        horiz = !horiz;
      }
      const lens = [0];
      let total = 0;
      for (let k = 1; k < pts.length; k++) {
        total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
        lens.push(total);
      }
      if (total < GRID * 3) continue;
      const colorIdx = rnd() < 0.7 ? 0 : 1;
      paths.push({ pts, lens, total, colorIdx });
      const np = 1 + (rnd() < 0.5 ? 1 : 0);
      for (let k = 0; k < np; k++) {
        packets.push({ path: paths.length - 1, d: rnd() * total, v: 50 + rnd() * 90 });
      }
    }
  }

  function pointAt(path, d) {
    const { pts, lens } = path;
    let i = 1;
    while (i < lens.length - 1 && lens[i] < d) i++;
    const t = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    paths.forEach((p) => {
      ctx.strokeStyle = 'rgba(' + pal[p.colorIdx] + ',0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      p.pts.forEach((pt, i) => { if (i) ctx.lineTo(pt[0], pt[1]); else ctx.moveTo(pt[0], pt[1]); });
      ctx.stroke();
      ctx.fillStyle = 'rgba(' + pal[p.colorIdx] + ',0.45)';
      const e = p.pts[p.pts.length - 1];
      ctx.fillRect(e[0] - 2.5, e[1] - 2.5, 5, 5);
    });
    ctx.globalCompositeOperation = 'lighter';
    packets.forEach((k) => {
      const p = paths[k.path];
      const col = pal[p.colorIdx];
      for (let s = 0; s < 8; s++) {
        const d = k.d - s * 5;
        if (d < 0 || d > p.total) continue;
        const pt = pointAt(p, d);
        ctx.fillStyle = 'rgba(' + col + ',' + (0.9 * (1 - s / 8)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2.2 - s * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    build();
    draw();
  }

  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    packets.forEach((k) => {
      k.d += k.v * dt;
      if (k.d > paths[k.path].total + 40) k.d = -20;
    });
    draw();
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (!animate || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  resize();
  // static frame: packets spread along the paths
  window.addEventListener('resize', resize);
  if (animate) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) start();
      }).observe(canvas);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    start();
  }
}
