// ============================================================================
// DEMO SEED DATA (all values are fictitious sample data, shown as "Ornek veri").
//
// Entity shapes (plain JSON, stable string ids, field names English). These are
// the shapes a future server-side API is expected to return as well.
//
//   customer     { id, name, status: 'active'|'suspended', city, since, plan,
//                  profile: { taxNo, address, phone, email, contactName },
//                  contacts: [ { id, name, role, email, phone } ] }
//   service      { id, customerId, type: 'colo'|'vds'|'internet', name,
//                  status: 'active'|'suspended', mrr (TRY per month), since,
//                  colo:     { rackId, units, powerKw }
//                  vds:      { power: 'running'|'stopped', ip, os, vcpu, ramGb, diskGb,
//                              usage: { cpu, ram, disk } (percent) }
//                  internet: { lineState: 'up'|'down', downMbps, upMbps, ip, uptimePct,
//                              dailyGb: [30 numbers] } }
//   order        { id, customerId, type, title, plan, mrr, note, status:
//                  'pending'|'approved'|'rejected', createdAt }
//   invoice      { id, customerId, no, issuedAt, dueAt, status: 'paid'|'unpaid'|'overdue',
//                  paidAt|null, items: [ { desc, amount } ], total }
//   ticket       { id, customerId, subject, dept, priority: 'low'|'normal'|'high',
//                  status: 'open'|'answered'|'closed', createdAt, updatedAt,
//                  messages: [ { id, from: 'customer'|'admin', text, at } ] }
//   announcement { id, title, text, createdAt }
//   rack         { id, totalU, usedU, powerKw, tempC }
//   link         { id, name, capacityGbps, usagePct, status: 'up'|'degraded'|'down' }
//   alarm        { id, severity: 'critical'|'warning'|'info', source, text, at, acked }
//   usage        { bandwidth24: [24 Mbps], power24: [24 kW], customerId }
//
// External reference fields (all null in the demo). They are reserved for the planned
// billing/client/ticket platform (WHMCS) and virtualization platform (Proxmox VE) integration:
//   customer.whmcsClientId, service.whmcsServiceId, order.whmcsOrderId,
//   invoice.whmcsInvoiceId, ticket.whmcsTicketId, announcement.whmcsAnnouncementId
//   vds service: provisioning { provider: 'proxmox', node: null, vmid: null, status: 'demo' }
// Nothing is integrated yet; these fields only mark where the mapping will live.
//
// Timestamps are ISO 8601 strings. Money is a number in TRY.
// ============================================================================

export const DEMO_CUSTOMER_ID = 'c1';

// Small deterministic PRNG so the seeded charts look the same on every reset.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n) => Math.round(n * 10) / 10;

export function createSeed(now = Date.now()) {
  const rnd = mulberry32(20261023);
  const at = (days, hours = 0) => new Date(now - days * 864e5 - hours * 36e5).toISOString();
  const ahead = (days) => new Date(now + days * 864e5).toISOString();
  const series = (n, base, amp, noise, phase = 0) =>
    Array.from({ length: n }, (_, i) => round1(Math.max(0, base + amp * Math.sin((i / n) * Math.PI * 2 + phase) + (rnd() - 0.5) * noise)));

  const customers = [
    { id: 'c1', name: 'Örnek Teknoloji A.Ş.', status: 'active', city: 'İstanbul', since: at(540), plan: 'Kurumsal',
      profile: { taxNo: '0000000000', address: 'Örnek Mah. Demo Cad. No: 1, İstanbul', phone: '+90 (000) 000 00 01', email: 'musteri@demo.local', contactName: 'Ayşe Demir' },
      contacts: [
        { id: 'p1', name: 'Ayşe Demir', role: 'Yetkili', email: 'ayse@demo.local', phone: '+90 (000) 000 00 01' },
        { id: 'p2', name: 'Mehmet Kaya', role: 'Teknik iletişim', email: 'mehmet@demo.local', phone: '+90 (000) 000 00 02' },
      ] },
    { id: 'c2', name: 'Mavi Yazılım Ltd.', status: 'active', city: 'Ankara', since: at(410), plan: 'Standart',
      profile: { taxNo: '0000000000', address: 'Örnek Mah., Ankara', phone: '+90 (000) 000 00 03', email: 'info@mavi.demo.local', contactName: 'Can Arslan' }, contacts: [] },
    { id: 'c3', name: 'Delta Lojistik', status: 'active', city: 'İzmir', since: at(300), plan: 'Kurumsal',
      profile: { taxNo: '0000000000', address: 'Örnek Mah., İzmir', phone: '+90 (000) 000 00 04', email: 'bt@delta.demo.local', contactName: 'Elif Şahin' }, contacts: [] },
    { id: 'c4', name: 'Anadolu Medya', status: 'active', city: 'Bursa', since: at(220), plan: 'Standart',
      profile: { taxNo: '0000000000', address: 'Örnek Mah., Bursa', phone: '+90 (000) 000 00 05', email: 'it@anadolu.demo.local', contactName: 'Burak Yıldız' }, contacts: [] },
    { id: 'c5', name: 'Kuzey Eğitim Kurumları', status: 'active', city: 'Samsun', since: at(120), plan: 'Standart',
      profile: { taxNo: '0000000000', address: 'Örnek Mah., Samsun', phone: '+90 (000) 000 00 06', email: 'bilgi@kuzey.demo.local', contactName: 'Zeynep Aydın' }, contacts: [] },
    { id: 'c6', name: 'Yıldız Perakende', status: 'suspended', city: 'Antalya', since: at(700), plan: 'Standart',
      profile: { taxNo: '0000000000', address: 'Örnek Mah., Antalya', phone: '+90 (000) 000 00 07', email: 'muhasebe@yildiz.demo.local', contactName: 'Deniz Koç' }, contacts: [] },
  ];

  const dailyGb = (base) => series(30, base, base * 0.25, base * 0.3);
  const services = [
    { id: 'svc-1', customerId: 'c1', type: 'colo', name: 'Co-location - Yarım Raf', status: 'active', mrr: 18500, since: at(540),
      colo: { rackId: 'R-04', units: 21, powerKw: 3.2 } },
    { id: 'svc-2', customerId: 'c1', type: 'vds', name: 'VDS Orta (vds-01)', status: 'active', mrr: 1450, since: at(400),
      vds: { power: 'running', ip: '203.0.113.24', os: 'Ubuntu 22.04 LTS', vcpu: 4, ramGb: 8, diskGb: 160, usage: { cpu: 34, ram: 58, disk: 41 } } },
    { id: 'svc-3', customerId: 'c1', type: 'internet', name: 'Fiber İnternet - Merkez Ofis', status: 'active', mrr: 3200, since: at(380),
      internet: { lineState: 'up', downMbps: 500, upMbps: 500, ip: '198.51.100.8/29', uptimePct: 99.97, dailyGb: dailyGb(95) } },
    { id: 'svc-4', customerId: 'c2', type: 'vds', name: 'VDS Büyük (vds-02)', status: 'active', mrr: 2900, since: at(300),
      vds: { power: 'running', ip: '203.0.113.31', os: 'Debian 12', vcpu: 8, ramGb: 16, diskGb: 320, usage: { cpu: 52, ram: 71, disk: 63 } } },
    { id: 'svc-5', customerId: 'c3', type: 'colo', name: 'Co-location - Tam Raf', status: 'active', mrr: 34000, since: at(290),
      colo: { rackId: 'R-02', units: 42, powerKw: 6.1 } },
    { id: 'svc-6', customerId: 'c3', type: 'internet', name: 'Radyolink - Depo', status: 'active', mrr: 4100, since: at(250),
      internet: { lineState: 'up', downMbps: 100, upMbps: 100, ip: '198.51.100.40/30', uptimePct: 99.62, dailyGb: dailyGb(40) } },
    { id: 'svc-7', customerId: 'c4', type: 'internet', name: 'Fiber İnternet - Stüdyo', status: 'active', mrr: 3900, since: at(200),
      internet: { lineState: 'up', downMbps: 1000, upMbps: 1000, ip: '198.51.100.64/29', uptimePct: 99.9, dailyGb: dailyGb(160) } },
    { id: 'svc-8', customerId: 'c5', type: 'colo', name: 'Co-location - Çeyrek Raf', status: 'active', mrr: 11200, since: at(110),
      colo: { rackId: 'R-06', units: 10, powerKw: 1.8 } },
    { id: 'svc-9', customerId: 'c6', type: 'vds', name: 'VDS Küçük (vds-03)', status: 'suspended', mrr: 790, since: at(650),
      vds: { power: 'stopped', ip: '203.0.113.77', os: 'Ubuntu 22.04 LTS', vcpu: 2, ramGb: 4, diskGb: 80, usage: { cpu: 0, ram: 0, disk: 22 } } },
  ];

  const orders = [
    { id: 'ord-1', customerId: 'c2', type: 'vds', plan: 'vds-medium', title: 'VDS Orta (ek sunucu)', mrr: 1450, note: 'Test ortamı için ek sunucu.', status: 'pending', createdAt: at(1) },
    { id: 'ord-2', customerId: 'c5', type: 'colo', plan: 'colo-quarter', title: 'Co-location - Ek Çeyrek Raf', mrr: 11200, note: 'Yedekleme sistemi için.', status: 'pending', createdAt: at(2) },
    { id: 'ord-3', customerId: 'c4', type: 'internet', plan: 'fiber-500', title: 'Fiber İnternet - Yedek Hat', mrr: 3900, note: '', status: 'pending', createdAt: at(0, 5) },
    { id: 'ord-4', customerId: 'c3', type: 'internet', plan: 'radio-100', title: 'Radyolink - Şube', mrr: 4100, note: '', status: 'approved', createdAt: at(40) },
  ];

  const inv = (id, customerId, no, issuedDays, dueDays, status, items) => ({
    id, customerId, no, issuedAt: at(issuedDays), dueAt: dueDays >= 0 ? ahead(dueDays) : at(-dueDays),
    status, paidAt: status === 'paid' ? at(Math.max(0, issuedDays - 3)) : null,
    items, total: items.reduce((s, i) => s + i.amount, 0),
  });
  const invoices = [
    inv('inv-1', 'c1', 'DEMO-2026-0101', 80, -50, 'paid', [{ desc: 'Co-location - Yarım Raf', amount: 18500 }, { desc: 'VDS Orta (vds-01)', amount: 1450 }, { desc: 'Fiber İnternet', amount: 3200 }]),
    inv('inv-2', 'c1', 'DEMO-2026-0142', 50, -20, 'paid', [{ desc: 'Co-location - Yarım Raf', amount: 18500 }, { desc: 'VDS Orta (vds-01)', amount: 1450 }, { desc: 'Fiber İnternet', amount: 3200 }]),
    inv('inv-3', 'c1', 'DEMO-2026-0188', 20, -2, 'overdue', [{ desc: 'Co-location - Yarım Raf', amount: 18500 }, { desc: 'VDS Orta (vds-01)', amount: 1450 }, { desc: 'Fiber İnternet', amount: 3200 }]),
    inv('inv-4', 'c1', 'DEMO-2026-0230', 3, 12, 'unpaid', [{ desc: 'Ek IP adresi (/29)', amount: 600 }, { desc: 'Uzaktan el hizmeti (2 saat)', amount: 1200 }]),
    inv('inv-5', 'c2', 'DEMO-2026-0189', 20, 5, 'unpaid', [{ desc: 'VDS Büyük (vds-02)', amount: 2900 }]),
    inv('inv-6', 'c3', 'DEMO-2026-0190', 20, 5, 'paid', [{ desc: 'Co-location - Tam Raf', amount: 34000 }, { desc: 'Radyolink - Depo', amount: 4100 }]),
    inv('inv-7', 'c4', 'DEMO-2026-0191', 22, -3, 'overdue', [{ desc: 'Fiber İnternet - Stüdyo', amount: 3900 }]),
    inv('inv-8', 'c5', 'DEMO-2026-0192', 18, 8, 'unpaid', [{ desc: 'Co-location - Çeyrek Raf', amount: 11200 }]),
    inv('inv-9', 'c6', 'DEMO-2026-0150', 60, -30, 'overdue', [{ desc: 'VDS Küçük (vds-03)', amount: 790 }]),
  ];

  const tickets = [
    { id: 'tkt-1', customerId: 'c1', subject: 'VDS disk alanı artırımı', dept: 'Teknik', priority: 'normal', status: 'answered', createdAt: at(4), updatedAt: at(3),
      messages: [
        { id: 'm1', from: 'customer', text: 'vds-01 için disk alanını artırmak istiyoruz. Seçenekler nelerdir?', at: at(4) },
        { id: 'm2', from: 'admin', text: 'Merhaba, disk artırımı için seçenekleri hazırlıyoruz. Bu bir demo yanıtıdır.', at: at(3) },
      ] },
    { id: 'tkt-2', customerId: 'c1', subject: 'Fatura bilgisi güncelleme', dept: 'Muhasebe', priority: 'low', status: 'closed', createdAt: at(30), updatedAt: at(28),
      messages: [
        { id: 'm3', from: 'customer', text: 'Fatura adresimiz değişti, güncelleyebilir misiniz?', at: at(30) },
        { id: 'm4', from: 'admin', text: 'Adres güncellendi. Demo yanıtı.', at: at(28) },
      ] },
    { id: 'tkt-3', customerId: 'c2', subject: 'Ağ bağlantısında yavaşlık', dept: 'Teknik', priority: 'high', status: 'open', createdAt: at(0, 6), updatedAt: at(0, 6),
      messages: [{ id: 'm5', from: 'customer', text: 'Akşam saatlerinde sunucuya erişim yavaşlıyor.', at: at(0, 6) }] },
    { id: 'tkt-4', customerId: 'c3', subject: 'Raf erişim izni', dept: 'Veri Merkezi', priority: 'normal', status: 'open', createdAt: at(1), updatedAt: at(1),
      messages: [{ id: 'm6', from: 'customer', text: 'Yarın iki kişilik ekip için raf erişimi talep ediyoruz.', at: at(1) }] },
    { id: 'tkt-5', customerId: 'c4', subject: 'Hat kesintisi bildirimi', dept: 'Teknik', priority: 'high', status: 'answered', createdAt: at(6), updatedAt: at(5),
      messages: [
        { id: 'm7', from: 'customer', text: 'Dün gece kısa süreli kesinti yaşandı.', at: at(6) },
        { id: 'm8', from: 'admin', text: 'Kayıtları inceledik, demo yanıtı.', at: at(5) },
      ] },
  ];

  const announcements = [
    { id: 'ann-1', title: 'Planlı bakım duyurusu (örnek)', text: 'Önümüzdeki hafta sonu kısa süreli ağ bakımı planlanmıştır. Bu bir demo duyurusudur.', createdAt: at(2) },
    { id: 'ann-2', title: 'Yeni destek paneli (örnek)', text: 'Destek talepleriniz artık panel üzerinden takip edilebilir. Bu bir demo duyurusudur.', createdAt: at(9) },
  ];

  const racks = [
    { id: 'R-01', totalU: 42, usedU: 30, powerKw: 4.8, tempC: 24.5 },
    { id: 'R-02', totalU: 42, usedU: 42, powerKw: 6.1, tempC: 26.2 },
    { id: 'R-03', totalU: 42, usedU: 18, powerKw: 2.9, tempC: 23.8 },
    { id: 'R-04', totalU: 42, usedU: 21, powerKw: 3.2, tempC: 24.1 },
    { id: 'R-05', totalU: 42, usedU: 36, powerKw: 5.4, tempC: 25.6 },
    { id: 'R-06', totalU: 42, usedU: 10, powerKw: 1.8, tempC: 23.2 },
    { id: 'R-07', totalU: 42, usedU: 0, powerKw: 0.2, tempC: 22.9 },
    { id: 'R-08', totalU: 42, usedU: 24, powerKw: 3.7, tempC: 24.9 },
  ];

  const links = [
    { id: 'lnk-1', name: 'Uplink-1 (Transit A)', capacityGbps: 10, usagePct: 58, status: 'up' },
    { id: 'lnk-2', name: 'Uplink-2 (Transit B)', capacityGbps: 10, usagePct: 41, status: 'up' },
    { id: 'lnk-3', name: 'Peering (IX)', capacityGbps: 10, usagePct: 66, status: 'up' },
    { id: 'lnk-4', name: 'Metro fiber halkası', capacityGbps: 100, usagePct: 22, status: 'up' },
    { id: 'lnk-5', name: 'Radyolink omurga', capacityGbps: 1, usagePct: 84, status: 'degraded' },
  ];

  const alarms = [
    { id: 'alm-1', severity: 'warning', source: 'Radyolink omurga', text: 'Bağlantı kullanımı eşik değerin üzerinde.', at: at(0, 2), acked: false },
    { id: 'alm-2', severity: 'critical', source: 'R-02', text: 'Raf sıcaklığı yükseliyor.', at: at(0, 4), acked: false },
    { id: 'alm-3', severity: 'info', source: 'Uplink-2 (Transit B)', text: 'Planlı bakım penceresi tamamlandı.', at: at(1), acked: true },
  ];

  const usage = {
    customerId: 'c1',
    bandwidth24: series(24, 210, 120, 60, -1),
    power24: series(24, 3.2, 0.25, 0.12, 0.6),
  };

  customers.forEach((x) => { x.whmcsClientId = null; });
  services.forEach((x) => {
    x.whmcsServiceId = null;
    if (x.vds) x.provisioning = { provider: 'proxmox', node: null, vmid: null, status: 'demo' };
  });
  orders.forEach((x) => { x.whmcsOrderId = null; });
  invoices.forEach((x) => { x.whmcsInvoiceId = null; });
  tickets.forEach((x) => { x.whmcsTicketId = null; });
  announcements.forEach((x) => { x.whmcsAnnouncementId = null; });

  return {
    version: 1,
    seq: { tkt: 5, msg: 8, inv: 9, ord: 4, ann: 2, svc: 9, alm: 3, ct: 2 },
    customers, services, orders, invoices, tickets, announcements, racks, links, alarms, usage,
    revenue6: [66000, 69500, 72400, 75800, 77900, 0], // last item is replaced by the computed MRR (79,250 in the seed)
  };
}
