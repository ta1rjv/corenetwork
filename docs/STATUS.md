# Status

Phase: VALIDATION (branch wip/panels, not merged into main)
- Site: IMPLEMENTED (10 pages, home 3D descent, corporate logo, Turkish copy, quote form). Contact details in js/config.js are PLACEHOLDERS.
- Demo panels: IMPLEMENTED (D5). giris.html, musteri-paneli.html, yonetim-paneli.html; data layer js/demo-store.js (async, localStorage, in-memory fallback); auth flag js/demo-auth.js; "Panel" button in the header via tools/build-pages.mjs.
- Verified on 2026-10-23 (headless Chromium via Playwright, python http.server): all panel routes at 1280x800 and 375x812 with no horizontal overflow and no console errors; login guard and logout; customer creates ticket -> admin sees it; admin reply, announcement, order approval and customer suspension reach the customer panel (cross-tab via storage event); invoice pay; VDS stop simulation; reset button; live dashboard values change.
- NOT TESTED: Firefox/Safari, real mobile devices, localStorage-blocked browsers (code path exists, untested), keyboard-only walkthrough and screen readers (buttons/labels used, not audited), independent code review of the panels.
- Earlier review of the original site: first review REJECTED (1 MAJOR, fixed); re-review NOT RUN.
- Deployment: GitHub Pages serves main at https://ta1rjv.github.io/corenetwork/; the panels reach it only after wip/panels is merged.
