# Decisions

- D1: Same stack as ta1rjv.github.io (Three.js + GLSL + GSAP + Lenis, static, no build). User delegated choice.
- D2: Turkish-only site copy (user request).
- D3: Quote request via "Teklif Al" form, no public prices (user request).
- D4: Deploy as separate repo ta1rjv/corenetwork served at ta1rjv.github.io/corenetwork/ (user request).
- D5: Client-side DEMO panels (customer and admin) with seed data in browser localStorage, no backend (user request, 2026-10-23). The demo is client-side only and is not authentication; a later migration to a real server-side application is planned. The async function interface of js/demo-store.js (plus js/demo-auth.js for the session) is the intended replacement seam: panel modules never touch localStorage directly, so the store can be swapped for HTTP calls with the same function names and the entity shapes documented in js/demo-data.js. No API client or mock server is built now.
- D6: PLANNED (not implemented): WHMCS integration for billing/clients/tickets and Proxmox VE provisioning for automatic VDS orders (2026-10-23). The seam is the js/demo-store.js function interface plus the nullable external reference fields (whmcsClientId, whmcsServiceId, whmcsOrderId, whmcsInvoiceId, whmcsTicketId, whmcsAnnouncementId, vds provisioning {provider, node, vmid, status}) documented in js/demo-data.js. WHMCS and Proxmox credentials must live only on a server-side backend; the browser never holds them. The Entegrasyonlar admin view is a static placeholder.
