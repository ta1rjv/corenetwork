# corenetwork

Multi-page Turkish corporate site for CORENETWORK (data center + ISP).
Static site; serve locally with `python -m http.server`.

## Demo panels

The site includes a DEMO customer panel and a DEMO admin panel (Turkish UI). They are client-side only: there is no backend, no real authentication and no real data. All numbers are sample data labeled "Örnek veri".

- Entry URL: `giris.html` (also the "Panel" button in the site header).
- Demo credentials (prefilled on the page): customer `musteri@demo.local` / `demo`, admin `yonetici@demo.local` / `demo`. "Demo olarak gir" signs in with one click.
- Pages: `musteri-paneli.html` (customer), `yonetim-paneli.html` (admin). Both are marked `noindex`.
- Data lives in the browser localStorage (key `corenetwork-demo:v1`) and is shared by both panels, so a ticket opened in the customer panel shows up in the admin panel (also across tabs). The "Demo verilerini sıfırla" button restores the seed data.
- Code: `js/demo-store.js` (the only data interface, async functions), `js/demo-data.js` (seed data and entity shapes), `js/demo-auth.js` (session flag), `js/panel-*.js`, `css/panel.css`.
