// Demo customer panel. Client-side demo only (see demo-store.js / demo-auth.js).
// All data comes from the async store interface; nothing here touches localStorage.
import * as store from './demo-store.js';
import {
  h, createApp, pageHead, backLink, card, cardX, chartCard, lineChart, barChart, meter, dl, table, badge, kpiTile, avatar,
  emptyState, sampleTag, threadView, field, option, money, num, fmtDate, fmtDateTime, LABELS, toast,
} from './panel-ui.js';

const CID = store.DEMO_CUSTOMER_ID;
const transient = new Map(); // serviceId -> label while a simulated power action runs
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const hours24 = Array.from({ length: 24 }, (_, i) => (i % 6 === 0 ? `${String(i).padStart(2, '0')}:00` : ''));

function suspendedNotice(customer) {
  return customer.status === 'suspended'
    ? h('p', { class: 'notice', role: 'alert' }, 'Hesabınız yönetici tarafından askıya alındı (demo). Hizmet işlemleri devre dışıdır.')
    : document.createDocumentFragment();
}

// ---------------------------------------------------------------- views ----
async function overview(_a, { main }) {
  const [customer, services, tickets, invoices, anns, usage, orders] = await Promise.all([
    store.getCustomer(CID), store.listServices({ customerId: CID }), store.listTickets({ customerId: CID }),
    store.listInvoices({ customerId: CID }), store.listAnnouncements(), store.getUsage(CID), store.listOrders({ customerId: CID }),
  ]);
  const openTickets = tickets.filter((t) => t.status !== 'closed');
  const unpaid = invoices.filter((i) => i.status !== 'paid');
  const owed = unpaid.reduce((s, i) => s + i.total, 0);
  main.append(
    pageHead('Genel bakış', `${customer.name} hesabınızın özeti.`),
    suspendedNotice(customer),
    h('div', { class: 'grid-kpi' },
      kpiTile({ label: 'Aktif hizmet', value: String(services.filter((s) => s.status === 'active').length), sub: `${services.length} hizmet`, spark: [2, 2, 3, 3, 3, 3], href: '#/hizmetler' }),
      kpiTile({ label: 'Açık destek talebi', value: String(openTickets.length), delta: { text: 'Son 30 günde 2 talep', tone: 'flat' }, href: '#/destek' }),
      kpiTile({ label: 'Ödenmemiş fatura', value: String(unpaid.length), sub: `Toplam ${money(owed)}`, href: '#/faturalar' }),
      kpiTile({ label: 'Bekleyen sipariş', value: String(orders.filter((o) => o.status === 'pending').length), href: '#/hizmetler' })),
    h('div', { class: 'grid-cards' },
      card('Duyurular', anns.length ? h('div', { class: 'list' }, anns.slice(0, 3).map((a) =>
        h('div', { class: 'list-item' }, h('div', null, h('p', null, h('strong', null, a.title)), h('p', { class: 'sub' }, a.text)), h('span', { class: 'sub' }, fmtDate(a.createdAt))))) : emptyState('Duyuru yok.')),
      card('Açık destek talepleri', openTickets.length ? h('div', { class: 'list' }, openTickets.map((t) =>
        h('a', { class: 'list-item', href: `#/destek/${t.id}` }, h('span', null, t.subject), badge(t.status, LABELS.ticket[t.status])))) : emptyState('Açık talep yok.')),
      card('Ödenmemiş faturalar', unpaid.length ? h('div', { class: 'list' }, unpaid.map((i) =>
        h('a', { class: 'list-item', href: `#/faturalar/${i.id}` }, h('span', null, `${i.no} - ${money(i.total)}`), badge(i.status, LABELS.invoice[i.status])))) : emptyState('Ödenmemiş fatura yok.'))),
    h('div', { class: 'grid-cards' },
      chartCard('Bant genişliği (son 24 saat)', lineChart([{ name: 'Mbps', values: usage.bandwidth24 }], { unit: 'Mbps', labels: ['24 sa önce', 'şimdi'], desc: 'Son 24 saat bant genişliği kullanımı' })),
      chartCard('Co-location güç tüketimi (son 24 saat)', lineChart([{ name: 'kW', values: usage.power24 }], { unit: 'kW', labels: ['24 sa önce', 'şimdi'], desc: 'Son 24 saat güç tüketimi' }))),
  );
}

async function powerAction(svc, kind) {
  const labels = { start: 'Başlatılıyor...', stop: 'Durduruluyor...', restart: 'Yeniden başlatılıyor...' };
  transient.set(svc.id, labels[kind]);
  await refresh();
  await delay(kind === 'restart' ? 2200 : 1500);
  transient.delete(svc.id);
  await store.setPowerState(svc.id, kind === 'stop' ? 'stopped' : 'running');
  toast(`${svc.name}: ${kind === 'stop' ? 'durduruldu' : kind === 'start' ? 'başlatıldı' : 'yeniden başlatıldı'} (simülasyon).`);
}

let refresh = async () => {};

function vdsDetail(svc, customer) {
  const v = svc.vds;
  const busy = transient.get(svc.id);
  const running = v.power === 'running';
  const locked = !!busy || customer.status === 'suspended' || svc.status !== 'active';
  const btn = (text, kind, enabled) => h('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: locked || !enabled, onclick: () => powerAction(svc, kind) }, text);
  const usage = running && !busy ? v.usage : { cpu: 0, ram: 0, disk: v.usage.disk };
  return [
    card('Durum ve işlemler',
      h('p', { class: 'power-state' }, h('span', { class: `dot ${busy ? 'busy' : running ? 'on' : ''}` }), h('strong', null, busy || LABELS.power[v.power])),
      h('div', { class: 'row mt' }, btn('Başlat', 'start', !running), btn('Durdur', 'stop', running), btn('Yeniden başlat', 'restart', running)),
      h('p', { class: 'sub mt' }, 'İşlemler simülasyondur; gerçek sunucu etkilenmez.')),
    card('Bilgiler', dl([['IP adresi', h('span', { class: 'mono' }, v.ip)], ['İşletim sistemi', v.os], ['vCPU', String(v.vcpu)], ['RAM', `${v.ramGb} GB`], ['Disk', `${v.diskGb} GB`]])),
    card('Kullanım', busy ? h('div', { class: 'stack', 'aria-busy': 'true' }, h('div', { class: 'skeleton', style: 'height:14px' }), h('div', { class: 'skeleton', style: 'height:14px' }), h('div', { class: 'skeleton', style: 'height:14px' })) : [meter(usage.cpu, 'CPU'), meter(usage.ram, 'RAM'), meter(usage.disk, 'Disk')], h('div', { class: 'chart-note' }, sampleTag())),
  ];
}

function internetDetail(svc) {
  const n = svc.internet;
  const total = n.dailyGb.reduce((a, b) => a + b, 0);
  return [
    card('Hat durumu',
      h('p', null, badge(n.lineState, n.lineState === 'up' ? 'Hat aktif' : 'Hat kapalı')),
      dl([['İndirme', `${n.downMbps} Mbps`], ['Yükleme', `${n.upMbps} Mbps`], ['IP bloğu', h('span', { class: 'mono' }, n.ip)], ['Çalışma süresi', `%${num(n.uptimePct, 2)}`]]),
      h('div', { class: 'chart-note mt' }, sampleTag())),
    chartCard(`Aylık trafik (toplam ${num(total)} GB)`, barChart(n.dailyGb, n.dailyGb.map((_, i) => (i % 5 === 0 ? String(i + 1) : '')), { unit: 'GB/gün', desc: 'Günlük trafik, son 30 gün' })),
  ];
}

async function coloDetail(svc) {
  const c = svc.colo;
  const usage = await store.getUsage(CID);
  return [
    card('Raf bilgisi', dl([['Raf', c.rackId], ['Kullanılan alan', `${c.units}U`], ['Güç', `${num(c.powerKw, 1)} kW`]]), h('div', { class: 'chart-note mt' }, sampleTag())),
    chartCard('Güç tüketimi (son 24 saat)', lineChart([{ name: 'kW', values: usage.power24 }], { unit: 'kW', labels: ['24 sa önce', 'şimdi'], desc: 'Güç tüketimi' })),
  ];
}

async function services(args, { main, render }) {
  refresh = () => render();
  const customer = await store.getCustomer(CID);
  if (args[0]) {
    const svc = await store.getService(args[0]).catch(() => null);
    if (!svc || svc.customerId !== CID) { main.append(backLink('#/hizmetler', 'Hizmetlerim'), emptyState('Hizmet bulunamadı.')); return; }
    const parts = svc.type === 'vds' ? vdsDetail(svc, customer) : svc.type === 'internet' ? internetDetail(svc) : await coloDetail(svc);
    main.append(backLink('#/hizmetler', 'Hizmetlerim'), pageHead(svc.name, `${LABELS.serviceType[svc.type]} hizmeti`, badge(svc.status, LABELS.service[svc.status])), suspendedNotice(customer),
      h('div', { class: 'grid-cards' }, parts), h('p', { class: 'sub' }, `Aylık ücret: ${money(svc.mrr)} (örnek)`));
    return;
  }
  const [list, orders] = await Promise.all([store.listServices({ customerId: CID }), store.listOrders({ customerId: CID })]);
  const typeSel = h('select', null, option('vds', 'VDS / VPS sunucu'), option('colo', 'Co-location'), option('internet', 'İnternet (fiber / radyolink)'));
  const note = h('textarea', { rows: 3, maxlength: 500 });
  const form = h('form', { class: 'panel-form', onsubmit: async (e) => {
    e.preventDefault();
    const titles = { vds: 'VDS Orta (yeni)', colo: 'Co-location - Çeyrek Raf (yeni)', internet: 'Fiber İnternet (yeni hat)' };
    const plans = { vds: 'vds-medium', colo: 'colo-quarter', internet: 'fiber-500' };
    const mrr = { vds: 1450, colo: 11200, internet: 3200 };
    await store.createOrder({ customerId: CID, type: typeSel.value, title: titles[typeSel.value], plan: plans[typeSel.value], mrr: mrr[typeSel.value], note: note.value.trim() });
    toast('Sipariş talebiniz iletildi (demo).');
  } }, field('Hizmet türü', typeSel), field('Not (isteğe bağlı)', note), h('div', null, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Talep gönder')));
  main.append(pageHead('Hizmetlerim', 'Aktif hizmetleriniz ve sipariş talepleriniz.'), suspendedNotice(customer),
    h('div', { class: 'list' }, list.map((s) =>
      h('a', { class: 'list-item', href: `#/hizmetler/${s.id}` },
        h('div', { class: 'row' }, h('span', { class: 'svc-ico', 'aria-hidden': 'true' }, ({ colo: 'CO', vds: 'VDS', internet: 'NET' })[s.type]), h('div', null, h('p', null, h('strong', null, s.name)), h('p', { class: 'sub' }, `${LABELS.serviceType[s.type]} - ${money(s.mrr)}/ay`))),
        badge(s.status, LABELS.service[s.status])))),
    card('Siparişlerim', orders.length ? h('div', { class: 'list' }, orders.map((o) =>
      h('div', { class: 'list-item' }, h('div', null, h('p', null, o.title), h('p', { class: 'sub' }, fmtDate(o.createdAt))), badge(o.status, LABELS.order[o.status])))) : emptyState('Sipariş yok.')),
    card('Yeni hizmet talep et', form));
}

async function invoices(args, { main, render }) {
  const pay = async (inv, btn) => {
    btn.disabled = true; btn.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Ödeme alınıyor');
    await delay(900);
    await store.payInvoice(inv.id);
    toast(`${inv.no} ödendi (simülasyon).`);
  };
  if (args[0]) {
    const inv = await store.getInvoice(args[0]).catch(() => null);
    if (!inv || inv.customerId !== CID) { main.append(backLink('#/faturalar', 'Faturalar'), emptyState('Fatura bulunamadı.')); return; }
    const payBtn = inv.status !== 'paid' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: (e) => pay(inv, e.currentTarget) }, 'Öde') : null;
    main.append(backLink('#/faturalar', 'Faturalar'), pageHead(`Fatura ${inv.no}`, `Düzenleme: ${fmtDate(inv.issuedAt)}`, badge(inv.status, LABELS.invoice[inv.status]), payBtn),
      card('Detay', dl([['Düzenleme tarihi', fmtDate(inv.issuedAt)], ['Son ödeme tarihi', fmtDate(inv.dueAt)], ['Ödeme tarihi', fmtDate(inv.paidAt)]]),
        table(['Kalem', 'Tutar'], inv.items.map((i) => [i.desc, money(i.amount)]).concat([[h('strong', null, 'Toplam'), h('strong', null, money(inv.total))]]), 'Fatura kalemleri'),
        h('div', { class: 'chart-note mt' }, sampleTag())));
    return;
  }
  const list = await store.listInvoices({ customerId: CID });
  main.append(pageHead('Faturalar', 'Fatura geçmişiniz ve ödeme durumları.'),
    list.length ? table(['Fatura no', 'Tarih', 'Son ödeme', '>Tutar', 'Durum', ''], list.map((i) => [
      h('a', { href: `#/faturalar/${i.id}` }, i.no), fmtDate(i.issuedAt), fmtDate(i.dueAt), money(i.total), badge(i.status, LABELS.invoice[i.status]),
      h('span', { class: 'row' }, h('a', { class: 'btn btn-ghost btn-sm', href: `#/faturalar/${i.id}` }, 'Detay'),
        i.status !== 'paid' ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: (e) => pay(i, e.currentTarget) }, 'Öde') : null)]), 'Faturalar') : emptyState('Fatura yok.'));
}

async function support(args, { main }) {
  const mine = (t) => t.customerId === CID;
  if (args[0] === 'yeni') {
    const subject = h('input', { type: 'text', maxlength: 120, required: true });
    const dept = h('select', null, option('Teknik', 'Teknik destek'), option('Muhasebe', 'Muhasebe'), option('Satış', 'Satış'), option('Veri Merkezi', 'Veri merkezi'));
    const prio = h('select', null, option('low', 'Düşük'), option('normal', 'Normal', true), option('high', 'Yüksek'));
    const msg = h('textarea', { rows: 5, maxlength: 2000, required: true });
    const err = h('p', { class: 'err', role: 'alert' });
    main.append(backLink('#/destek', 'Destek talepleri'), pageHead('Yeni destek talebi', 'Konunuzu ve ayrıntıları paylaşın; ekibimiz en kısa sürede yanıtlar.'),
      h('form', { class: 'panel-form', novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (!subject.value.trim() || !msg.value.trim()) { err.textContent = 'Konu ve mesaj zorunludur.'; return; }
        const t = await store.createTicket({ customerId: CID, subject: subject.value.trim(), dept: dept.value, priority: prio.value, message: msg.value.trim() });
        toast('Destek talebi oluşturuldu.');
        window.location.hash = `#/destek/${t.id}`;
      } }, field('Konu', subject), h('div', { class: 'filters' }, field('Departman', dept), field('Öncelik', prio)), field('Mesaj', msg), err,
      h('div', null, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Gönder'))));
    return;
  }
  if (args[0]) {
    const t = await store.getTicket(args[0]).catch(() => null);
    if (!t || !mine(t)) { main.append(backLink('#/destek', 'Destek talepleri'), emptyState('Talep bulunamadı.')); return; }
    const text = h('textarea', { rows: 4, maxlength: 2000 });
    const err = h('p', { class: 'err', role: 'alert' });
    main.append(backLink('#/destek', 'Destek talepleri'),
      pageHead(t.subject, `${t.dept} - Öncelik: ${LABELS.priority[t.priority]} - ${fmtDateTime(t.createdAt)}`, badge(t.status, LABELS.ticket[t.status])),
      card('Yazışma', threadView(t.messages, { customer: 'Siz', admin: 'CORENETWORK Destek' }),
        h('div', { class: 'composer mt' }, t.status === 'closed'
          ? h('div', { class: 'stack' }, h('p', { class: 'notice info' }, 'Bu talep kapatıldı. Yanıt yazmak için talebi yeniden açın.'),
            h('div', null, h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => store.setTicketStatus(t.id, 'open') }, 'Talebi yeniden aç')))
          : h('form', { class: 'panel-form', novalidate: true, onsubmit: async (e) => {
            e.preventDefault();
            if (!text.value.trim()) { err.textContent = 'Mesaj boş olamaz.'; return; }
            await store.replyTicket(t.id, 'customer', text.value.trim());
            toast('Yanıtınız gönderildi.');
          } }, field('Yanıtınız', text), err,
          h('div', { class: 'row' }, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Yanıtla'),
            h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { if (window.confirm('Bu destek talebini kapatmak istiyor musunuz?')) store.setTicketStatus(t.id, 'closed'); } }, 'Talebi kapat'))))));
    return;
  }
  const list = await store.listTickets({ customerId: CID });
  main.append(pageHead('Destek', 'Destek taleplerinizi oluşturun ve takip edin.', h('a', { class: 'btn btn-primary btn-sm', href: '#/destek/yeni' }, 'Yeni talep')),
    list.length ? table(['Konu', 'Departman', 'Öncelik', 'Durum', 'Güncelleme'], list.map((t) => [
      h('a', { href: `#/destek/${t.id}` }, t.subject), t.dept, LABELS.priority[t.priority], badge(t.status, LABELS.ticket[t.status]), fmtDateTime(t.updatedAt)]), 'Destek talepleri') : emptyState('Destek talebiniz yok.'));
}

async function account(_a, { main }) {
  const c = await store.getCustomer(CID);
  const p = c.profile;
  const inputs = {
    company: h('input', { type: 'text', value: c.name, disabled: true }),
    contactName: h('input', { type: 'text', value: p.contactName, maxlength: 80 }),
    email: h('input', { type: 'email', value: p.email, maxlength: 120 }),
    phone: h('input', { type: 'text', value: p.phone, maxlength: 40 }),
    address: h('input', { type: 'text', value: p.address, maxlength: 200 }),
  };
  const cur = h('input', { type: 'password', autocomplete: 'current-password' });
  const n1 = h('input', { type: 'password', autocomplete: 'new-password' });
  const n2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const perr = h('p', { class: 'err', role: 'alert' });
  const cn = h('input', { type: 'text', maxlength: 80 });
  const cr = h('input', { type: 'text', maxlength: 60 });
  const ce = h('input', { type: 'email', maxlength: 120 });
  const cerr = h('p', { class: 'err', role: 'alert' });
  main.append(pageHead('Hesabım', 'Profil bilgileriniz, şifre ve iletişim kişileri.'),
    h('div', { class: 'grid-cards' },
      card('Profil', h('form', { class: 'panel-form', onsubmit: async (e) => {
        e.preventDefault();
        await store.updateProfile(CID, { contactName: inputs.contactName.value.trim(), email: inputs.email.value.trim(), phone: inputs.phone.value.trim(), address: inputs.address.value.trim() });
        toast('Profil kaydedildi.');
      } }, field('Firma', inputs.company), field('Yetkili kişi', inputs.contactName), field('E-posta', inputs.email), field('Telefon', inputs.phone), field('Adres', inputs.address),
        h('div', null, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Kaydet')))),
      card('Şifre değiştir (demo)', h('form', { class: 'panel-form', novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        perr.textContent = '';
        if (!cur.value) { perr.textContent = 'Mevcut şifreyi girin.'; return; }
        if (n1.value.length < 6) { perr.textContent = 'Yeni şifre en az 6 karakter olmalıdır.'; return; }
        if (n1.value !== n2.value) { perr.textContent = 'Yeni şifreler eşleşmiyor.'; return; }
        cur.value = n1.value = n2.value = '';
        toast('Şifre değişikliği simüle edildi; demo şifresi değişmedi.');
      } }, field('Mevcut şifre', cur), field('Yeni şifre', n1), field('Yeni şifre (tekrar)', n2), perr,
        h('div', null, h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Şifreyi değiştir'))))),
    card('İletişim kişileri',
      c.contacts.length ? h('div', { class: 'list' }, c.contacts.map((k) => h('div', { class: 'list-item' },
        h('div', null, h('p', null, h('strong', null, k.name), ` (${k.role})`), h('p', { class: 'sub' }, `${k.email} ${k.phone}`)),
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => { if (window.confirm(`${k.name} kişisini silmek istiyor musunuz?`)) store.removeContact(CID, k.id); } }, 'Sil')))) : emptyState('Kişi yok.'),
      h('form', { class: 'panel-form mt', novalidate: true, onsubmit: async (e) => {
        e.preventDefault();
        if (!cn.value.trim()) { cerr.textContent = 'Ad soyad zorunludur.'; return; }
        await store.addContact(CID, { name: cn.value.trim(), role: cr.value.trim() || 'Kişi', email: ce.value.trim(), phone: '' });
      } }, h('div', { class: 'filters' }, field('Ad soyad', cn), field('Görev', cr), field('E-posta', ce)), cerr,
        h('div', null, h('button', { class: 'btn btn-ghost btn-sm', type: 'submit' }, 'Kişi ekle')))));
}

const shell = {
  groups: [
    { cap: 'Genel', items: [{ route: 'genel', label: 'Genel bakış', icon: 'grid' }] },
    { cap: 'Hizmetler ve ödemeler', items: [{ route: 'hizmetler', label: 'Hizmetlerim', icon: 'server' }, { route: 'faturalar', label: 'Faturalar', icon: 'receipt' }] },
    { cap: 'Destek', items: [{ route: 'destek', label: 'Destek', icon: 'chat' }] },
    { cap: 'Hesap', items: [{ route: 'hesap', label: 'Hesabım', icon: 'user' }] },
  ],
  user: { name: 'Ayşe Demir', email: 'musteri@demo.local' },
  // Bell items: latest announcements and answered tickets.
  notify: async () => {
    const [anns, tix] = await Promise.all([store.listAnnouncements(), store.listTickets({ customerId: CID })]);
    return [...tix.filter((t) => t.status === 'answered').map((t) => ({ text: `Yanıtlandı: ${t.subject}`, href: `#/destek/${t.id}` })),
      ...anns.slice(0, 2).map((a) => ({ text: a.title, href: '#/genel' }))];
  },
};

createApp({ role: 'customer', defaultRoute: 'genel', shell, routes: { genel: overview, hizmetler: services, faturalar: invoices, destek: support, hesap: account } });
