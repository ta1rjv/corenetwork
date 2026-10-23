// Optional page generator. Run with: node tools/build-pages.mjs
// It writes the static HTML pages (shared header, footer and head are defined once here).
// The generated HTML files are committed, so hosting needs no build step.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://ta1rjv.github.io/corenetwork/';
const OG_IMAGE = SITE + 'assets/og.png';

const NAV = [
  ['hizmetler.html', 'Hizmetler'],
  ['veri-merkezi.html', 'Veri Merkezi'],
  ['sunucu.html', 'Sunucu'],
  ['internet.html', 'İnternet'],
  ['altyapi.html', 'Altyapı'],
  ['hakkimizda.html', 'Hakkımızda'],
  ['iletisim.html', 'İletişim'],
];

// ---------------------------------------------------------------------------
// Icons (24x24 stroke icons, referenced through <use>)
// ---------------------------------------------------------------------------
const ICONS = {
  server: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/>',
  rack: '<rect x="5" y="2.5" width="14" height="19" rx="1.5"/><path d="M5 8h14M5 13h14M8.5 5.2h.01M8.5 10.5h.01M8.5 16h.01M12 18.5h4"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  fiber: '<path d="M3 12h4l2-5 3 10 3-8 2 3h4"/>',
  radio: '<path d="M12 12v9M8 21h8M12 12l-3 9M12 12l3 9"/><circle cx="12" cy="9" r="1.5"/><path d="M8.2 5.8a5.4 5.4 0 000 6.4M15.8 5.8a5.4 5.4 0 010 6.4M5.6 3.4a9 9 0 000 11.2M18.4 3.4a9 9 0 010 11.2"/>',
  network: '<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v5M12 12l-6 5M12 12l6 5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  snow: '<path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 3.5l3 2 3-2M9 20.5l3-2 3 2"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  db: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  panel: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3M7 14l3-3 3 2 4-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6M16 4.8a3.5 3.5 0 010 6.4M18 14.4c2 .7 3.5 2.6 3.5 5.6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />',
  wifi: '<path d="M2 9a15 15 0 0120 0M5 12.5a10.5 10.5 0 0114 0M8.5 16a5.5 5.5 0 017 0"/><circle cx="12" cy="19" r="1"/>',
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/>',
};

const sprite = () => '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
  Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('') +
  '</defs></svg>';

const ico = (name, cls = 'ico') => `<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;

// ---------------------------------------------------------------------------
// Logo (inline wordmark; colors come from CSS)
// ---------------------------------------------------------------------------
const logo = () => `<svg class="logo" viewBox="0 0 324 40" role="img" aria-label="CORENETWORK" focusable="false">
<g class="lg-core" fill="none" stroke="currentColor" stroke-width="5.2" stroke-linejoin="miter"><path d="M23.87 14.3A11.4 11.4 0 1 0 23.87 25.7"/><circle cx="48" cy="20" r="11.4"/><path d="M70.6 34V8.6H84A6.2 6.2 0 0 1 84 21H70.6M81 21L90.4 34"/><path d="M122 8.6H100.6V31.4H122M100.6 20H119"/></g>
<rect x="45.5" y="17.5" width="5" height="5" fill="#19e0ff"/>
<g class="lg-net" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="bevel"><path d="M135.6 34V6L154.4 34V6"/><path d="M179 7.6H162.6V32.4H179M162.6 20H177"/><path d="M184 7.6H204M194 7.6V34"/><path d="M209.8 6L217 34L224 10L231 34L238.2 6"/><circle cx="258" cy="20" r="12.4"/><path d="M278.6 34V7.6H289A5.6 5.6 0 0 1 289 18.8H278.6M287 18.8L296.4 34"/><path d="M303.6 34V6M322.4 6L303.6 21M310 16.6L323 34"/></g>
</svg>`;

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------
function headHtml({ file, title, desc, home, noindex, three }) {
  const url = SITE + (file === 'index.html' ? '' : file);
  return `<!DOCTYPE html>
<html lang="tr" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta name="theme-color" content="#07090c">
  <meta name="color-scheme" content="dark">
  ${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
  <meta property="og:type" content="website">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:site_name" content="CORENETWORK">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
  <link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <script>
    // Switch the no-js class early; fall back to the static layout if the app never boots.
    document.documentElement.className = document.documentElement.className.replace('no-js', 'js');
    setTimeout(function () {
      if (!window.__booted) document.documentElement.classList.add('static', 'ready');
    }, 4000);
  </script>${home || three ? `
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"
    }
  }
  </script>` : ''}
</head>`;
}

function headerHtml(active) {
  const links = NAV.map(([f, t]) => `<li><a href="${f}"${f === active ? ' aria-current="page"' : ''}>${t}</a></li>`).join('');
  return `<header class="site-header">
  <div class="header-in">
    <a class="brand" href="index.html" aria-label="CORENETWORK ana sayfa">${logo()}</a>
    <nav id="site-nav" class="nav" aria-label="Ana menü">
      <ul>${links}</ul>
      <a class="btn btn-ghost btn-sm nav-cta" href="giris.html" data-cfg-href="panelUrl">Panel</a>
      <a class="btn btn-primary btn-sm nav-cta" href="iletisim.html#teklif">Teklif Alın</a>
    </nav>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menüyü aç"><span></span><span></span><span></span></button>
  </div>
</header>`;
}

function footerHtml() {
  return `<footer class="site-footer">
  <div class="wrap footer-grid">
    <div class="footer-brand">
      <a class="brand" href="index.html" aria-label="CORENETWORK ana sayfa">${logo()}</a>
      <p>Veri merkezi ve internet servis sağlayıcı. Barındırma, sunucu ve bağlantı hizmetlerini uçtan uca yönetiriz.</p>
      <ul class="socials" data-socials>
        <li><a href="https://www.linkedin.com/company/ornek-firma" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
        <li><a href="https://x.com/ornekfirma" target="_blank" rel="noopener noreferrer">X</a></li>
        <li><a href="https://www.instagram.com/ornekfirma" target="_blank" rel="noopener noreferrer">Instagram</a></li>
      </ul>
    </div>
    <nav aria-label="Hizmetler">
      <h2 class="foot-h mono">Hizmetler</h2>
      <ul>
        <li><a href="veri-merkezi.html">Veri Merkezi &amp; Co-location</a></li>
        <li><a href="sunucu.html">VDS / VPS Sunucu</a></li>
        <li><a href="internet.html">Fiber, xDSL, Radyolink</a></li>
        <li><a href="altyapi.html">Altyapı</a></li>
      </ul>
    </nav>
    <nav aria-label="Kurumsal">
      <h2 class="foot-h mono">Kurumsal</h2>
      <ul>
        <li><a href="hakkimizda.html">Hakkımızda</a></li>
        <li><a href="sss.html">Sıkça Sorulan Sorular</a></li>
        <li><a href="iletisim.html#teklif">Teklif Alın</a></li>
        <li><a href="giris.html" data-cfg-href="panelUrl">Müşteri Paneli</a></li>
        <li><a href="https://hiztesti.ornek-alanadi.com" data-cfg-href="speedTestUrl" target="_blank" rel="noopener noreferrer">Hız Testi</a></li>
      </ul>
    </nav>
    <div>
      <h2 class="foot-h mono">İletişim</h2>
      <ul class="contact-list">
        <li>${ico('phone')}<a href="tel:+900000000000" data-cfg-href="phoneHref" data-cfg="phone">+90 (000) 000 00 00</a></li>
        <li>${ico('mail')}<a href="mailto:info@ornek-alanadi.com" data-cfg-href="emailHref" data-cfg="email">info@ornek-alanadi.com</a></li>
        <li>${ico('pin')}<span data-cfg="address">Örnek Mahallesi, Örnek Caddesi No: 0, Örnek / Türkiye</span></li>
        <li>${ico('clock')}<span data-cfg="workingHours">Pazartesi - Cuma, 09:00 - 18:00</span></li>
      </ul>
    </div>
  </div>
  <div class="wrap footer-bottom mono">
    <span>© <span data-year>2026</span> <span data-cfg="companyName">CORENETWORK</span>. Tüm hakları saklıdır.</span>
    <a href="#top" class="to-top">Başa dön</a>
  </div>
</footer>`;
}

function pageHtml({ file, title, desc, body, bodyClass = '', home = false, three = false, noindex = false, active = file, before = '', after = '', headExtra = '' }) {
  let head = headHtml({ file, title, desc, home, noindex, three });
  if (headExtra) head = head.replace('</head>', headExtra + '\n</head>');
  const scripts = home
    ? `<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"></script>
  <script type="module" src="js/common.js"></script>
  <script type="module" src="js/home.js"></script>`
    : '<script type="module" src="js/common.js"></script>';
  return `${head}
<body class="${bodyClass}" id="top">
  <a class="skip" href="#main">İçeriğe geç</a>
  ${sprite()}
  ${before}
  ${headerHtml(active)}
  <main id="main" tabindex="-1">
${body}
  </main>
  ${footerHtml()}
  ${after}
  <div class="page-fade" aria-hidden="true"></div>
  ${scripts}
</body>
</html>
`;
}

function write(file, html) {
  writeFileSync(join(ROOT, file), html, 'utf8');
  console.log('wrote', file);
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------
const BTN_QUOTE = 'Teklif Alın';
const BTN_SERVICES = 'Hizmetlerimizi İnceleyin';

const hero = (eyebrow, title, lead, extra = '', accent = 'cyan') => `<section class="page-hero" aria-labelledby="page-title">
  <canvas class="accent" data-accent="${accent}" aria-hidden="true"></canvas>
  <div class="wrap page-hero-in">
    <p class="eyebrow mono">${eyebrow}</p>
    <h1 id="page-title" class="h1">${title}</h1>
    <p class="lead">${lead}</p>
    ${extra}
  </div>
</section>`;

const ctaBand = (title, text, svc) => `<section class="section" aria-label="Teklif">
  <div class="wrap">
    <div class="cta-band reveal">
      <div>
        <h2 class="h2">${title}</h2>
        <p class="lead">${text}</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-primary" href="iletisim.html${svc ? `?hizmet=${svc}` : ''}#teklif">${BTN_QUOTE}</a>
        <a class="btn btn-ghost" href="hizmetler.html">${BTN_SERVICES}</a>
      </div>
    </div>
  </div>
</section>`;

const card = ({ icon, title, text, href, link = 'İnceleyin' }) => `<article class="card reveal">
  <div class="card-ico">${ico(icon)}</div>
  <h3>${title}</h3>
  <p>${text}</p>${href ? `
  <a class="card-link" href="${href}">${link} ${ico('arrow', 'ico ico-sm')}</a>` : ''}
</article>`;

const sectionHead = (eyebrow, title, lead = '', id = '') => `<header class="section-head reveal">
  <p class="eyebrow mono">${eyebrow}</p>
  <h2${id ? ` id="${id}"` : ''} class="h2">${title}</h2>${lead ? `
  <p class="lead">${lead}</p>` : ''}
</header>`;

const checks = (items) => `<ul class="checks">${items.map((t) => `<li>${ico('check')}<span>${t}</span></li>`).join('')}</ul>`;

const processSection = (id = 'proc-title') => `<section class="section" aria-labelledby="${id}">
  <div class="wrap">
    ${sectionHead('Süreç', 'Keşiften desteğe dört adım.', '', id)}
    <ol class="steps">
      <li class="reveal"><span class="step-n mono">01</span><h3>Keşif</h3><p>İhtiyaçlarınızı ve mevcut altyapınızı analiz ederiz.</p></li>
      <li class="reveal"><span class="step-n mono">02</span><h3>Teklif</h3><p>Kapsamı netleştirir, size özel teklifimizi sunarız.</p></li>
      <li class="reveal"><span class="step-n mono">03</span><h3>Kurulum</h3><p>Hizmeti planlı biçimde kurar ve devreye almadan önce test ederiz.</p></li>
      <li class="reveal"><span class="step-n mono">04</span><h3>Destek</h3><p>Devreye alma sonrasında teknik destek sağlarız.</p></li>
    </ol>
  </div>
</section>`;

const forWhom = (items, id = 'who-title') => `<section class="section section-alt" aria-labelledby="${id}">
  <div class="wrap">
    ${sectionHead('Kimler için', 'Bu hizmet kimler için uygundur?', '', id)}
    <ul class="chips reveal">${items.map((t) => `<li>${t}</li>`).join('')}</ul>
  </div>
</section>`;

// ---------------------------------------------------------------------------
// HOME
// ---------------------------------------------------------------------------
const homeBody = `
    <canvas id="gl" aria-hidden="true"></canvas>
    <div class="gl-fallback" aria-hidden="true"></div>

    <div class="hud" aria-hidden="true">
      <div class="hud-layer mono"><span class="hud-k">KATMAN</span><strong id="hud-layer">KABİN</strong></div>
      <div class="hud-scale mono"><span class="hud-k">ÖLÇEK</span><strong id="hud-scale">1 m</strong><i class="ruler" id="hud-ruler"></i></div>
      <div class="hud-prog mono"><span id="hud-pct">000%</span><span class="rail"><i id="hud-bar"></i></span></div>
    </div>

    <div id="descent" class="descent">
      <section id="cabinet" class="phase phase-cabinet" aria-labelledby="hero-title">
        <div class="stage">
          <div class="hero-copy">
            <p class="eyebrow mono" data-intro>Veri merkezi · Sunucu · İnternet</p>
            <h1 id="hero-title" class="hero-title"><span class="hl">Kurumsal altyapının</span> <span class="hl hl-2">çekirdeği.</span></h1>
            <p class="lead" data-intro>Veri merkezi, sunucu ve internet hizmetlerini tek çatı altında, uçtan uca yönetiyoruz.</p>
            <div class="hero-cta" data-intro>
              <a class="btn btn-primary" href="iletisim.html#teklif">${BTN_QUOTE}</a>
              <a class="btn btn-ghost" href="hizmetler.html">${BTN_SERVICES}</a>
            </div>
          </div>
          <div class="cap-block cap-left cap-late">
            <p class="eyebrow mono">Kabin</p>
            <h2 class="h2">Kesintisiz altyapı.</h2>
            <p class="lead">Yedekli enerji ve soğutma, kontrollü erişim ve fiziksel güvenlik. Donanımınızı kesintiye karşı tasarlanmış bir ortamda barındırırız.</p>
          </div>
          <div class="scroll-cue mono" aria-hidden="true"><span>Kaydırarak çekirdeğe inin</span><i></i></div>
        </div>
      </section>

      <section id="server" class="phase" aria-labelledby="server-title">
        <div class="stage">
          <div class="cap-block cap-left">
            <p class="eyebrow mono">Sunucu</p>
            <h2 id="server-title" class="h2">Kurumsal donanım. Öngörülebilir performans.</h2>
            <p class="lead">Kurumsal sınıf sunucu donanımını yönetilen operasyonla işletiriz. Düzenli bakım ve sürekli izleme, sistemlerinizin istikrarlı çalışmasını sağlar.</p>
          </div>
        </div>
      </section>

      <section id="cpu" class="phase" aria-labelledby="cpu-title">
        <div class="stage">
          <div class="cap-block cap-right">
            <p class="eyebrow mono">İşlemci</p>
            <h2 id="cpu-title" class="h2">İşleminiz için ayrılmış kaynak.</h2>
            <p class="lead">VDS hizmetinde işlemci, bellek ve depolama kaynakları size tahsis edilir. İş yükleriniz diğer müşterilerden izole çalışır.</p>
          </div>
        </div>
      </section>

      <section id="silicon" class="phase" aria-labelledby="silicon-title">
        <div class="stage">
          <div class="cap-block cap-left">
            <p class="eyebrow mono">Silisyum</p>
            <h2 id="silicon-title" class="h2">Altyapının her katmanında kontrol.</h2>
            <p class="lead">Fiber hattan sunucuya kadar tüm katmanları biz işletiriz. Uçtan uca sahiplik; hızlı müdahale ve net sorumluluk anlamına gelir.</p>
          </div>
        </div>
      </section>

      <section id="deep" class="phase phase-deep" aria-labelledby="deep-title">
        <div class="stage stage-center">
          <div class="deep-msg">
            <p class="eyebrow mono">Çekirdek</p>
            <h2 id="deep-title" class="deep-title">Biz buradayız.</h2>
            <p class="lead">Verinizin, bağlantınızın ve işinizin merkezinde.</p>
          </div>
          <div class="deep-cta">
            <p class="lead">Altyapı ihtiyacınızı paylaşın. Size özel teklifimizi hazırlayalım.</p>
            <div class="hero-cta">
              <a class="btn btn-primary" href="iletisim.html#teklif">${BTN_QUOTE}</a>
              <a class="btn btn-ghost" href="hizmetler.html">${BTN_SERVICES}</a>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div id="after" class="after">
      <section class="section" aria-labelledby="svc-title">
        <div class="wrap">
          ${sectionHead('Hizmetler', 'Altyapınızın her katmanı için tek muhatap.', 'Barındırma, sunucu ve bağlantı hizmetlerini tek bir kurumsal çatı altında sağlarız.', 'svc-title')}
          <div class="grid grid-4">
            ${card({ icon: 'rack', title: 'Veri Merkezi &amp; Co-location', text: 'Kabin, yarım kabin ve U bazında barındırma. Yedekli enerji ve soğutma, kontrollü fiziksel erişim.', href: 'veri-merkezi.html' })}
            ${card({ icon: 'server', title: 'VDS / VPS Sunucu', text: 'NVMe depolama, snapshot, DDoS koruması ve IPv4/IPv6 desteğiyle yönetilen sanal sunucular.', href: 'sunucu.html' })}
            ${card({ icon: 'fiber', title: 'İnternet', text: 'Fiber, xDSL ve radyolink. Kurumsal ve bireysel bağlantı, statik IP ve simetrik hat.', href: 'internet.html' })}
            ${card({ icon: 'network', title: 'Altyapı', text: 'Çekirdek ağdan fiber halkaya, radyolink kulelerinden üst sağlayıcı bağlantılarına ağ topolojimiz.', href: 'altyapi.html' })}
          </div>
        </div>
      </section>

      <section class="section section-alt" aria-labelledby="why-title">
        <div class="wrap">
          ${sectionHead('Neden CORENETWORK', 'Kesintiye karşı tasarlanmış altyapı. Sorumluluğu üstlenen ekip.', '', 'why-title')}
          <div class="grid grid-4">
            ${card({ icon: 'bolt', title: 'Kesintiye karşı tasarım', text: 'Enerji, soğutma ve ağ yollarında yedeklilik esas alınır.' })}
            ${card({ icon: 'shield', title: 'Katmanlı güvenlik', text: 'Kontrollü fiziksel erişim, sürekli izleme ve DDoS koruması.' })}
            ${card({ icon: 'users', title: 'Uzman teknik ekip', text: 'Kendi teknik ekibimiz taleplerinize doğrudan yanıt verir.' })}
            ${card({ icon: 'pin', title: 'Yerel varlık', text: 'Türkiye’de konumlanmış altyapı ve ekip. Yakın, erişilebilir, hızlı.' })}
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="infra-title">
        <div class="wrap split">
          <div class="reveal">
            <p class="eyebrow mono">Altyapı</p>
            <h2 id="infra-title" class="h2">Ağ topolojimiz.</h2>
            <p class="lead">Üst sağlayıcılardan çekirdek yönlendiriciye, veri merkezinden fiber halka ve radyolink kulelerine uzanan yapıyı yedeklilik esasıyla planlarız.</p>
            <a class="btn btn-ghost" href="altyapi.html">Altyapıyı İnceleyin ${ico('arrow', 'ico ico-sm')}</a>
          </div>
          <div class="visual reveal">
            <div class="netmap-mini" data-netmap="mini" role="img" aria-label="Ağ topolojisinin sadeleştirilmiş çizimi: üst sağlayıcılar, çekirdek yönlendirici, veri merkezi ve fiber halka"></div>
          </div>
        </div>
      </section>

      ${ctaBand('Altyapı ihtiyacınızı birlikte netleştirelim.', 'Gereksinimlerinizi iletin. Size uygun barındırma, sunucu veya internet çözümü için teklif hazırlayalım.')}
    </div>
`;

write('index.html', pageHtml({
  file: 'index.html',
  title: 'CORENETWORK | Kurumsal Veri Merkezi ve İnternet Altyapısı',
  desc: 'CORENETWORK: veri merkezi, co-location, VDS/VPS sunucu, fiber, xDSL ve radyolink internet hizmetlerini tek çatı altında, uçtan uca yönetir.',
  body: homeBody,
  bodyClass: 'page-home',
  home: true,
  active: 'index.html',
}));

// ---------------------------------------------------------------------------
// HIZMETLER
// ---------------------------------------------------------------------------
write('hizmetler.html', pageHtml({
  file: 'hizmetler.html',
  title: 'Hizmetler | CORENETWORK',
  desc: 'CORENETWORK hizmetleri: veri merkezi ve co-location, VDS, VPS, fiber, xDSL ve radyolink internet çözümleri.',
  bodyClass: 'page-inner',
  body: `
${hero('Hizmetler', 'Kurumsal altyapı hizmetleri.', 'Barındırma, sunucu ve bağlantı çözümlerini tek bir sağlayıcıdan alın.')}
<section class="section" aria-label="Hizmet listesi">
  <div class="wrap">
    <div class="grid grid-3">
      ${card({ icon: 'rack', title: 'Veri Merkezi &amp; Co-location', text: 'Donanımınızı yedekli enerji ve soğutma, kontrollü erişim altında barındırırız.', href: 'veri-merkezi.html' })}
      ${card({ icon: 'server', title: 'VDS', text: 'Size ayrılmış kaynaklarla çalışan sanal sunucu. Öngörülebilir performans sağlar.', href: 'sunucu.html#vds-vps' })}
      ${card({ icon: 'cpu', title: 'VPS', text: 'Web, test ve geliştirme ortamları için uygun maliyetli sanal sunucu.', href: 'sunucu.html#vds-vps' })}
      ${card({ icon: 'fiber', title: 'Fiber İnternet', text: 'Simetrik hat ve statik IP seçenekleriyle kurumsal ve bireysel fiber bağlantı.', href: 'internet.html#fiber' })}
      ${card({ icon: 'globe', title: 'xDSL', text: 'Fiber altyapısı bulunmayan lokasyonlarda mevcut hat üzerinden internet erişimi.', href: 'internet.html#xdsl' })}
      ${card({ icon: 'radio', title: 'Radyolink', text: 'Kablosuz noktadan noktaya bağlantı ile fiberin ulaşmadığı noktalara erişim.', href: 'internet.html#radyolink' })}
    </div>
  </div>
</section>
${processSection('flow-title')}
<section class="section section-alt" aria-label="Sıkça sorulan sorular">
  <div class="wrap">
    <div class="cta-band reveal">
      <div>
        <h2 class="h2">Sorularınızın yanıtları burada.</h2>
        <p class="lead">VDS ve VPS farkı, co-location seçenekleri, kapsama ve diğer konulardaki sorulara kısa ve net yanıtlar verdik.</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-ghost" href="sss.html">Sıkça Sorulan Sorular</a>
        <a class="btn btn-primary" href="iletisim.html#teklif">${BTN_QUOTE}</a>
      </div>
    </div>
  </div>
</section>`,
}));

// ---------------------------------------------------------------------------
// VERI MERKEZI
// ---------------------------------------------------------------------------
const powerDiagram = `<svg class="schematic" viewBox="0 0 520 300" role="img" aria-label="Yedekli enerji ve soğutma şeması: iki bağımsız besleme hattı ve yedekli soğutma üniteleri bir kabine bağlanır" focusable="false">
  <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#19c8e6"/><stop offset="1" stop-color="#8a5cff"/></linearGradient></defs>
  <g class="sch-node"><rect x="10" y="40" width="110" height="50" rx="8"/><text x="65" y="70" text-anchor="middle">Besleme A</text></g>
  <g class="sch-node"><rect x="10" y="210" width="110" height="50" rx="8"/><text x="65" y="240" text-anchor="middle">Besleme B</text></g>
  <g class="sch-node sch-core"><rect x="200" y="100" width="120" height="100" rx="10"/><text x="260" y="146" text-anchor="middle">Kabin</text><text x="260" y="168" text-anchor="middle" class="sch-sub">A + B beslemeli</text></g>
  <g class="sch-node sch-cool"><rect x="400" y="40" width="110" height="50" rx="8"/><text x="455" y="70" text-anchor="middle">Soğutma 1</text></g>
  <g class="sch-node sch-cool"><rect x="400" y="210" width="110" height="50" rx="8"/><text x="455" y="240" text-anchor="middle">Soğutma 2</text></g>
  <path class="sch-flow" d="M120 65 C160 65 160 125 200 125"/>
  <path class="sch-flow" d="M120 235 C160 235 160 175 200 175"/>
  <path class="sch-flow sch-flow-cool" d="M400 65 C360 65 360 125 320 125"/>
  <path class="sch-flow sch-flow-cool" d="M400 235 C360 235 360 175 320 175"/>
</svg>`;

write('veri-merkezi.html', pageHtml({
  file: 'veri-merkezi.html',
  three: true,
  title: 'Veri Merkezi ve Co-location | CORENETWORK',
  desc: 'Kabin, yarım kabin ve U bazında co-location; enerji ve soğutma yedekliliği, fiziksel güvenlik, uzaktan el hizmeti ve cross-connect.',
  bodyClass: 'page-inner',
  body: `
${hero('Veri Merkezi &amp; Co-location', 'Donanımınız için güvenli, yedekli barındırma.', 'Sunucularınızı kontrollü erişimli, yedekli enerji ve soğutma altyapısına sahip veri merkezimizde barındırırız.', `<div class="hero-cta"><a class="btn btn-primary" href="iletisim.html?hizmet=colocation#teklif">${BTN_QUOTE}</a><a class="btn btn-ghost" href="altyapi.html">Altyapıyı İnceleyin</a></div>`, 'cyan')}
<section class="section" aria-labelledby="opt-title">
  <div class="wrap">
    ${sectionHead('Hizmet kapsamı', 'Büyüklüğünüze uygun barındırma seçenekleri.', 'Kabin, yarım kabin ve U bazında barındırma seçenekleri sunarız.', 'opt-title')}
    <div class="grid grid-3">
      ${card({ icon: 'rack', title: 'Tam kabin', text: 'Yalnızca size ayrılmış kabin. Yerleşimi ve erişimi siz yönetirsiniz.' })}
      ${card({ icon: 'layers', title: 'Yarım kabin', text: 'Daha küçük dağıtımlar için kabinin ayrılmış bir bölümü.' })}
      ${card({ icon: 'server', title: 'U bazında barındırma', text: 'Yalnızca ihtiyaç duyduğunuz alan kadar barındırma.' })}
    </div>
    <p class="note reveal">Kabin içi ölçüler, güç ve bağlantı detayları teklif sürecinde projenize göre belirlenir.</p>
  </div>
</section>
<section class="section section-alt" aria-labelledby="pwr-title">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow mono">Teknik özellikler</p>
      <h2 id="pwr-title" class="h2">Enerji ve soğutmada yedeklilik.</h2>
      <p class="lead">Donanımınızın çalışması enerjiye ve doğru sıcaklığa bağlıdır. Her iki katmanı da yedeklilik esasıyla kurgularız.</p>
      ${checks(['Bağımsız enerji besleme yolları', 'Yedekli soğutma altyapısı', 'Kabin düzeyinde çift besleme seçeneği', 'Altyapının sürekli izlenmesi'])}
    </div>
    <div class="visual reveal"><div class="viz" data-viz="energy" role="img" aria-label="Yedekli enerji ve soğutma: iki bağımsız besleme hattı ve iki soğutma ünitesi bir kabine bağlanır">${powerDiagram}</div></div>
  </div>
</section>
<section class="section" aria-labelledby="sec-title">
  <div class="wrap">
    ${sectionHead('Fiziksel güvenlik', 'Donanımınız kontrollü bir ortamda.', '', 'sec-title')}
    <div class="grid grid-4">
      ${card({ icon: 'lock', title: 'Kontrollü erişim', text: 'Veri salonuna yalnızca yetkilendirilmiş kişiler girer.' })}
      ${card({ icon: 'eye', title: 'Kamera ile izleme', text: 'Kritik alanlar izlenir ve kayıt altına alınır.' })}
      ${card({ icon: 'users', title: 'Ziyaretçi yönetimi', text: 'Ziyaretler önceden planlanır, kayıt altına alınır ve eşlik edilir.' })}
      ${card({ icon: 'shield', title: 'Kilitli kabinler', text: 'Kabinleriniz kilit altındadır. Erişim yetkisi size aittir.' })}
    </div>
  </div>
</section>
<section class="section section-alt" aria-labelledby="svc-title">
  <div class="wrap">
    ${sectionHead('Ek hizmetler', 'Sahada olmadığınız durumlarda da operasyon sürer.', '', 'svc-title')}
    <div class="grid grid-2">
      <article class="card card-lg reveal">
        <div class="card-ico">${ico('terminal')}</div>
        <h3>Uzaktan el hizmeti (Remote Hands)</h3>
        <p>Veri merkezine gelmeden, ekibimizden yerinde işlem talep edersiniz: kablo değişimi, cihaz yeniden başlatma, görsel kontrol ve benzeri müdahaleler.</p>
        ${checks(['Talebiniz kayıt altına alınır', 'Yapılan işlem size raporlanır', 'Kapsam teklif sürecinde belirlenir'])}
      </article>
      <article class="card card-lg reveal">
        <div class="card-ico">${ico('link')}</div>
        <h3>Cross-connect</h3>
        <p>Kabininizi aynı tesisteki başka bir müşteriye veya servis sağlayıcıya doğrudan fiziksel bağlantıyla bağlarız. Doğrudan, aracısız bir yol sağlar.</p>
        ${checks(['Bakır ve fiber bağlantı seçenekleri', 'Doğrudan bağlantı', 'Talep üzerine planlı kurulum'])}
      </article>
    </div>
  </div>
</section>
${forWhom(['Kurumsal BT ekipleri', 'Yazılım ve SaaS şirketleri', 'Servis sağlayıcılar', 'Kendi donanımını işleten işletmeler'])}
${processSection()}
${ctaBand('Donanımınız için güvenli bir alan ayıralım.', 'Projenizi iletin. Barındırma ihtiyacınıza uygun teklifimizi hazırlayalım.', 'colocation')}`,
}));

// ---------------------------------------------------------------------------
// SUNUCU
// ---------------------------------------------------------------------------
const tier = (name, kicker, items, feat = false) => `<article class="card tier${feat ? ' tier-feat' : ''} reveal">
  ${feat ? '<span class="tier-badge mono">Önerilen</span>' : ''}
  <p class="eyebrow mono">${kicker}</p>
  <h3>${name}</h3>
  ${checks(items)}
  <a class="btn ${feat ? 'btn-primary' : 'btn-ghost'}" href="iletisim.html?hizmet=vds#teklif">${BTN_QUOTE}</a>
</article>`;

write('sunucu.html', pageHtml({
  file: 'sunucu.html',
  title: 'VDS ve VPS Sunucu | CORENETWORK',
  desc: 'VDS ve VPS sanal sunucu hizmetleri: NVMe depolama, snapshot, DDoS koruması, IPv4/IPv6 ve yönetim paneli. VDS ile VPS farkı.',
  bodyClass: 'page-inner',
  body: `
${hero('VDS / VPS Sunucu', 'Yönetilen sanal sunucu altyapısı.', 'NVMe depolama, snapshot, DDoS koruması ve IPv4/IPv6 desteğiyle VDS ve VPS çözümleri sunarız.', `<div class="hero-cta"><a class="btn btn-primary" href="iletisim.html?hizmet=vds#teklif">${BTN_QUOTE}</a><a class="btn btn-ghost" href="#vds-vps">VDS ve VPS Farkı</a></div>`, 'violet')}
<section id="vds-vps" class="section" aria-labelledby="diff-title">
  <div class="wrap">
    ${sectionHead('Hizmet kapsamı', 'VDS ve VPS: kaynak ayrımı farkı belirler.', 'İkisi de fiziksel bir sunucunun sanallaştırılmasıyla elde edilir. Fark, kaynakların nasıl tahsis edildiğindedir.', 'diff-title')}
    <div class="grid grid-2">
      <article class="card card-lg reveal">
        <div class="card-ico">${ico('cpu')}</div>
        <h3>VPS</h3>
        <p><strong>Virtual Private Server.</strong> Fiziksel sunucunun kaynakları, sanallaştırma katmanı üzerinden paylaşılır. Uygun maliyetli ve esnek bir çözümdür.</p>
        ${checks(['Web siteleri ve küçük uygulamalar', 'Test ve geliştirme ortamları', 'Hızlı kurulum'])}
      </article>
      <article class="card card-lg reveal">
        <div class="card-ico">${ico('server')}</div>
        <h3>VDS</h3>
        <p><strong>Virtual Dedicated Server.</strong> Kaynaklar size ayrılmış olarak tahsis edilir ve iş yükleriniz izole çalışır. Öngörülebilir performans sağlar.</p>
        ${checks(['Veritabanları ve yoğun uygulamalar', 'Kritik servisler ve API’ler', 'Öngörülebilir performans gereksinimi'])}
      </article>
    </div>
    <div class="table-wrap reveal">
      <table class="compare">
        <caption class="sr-only">VPS ve VDS karşılaştırması</caption>
        <thead><tr><th scope="col">Özellik</th><th scope="col">VPS</th><th scope="col">VDS</th></tr></thead>
        <tbody>
          <tr><th scope="row">Kaynak yaklaşımı</th><td>Paylaşımlı kaynak havuzu</td><td>Size ayrılmış kaynak</td></tr>
          <tr><th scope="row">Performans</th><td>Genel iş yükleri için uygun</td><td>Daha öngörülebilir</td></tr>
          <tr><th scope="row">Tipik kullanım</th><td>Web, test, geliştirme</td><td>Veritabanı, yoğun ve kritik servisler</td></tr>
          <tr><th scope="row">Maliyet yaklaşımı</th><td>Genellikle daha uygun</td><td>Ayrılmış kaynak nedeniyle genellikle daha yüksek</td></tr>
        </tbody>
      </table>
    </div>
    <p class="note reveal">Tanımlar sağlayıcıya göre değişebilir. Yapılandırmayı ihtiyacınıza göre birlikte belirleriz.</p>
  </div>
</section>
<section class="section section-alt" aria-labelledby="feat-title">
  <div class="wrap">
    ${sectionHead('Teknik özellikler', 'Her sunucuda temel olarak sunduklarımız.', '', 'feat-title')}
    <div class="grid grid-3">
      ${card({ icon: 'db', title: 'NVMe depolama', text: 'Yüksek hızlı NVMe diskler ile hızlı okuma ve yazma.' })}
      ${card({ icon: 'layers', title: 'Snapshot', text: 'Sunucunun anlık görüntüsünü alın, gerektiğinde geri dönün.' })}
      ${card({ icon: 'shield', title: 'DDoS koruması', text: 'Hizmetlerinizi hacimsel saldırılara karşı koruyan altyapı.' })}
      ${card({ icon: 'globe', title: 'IPv4 / IPv6', text: 'IPv4 ve IPv6 adres desteği.' })}
      ${card({ icon: 'panel', title: 'Yönetim paneli', text: 'Sunucunuzu başlatın, durdurun, izleyin ve yönetin.' })}
      ${card({ icon: 'users', title: 'Teknik destek', text: 'Kurulumdan işletime kadar ulaşabileceğiniz uzman ekip.' })}
    </div>
  </div>
</section>
${forWhom(['Web siteleri ve e-ticaret', 'Uygulama ve API sunucuları', 'Veritabanları', 'Test ve geliştirme ortamları', 'VPN ve uzaktan erişim', 'Yedekleme ve dosya paylaşımı', 'Mail ve iletişim servisleri'])}
<section class="section" aria-labelledby="tier-title">
  <div class="wrap">
    ${sectionHead('Planlar', 'Kapsamı ihtiyacınıza göre seçin.', 'Kaynak ve yapılandırma detaylarını projenize göre teklif sürecinde belirleriz.', 'tier-title')}
    <div class="grid grid-3 tiers">
      ${tier('Başlangıç', 'Küçük projeler', ['NVMe depolama', 'IPv4 ve IPv6', 'DDoS koruması', 'Yönetim paneli erişimi'])}
      ${tier('Profesyonel', 'Büyüyen işletmeler', ['Başlangıç planındaki tüm özellikler', 'Snapshot desteği', 'Daha geniş kaynak seçenekleri', 'Gelişmiş teknik destek'], true)}
      ${tier('Kurumsal', 'Kritik iş yükleri', ['Profesyonel plandaki tüm özellikler', 'Ayrılmış kaynak (VDS) yaklaşımı', 'Özel yapılandırma ve IP planlaması', 'Danışmanlık ve proje desteği'])}
    </div>
  </div>
</section>
${processSection()}
${ctaBand('Sunucu mimarinizi birlikte planlayalım.', 'İş yükünüzü iletin. Size uygun VDS veya VPS yapılandırması için teklif hazırlayalım.', 'vds')}`,
}));

// ---------------------------------------------------------------------------
// INTERNET
// ---------------------------------------------------------------------------
write('internet.html', pageHtml({
  file: 'internet.html',
  title: 'Fiber, xDSL ve Radyolink İnternet | CORENETWORK',
  desc: 'Kurumsal ve bireysel internet: fiber (simetrik hat), xDSL ve radyolink, statik IP seçenekleri. Adresiniz için kapsama sorgulayın.',
  bodyClass: 'page-inner',
  body: `
${hero('İnternet', 'Kurumsal ve bireysel internet bağlantısı.', 'Fiber, xDSL ve radyolink seçenekleriyle her lokasyona uygun bağlantı sağlarız.', `<div class="hero-cta"><a class="btn btn-primary" href="#kapsama">Kapsama Sorgulayın</a><a class="btn btn-ghost" href="iletisim.html?hizmet=fiber#teklif">${BTN_QUOTE}</a></div>`, 'amber')}
<section class="section" aria-labelledby="tech-title">
  <div class="wrap">
    ${sectionHead('Hizmet kapsamı', 'Üç bağlantı teknolojisi.', 'Lokasyonunuza ve ihtiyacınıza en uygun teknolojiyi birlikte belirleriz.', 'tech-title')}
    <div class="grid grid-3">
      <article id="fiber" class="card card-lg reveal">
        <div class="card-ico">${ico('fiber')}</div>
        <h3>Fiber</h3>
        <p>Kararlı ve simetrik hat. Yükleme ve indirme dengesinin önemli olduğu kurumsal iş yükleri için uygundur.</p>
        ${checks(['Simetrik hat seçeneği', 'Statik IP desteği', 'Kurumsal ve bireysel paketler'])}
      </article>
      <article id="xdsl" class="card card-lg reveal">
        <div class="card-ico">${ico('globe')}</div>
        <h3>xDSL</h3>
        <p>Fiber altyapısı bulunmayan bölgelerde, mevcut hat altyapısı üzerinden yaygın erişim sağlar.</p>
        ${checks(['Geniş erişim alanı', 'Hızlı devreye alma', 'Statik IP seçenekleri'])}
      </article>
      <article id="radyolink" class="card card-lg reveal">
        <div class="card-ico">${ico('radio')}</div>
        <h3>Radyolink</h3>
        <p>Kablosuz noktadan noktaya bağlantı. Fiberin ulaşmadığı veya kazı yapılamayan noktalar için hızlı bir çözümdür.</p>
        ${checks(['Noktadan noktaya kablosuz hat', 'Fiber altyapısı gerektirmez', 'Görüş hattı değerlendirmesiyle planlanır'])}
      </article>
    </div>
  </div>
</section>
<section class="section section-alt" aria-labelledby="spec-title">
  <div class="wrap">
    ${sectionHead('Teknik özellikler', 'Bağlantınızı ihtiyacınıza göre yapılandırırız.', '', 'spec-title')}
    <div class="grid grid-3">
      ${card({ icon: 'network', title: 'Statik IP', text: 'Sunucu, kamera, VPN ve uzaktan erişim için sabit IP adresi seçenekleri.' })}
      ${card({ icon: 'fiber', title: 'Simetrik hat', text: 'Fiber bağlantılarda yükleme ve indirme dengeli hat seçeneği.' })}
      <article class="card reveal">
        <div class="card-ico">${ico('wifi')}</div>
        <h3>Hız testi</h3>
        <p>Bağlantınızı kendiniz ölçün.</p>
        <a class="card-link" href="https://hiztesti.ornek-alanadi.com" data-cfg-href="speedTestUrl" target="_blank" rel="noopener noreferrer">Hız testini açın ${ico('arrow', 'ico ico-sm')}</a>
      </article>
    </div>
  </div>
</section>
<section class="section" aria-labelledby="seg-title">
  <div class="wrap">
    ${sectionHead('Kimler için', 'Kurumsal ve bireysel kullanıcılar.', '', 'seg-title')}
    <div class="grid grid-2">
      <article class="card card-lg reveal">
        <div class="card-ico">${ico('building')}</div>
        <h3>Kurumsal</h3>
        <p>İş sürekliliğinin öncelikli olduğu işletmeler için yedekli hat planlaması, statik IP, simetrik fiber ve doğrudan teknik iletişim sağlarız.</p>
      </article>
      <article class="card card-lg reveal">
        <div class="card-ico">${ico('home')}</div>
        <h3>Bireysel</h3>
        <p>Ev ve küçük ofisler için sade kurulum, anlaşılır paketler ve etkin teknik destek sunarız.</p>
      </article>
    </div>
  </div>
</section>
<section id="kapsama" class="section section-alt" aria-labelledby="cov-title">
  <div class="wrap">
    <div class="coverage reveal">
      <div>
        <p class="eyebrow mono">Kapsama</p>
        <h2 id="cov-title" class="h2">Adresiniz için kapsama sorgulayın.</h2>
        <p class="lead">Adresinizi yazın ve bağlantı türünü seçin. Bilgilerinizi teklif formuna taşırız; ekibimiz uygunluğu değerlendirip size dönüş yapar.</p>
      </div>
      <form class="form cov-form" action="iletisim.html#teklif" method="get">
        <div class="field">
          <label for="cov-adres">Adres</label>
          <input id="cov-adres" name="adres" type="text" autocomplete="street-address" placeholder="Mahalle, cadde, bina no, ilçe / il" required>
        </div>
        <div class="field">
          <label for="cov-tur">Bağlantı türü</label>
          <select id="cov-tur" name="hizmet">
            <option value="fiber">Fiber</option>
            <option value="xdsl">xDSL</option>
            <option value="radyolink">Radyolink</option>
          </select>
        </div>
        <input type="hidden" name="kaynak" value="kapsama">
        <button class="btn btn-primary" type="submit">Kapsama Sorgulayın</button>
      </form>
    </div>
  </div>
</section>
${processSection()}
${ctaBand('İnternet bağlantınızı birlikte planlayalım.', 'Hat türü, hız gereksinimi ve statik IP ihtiyacınızı iletin. Size uygun teklifi hazırlayalım.', 'fiber')}`,
}));

// ---------------------------------------------------------------------------
// ALTYAPI
// ---------------------------------------------------------------------------
write('altyapi.html', pageHtml({
  file: 'altyapi.html',
  three: true,
  title: 'Altyapı ve Ağ Topolojisi | CORENETWORK',
  desc: 'CORENETWORK ağ altyapısı: veri merkezi, çekirdek yönlendirici, üst sağlayıcılar, fiber halka ve radyolink kuleleri.',
  bodyClass: 'page-inner',
  body: `
${hero('Altyapı', 'Ağ altyapımız.', 'Üst sağlayıcı bağlantılarından radyolink kulelerine, ağımızın yapısını ve paket akışını inceleyin.', '', 'cyan')}
<section class="section" aria-labelledby="map-title">
  <div class="wrap">
    ${sectionHead('Ağ topolojisi', 'Trafik nereden nereye akar?', 'Çizim, ağ yapımızı sadeleştirilmiş biçimde gösterir.', 'map-title')}
    <div class="netmap-wrap reveal">
      <div class="netmap" data-netmap="full" role="img" aria-label="Ağ topolojisi çizimi: iki üst sağlayıcı çekirdek yönlendiriciye, çekirdek yönlendirici veri merkezine, veri merkezi fiber halkaya, fiber halka ise radyolink kulelerine bağlanır."></div>
      <ul class="legend mono" aria-hidden="true">
        <li><i class="lg lg-fiber"></i>Fiber</li>
        <li><i class="lg lg-radio"></i>Radyolink</li>
        <li><i class="lg lg-up"></i>Üst sağlayıcı</li>
        <li><i class="lg lg-pkt"></i>Veri paketi</li>
      </ul>
    </div>
    <ul class="topo-list">
      <li><strong>Üst sağlayıcılar:</strong> Ağımızın dış dünyayla bağlantısını sağlayan çoklu çıkış yolları.</li>
      <li><strong>Çekirdek yönlendirici:</strong> Trafiğin yönlendirildiği merkezi nokta.</li>
      <li><strong>Veri merkezi:</strong> Barındırma ve sunucu hizmetlerinin çalıştığı tesis.</li>
      <li><strong>Fiber halka:</strong> Dağıtım noktalarını birbirine bağlayan halka yapısı.</li>
      <li><strong>Radyolink kuleleri:</strong> Fiberin ulaşmadığı noktalara kablosuz erişim sağlayan istasyonlar.</li>
    </ul>
  </div>
</section>
<section class="section section-alt" aria-labelledby="stat-title">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow mono">Ağ durumu</p>
      <h2 id="stat-title" class="h2">Şeffaf durum izleme.</h2>
      <p class="lead">Ağın durumu katman bazında izlenir. Yandaki pano, arayüzün örnek görünümüdür.</p>
      ${checks(['Katman bazında durum göstergeleri', 'Planlı çalışma bildirimleri', 'Olay geçmişi'])}
    </div>
    <div class="status reveal" role="group" aria-labelledby="status-h">
      <div class="status-head">
        <h3 id="status-h" class="mono">Ağ Durumu</h3>
        <span class="badge mono">Örnek gösterim</span>
      </div>
      <p class="status-all"><i class="led led-ok" aria-hidden="true"></i>Tüm sistemler çalışıyor</p>
      <ul class="status-list">
        <li><span>Çekirdek ağ</span><b><i class="led led-ok" aria-hidden="true"></i>Çalışıyor</b></li>
        <li><span>Veri merkezi</span><b><i class="led led-ok" aria-hidden="true"></i>Çalışıyor</b></li>
        <li><span>Fiber halka</span><b><i class="led led-ok" aria-hidden="true"></i>Çalışıyor</b></li>
        <li><span>Radyolink kuleleri</span><b><i class="led led-ok" aria-hidden="true"></i>Çalışıyor</b></li>
        <li><span>Üst sağlayıcı bağlantıları</span><b><i class="led led-ok" aria-hidden="true"></i>Çalışıyor</b></li>
      </ul>
      <p class="status-note">Bu pano yalnızca arayüz örneğidir; canlı veri göstermez.</p>
    </div>
  </div>
</section>
${ctaBand('Ağımıza bağlanın.', 'Barındırma, sunucu veya internet ihtiyacınız için bizimle iletişime geçin.')}`,
}));

// ---------------------------------------------------------------------------
// HAKKIMIZDA
// ---------------------------------------------------------------------------
write('hakkimizda.html', pageHtml({
  file: 'hakkimizda.html',
  title: 'Hakkımızda | CORENETWORK',
  desc: 'CORENETWORK hakkında: veri merkezi ve internet servis sağlayıcı olarak misyonumuz, vizyonumuz ve değerlerimiz.',
  bodyClass: 'page-inner',
  body: `
${hero('Hakkımızda', 'Altyapıyı güvenilir ve sorumlu biçimde işletiriz.', 'CORENETWORK, veri merkezi ve internet servis sağlayıcı olarak kurumsal müşterilerinin dijital altyapı ihtiyaçlarını uçtan uca karşılar.', '', 'violet')}
<section class="section" aria-labelledby="mis-title">
  <div class="wrap split">
    <div class="reveal">
      <p class="eyebrow mono">Misyonumuz</p>
      <h2 id="mis-title" class="h2">Verinizi ve bağlantınızı güvenle taşırız.</h2>
      <p class="lead">Müşterilerimizin donanımını, verisini ve bağlantısını güvenle taşırız. Şeffaf, ölçülebilir ve çözüm odaklı bir altyapı ortağıyız.</p>
    </div>
    <div class="reveal">
      <p class="eyebrow mono">Vizyonumuz</p>
      <h2 class="h2">Bölgenin güvenilir altyapı adresi.</h2>
      <p class="lead">Teknolojiyi yakından izler, altyapımızı sürekli geliştirir ve müşterilerimizle uzun vadeli ilişkiler kurarız.</p>
    </div>
  </div>
</section>
<section class="section section-alt" aria-labelledby="val-title">
  <div class="wrap">
    ${sectionHead('Değerlerimiz', 'Kararlarımızın dayandığı ilkeler.', '', 'val-title')}
    <div class="grid grid-3">
      ${card({ icon: 'shield', title: 'Güvenilirlik', text: 'Verdiğimiz sözün arkasında durur, altyapıyı kesintiye karşı tasarlarız.' })}
      ${card({ icon: 'eye', title: 'Şeffaflık', text: 'Sunduğumuz hizmeti ve işleyişimizi açık biçimde paylaşırız.' })}
      ${card({ icon: 'cpu', title: 'Teknik derinlik', text: 'Kabinden çekirdeğe, her katmanı bilen bir ekiple çalışırız.' })}
      ${card({ icon: 'pin', title: 'Yerellik', text: 'Size yakınız. İhtiyacınıza yerinde ve hızlı yanıt veririz.' })}
      ${card({ icon: 'users', title: 'Sorumluluk', text: 'Üstlendiğimiz her hizmetin sorumluluğunu sahipleniriz.' })}
      ${card({ icon: 'layers', title: 'Sürekli gelişim', text: 'Altyapımızı ve süreçlerimizi düzenli olarak gözden geçirir, iyileştiririz.' })}
    </div>
  </div>
</section>
<section class="section" aria-labelledby="story-title">
  <div class="wrap narrow reveal">
    <p class="eyebrow mono">Yaklaşımımız</p>
    <h2 id="story-title" class="h2">Çekirdekten başlayan bütünlük.</h2>
    <p class="lead">Adımızı, internetin ve verinin çekirdeğinde yer alma kararlılığımızdan alırız. Veri merkezinden son kullanıcı hattına uzanan altyapıyı bütün olarak yönetir, her katmanın sorumluluğunu üstleniriz.</p>
  </div>
</section>
${ctaBand('Birlikte çalışalım.', 'İhtiyacınızı iletin. Size nasıl değer katabileceğimizi netleştirelim.')}`,
}));

// ---------------------------------------------------------------------------
// SSS
// ---------------------------------------------------------------------------
const faq = [
  ['VDS ile VPS arasındaki fark nedir?', 'VPS’te fiziksel sunucunun kaynakları sanal sunucular arasında paylaşılır. VDS’te kaynaklar size ayrılır ve performans daha öngörülebilir olur. Ayrıntılar için <a href="sunucu.html#vds-vps">VDS / VPS sayfamızı</a> inceleyin.'],
  ['Co-location hizmetinde hangi seçenekler sunulur?', 'Tam kabin, yarım kabin ve U bazında barındırma seçenekleri sunarız. Uygun yerleşimi teklif sürecinde belirleriz.'],
  ['Uzaktan el hizmeti (remote hands) nedir?', 'Veri merkezine gelmeden, ekibimizden yerinde işlem talep etmenizdir: kablo değişimi, cihaz yeniden başlatma ve görsel kontrol gibi. Kapsamı teklif sürecinde belirleriz.'],
  ['Cross-connect nedir, nasıl talep edilir?', 'Kabininizin aynı tesisteki başka bir müşteriye veya servis sağlayıcıya doğrudan fiziksel bağlantıyla bağlanmasıdır. Talebinizi <a href="iletisim.html#teklif">teklif formu</a> üzerinden iletebilirsiniz.'],
  ['Fiber, xDSL ve radyolink arasında nasıl seçim yapılır?', 'Fiber, simetrik ve kararlı hat sağlar. xDSL, fiber bulunmayan bölgelerde yaygın erişim sunar. Radyolink, kablosuz noktadan noktaya bağlantıyla fiberin ulaşmadığı noktalara çözüm getirir. Adresiniz için <a href="internet.html#kapsama">kapsama sorgusu</a> yapabilirsiniz.'],
  ['Statik IP sağlıyor musunuz?', 'Evet. Statik IP seçeneklerimiz bulunur. Teklif talebinizde ihtiyacınızı belirtmeniz yeterlidir.'],
  ['Adresim için kapsama var mı?', '<a href="internet.html#kapsama">Kapsama Sorgulayın</a> formuna adresinizi yazın. Bilgilerinizi teklif formuna taşırız, ekibimiz uygunluğu değerlendirip size dönüş yapar.'],
  ['DDoS koruması neleri kapsar?', 'Sunucu hizmetlerimizde DDoS koruması bulunur. Koruma kapsamı hizmet planına göre yapılandırılır; ayrıntıları teklif sürecinde paylaşırız.'],
  ['Teklifi nasıl alırım?', '<a href="iletisim.html#teklif">Teklif formunu</a> doldurun. Ekibimiz talebinizi değerlendirir ve sizinle iletişime geçer.'],
  ['Müşteri paneline nasıl erişirim?', 'Panel bağlantısı sayfa altındaki “Müşteri Paneli” bağlantısında yer alır.'],
];

write('sss.html', pageHtml({
  file: 'sss.html',
  title: 'Sıkça Sorulan Sorular | CORENETWORK',
  desc: 'CORENETWORK hizmetleri hakkında sıkça sorulan sorular: VDS/VPS farkı, co-location, remote hands, cross-connect, fiber, xDSL ve radyolink.',
  bodyClass: 'page-inner',
  active: 'hizmetler.html',
  body: `
${hero('SSS', 'Sıkça sorulan sorular.', 'Hizmetlerimiz hakkındaki sorulara kısa ve net yanıtlar verdik.', '', 'amber')}
<section class="section" aria-label="Sorular">
  <div class="wrap narrow">
    <div class="faq">
      ${faq.map(([q, a]) => `<details class="faq-item reveal"><summary><span>${q}</span>${ico('arrow', 'ico faq-ico')}</summary><div class="faq-a"><p>${a}</p></div></details>`).join('\n      ')}
    </div>
  </div>
</section>
${ctaBand('Aradığınız yanıtı bulamadınız mı?', 'Bizimle iletişime geçin. Ekibimiz en kısa sürede dönüş yapsın.')}`,
}));

// ---------------------------------------------------------------------------
// ILETISIM
// ---------------------------------------------------------------------------
const svcOptions = [
  ['colocation', 'Co-location'], ['vds', 'VDS'], ['vps', 'VPS'], ['fiber', 'Fiber'], ['xdsl', 'xDSL'], ['radyolink', 'Radyolink'], ['diger', 'Diğer'],
];

write('iletisim.html', pageHtml({
  file: 'iletisim.html',
  title: 'İletişim ve Teklif | CORENETWORK',
  desc: 'CORENETWORK ile iletişime geçin ve teklif alın: co-location, VDS, VPS, fiber, xDSL ve radyolink hizmetleri için teklif formu.',
  bodyClass: 'page-inner',
  body: `
${hero('İletişim', 'Bizimle iletişime geçin.', 'Talebinizi iletin. İhtiyacınıza uygun çözümü belirleyip size dönüş yapalım.', '', 'cyan')}
<section class="section" aria-label="İletişim bilgileri ve teklif formu">
  <div class="wrap contact-grid">
    <aside class="contact-card reveal" aria-labelledby="ci-title">
      <h2 id="ci-title" class="h3">İletişim bilgileri</h2>
      <ul class="contact-list">
        <li>${ico('phone')}<div><span class="lbl mono">Telefon</span><a href="tel:+900000000000" data-cfg-href="phoneHref" data-cfg="phone">+90 (000) 000 00 00</a></div></li>
        <li>${ico('mail')}<div><span class="lbl mono">E-posta</span><a href="mailto:info@ornek-alanadi.com" data-cfg-href="emailHref" data-cfg="email">info@ornek-alanadi.com</a></div></li>
        <li>${ico('pin')}<div><span class="lbl mono">Adres</span><span data-cfg="address">Örnek Mahallesi, Örnek Caddesi No: 0, Örnek / Türkiye</span></div></li>
        <li>${ico('clock')}<div><span class="lbl mono">Çalışma saatleri</span><span data-cfg="workingHours">Pazartesi - Cuma, 09:00 - 18:00</span></div></li>
      </ul>
      <p class="lbl mono">Sosyal medya</p>
      <ul class="socials" data-socials>
        <li><a href="https://www.linkedin.com/company/ornek-firma" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
        <li><a href="https://x.com/ornekfirma" target="_blank" rel="noopener noreferrer">X</a></li>
        <li><a href="https://www.instagram.com/ornekfirma" target="_blank" rel="noopener noreferrer">Instagram</a></li>
      </ul>
      <a class="btn btn-ghost btn-sm" href="#" data-cfg-href="panelUrl">Müşteri Paneli</a>
    </aside>

    <div id="teklif" class="quote reveal">
      <h2 class="h2">Teklif Alın</h2>
      <p class="lead">Gereksinimlerinizi kısaca paylaşın. Ekibimiz talebinizi değerlendirir ve sizinle iletişime geçer.</p>
      <form id="quote-form" class="form" novalidate>
        <div class="field-row">
          <div class="field">
            <label for="f-ad">Ad Soyad <span class="req" aria-hidden="true">*</span></label>
            <input id="f-ad" name="adSoyad" type="text" autocomplete="name" required aria-describedby="e-ad">
            <p class="err" id="e-ad" role="alert"></p>
          </div>
          <div class="field">
            <label for="f-firma">Firma</label>
            <input id="f-firma" name="firma" type="text" autocomplete="organization">
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="f-eposta">E-posta <span class="req" aria-hidden="true">*</span></label>
            <input id="f-eposta" name="eposta" type="email" autocomplete="email" required aria-describedby="e-eposta">
            <p class="err" id="e-eposta" role="alert"></p>
          </div>
          <div class="field">
            <label for="f-tel">Telefon <span class="req" aria-hidden="true">*</span></label>
            <input id="f-tel" name="telefon" type="tel" autocomplete="tel" inputmode="tel" required aria-describedby="e-tel">
            <p class="err" id="e-tel" role="alert"></p>
          </div>
        </div>
        <fieldset class="field services" aria-describedby="e-hizmet">
          <legend>Hizmet seçimi <span class="req" aria-hidden="true">*</span></legend>
          <div class="check-grid">
            ${svcOptions.map(([v, l]) => `<label class="check"><input type="checkbox" name="hizmet" value="${v}"><span>${l}</span></label>`).join('\n            ')}
          </div>
          <p class="err" id="e-hizmet" role="alert"></p>
        </fieldset>
        <div class="field">
          <label for="f-adres">Adres <span class="hint" id="adres-hint">(internet hizmetleri için)</span></label>
          <textarea id="f-adres" name="adres" rows="2" autocomplete="street-address" aria-describedby="e-adres adres-hint"></textarea>
          <p class="err" id="e-adres" role="alert"></p>
        </div>
        <div class="field">
          <label for="f-mesaj">Mesajınız</label>
          <textarea id="f-mesaj" name="mesaj" rows="4"></textarea>
        </div>
        <div class="field hp" aria-hidden="true">
          <label for="f-web">Web sitesi</label>
          <input id="f-web" name="website" type="text" tabindex="-1" autocomplete="off">
        </div>
        <div class="field">
          <label class="check check-kvkk"><input id="f-kvkk" type="checkbox" name="kvkk" required aria-describedby="e-kvkk"><span>Kişisel verilerimin, teklif talebimin değerlendirilmesi amacıyla 6698 sayılı KVKK kapsamında işlenmesini kabul ediyorum. <span class="req" aria-hidden="true">*</span></span></label>
          <p class="err" id="e-kvkk" role="alert"></p>
        </div>
        <button class="btn btn-primary" type="submit">Teklif Talebini Gönderin ${ico('arrow', 'ico ico-sm')}</button>
        <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
      </form>
      <noscript><p class="note">Formu kullanmak için tarayıcınızda JavaScript etkin olmalıdır. Bize e-posta ile de ulaşabilirsiniz.</p></noscript>
    </div>
  </div>
</section>`,
}));

// ---------------------------------------------------------------------------
// 404 (uses a computed <base> because it is served from arbitrary paths)
// ---------------------------------------------------------------------------
const baseScript = `
  <script>
    // GitHub Pages serves this page from any missing path. Compute a base URL so that
    // relative links and assets still resolve to the site root.
    (function () {
      var p = location.pathname.split('/');
      var base = '/';
      if (/\\.github\\.io$/.test(location.hostname) && p.length > 1 && p[1]) base = '/' + p[1] + '/';
      document.write('<base href="' + base + '">');
    }());
  </script>`;

let nf = pageHtml({
  file: '404.html',
  title: 'Sayfa bulunamadı | CORENETWORK',
  desc: 'Aradığınız sayfa bulunamadı. CORENETWORK ana sayfasına dönün.',
  bodyClass: 'page-inner page-404',
  noindex: true,
  active: '',
  body: `
<section class="notfound" aria-labelledby="nf-title">
  <canvas class="accent" data-accent="amber" aria-hidden="true"></canvas>
  <div class="wrap narrow center">
    <p class="nf-code mono" aria-hidden="true">404</p>
    <h1 id="nf-title" class="h1">Sayfa bulunamadı.</h1>
    <p class="lead">Aradığınız sayfa taşınmış veya kaldırılmış olabilir.</p>
    <div class="hero-cta center">
      <a class="btn btn-primary" href="index.html">Ana Sayfa</a>
      <a class="btn btn-ghost" href="hizmetler.html">${BTN_SERVICES}</a>
      <a class="btn btn-ghost" href="iletisim.html">Bizimle İletişime Geçin</a>
    </div>
  </div>
</section>`,
});
nf = nf.replace('<meta charset="utf-8">', '<meta charset="utf-8">' + baseScript);
write('404.html', nf);
