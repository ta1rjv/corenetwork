// ============================================================================
// DEMO STORE - the ONLY data interface used by the panels.
//
// Client-side demo only: state lives in this browser's localStorage under one
// namespaced key (no server, no real data). Every function is async and returns
// plain JSON copies, so a later server-side version can replace this module
// with HTTP calls that keep the same function names and entity shapes
// (documented in js/demo-data.js). Panel modules must not touch localStorage.
// ============================================================================
import { createSeed, DEMO_CUSTOMER_ID } from './demo-data.js';

const KEY = 'corenetwork-demo:v1';
let state = null;
let memoryRaw = null; // in-memory fallback when localStorage is unavailable
const listeners = new Set();

const clone = (v) => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

function readRaw() {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v) return v;
  } catch (e) { /* blocked: use memory */ }
  return memoryRaw;
}

function load() {
  const raw = readRaw();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) { state = parsed; return; }
    } catch (e) { /* corrupt: reseed */ }
  }
  state = createSeed();
  save();
}

function save() {
  memoryRaw = JSON.stringify(state);
  try { window.localStorage.setItem(KEY, memoryRaw); } catch (e) { /* memory only */ }
}

function ensure() { load(); return state; }

function emit(source) { listeners.forEach((fn) => { try { fn(source); } catch (e) { /* listener error must not break the store */ } }); }

// Other tabs: reload and notify.
window.addEventListener('storage', (e) => {
  if (e.key !== KEY && e.key !== null) return;
  memoryRaw = e.newValue;
  load();
  emit('remote');
});

/** Subscribes to data changes. fn('local'|'remote'). Returns an unsubscribe function. */
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function mutate(fn) {
  const s = ensure();
  const result = fn(s);
  save();
  emit('local');
  return clone(result === undefined ? null : result);
}

function nextId(prefix) {
  state.seq[prefix] = (state.seq[prefix] || 0) + 1;
  return `${prefix}-${state.seq[prefix]}`;
}

function find(list, id) {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`Kayıt bulunamadı: ${id}`);
  return item;
}

export { DEMO_CUSTOMER_ID };

// ---------------------------------------------------------------- reads ----
export async function listCustomers() { return clone(ensure().customers); }
export async function getCustomer(id) { return clone(find(ensure().customers, id)); }
export async function listServices(filter = {}) {
  return clone(ensure().services.filter((s) => !filter.customerId || s.customerId === filter.customerId));
}
export async function getService(id) { return clone(find(ensure().services, id)); }
export async function listOrders(filter = {}) {
  return clone(ensure().orders.filter((o) => (!filter.customerId || o.customerId === filter.customerId) && (!filter.status || o.status === filter.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}
export async function listInvoices(filter = {}) {
  return clone(ensure().invoices.filter((i) => (!filter.customerId || i.customerId === filter.customerId) && (!filter.status || i.status === filter.status))
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)));
}
export async function getInvoice(id) { return clone(find(ensure().invoices, id)); }
export async function listTickets(filter = {}) {
  return clone(ensure().tickets.filter((t) => (!filter.customerId || t.customerId === filter.customerId) && (!filter.status || t.status === filter.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}
export async function getTicket(id) { return clone(find(ensure().tickets, id)); }
export async function listAnnouncements() { return clone(ensure().announcements.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))); }
export async function listRacks() { return clone(ensure().racks); }
export async function listLinks() { return clone(ensure().links); }
export async function listAlarms() { return clone(ensure().alarms.slice().sort((a, b) => b.at.localeCompare(a.at))); }
export async function getUsage(customerId) {
  const u = ensure().usage;
  return clone(u.customerId === customerId ? u : { customerId, bandwidth24: [], power24: [] });
}

// Simulated live metrics: a bounded random walk kept in memory (not persisted).
let live = null;
function seedLive(s) {
  const base = s.links.slice(0, 3).reduce((a, l) => a + l.usagePct, 0) / 3;
  const power = s.racks.reduce((a, r) => a + r.powerKw, 0);
  live = { uplink: Array.from({ length: 30 }, () => base), power: Array.from({ length: 30 }, () => power) };
}
const walk = (arr, step, lo, hi) => {
  const v = arr[arr.length - 1] + (Math.random() - 0.5) * step;
  arr.push(Math.round(Math.min(hi, Math.max(lo, v)) * 10) / 10);
  arr.shift();
};

/** Admin KPIs plus simulated live series. Each call advances the simulation by one step. */
export async function getMetrics() {
  const s = ensure();
  if (!live) seedLive(s);
  walk(live.uplink, 6, 20, 95);
  walk(live.power, 1.2, 10, 60);
  const mrr = s.services.filter((x) => x.status === 'active').reduce((a, x) => a + x.mrr, 0);
  const totalU = s.racks.reduce((a, r) => a + r.totalU, 0);
  const usedU = s.racks.reduce((a, r) => a + r.usedU, 0);
  const revenue6 = s.revenue6.slice();
  revenue6[revenue6.length - 1] = mrr;
  return clone({
    customers: s.customers.length,
    activeCustomers: s.customers.filter((c) => c.status === 'active').length,
    mrr,
    openTickets: s.tickets.filter((t) => t.status !== 'closed').length,
    pendingOrders: s.orders.filter((o) => o.status === 'pending').length,
    rackOccupancyPct: Math.round((usedU / totalU) * 100),
    uplinkPct: live.uplink[live.uplink.length - 1],
    powerKw: live.power[live.power.length - 1],
    uplinkHistory: live.uplink,
    powerHistory: live.power,
    revenue6,
    ticketsByStatus: ['open', 'answered', 'closed'].map((k) => ({ status: k, count: s.tickets.filter((t) => t.status === k).length })),
  });
}

// --------------------------------------------------------------- writes ----
export async function createTicket({ customerId, subject, dept, priority, message }) {
  return mutate((s) => {
    const t = { id: nextId('tkt'), customerId, subject, dept, priority, status: 'open', createdAt: now(), updatedAt: now(),
      messages: [{ id: nextId('msg'), from: 'customer', text: message, at: now() }] };
    s.tickets.push(t);
    return t;
  });
}

export async function replyTicket(id, from, text) {
  return mutate((s) => {
    const t = find(s.tickets, id);
    t.messages.push({ id: nextId('msg'), from, text, at: now() });
    t.status = from === 'admin' ? 'answered' : 'open';
    t.updatedAt = now();
    return t;
  });
}

export async function setTicketStatus(id, status) {
  return mutate((s) => { const t = find(s.tickets, id); t.status = status; t.updatedAt = now(); return t; });
}

export async function payInvoice(id) {
  return mutate((s) => { const i = find(s.invoices, id); i.status = 'paid'; i.paidAt = now(); return i; });
}

export async function createInvoice({ customerId, desc, amount, dueAt }) {
  return mutate((s) => {
    const seq = 230 + (s.seq.inv = (s.seq.inv || 0) + 1);
    const i = { id: `inv-${s.seq.inv}`, customerId, no: `DEMO-2026-${String(seq).padStart(4, '0')}`, issuedAt: now(), dueAt,
      status: 'unpaid', paidAt: null, items: [{ desc, amount }], total: amount };
    s.invoices.push(i);
    return i;
  });
}

export async function setPowerState(serviceId, power) {
  return mutate((s) => { const v = find(s.services, serviceId); if (v.vds) v.vds.power = power; return v; });
}

export async function createOrder({ customerId, type, title, mrr, note }) {
  return mutate((s) => {
    const o = { id: nextId('ord'), customerId, type, title, mrr, note: note || '', status: 'pending', createdAt: now() };
    s.orders.push(o);
    return o;
  });
}

export async function approveOrder(id) {
  return mutate((s) => {
    const o = find(s.orders, id);
    if (o.status !== 'pending') return o;
    o.status = 'approved';
    const svc = { id: nextId('svc'), customerId: o.customerId, type: o.type, name: o.title, status: 'active', mrr: o.mrr, since: now() };
    if (o.type === 'vds') svc.vds = { power: 'running', ip: `203.0.113.${100 + s.seq.svc}`, os: 'Ubuntu 22.04 LTS', vcpu: 2, ramGb: 4, diskGb: 80, usage: { cpu: 5, ram: 12, disk: 10 } };
    if (o.type === 'colo') svc.colo = { rackId: 'R-07', units: 10, powerKw: 1.5 };
    if (o.type === 'internet') svc.internet = { lineState: 'up', downMbps: 100, upMbps: 100, ip: '198.51.100.120/30', uptimePct: 100, dailyGb: Array(30).fill(0) };
    s.services.push(svc);
    return o;
  });
}

export async function rejectOrder(id) {
  return mutate((s) => { const o = find(s.orders, id); if (o.status === 'pending') o.status = 'rejected'; return o; });
}

export async function setCustomerStatus(id, status) {
  return mutate((s) => {
    const c = find(s.customers, id);
    c.status = status;
    s.services.filter((x) => x.customerId === id).forEach((x) => { x.status = status === 'suspended' ? 'suspended' : 'active'; });
    return c;
  });
}

export async function updateProfile(id, profile) {
  return mutate((s) => { const c = find(s.customers, id); Object.assign(c.profile, profile); return c; });
}

export async function addContact(customerId, contact) {
  return mutate((s) => { const c = find(s.customers, customerId); c.contacts.push({ id: nextId('ct'), ...contact }); return c; });
}

export async function removeContact(customerId, contactId) {
  return mutate((s) => { const c = find(s.customers, customerId); c.contacts = c.contacts.filter((x) => x.id !== contactId); return c; });
}

export async function createAnnouncement({ title, text }) {
  return mutate((s) => { const a = { id: nextId('ann'), title, text, createdAt: now() }; s.announcements.push(a); return a; });
}

export async function deleteAnnouncement(id) {
  return mutate((s) => { s.announcements = s.announcements.filter((a) => a.id !== id); });
}

export async function ackAlarm(id) {
  return mutate((s) => { const a = find(s.alarms, id); a.acked = true; return a; });
}

/** Restores the seed data. */
export async function resetDemoData() {
  state = createSeed();
  live = null;
  save();
  emit('local');
}
