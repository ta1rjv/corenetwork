// Demo admin (management) panel. Client-side demo only (see demo-store.js / demo-auth.js).
// All data comes from the async store interface; nothing here touches localStorage.
import * as store from './demo-store.js';
import {
  h, createApp, pageHead, backLink, card, cardX, chartCard, lineChart, barChart, meter, dl, table, badge, sampleTag, kpiTile, icon, threadView,
  emptyState, field, option, money, num, fmtDate, fmtDateTime, LABELS, toast,
} from './panel-ui.js';

const months = ['5 ay önce', '', '', '', '', 'bu ay'];

// ------------------------------------------------------------ dashboard ----
async function dashboard(_a, { main }) {
  const m = await store.getMetrics();
  const prev = m.revenue6[m.revenue6.length - 2];
  const growth = ((m.mrr - prev) / prev) * 100;
  const tiles = {
    cust: kpiTile({ label: 'Müşteri sayısı', value: String(m.customers), sub: `${m.activeCustomers} aktif`, delta: { text: '+1 geçen aya göre', tone: 'up' }, spark: [4, 4, 5, 5, 5, 6] }),
    mrr: kpiTile({ label: 'Aylık yinelenen gelir', value: money(m.mrr), delta: { text: `${growth >= 0 ? '+' : ''}${num(growth, 1)}% geçen aya göre`, tone: growth >= 0 ? 'up' : 'down' }, spark: m.revenue6 }),
    tix: kpiTile({ label: 'Açık destek talebi', value: String(m.openTickets), sub: `${m.pendingOrders} bekleyen sipariş`, href: '#/destek', spark: [3, 5, 4, 6, 5, m.openTickets] }),
    rack: kpiTile({ label: 'Raf doluluğu', value: `%${m.rackOccupancyPct}`, delta: { text: '+2 puan geçen aya göre', tone: 'flat' }, spark: [48, 49, 51, 52, 53, m.rackOccupancyPct] }),
  };
  const upVal = h('span', { class: 'big-val' }), pwVal = h('span', { class: 'big-val' });
  const upChart = lineChart([{ name: 'Uplink', values: m.uplinkHistory }], { unit: '%', max: 100, labels: ['~90 sn önce', 'şimdi'], desc: 'Uplink kullanımı yüzdesi, canlı simülasyon' });
  const pwChart = lineChart([{ name: 'Güç', values: m.powerHistory }], { unit: 'kW', labels: ['~90 sn önce', 'şimdi'], desc: 'Toplam IT gücü, canlı simülasyon' });
  const tixBox = h('div');
  const paint = (d) => {
    tiles.cust.update({ value: String(d.customers) });
    tiles.mrr.update({ value: money(d.mrr) });
    tiles.tix.update({ value: String(d.openTickets) });
    tiles.rack.update({ value: `%${d.rackOccupancyPct}` });
    upVal.textContent = `%${num(d.uplinkPct, 1)}`;
    pwVal.textContent = `${num(d.powerKw, 1)} kW`;
    upChart.update([{ name: 'Uplink', values: d.uplinkHistory }]);
    pwChart.update([{ name: 'Güç', values: d.powerHistory }]);
    const total = d.ticketsByStatus.reduce((a, b) => a + b.count, 0) || 1;
    tixBox.replaceChildren(...d.ticketsByStatus.map((s) => meter((s.count / total) * 100, LABELS.ticket[s.status])));
  };
  paint(m);
  const note = h('div', { class: 'chart-note' }, sampleTag(), h('span', null, 'Canlı simülasyon, 3 saniyede bir güncellenir'));
  main.append(pageHead('Gösterge paneli', 'Operasyonun anlık özeti. Tüm değerler örnek veridir.'),
    h('div', { class: 'grid-kpi' }, tiles.cust, tiles.mrr, tiles.tix, tiles.rack),
    h('div', { class: 'grid-cards' },
      cardX('Uplink kullanımı', 'İlk 3 hat ortalaması', upVal, upChart, note),
      cardX('Toplam IT gücü', 'Tüm raflar', pwVal, pwChart, note.cloneNode(true))),
    h('div', { class: 'grid-cards' },
      chartCard('Aylık yinelenen gelir', barChart(m.revenue6.map((v) => Math.round(v / 1000)), months, { unit: 'bin TL', desc: 'Aylık yinelenen gelir, son 6 ay', color: '#19e0ff' }), null, 'Son 6 ay'),
      cardX('Destek talepleri', 'Durum dağılımı', null, tixBox, h('div', { class: 'chart-note' }, sampleTag()))));
  const timer = setInterval(async () => { if (!document.hidden) paint(await store.getMetrics()); }, 3000);
  return () => clearInterval(timer);
}

// ------------------------------------------------------------ customers ----
let custQuery = '';
let custStatus = '';

async function customers(args, { main }) {
  if (args[0]) {
    const [c, svcs, invs, tix] = await Promise.all([store.getCustomer(args[0]).catch(() => null), store.listServices({ customerId: args[0] }), store.listInvoices({ customerId: args[0] }), store.listTickets({ customerId: args[0] })]);
    if (!c) { main.append(backLink('#/musteriler', 'Müşteriler'), emptyState('Müşteri bulunamadı.')); return; }
    const suspended = c.status === 'suspended';
    main.append(backLink('#/musteriler', 'Müşteriler'),
      pageHead(c.name, `${c.city} - ${c.plan} plan`, badge(c.status, LABELS.customer[c.status]),
        h('button', { class: suspended ? 'btn btn-primary btn-sm' : 'btn btn-danger btn-sm', type: 'button', onclick: () => store.setCustomerStatus(c.id, suspended ? 'active' : 'suspended') }, suspended ? 'Etkinleştir' : 'Askıya al')),
      h('div', { class: 'grid-cards' },
        card('Bilgiler', dl([['Şehir', c.city], ['Müşteri olma tarihi', fmtDate(c.since)], ['Plan', c.plan], ['Yetkili', c.profile.contactName], ['E-posta', c.profile.email], ['Telefon', c.profile.phone]])),
        card('Hizmetler', svcs.length ? h('div', { class: 'list' }, svcs.map((s) => h('div', { class: 'list-item' }, h('div', null, h('p', null, s.name), h('p', { class: 'sub' }, `${LABELS.serviceType[s.type]} - ${money(s.mrr)}/ay`)), badge(s.status, LABELS.service[s.status])))) : emptyState('Hizmet yok.')),
        card('Faturalar', invs.length ? h('div', { class: 'list' }, invs.map((i) => h('div', { class: 'list-item' }, h('span', null, `${i.no} - ${money(i.total)}`), badge(i.status, LABELS.invoice[i.status])))) : emptyState('Fatura yok.')),
        card('Destek talepleri', tix.length ? h('div', { class: 'list' }, tix.map((t) => h('a', { class: 'list-item', href: `#/destek/${t.id}` }, h('span', null, t.subject), badge(t.status, LABELS.ticket[t.status])))) : emptyState('Talep yok.'))),
      sampleTag());
    return;
  }
  const all = await store.listCustomers();
  const [svcs] = await Promise.all([store.listServices()]);
  const q = h('input', { type: 'search', value: custQuery, placeholder: 'Ad, şehir veya e-posta' });
  const st = h('select', null, option('', 'Tümü', !custStatus), option('active', 'Aktif', custStatus === 'active'), option('suspended', 'Askıda', custStatus === 'suspended'));
  const body = h('div');
  const draw = () => {
    custQuery = q.value; custStatus = st.value;
    const needle = q.value.trim().toLowerCase();
    const rows = all.filter((c) => (!st.value || c.status === st.value) && (!needle || `${c.name} ${c.city} ${c.profile.email}`.toLowerCase().includes(needle)));
    body.replaceChildren(rows.length ? table(['Müşteri', 'Şehir', 'Plan', 'Hizmet', 'Durum', ''], rows.map((c) => [
      h('a', { href: `#/musteriler/${c.id}` }, c.name), c.city, c.plan, String(svcs.filter((s) => s.customerId === c.id).length), badge(c.status, LABELS.customer[c.status]),
      h('button', { class: c.status === 'active' ? 'btn btn-danger btn-sm' : 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.setCustomerStatus(c.id, c.status === 'active' ? 'suspended' : 'active') }, c.status === 'active' ? 'Askıya al' : 'Etkinleştir')]), 'Müşteriler') : emptyState('Sonuç yok.'));
  };
  q.addEventListener('input', draw);
  st.addEventListener('change', draw);
  draw();
  main.append(pageHead('Müşteriler', 'Müşteri hesapları, durumları ve hizmet sayıları.'), h('div', { class: 'filters filters-bar' }, field('Ara', q), field('Durum', st)), body);
}

// --------------------------------------------------------------- orders ----
async function orders(_a, { main }) {
  const [list, svcs, custs] = await Promise.all([store.listOrders(), store.listServices(), store.listCustomers()]);
  const name = (id) => (custs.find((c) => c.id === id) || { name: id }).name;
  const pending = list.filter((o) => o.status === 'pending');
  const done = list.filter((o) => o.status !== 'pending');
  main.append(pageHead('Siparişler / Hizmetler', 'Bekleyen siparişleri onaylayın veya reddedin; onaylanan sipariş hizmet olarak oluşturulur.'),
    card('Bekleyen siparişler', pending.length ? table(['Müşteri', 'Hizmet', '>Aylık', 'Tarih', 'Not', ''], pending.map((o) => [
      name(o.customerId), o.title, money(o.mrr), fmtDate(o.createdAt), o.note || '-',
      h('span', { class: 'row' }, h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await store.approveOrder(o.id); toast('Sipariş onaylandı, hizmet oluşturuldu.'); } }, 'Onayla'),
        h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: async () => { await store.rejectOrder(o.id); toast('Sipariş reddedildi.'); } }, 'Reddet'))]), 'Bekleyen siparişler') : emptyState('Bekleyen sipariş yok.')),
    card('Geçmiş siparişler', done.length ? table(['Müşteri', 'Hizmet', 'Tarih', 'Durum'], done.map((o) => [name(o.customerId), o.title, fmtDate(o.createdAt), badge(o.status, LABELS.order[o.status])]), 'Geçmiş siparişler') : emptyState('Kayıt yok.')),
    card(`Tüm hizmetler (${svcs.length})`, table(['Müşteri', 'Hizmet', 'Tür', '>Aylık', 'Durum'], svcs.map((s) => [name(s.customerId), s.name, LABELS.serviceType[s.type], money(s.mrr), badge(s.status, LABELS.service[s.status])]), 'Hizmetler')));
}

// ------------------------------------------------------------- invoices ----
let invStatus = '';
let invCustomer = '';

async function invoices(_a, { main }) {
  const [list, custs] = await Promise.all([store.listInvoices(), store.listCustomers()]);
  const name = (id) => (custs.find((c) => c.id === id) || { name: id }).name;
  const st = h('select', null, option('', 'Tümü', !invStatus), option('paid', 'Ödendi', invStatus === 'paid'), option('unpaid', 'Ödenmedi', invStatus === 'unpaid'), option('overdue', 'Gecikmiş', invStatus === 'overdue'));
  const cu = h('select', null, option('', 'Tümü', !invCustomer), custs.map((c) => option(c.id, c.name, invCustomer === c.id)));
  const body = h('div');
  const draw = () => {
    invStatus = st.value; invCustomer = cu.value;
    const rows = list.filter((i) => (!st.value || i.status === st.value) && (!cu.value || i.customerId === cu.value));
    body.replaceChildren(rows.length ? table(['Fatura no', 'Müşteri', 'Tarih', 'Son ödeme', '>Tutar', 'Durum', ''], rows.map((i) => [
      i.no, name(i.customerId), fmtDate(i.issuedAt), fmtDate(i.dueAt), money(i.total), badge(i.status, LABELS.invoice[i.status]),
      i.status !== 'paid' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => { await store.payInvoice(i.id); toast(`${i.no} ödendi olarak işaretlendi.`); } }, 'Ödendi işaretle') : null]), 'Faturalar') : emptyState('Sonuç yok.'));
  };
  st.addEventListener('change', draw);
  cu.addEventListener('change', draw);
  draw();

  const fc = h('select', null, custs.map((c) => option(c.id, c.name)));
  const fd = h('input', { type: 'text', maxlength: 120, required: true });
  const fa = h('input', { type: 'number', min: '1', step: '1', required: true });
  const due = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const fdue = h('input', { type: 'date', value: due, required: true });
  const err = h('p', { class: 'err', role: 'alert' });
  const form = h('form', { class: 'panel-form', novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const amount = Number(fa.value);
    if (!fd.value.trim() || !(amount > 0) || !fdue.value) { err.textContent = 'Açıklama, pozitif tutar ve son ödeme tarihi zorunludur.'; return; }
    await store.createInvoice({ customerId: fc.value, desc: fd.value.trim(), amount, dueAt: new Date(fdue.value).toISOString() });
    toast('Fatura oluşturuldu.');
  } }, field('Müşteri', fc), field('Açıklama', fd), h('div', { class: 'filters' }, field('Tutar (TL)', fa), field('Son ödeme tarihi', fdue)), err,
    h('div', null, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Fatura oluştur')));
  main.append(pageHead('Faturalar', 'Fatura listesi, ödeme durumları ve yeni fatura oluşturma.'), h('div', { class: 'filters filters-bar' }, field('Durum', st), field('Müşteri', cu)), body, card('Yeni fatura', form));
}

// -------------------------------------------------------------- tickets ----
let tixStatus = '';

async function tickets(args, { main }) {
  const custs = await store.listCustomers();
  const name = (id) => (custs.find((c) => c.id === id) || { name: id }).name;
  if (args[0]) {
    const t = await store.getTicket(args[0]).catch(() => null);
    if (!t) { main.append(backLink('#/destek', 'Destek talepleri'), emptyState('Talep bulunamadı.')); return; }
    const text = h('textarea', { rows: 4, maxlength: 2000 });
    const err = h('p', { class: 'err', role: 'alert' });
    const stSel = h('select', { onchange: async (e) => { await store.setTicketStatus(t.id, e.target.value); toast('Durum güncellendi.'); } },
      ['open', 'answered', 'closed'].map((k) => option(k, LABELS.ticket[k], t.status === k)));
    main.append(backLink('#/destek', 'Destek talepleri'), pageHead(t.subject, `${name(t.customerId)} - ${t.dept} - Öncelik: ${LABELS.priority[t.priority]} - ${fmtDateTime(t.createdAt)}`, badge(t.status, LABELS.ticket[t.status])),
      card('Yazışma', threadView(t.messages, { customer: name(t.customerId), admin: 'Destek ekibi' })),
      card('Yanıt', h('form', { class: 'panel-form', novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (!text.value.trim()) { err.textContent = 'Yanıt boş olamaz.'; return; }
        await store.replyTicket(t.id, 'admin', text.value.trim());
        toast('Yanıt gönderildi.');
      } }, field('Yanıt', text), err, h('div', { class: 'filters' }, h('div', null, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Yanıtla')), field('Durum', stSel),
        t.status !== 'closed' ? h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.setTicketStatus(t.id, 'closed') }, 'Talebi kapat') : null))));
    return;
  }
  const list = await store.listTickets();
  const st = h('select', null, option('', 'Tümü', !tixStatus), ['open', 'answered', 'closed'].map((k) => option(k, LABELS.ticket[k], tixStatus === k)));
  const body = h('div');
  const draw = () => {
    tixStatus = st.value;
    const rows = list.filter((t) => !st.value || t.status === st.value);
    body.replaceChildren(rows.length ? table(['Konu', 'Müşteri', 'Departman', 'Öncelik', 'Durum', 'Güncelleme'], rows.map((t) => [
      h('a', { href: `#/destek/${t.id}` }, t.subject), name(t.customerId), t.dept, LABELS.priority[t.priority], badge(t.status, LABELS.ticket[t.status]), fmtDateTime(t.updatedAt)]), 'Destek talepleri') : emptyState('Talep yok.'));
  };
  st.addEventListener('change', draw);
  draw();
  main.append(pageHead('Destek talepleri', 'Müşteri talepleri; yanıtlayın, durumu güncelleyin veya kapatın.'), h('div', { class: 'filters filters-bar' }, field('Durum', st)), body);
}

// ---------------------------------------------------------- infrastructure ----
async function infra(_a, { main }) {
  const [racks, links, alarms] = await Promise.all([store.listRacks(), store.listLinks(), store.listAlarms()]);
  const rackNodes = racks.map((r) => ({ r, kw: h('span'), t: h('span') }));
  const jitter = () => rackNodes.forEach((n) => {
    n.kw.textContent = `${num(Math.max(0, n.r.powerKw + (Math.random() - 0.5) * 0.3), 1)} kW`;
    n.t.textContent = `${num(n.r.tempC + (Math.random() - 0.5) * 0.6, 1)} °C`;
  });
  jitter();
  const open = alarms.filter((a) => !a.acked);
  main.append(pageHead('Altyapı izleme', 'Raf, ağ hattı ve alarm durumu. Değerler canlı simülasyondur (örnek veri).'),
    h('div', { class: 'rack-grid' }, rackNodes.map(({ r, kw, t }) => h('section', { class: 'rack-card' },
      h('h3', null, h('span', { class: 'row' }, icon('rack'), `Raf ${r.id}`), badge(r.tempC >= 26 ? 'warning' : 'up', r.tempC >= 26 ? 'Uyarı' : 'Normal')),
      meter((r.usedU / r.totalU) * 100, 'Doluluk'), dl([['Kullanılan', `${r.usedU}/${r.totalU}U`], ['Güç', kw], ['Sıcaklık', t]])))),
    card('Ağ bağlantıları', table(['Hat', '>Kapasite', 'Kullanım', 'Durum'], links.map((l) => [l.name, `${l.capacityGbps} Gbps`, meter(l.usagePct, 'Kullanım'), badge(l.status, LABELS.link[l.status])]), 'Ağ bağlantıları')),
    card(`Alarmlar (${open.length} onaylanmamış)`, alarms.length ? table(['Önem', 'Kaynak', 'Mesaj', 'Zaman', ''], alarms.map((a) => [
      badge(a.severity, LABELS.severity[a.severity]), a.source, a.text, fmtDateTime(a.at),
      a.acked ? badge('closed', 'Onaylandı') : h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.ackAlarm(a.id) }, 'Onayla')]), 'Alarmlar') : emptyState('Alarm yok.')));
  const timer = setInterval(() => { if (!document.hidden) jitter(); }, 3000);
  return () => clearInterval(timer);
}

// -------------------------------------------------------- announcements ----
async function announcements(_a, { main }) {
  const list = await store.listAnnouncements();
  const title = h('input', { type: 'text', maxlength: 120, required: true });
  const text = h('textarea', { rows: 4, maxlength: 1000, required: true });
  const err = h('p', { class: 'err', role: 'alert' });
  main.append(pageHead('Duyurular', 'Yayınladığınız duyurular müşteri panelinde görünür.'),
    card('Yeni duyuru', h('form', { class: 'panel-form', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      if (!title.value.trim() || !text.value.trim()) { err.textContent = 'Başlık ve metin zorunludur.'; return; }
      await store.createAnnouncement({ title: title.value.trim(), text: text.value.trim() });
      toast('Duyuru yayınlandı; müşteri panelinde görünür.');
    } }, field('Başlık', title), field('Metin', text), err, h('div', null, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Yayınla')))),
    card('Yayındaki duyurular', list.length ? h('div', { class: 'list' }, list.map((a) => h('div', { class: 'list-item' },
      h('div', null, h('p', null, h('strong', null, a.title)), h('p', { class: 'sub' }, a.text), h('p', { class: 'sub' }, fmtDate(a.createdAt))),
      h('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => store.deleteAnnouncement(a.id) }, 'Sil')))) : emptyState('Duyuru yok.')));
}

// ---------------------------------------------------------- integrations ----
// Placeholder cards only: no integration exists yet (planned, see docs/DECISIONS.md D6).
async function integrations(_a, { main }) {
  const item = (ico, title, text) => h('section', { class: 'pcard' },
    h('div', { class: 'pcard-head' }, h('div', { class: 'row' }, h('span', { class: 'integ-ico' }, icon(ico)), h('h3', { class: 'pcard-h' }, title)), badge('closed', 'Bağlı değil (demo)')),
    h('p', { class: 'sub' }, text));
  main.append(pageHead('Entegrasyonlar', 'Dış sistem bağlantıları. Bu demoda hiçbir entegrasyon etkin değildir.'),
    h('div', { class: 'integ-grid' },
      item('receipt', 'WHMCS', 'Faturalama, müşteri kayıtları ve destek talebi yönetimi için planlanan entegrasyon.'),
      item('server', 'Proxmox VE', 'VDS siparişlerinin otomatik kurulumu için planlanan entegrasyon.')));
}

const shell = {
  groups: [
    { cap: 'Genel', items: [{ route: 'gosterge', label: 'Gösterge paneli', icon: 'grid' }] },
    { cap: 'Müşteri yönetimi', items: [
      { route: 'musteriler', label: 'Müşteriler', icon: 'users' }, { route: 'siparisler', label: 'Siparişler / Hizmetler', icon: 'inbox' },
      { route: 'faturalar', label: 'Faturalar', icon: 'receipt' }, { route: 'destek', label: 'Destek talepleri', icon: 'chat' }] },
    { cap: 'Altyapı', items: [{ route: 'altyapi', label: 'Altyapı izleme', icon: 'pulse' }, { route: 'entegrasyonlar', label: 'Entegrasyonlar', icon: 'plug' }] },
    { cap: 'İletişim', items: [{ route: 'duyurular', label: 'Duyurular', icon: 'megaphone' }] },
  ],
  user: { name: 'Yönetici', email: 'yonetici@demo.local' },
  // Bell items: unacknowledged alarms and pending orders.
  notify: async () => {
    const [alarms, orders] = await Promise.all([store.listAlarms(), store.listOrders({ status: 'pending' })]);
    return [...alarms.filter((a) => !a.acked).map((a) => ({ text: `Alarm: ${a.source} - ${a.text}`, href: '#/altyapi' })),
      ...orders.map((o) => ({ text: `Bekleyen sipariş: ${o.title}`, href: '#/siparisler' }))];
  },
};

createApp({ role: 'admin', defaultRoute: 'gosterge', shell, routes: { gosterge: dashboard, musteriler: customers, siparisler: orders, faturalar: invoices, destek: tickets, altyapi: infra, entegrasyonlar: integrations, duyurular: announcements } });
