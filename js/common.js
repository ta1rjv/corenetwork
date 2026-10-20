// Shared behaviour for every page: config hydration, navigation, page transitions,
// reveal animations and lazy loading of page specific modules.
import { CONFIG } from './config.js';

const html = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ---------------------------------------------------------------------------
// Config hydration (data-cfg, data-cfg-href, data-socials, data-year)
// ---------------------------------------------------------------------------
function externalAttrs(a, href) {
  if (/^https?:/i.test(href)) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
}

function hydrate() {
  $$('[data-cfg]').forEach((el) => {
    const v = CONFIG[el.dataset.cfg];
    if (typeof v === 'string' && v) el.textContent = v;
  });
  $$('[data-cfg-href]').forEach((el) => {
    const v = CONFIG[el.dataset.cfgHref];
    if (typeof v === 'string' && v) {
      el.setAttribute('href', v);
      externalAttrs(el, v);
    }
  });
  $$('[data-socials]').forEach((ul) => {
    if (!Array.isArray(CONFIG.social) || !CONFIG.social.length) return;
    ul.textContent = '';
    CONFIG.social.forEach((s) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = s.href;
      a.textContent = s.label;
      externalAttrs(a, s.href);
      li.appendChild(a);
      ul.appendChild(li);
    });
  });
  $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  // Links that point to "#" (unset placeholders) must not jump to the top of the page.
  $$('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));
}

// ---------------------------------------------------------------------------
// Header, mobile navigation
// ---------------------------------------------------------------------------
function initNav() {
  const toggle = $('.nav-toggle');
  const nav = $('#site-nav');
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  if (!toggle || !nav) return;
  const setOpen = (open) => {
    html.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
  };
  toggle.addEventListener('click', () => setOpen(!html.classList.contains('nav-open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && html.classList.contains('nav-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  nav.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) setOpen(false);
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 1080) setOpen(false); });
}

// ---------------------------------------------------------------------------
// In-page anchors (needed when a <base> element is present, e.g. on 404.html)
// ---------------------------------------------------------------------------
function initAnchors() {
  if (!$('base')) return;
  $$('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (!id || id === '') return;
    a.addEventListener('click', (e) => {
      const t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  });
  const top = $('.to-top');
  if (top) top.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0 }); });
}

// ---------------------------------------------------------------------------
// Page transitions (fade out before navigating to another page of the site)
// ---------------------------------------------------------------------------
function initTransitions() {
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) html.classList.remove('is-leaving');
  });
  if (reducedMotion) return;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    let url;
    try { url = new URL(a.href, location.href); } catch (_) { return; }
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    e.preventDefault();
    html.classList.add('is-leaving');
    window.setTimeout(() => { location.href = url.href; }, 260);
  });
}

// ---------------------------------------------------------------------------
// Reveal on scroll
// ---------------------------------------------------------------------------
function initReveal() {
  const els = $$('.reveal');
  if (!els.length) return;
  if (reducedMotion || !('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-in');
        io.unobserve(en.target);
        // drop the stagger delay afterwards so hover transitions are immediate
        window.setTimeout(() => en.target.style.setProperty('--d', '0ms'), 1500);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((el, i) => {
    el.style.setProperty('--d', String((i % 4) * 70) + 'ms');
    io.observe(el);
  });
}

// ---------------------------------------------------------------------------
// Card spotlight
// ---------------------------------------------------------------------------
function initSpotlight() {
  if (!finePointer) return;
  $$('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
    });
  });
}

// ---------------------------------------------------------------------------
// Lazy page modules
// ---------------------------------------------------------------------------
function initModules() {
  $$('canvas.accent').forEach((c) => {
    import('./accent.js').then((m) => m.initAccent(c, { animate: !reducedMotion })).catch(() => {});
  });
  // 3D visualizations (lazy). The SVG/HTML versions are the fallback when WebGL is unavailable.
  $$('[data-netmap]').forEach((el) => {
    const mini = el.dataset.netmap === 'mini';
    const fallback = () => {
      import('./network.js').then((m) => m.initNetwork(el, { animate: !reducedMotion, mini })).catch(() => {});
    };
    import('./viz3d.js')
      .then((m) => m.initViz(el, { kind: 'network', mini, onFail: fallback }))
      .catch(fallback);
  });
  $$('[data-viz="energy"]').forEach((el) => {
    import('./viz3d.js').then((m) => m.initViz(el, { kind: 'energy' })).catch(() => {});
  });
  if ($('#quote-form')) {
    import('./contact.js').then((m) => m.initQuoteForm()).catch(() => {});
  }
}

try {
  hydrate();
  initNav();
  initAnchors();
  initTransitions();
  initReveal();
  initSpotlight();
  initModules();
  html.classList.add('ready');
  // The home page boots through home.js, which sets the flag itself.
  if (!document.body.classList.contains('page-home')) window.__booted = true;
} catch (err) {
  html.classList.add('static', 'ready');
  window.__booted = true;
}
