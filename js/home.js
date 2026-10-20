// Home page: scroll-driven descent (cabinet -> server -> CPU -> silicon -> core).
// Scroll progress is scrubbed 1:1 and mapped piecewise to the DOM section marks.
import { clamp, SCENE_MARKS, layerName, scaleLabel } from './path.js';

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const coarse = window.matchMedia('(pointer: coarse)').matches;
const lowEnd = coarse || window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 2;

const QUALITY = lowEnd
  ? { dprCap: 1.0, bloom: false, dust: 120, low: true }
  : { dprCap: 1.5, bloom: true, dust: 380 };

const PHASE_IDS = ['cabinet', 'server', 'cpu', 'silicon', 'deep'];
// Representative scene progress used for static frames (reduced motion / fallback layout)
const STATIC_FRAMES = { cabinet: 0.04, server: 0.27, cpu: 0.52, silicon: 0.72, deep: 0.86 };

function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (_) {
    return false;
  }
}

const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
const webgl = hasWebGL2();
let staticMode = reducedMotion || !webgl || !hasGsap;

function enterStatic() {
  staticMode = true;
  html.classList.add('static', 'ready');
  html.classList.remove('no-js');
}

if (!webgl) html.classList.add('no-webgl');
if (staticMode) enterStatic();

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------
const hud = {
  layer: $('#hud-layer'),
  scale: $('#hud-scale'),
  pct: $('#hud-pct'),
  bar: $('#hud-bar'),
  ruler: $('#hud-ruler'),
  last: { layer: '', scale: '', pct: '' },
};

function updateHud(p) {
  const layer = layerName(p);
  const scale = scaleLabel(p);
  const pct = String(Math.round(p * 100)).padStart(3, '0') + '%';
  if (hud.layer && layer !== hud.last.layer) { hud.layer.textContent = layer; hud.last.layer = layer; }
  if (hud.scale && scale !== hud.last.scale) { hud.scale.textContent = scale; hud.last.scale = scale; }
  if (hud.pct && pct !== hud.last.pct) { hud.pct.textContent = pct; hud.last.pct = pct; }
  if (hud.bar) hud.bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  if (hud.ruler) hud.ruler.style.backgroundPositionX = (-p * 3000).toFixed(1) + 'px';
}

// ---------------------------------------------------------------------------
// Scroll -> scene progress mapping
// ---------------------------------------------------------------------------
let scene = null;
let bounds = [0, 1, 2, 3, 4, 5];

function measure() {
  const top = (id) => {
    const el = document.getElementById(id);
    return el ? el.getBoundingClientRect().top + window.scrollY : 0;
  };
  const ys = PHASE_IDS.map(top);
  const deep = document.getElementById('deep');
  const end = deep ? top('deep') + deep.offsetHeight - window.innerHeight : ys[4] + 1;
  bounds = ys.concat([end]);
  for (let i = 1; i < bounds.length; i++) bounds[i] = Math.max(bounds[i], bounds[i - 1] + 1);
}

function remap(y) {
  for (let i = 0; i < 5; i++) {
    if (y <= bounds[i + 1] || i === 4) {
      const t = clamp((y - bounds[i]) / (bounds[i + 1] - bounds[i]), 0, 1);
      return SCENE_MARKS[i] + t * (SCENE_MARKS[i + 1] - SCENE_MARKS[i]);
    }
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Static mode (reduced motion, no WebGL, or no GSAP)
// ---------------------------------------------------------------------------
function staticProgress() {
  const mid = window.innerHeight * 0.5;
  const after = document.getElementById('after');
  if (after && after.getBoundingClientRect().top < mid) return 1;
  for (let i = PHASE_IDS.length - 1; i >= 0; i--) {
    const el = document.getElementById(PHASE_IDS[i]);
    if (el && el.getBoundingClientRect().top < mid) return STATIC_FRAMES[PHASE_IDS[i]];
  }
  return STATIC_FRAMES.cabinet;
}

function initStatic() {
  html.classList.add('ready');
  updateHud(STATIC_FRAMES.cabinet);
  if (!webgl) return;
  import('./scene.js').then((m) => {
    scene = m.createScene({ canvas: $('#gl'), quality: QUALITY, onLost: () => { html.classList.add('no-webgl'); scene = null; } });
    html.classList.add('gl-ready');
    const draw = () => {
      const p = staticProgress();
      updateHud(p);
      if (scene) scene.frame(0, p, { x: 0, y: 0 }, false);
    };
    draw();
    let queued = false;
    const req = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; draw(); }); } };
    window.addEventListener('scroll', req, { passive: true });
    window.addEventListener('resize', () => { if (scene) scene.resize(); req(); });
  }).catch(() => {
    html.classList.add('no-webgl');
  });
}

// ---------------------------------------------------------------------------
// Animated mode
// ---------------------------------------------------------------------------
function initAnimated() {
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  let lenis = null;
  if (typeof window.Lenis !== 'undefined') {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
  }
  gsap.ticker.lagSmoothing(0);
  html.classList.add('ready');

  const mouse = { x: 0, y: 0 };
  if (finePointer) {
    window.addEventListener('pointermove', (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  // Hero intro
  gsap.timeline({ delay: 0.3 })
    .fromTo('.hero-title .hl', { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power4.out', stagger: 0.16 })
    .fromTo('.phase-cabinet [data-intro]', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12 }, '-=0.8');
  gsap.to('.hero-copy', {
    autoAlpha: 0, y: -80, ease: 'none',
    scrollTrigger: { trigger: '#cabinet', start: '8% top', end: '40% top', scrub: true },
  });
  gsap.to('.scroll-cue', {
    autoAlpha: 0, ease: 'none',
    scrollTrigger: { trigger: '#cabinet', start: 'top top', end: '8% top', scrub: true },
  });

  // Cabinet caption appears after the hero copy has faded
  const lateCap = $('#cabinet .cap-late');
  if (lateCap) {
    gsap.timeline({ scrollTrigger: { trigger: '#cabinet', start: '48% top', end: 'bottom 100%', scrub: true } })
      .fromTo(lateCap, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'none' })
      .to(lateCap, { duration: 0.55 })
      .to(lateCap, { autoAlpha: 0, y: -50, duration: 0.2, ease: 'none' });
  }

  // Phase captions (scrubbed)
  ['#server', '#cpu', '#silicon'].forEach((id) => {
    const cap = $(id + ' .cap-block');
    if (!cap) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: id, start: 'top 75%', end: 'bottom 25%', scrub: true } });
    tl.fromTo(cap, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 0.25, ease: 'none' })
      .to(cap, { duration: 0.5 })
      .to(cap, { autoAlpha: 0, y: -50, duration: 0.25, ease: 'none' });
  });

  // Deepest level: message, then pull back to the call to action
  const deepTl = gsap.timeline({ scrollTrigger: { trigger: '#deep', start: 'top top', end: 'bottom bottom', scrub: true } });
  deepTl
    .fromTo('.deep-msg', { autoAlpha: 0, y: 30, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.14, ease: 'none' }, 0.08)
    .to('.deep-msg', { autoAlpha: 0, y: -30, duration: 0.12, ease: 'none' }, 0.52)
    .fromTo('.deep-cta', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.14, ease: 'none' }, 0.7)
    .set({}, {}, 1);

  // HUD fades out once the normal sections begin
  ScrollTrigger.create({
    trigger: '#after',
    start: 'top 70%',
    onEnter: () => html.classList.add('hud-off'),
    onLeaveBack: () => html.classList.remove('hud-off'),
  });

  // Global scroll fraction, smoothed by the ScrollTrigger scrub
  const raw = { v: 0 };
  gsap.to(raw, {
    v: 1, ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.5 },
  });
  ScrollTrigger.addEventListener('refresh', measure);
  measure();

  // In-page anchors with smooth scrolling
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const target = id === 'top' ? document.body : document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(id === 'top' ? 0 : target, { duration: 2 });
      else target.scrollIntoView({ behavior: 'auto' });
    });
  });

  // Single render loop
  gsap.ticker.add((time) => {
    if (lenis) lenis.raf(time * 1000);
    if (document.hidden) return;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = remap(raw.v * max);
    updateHud(p);
    if (scene) scene.frame(time, p, mouse, true);
  });

  window.addEventListener('resize', () => { if (scene) scene.resize(); });

  import('./scene.js').then((m) => {
    scene = m.createScene({
      canvas: $('#gl'),
      quality: QUALITY,
      onLost: () => { html.classList.add('no-webgl'); scene = null; },
    });
    html.classList.add('gl-ready');
  }).catch(() => {
    html.classList.add('no-webgl');
    fallbackToStatic(gsap, ScrollTrigger, lenis);
  });
}

function fallbackToStatic(gsap, ScrollTrigger, lenis) {
  ScrollTrigger.getAll().forEach((st) => st.kill());
  if (lenis) lenis.destroy();
  gsap.ticker.lagSmoothing(500, 33);
  enterStatic();
  $$('.hl,[data-intro],.hero-copy,.scroll-cue,.cap-block,.deep-msg,.deep-cta').forEach((el) => {
    gsap.set(el, { clearProps: 'all' });
  });
}

try {
  if (staticMode) initStatic();
  else initAnimated();
  window.__booted = true;
} catch (err) {
  // A synchronous init failure must never leave content hidden.
  enterStatic();
  window.__booted = true;
}
